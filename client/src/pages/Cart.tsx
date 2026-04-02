import React, { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ShoppingCart, Trash2, AlertCircle, Package, ChevronRight, ArrowLeft, Clock, Check, X, Phone, MapPin, CreditCard, Truck, Users, ChevronDown, Smartphone, Copy, Upload, Loader2, CheckCircle, Trophy, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SF_STATIONS as sfStations, SFPoint } from "@/lib/sfStations";
import { SF_LOCKERS } from "@/lib/sfLockers";
import { useTranslation } from "react-i18next";

const ALIPAY_QR_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";

const CONDITION_LABELS: Record<string, string> = {
  mint: "Mint",
  near_mint: "Near Mint",
  excellent: "Excellent",
  good: "Good",
  light_played: "Light Played",
  played: "Played",
  poor: "Poor",
};

// Combine stations and lockers for district list
const ALL_SF_POINTS: SFPoint[] = [
  ...sfStations.map(s => ({ ...s, type: 'station' as const })),
  ...SF_LOCKERS.map(l => ({ ...l, type: 'locker' as const })),
];
const SF_DISTRICTS = Array.from(new Set(ALL_SF_POINTS.map((s) => s.district))).sort();

type ShippingMethod = "sf_cod" | "meetup";
type PaymentMethod = "stripe" | "alipay_hk";

interface CheckoutForm {
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  // SF fields
  sfDistrict: string;
  sfStationCode: string | null;
  recipientName: string;
  recipientPhone: string;
  // Meetup
  meetupNote: string;
}

