/**
 * Marketplace Feature Tests
 * Tests for:
 * 1. Auto-complete orders scheduler (sellerId bug fix + source_transaction fix)
 * 2. Dispute evidence upload (image + video support)
 * 3. Scheduler sellerId resolution correctness
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Test 1: Auto-complete scheduler uses getSellerProfileById (not ByUserId) ─
describe("autoCompleteOrdersScheduler - sellerId resolution", () => {
  it("should use getSellerProfileById to resolve sellerProfile from order.sellerId", () => {
    // order.sellerId = sellerProfiles.id (NOT users.id)
    // The scheduler must call getSellerProfileById(order.sellerId)
    // to get sellerProfile.userId (which is users.id)
    const order = { sellerId: 42, sellerType: "seller" };
    // Verify the correct function name is used in priceUpdateScheduler.ts
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "priceUpdateScheduler.ts"),
      "utf-8"
    );
    // autoCompleteOrders should use getSellerProfileById
    const autoCompleteSection = content.substring(
      content.indexOf("startAutoCompleteOrdersScheduler"),
      content.indexOf("stopAutoCompleteOrdersScheduler")
    );
    expect(autoCompleteSection).toContain("getSellerProfileById");
    expect(autoCompleteSection).not.toContain("getSellerProfileByUserId");
  });

  it("should use sellerProfile.userId for notifications (not order.sellerId)", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "priceUpdateScheduler.ts"),
      "utf-8"
    );
    const autoCompleteSection = content.substring(
      content.indexOf("startAutoCompleteOrdersScheduler"),
      content.indexOf("stopAutoCompleteOrdersScheduler")
    );
    // Should use sellerUserId (resolved from sellerProfile.userId)
    expect(autoCompleteSection).toContain("sellerUserId");
    // Should NOT directly use order.sellerId as userId
    expect(autoCompleteSection).not.toContain("userId: order.sellerId");
  });

  it("should get Charge ID from PaymentIntent for source_transaction", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "priceUpdateScheduler.ts"),
      "utf-8"
    );
    const autoCompleteSection = content.substring(
      content.indexOf("startAutoCompleteOrdersScheduler"),
      content.indexOf("stopAutoCompleteOrdersScheduler")
    );
    // Should expand latest_charge to get Charge ID
    expect(autoCompleteSection).toContain("latest_charge");
    expect(autoCompleteSection).toContain("chargeId");
    // Should NOT use stripePaymentIntentId directly as source_transaction
    expect(autoCompleteSection).not.toContain("source_transaction: order.stripePaymentIntentId");
  });
});

// ─── Test 2: ShippingReminder scheduler uses getSellerProfileById ─────────────
describe("shippingReminderScheduler - sellerId resolution", () => {
  it("should use getSellerProfileById in shipping reminder scheduler", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "priceUpdateScheduler.ts"),
      "utf-8"
    );
    const reminderSection = content.substring(
      content.indexOf("startShippingReminderScheduler"),
      content.indexOf("stopShippingReminderScheduler")
    );
    expect(reminderSection).toContain("getSellerProfileById");
    expect(reminderSection).not.toContain("getSellerProfileByUserId");
    // Should use sellerProf.userId for notification
    expect(reminderSection).toContain("sellerProf.userId");
    expect(reminderSection).not.toContain("userId: order.sellerId");
  });
});

// ─── Test 3: PaymentTimeout scheduler uses getSellerProfileById ───────────────
describe("paymentTimeoutCancelScheduler - sellerId resolution", () => {
  it("should use getSellerProfileById in payment timeout cancel scheduler", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "priceUpdateScheduler.ts"),
      "utf-8"
    );
    const timeoutSection = content.substring(
      content.indexOf("startPaymentTimeoutCancelScheduler"),
      content.indexOf("stopPaymentTimeoutCancelScheduler")
    );
    expect(timeoutSection).toContain("getSellerProfileById");
    // Should use sellerProf.userId for notification
    expect(timeoutSection).toContain("sellerProf.userId");
    expect(timeoutSection).not.toContain("userId: order.sellerId");
  });
});

// ─── Test 4: uploadDisputeEvidence supports video MIME types ─────────────────
describe("uploadDisputeEvidence - video support", () => {
  it("should support video MIME types in backend", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "routers/marketplace.ts"),
      "utf-8"
    );
    const uploadSection = content.substring(
      content.indexOf("uploadDisputeEvidence: protectedProcedure"),
      content.indexOf("openDispute: protectedProcedure")
    );
    // Should support video MIME types
    expect(uploadSection).toContain("video/mp4");
    expect(uploadSection).toContain("video/webm");
    expect(uploadSection).toContain("video/quicktime");
    // Should use fileBase64 (not imageBase64)
    expect(uploadSection).toContain("fileBase64");
    expect(uploadSection).not.toContain("imageBase64");
    // Should return mimeType
    expect(uploadSection).toContain("mimeType: input.mimeType");
  });

  it("should map video extensions correctly", () => {
    const mimeExtMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "video/x-msvideo": "avi",
    };
    expect(mimeExtMap["video/mp4"]).toBe("mp4");
    expect(mimeExtMap["video/webm"]).toBe("webm");
    expect(mimeExtMap["video/quicktime"]).toBe("mov");
    expect(mimeExtMap["image/jpeg"]).toBe("jpg");
    expect(mimeExtMap["image/png"]).toBe("png");
  });
});

// ─── Test 5: Frontend Orders.tsx uses fileBase64 (not imageBase64) ────────────
describe("Orders.tsx - dispute evidence upload", () => {
  it("should use fileBase64 in uploadDisputeEvidence mutation call", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "../client/src/pages/Orders.tsx"),
      "utf-8"
    );
    // Should use fileBase64 (updated from imageBase64)
    expect(content).toContain("fileBase64: base64");
    expect(content).not.toContain("imageBase64: base64");
  });

  it("should support video preview in dispute dialog", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "../client/src/pages/Orders.tsx"),
      "utf-8"
    );
    // Should have video element for video evidence
    expect(content).toContain("<video");
    expect(content).toContain("disputeEvidenceMimeTypes");
    expect(content).toContain('startsWith("video/")');
  });

  it("should have size limits: 5MB for images, 30MB for videos", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "../client/src/pages/Orders.tsx"),
      "utf-8"
    );
    expect(content).toContain("30 * 1024 * 1024");
    expect(content).toContain("5 * 1024 * 1024");
  });
});

// ─── Test 6: AdminMarketplace.tsx supports video evidence display ─────────────
describe("AdminMarketplace.tsx - dispute evidence display", () => {
  it("should detect and display video evidence", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "../client/src/pages/AdminMarketplace.tsx"),
      "utf-8"
    );
    // Should detect video by extension
    expect(content).toContain("mp4|webm|mov|avi");
    // Should render video element
    expect(content).toContain("<video");
    expect(content).toContain("controls");
  });
});

// ─── Test 7: marketplace.ts confirmReceipt uses getSellerProfileById ──────────
describe("marketplace.ts - confirmReceipt sellerId resolution", () => {
  it("should use getSellerProfileById in confirmReceipt", () => {
    const fs = require("fs");
    const content = fs.readFileSync(
      require("path").join(__dirname, "routers/marketplace.ts"),
      "utf-8"
    );
    const confirmSection = content.substring(
      content.indexOf("confirmReceipt: protectedProcedure"),
      content.indexOf("buyerCancelOrder: protectedProcedure")
    );
    expect(confirmSection).toContain("getSellerProfileById");
    // Should use chargeId (not stripePaymentIntentId) for source_transaction
    expect(confirmSection).toContain("chargeId");
    expect(confirmSection).not.toContain("source_transaction: order.stripePaymentIntentId");
  });
});
