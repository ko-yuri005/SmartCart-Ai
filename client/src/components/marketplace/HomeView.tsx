import React, { useState, useMemo } from 'react';
import { Product } from '../../types/shopping';
import { ProductCard } from '../products/ProductCard';
import { ProductImage } from '../common/ProductImage';
import {
  Search,
  Sparkles,
  Camera,
  ArrowRight,
  ShieldCheck,
  Scale,
  Truck,
  Layers,
  Flame,
  Zap,
  Tag,
  Compass,
  ShoppingBag,
  CheckCircle2,
  Star,
  Cpu,
} from 'lucide-react';

interface HomeViewProps {
  products: Product[];
  categories: string[];
  onNavigateShop: (params?: { category?: string; search?: string }) => void;
  onAskAssistant: (prompt: string) => void;
  onOpenVisualSearch: () => void;
  onViewDetails: (product: Product) => void;
  onComparePrices: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  comparedProductIds: string[];
  onAddToCart: (product: Product) => void;
  getCartQuantity: (productId: string) => number;
}

const formatINR = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN')}`;

const hasVerifiedPhoto = (p: Product): boolean =>
  Boolean(p.image && p.image.trim().length > 0);

const sortWithVerifiedPhotosFirst = (list: Product[]): Product[] => {
  return [...list].sort((a, b) => {
    const aPhoto = hasVerifiedPhoto(a) ? 1 : 0;
    const bPhoto = hasVerifiedPhoto(b) ? 1 : 0;
    if (bPhoto !== aPhoto) return bPhoto - aPhoto;
    return b.rating - a.rating || b.review_count - a.review_count;
  });
};

interface CategoryTileConfig {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  accentTextClass: string;
  tag: string;
}

