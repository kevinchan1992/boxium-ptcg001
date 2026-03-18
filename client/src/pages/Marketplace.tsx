import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Package, ChevronLeft, ChevronRight, X, ShoppingBag,
  SlidersHorizontal, Heart, Star, Tag, Shield, Award,
  ShoppingCart, TrendingUp, Zap, Loader2, ArrowUp, Filter
} from "lucide-react";
import { toast } from "sonner";
import {
  CONDITION_GROUPS, CONDITION_SHORT, CONDITION_BADGE,
  type ConditionValue
} from "@/lib/conditions";

// ─── TCG Series Config (只保留 3 種 + 全部) ──────────────────────────────────

const TCG_SERIES = [
  { value: "all",      label: "全部",      emoji: "🎴", color: "bg-[#06038D] text-white",         border: "border-[#06038D]" },
  { value: "pokemon",  label: "Pokémon",   emoji: "⚡", color: "bg-yellow-400 text-[#06038D]",    border: "border-yellow-400" },
  { value: "onepiece", label: "One Piece", emoji: "🏴‍☠️", color: "bg-red-600 text-white",           border: "border-red-600" },
  { value: "yugioh",   label: "Yu-Gi-Oh!", emoji: "🔮", color: "bg-purple-700 text-white",         border: "border-purple-700" },
];

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

