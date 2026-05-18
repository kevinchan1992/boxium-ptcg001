/**
 * BOXIUM PTCG - Service Worker (穩定版)
 *
 * 設計原則：
 * 1. 絕對不攔截 /api/ 請求 — 讓所有 API 請求直接到達伺服器，不增加任何快取層
 * 2. 只快取靜態資源（JS/CSS/HTML）和 CDN 圖片 — 純前端，不影響後端
 * 3. 圖片快取上限 150 張，超過自動清除最舊的，防止佔用過多裝置空間
 * 4. 所有快取操作都是 try/catch 包裹，失敗時靜默降級
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `boxium-shell-${CACHE_VERSION}`;
const IMAGE_CACHE = `boxium-images-${CACHE_VERSION}`;

const MAX_IMAGE_ENTRIES = 150;
const IMAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (reduced from 30)

// ─── Install: pre-cache only the offline fallback page ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.add('/offline.html').catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old cache versions ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== IMAGE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ✅ CRITICAL: Never intercept API calls — pass through directly
  // This ensures tRPC, auth, webhooks, etc. always reach the server
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/api/trpc') ||
    url.pathname.includes('trpc')
  ) {
    return; // Do not call event.respondWith — browser handles normally
  }

  // Skip non-http protocols (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // ── CDN card images → Cache First (7 days, max 150 entries) ────────────────
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

  // ── HTML navigation → Network First, offline fallback ──────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() =>
          caches.match('/offline.html').then((r) => r || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // ── Same-origin static assets (JS/CSS/fonts/images) → Cache First ──────────
  if (url.hostname === self.location.hostname) {
    // Skip dynamic paths — only cache truly static assets
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname === '/' ||
      url.pathname === '/index.html'
    ) {
      return;
    }

    // Only cache files with extensions (JS, CSS, fonts, images)
    if (/\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|webp|svg|ico)(\?.*)?$/.test(url.pathname)) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok && response.status === 200) {
              const clone = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
            }
            return response;
          });
        })
      );
    }
  }
});

// ─── CDN Image Handler ───────────────────────────────────────────────────────
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

        // Evict oldest if over limit
        const keys = await cache.keys();
        if (keys.length > MAX_IMAGE_ENTRIES) {
          await cache.delete(keys[0]);
        }
      } catch {
        // Cache write failed — not critical, just return the response
      }
    }
    return response;
  } catch {
    // Network failed and no cache — return empty 503
    return new Response('', { status: 503 });
  }
}

// ─── Message handler ─────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
