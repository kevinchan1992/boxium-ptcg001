import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, ChevronLeft, ChevronRight, X, ShoppingBag, SlidersHorizontal, ChevronDown, ChevronUp, HelpCircle, Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CONDITION_GROUPS, CONDITION_SHORT, CONDITION_BADGE, CONDITION_TOOLTIP, type ConditionValue } from "@/lib/conditions";

// ─── Constants ────────────────────────────────────────────────────────────────

// Banner slides for the carousel
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
    badgeClass: "bg-yellow-400 text-[#06038d]",
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
    gradient: "from-[#7c1a1a] via-[#9e2525] to-[#7c1a1a]",
    accent: "#fca5a5",
    badge: "官方",
    badgeClass: "bg-blue-500 text-white",
    emoji: "✨",
  },
];

// Quick category filter tags
const QUICK_TAGS = [
  { label: "全部", conditions: [], sellerType: "all" as const },
  { label: "PSA 評級卡", conditions: ["psa10", "psa9", "psa8_below"], sellerType: "all" as const },
  { label: "BGS 評級卡", conditions: ["bgs10", "bgs9", "bgs8_below"], sellerType: "all" as const },
  { label: "TAG 評級卡", conditions: ["tag10", "tag9_below"], sellerType: "all" as const },
  { label: "Raw 卡", conditions: ["raw_a", "raw_b", "raw_c", "raw_d"], sellerType: "all" as const },
  { label: "BOXIUM 官方", conditions: [], sellerType: "platform" as const },
  { label: "個人賣家", conditions: [], sellerType: "seller" as const },
];

const LANGUAGES = [
  { value: "jp", label: "日版" },
  { value: "en", label: "英版" },
  { value: "tw", label: "台版" },
  { value: "kr", label: "韓版" },
];

