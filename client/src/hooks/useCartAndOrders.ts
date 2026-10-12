import { useState, useEffect, useCallback } from 'react';
import {
  AccountProfileDTO,
  CartSummaryDTO,
  CheckoutInput,
  OrderDTO,
  OrderStatus,
  UserDTO,
} from '../types/shopping';
import {
  fetchCart,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCartApi,
  applyCartCoupon,
  checkoutOrderApi,
  fetchOrders,
  updateOrderStatusApi,
  fetchAccountProfile,
  updateAccountProfile,
  fetchCurrentUserApi,
  logoutApi,
} from '../api/client';

export function useCartAndOrders(sessionId: string) {
  const [cart, setCart] = useState<CartSummaryDTO | null>(null);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [account, setAccount] = useState<AccountProfileDTO | null>(null);
  const [authUser, setAuthUser] = useState<UserDTO | null>(null);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [cartToast, setCartToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setCartToast({ type, message });
    setTimeout(() => {
      setCartToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  const refreshCartAndOrders = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [c, o, a, me] = await Promise.all([
        fetchCart(sessionId).catch(() => null),
        fetchOrders(sessionId).catch(() => []),
        fetchAccountProfile(sessionId).catch(() => null),
        fetchCurrentUserApi().catch(() => ({ user: null, csrfToken: null })),
      ]);
      if (c) setCart(c);
      setOrders(o);
      if (a) setAccount(a);
      setAuthUser(me.user || null);
    } catch {
      // Ignore initial load error
    }
  }, [sessionId]);

  useEffect(() => {
    refreshCartAndOrders();
  }, [refreshCartAndOrders]);

  const handleAuthSuccess = useCallback(
    (user: UserDTO, mergedCart?: CartSummaryDTO) => {
      setAuthUser(user);
      if (mergedCart) {
        setCart(mergedCart);
      }
      refreshCartAndOrders();
      showToast(
        'success',
        `Signed in as ${user.fullName || user.username} (${user.role}).`
      );
    },
    [refreshCartAndOrders, showToast]
  );

  const handleLogout = useCallback(async () => {
    await logoutApi();
    setAuthUser(null);
    await refreshCartAndOrders();
    showToast('success', 'Signed out.');
  }, [refreshCartAndOrders, showToast]);

  const addToCart = useCallback(
    async (
      productId: string,
      quantity: number = 1,
      productName?: string,
      variantOptions?: {
        variantId?: string | null;
        selectedSize?: string | null;
        selectedColor?: string | null;
      }
    ) => {
      if (!sessionId) return null;
      setIsCartLoading(true);
      try {
        const updated = await addCartItem(
          sessionId,
          productId,
          quantity,
          variantOptions
        );
        setCart(updated);
        const variantSuffix =
          variantOptions?.selectedSize || variantOptions?.selectedColor
            ? ` (${[variantOptions.selectedSize, variantOptions.selectedColor].filter(Boolean).join(' / ')})`
            : '';
        showToast(
          'success',
          `Added ${quantity} × ${productName || 'item'}${variantSuffix} to your cart.`
        );
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not add item to cart';
        showToast('error', msg);
        return null;
      } finally {
        setIsCartLoading(false);
      }
    },
    [sessionId, showToast]
  );

  const updateQuantity = useCallback(
    async (
      productId: string,
      quantity: number,
      variantId?: string | null
    ) => {
      if (!sessionId) return null;
      setIsCartLoading(true);
      try {
        const updated = await updateCartItemQuantity(
          sessionId,
          productId,
          quantity,
          variantId
        );
        setCart(updated);
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not update quantity';
        showToast('error', msg);
        return null;
      } finally {
        setIsCartLoading(false);
      }
    },
    [sessionId, showToast]
  );

  const removeFromCart = useCallback(
    async (productId: string, variantId?: string | null) => {
      if (!sessionId) return null;
      setIsCartLoading(true);
      try {
        const updated = await removeCartItem(sessionId, productId, variantId);
        setCart(updated);
        showToast('success', 'Item removed from cart.');
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not remove item';
        showToast('error', msg);
        return null;
      } finally {
        setIsCartLoading(false);
      }
    },
    [sessionId, showToast]
  );

  const clearCart = useCallback(async () => {
    if (!sessionId) return null;
    setIsCartLoading(true);
    try {
      const updated = await clearCartApi(sessionId);
      setCart(updated);
      showToast('success', 'Cart cleared.');
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not clear cart';
      showToast('error', msg);
      return null;
    } finally {
      setIsCartLoading(false);
    }
  }, [sessionId, showToast]);

  const applyCoupon = useCallback(
    async (couponCode: string | null) => {
      if (!sessionId) return null;
      setIsCartLoading(true);
      try {
        const updated = await applyCartCoupon(sessionId, couponCode);
        setCart(updated);
        showToast(
          'success',
          couponCode
            ? `Coupon ${couponCode.toUpperCase()} applied!`
            : 'Coupon removed.'
        );
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid coupon code';
        showToast('error', msg);
        return null;
      } finally {
        setIsCartLoading(false);
      }
    },
    [sessionId, showToast]
  );

  const submitCheckout = useCallback(
    async (input: Omit<CheckoutInput, 'sessionId'>): Promise<OrderDTO | null> => {
      if (!sessionId) return null;
      setIsCheckoutLoading(true);
      try {
        const order = await checkoutOrderApi({
          ...input,
          sessionId,
        });
        const [freshCart, freshOrders] = await Promise.all([
          fetchCart(sessionId).catch(() => null),
          fetchOrders(sessionId).catch(() => []),
        ]);
        if (freshCart) setCart(freshCart);
        setOrders(freshOrders);
        showToast('success', `Demo Order ${order.id} placed!`);
        return order;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Checkout validation failed';
        showToast('error', msg);
        throw err;
      } finally {
        setIsCheckoutLoading(false);
      }
    },
    [sessionId, showToast]
  );

  const changeOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, note?: string) => {
      if (!sessionId) return null;
      try {
        const updated = await updateOrderStatusApi(sessionId, orderId, status, note);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        showToast('success', `Order ${orderId} updated to ${status}.`);
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update order status';
        showToast('error', msg);
        return null;
      }
    },
    [sessionId, showToast]
  );

  const saveAccount = useCallback(
    async (
      profileUpdate: Parameters<typeof updateAccountProfile>[1]
    ): Promise<AccountProfileDTO | null> => {
      if (!sessionId) return null;
      try {
        const updated = await updateAccountProfile(sessionId, profileUpdate);
        setAccount(updated);
        showToast('success', 'Account profile & preferences saved.');
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save account';
        showToast('error', msg);
        return null;
      }
    },
    [sessionId, showToast]
  );

  const syncCartFromChat = useCallback(
    (updatedCart: CartSummaryDTO) => {
      setCart(updatedCart);
      showToast('success', 'Cart updated via AI Shopping Assistant.');
    },
    [showToast]
  );

  const getProductQuantityInCart = useCallback(
    (productId: string): number => {
      if (!cart) return 0;
      return cart.items
        .filter((i) => i.productId === productId)
        .reduce((sum, i) => sum + i.quantity, 0);
    },
    [cart]
  );

  return {
    cart,
    orders,
    account,
    authUser,
    setAuthUser,
    handleAuthSuccess,
    handleLogout,
    isCartLoading,
    isCheckoutLoading,
    cartToast,
    showToast,
    dismissToast: () => setCartToast(null),
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    submitCheckout,
    changeOrderStatus,
    saveAccount,
    syncCartFromChat,
    getProductQuantityInCart,
    refreshCartAndOrders,
  };
}
