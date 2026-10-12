import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { getDatabase, initMarketplaceTables } from '../db/database.js';
import { IProductRepository } from '../db/repositories/product.repository.js';
import {
  CategoryReviewAttributes,
  CreateReviewInput,
  ProductReviewDTO,
  ProductReviewSummaryDTO,
  ReviewModerationStatus,
  UserDTO,
} from '../types/index.js';

export class ReviewValidationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code = 'REVIEW_VALIDATION_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ReviewValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface RawReviewRow {
  id: string;
  product_id: string;
  user_id: string | null;
  session_id: string;
  author_name: string;
  rating: number;
  title: string;
  comment: string;
  photos: string;
  category_attributes: string;
  is_verified_purchase: number;
  moderation_status: ReviewModerationStatus;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
}

export class ReviewService {
  private db: Database.Database;

  constructor(
    private productRepo: IProductRepository,
    db?: Database.Database
  ) {
    this.db = db || getDatabase();
    initMarketplaceTables(this.db);
  }

  private mapRowToDTO(row: RawReviewRow): ProductReviewDTO {
    let photos: string[] = [];
    try {
      const parsed = JSON.parse(row.photos || '[]');
      if (Array.isArray(parsed)) {
        photos = parsed.filter((p): p is string => typeof p === 'string');
      }
    } catch {}

    let categoryAttributes: CategoryReviewAttributes = {};
    try {
      const parsed = JSON.parse(row.category_attributes || '{}');
      if (parsed && typeof parsed === 'object') {
        categoryAttributes = parsed;
      }
    } catch {}

    return {
      id: row.id,
      productId: row.product_id,
      userId: row.user_id,
      sessionId: row.session_id,
      authorName: row.author_name,
      rating: row.rating,
      title: row.title || '',
      comment: row.comment,
      photos,
      categoryAttributes,
      isVerifiedPurchase: Boolean(row.is_verified_purchase),
      moderationStatus: row.moderation_status,
      moderationNote: row.moderation_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Checks server-side order history to determine whether the customer actually purchased
   * the product in a non-cancelled order. Never trusts a client-supplied verification flag.
   */
  public checkVerifiedPurchaseServerSide(
    productId: string,
    userId?: string | null,
    sessionId?: string
  ): boolean {
    if (userId) {
      const found = this.db
        .prepare(
          `SELECT oi.id
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           WHERE oi.product_id = ?
             AND o.status != 'Cancelled'
             AND (o.user_id = ? OR o.session_id = ?)
           LIMIT 1`
        )
        .get(productId, userId, sessionId || '') as { id: string } | undefined;
      if (found) return true;
    }

    if (sessionId) {
      const found = this.db
        .prepare(
          `SELECT oi.id
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           WHERE oi.product_id = ?
             AND o.status != 'Cancelled'
             AND o.session_id = ?
           LIMIT 1`
        )
        .get(productId, sessionId) as { id: string } | undefined;
      if (found) return true;
    }

    return false;
  }

  public getProductReviewSummary(
    productId: string,
    sortBy: 'newest' | 'highest' | 'lowest' = 'newest'
  ): ProductReviewSummaryDTO {
    let orderClause = 'created_at DESC';
    if (sortBy === 'highest') {
      orderClause = 'rating DESC, created_at DESC';
    } else if (sortBy === 'lowest') {
      orderClause = 'rating ASC, created_at DESC';
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM product_reviews
         WHERE product_id = ? AND moderation_status = 'published'
         ORDER BY ${orderClause}`
      )
      .all(productId) as RawReviewRow[];

    const reviews = rows.map((r) => this.mapRowToDTO(r));
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;
    let verifiedCount = 0;

    for (const rev of reviews) {
      const rKey = Math.min(5, Math.max(1, Math.round(rev.rating))) as 1 | 2 | 3 | 4 | 5;
      distribution[rKey] += 1;
      ratingSum += rev.rating;
      if (rev.isVerifiedPurchase) verifiedCount += 1;
    }

    const totalPublishedCount = reviews.length;
    const averageRating =
      totalPublishedCount > 0
        ? Math.round((ratingSum / totalPublishedCount) * 10) / 10
        : 0;

    return {
      productId,
      averageRating,
      totalPublishedCount,
      verifiedPurchaseCount: verifiedCount,
      distribution,
      reviews,
    };
  }

  public createReview(input: CreateReviewInput): ProductReviewDTO {
    const productId = (input.productId || '').trim();
    if (!productId) {
      throw new ReviewValidationError('Product ID is required.', 'INVALID_PRODUCT_ID', 400);
    }

    const product = this.productRepo.findById(productId, { includeArchived: true });
    if (!product) {
      throw new ReviewValidationError(
        `Product '${productId}' not found.`,
        'PRODUCT_NOT_FOUND',
        404
      );
    }

    const sessionId = (input.sessionId || '').trim();
    if (!sessionId) {
      throw new ReviewValidationError('Session ID is required.', 'INVALID_SESSION', 400);
    }

    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ReviewValidationError(
        'Rating must be a whole number from 1 to 5 stars.',
        'INVALID_RATING',
        400
      );
    }

    const comment = (input.comment || '').trim();
    if (comment.length < 3 || comment.length > 2000) {
      throw new ReviewValidationError(
        'Review text must be between 3 and 2000 characters.',
        'INVALID_REVIEW_COMMENT',
        400
      );
    }

    const title = (input.title || '').trim().slice(0, 140);
    const authorName = (input.authorName || 'Verified Shopper').trim().slice(0, 80);
    const userId = input.userId || null;

    // Duplicate review prevention per user/session + product
    const duplicate = userId
      ? (this.db
          .prepare(
            `SELECT id FROM product_reviews
             WHERE product_id = ? AND (user_id = ? OR session_id = ?) AND moderation_status != 'rejected'
             LIMIT 1`
          )
          .get(productId, userId, sessionId) as { id: string } | undefined)
      : (this.db
          .prepare(
            `SELECT id FROM product_reviews
             WHERE product_id = ? AND session_id = ? AND moderation_status != 'rejected'
             LIMIT 1`
          )
          .get(productId, sessionId) as { id: string } | undefined);

    if (duplicate) {
      throw new ReviewValidationError(
        'You have already submitted a review for this product. You can edit or delete your existing review.',
        'DUPLICATE_REVIEW',
        409
      );
    }

    const safePhotos: string[] = [];
    if (Array.isArray(input.photos)) {
      for (const p of input.photos.slice(0, 4)) {
        if (typeof p === 'string' && p.trim().length > 0) {
          const trimmed = p.trim();
          if (
            trimmed.startsWith('data:image/jpeg;base64,') ||
            trimmed.startsWith('data:image/png;base64,') ||
            trimmed.startsWith('data:image/webp;base64,') ||
            /^https:\/\/[^\s]+$/i.test(trimmed)
          ) {
            safePhotos.push(trimmed);
          }
        }
      }
    }

    const verifiedPurchase = this.checkVerifiedPurchaseServerSide(
      productId,
      userId,
      sessionId
    );

    const reviewId = `rev_${randomUUID().slice(0, 12)}`;
    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO product_reviews (
          id, product_id, user_id, session_id, author_name, rating, title, comment,
          photos, category_attributes, is_verified_purchase, moderation_status,
          moderation_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', NULL, ?, ?)`
      )
      .run(
        reviewId,
        productId,
        userId,
        sessionId,
        authorName,
        rating,
        title,
        comment,
        JSON.stringify(safePhotos),
        JSON.stringify(input.categoryAttributes || {}),
        verifiedPurchase ? 1 : 0,
        nowIso,
        nowIso
      );

    const created = this.db
      .prepare('SELECT * FROM product_reviews WHERE id = ?')
      .get(reviewId) as RawReviewRow;
    return this.mapRowToDTO(created);
  }

  public updateReview(
    reviewId: string,
    input: {
      rating?: number;
      title?: string;
      comment?: string;
      categoryAttributes?: CategoryReviewAttributes;
    },
    actor: { userId?: string | null; sessionId?: string; isAdmin?: boolean }
  ): ProductReviewDTO {
    const row = this.db
      .prepare('SELECT * FROM product_reviews WHERE id = ?')
      .get((reviewId || '').trim()) as RawReviewRow | undefined;

    if (!row) {
      throw new ReviewValidationError('Review not found.', 'REVIEW_NOT_FOUND', 404);
    }

    const ownsByUser = Boolean(actor.userId && row.user_id && actor.userId === row.user_id);
    const ownsBySession = Boolean(
      !row.user_id && actor.sessionId && actor.sessionId === row.session_id
    );

    if (!actor.isAdmin && !ownsByUser && !ownsBySession) {
      throw new ReviewValidationError(
        'You may only edit your own reviews.',
        'FORBIDDEN_REVIEW_OWNERSHIP',
        403
      );
    }

    const nextRating =
      input.rating !== undefined ? Number(input.rating) : row.rating;
    if (!Number.isInteger(nextRating) || nextRating < 1 || nextRating > 5) {
      throw new ReviewValidationError(
        'Rating must be a whole number from 1 to 5 stars.',
        'INVALID_RATING',
        400
      );
    }

    const nextComment =
      input.comment !== undefined ? input.comment.trim() : row.comment;
    if (nextComment.length < 3 || nextComment.length > 2000) {
      throw new ReviewValidationError(
        'Review text must be between 3 and 2000 characters.',
        'INVALID_REVIEW_COMMENT',
        400
      );
    }

    const nextTitle =
      input.title !== undefined ? input.title.trim().slice(0, 140) : row.title;
    const nextAttrs =
      input.categoryAttributes !== undefined
        ? JSON.stringify(input.categoryAttributes)
        : row.category_attributes;
    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE product_reviews
         SET rating = ?, title = ?, comment = ?, category_attributes = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(nextRating, nextTitle, nextComment, nextAttrs, nowIso, row.id);

    const updated = this.db
      .prepare('SELECT * FROM product_reviews WHERE id = ?')
      .get(row.id) as RawReviewRow;
    return this.mapRowToDTO(updated);
  }

  public deleteReview(
    reviewId: string,
    actor: { userId?: string | null; sessionId?: string; isAdmin?: boolean }
  ): void {
    const row = this.db
      .prepare('SELECT * FROM product_reviews WHERE id = ?')
      .get((reviewId || '').trim()) as RawReviewRow | undefined;

    if (!row) {
      throw new ReviewValidationError('Review not found.', 'REVIEW_NOT_FOUND', 404);
    }

    const ownsByUser = Boolean(actor.userId && row.user_id && actor.userId === row.user_id);
    const ownsBySession = Boolean(
      !row.user_id && actor.sessionId && actor.sessionId === row.session_id
    );

    if (!actor.isAdmin && !ownsByUser && !ownsBySession) {
      throw new ReviewValidationError(
        'You may only delete your own reviews.',
        'FORBIDDEN_REVIEW_OWNERSHIP',
        403
      );
    }

    this.db.prepare('DELETE FROM product_reviews WHERE id = ?').run(row.id);
  }

  public listAllReviewsForAdmin(statusFilter?: ReviewModerationStatus): ProductReviewDTO[] {
    const rows = statusFilter
      ? (this.db
          .prepare(
            'SELECT * FROM product_reviews WHERE moderation_status = ? ORDER BY created_at DESC'
          )
          .all(statusFilter) as RawReviewRow[])
      : (this.db
          .prepare('SELECT * FROM product_reviews ORDER BY created_at DESC')
          .all() as RawReviewRow[]);
    return rows.map((r) => this.mapRowToDTO(r));
  }

  public moderateReview(
    reviewId: string,
    moderationStatus: ReviewModerationStatus,
    moderationNote?: string
  ): ProductReviewDTO {
    const valid: ReviewModerationStatus[] = [
      'published',
      'pending',
      'rejected',
      'flagged',
    ];
    if (!valid.includes(moderationStatus)) {
      throw new ReviewValidationError(
        `Invalid moderation status '${moderationStatus}'.`,
        'INVALID_MODERATION_STATUS',
        400
      );
    }

    const row = this.db
      .prepare('SELECT * FROM product_reviews WHERE id = ?')
      .get((reviewId || '').trim()) as RawReviewRow | undefined;

    if (!row) {
      throw new ReviewValidationError('Review not found.', 'REVIEW_NOT_FOUND', 404);
    }

    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE product_reviews
         SET moderation_status = ?, moderation_note = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        moderationStatus,
        moderationNote ? moderationNote.trim().slice(0, 300) : null,
        nowIso,
        row.id
      );

    const updated = this.db
      .prepare('SELECT * FROM product_reviews WHERE id = ?')
      .get(row.id) as RawReviewRow;
    return this.mapRowToDTO(updated);
  }
}
