/**
 * Tests for P1 Mobile Optimizations:
 * 1. usePullToRefresh hook logic
 * 2. PullToRefreshIndicator rendering logic
 * 3. Dialog bottomSheet prop coverage
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

// ─── Pull-to-refresh hook ────────────────────────────────────────────────────

describe("usePullToRefresh hook", () => {
  it("hook file exists with correct exports", () => {
    const src = readFileSync(join(ROOT, "client/src/hooks/usePullToRefresh.ts"), "utf-8");
    expect(src).toContain("export function usePullToRefresh");
    expect(src).toContain("containerRef");
    expect(src).toContain("pullDistance");
    expect(src).toContain("isRefreshing");
    expect(src).toContain("isPulling");
  });

  it("hook uses passive touch listeners for performance", () => {
    const src = readFileSync(join(ROOT, "client/src/hooks/usePullToRefresh.ts"), "utf-8");
    expect(src).toContain("passive: true");
    expect(src).toContain("passive: false"); // touchmove must be non-passive to preventDefault
  });

  it("hook applies rubber-band damping", () => {
    const src = readFileSync(join(ROOT, "client/src/hooks/usePullToRefresh.ts"), "utf-8");
    expect(src).toContain("Math.exp");
  });

  it("hook has disabled option for desktop", () => {
    const src = readFileSync(join(ROOT, "client/src/hooks/usePullToRefresh.ts"), "utf-8");
    expect(src).toContain("disabled");
  });
});

// ─── PullToRefreshIndicator component ────────────────────────────────────────

describe("PullToRefreshIndicator component", () => {
  it("component file exists with correct structure", () => {
    const src = readFileSync(join(ROOT, "client/src/components/PullToRefreshIndicator.tsx"), "utf-8");
    expect(src).toContain("export function PullToRefreshIndicator");
    expect(src).toContain("pullDistance");
    expect(src).toContain("isRefreshing");
    expect(src).toContain("threshold");
  });

  it("indicator shows BOXIUM brand colors", () => {
    const src = readFileSync(join(ROOT, "client/src/components/PullToRefreshIndicator.tsx"), "utf-8");
    expect(src).toContain("#06038D");
    expect(src).toContain("#FEDD00");
  });

  it("indicator shows different states: pulling vs refreshing", () => {
    const src = readFileSync(join(ROOT, "client/src/components/PullToRefreshIndicator.tsx"), "utf-8");
    expect(src).toContain("更新中");
    expect(src).toContain("下拉更新");
    expect(src).toContain("放開以更新");
  });
});

// ─── Marketplace Pull-to-refresh integration ─────────────────────────────────

describe("Marketplace Pull-to-refresh integration", () => {
  it("imports usePullToRefresh and PullToRefreshIndicator", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/Marketplace.tsx"), "utf-8");
    expect(src).toContain("usePullToRefresh");
    expect(src).toContain("PullToRefreshIndicator");
  });

  it("uses containerRef on root div", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/Marketplace.tsx"), "utf-8");
    expect(src).toContain("ref={containerRef}");
  });

  it("invalidates listings and auctions on refresh", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/Marketplace.tsx"), "utf-8");
    expect(src).toContain("getListings.invalidate");
  });
});

// ─── Research Pull-to-refresh integration ────────────────────────────────────

describe("Research Pull-to-refresh integration", () => {
  it("imports usePullToRefresh and PullToRefreshIndicator", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/Research.tsx"), "utf-8");
    expect(src).toContain("usePullToRefresh");
    expect(src).toContain("PullToRefreshIndicator");
  });

  it("uses containerRef on root div", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/Research.tsx"), "utf-8");
    expect(src).toContain("ref={containerRef}");
  });

  it("invalidates trending cards on refresh", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/Research.tsx"), "utf-8");
    expect(src).toContain("getTrending.invalidate");
  });
});

// ─── Dialog bottomSheet coverage ─────────────────────────────────────────────

describe("Dialog bottomSheet prop coverage", () => {
  const pages = [
    "MarketplaceListing.tsx",
    "AuctionDetail.tsx",
    "Cart.tsx",
    "OrderDetail.tsx",
    "Profile.tsx",
    "SellerDashboard.tsx",
  ];

  for (const page of pages) {
    it(`${page} has at least one DialogContent with bottomSheet`, () => {
      const src = readFileSync(join(ROOT, `client/src/pages/${page}`), "utf-8");
      const hasBottomSheet = src.includes("bottomSheet");
      expect(hasBottomSheet).toBe(true);
    });
  }

  it("dialog.tsx bottomSheet uses lg breakpoint (1024px)", () => {
    const src = readFileSync(join(ROOT, "client/src/components/ui/dialog.tsx"), "utf-8");
    // Should use lg: prefix for breakpoint
    expect(src).toContain("lg:");
  });
});
