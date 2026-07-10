/**
 * BOXIUM PTCG - Service Worker (Stale-Deployment-Safe Version)
 *
 * 設計原則：
 * 1. 絕對不攔截 /api/ 請求 — 讓所有 API 請求直接到達伺服器
 * 2. JS/CSS 靜態資源 → Network First（先去網路，失敗才用快取）
 *    → 這樣每次部署後，新 hash 的 chunk 一定能從網路取得，不會出現
 *      "Failed to fetch dynamically imported module" 錯誤
 * 3. CDN 圖片 → Cache First（7 天，最多 150 張）
 * 4. HTML 導航 → Network First，離線時降級到 /offline.html
 * 5. 每次 activate 清除所有舊版快取，確保部署後乾淨啟動
 */

const CACHE_VERSION = 'v3'; // ← 每次修改 sw.js 時遞增，強制清除舊快取
const SHELL_CACHE = `boxium-shell-${CACHE_VERSION}`;
const IMAGE_CACHE = `boxium-images-${CACHE_VERSION}`;

const MAX_IMAGE_ENTRIES = 150;
const IMAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting immediately so the new SW takes over without waiting for old tabs to close
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.add('/offline.html').catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: aggressively clean ALL old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== IMAGE_CACHE)
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ✅ CRITICAL: Never intercept API calls
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('trpc')
  ) {
    return;
  }

  // Skip non-http protocols
  if (!url.protocol.startsWith('http')) return;

  // ── CDN card images → Cache First (7 days, max 150 entries) ─────────────────
  const isCdnImage = (
    url.hostname.includes('cloudfront.net') ||
    url.hostname.includes('snkrdunk') ||
    url.hostname.includes('tcgplayer') ||
    url.hostname.includes('cardmarket') ||
    url.hostname.includes('pokellector')
  );

  if (isCdnImage) {
    event.respondWith(handleCdnImage(request));
    return;
  }

  // ── HTML navigation → Network First, offline fallback ────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() =>
          caches.match('/offline.html').then((r) => r || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // ── Same-origin JS/CSS/fonts → Network First (CRITICAL for Vite code-splitting)
  // We must NOT use Cache First for hashed JS chunks because:
  // - After a new deploy, new index.html references new chunk hashes
  // - Old chunks are gone from the server
  // - Cache First would serve a stale cached chunk that references missing deps
  // Network First ensures we always get the latest chunk; cache is only a fallback
  if (url.hostname === self.location.hostname) {
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname === '/' ||
      url.pathname === '/index.html'
    ) {
      return;
    }

    if (/\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|webp|svg|ico)(\?.*)?$/.test(url.pathname)) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Cache the fresh response for offline fallback
            if (response.ok && response.status === 200) {
              const clone = response.clone();
              caches.open(SHELL_CACHE)
                .then((cache) => cache.put(request, clone))
                .catch(() => {});
            }
            return response;
          })
          .catch(() =>
            // Network failed → try cache as last resort
            caches.match(request).then((cached) =>
              cached || new Response('', { status: 503 })
            )
          )
      );
    }
  }
});

// ─── CDN Image Handler ────────────────────────────────────────────────────────
async function handleCdnImage(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);

    if (cached) {
      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
      if (Date.now() - cachedAt < IMAGE_MAX_AGE_MS) {
        return cached;
      }
      await cache.delete(request);
    }

    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      try {
        const headers = new Headers(response.headers);
        headers.set('sw-cached-at', Date.now().toString());
        const body = await response.clone().arrayBuffer();
        const toStore = new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        await cache.put(request, toStore);

        const keys = await cache.keys();
        if (keys.length > MAX_IMAGE_ENTRIES) {
          await cache.delete(keys[0]);
        }
      } catch {
        // Cache write failed — not critical
      }
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
