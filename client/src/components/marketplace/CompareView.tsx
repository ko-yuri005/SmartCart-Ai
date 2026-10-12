import React, { useEffect, useState } from 'react';
import {
  Product,
  ComparisonResult,
  ComparisonPriorityKey,
} from '../../types/shopping';
import { compareProductsApi } from '../../api/client';
import { ComparisonMatrixContent } from '../comparison/ComparisonDrawer';
import { ProductImage } from '../common/ProductImage';
import {
  Scale,
  Trash2,
  Loader2,
  Plus,
  Sparkles,
  Check,
} from 'lucide-react';

interface CompareViewProps {
  allProducts: Product[];
  selectedProducts: Product[];
  onToggleCompare: (product: Product) => void;
  onRemoveProduct: (productId: string) => void;
  onClearComparison: () => void;
  onAddToCart: (product: Product) => void;
  getCartQuantity: (productId: string) => number;
  defaultPriority?: ComparisonPriorityKey;
}

const QUICK_COMPARE_PRESETS: {
  title: string;
  subtitle: string;
  productIds: string[];
}[] = [
  {
    title: 'Wireless Headphones & Earbuds',
    subtitle: 'Compare battery life, ANC, and verified audio specs',
    productIds: ['hp-sony-wh-ch720n', 'hp-jbl-tune-760nc', 'hp-realme-buds-t300'],
  },
  {
    title: 'Skincare & Sunscreens (Certification Audit)',
    subtitle: 'Inspect verified ingredients vs "natural" marketing claims',
    productIds: ['beauty-minimalist-sunscreen-spf50', 'beauty-minimalist-salicylic-facewash'],
  },
  {
    title: 'Commuter Motorcycles (125cc–350cc)',
    subtitle: 'Compare mileage, kerb weight, power, and price spread',
    productIds: ['auto-honda-sp125', 'auto-tvs-raider-125', 'auto-re-hunter-350'],
  },
  {
    title: 'Running & Training Footwear',
    subtitle: 'Compare cushioning, sole material, and athletic fit',
    productIds: ['foot-nike-revolution-6', 'foot-puma-velocity-nitro', 'foot-decathlon-kalenji'],
  },
];

export const CompareView: React.FC<CompareViewProps> = ({
  allProducts,
  selectedProducts,
  onToggleCompare,
  onRemoveProduct,
  onClearComparison,
  onAddToCart,
  getCartQuantity,
  defaultPriority = 'quality_performance',
}) => {
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (selectedProducts.length < 2) {
      setComparison(null);
      return;
    }

    setLoading(true);
    setError(null);

    compareProductsApi(selectedProducts.map((p) => p.id))
      .then((res) => {
        setComparison(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to compare products');
        setLoading(false);
      });
  }, [selectedProducts]);

  const handleLoadPreset = (ids: string[]) => {
    onClearComparison();
    const found = allProducts.filter((p) => ids.includes(p.id));
    found.forEach((p) => onToggleCompare(p));
  };

  const quickAddCandidates = allProducts
    .filter((p) => {
      if (!pickerSearch.trim()) return false;
      const q = pickerSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    })
    .slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F5]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header & Product Selector Bar */}
        <div className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#DCE7D9] border border-[#C5D7C0] flex items-center justify-center text-[#254B3B]">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-zinc-900">
                  Meaningful Side-by-Side Product Comparison ({selectedProducts.length}/4)
                </h1>
                <p className="text-xs text-zinc-500">
                  Category-specific attributes • Verified facts vs seller claims • Organic certification verification
                </p>
              </div>
            </div>

            {selectedProducts.length > 0 && (
              <button
                type="button"
                onClick={onClearComparison}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-rose-50 border border-[#E6E1D6] hover:border-rose-200 text-xs font-semibold text-zinc-700 hover:text-rose-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Selection</span>
              </button>
            )}
          </div>

          {/* Add Product to Compare Search Input */}
          <div className="space-y-2">
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search any product in our curated catalogue to add to comparison (max 4)..."
              aria-label="Search products to add to comparison"
              className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#254B3B]"
            />

            {quickAddCandidates.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                {quickAddCandidates.map((cand) => {
                  const alreadySelected = selectedProducts.some((p) => p.id === cand.id);
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => onToggleCompare(cand)}
                      className={`p-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                        alreadySelected
                          ? 'bg-[#DCE7D9] border-[#C5D7C0] text-[#254B3B]'
                          : 'bg-[#FAF8F5] hover:bg-white border-[#E6E1D6] text-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-[#E6E1D6] flex-shrink-0">
                          <ProductImage
                            productId={cand.id}
                            src={cand.image}
                            alt={cand.name}
                            category={cand.category}
                            productType={cand.product_type}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{cand.name}</p>
                          <p className="text-[11px] text-zinc-500">
                            {cand.brand} • ₹{cand.price.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#E6E1D6] text-[11px] font-semibold flex-shrink-0">
                        {alreadySelected ? (
                          <Check className="w-3.5 h-3.5 text-[#254B3B]" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-zinc-600" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Comparison Content or Presets */}
        {selectedProducts.length < 2 ? (
          <div className="space-y-4">
            <div className="p-8 rounded-2xl bg-white border border-[#E6E1D6] text-center space-y-2">
              <Scale className="w-10 h-10 text-[#254B3B] mx-auto" />
              <h2 className="text-sm font-bold text-zinc-900">
                {selectedProducts.length === 1
                  ? `1 Product Selected (${selectedProducts[0].name}) — Add 1 More to Compare`
                  : 'Select 2 to 4 Products to Compare Side-by-Side'}
              </h2>
              <p className="text-xs text-zinc-600 max-w-md mx-auto">
                Search above, click &quot;+ Compare&quot; on any product card in the Shop or AI Assistant, or launch one of our instant comparison presets below:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {QUICK_COMPARE_PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-white border border-[#E6E1D6] hover:border-[#C5D7C0] flex items-center justify-between gap-4 shadow-sm transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                      <Sparkles className="w-3.5 h-3.5 text-[#254B3B]" />
                      <span>{preset.title}</span>
                    </div>
                    <p className="text-xs text-zinc-600">{preset.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadPreset(preset.productIds)}
                    className="px-3.5 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold flex-shrink-0 transition-colors"
                  >
                    Compare ({preset.productIds.length})
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="p-16 rounded-2xl bg-white border border-[#E6E1D6] flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#254B3B]" />
            <p className="text-xs text-zinc-600">
              Auditing certifications, separating verified facts from seller claims, and building matrix...
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        ) : comparison ? (
          <ComparisonMatrixContent
            comparison={comparison}
            onRemoveProduct={onRemoveProduct}
            onAddToCart={onAddToCart}
            getCartQuantity={getCartQuantity}
            initialPriority={defaultPriority}
          />
        ) : null}
      </div>
    </div>
  );
};
