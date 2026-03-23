/**
 * Email Service for BOXIUM PTCG
 * Sends transactional emails for order status changes using SMTP settings stored in DB.
 */

import nodemailer from "nodemailer";
import { getSystemSetting } from "./db";

// ─── Transporter factory (reads SMTP config from DB each time) ───────────────

async function createTransporter() {
  // Priority 1: Gmail App Password from environment variable
  const gmailAppPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailAppPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "boxium.asia@gmail.com",
        pass: gmailAppPass,
      },
    });
  }

  // Priority 2: DB SMTP settings (fallback)
  const [hostRow, portRow, userRow, passRow] = await Promise.all([
    getSystemSetting("smtp_host"),
    getSystemSetting("smtp_port"),
    getSystemSetting("smtp_user"),
    getSystemSetting("smtp_pass"),
  ]);
  const host = hostRow?.settingValue;
  const port = parseInt(portRow?.settingValue || "587", 10);
  const user = userRow?.settingValue;
  const pass = passRow?.settingValue;
  if (!host || !user || !pass) {
    console.warn("[EmailService] SMTP not configured — skipping email send");
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// ─── Shared HTML wrapper ─────────────────────────────────────────────────────

// BOXIUM brand colours
const BRAND_BLUE = "#06038d";   // deep brand blue (matches website nav)
const BRAND_YELLOW = "#FFD700"; // gold yellow accent
const BRAND_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo_004f9905.png";

function wrapHtml(title: string, body: string, unsubscribeToken?: string, emailType?: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light only; supported-color-schemes: light; }
    html, body {
      background-color: #f4f5f7 !important;
      color: #1a1a2e !important;
    }
    /* Force light mode - prevent Gmail dark mode override */
    [data-ogsc] .email-header-bg { background-color: #06038d !important; }
    [data-ogsc] .email-footer-bg { background-color: #06038d !important; }
    [data-ogsc] .email-body-bg { background-color: #ffffff !important; }
    [data-ogsc] .email-outer-bg { background-color: #f4f5f7 !important; }
    /* Gmail dark mode override prevention */
    u + .body .email-header-bg { background-color: #06038d !important; }
    u + .body .email-footer-bg { background-color: #06038d !important; }
    u + .body .email-body-bg { background-color: #ffffff !important; }
    /* Outlook dark mode */
    @media (prefers-color-scheme: dark) {
      .email-header-bg { background-color: #06038d !important; }
      .email-footer-bg { background-color: #06038d !important; }
      .email-body-bg { background-color: #ffffff !important; }
      .email-outer-bg { background-color: #f4f5f7 !important; }
    }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,'Helvetica Neue',sans-serif;" bgcolor="#f4f5f7">
  <table class="email-outer-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f7" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(6,3,141,0.12);">

          <!-- Header: brand blue background -->
          <tr>
            <td class="email-header-bg" bgcolor="#06038d" style="background-color:#06038d !important;padding:28px 32px 24px;text-align:center;">
              <!-- Logo -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <img src="${BRAND_LOGO_URL}" alt="BOXIUM PTCG" width="180"
                      style="display:block;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;"
                      border="0" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <!-- Tagline -->
                    <p style="margin:12px 0 0;font-size:12px;color:#b3b0ff;letter-spacing:2px;text-transform:uppercase;">LUCK IN EVERY BOX</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Yellow accent divider -->
          <tr>
            <td bgcolor="#FFD700" style="background-color:#FFD700 !important;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-body-bg" bgcolor="#ffffff" style="background-color:#ffffff !important;padding:32px 36px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer-bg" bgcolor="#06038d" style="background-color:#06038d !important;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#b3b0ff;">
                此郵件由 BOXIUM PTCG 系統自動發送，請勿直接回覆。<br/>
                如有問題請聯絡客服：<a href="mailto:boxium.asia@gmail.com" style="color:#FFD700;text-decoration:none;">boxium.asia@gmail.com</a>
              </p>
              ${unsubscribeToken ? `
              <p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.45);">
                <a href="https://boxium.asia/unsubscribe?token=${unsubscribeToken}&action=unsubscribe" style="color:rgba(255,255,255,0.45);text-decoration:underline;">退訂此類通知</a>
                &nbsp;·&nbsp;
                <a href="https://boxium.asia/unsubscribe?token=${unsubscribeToken}&action=resubscribe" style="color:rgba(255,255,255,0.45);text-decoration:underline;">重新訂閱</a>
              </p>` : ''}
            </td>
          </tr>

        </table>

        <!-- Below-card copyright -->
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
          &copy; 2025 BOXIUM PTCG. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function orderInfoBlock(orderNo: string, itemName: string, priceHkd: string, listingId?: number): string {
  const listingIdRow = listingId ? `
    <tr>
      <td style="padding:10px 16px;border-top:1px solid #dde0f5;">
        <p style="margin:0;font-size:12px;color:#888;">商品編號（支付寶備注用）</p>
        <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:${BRAND_BLUE};font-family:monospace;">#BOXIUM-${listingId}</p>
      </td>
    </tr>` : '';
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6ff;border:2px solid #dde0f5;border-radius:10px;margin:20px 0;overflow:hidden;">
    <!-- Order No header row -->
    <tr>
      <td style="background:${BRAND_BLUE};padding:10px 16px;">
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);">訂單編號</p>
        <p style="margin:2px 0 0;font-size:14px;font-weight:bold;color:#ffffff;font-family:monospace;">${orderNo}</p>
      </td>
    </tr>
    ${listingIdRow}
    <tr>
      <td style="padding:10px 16px;border-top:1px solid #dde0f5;">
        <p style="margin:0;font-size:12px;color:#888;">商品</p>
        <p style="margin:4px 0 0;font-size:15px;color:#1a1a2e;font-weight:500;">${itemName}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 16px;border-top:1px solid #dde0f5;background:#ffffff;">
        <p style="margin:0;font-size:12px;color:#888;">金額</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:${BRAND_BLUE};">HKD ${priceHkd}</p>
      </td>
    </tr>
  </table>`;
}

function ctaButton(text: string, url: string): string {
  return `
  <div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:${BRAND_YELLOW};color:${BRAND_BLUE};font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(6,3,141,0.2);">${text}</a>
  </div>`;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export interface OrderEmailData {
  orderNo: string;
  itemName: string;
  priceHkd: string;
  listingId?: number;
  trackingNo?: string;
  note?: string;
  siteUrl?: string;
}

/** Order confirmed / payment received — to buyer */
export function buildOrderConfirmedEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `✅ 訂單確認 — ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單已確認 ✅</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">感謝您的購買！您的付款已成功，賣家將盡快為您處理訂單。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd, data.listingId)}
    <p style="color:#555;font-size:14px;">我們會在訂單出貨後再次通知您。如有任何問題，請透過平台聯絡賣家。</p>
    ${ctaButton("查看訂單", `${siteUrl}/orders`)}
  `);
  return { subject, html };
}

/** Order shipped — to buyer */
export function buildOrderShippedEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `📦 訂單已出貨 — ${data.orderNo}`;
  const trackingBlock = data.trackingNo
    ? `<p style="background:#fff8e1;border-left:4px solid ${BRAND_YELLOW};padding:12px 16px;border-radius:4px;margin:16px 0;font-size:14px;color:#333;">
        <strong>物流追蹤號：</strong>${data.trackingNo}
       </p>`
    : "";
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單已出貨 📦</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">您的商品已由賣家寄出，請留意查收。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    ${trackingBlock}
    <p style="color:#555;font-size:14px;">收到商品後，請記得在平台上確認收貨。如 <strong>14 天</strong>內未確認，系統將自動完成訂單。</p>
    ${ctaButton("確認收貨", `${siteUrl}/orders`)}
  `);
  return { subject, html };
}

/** Order completed (buyer confirmed) — to buyer */
export function buildOrderCompletedBuyerEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `🎉 訂單已完成 — ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單已完成 🎉</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">感謝您的購買！您已確認收貨，訂單已成功完成。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    <p style="color:#555;font-size:14px;">希望您對這次購物感到滿意！如有任何問題，請聯絡客服。</p>
    ${ctaButton("查看訂單記錄", `${siteUrl}/orders`)}
  `);
  return { subject, html };
}

/** Order completed — to seller */
export function buildOrderCompletedSellerEmail(data: OrderEmailData & { receivableHkd: string }): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `💰 訂單已完成，款項即將到帳 — ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單已完成 💰</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">買家已確認收貨，您的款項將按照平台規定時間轉帳。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1ff;border:1px solid #c8cbf0;border-radius:8px;margin:16px 0;padding:16px;">
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0;font-size:13px;color:#666;">您將收到（扣除平台手續費後）</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#16a34a;">HKD ${data.receivableHkd}</p>
        </td>
      </tr>
    </table>
    ${ctaButton("查看賣家中心", `${siteUrl}/seller`)}
  `);
  return { subject, html };
}

/** Order auto-completed (14 days no confirmation) — to buyer */
export function buildOrderAutoCompletedBuyerEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `⏰ 訂單已自動完成 — ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單已自動完成 ⏰</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">由於您的訂單在出貨後 <strong>14 天</strong>內未確認收貨，系統已自動完成此訂單。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    <p style="color:#555;font-size:14px;">如您尚未收到商品，或對訂單有任何疑問，請盡快聯絡客服處理。</p>
    ${ctaButton("查看訂單", `${siteUrl}/orders`)}
  `);
  return { subject, html };
}

/** Order auto-completed — to seller */
export function buildOrderAutoCompletedSellerEmail(data: OrderEmailData & { receivableHkd: string }): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `⏰ 訂單已自動完成，款項即將到帳 — ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單已自動完成 ⏰</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">由於買家在出貨後 <strong>14 天</strong>內未確認收貨，系統已自動完成此訂單。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1ff;border:1px solid #c8cbf0;border-radius:8px;margin:16px 0;padding:16px;">
      <tr>
        <td style="padding:8px 16px;">
          <p style="margin:0;font-size:13px;color:#666;">您將收到（扣除平台手續費後）</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#16a34a;">HKD ${data.receivableHkd}</p>
        </td>
      </tr>
    </table>
    ${ctaButton("查看賣家中心", `${siteUrl}/seller`)}
  `);
  return { subject, html };
}

/** Order refunded — to buyer */
export function buildOrderRefundedEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `💸 訂單退款通知 — ${data.orderNo}`;
  const noteBlock = data.note
    ? `<p style="background:#fff3f3;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:14px;color:#333;"><strong>退款原因：</strong>${data.note}</p>`
    : "";
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單退款通知 💸</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">您的訂單已申請退款，款項將退回至原付款方式，通常需要 5-10 個工作天。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    ${noteBlock}
    <p style="color:#555;font-size:14px;">如有任何疑問，請聯絡客服。</p>
    ${ctaButton("查看訂單", `${siteUrl}/orders`)}
  `);
  return { subject, html };
}

/** Order cancelled — to buyer */
export function buildOrderCancelledEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `❌ 訂單已取消 — ${data.orderNo}`;
  const noteBlock = data.note
    ? `<p style="background:#fff3f3;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:14px;color:#333;"><strong>取消原因：</strong>${data.note}</p>`
    : "";
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">訂單已取消 ❌</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">您的訂單已被取消。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    ${noteBlock}
    <p style="color:#555;font-size:14px;">如有任何疑問，請聯絡客服。</p>
    ${ctaButton("繼續購物", `${siteUrl}`)}
  `);
  return { subject, html };
}

