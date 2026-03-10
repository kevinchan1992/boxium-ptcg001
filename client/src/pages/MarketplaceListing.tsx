import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, CreditCard, Smartphone, Package, Star, Shield, Truck,
  AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Loader2, HelpCircle, Tag, Flag, TrendingUp, TrendingDown, Minus,
  ExternalLink, Heart, ZoomIn, MessageSquare, ShoppingCart, ChevronDown,
  ChevronUp, Store, X, Clock
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CONDITION_BADGE, CONDITION_FULL, CONDITION_TOOLTIP, CONDITION_GROUP_COLOR, CONDITION_GROUPS, type ConditionValue } from "@/lib/conditions";

const ALIPAY_QR_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";

function getConditionGroup(condition: string): string {
  for (const g of CONDITION_GROUPS) {
    if (g.items.some(i => i.value === condition)) return g.group;
  }
  return "";
}

// ─── Image Gallery ─────────────────────────────────────────────────────────────

function ListingImageGallery({ images, title }: { images: string[] | null; title: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgs = images && images.length > 0 ? images : null;

  if (!imgs) {
    return (
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center border border-gray-200">
        <div className="text-center text-gray-400">
          <Package className="w-16 h-16 mx-auto mb-2 opacity-30" />
          <p className="text-sm">商品圖片</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div
        className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-gray-200 group cursor-zoom-in shadow-sm"
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src={imgs[activeIdx]}
          alt={`${title} - 圖片 ${activeIdx + 1}`}
          className="w-full h-full object-contain p-4"
        />
        {/* Zoom hint */}
        <div className="absolute bottom-3 right-3 bg-black/40 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="w-3 h-3" />點擊放大
        </div>
        {imgs.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); setActiveIdx(i => (i - 1 + imgs.length) % imgs.length); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-md text-gray-700 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setActiveIdx(i => (i + 1) % imgs.length); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-md text-gray-700 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* Image counter */}
            <div className="absolute bottom-3 left-3 bg-black/40 text-white rounded-full px-2 py-0.5 text-xs">
              {activeIdx + 1} / {imgs.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {imgs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {imgs.map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeIdx
                  ? "border-[#06038D] shadow-md scale-105"
                  : "border-gray-200 hover:border-[#06038D]/50"
              }`}
            >
              <img src={url} alt={`縮圖 ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 rounded-full p-2"
            onClick={() => setLightboxOpen(false)}
          >
            <XCircle className="w-6 h-6" />
          </button>
          <img
            src={imgs[activeIdx]}
            alt={title}
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          {imgs.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setActiveIdx(i => (i - 1 + imgs.length) % imgs.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full p-2"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setActiveIdx(i => (i + 1) % imgs.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full p-2"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SNKRDUNK Price Block ──────────────────────────────────────────────────────

function SnkrdunkPriceBlock({ cardId, listingPriceHkd }: { cardId: number; listingPriceHkd: number }) {
  const [days, setDays] = useState(7);

  const { data: history, isLoading } = trpc.prices.getHistory.useQuery(
    { cardId, source: "snkrdunk", limit: 100, days: 90 },
    { enabled: !!cardId }
  );

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const filtered = history.filter(h => h.soldAt && new Date(h.soldAt) >= cutoff);
    const byDate: Record<string, number[]> = {};
    for (const h of filtered) {
      if (!h.soldAt) continue;
      const d = new Date(h.soldAt).toLocaleDateString("zh-HK", { month: "2-digit", day: "2-digit" });
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(parseFloat(h.price as string));
    }
    return Object.entries(byDate)
      .map(([date, prices]) => ({
        date,
        avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
        count: prices.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [history, days]);

  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const recent = history.filter(h => h.soldAt && new Date(h.soldAt) >= cutoff);
    if (recent.length === 0) return null;
    const prices = recent.map(h => parseFloat(h.price as string));
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const now = new Date();
    const d7 = new Date(); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(); d14.setDate(d14.getDate() - 14);
    const last7 = history.filter(h => h.soldAt && new Date(h.soldAt) >= d7);
    const prev7 = history.filter(h => h.soldAt && new Date(h.soldAt) >= d14 && new Date(h.soldAt) < d7);
    let trend: "up" | "down" | "flat" = "flat";
    let trendPct = 0;
    if (last7.length > 0 && prev7.length > 0) {
      const avgLast = last7.reduce((s, h) => s + parseFloat(h.price as string), 0) / last7.length;
      const avgPrev = prev7.reduce((s, h) => s + parseFloat(h.price as string), 0) / prev7.length;
      trendPct = ((avgLast - avgPrev) / avgPrev) * 100;
      if (trendPct > 2) trend = "up";
      else if (trendPct < -2) trend = "down";
    }
    return { avg, min, max, count: recent.length, trend, trendPct };
  }, [history]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-5 rounded-full bg-[#06038D]" />
          <h3 className="font-semibold text-sm text-[#06038D]">SNKRDUNK 市場參考價</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>載入中...</span>
        </div>
      </div>
    );
  }

  if (!stats || chartData.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-5 rounded-full bg-[#06038D]" />
          <h3 className="font-semibold text-sm text-[#06038D]">SNKRDUNK 市場參考價</h3>
        </div>
        <p className="text-sm text-gray-400">暫無 SNKRDUNK 近期交易數據</p>
      </div>
    );
  }

  const TrendIcon = stats.trend === "up" ? TrendingUp : stats.trend === "down" ? TrendingDown : Minus;
  const trendColor = stats.trend === "up" ? "text-green-600" : stats.trend === "down" ? "text-red-500" : "text-gray-500";
  const vsListing = ((listingPriceHkd - stats.avg) / stats.avg) * 100;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="bg-gradient-to-r from-[#06038D] to-[#1a18c4] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendIcon className="w-4 h-4 text-white" />
          <span className="text-white font-semibold text-sm">SNKRDUNK 市場參考價</span>
        </div>
        <a
          href={`https://snkrdunk.com/en/trading-cards/search?q=`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-white/70 hover:text-white text-xs transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>SNKRDUNK</span>
        </a>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center bg-[#06038D]/5 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-0.5">30天均價</p>
            <p className="text-lg font-bold text-[#06038D]">HKD {Math.round(stats.avg).toLocaleString()}</p>
          </div>
          <div className="text-center bg-green-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-0.5">最低</p>
            <p className="text-base font-semibold text-green-600">HKD {Math.round(stats.min).toLocaleString()}</p>
          </div>
          <div className="text-center bg-red-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-0.5">最高</p>
            <p className="text-base font-semibold text-red-500">HKD {Math.round(stats.max).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span>7天趨勢：{stats.trend === "flat" ? "持平" : `${stats.trendPct > 0 ? "+" : ""}${stats.trendPct.toFixed(1)}%`}</span>
          </div>
          {Math.abs(vsListing) > 1 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              vsListing > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              比市場均價{vsListing > 0 ? "低" : "高"} {Math.abs(vsListing).toFixed(1)}%
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">成交走勢</span>
            <div className="flex gap-1">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                    days === d ? "bg-[#06038D] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <RechartsTooltip
                  formatter={(value: number) => [`HKD ${value.toLocaleString()}`, "均價"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <ReferenceLine y={listingPriceHkd} stroke="#FEDD00" strokeDasharray="4 2" strokeWidth={2} label={{ value: "此商品", fontSize: 10, fill: "#06038D" }} />
                <Line type="monotone" dataKey="avg" stroke="#06038D" strokeWidth={2} dot={{ r: 3, fill: "#06038D" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">此時間範圍內數據不足，請選擇更長時間範圍</p>
          )}
        </div>

        <p className="text-xs text-gray-400">數據來源：SNKRDUNK · 近 {days} 天 {chartData.reduce((s, d) => s + d.count, 0)} 筆成交記錄</p>
      </div>
    </div>
  );
}

// ─── Seller Reviews ────────────────────────────────────────────────────────────

function SellerReviewsSection({ sellerId }: { sellerId: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data } = trpc.marketplace.getSellerReviews.useQuery(
    { sellerId, page: 1, pageSize: 5 },
    { enabled: !!sellerId }
  );
  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  if (total === 0) return (
    <div className="text-sm text-gray-400 py-4 text-center">此賣家暫無評價記錄</div>
  );
  const shown = expanded ? reviews : reviews.slice(0, 3);
  return (
    <div className="space-y-3">
      {shown.map((r: any) => (
        <div key={r.id} className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "fill-[#FEDD00] text-[#FEDD00]" : "text-gray-200"}`} />
              ))}
            </div>
            <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("zh-HK")}</span>
          </div>
          {r.comment && <p className="text-gray-700">{r.comment}</p>}
        </div>
      ))}
      {total > 3 && (
        <button
          className="text-xs text-[#06038D] hover:underline font-medium"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? "收起" : `查看全部 ${total} 則評價`}
        </button>
      )}
    </div>
  );
}

// ─── Seller Other Listings ──────────────────────────────────────────────────────

function SellerOtherListings({ sellerId, currentListingId }: { sellerId: number; currentListingId: number }) {
  const [, setLocation] = useLocation();
  const { data } = trpc.marketplace.getListings.useQuery({
    page: 1,
    pageSize: 6,
  });
  // Filter to same seller, exclude current listing
  const others = (data?.listings ?? []).filter(
    (l: any) => l.sellerId === sellerId && l.id !== currentListingId
  ).slice(0, 4);

  if (others.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-[#06038D] mb-3 flex items-center gap-2">
        <Store className="w-4 h-4" />
        同一賣家的其他商品
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {others.map((l: any) => {
          const imgs = (() => { try { return l.images ? JSON.parse(l.images) : null; } catch { return null; } })();
          const cover = imgs?.[0];
          return (
            <button
              key={l.id}
              onClick={() => setLocation(`/marketplace/${l.id}`)}
              className="shrink-0 w-32 bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#FEDD00] hover:shadow-md transition-all text-left"
            >
              <div className="aspect-square bg-gray-50 overflow-hidden">
                {cover
                  ? <img src={cover} alt={l.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>
                }
              </div>
              <div className="p-2">
                <p className="text-xs text-gray-800 line-clamp-2 leading-snug">{l.title}</p>
                <p className="text-xs font-bold text-[#06038D] mt-1">HK${Number(l.priceHkd).toLocaleString()}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Verify Result Type ────────────────────────────────────────────────────────

type VerifyResult = {
  verified: boolean;
  payeeVerified: boolean;
  detectedPayee: string | null;
  amountVerified: boolean;
  detectedAmount: number | null;
  currency: string | null;
  statusVerified: boolean;
  detectedStatus: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function MarketplaceListing() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [showAlipay, setShowAlipay] = useState(false);
  const [completedOrderNo, setCompletedOrderNo] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [alipayStep, setAlipayStep] = useState<"qr" | "shipping" | "upload" | "done">("qr");
  const [alipayShippingForm, setAlipayShippingForm] = useState({ name: "", phone: "", address: "", district: "", region: "香港" });
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [showShippingDialog, setShowShippingDialog] = useState(false);
  const [shippingForm, setShippingForm] = useState({ name: "", phone: "", address: "", district: "", region: "香港" });
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<number | null>(null);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [activeTab, setActiveTab] = useState<"price" | "desc" | "reviews">("price");
  const [isWishlisted, setIsWishlisted] = useState(false);

  const { data: me } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const { data: savedAddresses } = trpc.marketplace.getMyShippingAddresses.useQuery(
    undefined,
    { enabled: !!me }
  );

  useEffect(() => {
    if (showShippingDialog && savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find((a: any) => a.isDefault) || savedAddresses[0];
      if (defaultAddr && !shippingForm.name) {
        setShippingForm({ name: defaultAddr.recipientName, phone: defaultAddr.phone, address: defaultAddr.address, district: defaultAddr.district || "", region: defaultAddr.region });
        setSelectedSavedAddressId(defaultAddr.id);
      }
    }
  }, [showShippingDialog, savedAddresses]);

  const { data: listing, isLoading } = trpc.marketplace.getListing.useQuery(
    { id },
    { enabled: !!id }
  );

  const { data: wishlistIds = [] } = trpc.marketplace.getWishlistIds.useQuery(undefined, { enabled: !!me });
  const toggleWishlistMutation = trpc.marketplace.toggleWishlist.useMutation({
    onSuccess: (res) => {
      setIsWishlisted(res.wishlisted);
      toast.success(res.wishlisted ? "已加入收藏" : "已移除收藏");
      utils.marketplace.getWishlistIds.invalidate();
    },
    onError: () => toast.error("請先登入才能收藏"),
  });

  useEffect(() => {
    if (listing && wishlistIds) {
      setIsWishlisted((wishlistIds as number[]).includes(listing.id));
    }
  }, [listing, wishlistIds]);

  // SEO meta tags
  useEffect(() => {
    if (!listing) return;
    const price = parseFloat(listing.priceHkd as string);
    const rawImages = listing.images;
    const images: string[] | null = (() => {
      if (!rawImages) return null;
      if (Array.isArray(rawImages)) return rawImages as string[];
      if (typeof rawImages === "string") {
        try { const parsed = JSON.parse(rawImages); return Array.isArray(parsed) ? parsed : null; } catch { return null; }
      }
      return null;
    })();
    const imageUrl = images && images.length > 0 ? images[0] : "";
    const title = `${listing.title} - HKD ${price.toFixed(2)} | BOXIUM PTCG`;
    const description = listing.description
      ? `${listing.description.slice(0, 120)}${listing.description.length > 120 ? "..." : ""} | HKD ${price.toFixed(2)}`
      : `商品狀況：${listing.condition} | 價格：HKD ${price.toFixed(2)} | BOXIUM PTCG 卡牌商城`;
    document.title = title;
    const setMeta = (property: string, content: string, useProperty = true) => {
      const attr = useProperty ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, property); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const pageUrl = window.location.href;
    setMeta("og:title", title); setMeta("og:description", description); setMeta("og:url", pageUrl);
    setMeta("og:type", "product"); setMeta("og:site_name", "BOXIUM PTCG");
    if (imageUrl) setMeta("og:image", imageUrl);
    setMeta("og:price:amount", price.toFixed(2)); setMeta("og:price:currency", "HKD");
    setMeta("twitter:card", imageUrl ? "summary_large_image" : "summary", false);
    setMeta("twitter:title", title, false); setMeta("twitter:description", description, false);
    if (imageUrl) setMeta("twitter:image", imageUrl, false);
    return () => { document.title = "BOXIUM PTCG"; };
  }, [listing]);

  const createStripeOrderMutation = trpc.marketplace.createStripeOrder.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) { window.open(data.checkoutUrl, "_blank"); toast.success("正在跳轉到 Stripe 付款頁面..."); }
    },
    onError: (e) => toast.error(e.message),
  });

  const makeOfferMutation = trpc.marketplace.makeOffer.useMutation({
    onSuccess: () => {
      toast.success("出價已送出！賣家將盡快回覆。");
      setShowOfferDialog(false); setOfferAmount(""); setOfferMessage("");
      utils.marketplace.getMyOfferForListing.invalidate({ listingId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: myPendingOffer } = trpc.marketplace.getMyOfferForListing.useQuery(
    { listingId: id },
    { enabled: !!me && !!id }
  );

  const reportListingMutation = trpc.marketplace.reportListing.useMutation({
    onSuccess: () => {
      toast.success("舉報已提交，我們將盡快審核。");
      setShowReportDialog(false); setReportReason(""); setReportDetails("");
    },
    onError: (e) => toast.error(e.message),
  });

  const createAlipayOrderMutation = trpc.marketplace.createAlipayOrder.useMutation({
    onSuccess: (data) => { setCompletedOrderNo(data.orderNo); setAlipayStep("done"); },
    onError: (e) => toast.error(e.message),
  });

  const verifyPaymentProofMutation = trpc.marketplace.verifyPaymentProof.useMutation({
    onSuccess: (data) => {
      setVerifyResult(data as VerifyResult); setIsVerifying(false);
      if (data.verified) toast.success("✅ 付款金額驗證成功！");
      else toast.error("⚠️ 付款金額不符，請重新確認");
    },
    onError: (e) => { setIsVerifying(false); toast.error("驗證失敗：" + e.message); },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("截圖不能超過 5MB"); return; }
    setIsUploading(true); setVerifyResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-payment-proof", { method: "POST", body: formData });
      if (!res.ok) throw new Error("上傳失敗");
      const { url } = await res.json();
      setProofUrl(url);
      toast.success("截圖已上傳，正在 AI 驗證金額...");
      setIsVerifying(true);
      const price = parseFloat((listing as any)?.priceHkd ?? "0");
      verifyPaymentProofMutation.mutate({ proofImageUrl: url, expectedAmountHkd: price });
    } catch { toast.error("截圖上傳失敗，請重試"); }
    finally { setIsUploading(false); }
  };

  // ─── Loading / Error states ──────────────────────────────────────────────────

  if (isLoading) return (
    <div className="min-h-screen bg-[#F8F9FA] pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4" />
            <div className="h-10 bg-gray-200 rounded w-1/2" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );

  if (!listing) return (
    <div className="min-h-screen bg-[#F8F9FA] pt-20 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-lg font-semibold text-gray-700">商品不存在或已下架</p>
        <Link href="/marketplace">
          <Button className="mt-4 bg-[#06038D] hover:bg-[#0804b8] text-white">返回商城</Button>
        </Link>
      </div>
    </div>
  );

  const price = parseFloat(listing.priceHkd as string);
  const isAvailable = listing.status === "active" && listing.quantity > 0;
  const rawImages = listing.images;
  const images: string[] | null = (() => {
    if (!rawImages) return null;
    if (Array.isArray(rawImages)) return rawImages as string[];
    if (typeof rawImages === "string") {
      try { const parsed = JSON.parse(rawImages); return Array.isArray(parsed) ? parsed : null; }
      catch { return null; }
    }
    return null;
  })();
  const canSubmitAlipay = proofUrl && verifyResult?.verified === true;
  const conditionGroup = getConditionGroup(listing.condition);
  const sellerProfile = (listing as any).sellerProfile;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {/* ── Top Bar ── */}
      <div className="bg-[#06038D] border-b border-[#0a07b5]">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-white/60">
            <Link href="/marketplace">
              <span className="text-[#FEDD00] hover:text-white font-medium cursor-pointer transition-colors">商城</span>
            </Link>
            <ChevronRight className="w-3 h-3" />
            {conditionGroup && (
              <>
                <span className="text-white/60">{conditionGroup}</span>
                <ChevronRight className="w-3 h-3" />
              </>
            )}
            <span className="text-white/80 truncate max-w-[200px]">{listing.title}</span>
          </nav>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">

          {/* Left: Image Gallery */}
          <div>
            <ListingImageGallery images={images} title={listing.title} />
          </div>

          {/* Right: Product Info */}
          <div className="space-y-4">

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-help">
                      {conditionGroup && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CONDITION_GROUP_COLOR[conditionGroup] ?? "bg-gray-100 text-gray-700"}`}>
                          {conditionGroup}
                        </span>
                      )}
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${CONDITION_BADGE[listing.condition as ConditionValue] ?? "bg-gray-100 text-gray-700 border border-gray-300"}`}>
                        {CONDITION_FULL[listing.condition as ConditionValue] ?? listing.condition}
                      </span>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-sm">
                    <p className="font-semibold mb-1">{CONDITION_FULL[listing.condition as ConditionValue] ?? listing.condition}</p>
                    <p className="text-gray-500">{CONDITION_TOOLTIP[listing.condition as ConditionValue] ?? ""}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Badge
                variant="outline"
                className={listing.sellerType === "platform"
                  ? "bg-[#06038D] text-[#FEDD00] border-[#06038D] font-bold"
                  : "bg-orange-50 text-orange-700 border-orange-200"
                }
              >
                {listing.sellerType === "platform" ? "🏻 BOXIUM 官方" : "👤 個人賣家"}
              </Badge>
              {!isAvailable && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">已售出</Badge>}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{listing.title}</h1>
              {listing.description && (
                <p className="text-gray-500 mt-1.5 text-sm leading-relaxed line-clamp-2">{listing.description}</p>
              )}
            </div>

            {/* Price Block */}
            <div className="bg-[#06038D] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs mb-0.5">售價</p>
                <span className="text-3xl font-bold text-[#FEDD00]">
                  HKD {price.toLocaleString("zh-HK", { minimumFractionDigits: 2 })}
                </span>
                <p className="text-white/60 text-xs mt-1">庫存：{listing.quantity} 件</p>
              </div>
              <button
                onClick={() => {
                  if (!me) { toast.error("請先登入才能收藏"); return; }
                  toggleWishlistMutation.mutate({ listingId: listing.id });
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isWishlisted ? "bg-red-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                }`}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? "fill-white" : ""}`} />
              </button>
            </div>

            {/* Seller Info Card */}
            {listing.sellerType === "seller" && sellerProfile && (
              <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#06038D]/10 flex items-center justify-center shrink-0">
                  <span className="text-[#06038D] font-bold text-sm">
                    {(sellerProfile.displayName || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{sellerProfile.displayName || "個人賣家"}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {sellerProfile.ratingCount > 0 ? (
                      <>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= Math.round(parseFloat(sellerProfile.avgRating ?? "0")) ? "fill-[#FEDD00] text-[#FEDD00]" : "text-gray-200"}`} />
                          ))}
                        </div>
                        <span className="font-medium text-gray-700">{parseFloat(sellerProfile.avgRating ?? "0").toFixed(1)}</span>
                        <span>({sellerProfile.ratingCount} 個評價)</span>
                      </>
                    ) : <span>新賣家</span>}
                    <span>·</span>
                    <span>已售 {sellerProfile.totalSales} 件</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {completedOrderNo ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-800 font-semibold">訂單已提交！</p>
                <p className="text-sm text-green-700 mt-1">訂單號：{completedOrderNo}</p>
              </div>
            ) : isAvailable ? (
              <div className="space-y-2.5">
                {!me && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>請先<Link href="/login" className="font-semibold underline mx-1">登入</Link>才能購買</span>
                  </div>
                )}
                {price < 4.00 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>此商品金額低於 Stripe 最低付款限額（HKD 4.00），請使用支付寶 HK 付款。</span>
                  </div>
                )}
                {/* Primary buy button */}
                <Button
                  className="w-full bg-[#FEDD00] hover:bg-[#e8c800] text-[#06038D] font-bold h-12 text-base rounded-xl shadow-sm disabled:opacity-40"
                  disabled={!me || createStripeOrderMutation.isPending || price < 4.00}
                  onClick={() => { if (!me) return; setShowShippingDialog(true); }}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {createStripeOrderMutation.isPending ? "處理中..." : "立即購買"}
                </Button>
                {/* Credit card */}
                <Button
                  className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white h-11 text-sm rounded-xl disabled:opacity-40"
                  disabled={!me || createStripeOrderMutation.isPending || price < 4.00}
                  onClick={() => { if (!me) return; setShowShippingDialog(true); }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  信用卡 / Apple Pay 付款
                </Button>
                {/* Alipay */}
                <Button
                  variant="outline"
                  className="w-full h-11 text-sm border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/5 rounded-xl"
                  disabled={!me}
                  onClick={() => { setAlipayStep("qr"); setProofUrl(""); setVerifyResult(null); setShowAlipay(true); }}
                >
                  <Smartphone className="w-4 h-4 mr-2" />支付寶 HK 付款
                </Button>
                {/* Offer - show pending offer status or offer button */}
                {myPendingOffer ? (
                  <div className="w-full rounded-xl border-2 border-[#FEDD00] bg-[#FEDD00]/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#FEDD00]/30 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-[#06038D]" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 leading-none">已出價</p>
                          <p className="font-bold text-[#06038D] text-base leading-tight">
                            HKD {parseFloat(myPendingOffer.offerPriceHkd as string).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">等待賣家回覆</span>
                    </div>
                    <p className="text-xs text-gray-500">出價將於 {new Date(myPendingOffer.expiresAt).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} 到期</p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-11 text-sm border-[#FEDD00] text-[#06038D] hover:bg-[#FEDD00]/10 rounded-xl font-semibold"
                    disabled={!me}
                    onClick={() => {
                      if (!me) { toast.error("請先登入才能出價"); return; }
                      setShowOfferDialog(true);
                    }}
                  >
                    <Tag className="w-4 h-4 mr-2" />出價洽議
                  </Button>
                )}
              </div>
            ) : (
              <Button disabled className="w-full h-12 rounded-xl text-base">商品已售出</Button>
            )}

            {/* Trust badges */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Shield className="w-4 h-4 text-green-500 shrink-0" />
                <span>買家保障：商品與描述不符可申請退款</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Truck className="w-4 h-4 text-[#06038D] shrink-0" />
                <span>本地順豐到付 / 自取（詳情請聯絡賣家）</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Star className="w-4 h-4 text-[#FEDD00] shrink-0" />
                <span>付款後 14 天自動確認完成交易</span>
              </div>
            </div>

            {/* Report link */}
            {me && (
              <button
                onClick={() => setShowReportDialog(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />舉報此商品
              </button>
            )}
          </div>
        </div>

        {/* ── Detail Tabs ── */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Tab headers */}
          <div className="flex border-b border-gray-200">
            {[
              { key: "price", label: "市場價格", icon: TrendingUp },
              { key: "desc", label: "商品描述", icon: MessageSquare },
              { key: "reviews", label: "賣家評價", icon: Star },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                    isActive
                      ? "border-[#FEDD00] text-[#06038D] bg-[#06038D]/5"
                      : "border-transparent text-gray-500 hover:text-[#06038D]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#06038D]" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-4 sm:p-6">
            {activeTab === "price" && (
              (listing as any).cardId
                ? <SnkrdunkPriceBlock cardId={(listing as any).cardId} listingPriceHkd={price} />
                : <div className="text-center py-8 text-gray-400">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>此商品暫無關聯卡牌價格數據</p>
                  </div>
            )}
            {activeTab === "desc" && (
              listing.description
                ? <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">{listing.description}</div>
                : <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>賣家暫未提供商品描述</p>
                  </div>
            )}
            {activeTab === "reviews" && listing.sellerType === "seller" && sellerProfile && (
              <SellerReviewsSection sellerId={sellerProfile.id} />
            )}
            {activeTab === "reviews" && listing.sellerType === "platform" && (
              <div className="text-center py-8 text-gray-400">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>官方商品暫不顯示評價</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Seller Other Listings ── */}
        {listing.sellerType === "seller" && sellerProfile && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
            <SellerOtherListings sellerId={sellerProfile.id} currentListingId={listing.id} />
          </div>
        )}
      </div>

      {/* ── Alipay Dialog ── */}
      <Dialog open={showAlipay} onOpenChange={() => setShowAlipay(false)}>
        <DialogContent bottomSheet className="sm:max-w-md p-0 overflow-hidden border-2 border-[#FEDD00]">
          {/* 深藍色頭部 */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FEDD00]/20 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-[#FEDD00]" />
              </div>
              <h2 className="text-white font-bold text-lg">支付寶 HK 付款</h2>
            </div>
            <button onClick={() => setShowAlipay(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">

          {alipayStep === "qr" && (
            <div className="space-y-4">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-4 text-sm">
                <p className="font-bold text-[#06038D]">
                  付款金額：<span className="text-lg">HKD {price.toFixed(2)}</span>
                </p>
                <p className="text-gray-600 mt-1">{listing.title}</p>
              </div>
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500">請掃描 QR Code 或點擊連結付款</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ALIPAY_QR_URL)}`}
                  alt="支付寶 HK QR Code"
                  className="w-48 h-48 mx-auto rounded-xl border-4 border-white shadow-lg"
                />
                <a href={ALIPAY_QR_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#06038D] hover:underline text-sm">
                  <Smartphone className="w-4 h-4" />在手機上開啟支付寶 HK
                </a>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-medium">付款備注請填寫：</p>
                <p className="font-mono mt-1">{listing.title.substring(0, 30)}</p>
              </div>
              <Button className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white"
                onClick={() => setAlipayStep("shipping")}>
                我已完成付款，填寫收貨地址
              </Button>
            </div>
          )}

          {alipayStep === "shipping" && (
            <div className="space-y-4">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-sm text-[#06038D]">
                <p className="font-medium">請填寫收貨地址</p>
                <p className="text-xs mt-1 text-gray-500">收貨地址將提供給賣家安排寄送</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>收件人姓名 *</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：陳大文" value={alipayShippingForm.name} onChange={e => setAlipayShippingForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>聯絡電話 *</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：9123 4567" value={alipayShippingForm.phone} onChange={e => setAlipayShippingForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>詳細地址 *</Label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：旺角彌敦道 123 號 ABC 大廈 5 樓 A 室" value={alipayShippingForm.address} onChange={e => setAlipayShippingForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>地區</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：旺角" value={alipayShippingForm.district} onChange={e => setAlipayShippingForm(f => ({ ...f, district: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>區域</Label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] bg-white" value={alipayShippingForm.region} onChange={e => setAlipayShippingForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="香港島">香港島</option>
                    <option value="九龍">九龍</option>
                    <option value="新界">新界</option>
                    <option value="香港">香港（不指定）</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400">* 必填欄位。如不需要寄送可跳過。</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAlipayStep("qr")}>返回</Button>
                <Button
                  className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white"
                  disabled={!alipayShippingForm.name.trim() || !alipayShippingForm.phone.trim() || !alipayShippingForm.address.trim()}
                  onClick={() => setAlipayStep("upload")}
                >
                  下一步：上傳截圖
                </Button>
              </div>
            </div>
          )}

          {alipayStep === "upload" && (
            <div className="space-y-4">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-sm">
                <p className="font-bold text-[#06038D]">付款金額：HKD {price.toFixed(2)}</p>
                <p className="text-gray-500 mt-1">請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致。</p>
              </div>
              <div>
                <Label>付款截圖 *</Label>
                <div className="mt-2 border-2 border-dashed border-[#06038D]/30 rounded-xl p-6 text-center">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm">上傳中...</p>
                    </div>
                  ) : proofUrl ? (
                    <div className="space-y-3">
                      <img src={proofUrl} alt="付款截圖" className="max-h-40 mx-auto rounded object-contain" />
                      {isVerifying ? (
                        <div className="flex items-center justify-center gap-2 text-[#06038D] text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AI 正在驗證付款金額...</span>
                        </div>
                      ) : verifyResult ? (
                        <div className={`rounded-xl p-3 text-sm space-y-2 ${verifyResult.verified ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
                          <div className="flex items-center gap-2 font-medium mb-2">
                            {verifyResult.verified
                              ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">三項驗證全部通過</span></>
                              : <><XCircle className="w-4 h-4 text-orange-600" /><span className="text-orange-800">驗證未完全通過</span></>
                            }
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { ok: verifyResult.payeeVerified, label: `收款方：${verifyResult.detectedPayee ?? "未識別"}${!verifyResult.payeeVerified ? " （需為「零度有限公司」）" : ""}` },
                              { ok: verifyResult.amountVerified, label: `金額：${verifyResult.currency ?? "HKD"} ${verifyResult.detectedAmount ?? "未識別"}${!verifyResult.amountVerified ? ` （需為 HKD ${price.toFixed(2)}）` : ""}` },
                              { ok: verifyResult.statusVerified, label: `狀態：${verifyResult.detectedStatus ?? "未識別"}${!verifyResult.statusVerified ? " （需為「成功」）" : ""}` },
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {item.ok ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                <span className={item.ok ? "text-green-700" : "text-red-700"}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                          <p className={`text-xs mt-1 ${verifyResult.verified ? "text-green-700" : "text-orange-700"}`}>{verifyResult.reason}</p>
                          <p className="text-xs text-gray-400">AI 信心度：{verifyResult.confidence === "high" ? "高" : verifyResult.confidence === "medium" ? "中" : "低"}</p>
                          {!verifyResult.verified && (
                            <button className="mt-1 text-xs text-[#06038D] underline" onClick={() => { setProofUrl(""); setVerifyResult(null); }}>
                              重新上傳截圖
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="proof-upload" />
                      <label htmlFor="proof-upload" className="cursor-pointer">
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-sm text-gray-500">點擊上傳截圖</p>
                        <p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 5MB</p>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              {verifyResult && !verifyResult.verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <p className="font-medium">⚠️ 如確認已付款，可繼續提交</p>
                  <p className="mt-1">訂單將標記為「待人工核對」，管理員將在 1-2 個工作天內確認。</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAlipayStep("qr")}>返回</Button>
                <Button
                  className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white font-bold"
                  disabled={!proofUrl || isVerifying || isUploading || createAlipayOrderMutation.isPending}
                  onClick={() => createAlipayOrderMutation.mutate({
                    listingId: listing.id,
                    proofImageUrl: proofUrl,
                    shippingAddress: alipayShippingForm.name.trim() ? {
                      name: alipayShippingForm.name.trim(),
                      phone: alipayShippingForm.phone.trim(),
                      address: alipayShippingForm.address.trim(),
                      district: alipayShippingForm.district.trim() || undefined,
                      region: alipayShippingForm.region,
                    } : undefined,
                  })}
                >
                  {createAlipayOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : canSubmitAlipay ? "✅ 提交訂單" : "提交訂單（待核對）"}
                </Button>
              </div>
            </div>
          )}

          {alipayStep === "done" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="font-bold text-lg text-gray-900">訂單已提交！</p>
              <p className="text-sm text-gray-500">我們將在核對收款後確認你的訂單，通常需要 1-2 個工作天。</p>
              <Button className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white" onClick={() => setShowAlipay(false)}>關閉</Button>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Shipping Dialog ── */}
      <Dialog open={showShippingDialog} onOpenChange={(open) => { setShowShippingDialog(open); if (!open) { setShippingForm({ name: "", phone: "", address: "", district: "", region: "香港" }); setSelectedSavedAddressId(null); } }}>
        <DialogContent bottomSheet className="sm:max-w-md p-0 overflow-hidden border-2 border-[#FEDD00]">
          {/* 深藍色頭部 */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FEDD00]/20 flex items-center justify-center">
                <Truck className="w-4 h-4 text-[#FEDD00]" />
              </div>
              <h2 className="text-white font-bold text-lg">填寫收貨地址</h2>
            </div>
            <button onClick={() => setShowShippingDialog(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            {savedAddresses && savedAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">已儲存地址</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {savedAddresses.map((addr: any) => (
                    <button key={addr.id} type="button"
                      onClick={() => { setSelectedSavedAddressId(addr.id); setShippingForm({ name: addr.recipientName, phone: addr.phone, address: addr.address, district: addr.district || "", region: addr.region }); }}
                      className={`w-full text-left rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                        selectedSavedAddressId === addr.id ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <span className="font-semibold">{addr.label}</span>
                      <span className="text-gray-500 ml-2">{addr.recipientName} · {addr.phone}</span>
                      <br />
                      <span className="text-gray-400 text-xs">{addr.district ? `${addr.district}，` : ""}{addr.address}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">或手動填寫以下欄位</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-name">收件人姓名 *</Label>
                <input id="ship-name" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：陳大文" value={shippingForm.name} onChange={e => setShippingForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-phone">聯絡電話 *</Label>
                <input id="ship-phone" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：9123 4567" value={shippingForm.phone} onChange={e => setShippingForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship-address">詳細地址 *</Label>
              <input id="ship-address" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：旺角彌敦道 123 號 ABC 大廈 5 樓 A 室" value={shippingForm.address} onChange={e => setShippingForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-district">地區</Label>
                <input id="ship-district" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：旺角" value={shippingForm.district} onChange={e => setShippingForm(f => ({ ...f, district: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-region">區域</Label>
                <select id="ship-region" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] bg-white" value={shippingForm.region} onChange={e => setShippingForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="香港島">香港島</option>
                  <option value="九龍">九龍</option>
                  <option value="新界">新界</option>
                  <option value="香港">香港（不指定）</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">* 必填欄位。收貨地址將提供給賣家安排寄送。</p>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <Button variant="outline" className="flex-1 border-gray-200" onClick={() => setShowShippingDialog(false)}>取消</Button>
            <Button
              className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white font-bold"
              disabled={!shippingForm.name.trim() || !shippingForm.phone.trim() || !shippingForm.address.trim() || createStripeOrderMutation.isPending}
              onClick={() => {
                setShowShippingDialog(false);
                createStripeOrderMutation.mutate({
                  listingId: listing.id,
                  shippingAddress: {
                    name: shippingForm.name.trim(),
                    phone: shippingForm.phone.trim(),
                    address: shippingForm.address.trim(),
                    district: shippingForm.district.trim() || undefined,
                    region: shippingForm.region,
                  },
                });
              }}
            >
              {createStripeOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</> : <><CreditCard className="w-4 h-4 mr-2" />前往付款</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Offer Dialog ── */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm p-0 overflow-hidden border-2 border-[#FEDD00]">
          {/* 深藍色頭部 */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FEDD00]/20 flex items-center justify-center">
                <Tag className="w-4 h-4 text-[#FEDD00]" />
              </div>
              <h2 className="text-white font-bold text-lg">出價洽議</h2>
            </div>
            <button onClick={() => setShowOfferDialog(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            {listing?.priceHkd && (
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-sm">
                <p className="text-gray-500">市價</p>
                <p className="font-bold text-[#06038D] text-lg">HKD {parseFloat(listing.priceHkd as string).toFixed(2)}</p>
                {listing.minOfferHkd && (
                  <p className="text-xs text-gray-400 mt-1">最低出價：HKD {parseFloat(listing.minOfferHkd as string).toFixed(0)}</p>
                )}
              </div>
            )}
            <div>
              <Label className="text-sm font-medium mb-1.5 block text-[#06038D]">出價金額（HKD） *</Label>
              <Input
                type="number"
                placeholder="請輸入出價金額"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="border-gray-200 focus-visible:ring-[#06038D]"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block text-[#06038D]">留言（可選）</Label>
              <Textarea
                placeholder="可以說明出價原因或其他要求..."
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                rows={3}
                className="border-gray-200 focus-visible:ring-[#06038D] resize-none"
              />
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <Button variant="outline" className="flex-1 border-gray-200" onClick={() => setShowOfferDialog(false)}>取消</Button>
            <Button
              className="flex-1 bg-[#FEDD00] hover:bg-[#e8c800] text-[#06038D] font-bold"
              disabled={!offerAmount || parseFloat(offerAmount) <= 0 || makeOfferMutation.isPending}
              onClick={() => {
                if (!listing || !me) return;
                const sellerId = (listing as any).sellerId;
                if (!sellerId) return;
                makeOfferMutation.mutate({
                  listingId: listing.id,
                  offerPriceHkd: parseFloat(offerAmount),
                  message: offerMessage || undefined,
                });
              }}
            >
              {makeOfferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "送出出價"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Report Dialog ── */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm p-0 overflow-hidden border-2 border-red-400">
          {/* 深藍色頭部 */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-400/20 flex items-center justify-center">
                <Flag className="w-4 h-4 text-red-400" />
              </div>
              <h2 className="text-white font-bold text-lg">舉報商品</h2>
            </div>
            <button onClick={() => setShowReportDialog(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">舉報原因</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="border-gray-200 focus:ring-[#06038D]">
                  <SelectValue placeholder="請選擇舉報原因" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fake_item">假貨 / 詐騙</SelectItem>
                  <SelectItem value="wrong_description">商品與描述不符</SelectItem>
                  <SelectItem value="prohibited_item">禁售商品</SelectItem>
                  <SelectItem value="scam">詐騙行為</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">詳細說明（可選）</Label>
              <Textarea
                placeholder="請詳述舉報原因..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                className="border-gray-200 focus-visible:ring-[#06038D] resize-none"
              />
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <Button variant="outline" className="flex-1 border-gray-200" onClick={() => setShowReportDialog(false)}>取消</Button>
            <Button
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold"
              disabled={!reportReason || reportListingMutation.isPending}
              onClick={() => {
                if (!listing) return;
                reportListingMutation.mutate({
                  listingId: listing.id,
                  reason: reportReason as "fake_item" | "wrong_description" | "prohibited_item" | "scam" | "other",
                  details: reportDetails || undefined,
                });
              }}
            >
              {reportListingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "提交舉報"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