function ProductCard({ listing, wishlistIds, onWishlistToggle }: {
  listing: any;
  wishlistIds?: number[];
  onWishlistToggle?: (id: number) => void;
}) {
  const [, setLocation] = useLocation();
  const images: string[] | null = (() => {
    try { return listing.images ? JSON.parse(listing.images) : null; }
    catch { return null; }
  })();
  const coverImage = images && images.length > 0 ? images[0] : null;
  const conditionKey = listing.condition as ConditionValue;
  const isWishlisted = wishlistIds?.includes(listing.id) ?? false;

  return (
    <div
      className="group cursor-pointer bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-[#FEDD00] hover:shadow-lg transition-all duration-300 flex flex-col relative"
      onClick={() => setLocation(`/marketplace/${listing.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

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
                官方
              </span>
            )}
            {onWishlistToggle && (
              <button
                className="w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:scale-110 transition-transform z-10"
                onClick={e => { e.stopPropagation(); onWishlistToggle(listing.id); }}
                aria-label={isWishlisted ? "移除收藏" : "加入收藏"}
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
            查看詳情
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
              <Zap className="w-2.5 h-2.5" />僅剩{listing.quantity}
            </span>
          )}
        </div>
        {listing.sellerType === "seller" && listing.sellerProfile && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
            {listing.sellerProfile.ratingCount > 0 ? (
              <>
                <Star className="w-3 h-3 fill-[#FEDD00] text-[#FEDD00]" />
                <span className="font-medium text-gray-700">{parseFloat(listing.sellerProfile.avgRating ?? "0").toFixed(1)}</span>
                <span>({listing.sellerProfile.ratingCount})</span>
              </>
            ) : (
              <span className="text-gray-400">新賣家</span>
            )}
            {listing.sellerProfile.displayName && (
              <span className="ml-auto truncate max-w-[80px] text-gray-400">{listing.sellerProfile.displayName}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
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
  return (
    <aside className="w-56 shrink-0 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[#06038D] text-sm flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          篩選條件
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
            清除全部
          </button>
        )}
      </div>

      {/* TCG Series */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">TCG 系列</p>
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
                <span className="text-base">{s.emoji}</span>
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
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">商品來源</p>
        <div className="space-y-1">
          {[
            { value: "all",      label: "全部來源", icon: ShoppingBag },
            { value: "platform", label: "官方商品",  icon: Shield },
            { value: "seller",   label: "個人賣家",  icon: Star },
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
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">品相篩選</p>
          {selectedConditions.length > 0 && (
            <button onClick={() => { clearConditions(); resetAndSearch(); }} className="text-[11px] text-[#06038D] hover:underline">
              清除
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
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">價格範圍 (HKD)</p>
          {(priceMin || priceMax) && (
            <button
              onClick={() => { setPriceMin(""); setPriceMax(""); resetAndSearch(); }}
              className="text-[11px] text-[#06038D] hover:underline"
            >
              清除
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            placeholder="最低"
            value={priceMin}
            onChange={e => { setPriceMin(e.target.value); resetAndSearch(); }}
            className="h-8 text-xs border-gray-200 focus-visible:ring-[#06038D]"
          />
          <span className="text-gray-400 text-xs shrink-0">—</span>
          <Input
            type="number"
            placeholder="最高"
            value={priceMax}
            onChange={e => { setPriceMax(e.target.value); resetAndSearch(); }}
            className="h-8 text-xs border-gray-200 focus-visible:ring-[#06038D]"
          />
        </div>
      </div>
    </aside>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [sellerType, setSellerType] = useState<string>("all");
  const [tcgSeries, setTcgSeries] = useState<string>("all");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [allListings, setAllListings] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Banners
  const FALLBACK_BANNERS = useMemo(() => [
    {
      id: 1,
      title: "TCG 卡牌交易平台",
      subtitle: "Pokémon · One Piece · Yu-Gi-Oh!",
      cta: "探索商城",
      ctaConditions: "[]",
      ctaSellerType: "all",
      gradient: "from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]",
      accentColor: "#FEDD00",
      badge: "BOXIUM",
      badgeClass: "bg-[#FEDD00] text-[#06038d]",
      emoji: "🎴",
    },
    {
      id: 2,
      title: "PSA 評級卡專區",
      subtitle: "精選 PSA 10 完美品相 · 限量珍藏",
      cta: "立即選購",
      ctaConditions: JSON.stringify(["psa10"]),
      ctaSellerType: "all",
      gradient: "from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]",
      accentColor: "#FEDD00",
      badge: "PSA 10",
      badgeClass: "bg-[#FEDD00] text-[#06038d]",
      emoji: "🏆",
    },
    {
      id: 3,
      title: "BOXIUM 官方上架",
      subtitle: "官方認證 · 品質保證 · 安心購買",
      cta: "查看官方商品",
      ctaConditions: "[]",
      ctaSellerType: "platform",
      gradient: "from-[#06038d] via-[#06038d] to-[#1a0a9e]",
      accentColor: "#FEDD00",
      badge: "官方",
      badgeClass: "bg-[#FEDD00] text-[#06038d]",
      emoji: "✨",
    },
  ], []);

  const { data: dbBanners } = trpc.marketplace.getBanners.useQuery();
  const activeBanners = (dbBanners && dbBanners.length > 0) ? dbBanners : FALLBACK_BANNERS;

  useEffect(() => {
    if (bannerPaused || activeBanners.length <= 1) return;
    const t = setInterval(() => setBannerIdx(i => (i + 1) % activeBanners.length), 5000);
    return () => clearInterval(t);
  }, [bannerPaused, activeBanners.length]);

  // Auth + wishlist
  const { data: me } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const { data: wishlistIds = [] } = trpc.marketplace.getWishlistIds.useQuery(undefined, { enabled: !!me });
  const toggleWishlistMutation = trpc.marketplace.toggleWishlist.useMutation({
    onSuccess: (res) => {
      toast.success(res.wishlisted ? "已加入收藏" : "已移除收藏");
      utils.marketplace.getWishlistIds.invalidate();
    },
    onError: () => toast.error("請先登入才能收藏"),
  });
  const handleWishlistToggle = (listingId: number) => {
    if (!me) { toast.error("請先登入才能收藏"); return; }
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
    minPrice: priceMin ? Number(priceMin) : undefined,
    maxPrice: priceMax ? Number(priceMax) : undefined,
  }), [page, search, selectedConditions, sellerType, tcgSeries, sortBy, priceMin, priceMax]);

  const { data, isLoading, isFetching } = trpc.marketplace.getListings.useQuery(queryInput);

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

  return (
    <div className="min-h-screen bg-[#F4F5F7] overflow-x-hidden">

      {/* ── Hero Section ── */}
      <div className="bg-gradient-to-b from-[#06038D] via-[#0a06b0] to-[#06038D] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#FEDD00]/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[#FEDD00]/5 rounded-full blur-3xl" />
          {/* Decorative card shapes - contained within overflow-hidden parent */}
          <div className="absolute top-4 right-4 w-14 h-20 bg-white/5 rounded-lg rotate-12 hidden lg:block" />
          <div className="absolute top-8 right-20 w-10 h-14 bg-[#FEDD00]/10 rounded-lg -rotate-6 hidden lg:block" />
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-7 pb-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:gap-8">
            {/* Left: Branding */}
            <div className="mb-4 md:mb-0 md:shrink-0">
              <div className="flex items-center gap-3 mb-1.5">
                <img src="/boxium-logo.png" alt="BOXIUM" className="h-9 w-auto object-contain" />
                <div className="h-7 w-px bg-white/20" />
                <span className="text-[#FEDD00] font-bold text-xl tracking-wide">商城</span>
              </div>
              <p className="text-white/50 text-xs">
                Pokémon · One Piece · Yu-Gi-Oh!
              </p>
            </div>

            {/* Right: Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜尋卡牌名稱、編號..."
                  className="pl-12 pr-24 bg-white border-0 text-gray-900 placeholder:text-gray-400 h-12 rounded-full shadow-lg focus-visible:ring-2 focus-visible:ring-[#FEDD00] text-base"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <Button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#06038D] hover:bg-[#0804b8] text-white font-bold h-9 px-5 rounded-full"
                >
                  搜尋
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── Banner Carousel ── */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div
          className="relative rounded-2xl overflow-hidden shadow-md"
          onMouseEnter={() => setBannerPaused(true)}
          onMouseLeave={() => setBannerPaused(false)}
        >
          {activeBanners.map((banner: any, i: number) => (
            <div
              key={banner.id}
              className={`bg-gradient-to-r ${banner.gradient} transition-all duration-700 ${i === bannerIdx ? "block" : "hidden"}`}
            >
              <div className="px-6 py-5 sm:py-7 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-4xl hidden sm:block">{banner.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${banner.badgeClass}`}>{banner.badge}</span>
                    </div>
                    <h2 className="text-white font-bold text-lg sm:text-xl leading-tight">{banner.title}</h2>
                    <p className="text-white/70 text-xs sm:text-sm mt-0.5">{banner.subtitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    try {
                      const conditions = JSON.parse(banner.ctaConditions || "[]");
                      setSelectedConditions(conditions);
                    } catch { setSelectedConditions([]); }
                    setSellerType(banner.ctaSellerType ?? "all");
                    resetAndSearch();
                  }}
                  className="shrink-0 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                  style={{ backgroundColor: banner.accentColor || "#FEDD00", color: "#06038D" }}
                >
                  {banner.cta}
                </button>
              </div>
            </div>
          ))}
          {activeBanners.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {activeBanners.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setBannerIdx(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === bannerIdx ? "bg-white w-5" : "bg-white/40 w-1.5"}`}
                />
              ))}
            </div>
          )}
          {activeBanners.length > 1 && (
            <>
              <button
                onClick={() => setBannerIdx(i => (i - 1 + activeBanners.length) % activeBanners.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setBannerIdx(i => (i + 1) % activeBanners.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main Content: Left Sidebar + Right Products ── */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

          {/* ── Left Sidebar (desktop) ── */}
          <div className="hidden lg:block" style={{ width: '224px', flexShrink: 0, position: 'sticky', top: '1rem', alignSelf: 'flex-start' }}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <SidebarFilter {...sidebarProps} />
            </div>
          </div>

          {/* ── Right: Products Area ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Top bar: count + sort + mobile filter */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile filter toggle */}
                <button
                  onClick={() => setShowMobileFilter(o => !o)}
                  className={`lg:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border transition-all ${
                    showMobileFilter || hasActiveFilters
                      ? "bg-[#06038D] text-white border-[#06038D]"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  篩選
                  {activeFilterCount > 0 && (
                    <span className="bg-[#FEDD00] text-[#06038D] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <p className="text-sm text-gray-500">
                  {isLoading && page === 1 ? "載入中..." : total > 0 ? (
                    <>共 <span className="text-[#06038D] font-bold">{total}</span> 件商品</>
                  ) : "暫無商品"}
                </p>
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={v => { setSortBy(v as typeof sortBy); resetAndSearch(); }}>
                <SelectTrigger className="w-28 h-8 text-xs border-gray-200 bg-white focus:ring-[#06038D] rounded-full shrink-0 max-w-[7rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新上架</SelectItem>
                  <SelectItem value="price_asc">價格低→高</SelectItem>
                  <SelectItem value="price_desc">價格高→低</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mobile filter panel */}
            {showMobileFilter && (
              <div className="lg:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                <SidebarFilter {...sidebarProps} />
              </div>
            )}

            {/* Active filter tags */}
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {search && (
                  <span className="inline-flex items-center gap-1 bg-[#06038D]/10 text-[#06038D] text-xs font-medium px-2 py-0.5 rounded-full">
                    搜尋：{search}
                    <button onClick={clearSearch}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {tcgSeries !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-[#06038D]/10 text-[#06038D] text-xs font-medium px-2 py-0.5 rounded-full">
                    {TCG_SERIES_LABEL[tcgSeries] ?? tcgSeries}
                    <button onClick={() => { setTcgSeries("all"); resetAndSearch(); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {selectedConditions.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 bg-[#06038D]/10 text-[#06038D] text-xs font-medium px-2 py-0.5 rounded-full">
                    {CONDITION_SHORT[c as ConditionValue] ?? c}
                    <button onClick={() => toggleCondition(c)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {sellerType !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-[#06038D]/10 text-[#06038D] text-xs font-medium px-2 py-0.5 rounded-full">
                    {sellerType === "platform" ? "官方商品" : "個人賣家"}
                    <button onClick={() => { setSellerType("all"); resetAndSearch(); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {(priceMin || priceMax) && (
                  <span className="inline-flex items-center gap-1 bg-[#06038D]/10 text-[#06038D] text-xs font-medium px-2 py-0.5 rounded-full">
                    HK${priceMin || "0"} - {priceMax || "∞"}
                    <button onClick={() => { setPriceMin(""); setPriceMax(""); resetAndSearch(); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-[#06038D] font-medium ml-1">
                  清除全部
                </button>
              </div>
            )}

            {/* Product Grid */}
            {isLoading && page === 1 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : allListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-100">
                <div className="w-20 h-20 rounded-full bg-[#06038D]/5 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-10 h-10 text-[#06038D]/30" />
                </div>
                <h3 className="text-lg font-bold text-[#06038D] mb-2">暫無在售商品</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  {hasActiveFilters ? "嘗試調整篩選條件以查看更多商品" : "商城即將上架更多精選卡牌，敬請期待！"}
                </p>
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    className="mt-4 bg-[#06038D] hover:bg-[#0804b8] text-white"
                    onClick={clearAllFilters}
                  >
                    清除篩選
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
                      載入更多商品...
                    </div>
                  )}
                  {!hasMore && allListings.length > 0 && (
                    <p className="text-gray-400 text-sm">已顯示全部 {allListings.length} 件商品</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Trust Footer ── */}
      <div className="bg-white border-t border-gray-100 mt-4">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield,      title: "買家保障",  desc: "商品與描述不符可退款" },
              { icon: TrendingUp,  title: "價格透明",  desc: "SNKRDUNK 即時數據" },
              { icon: Zap,         title: "快速交易",  desc: "付款後即時確認" },
              { icon: Star,        title: "賣家評分",  desc: "真實買家評價" },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-10 h-10 rounded-xl bg-[#06038D]/5 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#06038D]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#06038D]">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
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
          className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-[#06038D] text-white shadow-lg flex items-center justify-center hover:bg-[#0804b8] transition-all duration-200 hover:scale-110 z-30"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