// ─── Seller Application Email Templates ─────────────────────────────────────

export interface SellerApplicationEmailData {
  displayName: string;
  rejectReason?: string;
  siteUrl?: string;
}

/** Seller application approved — to seller */
export function buildSellerApprovedEmail(data: SellerApplicationEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `✅ 賣家申請已批准 — BOXIUM PTCG`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">賣家申請已批准 ✅</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.displayName}</strong>，<br/>
      恭喜！你的 BOXIUM PTCG 賣家申請已獲批准，現在可以開始在平台上架商品了。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1ff;border:1px solid #c8cbf0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:14px;color:#16a34a;font-weight:bold;">🎉 接下來的步驟：</p>
          <ol style="margin:0;padding-left:20px;color:#333;font-size:14px;line-height:1.8;">
            <li>前往賣家中心設定 <strong>Stripe 收款帳戶</strong>（必須完成才能收取款項）</li>
            <li>上架你的第一件商品</li>
            <li>等待買家下單，開始交易！</li>
          </ol>
        </td>
      </tr>
    </table>
    <p style="color:#555;font-size:14px;">平台收取 <strong>5% 服務費</strong>，款項在訂單完成後透過 Stripe 自動轉帳至你的帳戶。</p>
    ${ctaButton("前往賣家中心", `${siteUrl}/seller`)}
  `);
  return { subject, html };
}

/** Seller application rejected — to seller */
export function buildSellerRejectedEmail(data: SellerApplicationEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `❌ 賣家申請未獲批准 — BOXIUM PTCG`;
  const reasonBlock = data.rejectReason
    ? `<p style="background:#fff3f3;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:14px;color:#333;"><strong>未批准原因：</strong>${data.rejectReason}</p>`
    : "";
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">賣家申請未獲批准 ❌</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.displayName}</strong>，<br/>
      很遺憾，你的 BOXIUM PTCG 賣家申請目前未獲批准。
    </p>
    ${reasonBlock}
    <p style="color:#555;font-size:14px;">如你認為此決定有誤，或希望了解更多詳情，請聯絡我們的客服團隊，我們將盡快為你跟進。</p>
    <p style="color:#555;font-size:14px;">你仍然可以繼續使用 BOXIUM PTCG 平台進行購買。</p>
    ${ctaButton("聯絡客服", `mailto:boxium.asia@gmail.com`)}
  `);
  return { subject, html };
}

