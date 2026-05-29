import React, { useState, useMemo, useEffect } from "react";
import { parseApiError } from "@/lib/parseApiError";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ShoppingCart, Trash2, AlertCircle, Package, ChevronRight, ArrowLeft, Clock, Check, X, Phone, MapPin, CreditCard, Truck, Users, ChevronDown, Smartphone, Copy, Upload, Loader2, CheckCircle, Trophy, XCircle, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
import { LazyImage } from "@/components/LazyImage";

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

type ShippingMethod = "sf_cod" | "hk_post";
const HK_POST_FEE = 10; // HK$10 郵費（香港郵政）
type PaymentMethod = "stripe" | "alipay_hk";

interface CheckoutForm {
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  // SF fields
  sfDistrict: string;
  sfStationCode: string | null;
  recipientName: string;
  recipientPhone: string;
  manualAddress: string; // SF 上門派送手動地址
  // HK Post address
  hkPostAddress: string;
  hkPostRecipientName: string;
  hkPostRecipientPhone: string;
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
      toast.success(t("cart.removedUnavailable", { count: data.removed }));
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
    manualAddress: "",
    hkPostAddress: "",
    hkPostRecipientName: "",
    hkPostRecipientPhone: "",
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
    () => (cartItems ?? []).filter((item) => item.status === "active" || (item as any).hasPendingOrder),
    [cartItems]
  );

  const unavailableItems = useMemo(
    () => (cartItems ?? []).filter((item) => item.status !== "active" && !(item as any).hasPendingOrder),
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

  // Clear cart after Stripe payment success (webhook may be delayed, so also clear from frontend)
  // MUST be placed before any early returns to comply with React Hooks rules
  useEffect(() => {
    if (isStripeSuccess && user) {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStripeSuccess, !!user]);

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
                {t("common.back")}
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
                {t("common.loginNow")}
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
        <div className="text-center text-gray-500">{t("common.loading")}</div>
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
              <h2 className="text-2xl font-bold text-white mb-2">{t("cart.paymentSuccess")}</h2>
              <p className="text-white/80 text-sm">{t("cart.stripePaymentConfirmed")}</p>
            </div>
            {/* Order numbers */}
            <div className="p-6">
              {stripeOrderNos.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700 mb-3">{t("cart.ordersCreated", { count: stripeOrderNos.length })}</p>
                  {stripeOrderNos.map((orderNo) => (
                    <div key={orderNo} className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                        <div>
                          <p className="text-xs text-gray-500">{t("cart.orderNo")}</p>
                          <p className="font-mono font-semibold text-gray-800 text-sm">#{orderNo}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">{t("cart.waitingShipment")}</span>
                      </div>
                      <Link href={`/orders/${orderNo}`}>
                        <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-[#06038D]/5 transition-colors cursor-pointer border-t border-gray-100">
                          <Package className="w-3.5 h-3.5 text-[#06038D]" />
                          <span className="text-xs font-semibold text-[#06038D]">{t("cart.viewOrderStatus")}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#06038D]" />
                        </div>
                      </Link>
                    </div>
                  ))}
                  {/* Shipping progress hint */}
                  <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">{t("cart.sellerWillShip")}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">{t("cart.orderCreatedGoToOrders")}</p>
                </div>
              )}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => stripeOrderNos.length === 1 ? setLocation(`/orders/${stripeOrderNos[0]}`) : setLocation('/profile?tab=orders')}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#06038D' }}
                >
                  <Package className="w-4 h-4" />
                  {stripeOrderNos.length === 1 ? t("cart.viewOrderStatus") : t("cart.goToOrders")}
                </button>
                <button
                  onClick={() => setLocation('/marketplace')}
                  className="w-full py-3 rounded-xl text-gray-700 font-semibold text-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {t("cart.continueShopping")}
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
              {t("cart.backToMarketplace")}
            </button>
          </div>
          {/* Title row */}
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-white" />
            <h1 className="text-2xl font-bold text-white">{t("cart.title")}</h1>
            {!isEmpty && (
              <span className="text-sm text-white/60">（{(cartItems?.length ?? 0) + (pendingAuctionOrders?.length ?? 0)} {t("cart.itemCount")}）</span>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {isEmpty ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <ShoppingCart className="w-16 h-16 text-gray-200" />
            <h2 className="text-xl font-semibold text-gray-500">{t("cart.empty.title")}</h2>
            <p className="text-gray-400 text-sm">{t("cart.empty.message")}</p>
            <Link href="/marketplace">
              <Button className="bg-[#06038D] text-white hover:bg-[#06038D]/90">
                {t("cart.empty.goToMarketplace")}
              </Button>
            </Link>
            {/* Recommended listings */}
            {recommendedListings && (
              <div className="w-full mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-700">{recommendedListings.label}</h3>
                  <Link href="/marketplace">
                    <span className="text-sm text-[#06038D] hover:underline cursor-pointer">{t("common.viewAll")} →</span>
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {recommendedListings.data.listings.map((item: any) => {
                    const imgs: string[] | null = (() => { try { return item.images ? JSON.parse(item.images) : null; } catch { return null; } })();
                    return (
                    <Link key={item.id} href={`/marketplace/${item.id}`}>
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                          {imgs?.[0] ? (
                            <LazyImage src={imgs[0]} alt={item.title} className="w-full h-full object-cover" />
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
                    {t("cart.unavailableWarning", { count: unavailableItems.length })}
                  </span>
                </div>
                <button
                  onClick={() => clearUnavailableMutation.mutate()}
                  disabled={clearUnavailableMutation.isPending}
                  className="text-xs text-orange-600 hover:text-orange-800 font-medium whitespace-nowrap flex items-center gap-1 border border-orange-300 rounded-lg px-2.5 py-1.5 bg-white hover:bg-orange-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("cart.clearUnavailable")}
                </button>
              </div>
            )}
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Available items */}
              {activeItems.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <span className="font-semibold text-gray-700 text-sm">{t("cart.availableItems", { count: activeItems.length })}</span>
                    <button
                      onClick={() => clearCartMutation.mutate()}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("cart.clearCart")}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50 overscroll-contain">
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
                    <span className="font-semibold">{t("cart.soonExpiring", { count: soonExpiringItems.length })}</span>
                    {soonExpiringItems.map(item => {
                      const daysLeft = Math.ceil((new Date(item.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return <span key={item.cartItemId} className="block text-xs mt-0.5">{item.title.slice(0, 30)}... {t("cart.daysLeft", { count: daysLeft })}</span>;
                    })}
                  </div>
                </div>
              )}

              {/* ── Pending Auction Orders ── */}
              {pendingAuctionOrders && pendingAuctionOrders.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-yellow-100 bg-gradient-to-r from-yellow-50 to-amber-50">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-amber-800 text-sm">{t("cart.auctionWon", { count: pendingAuctionOrders.length })}</span>
                    <span className="text-xs text-amber-600 ml-1">— {t("cart.payInTime")}</span>
                  </div>
                  <div className="divide-y divide-yellow-50 overscroll-contain">
                    {pendingAuctionOrders.map((order: PendingAuctionOrder) => (
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
                      <span className="font-semibold text-red-600 text-sm">{t("cart.unavailableItems", { count: unavailableItems.length })}</span>
                    </div>
                    <button
                      onClick={() => clearUnavailableMutation.mutate()}
                      disabled={clearUnavailableMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("cart.clearUnavailable")}
                </button>
                  </div>
                  <div className="divide-y divide-gray-50 overscroll-contain">
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:sticky lg:top-20">
                <h2 className="font-bold text-gray-800 mb-4">{t("cart.orderInfo")}</h2>
                <div className="space-y-2 text-sm">
                  {activeItems.length > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>{t("cart.marketplaceItems", { count: activeItems.length })}</span>
                      <span>HK${activeSubtotal.toFixed(0)}</span>
                    </div>
                  )}
                  {pendingAuctionOrders && pendingAuctionOrders.length > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>🏆 {t("cart.auctionWonItems", { count: pendingAuctionOrders.length })}</span>
                      <span>HK${pendingAuctionOrders.reduce((s: number, o: { subtotalHkd: string | number }) => s + parseFloat(String(o.subtotalHkd)), 0).toFixed(0)}</span>
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
                  <span>HK${(activeSubtotal + (pendingAuctionOrders ?? []).reduce((s: number, o: { subtotalHkd: string | number }) => s + parseFloat(String(o.subtotalHkd)), 0)).toFixed(0)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t("cart.totalDisclaimer")}</p>

                <div className="mt-4 space-y-2">
                  <button
                    className="w-full h-9 rounded-md text-sm font-bold bg-[#06038D] text-white hover:bg-[#06038D]/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-all"
                    style={{ border: 'none', outline: 'none' }}
                    disabled={activeItems.length === 0 && (!pendingAuctionOrders || pendingAuctionOrders.length === 0)}
                    onClick={() => setShowCheckout(true)}
                  >
                    {t("cart.checkout")}
                  </button>
                  <button
                    className="w-full h-9 rounded-md text-sm font-semibold bg-white text-[#06038D] hover:bg-[#06038D]/5 cursor-pointer transition-all"
                    style={{ border: 'none', outline: 'none', boxShadow: 'inset 0 0 0 1px #06038D' }}
                    onClick={() => setLocation("/marketplace")}
                  >
                    {t("cart.continueShopping")}
                  </button>
                </div>

                {unavailableItems.length > 0 && (
                  <p className="text-xs text-red-400 mt-2 text-center">
                    {t("cart.unavailableExcluded")}
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
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = React.useState<{ hours: number; minutes: number; seconds: number; expired: boolean } | null>(null);
  const [showAlipayQR, setShowAlipayQR] = React.useState(false);
  const utils = trpc.useUtils();
  const switchToAlipayMutation = trpc.marketplace.switchOrderPaymentToAlipay.useMutation({
    onSuccess: () => {
      setShowAlipayQR(true);
      utils.marketplace.getMyPendingAuctionOrders.invalidate();
    },
    onError: (err) => toast.error(parseApiError(err)),
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
            {t('cart.paymentTimeLeft', { hours: String(timeLeft.hours).padStart(2, '0'), minutes: String(timeLeft.minutes).padStart(2, '0'), seconds: String(timeLeft.seconds).padStart(2, '0') })}
          </span>
        </div>
      )}
      {timeLeft?.expired && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 font-semibold">{t('cart.paymentExpired')}</span>
        </div>
      )}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Image */}
        <Link href={`/orders/${order.orderNo}`}>
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-yellow-200">
            {imgs?.[0] ? (
              <LazyImage src={imgs[0]} alt={order.title} className="w-full h-full object-cover" />
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
              <Trophy className="w-2.5 h-2.5 mr-1" />{t('cart.auctionWon')}
            </Badge>
            {order.condition && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-gray-700 border-gray-300">{order.condition}</Badge>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{t('cart.orderNo', { no: order.orderNo })}</p>
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
              <Smartphone className="w-3 h-3 mr-1" />{t('cart.alipayHk')}
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
              <span className="text-sm font-semibold text-blue-800">{t('cart.alipayPayment')}</span>
            </div>
            <button onClick={() => setShowAlipayQR(false)} className="text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-3">
            <img src={ALIPAY_QR_URL} alt={t('cart.alipayQrAlt')} className="w-32 h-32 rounded-lg border border-blue-200" />
            <div className="text-center">
              <p className="text-sm font-bold text-blue-800">HK${Number(order.subtotalHkd).toFixed(2)}</p>
              <p className="text-xs text-blue-600 mt-1">{t('cart.alipayQrInstruction')}</p>
            </div>
            <Link href={`/orders/${order.orderNo}`}>
              <Button size="sm" variant="outline" className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100">
                {t('cart.goToOrderUploadProof')}
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
      setTimeLeft(t('cart.timeLeftFormat', { hours, minutes }));
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
            {t('cart.offerAccepted', { timeLeft })}
          </span>
        </div>
      )}
      {/* Offer expired banner */}
      {item.isOfferExpired && (
        <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-700">
            {t('cart.offerExpired', { price: Number(item.priceHkd).toFixed(0) })}
          </span>
        </div>
      )}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Image */}
        <Link href={`/marketplace/${item.listingId}`}>
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
            {item.images ? (
              <LazyImage src={JSON.parse(item.images)[0] ?? ''} alt={item.title} className="w-full h-full object-cover" />
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
                  {t('cart.pendingPayment')}
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
  pendingAuctionOrders?: Array<{ orderId: number; orderNo: string; subtotalHkd: string | number; sellerType?: string | null }> | null;
}

function CheckoutDialog({
  open, onClose, form, setForm, filteredStations, selectedStation, activeItems, activeSubtotal, sfDistricts, user, pendingAuctionOrders,
}: CheckoutDialogProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [isValidatingStock, setIsValidatingStock] = React.useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [alipayOrderNos, setAlipayOrderNos] = useState<string[]>([]);
  // Step 4: Payment proof upload
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

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
    const method: ShippingMethod = addr.addressType === "sf_station" ? "sf_cod" : "hk_post";
    setForm((f) => ({
      ...f,
      shippingMethod: method,
      recipientName: addr.recipientName || "",
      recipientPhone: addr.phone || "",
      sfDistrict: addr.district || "",
      sfStationCode: addr.sfStationCode || null,
      hkPostAddress: addr.addressType === "normal" ? (addr.address || "") : "",
      hkPostRecipientName: addr.recipientName || "",
      hkPostRecipientPhone: addr.phone || "",
    }));
  };

  // For cart checkout we create individual orders per listing (one order per item)
  // since each listing is from potentially different sellers
  const createBatchStripeOrderMutation = trpc.marketplace.createBatchStripeOrder.useMutation({
    onError: (err) => toast.error(parseApiError(err)),
  });

  const createBatchAlipayOrderMutation = trpc.marketplace.createBatchAlipayOrder.useMutation({
    onError: (err) => toast.error(parseApiError(err)),
  });

  const isProcessing = createBatchStripeOrderMutation.isPending || createBatchAlipayOrderMutation.isPending;

  const submitBatchAlipayProofMutation = trpc.marketplace.submitBatchAlipayProof.useMutation({
    onError: (err) => toast.error(parseApiError(err)),
  });

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t('cart.uploadImageOnly'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('cart.uploadSizeLimit'));
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

  // P0: Alipay HK is ONLY allowed when ALL items (direct-buy + auction) are platform-owned.
  // If even one item is NOT sellerType='platform', Alipay HK must be disabled.
  const hasSellerItems = useMemo(() => {
    const allDirectBuyArePlatform = activeItems.length === 0 || activeItems.every((item) => item.sellerType === "platform");
    const allAuctionArePlatform = (pendingAuctionOrders ?? []).length === 0 || (pendingAuctionOrders ?? []).every((o) => o.sellerType === "platform");
    const hasAnyItem = activeItems.length > 0 || (pendingAuctionOrders ?? []).length > 0;
    // hasSellerItems = true means Alipay is BLOCKED
    // Block Alipay if: no items at all, or any item is not platform-owned
    return !hasAnyItem || !allDirectBuyArePlatform || !allAuctionArePlatform;
  }, [activeItems, pendingAuctionOrders]);

  // P0: Auto-switch to Stripe if Alipay HK is selected but cart has seller items
  useEffect(() => {
    if (hasSellerItems && form.paymentMethod === "alipay_hk") {
      setForm((f) => ({ ...f, paymentMethod: "stripe" }));
    }
  }, [hasSellerItems, form.paymentMethod, setForm]);

  // Step 1: just need a shipping method selected (always true since default is sf_cod)
  const canProceedStep1 = useMemo(() => {
    const hasItems = activeItems.length > 0 || (pendingAuctionOrders && pendingAuctionOrders.length > 0);
    return hasItems; // shipping method is always selected (sf_cod or hk_post)
  }, [activeItems, pendingAuctionOrders]);

  // Step 2: address details must be filled
  const canProceedStep2 = useMemo(() => {
    if (selectedAddressId !== null) return true;
    if (form.shippingMethod === "sf_cod") {
      if (!form.recipientName.trim() || !form.recipientPhone.trim()) return false;
      if (sfAddressMode === "sf_station") return !!(form.sfStationCode);
      if (sfAddressMode === "manual") return !!(form.manualAddress.trim());
      return false;
    }
    if (form.shippingMethod === "hk_post") {
      return !!(form.hkPostRecipientName.trim() && form.hkPostRecipientPhone.trim() && form.hkPostAddress.trim());
    }
    return true;
  }, [form, selectedAddressId, sfAddressMode]);

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
          address: form.manualAddress,
          addressType: "normal" as const,
        };
      }
    }
    // hk_post
    return {
      name: form.hkPostRecipientName || form.recipientName || user?.name || "",
      phone: form.hkPostRecipientPhone || form.recipientPhone || user?.phone || "",
      district: "",
      address: form.hkPostAddress,
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
        toast.error(t('cart.itemsRemoved', { names }));
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
        toast.success(t('cart.ordersCreatedStripe', { count: result.orderNos.length }));
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
        setCheckoutStep(4);
      } catch {
        setBatchProgress(null);
        // Error already shown by mutation onError
      }
    }
  };

  const handleAlipayDone = () => {
    // Go to Step 5 to upload payment proof
    setCheckoutStep(5);
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
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden lg:max-w-lg max-h-[96vh] lg:mt-2">
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
            {(checkoutStep <= 3
              ? [{ n: 1 as const, label: t("cart.checkoutDialog.step1") }, { n: 2 as const, label: t("cart.checkoutDialog.step2") }, { n: 3 as const, label: t("cart.checkoutDialog.step3") }]
              : [{ n: 1 as const, label: t("cart.checkoutDialog.step1") }, { n: 2 as const, label: t("cart.checkoutDialog.step2") }, { n: 3 as const, label: t("cart.checkoutDialog.step3") }, { n: 4 as const, label: t("cart.checkoutDialog.step4") }, { n: 5 as const, label: t("cart.checkoutDialog.step5") }]
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

          {/* ── Step 1: Choose Shipping Method ── */}
          {checkoutStep === 1 && (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-3">{t('cart.selectShippingMethod')}</p>
                <RadioGroup
                  value={form.shippingMethod}
                  onValueChange={(v) => setForm((f) => ({ ...f, shippingMethod: v as ShippingMethod, sfDistrict: "", sfStationCode: null }))}
                  className="space-y-3"
                >
                  {/* SF Express */}
                  <div className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    form.shippingMethod === "sf_cod" ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-[#06038D]/40"
                  }`}>
                    <RadioGroupItem value="sf_cod" id="sf_cod_step1" className="mt-0.5 flex-shrink-0" />
                    <Label htmlFor="sf_cod_step1" className="cursor-pointer flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Truck className="w-4 h-4 text-[#06038D] flex-shrink-0" />
                        <span className="font-bold text-sm text-gray-800">{t('cart.sfExpress')}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">{t('cart.freightExtra')}</span>
                      </div>
                      <p className="text-xs text-gray-500 ml-6">{t('cart.sfFeeNote')}</p>
                    </Label>
                  </div>

                  {/* HK Post */}
                  <div className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    form.shippingMethod === "hk_post" ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-[#06038D]/40"
                  }`}>
                    <RadioGroupItem value="hk_post" id="hk_post_step1" className="mt-0.5 flex-shrink-0" />
                    <Label htmlFor="hk_post_step1" className="cursor-pointer flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Mail className="w-4 h-4 text-[#06038D] flex-shrink-0" />
                        <span className="font-bold text-sm text-gray-800">{t('cart.hkPost')}</span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">+HK$10</span>
                      </div>
                      <p className="text-xs text-gray-500 ml-6">{t('cart.hkPostFeeNote')}</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {/* ── Step 2: Address ── */}
          {checkoutStep === 2 && (
            <>
              {/* Saved Addresses */}
              {savedAddresses && savedAddresses.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-[#06038D] mb-2 block">{t("cart.address.savedAddresses")}</Label>
                  <div className="space-y-2">
                    {savedAddresses.filter((addr: any) =>
                      form.shippingMethod === "sf_cod" ? addr.addressType === "sf_station" : addr.addressType === "normal"
                    ).map((addr: any) => (
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
                              {addr.label && addr.label !== t('cart.defaultAddress') && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{addr.label}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />{addr.phone}
                            </p>
                            {addr.addressType === "sf_station" ? (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Truck className="w-3 h-3" />{t('cart.sfPickup', { name: addr.sfStationName || addr.sfStationCode })}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />{addr.address || t('cart.address')}
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
                    {t('cart.manualAddress')}
                  </button>
                </div>
              )}

              {/* No saved addresses - quick link to profile */}
              {(!savedAddresses || savedAddresses.filter((addr: any) =>
                form.shippingMethod === "sf_cod" ? addr.addressType === "sf_station" : addr.addressType === "normal"
              ).length === 0) && (
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
                    {t('cart.goToProfileAddAddress')}
                  </a>
                </div>
              )}

              {/* Manual Address Fields */}
              {selectedAddressId === null && (<>
                {/* SF COD Details */}
                {form.shippingMethod === "sf_cod" && (
                  <div className="space-y-3 p-4 bg-[#06038D]/5 rounded-xl border border-[#06038D]/20">
                    {/* SF Notice */}
                    <div className="text-xs text-gray-600 bg-white rounded-lg p-3 border border-[#06038D]/10">
                      <p className="font-semibold text-[#06038D] mb-1">{t('cart.sfTermsTitle')}</p>
                      <p className="leading-relaxed">{t('cart.sfTerms1')}</p>
                      <p className="mt-1 leading-relaxed">{t('cart.sfTerms2')}</p>
                    </div>

                    {/* Recipient Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">{t('cart.recipientName')}</Label>
                        <Input
                          placeholder={t('cart.recipientNamePlaceholder')}
                          value={form.recipientName}
                          onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                          className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">{t('cart.contactPhone')}</Label>
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
                      <Label className="text-xs text-gray-600 mb-2 block">{t('cart.addressMethod')}</Label>
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
                          <span>{t('cart.sfStation')}</span>
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
                          <span>{t('cart.manualInput')}</span>
                        </button>
                      </div>
                    </div>

                    {/* SF Station Selection */}
                    {sfAddressMode === "sf_station" && (
                      <>
                        <div>
                          <Label className="text-xs text-gray-600 mb-1 block">{t('cart.sfRegion')}</Label>
                          <Select
                            value={form.sfDistrict}
                            onValueChange={(v) => setForm((f) => ({ ...f, sfDistrict: v, sfStationCode: null }))}
                          >
                            <SelectTrigger className="text-sm h-9 border-[#06038D]/30 text-gray-900">
                              <SelectValue placeholder={t('cart.selectDistrict')} />
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
              {t('cart.sfStationLabel')}
              {form.sfDistrict && (
                <span className="ml-1 text-gray-400">（{filteredStations.length} 個）</span>
                              )}
                            </Label>
                            <Select
                              value={form.sfStationCode ?? ""}
                              onValueChange={(v) => setForm((f) => ({ ...f, sfStationCode: v }))}
                          >
                            <SelectTrigger className="text-sm h-9 border-[#06038D]/30 text-gray-900">
                              <SelectValue placeholder={t('cart.selectSfStation')} />
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
                      <Label className="text-xs text-gray-600 mb-1 block">{t('cart.detailedAddress')}</Label>
                      <Input
                        placeholder={t('cart.addressPlaceholder')}
                        value={form.manualAddress}
                        onChange={(e) => setForm((f) => ({ ...f, manualAddress: e.target.value }))}
                        className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                      />
                      <p className="text-xs text-gray-400 mt-1">{t('cart.sfDeliveryAddressNote')}</p>
                    </div>
                  )}
                </div>
              )}

                {/* HK Post Address */}
                {form.shippingMethod === "hk_post" && (
                  <div className="space-y-3 p-4 bg-[#06038D]/5 rounded-xl border border-[#06038D]/20">
                    <div className="text-xs text-gray-600 bg-white rounded-lg p-3 border border-[#06038D]/10">
                      <p className="font-semibold text-[#06038D] mb-1">{t('cart.hkPostTitle')}</p>
                      <p className="leading-relaxed">{t('cart.hkPostFeeNote')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">{t('cart.recipientName')}</Label>
                        <Input
                          placeholder={t('cart.recipientNamePlaceholder')}
                          value={form.hkPostRecipientName}
                          onChange={(e) => setForm((f) => ({ ...f, hkPostRecipientName: e.target.value }))}
                          className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">{t('cart.contactPhone')}</Label>
                        <Input
                          placeholder="+852 XXXX XXXX"
                          value={form.hkPostRecipientPhone}
                          onChange={(e) => setForm((f) => ({ ...f, hkPostRecipientPhone: e.target.value }))}
                          className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">{t('cart.deliveryAddress')}</Label>
                      <Input
                        placeholder={t('cart.addressPlaceholder')}
                        value={form.hkPostAddress}
                        onChange={(e) => setForm((f) => ({ ...f, hkPostAddress: e.target.value }))}
                        className="text-sm h-9 border-[#06038D]/30 focus:border-[#06038D] text-gray-900 placeholder:text-gray-400"
                      />
                      <p className="text-xs text-gray-400 mt-1">{t('cart.fullAddressNote')}</p>
                    </div>
                  </div>
                )}
              </>)}

            </>
          )}

          {/* ── Step 3: Payment + Summary ── */}
          {checkoutStep === 3 && (
            <>
              {/* Order Summary */}
              <div className="bg-[#06038D]/5 rounded-xl border border-[#06038D]/20 p-4 space-y-2">
                <p className="text-xs font-semibold text-[#06038D] mb-2">{t("cart.summary")}</p>
                {activeItems.map((item) => (
                  <div key={item.listingId} className="flex justify-between text-sm text-gray-700">
                    <span className="truncate flex-1 mr-2">
                      {item.title}
                      {item.acceptedOfferId && (
                        <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded font-medium">{t('cart.offerPrice')}</span>
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
                        <span className="truncate flex-1 mr-2">🏆 {t('cart.auctionWon')} #{o.orderNo}</span>
                        <span className="flex-shrink-0 font-medium">HK${parseFloat(String(o.subtotalHkd)).toFixed(0)}</span>
                      </div>
                    ))}
                  </>
                )}
                {form.shippingMethod === "hk_post" && (
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>📮 {t('cart.hkPostShipping')}</span>
                    <span className="font-medium">+HK${HK_POST_FEE}</span>
                  </div>
                )}
                <div className="border-t border-[#06038D]/20 pt-2 mt-2 flex justify-between font-bold text-[#06038D]">
                  <span>{form.shippingMethod === "hk_post" ? t('cart.totalWithShipping') : t('cart.totalExcludeShipping')}</span>
                  <span>HK${(activeSubtotal + (pendingAuctionOrders ?? []).reduce((s: number, o: { subtotalHkd: string | number }) => s + parseFloat(String(o.subtotalHkd)), 0) + (form.shippingMethod === "hk_post" ? HK_POST_FEE : 0)).toFixed(0)}</span>
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
                  <Mail className="w-4 h-4 text-[#06038D] mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {selectedAddressId !== null ? (
                    (() => {
                      const selAddr = savedAddresses?.find((a: any) => a.id === selectedAddressId);
                      const isSfStation = selAddr?.addressType === "sf_station";
                      return (
                        <>
                          <p className="text-xs font-semibold text-gray-700">
                            {isSfStation ? t('cart.sfCodLabel') : t('cart.hkPostLabel')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {selAddr?.recipientName} · {selAddr?.phone}
                            {isSfStation
                              ? ` · ${t('cart.sfStationShort')}：${selAddr?.sfStationName || selAddr?.sfStationCode}`
                              : selAddr?.address ? ` · ${selAddr.address}` : ""}
                          </p>
                        </>
                      );
                    })()
                  ) : (
                  <>
                  <p className="text-xs font-semibold text-gray-700">
                    {form.shippingMethod === "sf_cod" ? t('cart.sfCodLabel') : t('cart.hkPostPlusLabel')}
                  </p>
                  {form.shippingMethod === "sf_cod" && selectedStation && (
                    <p className="text-xs text-gray-500 mt-0.5">{form.recipientName} · {form.recipientPhone} · {selectedStation.name}</p>
                  )}
                  {form.shippingMethod === "sf_cod" && sfAddressMode === "manual" && form.manualAddress && (
                    <p className="text-xs text-gray-500 mt-0.5">{form.recipientName} · {form.recipientPhone} · {form.manualAddress}</p>
                  )}
                  {form.shippingMethod === "hk_post" && (
                    <p className="text-xs text-gray-500 mt-0.5">{form.hkPostRecipientName} · {form.hkPostRecipientPhone} · {form.hkPostAddress}</p>
                  )}
                  </>
                  )}
                </div>
              </div>


              {/* Payment Method */}
              <div>
                <Label className="text-xs font-semibold text-[#06038D] mb-2 block">{t('cart.paymentMethod')}</Label>
                {/* P0: Show restriction notice if cart has seller items */}
                {hasSellerItems && (
                  <div className="flex items-start gap-2 p-3 mb-2 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      {t('cart.sellerItemsPaymentNotice')}
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
                  <div className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    hasSellerItems
                      ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      : form.paymentMethod === "alipay_hk"
                        ? "border-[#06038D] bg-[#06038D]/5 cursor-pointer"
                        : "border-gray-200 hover:border-[#06038D]/40 cursor-pointer"
                  }`}>
                    <RadioGroupItem value="alipay_hk" id="alipay_hk2" className="shrink-0" disabled={hasSellerItems} />
                    <Label htmlFor="alipay_hk2" className={`flex-1 min-w-0 ${hasSellerItems ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-6 w-auto object-contain" style={{maxWidth:'80px'}} />
                        <div className="text-center">
                          <div className="font-semibold text-sm text-gray-700">{t('cart.alipayHkLabel')}</div>
                          <div className="text-xs text-gray-400">AlipayHK</div>
                        </div>
                        {hasSellerItems && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">{t('cart.unavailable')}</span>
                        )}
                      </div>
                      {hasSellerItems ? (
                        <p className="text-xs text-amber-600 mt-1.5 text-center">{t('cart.alipaySellerItemsDisabled')}</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1.5 text-center">{t('cart.scanQrToPay')}</p>
                      )}
                    </Label>
                  </div>
                  {/* Stripe option — always available */}
                  <div className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    form.paymentMethod === "stripe" ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-[#06038D]/40"
                  }`}>
                    <RadioGroupItem value="stripe" id="stripe2" className="shrink-0" />
                    <Label htmlFor="stripe2" className="cursor-pointer flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1.5">
                        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/visa-mastercard-logo_9a6481e0.png" alt="Visa Mastercard" className="h-6 w-auto object-contain" style={{maxWidth:'80px'}} />
                        <div className="text-center">
                          <div className="font-semibold text-sm text-gray-800">{t('cart.creditCard')}</div>
                          <div className="text-xs text-gray-400">Stripe</div>
                        </div>
                        {hasSellerItems && (
                          <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">{t('cart.recommended')}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5 text-center">{t('cart.creditCardNote')}</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {(activeItems.length > 1 || (pendingAuctionOrders && pendingAuctionOrders.length > 0)) && form.paymentMethod === "stripe" && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    {activeItems.length > 0 && t('cart.marketplaceItemsCount', { count: activeItems.length })}
                    {activeItems.length > 0 && pendingAuctionOrders && pendingAuctionOrders.length > 0 && t('cart.and')}
                    {pendingAuctionOrders && pendingAuctionOrders.length > 0 && t('cart.auctionItemsCount', { count: pendingAuctionOrders.length })}
                    {t('cart.createOrdersStripe', { total: (activeSubtotal + (pendingAuctionOrders ?? []).reduce((s, o) => s + parseFloat(String(o.subtotalHkd)), 0)).toFixed(0) })}
                  </p>
                </div>
              )}
              {activeItems.length > 1 && form.paymentMethod === "alipay_hk" && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    {t('cart.createOrdersAlipay', { count: activeItems.length, total: activeSubtotal.toFixed(0) })}
                  </p>
                </div>
              )}

              {/* Terms agreement checkbox */}
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
                  agreeTerms
                    ? 'bg-[#06038D]/5 border-[#06038D]/30'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="relative flex-shrink-0 mt-0.5">
                  <Checkbox
                    id="agree-terms"
                    checked={agreeTerms}
                    onCheckedChange={(checked) => setAgreeTerms(checked === true)}
                    className="transition-all duration-200"
                  />
                </div>
                <div className="flex-1 flex items-start gap-2">
                  <label htmlFor="agree-terms" className="text-xs text-gray-700 cursor-pointer leading-relaxed select-none flex-1">
                    {t('cart.agreeTermsPrefix')}{" "}
                    <Link href="/auction/terms" target="_blank" className="text-[#06038D] underline hover:text-[#06038D]/80 font-medium">
                      {t('cart.termsLink')}
                    </Link>
                    {t('cart.agreeTermsSuffix')}
                  </label>
                  {/* Animated check icon on agree */}
                  <div
                    className={`transition-all duration-300 flex-shrink-0 ${
                      agreeTerms ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-[#06038D]" />
                  </div>
                </div>
              </div>

              {batchProgress && (
                <div className="bg-[#06038D]/5 rounded-xl border border-[#06038D]/20 p-3">
                  <div className="flex justify-between text-sm text-[#06038D] font-medium mb-2">
                    <span>{t('cart.creatingOrders')}</span>
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

          {/* ── Step 4: AlipayHK QR Code ── */}
          {checkoutStep === 4 && (
            <div className="space-y-4">
              {/* Amount summary */}
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-[#06038D] mb-2">{t('cart.orderCreatedAlipay')}</p>
                {activeItems.map((item) => (
                  <div key={item.listingId} className="flex justify-between text-sm text-gray-700 mb-1">
                    <span className="truncate flex-1 mr-2">{item.title}</span>
                    <span className="flex-shrink-0 font-medium">
                      {item.acceptedOfferPrice ? `HK$${Number(item.acceptedOfferPrice).toFixed(0)}` : `HK$${Number(item.priceHkd).toFixed(0)}`}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[#06038D]/20 pt-2 mt-2 flex justify-between font-bold text-[#06038D]">
                  <span>{t('cart.totalPayment')}</span>
                  <span className="text-lg">HK${activeSubtotal.toFixed(0)}</span>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center space-y-3">
                <p className="text-sm font-medium text-gray-700">{t('cart.scanAlipayQr')}</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ALIPAY_QR_URL)}`}
                  alt={t('cart.alipayQrAlt')}
                  className="w-52 h-52 mx-auto rounded-xl border-4 border-white shadow-lg"
                />
                <a href={ALIPAY_QR_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#06038D] hover:underline text-sm">
                  <Smartphone className="w-4 h-4" />{t('cart.openAlipayMobile')}
                </a>
              </div>

              {/* Reference note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-medium">{t('cart.paymentRemarkInstruction')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm font-bold tracking-wide flex-1">
                    {alipayOrderNos.length === 1 ? `#${alipayOrderNos[0]}` : t('cart.multipleOrders', { first: alipayOrderNos[0], count: alipayOrderNos.length })}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(alipayOrderNos.map(no => `#${no}`).join(" "));
                      toast.success(t('cart.orderNoCopied'));
                    }}
                    className="flex items-center gap-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3 h-3" />{t('cart.copy')}
                  </button>
                </div>
                <p className="text-amber-600 mt-1">{t('cart.alipayRemarkWarning')}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                <p>{t('cart.alipayCompleteInstruction')}</p>
              </div>
            </div>
          )}
          {/* Step 5: Upload Payment Proof */}
          {checkoutStep === 5 && (
            <div className="space-y-4">
              {proofSubmitted ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#06038D' }}>
                    <CheckCircle className="w-9 h-9 text-[#FEDD00]" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{t('cart.screenshotUploaded')}</h3>
                    <p className="text-sm text-gray-500">{t('cart.screenshotReviewNote')}</p>
                  </div>
                  <div className="w-full bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
                    <p className="font-medium mb-1">{t('cart.orderCreatedPendingReview')}</p>
                    <p>{t('cart.orderNo')}：{alipayOrderNos.length === 1 ? `#${alipayOrderNos[0]}` : alipayOrderNos.map(no => `#${no}`).join("、")}</p>
                    <p className="mt-1">{t('cart.checkOrderStatus')}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#06038D] mb-2">{t('cart.uploadAlipayScreenshot')}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{t('cart.uploadScreenshotInstruction')}</p>
                    <ul className="mt-2 space-y-1">
                      <li className="text-xs text-gray-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#06038D] flex-shrink-0" />{t('cart.payee')}：{t('cart.companyName')}</li>
                      <li className="text-xs text-gray-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#06038D] flex-shrink-0" />{t('cart.paymentAmount')}：HKD {activeSubtotal.toFixed(0)}</li>
                      <li className="text-xs text-gray-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#06038D] flex-shrink-0" />{t('cart.paymentStatus')}：{t('cart.paymentSuccess')}</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-amber-800 mb-1">{t('cart.orderNoConfirm')}</p>
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
                          <img src={proofPreview} alt={t('cart.paymentScreenshotPreview')} className="w-full max-h-64 object-contain rounded-lg" />
                          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">{t('cart.clickToChangeScreenshot')}</div>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                            <Upload className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-600">{t('cart.clickToUploadScreenshot')}</p>
                          <p className="text-xs text-gray-400 mt-1">{t('cart.uploadFileTypes')}</p>
                        </>
                      )}
                    </label>
                    <input id="proof-upload" type="file" accept="image/*" className="hidden" onChange={handleProofFileChange} />
                  </div>
                  {proofFile && (
                    <p className="text-xs text-gray-500 text-center">{t('cart.selectedFile', { name: proofFile.name, size: (proofFile.size / 1024).toFixed(0) })}</p>
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
            >{t('common.cancel')}</Button>
          )}
          {(checkoutStep === 2 || checkoutStep === 3) && (
            <Button
              variant="outline"
              className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white"
              onClick={() => {
                // If on step 2 and address has been filled, show confirmation
                const hasFilledAddress = checkoutStep === 2 && (
                  form.sfStationCode || form.recipientName || form.recipientPhone || form.manualAddress || form.hkPostAddress
                );
                if (hasFilledAddress) {
                  setShowBackConfirm(true);
                } else {
                  setCheckoutStep((checkoutStep - 1) as 1 | 2 | 3 | 4 | 5);
                }
              }}
              disabled={isProcessing}
            >{t('common.back')}</Button>
          )}
          {/* Back confirmation dialog */}
          {showBackConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowBackConfirm(false)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-bold text-gray-900 mb-2">{t('cart.goBackTitle')}</h3>
                <p className="text-sm text-gray-600 mb-5">{t('cart.goBackConfirm')}</p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-gray-200 text-gray-700 bg-white" onClick={() => setShowBackConfirm(false)}>{t('cart.continueFilling')}</Button>
                  <Button className="flex-1 font-bold" style={{background:'#06038D',color:'#fff'}} onClick={() => { setShowBackConfirm(false); setCheckoutStep(1); }}>{t('cart.confirmGoBack')}</Button>
                </div>
              </div>
            </div>
          )}
          {checkoutStep === 1 && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              disabled={!canProceedStep1}
              onClick={() => setCheckoutStep(2)}
            >{t('cart.nextFillAddress')}</Button>
          )}
          {checkoutStep === 2 && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              disabled={!canProceedStep2}
              onClick={() => setCheckoutStep(3)}
            >{t('cart.nextConfirmPayment')}</Button>
          )}
          {checkoutStep === 3 && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              onClick={handleCheckout}
              disabled={isProcessing || !!batchProgress || isValidatingStock || !agreeTerms}
            >
              {isValidatingStock
                ? t('cart.verifyingInventory')
                : batchProgress
                ? t('cart.creatingProgress', { done: batchProgress.done, total: batchProgress.total })
                : isProcessing
                ? t('cart.processing')
                : activeItems.length > 1
                ? t('cart.confirmCheckout', { count: activeItems.length })
                : t('cart.confirmCheckoutSimple')}
            </Button>
          )}
          {checkoutStep === 4 && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              onClick={handleAlipayDone}
            >
              {t('cart.paymentDoneUpload')}
            </Button>
          )}
          {checkoutStep === 5 && !proofSubmitted && (
            <Button
              variant="outline"
              className="flex-shrink-0 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white px-4"
              onClick={() => setCheckoutStep(4)}
              disabled={isSubmittingProof}
            >{t("cart.back")}</Button>
          )}
          {checkoutStep === 5 && !proofSubmitted && (
            <Button
              className="flex-1 font-bold"
              style={{ background: proofFile ? '#FEDD00' : '#e5e7eb', color: proofFile ? '#06038D' : '#9ca3af' }}
              onClick={handleSubmitProof}
              disabled={!proofFile || isSubmittingProof}
            >
              {isSubmittingProof ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('cart.uploading')}</span>
              ) : t('cart.submitPaymentScreenshot')}
            </Button>
          )}
          {checkoutStep === 5 && proofSubmitted && (
            <Button
              className="flex-1 font-bold"
              style={{ background: '#FEDD00', color: '#06038D' }}
              onClick={handleFinishAndGoToOrders}
            >{t('cart.goToMyOrders')}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
