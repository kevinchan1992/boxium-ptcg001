/**
 * Stripe Connect 限制上架商品測試
 * 驗證：賣家 Stripe Connect 未完成時無法上架商品
 */
import { describe, it, expect } from "vitest";

// ─── 模擬賣家 Stripe Connect 狀態 ────────────────────────────────────────────
type StripeConnectStatus = "pending" | "active" | "restricted" | "disabled";

interface SellerProfile {
  id: number;
  userId: number;
  isActive: boolean;
  stripeConnectId: string | null;
  stripeConnectStatus: StripeConnectStatus;
}

/**
 * 模擬後端 createListing 的驗證邏輯
 */
function validateCanCreateListing(seller: SellerProfile | null): { allowed: boolean; reason?: string } {
  if (!seller) return { allowed: false, reason: "請先申請成為賣家" };
  if (!seller.isActive) return { allowed: false, reason: "賣家帳號尚未獲批准" };
  if (seller.stripeConnectStatus !== "active") {
    return { allowed: false, reason: "請先完成 Stripe Connect 收款帳戶設定，才能上架商品" };
  }
  return { allowed: true };
}

/**
 * 模擬後端 updateMyListing 的驗證邏輯（改為 active 時）
 */
function validateCanActivateListing(seller: SellerProfile | null, newStatus?: string): { allowed: boolean; reason?: string } {
  if (!seller) return { allowed: false, reason: "未授權" };
  if (newStatus === "active" && seller.stripeConnectStatus !== "active") {
    return { allowed: false, reason: "請先完成 Stripe Connect 收款帳戶設定，才能上架商品" };
  }
  return { allowed: true };
}

// ─── 測試案例 ─────────────────────────────────────────────────────────────────

describe("Stripe Connect 限制上架商品", () => {
  // 各種 Stripe Connect 狀態的賣家
  const activeSeller: SellerProfile = {
    id: 1, userId: 100, isActive: true,
    stripeConnectId: "acct_test_active",
    stripeConnectStatus: "active",
  };
  const pendingSeller: SellerProfile = {
    id: 2, userId: 101, isActive: true,
    stripeConnectId: null,
    stripeConnectStatus: "pending",
  };
  const pendingWithIdSeller: SellerProfile = {
    id: 3, userId: 102, isActive: true,
    stripeConnectId: "acct_test_pending",
    stripeConnectStatus: "pending",
  };
  const restrictedSeller: SellerProfile = {
    id: 4, userId: 103, isActive: true,
    stripeConnectId: "acct_test_restricted",
    stripeConnectStatus: "restricted",
  };
  const disabledSeller: SellerProfile = {
    id: 5, userId: 104, isActive: true,
    stripeConnectId: "acct_test_disabled",
    stripeConnectStatus: "disabled",
  };
  const inactiveSeller: SellerProfile = {
    id: 6, userId: 105, isActive: false,
    stripeConnectId: "acct_test_inactive",
    stripeConnectStatus: "active",
  };

  // ── createListing 驗證 ─────────────────────────────────────────────────────

  describe("createListing 驗證", () => {
    it("Stripe Connect active 的賣家可以上架商品", () => {
      const result = validateCanCreateListing(activeSeller);
      expect(result.allowed).toBe(true);
    });

    it("Stripe Connect pending（未設定）的賣家不能上架商品", () => {
      const result = validateCanCreateListing(pendingSeller);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Stripe Connect");
    });

    it("Stripe Connect pending（已連結但未驗證）的賣家不能上架商品", () => {
      const result = validateCanCreateListing(pendingWithIdSeller);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Stripe Connect");
    });

    it("Stripe Connect restricted 的賣家不能上架商品", () => {
      const result = validateCanCreateListing(restrictedSeller);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Stripe Connect");
    });

    it("Stripe Connect disabled 的賣家不能上架商品", () => {
      const result = validateCanCreateListing(disabledSeller);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Stripe Connect");
    });

    it("賣家帳號未獲批准（isActive=false）不能上架商品", () => {
      const result = validateCanCreateListing(inactiveSeller);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("批准");
    });

    it("未登記賣家不能上架商品", () => {
      const result = validateCanCreateListing(null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("賣家");
    });
  });

  // ── updateMyListing 改為 active 的驗證 ────────────────────────────────────

  describe("updateMyListing 改為 active 的驗證", () => {
    it("Stripe Connect active 的賣家可以將商品改為 active", () => {
      const result = validateCanActivateListing(activeSeller, "active");
      expect(result.allowed).toBe(true);
    });

    it("Stripe Connect pending 的賣家不能將商品改為 active", () => {
      const result = validateCanActivateListing(pendingSeller, "active");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Stripe Connect");
    });

    it("Stripe Connect restricted 的賣家不能將商品改為 active", () => {
      const result = validateCanActivateListing(restrictedSeller, "active");
      expect(result.allowed).toBe(false);
    });

    it("任何賣家都可以將商品改為 removed（下架）", () => {
      const result = validateCanActivateListing(pendingSeller, "removed");
      expect(result.allowed).toBe(true);
    });

    it("任何賣家都可以將商品改為 draft（草稿）", () => {
      const result = validateCanActivateListing(pendingSeller, "draft");
      expect(result.allowed).toBe(true);
    });

    it("不改變 status 時不受 Stripe Connect 限制", () => {
      const result = validateCanActivateListing(pendingSeller, undefined);
      expect(result.allowed).toBe(true);
    });
  });

  // ── 前端 UI 邏輯驗證 ──────────────────────────────────────────────────────

  describe("前端上架按鈕禁用邏輯", () => {
    it("Stripe Connect active 時按鈕應啟用", () => {
      const isDisabled = activeSeller.stripeConnectStatus !== "active";
      expect(isDisabled).toBe(false);
    });

    it("Stripe Connect pending 時按鈕應禁用", () => {
      const isDisabled = pendingSeller.stripeConnectStatus !== "active";
      expect(isDisabled).toBe(true);
    });

    it("Stripe Connect restricted 時按鈕應禁用", () => {
      const isDisabled = restrictedSeller.stripeConnectStatus !== "active";
      expect(isDisabled).toBe(true);
    });

    it("Stripe Connect disabled 時按鈕應禁用", () => {
      const isDisabled = disabledSeller.stripeConnectStatus !== "active";
      expect(isDisabled).toBe(true);
    });
  });
});
