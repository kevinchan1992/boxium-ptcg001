/**
 * BOXIUM PTCG - Cloudflare Workers OG Tag Injector
 *
 * 這個 Worker 在 Cloudflare 邊緣層攔截社交媒體爬蟲請求，
 * 動態注入卡牌專屬的 Open Graph meta tags，
 * 讓 WhatsApp / Facebook / Telegram 分享時顯示卡牌縮圖。
 *
 * 部署方式：見下方 README 或 cloudflare-workers/README.md
 */

const ORIGIN = "https://boxium.asia";
const API_BASE = "https://boxiumptcg-mua4eq38.manus.space"; // Express API 端點

// 社交媒體爬蟲 User-Agent 特徵
const CRAWLER_UA_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "whatsapp",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  "googlebot",
  "bingbot",
  "applebot",
  "pinterest",
  "vkshare",
  "w3c_validator",
  "embedly",
  "quora",
  "outbrain",
  "semrushbot",
  "ahrefsbot",
  "ia_archiver",
  "rogerbot",
  "msnbot",
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}

// 從 URL 路徑解析卡牌 ID
// 支援 /card/123 和 /marketplace/123
function parseCardId(pathname) {
  const cardMatch = pathname.match(/^\/card\/(\d+)/);
  if (cardMatch) return { id: cardMatch[1], type: "card" };
  const marketMatch = pathname.match(/^\/marketplace\/(\d+)/);
  if (marketMatch) return { id: marketMatch[1], type: "marketplace" };
  return null;
}

// 從 Express API 取得卡牌 OG meta 資料
async function fetchOgMeta(cardId) {
  try {
    const url = `${API_BASE}/api/og-meta/${cardId}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "CloudflareWorker/OGBot" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

// 將動態 OG tags 注入靜態 HTML
function injectOgTags(html, meta) {
  const { title, description, image, url } = meta;

  // 替換 og:title
  html = html.replace(
    /<meta property="og:title"[^>]*>/gi,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  // 替換 og:description
  html = html.replace(
    /<meta property="og:description"[^>]*>/gi,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  // 替換 og:image
  html = html.replace(
    /<meta property="og:image"[^>]*>/gi,
    `<meta property="og:image" content="${escapeHtml(image)}" />`
  );
  // 替換 og:url
  html = html.replace(
    /<meta property="og:url"[^>]*>/gi,
    `<meta property="og:url" content="${escapeHtml(url)}" />`
  );
  // 替換 twitter:title
  html = html.replace(
    /<meta name="twitter:title"[^>]*>/gi,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`
  );
  // 替換 twitter:description
  html = html.replace(
    /<meta name="twitter:description"[^>]*>/gi,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`
  );
  // 替換 twitter:image
  html = html.replace(
    /<meta name="twitter:image"[^>]*>/gi,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`
  );
  // 替換 twitter:url
  html = html.replace(
    /<meta name="twitter:url"[^>]*>/gi,
    `<meta name="twitter:url" content="${escapeHtml(url)}" />`
  );
  // 替換 <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  return html;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const userAgent = request.headers.get("User-Agent") || "";

    // 只處理爬蟲請求，且路徑為 /card/:id 或 /marketplace/:id
    const parsed = parseCardId(pathname);
    if (!parsed || !isCrawler(userAgent)) {
      // 非爬蟲或非卡牌頁面，直接透傳到 origin
      return fetch(request);
    }

    // 爬蟲 + 卡牌頁面：並行取得 HTML 和 OG meta 資料
    const [htmlResp, ogMeta] = await Promise.all([
      fetch(request), // 從 origin 取得靜態 HTML
      fetchOgMeta(parsed.id), // 從 Express API 取得卡牌資料
    ]);

    // 如果取不到 OG meta，直接回傳原始 HTML
    if (!ogMeta || !ogMeta.title) {
      return htmlResp;
    }

    // 讀取 HTML 並注入動態 OG tags
    const originalHtml = await htmlResp.text();
    const injectedHtml = injectOgTags(originalHtml, ogMeta);

    return new Response(injectedHtml, {
      status: htmlResp.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store", // 爬蟲回應不快取，確保每次都是最新資料
        "X-OG-Injected": "true", // 方便除錯確認
      },
    });
  },
};
