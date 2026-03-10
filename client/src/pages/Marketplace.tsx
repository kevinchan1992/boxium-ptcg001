import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Package, ChevronLeft, ChevronRight, X, ShoppingBag,
  SlidersHorizontal, ChevronDown, ChevronUp, HelpCircle, Heart,
  Star, LayoutGrid, List, Tag, Shield, Award, Layers, Filter,
  ShoppingCart, TrendingUp, Zap
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CONDITION_GROUPS, CONDITION_SHORT, CONDITION_BADGE,
  CONDITION_TOOLTIP, CONDITION_GROUP_COLOR, type ConditionValue
} from "@/lib/conditions";

// ─── Constants ────────────────────────────────────────────────────────────────

const BANNERS = [
  {
    id: 1,
    title: "PSA 評級卡專區",
    subtitle: "精選 PSA 10 完美品相 · 限量珍藏",
    cta: "立即選購",
    ctaConditions: ["psa10"],
    gradient: "from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]",
    accent: "#FEDD00",
    badge: "PSA 10",
    badgeClass: "bg-[#FEDD00] text-[#06038d]",
    emoji: "🏆",
  },
  {
    id: 2,
    title: "Raw 卡精選",
    subtitle: "A品 · B品 嚴選卡牌 · 性價比之選",
    cta: "探索 Raw 卡",
    ctaConditions: ["raw_a", "raw_b"],
    gradient: "from-[#0f4c2a] via-[#1a6b3a] to-[#0f4c2a]",
    accent: "#4ade80",
    badge: "Raw 卡",
    badgeClass: "bg-emerald-400 text-white",
    emoji: "🌿",
  },
  {
    id: 3,
    title: "BOXIUM 官方上架",
    subtitle: "官方認證 · 品質保證 · 安心購買",
    cta: "查看官方商品",
    ctaConditions: [],
    ctaSellerType: "platform" as const,
    gradient: "from-[#06038d] via-[#06038d] to-[#1a0a9e]",
    accent: "#FEDD00",
    badge: "官方",
    badgeClass: "bg-[#FEDD00] text-[#06038d]",
    emoji: "✨",
  },
];

// Quick category filter tabs with icons
const QUICK_TAGS = [
  { label: "全部", icon: Layers, conditions: [], sellerType: "all" as const },
  { label: "PSA 評級卡", icon: Award, conditions: ["psa10", "psa9", "psa8_below"], sellerType: "all" as const },
  { label: "BGS 評級卡", icon: Award, conditions: ["bgs10", "bgs9", "bgs8_below"], sellerType: "all" as const },
  { label: "TAG 評級卡", icon: Award, conditions: ["tag10", "tag9_below"], sellerType: "all" as const },
  { label: "Raw 卡", icon: Tag, conditions: ["raw_a", "raw_b", "raw_c", "raw_d"], sellerType: "all" as const },
  { label: "BOXIUM 官方", icon: Shield, conditions: [], sellerType: "platform" as const },
  { label: "個人賣家", icon: Star, conditions: [], sellerType: "seller" as const },
];

const LANGUAGES = [
  { value: "jp", label: "日版" },
  { value: "en", label: "英版" },
  { value: "tw", label: "台版" },
  { value: "kr", label: "韓版" },
];

const PAGE_SIZE = 20;

// Stats bar items
const STATS_ITEMS = [
  { icon: Shield, label: "買家保障", desc: "商品與描述不符可退款" },
  { icon: TrendingUp, label: "市場價格透明", desc: "SNKRDUNK 即時數據" },
  { icon: Zap, label: "快速交易", desc: "付款後即時確認" },
  { icon: Star, label: "賣家評分制度", desc: "真實買家評價" },
];

