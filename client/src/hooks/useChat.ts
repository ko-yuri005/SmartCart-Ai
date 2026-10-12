import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CartSummaryDTO,
  ChatMessage,
  ExtractedRequirements,
  Product,
  ScoredProduct,
  VisualSearchCorrectionInput,
  VisualSearchResponseDTO,
} from '../types/shopping';
import {
  sendChatMessage,
  fetchChatHistory,
  resetChatSession,
  fetchProductById,
  visualSearchApi,
} from '../api/client';

export const SESSION_STORAGE_KEY = 'shopping_assistant_session_id';

export function getOrInitSessionId(): string {
  const existing = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

export function useChat(options?: {
  onCartUpdated?: (cart: CartSummaryDTO) => void;
}) {
  const [sessionId, setSessionId] = useState<string>(() => getOrInitSessionId());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentProducts, setCurrentProducts] = useState<(Product | ScoredProduct)[]>([]);
  const [activeRequirements, setActiveRequirements] = useState<
    Partial<ExtractedRequirements> | undefined
  >();
  const [isRelaxedMatch, setIsRelaxedMatch] = useState(false);
  const [relaxedExplanation, setRelaxedExplanation] = useState<string | undefined>();
  const [lastVisualSearch, setLastVisualSearch] = useState<VisualSearchResponseDTO | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const msgCounterRef = useRef(0);
  const sessionEpochRef = useRef(0);
  const onCartUpdatedRef = useRef(options?.onCartUpdated);
  onCartUpdatedRef.current = options?.onCartUpdated;

  // Restore conversation history and active product cards on page reload
  useEffect(() => {
    const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedSessionId) return;

    const epochAtStart = sessionEpochRef.current;

    fetchChatHistory(savedSessionId)
      .then(async (history) => {
        if (sessionEpochRef.current !== epochAtStart) return;

        if (history.messages && history.messages.length > 0) {
          const formatted: ChatMessage[] = history.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
            activeRequirements: m.extracted_requirements,
          }));

          setMessages(formatted);

          // Find the last assistant message with requirements
          const reversedAssistant = [...history.messages]
            .reverse()
            .filter((m) => m.role === 'assistant');

          const lastWithReqs = reversedAssistant.find((m) => m.extracted_requirements);
          if (lastWithReqs && lastWithReqs.extracted_requirements) {
            setActiveRequirements(lastWithReqs.extracted_requirements);
          }

          // Restore active product cards from the most recent assistant message
          const lastWithProducts = reversedAssistant.find(
            (m) =>
              (m.recommended_product_ids && m.recommended_product_ids.length > 0) ||
              (m.extracted_requirements?.referenced_product_ids &&
                m.extracted_requirements.referenced_product_ids.length > 0)
          );
          if (lastWithProducts) {
            const focusedIds =
              lastWithProducts.extracted_requirements?.referenced_product_ids || [];
            const recIds = lastWithProducts.recommended_product_ids || [];
            const idsToLoad =
              focusedIds.length === 1 &&
              (lastWithProducts.extracted_requirements?.intent === 'PRODUCT_DETAILS' ||
                lastWithProducts.extracted_requirements?.intent === 'QUESTION_ON_PREVIOUS')
                ? focusedIds
                : recIds.length > 0
                  ? recIds
                  : focusedIds;

            if (idsToLoad.length > 0) {
              const loaded = await Promise.all(
                idsToLoad.slice(0, 6).map((id) => fetchProductById(id).catch(() => null))
              );
              if (sessionEpochRef.current !== epochAtStart) return;
              const validProducts = loaded.filter((p): p is Product => p !== null);
              if (validProducts.length > 0) {
                setCurrentProducts(validProducts);
              }
            }
          }
        }
      })
      .catch(() => {
        // Fresh session if not yet saved in DB
      });
  }, []);

  // Send message handler (synchronously guarded so suggestion clicks submit once)
  const sendMessage = useCallback(
    async (text: string) => {
      const cleanText = text.trim();
      if (!cleanText || isLoading || inFlightRef.current) return;

      inFlightRef.current = true;
      const turnSeq = ++msgCounterRef.current;
      const epochAtStart = sessionEpochRef.current;

      const userMsg: ChatMessage = {
        id: `client_user_${Date.now()}_${turnSeq}`,
        role: 'user',
        content: cleanText,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await sendChatMessage(cleanText, sessionId);
        if (sessionEpochRef.current !== epochAtStart) return;

        if (response.sessionId) {
          setSessionId(response.sessionId);
          localStorage.setItem(SESSION_STORAGE_KEY, response.sessionId);
        }

        if (response.cart && onCartUpdatedRef.current) {
          onCartUpdatedRef.current(response.cart);
        } else if (response.cartAction?.cart && onCartUpdatedRef.current) {
          onCartUpdatedRef.current(response.cartAction.cart);
        }

        const assistantMsg: ChatMessage = {
          id: `client_asst_${Date.now()}_${turnSeq}`,
          role: 'assistant',
          content: response.message,
          products: response.products,
          scoredProducts: response.scoredProducts,
          targetProduct: response.targetProduct,
          comparison: response.comparison,
          alternatives: response.alternatives,
          priceComparison: response.priceComparison,
          priceComparisons: response.priceComparisons,
          cartAction: response.cartAction,
          offerProductRequestForm: response.offerProductRequestForm,
          offerRestockNotification: response.offerRestockNotification,
          activeRequirements: response.activeRequirements,
          intent: response.intent,
          isRelaxedMatch: response.isRelaxedMatch,
          relaxedExplanation: response.relaxedExplanation,
          suggestions: response.suggestions,
          diagnostics: response.diagnostics,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (response.products && response.products.length > 0) {
          setCurrentProducts(response.scoredProducts || response.products);
        } else if (response.targetProduct) {
          setCurrentProducts([response.targetProduct]);
        } else if (response.comparison && response.comparison.products) {
          setCurrentProducts(response.comparison.products);
        } else if (response.alternatives && response.alternatives.alternatives) {
          setCurrentProducts(response.alternatives.alternatives.map((a) => a.product));
        }

        if (response.activeRequirements) {
          setActiveRequirements(response.activeRequirements);
        }

        setIsRelaxedMatch(Boolean(response.isRelaxedMatch));
        setRelaxedExplanation(response.relaxedExplanation);
      } catch (err) {
        if (sessionEpochRef.current !== epochAtStart) return;
        const errMsg = err instanceof Error ? err.message : 'Failed to send message';
        setError(errMsg);

        setMessages((prev) => [
          ...prev,
          {
            id: `client_err_${Date.now()}_${turnSeq}`,
            role: 'assistant',
            content: `I encountered an issue connecting to the shopping service (${errMsg}). Please check your connection or try again.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        if (sessionEpochRef.current === epochAtStart) {
          inFlightRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [isLoading, sessionId]
  );

  // Send visual product search (image upload or user correction)
  const sendVisualSearch = useCallback(
    async (params: {
      imageData?: string;
      mimeType?: string;
      fileName?: string;
      userHint?: string;
      previewUrl?: string;
      correction?: VisualSearchCorrectionInput;
    }) => {
      if (isLoading || inFlightRef.current) return;

      inFlightRef.current = true;
      const turnSeq = ++msgCounterRef.current;
      const epochAtStart = sessionEpochRef.current;

      const userSummary = params.correction
        ? `Refined visual search: ${[params.correction.brand, params.correction.model, params.correction.category, params.correction.keywords].filter(Boolean).join(' • ')}`
        : `Uploaded product photo${params.fileName ? ` (${params.fileName})` : ''}${params.userHint ? ` — "${params.userHint}"` : ''}`;

      const userMsg: ChatMessage = {
        id: `client_vis_user_${Date.now()}_${turnSeq}`,
        role: 'user',
        content: userSummary,
        uploadedImagePreviewUrl: params.previewUrl,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await visualSearchApi({
          sessionId,
          imageData: params.imageData,
          mimeType: params.mimeType,
          fileName: params.fileName,
          userHint: params.userHint,
          correction: params.correction,
        });
        if (sessionEpochRef.current !== epochAtStart) return;

        if (response.sessionId) {
          setSessionId(response.sessionId);
          localStorage.setItem(SESSION_STORAGE_KEY, response.sessionId);
        }

        setLastVisualSearch(response);

        const assistantMsg: ChatMessage = {
          id: `client_vis_asst_${Date.now()}_${turnSeq}`,
          role: 'assistant',
          content: response.classificationSummary,
          products: response.products,
          visualSearch: response,
          suggestions: response.suggestions,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (response.products && response.products.length > 0) {
          setCurrentProducts(response.products);
        }

        setActiveRequirements({
          category: response.clues.category,
          brand: response.clues.brand,
        });
        setIsRelaxedMatch(response.overallClassification === 'relevant_alternative');
        setRelaxedExplanation(
          response.overallClassification === 'relevant_alternative'
            ? response.classificationSummary
            : undefined
        );
      } catch (err) {
        if (sessionEpochRef.current !== epochAtStart) return;
        const errMsg =
          err instanceof Error ? err.message : 'Failed to analyze uploaded image';
        setError(errMsg);
        setMessages((prev) => [
          ...prev,
          {
            id: `client_vis_err_${Date.now()}_${turnSeq}`,
            role: 'assistant',
            content: `**Visual Search Notice:** ${errMsg}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        if (sessionEpochRef.current === epochAtStart) {
          inFlightRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [isLoading, sessionId]
  );

  // Reset conversation handler
  const reset = useCallback(async () => {
    sessionEpochRef.current += 1;
    inFlightRef.current = false;
    setIsLoading(false);
    setMessages([]);
    setCurrentProducts([]);
    setActiveRequirements(undefined);
    setIsRelaxedMatch(false);
    setRelaxedExplanation(undefined);
    setLastVisualSearch(null);
    setError(null);

    if (sessionId) {
      try {
        await resetChatSession(sessionId);
      } catch (err) {
        console.warn('[useChat] Failed to reset backend session:', err);
      }
    }
  }, [sessionId]);

  return {
    messages,
    currentProducts,
    activeRequirements,
    isRelaxedMatch,
    relaxedExplanation,
    lastVisualSearch,
    isLoading,
    error,
    sessionId,
    sendMessage,
    sendVisualSearch,
    reset,
  };
}
