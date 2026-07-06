import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation, useSearch, Link } from "wouter";

import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Package, ChevronLeft, ChevronRight, X, ShoppingBag,
  SlidersHorizontal, Heart, Star, Tag, Shield, Award,
  ShoppingCart, TrendingUp, Zap, Loader2, ArrowUp, Filter, Share2, Copy, Check, Gavel
} from "lucide-react";
import { AuctionCard, AuctionCardSkeleton } from "@/components/AuctionCard";
import { AuctionHero, AuctionHeroSkeleton } from "@/components/AuctionHero";
import { ListingCard, ListingCardSkeleton } from "@/components/ListingCard";
import { toast } from "sonner";
import {
  CONDITION_GROUPS, CONDITION_SHORT, CONDITION_BADGE,
  type ConditionValue
} from "@/lib/conditions";
import { useTranslation } from "react-i18next";
import { getProxiedImageUrl } from "@/lib/utils";
import PageHead from "@/components/PageHead";

// ─── TCG Series Config (只保留 3 種 + 全部) ──────────────────────────────────

const TCG_SERIES = [
  { value: "all",      label: "全部",      emoji: "🎴", logo: null,                                                                                                                                      color: "bg-[#06038D] text-white",         border: "border-[#06038D]" },
  { value: "pokemon",  label: "Pokémon",   emoji: "⚡",  logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif",  color: "bg-yellow-400 text-[#06038D]",    border: "border-yellow-400" },
  { value: "onepiece", label: "One Piece", emoji: "🏴‍☠️", logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif", color: "bg-red-600 text-white",           border: "border-red-600" },
  { value: "yugioh",   label: "Yu-Gi-Oh!", emoji: "🔮",  logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp",  color: "bg-purple-700 text-white",         border: "border-purple-700" },
];

const TCG_SERIES_LOGO: Record<string, string> = {
  pokemon:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif",
  onepiece: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif",
  yugioh:   "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp",
};

const TCG_SERIES_BADGE: Record<string, string> = {
  pokemon:  "bg-yellow-100 text-yellow-800",
  onepiece: "bg-red-100 text-red-800",
  yugioh:   "bg-purple-100 text-purple-800",
};

const TCG_SERIES_LABEL: Record<string, string> = {
  pokemon:  "Pokémon",
  onepiece: "One Piece",
  yugioh:   "Yu-Gi-Oh!",
};

const CONDITION_CHIPS = [
  { label: "PSA 評級", conditions: ["psa10", "psa9", "psa8_below"], icon: Award },
  { label: "BGS 評級", conditions: ["bgs10", "bgs9", "bgs8_below"], icon: Award },
  { label: "TAG 評級", conditions: ["tag10", "tag9_below"],          icon: Award },
  { label: "Raw 卡",   conditions: ["raw_a", "raw_b", "raw_c", "raw_d"], icon: Tag },
];

const PAGE_SIZE = 24;

// ─── Product Card ────────────────────────────────────────────────────────────

// ProductCard is now replaced by ListingCard from @/components/ListingCard
// Keeping this stub to avoid breaking any remaining references during migration
function ProductCard({ listing, wishlistIds, onWishlistToggle }: {
  listing: any;
  wishlistIds?: number[];
  onWishlistToggle?: (id: number) => void;
}) {
  return (
    <ListingCard
      listing={listing}
      variant="marketplace"
      wishlistIds={wishlistIds}
      onWishlistToggle={onWishlistToggle}
    />
  );
}

// Legacy stub — kept for reference only
function _ProductCardLegacy({ listing, wishlistIds, onWishlistToggle }: {
  listing: any;
  wishlistIds?: number[];
  onWishlistToggle?: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const images: string[] | null = (() => {
    try { return listing.images ? JSON.parse(listing.images) : null; }
    catch { return null; }
  })();
  const coverImageRaw = images && images.length > 0 ? images[0] : null;
  const coverImage = getProxiedImageUrl(coverImageRaw);
  const conditionKey = listing.condition as ConditionValue;
  const isWishlisted = wishlistIds?.includes(listing.id) ?? false;
  const isSoldOut = listing.remainingQuantity === 0 || listing.status === 'sold';

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/marketplace/${listing.id}${listing.tcgSeries && listing.tcgSeries !== 'all' ? `?series=${listing.tcgSeries}` : ''}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success(t("marketplace.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error(t("marketplace.copyFailed")));
  };

  return (
    <div
      className={`group bg-white rounded-xl overflow-hidden border border-gray-100 transition-all duration-300 flex flex-col relative ${isSoldOut ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-[#FEDD00] hover:shadow-lg'}`}
      onClick={() => { if (!isSoldOut) setLocation(`/marketplace/${listing.id}`); }}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage ?? undefined}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* Sold out overlay */}
        {(listing.remainingQuantity === 0 || listing.status === 'sold') && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
              <span className="text-[#06038D] font-bold text-sm tracking-wider">{t("marketplace.soldOut")}</span>
            </div>
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm backdrop-blur-sm ${CONDITION_BADGE[conditionKey] ?? "bg-gray-100 text-gray-600 border border-gray-300"}`}>
              {CONDITION_SHORT[conditionKey] ?? conditionKey}
            </span>
            {listing.tcgSeries && listing.tcgSeries !== "pokemon" && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow-sm backdrop-blur-sm ${TCG_SERIES_BADGE[listing.tcgSeries] ?? "bg-gray-100 text-gray-700"}`}>
                {TCG_SERIES_LABEL[listing.tcgSeries] ?? listing.tcgSeries}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {listing.sellerType === "platform" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#06038D]/90 text-[#FEDD00] shadow-sm backdrop-blur-sm">
                {t("marketplace.official")}
              </span>
            )}
            {onWishlistToggle && (
              <button
                className="w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:scale-110 transition-transform z-10"
                onClick={e => { e.stopPropagation(); onWishlistToggle(listing.id); }}
                aria-label={isWishlisted ? t("marketplace.removeWishlist") : t("marketplace.addWishlist")}
              >
                <Heart className={`w-3.5 h-3.5 transition-colors ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-400"}`} />
              </button>
            )}
          </div>
        </div>

        {/* Hover CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="bg-[#06038D]/90 backdrop-blur-sm text-white font-semibold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-lg">
            <ShoppingCart className="w-3.5 h-3.5" />
            {t("marketplace.viewDetails")}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug flex-1 min-h-[2.5rem]">
          {listing.title}
        </p>
        <div className="flex items-end justify-between gap-1">
          <p className="text-lg font-bold text-[#06038D] leading-tight">
            HK${Number(listing.priceHkd).toLocaleString()}
          </p>
          {listing.quantity <= 3 && listing.quantity > 0 && (
            <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5 bg-orange-50 px-1.5 py-0.5 rounded-md shrink-0">
              <Zap className="w-2.5 h-2.5" />{t("marketplace.onlyLeft", { count: listing.quantity })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          {listing.sellerType === "seller" && listing.sellerProfile ? (
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              {listing.sellerProfile.ratingCount > 0 ? (
                <>
                  <Star className="w-3 h-3 fill-[#FEDD00] text-[#FEDD00]" />
                  <span className="font-medium text-gray-700">{parseFloat(listing.sellerProfile.avgRating ?? "0").toFixed(1)}</span>
                  <span>({listing.sellerProfile.ratingCount})</span>
                </>
              ) : (
                <span className="text-gray-400">{t("marketplace.newSeller")}</span>
              )}
            </div>
          ) : <span />}
          <div className="flex items-center gap-1.5">
            {listing.tcgSeries && TCG_SERIES_LOGO[listing.tcgSeries] && (
              <img
                src={getProxiedImageUrl(TCG_SERIES_LOGO[listing.tcgSeries]) ?? undefined}
                alt={TCG_SERIES_LABEL[listing.tcgSeries] ?? listing.tcgSeries}
                className="h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
              />
            )}
            <button
              onClick={handleCopyLink}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-[#06038D] hover:bg-gray-100 transition-all"
              title={t("marketplace.copyProductLink")}
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Share2 className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );
}

// ─── Left Sidebar Filter ──────────────────────────────────────────────────────

function SidebarFilter({
  tcgSeries, setTcgSeries,
  selectedConditions, toggleCondition, clearConditions,
  sellerType, setSellerType,
  priceMin, setPriceMin,
  priceMax, setPriceMax,
  clearAllFilters, hasActiveFilters, activeFilterCount,
  resetAndSearch,
}: {
  tcgSeries: string;
  setTcgSeries: (v: string) => void;
  selectedConditions: string[];
  toggleCondition: (v: string) => void;
  clearConditions: () => void;
  sellerType: string;
  setSellerType: (v: string) => void;
  priceMin: string;
  setPriceMin: (v: string) => void;
  priceMax: string;
  setPriceMax: (v: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  resetAndSearch: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className="w-full space-y-5 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[#06038D] text-sm flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          {t("marketplace.filter.title")}
          {activeFilterCount > 0 && (
            <span className="bg-[#FEDD00] text-[#06038D] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </h2>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-400 hover:text-[#06038D] transition-colors"
          >
            {t("marketplace.filter.clearAll")}
          </button>
        )}
      </div>

      {/* TCG Series */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("marketplace.filter.tcgSeries")}</p>
        <div className="space-y-1">
          {TCG_SERIES.map(s => {
            const isActive = tcgSeries === s.value;
            return (
              <button
                key={s.value}
                onClick={() => { setTcgSeries(s.value); resetAndSearch(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-[#06038D] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-[#06038D]"
                }`}
              >
                {s.logo ? (
                  <img
                    src={getProxiedImageUrl(s.logo) ?? undefined}
                    alt={s.label}
                    className="w-12 h-7 object-contain flex-shrink-0"
                  />
                ) : (
                  <span className="text-base">{s.emoji}</span>
                )}
                {s.label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FEDD00]" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Seller Type */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("marketplace.filter.source")}</p>
        <div className="space-y-1">
          {[
            { value: "all",      label: t("marketplace.filter.allSources"), icon: ShoppingBag },
            { value: "platform", label: t("marketplace.filter.official"),  icon: Shield },
            { value: "seller",   label: t("marketplace.filter.individualSeller"),  icon: Star },
          ].map(chip => {
            const Icon = chip.icon;
            const isActive = sellerType === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => { setSellerType(chip.value); resetAndSearch(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-[#06038D] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-[#06038D]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {chip.label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FEDD00]" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Condition */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("marketplace.filter.condition")}</p>
          {selectedConditions.length > 0 && (
            <button onClick={() => { clearConditions(); resetAndSearch(); }} className="text-[11px] text-[#06038D] hover:underline">
              {t("marketplace.filter.clear")}
            </button>
          )}
        </div>
        {CONDITION_GROUPS.map(group => (
          <div key={group.group} className="space-y-1.5">
            <p className="text-[11px] font-bold text-gray-500">{group.group}</p>
            <div className="flex flex-wrap gap-1">
              {group.items.map(item => {
                const checked = selectedConditions.includes(item.value);
                return (
                  <button
                    key={item.value}
                    onClick={() => toggleCondition(item.value)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-all duration-150 font-medium ${
                      checked
                        ? "bg-[#06038D] text-white border-[#06038D]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-[#06038D] hover:text-[#06038D]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-gray-100" />

      {/* Price Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("marketplace.filter.priceRange")}</p>
          {(priceMin || priceMax) && (
            <button
              onClick={() => { setPriceMin(""); setPriceMax(""); resetAndSearch(); }}
              className="text-[11px] text-[#06038D] hover:underline"
            >
              {t("marketplace.filter.clear")}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 items-center">
          <Input
            type="number"
            placeholder={t("marketplace.filter.minPrice")}
            value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
            onBlur={() => resetAndSearch()}
            onKeyDown={e => e.key === 'Enter' && resetAndSearch()}
            className="h-8 text-xs border-gray-200 focus-visible:ring-[#06038D] min-w-0 text-gray-900 placeholder:text-gray-400"
          />
          <Input
            type="number"
            placeholder={t("marketplace.filter.maxPrice")}
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
            onBlur={() => resetAndSearch()}
            onKeyDown={e => e.key === 'Enter' && resetAndSearch()}
            className="h-8 text-xs border-gray-200 focus-visible:ring-[#06038D] min-w-0 text-gray-900 placeholder:text-gray-400"
          />
        </div>
      </div>
    </aside>
  );
}

//// ─── Maintenance Page ───────────────────────────────────────────────────────
function MarketplaceMaintenancePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#06038D] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Shield className="w-10 h-10 text-[#06038D]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">{t("marketplace.maintenance.title")}</h1>
        <p className="text-white/70 text-base mb-6 leading-relaxed">
          {t("marketplace.maintenance.message")}
        </p>
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors">
          {t("common.backToHome")}
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Marketplace() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  // ── Maintenance mode check ──
  const { data: accessData, isLoading: accessLoading } = trpc.marketplace.getMarketplaceAccess.useQuery();
  // 初始化時從 URL 讀取篩選狀態
  const initParams = useMemo(() => {
    const p = new URLSearchParams(searchStr);
    return {
      search: p.get("search") ?? "",
      series: p.get("series") ?? "all",
      sellerType: p.get("seller") ?? "all",
      sortBy: (p.get("sort") ?? "newest") as "newest" | "price_asc" | "price_desc",
      priceMin: p.get("min") ?? "",
      priceMax: p.get("max") ?? "",
      conditions: p.get("cond") ? p.get("cond")!.split(",") : [] as string[],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在首次載入時讀取

  const [search, setSearch] = useState(initParams.search);
  const [searchInput, setSearchInput] = useState(initParams.search);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(initParams.conditions);
  const [sellerType, setSellerType] = useState<string>(initParams.sellerType);
  const [tcgSeries, setTcgSeries] = useState<string>(initParams.series);
  const [priceMin, setPriceMin] = useState<string>(initParams.priceMin);
  const [priceMax, setPriceMax] = useState<string>(initParams.priceMax);
  const debouncedPriceMin = useDebounce(priceMin, 400);
  const debouncedPriceMax = useDebounce(priceMax, 400);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">(initParams.sortBy);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [marketTab, setMarketTab] = useState<'shop' | 'auction'>('shop');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Auction list query
  const [auctionPage, setAuctionPage] = useState(1);
  const [auctionSeries, setAuctionSeries] = useState<string>('all');
  const [auctionSort, setAuctionSort] = useState<'ending_soon' | 'newest' | 'price_asc' | 'price_desc'>('ending_soon');
  const auctionQueryInput = useMemo(() => ({
    page: auctionPage,
    pageSize: 20,
    tcgSeries: auctionSeries !== 'all' ? auctionSeries : undefined,
    sortBy: auctionSort,
    status: ['active', 'ending_soon'],
  }), [auctionPage, auctionSeries, auctionSort]);
  const { data: auctionData, isLoading: auctionLoading } = trpc.auction.list.useQuery(auctionQueryInput, {
    enabled: marketTab === 'auction',
  });
  // Hero query — always enabled so the Auction Hall Hero shows on page load
  const auctionHeroQueryInput = useMemo(() => ({
    page: 1,
    pageSize: 4,
    sortBy: 'ending_soon' as const,
    status: ['active', 'ending_soon'],
  }), []);
  const { data: auctionHeroData, isLoading: auctionHeroLoading } = trpc.auction.list.useQuery(auctionHeroQueryInput, {
    enabled: true,
    staleTime: 30_000,
  });



  // Hot keywords (dynamic)
  const { data: hotKeywordsData } = trpc.marketplace.getHotKeywords.useQuery({ limit: 6, days: 7 });
  const logSearchMutation = trpc.marketplace.logSearch.useMutation();

  // Auth + wishlist
  const { data: me } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const { data: wishlistIds = [] } = trpc.marketplace.getWishlistIds.useQuery(undefined, { enabled: !!me });
  const toggleWishlistMutation = trpc.marketplace.toggleWishlist.useMutation({
    onSuccess: (res) => {
      toast.success(res.wishlisted ? t("marketplace.wishlist.added") : t("marketplace.wishlist.removed"));
      utils.marketplace.getWishlistIds.invalidate();
    },
    onError: () => toast.error(t("marketplace.wishlist.loginRequired")),
  });
  const handleWishlistToggle = (listingId: number) => {
    if (!me) { toast.error(t("marketplace.wishlist.loginRequired")); return; }
    toggleWishlistMutation.mutate({ listingId });
  };

  // Query
  const queryInput = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    conditions: selectedConditions.length > 0 ? selectedConditions : undefined,
    sellerType: sellerType !== "all" ? (sellerType as "platform" | "seller") : undefined,
    tcgSeries: tcgSeries !== "all" ? (tcgSeries as any) : undefined,
    sortBy,
    minPrice: debouncedPriceMin ? Number(debouncedPriceMin) : undefined,
    maxPrice: debouncedPriceMax ? Number(debouncedPriceMax) : undefined,
  }), [page, search, selectedConditions, sellerType, tcgSeries, sortBy, debouncedPriceMin, debouncedPriceMax]);

  const { data, isLoading, isFetching } = trpc.marketplace.getListings.useQuery(queryInput, {
    enabled: marketTab === 'shop',
  });
  const seriesCounts = data?.seriesCounts ?? {};

  useEffect(() => {
    if (data?.listings) {
      if (page === 1) {
        setAllListings(data.listings);
      } else {
        setAllListings(prev => {
          const existingIds = new Set(prev.map((l: any) => l.id));
          const newItems = data.listings.filter((l: any) => !existingIds.has(l.id));
          return [...prev, ...newItems];
        });
      }
      setHasMore(data.listings.length === PAGE_SIZE);
    }
  }, [data, page]);

  // 篩選變更時同步 URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (tcgSeries !== "all") p.set("series", tcgSeries);
    if (sellerType !== "all") p.set("seller", sellerType);
    if (sortBy !== "newest") p.set("sort", sortBy);
    if (priceMin) p.set("min", priceMin);
    if (priceMax) p.set("max", priceMax);
    if (selectedConditions.length > 0) p.set("cond", selectedConditions.join(","));
    const qs = p.toString();
    setLocation("/marketplace" + (qs ? "?" + qs : ""), { replace: true });
  }, [search, tcgSeries, sellerType, sortBy, priceMin, priceMax, selectedConditions, setLocation]);

  const resetAndSearch = useCallback(() => {
    setPage(1);
    setAllListings([]);
    setHasMore(true);
  }, []);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoading || isFetching) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isFetching]);

  // Scroll to top
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const total = data?.total ?? 0;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement)?.blur();
    setSearch(searchInput);
    resetAndSearch();
  }, [searchInput, resetAndSearch]);

  const clearSearch = useCallback(() => {
    setSearch("");
    setSearchInput("");
    resetAndSearch();
  }, [resetAndSearch]);

  const toggleCondition = (val: string) => {
    setSelectedConditions(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
    resetAndSearch();
  };

  const clearAllFilters = () => {
    setSelectedConditions([]);
    setSellerType("all");
    setTcgSeries("all");
    setPriceMin("");
    setPriceMax("");
    clearSearch();
  };

  const hasActiveFilters = selectedConditions.length > 0 || sellerType !== "all" || tcgSeries !== "all" || !!search || !!priceMin || !!priceMax;
  const activeFilterCount = selectedConditions.length + (sellerType !== "all" ? 1 : 0) + (tcgSeries !== "all" ? 1 : 0) + (search ? 1 : 0) + (priceMin || priceMax ? 1 : 0);

  const sidebarProps = {
    tcgSeries, setTcgSeries,
    selectedConditions, toggleCondition,
    clearConditions: () => setSelectedConditions([]),
    sellerType, setSellerType,
    priceMin, setPriceMin,
    priceMax, setPriceMax,
    clearAllFilters, hasActiveFilters, activeFilterCount,
    resetAndSearch,
  };

  // ── Maintenance mode guard (must be after all hooks) ──
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06038D]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }
  if (accessData && !accessData.allowed) {
    return <MarketplaceMaintenancePage />;
  }

  return (
    <>
    <PageHead
      title={t("marketplace.pageTitle")}
      description={t("marketplace.pageDescription")}
      keywords={t("marketplace.pageKeywords")}
    />
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Editorial Top Bar ── */}
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
            {/* Branding */}
            <div className="flex items-center gap-3 mb-3 sm:mb-0 shrink-0">
              <Link href="/">
                <img src="/boxium-logo.png" alt="BOXIUM" className="h-8 w-auto object-contain hover:opacity-80 transition-opacity cursor-pointer" />
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <span
                  className="font-bold text-lg text-[#1a1a2e] tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {t("marketplace.title")}
                </span>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mt-0.5">Pokémon · One Piece · Yu-Gi-Oh!</p>
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t("marketplace.search.placeholder")}
                    className="pl-10 pr-8 bg-gray-50 border-gray-200 text-[#1a1a2e] placeholder:text-gray-400 h-10 rounded-full text-sm w-full focus-visible:ring-[#06038D] focus-visible:border-[#06038D]"
                  />
                  {searchInput && (
                    <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Button type="submit" className="shrink-0 bg-[#06038D] hover:bg-[#0804b8] text-white h-10 px-5 rounded-full text-sm font-semibold">
                  {t("common.search")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── Auction Hall Hero Section ── */}
      {(auctionHeroLoading || (auctionHeroData && auctionHeroData.listings.length > 0)) && (
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-6">
          <AuctionHero
            auctions={auctionHeroData?.listings ?? []}
            total={auctionHeroData?.total ?? 0}
            isLoading={auctionHeroLoading}
            onViewAll={() => setMarketTab('auction')}
          />
        </div>
      )}

      {/* ── Divider + Market Tab Switcher ── */}
      <div className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Auction Tab — shown first / more prominent */}
            <button
              onClick={() => setMarketTab('auction')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                marketTab === 'auction'
                  ? 'bg-[#1a1a2e] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#1a1a2e] hover:bg-white'
              }`}
            >
              <Gavel className="w-4 h-4" />
              {t("marketplace.tab.auction")}
              {(auctionHeroData?.total ?? 0) > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  marketTab === 'auction' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {auctionHeroData?.total}
                </span>
              )}
            </button>
            {/* Shop Tab */}
            <button
              onClick={() => setMarketTab('shop')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                marketTab === 'shop'
                  ? 'bg-[#1a1a2e] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#1a1a2e] hover:bg-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              {t("marketplace.tab.shop")}
            </button>
          </div>
        </div>
      </div>

      {/* ── TCG Series Quick Filter ── */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TCG_SERIES.map(s => {
            const isActive = marketTab === 'auction' ? auctionSeries === s.value : tcgSeries === s.value;
            const count = marketTab === 'auction'
              ? (s.value === 'all'
                  ? auctionData?.total
                  : auctionData?.listings.filter((a: any) => a.tcgSeries === s.value).length)
              : seriesCounts[s.value];
            return (
              <button
                key={s.value}
                onClick={() => {
                  if (marketTab === 'auction') {
                    setAuctionSeries(s.value);
                    setAuctionPage(1);
                  } else {
                    setTcgSeries(s.value);
                    resetAndSearch();
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-[#1a1a2e] bg-[#1a1a2e] text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-[#1a1a2e]'
                }`}
              >
                {s.logo ? (
                  <img
                    src={getProxiedImageUrl(s.logo) ?? undefined}
                    alt={s.label}
                    className="h-4 w-auto object-contain"
                    style={{ filter: isActive ? 'brightness(0) invert(1)' : 'none' }}
                  />
                ) : (
                  <span>{t("marketplace.allSeries")}</span>
                )}
                {s.value !== 'all' && <span>{s.label}</span>}
                {count != null && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Content: Left Sidebar + Right Products ── */}
      <div className="max-w-7xl mx-auto py-5" style={{ paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', overflow: 'hidden' }}>

          {/* ── Left Sidebar (tablet+) - only show for shop tab ── */}
          {marketTab === 'shop' && (
          <div className="hidden md:block" style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '4.5rem', alignSelf: 'flex-start', overflow: 'hidden' }}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" style={{ width: '220px', boxSizing: 'border-box', overflow: 'hidden' }}>
              <SidebarFilter {...sidebarProps} />
            </div>
          </div>
          )}

          {/* ── Right: Products Area ── */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>

            {/* ── AUCTION TAB CONTENT ── */}
            {marketTab === 'auction' && (
              <div>
                {/* Auction top bar */}
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <p className="text-sm text-gray-500">
                    {auctionLoading ? t("common.loading") : auctionData && auctionData.total > 0 ? (
                      <>{t("marketplace.auction.total", { count: auctionData.total })}</>
                    ) : t("marketplace.auction.empty")}
                  </p>
                  <div className="flex items-center gap-2">
                    {/* Series filter for auction */}
                    <Select value={auctionSeries} onValueChange={v => { setAuctionSeries(v); setAuctionPage(1); }}>
                      <SelectTrigger className="h-8 text-xs border-gray-200 bg-white focus:ring-[#06038D] rounded-full shrink-0" style={{width:'7rem'}}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="all">{t("marketplace.allSeries")}</SelectItem>
                        <SelectItem value="pokemon">Pokémon</SelectItem>
                        <SelectItem value="onepiece">One Piece</SelectItem>
                        <SelectItem value="yugioh">Yu-Gi-Oh!</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={auctionSort} onValueChange={v => { setAuctionSort(v as typeof auctionSort); setAuctionPage(1); }}>
                      <SelectTrigger className="h-8 text-xs border-gray-200 bg-white focus:ring-[#06038D] rounded-full shrink-0" style={{width:'7.5rem'}}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="ending_soon">{t("marketplace.sort.endingSoon")}</SelectItem>
                        <SelectItem value="newest">{t("marketplace.sort.newest")}</SelectItem>
                        <SelectItem value="price_asc">{t("marketplace.sort.priceAsc")}</SelectItem>
                        <SelectItem value="price_desc">{t("marketplace.sort.priceDesc")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Auction grid */}
                {auctionLoading ? (
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}>
                    {Array.from({ length: 8 }).map((_, i) => <AuctionCardSkeleton key={i} />)}
                  </div>
                ) : !auctionData || auctionData.listings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Gavel className="w-12 h-12 text-gray-200 mb-4" />
                    <p className="text-sm text-gray-400 uppercase tracking-widest">{t("marketplace.auction.empty")}</p>
                    <p className="text-xs text-gray-300 mt-1">{t("marketplace.auction.comingSoon")}</p>
                  </div>
                ) : (
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}>
                    {auctionData.listings.map((auction: any) => (
                      <AuctionCard key={auction.id} auction={auction} />
                    ))}
                  </div>
                )}

                {/* Auction pagination */}
                {auctionData && auctionData.total > 20 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auctionPage <= 1}
                      onClick={() => setAuctionPage(p => p - 1)}
                      className="border-gray-200"
                    >
                      {t("common.prevPage")}
                    </Button>
                    <span className="text-sm text-gray-500">{t("common.page", { page: auctionPage })}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auctionPage * 20 >= auctionData.total}
                      onClick={() => setAuctionPage(p => p + 1)}
                      className="border-gray-200"
                    >
                      {t("common.nextPage")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── SHOP TAB CONTENT ── */}
            {marketTab === 'shop' && (
            <>
            {/* Top bar: count + sort + mobile filter */}
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                {/* Mobile filter toggle */}
                <button
                  onClick={() => setShowMobileFilter(o => !o)}
                  className={`md:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border transition-all ${
                    showMobileFilter || hasActiveFilters
                      ? "bg-[#06038D] text-white border-[#06038D]"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {t("marketplace.filter.title")}
                  {activeFilterCount > 0 && (
                    <span className="bg-[#FEDD00] text-[#06038D] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <p className="text-sm text-gray-500">
                  {isLoading && page === 1 ? t("common.loading") : total > 0 ? (
                    <>{t("marketplace.shop.total", { count: total })}</>
                  ) : t("marketplace.shop.empty")}
                </p>
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={v => { setSortBy(v as typeof sortBy); resetAndSearch(); }}>
                <SelectTrigger className="h-8 text-xs border-gray-200 bg-white focus:ring-[#06038D] rounded-full shrink-0" style={{width:'7.5rem'}}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="newest">{t("marketplace.sort.newest")}</SelectItem>
                  <SelectItem value="price_asc">{t("marketplace.sort.priceAsc")}</SelectItem>
                  <SelectItem value="price_desc">{t("marketplace.sort.priceDesc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mobile filter panel (< 768px only) */}
            {showMobileFilter && (
              <div className="md:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                <SidebarFilter {...sidebarProps} />
              </div>
            )}

            {/* Active filter tags */}
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {search && (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200">
                    {t("marketplace.filter.searchTag", { search })}
                    <button onClick={clearSearch}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {tcgSeries !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200">
                    {TCG_SERIES_LABEL[tcgSeries] ?? tcgSeries}
                    <button onClick={() => { setTcgSeries("all"); resetAndSearch(); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {selectedConditions.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200">
                    {CONDITION_SHORT[c as ConditionValue] ?? c}
                    <button onClick={() => toggleCondition(c)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {sellerType !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200">
                    {sellerType === "platform" ? t("marketplace.filter.official") : t("marketplace.filter.individualSeller")}
                    <button onClick={() => { setSellerType("all"); resetAndSearch(); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {(priceMin || priceMax) && (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200">
                    HK${priceMin || "0"} - {priceMax || "∞"}
                    <button onClick={() => { setPriceMin(""); setPriceMax(""); resetAndSearch(); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-[#06038D] font-medium ml-1">
                  {t("marketplace.filter.clearAll")}
                </button>
              </div>
            )}

            {/* Product Grid */}
            {isLoading && page === 1 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : allListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-sm text-gray-400 uppercase tracking-widest">{t("marketplace.shop.emptyTitle")}</p>
                <p className="text-xs text-gray-300 mt-1">
                  {hasActiveFilters ? t("marketplace.shop.adjustFilter") : t("marketplace.shop.comingSoon")}
                </p>
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    className="mt-4 bg-[#06038D] hover:bg-[#0804b8] text-white"
                    onClick={clearAllFilters}
                  >
                    {t("marketplace.filter.clearFilters")}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {allListings.map((listing: any) => (
                    <ProductCard
                      key={listing.id}
                      listing={listing}
                      wishlistIds={wishlistIds}
                      onWishlistToggle={handleWishlistToggle}
                    />
                  ))}
                </div>

                {/* Infinite scroll trigger */}
                <div ref={loadMoreRef} className="py-8 flex items-center justify-center">
                  {isFetching && page > 1 && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("marketplace.shop.loadingMore")}
                    </div>
                  )}
                  {!hasMore && allListings.length > 0 && (
                    <p className="text-gray-400 text-sm">{t("marketplace.shop.allShown", { count: allListings.length })}</p>
                  )}
                </div>
              </>
            )}
            </> /* end shop fragment */
            )} {/* end shop tab */}
          </div>
        </div>
      </div>

      {/* ── Trust Footer ── */}
      <div className="border-t border-gray-100 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield,      titleKey: "marketplace.trust.buyerProtection",  descKey: "marketplace.trust.buyerProtectionDesc" },
              { icon: TrendingUp,  titleKey: "marketplace.trust.priceTransparency",  descKey: "marketplace.trust.priceTransparencyDesc" },
              { icon: Zap,         titleKey: "marketplace.trust.fastTrade",  descKey: "marketplace.trust.fastTradeDesc" },
              { icon: Star,        titleKey: "marketplace.trust.sellerRating",  descKey: "marketplace.trust.sellerRatingDesc" },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.titleKey} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a2e]">{t(item.titleKey)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t(item.descKey)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          className="fixed right-20 w-10 h-10 rounded-full bg-[#06038D] text-white shadow-lg flex items-center justify-center hover:bg-[#0804b8] transition-all duration-200 hover:scale-110 z-30"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
    </>
  );
}