// ─── Product Card (Grid View) ─────────────────────────────────────────────────

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
      className="group cursor-pointer bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-[#FEDD00] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 flex flex-col relative"
      onClick={() => setLocation(`/marketplace/${listing.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-400"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
        )}
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        {/* Condition badge - top left */}
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shadow-sm ${CONDITION_BADGE[conditionKey] ?? "bg-gray-100 text-gray-600 border border-gray-300"}`}>
            {CONDITION_SHORT[conditionKey] ?? conditionKey}
          </span>
        </div>
        {/* Official badge - top right */}
        {listing.sellerType === "platform" && (
          <div className="absolute top-2 right-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#06038D] text-[#FEDD00] shadow-sm">
              官方
            </span>
          </div>
        )}
        {/* Wishlist heart */}
        {onWishlistToggle && (
          <button
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:scale-110 transition-transform z-10"
            style={{ display: listing.sellerType === 'platform' ? 'none' : undefined }}
            onClick={e => { e.stopPropagation(); onWishlistToggle(listing.id); }}
            aria-label={isWishlisted ? "移除收藏" : "加入收藏"}
          >
            <Heart className={`w-4 h-4 transition-colors ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-400"}`} />
          </button>
        )}
        {/* Quick buy button - shows on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <div className="bg-[#FEDD00] text-[#06038D] font-bold text-xs py-1.5 rounded-lg flex items-center justify-center gap-1.5 shadow-lg">
            <ShoppingCart className="w-3.5 h-3.5" />
            查看詳情
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug flex-1">
          {listing.title}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-[#06038D]">
            HK${Number(listing.priceHkd).toLocaleString()}
          </p>
          {listing.quantity <= 3 && listing.quantity > 0 && (
            <span className="text-xs text-orange-500 font-medium flex items-center gap-0.5">
              <Zap className="w-3 h-3" />僅剩{listing.quantity}件
            </span>
          )}
        </div>
        {listing.sellerType === "seller" && listing.sellerProfile && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
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

// ─── Product Card (List View) ─────────────────────────────────────────────────

function ProductListItem({ listing, wishlistIds, onWishlistToggle }: {
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
      className="group cursor-pointer bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-[#FEDD00] hover:shadow-md transition-all duration-200 flex gap-0"
      onClick={() => setLocation(`/marketplace/${listing.id}`)}
    >
      {/* Image */}
      <div className="relative w-24 sm:w-32 shrink-0 bg-gray-50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ aspectRatio: "3/4" }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100" style={{ aspectRatio: "3/4" }}>
            <Package className="w-8 h-8 text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CONDITION_BADGE[conditionKey] ?? "bg-gray-100 text-gray-600 border border-gray-300"}`}>
              {CONDITION_SHORT[conditionKey] ?? conditionKey}
            </span>
            {listing.sellerType === "platform" && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#06038D] text-[#FEDD00]">官方</span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{listing.title}</p>
          {listing.sellerType === "seller" && listing.sellerProfile && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              {listing.sellerProfile.ratingCount > 0 ? (
                <>
                  <Star className="w-3 h-3 fill-[#FEDD00] text-[#FEDD00]" />
                  <span>{parseFloat(listing.sellerProfile.avgRating ?? "0").toFixed(1)}</span>
                  <span>({listing.sellerProfile.ratingCount})</span>
                  <span>·</span>
                </>
              ) : null}
              <span>{listing.sellerProfile.displayName || "個人賣家"}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-lg font-bold text-[#06038D]">
            HK${Number(listing.priceHkd).toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            {onWishlistToggle && (
              <button
                className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:scale-110 transition-transform"
                onClick={e => { e.stopPropagation(); onWishlistToggle(listing.id); }}
              >
                <Heart className={`w-3.5 h-3.5 ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
              </button>
            )}
            <span className="text-xs text-[#06038D] font-medium bg-[#06038D]/5 px-2 py-1 rounded-lg">查看詳情 →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );
}

function ProductListItemSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex gap-0">
      <Skeleton className="w-24 sm:w-32 shrink-0" style={{ aspectRatio: "3/4" }} />
      <div className="flex-1 p-4 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-1/3 mt-2" />
      </div>
    </div>
  );
}

// ─── Filter Section ───────────────────────────────────────────────────────────

function FilterSection({ title, children, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <button
        className="w-full flex items-center justify-between text-sm font-semibold text-[#06038D] mb-2"
        onClick={() => setOpen(o => !o)}
      >
        {title}
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        }
      </button>
      {open && <div className="animate-in slide-in-from-top-1 duration-150">{children}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Marketplace() {
  return <MarketplaceInner />;
}

function MarketplaceInner() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [sellerType, setSellerType] = useState<string>("all");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);

  // Load banners from DB (fallback to static BANNERS)
  const { data: dbBanners } = trpc.marketplace.getBanners.useQuery();
  const activeBanners = (dbBanners && dbBanners.length > 0) ? dbBanners : BANNERS;

  // Auto-advance banner every 4 seconds
  useEffect(() => {
    if (bannerPaused) return;
    const t = setInterval(() => setBannerIdx(i => (i + 1) % activeBanners.length), 4000);
    return () => clearInterval(t);
  }, [bannerPaused, activeBanners.length]);

  // Apply quick tag filter
  const applyQuickTag = (tag: typeof QUICK_TAGS[0]) => {
    setSelectedConditions(tag.conditions);
    setSellerType(tag.sellerType);
    setPage(1);
  };

  // Derive active quick tag index
  const activeQuickTag = QUICK_TAGS.findIndex(t => {
    const condMatch = JSON.stringify([...t.conditions].sort()) === JSON.stringify([...selectedConditions].sort());
    const sellerMatch = t.sellerType === sellerType;
    return condMatch && sellerMatch;
  });

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

  const priceRangeQuery = useMemo(() => ({
    min: priceMin ? Number(priceMin) : undefined,
    max: priceMax ? Number(priceMax) : undefined,
  }), [priceMin, priceMax]);

  const { data, isLoading } = trpc.marketplace.getListings.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    conditions: selectedConditions.length > 0 ? selectedConditions : undefined,
    sellerType: sellerType !== "all" ? (sellerType as "platform" | "seller") : undefined,
    sortBy,
  });

  const listings = data?.listings ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearch("");
    setSearchInput("");
    setPage(1);
  }, []);

  const toggleCondition = (val: string) => {
    setSelectedConditions(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
    setPage(1);
  };

  const toggleLanguage = (val: string) => {
    setSelectedLanguages(prev =>
      prev.includes(val) ? prev.filter(l => l !== val) : [...prev, val]
    );
    setPage(1);
  };

  const clearAllFilters = () => {
    setSelectedConditions([]);
    setSellerType("all");
    setSelectedLanguages([]);
    setPriceMin("");
    setPriceMax("");
    clearSearch();
  };

  const hasActiveFilters = selectedConditions.length > 0 || sellerType !== "all" || selectedLanguages.length > 0 || search || priceMin || priceMax;
  const activeFilterCount = selectedConditions.length + (sellerType !== "all" ? 1 : 0) + selectedLanguages.length + (search ? 1 : 0) + (priceMin || priceMax ? 1 : 0);

  // ─── Filter Sidebar ─────────────────────────────────────────────────────────
  const FilterSidebar = () => (
    <aside className="w-full">
      {/* Sidebar Header */}
      <div className="bg-[#06038D] rounded-t-xl px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          篩選條件
          {activeFilterCount > 0 && (
            <span className="bg-[#FEDD00] text-[#06038D] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </h2>
        {hasActiveFilters && (
          <button
            className="text-xs text-[#FEDD00] hover:text-white font-medium transition-colors"
            onClick={clearAllFilters}
          >
            清除全部
          </button>
        )}
      </div>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="bg-[#06038D]/5 border-x border-gray-200 px-3 py-2 flex flex-wrap gap-1.5">
          {search && (
            <span className="inline-flex items-center gap-1 bg-[#06038D] text-white text-xs px-2 py-0.5 rounded-full">
              搜尋：{search}
              <button onClick={clearSearch}><X className="w-3 h-3" /></button>
            </span>
          )}
          {selectedConditions.map(c => (
            <span key={c} className="inline-flex items-center gap-1 bg-[#06038D] text-white text-xs px-2 py-0.5 rounded-full">
              {CONDITION_SHORT[c as ConditionValue] ?? c}
              <button onClick={() => toggleCondition(c)}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {sellerType !== "all" && (
            <span className="inline-flex items-center gap-1 bg-[#06038D] text-white text-xs px-2 py-0.5 rounded-full">
              {sellerType === "platform" ? "官方" : "C2C"}
              <button onClick={() => setSellerType("all")}><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      )}

      {/* Filter body */}
      <div className={`border border-gray-200 ${hasActiveFilters ? "border-t-0" : "rounded-t-none"} rounded-b-xl p-3 space-y-0 bg-white`}>
        {/* Condition - grouped */}
        <FilterSection title="品相">
          <TooltipProvider delayDuration={200}>
            <div className="space-y-3">
              {CONDITION_GROUPS.map(group => (
                <div key={group.group}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1 cursor-help w-fit">
                        {group.group}
                        <HelpCircle className="w-3 h-3 text-gray-300" />
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px] text-xs">
                      {group.groupDesc}
                    </TooltipContent>
                  </Tooltip>
                  <div className="space-y-1">
                    {group.items.map(item => {
                      const checked = selectedConditions.includes(item.value);
                      return (
                        <div key={item.value} className="flex items-center gap-1.5">
                          <label
                            className="flex items-center gap-2 cursor-pointer group flex-1"
                            onClick={() => toggleCondition(item.value)}
                          >
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked ? "bg-[#06038D] border-[#06038D]" : "border-gray-300 bg-white group-hover:border-[#06038D]"
                            }`}>
                              {checked && (
                                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CONDITION_BADGE[item.value as ConditionValue]}`}>
                              {item.label}
                            </span>
                          </label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
                                <HelpCircle className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[200px] text-xs">
                              {CONDITION_TOOLTIP[item.value as ConditionValue]}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>
        </FilterSection>

        {/* Seller Type */}
        <FilterSection title="賣家類型" defaultOpen={false}>
          <div className="space-y-1">
            {[
              { value: "all", label: "全部" },
              { value: "platform", label: "BOXIUM 官方" },
              { value: "seller", label: "C2C 賣家" },
            ].map(s => (
              <label key={s.value} className="flex items-center gap-2 cursor-pointer group" onClick={() => { setSellerType(s.value); setPage(1); }}>
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  sellerType === s.value ? "bg-[#06038D] border-[#06038D]" : "border-gray-300 bg-white group-hover:border-[#06038D]"
                }`}>
                  {sellerType === s.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-xs text-gray-700">{s.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Language */}
        <FilterSection title="語言版本" defaultOpen={false}>
          <div className="space-y-1">
            {LANGUAGES.map(l => (
              <label key={l.value} className="flex items-center gap-2 cursor-pointer group" onClick={() => toggleLanguage(l.value)}>
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selectedLanguages.includes(l.value) ? "bg-[#06038D] border-[#06038D]" : "border-gray-300 bg-white group-hover:border-[#06038D]"
                }`}>
                  {selectedLanguages.includes(l.value) && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className="text-xs text-gray-700">{l.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Price Range */}
        <FilterSection title="價格範圍 (HKD)" defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="最低"
                value={priceMin}
                onChange={e => { setPriceMin(e.target.value); setPage(1); }}
                className="h-7 text-xs border-gray-200 focus-visible:ring-[#06038D]"
              />
              <span className="text-gray-400 text-xs shrink-0">—</span>
              <Input
                type="number"
                placeholder="最高"
                value={priceMax}
                onChange={e => { setPriceMax(e.target.value); setPage(1); }}
                className="h-7 text-xs border-gray-200 focus-visible:ring-[#06038D]"
              />
            </div>
            {(priceMin || priceMax) && (
              <button className="text-xs text-[#06038D] hover:underline" onClick={() => { setPriceMin(""); setPriceMax(""); }}>
                清除價格篩選
              </button>
            )}
          </div>
        </FilterSection>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {/* ── Top Search Bar ── */}
      <div className="bg-[#06038D] border-b border-[#0a07b5]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Logo + Title */}
            <div className="shrink-0 flex items-center gap-3">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo-full_e9207f64.png"
                alt="BOXIUM"
                className="h-11 w-auto object-contain"
              />
              <div className="text-left hidden sm:block">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[#FEDD00] font-bold text-xl leading-none">商城</span>
                </div>
                <p className="text-xs text-white/60 mt-0.5">精選寶可夢卡牌 · 安全交易</p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-10 bg-white/10 shrink-0" />

            {/* Search form */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-2xl w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜尋卡牌名稱、編號..."
                  className="pl-9 pr-8 bg-white border-0 text-gray-900 placeholder:text-gray-400 h-10 rounded-lg focus-visible:ring-2 focus-visible:ring-[#FEDD00]"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                className="bg-[#FEDD00] hover:bg-[#e8c800] text-[#06038D] font-bold h-10 px-6 rounded-lg shrink-0"
              >
                搜尋
              </Button>
            </form>

            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className="md:hidden border-white/30 text-white hover:bg-white/10 gap-1.5 relative"
              onClick={() => setMobileSidebarOpen(o => !o)}
            >
              <Filter className="w-4 h-4" />
              篩選
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FEDD00] text-[#06038D] text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Trust Stats Bar ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-around gap-2 overflow-x-auto scrollbar-none">
            {STATS_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-2 shrink-0 py-1">
                  <Icon className="w-4 h-4 text-[#06038D] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[#06038D]">{item.label}</p>
                    <p className="text-xs text-gray-400 hidden sm:block">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Banner Carousel ── */}
      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setBannerPaused(true)}
        onMouseLeave={() => setBannerPaused(false)}
      >
        {activeBanners.map((banner: any, i: number) => (
          <div
            key={banner.id}
            className={`bg-gradient-to-r ${banner.gradient} transition-all duration-700 ${i === bannerIdx ? "block" : "hidden"}`}
          >
            <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl hidden sm:block">{banner.emoji}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${banner.badgeClass}`}>{banner.badge}</span>
                  </div>
                  <h2 className="text-white font-bold text-base sm:text-lg leading-tight">{banner.title}</h2>
                  <p className="text-white/70 text-xs sm:text-sm">{banner.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedConditions(banner.ctaConditions);
                  setSellerType((banner as any).ctaSellerType ?? "all");
                  setPage(1);
                }}
                className="shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ backgroundColor: banner.accent, color: "#06038D" }}
              >
                {banner.cta}
              </button>
            </div>
          </div>
        ))}
        {/* Dot indicators */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {activeBanners.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setBannerIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === bannerIdx ? "bg-white w-4" : "bg-white/40 w-1.5"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setBannerIdx(i => (i - 1 + activeBanners.length) % activeBanners.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setBannerIdx(i => (i + 1) % activeBanners.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Category Tab Bar ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-0 scrollbar-none">
            {QUICK_TAGS.map((tag, i) => {
              const Icon = tag.icon;
              const isActive = activeQuickTag === i;
              return (
                <button
                  key={tag.label}
                  onClick={() => applyQuickTag(tag)}
                  className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-3.5 border-b-2 transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? "border-[#FEDD00] text-[#06038D] bg-[#06038D]/5"
                      : "border-transparent text-gray-600 hover:text-[#06038D] hover:border-[#06038D]/30"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#06038D]" : "text-gray-400"}`} />
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex gap-5">

          {/* Left Sidebar - Desktop */}
          <div className="hidden md:block w-56 shrink-0">
            <div className="sticky top-16">
              <FilterSidebar />
            </div>
          </div>

          {/* Mobile Sidebar Overlay */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#F8F9FA] overflow-y-auto shadow-2xl">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-[#06038D]">篩選條件</h2>
                    <button
                      onClick={() => setMobileSidebarOpen(false)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <FilterSidebar />
                </div>
                <div className="p-4 border-t border-gray-200 bg-white">
                  <Button
                    className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white"
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    查看 {total} 件商品
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Right Content */}
          <div className="flex-1 min-w-0">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
              <span className="text-[#06038D] font-medium">商城</span>
              {activeQuickTag > 0 && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[#06038D] font-medium">{QUICK_TAGS[activeQuickTag]?.label}</span>
                </>
              )}
              {search && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span>搜尋：{search}</span>
                </>
              )}
            </nav>

            {/* Toolbar: result count + view toggle + sort */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <p className="text-sm text-gray-600">
                {isLoading ? "載入中..." : total > 0 ? (
                  <>共 <span className="text-[#06038D] font-bold">{total}</span> 件商品</>
                ) : "暫無商品"}
              </p>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#06038D] text-white" : "text-gray-400 hover:text-gray-600"}`}
                    title="格子視圖"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#06038D] text-white" : "text-gray-400 hover:text-gray-600"}`}
                    title="列表視圖"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Sort */}
                <Select value={sortBy} onValueChange={v => { setSortBy(v as typeof sortBy); setPage(1); }}>
                  <SelectTrigger className="w-36 h-8 text-xs border-gray-200 bg-white focus:ring-[#06038D]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">最新上架</SelectItem>
                    <SelectItem value="price_asc">價格由低至高</SelectItem>
                    <SelectItem value="price_desc">價格由高至低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Grid / List */}
            {isLoading ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <ProductListItemSkeleton key={i} />)}
                </div>
              )
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-200">
                <div className="w-20 h-20 rounded-full bg-[#06038D]/5 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-10 h-10 text-[#06038D]/40" />
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
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {listings.map((listing: any) => (
                  <ProductCard
                    key={listing.id}
                    listing={listing}
                    wishlistIds={wishlistIds}
                    onWishlistToggle={handleWishlistToggle}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing: any) => (
                  <ProductListItem
                    key={listing.id}
                    listing={listing}
                    wishlistIds={wishlistIds}
                    onWishlistToggle={handleWishlistToggle}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="gap-1 border-gray-200 hover:border-[#06038D] hover:text-[#06038D]"
                >
                  <ChevronLeft className="w-4 h-4" />上一頁
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) pageNum = i + 1;
                    else if (page <= 4) pageNum = i + 1;
                    else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                    else pageNum = page - 3 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "ghost"}
                        size="sm"
                        className={`w-8 h-8 p-0 text-xs ${page === pageNum ? "bg-[#06038D] text-white hover:bg-[#0804b8]" : "hover:text-[#06038D]"}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="gap-1 border-gray-200 hover:border-[#06038D] hover:text-[#06038D]"
                >
                  下一頁<ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
