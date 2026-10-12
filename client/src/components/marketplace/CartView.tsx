import React, { useState, useEffect } from 'react';
import {
  AccountProfileDTO,
  CartSummaryDTO,
  CheckoutInput,
  OrderDTO,
  Product,
} from '../../types/shopping';
import { ProductImage } from '../common/ProductImage';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Tag,
  Truck,
  ShieldAlert,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Store,
} from 'lucide-react';

interface CartViewProps {
  cart: CartSummaryDTO | null;
  account: AccountProfileDTO | null;
  isLoading: boolean;
  isCheckoutLoading: boolean;
  onUpdateQuantity: (
    productId: string,
    quantity: number,
    variantId?: string | null
  ) => void;
  onRemoveItem: (productId: string, variantId?: string | null) => void;
  onClearCart: () => void;
  onApplyCoupon: (code: string | null) => void;
  onCheckout: (input: Omit<CheckoutInput, 'sessionId'>) => Promise<OrderDTO | null>;
  onOrderCreated: (order: OrderDTO) => void;
  onNavigateShop: () => void;
  onViewProduct: (product: Product) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  account,
  isLoading,
  isCheckoutLoading,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onApplyCoupon,
  onCheckout,
  onOrderCreated,
  onNavigateShop,
  onViewProduct,
}) => {
  const [couponInput, setCouponInput] = useState(cart?.pricing.couponCode || '');
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Checkout fields
  const [customerName, setCustomerName] = useState(account?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState(account?.email || '');
  const [customerPhone, setCustomerPhone] = useState(account?.phone || '');
  const [line1, setLine1] = useState(account?.defaultAddress?.line1 || '');
  const [line2, setLine2] = useState(account?.defaultAddress?.line2 || '');
  const [city, setCity] = useState(account?.defaultAddress?.city || '');
  const [state, setState] = useState(account?.defaultAddress?.state || '');
  const [postalCode, setPostalCode] = useState(account?.defaultAddress?.postalCode || '');
  const [paymentMethod, setPaymentMethod] = useState('UPI (Demo)');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  );

  // Sync default account details when loaded
  useEffect(() => {
    if (account) {
      if (!customerName && account.fullName) setCustomerName(account.fullName);
      if (!customerEmail && account.email) setCustomerEmail(account.email);
      if (!customerPhone && account.phone) setCustomerPhone(account.phone);
      if (account.defaultAddress) {
        if (!line1 && account.defaultAddress.line1) setLine1(account.defaultAddress.line1);
        if (!line2 && account.defaultAddress.line2) setLine2(account.defaultAddress.line2);
        if (!city && account.defaultAddress.city) setCity(account.defaultAddress.city);
        if (!state && account.defaultAddress.state) setState(account.defaultAddress.state);
        if (!postalCode && account.defaultAddress.postalCode) {
          setPostalCode(account.defaultAddress.postalCode);
        }
      }
    }
  }, [account]);

  const handleCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyCoupon(couponInput.trim() || null);
  };

  const handlePlaceDemoOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    try {
      const order = await onCheckout({
        idempotencyKey,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress: {
          line1,
          line2: line2 || undefined,
          city,
          state,
          postalCode,
          country: 'India',
        },
        paymentMethod,
        couponCode: cart?.pricing.couponCode || undefined,
        notes: notes || undefined,
      });

      if (order) {
        // Generate fresh idempotencyKey for next order
        setIdempotencyKey(`idem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
        onOrderCreated(order);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Checkout validation failed'
      );
    }
  };

  const items = cart?.items || [];
  const pricing = cart?.pricing;

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F5]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#DCE7D9] border border-[#C5D7C0] flex items-center justify-center text-[#254B3B]">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900">
                Shopping Cart &amp; Checkout ({cart?.totalQuantity || 0} items)
              </h1>
              <p className="text-xs text-zinc-500">
                Server-validated inventory, discounts, and shipping calculations
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              disabled={isLoading}
              onClick={onClearCart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-[#E6E1D6] hover:border-rose-200 text-xs font-semibold text-zinc-700 hover:text-rose-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white border border-[#E6E1D6] text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-center text-[#254B3B] mx-auto">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-zinc-900">Your Shopping Cart is Empty</h2>
              <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                Add products from the Shop, comparison view, or ask our AI Assistant to add recommendations directly to your cart.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateShop}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Store className="w-4 h-4" />
              <span>Browse Catalogue Shop</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2 Columns: Cart Items + Checkout Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Free Shipping Progress Banner */}
              {pricing && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E1D6] flex items-center justify-between gap-3 text-xs shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-[#254B3B] flex-shrink-0" />
                    {pricing.amountNeededForFreeShipping === 0 ? (
                      <span className="font-semibold text-emerald-800">
                        You have unlocked FREE Standard Delivery on this order!
                      </span>
                    ) : (
                      <span className="text-zinc-700">
                        Add{' '}
                        <strong className="text-zinc-900">
                          ₹{pricing.amountNeededForFreeShipping.toLocaleString('en-IN')}
                        </strong>{' '}
                        more for <strong>FREE Shipping</strong> (Free on orders ≥ ₹999).
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Cart Items List */}
              <div className="rounded-2xl bg-white border border-[#E6E1D6] divide-y divide-[#E6E1D6] overflow-hidden shadow-sm">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF8F5]/60 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onViewProduct(item.product)}
                        className="w-20 h-20 rounded-xl overflow-hidden bg-[#F3EFE6] border border-[#E6E1D6] flex-shrink-0"
                      >
                        <ProductImage
                          productId={item.product.id}
                          src={item.product.image}
                          alt={item.product.name}
                          category={item.product.category}
                          productType={item.product.product_type}
                          className="w-full h-full"
                        />
                      </button>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#254B3B]">
                            {item.product.brand}
                          </span>
                          {(item.variantLabel || item.selectedSize || item.selectedColor) && (
                            <span className="px-2 py-0.5 rounded-md bg-[#DCE7D9] border border-[#C5D7C0] text-[10px] font-semibold text-[#254B3B]">
                              {item.variantLabel ||
                                [item.selectedSize, item.selectedColor].filter(Boolean).join(' / ')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onViewProduct(item.product)}
                          className="block text-left text-sm font-semibold text-zinc-900 hover:text-[#254B3B] truncate max-w-md"
                        >
                          {item.product.name}
                        </button>
                        <p className="text-xs text-zinc-500 flex items-center gap-1.5 flex-wrap">
                          <span>Unit Price: ₹{item.unitPrice.toLocaleString('en-IN')}</span>
                          {item.originalUnitPrice && item.originalUnitPrice > item.unitPrice && (
                            <span className="line-through text-zinc-400">
                              ₹{item.originalUnitPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                          <span>• Max Stock: {item.maxAvailableStock}</span>
                        </p>
                      </div>
                    </div>

                    {/* Quantity Controls & Line Total */}
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="flex items-center border border-[#E6E1D6] rounded-xl bg-[#FAF8F5] overflow-hidden">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            onUpdateQuantity(
                              item.productId,
                              item.quantity - 1,
                              item.variantId
                            )
                          }
                          aria-label={`Decrease quantity of ${item.product.name}`}
                          className="p-2 text-zinc-700 hover:bg-[#E6E1D6] disabled:opacity-40 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span
                          data-testid={`cart-item-qty-${item.productId}`}
                          className="px-3 text-xs font-bold text-zinc-900 min-w-[2.2rem] text-center"
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={isLoading || item.quantity >= item.maxAvailableStock}
                          onClick={() =>
                            onUpdateQuantity(
                              item.productId,
                              item.quantity + 1,
                              item.variantId
                            )
                          }
                          aria-label={`Increase quantity of ${item.product.name}`}
                          className="p-2 text-zinc-700 hover:bg-[#E6E1D6] disabled:opacity-40 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right min-w-[90px]">
                        <div className="text-sm font-bold text-zinc-900">
                          ₹{item.lineTotal.toLocaleString('en-IN')}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId, item.variantId)}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Checkout Customer & Delivery Form */}
              {showCheckoutForm && (
                <form
                  onSubmit={handlePlaceDemoOrder}
                  data-testid="checkout-form"
                  className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E6E1D6] space-y-5 shadow-sm"
                >
                  {/* Explicit Demo Checkout Disclaimer Banner */}
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950">
                        Demo Checkout Mode — No Real Payment Processed
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        This order will be validated and recorded in our local SQLite database with inventory tracking, but no real financial charge or shipment will occur.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-zinc-900">
                      Customer &amp; Delivery Address
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('Aarav Sharma');
                        setCustomerEmail('aarav.sharma@example.com');
                        setCustomerPhone('+91 9876543210');
                        setLine1('42 Indiranagar 100 Feet Road');
                        setLine2('Near Metro Station');
                        setCity('Bengaluru');
                        setState('Karnataka');
                        setPostalCode('560038');
                      }}
                      className="text-xs font-semibold text-[#254B3B] hover:text-[#1C3A2E] underline"
                    >
                      Auto-fill Demo Address
                    </button>
                  </div>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                      {checkoutError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Aarav Sharma"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="aarav@example.com"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Street Address Line 1 *
                      </label>
                      <input
                        type="text"
                        required
                        value={line1}
                        onChange={(e) => setLine1(e.target.value)}
                        placeholder="House/Flat No., Building, Street"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Landmark / Area (Optional)
                      </label>
                      <input
                        type="text"
                        value={line2}
                        onChange={(e) => setLine2(e.target.value)}
                        placeholder="Apartment, Suite, or Landmark"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Bengaluru"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        State *
                      </label>
                      <input
                        type="text"
                        required
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="Karnataka"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        PIN Code (6 digits) *
                      </label>
                      <input
                        type="text"
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="560038"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Payment Method (Simulated Demo)
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      >
                        <option value="UPI (Demo)">UPI — Google Pay / PhonePe (Demo)</option>
                        <option value="Card (Demo)">Credit / Debit Card (Demo)</option>
                        <option value="Cash on Delivery (Demo)">
                          Cash on Delivery (Demo)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Delivery Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Leave at security desk..."
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E6E1D6]">
                    <button
                      type="button"
                      onClick={() => setShowCheckoutForm(false)}
                      className="px-4 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFE6] border border-[#E6E1D6] text-xs font-semibold text-zinc-700"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isCheckoutLoading}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-sm"
                    >
                      {isCheckoutLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Validating &amp; Creating Demo Order...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            Place Demo Order — ₹
                            {pricing?.finalTotal.toLocaleString('en-IN')}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Column: Server-Calculated Order Summary & Coupons */}
            {pricing && (
              <div className="p-5 rounded-2xl bg-white border border-[#E6E1D6] space-y-5 shadow-sm sticky top-20">
                <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Order Summary
                </h2>

                {/* Coupon Section */}
                <div className="space-y-2">
                  <form onSubmit={handleCouponSubmit} className="flex gap-2">
                    <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6]">
                      <Tag className="w-3.5 h-3.5 text-[#254B3B] flex-shrink-0" />
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Promo code (e.g. WELCOME10)"
                        aria-label="Promo code"
                        className="w-full bg-transparent text-xs text-zinc-900 uppercase placeholder-zinc-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-[#F3EFE6] hover:bg-[#E6E1D6] text-xs font-semibold text-zinc-800 transition-colors"
                    >
                      Apply
                    </button>
                  </form>

                  {/* Quick Coupon Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {['WELCOME10', 'SAVE500', 'FREESHIP', 'APPAREL15'].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setCouponInput(code);
                          onApplyCoupon(code);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          pricing.couponCode === code
                            ? 'bg-[#254B3B] border-[#254B3B] text-white'
                            : 'bg-[#FAF8F5] border-[#E6E1D6] text-zinc-700 hover:border-[#254B3B]'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                    {pricing.couponCode && (
                      <button
                        type="button"
                        onClick={() => {
                          setCouponInput('');
                          onApplyCoupon(null);
                        }}
                        className="px-2 py-0.5 rounded-md text-[10px] text-rose-700 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Price Breakdown Rows */}
                <div className="space-y-2.5 pt-3 border-t border-[#E6E1D6] text-xs">
                  {pricing.itemDiscountAmount && pricing.itemDiscountAmount > 0 ? (
                    <div className="flex justify-between text-emerald-700">
                      <span>Sale Savings on MRP</span>
                      <span className="font-semibold">
                        −₹{pricing.itemDiscountAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal ({cart.totalQuantity} items)</span>
                    <span className="font-semibold text-zinc-900">
                      ₹{pricing.subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {pricing.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>
                        Discount{' '}
                        {pricing.discountDescription
                           ? `(${pricing.discountDescription})`
                          : ''}
                      </span>
                      <span className="font-semibold">
                        −₹{pricing.discountAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-zinc-600">
                    <span>Shipping &amp; Handling</span>
                    <span className="font-semibold text-zinc-900">
                      {pricing.shippingCost === 0
                        ? 'FREE'
                        : `₹${pricing.shippingCost.toLocaleString('en-IN')}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Estimated Included GST (18%)</span>
                    <span>₹{pricing.taxIncludedEstimate.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="pt-3 border-t border-[#E6E1D6] flex justify-between items-baseline">
                    <span className="text-sm font-bold text-zinc-900">Final Total</span>
                    <span
                      data-testid="cart-final-total"
                      className="text-xl font-bold text-zinc-900"
                    >
                      ₹{pricing.finalTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {!showCheckoutForm && (
                  <button
                    type="button"
                    onClick={() => setShowCheckoutForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    <span>Proceed to Demo Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                  All prices and totals are calculated and verified on the server before order creation.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