// ─── Main send function ───────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
  emailType = 'general',
  toUserId,
  skipUnsubscribeCheck = false,
  dedupeKey,
}: {
  to: string;
  subject: string;
  html: string;
  emailType?: string;
  toUserId?: number;
  skipUnsubscribeCheck?: boolean;
  dedupeKey?: string; // e.g. 'order_shipped_buyer_123' — prevents duplicate sends
}): Promise<boolean> {
  try {
    // ── Deduplication check: skip if same dedupeKey was already sent successfully ──
    if (dedupeKey) {
      try {
        const { getDb: _getDbDedup } = await import('./db');
        const { emailLogs: _emailLogsDedup } = await import('../drizzle/schema_new');
        const { and: _andDedup, eq: _eqDedup } = await import('drizzle-orm');
        const dbDedup = await _getDbDedup();
        if (dbDedup) {
          const existing = await dbDedup.select({ id: _emailLogsDedup.id })
            .from(_emailLogsDedup)
            .where(_andDedup(_eqDedup(_emailLogsDedup.dedupeKey, dedupeKey), _eqDedup(_emailLogsDedup.status, 'sent')))
            .limit(1);
          if (existing.length > 0) {
            console.log(`[EmailService] Dedup skip "${subject}" to ${to} (key=${dedupeKey})`);
            return false;
          }
        }
      } catch (e) {
        // Non-fatal: if dedup check fails, proceed to send
      }
    }
    // Check unsubscribe status (skip for critical emails like order confirmation)
    // A user is considered unsubscribed only when resubscribedAt IS NULL.
    // Records with resubscribedAt set are "active" token records created by getOrCreateUnsubscribeToken().
    if (!skipUnsubscribeCheck) {
      try {
        const { getDb } = await import('./db');
        const { emailUnsubscribes } = await import('../drizzle/schema_new');
        const { and, eq, or, isNull } = await import('drizzle-orm');
        const db = await getDb();
        if (db) {
          const unsub = await db.select().from(emailUnsubscribes)
            .where(and(
              or(eq(emailUnsubscribes.email, to), ...(toUserId ? [eq(emailUnsubscribes.userId, toUserId)] : [])),
              or(eq(emailUnsubscribes.emailType, emailType), eq(emailUnsubscribes.emailType, 'all')),
              isNull(emailUnsubscribes.resubscribedAt) // Only truly unsubscribed records (resubscribedAt IS NULL)
            ))
            .limit(1);
          if (unsub.length > 0) {
            console.log(`[EmailService] Skipped "${subject}" to ${to} (unsubscribed)`);
            await logEmail({ to, subject, emailType, toUserId, status: 'skipped', dedupeKey });
            return false;
          }
        }
      } catch (e) {
        // Non-fatal: if unsubscribe check fails, still send email
      }
    }

    // Auto-inject unsubscribe token into HTML footer if toUserId is provided
    let finalHtml = html;
    if (toUserId && emailType !== 'system' && !skipUnsubscribeCheck) {
      try {
        const unsubToken = await getOrCreateUnsubscribeToken(toUserId, to, emailType);
        if (unsubToken) {
          // Replace the closing </body> with unsubscribe footer injection
          // We need to re-wrap with token — detect if already wrapped by checking for our footer marker
          if (!finalHtml.includes('unsubscribe?token=')) {
            // Inject unsubscribe links before </body>
            const unsubBlock = `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-top:1px solid #eeeeee;">
                <tr>
                  <td style="padding:12px 32px;text-align:center;">
                    <p style="margin:0;font-size:11px;color:#bbbbbb;">
                      <a href="https://boxiumptcg.manus.space/unsubscribe?token=${unsubToken}&action=unsubscribe" style="color:#aaaaaa;text-decoration:underline;">退訂此類通知</a>
                      &nbsp;·&nbsp;
                      <a href="https://boxiumptcg.manus.space/unsubscribe?token=${unsubToken}&action=resubscribe" style="color:#aaaaaa;text-decoration:underline;">重新訂閱</a>
                    </p>
                  </td>
                </tr>
              </table>`;
            finalHtml = finalHtml.replace('</body>', `${unsubBlock}</body>`);
          }
        }
      } catch (e) {
        // Non-fatal: if token injection fails, still send email without it
      }
    }

    const transporter = await createTransporter();
    if (!transporter) {
      await logEmail({ to, subject, emailType, toUserId, status: 'failed', errorMessage: 'SMTP not configured' });
      return false;
    }

    const fromEmail = process.env.GMAIL_APP_PASSWORD
      ? "boxium.asia@gmail.com"
      : (await getSystemSetting("smtp_user"))?.settingValue || "noreply@boxium.asia";
    const fromName = "BOXIUM PTCG";

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html: finalHtml,
    });

    console.log(`[EmailService] Sent "${subject}" to ${to}`);
    await logEmail({ to, subject, emailType, toUserId, status: 'sent', dedupeKey });
    return true;
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
    await logEmail({ to, subject, emailType, toUserId, status: 'failed', errorMessage: err.message, dedupeKey });
    return false;
  }
}

