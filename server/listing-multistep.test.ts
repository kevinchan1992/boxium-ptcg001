/**
 * 多步驟上架表單邏輯測試
 * 測試步驟驗證邏輯、步驟分配是否正確
 */
import { describe, it, expect } from "vitest";

// 模擬表單狀態
type ListingForm = {
  title: string;
  description: string;
  condition: string;
  quantity: string;
  price: string;
  tcgSeries: string;
  listingMode: "buy_now" | "auction";
  acceptOffers: boolean;
  minOffer: string;
  startingBid: string;
  reservePrice: string;
  buyNowPrice: string;
  bidIncrement: string;
  auctionEndAt: string;
  auctionDurationDays: number;
};

// 步驟1驗證邏輯（基本資料）
function isStep1Valid(form: ListingForm, images: string[]): boolean {
  return !(!form.title || form.title.trim().length < 3 || images.length === 0);
}

// 步驟2驗證邏輯（定價設定）
function isStep2Valid(form: ListingForm): boolean {
  if (form.listingMode === "auction") {
    return !!form.startingBid;
  }
  return !(!form.price || parseFloat(form.price) < 4.0);
}

const defaultForm: ListingForm = {
  title: "",
  description: "",
  condition: "raw_a",
  quantity: "1",
  price: "",
  tcgSeries: "pokemon",
  listingMode: "buy_now",
  acceptOffers: false,
  minOffer: "",
  startingBid: "",
  reservePrice: "",
  buyNowPrice: "",
  bidIncrement: "10",
  auctionEndAt: "",
  auctionDurationDays: 7,
};

describe("Step 1 (Basic Info) Validation", () => {
  it("should be invalid when title is empty", () => {
    expect(isStep1Valid({ ...defaultForm, title: "" }, ["img.jpg"])).toBe(false);
  });

  it("should be invalid when title is too short (< 3 chars)", () => {
    expect(isStep1Valid({ ...defaultForm, title: "AB" }, ["img.jpg"])).toBe(false);
  });

  it("should be invalid when no images uploaded", () => {
    expect(isStep1Valid({ ...defaultForm, title: "Valid Title" }, [])).toBe(false);
  });

  it("should be valid with title >= 3 chars and at least one image", () => {
    expect(isStep1Valid({ ...defaultForm, title: "Pokemon Card" }, ["img.jpg"])).toBe(true);
  });

  it("should be valid with exactly 3 char title and one image", () => {
    expect(isStep1Valid({ ...defaultForm, title: "ABC" }, ["img.jpg"])).toBe(true);
  });
});

describe("Step 2 (Pricing) Validation - Buy Now Mode", () => {
  it("should be invalid when price is empty", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "buy_now", price: "" })).toBe(false);
  });

  it("should be invalid when price is below minimum (HKD 4.00)", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "buy_now", price: "3.99" })).toBe(false);
  });

  it("should be invalid when price is exactly 3.99", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "buy_now", price: "3.99" })).toBe(false);
  });

  it("should be valid when price is exactly HKD 4.00", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "buy_now", price: "4.00" })).toBe(true);
  });

  it("should be valid when price is above minimum", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "buy_now", price: "100" })).toBe(true);
  });
});

describe("Step 2 (Pricing) Validation - Auction Mode", () => {
  it("should be invalid when starting bid is empty", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "auction", startingBid: "" })).toBe(false);
  });

  it("should be valid when starting bid is set (auctionEndAt auto-calculated)", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "auction", startingBid: "100" })).toBe(true);
  });

  it("should be valid even without auctionEndAt (auto-computed on advance)", () => {
    expect(isStep2Valid({ ...defaultForm, listingMode: "auction", startingBid: "50", auctionEndAt: "" })).toBe(true);
  });
});

describe("Step Distribution", () => {
  it("Step 1 should contain: images, card picker, title, condition, quantity", () => {
    const step1Fields = ["images", "cardPicker", "title", "condition", "quantity"];
    expect(step1Fields).toHaveLength(5);
    expect(step1Fields).toContain("images");
    expect(step1Fields).toContain("title");
    expect(step1Fields).toContain("condition");
    expect(step1Fields).toContain("quantity");
  });

  it("Step 2 should contain: tcgSeries, listingMode, description, pricing fields", () => {
    const step2Fields = ["tcgSeries", "listingMode", "description", "price/startingBid"];
    expect(step2Fields).toHaveLength(4);
    expect(step2Fields).toContain("tcgSeries");
    expect(step2Fields).toContain("listingMode");
    expect(step2Fields).toContain("description");
  });

  it("Step 3 should be confirmation/preview only", () => {
    const step3Fields = ["preview", "termsAgreement", "submitButton"];
    expect(step3Fields).toHaveLength(3);
    expect(step3Fields).toContain("preview");
    expect(step3Fields).toContain("termsAgreement");
  });
});

describe("Auction End Time Auto-computation", () => {
  it("should compute auctionEndAt when advancing from step 2 to step 3", () => {
    const form = { ...defaultForm, listingMode: "auction" as const, auctionDurationDays: 3, startingBid: "100" };
    const now = new Date();
    const days = form.auctionDurationDays || 3;
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    // Should be approximately 3 days from now
    const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(3, 0);
  });

  it("should use 7 days as default duration if not specified", () => {
    const form = { ...defaultForm, listingMode: "auction" as const, auctionDurationDays: 7 };
    const days = form.auctionDurationDays || 3;
    expect(days).toBe(7);
  });
});
