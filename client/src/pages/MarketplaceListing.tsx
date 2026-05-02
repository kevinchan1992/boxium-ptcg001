import { useState, useEffect, useMemo } from "react";
import { parseApiError } from "@/lib/parseApiError";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCartBounce } from "@/components/TopNav";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, CreditCard, Smartphone, Package, Star, Shield, Truck,
  AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Loader2, HelpCircle, Tag, Flag, TrendingUp, TrendingDown, Minus,
  ExternalLink, Heart, ZoomIn, MessageSquare, ShoppingCart, ChevronDown,
  ChevronUp, Store, X, Clock, Share2, Copy, Check
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CONDITION_BADGE, CONDITION_FULL, CONDITION_TOOLTIP, CONDITION_GROUP_COLOR, CONDITION_GROUPS, type ConditionValue } from "@/lib/conditions";
import { searchSFPointsAsync, validateSFCode, type SFPoint } from "@/lib/sfStations";
import { useTranslation } from "react-i18next";

const ALIPAY_QR_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";

function getConditionGroup(condition: string): string {
  for (const g of CONDITION_GROUPS) {
    if (g.items.some(i => i.value === condition)) return g.group;
  }
  return "";
}

// ─── Image Gallery ─────────────────────────────────────────────────────────────

function ListingImageGallery({ images, title }: { images: string[] | null; title: string }) {
  const { t } = useTranslation();
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgs = images && images.length > 0 ? images : null;

  if (!imgs) {
    return (
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center border border-gray-200">
        <div className="text-center text-gray-400">
          <Package className="w-16 h-16 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("marketplaceListing.productImage")}</p>
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

// Map ConditionValue to SNKRDUNK grade strings stored in DB
const CONDITION_TO_GRADES: Record<string, string[]> = {
  psa10: ["PSA10", "PSA 10"],
  psa9: ["PSA9", "PSA 9"],
  psa8_below: ["PSA8\u4ee5\u4e0b"],
  bgs10: ["BGS10 GL", "BGS10 BL"],
  bgs9: ["BGS 9.5", "BGS9.5"],
  bgs8_below: ["BGS9\u4ee5\u4e0b"],
  tag10: ["ARS10", "ARS10+"],
  tag9_below: ["ARS9", "ARS8\u4ee5\u4e0b"],
  raw_a: ["A"],
  raw_b: ["B"],
  raw_c: ["C"],
  raw_d: ["D"],
};

function SnkrdunkPriceBlock({ cardId, listingPriceHkd, condition }: { cardId: number; listingPriceHkd: number; condition?: string }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(90);

  const { data: history, isLoading } = trpc.prices.getHistory.useQuery(
    { cardId, source: "snkrdunk", limit: 100, days: 90 },
    { enabled: !!cardId }
  );

  // Filter history by condition-matched grades (client-side)
  const matchedGrades = condition ? CONDITION_TO_GRADES[condition] : undefined;
  const conditionLabel = condition ? CONDITION_FULL[condition as ConditionValue] : undefined;

  // filteredHistory: grade-matched records; fallbackHistory: all records when no grade match
  const { filteredHistory, isGradeFallback } = useMemo(() => {
    if (!history) return { filteredHistory: [], isGradeFallback: false };
    if (!matchedGrades || matchedGrades.length === 0) return { filteredHistory: history, isGradeFallback: false };
    const matched = history.filter(h => h.grade && matchedGrades.includes(h.grade));
    if (matched.length > 0) return { filteredHistory: matched, isGradeFallback: false };
    // No records for this grade → fall back to all grades
    return { filteredHistory: history, isGradeFallback: true };
  }, [history, matchedGrades]);

  const chartData = useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const filtered = filteredHistory.filter(h => h.soldAt && new Date(h.soldAt) >= cutoff);
    // Group by date, keyed by ISO date string (YYYY-MM-DD) for correct sorting
    const byDateKey: Record<string, { label: string; prices: number[] }> = {};
    for (const h of filtered) {
      if (!h.soldAt) continue;
      const dt = new Date(h.soldAt);
      // Use ISO date as sort key, display label as MM/DD
      const isoKey = dt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const label = dt.toLocaleDateString("zh-HK", { month: "2-digit", day: "2-digit" });
      if (!byDateKey[isoKey]) byDateKey[isoKey] = { label, prices: [] };
      byDateKey[isoKey].prices.push(parseFloat(h.price as string));
    }
    const sorted = Object.entries(byDateKey)
      .sort(([a], [b]) => a.localeCompare(b)); // sort by ISO key = chronological order
    // Detect if data spans multiple years
    const years = new Set(sorted.map(([isoKey]) => isoKey.slice(0, 4)));
    const multiYear = years.size > 1;
    return sorted.map(([isoKey, { label, prices }]) => ({
      date: multiYear ? `${label}'${isoKey.slice(2, 4)}` : label,
      avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      count: prices.length,
    }));
  }, [filteredHistory, days]);

  const stats = useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) return null;
    // Use all available filteredHistory for stats (not limited to 30 days)
    const recent = filteredHistory;
    if (recent.length === 0) return null;
    const prices = recent.map(h => parseFloat(h.price as string));
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const now = new Date();
    const d7 = new Date(); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(); d14.setDate(d14.getDate() - 14);
    const last7 = filteredHistory.filter(h => h.soldAt && new Date(h.soldAt) >= d7);
    const prev7 = filteredHistory.filter(h => h.soldAt && new Date(h.soldAt) >= d14 && new Date(h.soldAt) < d7);
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
  }, [filteredHistory]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-5 rounded-full bg-[#06038D]" />
          <h3 className="font-semibold text-sm text-[#06038D]">{t("marketplaceListing.boxiumMarketPrice")}</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t("marketplaceListing.loading")}</span>
        </div>
      </div>
    );
  }

  if (!stats || chartData.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-5 rounded-full bg-[#06038D]" />
          <h3 className="font-semibold text-sm text-[#06038D]">{t("marketplaceListing.boxiumMarketPrice")}</h3>
        </div>
        <p className="text-sm text-gray-400">{t("marketplaceListing.noRecentTransactions")}</p>
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
          <div>
            <span className="text-white font-semibold text-sm">{t("marketplaceListing.boxiumMarketPrice")}</span>
            {condition && CONDITION_FULL[condition as ConditionValue] && (
              <span className="ml-2 text-white/70 text-xs">({CONDITION_FULL[condition as ConditionValue]})</span>
            )}
          </div>
        </div>
        <a
          href={`/card/${cardId}`}
          className="flex items-center gap-1 text-white/70 hover:text-white text-xs transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>{t("marketplaceListing.viewDetailedChart")}</span>
        </a>
      </div>
      <div className="p-4 space-y-4">
        {/* Fallback notice: no records for this grade, showing all grades */}
        {isGradeFallback && conditionLabel && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              暫無 <span className="font-semibold">{conditionLabel}</span> 品相的交易數據，以下為所有品相的市場參考價
            </p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center bg-[#06038D]/5 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-0.5">{t("marketplaceListing.30DayAverage")}</p>
            <p className="text-lg font-bold text-[#06038D]">HKD {Math.round(stats.avg).toLocaleString()}</p>
          </div>
          <div className="text-center bg-green-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-0.5">{t("marketplaceListing.lowest")}</p>
            <p className="text-base font-semibold text-green-600">HKD {Math.round(stats.min).toLocaleString()}</p>
          </div>
          <div className="text-center bg-red-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-0.5">{t("marketplaceListing.highest")}</p>
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
            <span className="text-xs text-gray-500">{t("marketplaceListing.salesTrend")}</span>
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
            <p className="text-xs text-gray-400 text-center py-4">{t("marketplaceListing.chart.insufficientData")}</p>
          )}
        </div>

        <p className="text-xs text-gray-400">數據來源：BOXIUM{isGradeFallback ? ' · 所有品相（參考）' : condition && CONDITION_FULL[condition as ConditionValue] ? ` · ${CONDITION_FULL[condition as ConditionValue]}` : ''} · 圖表顯示近 {days} 天（共 {filteredHistory.length} 筆記錄）</p>
      </div>
    </div>
  );
}