/**
 * Get or create an unsubscribe token for a user+emailType combination.
 * Returns the token string, or null if DB is unavailable.
 */
async function getOrCreateUnsubscribeToken(
  userId: number,
  email: string,
  emailType: string,
): Promise<string | null> {
  try {
    const { getDb } = await import('./db');
    const { emailUnsubscribes } = await import('../drizzle/schema_new');
    const { eq, and } = await import('drizzle-orm');
    const db = await getDb();
    if (!db) return null;

    // Look for existing token for this user+emailType
    const existing = await db.select().from(emailUnsubscribes)
      .where(and(
        eq(emailUnsubscribes.userId, userId),
        eq(emailUnsubscribes.emailType, emailType),
      ))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].token;
    }

    // Create a new token record
    const { randomBytes } = await import('crypto');
    const token = randomBytes(32).toString('hex');
    await db.insert(emailUnsubscribes).values({
      userId,
      email,
      emailType,
      token,
      // resubscribedAt = now means "active" (not unsubscribed) — we just store the token
      resubscribedAt: new Date(),
    });
    return token;
  } catch (e) {
    return null;
  }
}

/** Internal helper: write an email log entry */
async function logEmail({
  to, subject, emailType, toUserId, status, errorMessage, dedupeKey,
}: {
  to: string;
  subject: string;
  emailType: string;
  toUserId?: number;
  status: 'sent' | 'failed' | 'skipped';
  errorMessage?: string;
  dedupeKey?: string;
}): Promise<void> {
  try {
    const { getDb } = await import('./db');
    const { emailLogs } = await import('../drizzle/schema_new');
    const db = await getDb();
    if (!db) return;
    await db.insert(emailLogs).values({
      toEmail: to,
      toUserId: toUserId ?? null,
      subject,
      emailType,
      status,
      errorMessage: errorMessage ?? null,
      dedupeKey: dedupeKey ?? null,
    });
  } catch (e) {
    // Non-fatal: log failures should not break email sending
  }
}

