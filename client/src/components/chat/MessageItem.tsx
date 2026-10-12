import React, { useState } from 'react';
import {
  ChatMessage,
  VisualSearchCorrectionInput,
} from '../../types/shopping';
import { MarkdownView } from '../common/MarkdownView';
import {
  subscribeRestockApi,
  submitProductRequestApi,
} from '../../api/client';
import { getOrInitSessionId } from '../../hooks/useChat';
import {
  Bot,
  User,
  ShoppingCart,
  CheckCircle2,
  Camera,
  AlertTriangle,
  SlidersHorizontal,
  Search,
  Bell,
  Link2,
} from 'lucide-react';

interface MessageItemProps {
  message: ChatMessage;
  onRefineVisualSearch?: (correction: VisualSearchCorrectionInput) => void;
  onOpenCart?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onRefineVisualSearch,
  onOpenCart,
}) => {
  const isUser = message.role === 'user';
  const vis = message.visualSearch;

  const [showCorrectionForm, setShowCorrectionForm] = useState(
    Boolean(
      vis &&
        (vis.overallClassification === 'no_match' ||
          vis.clues.imageQuality !== 'clear')
    )
  );
  const [brandInput, setBrandInput] = useState(vis?.clues.brand || '');
  const [modelInput, setModelInput] = useState(vis?.clues.model || '');
  const [categoryInput, setCategoryInput] = useState(vis?.clues.category || '');
  const [keywordsInput, setKeywordsInput] = useState('');

  // Inline Restock Notification state (Phase 10)
  const [restockEmail, setRestockEmail] = useState('');
  const [restockConsent, setRestockConsent] = useState(true);
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockResultMsg, setRestockResultMsg] = useState<string | null>(null);
  const [restockError, setRestockError] = useState<string | null>(null);

  // Inline Missing-Product Request state (Phase 9 & 10) — collapsed by default
  const [isReqFormExpanded, setIsReqFormExpanded] = useState(false);
  const [reqUrl, setReqUrl] = useState('');
  const [reqName, setReqName] = useState(
    message.offerProductRequestForm?.suggestedName || ''
  );
  const [reqNotes, setReqNotes] = useState('');
  const [reqVariant, setReqVariant] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqConsent, setReqConsent] = useState(true);
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqResultMsg, setReqResultMsg] = useState<string | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  const handleCorrectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRefineVisualSearch) return;
    onRefineVisualSearch({
      brand: brandInput.trim() || undefined,
      model: modelInput.trim() || undefined,
      category: categoryInput.trim() || undefined,
      keywords: keywordsInput.trim() || undefined,
    });
  };

  const handleInlineRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.offerRestockNotification) return;
    setRestockSubmitting(true);
    setRestockError(null);
    setRestockResultMsg(null);
    try {
      const sub = await subscribeRestockApi({
        productId: message.offerRestockNotification.productId,
        variantId: message.offerRestockNotification.variantId ?? null,
        sessionId: getOrInitSessionId(),
        email: restockEmail.trim(),
        consentGiven: restockConsent,
      });
      setRestockResultMsg(sub.statusMessage);
    } catch (err) {
      setRestockError(
        err instanceof Error ? err.message : 'Failed to subscribe to restock alert'
      );
    } finally {
      setRestockSubmitting(false);
    }
  };

  const handleInlineProductRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqSubmitting(true);
    setReqError(null);
    setReqResultMsg(null);
    try {
      const created = await submitProductRequestApi({
        sourceUrl: reqUrl.trim() || undefined,
        requestedName:
          reqName.trim() ||
          message.offerProductRequestForm?.suggestedName ||
          undefined,
        categoryHint: message.offerProductRequestForm?.suggestedCategory,
        descriptionNotes: reqNotes.trim() || undefined,
        desiredVariant: reqVariant.trim() || undefined,
        sessionId: getOrInitSessionId(),
        contactEmail: reqEmail.trim(),
        consentGiven: reqConsent,
      });
      setReqResultMsg(created.confirmationMessage);
    } catch (err) {
      setReqError(
        err instanceof Error ? err.message : 'Could not submit product request'
      );
    } finally {
      setReqSubmitting(false);
    }
  };

  const getClassificationBadge = (
    cls: NonNullable<ChatMessage['visualSearch']>['overallClassification']
  ) => {
    switch (cls) {
      case 'confirmed_exact_match':
        return {
          label: 'Confirmed Exact Match',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'likely_match':
        return {
          label: 'Likely Product Match',
          className: 'bg-[#DCE7D9]/50 text-[#254B3B] border-[#254B3B]/20',
        };
      case 'relevant_alternative':
        return {
          label: 'Relevant Catalogue Alternatives',
          className: 'bg-amber-50 text-amber-900 border-amber-200',
        };
      case 'no_match':
      default:
        return {
          label: 'No Direct Match — Correct Clues Below',
          className: 'bg-rose-50 text-rose-800 border-rose-200',
        };
    }
  };

  return (
    <div
      data-testid={isUser ? 'chat-message-user' : 'chat-message-assistant'}
      className={`flex gap-3 px-4 sm:px-5 py-4 transition-colors ${
        isUser ? 'bg-[#FAF8F5]' : 'bg-white'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold ${
          isUser
            ? 'bg-[#F3EFE6] text-zinc-800 border border-[#E6E1D6]'
            : 'bg-[#254B3B] text-white shadow-sm'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-900">
            {isUser ? 'You' : 'SmartCart AI Concierge'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* User Uploaded Image Preview */}
        {isUser && message.uploadedImagePreviewUrl && (
          <div className="inline-block rounded-xl overflow-hidden border border-[#E6E1D6] bg-white p-1.5 shadow-sm">
            <img
              src={message.uploadedImagePreviewUrl}
              alt="Uploaded product for visual discovery"
              className="max-h-36 w-auto rounded-lg object-contain"
            />
          </div>
        )}

        {isUser ? (
          <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <MarkdownView content={message.content} />
        )}

        {/* Cart Action Confirmation Card (Phase 5 & 12) */}
        {!isUser && message.cartAction && message.cartAction.action === 'added' && (
          <div
            data-testid="chat-cart-action-card"
            className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              <span>
                Added <strong>{message.cartAction.quantity || 1}×</strong>{' '}
                <strong>{message.cartAction.product?.name}</strong>
                {message.cartAction.variant
                  ? ` (${message.cartAction.variant.label})`
                  : ''}{' '}
                to your cart.
                {message.cartAction.cart && (
                  <>
                    {' '}
                    Cart total:{' '}
                    <strong>
                      ₹{message.cartAction.cart.pricing.finalTotal.toLocaleString('en-IN')}
                    </strong>
                  </>
                )}
              </span>
            </div>
            {onOpenCart && (
              <button
                type="button"
                onClick={onOpenCart}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-colors flex-shrink-0"
              >
                <ShoppingCart className="w-3 h-3" />
                <span>View Cart</span>
              </button>
            )}
          </div>
        )}

        {/* Inline Out-of-Stock Restock Notification Card (Phase 10) */}
        {!isUser && message.offerRestockNotification && (
          <div
            data-testid="chat-restock-notification-card"
            className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2.5 text-xs"
          >
            <div className="flex items-center gap-2 font-semibold text-amber-950">
              <Bell className="w-3.5 h-3.5 text-amber-700" />
              <span>
                Notify Me When Back in Stock:{' '}
                {message.offerRestockNotification.productName}
                {message.offerRestockNotification.variantLabel
                  ? ` (${message.offerRestockNotification.variantLabel})`
                  : ''}
              </span>
            </div>

            {restockResultMsg ? (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <span>{restockResultMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleInlineRestockSubmit} className="space-y-2">
                {restockError && (
                  <p className="text-rose-700 font-medium">{restockError}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    required
                    value={restockEmail}
                    onChange={(e) => setRestockEmail(e.target.value)}
                    placeholder="Enter your email for restock alert..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-zinc-900"
                  />
                  <button
                    type="submit"
                    disabled={restockSubmitting || !restockConsent}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold"
                  >
                    {restockSubmitting ? 'Subscribing...' : 'Notify Me'}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockConsent}
                    onChange={(e) => setRestockConsent(e.target.checked)}
                    className="rounded border-amber-400"
                  />
                  <span>I consent to receive a restock alert for this item.</span>
                </label>
              </form>
            )}
          </div>
        )}

        {/* Inline Missing-Product Request Card (Phase 9) — Collapsed by default */}
        {!isUser && message.offerProductRequestForm && (
          <div
            data-testid="chat-product-request-card"
            className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-zinc-800">
                <Link2 className="w-3.5 h-3.5 text-[#254B3B] flex-shrink-0" />
                <span className="font-medium">
                  Want us to add{' '}
                  <strong>
                    {message.offerProductRequestForm.suggestedName || 'this item'}
                  </strong>{' '}
                  to the SmartCart AI catalogue?
                </span>
              </div>
              {!reqResultMsg && (
                <button
                  type="button"
                  data-testid="toggle-product-request-form-btn"
                  onClick={() => setIsReqFormExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#254B3B] hover:bg-[#1d3d2f] text-white text-xs font-semibold transition-colors shadow-sm"
                >
                  <span>
                    {isReqFormExpanded ? 'Hide request form' : 'Request this product'}
                  </span>
                </button>
              )}
            </div>

            {reqResultMsg ? (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <span>{reqResultMsg}</span>
              </div>
            ) : isReqFormExpanded ? (
              <form
                onSubmit={handleInlineProductRequestSubmit}
                className="space-y-2 pt-2 border-t border-[#E6E1D6]"
              >
                <p className="text-[11px] text-zinc-600">
                  Submit a catalogue request below. Product name is prefilled from your search, and a public product URL is optional:
                </p>
                {reqError && (
                  <p className="text-rose-700 font-medium">{reqError}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="Product Name / Model *"
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-zinc-900"
                  />
                  <input
                    type="url"
                    value={reqUrl}
                    onChange={(e) => setReqUrl(e.target.value)}
                    placeholder="Optional Public Product URL (https://...)"
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-zinc-900"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={reqVariant}
                    onChange={(e) => setReqVariant(e.target.value)}
                    placeholder="Optional Variant / Size / Colour"
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-zinc-900"
                  />
                  <input
                    type="text"
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    placeholder="Optional Notes / Target Price"
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-zinc-900"
                  />
                  <input
                    type="email"
                    required
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="Your Contact Email *"
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-zinc-900"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 text-[11px] text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reqConsent}
                      onChange={(e) => setReqConsent(e.target.checked)}
                      className="rounded border-zinc-400"
                    />
                    <span>I consent to have this request saved in the request log for review.</span>
                  </label>
                  <button
                    type="submit"
                    disabled={reqSubmitting || !reqConsent}
                    className="px-3.5 py-1.5 rounded-lg bg-[#254B3B] hover:bg-[#1d3d2f] disabled:opacity-50 text-white font-semibold flex-shrink-0"
                  >
                    {reqSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        )}

        {/* Visual Search Clues & Interactive Correction Card (Phase 3) */}
        {!isUser && vis && (
          <div
            data-testid="visual-search-clues-card"
            className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-[#254B3B]" />
                <span className="font-semibold text-zinc-900">
                  Visual Product Identification
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    getClassificationBadge(vis.overallClassification).className
                  }`}
                >
                  {getClassificationBadge(vis.overallClassification).label}
                </span>
              </div>

              {onRefineVisualSearch && (
                <button
                  type="button"
                  onClick={() => setShowCorrectionForm((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F3EFE6] border border-[#E6E1D6] text-[11px] font-medium text-[#254B3B] transition-colors"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>{showCorrectionForm ? 'Hide Correction' : 'Correct Brand / Model'}</span>
                </button>
              )}
            </div>

            {/* Extracted Clue Chips */}
            <div className="flex flex-wrap gap-1.5">
              {vis.clues.brand && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#E6E1D6] text-zinc-800 text-[11px]">
                  Brand: <strong>{vis.clues.brand}</strong>
                </span>
              )}
              {vis.clues.model && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#E6E1D6] text-zinc-800 text-[11px]">
                  Model: <strong>{vis.clues.model}</strong>
                </span>
              )}
              {vis.clues.category && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#E6E1D6] text-zinc-800 text-[11px] capitalize">
                  Category: <strong>{vis.clues.category.replace(/-/g, ' ')}</strong>
                </span>
              )}
              {vis.clues.color && (
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#E6E1D6] text-zinc-800 text-[11px] capitalize">
                  Color: <strong>{vis.clues.color}</strong>
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#E6E1D6] text-zinc-600 text-[11px]">
                Confidence: {Math.round(vis.clues.confidence * 100)}%
              </span>
            </div>

            {/* Quality Warning (Blurry / Multiple Products / Unrecognizable) */}
            {vis.clues.qualityWarning && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                <span>{vis.clues.qualityWarning}</span>
              </div>
            )}

            {/* User Correction Form */}
            {showCorrectionForm && onRefineVisualSearch && (
              <form
                onSubmit={handleCorrectionSubmit}
                className="pt-2 border-t border-[#E6E1D6] space-y-2"
              >
                <p className="text-[11px] text-zinc-600 font-medium">
                  Correct the identified brand, model, or category to re-search our catalogue:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={brandInput}
                    onChange={(e) => setBrandInput(e.target.value)}
                    placeholder="Brand (e.g. Sony, boAt, Nike)"
                    aria-label="Correct product brand"
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                  />
                  <input
                    type="text"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    placeholder="Model (e.g. WH-CH720N, Airdopes 141)"
                    aria-label="Correct product model"
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                  />
                  <input
                    type="text"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    placeholder="Category (e.g. headphones, footwear)"
                    aria-label="Correct product category"
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="Optional keywords (e.g. wireless, black, ANC)"
                    aria-label="Additional keywords"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#254B3B] hover:bg-[#1d3d2f] text-white text-xs font-semibold transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Re-search</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Subtle execution diagnostics */}
        {!isUser && message.diagnostics && (
          <div className="pt-1 flex items-center gap-2 text-[10px] text-zinc-500 font-mono select-none">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  message.diagnostics.explanationSource === 'gemini'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              {message.diagnostics.explanationSource === 'gemini'
                ? `${message.diagnostics.model || 'Gemini 2.5 Flash'} • ${message.diagnostics.durationMs}ms`
                : `Verified Catalogue Engine • ${message.diagnostics.durationMs}ms`}
            </span>
            {message.diagnostics.productsConsidered > 0 && (
              <span>
                • {message.diagnostics.productsSelected} of {message.diagnostics.productsConsidered} matched
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
