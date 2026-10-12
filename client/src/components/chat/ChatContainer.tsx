import React, { useRef, useEffect, useState } from 'react';
import {
  ChatMessage,
  ExtractedRequirements,
  VisualSearchCorrectionInput,
} from '../../types/shopping';
import { MessageItem } from './MessageItem';
import { FilterBadges } from './FilterBadges';
import { Sparkles, Bot, Loader2, RotateCcw } from 'lucide-react';

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  activeRequirements?: Partial<ExtractedRequirements>;
  onSelectSuggestion: (suggestion: string) => void;
  onSendStarterPrompt: (prompt: string) => void;
  onRefineVisualSearch?: (correction: VisualSearchCorrectionInput) => void;
  onOpenCart?: () => void;
  onResetChat?: () => void;
  sessionId?: string;
  userEmail?: string;
}

const STARTER_PROMPTS = [
  'Find organic products under ₹1,000',
  'Suggest comfortable shoes for daily walking',
  'Wireless headphones under ₹3,000 for gym',
  'Bike under 1.5 lakh for daily commuting',
  'Office chair under ₹10,000',
  'Best sunscreen for oily skin under ₹800',
  'Black hoodie under ₹1,500',
  'Pressure cooker for a family of 4',
];

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isLoading,
  activeRequirements,
  onSelectSuggestion,
  onSendStarterPrompt,
  onRefineVisualSearch,
  onOpenCart,
  onResetChat,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (messages.length === 0 && !isLoading) {
      setIsConfirmingReset(false);
    }
  }, [messages.length, isLoading]);

  const handleNewChatClick = () => {
    if (messages.length > 0 || isLoading) {
      setIsConfirmingReset(true);
    } else {
      setIsConfirmingReset(false);
      onResetChat?.();
    }
  };

  const handleConfirmReset = () => {
    setIsConfirmingReset(false);
    onResetChat?.();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF8F5]">
      {/* Chat Header with Status & New Chat Action */}
      <div
        data-testid="chat-header"
        className="px-4 py-2.5 bg-white border-b border-[#E6E1D6] flex items-center justify-between gap-2 flex-shrink-0"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#254B3B] text-[#E6BE65] flex items-center justify-center shadow-sm flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-serif font-bold text-zinc-900 truncate">
                Ask SmartCart AI
              </h2>
              <span
                className={`${
                  isConfirmingReset ? 'hidden md:inline-flex' : 'inline-flex'
                } items-center gap-1 px-2 py-0.5 rounded-full bg-[#DCE7D9]/60 border border-[#254B3B]/20 text-[10px] font-semibold text-[#254B3B] flex-shrink-0`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {isLoading ? 'Thinking...' : 'Ready'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 truncate hidden sm:block">
              Shop Smarter. Choose Better. • Grounded in verified catalogue products
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isConfirmingReset ? (
            <div
              data-testid="new-chat-confirm-bar"
              className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#C76F4A]/40 rounded-xl px-2.5 py-1 shadow-sm"
            >
              <span className="text-[11px] font-medium text-zinc-800 whitespace-nowrap">
                <span className="hidden sm:inline">Start a new chat?</span>
                <span className="sm:hidden">New chat?</span>
              </span>
              <button
                type="button"
                data-testid="confirm-new-chat-btn"
                onClick={handleConfirmReset}
                className="px-2 py-0.5 rounded-lg bg-[#254B3B] hover:bg-[#1d3d2f] text-white text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear chat
              </button>
              <button
                type="button"
                data-testid="cancel-new-chat-btn"
                onClick={() => setIsConfirmingReset(false)}
                className="px-2 py-0.5 rounded-lg bg-white hover:bg-zinc-100 border border-[#E6E1D6] text-zinc-600 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="new-chat-btn"
              onClick={handleNewChatClick}
              title="Clear current conversation and start a fresh chat"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#DCE7D9]/50 border border-[#E6E1D6] hover:border-[#254B3B]/40 text-xs font-semibold text-[#254B3B] transition-all shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#254B3B]" />
              <span>New Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Active filters badge row */}
      <FilterBadges requirements={activeRequirements} />

      {/* Message scroll container */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E6E1D6]/70">
        {messages.length === 0 ? (
          <div className="p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-6 my-auto min-h-[350px]">
            <div className="w-12 h-12 rounded-2xl bg-[#DCE7D9] border border-[#254B3B]/20 flex items-center justify-center text-[#254B3B] shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h2 className="text-lg font-serif font-bold text-zinc-900 tracking-tight">
                SmartCart AI Concierge
              </h2>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Shop Smarter. Choose Better. Ask for tailored product recommendations by budget or use case, upload a product photo for visual discovery, compare options side-by-side, or ask me to add items directly to your cart.
              </p>
            </div>

            {/* Starter Prompts */}
            <div className="w-full max-w-lg space-y-2 pt-2">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block text-left">
                Try asking:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendStarterPrompt(prompt)}
                    className="p-3 rounded-xl bg-white hover:bg-[#DCE7D9]/30 border border-[#E6E1D6] hover:border-[#254B3B]/30 text-xs text-zinc-800 hover:text-zinc-950 text-left transition-all flex items-center justify-between group shadow-sm"
                  >
                    <span className="line-clamp-1">{prompt}</span>
                    <span className="text-zinc-400 group-hover:text-[#254B3B] transition-colors ml-2">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, idx) => (
            <MessageItem
              key={message.id || idx}
              message={message}
              onRefineVisualSearch={onRefineVisualSearch}
              onOpenCart={onOpenCart}
            />
          ))
        )}

        {/* Loading bubble */}
        {isLoading && (
          <div className="flex gap-3 px-4 py-4 bg-white animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-[#DCE7D9] border border-[#254B3B]/20 flex items-center justify-center text-[#254B3B] flex-shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none text-[#254B3B]" />
              <span>Analyzing request &amp; querying verified catalogue...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Separate follow-up suggestion chips bar (outside chat message prose) */}
      {!isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'assistant' &&
        messages[messages.length - 1].suggestions &&
        messages[messages.length - 1].suggestions!.length > 0 && (
          <div
            data-testid="followup-suggestions-bar"
            aria-label="Suggested follow-up questions"
            className="px-4 py-2.5 bg-white border-t border-[#E6E1D6] flex flex-wrap items-center gap-1.5"
          >
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mr-1 select-none">
              Suggested:
            </span>
            {messages[messages.length - 1].suggestions!.map((suggestion, idx) => (
              <button
                key={`${idx}-${suggestion}`}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectSuggestion(suggestion)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DCE7D9]/50 hover:bg-[#DCE7D9] disabled:opacity-50 disabled:pointer-events-none border border-[#254B3B]/20 hover:border-[#254B3B]/40 text-xs text-[#254B3B] font-medium transition-colors cursor-pointer text-left"
              >
                <Sparkles className="w-3 h-3 text-[#254B3B] flex-shrink-0" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  );
};