/**
 * Get order display data (item name + price) for email templates.
 * Falls back to orderNo if no items found.
 */
export async function getOrderEmailData(order: {
  id: number;
  orderNo: string;
  listingId?: number | null;
  subtotalHkd: string | number | null;
  sellerReceivableHkd: string | number | null;
}): Promise<{ itemName: string; priceHkd: string; receivableHkd: string; listingId?: number }> {
  try {
    const { getOrderItems } = await import("./db");
    const items = await getOrderItems(order.id);
    const itemName = items.length > 0
      ? items.map(i => i.title).join(", ")
      : order.orderNo;
    const priceHkd = order.subtotalHkd ? String(order.subtotalHkd) : "—";
    const receivableHkd = order.sellerReceivableHkd ? String(order.sellerReceivableHkd) : "—";
    const listingId = order.listingId ?? undefined;
    return { itemName, priceHkd, receivableHkd, listingId };
  } catch {
    return { itemName: order.orderNo, priceHkd: "—", receivableHkd: "—" };
  }
}

/**
 * Convenience: send order email to a user by ID.
 * Silently skips if user has no email or SMTP is not configured.
 * Pass emailType to enable unsubscribe token injection and logging.
 */
export async function sendOrderEmail({
  userId,
  subject,
  html,
  emailType = 'order',
  dedupeKey,
}: {
  userId: number;
  subject: string;
  html: string;
  emailType?: string;
  dedupeKey?: string; // e.g. 'order_shipped_buyer_123'
}): Promise<boolean> {
  try {
    const { getUserById } = await import("./userManagement");
    const user = await getUserById(userId);
    if (!user?.email) return false;
    return sendEmail({ to: user.email, subject, html, emailType, toUserId: userId, dedupeKey });
  } catch (err: any) {
    console.error(`[EmailService] sendOrderEmail error for userId=${userId}:`, err.message);
    return false;
  }
}

// ─── Offer Email Templates ────────────────────────────────────────────────────

export interface OfferEmailData {
  sellerName: string;
  buyerName: string;
  cardName: string;
  offerAmountHkd: string;
  listingPriceHkd: string;
  expiresAt: string; // e.g. "2026-03-11 18:00 (HKT)"
  sellerDashboardUrl: string;
}

/** New offer received — to seller */
export function buildNewOfferEmail(data: OfferEmailData): { subject: string; html: string } {
  const subject = `💬 您收到一個新出價 — ${data.cardName}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">您收到一個新出價 💬</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.sellerName}</strong>，<br/>
      買家 <strong>${data.buyerName}</strong> 對您的商品提出了出價，請盡快回應。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1ff;border:1px solid #c8cbf0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#666;">商品名稱</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#06038d;">${data.cardName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #c8cbf0;">
          <p style="margin:0;font-size:13px;color:#666;">您的定價</p>
          <p style="margin:4px 0 0;font-size:15px;color:#333;">HKD ${data.listingPriceHkd}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #c8cbf0;">
          <p style="margin:0;font-size:13px;color:#666;">買家出價</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#16a34a;">HKD ${data.offerAmountHkd}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #c8cbf0;">
          <p style="margin:0;font-size:13px;color:#666;">出價有效期至</p>
          <p style="margin:4px 0 0;font-size:14px;color:#ef4444;font-weight:bold;">${data.expiresAt}</p>
        </td>
      </tr>
    </table>
    <p style="color:#555;font-size:14px;">⚠️ 出價將在有效期後自動過期，請盡快登入平台回應。</p>
    ${ctaButton("前往賣家中心回應出價", data.sellerDashboardUrl)}
  `);
  return { subject, html };
}

