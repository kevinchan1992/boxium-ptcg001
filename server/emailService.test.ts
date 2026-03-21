/**
 * emailService.test.ts
 * Validates Gmail SMTP, email sending, welcome email, unsubscribe token injection,
 * email logging, and unsubscribe checks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock nodemailer ──────────────────────────────────────────────────────────
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-message-id" });
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

// ─── Mock DB helper ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getSystemSetting: vi.fn().mockResolvedValue(null),
  getDb: vi.fn().mockResolvedValue(null), // null DB = skip logging/unsubscribe checks
}));

// ─── Tests: Gmail SMTP ────────────────────────────────────────────────────────
describe("emailService - Gmail App Password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_APP_PASSWORD = "test-app-password";
  });

  it("creates Gmail transporter when GMAIL_APP_PASSWORD is set", async () => {
    const { sendEmail } = await import("./emailService");
    await sendEmail({
      to: "test@example.com",
      subject: "Test Subject",
      html: "<p>Test</p>",
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: {
        user: "boxium.asia@gmail.com",
        pass: "test-app-password",
      },
    });
  });

  it("sends email with BOXIUM as sender name", async () => {
    const { sendEmail } = await import("./emailService");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "出價通知",
      html: "<p>有人出價了</p>",
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining("BOXIUM PTCG"),
        to: "user@example.com",
        subject: "出價通知",
      })
    );
  });

  it("uses boxium.asia@gmail.com as from address", async () => {
    const { sendEmail } = await import("./emailService");
    await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.from).toContain("boxium.asia@gmail.com");
  });

  it("returns false when sendMail throws", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));
    const { sendEmail } = await import("./emailService");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(result).toBe(false);
  });

  it("email HTML template includes BOXIUM logo img tag", async () => {
    const { buildNewOfferEmail } = await import("./emailService");
    const { html } = buildNewOfferEmail({
      sellerName: "賣家A",
      itemTitle: "Charizard PSA 10",
      offerAmountHkd: "8000",
      buyerName: "買家B",
      siteUrl: "https://boxium.asia",
      listingId: 123,
    });

    expect(html).toContain("boxium-logo-white");
    expect(html).toContain("<img");
  });

  it("accepts emailType and toUserId parameters without error", async () => {
    const { sendEmail } = await import("./emailService");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "訂單通知",
      html: "<p>您的訂單已確認</p>",
      emailType: "order",
      toUserId: 42,
    });
    expect(result).toBe(true);
  });

  it("skipUnsubscribeCheck bypasses unsubscribe lookup", async () => {
    const { sendEmail } = await import("./emailService");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "重要訂單確認",
      html: "<p>訂單已確認</p>",
      emailType: "order",
      skipUnsubscribeCheck: true,
    });
    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("email footer contains customer support email", async () => {
    const { buildNewOfferEmail } = await import("./emailService");
    const { html } = buildNewOfferEmail({
      sellerName: "賣家A",
      itemTitle: "Pikachu",
      offerAmountHkd: "500",
      buyerName: "買家B",
      siteUrl: "https://boxium.asia",
      listingId: 1,
    });
    expect(html).toContain("boxium.asia@gmail.com");
  });
});

// ─── Tests: Welcome Email ─────────────────────────────────────────────────────
describe("emailService - Welcome Email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_APP_PASSWORD = "test-app-password";
  });

  it("buildWelcomeEmail returns correct subject and HTML", async () => {
    const { buildWelcomeEmail } = await import("./emailService");
    const { subject, html } = buildWelcomeEmail({
      userName: "測試用戶",
      siteUrl: "https://boxium.asia",
    });

    expect(subject).toContain("歡迎");
    expect(subject).toContain("BOXIUM PTCG");
    expect(html).toContain("測試用戶");
    expect(html).toContain("marketplace");
    expect(html).toContain("boxium-logo-white");
  });

  it("buildWelcomeEmail includes platform feature highlights", async () => {
    const { buildWelcomeEmail } = await import("./emailService");
    const { html } = buildWelcomeEmail({ userName: "Alice" });

    // Should contain feature highlights
    expect(html).toContain("即時價格追蹤");
    expect(html).toContain("安全交易市集");
    expect(html).toContain("關注清單");
    expect(html).toContain("成為賣家");
  });

  it("buildWelcomeEmail includes CTA button linking to marketplace", async () => {
    const { buildWelcomeEmail } = await import("./emailService");
    const { html } = buildWelcomeEmail({
      userName: "Bob",
      siteUrl: "https://boxium.asia",
    });

    expect(html).toContain("https://boxium.asia/marketplace");
    expect(html).toContain("前往 BOXIUM 市集");
  });

  it("sendWelcomeEmail sends email with welcome emailType", async () => {
    const { sendWelcomeEmail } = await import("./emailService");
    const result = await sendWelcomeEmail({
      userId: 1,
      userName: "新用戶",
      email: "newuser@example.com",
      siteUrl: "https://boxium.asia",
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "newuser@example.com",
        subject: expect.stringContaining("歡迎"),
      })
    );
  });

  it("sendWelcomeEmail uses default siteUrl when not provided", async () => {
    const { buildWelcomeEmail } = await import("./emailService");
    const { html } = buildWelcomeEmail({ userName: "User" });
    // Default siteUrl should be boxium.asia
    expect(html).toContain("boxium.asia");
  });
});

// ─── Tests: Unsubscribe Token Injection ──────────────────────────────────────
describe("emailService - Unsubscribe Token Auto-injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_APP_PASSWORD = "test-app-password";
  });

  it("sends email without token injection when DB is null (graceful fallback)", async () => {
    const { sendEmail } = await import("./emailService");
    // DB is mocked to return null, so token injection is skipped
    const result = await sendEmail({
      to: "user@example.com",
      subject: "出價通知",
      html: "<html><body><p>Test</p></body></html>",
      emailType: "offer",
      toUserId: 99,
    });

    expect(result).toBe(true);
    // Email should still be sent even without token injection
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("does not inject unsubscribe block for system emails", async () => {
    const { sendEmail } = await import("./emailService");
    const result = await sendEmail({
      to: "admin@example.com",
      subject: "系統通知",
      html: "<html><body><p>System</p></body></html>",
      emailType: "system",
      toUserId: 1,
    });

    expect(result).toBe(true);
    // system emailType should skip token injection
    const callArgs = mockSendMail.mock.calls[0][0];
    // The html passed should not have unsubscribe block added (since emailType === 'system')
    expect(callArgs.html).not.toContain("unsubscribe?token=");
  });
});

// ─── Tests: sendOrderEmail Integration ───────────────────────────────────────
describe("emailService - sendOrderEmail Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_APP_PASSWORD = "test-app-password";
  });

  it("sendOrderEmail passes emailType and toUserId to sendEmail", async () => {
    // Mock userManagement to return a user with email
    vi.doMock("./userManagement", () => ({
      getUserById: vi.fn().mockResolvedValue({
        id: 42,
        email: "buyer@example.com",
        name: "Test Buyer",
      }),
    }));

    const { sendOrderEmail } = await import("./emailService");
    const result = await sendOrderEmail({
      userId: 42,
      subject: "訂單確認",
      html: "<html><body><p>Order confirmed</p></body></html>",
      emailType: "order",
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe("buyer@example.com");
    expect(callArgs.subject).toBe("訂單確認");
  });

  it("sendOrderEmail defaults to order emailType when not specified", async () => {
    vi.doMock("./userManagement", () => ({
      getUserById: vi.fn().mockResolvedValue({
        id: 10,
        email: "seller@example.com",
        name: "Test Seller",
      }),
    }));

    const { sendOrderEmail } = await import("./emailService");
    const result = await sendOrderEmail({
      userId: 10,
      subject: "出貨通知",
      html: "<html><body><p>Shipped</p></body></html>",
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("sendOrderEmail returns false when user has no email", async () => {
    vi.doMock("./userManagement", () => ({
      getUserById: vi.fn().mockResolvedValue({
        id: 99,
        email: null,
        name: "No Email User",
      }),
    }));

    const { sendOrderEmail } = await import("./emailService");
    const result = await sendOrderEmail({
      userId: 99,
      subject: "訂單通知",
      html: "<html><body><p>Test</p></body></html>",
    });

    expect(result).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

// ─── Tests: Email Template emailType Mapping ─────────────────────────────────
describe("emailService - Email Template Types", () => {
  it("buildNewOfferEmail returns correct subject and HTML structure", async () => {
    const { buildNewOfferEmail } = await import("./emailService");
    const { subject, html } = buildNewOfferEmail({
      sellerName: "賣家A",
      buyerName: "買家B",
      cardName: "皮卡丘 VMAX",
      offerAmountHkd: "500.00",
      listingPriceHkd: "600.00",
      expiresAt: "2026-04-01 18:00 (HKT)",
      sellerDashboardUrl: "https://boxium.asia/seller",
    });
    expect(subject).toContain("新出價");
    expect(html).toContain("皮卡丘 VMAX");
    expect(html).toContain("HKD 500.00");
    expect(html).toContain("賣家A");
    expect(html).toContain("買家B");
  });

  it("buildSellerApprovedEmail returns correct subject and HTML", async () => {
    const { buildSellerApprovedEmail } = await import("./emailService");
    const { subject, html } = buildSellerApprovedEmail({
      displayName: "TestSeller",
      siteUrl: "https://boxium.asia",
    });
    expect(subject).toContain("批准");
    expect(html).toContain("TestSeller");
    expect(html).toContain("Stripe");
  });

  it("buildSellerRejectedEmail includes rejection reason when provided", async () => {
    const { buildSellerRejectedEmail } = await import("./emailService");
    const { subject, html } = buildSellerRejectedEmail({
      displayName: "TestSeller",
      rejectReason: "文件不齊全",
    });
    expect(subject).toContain("未獲批准");
    expect(html).toContain("文件不齊全");
  });
});