// ─── Seller Reviews ────────────────────────────────────────────────────────────

function SellerReviewsSection({ sellerId }: { sellerId: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data } = trpc.marketplace.getSellerReviews.useQuery(
    { sellerId, page: 1, pageSize: 5 },
    { enabled: !!sellerId }
  );
  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  if (total === 0) return (
    <div className="text-sm text-gray-400 py-4 text-center">{t("marketplaceListing.seller.noReviews")}</div>
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

function OfferPayButton({ orderId }: { orderId: number }) {
  const { t } = useTranslation();
  const getCheckoutMutation = trpc.marketplace.getOrderCheckoutUrl.useMutation({
    onSuccess: (data) => {
      toast.success(t("marketplaceListing.payment.redirecting"));
      window.location.href = data.checkoutUrl;
    },
    onError: (e: any) => toast.error(e.message || "無法獲取付款連結"),
  });
  return (
    <Button
      className="w-full h-11 text-white font-bold rounded-xl"
      style={{ backgroundColor: "#06038d" }}
      disabled={getCheckoutMutation.isPending}
      onClick={() => getCheckoutMutation.mutate({ orderId })}
    >
      {getCheckoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
      前往付款
    </Button>
  );
}

export default function MarketplaceListing() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  // ── Maintenance mode check (query placed before other hooks, guard after all hooks) ──
  const { data: accessData, isLoading: accessLoading } = trpc.marketplace.getMarketplaceAccess.useQuery();
  const [showAlipay, setShowAlipay] = useState(false);
  const [completedOrderNo, setCompletedOrderNo] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [alipayStep, setAlipayStep] = useState<"qr" | "shipping" | "upload" | "done">("qr");
  const [alipayShippingForm, setAlipayShippingForm] = useState({ name: "", phone: "", address: "", district: "", region: "香港", addressType: "normal" as "normal" | "sf_station", sfStationCode: "", sfStationName: "", sfStationAddress: "" });
  const [alipaySfSearch, setAlipaySfSearch] = useState("");
  const [alipaySfRegion, setAlipaySfRegion] = useState("");
  const [alipaySfType, setAlipaySfType] = useState<'all' | 'station' | 'locker'>('all');
  const [alipaySfResults, setAlipaySfResults] = useState<SFPoint[]>([]);
  const [alipaySfDropdown, setAlipaySfDropdown] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [showShippingDialog, setShowShippingDialog] = useState(false);
  const [shippingForm, setShippingForm] = useState({ name: "", phone: "", address: "", district: "", region: "香港", addressType: "normal" as "normal" | "sf_station", sfStationCode: "", sfStationName: "", sfStationAddress: "" });
  const [stripeSfSearch, setStripeSfSearch] = useState("");
  const [stripeSfRegion, setStripeSfRegion] = useState("");
  const [stripeSfType, setStripeSfType] = useState<'all' | 'station' | 'locker'>('all');
  const [stripeSfResults, setStripeSfResults] = useState<SFPoint[]>([]);
  const [stripeSfDropdown, setStripeSfDropdown] = useState(false);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<number | null>(null);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [activeTab, setActiveTab] = useState<"price" | "desc" | "reviews">("price");
  const [isWishlisted, setIsWishlisted] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);

  const { data: me } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const { data: savedAddresses } = trpc.marketplace.getMyShippingAddresses.useQuery(
    undefined,
    { enabled: !!me }
  );

  // 地址表單初始狀態為空白，由用戶自行選擇已儲存地址或手動填寫

  // SF 站點搜尋
  useEffect(() => {
    if (alipayShippingForm.addressType !== 'sf_station') return;
    searchSFPointsAsync(alipaySfSearch, alipaySfRegion || undefined, alipaySfType === 'all' ? 'all' : alipaySfType).then(setAlipaySfResults);
  }, [alipaySfSearch, alipaySfRegion, alipaySfType, alipayShippingForm.addressType]);
  useEffect(() => {
    if (shippingForm.addressType !== 'sf_station') return;
    searchSFPointsAsync(stripeSfSearch, stripeSfRegion || undefined, stripeSfType === 'all' ? 'all' : stripeSfType).then(setStripeSfResults);
  }, [stripeSfSearch, stripeSfRegion, stripeSfType, shippingForm.addressType]);

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
      utils.marketplace.getMyWishlist.invalidate(); // sync Profile wishlist tab
    },
    onError: () => toast.error(t("marketplaceListing.wishlist.loginRequired")),
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
    const tcgSeriesLabel: Record<string, string> = {
      pokemon: 'Pok\u00e9mon', onepiece: 'One Piece', yugioh: 'Yu-Gi-Oh!',
    };
    const seriesPrefix = (listing as any).tcgSeries && tcgSeriesLabel[(listing as any).tcgSeries as string]
      ? `[${tcgSeriesLabel[(listing as any).tcgSeries as string]}] `
      : '';
    const title = `${seriesPrefix}${listing.title} - HKD ${price.toFixed(2)} | BOXIUM PTCG`;
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
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; }
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const makeOfferMutation = trpc.marketplace.makeOffer.useMutation({
    onSuccess: () => {
      toast.success(t("marketplaceListing.offer.success"));
      setShowOfferDialog(false); setOfferAmount(""); setOfferMessage("");
      utils.marketplace.getMyOfferForListing.invalidate({ listingId: id });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const { data: myPendingOffer } = trpc.marketplace.getMyOfferForListing.useQuery(
    { listingId: id },
    { enabled: !!me && !!id }
  );

  const reportListingMutation = trpc.marketplace.reportListing.useMutation({
    onSuccess: () => {
      toast.success(t("marketplaceListing.report.success"));
      setShowReportDialog(false); setReportReason(""); setReportDetails("");
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const createAlipayOrderMutation = trpc.marketplace.createAlipayOrder.useMutation({
    onSuccess: (data) => { setCompletedOrderNo(data.orderNo); setAlipayStep("done"); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const verifyPaymentProofMutation = trpc.marketplace.verifyPaymentProof.useMutation({
    onSuccess: (data) => {
      setVerifyResult(data as VerifyResult); setIsVerifying(false);
      if (data.verified) toast.success(t("marketplaceListing.payment.verification.success"));
      else toast.error(t("marketplaceListing.payment.verification.failed"));
    },
    onError: (e) => { setIsVerifying(false); toast.error("驗證失敗：" + e.message); },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t("marketplaceListing.upload.sizeError")); return; }
    setIsUploading(true); setVerifyResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-payment-proof", { method: "POST", body: formData });
      if (!res.ok) throw new Error("上傳失敗");
      const { url } = await res.json();
      setProofUrl(url);
      toast.success(t("marketplaceListing.upload.verifying"));
      setIsVerifying(true);
      const verifyPrice = acceptedOffer ? parseFloat(acceptedOffer.offerPriceHkd as string) : parseFloat((listing as any)?.priceHkd ?? "0");
      verifyPaymentProofMutation.mutate({ proofImageUrl: url, expectedAmountHkd: verifyPrice });
    } catch { toast.error(t("marketplaceListing.upload.retry")); }
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
        <p className="text-lg font-semibold text-gray-700">{t("marketplaceListing.notFound")}</p>
        <Link href="/marketplace">
          <Button className="mt-4 bg-[#06038D] hover:bg-[#0804b8] text-white">{t("marketplaceListing.backToMarketplace")}</Button>
        </Link>
      </div>
    </div>
  );

  const price = parseFloat(listing.priceHkd as string);
  const remainingQty = listing.remainingQuantity ?? listing.quantity;
  // isAvailable: true if listing is active with stock, OR if buyer has an accepted offer (even if stock shows 0 due to order lock)
  const acceptedOfferForAvailability = myPendingOffer?.status === "accepted" ? myPendingOffer : null;
  const isAvailable = (listing.status === "active" && remainingQty > 0) || !!acceptedOfferForAvailability;
  // If buyer has an accepted offer, use offer price for payment buttons
  const acceptedOffer = myPendingOffer?.status === "accepted" ? myPendingOffer : null;
  const effectivePrice = acceptedOffer ? parseFloat(acceptedOffer.offerPriceHkd as string) : price;

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

  // ── Maintenance mode guard (after all hooks) ──
  if (accessLoading) return <div className="min-h-screen flex items-center justify-center bg-[#06038D]"><div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>;
  if (accessData && !accessData.allowed) return (
    <div className="min-h-screen bg-[#06038D] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-3">{t("marketplaceListing.maintenance.title")}</h1>
        <p className="text-white/70 mb-6">{t("marketplaceListing.maintenance.description")}</p>
        <a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors">{t("marketplaceListing.backToHome")}</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {/* ── Top Bar ── */}
      <div className="bg-[#06038D] border-b border-[#0a07b5]">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img src="/boxium-logo.png" alt="BOXIUM" className="h-14 cursor-pointer flex-shrink-0 p-1" />
            </Link>
          <nav className="flex items-center gap-1.5 text-xs text-white/60 flex-1">
            <Link href="/marketplace">
              <span className="text-[#FEDD00] hover:text-white font-medium cursor-pointer transition-colors">{t("marketplaceListing.nav.marketplace")}</span>
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
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
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
              {listing.tcgSeries && (
                <Badge variant="outline" className={
                  listing.tcgSeries === "pokemon" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                  listing.tcgSeries === "onepiece" ? "bg-red-50 text-red-700 border-red-200" :
                  listing.tcgSeries === "yugioh" ? "bg-purple-50 text-purple-700 border-purple-200" :
                  listing.tcgSeries === "dragonball" ? "bg-orange-50 text-orange-700 border-orange-200" :
                  listing.tcgSeries === "mtg" ? "bg-teal-50 text-teal-700 border-teal-200" :
                  "bg-gray-50 text-gray-700 border-gray-200"
                }>
                  {listing.tcgSeries === "pokemon" ? "Pokémon" :
                   listing.tcgSeries === "onepiece" ? "One Piece" :
                   listing.tcgSeries === "yugioh" ? "Yu-Gi-Oh!" :
                   listing.tcgSeries === "dragonball" ? "Dragon Ball" :
                   listing.tcgSeries === "mtg" ? "MTG" : "其他 TCG"}
                </Badge>
              )}
              {listing.status === 'reserved' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">⚠️ 爭議處理中</Badge>}
              {!isAvailable && listing.status !== 'reserved' && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{t("marketplaceListing.status.soldOut")}</Badge>}
            </div>

            {/* Title */}
            <div>
              {(() => {
                const tcgLogos: Record<string, { logo: string; label: string }> = {
                  pokemon:  { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif",  label: "Pok\u00e9mon" },
                  onepiece: { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif", label: "One Piece" },
                  yugioh:   { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp",  label: "Yu-Gi-Oh!" },
                };
                const series = tcgLogos[(listing as any).tcgSeries as string];
                return series ? (
                  <div className="mb-2">
                    <img src={series.logo} alt={series.label} className="h-16 w-auto object-contain" />                  </div>
                ) : null;
              })()}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{listing.title}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  className="inline-flex items-center gap-1 text-xs font-mono text-[#06038D]/60 hover:text-[#06038D] bg-[#06038D]/5 hover:bg-[#06038D]/10 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                  title={t("marketplaceListing.copyListingId.tooltip")}
                  onClick={() => {
                    navigator.clipboard.writeText(`#BOXIUM-${listing.id}`);
                    toast.success(t("marketplaceListing.copyListingId.success"));
                  }}
                >
                  #BOXIUM-{listing.id}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>

            </div>

            {/* Price Block */}
            <div className="bg-[#06038D] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs mb-0.5">{t("marketplaceListing.priceLabel")}</p>
                {acceptedOffer ? (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-bold text-white/40 line-through">
                      HKD {price.toLocaleString("zh-HK", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-3xl font-bold text-[#FEDD00]">
                      HKD {effectivePrice.toLocaleString("zh-HK", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl font-bold text-[#FEDD00]">
                    HKD {price.toLocaleString("zh-HK", { minimumFractionDigits: 2 })}
                  </span>
                )}
                <p className="text-white/60 text-xs mt-1">庫存：{listing.quantity} 件</p>
              </div>

              <button
                onClick={() => {
                  if (!me) { toast.error(t("marketplaceListing.wishlist.loginRequired")); return; }
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
              <div className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#06038D]/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {(sellerProfile as any).avatarUrl ? (
                      <img src={(sellerProfile as any).avatarUrl} alt={sellerProfile.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#06038D] font-bold text-sm">
                        {(sellerProfile.displayName || "?")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{sellerProfile.displayName || "個人賣家"}</p>
                      {sellerProfile.ratingCount > 0 && (
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-amber-700">{parseFloat(sellerProfile.avgRating ?? "0").toFixed(1)}</span>
                          <span className="text-xs text-amber-600">({sellerProfile.ratingCount})</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {sellerProfile.ratingCount > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= Math.round(parseFloat(sellerProfile.avgRating ?? "0")) ? "fill-[#FEDD00] text-[#FEDD00]" : "text-gray-200"}`} />
                          ))}
                        </div>
                      ) : <span className="text-gray-400">{t("marketplaceListing.seller.profile.new")}</span>}
                      <span>·</span>
                      <span>已售 {sellerProfile.totalSales} 件</span>
                    </div>
                  </div>
                  {/* Link to seller profile */}
                  {(sellerProfile as any).id && (
                    <Link
                      href={`/seller/${(sellerProfile as any).id}`}
                      className="text-xs text-[#06038D] hover:underline shrink-0 font-medium"
                    >
                      查看主頁
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {completedOrderNo ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-800 font-semibold">{t("marketplaceListing.order.submitted")}</p>
                <p className="text-sm text-green-700 mt-1">訂單號：{completedOrderNo}</p>
              </div>
            ) : listing.status === 'reserved' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-amber-800 font-semibold">此商品正在爭議處理中</p>
                <p className="text-sm text-amber-700 mt-1">管理員正在處理相關爭議，商品暫時無法購買</p>
              </div>
            ) : isAvailable ? (
              <div className="space-y-2.5">
                {!me && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>請先<Link href="/login" className="font-semibold underline mx-1">登入</Link>才能購買</span>
                  </div>
                )}

                {/* Accepted offer banner */}
                {acceptedOffer && (
                  <div className="w-full rounded-xl border-2 border-green-400 bg-green-50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-green-700 font-semibold leading-none">{t("marketplaceListing.offer.accepted.banner")}</p>
                        <p className="font-bold text-green-800 text-base leading-tight">出價金額：HKD {effectivePrice.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
                {effectivePrice < 4.00 && !acceptedOffer && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{t("marketplaceListing.payment.stripe.minimumError")}</span>
                  </div>
                )}
                {/* Add to Cart button (primary) - always show */}
                <AddToCartButton listingId={listing.id} isLoggedIn={!!me} isAcceptedOffer={!!acceptedOffer} />
                {/* Offer - show pending offer status or offer button (only if allowOffers is true) */}
                {listing?.allowOffers && (
                  myPendingOffer ? (
                    myPendingOffer.status === "accepted" ? (
                      // Offer accepted - no extra button needed, user uses payment buttons above
                      null
                    ) : (
                    <div className="w-full rounded-xl border-2 border-[#FEDD00] bg-[#FEDD00]/10 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#FEDD00]/30 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-[#06038D]" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 leading-none">{t("marketplaceListing.offer.myOffer")}</p>
                            <p className="font-bold text-[#06038D] text-base leading-tight">
                              HKD {parseFloat(myPendingOffer.offerPriceHkd as string).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">{t("marketplaceListing.offer.status.pending")}</span>
                      </div>
                      <p className="text-xs text-gray-500">出價將於 {new Date(myPendingOffer.expiresAt).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} 到期</p>
                    </div>
                    )
                  ) : (
                    !me ? (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-full">
                              <Button
                                variant="outline"
                                className="w-full h-11 text-sm border-[#06038D]/40 text-[#06038D]/50 rounded-xl font-semibold bg-white cursor-not-allowed"
                                disabled
                              >
                                <Tag className="w-4 h-4 mr-2" />出價洽議
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="bg-[#06038D] text-white text-xs px-3 py-2 rounded-lg">
                            請先登入才能出價
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                    <Button
                      variant="outline"
                      className="w-full h-11 text-sm border-[#06038D] text-[#06038D] hover:bg-[#06038D]/5 rounded-xl font-semibold bg-white"
                      onClick={() => setShowOfferDialog(true)}
                    >
                      <Tag className="w-4 h-4 mr-2" />出價洽議
                    </Button>
                    )
                  )
                )}
              </div>
            ) : (
              <Button disabled className="w-full h-12 rounded-xl text-base">{t("marketplaceListing.status.sold")}</Button>
            )}

            {/* Trust badges */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Shield className="w-4 h-4 text-green-500 shrink-0" />
                <span>{t("marketplaceListing.buyerProtection.description")}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Truck className="w-4 h-4 text-[#06038D] shrink-0" />
                <span>{t("marketplaceListing.shipping.local")}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Star className="w-4 h-4 text-[#FEDD00] shrink-0" />
                <span>{t("marketplaceListing.order.autoConfirm")}</span>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`#BOXIUM-${listing.id} ${listing.title} - HKD ${Number(listing.priceHkd).toLocaleString()}\n${window.location.href}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp 分享
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    setCopiedLink(true);
                    toast.success(t("marketplaceListing.share.copy.success"));
                    setTimeout(() => setCopiedLink(false), 2000);
                  }).catch(() => toast.error(t("marketplaceListing.share.copy.error")));
                }}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? '已複製！' : '複製連結'}
              </button>
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
              { key: "price", label: t("marketplaceListing.tabs.price"), icon: TrendingUp },
              { key: "desc", label: t("marketplaceListing.tabs.description"), icon: MessageSquare },
              { key: "reviews", label: t("marketplaceListing.tabs.reviews"), icon: Star },
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
                ? <SnkrdunkPriceBlock cardId={(listing as any).cardId} listingPriceHkd={price} condition={listing.condition} />
                : <div className="text-center py-8 text-gray-400">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t("marketplaceListing.tabs.price.noData")}</p>
                  </div>
            )}
            {activeTab === "desc" && (
              listing.description
                ? <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">{listing.description}</div>
                : <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t("marketplaceListing.tabs.description.noData")}</p>
                  </div>
            )}
            {activeTab === "reviews" && listing.sellerType === "seller" && sellerProfile && (
              <SellerReviewsSection sellerId={sellerProfile.id} />
            )}
            {activeTab === "reviews" && listing.sellerType === "platform" && (
              <div className="text-center py-8 text-gray-400">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t("marketplaceListing.tabs.reviews.noData.official")}</p>
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
        <DialogContent showCloseButton={false} className="sm:max-w-md p-0 overflow-visible border-2 border-[#FEDD00] gap-0">
          <VisuallyHidden><DialogTitle>{t("marketplaceListing.alipay.title")}</DialogTitle></VisuallyHidden>
          {/* 深藍色頭部 */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FEDD00]/20 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-[#FEDD00]" />
              </div>
              <h2 className="text-white font-bold text-lg">{t("marketplaceListing.alipay.title")}</h2>
            </div>
            <button onClick={() => setShowAlipay(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 bg-white text-[#06038D]">

          {alipayStep === "qr" && (
            <div className="space-y-4">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-4 text-sm">
                <p className="font-bold text-[#06038D]">
                  付款金額：<span className="text-lg">HKD {effectivePrice.toFixed(2)}</span>
                  {acceptedOffer && <span className="text-xs text-green-600 ml-2">{t("marketplaceListing.alipay.offerPriceLabel")}</span>}
                </p>
                <p className="text-gray-600 mt-1">{listing.title}</p>
              </div>
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500">{t("marketplaceListing.alipay.scanPrompt")}</p>
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
                <p className="font-medium">{t("marketplaceListing.alipay.memoPrompt")}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm font-bold tracking-wide flex-1">#BOXIUM-{listing.id}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`#BOXIUM-${listing.id}`);
                      toast.success(t("marketplaceListing.alipay.copySuccess"));
                    }}
                    className="flex items-center gap-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    複製編號
                  </button>
                </div>
                <p className="text-amber-600 mt-1">{t("marketplaceListing.alipay.memoWarning")}</p>
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
                <p className="font-medium">{t("marketplaceListing.alipay.address.title")}</p>
                <p className="text-xs mt-1 text-gray-500">{t("marketplaceListing.alipay.address.subtitle")}</p>
              </div>
              {/* 已儲存地址快速選擇 */}
              {savedAddresses && savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">{t("marketplaceListing.alipay.address.saved")}</p>
                    {(alipayShippingForm.name || alipayShippingForm.phone) && (
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                        onClick={() => { setAlipayShippingForm({ name: "", phone: "", address: "", district: "", region: "香港", addressType: "normal", sfStationCode: "", sfStationName: "", sfStationAddress: "" }); setAlipaySfSearch(""); setAlipaySfRegion(""); setAlipaySfType('all'); setAlipaySfResults([]); setAlipaySfDropdown(false); }}
                      >
                        <X className="w-3 h-3" /> 清除已選地址
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {savedAddresses.map((addr: any) => (
                      <button
                        key={addr.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                          alipayShippingForm.name === addr.recipientName && alipayShippingForm.phone === addr.phone
                            ? "border-[#06038D] bg-[#06038D]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setAlipayShippingForm({
                          name: addr.recipientName,
                          phone: addr.phone,
                          address: addr.addressType === "sf_station" ? `順豐自提站 ${addr.sfStationCode}` : (addr.address || ""),
                          district: addr.addressType === "sf_station" ? (addr.sfStationName || "") : (addr.district || ""),
                          sfStationAddress: addr.sfStationCode ? (addr.sfStationName || "") : "",
                          region: addr.region || "香港",
                          addressType: addr.addressType || "normal",
                          sfStationCode: addr.sfStationCode || "",
                          sfStationName: addr.sfStationName || "",
                        })}
                      >
                        <span className="font-semibold">{addr.label}</span>
                        <span className="text-gray-500 ml-2">{addr.recipientName} · {addr.phone}</span>
                        <br />
                        <span className="text-gray-400 text-xs">
                          {addr.addressType === "sf_station"
                            ? <>📦 順豐自提站 {addr.sfStationName ? `${addr.sfStationName} ` : ""}<span className="font-mono">{addr.sfStationCode}</span></>
                            : <>{addr.district ? `${addr.district}，` : ""}{addr.address}</>}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">{t("marketplaceListing.alipay.address.manualFillPrompt")}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("marketplaceListing.alipay.address.recipientName")}</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder={t("marketplaceListing.alipay.address.recipientName.placeholder")} value={alipayShippingForm.name} onChange={e => setAlipayShippingForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>聯絡電話 *</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：9123 4567" value={alipayShippingForm.phone} onChange={e => setAlipayShippingForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              {alipayShippingForm.addressType === "sf_station" ? (
                <div className="space-y-2">
                  {/* SF search */}
                  <div className="flex gap-1.5 flex-wrap">
                    {([['all', '全部'], ['station', '順豐站'], ['locker', '智能櫃']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setAlipaySfType(val); setAlipaySfDropdown(true); }}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${alipaySfType === val ? 'bg-[#06038D] text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{label}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] pl-7" placeholder="搜尋名稱/地址/編號" value={alipaySfSearch} onChange={e => { setAlipaySfSearch(e.target.value); setAlipaySfDropdown(true); }} onFocus={() => setAlipaySfDropdown(true)} />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    </div>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] bg-white" value={alipaySfRegion} onChange={e => { setAlipaySfRegion(e.target.value); setAlipaySfDropdown(true); }}>
                      <option value="">全部地區</option>
                      {["香港島", "九龍", "新界"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  {alipaySfDropdown && alipaySfResults.length > 0 && (
                    <div className="border rounded-xl overflow-hidden shadow-sm max-h-40 overflow-y-auto">
                      {alipaySfResults.map((pt: SFPoint) => (
                        <button key={pt.code} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 transition-colors"
                          onClick={() => { setAlipayShippingForm(f => ({ ...f, sfStationCode: pt.code, sfStationName: pt.name, sfStationAddress: pt.address || "" })); setAlipaySfDropdown(false); setAlipaySfSearch(""); }}>
                          <div className="flex items-center gap-1">
                            <span className="text-xs px-1 py-0.5 rounded" style={{ background: pt.type === 'locker' ? '#fef3c722' : '#06038D22', color: pt.type === 'locker' ? '#b45309' : '#06038D' }}>{pt.type === 'locker' ? '智能櫃' : '順豐站'}</span>
                            <span className="text-xs font-medium text-gray-900">{pt.name}</span>
                          </div>
                          <p className="text-xs text-gray-400 font-mono">{pt.code} · {pt.address}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {alipayShippingForm.sfStationCode && (
                    <div className="flex items-start gap-2 p-3 bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl">
                      <span className="text-[#06038D] text-lg">📦</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#06038D]">{alipayShippingForm.sfStationName || "順豐自提站"}</p>
                        <p className="text-xs text-gray-500 font-mono">{alipayShippingForm.sfStationCode}</p>
                        {alipayShippingForm.sfStationAddress && <p className="text-xs text-gray-400 mt-0.5">{alipayShippingForm.sfStationAddress}</p>}
                      </div>
                      <button onClick={() => setAlipayShippingForm(f => ({ ...f, sfStationCode: '', sfStationName: '', sfStationAddress: '' }))} className="text-xs text-red-500 hover:text-red-700 font-medium">✕ 清除</button>
                    </div>
                  )}
                  {!alipayShippingForm.sfStationCode && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">或手動輸入順豐站/智能櫃編號</Label>
                      <input
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] ${
                          alipayShippingForm.sfStationCode && !validateSFCode(alipayShippingForm.sfStationCode).valid
                            ? "border-red-400 bg-red-50"
                            : "border-gray-200"
                        }`}
                        placeholder="例：852Z351 或 H852001P"
                        value={alipayShippingForm.sfStationCode}
                        onChange={e => setAlipayShippingForm(f => ({ ...f, sfStationCode: e.target.value }))}
                      />
                      {alipayShippingForm.sfStationCode && !validateSFCode(alipayShippingForm.sfStationCode).valid && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {validateSFCode(alipayShippingForm.sfStationCode).message}
                        </p>
                      )}
                      {alipayShippingForm.sfStationCode && validateSFCode(alipayShippingForm.sfStationCode).valid && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {validateSFCode(alipayShippingForm.sfStationCode).type === 'locker' ? '✓ 有效智能櫃編號' : '✓ 有效順豐站編號'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                        <option value={t("marketplaceListing.address.region.hongkong")}>香港（不指定）</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              <p className="text-xs text-gray-400">* 必填欄位。如不需要寄送可跳過。</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-[#06038D] border-gray-200" onClick={() => setAlipayStep("qr")}>返回</Button>
                <Button
                  className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white"
                  disabled={!alipayShippingForm.name.trim() || !alipayShippingForm.phone.trim() || (alipayShippingForm.addressType !== "sf_station" && !alipayShippingForm.address.trim()) || (alipayShippingForm.addressType === "sf_station" && alipayShippingForm.sfStationCode.trim() !== "" && !validateSFCode(alipayShippingForm.sfStationCode).valid)}
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
                <Button variant="outline" className="flex-1 text-[#06038D] border-gray-200" onClick={() => setAlipayStep("qr")}>返回</Button>
                <Button
                  className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white font-bold"
                  disabled={!proofUrl || isVerifying || isUploading || createAlipayOrderMutation.isPending}
                  onClick={() => createAlipayOrderMutation.mutate({
                    listingId: listing.id,
                    offerId: acceptedOffer?.id ?? undefined,
                    proofImageUrl: proofUrl,
                    shippingAddress: alipayShippingForm.name.trim() ? (
                      alipayShippingForm.addressType === "sf_station" ? {
                        name: alipayShippingForm.name.trim(),
                        phone: alipayShippingForm.phone.trim(),
                        address: `順豐自提站 ${alipayShippingForm.sfStationCode}`,
                        district: alipayShippingForm.sfStationName || undefined,
                        region: "香港",
                        sfStationCode: alipayShippingForm.sfStationCode,
                        sfStationName: alipayShippingForm.sfStationName || undefined,
                      } : {
                        name: alipayShippingForm.name.trim(),
                        phone: alipayShippingForm.phone.trim(),
                        address: alipayShippingForm.address.trim(),
                        district: alipayShippingForm.district.trim() || undefined,
                        region: alipayShippingForm.region,
                      }
                    ) : undefined,
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
              <p className="font-bold text-lg text-[#06038D]">{t("marketplaceListing.order.submitted")}</p>
              <p className="text-sm text-gray-500">我們將在核對收款後確認你的訂單，通常需要 1-2 個工作天。</p>
              <Button className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white" onClick={() => setShowAlipay(false)}>關閉</Button>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Shipping Dialog ── */}
      <Dialog open={showShippingDialog} onOpenChange={(open) => { setShowShippingDialog(open); if (!open) { setShippingForm({ name: "", phone: "", address: "", district: "", region: "香港", addressType: "normal", sfStationCode: "", sfStationName: "", sfStationAddress: "" }); setSelectedSavedAddressId(null); } }}>
        <DialogContent bottomSheet showCloseButton={false} className="sm:max-w-md p-0 overflow-hidden border-2 border-[#FEDD00] gap-0">
          <VisuallyHidden><DialogTitle>填寫收貨地址</DialogTitle></VisuallyHidden>
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
          <div className="p-6 space-y-4 bg-white text-[#06038D]">
            {savedAddresses && savedAddresses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("marketplaceListing.alipay.address.saved")}</p>
                  {selectedSavedAddressId !== null && (
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                      onClick={() => { setSelectedSavedAddressId(null); setShippingForm({ name: "", phone: "", address: "", district: "", region: "香港", addressType: "normal", sfStationCode: "", sfStationName: "", sfStationAddress: "" }); setStripeSfSearch(""); setStripeSfRegion(""); setStripeSfType('all'); setStripeSfResults([]); setStripeSfDropdown(false); }}
                    >
                      <X className="w-3 h-3" /> 清除已選地址
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {savedAddresses.map((addr: any) => (
                    <button key={addr.id} type="button"
                      onClick={() => { setSelectedSavedAddressId(addr.id); setShippingForm({ name: addr.recipientName, phone: addr.phone, address: addr.address || "", district: addr.district || "", region: addr.region, addressType: (addr.addressType as any) || "normal", sfStationCode: addr.sfStationCode || "", sfStationName: addr.sfStationName || "", sfStationAddress: "" }); }}
                      className={`w-full text-left rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                        selectedSavedAddressId === addr.id ? "border-[#06038D] bg-[#06038D]/5" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <span className="font-semibold">{addr.label}</span>
                      <span className="text-gray-500 ml-2">{addr.recipientName} · {addr.phone}</span>
                      <br />
                      <span className="text-gray-400 text-xs">
                        {addr.addressType === "sf_station"
                          ? <>📦 順豐自提站 {addr.sfStationName ? `${addr.sfStationName} ` : ""}<span className="font-mono">{addr.sfStationCode}</span></>
                          : <>{addr.district ? `${addr.district}，` : ""}{addr.address}</>}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">{t("marketplaceListing.alipay.address.manualFillPrompt")}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-name">{t("marketplaceListing.alipay.address.recipientName")}</Label>
                <input id="ship-name" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder={t("marketplaceListing.alipay.address.recipientName.placeholder")} value={shippingForm.name} onChange={e => setShippingForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-phone">聯絡電話 *</Label>
                <input id="ship-phone" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：9123 4567" value={shippingForm.phone} onChange={e => setShippingForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            {shippingForm.addressType === "normal" && (
              <>
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
                      <option value={t("marketplaceListing.address.region.hongkong")}>香港（不指定）</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            {shippingForm.addressType === "sf_station" && (
              <div className="space-y-2">
                {/* SF search */}
                <div className="flex gap-1.5 flex-wrap">
                  {([['all', '全部'], ['station', '順豐站'], ['locker', '智能櫃']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => { setStripeSfType(val); setStripeSfDropdown(true); }}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${stripeSfType === val ? 'bg-[#06038D] text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] pl-7" placeholder="搜尋名稱/地址/編號" value={stripeSfSearch} onChange={e => { setStripeSfSearch(e.target.value); setStripeSfDropdown(true); }} onFocus={() => setStripeSfDropdown(true)} />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                  </div>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] bg-white" value={stripeSfRegion} onChange={e => { setStripeSfRegion(e.target.value); setStripeSfDropdown(true); }}>
                    <option value="">全部地區</option>
                    {["香港島", "九龍", "新界"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {stripeSfDropdown && stripeSfResults.length > 0 && (
                  <div className="border rounded-xl overflow-hidden shadow-sm max-h-40 overflow-y-auto">
                    {stripeSfResults.map((pt: SFPoint) => (
                      <button key={pt.code} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0 transition-colors"
                        onClick={() => { setShippingForm(f => ({ ...f, sfStationCode: pt.code, sfStationName: pt.name, sfStationAddress: pt.address || "" })); setStripeSfDropdown(false); setStripeSfSearch(""); }}>
                        <div className="flex items-center gap-1">
                          <span className="text-xs px-1 py-0.5 rounded" style={{ background: pt.type === 'locker' ? '#fef3c722' : '#06038D22', color: pt.type === 'locker' ? '#b45309' : '#06038D' }}>{pt.type === 'locker' ? '智能櫃' : '順豐站'}</span>
                          <span className="text-xs font-medium text-gray-900">{pt.name}</span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono">{pt.code} · {pt.address}</p>
                      </button>
                    ))}
                  </div>
                )}
                {shippingForm.sfStationCode && (
                  <div className="flex items-start gap-2 p-3 bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl">
                    <span className="text-[#06038D] text-lg">📦</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#06038D]">{shippingForm.sfStationName || "順豐自提站"}</p>
                      <p className="text-xs text-gray-500 font-mono">{shippingForm.sfStationCode}</p>
                      {shippingForm.sfStationAddress && <p className="text-xs text-gray-400 mt-0.5">{shippingForm.sfStationAddress}</p>}
                    </div>
                    <button onClick={() => setShippingForm(f => ({ ...f, sfStationCode: '', sfStationName: '', sfStationAddress: '' }))} className="text-xs text-red-500 hover:text-red-700 font-medium">✕ 清除</button>
                  </div>
                )}
                {!shippingForm.sfStationCode && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">或手動輸入順豐站/智能櫃編號</Label>
                    <input
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] ${
                        shippingForm.sfStationCode && !validateSFCode(shippingForm.sfStationCode).valid
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200"
                      }`}
                      placeholder="例：852Z351 或 H852001P"
                      value={shippingForm.sfStationCode}
                      onChange={e => setShippingForm(f => ({ ...f, sfStationCode: e.target.value }))}
                    />
                    {shippingForm.sfStationCode && !validateSFCode(shippingForm.sfStationCode).valid && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validateSFCode(shippingForm.sfStationCode).message}
                      </p>
                    )}
                    {shippingForm.sfStationCode && validateSFCode(shippingForm.sfStationCode).valid && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {validateSFCode(shippingForm.sfStationCode).type === 'locker' ? '✓ 有效智能櫃編號' : '✓ 有效順豐站編號'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400">* 必填欄位。收貨地址將提供給賣家安排寄送。</p>
          </div>
          <div className="px-6 pb-6 flex gap-3 bg-white">
            <Button variant="outline" className="flex-1 border-gray-200 text-[#06038D]" onClick={() => setShowShippingDialog(false)}>取消</Button>
            <Button
              className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white font-bold"
              disabled={!shippingForm.name.trim() || !shippingForm.phone.trim() || (shippingForm.addressType === "normal" && !shippingForm.address.trim()) || (shippingForm.addressType === "sf_station" && (!shippingForm.sfStationCode.trim() || !validateSFCode(shippingForm.sfStationCode).valid)) || createStripeOrderMutation.isPending}
              onClick={() => {
                setShowShippingDialog(false);
                createStripeOrderMutation.mutate({
                  listingId: listing.id,
                  offerId: acceptedOffer?.id ?? undefined,
                  shippingAddress: shippingForm.addressType === "sf_station" ? {
                    name: shippingForm.name.trim(),
                    phone: shippingForm.phone.trim(),
                    address: `順豐自提站 ${shippingForm.sfStationCode}`,
                    district: shippingForm.sfStationName || undefined,
                    region: "香港",
                    sfStationCode: shippingForm.sfStationCode,
                    sfStationName: shippingForm.sfStationName || undefined,
                  } : {
                    name: shippingForm.name.trim(),
                    phone: shippingForm.phone.trim(),
                    address: shippingForm.address.trim(),
                    district: shippingForm.district.trim() || undefined,
                    region: shippingForm.region,
                  },
                });
              }}
            >
              {createStripeOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</> : <><CreditCard className="w-4 h-4 mr-2" />信用卡付款</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Offer Dialog ── */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent bottomSheet showCloseButton={false} className="sm:max-w-sm p-0 overflow-hidden border-2 border-[#FEDD00] gap-0">
          <VisuallyHidden><DialogTitle>{t("marketplaceListing.offer.button.makeOffer")}</DialogTitle></VisuallyHidden>
          {/* 深藍色頭部 */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FEDD00]/20 flex items-center justify-center">
                <Tag className="w-4 h-4 text-[#FEDD00]" />
              </div>
              <h2 className="text-white font-bold text-lg">{t("marketplaceListing.offer.button.makeOffer")}</h2>
            </div>
            <button onClick={() => setShowOfferDialog(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4 bg-white text-[#06038D]">
            {listing?.priceHkd && (() => {
              const listingPrice = parseFloat(listing.priceHkd as string);
              const minOfferPrice = Math.ceil(listingPrice * 0.7 * 100) / 100;
              return (
                <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-sm">
                  <p className="text-gray-500">市價</p>
                  <p className="font-bold text-[#06038D] text-lg">HKD {listingPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">最低可出價：<span className="font-semibold text-[#06038D]">HKD {minOfferPrice.toFixed(0)}</span>（定價 70%）</p>
                </div>
              );
            })()}
            <div>
              <Label className="text-sm font-medium mb-1.5 block text-[#06038D]">出價金額（HKD） *</Label>
              <Input
                type="number"
                placeholder="請輸入出價金額"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className={`border-gray-200 focus-visible:ring-[#06038D] ${
                  offerAmount && listing?.priceHkd &&
                  parseFloat(offerAmount) < Math.ceil(parseFloat(listing.priceHkd as string) * 0.7 * 100) / 100
                    ? 'border-red-400 focus-visible:ring-red-400'
                    : ''
                }`}
              />
              {offerAmount && listing?.priceHkd && (() => {
                const listingPrice = parseFloat(listing.priceHkd as string);
                const minOfferPrice = Math.ceil(listingPrice * 0.7 * 100) / 100;
                const entered = parseFloat(offerAmount);
                if (entered > 0 && entered < minOfferPrice) {
                  return (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      出價金額不能低於定價的 70%（最低 HKD {minOfferPrice.toFixed(0)}）
                    </p>
                  );
                }
                return null;
              })()}
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
          <div className="px-6 pb-6 flex gap-3 bg-white">
            <Button variant="outline" className="flex-1 border-gray-200 text-[#06038D]" onClick={() => setShowOfferDialog(false)}>取消</Button>
            <Button
              className="flex-1 bg-[#FEDD00] hover:bg-[#e8c800] text-[#06038D] font-bold"
              disabled={(() => {
                if (!offerAmount || parseFloat(offerAmount) <= 0 || makeOfferMutation.isPending) return true;
                if (listing?.priceHkd) {
                  const minOfferPrice = Math.ceil(parseFloat(listing.priceHkd as string) * 0.7 * 100) / 100;
                  if (parseFloat(offerAmount) < minOfferPrice) return true;
                }
                return false;
              })()}
              onClick={() => {
                if (!listing || !me) return;
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
          <VisuallyHidden><DialogTitle>舉報商品</DialogTitle></VisuallyHidden>
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

// ─── Add to Cart Button ────────────────────────────────────────────────────────────────────────────────────
function AddToCartButton({ listingId, isLoggedIn, isAcceptedOffer }: { listingId: number; isLoggedIn: boolean; isAcceptedOffer?: boolean }) {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [flyAnim, setFlyAnim] = useState(false);

  const { data: inCart } = trpc.marketplace.isInCart.useQuery(
    { listingId },
    { enabled: isLoggedIn }
  );

  const { trigger: triggerCartBounce } = useCartBounce();

  const addToCartMutation = trpc.marketplace.addToCart.useMutation({
    onSuccess: () => {
      utils.marketplace.isInCart.invalidate({ listingId });
      utils.marketplace.getCartCount.invalidate();
      // Trigger fly animation only, no navigation
      setFlyAnim(true);
      setShowSuccess(true);
      setTimeout(() => {
        setFlyAnim(false);
        setShowSuccess(false);
      }, 900);
      // Trigger cart icon bounce animation
      triggerCartBounce();
      // Show toast with action button
      toast.success("已加入購物車", {
        action: {
          label: "查看購物車",
          onClick: () => window.location.href = "/cart",
        },
        duration: 4000,
      });
    },
    onError: (err) => {
      const msg = err.message || "加入購物車失敗";
      // Show specific stock error message
      if (msg.includes("庫存不足") || msg.includes("已下架") || msg.includes("不存在")) {
        toast.error(msg, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    },
  });

  if (!isLoggedIn) {
    return (
      <Button
        className="w-full bg-[#FEDD00] hover:bg-[#e8c800] text-[#06038D] font-bold h-12 text-base rounded-xl shadow-sm"
        onClick={() => { window.location.href = "/login"; }}
      >
        <ShoppingCart className="w-5 h-5 mr-2" />
        登入後加入購物車
      </Button>
    );
  }

  // Already in cart - show disabled "already in cart" button + link to cart
  if (inCart) {
    return (
      <div className="space-y-2">
        <Button
          className="w-full font-bold h-12 text-base rounded-xl shadow-sm cursor-not-allowed"
          style={{ background: "#e5e7eb", color: "#6b7280" }}
          disabled
        >
          <Check className="w-5 h-5 mr-2" />
          {isAcceptedOffer ? "已在購物車（待付款）" : "已在購物車"}
        </Button>
        <button
          onClick={() => setLocation("/cart")}
          className="w-full text-sm text-[#06038D] hover:underline flex items-center justify-center gap-1"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          {isAcceptedOffer ? "前往購物車付款" : "前往購物車"}
        </button>
      </div>
    );
  }

  // Not in cart - primary yellow button with fly animation
  return (
    <div className="relative">
      {/* Flying cart icon animation */}
      {flyAnim && (
        <div
          className="absolute left-1/2 top-0 z-50 pointer-events-none"
          style={{
            animation: "flyToCart 0.8s ease-in forwards",
            transform: "translateX(-50%)",
          }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ background: "#FEDD00" }}>
            <ShoppingCart className="w-5 h-5" style={{ color: "#06038D" }} />
          </div>
        </div>
      )}
      <style>{`
        @keyframes flyToCart {
          0% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          60% { transform: translateX(calc(-50% + 80px)) translateY(-60px) scale(0.8); opacity: 0.9; }
          100% { transform: translateX(calc(-50% + 160px)) translateY(-120px) scale(0.3); opacity: 0; }
        }
      `}</style>
      <Button
        className="w-full font-bold h-12 text-base rounded-xl shadow-sm disabled:opacity-40 transition-all duration-200"
        style={{
          background: showSuccess ? "#22c55e" : "#FEDD00",
          color: showSuccess ? "#fff" : "#06038D",
        }}
        disabled={addToCartMutation.isPending || showSuccess}
        onClick={() => addToCartMutation.mutate({ listingId })}
      >
        <ShoppingCart className="w-5 h-5 mr-2" />
        {addToCartMutation.isPending ? "加入中..." : showSuccess ? "已加入✓" : isAcceptedOffer ? "加入購物車付款" : "加入購物車"}
      </Button>
    </div>
  );
}
