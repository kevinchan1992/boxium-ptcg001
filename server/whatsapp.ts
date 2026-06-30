/**
 * WhatsApp Notification Service (Green API)
 * Sends WhatsApp messages via Green API: https://green-api.com
 *
 * Environment variables required:
 *   GREEN_API_INSTANCE_ID — instance ID (e.g. 710701668492)
 *   GREEN_API_TOKEN       — API token
 */

const BASE_URL = "https://api.green-api.com";

/**
 * Normalise a phone number to Green API chatId format.
 * Input examples: "+85291234567", "85291234567", "+852 9123 4567"
 * Output: "85291234567@c.us"
 */
export function toChatId(phone: string): string {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");
  return `${digits}@c.us`;
}

/**
 * Send a WhatsApp text message via Green API.
 * Returns true on success, false on failure (non-throwing — caller decides how to handle).
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<boolean> {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;

  if (!instanceId || !token) {
    console.warn("[WhatsApp] GREEN_API_INSTANCE_ID or GREEN_API_TOKEN not configured — skipping");
    return false;
  }

  const chatId = toChatId(phone);
  const url = `${BASE_URL}/waInstance${instanceId}/sendMessage/${token}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(no body)");
      console.error(`[WhatsApp] Failed to send message to ${chatId}: HTTP ${response.status} — ${body}`);
      return false;
    }

    const data = await response.json().catch(() => ({}));
    console.log(`[WhatsApp] Message sent to ${chatId}, idMessage: ${data?.idMessage ?? "unknown"}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] Error sending message to ${chatId}:`, err);
    return false;
  }
}

// ---- Pre-built message templates ----

/** Verification message with clickable link */
export function buildVerificationMessage(verifyUrl: string): string {
  return (
    `🔐 *BOXIUM PTCG 電話驗證*\n\n` +
    `請點擊以下連結完成 WhatsApp 電話驗證：\n` +
    `${verifyUrl}\n\n` +
    `此連結將在 30 分鐘後失效。\n` +
    `如非您本人操作，請忽略此訊息。`
  );
}

/** Outbid notification */
export function buildOutbidMessage(params: {
  cardName: string;
  yourBidHkd: string;
  newHighestBidHkd: string;
  auctionEndAt: string;
  listingId: number;
}): string {
  return (
    `📢 *您已被超標！*\n\n` +
    `拍賣品：${params.cardName}\n` +
    `您的出價：HK$${params.yourBidHkd}\n` +
    `最新最高出價：HK$${params.newHighestBidHkd}\n` +
    `結標時間：${params.auctionEndAt}\n\n` +
    `立即加價：https://boxium.asia/auction/${params.listingId}`
  );
}

/** 15-minute reminder */
export function buildEndingSoonMessage(params: {
  cardName: string;
  currentHighestBidHkd: string;
  isLeading: boolean;
  listingId: number;
}): string {
  const status = params.isLeading
    ? `✅ 您目前是最高出價者（HK$${params.currentHighestBidHkd}）`
    : `⚠️ 您目前已被超越，最高出價：HK$${params.currentHighestBidHkd}`;
  return (
    `⏰ *拍賣即將結束（15 分鐘）*\n\n` +
    `拍賣品：${params.cardName}\n` +
    `${status}\n\n` +
    `立即查看：https://boxium.asia/auction/${params.listingId}`
  );
}

/** Auction won — with payment link */
export function buildAuctionWonMessage(params: {
  cardName: string;
  winAmountHkd: string;
  orderNo: string;
  paymentUrl: string;
  paymentDeadline: string;
}): string {
  return (
    `🎉 *恭喜！您贏得了拍賣*\n\n` +
    `拍賣品：${params.cardName}\n` +
    `得標金額：HK$${params.winAmountHkd}\n` +
    `訂單號：${params.orderNo}\n\n` +
    `請在 *${params.paymentDeadline}* 前完成付款：\n` +
    `${params.paymentUrl}\n\n` +
    `逾期未付款將取消得標資格。`
  );
}

/** Auction lost notification */
export function buildAuctionLostMessage(params: {
  cardName: string;
  winAmountHkd: string;
  listingId: number;
}): string {
  return (
    `😔 *拍賣已結束*\n\n` +
    `拍賣品：${params.cardName}\n` +
    `最終成交價：HK$${params.winAmountHkd}\n\n` +
    `感謝您參與 BOXIUM PTCG 拍賣！\n` +
    `查看更多拍賣：https://boxium.asia/auction`
  );
}
