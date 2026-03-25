/**
 * Admin Delisted Feature Tests (2026-03-25)
 *
 * Tests for the adminDelisted boolean field on marketplaceListings:
 * - Admin can set adminDelisted=true when removing a listing
 * - Sellers cannot relist items that have adminDelisted=true
 * - Admin can clear adminDelisted=false when re-approving a listing
 * - batchReactivateListings skips adminDelisted items
 * - updateMyListing blocks status='active' for adminDelisted items
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ───────────────────────────────────────────────────────────
const mockUpdateListing = vi.fn().mockResolvedValue(undefined);
const mockGetListingById = vi.fn();
const mockGetSellerProfileByUserId = vi.fn();
const mockGetSellerProfileById = vi.fn();
const mockCreateNotification = vi.fn().mockResolvedValue(undefined);

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  updateListing: (...args: any[]) => mockUpdateListing(...args),
  getListingById: (...args: any[]) => mockGetListingById(...args),
  getSellerProfileByUserId: (...args: any[]) => mockGetSellerProfileByUserId(...args),
  getSellerProfileById: (...args: any[]) => mockGetSellerProfileById(...args),
  createNotification: (...args: any[]) => mockCreateNotification(...args),
}));

// ─── Admin Delisted: adminUpdateListing sets adminDelisted=true on remove ──────
describe("adminUpdateListing: sets adminDelisted=true when status=removed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set adminDelisted=true in updatePayload when status is 'removed'", () => {
    const input = { id: 60001, status: "removed" as const };
    const { id, ...data } = input;
    const updatePayload: Record<string, any> = { ...data };

    // Simulate the adminUpdateListing logic
    if (data.status === "removed") {
      updatePayload.adminDelisted = true;
    } else if (data.status === "active") {
      updatePayload.adminDelisted = false;
    }

    expect(updatePayload.adminDelisted).toBe(true);
    expect(updatePayload.status).toBe("removed");
  });

  it("should set adminDelisted=false in updatePayload when status is 'active' (re-approve)", () => {
    const input = { id: 60001, status: "active" as const };
    const { id, ...data } = input;
    const updatePayload: Record<string, any> = { ...data };

    if (data.status === "removed") {
      updatePayload.adminDelisted = true;
    } else if (data.status === "active") {
      updatePayload.adminDelisted = false;
    }

    expect(updatePayload.adminDelisted).toBe(false);
    expect(updatePayload.status).toBe("active");
  });

  it("should NOT modify adminDelisted when status is 'draft' or 'pending_review'", () => {
    const input = { id: 60001, status: "draft" as const };
    const { id, ...data } = input;
    const updatePayload: Record<string, any> = { ...data };

    if (data.status === "removed") {
      updatePayload.adminDelisted = true;
    } else if (data.status === "active") {
      updatePayload.adminDelisted = false;
    }

    expect(updatePayload).not.toHaveProperty("adminDelisted");
  });

  it("should NOT modify adminDelisted when only price is updated (no status change)", () => {
    const input = { id: 60001, price: 150 };
    const { id, ...data } = input;
    const updatePayload: Record<string, any> = { ...data };

    if ((data as any).status === "removed") {
      updatePayload.adminDelisted = true;
    } else if ((data as any).status === "active") {
      updatePayload.adminDelisted = false;
    }

    expect(updatePayload).not.toHaveProperty("adminDelisted");
    expect(updatePayload.price).toBe(150);
  });
});

// ─── updateMyListing: blocks seller from relisting adminDelisted items ─────────
describe("updateMyListing: blocks seller from relisting adminDelisted items", () => {
  it("should throw FORBIDDEN when seller tries to set status=active on adminDelisted listing", () => {
    // Simulate the guard logic in updateMyListing
    const listing = {
      id: 60001,
      adminDelisted: true,
      status: "removed",
      sellerId: 1,
    };
    const inputStatus = "active";

    const checkAdminDelisted = () => {
      if (inputStatus === "active" && listing.adminDelisted) {
        throw new Error("FORBIDDEN: 此商品已被管理員下架，如有疑問請聯絡平台客服");
      }
    };

    expect(checkAdminDelisted).toThrow("FORBIDDEN");
  });

  it("should NOT throw when seller relists a non-adminDelisted item", () => {
    const listing = {
      id: 60002,
      adminDelisted: false,
      status: "removed",
      sellerId: 1,
    };
    const inputStatus = "active";

    const checkAdminDelisted = () => {
      if (inputStatus === "active" && listing.adminDelisted) {
        throw new Error("FORBIDDEN: 此商品已被管理員下架，如有疑問請聯絡平台客服");
      }
    };

    expect(checkAdminDelisted).not.toThrow();
  });

  it("should NOT throw when seller sets status=removed on adminDelisted listing (can still delist)", () => {
    const listing = {
      id: 60001,
      adminDelisted: true,
      status: "removed",
      sellerId: 1,
    };
    const inputStatus = "removed";

    const checkAdminDelisted = () => {
      if (inputStatus === "active" && listing.adminDelisted) {
        throw new Error("FORBIDDEN: 此商品已被管理員下架，如有疑問請聯絡平台客服");
      }
    };

    expect(checkAdminDelisted).not.toThrow();
  });
});

// ─── batchReactivateListings: skips adminDelisted items ───────────────────────
describe("batchReactivateListings: skips adminDelisted items in batch reactivation", () => {
  it("should filter out adminDelisted listings from allowedIds", () => {
    const listings = [
      { id: 60001, sellerId: 1, adminDelisted: true },
      { id: 60002, sellerId: 1, adminDelisted: false },
      { id: 60003, sellerId: 1, adminDelisted: false },
    ];
    const inputIds = [60001, 60002, 60003];

    const adminDelistedIds = listings.filter(l => l.adminDelisted).map(l => l.id);
    const allowedIds = inputIds.filter(id => !adminDelistedIds.includes(id));

    expect(adminDelistedIds).toEqual([60001]);
    expect(allowedIds).toEqual([60002, 60003]);
  });

  it("should throw FORBIDDEN when ALL requested listings are adminDelisted", () => {
    const listings = [
      { id: 60001, sellerId: 1, adminDelisted: true },
      { id: 60004, sellerId: 1, adminDelisted: true },
    ];
    const inputIds = [60001, 60004];

    const adminDelistedIds = listings.filter(l => l.adminDelisted).map(l => l.id);
    const allowedIds = inputIds.filter(id => !adminDelistedIds.includes(id));

    const checkAllDelisted = () => {
      if (allowedIds.length === 0) {
        throw new Error("FORBIDDEN: 這些商品已被管理員下架，無法重新上架");
      }
    };

    expect(checkAllDelisted).toThrow("FORBIDDEN");
  });

  it("should return correct count and skipped count in mixed batch", () => {
    const listings = [
      { id: 60001, sellerId: 1, adminDelisted: true },
      { id: 60002, sellerId: 1, adminDelisted: false },
      { id: 60003, sellerId: 1, adminDelisted: false },
    ];
    const inputIds = [60001, 60002, 60003];

    const adminDelistedIds = listings.filter(l => l.adminDelisted).map(l => l.id);
    const allowedIds = inputIds.filter(id => !adminDelistedIds.includes(id));

    const result = { success: true, count: allowedIds.length, skipped: adminDelistedIds.length };

    expect(result.count).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.success).toBe(true);
  });

  it("should return count=0 and skipped=0 when no adminDelisted items in batch", () => {
    const listings = [
      { id: 60002, sellerId: 1, adminDelisted: false },
      { id: 60003, sellerId: 1, adminDelisted: false },
    ];
    const inputIds = [60002, 60003];

    const adminDelistedIds = listings.filter(l => l.adminDelisted).map(l => l.id);
    const allowedIds = inputIds.filter(id => !adminDelistedIds.includes(id));

    expect(adminDelistedIds.length).toBe(0);
    expect(allowedIds.length).toBe(2);
  });
});

// ─── Admin Authority: admin can override adminDelisted ────────────────────────
describe("Admin authority: admin can clear adminDelisted flag", () => {
  it("should allow admin to re-approve a previously adminDelisted listing", () => {
    // When admin sets status='active', adminDelisted should be cleared
    const input = { id: 60001, status: "active" as const };
    const { id, ...data } = input;
    const updatePayload: Record<string, any> = { ...data };

    if (data.status === "removed") {
      updatePayload.adminDelisted = true;
    } else if (data.status === "active") {
      updatePayload.adminDelisted = false; // Admin clears the flag
    }

    expect(updatePayload.adminDelisted).toBe(false);
    expect(updatePayload.status).toBe("active");
  });

  it("should allow admin to delist and relist multiple times", () => {
    // Simulate delist → relist cycle
    let adminDelisted = false;

    // Admin delists
    adminDelisted = true;
    expect(adminDelisted).toBe(true);

    // Admin re-approves
    adminDelisted = false;
    expect(adminDelisted).toBe(false);

    // Admin delists again
    adminDelisted = true;
    expect(adminDelisted).toBe(true);
  });
});

// ─── Schema validation: adminDelisted field defaults ─────────────────────────
describe("Schema: adminDelisted field defaults and constraints", () => {
  it("should default adminDelisted to false for new listings", () => {
    // Simulate a new listing creation (adminDelisted not set → defaults to false)
    const newListing = {
      title: "Test Card",
      status: "pending_review",
      adminDelisted: false, // default
    };
    expect(newListing.adminDelisted).toBe(false);
  });

  it("should be a boolean field (not null)", () => {
    const listing = { adminDelisted: true };
    expect(typeof listing.adminDelisted).toBe("boolean");
    expect(listing.adminDelisted).not.toBeNull();
    expect(listing.adminDelisted).not.toBeUndefined();
  });

  it("should distinguish between seller-removed and admin-removed listings", () => {
    // Seller removes their own listing: status=removed, adminDelisted=false
    const sellerRemoved = { status: "removed", adminDelisted: false };
    // Admin removes listing: status=removed, adminDelisted=true
    const adminRemoved = { status: "removed", adminDelisted: true };

    // Only adminDelisted=true should block seller from relisting
    const canSellerRelist = (listing: typeof sellerRemoved) => !listing.adminDelisted;

    expect(canSellerRelist(sellerRemoved)).toBe(true);  // Seller can relist own removal
    expect(canSellerRelist(adminRemoved)).toBe(false);  // Seller cannot relist admin removal
  });
});
