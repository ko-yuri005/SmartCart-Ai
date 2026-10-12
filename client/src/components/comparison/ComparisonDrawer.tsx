import React, { useEffect, useState } from 'react';
import {
  Product,
  ComparisonResult,
  ComparisonPriorityKey,
} from '../../types/shopping';
import { compareProductsApi } from '../../api/client';
import { ProductImage } from '../common/ProductImage';
import {
  X,
  Scale,
  Award,
  DollarSign,
  Star,
  Users,
  Loader2,
  Trash2,
  ExternalLink,
  Search,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  FileCheck2,
  Megaphone,
} from 'lucide-react';

interface ComparisonMatrixContentProps {
  comparison: ComparisonResult;
  onRemoveProduct: (productId: string) => void;
  onAddToCart?: (product: Product) => void;
  getCartQuantity?: (productId: string) => number;
  initialPriority?: ComparisonPriorityKey;
}

export const ComparisonMatrixContent: React.FC<ComparisonMatrixContentProps> = ({
  comparison,
  onRemoveProduct,
  onAddToCart,
  getCartQuantity,
  initialPriority = 'quality_performance',
}) => {
  const [selectedPriority, setSelectedPriority] =
    useState<ComparisonPriorityKey>(initialPriority);

  const priorityOptions: { key: ComparisonPriorityKey; label: string }[] = [
    { key: 'budget', label: 'Best for Budget' },
    { key: 'quality_performance', label: 'Quality & Performance' },
    {
      key: 'sustainability_certifications',
      label: 'Sustainability & Verified Certifications',
    },
    { key: 'everyday_convenience', label: 'Everyday Convenience' },
  ];

  const activeVerdict = comparison.verdictsByPriority?.[selectedPriority];

  return (
    <div className="space-y-6">
      {/* Scope Notice (Separating Feature Comparison vs Cross-Website Price Comparison) */}
      {comparison.comparisonScopeNote && (
        <div className="p-3 rounded-xl bg-[#F3EFE6] border border-[#E6E1D6] text-xs text-zinc-700 flex items-center justify-between gap-2">
          <span>{comparison.comparisonScopeNote}</span>
          {comparison.categoryGroup && (
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E6E1D6] text-[10px] font-semibold uppercase tracking-wider text-[#254B3B] flex-shrink-0">
              Domain: {comparison.categoryGroup.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {/* Priority-Based Verdict Selector (Phase 4) */}
      {comparison.verdictsByPriority && (
        <div
          data-testid="comparison-priority-verdict"
          className="p-4 rounded-2xl bg-[#DCE7D9]/40 border border-[#C5D7C0] space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#254B3B]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#254B3B]">
                Recommendation Verdict by Your Priority
              </h3>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedPriority(opt.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                    selectedPriority === opt.key
                      ? 'bg-[#254B3B] border-[#254B3B] text-white shadow-sm'
                      : 'bg-white border-[#C5D7C0] text-[#254B3B] hover:bg-[#DCE7D9]/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {activeVerdict && (
            <div className="p-3 rounded-xl bg-white border border-[#C5D7C0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#254B3B]">
                    {activeVerdict.priorityLabel} Winner:
                  </span>
                  <span className="text-sm font-bold text-zinc-900">
                    {activeVerdict.recommendedProductName}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {activeVerdict.rationale}
                </p>
              </div>
              {onAddToCart && (
                <button
                  type="button"
                  onClick={() => {
                    const winner = comparison.products.find(
                      (p) => p.id === activeVerdict.recommendedProductId
                    );
                    if (winner) onAddToCart(winner);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors flex-shrink-0"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Add Winner to Cart</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Comparative Indicators Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-[#E6E1D6] space-y-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Lowest Price</span>
          </div>
          <p className="text-xs text-zinc-900 font-semibold truncate">
            {comparison.products.find((p) => p.id === comparison.indicators.cheapestProductId)?.name}
          </p>
          <p className="text-[11px] text-zinc-500">
            ₹{comparison.indicators.priceSpread.toLocaleString('en-IN')} price spread
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E6E1D6] space-y-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Highest Rated</span>
          </div>
          <p className="text-xs text-zinc-900 font-semibold truncate">
            {comparison.products.find((p) => p.id === comparison.indicators.highestRatedProductId)?.name}
          </p>
          <p className="text-[11px] text-zinc-500">Top verified rating</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E6E1D6] space-y-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-sky-700 font-semibold">
            <Users className="w-3.5 h-3.5" />
            <span>Most Reviewed</span>
          </div>
          <p className="text-xs text-zinc-900 font-semibold truncate">
            {comparison.products.find((p) => p.id === comparison.indicators.mostReviewedProductId)?.name}
          </p>
          <p className="text-[11px] text-zinc-500">Highest review volume</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E6E1D6] space-y-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-[#254B3B] font-semibold">
            <Award className="w-3.5 h-3.5" />
            <span>Best Overall Fit</span>
          </div>
          <p className="text-xs text-zinc-900 font-semibold truncate">
            {comparison.products[0]?.name}
          </p>
          <p className="text-[11px] text-zinc-500">Top specification score</p>
        </div>
      </div>

      {/* Main Side-by-Side Comparison Matrix */}
      <div className="border border-[#E6E1D6] rounded-2xl overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-[#FAF8F5] border-b border-[#E6E1D6] divide-x divide-[#E6E1D6]">
              <th className="p-3.5 font-semibold text-zinc-600 w-40 sm:w-48 flex-shrink-0">
                Comparison Attribute
              </th>
              {comparison.products.map((p) => {
                const inCartQty = getCartQuantity ? getCartQuantity(p.id) : 0;
                return (
                  <th key={p.id} className="p-3.5 font-semibold text-zinc-900 min-w-[210px]">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-[#254B3B] font-bold">
                          {p.brand}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveProduct(p.id)}
                          aria-label={`Remove ${p.name} from comparison`}
                          className="text-zinc-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F3EFE6] border border-[#E6E1D6]">
                        <ProductImage
                          key={`${p.id}-${p.image || 'placeholder'}`}
                          productId={p.id}
                          src={p.image}
                          alt={p.name}
                          category={p.category}
                          productType={p.product_type}
                          className="w-full h-full"
                        />
                      </div>

                      <p className="line-clamp-2 leading-tight text-zinc-900 font-semibold">
                        {p.name}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-zinc-900">
                          ₹{p.price.toLocaleString('en-IN')}
                        </span>
                        {onAddToCart && (
                          <button
                            type="button"
                            disabled={!p.availability}
                            onClick={() => onAddToCart(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#254B3B] hover:bg-[#1C3A2E] disabled:bg-zinc-200 text-white text-[11px] font-semibold transition-colors"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>{inCartQty > 0 ? `Add (${inCartQty})` : 'Add to Cart'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E6E1D6]">
            {/* Section 1: Common Marketplace Attributes */}
            <tr className="bg-[#F3EFE6]/70">
              <td
                colSpan={comparison.products.length + 1}
                className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-700"
              >
                Core Product Attributes
              </td>
            </tr>

            {comparison.commonMatrix && comparison.commonMatrix.length > 0 ? (
              comparison.commonMatrix.map((row) => (
                <tr key={row.key} className="divide-x divide-[#E6E1D6] hover:bg-[#FAF8F5]">
                  <td className="p-3 font-medium text-zinc-600">{row.label}</td>
                  {comparison.products.map((p) => (
                    <td key={p.id} className="p-3 text-zinc-800">
                      {row.values[p.id] || 'Not provided'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <>
                <tr className="divide-x divide-[#E6E1D6]">
                  <td className="p-3 font-medium text-zinc-600">Rating &amp; Reviews</td>
                  {comparison.products.map((p) => (
                    <td key={p.id} className="p-3 text-zinc-800">
                      {p.rating} ★ ({p.review_count.toLocaleString('en-IN')} reviews)
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* Section 2: Category-Specific Attributes (Food, Clothing, Personal Care, Electronics, etc.) */}
            {comparison.categorySpecificMatrix &&
              comparison.categorySpecificMatrix.length > 0 && (
                <>
                  <tr className="bg-[#F3EFE6]/70">
                    <td
                      colSpan={comparison.products.length + 1}
                      className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#254B3B]"
                    >
                      Category-Relevant Attributes ({comparison.categoryGroup?.replace(/_/g, ' ')})
                    </td>
                  </tr>
                  {comparison.categorySpecificMatrix.map((row) => (
                    <tr key={row.key} className="divide-x divide-[#E6E1D6] hover:bg-[#FAF8F5]">
                      <td className="p-3 font-medium text-zinc-600">{row.label}</td>
                      {comparison.products.map((p) => {
                        const val = row.values[p.id] || 'Not provided';
                        const isMissing = val === 'Not provided' || val === 'Unknown';
                        return (
                          <td
                            key={p.id}
                            className={`p-3 ${
                              isMissing ? 'text-zinc-400 italic' : 'text-zinc-900 font-medium'
                            }`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              )}

            {/* Section 3: Organic & Technical Certification Verification Audit */}
            {comparison.certificationAudit && (
              <>
                <tr className="bg-[#F3EFE6]/70">
                  <td
                    colSpan={comparison.products.length + 1}
                    className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-900"
                  >
                    Certification &amp; Marketing Claim Audit (Verified vs Unverified)
                  </td>
                </tr>
                <tr className="divide-x divide-[#E6E1D6] bg-emerald-50/20">
                  <td className="p-3 font-medium text-zinc-700">
                    Organic &amp; Official Certifications
                  </td>
                  {comparison.products.map((p) => {
                    const audit = comparison.certificationAudit?.[p.id];
                    if (!audit) {
                      return (
                        <td key={p.id} className="p-3 text-zinc-500">
                          Not provided
                        </td>
                      );
                    }
                    return (
                      <td key={p.id} className="p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              audit.isOrganicCertified
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : audit.organicStatus === 'not_certified_organic'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-[#F3EFE6] text-zinc-700 border-[#E6E1D6]'
                            }`}
                          >
                            {audit.organicCertificationLabel}
                          </span>
                        </div>

                        {audit.verifiedCertifications.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {audit.verifiedCertifications.map((cert, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 font-medium"
                              >
                                <ShieldCheck className="w-2.5 h-2.5" />
                                {cert}
                              </span>
                            ))}
                          </div>
                        )}

                        {audit.unverifiedMarketingTerms.length > 0 && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
                            <div className="flex items-center gap-1 font-semibold">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              <span>
                                Marketing terms: {audit.unverifiedMarketingTerms.join(', ')}
                              </span>
                            </div>
                            <p className="text-[10px] text-amber-800 leading-snug">
                              {audit.auditNote}
                            </p>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* Section 4: Verified Facts vs Seller Claims vs AI Interpretations */}
            {comparison.evidenceBreakdown && (
              <>
                <tr className="bg-[#F3EFE6]/70">
                  <td
                    colSpan={comparison.products.length + 1}
                    className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-700"
                  >
                    Evidence Separation: Verified Facts vs Seller Claims vs AI Synthesis
                  </td>
                </tr>

                {/* Verified Facts */}
                <tr className="divide-x divide-[#E6E1D6]">
                  <td className="p-3 font-medium text-zinc-700">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Verified Facts</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Measurable database specs
                    </span>
                  </td>
                  {comparison.products.map((p) => {
                    const ev = comparison.evidenceBreakdown?.[p.id];
                    return (
                      <td key={p.id} className="p-3 text-zinc-800">
                        <ul className="list-disc list-inside space-y-1">
                          {(ev?.verifiedFacts || []).slice(0, 5).map((f, i) => (
                            <li key={i} className="text-[11px] leading-snug">
                              {f}
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  })}
                </tr>

                {/* Seller Claims */}
                <tr className="divide-x divide-[#E6E1D6]">
                  <td className="p-3 font-medium text-zinc-700">
                    <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>Seller Claims</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Brand/manufacturer highlights
                    </span>
                  </td>
                  {comparison.products.map((p) => {
                    const ev = comparison.evidenceBreakdown?.[p.id];
                    return (
                      <td key={p.id} className="p-3 text-zinc-700">
                        <ul className="list-disc list-inside space-y-1">
                          {(ev?.sellerClaims || []).slice(0, 4).map((c, i) => (
                            <li key={i} className="text-[11px] leading-snug">
                              {c}
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  })}
                </tr>

                {/* AI-Generated Interpretations */}
                <tr className="divide-x divide-[#E6E1D6]">
                  <td className="p-3 font-medium text-zinc-700">
                    <div className="flex items-center gap-1.5 text-[#254B3B] font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Interpretation</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Synthesized suitability note
                    </span>
                  </td>
                  {comparison.products.map((p) => {
                    const ev = comparison.evidenceBreakdown?.[p.id];
                    return (
                      <td key={p.id} className="p-3 text-zinc-700">
                        <ul className="list-disc list-inside space-y-1">
                          {(ev?.aiInterpretations || []).map((interp, i) => (
                            <li key={i} className="text-[11px] leading-snug italic">
                              {interp}
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* Section 5: External Retailer Purchase / Search Links */}
            <tr className="divide-x divide-[#E6E1D6] bg-[#FAF8F5]">
              <td className="p-3 font-medium text-zinc-600">External Retailer Links</td>
              {comparison.products.map((p) => {
                const primaryLink = p.purchaseLinks?.primaryLink ?? null;
                const hasVerifiedDirect = p.purchaseLinks?.hasVerifiedDirectListing ?? false;
                const lowestOffer = p.purchaseLinks?.lowestVerifiedOffer ?? null;
                const searchLinks = p.purchaseLinks?.retailerSearchLinks ?? [];
                return (
                  <td key={p.id} className="p-3 space-y-1.5">
                    {lowestOffer && lowestOffer.totalPrice !== null && (
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        Best Verified: ₹{lowestOffer.totalPrice.toLocaleString('en-IN')} (
                        {lowestOffer.retailerName})
                      </div>
                    )}

                    {primaryLink && hasVerifiedDirect ? (
                      <a
                        href={primaryLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition-colors"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>
                          {primaryLink.actionLabel} on {primaryLink.retailerName}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : searchLinks.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {searchLinks.slice(0, 2).map((sLink) => (
                          <a
                            key={sLink.retailerId}
                            href={sLink.searchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white hover:bg-[#F3EFE6] border border-[#E6E1D6] text-zinc-800 text-[11px] font-medium transition-colors"
                          >
                            <Search className="w-3 h-3 text-[#254B3B]" />
                            <span>{sLink.retailerName}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-[11px]">Check product details</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Section 6: Full Technical Specifications Matrix */}
            {comparison.specMatrix.map((spec) => (
              <tr key={spec.key} className="divide-x divide-[#E6E1D6] hover:bg-[#FAF8F5]">
                <td className="p-3 font-medium text-zinc-600 capitalize">
                  {spec.key.replace(/_/g, ' ')}
                </td>
                {comparison.products.map((p) => (
                  <td key={p.id} className="p-3 font-mono text-zinc-800">
                    {spec.values[p.id] || 'Not provided'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface ComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  onRemoveProduct: (productId: string) => void;
  onClearComparison: () => void;
  onAddToCart?: (product: Product) => void;
  getCartQuantity?: (productId: string) => number;
}

export const ComparisonDrawer: React.FC<ComparisonDrawerProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  onRemoveProduct,
  onClearComparison,
  onAddToCart,
  getCartQuantity,
}) => {
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || selectedProducts.length < 2) {
      setComparison(null);
      return;
    }

    setLoading(true);
    setError(null);

    const ids = selectedProducts.map((p) => p.id);
    compareProductsApi(ids)
      .then((data) => {
        setComparison(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isOpen, selectedProducts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF8F5] border border-[#E6E1D6] rounded-t-2xl sm:rounded-2xl w-full max-w-6xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E6E1D6] bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#254B3B]" />
            <h2 id="comparison-title" className="text-base font-bold text-zinc-900">
              Product Comparison ({selectedProducts.length}/4)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {selectedProducts.length > 0 && (
              <button
                type="button"
                onClick={onClearComparison}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F3EFE6] border border-[#E6E1D6] text-xs font-medium text-zinc-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close comparison drawer"
              className="p-1.5 rounded-lg bg-[#F3EFE6] hover:bg-[#E6E1D6] text-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content View */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {selectedProducts.length < 2 ? (
            <div className="py-16 text-center space-y-3">
              <Scale className="w-12 h-12 mx-auto text-[#254B3B]/60" />
              <h3 className="text-sm font-bold text-zinc-900">Select at Least 2 Products</h3>
              <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed">
                Click &quot;+ Compare&quot; on any 2 to 4 product cards to view category-specific attributes, organic certification audits, and priority verdicts.
              </p>
            </div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-zinc-600">
              <Loader2 className="w-8 h-8 animate-spin text-[#254B3B]" />
              <p className="text-xs">Computing category-specific comparison matrix...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          ) : comparison ? (
            <ComparisonMatrixContent
              comparison={comparison}
              onRemoveProduct={onRemoveProduct}
              onAddToCart={onAddToCart}
              getCartQuantity={getCartQuantity}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