/** Offer expiring soon reminder — to seller */
export function buildOfferExpiringSoonEmail(data: OfferEmailData): { subject: string; html: string } {
  const subject = `⏰ 出價即將過期 — ${data.cardName}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#e97316;font-size:22px;">出價即將過期 ⏰</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.sellerName}</strong>，<br/>
      您有一個出價將在 <strong>6 小時內</strong>過期，請盡快回應！
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#666;">商品名稱</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#06038d;">${data.cardName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #fed7aa;">
          <p style="margin:0;font-size:13px;color:#666;">買家出價</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#16a34a;">HKD ${data.offerAmountHkd}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #fed7aa;">
          <p style="margin:0;font-size:13px;color:#666;">過期時間</p>
          <p style="margin:4px 0 0;font-size:14px;color:#ef4444;font-weight:bold;">${data.expiresAt}</p>
        </td>
      </tr>
    </table>
    <p style="color:#555;font-size:14px;">若不在有效期內回應，此出價將自動過期，買家需重新出價。</p>
    ${ctaButton("立即回應出價", data.sellerDashboardUrl)}
  `);
  return { subject, html };
}

/** Payment received — new order notification to seller */
export function buildOrderPaymentReceivedSellerEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `🎉 新訂單已付款，請安排出貨 — ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">新訂單已付款 🎉</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">您有一筆新訂單的付款已確認，請盡快安排出貨。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd, data.listingId)}
    <p style="color:#555;font-size:14px;">請在賣家中心查看買家的收貨地址，並盡快安排寄送。出貨後請在平台更新物流追蹤號。</p>
    ${ctaButton("前往賣家中心出貨", `${siteUrl}/seller`)}
  `);
  return { subject, html };
}

/** Payment received — order confirmed notification to buyer */
export function buildOrderPaymentReceivedBuyerEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `✅ 付款確認 — 訂單 ${data.orderNo} 已進入處理中`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">付款已確認 ✅</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">您的付款已成功確認！賣家將盡快為您安排出貨。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd, data.listingId)}
    <p style="color:#555;font-size:14px;">我們會在訂單出貨後再次通知您，請留意追蹤號碼。如有任何問題，請透過平台聯絡賣家。</p>
    ${ctaButton("查看訂單詳情", `${siteUrl}/orders/${data.orderNo}`)}
  `);
  return { subject, html };
}

/** New review received — notification to seller */
export function buildNewReviewSellerEmail(data: { orderNo: string; itemName: string; rating: number; comment?: string; siteUrl?: string }): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const stars = "⭐".repeat(data.rating) + "☆".repeat(5 - data.rating);
  const subject = `⭐ 您收到一則新評價 — ${data.rating}/5 星`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">您收到一則新評價 ⭐</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">買家已對訂單 <strong>${data.orderNo}</strong> 提交評價。</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#666;">商品名稱</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#06038d;">${data.itemName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #fde68a;">
          <p style="margin:0;font-size:13px;color:#666;">評分</p>
          <p style="margin:4px 0 0;font-size:22px;">${stars} <span style="font-weight:bold;color:#d97706;">${data.rating}/5</span></p>
        </td>
      </tr>
      ${data.comment ? `<tr>
        <td style="padding:12px 16px;border-top:1px solid #fde68a;">
          <p style="margin:0;font-size:13px;color:#666;">買家留言</p>
          <p style="margin:4px 0 0;font-size:14px;color:#374151;font-style:italic;">"${data.comment}"</p>
        </td>
      </tr>` : ""}
    </table>
    <p style="color:#555;font-size:14px;">您的評分已更新。持續提供優質服務有助提升賣家評分，吸引更多買家！</p>
    ${ctaButton("前往賣家中心", `${siteUrl}/seller`)}
  `);
  return { subject, html };
}

// ─── Welcome Email ───────────────────────────────────────────────────────────

/**
 * Build welcome email HTML for new users.
 */
