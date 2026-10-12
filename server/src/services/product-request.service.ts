import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { env } from '../config/env.js';
import { getDatabase, initMarketplaceTables } from '../db/database.js';
import { IProductRepository } from '../db/repositories/product.repository.js';
import {
  Product,
  ProductRequestDTO,
  ProductRequestStatus,
  RestockSubscriptionDTO,
  RestockSubscriptionStatus,
} from '../types/index.js';

export class RequestWorkflowError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code = 'REQUEST_WORKFLOW_ERROR', statusCode = 400) {
    super(message);
    this.name = 'RequestWorkflowError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const PRODUCT_REQUEST_CONFIRMATION_MESSAGE =
  "Thanks! We've recorded your request. We'll contact you when availability is confirmed.";

/**
 * Validates and normalizes an external URL (e.g., product request URL or external image URL)
 * while enforcing strict SSRF protections:
 * - Only allows http: and https: protocols
 * - Rejects embedded credentials (user:pass@host)
 * - Blocks localhost, loopback, link-local (169.254.x.x cloud metadata), private RFC1918 ranges,
 *   IPv6 loopback/unique-local, and internal hostnames (.local, .internal, .localhost)
 */
export function validateAndNormalizeExternalUrl(rawUrl: string | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new RequestWorkflowError(
      'A valid HTTP or HTTPS URL is required.',
      'INVALID_URL',
      400
    );
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    throw new RequestWorkflowError(
      'URL exceeds maximum allowed length (2048 characters).',
      'INVALID_URL',
      400
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new RequestWorkflowError(
      'Malformed URL. Please provide a full http:// or https:// product link.',
      'INVALID_URL',
      400
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new RequestWorkflowError(
      `Unsupported URL scheme '${parsed.protocol}'. Only http:// and https:// URLs are allowed.`,
      'UNSAFE_URL_SCHEME',
      400
    );
  }

  if (parsed.username || parsed.password) {
    throw new RequestWorkflowError(
      'URLs containing embedded credentials are not allowed.',
      'SSRF_BLOCKED',
      400
    );
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    throw new RequestWorkflowError(
      'Localhost and internal network hostnames are blocked for security (SSRF protection).',
      'SSRF_BLOCKED',
      400
    );
  }

  // Block raw integer/hex/octal IP representations like http://2130706433 or http://0x7f000001
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(hostname)) {
    throw new RequestWorkflowError(
      'Numeric IP encoding is blocked for security (SSRF protection).',
      'SSRF_BLOCKED',
      400
    );
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    const parts = hostname.split('.').map((p) => parseInt(p, 10));
    const [a, b] = parts;
    const isLoopback = a === 127 || a === 0;
    const isPrivate10 = a === 10;
    const isPrivate172 = a === 172 && b >= 16 && b <= 31;
    const isPrivate192 = a === 192 && b === 168;
    const isLinkLocalOrMetadata = a === 169 && b === 254;
    const isCarrierNat = a === 100 && b >= 64 && b <= 127;

    if (
      isLoopback ||
      isPrivate10 ||
      isPrivate172 ||
      isPrivate192 ||
      isLinkLocalOrMetadata ||
      isCarrierNat
    ) {
      throw new RequestWorkflowError(
        'Private, loopback, and link-local IPv4 addresses are blocked for security (SSRF protection).',
        'SSRF_BLOCKED',
        400
      );
    }
  } else if (ipVersion === 6) {
    const norm6 = hostname.toLowerCase();
    if (
      norm6 === '::1' ||
      norm6 === '::' ||
      norm6.startsWith('fe80:') ||
      norm6.startsWith('fc') ||
      norm6.startsWith('fd') ||
      norm6.includes('127.0.0.1') ||
      norm6.includes('169.254.')
    ) {
      throw new RequestWorkflowError(
        'Loopback and private IPv6 addresses are blocked for security (SSRF protection).',
        'SSRF_BLOCKED',
        400
      );
    }
  }

  if (!hostname.includes('.')) {
    throw new RequestWorkflowError(
      'URL must point to a valid public domain name.',
      'SSRF_BLOCKED',
      400
    );
  }

  // Strip fragment for normalization
  parsed.hash = '';
  return parsed.toString();
}

interface RawRestockRow {
  id: string;
  product_id: string;
  variant_id: string;
  variant_label: string | null;
  selected_size: string | null;
  selected_color: string | null;
  user_id: string | null;
  session_id: string;
  email: string;
  consent_given: number;
  status: RestockSubscriptionStatus;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RawProductRequestRow {
  id: string;
  source_url: string;
  normalized_url: string;
  requested_name: string | null;
  category_hint: string | null;
  description_notes: string | null;
  desired_size: string | null;
  desired_color: string | null;
  desired_variant: string | null;
  user_id: string | null;
  session_id: string;
  contact_email: string;
  consent_given: number;
  status: ProductRequestStatus;
  linked_product_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export class ProductRequestService {
  private db: Database.Database;

  constructor(
    private productRepo: IProductRepository,
    db?: Database.Database
  ) {
    this.db = db || getDatabase();
    initMarketplaceTables(this.db);
  }

  private mapRestockRowToDTO(row: RawRestockRow): RestockSubscriptionDTO {
    const product = this.productRepo.findById(row.product_id, { includeArchived: true });
    const providerConfigured = Boolean(env.NOTIFICATION_PROVIDER_CONFIGURED);

    let statusMessage = '';
    if (row.status === 'Notified') {
      statusMessage = `Availability notification marked as sent on ${row.notified_at || row.updated_at}.`;
    } else if (row.status === 'EligibleForNotification') {
      statusMessage = providerConfigured
        ? 'Product is back in stock! Notification is queued for delivery.'
        : 'Product is back in stock! Automatic email delivery is not configured on this server, so you can now purchase it directly.';
    } else if (row.status === 'Cancelled') {
      statusMessage = 'Restock subscription was cancelled.';
    } else {
      statusMessage = providerConfigured
        ? 'Restock request saved. You will be notified when stock is replenished.'
        : 'Your restock request has been saved. Note: Automatic email notifications are not yet configured on this server; you can check your subscription status here anytime.';
    }

    return {
      id: row.id,
      productId: row.product_id,
      productName: product?.name,
      variantId: row.variant_id || null,
      variantLabel: row.variant_label,
      selectedSize: row.selected_size,
      selectedColor: row.selected_color,
      userId: row.user_id,
      sessionId: row.session_id,
      email: row.email,
      consentGiven: Boolean(row.consent_given),
      status: row.status,
      notificationProviderConfigured: providerConfigured,
      statusMessage,
      notifiedAt: row.notified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapProductRequestRowToDTO(row: RawProductRequestRow): ProductRequestDTO {
    const isSynthesizedSearchUrl = row.source_url.startsWith('https://www.amazon.in/s?k=');
    return {
      id: row.id,
      sourceUrl: row.source_url,
      normalizedUrl: row.normalized_url,
      requestedName: row.requested_name,
      categoryHint: row.category_hint,
      descriptionNotes: row.description_notes,
      desiredSize: row.desired_size,
      desiredColor: row.desired_color,
      desiredVariant: row.desired_variant,
      userId: row.user_id,
      sessionId: row.session_id,
      contactEmail: row.contact_email,
      consentGiven: Boolean(row.consent_given),
      status: row.status,
      linkedProductId: row.linked_product_id,
      adminNotes: row.admin_notes,
      confirmationMessage: isSynthesizedSearchUrl
        ? 'Your product request has been saved in the request log for review.'
        : PRODUCT_REQUEST_CONFIRMATION_MESSAGE,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Subscribes a customer to restock notifications for an out-of-stock product or variant.
   * Never places an order or reserves stock.
   */
  public subscribeRestock(input: {
    productId: string;
    variantId?: string | null;
    selectedSize?: string | null;
    selectedColor?: string | null;
    userId?: string | null;
    sessionId: string;
    email: string;
    consentGiven?: boolean;
  }): RestockSubscriptionDTO {
    const productId = (input.productId || '').trim();
    if (!productId) {
      throw new RequestWorkflowError('Product ID is required.', 'INVALID_PRODUCT_ID', 400);
    }

    const product = this.productRepo.findById(productId, { includeArchived: true });
    if (!product) {
      throw new RequestWorkflowError(
        `Product '${productId}' not found.`,
        'PRODUCT_NOT_FOUND',
        404
      );
    }

    const sessionId = (input.sessionId || '').trim();
    if (!sessionId) {
      throw new RequestWorkflowError('Session ID is required.', 'INVALID_SESSION', 400);
    }

    const email = (input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new RequestWorkflowError(
        'A valid email address is required for restock notifications.',
        'INVALID_EMAIL',
        400
      );
    }

    if (input.consentGiven === false) {
      throw new RequestWorkflowError(
        'Consent is required to subscribe to restock notifications.',
        'CONSENT_REQUIRED',
        400
      );
    }

    let variantKey = input.variantId ? input.variantId.trim() : '';
    let variantLabel: string | null = null;
    let selectedSize = input.selectedSize ? input.selectedSize.trim() : null;
    let selectedColor = input.selectedColor ? input.selectedColor.trim() : null;

    if (variantKey && product.variants) {
      const matched = product.variants.find((v) => v.id === variantKey);
      if (!matched) {
        throw new RequestWorkflowError(
          `Variant '${variantKey}' not found for '${product.name}'.`,
          'INVALID_VARIANT',
          400
        );
      }
      variantLabel = matched.label;
      selectedSize = selectedSize || matched.size || null;
      selectedColor = selectedColor || matched.color || null;
    } else if ((selectedSize || selectedColor) && product.variants) {
      const matched = product.variants.find(
        (v) =>
          (!selectedSize || (v.size && v.size.toLowerCase() === selectedSize.toLowerCase())) &&
          (!selectedColor || (v.color && v.color.toLowerCase().includes(selectedColor.toLowerCase())))
      );
      if (matched) {
        variantKey = matched.id;
        variantLabel = matched.label;
      }
    }

    // Prevent duplicate active subscription for same email/user + product + variant
    const existingActive = this.db
      .prepare(
        `SELECT * FROM restock_subscriptions
         WHERE product_id = ?
           AND variant_id = ?
           AND status IN ('Subscribed', 'EligibleForNotification')
           AND (LOWER(email) = ? OR (user_id IS NOT NULL AND user_id = ?))
         LIMIT 1`
      )
      .get(productId, variantKey, email, input.userId || '') as RawRestockRow | undefined;

    if (existingActive) {
      throw new RequestWorkflowError(
        `You are already subscribed to restock notifications for '${product.name}'${variantLabel ? ` (${variantLabel})` : ''}.`,
        'DUPLICATE_RESTOCK_SUBSCRIPTION',
        409
      );
    }

    const id = `rstk_${randomUUID().slice(0, 12)}`;
    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO restock_subscriptions (
          id, product_id, variant_id, variant_label, selected_size, selected_color,
          user_id, session_id, email, consent_given, status, notified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Subscribed', NULL, ?, ?)`
      )
      .run(
        id,
        productId,
        variantKey,
        variantLabel,
        selectedSize,
        selectedColor,
        input.userId || null,
        sessionId,
        email,
        nowIso,
        nowIso
      );

    const created = this.db
      .prepare('SELECT * FROM restock_subscriptions WHERE id = ?')
      .get(id) as RawRestockRow;
    return this.mapRestockRowToDTO(created);
  }

  public getCustomerRestockSubscriptions(
    sessionId: string,
    userId?: string | null
  ): RestockSubscriptionDTO[] {
    const rows = userId
      ? (this.db
          .prepare(
            'SELECT * FROM restock_subscriptions WHERE user_id = ? OR (user_id IS NULL AND session_id = ?) ORDER BY created_at DESC'
          )
          .all(userId, sessionId) as RawRestockRow[])
      : (this.db
          .prepare(
            'SELECT * FROM restock_subscriptions WHERE session_id = ? AND user_id IS NULL ORDER BY created_at DESC'
          )
          .all(sessionId) as RawRestockRow[]);
    return rows.map((r) => this.mapRestockRowToDTO(r));
  }

  public cancelRestockSubscription(
    subscriptionId: string,
    actor: { userId?: string | null; sessionId?: string; isAdmin?: boolean }
  ): RestockSubscriptionDTO {
    const row = this.db
      .prepare('SELECT * FROM restock_subscriptions WHERE id = ?')
      .get((subscriptionId || '').trim()) as RawRestockRow | undefined;

    if (!row) {
      throw new RequestWorkflowError(
        'Restock subscription not found.',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    const ownsByUser = Boolean(actor.userId && row.user_id && actor.userId === row.user_id);
    const ownsBySession = Boolean(
      !row.user_id && actor.sessionId && actor.sessionId === row.session_id
    );

    if (!actor.isAdmin && !ownsByUser && !ownsBySession) {
      throw new RequestWorkflowError(
        'You may only cancel your own restock subscriptions.',
        'FORBIDDEN_OWNERSHIP',
        403
      );
    }

    const nowIso = new Date().toISOString();
    this.db
      .prepare('UPDATE restock_subscriptions SET status = \'Cancelled\', updated_at = ? WHERE id = ?')
      .run(nowIso, row.id);

    const updated = this.db
      .prepare('SELECT * FROM restock_subscriptions WHERE id = ?')
      .get(row.id) as RawRestockRow;
    return this.mapRestockRowToDTO(updated);
  }

  public listAllRestockSubscriptionsForAdmin(
    statusFilter?: RestockSubscriptionStatus
  ): RestockSubscriptionDTO[] {
    const rows = statusFilter
      ? (this.db
          .prepare(
            'SELECT * FROM restock_subscriptions WHERE status = ? ORDER BY created_at DESC'
          )
          .all(statusFilter) as RawRestockRow[])
      : (this.db
          .prepare('SELECT * FROM restock_subscriptions ORDER BY created_at DESC')
          .all() as RawRestockRow[]);
    return rows.map((r) => this.mapRestockRowToDTO(r));
  }

  public updateRestockSubscriptionByAdmin(
    subscriptionId: string,
    status: RestockSubscriptionStatus
  ): RestockSubscriptionDTO {
    const valid: RestockSubscriptionStatus[] = [
      'Subscribed',
      'EligibleForNotification',
      'Notified',
      'Cancelled',
    ];
    if (!valid.includes(status)) {
      throw new RequestWorkflowError(
        `Invalid subscription status '${status}'.`,
        'INVALID_STATUS',
        400
      );
    }

    const row = this.db
      .prepare('SELECT * FROM restock_subscriptions WHERE id = ?')
      .get((subscriptionId || '').trim()) as RawRestockRow | undefined;

    if (!row) {
      throw new RequestWorkflowError(
        'Restock subscription not found.',
        'SUBSCRIPTION_NOT_FOUND',
        404
      );
    }

    const nowIso = new Date().toISOString();
    const notifiedAt = status === 'Notified' ? nowIso : row.notified_at;
    this.db
      .prepare(
        'UPDATE restock_subscriptions SET status = ?, notified_at = ?, updated_at = ? WHERE id = ?'
      )
      .run(status, notifiedAt, nowIso, row.id);

    const updated = this.db
      .prepare('SELECT * FROM restock_subscriptions WHERE id = ?')
      .get(row.id) as RawRestockRow;
    return this.mapRestockRowToDTO(updated);
  }

  /**
   * Records a customer request for a product missing from the catalogue.
   * Applies strict SSRF & URL validation when a public URL is provided, or synthesizes a canonical
   * reference URL when only a product name is supplied.
   */
  public createProductRequest(input: {
    sourceUrl?: string;
    requestedName?: string;
    categoryHint?: string;
    descriptionNotes?: string;
    desiredSize?: string;
    desiredColor?: string;
    desiredVariant?: string;
    userId?: string | null;
    sessionId: string;
    contactEmail: string;
    consentGiven?: boolean;
  }): ProductRequestDTO {
    const rawSourceUrl = (input.sourceUrl || '').trim();
    const rawRequestedName = (input.requestedName || '').trim();

    const effectiveSourceUrl =
      rawSourceUrl.length > 0
        ? rawSourceUrl
        : rawRequestedName.length > 0
          ? `https://www.amazon.in/s?k=${encodeURIComponent(rawRequestedName)}`
          : '';

    const normalizedUrl = validateAndNormalizeExternalUrl(effectiveSourceUrl);

    const sessionId = (input.sessionId || '').trim();
    if (!sessionId) {
      throw new RequestWorkflowError('Session ID is required.', 'INVALID_SESSION', 400);
    }

    const contactEmail = (input.contactEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw new RequestWorkflowError(
        'A valid contact email address is required.',
        'INVALID_EMAIL',
        400
      );
    }

    if (input.consentGiven === false) {
      throw new RequestWorkflowError(
        'Consent to receive availability updates is required.',
        'CONSENT_REQUIRED',
        400
      );
    }

    // Prevent duplicate open request for the same URL and customer
    const existingDuplicate = this.db
      .prepare(
        `SELECT * FROM product_requests
         WHERE normalized_url = ?
           AND status IN ('Requested', 'Under Review')
           AND (LOWER(contact_email) = ? OR (user_id IS NOT NULL AND user_id = ?))
         LIMIT 1`
      )
      .get(normalizedUrl, contactEmail, input.userId || '') as
      | RawProductRequestRow
      | undefined;

    if (existingDuplicate) {
      throw new RequestWorkflowError(
        'You have already submitted an open request for this product URL.',
        'DUPLICATE_PRODUCT_REQUEST',
        409
      );
    }

    const id = `preq_${randomUUID().slice(0, 12)}`;
    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO product_requests (
          id, source_url, normalized_url, requested_name, category_hint, description_notes,
          desired_size, desired_color, desired_variant, user_id, session_id,
          contact_email, consent_given, status, linked_product_id, admin_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Requested', NULL, NULL, ?, ?)`
      )
      .run(
        id,
        effectiveSourceUrl,
        normalizedUrl,
        rawRequestedName ? rawRequestedName.slice(0, 160) : null,
        input.categoryHint ? input.categoryHint.trim().slice(0, 80) : null,
        input.descriptionNotes ? input.descriptionNotes.trim().slice(0, 1000) : null,
        input.desiredSize ? input.desiredSize.trim().slice(0, 40) : null,
        input.desiredColor ? input.desiredColor.trim().slice(0, 40) : null,
        input.desiredVariant ? input.desiredVariant.trim().slice(0, 80) : null,
        input.userId || null,
        sessionId,
        contactEmail,
        nowIso,
        nowIso
      );

    const created = this.db
      .prepare('SELECT * FROM product_requests WHERE id = ?')
      .get(id) as RawProductRequestRow;
    return this.mapProductRequestRowToDTO(created);
  }

  public getCustomerProductRequests(
    sessionId: string,
    userId?: string | null
  ): ProductRequestDTO[] {
    const rows = userId
      ? (this.db
          .prepare(
            'SELECT * FROM product_requests WHERE user_id = ? OR (user_id IS NULL AND session_id = ?) ORDER BY created_at DESC'
          )
          .all(userId, sessionId) as RawProductRequestRow[])
      : (this.db
          .prepare(
            'SELECT * FROM product_requests WHERE session_id = ? AND user_id IS NULL ORDER BY created_at DESC'
          )
          .all(sessionId) as RawProductRequestRow[]);
    return rows.map((r) => this.mapProductRequestRowToDTO(r));
  }

  public getProductRequestById(
    requestId: string,
    actor: { userId?: string | null; sessionId?: string; isAdmin?: boolean }
  ): ProductRequestDTO {
    const row = this.db
      .prepare('SELECT * FROM product_requests WHERE id = ?')
      .get((requestId || '').trim()) as RawProductRequestRow | undefined;

    if (!row) {
      throw new RequestWorkflowError(
        'Product request not found.',
        'REQUEST_NOT_FOUND',
        404
      );
    }

    const ownsByUser = Boolean(actor.userId && row.user_id && actor.userId === row.user_id);
    const ownsBySession = Boolean(
      !row.user_id && actor.sessionId && actor.sessionId === row.session_id
    );

    if (!actor.isAdmin && !ownsByUser && !ownsBySession) {
      throw new RequestWorkflowError(
        'You may only view your own product requests.',
        'FORBIDDEN_OWNERSHIP',
        403
      );
    }

    return this.mapProductRequestRowToDTO(row);
  }

  public markRestockEligible(productId: string, variantId?: string | null): number {
    const nowIso = new Date().toISOString();
    if (variantId && variantId.trim().length > 0) {
      const res = this.db
        .prepare(
          `UPDATE restock_subscriptions
           SET status = 'EligibleForNotification', updated_at = ?
           WHERE product_id = ? AND (variant_id = ? OR variant_id = '') AND status = 'Subscribed'`
        )
        .run(nowIso, productId, variantId.trim());
      return res.changes;
    }
    const res = this.db
      .prepare(
        `UPDATE restock_subscriptions
         SET status = 'EligibleForNotification', updated_at = ?
         WHERE product_id = ? AND status = 'Subscribed'`
      )
      .run(nowIso, productId);
    return res.changes;
  }

  public cancelProductRequestByCustomer(
    requestId: string,
    actor: { userId?: string | null; sessionId?: string; isAdmin?: boolean }
  ): ProductRequestDTO {
    const row = this.db
      .prepare('SELECT * FROM product_requests WHERE id = ?')
      .get((requestId || '').trim()) as RawProductRequestRow | undefined;

    if (!row) {
      throw new RequestWorkflowError(
        'Product request not found.',
        'REQUEST_NOT_FOUND',
        404
      );
    }

    const ownsByUser = Boolean(actor.userId && row.user_id && actor.userId === row.user_id);
    const ownsBySession = Boolean(
      !row.user_id && actor.sessionId && actor.sessionId === row.session_id
    );

    if (!actor.isAdmin && !ownsByUser && !ownsBySession) {
      throw new RequestWorkflowError(
        'You may only cancel or view your own product requests.',
        'FORBIDDEN_OWNERSHIP',
        403
      );
    }

    const nowIso = new Date().toISOString();
    this.db
      .prepare("UPDATE product_requests SET status = 'Closed', updated_at = ? WHERE id = ?")
      .run(nowIso, row.id);

    const updated = this.db
      .prepare('SELECT * FROM product_requests WHERE id = ?')
      .get(row.id) as RawProductRequestRow;
    return this.mapProductRequestRowToDTO(updated);
  }

  public listAllProductRequestsForAdmin(filters?: {
    status?: ProductRequestStatus;
    search?: string;
  }): ProductRequestDTO[] {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(
        '(LOWER(COALESCE(requested_name, \'\')) LIKE ? OR LOWER(source_url) LIKE ? OR LOWER(contact_email) LIKE ?)'
      );
      params.push(q, q, q);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM product_requests ${where} ORDER BY created_at DESC`)
      .all(...params) as RawProductRequestRow[];

    return rows.map((r) => this.mapProductRequestRowToDTO(r));
  }

  public updateProductRequestByAdmin(
    requestId: string,
    input: {
      status?: ProductRequestStatus;
      linkedProductId?: string | null;
      adminNotes?: string | null;
    }
  ): ProductRequestDTO {
    const row = this.db
      .prepare('SELECT * FROM product_requests WHERE id = ?')
      .get((requestId || '').trim()) as RawProductRequestRow | undefined;

    if (!row) {
      throw new RequestWorkflowError(
        'Product request not found.',
        'REQUEST_NOT_FOUND',
        404
      );
    }

    const validStatuses: ProductRequestStatus[] = [
      'Requested',
      'Under Review',
      'Available',
      'Unavailable',
      'Closed',
    ];
    const nextStatus = input.status || row.status;
    if (!validStatuses.includes(nextStatus)) {
      throw new RequestWorkflowError(
        `Invalid request status '${nextStatus}'.`,
        'INVALID_STATUS',
        400
      );
    }

    let nextLinkedId =
      input.linkedProductId !== undefined ? input.linkedProductId : row.linked_product_id;
    if (nextLinkedId) {
      const prod = this.productRepo.findById(nextLinkedId, { includeArchived: true });
      if (!prod) {
        throw new RequestWorkflowError(
          `Linked product '${nextLinkedId}' does not exist in the catalogue.`,
          'PRODUCT_NOT_FOUND',
          404
        );
      }
    }

    const nextNotes =
      input.adminNotes !== undefined ? input.adminNotes : row.admin_notes;
    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE product_requests
         SET status = ?, linked_product_id = ?, admin_notes = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(nextStatus, nextLinkedId || null, nextNotes || null, nowIso, row.id);

    const updated = this.db
      .prepare('SELECT * FROM product_requests WHERE id = ?')
      .get(row.id) as RawProductRequestRow;
    return this.mapProductRequestRowToDTO(updated);
  }

  /**
   * Allows an administrator to create a new catalogue product directly from a reviewed product request
   * and automatically link the request as 'Available'.
   */
  public promoteRequestToCatalogueProduct(
    requestId: string,
    productInput: {
      id?: string;
      name: string;
      brand: string;
      category: string;
      price: number;
      description: string;
      features?: string[];
      specifications?: Record<string, string | number>;
      useCases?: string[];
      image?: string;
      stockCount?: number;
    }
  ): { request: ProductRequestDTO; product: Product } {
    const row = this.db
      .prepare('SELECT * FROM product_requests WHERE id = ?')
      .get((requestId || '').trim()) as RawProductRequestRow | undefined;

    if (!row) {
      throw new RequestWorkflowError(
        'Product request not found.',
        'REQUEST_NOT_FOUND',
        404
      );
    }

    const prodId =
      productInput.id && productInput.id.trim().length > 0
        ? productInput.id.trim()
        : `prod-req-${randomUUID().slice(0, 8)}`;

    let safeImage = '';
    if (productInput.image && productInput.image.trim().length > 0) {
      const img = productInput.image.trim();
      if (img.startsWith('data:image/')) {
        safeImage = img;
      } else {
        safeImage = validateAndNormalizeExternalUrl(img);
      }
    }

    const newProduct: Product = {
      id: prodId,
      name: productInput.name.trim(),
      brand: productInput.brand.trim(),
      category: productInput.category.trim(),
      price: Number(productInput.price),
      currency: 'INR',
      rating: 0,
      review_count: 0,
      description: productInput.description.trim(),
      features: productInput.features || [],
      specifications: productInput.specifications || {},
      use_cases: productInput.useCases || [],
      image: safeImage,
      availability: (productInput.stockCount ?? 15) > 0,
      stock_count: productInput.stockCount ?? 15,
    };

    this.productRepo.upsert(newProduct);
    const createdProd = this.productRepo.findById(prodId, { includeArchived: true })!;
    const updatedReq = this.updateProductRequestByAdmin(requestId, {
      status: 'Available',
      linkedProductId: prodId,
      adminNotes: `Added to catalogue as ${ prodId } (${createdProd.name}).`,
    });

    return { request: updatedReq, product: createdProd };
  }
}
