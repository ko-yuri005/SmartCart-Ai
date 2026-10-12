import React, { useState, useEffect, useCallback } from 'react';
import { Header, MarketplaceView } from './components/layout/Header';
import { ChatContainer } from './components/chat/ChatContainer';
import { ChatInput } from './components/chat/ChatInput';
import { ProductGrid } from './components/products/ProductGrid';
import { ProductDetailsModal } from './components/products/ProductDetailsModal';
import { ComparisonDrawer } from './components/comparison/ComparisonDrawer';
import { HomeView } from './components/marketplace/HomeView';
import { ShopView } from './components/marketplace/ShopView';
import { CompareView } from './components/marketplace/CompareView';
import { CartView } from './components/marketplace/CartView';
import { OrdersView } from './components/marketplace/OrdersView';
import { AccountView } from './components/marketplace/AccountView';
import { AdminDashboardView } from './components/marketplace/AdminDashboardView';
import { useChat, getOrInitSessionId } from './hooks/useChat';
import { useComparison } from './hooks/useComparison';
import { useCartAndOrders } from './hooks/useCartAndOrders';
import {
  fetchHealth,
  fetchProducts,
  fetchProductsMeta,
} from './api/client';
import { Product } from './types/shopping';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<MarketplaceView>('home');
  const [productCount, setProductCount] = useState<number | undefined>();
  const [catalogueProducts, setCatalogueProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [shopFilterCategory, setShopFilterCategory] = useState<string>('');
  const [shopFilterSearch, setShopFilterSearch] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [focusPriceComparison, setFocusPriceComparison] = useState<boolean>(false);
  const [activeAssistantMobileTab, setActiveAssistantMobileTab] = useState<
    'chat' | 'products'
  >('chat');
  const [chatResetKey, setChatResetKey] = useState(0);

  const initialSessionId = getOrInitSessionId();

  const {
    cart,
    orders,
    account,
    authUser,
    isCartLoading,
    isCheckoutLoading,
    cartToast,
    dismissToast,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    submitCheckout,
    changeOrderStatus,
    saveAccount,
    handleAuthSuccess,
    handleLogout,
    syncCartFromChat,
    getProductQuantityInCart,
  } = useCartAndOrders(initialSessionId);

  const {
    messages,
    currentProducts,
    activeRequirements,
    isRelaxedMatch,
    relaxedExplanation,
    isLoading,
    error,
    sendMessage,
    sendVisualSearch,
    reset,
  } = useChat({
    onCartUpdated: syncCartFromChat,
  });

  const handleResetChat = useCallback(() => {
    reset();
    setChatResetKey((prev) => prev + 1);
    setActiveAssistantMobileTab('chat');
  }, [reset]);

  const {
    selectedProducts,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    toggleProduct,
    removeProduct,
    clearComparison,
    isCompared,
    maxWarning,
  } = useComparison();

  const loadCatalogue = useCallback(() => {
    fetchProducts({ limit: 500 })
      .then((res) => {
        setCatalogueProducts(res.products || []);
        setProductCount(res.count || res.products?.length);
      })
      .catch(() => {
        // Fallback to health check
      });

    fetchProductsMeta()
      .then((meta) => {
        setCategories(meta.categories || []);
        setBrands(meta.brands || []);
        if (meta.totalProducts) setProductCount(meta.totalProducts);
      })
      .catch(() => {});

    fetchHealth()
      .then((data) => {
        setProductCount(data.database.productCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  const handleAddProductToCart = useCallback(
    (
      product: Product,
      quantity: number = 1,
      options?: {
        variantId?: string | null;
        selectedSize?: string | null;
        selectedColor?: string | null;
      }
    ) => {
      addToCart(product.id, quantity, product.name, options);
    },
    [addToCart]
  );

  const handleAskAssistantFromOtherView = useCallback(
    (prompt: string) => {
      setActiveView('assistant');
      sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleNavigateShopWithFilters = useCallback(
    (params?: { category?: string; search?: string }) => {
      setShopFilterCategory(params?.category || '');
      setShopFilterSearch(params?.search || '');
      setActiveView('shop');
    },
    []
  );

  return (
    <div className="h-screen flex flex-col bg-[#FAF8F5] text-zinc-900 overflow-hidden font-sans">
      {/* Global Header */}
      <Header
        activeView={activeView}
        onNavigate={setActiveView}
        productCount={productCount}
        comparisonCount={selectedProducts.length}
        cartCount={cart?.totalQuantity || 0}
        orderCount={orders.length}
        authUser={authUser}
        onOpenComparison={openDrawer}
        onResetSession={reset}
      />

      {/* Cart / Order Action Toast */}
      {cartToast && (
        <div
          role="status"
          className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
            cartToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 max-w-[1440px] mx-auto w-full justify-between">
            <div className="flex items-center gap-2">
              {cartToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0" />
              )}
              <span>{cartToast.message}</span>
            </div>
            <div className="flex items-center gap-3">
              {cartToast.type === 'success' && activeView !== 'cart' && (
                <button
                  type="button"
                  onClick={() => {
                    dismissToast();
                    setActiveView('cart');
                  }}
                  className="underline font-bold text-emerald-800 hover:text-emerald-950"
                >
                  Open Cart ({cart?.totalQuantity || 0})
                </button>
              )}
              <button
                type="button"
                onClick={dismissToast}
                aria-label="Dismiss notification"
                className="text-zinc-500 hover:text-zinc-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Toasts (e.g. max 4 products compared) */}
      {maxWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>{maxWarning}</span>
        </div>
      )}

      {/* Error alert if chat request failed */}
      {error && activeView === 'assistant' && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-[11px] underline text-rose-800 hover:text-rose-950 font-semibold"
          >
            Reload Page
          </button>
        </div>
      )}

      {/* View Switcher */}
      {activeView === 'home' && (
        <HomeView
          products={catalogueProducts}
          categories={categories}
          onNavigateShop={handleNavigateShopWithFilters}
          onAskAssistant={handleAskAssistantFromOtherView}
          onOpenVisualSearch={() => setActiveView('assistant')}
          onViewDetails={(prod) => {
            setFocusPriceComparison(false);
            setSelectedProduct(prod);
          }}
          onComparePrices={(prod) => {
            setFocusPriceComparison(true);
            setSelectedProduct(prod);
          }}
          onToggleCompare={toggleProduct}
          comparedProductIds={selectedProducts.map((p) => p.id)}
          onAddToCart={(prod) => handleAddProductToCart(prod, 1)}
          getCartQuantity={getProductQuantityInCart}
        />
      )}

      {activeView === 'shop' && (
        <ShopView
          products={catalogueProducts}
          categories={categories}
          brands={brands}
          initialCategory={shopFilterCategory}
          initialSearch={shopFilterSearch}
          onViewDetails={(prod) => {
            setFocusPriceComparison(false);
            setSelectedProduct(prod);
          }}
          onComparePrices={(prod) => {
            setFocusPriceComparison(true);
            setSelectedProduct(prod);
          }}
          onToggleCompare={toggleProduct}
          comparedProductIds={selectedProducts.map((p) => p.id)}
          onAddToCart={(prod) => handleAddProductToCart(prod, 1)}
          getCartQuantity={getProductQuantityInCart}
          onAskAssistant={handleAskAssistantFromOtherView}
        />
      )}

      {activeView === 'compare' && (
        <CompareView
          allProducts={catalogueProducts}
          selectedProducts={selectedProducts}
          onToggleCompare={toggleProduct}
          onRemoveProduct={removeProduct}
          onClearComparison={clearComparison}
          onAddToCart={(prod) => handleAddProductToCart(prod, 1)}
          getCartQuantity={getProductQuantityInCart}
          defaultPriority={account?.preferences.priorityPreference}
        />
      )}

      {activeView === 'cart' && (
        <CartView
          cart={cart}
          account={account}
          isLoading={isCartLoading}
          isCheckoutLoading={isCheckoutLoading}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
          onApplyCoupon={applyCoupon}
          onCheckout={submitCheckout}
          onOrderCreated={(order) => {
            loadCatalogue();
            setSelectedOrderId(order.id);
            setActiveView('orders');
          }}
          onNavigateShop={() => setActiveView('shop')}
          onViewProduct={(prod) => {
            setFocusPriceComparison(false);
            setSelectedProduct(prod);
          }}
        />
      )}

      {activeView === 'orders' && (
        <OrdersView
          orders={orders}
          initialSelectedOrderId={selectedOrderId}
          onUpdateStatus={(orderId, status, note) => {
            changeOrderStatus(orderId, status, note).then(() => {
              loadCatalogue();
            });
          }}
          onNavigateShop={() => setActiveView('shop')}
        />
      )}

      {activeView === 'account' && (
        <AccountView
          sessionId={initialSessionId}
          authUser={authUser}
          account={account}
          categories={categories}
          onAuthSuccess={(res) => handleAuthSuccess(res.user, res.mergedCart)}
          onLogout={handleLogout}
          onOpenAdminDashboard={() => setActiveView('admin')}
          onSaveAccount={saveAccount}
        />
      )}

      {activeView === 'admin' && (
        <AdminDashboardView
          sessionId={initialSessionId}
          authUser={authUser}
          categories={categories}
          onAuthSuccess={(res) => handleAuthSuccess(res.user, res.mergedCart)}
          onCatalogueChanged={loadCatalogue}
        />
      )}

      {activeView === 'assistant' && (
        <>
          {/* Mobile Tab Switcher inside AI Assistant View */}
          <div className="lg:hidden flex border-b border-[#E6E1D6] bg-white px-2 py-1.5 gap-2">
            <button
              type="button"
              onClick={() => setActiveAssistantMobileTab('chat')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeAssistantMobileTab === 'chat'
                  ? 'bg-[#254B3B] text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Conversation ({messages.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveAssistantMobileTab('products')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeAssistantMobileTab === 'products'
                  ? 'bg-[#254B3B] text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <span>Recommended Products</span>
              {currentProducts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#DCE7D9] text-[#254B3B] text-[10px] font-bold">
                  {currentProducts.length}
                </span>
              )}
            </button>
          </div>

          {/* Main Dual-Pane AI Assistant Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane: Chat Conversation & Input (with Visual Search) */}
            <section
              className={`flex-1 flex flex-col h-full border-r border-[#E6E1D6] min-w-0 ${
                activeAssistantMobileTab === 'chat' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <ChatContainer
                messages={messages}
                isLoading={isLoading}
                activeRequirements={activeRequirements}
                onSelectSuggestion={sendMessage}
                onSendStarterPrompt={sendMessage}
                onRefineVisualSearch={(correction) => sendVisualSearch({ correction })}
                onOpenCart={() => setActiveView('cart')}
                onResetChat={handleResetChat}
                sessionId={initialSessionId}
                userEmail={authUser?.email || account?.email}
              />

              <ChatInput
                key={chatResetKey}
                onSendMessage={sendMessage}
                onSendVisualSearch={(params) => sendVisualSearch(params)}
                isLoading={isLoading}
              />
            </section>

            {/* Right Pane: Contextual Product Recommendations */}
            <section
              className={`w-full lg:w-[48%] xl:w-[44%] h-full overflow-y-auto bg-[#F3EFE6]/50 flex flex-col ${
                activeAssistantMobileTab === 'products' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <ProductGrid
                products={currentProducts}
                isLoading={isLoading}
                isRelaxedMatch={isRelaxedMatch}
                relaxedExplanation={relaxedExplanation}
                onViewDetails={(prod) => {
                  setFocusPriceComparison(false);
                  setSelectedProduct(prod);
                }}
                onComparePrices={(prod) => {
                  setFocusPriceComparison(true);
                  setSelectedProduct(prod);
                }}
                onToggleCompare={toggleProduct}
                comparedProductIds={selectedProducts.map((p) => p.id)}
                onAddToCart={(prod) => handleAddProductToCart(prod, 1)}
                getCartQuantity={getProductQuantityInCart}
              />
            </section>
          </div>
        </>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal
          productId={selectedProduct.id}
          focusPriceComparison={focusPriceComparison}
          onClose={() => {
            setSelectedProduct(null);
            setFocusPriceComparison(false);
          }}
          onToggleCompare={toggleProduct}
          isCompared={isCompared(selectedProduct.id)}
          onAddToCart={(prod, qty, options) =>
            handleAddProductToCart(prod, qty, options)
          }
          cartQuantity={getProductQuantityInCart(selectedProduct.id)}
          sessionId={initialSessionId}
          userEmail={authUser?.email || account?.email}
          userName={authUser?.fullName || account?.fullName}
        />
      )}

      {/* Quick Comparison Drawer */}
      <ComparisonDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        selectedProducts={selectedProducts}
        onRemoveProduct={removeProduct}
        onClearComparison={clearComparison}
        onAddToCart={(prod) => handleAddProductToCart(prod, 1)}
        getCartQuantity={getProductQuantityInCart}
      />
    </div>
  );
};

export default App;