export function buildWelcomeEmail(data: {
  userName: string;
  siteUrl?: string;
}): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `🎉 歡迎加入 BOXIUM PTCG！`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:24px;">歡迎加入 BOXIUM PTCG！🎉</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.userName}</strong>，<br/>
      感謝您加入 BOXIUM PTCG — 香港及台灣最專業的寶可夢集換式卡牌交易平台！
    </p>

    <!-- Feature highlights -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1ff;border:1px solid #c8cbf0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #e0e4ff;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#06038d;">📊 即時價格追蹤</p>
          <p style="margin:6px 0 0;font-size:13px;color:#555;">整合 Snkrdunk、eBay 等多個國際市場數據，掌握卡牌最新成交價。</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #e0e4ff;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#06038d;">🛒 安全交易市集</p>
          <p style="margin:6px 0 0;font-size:13px;color:#555;">在 BOXIUM 市集買賣卡牌，支援出價洽議，安全有保障。</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #e0e4ff;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#06038d;">⭐ 關注清單</p>
          <p style="margin:6px 0 0;font-size:13px;color:#555;">追蹤心儀卡牌的價格走勢，第一時間掌握入手時機。</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#06038d;">🏪 成為賣家</p>
          <p style="margin:6px 0 0;font-size:13px;color:#555;">申請成為認證賣家，輕鬆在平台上架您的卡牌，觸及更多買家。</p>
        </td>
      </tr>
    </table>

    <p style="color:#555;font-size:14px;margin:16px 0;">立即前往市集，探索最新上架的優質卡牌！</p>
    ${ctaButton("前往 BOXIUM 市集", `${siteUrl}/marketplace`)}

    <p style="color:#999;font-size:12px;margin-top:24px;text-align:center;">
      如有任何問題，歡迎聯絡我們：<a href="mailto:boxium.asia@gmail.com" style="color:#06038d;">boxium.asia@gmail.com</a>
    </p>
  `);
  return { subject, html };
}

/**
 * Send welcome email to a new user.
 * Should be called once when the user first signs up / logs in for the first time.
 */
export async function sendWelcomeEmail({
  userId,
  userName,
  email,
  siteUrl,
}: {
  userId: number;
  userName: string;
  email: string;
  siteUrl?: string;
}): Promise<boolean> {
  const { subject, html } = buildWelcomeEmail({ userName, siteUrl });
  return sendEmail({
    to: email,
    subject,
    html,
    emailType: 'welcome',
    toUserId: userId,
    skipUnsubscribeCheck: false,
  });
}

// ─── Admin Notification Email (replaces Manus notifyOwner) ───────────────────

const ADMIN_EMAIL = "boxium.asia@gmail.com";

/**
 * Send an admin notification email to boxium.asia@gmail.com.
 * Replaces Manus notifyOwner() for all platform events.
 */
export async function notifyAdmin({
  title,
  content,
}: {
  title: string;
  content: string;
}): Promise<boolean> {
  const subject = `[BOXIUM 後台] ${title}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:20px;">${title}</h2>
    <div style="background:#f0f1ff;border:1px solid #c8cbf0;border-radius:8px;padding:16px 20px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#333;white-space:pre-line;">${content}</p>
    </div>
    <p style="color:#999;font-size:12px;margin-top:16px;">此為系統自動發送的管理員通知，時間：${new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })}</p>
  `);
  return sendEmail({ to: ADMIN_EMAIL, subject, html });
}

/**
 * Public wrapper for wrapHtml — used by the admin test-email endpoint.
 * Renders the given body inside the standard BOXIUM email shell without
 * an unsubscribe link (test emails are never stored in the log).
 */
export function wrapHtmlTest(title: string, body: string): string {
  return wrapHtml(title, body);
}

// ─── Dispute Opened Email Templates ──────────────────────────────────────────────────

export interface DisputeEmailData {
  orderNo: string;
  itemName: string;
  priceHkd: string;
  reason?: string;
  siteUrl?: string;
}

/** Dispute opened — confirmation to buyer */
export function buildDisputeOpenedBuyerEmail(data: DisputeEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `⚙️ 爭議申請已收到 — ${data.orderNo}`;
  const reasonBlock = data.reason
    ? `<p style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:14px;color:#333;"><strong>爭議原因：</strong>${data.reason}</p>`
    : "";
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">爭議申請已收到 ⚙️</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">您的爭議申請已成功提交，我們將在 <strong>24 小時內</strong>進行處理，請耐心等候。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    ${reasonBlock}
    <p style="color:#555;font-size:14px;">如需查看爭議進度，請前往「我的訂單」頁面。</p>
    ${ctaButton("查看訂單", `${siteUrl}/orders`)}
  `);
  return { subject, html };
}

/** Dispute opened — notification to seller */
export function buildDisputeOpenedSellerEmail(data: DisputeEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `⚠️ 買家對訂單提出爭議 — ${data.orderNo}`;
  const reasonBlock = data.reason
    ? `<p style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:14px;color:#333;"><strong>爭議原因：</strong>${data.reason}</p>`
    : "";
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#e65100;font-size:22px;">買家提出爭議 ⚠️</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">買家對以下訂單提出爭議，管理員正在處理中，請保持聯絡。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    ${reasonBlock}
    <p style="color:#555;font-size:14px;">如有任何證明或資料需要提供，請盡快與平台客服聯絡。</p>
    ${ctaButton("查看訂單", `${siteUrl}/orders`)}
  `);
  return { subject, html };
}

// ─── Dispute Resolved — Seller Notification Email Templates ──────────────────
export interface DisputeResolvedSellerEmailData {
  orderNo: string;
  itemName: string;
  priceHkd: string;
  resolution: string;
  outcome: "refund_buyer" | "release_seller" | "partial";
  receivableHkd?: string;
  siteUrl?: string;
}

/**
 * Dispute resolved — seller notification (covers all outcomes).
 *   refund_buyer   → seller "lost"; listing restored to active
 *   release_seller → seller "won"; payout processing
 *   partial        → partial resolution
 */
export function buildDisputeResolvedSellerEmail(
  data: DisputeResolvedSellerEmailData
): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const isWon     = data.outcome === "release_seller";
  const isPartial = data.outcome === "partial";

  const subject = isWon
    ? `✅ 爭議已解決（訂單完成）— ${data.orderNo}`
    : isPartial
    ? `⚖️ 爭議已解決（部分退款）— ${data.orderNo}`
    : `📋  爭議已解決（買家獲退款）— ${data.orderNo}`;

  const headingColor = isWon ? "#2e7d32" : "#555";
  const headingText  = isWon
    ? "爭議已解決 — 訂單完成 ✅"
    : isPartial
    ? "爭議已解決 — 部分退款 ⚖️"
    : "爭議已解決 — 買家獲退款 📋";

  const outcomeMessage = isWon
    ? `管理員審查後，裁定訂單正常完成。您的款項（<strong>HKD ${data.receivableHkd ?? data.priceHkd}</strong>）將按正常流程處理。`
    : isPartial
    ? `管理員審查後，裁定部分退款給買家。請查看訂單詳情了解具體安排。`
    : `管理員審查後，裁定退款給買家，訂單已取消。您的商品已重新上架，可繼續出售。`;

  const resolutionBlock = `
    <div style="background:#f5f5f5;border-left:4px solid #06038d;padding:12px 16px;border-radius:4px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#555;"><strong>管理員裁決說明：</strong></p>
      <p style="margin:6px 0 0;font-size:14px;color:#333;">${data.resolution}</p>
    </div>`;

  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:${headingColor};font-size:22px;">${headingText}</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">${outcomeMessage}</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    ${resolutionBlock}
    <p style="color:#555;font-size:14px;">如對裁決有任何疑問，請聯絡平台客服：<a href="mailto:boxium.asia@gmail.com" style="color:#06038d;">boxium.asia@gmail.com</a></p>
    ${ctaButton("查看賣家中心", `${siteUrl}/seller`)}
  `);

  return { subject, html };
}


