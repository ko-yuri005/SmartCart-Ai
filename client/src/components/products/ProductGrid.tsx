import React from 'react';
import { Product, ScoredProduct } from '../../types/shopping';
import { ProductCard } from './ProductCard';
import { Sparkles, Info, ShoppingBag } from 'lucide-react';

interface ProductGridProps {
  products: (Product | ScoredProduct)[];
  isLoading: boolean;
  isRelaxedMatch?: boolean;
  relaxedExplanation?: string;
  onViewDetails: (product: Product) => void;
  onComparePrices?: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  comparedProductIds: string[];
  onAddToCart?: (product: Product) => void;
  getCartQuantity?: (productId: string) => number;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading,
  isRelaxedMatch = false,
  relaxedExplanation,
  onViewDetails,
  onComparePrices,
  onToggleCompare,
  comparedProductIds,
  onAddToCart,
  getCartQuantity,
}) => {
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 bg-[#E6E1D6] rounded animate-pulse" />
          <div className="h-4 w-20 bg-[#E6E1D6] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#E6E1D6] rounded-2xl p-4 space-y-3 animate-pulse"
            >
              <div className="aspect-video bg-[#F3EFE6] rounded-xl w-full" />
              <div className="h-4 bg-[#F3EFE6] rounded w-3/4" />
              <div className="h-4 bg-[#F3EFE6] rounded w-1/3" />
              <div className="h-8 bg-[#F3EFE6] rounded w-full mt-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-[#DCE7D9]/40 border border-[#E6E1D6] flex items-center justify-center text-[#254B3B] shadow-sm">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-800">No Recommendations Yet</h3>
        <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
          Ask the assistant for what you're looking for, upload a product photo, or try one of the starter prompts on the left.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#254B3B]" />
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
            Recommended Products ({products.length})
          </h2>
        </div>
        <span className="text-xs text-zinc-500">Grounded from verified catalogue</span>
      </div>

      {/* Relaxed match banner */}
      {isRelaxedMatch && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-950">Closest Matches (Relaxed Constraints)</p>
            <p className="text-amber-800 mt-0.5 leading-relaxed">
              {relaxedExplanation ||
                'No exact matches were found for your strict requirements. Showing the nearest alternative options available in our catalogue.'}
            </p>
          </div>
        </div>
      )}

      {/* Product Grid: Primary exact matches vs Related alternatives */}
      {(() => {
        const primaryItems = products.filter(
          (item) => !('isRelatedAlternative' in item && item.isRelatedAlternative)
        );
        const relatedAlternativeItems = products.filter(
          (item) => 'isRelatedAlternative' in item && item.isRelatedAlternative
        );
        const relatedSectionTitle =
          (relatedAlternativeItems[0] &&
            'alternativeSectionLabel' in relatedAlternativeItems[0] &&
            relatedAlternativeItems[0].alternativeSectionLabel) ||
          'Related alternatives';

        return (
          <div className="space-y-6">
            {primaryItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {primaryItems.map((item) => {
                  const prod: Product = 'product' in item ? item.product : item;
                  const isCompared = comparedProductIds.includes(prod.id);
                  return (
                    <ProductCard
                      key={prod.id}
                      product={item}
                      onViewDetails={onViewDetails}
                      onComparePrices={onComparePrices}
                      onToggleCompare={onToggleCompare}
                      isCompared={isCompared}
                      onAddToCart={onAddToCart}
                      cartQuantity={getCartQuantity ? getCartQuantity(prod.id) : 0}
                    />
                  );
                })}
              </div>
            )}

            {relatedAlternativeItems.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#E6E1D6]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#C76F4A]" />
                    <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                      {relatedSectionTitle} ({relatedAlternativeItems.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Related form-factor options within budget
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedAlternativeItems.map((item) => {
                    const prod: Product = 'product' in item ? item.product : item;
                    const isCompared = comparedProductIds.includes(prod.id);
                    return (
                      <ProductCard
                        key={prod.id}
                        product={item}
                        onViewDetails={onViewDetails}
                        onComparePrices={onComparePrices}
                        onToggleCompare={onToggleCompare}
                        isCompared={isCompared}
                        onAddToCart={onAddToCart}
                        cartQuantity={getCartQuantity ? getCartQuantity(prod.id) : 0}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
