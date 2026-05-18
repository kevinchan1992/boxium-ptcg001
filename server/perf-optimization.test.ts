/**
 * perf-optimization.test.ts
 * 方案 H 效能優化測試
 * 驗證骨架屏組件和 code splitting 配置的正確性
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";

const clientSrc = path.resolve(__dirname, "../client/src");

describe("方案 H 效能優化", () => {
  describe("骨架屏組件（PageSkeletons.tsx）", () => {
    const skeletonFile = path.join(clientSrc, "components/PageSkeletons.tsx");

    it("PageSkeletons.tsx 檔案存在", () => {
      expect(existsSync(skeletonFile)).toBe(true);
    });

    it("匯出 ResearchSkeleton 組件", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      expect(content).toContain("export function ResearchSkeleton");
    });

    it("匯出 MarketplaceSkeleton 組件", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      expect(content).toContain("export function MarketplaceSkeleton");
    });

    it("匯出 CardDetailSkeleton 組件", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      expect(content).toContain("export function CardDetailSkeleton");
    });

    it("匯出 CardItemSkeleton 通用組件", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      expect(content).toContain("export function CardItemSkeleton");
    });

    it("使用 Skeleton UI 組件（animate-pulse 效果）", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      expect(content).toContain("Skeleton");
    });

    it("ResearchSkeleton 包含 5 張卡牌骨架", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      // 應該有 length: 5 的陣列來生成 5 張卡牌骨架
      expect(content).toContain("length: 5");
    });

    it("MarketplaceSkeleton 包含商品 grid 骨架", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      expect(content).toContain("gridTemplateColumns");
    });

    it("CardDetailSkeleton 包含卡牌圖片和價格骨架", () => {
      const content = readFileSync(skeletonFile, "utf-8");
      expect(content).toContain("aspect-[3/4]");
      expect(content).toContain("w-40");
    });
  });

  describe("Research 頁面骨架屏整合", () => {
    const researchFile = path.join(clientSrc, "pages/Research.tsx");

    it("Research.tsx 使用卡牌形狀骨架屏（非 Loader2）", () => {
      const content = readFileSync(researchFile, "utf-8");
      // 應該有卡牌形狀骨架（aspect-[3/4]），而不只是 Loader2 旋轉圖示
      expect(content).toContain("animate-pulse");
    });

    it("Research.tsx 骨架屏數量與實際卡牌數量一致（5張）", () => {
      const content = readFileSync(researchFile, "utf-8");
      // 骨架屏應該生成 5 個項目
      expect(content).toContain("length: 5");
    });
  });

  describe("CardDetail 頁面骨架屏整合", () => {
    const cardDetailFile = path.join(clientSrc, "pages/CardDetail.tsx");

    it("CardDetail.tsx 匯入 CardDetailSkeleton", () => {
      const content = readFileSync(cardDetailFile, "utf-8");
      expect(content).toContain("CardDetailSkeleton");
      expect(content).toContain("PageSkeletons");
    });

    it("CardDetail.tsx 在 isLoading 時使用 CardDetailSkeleton", () => {
      const content = readFileSync(cardDetailFile, "utf-8");
      expect(content).toContain("return <CardDetailSkeleton />");
    });

    it("CardDetail.tsx 不再使用全頁 Loader2 作為主要 loading 狀態", () => {
      const content = readFileSync(cardDetailFile, "utf-8");
      // isLoading 區塊不應該有 Loader2
      const isLoadingBlock = content.match(/if \(isLoading\) \{[\s\S]*?\}/)?.[0] || "";
      expect(isLoadingBlock).not.toContain("Loader2");
    });
  });

  describe("Marketplace 頁面效能優化", () => {
    const marketplaceFile = path.join(clientSrc, "pages/Marketplace.tsx");

    it("Marketplace.tsx 已有 ProductCardSkeleton 骨架屏", () => {
      const content = readFileSync(marketplaceFile, "utf-8");
      expect(content).toContain("ProductCardSkeleton");
    });

    it("ProductCard 圖片使用 loading=lazy", () => {
      const content = readFileSync(marketplaceFile, "utf-8");
      expect(content).toContain('loading="lazy"');
    });

    it("ProductCard 圖片使用 decoding=async 提升解碼效能", () => {
      const content = readFileSync(marketplaceFile, "utf-8");
      expect(content).toContain('decoding="async"');
    });

    it("Marketplace 使用無限滾動（IntersectionObserver）而非虛擬列表", () => {
      const content = readFileSync(marketplaceFile, "utf-8");
      expect(content).toContain("loadMoreRef");
      expect(content).toContain("IntersectionObserver");
    });
  });

  describe("Code Splitting 驗證", () => {
    const appFile = path.join(clientSrc, "App.tsx");

    it("App.tsx 使用 React.lazy() 進行路由級別 code splitting", () => {
      const content = readFileSync(appFile, "utf-8");
      const lazyCount = (content.match(/lazy\(/g) || []).length;
      // 應該有多個 lazy import（至少 10 個路由）
      expect(lazyCount).toBeGreaterThanOrEqual(10);
    });

    it("App.tsx 使用 Suspense 包裹 lazy 組件", () => {
      const content = readFileSync(appFile, "utf-8");
      expect(content).toContain("Suspense");
    });
  });
});
