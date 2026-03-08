/**
 * Unit tests for seller application email templates
 */
import { describe, it, expect } from "vitest";
import {
  buildSellerApprovedEmail,
  buildSellerRejectedEmail,
} from "./emailService";

describe("buildSellerApprovedEmail", () => {
  it("should return correct subject", () => {
    const { subject } = buildSellerApprovedEmail({
      displayName: "PTCG_Seller_001",
    });
    expect(subject).toContain("賣家申請已批准");
    expect(subject).toContain("BOXIUM PTCG");
  });

  it("should include displayName in html", () => {
    const { html } = buildSellerApprovedEmail({
      displayName: "PTCG_Seller_001",
    });
    expect(html).toContain("PTCG_Seller_001");
  });

  it("should include seller center CTA link", () => {
    const { html } = buildSellerApprovedEmail({
      displayName: "TestSeller",
      siteUrl: "https://boxium.asia",
    });
    expect(html).toContain("https://boxium.asia/seller");
    expect(html).toContain("前往賣家中心");
  });

  it("should include Stripe setup instructions", () => {
    const { html } = buildSellerApprovedEmail({
      displayName: "TestSeller",
    });
    expect(html).toContain("Stripe");
    expect(html).toContain("5%");
  });

  it("should use default siteUrl when not provided", () => {
    const { html } = buildSellerApprovedEmail({
      displayName: "TestSeller",
    });
    expect(html).toContain("https://boxium.asia");
  });
});

describe("buildSellerRejectedEmail", () => {
  it("should return correct subject", () => {
    const { subject } = buildSellerRejectedEmail({
      displayName: "PTCG_Seller_002",
    });
    expect(subject).toContain("賣家申請未獲批准");
    expect(subject).toContain("BOXIUM PTCG");
  });

  it("should include displayName in html", () => {
    const { html } = buildSellerRejectedEmail({
      displayName: "PTCG_Seller_002",
    });
    expect(html).toContain("PTCG_Seller_002");
  });

  it("should include rejectReason when provided", () => {
    const { html } = buildSellerRejectedEmail({
      displayName: "TestSeller",
      rejectReason: "資料不完整，請補充身份證明文件。",
    });
    expect(html).toContain("資料不完整，請補充身份證明文件。");
    expect(html).toContain("未批准原因");
  });

  it("should NOT include reason block when rejectReason is undefined", () => {
    const { html } = buildSellerRejectedEmail({
      displayName: "TestSeller",
    });
    expect(html).not.toContain("未批准原因");
  });

  it("should include customer service contact link", () => {
    const { html } = buildSellerRejectedEmail({
      displayName: "TestSeller",
    });
    expect(html).toContain("support@boxium.asia");
    expect(html).toContain("聯絡客服");
  });

  it("should produce valid HTML structure", () => {
    const { html } = buildSellerRejectedEmail({
      displayName: "TestSeller",
      rejectReason: "Test reason",
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("BOXIUM PTCG");
    expect(html).toContain("LUCK IN EVERY BOX");
  });
});
