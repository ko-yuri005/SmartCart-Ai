import Database from 'better-sqlite3';
import {
  OfferAvailabilityStatus,
  OfferLinkType,
  OfferMatchType,
  OfferVerificationStatus,
} from '../../types/index.js';

export interface RetailerOfferRecord {
  id: string;
  productId: string;
  retailerId: string;
  retailerName: string;
  externalListingId?: string | null;
  listingTitle: string;
  listingUrl: string | null;
  searchUrl: string;
  linkType: OfferLinkType;
  matchType: OfferMatchType;
  matchConfidence: number;
  matchedVariantSummary?: string;
  price: number | null;
  originalPrice?: number | null;
  discountPercent?: number | null;
  currency: string;
  shippingCost: number | null;
  shippingKnown: boolean;
  availability: OfferAvailabilityStatus;
  verificationStatus: OfferVerificationStatus;
  sourceProvider: string;
  lastCheckedAt: string | null;
  expiresAt?: string | null;
  createdAt?: string;
}

export interface IOfferRepository {
  findByProductId(productId: string): RetailerOfferRecord[];
  findById(id: string): RetailerOfferRecord | null;
  upsertOffer(offer: RetailerOfferRecord): void;
  upsertMany(offers: RetailerOfferRecord[]): void;
  deleteByProductId(productId: string): void;
  deleteByProductIdAndSource(productId: string, sourceProvider: string): void;
}

export class SqliteOfferRepository implements IOfferRepository {
  constructor(private db: Database.Database) {
    this.ensureTableExists();
  }

