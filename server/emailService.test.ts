/**
 * emailService.test.ts
 * Validates Gmail SMTP connection and email sending using GMAIL_APP_PASSWORD env var.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock nodemailer ──────────────────────────────────────────────────────────
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-message-id" });
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

// ─── Mock DB helper (not needed for Gmail App Password path) ─────────────────
vi.mock("./db", () => ({
  getSystemSetting: vi.fn().mockResolvedValue(null),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────
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
});
