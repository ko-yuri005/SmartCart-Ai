import React, { useState } from 'react';
import {
  Scale,
  Home,
  Store,
  Sparkles,
  ShoppingCart,
  Package,
  User,
  Shield,
  Search,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { UserDTO } from '../../types/shopping';

export type MarketplaceView =
  | 'home'
  | 'shop'
  | 'assistant'
  | 'compare'
  | 'cart'
  | 'orders'
  | 'account'
  | 'admin';

interface HeaderProps {
  activeView?: MarketplaceView;
  onNavigate?: (view: MarketplaceView, params?: { category?: string; search?: string }) => void;
  productCount?: number;
  comparisonCount: number;
  cartCount?: number;
  orderCount?: number;
  authUser?: UserDTO | null;
  onOpenComparison: () => void;
  onResetSession?: () => void;
  isResetting?: boolean;
}

const CATEGORY_SHORTCUTS = [
  { id: 'footwear', label: 'Sneakers & Footwear' },
  { id: 'automotive', label: 'Motors & Two-Wheelers' },
  { id: 'fashion', label: 'Streetwear & Apparel' },
  { id: 'headphones', label: 'Electronics & Audio' },
  { id: 'beauty-personal-care', label: 'Beauty & Skincare' },
  { id: 'sports-fitness', label: 'Sports & Fitness' },
  { id: 'kitchen-appliances', label: 'Home & Kitchen' },
];

export const Header: React.FC<HeaderProps> = ({
  activeView = 'home',
  onNavigate,
  comparisonCount,
  cartCount = 0,
  orderCount = 0,
  authUser,
  onOpenComparison,
}) => {
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      onNavigate?.('shop', { search: quickSearch.trim() });
      setQuickSearch('');
    }
  };

  return (
    <header className="border-b border-[#E8E3D9] bg-white/95 backdrop-blur-md sticky top-0 z-30 transition-all select-none shadow-2xs">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Brand Wordmark & Shopping Logo Mark */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onNavigate?.('home')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            aria-label="SmartCart AI Home"
          >
            <div className="w-9 h-9 rounded-xl bg-[#254B3B] group-hover:bg-[#1B382C] flex items-center justify-center shadow-xs transition-all flex-shrink-0 relative overflow-hidden border border-[#254B3B]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-white"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span
                className="w-2 h-2 rounded-full bg-[#E6BE65] absolute top-1.5 right-1.5 ring-1 ring-[#254B3B]"
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-[#282824] tracking-tight leading-none font-serif">
                  SmartCart
                </span>
                <span className="text-[11px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md bg-[#C76F4A] text-white leading-none">
                  AI
                </span>
              </div>
              <p className="text-[10px] font-medium text-[#77766F] leading-tight hidden sm:block mt-0.5">
                Shop Smarter. Choose Better.
              </p>
            </div>
          </button>

          {/* Primary Navigation Links (Desktop) */}
          {onNavigate && (
            <nav
              aria-label="Primary marketplace navigation"
              className="hidden lg:flex items-center gap-1 bg-[#F8F5EF] p-1 rounded-xl border border-[#E8E3D9]"
            >
              {/* Home */}
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'home'
                    ? 'bg-[#254B3B] text-white shadow-xs font-semibold'
                    : 'text-[#282824] hover:text-[#254B3B] hover:bg-white'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>

              {/* Shop */}
              <button
                type="button"
                onClick={() => onNavigate('shop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'shop'
                    ? 'bg-[#254B3B] text-white shadow-xs font-semibold'
                    : 'text-[#282824] hover:text-[#254B3B] hover:bg-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Shop</span>
              </button>

              {/* Categories Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCategoryMenuOpen
                      ? 'bg-white text-[#254B3B] font-semibold shadow-2xs'
                      : 'text-[#282824] hover:text-[#254B3B] hover:bg-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Categories</span>
                  <ChevronDown className="w-3 h-3 text-[#77766F]" />
                </button>

                {isCategoryMenuOpen && (
                  <div
                    className="absolute top-full left-0 mt-1.5 w-56 rounded-xl bg-white border border-[#E8E3D9] shadow-lg py-1.5 z-40"
                    onMouseLeave={() => setIsCategoryMenuOpen(false)}
                  >
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#77766F] border-b border-[#E8E3D9]">
                      Curated Departments
                    </div>
                    {CATEGORY_SHORTCUTS.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          onNavigate('shop', { category: cat.id });
                          setIsCategoryMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-[#282824] hover:bg-[#F8F5EF] hover:text-[#254B3B] transition-colors"
                      >
                        {cat.label}
                      </button>
                    ))}
                    <div className="border-t border-[#E8E3D9] mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('shop');
                          setIsCategoryMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-semibold text-[#254B3B] hover:bg-[#EDF3EE]"
                      >
                        Browse All 16 Departments →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Assistant */}
              <button
                type="button"
                onClick={() => onNavigate('assistant')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'assistant'
                    ? 'bg-[#C76F4A] text-white shadow-xs font-semibold'
                    : 'text-[#282824] hover:text-[#254B3B] hover:bg-white'
                }`}
              >
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    activeView === 'assistant' ? 'text-[#E6BE65]' : 'text-[#C76F4A]'
                  }`}
                />
                <span>Ask SmartCart AI</span>
              </button>
            </nav>
          )}
        </div>

        {/* Compact Quick Search Bar (Desktop) */}
        {onNavigate && (
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex items-center flex-1 max-w-xs relative"
          >
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search sneakers, motors, tech..."
              aria-label="Quick search"
              className="w-full bg-[#F1EDE4] border border-[#E8E3D9] focus:border-[#254B3B] focus:bg-white rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#282824] placeholder-[#77766F] focus:outline-none transition-all"
            />
            <Search className="w-3.5 h-3.5 text-[#77766F] absolute left-2.5 pointer-events-none" />
          </form>
        )}

        {/* Right Action Icons: Compare, Cart, Account */}
        <div className="flex items-center gap-2">
          {/* Compare Button */}
          <button
            type="button"
            onClick={onOpenComparison}
            aria-label="Product comparison tray"
            title="Compare products"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              comparisonCount > 0
                ? 'bg-[#EDF3EE] border-[#254B3B] text-[#254B3B]'
                : 'bg-white border-[#E8E3D9] text-[#282824] hover:bg-[#F1EDE4]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare</span>
            {comparisonCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#254B3B] text-white text-[10px] font-bold">
                {comparisonCount}
              </span>
            )}
          </button>

          {/* Cart Trigger */}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('cart')}
              aria-label="Shopping cart"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                activeView === 'cart'
                  ? 'bg-[#254B3B] border-[#254B3B] text-white'
                  : cartCount > 0
                  ? 'bg-white border-[#254B3B] text-[#254B3B]'
                  : 'bg-white border-[#E8E3D9] text-[#282824] hover:bg-[#F1EDE4]'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeView === 'cart'
                      ? 'bg-white text-[#254B3B]'
                      : 'bg-[#254B3B] text-white'
                  }`}
                >
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Account & Orders Menu */}
          {onNavigate && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  activeView === 'account' || activeView === 'orders' || activeView === 'admin'
                    ? 'bg-[#254B3B] border-[#254B3B] text-white'
                    : 'bg-white border-[#E8E3D9] text-[#282824] hover:bg-[#F1EDE4]'
                }`}
                aria-label="User Account Menu"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {authUser ? authUser.username : 'Account'}
                </span>
                <ChevronDown className="w-3 h-3 text-current" />
              </button>

              {isAccountMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white border border-[#E8E3D9] shadow-lg py-1.5 z-40"
                  onMouseLeave={() => setIsAccountMenuOpen(false)}
                >
                  <div className="px-3 py-1.5 border-b border-[#E8E3D9] text-[11px] text-[#77766F]">
                    {authUser ? (
                      <>
                        <div className="font-semibold text-[#282824] truncate">
                          {authUser.username}
                        </div>
                        <div className="text-[10px] text-[#254B3B] capitalize font-medium">
                          {authUser.role} Account
                        </div>
                      </>
                    ) : (
                      <span>Sign in or register</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('account');
                      setIsAccountMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-[#282824] hover:bg-[#F8F5EF] flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-[#254B3B]" />
                    <span>Profile &amp; Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('orders');
                      setIsAccountMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-[#282824] hover:bg-[#F8F5EF] flex items-center gap-2"
                  >
                    <Package className="w-3.5 h-3.5 text-[#254B3B]" />
                    <span>My Orders {orderCount > 0 ? `(${orderCount})` : ''}</span>
                  </button>

                  {/* Admin link strictly visible only if role is admin */}
                  {authUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('admin');
                        setIsAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center gap-2 border-t border-[#E8E3D9]"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-700" />
                      <span>Admin Dashboard</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Navigation Strip */}
      {onNavigate && (
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-3 py-2 bg-[#F1EDE4] border-t border-[#E8E3D9] no-scrollbar">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeView === 'home'
                ? 'bg-white text-[#254B3B] shadow-sm font-semibold'
                : 'text-[#77766F]'
            }`}
          >
            <Home className="w-3 h-3" />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('shop')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeView === 'shop'
                ? 'bg-white text-[#254B3B] shadow-sm font-semibold'
                : 'text-[#77766F]'
            }`}
          >
            <Store className="w-3 h-3" />
            <span>Shop</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeView === 'assistant'
                ? 'bg-white text-[#254B3B] shadow-sm font-semibold'
                : 'text-[#77766F]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#C76F4A]" />
            <span>AI Assistant</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeView === 'orders'
                ? 'bg-white text-[#254B3B] shadow-sm font-semibold'
                : 'text-[#77766F]'
            }`}
          >
            <Package className="w-3 h-3" />
            <span>Orders</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('account')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeView === 'account'
                ? 'bg-white text-[#254B3B] shadow-sm font-semibold'
                : 'text-[#77766F]'
            }`}
          >
            <User className="w-3 h-3" />
            <span>Account</span>
          </button>
        </div>
      )}
    </header>
  );
};
