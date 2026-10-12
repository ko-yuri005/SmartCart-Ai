import React, { useEffect, useState, useRef } from 'react';
import {
  CategoryReviewAttributes,
  Product,
  ProductReviewSummaryDTO,
  ProductVariantDTO,
} from '../../types/shopping';
import {
  fetchProductById,
  fetchProductReviewsApi,
  submitProductReviewApi,
  subscribeRestockApi,
} from '../../api/client';
import { ProductImage } from '../common/ProductImage';
import { PriceComparisonPanel } from './PriceComparisonPanel';
import {
  X,
  Star,
  Check,
  Plus,
  Loader2,
  ShieldCheck,
  Tag,
  ShoppingCart,
  Minus,
  Maximize2,
  Bell,
  MessageSquare,
  CheckCircle2,
  Award,
} from 'lucide-react';

interface ProductDetailsModalProps {
  productId: string | null;
  sessionId?: string;
  userEmail?: string;
  userName?: string;
  focusPriceComparison?: boolean;
  onClose: () => void;
  onToggleCompare: (product: Product) => void;
  isCompared: boolean;
  onAddToCart?: (
    product: Product,
    quantity: number,
    variantOptions?: {
      variantId?: string | null;
      selectedSize?: string | null;
      selectedColor?: string | null;
    }
  ) => void;
  cartQuantity?: number;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  productId,
  sessionId = 'guest_session',
  userEmail = '',
  userName = '',
  focusPriceComparison = false,
  onClose,
  onToggleCompare,
  isCompared,
  onAddToCart,
  cartQuantity = 0,
}) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  // Gallery & Lightbox state (Phase 4)
  const [activeImageUrl, setActiveImageUrl] = useState<string>('');
  const [activeImageLabel, setActiveImageLabel] = useState<string>('');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Variant state (Phase 5)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDTO | null>(null);

  // Restock notification state (Phase 10)
  const [restockEmail, setRestockEmail] = useState(userEmail || '');
  const [restockConsent, setRestockConsent] = useState(true);
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockSuccessMsg, setRestockSuccessMsg] = useState<string | null>(null);
  const [restockError, setRestockError] = useState<string | null>(null);

  // Reviews state (Phase 8)
  const [reviewSummary, setReviewSummary] = useState<ProductReviewSummaryDTO | null>(null);
  const [reviewSortBy, setReviewSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewAuthor, setReviewAuthor] = useState(userName || '');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFit, setReviewFit] = useState<string>('');
  const [reviewComfort, setReviewComfort] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  const priceSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userEmail && !restockEmail) setRestockEmail(userEmail);
    if (userName && !reviewAuthor) setReviewAuthor(userName);
  }, [userEmail, userName]);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setReviewSummary(null);
      setSelectedVariant(null);
      return;
    }

    setLoading(true);
    setError(null);
    setQty(1);
    setRestockSuccessMsg(null);
    setRestockError(null);
    setReviewFormError(null);
    setReviewSuccessMsg(null);
    setIsLightboxOpen(false);

    Promise.all([
      fetchProductById(productId),
      fetchProductReviewsApi(productId, 'newest').catch(() => null),
    ])
      .then(([data, revs]) => {
        setProduct(data);
        setActiveImageUrl(data.image);
        setActiveImageLabel(`${data.name} — Primary View`);

        if (data.variants && data.variants.length > 0) {
          const defVar =
            data.variants.find((v) => v.isDefault && v.availability && v.stockCount > 0) ||
            data.variants.find((v) => v.availability && v.stockCount > 0) ||
            data.variants[0];
          setSelectedVariant(defVar);
          if (defVar.image) {
            setActiveImageUrl(defVar.image);
          }
        } else {
          setSelectedVariant(null);
        }

        if (revs) setReviewSummary(revs);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    fetchProductReviewsApi(productId, reviewSortBy)
      .then((revs) => setReviewSummary(revs))
      .catch(() => {});
  }, [productId, reviewSortBy]);

  useEffect(() => {
    if (focusPriceComparison && product && !loading) {
      const timer = setTimeout(() => {
        priceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusPriceComparison, product, loading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLightboxOpen) {
          setIsLightboxOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isLightboxOpen]);

  if (!productId) return null;

  const effectivePrice = selectedVariant ? selectedVariant.price : product?.price ?? 0;
  const effectiveOriginalPrice =
    selectedVariant && selectedVariant.originalPrice
      ? selectedVariant.originalPrice
      : product?.original_price ?? null;
  const hasDiscount =
    typeof effectiveOriginalPrice === 'number' && effectiveOriginalPrice > effectivePrice;
  const discountPct = hasDiscount
    ? Math.round(((effectiveOriginalPrice! - effectivePrice) / effectiveOriginalPrice!) * 100)
    : 0;

  const maxStock = selectedVariant
    ? selectedVariant.stockCount
    : product
      ? (product.stock_count ?? 25)
      : 25;
  const isAvailable = Boolean(
    product &&
      (selectedVariant
        ? selectedVariant.availability && selectedVariant.stockCount > 0
        : product.availability && maxStock > 0)
  );

  const galleryItems =
    product?.image_gallery && product.image_gallery.length > 0
      ? product.image_gallery
      : product
        ? [
            {
              url: product.image,
              label: `${product.name} — Studio Front View`,
              viewType: 'front' as const,
            },
          ]
        : [];

  const handleSelectVariant = (v: ProductVariantDTO) => {
    setSelectedVariant(v);
    setRestockSuccessMsg(null);
    setRestockError(null);
    if (v.image) {
      setActiveImageUrl(v.image);
      setActiveImageLabel(`${product?.name} (${v.label})`);
    }
    if (qty > v.stockCount && v.stockCount > 0) {
      setQty(v.stockCount);
    }
  };

  const handleSubscribeRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setRestockLoading(true);
    setRestockError(null);
    setRestockSuccessMsg(null);
    try {
      const sub = await subscribeRestockApi({
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
        selectedSize: selectedVariant?.size ?? null,
        selectedColor: selectedVariant?.color ?? null,
        sessionId,
        email: restockEmail.trim(),
        consentGiven: restockConsent,
      });
      setRestockSuccessMsg(sub.statusMessage);
    } catch (err) {
      setRestockError(
        err instanceof Error ? err.message : 'Failed to subscribe to restock alert'
      );
    } finally {
      setRestockLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setReviewSubmitting(true);
    setReviewFormError(null);
    setReviewSuccessMsg(null);

    const catAttrs: CategoryReviewAttributes = {};
    const catLower = product.category.toLowerCase();
    if (catLower.includes('fashion') || catLower.includes('clothing')) {
      if (reviewFit) catAttrs.fit = reviewFit as any;
      if (reviewComfort) catAttrs.comfort = reviewComfort;
    } else if (catLower.includes('footwear') || catLower.includes('shoe')) {
      if (reviewFit) catAttrs.sizingAccuracy = reviewFit as any;
      if (reviewComfort) catAttrs.comfort = reviewComfort;
    } else if (
      catLower.includes('electronics') ||
      catLower.includes('phone') ||
      catLower.includes('laptop') ||
      catLower.includes('headphone')
    ) {
      if (reviewComfort) catAttrs.performance = reviewComfort;
    }

    try {
      const created = await submitProductReviewApi(product.id, {
        sessionId,
        authorName: reviewAuthor.trim() || 'Shopper',
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        categoryAttributes: catAttrs,
      });
      setReviewSuccessMsg(
        created.isVerifiedPurchase
          ? 'Thank you! Your Verified Purchase review has been published.'
          : 'Thank you! Your customer review has been published.'
      );
      setReviewTitle('');
      setReviewComment('');
      setShowReviewForm(false);
      const updatedRevs = await fetchProductReviewsApi(product.id, reviewSortBy);
      setReviewSummary(updatedRevs);
      const updatedProd = await fetchProductById(product.id);
      setProduct(updatedProd);
    } catch (err) {
      setReviewFormError(err instanceof Error ? err.message : 'Could not submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const isClothingOrFootwear =
    product &&
    (product.category.toLowerCase().includes('fashion') ||
      product.category.toLowerCase().includes('footwear') ||
      product.category.toLowerCase().includes('clothing'));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-product-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Fullscreen Image Lightbox Modal (Phase 4) */}
      {isLightboxOpen && product && (
        <div
          className="fixed inset-0 z-[60] bg-zinc-950/90 flex flex-col items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setIsLightboxOpen(false);
          }}
        >
          <div className="max-w-4xl w-full flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-between text-white px-2">
              <span className="text-sm font-semibold">
                {activeImageLabel || product.name}
              </span>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden max-h-[80vh] p-2">
              <ProductImage
                productId={product.id}
                src={activeImageUrl || product.image}
                alt={activeImageLabel || product.name}
                category={product.category}
                productType={product.product_type}
                className="max-h-[75vh] w-auto"
                imageClassName="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      <div
        className="bg-[#FAF8F5] border border-[#E6E1D6] rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E6E1D6] bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-600">
              Product Details, Gallery, Variants &amp; Reviews
            </span>
            {product?.availability !== undefined && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  isAvailable
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isAvailable ? `In Stock (${maxStock} available)` : 'Out of Stock'}
              </span>
            )}
            {hasDiscount && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-600 text-white">
                {discountPct}% OFF SALE
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details modal"
            className="p-1.5 rounded-lg bg-[#F3EFE6] hover:bg-[#E6E1D6] text-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#254B3B]" />
              <p className="text-xs">Fetching verified product specifications...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {product && !loading && (
            <>
              {/* Product Top Overview: Gallery + Variant & Purchase Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Multi-Angle Gallery Column (Phase 4) */}
                <div className="space-y-3">
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-[#E6E1D6] shadow-sm group">
                    <ProductImage
                      key={`${product.id}-${activeImageUrl || product.image || 'placeholder'}`}
                      productId={product.id}
                      src={activeImageUrl || product.image}
                      alt={activeImageLabel || product.name}
                      category={product.category}
                      productType={product.product_type}
                      className="w-full h-full"
                      imageClassName="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      title="Enlarge product image"
                      className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-white/95 hover:bg-white border border-[#E6E1D6] text-zinc-800 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-[#254B3B]" />
                      <span>Zoom</span>
                    </button>
                  </div>

                  {/* Gallery Thumbnails */}
                  {galleryItems.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {galleryItems.map((g, idx) => {
                        const isActiveImg = (activeImageUrl || product.image) === g.url && activeImageLabel === g.label;
                        return (
                          <button
                            key={`${g.viewType}-${idx}`}
                            type="button"
                            onClick={() => {
                              setActiveImageUrl(g.url);
                              setActiveImageLabel(g.label);
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all flex-shrink-0 ${
                              isActiveImg
                                ? 'bg-[#DCE7D9]/40 border-[#254B3B] text-[#254B3B] font-semibold shadow-sm'
                                : 'bg-white hover:bg-[#F3EFE6] border-[#E6E1D6] text-zinc-700'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#F3EFE6] border border-[#E6E1D6] flex-shrink-0">
                              <ProductImage
                                productId={product.id}
                                src={g.url}
                                alt={g.label}
                                category={product.category}
                                className="w-full h-full"
                              />
                            </div>
                            <span className="text-[11px] capitalize">{g.viewType}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Column: Info, Pricing, Variants, Cart / Restock */}
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-[#254B3B] uppercase tracking-wider">
                      {product.brand} • {product.category.replace(/-/g, ' ')}
                    </span>
                    <h2
                      id="modal-product-title"
                      className="text-xl font-bold text-zinc-900 mt-1 leading-snug"
                    >
                      {product.name}
                    </h2>
                  </div>

                  {/* Price & Genuine Reference Price Breakdown (Phase 9) */}
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-2xl font-bold text-zinc-900">
                      ₹{effectivePrice.toLocaleString('en-IN')}
                    </span>
                    {hasDiscount && effectiveOriginalPrice && (
                      <>
                        <span className="text-sm text-zinc-400 line-through">
                          MRP ₹{effectiveOriginalPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Save ₹{(effectiveOriginalPrice - effectivePrice).toLocaleString('en-IN')} ({discountPct}% OFF)
                        </span>
                      </>
                    )}
                    <div className="flex items-center gap-1 text-xs text-zinc-700 bg-white px-2.5 py-1 rounded-lg border border-[#E6E1D6]">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span className="font-semibold text-zinc-900">{product.rating}</span>
                      <span className="text-zinc-500">
                        ({product.review_count.toLocaleString('en-IN')} reviews)
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {product.description}
                  </p>

                  {/* Size & Colour Variant Selector (Phase 5) */}
                  {product.variants && product.variants.length > 0 && (
                    <div
                      data-testid="product-variant-selector"
                      className="p-3.5 rounded-xl bg-white border border-[#E6E1D6] space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-900">
                          Select Size / Variant:
                        </span>
                        {selectedVariant && (
                          <span className="text-[11px] text-zinc-500 font-mono">
                            SKU: {selectedVariant.sku}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((v) => {
                          const isSelected = selectedVariant?.id === v.id;
                          const varInStock = v.availability && v.stockCount > 0;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => handleSelectVariant(v)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[#254B3B] border-[#254B3B] text-white shadow-sm'
                                  : varInStock
                                    ? 'bg-[#FAF8F5] hover:bg-[#F3EFE6] border-[#E6E1D6] text-zinc-900'
                                    : 'bg-zinc-100 border-zinc-200 text-zinc-400 line-through'
                              }`}
                            >
                              <span>{v.label}</span>
                              {!varInStock && (
                                <span className="text-[10px] no-underline font-normal">
                                  (Out)
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add to Cart OR Out-of-Stock Restock Notification Form (Phase 10) */}
                  {isAvailable ? (
                    onAddToCart && (
                      <div className="pt-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-[#E6E1D6] rounded-xl bg-white overflow-hidden">
                            <button
                              type="button"
                              disabled={qty <= 1}
                              onClick={() => setQty((q) => Math.max(1, q - 1))}
                              aria-label="Decrease quantity"
                              className="p-2 text-zinc-700 hover:bg-[#F3EFE6] disabled:opacity-40 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-semibold text-zinc-900 min-w-[2rem] text-center">
                              {qty}
                            </span>
                            <button
                              type="button"
                              disabled={qty >= maxStock}
                              onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
                              aria-label="Increase quantity"
                              className="p-2 text-zinc-700 hover:bg-[#F3EFE6] disabled:opacity-40 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onAddToCart(product, qty, {
                                variantId: selectedVariant?.id ?? null,
                                selectedSize: selectedVariant?.size ?? null,
                                selectedColor: selectedVariant?.color ?? null,
                              })
                            }
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-all shadow-sm"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>
                              Add {qty > 1 ? `${qty} ` : ''}to Cart — ₹
                              {(effectivePrice * qty).toLocaleString('en-IN')}
                            </span>
                          </button>
                        </div>
                        {cartQuantity > 0 && (
                          <p className="text-[11px] text-[#254B3B] font-medium">
                            Currently {cartQuantity} in your shopping cart.
                          </p>
                        )}
                      </div>
                    )
                  ) : (
                    <div
                      data-testid="restock-notification-panel"
                      className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 space-y-3"
                    >
                      <div className="flex items-start gap-2">
                        <Bell className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-950">
                            Out of Stock — Notify Me When Available
                          </h4>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Subscribe below to be alerted when{' '}
                            <strong>
                              {product.name}
                              {selectedVariant ? ` (${selectedVariant.label})` : ''}
                            </strong>{' '}
                            is restocked.
                          </p>
                        </div>
                      </div>

                      {restockSuccessMsg ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                          <span>{restockSuccessMsg}</span>
                        </div>
                      ) : (
                        <form onSubmit={handleSubscribeRestock} className="space-y-2.5">
                          {restockError && (
                            <p className="text-xs text-rose-700 font-medium">{restockError}</p>
                          )}
                          <input
                            type="email"
                            required
                            value={restockEmail}
                            onChange={(e) => setRestockEmail(e.target.value)}
                            placeholder="Enter your email address"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-amber-300 text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                          />
                          <label className="flex items-center gap-2 text-[11px] text-amber-900 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={restockConsent}
                              onChange={(e) => setRestockConsent(e.target.checked)}
                              className="rounded border-amber-400 text-[#254B3B]"
                            />
                            <span>
                              I consent to receive a one-time restock alert for this product/variant.
                            </span>
                          </label>
                          <button
                            type="submit"
                            disabled={restockLoading || !restockConsent}
                            className="w-full py-2 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                          >
                            {restockLoading ? 'Subscribing...' : 'Notify Me When Available'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Compare action button */}
                  <button
                    type="button"
                    onClick={() => onToggleCompare(product)}
                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all border ${
                      isCompared
                        ? 'bg-zinc-900 border-zinc-900 text-white'
                        : 'bg-white hover:bg-[#F3EFE6] text-zinc-800 border-[#E6E1D6]'
                    }`}
                  >
                    {isCompared ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Added to Comparison Tray</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add to Side-by-Side Comparison</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Cross-Website Price Comparison & Purchase Links Panel */}
              <div ref={priceSectionRef}>
                <PriceComparisonPanel
                  productId={product.id}
                  autoFocus={focusPriceComparison}
                />
              </div>

              {/* Use Cases & Key Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {product.use_cases && product.use_cases.length > 0 && (
                  <div className="p-4 rounded-xl bg-white border border-[#E6E1D6] space-y-2">
                    <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#254B3B]" />
                      Recommended For
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.use_cases.map((uc, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-md bg-[#FAF8F5] border border-[#E6E1D6] text-[11px] text-zinc-700 capitalize font-medium"
                        >
                          {uc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {product.features && product.features.length > 0 && (
                  <div className="p-4 rounded-xl bg-white border border-[#E6E1D6] space-y-2">
                    <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-700" />
                      Key Highlights
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.features.map((feat, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-md bg-[#FAF8F5] border border-[#E6E1D6] text-[11px] text-zinc-700 font-medium"
                        >
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Specifications Table */}
              {product.specifications && Object.keys(product.specifications).length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    Verified Technical Specifications
                  </h3>
                  <div className="border border-[#E6E1D6] rounded-xl overflow-hidden divide-y divide-[#E6E1D6] text-xs bg-white">
                    {Object.entries(product.specifications).map(([key, val]) => (
                      <div
                        key={key}
                        className="grid grid-cols-2 p-3 hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-zinc-600 capitalize font-medium">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-zinc-900 font-mono text-right sm:text-left font-medium">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Reviews & Ratings Section (Phase 8) */}
              <div
                data-testid="product-reviews-section"
                className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E1D6] pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#254B3B]" />
                    <h3 className="text-sm font-bold text-zinc-900">
                      Customer Reviews &amp; Verified Ratings
                    </h3>
                    {reviewSummary && (
                      <span className="text-xs text-zinc-500">
                        ({reviewSummary.totalPublishedCount} customer review
                        {reviewSummary.totalPublishedCount === 1 ? '' : 's'})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Sort customer reviews"
                      value={reviewSortBy}
                      onChange={(e) =>
                        setReviewSortBy(e.target.value as 'newest' | 'highest' | 'lowest')
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-800"
                    >
                      <option value="newest">Most Recent</option>
                      <option value="highest">Highest Rated</option>
                      <option value="lowest">Lowest Rated</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowReviewForm((prev) => !prev)}
                      className="px-3 py-1.5 rounded-lg bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors"
                    >
                      {showReviewForm ? 'Cancel' : 'Write a Review'}
                    </button>
                  </div>
                </div>

                {reviewSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <span>{reviewSuccessMsg}</span>
                  </div>
                )}

                {/* Write a Review Form */}
                {showReviewForm && (
                  <form
                    onSubmit={handleSubmitReview}
                    className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-3 text-xs"
                  >
                    <h4 className="font-bold text-zinc-900">
                      Submit Your Product Review
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      A &quot;Verified Purchase&quot; badge is automatically granted if our server confirms this item in your completed orders.
                    </p>

                    {reviewFormError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                        {reviewFormError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={reviewAuthor}
                          onChange={(e) => setReviewAuthor(e.target.value)}
                          placeholder="e.g. Aarav S."
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                          Star Rating (1–5) *
                        </label>
                        <select
                          value={reviewRating}
                          onChange={(e) => setReviewRating(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6]"
                        >
                          <option value={5}>★★★★★ (5 - Excellent)</option>
                          <option value={4}>★★★★☆ (4 - Very Good)</option>
                          <option value={3}>★★★☆☆ (3 - Good)</option>
                          <option value={2}>★★☆☆☆ (2 - Fair)</option>
                          <option value={1}>★☆☆☆☆ (1 - Poor)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                          Review Title
                        </label>
                        <input
                          type="text"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          placeholder="Brief summary of your experience"
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6]"
                        />
                      </div>
                    </div>

                    {isClothingOrFootwear && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                            Sizing &amp; Fit Accuracy
                          </label>
                          <select
                            value={reviewFit}
                            onChange={(e) => setReviewFit(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6]"
                          >
                            <option value="">Select fit...</option>
                            <option value="True to Size">True to Size</option>
                            <option value="Runs Small">Runs Small</option>
                            <option value="Runs Large">Runs Large</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                            Comfort / Material Feel
                          </label>
                          <input
                            type="text"
                            value={reviewComfort}
                            onChange={(e) => setReviewComfort(e.target.value)}
                            placeholder="e.g. Breathable & comfortable for daily wear"
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6]"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Written Review *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share what you liked or disliked about this product..."
                        className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6E1D6]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="px-4 py-2 rounded-lg bg-[#254B3B] hover:bg-[#1C3A2E] text-white font-semibold"
                    >
                      {reviewSubmitting ? 'Publishing Review...' : 'Publish Review'}
                    </button>
                  </form>
                )}

                {/* Reviews List */}
                {reviewSummary && reviewSummary.reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviewSummary.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-1.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900">{rev.authorName}</span>
                            <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
                              {'★'.repeat(rev.rating)}
                              {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                            </span>
                            {rev.isVerifiedPurchase && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                                <Award className="w-3 h-3 text-emerald-700" />
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500">
                            {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {rev.title && (
                          <p className="font-semibold text-zinc-900">{rev.title}</p>
                        )}
                        <p className="text-zinc-700 leading-relaxed">{rev.comment}</p>

                        {rev.categoryAttributes &&
                          Object.keys(rev.categoryAttributes).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Object.entries(rev.categoryAttributes).map(([k, v]) =>
                                v ? (
                                  <span
                                    key={k}
                                    className="px-2 py-0.5 rounded bg-white border border-[#E6E1D6] text-[10px] text-zinc-700"
                                  >
                                    <strong>{k}:</strong> {v}
                                  </span>
                                ) : null
                              )}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">
                    No customer reviews have been submitted during this session yet. Be the first to review {product.name}!
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
