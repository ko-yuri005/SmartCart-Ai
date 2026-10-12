import React, { useState, useMemo } from 'react';
import { Product } from '../../types/shopping';
import { ProductCard } from '../products/ProductCard';
import {
  Search,
  SlidersHorizontal,
  X,
  Store,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface ShopViewProps {
  products: Product[];
  categories: string[];
  brands: string[];
  initialCategory?: string;
  initialSearch?: string;
  onViewDetails: (product: Product) => void;
  onComparePrices: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  comparedProductIds: string[];
  onAddToCart: (product: Product) => void;
  getCartQuantity: (productId: string) => number;
  onAskAssistant: (prompt: string) => void;
}

const PAGE_SIZE = 24;

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'womens-ethnic-wear': "Women's Ethnic Wear",
  'kurtis-kurtas': 'Kurtis & Kurtas',
  sarees: 'Sarees',
  'ethnic-sets-festive-wear': 'Ethnic Sets & Festive Wear',
  'western-wear': 'Western Wear',
  'womens-outerwear': "Women's Outerwear",
  automotive: 'Bikes & Automotive',
  'beauty-personal-care': 'Beauty & Personal Care',
  'keyboards-mice': 'Keyboards & Mice',
  'kitchen-appliances': 'Kitchen Appliances',
  'power-accessories': 'Power & Accessories',
  'sports-fitness': 'Sports & Fitness',
  'travel-luggage': 'Travel & Luggage',
};

const formatCategoryLabel = (slug: string): string =>
  CATEGORY_DISPLAY_NAMES[slug] || slug.replace(/-/g, ' ');

const WOMENS_ETHNIC_SUBCATEGORIES = new Set([
  'kurtis-kurtas',
  'sarees',
  'ethnic-sets-festive-wear',
]);

