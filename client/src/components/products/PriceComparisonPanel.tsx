import React, { useEffect, useState } from 'react';
import {
  ProductPriceComparisonResult,
  RetailerOffer,
} from '../../types/shopping';
import { fetchProductOffers, refreshProductOffers } from '../../api/client';
import {
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  ShoppingBag,
  Truck,
  Info,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface PriceComparisonPanelProps {
  productId: string;
  autoFocus?: boolean;
}

export function formatVerificationBadge(offer: RetailerOffer): {
  label: string;
  className: string;
} {
  if (offer.availability === 'out_of_stock') {
    return {
      label: 'Out of Stock',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  switch (offer.verificationStatus) {
    case 'live_verified':
      return {
        label: 'Live Verified Price',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'cached_verified':
      return {
        label: 'Cached Verified Price',
        className: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    case 'stale_cached':
      return {
        label: 'Stale Price (Refresh Recommended)',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'unavailable':
      return {
        label: 'Price Unavailable',
        className: 'bg-[#F3EFE6] text-zinc-600 border-[#E6E1D6]',
      };
    case 'unverified_search':
    default:
      return {
        label: 'Retailer Search Link',
        className: 'bg-[#F3EFE6] text-zinc-700 border-[#E6E1D6]',
      };
  }
}

export const PriceComparisonPanel: React.FC<PriceComparisonPanelProps> = ({
  productId,
  autoFocus = false,
}) => {
  const [comparison, setComparison] = useState<ProductPriceComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setCooldownMessage(null);

    fetchProductOffers(productId)
      .then((data) => {
        if (!active) return;
        setComparison(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Unable to load retailer offers');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setCooldownMessage(null);
    setError(null);

    try {
      const updated = await refreshProductOffers(productId);
      setComparison(updated);
      if (updated.providerStatus.rateLimited && updated.providerStatus.cooldownRemainingMs) {
        const secs = Math.ceil(updated.providerStatus.cooldownRemainingMs / 1000);
        setCooldownMessage(
          `Refresh cooldown active — showing cached results. Try again in ${secs}s.`
        );
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to refresh retailer prices');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-white border border-[#E6E1D6] flex items-center justify-center gap-2.5 text-xs text-zinc-600 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-[#254B3B]" />
        <span>Checking verified retailer links &amp; cross-website offers...</span>
      </div>
    );
  }

  if (error && !comparison) {
    return (
      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
        <span>{error}</span>
        <button
          type="button"
          onClick={handleRefresh}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-100 border border-rose-200 text-rose-800 font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!comparison) return null;

  const directOffers = comparison.offers.filter((o) => o.linkType === 'direct_listing');
  const searchOffers = comparison.offers.filter((o) => o.linkType === 'search_link');
  const bestOffer = comparison.lowestVerifiedOffer;

  return (
    <div
      id="price-comparison-section"
      className={`rounded-2xl bg-white border p-4 space-y-4 transition-all shadow-sm ${
        autoFocus
          ? 'border-[#254B3B] ring-2 ring-[#DCE7D9]'
          : 'border-[#E6E1D6]'
      }`}
    >
      {/* Header & Refresh Action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-[#254B3B]" />
          <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
            Where to Buy &amp; Cross-Website Price Comparison
          </h3>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh retailer offers"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F3EFE6] disabled:opacity-50 border border-[#E6E1D6] text-[11px] font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-[#254B3B]' : ''}`} />
          <span>{refreshing ? 'Checking Retailers...' : 'Refresh Prices'}</span>
        </button>
      </div>

      {/* Lowest Verified Total Price Highlight */}
      {comparison.hasComparableVerifiedPrices && bestOffer && bestOffer.totalPrice !== null ? (
        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" />
                Lowest Verified Total Price
              </span>
              <span className="text-[11px] text-zinc-600">
                {bestOffer.verificationStatus === 'live_verified'
                  ? 'Live Verified'
                  : 'Cached Verified'}
                {bestOffer.lastCheckedAt && (
                  <>
                    {' '}
                    • Checked{' '}
                    {new Date(bestOffer.lastCheckedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-xl font-bold text-emerald-800">
                ₹{bestOffer.totalPrice.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-semibold text-zinc-800">
                on {bestOffer.retailerName}
              </span>
              {bestOffer.originalPrice && bestOffer.originalPrice > (bestOffer.price ?? 0) && (
                <span className="text-xs text-zinc-500 line-through">
                  ₹{bestOffer.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
              {bestOffer.discountPercent && bestOffer.discountPercent > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  ({bestOffer.discountPercent}% off)
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
              <Truck className="w-3 h-3 text-zinc-500" />
              <span>
                Item: ₹{(bestOffer.price ?? 0).toLocaleString('en-IN')} +{' '}
                {bestOffer.shippingCost === 0
                  ? 'Free shipping'
                  : `₹${(bestOffer.shippingCost ?? 0).toLocaleString('en-IN')} shipping`}
              </span>
            </p>
          </div>

          <a
            href={bestOffer.listingUrl || bestOffer.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors flex-shrink-0 shadow-sm"
          >
            <span>Buy now on {bestOffer.retailerName}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-700 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#254B3B] flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-zinc-900">
              {comparison.providerStatus.honestStatusMessage}
            </p>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Catalogue reference price is ₹{comparison.cataloguePrice.toLocaleString('en-IN')}. Use the verified retailer links below to check current live pricing, stock, and delivery options.
            </p>
          </div>
        </div>
      )}

      {/* Cooldown or Provider Warning */}
      {cooldownMessage && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>{cooldownMessage}</span>
        </div>
      )}

      {/* Direct Verified Listings Section */}
      {directOffers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
            Verified Direct Retailer Listings ({directOffers.length})
          </h4>
          <div className="divide-y divide-[#E6E1D6] border border-[#E6E1D6] rounded-xl overflow-hidden bg-[#FAF8F5]">
            {directOffers.map((offer) => {
              const badge = formatVerificationBadge(offer);
              const isBest = bestOffer && bestOffer.id === offer.id;
              return (
                <div
                  key={offer.id}
                  className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isBest ? 'bg-emerald-50/40' : 'hover:bg-white'
                  } transition-colors`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-zinc-900">
                        {offer.retailerName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {offer.totalIsIncomplete && offer.price !== null && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          Shipping Unconfirmed
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-700 truncate" title={offer.listingTitle}>
                      {offer.listingTitle}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-600 flex-wrap">
                      {offer.price !== null ? (
                        <>
                          <span>
                            Item:{' '}
                            <strong className="text-zinc-900">
                              ₹{offer.price.toLocaleString('en-IN')}
                            </strong>
                          </span>
                          <span>
                            Shipping:{' '}
                            {offer.shippingKnown
                              ? offer.shippingCost === 0
                                ? 'Free'
                                : `₹${(offer.shippingCost ?? 0).toLocaleString('en-IN')}`
                              : 'Check on retailer'}
                          </span>
                          {offer.totalPrice !== null && (
                            <span>
                              Total:{' '}
                              <strong className="text-emerald-700">
                                ₹{offer.totalPrice.toLocaleString('en-IN')}
                              </strong>
                            </span>
                          )}
                        </>
                      ) : (
                        <span>Live price unavailable — check the retailer&apos;s listing.</span>
                      )}
                    </div>
                  </div>

                  <a
                    href={offer.listingUrl || offer.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                      offer.availability === 'out_of_stock'
                        ? 'bg-[#F3EFE6] text-zinc-600 hover:bg-[#E6E1D6]'
                        : 'bg-[#254B3B] hover:bg-[#1d3d2f] text-white shadow-sm'
                    }`}
                  >
                    <span>
                      {offer.availability === 'out_of_stock' ? 'View listing' : 'Buy now'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Safe Retailer Search Links Section */}
      {searchOffers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
              Search Product Across Online Retailers ({searchOffers.length})
            </h4>
            <span className="text-[10px] text-zinc-500">
              Opens verified retailer search in a new tab
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {searchOffers.map((offer) => (
              <a
                key={offer.id}
                href={offer.listingUrl || offer.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFE6] border border-[#E6E1D6] hover:border-[#254B3B]/40 flex items-center justify-between gap-2 transition-all group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Search className="w-3 h-3 text-[#254B3B] flex-shrink-0" />
                    <span className="text-xs font-semibold text-zinc-900 group-hover:text-[#254B3B] transition-colors">
                      {offer.retailerName}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                    Search this product • Check live price
                  </p>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#E6E1D6] text-[11px] font-medium text-zinc-700 group-hover:text-[#254B3B] group-hover:border-[#254B3B]/30 flex-shrink-0 transition-colors">
                  <span>Search on {offer.retailerName}</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Similar Alternatives / Variant Mismatches */}
      {comparison.similarAlternativeOffers.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Other Variants / Similar Listings (Not Compared as Identical)
            </h4>
          </div>
          <div className="divide-y divide-amber-200 border border-amber-200 rounded-xl overflow-hidden bg-amber-50/50">
            {comparison.similarAlternativeOffers.map((alt) => (
              <div
                key={alt.id}
                className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-900">{alt.retailerName}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-medium">
                      {alt.matchType === 'variant_mismatch'
                        ? 'Different Variant'
                        : 'Similar Alternative'}
                    </span>
                    {alt.price !== null && (
                      <span className="font-semibold text-zinc-900">
                        ₹{alt.price.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-700 truncate">{alt.listingTitle}</p>
                  {alt.matchedVariantSummary && (
                    <p className="text-[11px] text-amber-800">{alt.matchedVariantSummary}</p>
                  )}
                </div>

                <a
                  href={alt.listingUrl || alt.searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F3EFE6] border border-[#E6E1D6] text-zinc-800 text-[11px] font-medium flex-shrink-0 transition-colors"
                >
                  <span>View variant</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclosure Note */}
      <div className="pt-1 border-t border-[#E6E1D6] flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#254B3B] flex-shrink-0" />
          {comparison.affiliateDisclosure}
        </span>
      </div>
    </div>
  );
};
