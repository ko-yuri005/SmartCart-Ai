import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.resolve(process.cwd(), env.DATABASE_FILE);
  const dbDir = path.dirname(dbPath);

  if (env.NODE_ENV === 'production' && (dbPath.startsWith('/tmp/') || dbPath.startsWith('\\tmp\\'))) {
    console.warn(
      `[Database] WARNING: DATABASE_FILE (${dbPath}) is inside an ephemeral /tmp directory in production. Mount a persistent disk (e.g. /var/data/shopping.sqlite on Render or /data/shopping.sqlite on Railway) so production writes persist across restarts.`
    );
  }

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // Initialize schema (check both compiled dist/db/schema.sql and src/db/schema.sql)
  const schemaPathDist = path.resolve(__dirname, 'schema.sql');
  const schemaPathSrc = path.resolve(process.cwd(), 'src', 'db', 'schema.sql');
  if (fs.existsSync(schemaPathDist)) {
    const schemaSql = fs.readFileSync(schemaPathDist, 'utf-8');
    dbInstance.exec(schemaSql);
  } else if (fs.existsSync(schemaPathSrc)) {
    const schemaSql = fs.readFileSync(schemaPathSrc, 'utf-8');
    dbInstance.exec(schemaSql);
  } else {
    initFallbackSchema(dbInstance);
  }

  // Run safe incremental migrations on existing database tables
  initMarketplaceTables(dbInstance);

  return dbInstance;
}

function safeAddColumn(db: Database.Database, table: string, columnDef: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
  } catch {
    // Column already exists
  }
}

