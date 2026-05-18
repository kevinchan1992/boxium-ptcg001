/**
 * PageSkeletons.tsx
 * 統一骨架屏組件：Research、Marketplace、CardDetail
 * 設計原則：骨架屏形狀與實際內容佈局一致，減少 CLS（累積版面位移）
 */
import { Skeleton } from "@/components/ui/skeleton";

// ─── Research 頁面骨架屏 ──────────────────────────────────────────────────────
// 對應：Logo + 標題 + 搜尋框 + 5張卡牌縮圖
export function ResearchSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center w-full px-4 py-8 gap-6">
      {/* Logo placeholder */}
      <Skeleton className="w-48 h-16 rounded-xl" />
      {/* Title */}
      <div className="flex flex-col items-center gap-2 w-full max-w-sm">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-lg" />
      </div>
      {/* Search bar */}
      <Skeleton className="h-12 w-full max-w-sm rounded-full" />
      {/* Card grid - 5 cards */}
      <div className="flex gap-3 justify-center flex-wrap w-full max-w-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5" style={{ width: 'calc(20% - 12px)', minWidth: 56 }}>
            <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Marketplace 頁面骨架屏 ───────────────────────────────────────────────────
// 對應：Banner + Tab切換 + TCG系列篩選 + 商品卡片 grid
export function MarketplaceSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Banner */}
      <Skeleton className="w-full h-40 sm:h-56 rounded-2xl" />
      {/* Market Tab Switcher */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      {/* TCG Series Quick Filter */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      {/* Product Grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-2 space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
              <Skeleton className="h-5 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CardDetail 頁面骨架屏 ────────────────────────────────────────────────────
// 對應：卡牌圖片 + 名稱 + 價格 + 標籤 + 圖表
export function CardDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile: stacked layout */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Top section: image + basic info */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Card image */}
          <div className="flex-shrink-0 flex justify-center sm:justify-start">
            <Skeleton className="w-48 sm:w-56 aspect-[3/4] rounded-2xl" />
          </div>
          {/* Card info */}
          <div className="flex-1 space-y-4">
            {/* Card name */}
            <div className="space-y-2">
              <Skeleton className="h-7 w-3/4 rounded-lg" />
              <Skeleton className="h-5 w-1/2 rounded-lg" />
            </div>
            {/* Price display */}
            <div className="space-y-2">
              <Skeleton className="h-10 w-40 rounded-xl" />
              <Skeleton className="h-4 w-32 rounded-lg" />
            </div>
            {/* Tags */}
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
            {/* Action buttons */}
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
        </div>
        {/* Price chart */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-24 rounded-lg" />
          <Skeleton className="w-full h-48 rounded-2xl" />
        </div>
        {/* Price history table */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 flex-1 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 通用卡牌卡片骨架屏（可複用） ────────────────────────────────────────────
export function CardItemSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Skeleton className="aspect-[3/4] w-full rounded-lg" />
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-2/3 rounded" />
    </div>
  );
}
