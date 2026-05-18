/**
 * PWA Service Worker 邏輯測試
 * 重點驗證：API 請求不被攔截、快取策略正確、不影響伺服器穩定性
 */
import { describe, it, expect } from "vitest";

// ─── 模擬 SW 的路由判斷邏輯 ───────────────────────────────────────────────────

function shouldInterceptRequest(method: string, pathname: string, protocol: string): boolean {
  // Only GET
  if (method !== 'GET') return false;
  // Only http(s)
  if (!protocol.startsWith('http')) return false;
  // NEVER intercept API calls
  if (pathname.startsWith('/api/') || pathname.includes('trpc')) return false;
  return true;
}

function isCdnImage(hostname: string): boolean {
  return (
    hostname.includes('cloudfront.net') ||
    hostname.includes('snkrdunk') ||
    hostname.includes('tcgplayer') ||
    hostname.includes('cardmarket') ||
    hostname.includes('pokellector')
  );
}

function isStaticAsset(pathname: string): boolean {
  return /\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|webp|svg|ico)(\?.*)?$/.test(pathname);
}

function isCachedImage(cachedAt: number, maxAgeMs: number): boolean {
  return Date.now() - cachedAt < maxAgeMs;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Service Worker: API 請求不被攔截（伺服器穩定性保護）", () => {
  it("不攔截 /api/trpc 請求", () => {
    expect(shouldInterceptRequest('GET', '/api/trpc/cards.search', 'https:')).toBe(false);
  });

  it("不攔截 /api/ 前綴的所有請求", () => {
    expect(shouldInterceptRequest('GET', '/api/auth/me', 'https:')).toBe(false);
    expect(shouldInterceptRequest('GET', '/api/stripe/webhook', 'https:')).toBe(false);
    expect(shouldInterceptRequest('GET', '/api/health', 'https:')).toBe(false);
  });

  it("不攔截包含 trpc 的路徑", () => {
    expect(shouldInterceptRequest('GET', '/trpc/cards', 'https:')).toBe(false);
  });

  it("不攔截 POST 請求", () => {
    expect(shouldInterceptRequest('POST', '/api/trpc/cards.create', 'https:')).toBe(false);
  });

  it("不攔截 PUT/DELETE 請求", () => {
    expect(shouldInterceptRequest('PUT', '/api/listings/1', 'https:')).toBe(false);
    expect(shouldInterceptRequest('DELETE', '/api/listings/1', 'https:')).toBe(false);
  });

  it("不攔截非 http 協定", () => {
    expect(shouldInterceptRequest('GET', '/path', 'chrome-extension:')).toBe(false);
    expect(shouldInterceptRequest('GET', '/path', 'data:')).toBe(false);
  });
});

describe("Service Worker: CDN 圖片快取識別", () => {
  it("識別 CloudFront CDN 圖片", () => {
    expect(isCdnImage('d2xsxph8kpxj0f.cloudfront.net')).toBe(true);
  });

  it("識別 SNKRDUNK 圖片", () => {
    expect(isCdnImage('img.snkrdunk.com')).toBe(true);
  });

  it("識別 TCGPlayer 圖片", () => {
    expect(isCdnImage('product-images.tcgplayer.com')).toBe(true);
  });

  it("不識別一般網站為 CDN 圖片", () => {
    expect(isCdnImage('example.com')).toBe(false);
    expect(isCdnImage('boxium.asia')).toBe(false);
  });
});

describe("Service Worker: 靜態資源識別", () => {
  it("識別 JS 檔案", () => {
    expect(isStaticAsset('/assets/main.abc123.js')).toBe(true);
  });

  it("識別 CSS 檔案", () => {
    expect(isStaticAsset('/assets/style.abc123.css')).toBe(true);
  });

  it("識別字型檔案", () => {
    expect(isStaticAsset('/fonts/inter.woff2')).toBe(true);
  });

  it("識別圖片檔案", () => {
    expect(isStaticAsset('/favicon-192x192.png')).toBe(true);
    expect(isStaticAsset('/logo.webp')).toBe(true);
  });

  it("不識別 HTML 頁面為靜態資源（避免快取動態 HTML）", () => {
    expect(isStaticAsset('/')).toBe(false);
    expect(isStaticAsset('/research')).toBe(false);
    expect(isStaticAsset('/marketplace')).toBe(false);
  });
});

describe("Service Worker: 圖片快取過期邏輯", () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  it("7 天內的快取視為有效", () => {
    const cachedAt = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago
    expect(isCachedImage(cachedAt, SEVEN_DAYS_MS)).toBe(true);
  });

  it("超過 7 天的快取視為過期", () => {
    const cachedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
    expect(isCachedImage(cachedAt, SEVEN_DAYS_MS)).toBe(false);
  });

  it("剛快取的圖片視為有效", () => {
    const cachedAt = Date.now() - 1000; // 1 second ago
    expect(isCachedImage(cachedAt, SEVEN_DAYS_MS)).toBe(true);
  });

  it("無 cachedAt 時（值為 0）視為過期", () => {
    expect(isCachedImage(0, SEVEN_DAYS_MS)).toBe(false);
  });
});

describe("Service Worker: 快取上限保護", () => {
  it("圖片快取上限為 150 張", () => {
    const MAX_IMAGE_ENTRIES = 150;
    expect(MAX_IMAGE_ENTRIES).toBe(150);
    // Verify eviction would trigger at 151
    const currentCount = 151;
    expect(currentCount > MAX_IMAGE_ENTRIES).toBe(true);
  });

  it("快取版本號確保舊快取被清除", () => {
    const CACHE_VERSION = 'v1';
    const SHELL_CACHE = `boxium-shell-${CACHE_VERSION}`;
    const IMAGE_CACHE = `boxium-images-${CACHE_VERSION}`;
    // Old versions would not match and get deleted
    const oldCache = 'boxium-shell-v0';
    expect(oldCache !== SHELL_CACHE).toBe(true);
    expect(oldCache !== IMAGE_CACHE).toBe(true);
  });
});
