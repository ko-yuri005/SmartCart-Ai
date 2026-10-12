-- Schema for Mini Shopping Assistant AI Ecommerce Marketplace SQLite Database

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
  features TEXT NOT NULL,          -- JSON string array, e.g. ["ANC", "IPX5"]
  specifications TEXT NOT NULL,    -- JSON key-value object
  use_cases TEXT NOT NULL,         -- JSON string array, e.g. ["gym", "calls"]
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
  recommended_product_ids TEXT,   -- JSON array of product IDs
  extracted_requirements TEXT,    -- JSON object of active requirements
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
