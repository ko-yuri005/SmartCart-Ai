import React, { useState, useEffect, useCallback } from 'react';
import {
  UserDTO,
  AuthResponseDTO,
  AdminMarketplaceSummaryDTO,
  Product,
  OrderDTO,
  OrderStatus,
  ProductReviewDTO,
  ReviewModerationStatus,
  ProductRequestDTO,
  ProductRequestStatus,
  RestockSubscriptionDTO,
  CouponDTO,
} from '../../types/shopping';
import {
  loginApi,
  fetchAdminSummaryApi,
  fetchAdminProductsApi,
  createAdminProductApi,
  updateAdminProductApi,
  archiveAdminProductApi,
  uploadAdminProductImageApi,
  upsertAdminVariantApi,
  fetchAdminOrdersApi,
  updateAdminOrderStatusApi,
  fetchAdminReviewsApi,
  moderateAdminReviewApi,
  fetchAdminProductRequestsApi,
  updateAdminProductRequestApi,
  promoteAdminProductRequestApi,
  fetchAdminRestockSubscriptionsApi,
  updateAdminRestockSubscriptionApi,
  fetchAdminCouponsApi,
  upsertAdminCouponApi,
} from '../../api/client';
import {
  Shield,
  Package,
  ShoppingBag,
  Star,
  Link2,
  Bell,
  Ticket,
  Plus,
  Archive,
  CheckCircle2,
  AlertCircle,
  Upload,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface AdminDashboardViewProps {
  sessionId: string;
  authUser: UserDTO | null;
  categories: string[];
  onAuthSuccess: (authRes: AuthResponseDTO) => Promise<void> | void;
  onCatalogueChanged: () => void;
}

type AdminSection =
  | 'overview'
  | 'products'
  | 'orders'
  | 'requests'
  | 'reviews'
  | 'coupons';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  sessionId,
  authUser,
  categories,
  onAuthSuccess,
  onCatalogueChanged,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [summary, setSummary] = useState<AdminMarketplaceSummaryDTO | null>(null);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [adminOrders, setAdminOrders] = useState<OrderDTO[]>([]);
  const [adminReviews, setAdminReviews] = useState<ProductReviewDTO[]>([]);
  const [adminRequests, setAdminRequests] = useState<ProductRequestDTO[]>([]);
  const [adminRestocks, setAdminRestocks] = useState<RestockSubscriptionDTO[]>([]);
  const [adminCoupons, setAdminCoupons] = useState<CouponDTO[]>([]);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin quick sign-in state if not logged in as admin
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Product editor state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodCategory, setProdCategory] = useState('electronics');
  const [prodType, setProdType] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodPrice, setProdPrice] = useState<string>('');
  const [prodOriginalPrice, setProdOriginalPrice] = useState<string>('');
  const [prodStock, setProdStock] = useState<string>('15');
  const [prodImage, setProdImage] = useState('');
  const [prodFeatures, setProdFeatures] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Quick Variant Adder state
  const [varProductId, setVarProductId] = useState('');
  const [varSize, setVarSize] = useState('');
  const [varColor, setVarColor] = useState('');
  const [varPrice, setVarPrice] = useState('');
  const [varStock, setVarStock] = useState('10');

  // New Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponType, setCouponType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [couponValue, setCouponValue] = useState('10');
  const [couponMinSubtotal, setCouponMinSubtotal] = useState('500');

  const isAdmin = authUser?.role === 'admin';

  const notify = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 4000);
  };

  const loadAdminData = useCallback(() => {
    if (!isAdmin) return;
    fetchAdminSummaryApi()
      .then((res) => setSummary(res))
      .catch(() => {});
    fetchAdminProductsApi()
      .then((res) => setAdminProducts(res || []))
      .catch(() => {});
    fetchAdminOrdersApi()
      .then((res) => setAdminOrders(res || []))
      .catch(() => {});
    fetchAdminReviewsApi()
      .then((res) => setAdminReviews(res || []))
      .catch(() => {});
    fetchAdminProductRequestsApi()
      .then((res) => setAdminRequests(res || []))
      .catch(() => {});
    fetchAdminRestockSubscriptionsApi()
      .then((res) => setAdminRestocks(res || []))
      .catch(() => {});
    fetchAdminCouponsApi()
      .then((res) => setAdminCoupons(res || []))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await loginApi({
        usernameOrEmail: username,
        password,
        guestSessionId: sessionId,
      });
      await onAuthSuccess(res);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Admin login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const populateProductForm = (p: Product) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdBrand(p.brand);
    setProdCategory(p.category);
    setProdType(p.product_type || p.category);
    setProdDescription(p.description);
    setProdPrice(String(p.price));
    setProdOriginalPrice(p.original_price ? String(p.original_price) : '');
    setProdStock(String(p.stock_count ?? 10));
    setProdImage(p.image || '');
    setProdFeatures((p.features || []).join(', '));
    setVarProductId(p.id);
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdBrand('');
    setProdCategory(categories[0] || 'electronics');
    setProdType('');
    setProdDescription('');
    setProdPrice('');
    setProdOriginalPrice('');
    setProdStock('15');
    setProdImage('');
    setProdFeatures('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priceNum = Number(prodPrice);
      const origNum = prodOriginalPrice ? Number(prodOriginalPrice) : null;
      const stockNum = Number(prodStock);
      const featuresList = prodFeatures
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingProductId) {
        await updateAdminProductApi(editingProductId, {
          name: prodName,
          brand: prodBrand,
          category: prodCategory,
          product_type: prodType || prodCategory,
          description: prodDescription,
          price: priceNum,
          original_price: origNum,
          stock_count: stockNum,
          availability: stockNum > 0,
          image: prodImage || undefined,
          features: featuresList,
        });
        notify('success', `Updated product "${prodName}"`);
      } else {
        await createAdminProductApi({
          name: prodName,
          brand: prodBrand,
          category: prodCategory,
          product_type: prodType || prodCategory,
          description: prodDescription,
          price: priceNum,
          original_price: origNum,
          stock_count: stockNum,
          image: prodImage || undefined,
          features: featuresList,
        });
        notify('success', `Created product "${prodName}"`);
      }
      resetProductForm();
      loadAdminData();
      onCatalogueChanged();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save product.');
    }
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetId = editingProductId || adminProducts[0]?.id;
    if (!targetId) {
      notify('error', 'Select or save a product first to upload an image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await uploadAdminProductImageApi(targetId, {
          imageData: String(reader.result || ''),
          mimeType: file.type,
          isPrimary: true,
        });
        setProdImage(res.image);
        notify('success', `Uploaded verified image: ${res.image}`);
        loadAdminData();
        onCatalogueChanged();
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'Image upload failed.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varProductId) return;
    try {
      await upsertAdminVariantApi(varProductId, {
        size: varSize || undefined,
        color: varColor || undefined,
        price: Number(varPrice || prodPrice || 999),
        stockCount: Number(varStock || 10),
      });
      notify('success', `Saved variant (${varSize} ${varColor}) for ${varProductId}`);
      setVarSize('');
      setVarColor('');
      loadAdminData();
      onCatalogueChanged();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save variant.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-2xl bg-white border border-[#E6E1D6] shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#DCE7D9] border border-[#C5D7C0] flex items-center justify-center text-[#254B3B]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-900">Admin Marketplace Console</h1>
              <p className="text-xs text-zinc-500">
                Administrator role required to manage products, inventory, and requests
              </p>
            </div>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                Admin Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                Admin Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Demo local password: admin"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loginLoading ? 'Signing in...' : 'Sign In as Administrator'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredAdminProducts = adminProducts.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F5]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Admin Header */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E6E1D6] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#254B3B] text-white flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900">
                Admin Marketplace Control Center
              </h1>
              <p className="text-xs text-zinc-500">
                Signed in as @{authUser.username} • Manage products, variants, sales, orders, reviews &amp; customer requests
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'overview', label: 'Overview', icon: <Shield className="w-3.5 h-3.5" /> },
                {
                  id: 'products',
                  label: `Products (${adminProducts.length})`,
                  icon: <ShoppingBag className="w-3.5 h-3.5" />,
                },
                {
                  id: 'orders',
                  label: `Orders (${adminOrders.length})`,
                  icon: <Package className="w-3.5 h-3.5" />,
                },
                {
                  id: 'requests',
                  label: `Requests & Restocks (${adminRequests.length + adminRestocks.length})`,
                  icon: <Link2 className="w-3.5 h-3.5" />,
                },
                {
                  id: 'reviews',
                  label: `Reviews (${adminReviews.length})`,
                  icon: <Star className="w-3.5 h-3.5" />,
                },
                {
                  id: 'coupons',
                  label: `Coupons (${adminCoupons.length})`,
                  icon: <Ticket className="w-3.5 h-3.5" />,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  activeSection === tab.id
                    ? 'bg-[#254B3B] border-[#254B3B] text-white'
                    : 'bg-[#FAF8F5] border-[#E6E1D6] text-zinc-700 hover:bg-[#F3EFE6]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={loadAdminData}
              aria-label="Refresh admin data"
              className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFE6] border border-[#E6E1D6] text-zinc-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        {/* OVERVIEW SECTION */}
        {activeSection === 'overview' && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#E6E1D6] space-y-1">
              <span className="text-[11px] text-zinc-500 font-semibold uppercase">
                Active Products
              </span>
              <p className="text-2xl font-bold text-zinc-900">{summary.activeProducts}</p>
              <p className="text-[11px] text-zinc-500">
                {summary.archivedProducts} archived • {summary.outOfStockProducts} out of stock
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E6E1D6] space-y-1">
              <span className="text-[11px] text-zinc-500 font-semibold uppercase">
                Total Orders
              </span>
              <p className="text-2xl font-bold text-zinc-900">{summary.totalOrders}</p>
              <p className="text-[11px] text-emerald-700 font-semibold">
                ₹{(summary.totalRevenue ?? summary.totalOrderRevenue ?? 0).toLocaleString('en-IN')} GMV
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E6E1D6] space-y-1">
              <span className="text-[11px] text-zinc-500 font-semibold uppercase">
                Product Requests
              </span>
              <p className="text-2xl font-bold text-[#254B3B]">{summary.pendingProductRequests}</p>
              <p className="text-[11px] text-zinc-500">Pending customer URL requests</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E6E1D6] space-y-1">
              <span className="text-[11px] text-zinc-500 font-semibold uppercase">
                Restock Alerts
              </span>
              <p className="text-2xl font-bold text-amber-700">
                {summary.activeRestockSubscriptions}
              </p>
              <p className="text-[11px] text-zinc-500">Active restock subscriptions</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E6E1D6] space-y-1">
              <span className="text-[11px] text-zinc-500 font-semibold uppercase">
                Reviews &amp; Coupons
              </span>
              <p className="text-2xl font-bold text-zinc-900">{summary.totalReviews}</p>
              <p className="text-[11px] text-zinc-500">{summary.activeCoupons} active coupons</p>
            </div>
          </div>
        )}

        {/* PRODUCTS & VARIANTS SECTION */}
        {activeSection === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Create/Edit Product + Variant Manager */}
            <div className="lg:col-span-5 space-y-5">
              <form
                onSubmit={handleSaveProduct}
                className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-[#254B3B]" />
                    <span>
                      {editingProductId ? `Edit Product (${editingProductId})` : 'Add New Product'}
                    </span>
                  </h2>
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="text-xs text-[#254B3B] underline font-semibold"
                    >
                      + New Product
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Product Name *"
                    className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    placeholder="Brand *"
                    className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    placeholder="Category (e.g., footwear, clothing)"
                    className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                  <input
                    type="text"
                    value={prodType}
                    onChange={(e) => setProdType(e.target.value)}
                    placeholder="Product Type (e.g., running_shoes)"
                    className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-600 mb-0.5">
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-600 mb-0.5">
                      MRP Reference (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={prodOriginalPrice}
                      onChange={(e) => setProdOriginalPrice(e.target.value)}
                      placeholder="Optional sale MRP"
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-600 mb-0.5">
                      Stock Qty *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                    />
                  </div>
                </div>

                <textarea
                  rows={2}
                  required
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Detailed product description *"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-semibold text-zinc-700">
                      Product Image URL or Upload (JPEG/PNG/WebP ≤ 5MB)
                    </label>
                    <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DCE7D9] hover:bg-[#C5D7C0] border border-[#C5D7C0] text-[#254B3B] text-[11px] font-semibold cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={prodImage}
                    onChange={(e) => setProdImage(e.target.value)}
                    placeholder="https://... or /uploads/products/..."
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                </div>

                <input
                  type="text"
                  value={prodFeatures}
                  onChange={(e) => setProdFeatures(e.target.value)}
                  placeholder="Comma-separated features (e.g., Certified Organic, 1 Year Warranty)"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                />

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors"
                >
                  {editingProductId ? 'Save Product Changes' : 'Create Product in Catalogue'}
                </button>
              </form>

              {/* Variant Manager */}
              <form
                onSubmit={handleAddVariant}
                className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-3 shadow-sm"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Add / Update Size &amp; Colour Variant
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={varProductId}
                    onChange={(e) => setVarProductId(e.target.value)}
                    placeholder="Product ID (e.g. prod-010)"
                    className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                  <input
                    type="text"
                    value={varSize}
                    onChange={(e) => setVarSize(e.target.value)}
                    placeholder="Size (e.g. M, L, UK 9)"
                    className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={varColor}
                    onChange={(e) => setVarColor(e.target.value)}
                    placeholder="Colour (e.g. Black)"
                    className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                  <input
                    type="number"
                    required
                    value={varPrice}
                    onChange={(e) => setVarPrice(e.target.value)}
                    placeholder="Variant Price (₹)"
                    className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                  <input
                    type="number"
                    required
                    value={varStock}
                    onChange={(e) => setVarStock(e.target.value)}
                    placeholder="Stock Qty"
                    className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-[#254B3B] text-white text-xs font-semibold transition-colors"
                >
                  Save Product Variant
                </button>
              </form>
            </div>

            {/* Right: Catalogue Product List */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-zinc-900">
                  Catalogue Inventory ({filteredAdminProducts.length})
                </h2>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search by ID, name, brand..."
                  className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs w-64"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredAdminProducts.slice(0, 60).map((p) => (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      p.is_archived
                        ? 'bg-zinc-100 border-zinc-300 opacity-70'
                        : 'bg-[#FAF8F5] border-[#E6E1D6]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-500">{p.id}</span>
                        <span className="text-xs font-bold text-zinc-900 truncate">{p.name}</span>
                        {p.is_on_sale && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                            {p.discount_percent}% OFF
                          </span>
                        )}
                        {p.is_archived && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 text-[10px] font-bold">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        {p.brand} • {p.category} • ₹{p.price.toLocaleString('en-IN')}
                        {p.original_price ? ` (MRP ₹${p.original_price.toLocaleString('en-IN')})` : ''} • Stock: {p.stock_count ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => populateProductForm(p)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#DCE7D9]/50 border border-[#E6E1D6] text-xs font-semibold text-zinc-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await archiveAdminProductApi(p.id, !p.is_archived);
                            notify(
                              'success',
                              `${p.is_archived ? 'Restored' : 'Archived'} ${p.name}`
                            );
                            loadAdminData();
                            onCatalogueChanged();
                          } catch (err) {
                            notify(
                              'error',
                              err instanceof Error ? err.message : 'Archive action failed.'
                            );
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-[#E6E1D6] text-xs font-semibold text-zinc-700 hover:text-rose-700 flex items-center gap-1"
                      >
                        <Archive className="w-3 h-3" />
                        <span>{p.is_archived ? 'Restore' : 'Archive'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS SECTION */}
        {activeSection === 'orders' && (
          <div className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900">
              All Customer Orders ({adminOrders.length})
            </h2>
            {adminOrders.length === 0 ? (
              <p className="text-xs text-zinc-500">No orders placed yet.</p>
            ) : (
              <div className="space-y-3">
                {adminOrders.map((o) => (
                  <div
                    key={o.id}
                    className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900">{o.id}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#DCE7D9] text-[#254B3B] text-[10px] font-bold">
                          {o.status}
                        </span>
                        <span className="text-xs font-bold text-emerald-800">
                          ₹{o.pricing.finalTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        {o.customerName} ({o.customerEmail}) • {o.items.length} item(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          'Pending',
                          'Confirmed',
                          'Processing',
                          'Shipped',
                          'Delivered',
                          'Cancelled',
                        ] as OrderStatus[]
                      ).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={o.status === st}
                          onClick={async () => {
                            try {
                              await updateAdminOrderStatusApi(o.id, st, `Admin updated to ${st}`);
                              notify('success', `Order ${o.id} marked as ${st}`);
                              loadAdminData();
                              onCatalogueChanged();
                            } catch (err) {
                              notify(
                                'error',
                                err instanceof Error ? err.message : 'Order update failed.'
                              );
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            o.status === st
                              ? 'bg-[#254B3B] border-[#254B3B] text-white'
                              : 'bg-white border-[#E6E1D6] text-zinc-700 hover:bg-[#F3EFE6]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRODUCT REQUESTS & RESTOCK SUBSCRIPTIONS SECTION */}
        {activeSection === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Missing Product Requests */}
            <div className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#254B3B]" />
                <span>Customer Missing-Product Requests ({adminRequests.length})</span>
              </h2>
              {adminRequests.length === 0 ? (
                <p className="text-xs text-zinc-500">No product requests submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {adminRequests.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-900">
                          {r.requestedName || r.normalizedUrl}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#DCE7D9] text-[#254B3B] text-[10px] font-bold">
                          {r.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 break-all">{r.sourceUrl}</p>
                      <p className="text-[11px] text-zinc-500">
                        Requested by: {r.contactEmail}
                        {r.desiredVariant ? ` • Variant: ${r.desiredVariant}` : ''}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {(
                          ['Under Review', 'Available', 'Unavailable', 'Closed'] as ProductRequestStatus[]
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={async () => {
                              await updateAdminProductRequestApi(r.id, { status: st });
                              notify('success', `Updated request to ${st}`);
                              loadAdminData();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#E6E1D6] text-[11px] font-semibold text-zinc-700 hover:bg-[#DCE7D9]/50"
                          >
                            Mark {st}
                          </button>
                        ))}
                        {!r.linkedProductId && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await promoteAdminProductRequestApi(r.id, {
                                  name: r.requestedName || `Requested Item`,
                                  brand: 'Curated Selection',
                                  category: r.categoryHint || 'electronics',
                                  price: 1999,
                                  description:
                                    r.descriptionNotes ||
                                    `Customer requested product from ${r.normalizedUrl}`,
                                  image: '',
                                  stockCount: 10,
                                });
                                notify(
                                  'success',
                                  'Promoted request to active catalogue product!'
                                );
                                loadAdminData();
                                onCatalogueChanged();
                              } catch (err) {
                                notify(
                                  'error',
                                  err instanceof Error ? err.message : 'Promotion failed.'
                                );
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-semibold"
                          >
                            + Promote to Catalogue
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Restock Subscriptions */}
            <div className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <span>Out-of-Stock Restock Subscriptions ({adminRestocks.length})</span>
              </h2>
              {adminRestocks.length === 0 ? (
                <p className="text-xs text-zinc-500">No restock subscriptions yet.</p>
              ) : (
                <div className="space-y-3">
                  {adminRestocks.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-900">
                          {s.productName || s.productId}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                          {s.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        Subscriber: {s.email}
                        {s.variantLabel ? ` • ${s.variantLabel}` : ''}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        {(
                          ['EligibleForNotification', 'Notified', 'Cancelled'] as const
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={async () => {
                              await updateAdminRestockSubscriptionApi(s.id, st);
                              notify('success', `Subscription marked ${st}`);
                              loadAdminData();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#E6E1D6] text-[11px] font-semibold text-zinc-700 hover:bg-[#DCE7D9]/50"
                          >
                            Mark {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REVIEWS MODERATION SECTION */}
        {activeSection === 'reviews' && (
          <div className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900">
              Customer Review Moderation ({adminReviews.length})
            </h2>
            {adminReviews.length === 0 ? (
              <p className="text-xs text-zinc-500">No customer reviews submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {adminReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900">
                          {rev.authorName} ({rev.rating} ★)
                        </span>
                        <span className="text-[11px] text-zinc-500">on {rev.productId}</span>
                        {rev.isVerifiedPurchase && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                            Verified Purchase
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800 text-[10px] font-bold">
                          {rev.moderationStatus}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-700">{rev.comment}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(
                        ['published', 'pending', 'rejected', 'flagged'] as ReviewModerationStatus[]
                      ).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={async () => {
                            await moderateAdminReviewApi(rev.id, st);
                            notify('success', `Review status set to ${st}`);
                            loadAdminData();
                            onCatalogueChanged();
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                            rev.moderationStatus === st
                              ? 'bg-[#254B3B] border-[#254B3B] text-white'
                              : 'bg-white border-[#E6E1D6] text-zinc-700'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COUPONS SECTION */}
        {activeSection === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await upsertAdminCouponApi({
                    code: couponCode,
                    description: couponDesc,
                    discountType: couponType,
                    discountValue: Number(couponValue),
                    minOrderAmount: Number(couponMinSubtotal || 0),
                    isActive: true,
                  });
                  notify('success', `Saved coupon ${couponCode.toUpperCase()}`);
                  setCouponCode('');
                  setCouponDesc('');
                  loadAdminData();
                } catch (err) {
                  notify('error', err instanceof Error ? err.message : 'Coupon save failed.');
                }
              }}
              className="lg:col-span-5 p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-3 shadow-sm"
            >
              <h2 className="text-sm font-bold text-zinc-900">Create / Update Coupon Code</h2>
              <input
                type="text"
                required
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon Code (e.g. FESTIVE20)"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs uppercase font-mono"
              />
              <input
                type="text"
                required
                value={couponDesc}
                onChange={(e) => setCouponDesc(e.target.value)}
                placeholder="Description"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={couponType}
                  onChange={(e) =>
                    setCouponType(
                      e.target.value as 'percentage' | 'fixed' | 'free_shipping'
                    )
                  }
                  className="px-2 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                >
                  <option value="percentage">% Off</option>
                  <option value="fixed">Flat ₹ Off</option>
                  <option value="free_shipping">Free Ship</option>
                </select>
                <input
                  type="number"
                  required
                  value={couponValue}
                  onChange={(e) => setCouponValue(e.target.value)}
                  placeholder="Value"
                  className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                />
                <input
                  type="number"
                  required
                  value={couponMinSubtotal}
                  onChange={(e) => setCouponMinSubtotal(e.target.value)}
                  placeholder="Min Order ₹"
                  className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold"
              >
                Save Coupon
              </button>
            </form>

            <div className="lg:col-span-7 p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-3 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900">
                Configured Marketplace Coupons ({adminCoupons.length})
              </h2>
              <div className="space-y-2">
                {adminCoupons.map((c) => (
                  <div
                    key={c.code}
                    className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#254B3B]">{c.code}</span>
                      <span className="text-zinc-600 ml-2">{c.description}</span>
                      <p className="text-[11px] text-zinc-500">
                        Min Order: ₹{c.minOrderAmount} • Used: {c.usedCount}
                        {c.maxTotalUses ? `/${c.maxTotalUses}` : ''}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.isActive
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