export const ShopView: React.FC<ShopViewProps> = ({
  products,
  categories,
  brands,
  initialCategory = '',
  initialSearch = '',
  onViewDetails,
  onComparePrices,
  onToggleCompare,
  comparedProductIds,
  onAddToCart,
  getCartQuantity,
  onAskAssistant,
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [sortBy, setSortBy] = useState<
    'featured' | 'price_asc' | 'price_desc' | 'rating' | 'discount'
  >('featured');

  // Sync when navigated from Home with category/search
  React.useEffect(() => {
    setSelectedCategory(initialCategory);
    setVisibleCount(PAGE_SIZE);
  }, [initialCategory]);

  React.useEffect(() => {
    setSearch(initialSearch);
    setVisibleCount(PAGE_SIZE);
  }, [initialSearch]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (selectedCategory) {
          if (selectedCategory === 'womens-ethnic-wear') {
            if (!WOMENS_ETHNIC_SUBCATEGORIES.has(p.category)) return false;
          } else if (p.category !== selectedCategory) {
            return false;
          }
        }
        if (selectedBrand && p.brand !== selectedBrand) return false;
        if (maxPrice !== '' && p.price > Number(maxPrice)) return false;
        if (onSaleOnly && !(p.is_on_sale && (p.discount_percent || 0) > 0)) return false;
        if (q) {
          const catLabel = formatCategoryLabel(p.category);
          const ethnicTag = WOMENS_ETHNIC_SUBCATEGORIES.has(p.category)
            ? "women's ethnic wear womens ethnic wear"
            : '';
          const hay = `${p.name} ${p.brand} ${p.category} ${catLabel} ${ethnicTag} ${p.description} ${p.features.join(' ')} ${p.use_cases.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'discount')
          return (b.discount_percent || 0) - (a.discount_percent || 0) || b.rating - a.rating;
        if (sortBy === 'rating') return b.rating - a.rating || b.review_count - a.review_count;
        const aHasPhoto = a.image && a.image.trim().length > 0 ? 1 : 0;
        const bHasPhoto = b.image && b.image.trim().length > 0 ? 1 : 0;
        if (bHasPhoto !== aHasPhoto) return bHasPhoto - aHasPhoto;
        return b.rating * Math.log10(b.review_count + 10) - a.rating * Math.log10(a.review_count + 10);
      });
  }, [products, search, selectedCategory, selectedBrand, maxPrice, onSaleOnly, sortBy]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedBrand('');
    setMaxPrice('');
    setOnSaleOnly(false);
    setSortBy('featured');
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F5EF]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Filter & Search Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8E3D9] space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#254B3B] border border-[#1d3c2f] flex items-center justify-center text-[#E6BE65] shadow-xs">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-serif font-bold text-[#282824]">
                  SmartCart AI Marketplace
                </h1>
                <p className="text-xs text-[#77766F]">
                  Showing {filteredProducts.length} of {products.length} curated products • Shop Smarter. Choose Better.
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex-1 max-w-md flex items-center gap-2 bg-[#F7F5F0] border border-[#E8E4DC] focus-within:border-[#254B3B] rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-[#77736D] flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Filter by product name, brand, feature, or keyword..."
                aria-label="Search shop catalogue"
                className="w-full bg-transparent text-xs sm:text-sm text-[#242321] placeholder-zinc-400 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setVisibleCount(PAGE_SIZE);
                  }}
                  aria-label="Clear search"
                  className="text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-[#E8E4DC]">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="Filter by category"
              className="px-3 py-2 rounded-xl bg-[#F7F5F0] border border-[#E8E4DC] text-xs font-medium text-[#242321] capitalize focus:outline-none focus:border-[#254B3B]"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {formatCategoryLabel(c)}
                </option>
              ))}
            </select>

            {/* Brand Select */}
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="Filter by brand"
              className="px-3 py-2 rounded-xl bg-[#F7F5F0] border border-[#E8E4DC] text-xs font-medium text-[#242321] focus:outline-none focus:border-[#254B3B]"
            >
              <option value="">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Budget Ceiling Select */}
            <select
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value ? Number(e.target.value) : '');
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="Filter by maximum price"
              className="px-3 py-2 rounded-xl bg-[#F7F5F0] border border-[#E8E4DC] text-xs font-medium text-[#242321] focus:outline-none focus:border-[#254B3B]"
            >
              <option value="">Any Budget</option>
              <option value="1000">Under ₹1,000</option>
              <option value="2500">Under ₹2,500</option>
              <option value="5000">Under ₹5,000</option>
              <option value="15000">Under ₹15,000</option>
              <option value="50000">Under ₹50,000</option>
              <option value="150000">Under ₹1,50,000</option>
              <option value="300000">Under ₹3,00,000</option>
            </select>

            {/* On Sale Toggle */}
            <button
              type="button"
              onClick={() => {
                setOnSaleOnly((prev) => !prev);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                onSaleOnly
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-[#F7F5F0] border-[#E8E4DC] text-[#242321] hover:bg-[#EEEAE2]'
              }`}
            >
              <span>{onSaleOnly ? '✓ On Sale Only' : '% On Sale / Discounted'}</span>
            </button>

            {/* Sort Order */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as typeof sortBy);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="Sort products"
              className="px-3 py-2 rounded-xl bg-[#F7F5F0] border border-[#E8E4DC] text-xs font-medium text-[#242321] focus:outline-none focus:border-[#254B3B]"
            >
              <option value="featured">Sort: Featured &amp; Popular</option>
              <option value="discount">Sort: Biggest Sale Discount %</option>
              <option value="rating">Sort: Highest Customer Rating</option>
              <option value="price_asc">Sort: Price Low to High</option>
              <option value="price_desc">Sort: Price High to Low</option>
            </select>
          </div>

          {/* Active Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('');
                setVisibleCount(PAGE_SIZE);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                selectedCategory === ''
                  ? 'bg-[#254B3B] border-[#254B3B] text-white'
                  : 'bg-[#F7F5F0] border-[#E8E4DC] text-[#77736D] hover:bg-[#DCE7D9]/50 hover:text-[#242321]'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory((prev) => (prev === cat ? '' : cat));
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors border ${
                  selectedCategory === cat
                    ? 'bg-[#254B3B] border-[#254B3B] text-white'
                    : 'bg-[#F7F5F0] border-[#E8E4DC] text-[#77736D] hover:bg-[#DCE7D9]/50 hover:text-[#242321]'
                }`}
              >
                {formatCategoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid or Empty State */}
        {filteredProducts.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white border border-[#E8E4DC] text-center space-y-4">
            <SlidersHorizontal className="w-8 h-8 text-zinc-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[#242321]">
                No products match your exact filter combination
              </h2>
              <p className="text-xs text-[#77736D] max-w-md mx-auto">
                Try clearing one of your filters or ask our AI Shopping Assistant to find the closest alternatives.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 rounded-xl bg-[#EEEAE2] hover:bg-[#E8E4DC] text-xs font-semibold text-[#242321] transition-colors"
              >
                Reset All Filters
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => onAskAssistant(search)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-xs font-semibold text-white transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI for &quot;{search}&quot;</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onViewDetails={onViewDetails}
                  onComparePrices={onComparePrices}
                  onToggleCompare={onToggleCompare}
                  isCompared={comparedProductIds.includes(prod.id)}
                  onAddToCart={onAddToCart}
                  cartQuantity={getCartQuantity(prod.id)}
                />
              ))}
            </div>

            {/* Pagination / Load More Bar */}
            {visibleCount < filteredProducts.length && (
              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white hover:bg-[#EEEAE2] border border-[#E8E4DC] text-xs font-semibold text-[#242321] transition-colors shadow-sm"
                >
                  <span>Load More Products ({displayedProducts.length} of {filteredProducts.length} shown)</span>
                  <ChevronDown className="w-4 h-4 text-[#77736D]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
