import React from 'react';
import { Product, ScoredProduct } from '../../types/shopping';
import { ProductImage } from '../common/ProductImage';
import {
  Star,
  Check,
  Plus,
  Eye,
  Sparkles,
  ExternalLink,
  Search,
  ShoppingBag,
  ShoppingCart,
  Bell,
} from 'lucide-react';

interface ProductCardProps {
  product: Product | ScoredProduct;
  onViewDetails: (product: Product) => void;
  onComparePrices?: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  isCompared: boolean;
  onAddToCart?: (product: Product) => void;
  cartQuantity?: number;
  visualBadgeLabel?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onViewDetails,
  onComparePrices,
  onToggleCompare,
  isCompared,
  onAddToCart,
  cartQuantity = 0,
  visualBadgeLabel,
}) => {
  const prod: Product = 'product' in product ? product.product : product;
  const scoredMeta = 'scoreBreakdown' in product ? (product as ScoredProduct) : undefined;

  const whyMatches =
    scoredMeta?.rankingReasons && scoredMeta.rankingReasons.length > 0
      ? scoredMeta.rankingReasons[0]
      : prod.matchExplanation ||
        (prod.use_cases && prod.use_cases.length > 0
          ? `Best for: ${prod.use_cases.join(', ')}`
          : undefined);

  const primaryLink = prod.purchaseLinks?.primaryLink ?? null;
  const hasVerifiedDirect = prod.purchaseLinks?.hasVerifiedDirectListing ?? false;
  const lowestVerifiedOffer = prod.purchaseLinks?.lowestVerifiedOffer ?? null;
  const stockCount = prod.stock_count ?? (prod.availability ? 25 : 0);
  const isAvailable = prod.availability && stockCount > 0;

  const hasGenuineSale =
    Boolean(prod.is_on_sale) &&
    typeof prod.original_price === 'number' &&
    prod.original_price > prod.price;

  const discountPct =
    hasGenuineSale && prod.original_price
      ? prod.discount_percent ||
        Math.round(((prod.original_price - prod.price) / prod.original_price) * 100)
      : 0;

  const availableSizes = (prod.variants || [])
    .filter((v) => v.size && v.availability && v.stockCount > 0)
    .map((v) => v.size!);
  const uniqueSizes = Array.from(new Set(availableSizes));

  const isVehicle =
    prod.category === 'automotive' &&
    (prod.product_type === 'motorcycle' || prod.product_type === 'electric-scooter');

  return (
    <div className="bg-white rounded-2xl border border-[#E8E3D9] hover:border-[#254B3B]/45 overflow-hidden transition-all duration-200 flex flex-col justify-between group shadow-2xs hover:shadow-md">
      <div>
        {/* Coherent Full-Width Product Image Container (No Split Layout) */}
        <div
          onClick={() => onViewDetails(prod)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onViewDetails(prod);
            }
          }}
          className="relative w-full h-56 overflow-hidden bg-[#F4F1EA] border-b border-[#E8E3D9]/70 cursor-pointer"
        >
          <ProductImage
            key={`${prod.id}-${prod.image || 'placeholder'}`}
            productId={prod.id}
            src={prod.image}
            alt={prod.name}
            category={prod.category}
            productType={prod.product_type}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Top-Left Stock & Visual Match Badge */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20 pointer-events-none">
            {!isAvailable ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-900/90 text-white text-[10px] font-semibold tracking-wide uppercase shadow-xs">
                Out of Stock
              </span>
            ) : stockCount <= 5 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E6BE65] text-[#282824] text-[10px] font-bold tracking-wide uppercase shadow-xs">
                Only {stockCount} left
              </span>
            ) : null}
            {visualBadgeLabel && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#254B3B] text-white text-[10px] font-semibold tracking-wide shadow-xs">
                {visualBadgeLabel}
              </span>
            )}
          </div>

          {/* Top-Right Genuine Sale Discount Badge */}
          {hasGenuineSale && discountPct > 0 && (
            <div className="absolute top-3 right-3 z-20 pointer-events-none">
              <span className="px-2.5 py-1 rounded-full bg-[#C76F4A] text-white text-[10px] font-extrabold tracking-wider uppercase shadow-xs">
                -{discountPct}%
              </span>
            </div>
          )}

          {/* Subtle Quick-View Pill on Hover */}
          <div className="absolute bottom-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-[#E8E3D9] text-[#282824] text-[10px] font-semibold shadow-xs">
              <Eye className="w-3 h-3 text-[#254B3B]" />
              <span>Quick View</span>
            </span>
          </div>
        </div>

        {/* Product Details Body */}
        <div className="p-4 space-y-2">
          {/* Brand & Rating Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#254B3B] truncate">
              {prod.brand}
            </span>

            <div className="inline-flex items-center gap-1 text-xs text-[#282824] bg-[#F8F5EF] px-2 py-0.5 rounded-full border border-[#E8E3D9] flex-shrink-0">
              <Star className="w-3 h-3 fill-[#E6BE65] text-[#D4A743]" />
              <span className="font-bold text-[11px] text-[#282824]">{prod.rating}</span>
              <span className="text-[#77766F] text-[10px]">
                ({prod.review_count > 1000 ? `${(prod.review_count / 1000).toFixed(1)}k` : prod.review_count})
              </span>
            </div>
          </div>

          {/* Product Name */}
          <button
            type="button"
            onClick={() => onViewDetails(prod)}
            className="text-left block w-full focus:outline-none"
          >
            <h3 className="text-sm font-bold text-[#282824] line-clamp-2 leading-snug group-hover:text-[#254B3B] transition-colors min-h-[2.5rem]">
              {prod.name}
            </h3>
          </button>

          {/* Price & Sale Presentation */}
          <div className="flex items-baseline justify-between gap-2 pt-0.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-extrabold text-[#282824] tracking-tight">
                ₹{prod.price.toLocaleString('en-IN')}
              </span>
              {hasGenuineSale && prod.original_price && (
                <span className="text-xs text-[#77766F] line-through font-medium">
                  ₹{prod.original_price.toLocaleString('en-IN')}
                </span>
              )}
              {isVehicle && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#DCE7D9] text-[#254B3B]">
                  Ex-Showroom
                </span>
              )}
            </div>

            {isAvailable && stockCount > 5 && (
              <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                In Stock
              </span>
            )}
          </div>

          {/* Restrained Feature or AI Match Note */}
          {scoredMeta?.rankingReasons && scoredMeta.rankingReasons.length > 0 ? (
            <div className="px-2.5 py-1.5 rounded-lg bg-[#DCE7D9]/45 border border-[#254B3B]/15 flex items-start gap-1.5 text-[11px] text-[#254B3B]">
              <Sparkles className="w-3 h-3 flex-shrink-0 text-[#254B3B] mt-0.5" />
              <span className="line-clamp-1 font-medium">{whyMatches}</span>
            </div>
          ) : prod.features && prod.features.length > 0 ? (
            <p className="text-[11px] text-[#77766F] line-clamp-1">
              {prod.features.slice(0, 2).join(' • ')}
            </p>
          ) : null}

          {/* Available Sizes Indicator (Restrained) */}
          {uniqueSizes.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap text-[10px] text-[#77766F]">
              <span className="font-semibold text-[#282824]">Sizes:</span>
              {uniqueSizes.slice(0, 5).map((sz) => (
                <span
                  key={sz}
                  className="px-1.5 py-0.2 rounded bg-[#F8F5EF] border border-[#E8E3D9] font-medium text-[#282824]"
                >
                  {sz}
                </span>
              ))}
            </div>
          )}

          {/* Verified Lowest Retailer Price Badge */}
          {lowestVerifiedOffer && lowestVerifiedOffer.totalPrice !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-[#DCE7D9]/55 border border-[#254B3B]/20 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#254B3B] font-semibold truncate">
                Best price: ₹{lowestVerifiedOffer.totalPrice.toLocaleString('en-IN')} ({lowestVerifiedOffer.retailerName})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Forest-Green Add to Cart & Secondary Actions */}
      <div className="p-4 pt-2.5 space-y-2 border-t border-[#E8E3D9]/60 bg-[#FAF8F4]">
        <div className="flex items-center gap-2">
          {isAvailable ? (
            onAddToCart && (
              <button
                type="button"
                onClick={() =>
                  prod.requires_variant_selection && prod.variants && prod.variants.length > 0
                    ? onViewDetails(prod)
                    : onAddToCart(prod)
                }
                aria-label={`Add ${prod.name} to cart`}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                  cartQuantity > 0
                    ? 'bg-[#1B382C] hover:bg-[#13281F] text-white'
                    : 'bg-[#254B3B] hover:bg-[#1B382C] text-white'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {cartQuantity > 0
                    ? `In Cart (${cartQuantity}) • Add`
                    : isVehicle
                      ? 'Book / Enquire'
                      : prod.requires_variant_selection && prod.variants && prod.variants.length > 0
                        ? 'Select Size'
                        : 'Add to Cart'}
                </span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => onViewDetails(prod)}
              aria-label={`Notify me when ${prod.name} is back in stock`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#E6BE65]/30 hover:bg-[#E6BE65]/50 border border-[#D4A743] text-[#282824] transition-all"
            >
              <Bell className="w-3.5 h-3.5 text-[#C76F4A]" />
              <span>Notify Me</span>
            </button>
          )}

          {/* Secondary Compare Action */}
          <button
            type="button"
            onClick={() => onToggleCompare(prod)}
            aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
            title={isCompared ? 'Remove from comparison' : 'Compare product'}
            className={`inline-flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors flex-shrink-0 ${
              isCompared
                ? 'bg-[#C76F4A] border-[#C76F4A] text-white'
                : 'bg-white border-[#E8E3D9] text-[#282824] hover:bg-[#DCE7D9]/40 hover:border-[#254B3B]/40'
            }`}
          >
            {isCompared ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isCompared ? 'Compared' : 'Compare'}</span>
          </button>
        </div>

        {/* Subtle Secondary Row: Details & Retailer Price Check */}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => onViewDetails(prod)}
            className="inline-flex items-center gap-1 font-semibold text-[#254B3B] hover:underline"
          >
            <Eye className="w-3 h-3" />
            <span>View Details</span>
          </button>

          {primaryLink && hasVerifiedDirect ? (
            <a
              href={primaryLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#C76F4A] hover:underline truncate"
            >
              <ShoppingBag className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {primaryLink.actionLabel} on {primaryLink.retailerName}
              </span>
              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => (onComparePrices ? onComparePrices(prod) : onViewDetails(prod))}
              className="inline-flex items-center gap-1 font-medium text-[#77766F] hover:text-[#282824] transition-colors"
            >
              <Search className="w-3 h-3 text-[#C76F4A]" />
              <span>Compare Retailer Prices</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