const PAGE_SIZE = 20;

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ listing, wishlistIds, onWishlistToggle }: { listing: any; wishlistIds?: number[]; onWishlistToggle?: (id: number) => void }) {
  const [, setLocation] = useLocation();
  const images: string[] | null = (() => {
    try {
      return listing.images ? JSON.parse(listing.images) : null;
    } catch {
      return null;
    }
  })();
  const coverImage = images && images.length > 0 ? images[0] : null;
  const conditionKey = listing.condition as ConditionValue;
  const isWishlisted = wishlistIds?.includes(listing.id) ?? false;

  return (
    <div
      className="group cursor-pointer bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#FEDD00] hover:shadow-xl hover:shadow-yellow-100 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-200"
      onClick={() => setLocation(`/marketplace/${listing.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {/* Condition badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONDITION_BADGE[conditionKey] ?? "bg-gray-100 text-gray-600 border border-gray-300"}`}>
            {CONDITION_SHORT[conditionKey] ?? conditionKey}
          </span>
        </div>
        {/* Official badge */}
        {listing.sellerType === "platform" && (
          <div className="absolute top-2 right-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#0A0A2E] text-[#FEDD00]">
              官方
            </span>
          </div>
        )}
        {/* Wishlist heart button */}
        {onWishlistToggle && (
          <button
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:scale-110 transition-transform z-10"
            onClick={e => { e.stopPropagation(); onWishlistToggle(listing.id); }}
            aria-label={isWishlisted ? "移除收藏" : "加入收藏"}
          >
            <Heart className={`w-4 h-4 transition-colors ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-400"}`} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {listing.title}
        </p>
        <p className="text-base font-bold text-[#0A0A2E]">
          HK${Number(listing.priceHkd).toLocaleString()}
        </p>
        {/* Seller rating for C2C listings */}
        {listing.sellerType === "seller" && listing.sellerProfile && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {listing.sellerProfile.ratingCount > 0 ? (
              <>
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
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

// ─── Skeleton Card ────────────────────────────────────────────────────────────

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

// ─── Filter Section ───────────────────────────────────────────────────────────

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 py-3">
      <button
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-800 mb-2"
        onClick={() => setOpen(o => !o)}
      >
        {title}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Coming Soon (Production Guard) ─────────────────────────────────────────

function MarketplaceComingSoon() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Top brand bar */}
      <div className="w-full bg-[#06038d] py-4 flex justify-center absolute top-0 left-0">
        <img
          src={import.meta.env.VITE_APP_LOGO || "/boxium-logo.png"}
          alt="BOXIUM"
          className="h-10 object-contain"
        />
      </div>

      {/* Main content */}
      <div className="text-center max-w-md mt-16">
        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-[#06038d] flex items-center justify-center mx-auto mb-6 shadow-lg">
          <ShoppingBag className="w-12 h-12 text-[#FEDD00]" />
        </div>

        {/* Brand */}
        <div className="inline-flex items-center gap-2 bg-[#06038d] text-[#FEDD00] font-bold text-sm px-4 py-1.5 rounded-full mb-4">
          BOXIUM 商城
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[#06038d] mb-3">功能開發中</h1>
        <p className="text-lg text-gray-500 mb-2">敬請期待！</p>
        <p className="text-sm text-gray-400 mb-8">
          我們正在為您打造最優質的可夢卡牌交易平台，<br />
          即將推出，請繼續關注。
        </p>

        {/* Decorative dots */}
        <div className="flex justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEDD00] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-[#06038d] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEDD00] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

export default function Marketplace() {
  // Marketplace is now live - direct URL access only (nav entry hidden)
  return <MarketplaceInner />;
}

function MarketplaceInner() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [sellerType, setSellerType] = useState<string>("all");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
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

  // Derive active quick tag
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
    setPriceRange([0, 50000]);
    clearSearch();
  };

  const hasActiveFilters = selectedConditions.length > 0 || sellerType !== "all" || selectedLanguages.length > 0 || search;

  // ─── Filter Sidebar ───────────────────────────────────────────────────────
  const FilterSidebar = () => (
    <aside className="w-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[#0A0A2E] flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          篩選條件
        </h2>
        {hasActiveFilters && (
          <button
            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            onClick={clearAllFilters}
          >
            清除全部
          </button>
        )}
      </div>

      {/* Condition - grouped by grading company */}
      <FilterSection title="品相">
        <TooltipProvider delayDuration={200}>
          <div className="space-y-3">
            {CONDITION_GROUPS.map(group => (
              <div key={group.group}>
                {/* Group header with description tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1 cursor-help w-fit">
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
                            checked ? "bg-[#0A0A2E] border-[#0A0A2E]" : "border-gray-300 bg-white group-hover:border-[#0A0A2E]"
                          }`}>
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CONDITION_BADGE[item.value as ConditionValue]}`}>{item.label}</span>
                        </label>
                        {/* Per-item tooltip */}
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
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                sellerType === s.value ? "bg-[#0A0A2E] border-[#0A0A2E]" : "border-gray-300 bg-white group-hover:border-[#0A0A2E]"
              }`}>
                {sellerType === s.value && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
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
                selectedLanguages.includes(l.value) ? "bg-[#0A0A2E] border-[#0A0A2E]" : "border-gray-300 bg-white group-hover:border-[#0A0A2E]"
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
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="最低"
              value={priceRange[0] || ""}
              onChange={e => setPriceRange([Number(e.target.value) || 0, priceRange[1]])}
              className="h-7 text-xs"
            />
            <span className="text-gray-400 self-center text-xs">—</span>
            <Input
              type="number"
              placeholder="最高"
              value={priceRange[1] === 50000 ? "" : priceRange[1]}
              onChange={e => setPriceRange([priceRange[0], Number(e.target.value) || 50000])}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </FilterSection>
    </aside>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top Search Bar ── */}
      <div className="bg-[#06038d] border-b border-[#0a07b5]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Logo + Title block */}
            <div className="shrink-0 flex items-center gap-3">
              {/* BOXIUM Logo image */}
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo-full_e9207f64.png"
                alt="BOXIUM"
                className="h-12 w-auto object-contain"
              />
              {/* Text */}
              <div className="text-left">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[#FEDD00] font-bold text-xl leading-none">商城</span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5">精選寶可夢卡牌 · 安全交易</p>
              </div>
            </div>
            {/* Divider */}
            <div className="hidden md:block w-px h-10 bg-white/10 shrink-0" />
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-2xl mx-auto w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜尋卡牌名稱、編號..."
                  className="pl-9 pr-8 bg-white border-0 text-gray-900 placeholder:text-gray-400 h-9 rounded-lg focus-visible:ring-2 focus-visible:ring-[#FEDD00]"
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
                className="bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#0A0A2E] font-bold h-9 px-5 rounded-lg shrink-0"
              >
                搜尋
              </Button>
            </form>
            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className="md:hidden border-white/30 text-white hover:bg-white/10 gap-1.5"
              onClick={() => setMobileSidebarOpen(o => !o)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              篩選
            </Button>
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
            className={`bg-gradient-to-r ${banner.gradient} transition-all duration-700 ${
              i === bannerIdx ? "block" : "hidden"
            }`}
          >
            <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{banner.emoji}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${banner.badgeClass}`}>{banner.badge}</span>
                  </div>
                  <h2 className="text-white font-bold text-lg leading-tight">{banner.title}</h2>
                  <p className="text-white/70 text-sm">{banner.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedConditions(banner.ctaConditions);
                  setSellerType((banner as any).ctaSellerType ?? "all");
                  setPage(1);
                }}
                className="shrink-0 px-5 py-2 rounded-lg font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ backgroundColor: banner.accent, color: banner.gradient.includes("06038d") ? "#06038d" : "white" }}
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
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === bannerIdx ? "bg-white w-4" : "bg-white/40"
              }`}
            />
          ))}
        </div>
        {/* Prev / Next arrows */}
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

      {/* ── Quick Category Tags ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none">
            {QUICK_TAGS.map((tag, i) => (
              <button
                key={tag.label}
                onClick={() => applyQuickTag(tag)}
                className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all duration-150 ${
                  activeQuickTag === i
                    ? "bg-[#06038d] text-white border-[#06038d] shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#06038d] hover:text-[#06038d]"
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active Filter Tags ── */}
      {hasActiveFilters && (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">已篩選：</span>
            {search && (
              <span className="inline-flex items-center gap-1 bg-[#0A0A2E] text-white text-xs px-2 py-0.5 rounded-full">
                搜尋：{search}
                <button onClick={clearSearch}><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedConditions.map(c => (
              <span key={c} className="inline-flex items-center gap-1 bg-[#0A0A2E] text-white text-xs px-2 py-0.5 rounded-full">
                {CONDITION_SHORT[c as ConditionValue] ?? c}
                <button onClick={() => toggleCondition(c)}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {sellerType !== "all" && (
              <span className="inline-flex items-center gap-1 bg-[#0A0A2E] text-white text-xs px-2 py-0.5 rounded-full">
                {sellerType === "platform" ? "官方" : "C2C"}
                <button onClick={() => setSellerType("all")}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button className="text-xs text-red-500 hover:text-red-700 font-medium ml-1" onClick={clearAllFilters}>
              清除全部
            </button>
          </div>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Desktop */}
          <div className="hidden md:block w-52 shrink-0">
            <div className="sticky top-4 bg-white border border-gray-200 rounded-xl p-4">
              <FilterSidebar />
            </div>
          </div>

          {/* Mobile Sidebar Overlay */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-[#0A0A2E]">篩選條件</h2>
                  <button onClick={() => setMobileSidebarOpen(false)}><X className="w-5 h-5" /></button>
                </div>
                <FilterSidebar />
              </div>
            </div>
          )}

          {/* Right Content */}
          <div className="flex-1 min-w-0">
            {/* Result count + Sort */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-sm text-gray-500">
                {isLoading ? "載入中..." : total > 0 ? (
                  <>共 <span className="text-gray-900 font-semibold">{total}</span> 件商品</>
                ) : "暫無商品"}
              </p>
              <Select value={sortBy} onValueChange={v => { setSortBy(v as typeof sortBy); setPage(1); }}>
                <SelectTrigger className="w-36 h-8 text-xs border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新上架</SelectItem>
                  <SelectItem value="price_asc">價格由低至高</SelectItem>
                  <SelectItem value="price_desc">價格由高至低</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-1">暫無在售商品</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  {hasActiveFilters ? "嘗試調整篩選條件以查看更多商品" : "商城即將上架更多精選卡牌，敬請期待！"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearAllFilters}>
                    清除篩選
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {listings.map((listing: any) => (
                  <ProductCard key={listing.id} listing={listing} wishlistIds={wishlistIds} onWishlistToggle={handleWishlistToggle} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="gap-1">
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
                        className={`w-8 h-8 p-0 text-xs ${page === pageNum ? "bg-[#0A0A2E] text-white hover:bg-[#1a1a4e]" : ""}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">
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