export function initMarketplaceTables(db: Database.Database) {
  // 1. Ensure incremental columns on products
  safeAddColumn(db, 'products', 'product_type TEXT');
  safeAddColumn(db, 'products', 'image_type TEXT');
  safeAddColumn(db, 'products', 'stock_count INTEGER NOT NULL DEFAULT 25');
  safeAddColumn(db, 'products', 'original_price REAL');
  safeAddColumn(db, 'products', 'discount_percent REAL');
  safeAddColumn(db, 'products', 'sale_start_at DATETIME');
  safeAddColumn(db, 'products', 'sale_end_at DATETIME');
  safeAddColumn(db, 'products', 'is_on_sale INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'products', "image_gallery TEXT NOT NULL DEFAULT '[]'");
  safeAddColumn(db, 'products', 'is_archived INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'products', 'updated_at DATETIME');

  // 2. Create new marketplace tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      label TEXT NOT NULL,
      size TEXT,
      size_system TEXT,
      color TEXT,
      storage_or_model TEXT,
      price REAL NOT NULL,
      original_price REAL,
      stock_count INTEGER NOT NULL DEFAULT 15,
      availability INTEGER NOT NULL DEFAULT 1,
      image TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
      full_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      default_address TEXT,
      preferences TEXT NOT NULL DEFAULT '{}',
      must_change_password INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed', 'free_shipping')),
      discount_value REAL NOT NULL DEFAULT 0,
      min_order_amount REAL NOT NULL DEFAULT 0,
      max_discount_amount REAL,
      start_at DATETIME,
      end_at DATETIME,
      eligible_categories TEXT NOT NULL DEFAULT '[]',
      eligible_product_ids TEXT NOT NULL DEFAULT '[]',
      max_total_uses INTEGER,
      max_uses_per_user INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupon_usages (
      id TEXT PRIMARY KEY,
      coupon_code TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      discount_applied REAL NOT NULL DEFAULT 0,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_coupon_usages_code ON coupon_usages(coupon_code);
    CREATE INDEX IF NOT EXISTS idx_coupon_usages_session ON coupon_usages(session_id);

    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      coupon_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT NOT NULL DEFAULT '',
      variant_label TEXT,
      selected_size TEXT,
      selected_color TEXT,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cart_id, product_id, variant_id),
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT,
      idempotency_key TEXT UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'demo_card',
      is_demo_checkout INTEGER NOT NULL DEFAULT 1,
      demo_disclaimer TEXT NOT NULL,
      subtotal REAL NOT NULL,
      item_discount_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      coupon_discount_amount REAL NOT NULL DEFAULT 0,
      coupon_code TEXT,
      shipping_cost REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      final_total REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'Confirmed' CHECK(status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
      status_history TEXT NOT NULL,
      stock_restored INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
    CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      variant_label TEXT,
      selected_size TEXT,
      selected_color TEXT,
      product_name TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      image TEXT NOT NULL,
      unit_price REAL NOT NULL,
      original_unit_price REAL,
      item_discount_amount REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS account_profiles (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      full_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      default_address TEXT,
      preferences TEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title TEXT NOT NULL DEFAULT '',
      comment TEXT NOT NULL,
      photos TEXT NOT NULL DEFAULT '[]',
      category_attributes TEXT NOT NULL DEFAULT '{}',
      is_verified_purchase INTEGER NOT NULL DEFAULT 0,
      moderation_status TEXT NOT NULL DEFAULT 'published' CHECK(moderation_status IN ('published', 'pending', 'rejected', 'flagged')),
      moderation_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_reviews_session_id ON product_reviews(session_id);

    CREATE TABLE IF NOT EXISTS restock_subscriptions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT NOT NULL DEFAULT '',
      variant_label TEXT,
      selected_size TEXT,
      selected_color TEXT,
      user_id TEXT,
      session_id TEXT NOT NULL,
      email TEXT NOT NULL,
      consent_given INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Subscribed' CHECK(status IN ('Subscribed', 'EligibleForNotification', 'Notified', 'Cancelled')),
      notified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_restock_subscriptions_product_id ON restock_subscriptions(product_id);
    CREATE INDEX IF NOT EXISTS idx_restock_subscriptions_session_id ON restock_subscriptions(session_id);

    CREATE TABLE IF NOT EXISTS product_requests (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      normalized_url TEXT NOT NULL,
      requested_name TEXT,
      category_hint TEXT,
      description_notes TEXT,
      desired_size TEXT,
      desired_color TEXT,
      desired_variant TEXT,
      user_id TEXT,
      session_id TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      consent_given INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Requested' CHECK(status IN ('Requested', 'Under Review', 'Available', 'Unavailable', 'Closed')),
      linked_product_id TEXT,
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_product_requests_session_id ON product_requests(session_id);
    CREATE INDEX IF NOT EXISTS idx_product_requests_status ON product_requests(status);
  `);

  // 3. Ensure incremental columns on existing carts, cart_items, orders, order_items, account_profiles
  safeAddColumn(db, 'carts', 'user_id TEXT');
  safeAddColumn(db, 'account_profiles', 'user_id TEXT');

  safeAddColumn(db, 'cart_items', "variant_id TEXT NOT NULL DEFAULT ''");
  safeAddColumn(db, 'cart_items', 'variant_label TEXT');
  safeAddColumn(db, 'cart_items', 'selected_size TEXT');
  safeAddColumn(db, 'cart_items', 'selected_color TEXT');

  safeAddColumn(db, 'orders', 'user_id TEXT');
  safeAddColumn(db, 'orders', 'item_discount_amount REAL NOT NULL DEFAULT 0');
  safeAddColumn(db, 'orders', 'coupon_discount_amount REAL NOT NULL DEFAULT 0');
  safeAddColumn(db, 'orders', 'stock_restored INTEGER NOT NULL DEFAULT 0');

  safeAddColumn(db, 'order_items', 'variant_id TEXT');
  safeAddColumn(db, 'order_items', 'variant_label TEXT');
  safeAddColumn(db, 'order_items', 'selected_size TEXT');
  safeAddColumn(db, 'order_items', 'selected_color TEXT');
  safeAddColumn(db, 'order_items', 'original_unit_price REAL');
  safeAddColumn(db, 'order_items', 'item_discount_amount REAL NOT NULL DEFAULT 0');

  // 4. Migrate cart_items UNIQUE constraint if created before variant_id support
  try {
    const cartItemsMeta = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cart_items'")
      .get() as { sql?: string } | undefined;
    if (
      cartItemsMeta?.sql &&
      !cartItemsMeta.sql.includes('UNIQUE(cart_id, product_id, variant_id)')
    ) {
      db.pragma('foreign_keys = OFF');
      const migrateCartItemsTx = db.transaction(() => {
        db.exec(`
          CREATE TABLE cart_items_v2 (
            id TEXT PRIMARY KEY,
            cart_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            variant_id TEXT NOT NULL DEFAULT '',
            variant_label TEXT,
            selected_size TEXT,
            selected_color TEXT,
            quantity INTEGER NOT NULL CHECK(quantity > 0),
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(cart_id, product_id, variant_id),
            FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          );
          INSERT INTO cart_items_v2 (
            id, cart_id, product_id, variant_id, variant_label, selected_size, selected_color, quantity, added_at, updated_at
          )
          SELECT
            id, cart_id, product_id, COALESCE(variant_id, ''), variant_label, selected_size, selected_color, quantity, added_at, updated_at
          FROM cart_items;
          DROP TABLE cart_items;
          ALTER TABLE cart_items_v2 RENAME TO cart_items;
          CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
        `);
      });
      migrateCartItemsTx();
      db.pragma('foreign_keys = ON');
    }
  } catch {
    db.pragma('foreign_keys = ON');
  }

  // 5. Migrate orders status CHECK constraint if created before 'Processing' status was added
  try {
    const ordersMeta = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'")
      .get() as { sql?: string } | undefined;
    if (ordersMeta?.sql && !ordersMeta.sql.includes("'Processing'")) {
      db.pragma('foreign_keys = OFF');
      const migrateOrdersTx = db.transaction(() => {
        db.exec(`
          CREATE TABLE orders_v2 (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            user_id TEXT,
            idempotency_key TEXT UNIQUE,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            shipping_address TEXT NOT NULL,
            payment_method TEXT NOT NULL DEFAULT 'demo_card',
            is_demo_checkout INTEGER NOT NULL DEFAULT 1,
            demo_disclaimer TEXT NOT NULL,
            subtotal REAL NOT NULL,
            item_discount_amount REAL NOT NULL DEFAULT 0,
            discount_amount REAL NOT NULL DEFAULT 0,
            coupon_discount_amount REAL NOT NULL DEFAULT 0,
            coupon_code TEXT,
            shipping_cost REAL NOT NULL DEFAULT 0,
            tax_amount REAL NOT NULL DEFAULT 0,
            final_total REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            status TEXT NOT NULL DEFAULT 'Confirmed' CHECK(status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
            status_history TEXT NOT NULL,
            stock_restored INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO orders_v2 (
            id, session_id, user_id, idempotency_key, customer_name, customer_email, customer_phone,
            shipping_address, payment_method, is_demo_checkout, demo_disclaimer,
            subtotal, item_discount_amount, discount_amount, coupon_discount_amount, coupon_code,
            shipping_cost, tax_amount, final_total, currency, status, status_history, stock_restored,
            notes, created_at, updated_at
          )
          SELECT
            id, session_id, user_id, idempotency_key, customer_name, customer_email, customer_phone,
            shipping_address, payment_method, is_demo_checkout, demo_disclaimer,
            subtotal, COALESCE(item_discount_amount, 0), discount_amount, COALESCE(coupon_discount_amount, 0), coupon_code,
            shipping_cost, tax_amount, final_total, currency, status, status_history, COALESCE(stock_restored, 0),
            notes, created_at, updated_at
          FROM orders;
          DROP TABLE orders;
          ALTER TABLE orders_v2 RENAME TO orders;
          CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
          CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
        `);
      });
      migrateOrdersTx();
      db.pragma('foreign_keys = ON');
    }
  } catch {
    db.pragma('foreign_keys = ON');
  }

  // 6. Seed default server-validated coupons (idempotent INSERT OR IGNORE)
  seedDefaultCoupons(db);
}

export function seedDefaultCoupons(db: Database.Database) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO coupons (
      code, description, discount_type, discount_value, min_order_amount,
      max_discount_amount, start_at, end_at, eligible_categories, eligible_product_ids,
      max_total_uses, max_uses_per_user, used_count, is_active
    ) VALUES (
      @code, @description, @discount_type, @discount_value, @min_order_amount,
      @max_discount_amount, @start_at, @end_at, @eligible_categories, @eligible_product_ids,
      @max_total_uses, @max_uses_per_user, 0, @is_active
    )
  `);

  const defaults = [
    {
      code: 'WELCOME10',
      description: 'WELCOME10 (10% off up to ₹1,500 on orders of ₹1,000+)',
      discount_type: 'percentage',
      discount_value: 10,
      min_order_amount: 1000,
      max_discount_amount: 1500,
      start_at: '2025-01-01T00:00:00.000Z',
      end_at: '2030-12-31T23:59:59.000Z',
      eligible_categories: '[]',
      eligible_product_ids: '[]',
      max_total_uses: 10000,
      max_uses_per_user: 5,
      is_active: 1,
    },
    {
      code: 'SAVE500',
      description: 'SAVE500 (Flat ₹500 off on orders of ₹5,000+)',
      discount_type: 'fixed',
      discount_value: 500,
      min_order_amount: 5000,
      max_discount_amount: 500,
      start_at: '2025-01-01T00:00:00.000Z',
      end_at: '2030-12-31T23:59:59.000Z',
      eligible_categories: '[]',
      eligible_product_ids: '[]',
      max_total_uses: 5000,
      max_uses_per_user: 3,
      is_active: 1,
    },
    {
      code: 'FREESHIP',
      description: 'FREESHIP (Free standard delivery on any order)',
      discount_type: 'free_shipping',
      discount_value: 0,
      min_order_amount: 0,
      max_discount_amount: null,
      start_at: '2025-01-01T00:00:00.000Z',
      end_at: '2030-12-31T23:59:59.000Z',
      eligible_categories: '[]',
      eligible_product_ids: '[]',
      max_total_uses: 10000,
      max_uses_per_user: 10,
      is_active: 1,
    },
    {
      code: 'APPAREL15',
      description: 'APPAREL15 (15% off up to ₹1,000 on Clothing & Footwear above ₹999)',
      discount_type: 'percentage',
      discount_value: 15,
      min_order_amount: 999,
      max_discount_amount: 1000,
      start_at: '2025-01-01T00:00:00.000Z',
      end_at: '2030-12-31T23:59:59.000Z',
      eligible_categories: JSON.stringify(['Clothing & Apparel', 'Footwear']),
      eligible_product_ids: '[]',
      max_total_uses: 2000,
      max_uses_per_user: 2,
      is_active: 1,
    },
    {
      code: 'EXPIRED20',
      description: 'EXPIRED20 (Expired promotional coupon)',
      discount_type: 'percentage',
      discount_value: 20,
      min_order_amount: 500,
      max_discount_amount: 1000,
      start_at: '2024-01-01T00:00:00.000Z',
      end_at: '2024-12-31T23:59:59.000Z',
      eligible_categories: '[]',
      eligible_product_ids: '[]',
      max_total_uses: 100,
      max_uses_per_user: 1,
      is_active: 1,
    },
  ];

  for (const c of defaults) {
    try {
      stmt.run(c);
    } catch {
      // Ignore if already seeded
    }
  }
}

function initFallbackSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      discount_percent REAL,
      sale_start_at DATETIME,
      sale_end_at DATETIME,
      is_on_sale INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      rating REAL NOT NULL DEFAULT 0.0,
      review_count INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      features TEXT NOT NULL,
      specifications TEXT NOT NULL,
      use_cases TEXT NOT NULL,
      image TEXT NOT NULL,
      image_gallery TEXT NOT NULL DEFAULT '[]',
      product_type TEXT,
      image_type TEXT,
      availability INTEGER NOT NULL DEFAULT 1,
      stock_count INTEGER NOT NULL DEFAULT 25,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
    CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      recommended_product_ids TEXT,
      extracted_requirements TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

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
  initMarketplaceTables(db);
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