  private ensureTableExists(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS retailer_offers (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        retailer_id TEXT NOT NULL,
        retailer_name TEXT NOT NULL,
        external_listing_id TEXT,
        listing_title TEXT NOT NULL,
        listing_url TEXT,
        search_url TEXT NOT NULL,
        link_type TEXT NOT NULL CHECK(link_type IN ('direct_listing', 'search_link')),
        match_type TEXT NOT NULL DEFAULT 'exact' CHECK(match_type IN ('exact', 'similar_alternative', 'variant_mismatch')),
        match_confidence REAL NOT NULL DEFAULT 1.0,
        matched_variant_summary TEXT,
        price REAL,
        original_price REAL,
        discount_percent REAL,
        currency TEXT NOT NULL DEFAULT 'INR',
        shipping_cost REAL,
        shipping_known INTEGER NOT NULL DEFAULT 0,
        availability TEXT NOT NULL DEFAULT 'unknown' CHECK(availability IN ('in_stock', 'out_of_stock', 'limited', 'unknown')),
        verification_status TEXT NOT NULL CHECK(verification_status IN ('live_verified', 'cached_verified', 'stale_cached', 'unverified_search', 'unavailable')),
        source_provider TEXT NOT NULL,
        last_checked_at DATETIME,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_retailer_offers_product_id ON retailer_offers(product_id);
      CREATE INDEX IF NOT EXISTS idx_retailer_offers_retailer_id ON retailer_offers(retailer_id);
    `);
  }

  private mapRowToRecord(row: any): RetailerOfferRecord {
    return {
      id: row.id,
      productId: row.product_id,
      retailerId: row.retailer_id,
      retailerName: row.retailer_name,
      externalListingId: row.external_listing_id ?? null,
      listingTitle: row.listing_title,
      listingUrl: row.listing_url ?? null,
      searchUrl: row.search_url,
      linkType: (row.link_type as OfferLinkType) || 'search_link',
      matchType: (row.match_type as OfferMatchType) || 'exact',
      matchConfidence:
        typeof row.match_confidence === 'number' ? row.match_confidence : 1.0,
      matchedVariantSummary: row.matched_variant_summary ?? undefined,
      price: typeof row.price === 'number' ? row.price : null,
      originalPrice:
        typeof row.original_price === 'number' ? row.original_price : null,
      discountPercent:
        typeof row.discount_percent === 'number' ? row.discount_percent : null,
      currency: row.currency || 'INR',
      shippingCost:
        typeof row.shipping_cost === 'number' ? row.shipping_cost : null,
      shippingKnown: Boolean(row.shipping_known),
      availability:
        (row.availability as OfferAvailabilityStatus) || 'unknown',
      verificationStatus:
        (row.verification_status as OfferVerificationStatus) ||
        'unverified_search',
      sourceProvider: row.source_provider || 'catalogue_verified',
      lastCheckedAt: row.last_checked_at ?? null,
      expiresAt: row.expires_at ?? null,
      createdAt: row.created_at,
    };
  }

  public findByProductId(productId: string): RetailerOfferRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM retailer_offers WHERE product_id = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(productId);
    return rows.map((row) => this.mapRowToRecord(row));
  }

  public findById(id: string): RetailerOfferRecord | null {
    const stmt = this.db.prepare('SELECT * FROM retailer_offers WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return this.mapRowToRecord(row);
  }

  public upsertOffer(offer: RetailerOfferRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO retailer_offers (
        id, product_id, retailer_id, retailer_name, external_listing_id,
        listing_title, listing_url, search_url, link_type, match_type,
        match_confidence, matched_variant_summary, price, original_price,
        discount_percent, currency, shipping_cost, shipping_known,
        availability, verification_status, source_provider, last_checked_at, expires_at
      ) VALUES (
        @id, @productId, @retailerId, @retailerName, @externalListingId,
        @listingTitle, @listingUrl, @searchUrl, @linkType, @matchType,
        @matchConfidence, @matchedVariantSummary, @price, @originalPrice,
        @discountPercent, @currency, @shippingCost, @shippingKnown,
        @availability, @verificationStatus, @sourceProvider, @lastCheckedAt, @expiresAt
      )
      ON CONFLICT(id) DO UPDATE SET
        retailer_id = excluded.retailer_id,
        retailer_name = excluded.retailer_name,
        external_listing_id = excluded.external_listing_id,
        listing_title = excluded.listing_title,
        listing_url = excluded.listing_url,
        search_url = excluded.search_url,
        link_type = excluded.link_type,
        match_type = excluded.match_type,
        match_confidence = excluded.match_confidence,
        matched_variant_summary = excluded.matched_variant_summary,
        price = excluded.price,
        original_price = excluded.original_price,
        discount_percent = excluded.discount_percent,
        currency = excluded.currency,
        shipping_cost = excluded.shipping_cost,
        shipping_known = excluded.shipping_known,
        availability = excluded.availability,
        verification_status = excluded.verification_status,
        source_provider = excluded.source_provider,
        last_checked_at = excluded.last_checked_at,
        expires_at = excluded.expires_at
    `);

    stmt.run({
      id: offer.id,
      productId: offer.productId,
      retailerId: offer.retailerId,
      retailerName: offer.retailerName,
      externalListingId: offer.externalListingId ?? null,
      listingTitle: offer.listingTitle,
      listingUrl: offer.listingUrl ?? null,
      searchUrl: offer.searchUrl,
      linkType: offer.linkType,
      matchType: offer.matchType,
      matchConfidence: offer.matchConfidence,
      matchedVariantSummary: offer.matchedVariantSummary ?? null,
      price: offer.price ?? null,
      originalPrice: offer.originalPrice ?? null,
      discountPercent: offer.discountPercent ?? null,
      currency: offer.currency || 'INR',
      shippingCost: offer.shippingCost ?? null,
      shippingKnown: offer.shippingKnown ? 1 : 0,
      availability: offer.availability,
      verificationStatus: offer.verificationStatus,
      sourceProvider: offer.sourceProvider,
      lastCheckedAt: offer.lastCheckedAt ?? null,
      expiresAt: offer.expiresAt ?? null,
    });
  }

  public upsertMany(offers: RetailerOfferRecord[]): void {
    const transaction = this.db.transaction((items: RetailerOfferRecord[]) => {
      for (const item of items) {
        this.upsertOffer(item);
      }
    });
    transaction(offers);
  }

  public deleteByProductId(productId: string): void {
    this.db
      .prepare('DELETE FROM retailer_offers WHERE product_id = ?')
      .run(productId);
  }

  public deleteByProductIdAndSource(
    productId: string,
    sourceProvider: string
  ): void {
    this.db
      .prepare(
        'DELETE FROM retailer_offers WHERE product_id = ? AND source_provider = ?'
      )
      .run(productId, sourceProvider);
  }
}
