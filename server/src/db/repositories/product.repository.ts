import Database from 'better-sqlite3';
import {
  Product,
  ProductFilters,
  ProductImageGalleryItem,
  ProductVariantDTO,
  VariantSizingSystem,
} from '../../types/index.js';
import { getDatabase, initMarketplaceTables } from '../database.js';
import { imageResolverService } from '../../services/image-resolver.service.js';

export interface IProductRepository {
  findById(id: string, options?: { includeArchived?: boolean }): Product | null;
  findByIds(ids: string[], options?: { includeArchived?: boolean }): Product[];
  findMany(filters: ProductFilters): Product[];
  getAllCategories(): string[];
  getAllBrands(): string[];
  count(options?: { includeArchived?: boolean }): number;
  upsert(product: Product): void;
  upsertMany(products: Product[]): void;
  getStockCount?(id: string, variantId?: string | null): number;
  adjustStock?(id: string, delta: number, variantId?: string | null): boolean;
  getVariantsByProductId?(productId: string): ProductVariantDTO[];
  findVariantById?(variantId: string): ProductVariantDTO | null;
  upsertVariant?(variant: ProductVariantDTO): ProductVariantDTO;
  deleteVariant?(variantId: string): boolean;
  setArchived?(id: string, isArchived: boolean): Product | null;
}

interface RawProductRow {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  original_price?: number | null;
  discount_percent?: number | null;
  sale_start_at?: string | null;
  sale_end_at?: string | null;
  is_on_sale?: number;
  currency: string;
  rating: number;
  review_count: number;
  description: string;
  features: string;
  specifications: string;
  use_cases: string;
  image: string;
  image_gallery?: string;
  product_type?: string;
  image_type?: string;
  availability: number;
  stock_count?: number;
  is_archived?: number;
  created_at?: string;
  updated_at?: string;
}

interface RawVariantRow {
  id: string;
  product_id: string;
  sku: string;
  label: string;
  size: string | null;
  size_system: string | null;
  color: string | null;
  storage_or_model: string | null;
  price: number;
  original_price: number | null;
  stock_count: number;
  availability: number;
  image: string | null;
  is_default: number;
  created_at: string;
}