export default function Cart() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  // ── Maintenance mode check (query placed before other hooks, guard after all hooks) ──
  const { data: accessData, isLoading: accessLoading } = trpc.marketplace.getMarketplaceAccess.useQuery();
  // Parse URL params for Stripe success page
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isStripeSuccess = urlParams.get('success') === 'true';
  const stripeOrderNos = urlParams.get('orders')?.split(',').filter(Boolean) ?? [];
  const utils = trpc.useUtils();

  const { data: cartItems, isLoading } = trpc.marketplace.getMyCart.useQuery(undefined, {
    enabled: !!user,
    staleTime: 10000,
  });

  // ── Pending auction orders (shown separately in cart) ──
  const { data: pendingAuctionOrders } = trpc.marketplace.getMyPendingAuctionOrders.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30s to keep countdowns accurate
  });
  // ── Payment timeout settings (for auction countdown) ──
  const { data: timeoutSettings } = trpc.system.getTimeoutSettings.useQuery(undefined, {
    enabled: !!user,
    staleTime: 300000,
  });

  const removeFromCartMutation = trpc.marketplace.removeFromCart.useMutation({
    onSuccess: () => {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
      toast.success(t("cart.removedFromCart"));
    },
    onError: () => toast.error(t("cart.removalFailed")),
  });

  const clearCartMutation = trpc.marketplace.clearCart.useMutation({
    onSuccess: () => {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
      toast.success(t("cart.cartCleared"));
    },
  });

  const clearUnavailableMutation = trpc.marketplace.clearUnavailableCartItems.useMutation({
    onSuccess: (data) => {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
      toast.success(`已移除 ${data.removed} 件無效商品`);
    },
    onError: () => toast.error(t("cart.removalFailed")),
  });

  const [showCheckout, setShowCheckout] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({
    shippingMethod: "sf_cod",
    paymentMethod: "alipay_hk",
    sfDistrict: "",
      sfStationCode: null,
    recipientName: "",
    recipientPhone: "",
    meetupNote: "",
  });

  const filteredStations = useMemo(
    () => (form.sfDistrict ? ALL_SF_POINTS.filter((s) => s.district === form.sfDistrict) : []),
    [form.sfDistrict]
  );

  const selectedStation = useMemo(
    () => ALL_SF_POINTS.find((s) => s.code === form.sfStationCode),
    [form.sfStationCode]
  );

  const subtotal = useMemo(
    () => (cartItems ?? []).reduce((sum, item) => sum + Number(item.priceHkd), 0),
    [cartItems]
  );

  const activeItems = useMemo(
    // Items are "active" if the listing is active, OR if the buyer already has a pending_payment
    // order for this listing (meaning they checked out but haven't paid yet).
    () => (cartItems ?? []).filter((item) => item.status === "active" || item.status === "reserved" || (item as any).hasPendingOrder),
    [cartItems]
  );

  const unavailableItems = useMemo(
    () => (cartItems ?? []).filter((item) => item.status !== "active" && item.status !== "reserved" && !(item as any).hasPendingOrder),
    [cartItems]
  );

  const activeSubtotal = useMemo(
    () => activeItems.reduce((sum, item) => {
      // Use accepted offer price if available, otherwise use listing price
      const effectivePrice = item.acceptedOfferPrice ? Number(item.acceptedOfferPrice) : Number(item.priceHkd);
      return sum + effectivePrice;
    }, 0),
    [activeItems]
  );

  // Items expiring within 3 days
  const soonExpiringItems = useMemo(() => {
    const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;
    return activeItems.filter(item => item.expiresAt && new Date(item.expiresAt).getTime() < threeDaysFromNow);
  }, [activeItems]);

  // Group active items by seller for batch checkout display
  const itemsBySeller = useMemo(() => {
    const groups: Record<number, typeof activeItems> = {};
    for (const item of activeItems) {
      const sid = item.sellerId ?? 0;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(item);
    }
    return Object.entries(groups).map(([sellerId, items]) => ({ sellerId: Number(sellerId), items }));
  }, [activeItems]);

  // isEmpty must be computed before hooks that depend on it
  // Cart is empty only if both regular cart items AND pending auction orders are empty
  const isEmpty = (!cartItems || cartItems.length === 0) && (!pendingAuctionOrders || pendingAuctionOrders.length === 0);

  // Fetch watchlist for personalized recommendations (always call hooks, use enabled to control)
  const { data: watchlist } = trpc.profile.getWatchlist.useQuery(undefined, {
    enabled: !!user && isEmpty,
    staleTime: 60000,
  });
  const watchlistCardIds = useMemo(
    () => (watchlist ?? []).map((w: { card: { id: number } }) => w.card.id).slice(0, 20),
    [watchlist]
  );
  const hasWatchlist = watchlistCardIds.length > 0;

  // Fetch personalized listings (from watchlist) or recent listings as fallback
  const { data: personalizedListings } = trpc.marketplace.getListings.useQuery(
    { page: 1, pageSize: 6, sortBy: "newest", cardIds: watchlistCardIds },
    { enabled: !!user && isEmpty && hasWatchlist, staleTime: 60000 }
  );
  const { data: recentListings } = trpc.marketplace.getListings.useQuery(
    { page: 1, pageSize: 6, sortBy: "newest" },
    { enabled: isEmpty && (!user || !hasWatchlist || (personalizedListings?.listings.length === 0)), staleTime: 60000 }
  );
  // Use personalized if available, else fall back to recent
  const recommendedListings = useMemo(() => {
    if (personalizedListings && personalizedListings.listings.length > 0) return { data: personalizedListings, label: t("cart.recommendationsFromWatchlist") };
    if (recentListings && recentListings.listings.length > 0) return { data: recentListings, label: t("cart.newlyListed") };
    return null;
  }, [personalizedListings, recentListings]);

  // ── Maintenance mode guard (after all hooks) ──
  if (accessLoading) return <div className="min-h-screen flex items-center justify-center bg-[#06038D]"><div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>;
  if (accessData && !accessData.allowed) return (
    <div className="min-h-screen bg-[#06038D] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-3">{t("cart.maintenance.title")}</h1>
        <p className="text-white/70 mb-6">{t("cart.maintenance.message")}</p>
        <a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors">{t("cart.maintenance.backToHome")}</a>
      </div>
    </div>
  );
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Hero Banner */}
        <div className="relative" style={{ background: "linear-gradient(135deg, #06038D 0%, #0a06b5 100%)" }}>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
          <div className="max-w-5xl mx-auto px-4 pt-5 pb-6">
            <div className="flex items-center justify-between mb-4">
              <Link href="/">
                <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 cursor-pointer p-1" />
              </Link>
              <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                返回
              </button>
            </div>
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-white" />
              <h1 className="text-2xl font-bold text-white">{t("cart.title")}</h1>
            </div>
          </div>
        </div>
        {/* Login prompt card */}
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="rounded-2xl overflow-hidden shadow-xl">
            <div className="p-8 text-center" style={{ background: "linear-gradient(135deg, #06038D 0%, #0a06b5 100%)" }}>
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#FEDD00" }}>
                <ShoppingCart className="w-10 h-10" style={{ color: "#06038D" }} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t("cart.loginPrompt.title")}</h2>
              <p className="text-white/70 mb-6">{t("cart.loginPrompt.message")}</p>
              <Button
                className="w-full h-12 font-bold text-base rounded-xl"
                style={{ background: "#FEDD00", color: "#06038D" }}
                onClick={() => window.location.href = '/login'}
              >
                立即登入
              </Button>
              <Link href="/marketplace">
                <p className="text-white/50 text-sm mt-4 hover:text-white/80 cursor-pointer transition-colors">{t("cart.loginPrompt.browseMarketplace")}</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">載入中...</div>
      </div>
    );
  }

  // Stripe payment success page
  if (isStripeSuccess) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Hero Banner */}
        <div className="relative" style={{ background: "linear-gradient(135deg, #06038D 0%, #0a06b5 100%)" }}>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
          <div className="max-w-5xl mx-auto px-4 pt-5 pb-6">
            <div className="flex items-center justify-between mb-4">
              <Link href="/">
                <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 cursor-pointer p-1" />
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Success header */}
            <div className="px-6 py-8 text-center" style={{ background: "linear-gradient(135deg, #06038D 0%, #0a06b5 100%)" }}>
              <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">付款成功！</h2>
              <p className="text-white/80 text-sm">Stripe 信用卡付款已確認</p>
            </div>
            {/* Order numbers */}
            <div className="p-6">
              {stripeOrderNos.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700 mb-3">已建立訂單：</p>
                  {stripeOrderNos.map((orderNo) => (
                    <Link key={orderNo} href={`/orders/${orderNo}`}>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-[#06038d]/30 transition-colors cursor-pointer">
                        <div>
                          <p className="text-xs text-gray-500">訂單編號</p>
                          <p className="font-mono font-medium text-gray-800">#{orderNo}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">訂單已建立，請前往「我的訂單」查看詳情</p>
                </div>
              )}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setLocation('/profile?tab=orders')}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors"
                  style={{ backgroundColor: '#06038D' }}
                >
                  前往我的訂單
                </button>
                <button
                  onClick={() => setLocation('/marketplace')}
                  className="w-full py-3 rounded-xl text-gray-700 font-semibold text-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  繼續購物
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero Banner ── */}
      <div className="relative" style={{ background: "linear-gradient(135deg, #06038D 0%, #0a06b5 100%)" }}>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
        <div className="max-w-5xl mx-auto px-4 pt-5 pb-6">
          {/* Top row: LOGO + back button */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 cursor-pointer p-1" />
            </Link>
            <button onClick={() => setLocation("/marketplace")} className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              返回市集
            </button>
          </div>
          {/* Title row */}
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-white" />
            <h1 className="text-2xl font-bold text-white">{t("cart.title")}</h1>
            {!isEmpty && (
              <span className="text-sm text-white/60">（{(cartItems?.length ?? 0) + (pendingAuctionOrders?.length ?? 0)} 件商品）</span>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {isEmpty ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <ShoppingCart className="w-16 h-16 text-gray-200" />
            <h2 className="text-xl font-semibold text-gray-500">購物車是空的</h2>
            <p className="text-gray-400 text-sm">去市集逛逛，找到喜歡的卡牌加入購物車吧！</p>
            <Link href="/marketplace">
              <Button className="bg-[#06038D] text-white hover:bg-[#06038D]/90">
                前往市集
              </Button>
            </Link>
            {/* Recommended listings */}
            {recommendedListings && (
              <div className="w-full mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-700">{recommendedListings.label}</h3>
                  <Link href="/marketplace">
                    <span className="text-sm text-[#06038D] hover:underline cursor-pointer">查看全部 →</span>
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {recommendedListings.data.listings.map((item) => {
                    const imgs: string[] | null = (() => { try { return item.images ? JSON.parse(item.images) : null; } catch { return null; } })();
                    return (
                    <Link key={item.id} href={`/marketplace/${item.id}`}>
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                          {imgs?.[0] ? (
                            <img src={imgs[0]} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-8 h-8 text-gray-300" />
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs text-gray-600 line-clamp-2 leading-tight mb-1">{item.title}</p>
                          <p className="text-sm font-bold text-[#06038D]">HKD {parseFloat(item.priceHkd as string).toFixed(0)}</p>
                        </div>
                      </div>
                    </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Unavailable items top warning banner */}
            {unavailableItems.length > 0 && (
              <div className="lg:col-span-3 flex items-center justify-between gap-3 bg-orange-50 border border-orange-300 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-orange-700">
                    {unavailableItems.length} 件商品已下架或售出，請移除後再結帳
                  </span>
                </div>
                <button
                  onClick={() => clearUnavailableMutation.mutate()}
                  disabled={clearUnavailableMutation.isPending}
                  className="text-xs text-orange-600 hover:text-orange-800 font-medium whitespace-nowrap flex items-center gap-1 border border-orange-300 rounded-lg px-2.5 py-1.5 bg-white hover:bg-orange-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  一鍵清理
                </button>
              </div>
            )}
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Available items */}
              {activeItems.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <span className="font-semibold text-gray-700 text-sm">可購買商品（{activeItems.length}）</span>
                    <button
                      onClick={() => clearCartMutation.mutate()}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      清空購物車
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {activeItems.map((item) => (
                      <CartItemRow
                        key={item.cartItemId}
                        item={item}
                        onRemove={() => removeFromCartMutation.mutate({ listingId: item.listingId })}
                        removing={removeFromCartMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Soon expiring warning */}
              {soonExpiringItems.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-700">
                    <span className="font-semibold">{soonExpiringItems.length} 件商品即將到期：</span>
                    {soonExpiringItems.map(item => {
                      const daysLeft = Math.ceil((new Date(item.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return <span key={item.cartItemId} className="block text-xs mt-0.5">{item.title.slice(0, 30)}... 剩餘 {daysLeft} 天</span>;
                    })}
                  </div>
                </div>
              )}

              {/* ── Pending Auction Orders ── */}
              {pendingAuctionOrders && pendingAuctionOrders.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-yellow-100 bg-gradient-to-r from-yellow-50 to-amber-50">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-amber-800 text-sm">拍賣得標待付款（{pendingAuctionOrders.length}）</span>
                    <span className="text-xs text-amber-600 ml-1">— 請在時限內完成付款</span>
                  </div>
                  <div className="divide-y divide-yellow-50">
                    {pendingAuctionOrders.map((order) => (
                      <AuctionOrderRow
                        key={order.orderId}
                        order={order}
                        paymentTimeoutMinutes={timeoutSettings?.paymentTimeoutMinutes ?? 1440}
                        onPaymentSuccess={() => {
                          utils.marketplace.getMyPendingAuctionOrders.invalidate();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Unavailable items */}
              {unavailableItems.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-red-50 bg-red-50/50">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="font-semibold text-red-600 text-sm">已下架商品（{unavailableItems.length}）</span>
                    </div>
                    <button
                      onClick={() => clearUnavailableMutation.mutate()}
                      disabled={clearUnavailableMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      一鍵清理
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {unavailableItems.map((item) => (
                      <CartItemRow
                        key={item.cartItemId}
                        item={item}
                        onRemove={() => removeFromCartMutation.mutate({ listingId: item.listingId })}
                        removing={removeFromCartMutation.isPending}
                        unavailable
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-24">
                <h2 className="font-bold text-gray-800 mb-4">訂單資訊</h2>
                <div className="space-y-2 text-sm">
                  {activeItems.length > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>市集商品（{activeItems.length} 件）</span>
                      <span>HK${activeSubtotal.toFixed(0)}</span>
                    </div>
                  )}
                  {pendingAuctionOrders && pendingAuctionOrders.length > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>🏆 拍賣得標（{pendingAuctionOrders.length} 件）</span>
                      <span>HK${pendingAuctionOrders.reduce((s, o) => s + parseFloat(String(o.subtotalHkd)), 0).toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>{t("cart.shippingFee")}</span>
                    <span className="text-green-600">{t("cart.shippingFeeValue")}</span>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between font-bold text-base text-[#06038D]">
                  <span>{t("cart.total")}</span>
                  <span>HK${(activeSubtotal + (pendingAuctionOrders ?? []).reduce((s, o) => s + parseFloat(String(o.subtotalHkd)), 0)).toFixed(0)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t("cart.totalDisclaimer")}</p>

                <div className="mt-4 space-y-2">
                  <button
                    className="w-full h-9 rounded-md text-sm font-bold bg-[#06038D] text-white hover:bg-[#06038D]/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-all"
                    style={{ border: 'none', outline: 'none' }}
                    disabled={activeItems.length === 0 && (!pendingAuctionOrders || pendingAuctionOrders.length === 0)}
                    onClick={() => setShowCheckout(true)}
                  >
                    前往結帳
                  </button>
                  <button
                    className="w-full h-9 rounded-md text-sm font-semibold bg-white text-[#06038D] hover:bg-[#06038D]/5 cursor-pointer transition-all"
                    style={{ border: 'none', outline: 'none', boxShadow: 'inset 0 0 0 1px #06038D' }}
                    onClick={() => setLocation("/marketplace")}
                  >
                    繼續購物
                  </button>
                </div>

                {unavailableItems.length > 0 && (
                  <p className="text-xs text-red-400 mt-2 text-center">
                    已下架商品不會納入結帳
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        form={form}
        setForm={setForm}
        filteredStations={filteredStations}
        selectedStation={selectedStation}
        activeItems={activeItems}
        activeSubtotal={activeSubtotal}
        sfDistricts={SF_DISTRICTS}
        user={user}
        pendingAuctionOrders={pendingAuctionOrders}
      />
    </div>
  );
}

// ─── Auction Order Row ──────────────────────────────────────────────────────────
type PendingAuctionOrder = {
  orderId: number;
  orderNo: string;
  listingId: number;
  auctionListingId: number | null;
  subtotalHkd: string;
  orderStatus: string;
  createdAt: Date | null;
  sellerType: string | null;
  sellerId: number | null;
  title: string;
  images: string | null;
  condition: string | null;
  listingMode: string | null;
  auctionEndAt: Date | null;
  sellerDisplayName: string | null;
  isAuctionOrder: true;
};

function AuctionOrderRow({ order, paymentTimeoutMinutes, onPaymentSuccess }: {
  order: PendingAuctionOrder;
  paymentTimeoutMinutes: number;
  onPaymentSuccess: () => void;
}) {
  const [timeLeft, setTimeLeft] = React.useState<{ hours: number; minutes: number; seconds: number; expired: boolean } | null>(null);
  const [showAlipayQR, setShowAlipayQR] = React.useState(false);
  const utils = trpc.useUtils();
  const switchToAlipayMutation = trpc.marketplace.switchOrderPaymentToAlipay.useMutation({
    onSuccess: () => {
      setShowAlipayQR(true);
      utils.marketplace.getMyPendingAuctionOrders.invalidate();
    },
    onError: (err) => toast.error(err.message || '切換付款方式失敗'),
  });

  React.useEffect(() => {
    if (!order.createdAt) return;
    const deadline = new Date(order.createdAt).getTime() + paymentTimeoutMinutes * 60 * 1000;
    const update = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds, expired: false });
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [order.createdAt, paymentTimeoutMinutes]);

  const imgs: string[] | null = (() => { try { return order.images ? JSON.parse(order.images) : null; } catch { return null; } })();
  const canUseAlipay = order.sellerType !== 'seller';

  return (
    <div className="flex flex-col">
      {/* Countdown banner */}
      {timeLeft && !timeLeft.expired && (
        <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 font-mono font-semibold">
            付款時限剩餘：{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </span>
        </div>
      )}
      {timeLeft?.expired && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 font-semibold">付款時限已到，訂單即將自動取消</span>
        </div>
      )}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Image */}
        <Link href={`/orders/${order.orderNo}`}>
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-yellow-200">
            {imgs?.[0] ? (
              <img src={imgs[0]} alt={order.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
            )}
          </div>
        </Link>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link href={`/orders/${order.orderNo}`}>
            <p className="text-sm font-medium text-gray-800 line-clamp-2 hover:text-[#06038D] transition-colors">{order.title}</p>
          </Link>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className="text-xs px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-300">
              <Trophy className="w-2.5 h-2.5 mr-1" />拍賣得標
            </Badge>
            {order.condition && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-gray-700 border-gray-300">{order.condition}</Badge>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">訂單 #{order.orderNo}</p>
        </div>
        {/* Price */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="font-bold text-[#06038D] text-sm">HK${Number(order.subtotalHkd).toFixed(0)}</span>
          {canUseAlipay && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-3 border-blue-300 text-blue-700 hover:bg-blue-50"
              disabled={switchToAlipayMutation.isPending || !!timeLeft?.expired}
              onClick={() => switchToAlipayMutation.mutate({ orderId: order.orderId })}
            >
              <Smartphone className="w-3 h-3 mr-1" />支付寶 HK
            </Button>
          )}
        </div>
      </div>
      {/* AlipayHK QR Code Dialog */}
      {showAlipayQR && (
        <div className="mx-4 mb-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">支付寶 HK 付款</span>
            </div>
            <button onClick={() => setShowAlipayQR(false)} className="text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-3">
            <img src={ALIPAY_QR_URL} alt="支付寶 HK QR Code" className="w-32 h-32 rounded-lg border border-blue-200" />
            <div className="text-center">
              <p className="text-sm font-bold text-blue-800">HK${Number(order.subtotalHkd).toFixed(2)}</p>
              <p className="text-xs text-blue-600 mt-1">掃描 QR code 付款，付款後請截圖上傳付款證明</p>
            </div>
            <Link href={`/orders/${order.orderNo}`}>
              <Button size="sm" variant="outline" className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100">
                前往訂單上傳付款證明
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cart Item Row ────────────────────────────────────────────────────────────
interface CartItemRowProps {
  item: {
    cartItemId: number;
    listingId: number;
    title: string;
    priceHkd: string | number;
    condition: string | null;
    images: string | null;
    status: string | null;
    sellerType: string | null;
    acceptedOfferId?: number | null;
    acceptedOfferPrice?: string | number | null;
    acceptedOfferExpiresAt?: Date | string | null;
    isOfferExpired?: boolean;
    hasPendingOrder?: boolean;
    pendingOrderNo?: string | null;
  };
  onRemove: () => void;
  removing: boolean;
  unavailable?: boolean;
}

function CartItemRow({ item, onRemove, removing, unavailable }: CartItemRowProps) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!item.acceptedOfferExpiresAt || item.isOfferExpired || !item.acceptedOfferId) {
      setTimeLeft(null);
      return;
    }
    const expiresAt = new Date(item.acceptedOfferExpiresAt).getTime();
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours} 小時 ${minutes} 分鐘`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [item.acceptedOfferExpiresAt, item.isOfferExpired, item.acceptedOfferId]);

  const effectivePrice = item.acceptedOfferId && item.acceptedOfferPrice && !item.isOfferExpired
    ? Number(item.acceptedOfferPrice)
    : Number(item.priceHkd);

  return (
    <div className={`flex flex-col ${unavailable ? "opacity-50" : ""}`}>
      {/* Offer accepted countdown banner */}
      {item.acceptedOfferId && !item.isOfferExpired && timeLeft && (
        <div className="mx-4 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700">
            賣家已接受你的出價！請在 <span className="font-bold">{timeLeft}</span> 內完成付款
          </span>
        </div>
      )}
      {/* Offer expired banner */}
      {item.isOfferExpired && (
        <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-700">
            出價已過期，將以原價 <span className="font-bold">HK${Number(item.priceHkd).toFixed(0)}</span> 購買
          </span>
        </div>
      )}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Image */}
        <Link href={`/marketplace/${item.listingId}`}>
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
            {item.images ? (
              <img src={JSON.parse(item.images)[0] ?? ''} alt={item.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-300" />
              </div>
            )}
          </div>
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link href={`/marketplace/${item.listingId}`}>
            <p className="text-sm font-medium text-gray-800 line-clamp-2 hover:text-[#06038D] transition-colors">
              {item.title}
            </p>
          </Link>
          <div className="flex items-center gap-2 mt-1">
            {item.condition && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-gray-700 border-gray-300">
                {CONDITION_LABELS[item.condition] ?? item.condition}
              </Badge>
            )}
            {item.acceptedOfferId && !item.isOfferExpired && (
              <Badge className="text-xs px-1.5 py-0 h-5 bg-green-100 text-green-700 border-green-200">{t("cart.offer.acceptedBadge")}</Badge>
            )}
            {unavailable && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">{t("cart.item.unavailableBadge")}</Badge>
            )}
            {item.hasPendingOrder && !unavailable && (
              <Link href={item.pendingOrderNo ? `/orders?highlight=${item.pendingOrderNo}` : '/orders'}>
                <Badge className="text-xs px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-200 transition-colors">
                  待付款 →
                </Badge>
              </Link>
            )}
          </div>
        </div>

        {/* Price + Remove */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {item.acceptedOfferId && !item.isOfferExpired && item.acceptedOfferPrice ? (
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-400 line-through">HK${Number(item.priceHkd).toFixed(0)}</span>
              <span className="font-bold text-green-600 text-sm">HK${effectivePrice.toFixed(0)}</span>
            </div>
          ) : (
            <span className="font-bold text-[#06038D] text-sm">
              HK${effectivePrice.toFixed(0)}
            </span>
          )}
          <button
            onClick={onRemove}
            disabled={removing}
            className="text-gray-300 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout Dialog ──────────────────────────────────────────────────────────
interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  form: CheckoutForm;
  setForm: React.Dispatch<React.SetStateAction<CheckoutForm>>;
  filteredStations: SFPoint[];
  selectedStation: SFPoint | undefined;
  activeItems: Array<{
    listingId: number;
    title: string;
    priceHkd: string | number;
    sellerType: string | null;
    acceptedOfferId?: number | null;
    acceptedOfferPrice?: string | number | null;
    sellerUserPhone?: string | null;
    sellerDisplayName?: string | null;
  }>;
  activeSubtotal: number;
  sfDistricts: string[];
  user?: { id: number; name?: string | null; phone?: string | null; email?: string | null } | null;
  pendingAuctionOrders?: Array<{ orderId: number; orderNo: string; subtotalHkd: string | number }> | null;
}

function CheckoutDialog({
  open, onClose, form, setForm, filteredStations, selectedStation, activeItems, activeSubtotal, sfDistricts, user, pendingAuctionOrders,
}: CheckoutDialogProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [isValidatingStock, setIsValidatingStock] = React.useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3 | 4>(1);
  const [alipayOrderNos, setAlipayOrderNos] = useState<string[]>([]);
  // Step 4: Payment proof upload
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);

  // Fetch saved addresses
  const { data: savedAddresses } = trpc.marketplace.getMyShippingAddresses.useQuery(undefined, {
    enabled: open,
  });
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [sfAddressMode, setSfAddressMode] = useState<"sf_station" | "manual">("sf_station");

  // Auto-fill from saved address when dialog opens
  useEffect(() => {
    if (!open) {
      setCheckoutStep(1);
      setSelectedAddressId(null);
      setProofFile(null);
      setProofPreview(null);
      setIsSubmittingProof(false);
      setProofSubmitted(false);
      return;
    }
    if (savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find((a: any) => a.isDefault) ?? savedAddresses[0];
      if (defaultAddr) {
        applyAddress(defaultAddr);
        setSelectedAddressId(defaultAddr.id);
      }
    }
  }, [open, savedAddresses]);

  const applyAddress = (addr: any) => {
    setForm((f) => ({
      ...f,
      shippingMethod: addr.addressType === "sf_station" ? "sf_cod" : "meetup",
      recipientName: addr.recipientName || "",
      recipientPhone: addr.phone || "",
      sfDistrict: addr.district || "",
      sfStationCode: addr.sfStationCode || null,
      meetupNote: addr.addressType === "normal" ? (addr.address || "") : "",
    }));
  };

  // For cart checkout we create individual orders per listing (one order per item)
  // since each listing is from potentially different sellers
  const createBatchStripeOrderMutation = trpc.marketplace.createBatchStripeOrder.useMutation({
    onError: (err) => toast.error(err.message || "建立訂單失敗"),
  });

  const createBatchAlipayOrderMutation = trpc.marketplace.createBatchAlipayOrder.useMutation({
    onError: (err) => toast.error(err.message || "建立訂單失敗"),
  });

  const isProcessing = createBatchStripeOrderMutation.isPending || createBatchAlipayOrderMutation.isPending;

  const submitBatchAlipayProofMutation = trpc.marketplace.submitBatchAlipayProof.useMutation({
    onError: (err) => toast.error(err.message || "上傳截圖失敗，請重試"),
  });

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("請上傳圖片格式的截圖（JPG、PNG 等）");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("截圖大小不能超過 10MB");
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!proofFile || alipayOrderNos.length === 0) return;
    setIsSubmittingProof(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(proofFile);
      });
      await submitBatchAlipayProofMutation.mutateAsync({
        orderNos: alipayOrderNos,
        proofImageBase64: base64,
        mimeType: proofFile.type || "image/jpeg",
      });
      setProofSubmitted(true);
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
    } catch {
      // Error already shown by mutation onError
    } finally {
      setIsSubmittingProof(false);
    }
  };

  // P0: Detect if any item is from a C2C seller — restricts payment to Stripe only
  const hasSellerItems = useMemo(
    () => activeItems.some((item) => item.sellerType === "seller"),
    [activeItems]
  );

  // P0: Auto-switch to Stripe if Alipay HK is selected but cart has seller items
  useEffect(() => {
    if (hasSellerItems && form.paymentMethod === "alipay_hk") {
      setForm((f) => ({ ...f, paymentMethod: "stripe" }));
    }
  }, [hasSellerItems, form.paymentMethod, setForm]);

  const canProceedStep1 = useMemo(() => {
    const hasItems = activeItems.length > 0 || (pendingAuctionOrders && pendingAuctionOrders.length > 0);
    if (!hasItems) return false;
    if (selectedAddressId !== null) return true;
    if (form.shippingMethod === "sf_cod") {
      if (!form.recipientName.trim() || !form.recipientPhone.trim()) return false;
      if (sfAddressMode === "sf_station") return !!(form.sfStationCode);
      if (sfAddressMode === "manual") return !!(form.meetupNote.trim());
      return false;
    }
    return true;
  }, [form, activeItems, selectedAddressId, sfAddressMode]);

  const buildShippingAddress = () => {
    if (form.shippingMethod === "sf_cod") {
      if (sfAddressMode === "sf_station" && selectedStation) {
        return {
          name: form.recipientName,
          phone: form.recipientPhone,
          district: selectedStation.district,
          address: selectedStation.address,
          addressType: "sf_station" as const,
          sfStationCode: selectedStation.code,
          sfStationName: selectedStation.name,
        };
      }
      if (sfAddressMode === "manual") {
        return {
          name: form.recipientName,
          phone: form.recipientPhone,
          district: "",
          address: form.meetupNote,
          addressType: "normal" as const,
        };
      }
    }
    return {
      name: form.recipientName || user?.name || "面交",
      phone: form.recipientPhone || user?.phone || "",
      district: "",
      address: form.meetupNote || "面交/其他",
      addressType: "normal" as const,
    };
  };

  // Batch checkout state
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; errors: number } | null>(null);

  const handleCheckout = async () => {
    if (isProcessing || batchProgress) return;

    // Pre-checkout inventory validation
    setIsValidatingStock(true);
    try {
      const freshCart = await utils.marketplace.getMyCart.fetch();
      const freshActiveIds = new Set(
        (freshCart ?? []).filter((i) => i.status === "active").map((i) => i.listingId)
      );
      const nowUnavailable = activeItems.filter((i) => !freshActiveIds.has(i.listingId));
      if (nowUnavailable.length > 0) {
        const names = nowUnavailable.map((i) => i.title).join("、");
        toast.error(`以下商品已下架或售出，已自動從購物車移除：${names}`);
        utils.marketplace.getMyCart.invalidate();
        utils.marketplace.getCartCount.invalidate();
        setIsValidatingStock(false);
        return;
      }
    } catch {
      // Non-fatal
    }
    setIsValidatingStock(false);

    const shippingAddress = buildShippingAddress();
    const itemsPayload = activeItems.map((item) => ({
      listingId: item.listingId,
      ...(item.acceptedOfferId ? { offerId: item.acceptedOfferId } : {}),
    }));

    // Collect auction order IDs for mixed checkout
    const auctionOrderIds = (pendingAuctionOrders ?? []).map(o => o.orderId);

    if (form.paymentMethod === "stripe") {
      // ── Stripe: batch checkout, one payment for all items (including auction orders) ──
      setBatchProgress({ total: activeItems.length + auctionOrderIds.length, done: 0, errors: 0 });
      try {
        const result = await new Promise<{ checkoutUrl: string; orderNos: string[]; totalAmount: number }>((resolve, reject) => {
          createBatchStripeOrderMutation.mutate({
            items: itemsPayload,
            auctionOrderIds: auctionOrderIds.length > 0 ? auctionOrderIds : undefined,
            shippingAddress,
            shippingMethod: form.shippingMethod,
            buyerPhone: buyerPhone || undefined,
          }, {
            onSuccess: resolve,
            onError: reject,
          });
        });
        utils.marketplace.getMyCart.invalidate();
        utils.marketplace.getCartCount.invalidate();
        setBatchProgress(null);
        onClose();
        toast.success(`已建立 ${result.orderNos.length} 個訂單，正在跳轉至 Stripe 付款頁面...`);
        window.location.href = result.checkoutUrl;
      } catch {
        setBatchProgress(null);
        // Error already shown by mutation onError
      }
    } else {
      // ── AlipayHK: create all orders, then show QR code ──
      setBatchProgress({ total: activeItems.length, done: 0, errors: 0 });
      try {
        const result = await new Promise<{ orderNos: string[]; totalAmount: number; firstOrderNo: string }>((resolve, reject) => {
          createBatchAlipayOrderMutation.mutate({
            items: itemsPayload,
            proofImageUrl: "",
            shippingAddress,
            shippingMethod: form.shippingMethod,
            buyerPhone: buyerPhone || undefined,
          }, {
            onSuccess: resolve,
            onError: reject,
          });
        });
        utils.marketplace.getMyCart.invalidate();
        utils.marketplace.getCartCount.invalidate();
        setBatchProgress(null);
        // Show QR code step
        setAlipayOrderNos(result.orderNos);
        setCheckoutStep(3);
      } catch {
        setBatchProgress(null);
        // Error already shown by mutation onError
      }
    }
  };

  const handleAlipayDone = () => {
    // Go to Step 4 to upload payment proof instead of navigating away
    setCheckoutStep(4);
  };

  const handleFinishAndGoToOrders = () => {
    onClose();
    if (alipayOrderNos.length === 1) {
      setLocation(`/orders/${alipayOrderNos[0]}`);
    } else {
      setLocation("/orders");
    }
  };

  const buyerPhone = user?.phone || "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg max-h-[92vh]">
        <VisuallyHidden><DialogTitle>{t("cart.checkoutDialog.title")}</DialogTitle></VisuallyHidden>
        {/* Header - /seller style */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0" style={{ backgroundColor: '#06038D', borderBottom: '3px solid #FEDD00' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">{t("cart.checkoutDialog.title")}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Step Indicator */}
          <div className="flex items-center gap-0">
            {(checkoutStep <= 2
              ? [{ n: 1 as const, label: t("cart.checkoutDialog.step1") }, { n: 2 as const, label: t("cart.checkoutDialog.step2") }]
              : [{ n: 1 as const, label: t("cart.checkoutDialog.step1") }, { n: 2 as const, label: t("cart.checkoutDialog.step2") }, { n: 3 as const, label: t("cart.checkoutDialog.step3") }, { n: 4 as const, label: t("cart.checkoutDialog.step4") }]
            ).map(({ n, label }, idx, arr) => (
              <React.Fragment key={n}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    checkoutStep > n ? "bg-[#FEDD00] text-[#06038D]" :
                    checkoutStep === n ? "bg-[#FEDD00] text-[#06038D] ring-4 ring-[#FEDD00]/30" :
                    "bg-white/20 text-white/50"
                  }`}>
                    {checkoutStep > n ? <Check className="w-3.5 h-3.5" /> : n}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    checkoutStep >= n ? "text-[#FEDD00]" : "text-white/40"
                  }`}>{label}</span>
                </div>
                {idx < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${
                    checkoutStep > n ? "bg-[#FEDD00]" : "bg-white/20"
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-white">

          {/* ── Step 1: Shipping ── */}
          {checkoutStep === 1 && (
            <>
              {/* Saved Addresses */}
              {savedAddresses && savedAddresses.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-[#06038D] mb-2 block">{t("cart.address.savedAddresses")}</Label>
                  <div className="space-y-2">
                    {savedAddresses.map((addr: any) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => { applyAddress(addr); setSelectedAddressId(addr.id); }}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedAddressId === addr.id
                            ? "border-[#06038D] bg-[#06038D]/5"
                            : "border-gray-200 hover:border-[#06038D]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold text-gray-800">{addr.recipientName}</span>
                              {addr.isDefault && (
                                <span className="text-[10px] bg-[#06038D] text-white px-1.5 py-0.5 rounded font-medium">{t("cart.address.defaultBadge")}</span>
                              )}
                              {addr.label && addr.label !== "預設地址" && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{addr.label}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />{addr.phone}
                            </p>
                            {addr.addressType === "sf_station" ? (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Truck className="w-3 h-3" />順豐自提：{addr.sfStationName || addr.sfStationCode}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />{addr.address || "面交/其他"}
                              </p>
                            )}
                          </div>
                          {selectedAddressId === addr.id && (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#06038D' }}>
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAddressId(null)}
                    className="mt-2 text-xs text-[#06038D] underline"
                  >
                    手動填寫其他地址
                  </button>
                </div>
              )}

              {/* No saved addresses - quick link to profile */}
              {(!savedAddresses || savedAddresses.length === 0) && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-[#06038D]/30 bg-[#06038D]/5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#06038D]" />
                    <span className="text-xs text-gray-600">{t("cart.address.noSavedAddresses")}</span>
                  </div>
                  <a
                    href="/profile?tab=addresses"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#06038D] underline whitespace-nowrap"
                  >
                    前往個人中心新增地址
                  </a>
                </div>
              )}

              {/* Manual Address / Shipping Method */}
              {(!savedAddresses || savedAddresses.length === 0 || selectedAddressId === null) && (<>
                <div>
                  <Label className="text-xs font-semibold text-[#06038D] mb-2 block">{t("cart.checkoutDialog.step1")}</Label>
                  <RadioGroup
                    value={form.shippingMethod}
                    onValueChange={(v) => setForm((f) => ({ ...f, shippingMethod: v as ShippingMethod, sfDistrict: "", sfStationCode: null }))}
                    className="space-y-2"
                  >
                    <div className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      form.shippingMethod === "sf_cod" ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-[#06038D]/40"
                    }`}>
                      <RadioGroupItem value="sf_cod" id="sf_cod2" className="mt-0.5 flex-shrink-0" />
                      <Label htmlFor="sf_cod2" className="cursor-pointer flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#06038D] flex-shrink-0" />
                          <span className="font-semibold text-sm text-gray-800 whitespace-nowrap">{t("cart.shipping.sfExpressTitle")}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 ml-6">{t("cart.shipping.sfExpressDescription")}</p>
                      </Label>
                    </div>
                    <div className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      form.shippingMethod === "meetup" ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-[#06038D]/40"
                    }`}>
                      <RadioGroupItem value="meetup" id="meetup2" className="mt-0.5" />
                      <Label htmlFor="meetup2" className="cursor-pointer flex-1">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#06038D]" />
                          <span className="font-semibold text-sm text-gray-800">{t("cart.shipping.meetupTitle")}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 ml-6">{t("cart.shipping.meetupDescription")}</p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
              )}

              {/* SF COD Details */}
              {form.shippingMethod === "sf_cod" && selectedAddressId === null && (
                <div className="space-y-3 p-4 bg-[#06038D]/5 rounded-xl border border-[#06038D]/20">
                  {/* SF Notice */}
                  <div className="text-xs text-gray-600 bg-white rounded-lg p-3 border border-[#06038D]/10">
                    <p className="font-semibold text-[#06038D] mb-1">📦 順豐速運條款</p>
                    <p className="leading-relaxed">【如寄順豐自提網點可享運費優惠】請於下單時提供收件人名、電話，並選擇你的順豐網點。運費金額將自動根據貨件重量、材積、收件地址計算。運費由順豐速運收取，於取件時支付。運費詳情可參考<a href="https://htm.sf-express.com/hk/tc/" target="_blank" rel="noopener noreferrer" className="text-[#06038D] underline">順豐速運香港官方網站</a>。</p>
                    <p className="mt-1 leading-relaxed">【客戶須知】由於順豐已暫停經SMS短訊方式發送取件訊息，所有取件訊息已改為透過順豐香港官方手機應用程式「SFHK APP」推送，客戶請提前下載「SFHK APP」，並開啟手機推送通知，以免錯過貨件運送提醒，同時客戶可透過「SFHK APP」隨時查看快件的最新狀態。</p>
                  </div>

                  {/* Recipient Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">收件人姓名 *</Label>
                      <Input
                        placeholder="收件人全名"
                        value={form.recipientName}
                        onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                        className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">聯絡電話 *</Label>
                      <Input
                        placeholder="+852 XXXX XXXX"
                        value={form.recipientPhone}
                        onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                        className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* SF Address Mode Toggle */}
                  <div>
                    <Label className="text-xs text-gray-600 mb-2 block">收件地址方式</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setSfAddressMode("sf_station"); setForm((f) => ({ ...f, sfDistrict: "", sfStationCode: null })); }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                          sfAddressMode === "sf_station"
                            ? "border-[#06038D] bg-[#06038D]/5 text-[#06038D]"
                            : "border-gray-200 text-gray-600 hover:border-[#06038D]/40"
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>順豐點 / 智能櫃</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSfAddressMode("manual"); setForm((f) => ({ ...f, sfDistrict: "", sfStationCode: null })); }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                          sfAddressMode === "manual"
                            ? "border-[#06038D] bg-[#06038D]/5 text-[#06038D]"
                            : "border-gray-200 text-gray-600 hover:border-[#06038D]/40"
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>手動輸入地址</span>
                      </button>
                    </div>
                  </div>

                  {/* SF Station Selection */}
                  {sfAddressMode === "sf_station" && (
                    <>
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">順豐地區 *</Label>
                        <Select
                          value={form.sfDistrict}
                          onValueChange={(v) => setForm((f) => ({ ...f, sfDistrict: v, sfStationCode: null }))}
                        >
                          <SelectTrigger className="text-sm h-9 border-[#06038D]/30 text-gray-900">
                            <SelectValue placeholder="選擇地區" />
                          </SelectTrigger>
                          <SelectContent>
                            {sfDistricts.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {form.sfDistrict && (
                        <div>
                          <Label className="text-xs text-gray-600 mb-1 block">
                            順豐點 / 智能櫃 *
                            {form.sfDistrict && (
                              <span className="ml-1 text-gray-400">（{filteredStations.length} 個）</span>
                            )}
                          </Label>
                          <Select
                            value={form.sfStationCode ?? ""}
                            onValueChange={(v) => setForm((f) => ({ ...f, sfStationCode: v }))}
                          >
                            <SelectTrigger className="text-sm h-9 border-[#06038D]/30 text-gray-900">
                              <SelectValue placeholder="選擇順豐點 / 智能櫃" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {filteredStations.map((s) => (
                                <SelectItem key={s.code} value={s.code}>
                                  <span className="font-medium">
                                    {s.type === 'locker' ? '🔒 ' : '📦 '}{s.name}
                                    <span className="ml-1.5 text-xs text-gray-400 font-mono">[{s.code}]</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedStation && (
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span>{selectedStation.address}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Manual Address Input */}
                  {sfAddressMode === "manual" && (
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">詳細地址 *</Label>
                      <Input
                        placeholder="例：新界東涌達東路1號東薈城2樓201室"
                        value={form.meetupNote}
                        onChange={(e) => setForm((f) => ({ ...f, meetupNote: e.target.value }))}
                        className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                      />
                      <p className="text-xs text-gray-400 mt-1">順豐上門派送，請填寫完整地址（包括大廈名稱、樓層及室號）</p>
                    </div>
                  )}
                </div>
              )}

              {/* Meetup Details */}
              {form.shippingMethod === "meetup" && selectedAddressId === null && (
                <div className="space-y-3 p-4 bg-[#06038D]/5 rounded-xl border border-[#06038D]/20">
                  {/* Buyer phone info */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#06038D]/10">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#06038D' }}>
                      <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#06038D] mb-0.5">你的聯絡電話（賣家可見）</p>
                      {buyerPhone ? (
                        <p className="text-sm font-bold text-gray-800">{buyerPhone}</p>
                      ) : (
                        <p className="text-xs text-amber-600">⚠️ 你尚未在個人中心設定電話，賣家將無法主動聯絡你。建議前往個人中心設定電話後再結帳。</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">面交訂單建立後，賣家可在訂單詳情中查看你的電話</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">偏好交收地點（可選）</Label>
                    <Input
                      placeholder="例：旺角地鐵站 B 出口、荃灣廣場門口..."
                      value={form.meetupNote}
                      onChange={(e) => setForm((f) => ({ ...f, meetupNote: e.target.value }))}
                      className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">此備註將顯示在訂單詳情中，供雙方溝通安排交收地點</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Payment + Summary ── */}
          {checkoutStep === 2 && (
            <>
              {/* Order Summary */}
              <div className="bg-[#06038D]/5 rounded-xl border border-[#06038D]/20 p-4 space-y-2">
                <p className="text-xs font-semibold text-[#06038D] mb-2">{t("cart.summary")}</p>
                {activeItems.map((item) => (
                  <div key={item.listingId} className="flex justify-between text-sm text-gray-700">
                    <span className="truncate flex-1 mr-2">
                      {item.title}
                      {item.acceptedOfferId && (
                        <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded font-medium">出價價</span>
                      )}
                    </span>
                    <span className="flex-shrink-0 font-medium">
                      {item.acceptedOfferPrice ? (
                        <span className="flex items-center gap-1">
                          <span className="line-through text-gray-400 text-xs">HK${Number(item.priceHkd).toFixed(0)}</span>
                          <span className="text-green-700 font-semibold">HK${Number(item.acceptedOfferPrice).toFixed(0)}</span>
                        </span>
                      ) : (
                        `HK$${Number(item.priceHkd).toFixed(0)}`
                      )}
                    </span>
                  </div>
                ))}
                {pendingAuctionOrders && pendingAuctionOrders.length > 0 && (
                  <>
                    {pendingAuctionOrders.map((o) => (
                      <div key={o.orderId} className="flex justify-between text-sm text-amber-700">
                        <span className="truncate flex-1 mr-2">🏆 拍賣得標 #{o.orderNo}</span>
                        <span className="flex-shrink-0 font-medium">HK${parseFloat(String(o.subtotalHkd)).toFixed(0)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="border-t border-[#06038D]/20 pt-2 mt-2 flex justify-between font-bold text-[#06038D]">
                  <span>合計（不含運費）</span>
                  <span>HK${(activeSubtotal + (pendingAuctionOrders ?? []).reduce((s, o) => s + parseFloat(String(o.subtotalHkd)), 0)).toFixed(0)}</span>
                </div>
              </div>

              {/* Shipping Summary */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                {selectedAddressId !== null ? (
                  (() => {
                    const selAddr = savedAddresses?.find((a: any) => a.id === selectedAddressId);
                    const isSfStation = selAddr?.addressType === "sf_station";
                    return isSfStation ? (
                      <Truck className="w-4 h-4 text-[#06038D] mt-0.5 flex-shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-[#06038D] mt-0.5 flex-shrink-0" />
                    );
                  })()
                ) : form.shippingMethod === "sf_cod" ? (
                  <Truck className="w-4 h-4 text-[#06038D] mt-0.5 flex-shrink-0" />
                ) : (
                  <Users className="w-4 h-4 text-[#06038D] mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {selectedAddressId !== null ? (
                    (() => {
                      const selAddr = savedAddresses?.find((a: any) => a.id === selectedAddressId);
                      const isSfStation = selAddr?.addressType === "sf_station";
                      return (
                        <>
                          <p className="text-xs font-semibold text-gray-700">
                            {isSfStation ? "順豐速運（運費到付）" : "面交 / 其他"}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {selAddr?.recipientName} · {selAddr?.phone}
                            {isSfStation
                              ? ` · 順豐點：${selAddr?.sfStationName || selAddr?.sfStationCode}`
                              : selAddr?.address ? ` · ${selAddr.address}` : ""}
                          </p>
                        </>
                      );
                    })()
                  ) : (
                  <>
                  <p className="text-xs font-semibold text-gray-700">
                    {form.shippingMethod === "sf_cod" ? "順豐速運（運費到付）" : "面交 / 其他"}
                  </p>
                  {form.shippingMethod === "sf_cod" && selectedStation && (
                    <p className="text-xs text-gray-500 mt-0.5">{form.recipientName} · {form.recipientPhone} · {selectedStation.name}</p>
                  )}
                  {form.shippingMethod === "sf_cod" && sfAddressMode === "manual" && form.meetupNote && (
                    <p className="text-xs text-gray-500 mt-0.5">{form.recipientName} · {form.recipientPhone} · {form.meetupNote}</p>
                  )}
                  {form.shippingMethod === "meetup" && (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-gray-500">
                        {buyerPhone ? `你的電話：${buyerPhone}` : "⚠️ 未設定電話（請先在個人中心設定）"}
                        {form.meetupNote ? ` · 交收地點：${form.meetupNote}` : ""}
                      </p>
                      <p className="text-xs text-gray-400">付款完成後，訂單詳情頁面將顯示賣家聯絡電話</p>
                    </div>
                  )}
                  </>
                  )}
                </div>
              </div>


              {/* Payment Method */}
              <div>
                <Label className="text-xs font-semibold text-[#06038D] mb-2 block">付款方式</Label>
                {/* P0: Show restriction notice if cart has seller items */}
                {hasSellerItems && (
                  <div className="flex items-start gap-2 p-3 mb-2 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      購物車包含個人賣家商品，僅支援信用卡付款。支付寶 HK 僅適用於全部為本公司自營商品的訂單。
                    </p>
                  </div>
                )}
                <RadioGroup
                  value={form.paymentMethod}
                  onValueChange={(v) => {
                    // P0: Block Alipay HK if cart has seller items
                    if (v === "alipay_hk" && hasSellerItems) return;
                    setForm((f) => ({ ...f, paymentMethod: v as PaymentMethod }));
                  }}
                  className="space-y-2"
                >
                  {/* Alipay HK option — disabled when cart has seller items */}
                  <div className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                    hasSellerItems
                      ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      : form.paymentMethod === "alipay_hk"
                        ? "border-[#06038D] bg-[#06038D]/5 cursor-pointer"
                        : "border-gray-200 hover:border-[#06038D]/40 cursor-pointer"
                  }`}>
                    <RadioGroupItem value="alipay_hk" id="alipay_hk2" className="mt-0.5" disabled={hasSellerItems} />
                    <Label htmlFor="alipay_hk2" className={`flex-1 ${hasSellerItems ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-sm text-gray-500">支付寶 HK（AlipayHK）</span>
                        {hasSellerItems && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">不可用</span>
                        )}
                      </div>
                      {hasSellerItems ? (
                        <p className="text-xs text-amber-600 mt-0.5 ml-6">包含個人賣家商品，不可使用此付款方式</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-0.5 ml-6">確認後跳轉至付款二維碼頁面，請用 AlipayHK App 揃描完成付款</p>
                      )}
                    </Label>
                  </div>
                  {/* Stripe option — always available */}
                  <div className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.paymentMethod === "stripe" ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-[#06038D]/40"
                  }`}>
                    <RadioGroupItem value="stripe" id="stripe2" className="mt-0.5" />
                    <Label htmlFor="stripe2" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#06038D]" />
                        <span className="font-semibold text-sm text-gray-800">信用卡（Stripe）</span>
                        {hasSellerItems && (
                          <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">推薦</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 ml-6">支援 Visa、Mastercard 等主要信用卡</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {(activeItems.length > 1 || (pendingAuctionOrders && pendingAuctionOrders.length > 0)) && form.paymentMethod === "stripe" && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    {activeItems.length > 0 && `將為 ${activeItems.length} 件市集商品`}
                    {activeItems.length > 0 && pendingAuctionOrders && pendingAuctionOrders.length > 0 && `及 `}
                    {pendingAuctionOrders && pendingAuctionOrders.length > 0 && `${pendingAuctionOrders.length} 件拍賣得標`}
                    {`建立訂單，並合並為一筆 HK$${(activeSubtotal + (pendingAuctionOrders ?? []).reduce((s, o) => s + parseFloat(String(o.subtotalHkd)), 0)).toFixed(0)} 的 Stripe 付款，一次完成所有訂單的支付。`}
                  </p>
                </div>
              )}
              {activeItems.length > 1 && form.paymentMethod === "alipay_hk" && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    將為 {activeItems.length} 件商品建立 {activeItems.length} 個訂單，確認後顯示支付寶 HK 收款 QR 碼，掃碼支付合計 HK${activeSubtotal.toFixed(0)}，完成後上傳截圖確認。
                  </p>
                </div>
              )}

              {batchProgress && (
                <div className="bg-[#06038D]/5 rounded-xl border border-[#06038D]/20 p-3">
                  <div className="flex justify-between text-sm text-[#06038D] font-medium mb-2">
                    <span>正在建立訂單...</span>
                    <span>{batchProgress.done} / {batchProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%`, background: '#FEDD00' }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 3: AlipayHK QR Code ── */}
          {checkoutStep === 3 && (
            <div className="space-y-4">
              {/* Amount summary */}
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-[#06038D] mb-2">訂單已建立，請完成支付寶 HK 付款</p>
                {activeItems.map((item) => (
                  <div key={item.listingId} className="flex justify-between text-sm text-gray-700 mb-1">
                    <span className="truncate flex-1 mr-2">{item.title}</span>
                    <span className="flex-shrink-0 font-medium">
                      {item.acceptedOfferPrice ? `HK$${Number(item.acceptedOfferPrice).toFixed(0)}` : `HK$${Number(item.priceHkd).toFixed(0)}`}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[#06038D]/20 pt-2 mt-2 flex justify-between font-bold text-[#06038D]">
                  <span>合計付款金額</span>
                  <span className="text-lg">HK${activeSubtotal.toFixed(0)}</span>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center space-y-3">
                <p className="text-sm font-medium text-gray-700">請用 AlipayHK App 掃描以下 QR 碼付款</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ALIPAY_QR_URL)}`}
                  alt="支付寶 HK QR Code"
                  className="w-52 h-52 mx-auto rounded-xl border-4 border-white shadow-lg"
                />
                <a href={ALIPAY_QR_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#06038D] hover:underline text-sm">
                  <Smartphone className="w-4 h-4" />在手機上開啟支付寶 HK
                </a>
              </div>

              {/* Reference note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-medium">付款備注請填寫訂單編號：</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm font-bold tracking-wide flex-1">
                    {alipayOrderNos.length === 1 ? `#${alipayOrderNos[0]}` : `#${alipayOrderNos[0]} 等 ${alipayOrderNos.length} 個訂單`}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(alipayOrderNos.map(no => `#${no}`).join(" "));
                      toast.success("訂單編號已複製！請貼上到支付寶備注欄位");
                    }}
                    className="flex items-center gap-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3 h-3" />複製
                  </button>
                </div>
                <p className="text-amber-600 mt-1">⚠️ 請務必在支付寶備注欄填寫以上編號，方便核對付款</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                <p>ℹ️ 完成支付寶 HK 付款後，請點擊下方按鈕進入下一步上傳截圖。管理員審核後訂單即生效。</p>
              </div>
            </div>
          )}
          {/* Step 4: Upload Payment Proof */}
          {checkoutStep === 4 && (
            <div className="space-y-4">
              {proofSubmitted ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#06038D' }}>
                    <CheckCircle className="w-9 h-9 text-[#FEDD00]" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">截圖已成功上傳！</h3>
                    <p className="text-sm text-gray-500">管理員將在 1 個工作天內審核你的付款截圖，審核通過後訂單即生效。</p>
                  </div>
                  <div className="w-full bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
                    <p className="font-medium mb-1">✅ 訂單已建立，截圖待審核</p>
                    <p>訂單編號：{alipayOrderNos.length === 1 ? `#${alipayOrderNos[0]}` : alipayOrderNos.map(no => `#${no}`).join("、")}</p>
                    <p className="mt-1">你可以在「我的訂單」頁面查看訂單狀態。</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#06038D] mb-2">上傳支付寶 HK 付款截圖</p>
                    <p className="text-xs text-gray-600 leading-relaxed">請上傳支付寶 HK 付款成功的截圖，截圖需清晰顯示：</p>
                    <ul className="mt-2 space-y-1">
                      <li className="text-xs text-gray-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#06038D] flex-shrink-0" />收款方：零度有限公司</li>
                      <li className="text-xs text-gray-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#06038D] flex-shrink-0" />付款金額：HKD {activeSubtotal.toFixed(0)}</li>
                      <li className="text-xs text-gray-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#06038D] flex-shrink-0" />付款狀態：成功</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-amber-800 mb-1">訂單編號（請確認已在備注填寫）：</p>
                    <p className="text-sm font-mono font-bold text-amber-900">
                      {alipayOrderNos.length === 1 ? `#${alipayOrderNos[0]}` : alipayOrderNos.map(no => `#${no}`).join(" · ")}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="proof-upload"
                      className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                        proofPreview
                          ? "border-[#06038D] bg-[#06038D]/5 p-2"
                          : "border-gray-300 hover:border-[#06038D] bg-gray-50 hover:bg-[#06038D]/5 p-8"
                      }`}
                    >
                      {proofPreview ? (
                        <div className="relative w-full">
                          <img src={proofPreview} alt="付款截圖預覽" className="w-full max-h-64 object-contain rounded-lg" />
                          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">點擊更換截圖</div>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                            <Upload className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-600">點擊上傳付款截圖</p>
                          <p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 10MB</p>
                        </>
                      )}
                    </label>
                    <input id="proof-upload" type="file" accept="image/*" className="hidden" onChange={handleProofFileChange} />
                  </div>
                  {proofFile && (
                    <p className="text-xs text-gray-500 text-center">已選擇：{proofFile.name}（{(proofFile.size / 1024).toFixed(0)} KB）</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2 bg-white flex-shrink-0" style={{ borderTop: '1px solid rgba(6,3,141,0.15)' }}>
          {checkoutStep === 1 && (
            <Button
              variant="outline"
              className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white"
              onClick={onClose}
            >取消</Button>
          )}
          {checkoutStep === 2 && (
            <Button
              variant="outline"
              className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white"
              onClick={() => setCheckoutStep(1)}
              disabled={isProcessing}
            >上一步</Button>
          )}
          {checkoutStep === 1 && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              disabled={!canProceedStep1}
              onClick={() => setCheckoutStep(2)}
            >下一步</Button>
          )}
          {checkoutStep === 2 && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              onClick={handleCheckout}
              disabled={isProcessing || !!batchProgress || isValidatingStock}
            >
              {isValidatingStock
                ? "驗證庫存中..."
                : batchProgress
                ? `建立中 ${batchProgress.done}/${batchProgress.total}...`
                : isProcessing
                ? "處理中..."
                : activeItems.length > 1
                ? `確認結帳（${activeItems.length} 件）`
                : "確認結帳"}
            </Button>
          )}
          {checkoutStep === 3 && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              onClick={handleAlipayDone}
            >
              我已完成付款 → 上傳截圖
            </Button>
          )}
          {checkoutStep === 4 && !proofSubmitted && (
            <Button
              variant="outline"
              className="flex-shrink-0 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white px-4"
              onClick={() => setCheckoutStep(3)}
              disabled={isSubmittingProof}
            >{t("cart.back")}</Button>
          )}
          {checkoutStep === 4 && !proofSubmitted && (
            <Button
              className="flex-1 font-bold"
              style={{ background: proofFile ? '#FEDD00' : '#e5e7eb', color: proofFile ? '#06038D' : '#9ca3af' }}
              onClick={handleSubmitProof}
              disabled={!proofFile || isSubmittingProof}
            >
              {isSubmittingProof ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />上傳中...</span>
              ) : "提交付款截圖"}
            </Button>
          )}
          {checkoutStep === 4 && proofSubmitted && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              onClick={handleFinishAndGoToOrders}
            >前往我的訂單</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
