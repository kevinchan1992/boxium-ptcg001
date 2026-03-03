import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, ChevronLeft, ChevronRight, SlidersHorizontal, X, ShoppingBag } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  mint: "Mint",
  near_mint: "NM",
  excellent: "EX",
  good: "Good",
  played: "Played",
  poor: "Poor",
  sealed: "Sealed",
};

const CONDITION_COLORS: Record<string, string> = {
  mint: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  near_mint: "bg-green-500/20 text-green-400 border-green-500/30",
  excellent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  good: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  played: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  poor: "bg-red-500/20 text-red-400 border-red-500/30",
  sealed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const PAGE_SIZE = 20;

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ listing }: { listing: any }) {
  const [, setLocation] = useLocation();
  const images: string[] | null = (() => {
    try {
      return listing.images ? JSON.parse(listing.images) : null;
    } catch {
      return null;
    }
  })();
  const coverImage = images && images.length > 0 ? images[0] : null;
  const conditionKey = listing.condition as string;

  return (
    <div
      className="group cursor-pointer bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200"
      onClick={() => setLocation(`/marketplace/${listing.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-[3/4] bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        {/* Condition badge overlay */}
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm ${CONDITION_COLORS[conditionKey] ?? "bg-muted/80 text-muted-foreground border-border"}`}>
            {CONDITION_LABELS[conditionKey] ?? conditionKey}
          </span>
        </div>
        {/* Platform badge */}
        {listing.sellerType === "platform" && (
          <div className="absolute top-2 right-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground backdrop-blur-sm">
              官方
            </span>
          </div>
        )}
        {/* Image count indicator */}
        {images && images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full">
            +{images.length - 1}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {listing.title}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-primary">
            HK${Number(listing.priceHkd).toLocaleString()}
          </span>
          {listing.quantity > 1 && (
            <span className="text-xs text-muted-foreground">×{listing.quantity}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [condition, setCondition] = useState<string>("all");
  const [sellerType, setSellerType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = trpc.marketplace.getListings.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    condition: condition !== "all" ? condition : undefined,
    sellerType: sellerType !== "all" ? (sellerType as "platform" | "seller") : undefined,
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

  const handleConditionChange = (val: string) => {
    setCondition(val);
    setPage(1);
  };

  const handleSellerTypeChange = (val: string) => {
    setSellerType(val);
    setPage(1);
  };

  const hasActiveFilters = condition !== "all" || sellerType !== "all" || search;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px] flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜尋商品名稱..."
                  className="pl-9 pr-8 text-sm"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button type="submit" size="sm" className="shrink-0">搜尋</Button>
            </form>

            {/* Filter toggle (mobile) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 gap-1.5 ${hasActiveFilters ? "border-primary text-primary" : ""}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              篩選
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </Button>
          </div>

          {/* Filters row */}
          {showFilters && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <Select value={condition} onValueChange={handleConditionChange}>
                <SelectTrigger className="w-36 text-sm h-8">
                  <SelectValue placeholder="卡況" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部卡況</SelectItem>
                  <SelectItem value="mint">Mint</SelectItem>
                  <SelectItem value="near_mint">Near Mint</SelectItem>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="played">Played</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="sealed">Sealed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sellerType} onValueChange={handleSellerTypeChange}>
                <SelectTrigger className="w-36 text-sm h-8">
                  <SelectValue placeholder="賣家類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部賣家</SelectItem>
                  <SelectItem value="platform">官方商品</SelectItem>
                  <SelectItem value="seller">C2C 賣家</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => {
                    setCondition("all");
                    setSellerType("all");
                    clearSearch();
                  }}
                >
                  清除篩選
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Result count */}
        {!isLoading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {total > 0 ? (
                <>共 <span className="text-foreground font-medium">{total}</span> 件商品</>
              ) : (
                "暫無商品"
              )}
            </p>
            {search && (
              <Badge variant="secondary" className="gap-1 text-xs">
                搜尋：{search}
                <button onClick={clearSearch}><X className="w-3 h-3" /></button>
              </Badge>
            )}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">暫無在售商品</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {hasActiveFilters ? "嘗試調整篩選條件以查看更多商品" : "商城即將上架更多精選卡牌，敬請期待！"}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setCondition("all");
                  setSellerType("all");
                  clearSearch();
                }}
              >
                清除篩選
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {listings.map((listing: any) => (
              <ProductCard key={listing.id} listing={listing} />
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
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              上一頁
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0 text-xs"
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
              className="gap-1"
            >
              下一頁
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
