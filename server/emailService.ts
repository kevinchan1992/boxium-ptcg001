/**
 * Email Service for BOXIUM PTCG
 * Sends transactional emails for order status changes using SMTP settings stored in DB.
 */

import nodemailer from "nodemailer";
import { getSystemSetting } from "./db";

// ─── Transporter factory (reads SMTP config from DB each time) ───────────────

async function createTransporter() {
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

const BRAND_BLUE = "#1a0dab";
const BRAND_YELLOW = "#ffed00";

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND_BLUE};padding:24px 32px;text-align:center;">
              <span style="font-size:24px;font-weight:900;color:${BRAND_YELLOW};letter-spacing:2px;">BOXIUM PTCG</span>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">LUCK IN EVERY BOX</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:12px;color:#999999;">
                此郵件由 BOXIUM PTCG 系統自動發送，請勿直接回覆。<br/>
                如有問題請聯絡客服：<a href="mailto:support@boxium.asia" style="color:${BRAND_BLUE};">support@boxium.asia</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function orderInfoBlock(orderNo: string, itemName: string, priceHkd: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border:1px solid #e0e4ff;border-radius:8px;margin:20px 0;padding:16px;">
    <tr>
      <td style="padding:8px 16px;">
        <p style="margin:0;font-size:13px;color:#666;">訂單編號</p>
        <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#1a0dab;">${orderNo}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 16px;border-top:1px solid #e0e4ff;">
        <p style="margin:0;font-size:13px;color:#666;">商品</p>
        <p style="margin:4px 0 0;font-size:15px;color:#333;">${itemName}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 16px;border-top:1px solid #e0e4ff;">
        <p style="margin:0;font-size:13px;color:#666;">金額</p>
        <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#333;">HKD ${priceHkd}</p>
      </td>
    </tr>
  </table>`;
}

function ctaButton(text: string, url: string): string {
  return `
  <div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:${BRAND_BLUE};color:#ffffff;font-size:15px;font-weight:bold;padding:12px 32px;border-radius:8px;text-decoration:none;">${text}</a>
  </div>`;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export interface OrderEmailData {
  orderNo: string;
  itemName: string;
  priceHkd: string;
  trackingNo?: string;
  note?: string;
  siteUrl?: string;
}

/** Order confirmed / payment received — to buyer */
export function buildOrderConfirmedEmail(data: OrderEmailData): { subject: string; html: string } {
  const siteUrl = data.siteUrl || "https://boxium.asia";
  const subject = `✅ 訂單確認 — ${data.orderNo}`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單已確認 ✅</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">感謝您的購買！您的付款已成功，賣家將盡快為您處理訂單。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單已出貨 📦</h2>
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單已完成 🎉</h2>
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單已完成 💰</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">買家已確認收貨，您的款項將按照平台規定時間轉帳。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border:1px solid #b2f5c8;border-radius:8px;margin:16px 0;padding:16px;">
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單已自動完成 ⏰</h2>
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單已自動完成 ⏰</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">由於買家在出貨後 <strong>14 天</strong>內未確認收貨，系統已自動完成此訂單。</p>
    ${orderInfoBlock(data.orderNo, data.itemName, data.priceHkd)}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border:1px solid #b2f5c8;border-radius:8px;margin:16px 0;padding:16px;">
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單退款通知 💸</h2>
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">訂單已取消 ❌</h2>
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">賣家申請已批准 ✅</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.displayName}</strong>，<br/>
      恭喜！你的 BOXIUM PTCG 賣家申請已獲批准，現在可以開始在平台上架商品了。
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border:1px solid #b2f5c8;border-radius:8px;margin:20px 0;">
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
    <h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">賣家申請未獲批准 ❌</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">
      親愛的 <strong>${data.displayName}</strong>，<br/>
      很遺憾，你的 BOXIUM PTCG 賣家申請目前未獲批准。
    </p>
    ${reasonBlock}
    <p style="color:#555;font-size:14px;">如你認為此決定有誤，或希望了解更多詳情，請聯絡我們的客服團隊，我們將盡快為你跟進。</p>
    <p style="color:#555;font-size:14px;">你仍然可以繼續使用 BOXIUM PTCG 平台進行購買。</p>
    ${ctaButton("聯絡客服", `mailto:support@boxium.asia`)}
  `);
  return { subject, html };
}

// ─── Main send function ───────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    if (!transporter) return false;

    const userRow = await getSystemSetting("smtp_user");
    const fromEmail = userRow?.settingValue || "noreply@boxium.asia";
    const fromName = "BOXIUM PTCG";

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log(`[EmailService] Sent "${subject}" to ${to}`);
    return true;
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
    return false;
  }
}

/**
 * Get order display data (item name + price) for email templates.
 * Falls back to orderNo if no items found.
 */
export async function getOrderEmailData(order: {
  id: number;
  orderNo: string;
  subtotalHkd: string | number | null;
  sellerReceivableHkd: string | number | null;
}): Promise<{ itemName: string; priceHkd: string; receivableHkd: string }> {
  try {
    const { getOrderItems } = await import("./db");
    const items = await getOrderItems(order.id);
    const itemName = items.length > 0
      ? items.map(i => i.title).join(", ")
      : order.orderNo;
    const priceHkd = order.subtotalHkd ? String(order.subtotalHkd) : "—";
    const receivableHkd = order.sellerReceivableHkd ? String(order.sellerReceivableHkd) : "—";
    return { itemName, priceHkd, receivableHkd };
  } catch {
    return { itemName: order.orderNo, priceHkd: "—", receivableHkd: "—" };
  }
}

/**
 * Convenience: send order email to a user by ID.
 * Silently skips if user has no email or SMTP is not configured.
 */
export async function sendOrderEmail({
  userId,
  subject,
  html,
}: {
  userId: number;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const { getUserById } = await import("./userManagement");
    const user = await getUserById(userId);
    if (!user?.email) return false;
    return sendEmail({ to: user.email, subject, html });
  } catch (err: any) {
    console.error(`[EmailService] sendOrderEmail error for userId=${userId}:`, err.message);
    return false;
  }
}
