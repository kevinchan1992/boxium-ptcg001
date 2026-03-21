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
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light only; }
    body { background-color: #f4f5f7 !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7 !important;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(6,3,141,0.12);">

          <!-- Header: brand blue with yellow logo badge -->
          <tr>
            <td style="background:${BRAND_BLUE};padding:28px 32px 24px;text-align:center;">
              <!-- Logo on yellow pill background for visibility -->
              <div style="display:inline-block;background:${BRAND_YELLOW};border-radius:12px;padding:10px 20px;">
                <img src="${BRAND_LOGO_URL}" alt="BOXIUM PTCG" width="160" height="auto"
                  style="display:block;max-width:160px;height:auto;" />
              </div>
              <!-- Tagline -->
              <p style="margin:12px 0 0;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase;">LUCK IN EVERY BOX</p>
            </td>
          </tr>

          <!-- Yellow accent divider -->
          <tr>
            <td style="background:${BRAND_YELLOW};height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;background:#ffffff;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#06038d;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);">
                此郵件由 BOXIUM PTCG 系統自動發送，請勿直接回覆。<br/>
                如有問題請聯絡客服：<a href="mailto:boxium.asia@gmail.com" style="color:${BRAND_YELLOW};text-decoration:none;">boxium.asia@gmail.com</a>
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
}: {
  to: string;
  subject: string;
  html: string;
  emailType?: string;
  toUserId?: number;
  skipUnsubscribeCheck?: boolean;
}): Promise<boolean> {
  try {
    // Check unsubscribe status (skip for critical emails like order confirmation)
    if (!skipUnsubscribeCheck) {
      try {
        const { getDb } = await import('./db');
        const { emailUnsubscribes } = await import('../drizzle/schema_new');
        const { and, eq, or } = await import('drizzle-orm');
        const db = await getDb();
        if (db) {
          const unsub = await db.select().from(emailUnsubscribes)
            .where(and(
              or(eq(emailUnsubscribes.email, to), ...(toUserId ? [eq(emailUnsubscribes.userId, toUserId)] : [])),
              or(eq(emailUnsubscribes.emailType, emailType), eq(emailUnsubscribes.emailType, 'all'))
            ))
            .limit(1);
          if (unsub.length > 0) {
            console.log(`[EmailService] Skipped "${subject}" to ${to} (unsubscribed)`);
            await logEmail({ to, subject, emailType, toUserId, status: 'skipped' });
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
    await logEmail({ to, subject, emailType, toUserId, status: 'sent' });
    return true;
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
    await logEmail({ to, subject, emailType, toUserId, status: 'failed', errorMessage: err.message });
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
  to, subject, emailType, toUserId, status, errorMessage,
}: {
  to: string;
  subject: string;
  emailType: string;
  toUserId?: number;
  status: 'sent' | 'failed' | 'skipped';
  errorMessage?: string;
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
}: {
  userId: number;
  subject: string;
  html: string;
  emailType?: string;
}): Promise<boolean> {
  try {
    const { getUserById } = await import("./userManagement");
    const user = await getUserById(userId);
    if (!user?.email) return false;
    return sendEmail({ to: user.email, subject, html, emailType, toUserId: userId });
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