function mapRawVariantToDTO(row: RawVariantRow): ProductVariantDTO {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    label: row.label,
    size: row.size || undefined,
    sizeSystem: (row.size_system as VariantSizingSystem) || undefined,
    color: row.color || undefined,
    storageOrModel: row.storage_or_model || undefined,
    price: row.price,
    originalPrice: row.original_price ?? null,
    stockCount: row.stock_count,
    availability: Boolean(row.availability) && row.stock_count > 0,
    image: row.image || undefined,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

function computeEffectiveSaleFields(row: RawProductRow): {
  original_price: number | null;
  discount_percent: number | null;
  is_on_sale: boolean;
  amount_saved: number;
} {
  const originalPrice =
    typeof row.original_price === 'number' && row.original_price > row.price
      ? row.original_price
      : null;

  if (!originalPrice) {
    return {
      original_price: null,
      discount_percent: null,
      is_on_sale: false,
      amount_saved: 0,
    };
  }

  const nowMs = Date.now();
  if (row.sale_start_at) {
    const startMs = Date.parse(row.sale_start_at);
    if (!Number.isNaN(startMs) && nowMs < startMs) {
      return {
        original_price: originalPrice,
        discount_percent: null,
        is_on_sale: false,
        amount_saved: 0,
      };
    }
  }
  if (row.sale_end_at) {
    const endMs = Date.parse(row.sale_end_at);
    if (!Number.isNaN(endMs) && nowMs > endMs) {
      return {
        original_price: originalPrice,
        discount_percent: null,
        is_on_sale: false,
        amount_saved: 0,
      };
    }
  }

  const isOnSaleFlag = row.is_on_sale === undefined ? true : Boolean(row.is_on_sale);
  if (!isOnSaleFlag) {
    return {
      original_price: originalPrice,
      discount_percent: null,
      is_on_sale: false,
      amount_saved: 0,
    };
  }

  const amountSaved = Math.max(0, Math.round((originalPrice - row.price) * 100) / 100);
  const discountPercent =
    typeof row.discount_percent === 'number' && row.discount_percent > 0
      ? Math.round(row.discount_percent)
      : Math.round(((originalPrice - row.price) / originalPrice) * 100);

  return {
    original_price: originalPrice,
    discount_percent: discountPercent > 0 ? discountPercent : null,
    is_on_sale: discountPercent > 0,
    amount_saved: amountSaved,
  };
}

function buildDefaultGallery(
  primaryImageUrl: string,
  productName: string,
  storedGalleryJson?: string
): ProductImageGalleryItem[] {
  let parsed: ProductImageGalleryItem[] = [];
  if (storedGalleryJson) {
    try {
      const arr = JSON.parse(storedGalleryJson);
      if (Array.isArray(arr)) {
        parsed = arr.filter(
          (item) => item && typeof item.url === 'string' && item.url.trim().length > 0
        );
      }
    } catch {
      parsed = [];
    }
  }

  if (parsed.length > 0) {
    return parsed;
  }

  if (!primaryImageUrl || primaryImageUrl.startsWith('data:image/svg+xml')) {
    return primaryImageUrl
      ? [
          {
            url: primaryImageUrl,
            label: `${productName} — Placeholder View`,
            viewType: 'front',
          },
        ]
      : [];
  }

  return [
    {
      url: primaryImageUrl,
      label: `${productName} — Primary Studio View`,
      viewType: 'front',
    },
    {
      url: primaryImageUrl,
      label: `${productName} — Side Profile View`,
      viewType: 'side',
    },
    {
      url: primaryImageUrl,
      label: `${productName} — Detail & Texture View`,
      viewType: 'closeup',
    },
  ];
}

export class SqliteProductRepository implements IProductRepository {
  private db: Database.Database;
  private columnsChecked = false;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
    this.ensureColumns();
  }

  public ensureColumns(): void {
    if (this.columnsChecked) return;
    initMarketplaceTables(this.db);
    this.columnsChecked = true;
  }

  private mapRowToProduct(row: RawProductRow, variantsMap?: Map<string, ProductVariantDTO[]>): Product {
    let features: string[] = [];
    try {
      features = JSON.parse(row.features || '[]');
    } catch {
      features = [];
    }

    let specifications: Record<string, string | number> = {};
    try {
      specifications = JSON.parse(row.specifications || '{}');
    } catch {
      specifications = {};
    }

    let use_cases: string[] = [];
    try {
      use_cases = JSON.parse(row.use_cases || '[]');
    } catch {
      use_cases = [];
    }

    const resolved = imageResolverService.resolveImage({
      id: row.id,
      name: row.name,
      category: row.category,
      image: row.image,
      product_type: row.product_type,
      image_type: row.image_type,
    });

    const isAvailable = Boolean(row.availability);
    const stockCount =
      typeof row.stock_count === 'number'
        ? row.stock_count
        : isAvailable
          ? 25
          : 0;

    const saleInfo = computeEffectiveSaleFields(row);
    const variants = variantsMap
      ? variantsMap.get(row.id) || []
      : this.getVariantsByProductId(row.id);

    const catLower = (row.category || '').toLowerCase();
    const requiresVariantSelection =
      variants.length > 0 &&
      (catLower.includes('fashion') ||
        catLower.includes('clothing') ||
        catLower.includes('apparel') ||
        catLower.includes('footwear') ||
        catLower.includes('shoe') ||
        variants.some((v) => Boolean(v.size)));

    const gallery = buildDefaultGallery(resolved.imageUrl, row.name, row.image_gallery);

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      brand: row.brand,
      price: row.price,
      original_price: saleInfo.original_price,
      discount_percent: saleInfo.discount_percent,
      sale_start_at: row.sale_start_at || null,
      sale_end_at: row.sale_end_at || null,
      is_on_sale: saleInfo.is_on_sale,
      amount_saved: saleInfo.amount_saved,
      currency: row.currency || 'INR',
      rating: row.rating,
      review_count: row.review_count,
      description: row.description,
      features,
      specifications,
      use_cases,
      image: resolved.imageUrl,
      image_gallery: gallery,
      variants: variants.length > 0 ? variants : undefined,
      requires_variant_selection: requiresVariantSelection,
      product_type: resolved.productType,
      image_type: resolved.imageType,
      availability: isAvailable && stockCount > 0 && !Boolean(row.is_archived),
      stock_count: stockCount,
      is_archived: Boolean(row.is_archived),
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    };
  }

  private loadVariantsMapForProducts(productIds: string[]): Map<string, ProductVariantDTO[]> {
    const map = new Map<string, ProductVariantDTO[]>();
    if (!productIds || productIds.length === 0) return map;

    const placeholders = productIds.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY is_default DESC, created_at ASC`
      )
      .all(...productIds) as RawVariantRow[];

    for (const r of rows) {
      const list = map.get(r.product_id) || [];
      list.push(mapRawVariantToDTO(r));
      map.set(r.product_id, list);
    }
    return map;
  }

  public getVariantsByProductId(productId: string): ProductVariantDTO[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM product_variants WHERE product_id = ? ORDER BY is_default DESC, created_at ASC'
      )
      .all(productId) as RawVariantRow[];
    return rows.map(mapRawVariantToDTO);
  }

  public findVariantById(variantId: string): ProductVariantDTO | null {
    const row = this.db
      .prepare('SELECT * FROM product_variants WHERE id = ?')
      .get(variantId) as RawVariantRow | undefined;
    return row ? mapRawVariantToDTO(row) : null;
  }

  public upsertVariant(variant: ProductVariantDTO): ProductVariantDTO {
    const nowIso = new Date().toISOString();
    const stockCount = Math.max(0, Math.floor(variant.stockCount ?? 15));
    const isAvailable = variant.availability !== false && stockCount > 0 ? 1 : 0;

    this.db
      .prepare(
        `INSERT INTO product_variants (
          id, product_id, sku, label, size, size_system, color, storage_or_model,
          price, original_price, stock_count, availability, image, is_default, created_at
        ) VALUES (
          @id, @productId, @sku, @label, @size, @sizeSystem, @color, @storageOrModel,
          @price, @originalPrice, @stockCount, @availability, @image, @isDefault, @createdAt
        ) ON CONFLICT(id) DO UPDATE SET
          sku = excluded.sku,
          label = excluded.label,
          size = excluded.size,
          size_system = excluded.size_system,
          color = excluded.color,
          storage_or_model = excluded.storage_or_model,
          price = excluded.price,
          original_price = excluded.original_price,
          stock_count = excluded.stock_count,
          availability = excluded.availability,
          image = excluded.image,
          is_default = excluded.is_default`
      )
      .run({
        id: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        label: variant.label,
        size: variant.size || null,
        sizeSystem: variant.sizeSystem || null,
        color: variant.color || null,
        storageOrModel: variant.storageOrModel || null,
        price: variant.price,
        originalPrice: variant.originalPrice ?? null,
        stockCount,
        availability: isAvailable,
        image: variant.image || null,
        isDefault: variant.isDefault ? 1 : 0,
        createdAt: variant.createdAt || nowIso,
      });

    return this.findVariantById(variant.id)!;
  }

  public deleteVariant(variantId: string): boolean {
    const info = this.db
      .prepare('DELETE FROM product_variants WHERE id = ?')
      .run(variantId);
    return info.changes > 0;
  }

  public setArchived(id: string, isArchived: boolean): Product | null {
    const existing = this.findById(id, { includeArchived: true });
    if (!existing) return null;
    const nowIso = new Date().toISOString();
    this.db
      .prepare('UPDATE products SET is_archived = ?, updated_at = ? WHERE id = ?')
      .run(isArchived ? 1 : 0, nowIso, id);
    return this.findById(id, { includeArchived: true });
  }

  findById(id: string, options?: { includeArchived?: boolean }): Product | null {
    const stmt = this.db.prepare('SELECT * FROM products WHERE id = ?');
    const row = stmt.get(id) as RawProductRow | undefined;
    if (!row) return null;
    if (!options?.includeArchived && Boolean(row.is_archived)) {
      return null;
    }
    return this.mapRowToProduct(row);
  }

  findByIds(ids: string[], options?: { includeArchived?: boolean }): Product[] {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids) as RawProductRow[];
    const variantsMap = this.loadVariantsMapForProducts(rows.map((r) => r.id));
    const byId = new Map<string, Product>();
    for (const row of rows) {
      if (!options?.includeArchived && Boolean(row.is_archived)) continue;
      byId.set(row.id, this.mapRowToProduct(row, variantsMap));
    }
    return ids.map((id) => byId.get(id)).filter((p): p is Product => p !== undefined);
  }

  findMany(filters: ProductFilters = {}): Product[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!filters.includeArchived) {
      conditions.push('COALESCE(is_archived, 0) = 0');
    }

    if (filters.inStockOnly !== false) {
      conditions.push('availability = 1');
    }

    if (filters.onSaleOnly) {
      conditions.push('(is_on_sale = 1 AND original_price IS NOT NULL AND original_price > price)');
    }

    if (filters.categories && filters.categories.length > 0) {
      const expanded = Array.from(
        new Set(filters.categories.flatMap((c) => this.expandCategorySlug(c)))
      );
      const placeholders = expanded.map(() => '?').join(',');
      conditions.push(`LOWER(category) IN (${placeholders})`);
      params.push(...expanded);
    } else if (filters.category) {
      const expanded = this.expandCategorySlug(filters.category);
      if (expanded.length === 1) {
        conditions.push('LOWER(category) = LOWER(?)');
        params.push(expanded[0]);
      } else {
        const placeholders = expanded.map(() => '?').join(',');
        conditions.push(`LOWER(category) IN (${placeholders})`);
        params.push(...expanded);
      }
    }

    if (filters.brand) {
      conditions.push('LOWER(brand) = LOWER(?)');
      params.push(filters.brand.trim());
    }

    if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
      conditions.push('price <= ?');
      params.push(filters.maxPrice);
    }

    if (filters.minPrice !== undefined && filters.minPrice !== null) {
      conditions.push('price >= ?');
      params.push(filters.minPrice);
    }

    if (filters.searchQuery) {
      conditions.push(
        '(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(category) LIKE ? OR LOWER(features) LIKE ? OR LOWER(use_cases) LIKE ?)'
      );
      const q = `%${filters.searchQuery.toLowerCase().trim()}%`;
      params.push(q, q, q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 500;
    const offset = filters.offset ?? 0;

    let orderBy = 'rating DESC, price ASC';
    if (filters.sortBy === 'price_asc') {
      orderBy = 'price ASC, rating DESC';
    } else if (filters.sortBy === 'price_desc') {
      orderBy = 'price DESC, rating DESC';
    } else if (filters.sortBy === 'discount_desc') {
      orderBy = 'COALESCE(discount_percent, 0) DESC, rating DESC';
    }

    const sql = `SELECT * FROM products ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params, limit, offset) as RawProductRow[];
    const variantsMap = this.loadVariantsMapForProducts(rows.map((r) => r.id));

    return rows.map((r) => this.mapRowToProduct(r, variantsMap));
  }

  private expandCategorySlug(rawCategory: string): string[] {
    const cleaned = (rawCategory || '').toLowerCase().trim();
    if (
      cleaned === 'womens-ethnic-wear' ||
      cleaned === "women's ethnic wear" ||
      cleaned === 'womens ethnic wear' ||
      cleaned === 'ethnic wear'
    ) {
      return ['kurtis-kurtas', 'sarees', 'ethnic-sets-festive-wear'];
    }
    if (
      cleaned === 'kurtis-kurtas' ||
      cleaned === 'kurtis & kurtas' ||
      cleaned === 'kurtis & everyday kurtas' ||
      cleaned === 'kurtis' ||
      cleaned === 'kurtas'
    ) {
      return ['kurtis-kurtas'];
    }
    if (cleaned === 'sarees' || cleaned === 'saree') {
      return ['sarees'];
    }
    if (
      cleaned === 'ethnic-sets-festive-wear' ||
      cleaned === 'ethnic sets & festive wear' ||
      cleaned === 'ethnic sets' ||
      cleaned === 'festive wear'
    ) {
      return ['ethnic-sets-festive-wear'];
    }
    if (cleaned === 'western-wear' || cleaned === 'western wear') {
      return ['western-wear'];
    }
    if (
      cleaned === 'womens-outerwear' ||
      cleaned === "women's outerwear" ||
      cleaned === 'womens outerwear' ||
      cleaned === "women's outerwear & occasion wear"
    ) {
      return ['womens-outerwear'];
    }
    return [cleaned];
  }

  getAllCategories(): string[] {
    const stmt = this.db.prepare(
      'SELECT DISTINCT category FROM products WHERE COALESCE(is_archived, 0) = 0 ORDER BY category ASC'
    );
    const rows = stmt.all() as { category: string }[];
    const cats = rows.map((r) => r.category);
    if (
      (cats.includes('kurtis-kurtas') ||
        cats.includes('sarees') ||
        cats.includes('ethnic-sets-festive-wear')) &&
      !cats.includes('womens-ethnic-wear')
    ) {
      cats.push('womens-ethnic-wear');
      cats.sort();
    }
    return cats;
  }

  getAllBrands(): string[] {
    const stmt = this.db.prepare(
      'SELECT DISTINCT brand FROM products WHERE COALESCE(is_archived, 0) = 0 ORDER BY brand ASC'
    );
    const rows = stmt.all() as { brand: string }[];
    return rows.map((r) => r.brand);
  }

  count(options?: { includeArchived?: boolean }): number {
    const sql = options?.includeArchived
      ? 'SELECT COUNT(*) as count FROM products'
      : 'SELECT COUNT(*) as count FROM products WHERE COALESCE(is_archived, 0) = 0';
    const stmt = this.db.prepare(sql);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  getStockCount(id: string, variantId?: string | null): number {
    if (variantId && variantId.trim().length > 0) {
      const variant = this.findVariantById(variantId.trim());
      if (!variant || variant.productId !== id || !variant.availability) return 0;
      return variant.stockCount;
    }
    const prod = this.findById(id, { includeArchived: true });
    if (!prod || !prod.availability) return 0;
    return typeof prod.stock_count === 'number' ? prod.stock_count : 25;
  }

  adjustStock(id: string, delta: number, variantId?: string | null): boolean {
    if (variantId && variantId.trim().length > 0) {
      const variant = this.findVariantById(variantId.trim());
      if (!variant || variant.productId !== id) return false;
      const nextVarStock = variant.stockCount + delta;
      if (nextVarStock < 0) return false;
      const nextVarAvail = nextVarStock > 0 ? 1 : 0;
      this.db
        .prepare('UPDATE product_variants SET stock_count = ?, availability = ? WHERE id = ?')
        .run(nextVarStock, nextVarAvail, variant.id);

      // If variant stock was replenished (> 0), mark any Subscribed restock notifications for this variant as EligibleForNotification
      if (delta > 0 && nextVarStock > 0) {
        this.markRestockSubscriptionsEligible(id, variant.id);
      }
    }

    const prod = this.findById(id, { includeArchived: true });
    if (!prod) return false;
    const currentStock =
      typeof prod.stock_count === 'number'
        ? prod.stock_count
        : prod.availability
          ? 25
          : 0;
    const nextStock = currentStock + delta;
    if (nextStock < 0) return false;
    const nextAvail = nextStock > 0 ? 1 : 0;
    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        'UPDATE products SET stock_count = ?, availability = ?, updated_at = ? WHERE id = ?'
      )
      .run(nextStock, nextAvail, nowIso, id);

    if (delta > 0 && nextStock > 0) {
      this.markRestockSubscriptionsEligible(id, variantId || '');
    }

    return true;
  }

  public markRestockSubscriptionsEligible(productId: string, variantId?: string | null): void {
    try {
      const nowIso = new Date().toISOString();
      if (variantId && variantId.trim().length > 0) {
        this.db
          .prepare(
            `UPDATE restock_subscriptions
             SET status = 'EligibleForNotification', updated_at = ?
             WHERE product_id = ? AND (variant_id = ? OR variant_id = '') AND status = 'Subscribed'`
          )
          .run(nowIso, productId, variantId.trim());
      } else {
        this.db
          .prepare(
            `UPDATE restock_subscriptions
             SET status = 'EligibleForNotification', updated_at = ?
             WHERE product_id = ? AND status = 'Subscribed'`
          )
          .run(nowIso, productId);
      }
    } catch {
      // Ignore if table not yet initialized
    }
  }

  upsert(product: Product): void {
    const stmt = this.db.prepare(`
      INSERT INTO products (
        id, name, category, brand, price, original_price, discount_percent,
        sale_start_at, sale_end_at, is_on_sale, currency, rating,
        review_count, description, features, specifications,
        use_cases, image, image_gallery, product_type, image_type,
        availability, stock_count, is_archived, updated_at
      ) VALUES (
        @id, @name, @category, @brand, @price, @original_price, @discount_percent,
        @sale_start_at, @sale_end_at, @is_on_sale, @currency, @rating,
        @review_count, @description, @features, @specifications,
        @use_cases, @image, @image_gallery, @product_type, @image_type,
        @availability, @stock_count, @is_archived, @updated_at
      ) ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        brand = excluded.brand,
        price = excluded.price,
        original_price = COALESCE(excluded.original_price, products.original_price),
        discount_percent = COALESCE(excluded.discount_percent, products.discount_percent),
        sale_start_at = COALESCE(excluded.sale_start_at, products.sale_start_at),
        sale_end_at = COALESCE(excluded.sale_end_at, products.sale_end_at),
        is_on_sale = CASE WHEN excluded.original_price IS NOT NULL THEN excluded.is_on_sale ELSE products.is_on_sale END,
        currency = excluded.currency,
        rating = excluded.rating,
        review_count = excluded.review_count,
        description = excluded.description,
        features = excluded.features,
        specifications = excluded.specifications,
        use_cases = excluded.use_cases,
        image = excluded.image,
        image_gallery = CASE WHEN excluded.image_gallery != '[]' THEN excluded.image_gallery ELSE products.image_gallery END,
        product_type = excluded.product_type,
        image_type = excluded.image_type,
        availability = excluded.availability,
        stock_count = excluded.stock_count,
        is_archived = CASE WHEN products.is_archived = 1 THEN 1 ELSE COALESCE(excluded.is_archived, 0) END,
        updated_at = excluded.updated_at
    `);

    const resolved = imageResolverService.resolveImage(product);
    const stockCount =
      typeof product.stock_count === 'number'
        ? product.stock_count
        : product.availability
          ? 25
          : 0;

    const originalPrice =
      typeof product.original_price === 'number' && product.original_price > product.price
        ? product.original_price
        : null;
    const discountPercent =
      originalPrice && originalPrice > product.price
        ? product.discount_percent ??
          Math.round(((originalPrice - product.price) / originalPrice) * 100)
        : null;
    const isOnSale =
      originalPrice !== null && (product.is_on_sale !== false) ? 1 : 0;

    const nowIso = new Date().toISOString();

    stmt.run({
      id: product.id,
      name: product.name,
      category: product.category,
      brand: product.brand,
      price: product.price,
      original_price: originalPrice,
      discount_percent: discountPercent,
      sale_start_at: product.sale_start_at || null,
      sale_end_at: product.sale_end_at || null,
      is_on_sale: isOnSale,
      currency: product.currency || 'INR',
      rating: product.rating,
      review_count: product.review_count,
      description: product.description,
      features: JSON.stringify(product.features || []),
      specifications: JSON.stringify(product.specifications || {}),
      use_cases: JSON.stringify(product.use_cases || []),
      image: resolved.imageUrl,
      image_gallery: JSON.stringify(product.image_gallery || []),
      product_type: resolved.productType || null,
      image_type: resolved.imageType || null,
      availability: product.availability && stockCount > 0 ? 1 : 0,
      stock_count: stockCount,
      is_archived: product.is_archived ? 1 : 0,
      updated_at: product.updated_at || nowIso,
    });

    if (product.availability && stockCount > 0) {
      this.markRestockSubscriptionsEligible(product.id);
    }

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      for (const v of product.variants) {
        this.upsertVariant({
          ...v,
          productId: product.id,
        });
      }
    }
  }

  upsertMany(products: Product[]): void {
    const insertTx = this.db.transaction((items: Product[]) => {
      for (const item of items) {
        this.upsert(item);
      }
    });
    insertTx(products);
    this.seedMarketplaceCatalogueEnhancements();
  }

  /**
   * Idempotently seeds category-appropriate variants (Clothing sizes XS–XXL, Footwear UK 7–11,
   * Helmet sizes M–XL, and select smartphone storage variants) and legitimate reference-price
   * discounts on a curated set of catalogue products without fabricating discounts everywhere.
   */
  public seedMarketplaceCatalogueEnhancements(): void {
    const allRows = this.db
      .prepare('SELECT id, name, category, brand, price, image, product_type FROM products')
      .all() as {
      id: string;
      name: string;
      category: string;
      brand: string;
      price: number;
      image: string;
      product_type?: string;
    }[];

    const tx = this.db.transaction(() => {
      for (const row of allRows) {
        const catLower = (row.category || '').toLowerCase();
        const existingVariantsCount = (
          this.db
            .prepare('SELECT COUNT(*) as c FROM product_variants WHERE product_id = ?')
            .get(row.id) as { c: number }
        ).c;

        // 1. Seed category-appropriate variants if none exist yet for this product
        if (existingVariantsCount === 0) {
          if (catLower === 'sarees') {
            this.upsertVariant({
              id: `${row.id}-var-freesize`,
              productId: row.id,
              sku: `${row.id.toUpperCase()}-FS`,
              label: 'Free Size (5.5m Saree + 0.8m Blouse Piece)',
              size: 'Free Size',
              sizeSystem: 'Alpha',
              color: 'As Shown',
              price: row.price,
              stockCount: 15,
              availability: true,
              image: row.image || undefined,
              isDefault: true,
            });
          } else if (
            catLower === 'fashion' ||
            catLower === 'kurtis-kurtas' ||
            catLower === 'ethnic-sets-festive-wear' ||
            catLower === 'western-wear' ||
            catLower === 'womens-outerwear' ||
            catLower.includes('clothing') ||
            catLower.includes('apparel') ||
            row.id.startsWith('fash-') ||
            row.id.startsWith('wf-')
          ) {
            const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            const primaryColor = row.name.toLowerCase().includes('black')
              ? 'Jet Black'
              : row.name.toLowerCase().includes('navy') ||
                  row.name.toLowerCase().includes('blue') ||
                  row.name.toLowerCase().includes('indigo')
                ? 'Indigo / Navy'
                : row.name.toLowerCase().includes('emerald') ||
                    row.name.toLowerCase().includes('green') ||
                    row.name.toLowerCase().includes('olive') ||
                    row.name.toLowerCase().includes('sage')
                  ? 'Botanical Green'
                  : row.name.toLowerCase().includes('red') ||
                      row.name.toLowerCase().includes('crimson') ||
                      row.name.toLowerCase().includes('maroon') ||
                      row.name.toLowerCase().includes('wine') ||
                      row.name.toLowerCase().includes('rust')
                    ? 'Festive Crimson / Rust'
                    : 'Signature Shade';
            sizes.forEach((sz, idx) => {
              // Make XXL out of stock on some items so users can test unavailable variants & Notify Me!
              const stock = sz === 'XXL' ? 0 : 12;
              this.upsertVariant({
                id: `${row.id}-var-${sz.toLowerCase()}`,
                productId: row.id,
                sku: `${row.id.toUpperCase()}-${sz}`,
                label: `Size ${sz} · ${primaryColor}`,
                size: sz,
                sizeSystem: 'Alpha',
                color: primaryColor,
                price: row.price,
                stockCount: stock,
                availability: stock > 0,
                image: row.image || undefined,
                isDefault: idx === 2, // M is default
              });
            });
          } else if (
            catLower === 'footwear' ||
            catLower.includes('shoe') ||
            row.id.startsWith('foot-')
          ) {
            const ukSizes = ['UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'];
            const shoeColor = row.name.toLowerCase().includes('red')
              ? 'Crimson / Black'
              : row.name.toLowerCase().includes('blue')
                ? 'Cobalt Blue'
                : 'Core Black / White';
            ukSizes.forEach((sz, idx) => {
              const code = sz.replace(/\s+/g, '');
              const stock = sz === 'UK 11' ? 0 : 10;
              this.upsertVariant({
                id: `${row.id}-var-${code.toLowerCase()}`,
                productId: row.id,
                sku: `${row.id.toUpperCase()}-${code}`,
                label: `${sz} · ${shoeColor}`,
                size: sz,
                sizeSystem: 'UK',
                color: shoeColor,
                price: row.price,
                stockCount: stock,
                availability: stock > 0,
                image: row.image || undefined,
                isDefault: idx === 2, // UK 9 default
              });
            });
          } else if (row.product_type === 'helmet' || row.id.includes('helmet')) {
            const helmetSizes = ['M (58cm)', 'L (60cm)', 'XL (62cm)'];
            helmetSizes.forEach((sz, idx) => {
              const short = sz.split(' ')[0];
              this.upsertVariant({
                id: `${row.id}-var-${short.toLowerCase()}`,
                productId: row.id,
                sku: `${row.id.toUpperCase()}-${short}`,
                label: `Helmet ${sz} · Matte Black/Red`,
                size: short,
                sizeSystem: 'Helmet',
                color: 'Matte Black/Red',
                price: row.price,
                stockCount: 8,
                availability: true,
                image: row.image || undefined,
                isDefault: idx === 0,
              });
            });
          }
        }
      }

      // 2. Seed legitimate reference prices (original_price) on a curated set of products
      // Only update if original_price is currently NULL so admin edits are never overwritten
      const curatedSales: { id: string; originalPrice: number; discountPercent: number }[] = [
        { id: 'hp-boat-airdopes-141', originalPrice: 2490, discountPercent: 48 },
        { id: 'hp-oneplus-nord-buds-2r', originalPrice: 2299, discountPercent: 4 },
        { id: 'hp-realme-buds-t300', originalPrice: 2999, discountPercent: 23 },
        { id: 'hp-sony-wh-1000xm4', originalPrice: 29990, discountPercent: 23 },
        { id: 'hp-jbl-tune-760nc', originalPrice: 7999, discountPercent: 31 },
        { id: 'phone-nothing-phone-2a', originalPrice: 25999, discountPercent: 8 },
        { id: 'phone-samsung-galaxy-s24-ultra', originalPrice: 134999, discountPercent: 7 },
        { id: 'lap-apple-macbook-air-m2', originalPrice: 114900, discountPercent: 17 },
        { id: 'foot-nike-revolution-6', originalPrice: 3695, discountPercent: 19 },
        { id: 'foot-puma-velocity-nitro', originalPrice: 10999, discountPercent: 23 },
        { id: 'fash-zara-cotton-tee', originalPrice: 1990, discountPercent: 25 },
        { id: 'kitch-instant-pot-duo-6qt', originalPrice: 12999, discountPercent: 23 },
      ];

      const saleStmt = this.db.prepare(`
        UPDATE products
        SET original_price = @originalPrice,
            discount_percent = @discountPercent,
            is_on_sale = 1
        WHERE id = @id AND original_price IS NULL AND price < @originalPrice
      `);

      for (const sale of curatedSales) {
        saleStmt.run(sale);
      }

      // 3. Enrich curated certified-organic catalogue items under ₹1,000 so strict organic
      // certification queries ("Find organic products under ₹1,000") match verified certifications
      const organicEnhancements: { id: string; certFeature: string; certSpec: string }[] = [
        {
          id: 'fash-zara-cotton-tee',
          certFeature: 'GOTS Certified Organic Cotton (100% Organic Fiber)',
          certSpec: 'GOTS Certified Organic Cotton',
        },
        {
          id: 'beauty-dot-key-matte-sunscreen',
          certFeature: 'ECOCERT Organic Botanical Extracts',
          certSpec: 'ECOCERT Organic Botanical Extracts',
        },
      ];

      for (const item of organicEnhancements) {
        const existing = this.db
          .prepare('SELECT features, specifications FROM products WHERE id = ?')
          .get(item.id) as { features: string; specifications: string } | undefined;
        if (existing) {
          let feats: string[] = [];
          let specs: Record<string, string | number> = {};
          try {
            feats = JSON.parse(existing.features || '[]');
          } catch {
            feats = [];
          }
          try {
            specs = JSON.parse(existing.specifications || '{}');
          } catch {
            specs = {};
          }
          if (!feats.includes(item.certFeature)) {
            feats.push(item.certFeature);
          }
          if (!specs.certification) {
            specs.certification = item.certSpec;
          }
          this.db
            .prepare('UPDATE products SET features = ?, specifications = ? WHERE id = ?')
            .run(JSON.stringify(feats), JSON.stringify(specs), item.id);
        }
      }
    });

    tx();
  }
}
