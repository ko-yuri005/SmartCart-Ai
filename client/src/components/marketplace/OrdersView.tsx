import React, { useState, useEffect } from 'react';
import { OrderDTO, OrderStatus } from '../../types/shopping';
import { ProductImage } from '../common/ProductImage';
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  ShieldAlert,
  MapPin,
  Store,
  ChevronRight,
} from 'lucide-react';

interface OrdersViewProps {
  orders: OrderDTO[];
  initialSelectedOrderId?: string | null;
  onUpdateStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  onNavigateShop: () => void;
}

const ORDER_STEPS: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
];

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  initialSelectedOrderId,
  onUpdateStatus,
  onNavigateShop,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialSelectedOrderId || (orders.length > 0 ? orders[0].id : null)
  );

  useEffect(() => {
    if (initialSelectedOrderId) {
      setSelectedOrderId(initialSelectedOrderId);
    } else if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
    }
  }, [initialSelectedOrderId, orders]);

  const activeOrder =
    orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Confirmed':
      case 'Processing':
        return {
          className: 'bg-[#DCE7D9] text-[#254B3B] border-[#C5D7C0]',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#254B3B]" />,
        };
      case 'Shipped':
        return {
          className: 'bg-sky-50 text-sky-800 border-sky-200',
          icon: <Truck className="w-3.5 h-3.5 text-sky-700" />,
        };
      case 'Delivered':
        return {
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />,
        };
      case 'Cancelled':
        return {
          className: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-700" />,
        };
      case 'Pending':
      default:
        return {
          className: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: <Clock className="w-3.5 h-3.5 text-amber-700" />,
        };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F5]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#DCE7D9] border border-[#C5D7C0] flex items-center justify-center text-[#254B3B]">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900">
                Order History &amp; Tracking ({orders.length})
              </h1>
              <p className="text-xs text-zinc-500">
                Inspect order confirmations, item breakdowns, and live status progression
              </p>
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white border border-[#E6E1D6] text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-center text-[#254B3B] mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-zinc-900">No Orders Placed Yet</h2>
              <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                Once you complete a demo checkout from your shopping cart, your order confirmation and status timeline will appear here.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateShop}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Store className="w-4 h-4" />
              <span>Start Shopping</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Order History List */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 px-1">
                Recent Orders ({orders.length})
              </h2>
              <div className="space-y-2.5">
                {orders.map((ord) => {
                  const isSelected = activeOrder?.id === ord.id;
                  const badge = getStatusBadge(ord.status);
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-white border-[#254B3B] ring-2 ring-[#DCE7D9] shadow-sm'
                          : 'bg-white hover:bg-[#FAF8F5] border-[#E6E1D6]'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900 font-mono">
                            {ord.id}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}
                          >
                            {badge.icon}
                            <span>{ord.status}</span>
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 truncate">
                          {ord.totalQuantity} item(s) • Placed{' '}
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-sm font-bold text-zinc-900">
                          ₹{ord.pricing.finalTotal.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 flex-shrink-0 ${
                          isSelected ? 'text-[#254B3B]' : 'text-zinc-400'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 2 Columns: Active Order Detail View */}
            {activeOrder && (
              <div
                data-testid="order-detail-panel"
                className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white border border-[#E6E1D6] space-y-6 shadow-sm"
              >
                {/* Demo Order Notice */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-950">Demo Order Confirmation</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {activeOrder.demoDisclaimer}
                    </p>
                  </div>
                </div>

                {/* Order Header & Interactive Status Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E1D6]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-zinc-900 font-mono">
                        {activeOrder.id}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          getStatusBadge(activeOrder.status).className
                        }`}
                      >
                        {getStatusBadge(activeOrder.status).icon}
                        <span>{activeOrder.status}</span>
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Customer: <strong>{activeOrder.customerName}</strong> (
                      {activeOrder.customerEmail}) • Payment: {activeOrder.paymentMethod}
                    </p>
                  </div>

                  {/* Demo Order Lifecycle Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeOrder.status === 'Confirmed' && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStatus(
                            activeOrder.id,
                            'Processing',
                            'Order is being packed and prepared for dispatch (Demo)'
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-[#DCE7D9] hover:bg-[#C5D7C0] border border-[#C5D7C0] text-[#254B3B] text-xs font-semibold transition-colors"
                      >
                        Simulate Processing →
                      </button>
                    )}
                    {(activeOrder.status === 'Confirmed' ||
                      activeOrder.status === 'Processing') && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStatus(
                            activeOrder.id,
                            'Shipped',
                            'Dispatched via express courier (Demo)'
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors"
                      >
                        Simulate Shipped →
                      </button>
                    )}
                    {activeOrder.status === 'Shipped' && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStatus(
                            activeOrder.id,
                            'Delivered',
                            'Package delivered to customer address (Demo)'
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors"
                      >
                        Simulate Delivered ✓
                      </button>
                    )}
                    {activeOrder.status !== 'Cancelled' &&
                      activeOrder.status !== 'Delivered' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateStatus(
                              activeOrder.id,
                              'Cancelled',
                              'Cancelled by customer (stock restored)'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors"
                        >
                          Cancel Order
                        </button>
                      )}
                  </div>
                </div>

                {/* Visual Order Status Progress Bar */}
                {activeOrder.status !== 'Cancelled' && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {ORDER_STEPS.map((step, idx) => {
                      const currentIdx = ORDER_STEPS.indexOf(activeOrder.status);
                      const completed = idx <= currentIdx;
                      return (
                        <div
                          key={step}
                          className={`p-2.5 rounded-xl border text-center text-xs font-semibold ${
                            completed
                              ? 'bg-[#DCE7D9] border-[#C5D7C0] text-[#254B3B]'
                              : 'bg-[#FAF8F5] border-[#E6E1D6] text-zinc-400'
                          }`}
                        >
                          {idx + 1}. {step}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ordered Items List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                    Ordered Items ({activeOrder.totalQuantity})
                  </h3>
                  <div className="divide-y divide-[#E6E1D6] border border-[#E6E1D6] rounded-xl overflow-hidden bg-[#FAF8F5]">
                    {activeOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 flex items-center justify-between gap-3 bg-white"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F3EFE6] border border-[#E6E1D6] flex-shrink-0">
                            <ProductImage
                              productId={item.productId}
                              src={item.image}
                              alt={item.productName}
                              category={item.category}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#254B3B]">
                                {item.brand}
                              </p>
                              {(item.variantLabel || item.selectedSize || item.selectedColor) && (
                                <span className="px-1.5 py-0.2 rounded bg-[#DCE7D9] border border-[#C5D7C0] text-[10px] font-semibold text-[#254B3B]">
                                  {item.variantLabel ||
                                    [item.selectedSize, item.selectedColor].filter(Boolean).join(' / ')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-zinc-900 truncate">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              Qty: {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                              {item.originalUnitPrice && item.originalUnitPrice > item.unitPrice && (
                                <span className="line-through text-zinc-400 ml-1.5">
                                  ₹{item.originalUnitPrice.toLocaleString('en-IN')}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-zinc-900 flex-shrink-0">
                          ₹{item.lineTotal.toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Address & Pricing Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                      <MapPin className="w-3.5 h-3.5 text-[#254B3B]" />
                      <span>Delivery Address</span>
                    </div>
                    <p className="font-semibold text-zinc-800">{activeOrder.customerName}</p>
                    <p className="text-zinc-600">{activeOrder.shippingAddress.line1}</p>
                    {activeOrder.shippingAddress.line2 && (
                      <p className="text-zinc-600">{activeOrder.shippingAddress.line2}</p>
                    )}
                    <p className="text-zinc-600">
                      {activeOrder.shippingAddress.city}, {activeOrder.shippingAddress.state}{' '}
                      — {activeOrder.shippingAddress.postalCode}
                    </p>
                    <p className="text-zinc-500">Phone: {activeOrder.customerPhone}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-2 text-xs">
                    <h4 className="font-bold text-zinc-900">Server-Verified Order Total</h4>
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal</span>
                      <span>₹{activeOrder.pricing.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {activeOrder.pricing.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>
                          Discount{' '}
                          {activeOrder.pricing.couponCode
                            ? `(${activeOrder.pricing.couponCode})`
                            : ''}
                        </span>
                        <span>
                          −₹{activeOrder.pricing.discountAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-zinc-600">
                      <span>Shipping</span>
                      <span>
                        {activeOrder.pricing.shippingCost === 0
                          ? 'FREE'
                          : `₹${activeOrder.pricing.shippingCost.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[#E6E1D6] flex justify-between font-bold text-sm text-zinc-900">
                      <span>Total</span>
                      <span>₹{activeOrder.pricing.finalTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Status Audit Timeline */}
                <div className="space-y-2 pt-2 border-t border-[#E6E1D6]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                    Order Status Timeline
                  </h4>
                  <div className="space-y-2">
                    {activeOrder.statusHistory.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 text-xs p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6]"
                      >
                        <div>
                          <span className="font-bold text-zinc-900">{entry.status}</span>
                          <span className="text-zinc-600 ml-2">— {entry.note}</span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono flex-shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