const COLOURFUL_CATEGORY_TILES: CategoryTileConfig[] = [
  {
    id: 'tile-sneakers',
    title: 'Sneakers & Footwear',
    subtitle: 'Air Jordan, Nike Dunk, Adidas Samba & performance runners',
    category: 'footwear',
    bgClass: 'bg-[#DCE7D9]',
    borderClass: 'border-[#254B3B]/20 hover:border-[#254B3B]',
    badgeClass: 'bg-[#254B3B] text-white',
    accentTextClass: 'text-[#254B3B]',
    tag: 'Sneaker Drop',
  },
  {
    id: 'tile-motorcycles',
    title: 'Motorcycles & Riding',
    subtitle: 'Royal Enfield, Triumph, KTM, EVs & ECE 22.06 riding gear',
    category: 'automotive',
    bgClass: 'bg-[#DCE7EE]',
    borderClass: 'border-[#2B4C65]/20 hover:border-[#2B4C65]',
    badgeClass: 'bg-[#2B4C65] text-white',
    accentTextClass: 'text-[#2B4C65]',
    tag: 'Motors Hub',
  },
  {
    id: 'tile-streetwear',
    title: 'Streetwear & Apparel',
    subtitle: 'Heavyweight hoodies, trucker jackets, oversized tees & denim',
    category: 'fashion',
    bgClass: 'bg-[#E58B78]/25',
    borderClass: 'border-[#C76F4A]/30 hover:border-[#C76F4A]',
    badgeClass: 'bg-[#C76F4A] text-white',
    accentTextClass: 'text-[#8C3D20]',
    tag: 'Streetwear',
  },
  {
    id: 'tile-electronics',
    title: 'Electronics & Audio',
    subtitle: 'Flagship smartphones, ANC headphones, laptops & smartwatches',
    category: 'headphones',
    bgClass: 'bg-[#A9CFE0]/35',
    borderClass: 'border-[#2B5B75]/25 hover:border-[#2B5B75]',
    badgeClass: 'bg-[#244B61] text-white',
    accentTextClass: 'text-[#1E3F52]',
    tag: 'Pro Tech',
  },
  {
    id: 'tile-beauty',
    title: 'Beauty & Skincare',
    subtitle: 'Dermatologist serums, SPF 50 sunscreens & daily grooming',
    category: 'beauty-personal-care',
    bgClass: 'bg-[#E6BE65]/30',
    borderClass: 'border-[#B88628]/30 hover:border-[#966A16]',
    badgeClass: 'bg-[#8A5A10] text-white',
    accentTextClass: 'text-[#6E470B]',
    tag: 'Self Care',
  },
  {
    id: 'tile-sports',
    title: 'Sports & Fitness',
    subtitle: 'Strength gear, pro badminton racquets, yoga & recovery tools',
    category: 'sports-fitness',
    bgClass: 'bg-[#DCE7D9]/75',
    borderClass: 'border-[#254B3B]/20 hover:border-[#254B3B]',
    badgeClass: 'bg-[#254B3B] text-white',
    accentTextClass: 'text-[#254B3B]',
    tag: 'Active Life',
  },
  {
    id: 'tile-womens-ethnic',
    title: "Women's Ethnic Wear",
    subtitle: 'Handloom sarees, cotton kurtis, Anarkalis & festive kurta sets',
    category: 'womens-ethnic-wear',
    bgClass: 'bg-[#E6BE65]/35',
    borderClass: 'border-[#C76F4A]/30 hover:border-[#C76F4A]',
    badgeClass: 'bg-[#254B3B] text-white',
    accentTextClass: 'text-[#254B3B]',
    tag: 'Festive Edit',
  },
  {
    id: 'tile-lifestyle',
    title: 'Home & Lifestyle',
    subtitle: 'Ergonomic chairs, espresso machines, air fryers & decor',
    category: 'furniture',
    bgClass: 'bg-[#F5E6DF]',
    borderClass: 'border-[#C76F4A]/25 hover:border-[#C76F4A]',
    badgeClass: 'bg-[#C76F4A] text-white',
    accentTextClass: 'text-[#8C3D20]',
    tag: 'Living',
  },
];

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  categories,
  onNavigateShop,
  onAskAssistant,
  onOpenVisualSearch,
  onViewDetails,
  onComparePrices,
  onToggleCompare,
  comparedProductIds,
  onAddToCart,
  getCartQuantity,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      onNavigateShop();
      return;
    }
    onNavigateShop({ search: trimmed });
  };

  // Hero Spotlight Products (4 iconic items across sneakers, motorcycles, audio, streetwear with verified photos)
  const heroSpotlightProducts = useMemo(() => {
    const preferredIds = [
      'foot-air-jordan-1-low-chicago',
      'auto-re-hunter-350',
      'hp-sony-wh-1000xm4',
      'fash-levis-denim-jacket',
    ];
    const picked: Product[] = [];
    for (const id of preferredIds) {
      const found = products.find((p) => p.id === id && hasVerifiedPhoto(p));
      if (found) picked.push(found);
    }
    if (picked.length < 4) {
      const extras = sortWithVerifiedPhotosFirst(products).filter(
        (p) => !picked.some((existing) => existing.id === p.id)
      );
      picked.push(...extras.slice(0, 4 - picked.length));
    }
    return picked.slice(0, 4);
  }, [products]);

  // Representative verified product per category tile
  const categoryTileProductMap = useMemo(() => {
    const map: Record<string, Product | undefined> = {};
    for (const tile of COLOURFUL_CATEGORY_TILES) {
      const matching = sortWithVerifiedPhotosFirst(
        products.filter((p) => {
          if (!p.availability) return false;
          if (tile.category === 'womens-ethnic-wear') {
            return (
              p.category === 'sarees' ||
              p.category === 'kurtis-kurtas' ||
              p.category === 'ethnic-sets-festive-wear'
            );
          }
          return p.category === tile.category;
        })
      );
      map[tile.id] = matching[0];
    }
    return map;
  }, [products]);

  // 1. Premium Sneaker Collection (prioritizing verified product photography)
  const sneakerProducts = useMemo(() => {
    return sortWithVerifiedPhotosFirst(
      products.filter((p) => p.category === 'footwear' && p.availability)
    ).slice(0, 4);
  }, [products]);

  // 2. Motorcycle & Riding Lifestyle Collection (prioritizing verified motorcycle photography)
  const motorsProducts = useMemo(() => {
    return sortWithVerifiedPhotosFirst(
      products.filter((p) => p.category === 'automotive' && p.availability)
    ).slice(0, 4);
  }, [products]);

  // 3. Streetwear & Apparel Collection (prioritizing verified apparel photography)
  const streetwearProducts = useMemo(() => {
    return sortWithVerifiedPhotosFirst(
      products.filter((p) => p.category === 'fashion' && p.availability)
    ).slice(0, 4);
  }, [products]);

  // 4. Electronics & Lifestyle Collection (phones, headphones, laptops, smartwatches with verified photography)
  const electronicsProducts = useMemo(() => {
    const preferredIds = [
      'phone-apple-iphone-15-pro-max',
      'hp-sony-wh-1000xm4',
      'lap-apple-macbook-air-m2',
      'sw-apple-watch-ultra-2-gps-cellular',
    ];
    const picked: Product[] = [];
    for (const id of preferredIds) {
      const found = products.find((p) => p.id === id && hasVerifiedPhoto(p));
      if (found) picked.push(found);
    }
    if (picked.length < 4) {
      const techCategories = new Set(['phones', 'headphones', 'laptops', 'smartwatches']);
      const fallback = sortWithVerifiedPhotosFirst(
        products.filter(
          (p) =>
            techCategories.has(p.category) &&
            p.availability &&
            !picked.some((existing) => existing.id === p.id)
        )
      );
      picked.push(...fallback.slice(0, 4 - picked.length));
    }
    return picked.slice(0, 4);
  }, [products]);

  // Curated Product Comparison Presets
  const comparisonPairs = useMemo(() => {
    const findPair = (idA: string, idB: string, catFallback: string) => {
      const a = products.find((p) => p.id === idA);
      const b = products.find((p) => p.id === idB);
      if (a && b) return [a, b];
      return sortWithVerifiedPhotosFirst(
        products.filter((p) => p.category === catFallback)
      ).slice(0, 2);
    };

    return [
      {
        title: 'Iconic Court Sneakers',
        subtitle: 'Compare heritage leather build, cushioning & street value',
        badge: 'Sneakers',
        bgClass: 'bg-[#DCE7D9]/55 border-[#254B3B]/20',
        items: findPair(
          'foot-air-jordan-1-low-chicago',
          'foot-nike-dunk-low-retro-panda',
          'footwear'
        ),
        prompt: 'Compare Air Jordan 1 Low Chicago vs Nike Dunk Low Retro Panda',
      },
      {
        title: 'Modern Roadster Motorcycles',
        subtitle: 'Compare engine torque, weight, mileage & ex-showroom price',
        badge: 'Motorcycles',
        bgClass: 'bg-[#DCE7EE]/65 border-[#2B4C65]/20',
        items: findPair(
          'auto-re-hunter-350',
          'auto-triumph-speed-400-phantom-black',
          'automotive'
        ),
        prompt: 'Compare Royal Enfield Hunter 350 vs Triumph Speed 400',
      },
      {
        title: 'Flagship ANC Headphones',
        subtitle: 'Compare noise cancellation, codec support & battery endurance',
        badge: 'Audio',
        bgClass: 'bg-[#F5E6DF]/75 border-[#C76F4A]/25',
        items: findPair(
          'hp-sony-wh-1000xm4',
          'hp-sennheiser-momentum-4',
          'headphones'
        ),
        prompt: 'Compare Sony WH-1000XM4 vs Sennheiser Momentum 4 Wireless',
      },
    ].filter((group) => group.items.length === 2);
  }, [products]);

  // Verified Deals & Offers (prioritizing verified product photos first)
  const dealProducts = useMemo(() => {
    return products
      .filter(
        (p) =>
          p.availability &&
          p.is_on_sale &&
          typeof p.discount_percent === 'number' &&
          p.discount_percent > 0
      )
      .sort((a, b) => {
        const aPhoto = hasVerifiedPhoto(a) ? 1 : 0;
        const bPhoto = hasVerifiedPhoto(b) ? 1 : 0;
        if (bPhoto !== aPhoto) return bPhoto - aPhoto;
        return (b.discount_percent || 0) - (a.discount_percent || 0);
      })
      .slice(0, 4);
  }, [products]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F5EF]">
      {/* =====================================================================
          1. COLOURFUL EDITORIAL HERO SECTION
      ===================================================================== */}
      <section className="bg-gradient-to-br from-[#254B3B] via-[#1E3F31] to-[#183328] text-white border-b border-[#254B3B] relative overflow-hidden">
        {/* Subtle Warm Editorial Colour Shapes */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#E6BE65]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 w-80 h-80 rounded-full bg-[#C76F4A]/20 blur-3xl" />

        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-14 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Column: Headline, Search Bar & Clear Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DCE7D9]/15 border border-[#DCE7D9]/30 text-[#E6BE65] text-xs font-semibold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-[#E6BE65]" />
                <span>SmartCart AI • Shop Smarter. Choose Better.</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-serif font-bold text-white tracking-tight leading-[1.08]">
                Find what you love.{' '}
                <span className="text-[#E6BE65]">
                  Shop smarter.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-[#DCE7D9]/90 leading-relaxed max-w-2xl font-sans">
                Explore {products.length || 400} curated products across sneakers, motorcycles, streetwear, flagship electronics, beauty, and home living — powered by SmartCart AI visual search, live price comparison, and verified product specs.
              </p>

              {/* Prominent Product Search Bar */}
              <form
                onSubmit={handleHeroSearch}
                className="bg-white p-2 rounded-2xl shadow-lg border-2 border-[#E6BE65]/50 flex flex-col sm:flex-row gap-2 max-w-2xl"
              >
                <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2">
                  <Search className="w-4 h-4 text-[#254B3B] flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Air Jordan, Royal Enfield, Sony ANC, hoodies, laptops..."
                    aria-label="Search SmartCart AI marketplace"
                    className="w-full bg-transparent text-sm text-[#282824] placeholder-[#77766F] focus:outline-none font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#254B3B] hover:bg-[#1b382c] text-white text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer"
                >
                  <span>Search</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Primary CTA Buttons: Explore Products & Ask SmartCart AI */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateShop()}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#E6BE65] hover:bg-[#d9b054] text-[#282824] text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-[#282824]" />
                  <span>Explore Products</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (searchQuery.trim()) {
                      onAskAssistant(searchQuery.trim());
                    } else {
                      onAskAssistant(
                        'Recommend top-rated sneakers, headphones, or everyday essentials under ₹5,000'
                      );
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#C76F4A] hover:bg-[#b5613e] text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#F8F5EF]" />
                  <span>Ask SmartCart AI</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenVisualSearch}
                  title="Upload a product photo for AI visual discovery"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#E6BE65]" />
                  <span>Visual Photo Search</span>
                </button>
              </div>

              {/* Trust Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/15 text-xs text-[#DCE7D9]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#E6BE65] flex-shrink-0" />
                  <span>Verified product photography</span>
                </div>
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#A9CFE0] flex-shrink-0" />
                  <span>Multi-retailer price comparison</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#E58B78] flex-shrink-0" />
                  <span>Free delivery above ₹999</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Editorial Product Collage (4 Real Verified Product Photos) */}
            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-3.5">
                {heroSpotlightProducts.map((item, idx) => {
                  const accentBorders = [
                    'border-[#E6BE65]',
                    'border-[#A9CFE0]',
                    'border-[#E58B78]',
                    'border-[#DCE7D9]',
                  ];
                  const badgeColors = [
                    'bg-[#E6BE65] text-[#282824]',
                    'bg-[#DCE7EE] text-[#282824]',
                    'bg-[#E58B78] text-white',
                    'bg-[#DCE7D9] text-[#254B3B]',
                  ];
                  return (
                    <div
                      key={item.id}
                      onClick={() => onViewDetails(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onViewDetails(item);
                        }
                      }}
                      className={`group rounded-2xl bg-white text-[#282824] overflow-hidden border-2 ${accentBorders[idx % accentBorders.length]} shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col`}
                    >
                      <div className="relative w-full h-36 sm:h-40 overflow-hidden bg-[#F8F5EF]">
                        <ProductImage
                          productId={item.id}
                          src={item.image}
                          alt={item.name}
                          category={item.category}
                          productType={item.product_type}
                          className="w-full h-full"
                          imageClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span
                          className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-2xs ${badgeColors[idx % badgeColors.length]}`}
                        >
                          {item.brand}
                        </span>
                      </div>
                      <div className="p-3 flex flex-col justify-between flex-1 bg-white">
                        <p className="text-xs font-bold text-[#282824] line-clamp-1 group-hover:text-[#254B3B]">
                          {item.name}
                        </p>
                        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-[#E8E3D9]/70">
                          <span className="text-xs font-extrabold text-[#254B3B]">
                            {formatINR(item.price)}
                          </span>
                          <span className="text-[11px] font-semibold text-[#C76F4A] group-hover:translate-x-0.5 transition-transform">
                            View →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. COLOURFUL CATEGORY TILES SECTION (White Background)
      ===================================================================== */}
      <section className="bg-white border-b border-[#E8E3D9] py-10 sm:py-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#C76F4A]">
                <Layers className="w-3.5 h-3.5" />
                Curated Storefronts
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#282824] tracking-tight mt-0.5">
                Shop by Colourful Category Worlds
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateShop()}
              className="text-xs font-bold text-[#254B3B] hover:text-[#C76F4A] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Browse all {categories.length || 16} departments ({products.length} items)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 7 Colourful Editorial Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
            {COLOURFUL_CATEGORY_TILES.map((tile) => {
              const previewProduct = categoryTileProductMap[tile.id];
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => onNavigateShop({ category: tile.category })}
                  className={`group text-left rounded-2xl p-4 ${tile.bgClass} border ${tile.borderClass} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between cursor-pointer`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${tile.badgeClass}`}
                      >
                        {tile.tag}
                      </span>
                      <ArrowRight
                        className={`w-3.5 h-3.5 ${tile.accentTextClass} group-hover:translate-x-0.5 transition-transform`}
                      />
                    </div>

                    {previewProduct && (
                      <div className="w-full h-28 rounded-xl overflow-hidden bg-white border border-black/5 shadow-2xs my-1">
                        <ProductImage
                          productId={previewProduct.id}
                          src={previewProduct.image}
                          alt={previewProduct.name}
                          category={previewProduct.category}
                          productType={previewProduct.product_type}
                          className="w-full h-full"
                          imageClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <h3 className="text-sm font-bold text-[#282824] leading-snug">
                      {tile.title}
                    </h3>
                    <p className="text-[11px] text-[#282824]/75 leading-relaxed line-clamp-2">
                      {tile.subtitle}
                    </p>
                  </div>

                  <div className={`pt-3 mt-3 border-t border-black/10 text-[11px] font-bold ${tile.accentTextClass} flex items-center justify-between`}>
                    <span>Explore Collection</span>
                    <span>→</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* All 16 Department Quick Pills */}
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#77766F] mr-1">
              All Departments:
            </span>
            {categories.map((cat, idx) => {
              const pillTints = [
                'bg-[#F8F5EF] hover:bg-[#DCE7D9] text-[#282824]',
                'bg-[#DCE7EE]/40 hover:bg-[#DCE7EE] text-[#282824]',
                'bg-[#F5E6DF]/50 hover:bg-[#F5E6DF] text-[#282824]',
                'bg-[#E6BE65]/20 hover:bg-[#E6BE65]/40 text-[#282824]',
              ];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onNavigateShop({ category: cat })}
                  className={`px-3 py-1.5 rounded-xl border border-[#E8E3D9] text-xs font-semibold capitalize transition-colors cursor-pointer ${pillTints[idx % pillTints.length]}`}
                >
                  {cat.replace(/-/g, ' ')}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. PREMIUM SNEAKER COLLECTION (Warm Ivory + Sage Accent Section)
      ===================================================================== */}
      {sneakerProducts.length > 0 && (
        <section className="bg-[#F8F5EF] border-b border-[#E8E3D9] py-10 sm:py-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-[#DCE7D9]/65 border border-[#254B3B]/15 rounded-2xl p-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#254B3B] text-white text-[10px] font-bold uppercase tracking-wider">
                  <Flame className="w-3 h-3 text-[#E6BE65]" />
                  <span>Footwear Vault</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#282824] tracking-tight">
                  Premium Sneaker &amp; Runner Collection
                </h2>
                <p className="text-xs sm:text-sm text-[#282824]/80">
                  Iconic court leather classics, daily trainers, and retro silhouettes with verified studio &amp; lifestyle photography.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-end">
                <button
                  type="button"
                  onClick={() =>
                    onAskAssistant('Recommend the best sneakers for all-day comfort and streetwear styling')
                  }
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F8F5EF] border border-[#254B3B]/20 text-xs font-bold text-[#254B3B] transition-colors cursor-pointer"
                >
                  Ask SmartCart AI
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateShop({ category: 'footwear' })}
                  className="px-4 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1d3c2f] text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Shop All Footwear →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {sneakerProducts.map((prod) => (
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
          </div>
        </section>
      )}

      {/* =====================================================================
          4. MOTORCYCLE & RIDING LIFESTYLE COLLECTION (Dusty Blue Section)
      ===================================================================== */}
      {motorsProducts.length > 0 && (
        <section className="bg-[#DCE7EE]/65 border-b border-[#C5D6E2] py-10 sm:py-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#2B4C65] text-white text-[10px] font-bold uppercase tracking-wider">
                  <Zap className="w-3 h-3 text-[#E6BE65]" />
                  <span>Motors &amp; Riding Hub</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#282824] tracking-tight">
                  Motorcycle &amp; Riding Lifestyle Collection
                </h2>
                <p className="text-xs sm:text-sm text-[#282824]/80">
                  Modern roadsters, adventure tourers, electric scooters, and certified riding gear with accurate vehicle photography.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-end">
                <button
                  type="button"
                  onClick={() =>
                    onAskAssistant('Compare Royal Enfield Hunter 350, Triumph Speed 400, and KTM 390 Duke')
                  }
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F8F5EF] border border-[#2B4C65]/25 text-xs font-bold text-[#2B4C65] transition-colors cursor-pointer"
                >
                  Compare Bikes with AI
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateShop({ category: 'automotive' })}
                  className="px-4 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1d3c2f] text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Explore Motors →
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/90 border border-[#2B4C65]/20 flex items-center justify-between gap-3 text-xs text-[#282824] shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-[#254B3B] flex-shrink-0" />
                <span>
                  <strong>Official Ex-Showroom Pricing:</strong> Motorcycle and scooter rates reflect verified base ex-showroom prices. Select any bike to inspect engine specs or compare models side-by-side.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {motorsProducts.map((prod) => (
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
          </div>
        </section>
      )}

      {/* =====================================================================
          5. STREETWEAR & APPAREL COLLECTION (Warm Coral / Terracotta Section)
      ===================================================================== */}
      {streetwearProducts.length > 0 && (
        <section className="bg-white border-b border-[#E8E3D9] py-10 sm:py-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-[#F5E6DF] border border-[#C76F4A]/25 rounded-2xl p-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#C76F4A] text-white text-[10px] font-bold uppercase tracking-wider">
                  <span>Streetwear Edit</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#282824] tracking-tight">
                  Streetwear &amp; Modern Wardrobe
                </h2>
                <p className="text-xs sm:text-sm text-[#282824]/80">
                  Relaxed denim jackets, heavyweight fleece hoodies, puffer outerwear, and everyday essentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateShop({ category: 'fashion' })}
                className="px-4 py-2 rounded-xl bg-[#C76F4A] hover:bg-[#b25f3c] text-xs font-bold text-white transition-colors self-start sm:self-end cursor-pointer"
              >
                Shop All Apparel →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {streetwearProducts.map((prod) => (
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
          </div>
        </section>
      )}

      {/* =====================================================================
          6. ELECTRONICS & LIFESTYLE COLLECTION (Muted Sage & Sky Blue Section)
      ===================================================================== */}
      {electronicsProducts.length > 0 && (
        <section className="bg-[#DCE7D9]/45 border-b border-[#C5D7C0] py-10 sm:py-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#254B3B] text-white text-[10px] font-bold uppercase tracking-wider">
                  <Cpu className="w-3 h-3 text-[#E6BE65]" />
                  <span>Flagship Tech &amp; Audio</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#282824] tracking-tight">
                  Electronics &amp; Connected Lifestyle
                </h2>
                <p className="text-xs sm:text-sm text-[#282824]/80">
                  Industry-leading ANC headphones, flagship smartphones, Apple silicon laptops, and rugged smartwatches.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-end">
                <button
                  type="button"
                  onClick={() => onNavigateShop({ category: 'phones' })}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F8F5EF] border border-[#254B3B]/20 text-xs font-bold text-[#254B3B] transition-colors cursor-pointer"
                >
                  Phones
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateShop({ category: 'headphones' })}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F8F5EF] border border-[#254B3B]/20 text-xs font-bold text-[#254B3B] transition-colors cursor-pointer"
                >
                  Audio
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateShop({ category: 'laptops' })}
                  className="px-4 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1d3c2f] text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Laptops →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {electronicsProducts.map((prod) => (
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
          </div>
        </section>
      )}

      {/* =====================================================================
          7. VISUALLY DISTINCT SMARTCART AI SHOPPING ASSISTANT FEATURE SECTION
      ===================================================================== */}
      <section className="bg-[#254B3B] text-white border-b border-[#1b382c] py-12 sm:py-14">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6BE65] text-[#282824] text-xs font-extrabold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Meet SmartCart AI Concierge</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-white leading-tight">
                Not sure which model fits your budget? Ask SmartCart AI.
              </h2>

              <p className="text-sm sm:text-base text-[#DCE7D9]/90 leading-relaxed max-w-2xl">
                Our AI shopping assistant analyses real specifications, verifies stock and multi-retailer pricing, finds visual matches from your uploaded photos, and can even add items straight to your cart.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  'Best wireless ANC headphones under ₹15,000',
                  'Compare Royal Enfield Hunter 350 vs Triumph Speed 400',
                  'Sneakers for daily walking under ₹8,000',
                  'Ergonomic office chair for long coding hours',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onAskAssistant(prompt)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-[#E6BE65] text-white hover:text-[#282824] border border-white/20 text-xs font-semibold transition-all cursor-pointer"
                  >
                    “{prompt}” →
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-5 rounded-2xl bg-[#DCE7D9] text-[#282824] space-y-2 shadow-md">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#254B3B] text-[#E6BE65]">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold">Conversational Discovery</h3>
                <p className="text-xs text-[#282824]/80 leading-relaxed">
                  Filter by exact budget, use-case, brand, or technical requirement in plain English.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F5E6DF] text-[#282824] space-y-2 shadow-md">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#C76F4A] text-white">
                  <Camera className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold">Visual Photo Search</h3>
                <p className="text-xs text-[#282824]/80 leading-relaxed">
                  Upload any sneaker, watch, or gadget photo to find matching products in our catalogue.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#DCE7EE] text-[#282824] space-y-2 shadow-md">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#2B4C65] text-white">
                  <Scale className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold">Deterministic Specs</h3>
                <p className="text-xs text-[#282824]/80 leading-relaxed">
                  Zero hallucinated prices — every recommendation is grounded in live SQLite inventory.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#E6BE65] text-[#282824] space-y-2 shadow-md flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold">Launch AI Assistant</h3>
                  <p className="text-xs text-[#282824]/85 leading-relaxed">
                    Start a tailored shopping session right now.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAskAssistant('Help me find the best value products for my budget')
                  }
                  className="w-full py-2 px-3 rounded-xl bg-[#282824] hover:bg-[#254B3B] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Open SmartCart AI →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. CURATED PRODUCT-COMPARISON SECTION (Warm Ivory + Tinted Cards)
      ===================================================================== */}
      {comparisonPairs.length > 0 && (
        <section className="bg-[#F8F5EF] border-b border-[#E8E3D9] py-10 sm:py-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#254B3B]">
                  <Scale className="w-3.5 h-3.5 text-[#C76F4A]" />
                  Head-to-Head Matchups
                </span>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#282824] tracking-tight mt-0.5">
                  Curated Product Comparisons
                </h2>
                <p className="text-xs sm:text-sm text-[#77766F]">
                  Compare popular rivals side-by-side on price, rating, and verified specifications.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {comparisonPairs.map((pair, idx) => {
                const [itemA, itemB] = pair.items;
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl p-5 border ${pair.bgClass} flex flex-col justify-between space-y-4 shadow-2xs`}
                  >
                    <div className="space-y-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-white text-[#254B3B] text-[10px] font-bold uppercase tracking-wider border border-black/10">
                        {pair.badge}
                      </span>
                      <h3 className="text-base font-bold text-[#282824]">
                        {pair.title}
                      </h3>
                      <p className="text-xs text-[#282824]/75">{pair.subtitle}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-stretch">
                      {[itemA, itemB].map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => onViewDetails(prod)}
                          className="rounded-xl bg-white p-2.5 border border-[#E8E3D9] hover:border-[#254B3B] transition-colors cursor-pointer flex flex-col justify-between"
                        >
                          <div className="w-full h-28 rounded-lg overflow-hidden bg-[#F8F5EF] mb-2">
                            <ProductImage
                              productId={prod.id}
                              src={prod.image}
                              alt={prod.name}
                              category={prod.category}
                              productType={prod.product_type}
                              className="w-full h-full"
                              imageClassName="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-[#77766F] truncate">
                              {prod.brand}
                            </p>
                            <p className="text-xs font-bold text-[#282824] line-clamp-1">
                              {prod.name}
                            </p>
                            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-[#E8E3D9]/60">
                              <span className="text-xs font-extrabold text-[#254B3B]">
                                {formatINR(prod.price)}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                                {prod.rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!comparedProductIds.includes(itemA.id)) {
                            onToggleCompare(itemA);
                          }
                          if (!comparedProductIds.includes(itemB.id)) {
                            onToggleCompare(itemB);
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#254B3B] hover:bg-[#1d3c2f] text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        + Select Both to Compare
                      </button>
                      <button
                        type="button"
                        onClick={() => onAskAssistant(pair.prompt)}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-[#F8F5EF] border border-[#282824]/15 text-xs font-bold text-[#282824] transition-colors cursor-pointer"
                      >
                        AI Verdict
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          9. VERIFIED DEALS & DISCOUNTS SECTION (Crisp White Background)
      ===================================================================== */}
      {dealProducts.length > 0 && (
        <section className="bg-white border-b border-[#E8E3D9] py-10 sm:py-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#E6BE65]/40 text-[#6E470B] text-[10px] font-bold uppercase tracking-wider">
                  <Tag className="w-3 h-3 text-[#C76F4A]" />
                  <span>Verified Price Drops</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#282824] tracking-tight mt-1">
                  Limited-Time Deals &amp; Offers
                </h2>
                <p className="text-xs sm:text-sm text-[#77766F]">
                  Genuine discounts verified against reference retail pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateShop()}
                className="px-4 py-2 rounded-xl bg-[#F8F5EF] hover:bg-[#DCE7D9]/50 border border-[#E8E3D9] text-xs font-bold text-[#282824] transition-colors self-start sm:self-end cursor-pointer"
              >
                See All Deals →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {dealProducts.map((prod) => (
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
          </div>
        </section>
      )}

      {/* =====================================================================
          10. POLISHED SMARTCART AI FOOTER (Deep Charcoal #282824)
      ===================================================================== */}
      <footer className="bg-[#282824] text-[#F8F5EF] border-t border-[#3A3A34]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Brand Identity Column */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#254B3B] border border-[#E6BE65]/40 flex items-center justify-center text-white font-serif font-bold text-base">
                  S
                </div>
                <div>
                  <span className="text-lg font-serif font-bold tracking-tight text-white">
                    SmartCart <span className="text-[#E6BE65]">AI</span>
                  </span>
                  <p className="text-[11px] text-[#DCE7D9]/80 font-medium">
                    Shop Smarter. Choose Better.
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#F8F5EF]/75 leading-relaxed max-w-sm">
                SmartCart AI combines a curated 400-product marketplace across 16 lifestyle &amp; technology departments with deterministic specification comparison, multi-retailer pricing, and conversational AI discovery.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[#E6BE65]">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 400 Curated Products
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 16 Storefront Departments
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified Imagery
                </span>
              </div>
            </div>

            {/* Featured Departments */}
            <div className="md:col-span-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E6BE65]">
                Popular Storefronts
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#F8F5EF]/80">
                {[
                  { label: 'Sneakers & Footwear', cat: 'footwear' },
                  { label: 'Motorcycles & Riding', cat: 'automotive' },
                  { label: 'Streetwear & Apparel', cat: 'fashion' },
                  { label: 'Headphones & Audio', cat: 'headphones' },
                  { label: 'Smartphones', cat: 'phones' },
                  { label: 'Laptops & Computing', cat: 'laptops' },
                  { label: 'Beauty & Personal Care', cat: 'beauty-personal-care' },
                  { label: 'Sports & Fitness', cat: 'sports-fitness' },
                ].map((link) => (
                  <button
                    key={link.cat}
                    type="button"
                    onClick={() => onNavigateShop({ category: link.cat })}
                    className="text-left hover:text-[#E6BE65] transition-colors cursor-pointer"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Shopping Tools */}
            <div className="md:col-span-3 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E6BE65]">
                SmartCart AI Tools
              </h3>
              <ul className="space-y-2 text-xs text-[#F8F5EF]/80">
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      onAskAssistant('Help me compare top-rated products for my budget')
                    }
                    className="hover:text-[#E6BE65] transition-colors cursor-pointer"
                  >
                    AI Shopping Concierge
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenVisualSearch}
                    className="hover:text-[#E6BE65] transition-colors cursor-pointer"
                  >
                    Visual Photo Discovery
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateShop()}
                    className="hover:text-[#E6BE65] transition-colors cursor-pointer"
                  >
                    Multi-Retailer Price Check
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#F8F5EF]/60">
            <span>© {new Date().getFullYear()} SmartCart AI — Shop Smarter. Choose Better.</span>
            <span>Grounded in verified catalogue data • INR (₹) pricing</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