/** 7-day confirm receipt reminder — sent to buyer when shipped but not confirmed after 7 days */
export function buildConfirmReceiptReminderEmail(data: { buyerName: string; orderNo: string; itemName: string; shippedDaysAgo: number; ordersUrl: string }): { subject: string; html: string } {
  const subject = `📦 請確認收貨 — 訂單 ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">請確認收貨 📦</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.buyerName}</strong>，<br/>
      您的訂單 <strong>#${data.orderNo}</strong>（${data.itemName}）已出貨超過 <strong>${data.shippedDaysAgo} 天</strong>。<br/>
      如果您已收到商品，請盡快確認收貨，以便賣家收到款項。
    </p>
    <p style="color:#555;font-size:14px;">
      若您尚未收到商品或商品有問題，請在訂單頁面提出爭議，我們會協助處理。<br/>
      <strong>提醒：</strong>出貨超過 14 天未確認收貨的訂單將自動完成。
    </p>
    ${ctaButton("前往確認收貨", data.ordersUrl)}
  `);
  return { subject, html };
}

/** Offer expiring soon — notification to buyer (their offer is about to expire) */
export function buildOfferExpiringSoonBuyerEmail(data: { buyerName: string; sellerName: string; cardName: string; offerAmountHkd: string; expiresAt: string; ordersUrl: string }): { subject: string; html: string } {
  const subject = `⏰ 您的出價即將過期 — ${data.cardName}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#e97316;font-size:22px;">您的出價即將過期 ⏰</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.buyerName}</strong>，<br/>
      您對「${data.cardName}」的出價將在 <strong>6 小時內</strong>過期。如果賣家未在期限內回應，此出價將自動失效。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#666;">商品名稱</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#06038d;">${data.cardName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #fed7aa;">
          <p style="margin:0;font-size:13px;color:#666;">您的出價</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#16a34a;">HKD ${data.offerAmountHkd}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid #fed7aa;">
          <p style="margin:0;font-size:13px;color:#666;">過期時間</p>
          <p style="margin:4px 0 0;font-size:14px;color:#ef4444;font-weight:bold;">${data.expiresAt}</p>
        </td>
      </tr>
    </table>
    <p style="color:#555;font-size:14px;">若出價過期後仍有興趣，您可以重新出價。</p>
    ${ctaButton("查看我的出價", data.ordersUrl)}
  `);
  return { subject, html };
}
