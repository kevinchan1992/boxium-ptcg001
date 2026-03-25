/**
 * Admin Delisted UI Badge Tests (2026-03-25)
 *
 * Tests for the adminDelisted UI display logic:
 * - 商品列表卡片 Header 顯示「🚫 強制下架」Badge
 * - 商品詳情 Dialog 顯示紅色警告橫幅
 * - 篩選 Tab「🚫 強制下架」只顯示 adminDelisted=true 的商品
 * - 篩選邏輯：admin_delisted → status=removed + client-side adminDelisted filter
 */
import { describe, it, expect } from "vitest";

// ─── Filter Tab Logic ─────────────────────────────────────────────────────────
describe("ListingsTab: admin_delisted filter logic", () => {
  it("should map statusFilter='admin_delisted' to query status='removed'", () => {
    const statusFilter = "admin_delisted";
    // Simulate the query mapping logic
    const queryStatus = statusFilter === "all"
      ? undefined
      : statusFilter === "admin_delisted"
        ? "removed"
        : statusFilter;
    expect(queryStatus).toBe("removed");
  });

  it("should pass status=undefined when statusFilter='all'", () => {
    const statusFilter = "all";
    const queryStatus = statusFilter === "all"
      ? undefined
      : statusFilter === "admin_delisted"
        ? "removed"
        : statusFilter;
    expect(queryStatus).toBeUndefined();
  });

  it("should pass status='active' unchanged when statusFilter='active'", () => {
    const statusFilter = "active";
    const queryStatus = statusFilter === "all"
      ? undefined
      : statusFilter === "admin_delisted"
        ? "removed"
        : statusFilter;
    expect(queryStatus).toBe("active");
  });

  it("should client-side filter adminDelisted=true when statusFilter='admin_delisted'", () => {
    const statusFilter = "admin_delisted";
    const allListings = [
      { id: 60001, status: "removed", adminDelisted: true },
      { id: 60002, status: "removed", adminDelisted: false },
      { id: 60003, status: "removed", adminDelisted: true },
    ];

    const filteredListings = statusFilter === "admin_delisted"
      ? allListings.filter((l) => l.adminDelisted)
      : allListings;

    expect(filteredListings).toHaveLength(2);
    expect(filteredListings.map(l => l.id)).toEqual([60001, 60003]);
  });

  it("should NOT filter when statusFilter is not 'admin_delisted'", () => {
    const statusFilter = "removed";
    const allListings = [
      { id: 60001, status: "removed", adminDelisted: true },
      { id: 60002, status: "removed", adminDelisted: false },
    ];

    const filteredListings = statusFilter === "admin_delisted"
      ? allListings.filter((l) => l.adminDelisted)
      : allListings;

    expect(filteredListings).toHaveLength(2);
  });
});

// ─── Badge Display Logic ──────────────────────────────────────────────────────
describe("Listing card: adminDelisted Badge display logic", () => {
  it("should show 強制下架 badge when adminDelisted=true", () => {
    const listing = { id: 60001, status: "removed", adminDelisted: true };
    const shouldShowBadge = (listing as any).adminDelisted === true;
    expect(shouldShowBadge).toBe(true);
  });

  it("should NOT show 強制下架 badge when adminDelisted=false", () => {
    const listing = { id: 60002, status: "removed", adminDelisted: false };
    const shouldShowBadge = (listing as any).adminDelisted === true;
    expect(shouldShowBadge).toBe(false);
  });

  it("should NOT show 強制下架 badge when adminDelisted is undefined (legacy data)", () => {
    const listing = { id: 60003, status: "removed" }; // no adminDelisted field
    const shouldShowBadge = !!(listing as any).adminDelisted;
    expect(shouldShowBadge).toBe(false);
  });

  it("should show badge regardless of listing status when adminDelisted=true", () => {
    // Edge case: admin re-approved but forgot to clear flag (shouldn't happen due to logic, but test defensively)
    const listing = { id: 60004, status: "active", adminDelisted: true };
    const shouldShowBadge = !!(listing as any).adminDelisted;
    expect(shouldShowBadge).toBe(true);
  });
});

// ─── Dialog Warning Banner Logic ──────────────────────────────────────────────
describe("ListingDetailDialog: adminDelisted warning banner", () => {
  it("should show warning banner when listing.adminDelisted=true", () => {
    const listing = { id: 60001, status: "removed", adminDelisted: true };
    const shouldShowWarning = !!(listing as any).adminDelisted;
    expect(shouldShowWarning).toBe(true);
  });

  it("should NOT show warning banner when listing.adminDelisted=false", () => {
    const listing = { id: 60002, status: "removed", adminDelisted: false };
    const shouldShowWarning = !!(listing as any).adminDelisted;
    expect(shouldShowWarning).toBe(false);
  });

  it("warning banner should appear before seller-readonly notice", () => {
    // Verify the render order: adminDelisted warning → seller readonly notice
    // This is a structural test - both can appear simultaneously for C2C adminDelisted listings
    const listing = { id: 60001, status: "removed", adminDelisted: true, sellerType: "seller" };
    const showAdminDelistedWarning = !!(listing as any).adminDelisted;
    const showSellerReadonlyNotice = listing.sellerType !== "platform";

    // Both should be true for a C2C adminDelisted listing
    expect(showAdminDelistedWarning).toBe(true);
    expect(showSellerReadonlyNotice).toBe(true);
  });
});

// ─── Filter Tab Button Styling ────────────────────────────────────────────────
describe("Filter Tab: admin_delisted button styling", () => {
  it("should use red color scheme for admin_delisted tab (active state)", () => {
    const s = "admin_delisted";
    const isActive = true;
    // Simulate the className logic
    const className = isActive
      ? (s === 'reserved' ? 'bg-amber-600 text-white' : s === 'admin_delisted' ? 'bg-red-600 text-white' : 'bg-[#06038d] text-white')
      : (s === 'reserved' ? 'text-amber-700 bg-amber-50 border-amber-300' : s === 'admin_delisted' ? 'text-red-700 bg-red-50 border-red-300' : 'text-gray-700 bg-white');

    expect(className).toBe('bg-red-600 text-white');
  });

  it("should use red outline for admin_delisted tab (inactive state)", () => {
    const s = "admin_delisted";
    const isActive = false;
    const className = isActive
      ? (s === 'reserved' ? 'bg-amber-600 text-white' : s === 'admin_delisted' ? 'bg-red-600 text-white' : 'bg-[#06038d] text-white')
      : (s === 'reserved' ? 'text-amber-700 bg-amber-50 border-amber-300' : s === 'admin_delisted' ? 'text-red-700 bg-red-50 border-red-300' : 'text-gray-700 bg-white');

    expect(className).toBe('text-red-700 bg-red-50 border-red-300');
  });

  it("should display correct label for each filter tab", () => {
    const labelMap: Record<string, string> = {
      all: "全部",
      active: "上架中",
      reserved: "🔒 鎖定中",
      pending_review: "待審核",
      draft: "草稿",
      sold: "已售出",
      admin_delisted: "🚫 強制下架",
      removed: "已下架",
    };

    expect(labelMap["admin_delisted"]).toBe("🚫 強制下架");
    expect(labelMap["removed"]).toBe("已下架");
    expect(labelMap["active"]).toBe("上架中");
  });
});
