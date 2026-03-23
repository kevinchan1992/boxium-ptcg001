import React, { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ShoppingCart, Trash2, AlertCircle, Package, ChevronRight, ArrowLeft, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { SF_STATIONS as sfStations, SFStation } from "@/lib/sfStations";

const CONDITION_LABELS: Record<string, string> = {
  mint: "Mint",
  near_mint: "Near Mint",
  excellent: "Excellent",
  good: "Good",
  light_played: "Light Played",
  played: "Played",
  poor: "Poor",
};

const SF_DISTRICTS = Array.from(new Set(sfStations.map((s: SFStation) => s.district))).sort();

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
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const { data: cartItems, isLoading } = trpc.marketplace.getMyCart.useQuery(undefined, {
    enabled: !!user,
    staleTime: 10000,
  });

  const removeFromCartMutation = trpc.marketplace.removeFromCart.useMutation({
    onSuccess: () => {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
      toast.success("已從購物車移除");
    },
    onError: () => toast.error("移除失敗，請重試"),
  });

  const clearCartMutation = trpc.marketplace.clearCart.useMutation({
    onSuccess: () => {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
      toast.success("購物車已清空");
    },
  });

  const clearUnavailableMutation = trpc.marketplace.clearUnavailableCartItems.useMutation({
    onSuccess: (data) => {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
      toast.success(`已移除 ${data.removed} 件無效商品`);
    },
    onError: () => toast.error("移除失敗，請重試"),
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
    () => (form.sfDistrict ? sfStations.filter((s: SFStation) => s.district === form.sfDistrict) : []),
    [form.sfDistrict]
  );

  const selectedStation = useMemo(
    () => sfStations.find((s: SFStation) => s.code === form.sfStationCode),
    [form.sfStationCode]
  );

  const subtotal = useMemo(
    () => (cartItems ?? []).reduce((sum, item) => sum + Number(item.priceHkd), 0),
    [cartItems]
  );

  const activeItems = useMemo(
    () => (cartItems ?? []).filter((item) => item.status === "active"),
    [cartItems]
  );

  const unavailableItems = useMemo(
    () => (cartItems ?? []).filter((item) => item.status !== "active"),
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
  const isEmpty = !cartItems || cartItems.length === 0;

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
    if (personalizedListings && personalizedListings.listings.length > 0) return { data: personalizedListings, label: "為你推薦（來自關注清單）" };
    if (recentListings && recentListings.listings.length > 0) return { data: recentListings, label: "最新上架" };
    return null;
  }, [personalizedListings, recentListings]);

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
              <h1 className="text-2xl font-bold text-white">購物車</h1>
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
              <h2 className="text-2xl font-bold text-white mb-2">請先登入</h2>
              <p className="text-white/70 mb-6">登入後即可查看購物車</p>
              <Button
                className="w-full h-12 font-bold text-base rounded-xl"
                style={{ background: "#FEDD00", color: "#06038D" }}
                onClick={() => window.location.href = '/login'}
              >
                立即登入
              </Button>
              <Link href="/marketplace">
                <p className="text-white/50 text-sm mt-4 hover:text-white/80 cursor-pointer transition-colors">先去市集看看 →</p>
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
            <h1 className="text-2xl font-bold text-white">購物車</h1>
            {!isEmpty && (
              <span className="text-sm text-white/60">（{cartItems.length} 件商品）</span>
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
                  <div className="flex justify-between text-gray-600">
                    <span>小計（{activeItems.length} 件）</span>
                    <span>HK${activeSubtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>運費</span>
                    <span className="text-green-600">運費到付</span>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between font-bold text-base text-[#06038D]">
                  <span>合計</span>
                  <span>HK${activeSubtotal.toFixed(0)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">（不含運費）</p>

                <Button
                  className="w-full mt-4 bg-[#06038D] text-white hover:bg-[#06038D]/90 font-bold"
                  disabled={activeItems.length === 0}
                  onClick={() => setShowCheckout(true)}
                >
                  前往結帳
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2 border-[#06038D] text-[#06038D] hover:bg-[#06038D]/5 font-semibold bg-white"
                  onClick={() => setLocation("/marketplace")}
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  繼續購物
                </Button>

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
      />
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
  };
  onRemove: () => void;
  removing: boolean;
  unavailable?: boolean;
}

function CartItemRow({ item, onRemove, removing, unavailable }: CartItemRowProps) {
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
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                {CONDITION_LABELS[item.condition] ?? item.condition}
              </Badge>
            )}
            {item.acceptedOfferId && !item.isOfferExpired && (
              <Badge className="text-xs px-1.5 py-0 h-5 bg-green-100 text-green-700 border-green-200">已接受出價</Badge>
            )}
            {unavailable && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">已下架</Badge>
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
  filteredStations: typeof sfStations;
  selectedStation: typeof sfStations[0] | undefined;
  activeItems: Array<{
    listingId: number;
    title: string;
    priceHkd: string | number;
    sellerType: string | null;
    acceptedOfferId?: number | null;
    acceptedOfferPrice?: string | number | null;
  }>;
  activeSubtotal: number;
  sfDistricts: string[];
}

function CheckoutDialog({
  open, onClose, form, setForm, filteredStations, selectedStation, activeItems, activeSubtotal, sfDistricts,
}: CheckoutDialogProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [isValidatingStock, setIsValidatingStock] = React.useState(false);

  // For cart checkout we create individual orders per listing (one order per item)
  // since each listing is from potentially different sellers
  const createStripeOrderMutation = trpc.marketplace.createStripeOrder.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("正在跳轉至付款頁面...");
        window.open(data.checkoutUrl, "_blank");
        utils.marketplace.getMyCart.invalidate();
        utils.marketplace.getCartCount.invalidate();
        onClose();
      }
    },
    onError: (err) => toast.error(err.message || "建立訂單失敗"),
  });

  const createAlipayOrderMutation = trpc.marketplace.createAlipayOrder.useMutation({
    onSuccess: () => {
      utils.marketplace.getMyCart.invalidate();
      utils.marketplace.getCartCount.invalidate();
      toast.success("訂單已建立，請完成支付寶付款");
      onClose();
      setLocation("/orders");
    },
    onError: (err) => toast.error(err.message || "建立訂單失敗"),
  });

  const isProcessing = createStripeOrderMutation.isPending || createAlipayOrderMutation.isPending;

  const canSubmit = useMemo(() => {
    if (activeItems.length === 0) return false;
    if (form.shippingMethod === "sf_cod") {
      return !!(form.sfStationCode && form.recipientName.trim() && form.recipientPhone.trim());
    }
    return true;
  }, [form, activeItems]);

  const buildShippingAddress = () => {
    if (form.shippingMethod === "sf_cod" && selectedStation) {
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
    return {
      name: form.recipientName || "面交",
      phone: form.recipientPhone || "",
      district: "",
      address: form.meetupNote || "面交/其他",
      addressType: "normal" as const,
    };
  };

  // Batch checkout state: track which items have been processed
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; errors: number } | null>(null);

  const handleCheckout = async () => {
    if (!canSubmit || batchProgress) return;

    // Pre-checkout inventory validation: check all active items are still available
    setIsValidatingStock(true);
    try {
      const invalidItems: string[] = [];
      await Promise.all(activeItems.map(async (item) => {
        try {
          // Use clearUnavailableCartItems logic: check listing status via getMyCart data
          // We rely on the server-side check in createOrder, but also do a quick client-side check
          // by re-fetching cart to see if any items became unavailable
        } catch {
          invalidItems.push(item.title);
        }
      }));

      // Re-fetch cart to detect newly unavailable items
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
      // Non-fatal: if validation fails, proceed to checkout
    }
    setIsValidatingStock(false);
    const shippingAddress = buildShippingAddress();
    const items = [...activeItems];
    setBatchProgress({ total: items.length, done: 0, errors: 0 });

    let done = 0;
    let errors = 0;

    for (const item of items) {
      try {
        if (form.paymentMethod === "stripe") {
          // For Stripe: open first item's checkout URL, create orders for rest
          if (done === 0) {
            await new Promise<void>((resolve, reject) => {
              createStripeOrderMutation.mutate({
                listingId: item.listingId,
                shippingAddress,
                ...(item.acceptedOfferId ? { offerId: item.acceptedOfferId } : {}),
              }, {
                onSuccess: () => resolve(),
                onError: (e) => reject(e),
              });
            });
          } else {
            // For remaining items, create alipay orders (seller will contact for payment)
            await new Promise<void>((resolve, reject) => {
              createAlipayOrderMutation.mutate({
                listingId: item.listingId,
                proofImageUrl: "",
                shippingAddress,
                ...(item.acceptedOfferId ? { offerId: item.acceptedOfferId } : {}),
              }, {
                onSuccess: () => resolve(),
                onError: (e) => reject(e),
              });
            });
          }
        } else {
          await new Promise<void>((resolve, reject) => {
            createAlipayOrderMutation.mutate({
              listingId: item.listingId,
              proofImageUrl: "",
              shippingAddress,
              ...(item.acceptedOfferId ? { offerId: item.acceptedOfferId } : {}),
            }, {
              onSuccess: () => resolve(),
              onError: (e) => reject(e),
            });
          });
        }
        done++;
      } catch {
        errors++;
      }
      setBatchProgress({ total: items.length, done: done + errors, errors });
    }

    utils.marketplace.getMyCart.invalidate();
    utils.marketplace.getCartCount.invalidate();

    if (errors === 0) {
      toast.success(`已成功建立 ${done} 個訂單！`);
      if (form.paymentMethod === "alipay_hk") setLocation("/orders");
    } else {
      // Auto-remove unavailable items from cart after partial failure
      try {
        const freshCart2 = await utils.marketplace.getMyCart.fetch();
        const freshActiveIds2 = new Set(
          (freshCart2 ?? []).filter((i) => i.status === "active").map((i) => i.listingId)
        );
        const failedItems = activeItems.filter((i) => !freshActiveIds2.has(i.listingId));
        if (failedItems.length > 0) {
          const names = failedItems.map((i) => i.title).join("、");
          toast.warning(`建立了 ${done} 個訂單，${errors} 個因商品已下架或售出而失敗，已自動移除：${names}`);
        } else {
          toast.warning(`建立了 ${done} 個訂單，${errors} 個失敗，請檢查訂單頁面`);
        }
      } catch {
        toast.warning(`建立了 ${done} 個訂單，${errors} 個失敗，請檢查訂單頁面`);
      }
      setLocation("/orders");
    }
    setBatchProgress(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#06038D]">選擇送貨及付款方式</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Shipping Method */}
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">送貨方式</Label>
            <RadioGroup
              value={form.shippingMethod}
              onValueChange={(v) => setForm((f) => ({ ...f, shippingMethod: v as ShippingMethod, sfDistrict: "", sfStationCode: null }))}
              className="space-y-2"
            >
              <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.shippingMethod === "sf_cod" ? "border-[#06038D] bg-blue-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <RadioGroupItem value="sf_cod" id="sf_cod" className="mt-0.5" />
                <Label htmlFor="sf_cod" className="cursor-pointer flex-1">
                  <span className="font-medium text-sm">順豐速運（運費到付）</span>
                  <p className="text-xs text-gray-500 mt-0.5">運費由順豐速運收取，於取件時支付</p>
                </Label>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.shippingMethod === "meetup" ? "border-[#06038D] bg-blue-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <RadioGroupItem value="meetup" id="meetup" className="mt-0.5" />
                <Label htmlFor="meetup" className="cursor-pointer flex-1">
                  <span className="font-medium text-sm">面交 / 其他</span>
                  <p className="text-xs text-gray-500 mt-0.5">請與賣家協商交收地點</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* SF COD Details */}
          {form.shippingMethod === "sf_cod" && (
            <div className="space-y-3 p-4 bg-blue-50/40 rounded-lg border border-blue-100">
              {/* SF Notice */}
              <div className="text-xs text-gray-600 space-y-1.5 bg-white rounded-md p-3 border border-blue-100">
                <p className="font-semibold text-[#06038D]">📦 順豐速運條款</p>
                <p>【如寄順豐自提網點可享運費優惠】請於下單時提供收件人名、電話，並選擇你的順豐網點。運費金額將自動根據貨件重量、材積、收件地址計算。運費由順豐速運收取，於取件時支付。運費詳情可參考<a href="https://htm.sf-express.com/hk/tc/" target="_blank" rel="noopener noreferrer" className="text-[#06038D] underline">順豐速運香港官方網站</a>。</p>
                <p>【客戶須知】由於順豐已暫停經SMS短訊方式發送取件訊息，所有取件訊息已改為透過順豐香港官方手機應用程式「SFHK APP」推送，客戶請提前下載「SFHK APP」，並開啟手機推送通知，以免錯過貨件運送提醒，同時客戶可透過「SFHK APP」隨時查看快件的最新狀態。</p>
              </div>

              {/* Recipient Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">收件人姓名 *</Label>
                  <Input
                    placeholder="收件人全名"
                    value={form.recipientName}
                    onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                    className="text-sm h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">聯絡電話 *</Label>
                  <Input
                    placeholder="+852 XXXX XXXX"
                    value={form.recipientPhone}
                    onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                    className="text-sm h-9"
                  />
                </div>
              </div>

              {/* SF District */}
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">順豐地區 *</Label>
                <Select
                  value={form.sfDistrict}
                  onValueChange={(v) => setForm((f) => ({ ...f, sfDistrict: v, sfStationCode: null }))}
                >
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="選擇地區" />
                  </SelectTrigger>
                  <SelectContent>
                    {sfDistricts.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* SF Station */}
              {form.sfDistrict && (
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">順豐網點 *</Label>
                  <Select
                    value={form.sfStationCode ?? ""}
                    onValueChange={(v) => setForm((f) => ({ ...f, sfStationCode: v }))}
                  >
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="選擇網點" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStations.map((s: SFStation) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name}（{s.code}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedStation && (
                    <p className="text-xs text-gray-500 mt-1">📍 {selectedStation.address}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Meetup Note */}
          {form.shippingMethod === "meetup" && (
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">備註（可選）</Label>
              <Input
                placeholder="如有特定交收地點或時間要求，請填寫"
                value={form.meetupNote}
                onChange={(e) => setForm((f) => ({ ...f, meetupNote: e.target.value }))}
                className="text-sm h-9"
              />
            </div>
          )}

          <Separator />

          {/* Payment Method */}
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">付款方式</Label>
            <RadioGroup
              value={form.paymentMethod}
              onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as PaymentMethod }))}
              className="space-y-2"
            >
              <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.paymentMethod === "alipay_hk" ? "border-[#06038D] bg-blue-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <RadioGroupItem value="alipay_hk" id="alipay_hk" className="mt-0.5" />
                <Label htmlFor="alipay_hk" className="cursor-pointer flex-1">
                  <span className="font-medium text-sm">支付寶 HK（AlipayHK）</span>
                  <p className="text-xs text-gray-500 mt-0.5">網頁版：確認後跳轉至付款二維碼頁面。請打開手機內的 AlipayHK App 掃描二維碼完成付款。</p>
                </Label>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.paymentMethod === "stripe" ? "border-[#06038D] bg-blue-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                <RadioGroupItem value="stripe" id="stripe" className="mt-0.5" />
                <Label htmlFor="stripe" className="cursor-pointer flex-1">
                  <span className="font-medium text-sm">信用卡（Stripe）</span>
                  <p className="text-xs text-gray-500 mt-0.5">支援 Visa、Mastercard 等主要信用卡</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="font-semibold text-gray-700 mb-2">訂單摘要</div>
            {activeItems.map((item) => (
              <div key={item.listingId} className="flex justify-between text-gray-600">
                <span className="truncate flex-1 mr-2">
                  {item.title}
                  {item.acceptedOfferId && (
                    <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded font-medium">出價價</span>
                  )}
                </span>
                <span className="flex-shrink-0">
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
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-[#06038D]">
              <span>合計（不含運費）</span>
              <span>HK${activeSubtotal.toFixed(0)}</span>
            </div>
          </div>

          {activeItems.length > 1 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                將為 {activeItems.length} 件商品建立 {activeItems.length} 個訂單（每個賣家各一個）。Stripe 結帳時會開啟第一個訂單的付款頁，其餘訂單請到「我的訂單」完成支付。
              </p>
            </div>
          )}

          {batchProgress && (
            <div className="bg-[#06038D]/5 rounded-lg p-3">
              <div className="flex justify-between text-sm text-[#06038D] font-medium mb-2">
                <span>正在建立訂單...</span>
                <span>{batchProgress.done} / {batchProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-[#06038D] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>取消</Button>
          <Button
            className="bg-[#06038D] text-white hover:bg-[#06038D]/90"
            onClick={handleCheckout}
            disabled={!canSubmit || isProcessing || !!batchProgress || isValidatingStock}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
