/**
 * OG Image Composer
 * Composites a card image with the BOXIUM logo watermark in the top-left corner.
 * Uploads the result to S3 and caches the URL to avoid repeated composition.
 *
 * Performance strategy:
 * 1. Check in-memory cache first (fastest, cleared on restart)
 * 2. Check S3 by attempting storageGet (persists across restarts)
 * 3. If not in S3, compose and upload in background, return default URL immediately
 */
import sharp from "sharp";
import { storagePut, storageGet } from "./storage";

const BOXIUM_LOGO_URL = "https://boxiumptcg.manus.space/boxium-logo.png";
const DEFAULT_OG_IMAGE = "https://boxiumptcg.manus.space/og-image.png";

// Target output dimensions for OG image (1200x630 is the recommended og:image size)
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Logo dimensions: resize logo to ~20% of card width, placed at top-left with padding
const LOGO_WIDTH = 200;
const LOGO_PADDING = 20;

// In-memory cache: cardId -> S3 URL (cleared on server restart)
const ogImageCache = new Map<number, string>();

// Track in-progress generations to avoid duplicate work
const ogImageGenerating = new Set<number>();

/**
 * Fetch an image from a URL and return as Buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": "BOXIUM-OG-Composer/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Failed to fetch image: ${url} (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get the S3 key for a card's OG image
 */
function getOgImageS3Key(cardId: number): string {
  return `og-images/card-${cardId}.png`;
}

/**
 * Check if OG image already exists in S3 and return its URL.
 * Returns null if not found or on error.
 */
async function getExistingS3Url(cardId: number): Promise<string | null> {
  try {
    const s3Key = getOgImageS3Key(cardId);
    const { url } = await storageGet(s3Key);
    // Verify the URL is accessible (storageGet may return a URL even if file doesn't exist)
    const checkResponse = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    if (checkResponse.ok) {
      // Cache in memory for future requests
      ogImageCache.set(cardId, url);
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compose and upload OG image to S3 in the background.
 * Updates the in-memory cache when done.
 */
async function generateAndCacheInBackground(cardId: number, cardImageUrl: string): Promise<void> {
  if (ogImageGenerating.has(cardId)) return; // Already in progress
  ogImageGenerating.add(cardId);
  try {
    const composed = await composeOgImage(cardImageUrl);
    if (!composed) return;

    const s3Key = getOgImageS3Key(cardId);
    const { url } = await storagePut(s3Key, composed, "image/png");
    ogImageCache.set(cardId, url);
    console.log(`[OG Composer] Background generation complete for card ${cardId}: ${url}`);
  } catch (err) {
    console.error(`[OG Composer] Background generation failed for card ${cardId}:`, err);
  } finally {
    ogImageGenerating.delete(cardId);
  }
}

/**
 * Get OG image URL for a card.
 * - Returns cached URL immediately if available (in-memory or S3)
 * - If not cached, starts background generation and returns default URL
 * - This ensures /api/card-preview always responds within 1-2 seconds
 *
 * @param cardId - The card database ID (used as cache key)
 * @param cardImageUrl - The URL of the card image
 * @returns S3 URL if cached, default URL if generation is in progress
 */
export async function composeAndCacheOgImage(cardId: number, cardImageUrl: string): Promise<string | null> {
  // 1. Check in-memory cache (fastest)
  const cached = ogImageCache.get(cardId);
  if (cached) return cached;

  // 2. Check S3 (persists across server restarts) - with short timeout
  const s3Url = await Promise.race([
    getExistingS3Url(cardId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
  if (s3Url) return s3Url;

  // 3. Not in cache - start background generation, return default URL immediately
  // This prevents request timeout in production
  generateAndCacheInBackground(cardId, cardImageUrl).catch(() => {});
  return null; // Caller will use default OG image
}

/**
 * Compose a card image with BOXIUM logo watermark.
 * Returns raw PNG buffer (used by /api/og-image/:cardId for direct serving).
 */
export async function composeOgImage(cardImageUrl: string): Promise<Buffer | null> {
  try {
    // Fetch both images in parallel
    const [cardBuffer, logoBuffer] = await Promise.all([
      fetchImageBuffer(cardImageUrl),
      fetchImageBuffer(BOXIUM_LOGO_URL),
    ]);

    // Get card image metadata to determine aspect ratio
    const cardMeta = await sharp(cardBuffer).metadata();
    const cardW = cardMeta.width || 400;
    const cardH = cardMeta.height || 560;

    // Calculate canvas layout: card centered, with dark background
    const cardAspect = cardW / cardH;

    // Fit card into OG canvas while maintaining aspect ratio
    let fitW: number, fitH: number;
    if (cardAspect > OG_WIDTH / OG_HEIGHT) {
      fitW = OG_WIDTH;
      fitH = Math.round(OG_WIDTH / cardAspect);
    } else {
      fitH = OG_HEIGHT;
      fitW = Math.round(OG_HEIGHT * cardAspect);
    }

    // Resize card to fit canvas
    const resizedCard = await sharp(cardBuffer)
      .resize(fitW, fitH, { fit: "inside", withoutEnlargement: false })
      .toBuffer();

    // Center the card on the canvas
    const cardLeft = Math.round((OG_WIDTH - fitW) / 2);
    const cardTop = Math.round((OG_HEIGHT - fitH) / 2);

    // Resize logo: width = LOGO_WIDTH, maintain aspect ratio
    const logoMeta = await sharp(logoBuffer).metadata();
    const logoAspect = (logoMeta.width || 2048) / (logoMeta.height || 1228);
    const logoH = Math.round(LOGO_WIDTH / logoAspect);

    const resizedLogo = await sharp(logoBuffer)
      .resize(LOGO_WIDTH, logoH, { fit: "fill" })
      .toBuffer();

    // Compose: dark background + card + logo watermark
    const composed = await sharp({
      create: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        channels: 3,
        background: { r: 10, g: 10, b: 30 }, // dark navy background
      },
    })
      .composite([
        // Card image centered
        { input: resizedCard, left: cardLeft, top: cardTop },
        // BOXIUM logo at top-left corner with padding
        { input: resizedLogo, left: LOGO_PADDING, top: LOGO_PADDING },
      ])
      .png({ quality: 90 })
      .toBuffer();

    return composed;
  } catch (err) {
    console.error("[OG Composer] Failed to compose image:", err);
    return null;
  }
}

/**
 * Ensure an OG image exists in S3 for a card.
 * - If already in S3 (or in-memory cache), does nothing (idempotent)
 * - If not yet generated, triggers background generation
 * - Safe to call on every card update; generation only happens once per card
 *
 * @param cardId - The card database ID
 * @param cardImageUrl - The URL of the card image (used for composition)
 */
export async function ensureOgImageExists(cardId: number, cardImageUrl: string | null | undefined): Promise<void> {
  if (!cardImageUrl) return; // No image to compose from

  // If already in memory cache, nothing to do
  if (ogImageCache.has(cardId)) return;

  // If already generating, nothing to do
  if (ogImageGenerating.has(cardId)) return;

  // Check S3 quickly (3 second timeout)
  const s3Url = await Promise.race([
    getExistingS3Url(cardId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);

  if (s3Url) {
    // Already in S3, cache it and done
    ogImageCache.set(cardId, s3Url);
    return;
  }

  // Not in S3 yet — generate in background (fire and forget)
  generateAndCacheInBackground(cardId, cardImageUrl).catch(() => {});
}

/**
 * Get the default OG image URL (fallback)
 */
export function getDefaultOgImageUrl(): string {
  return DEFAULT_OG_IMAGE;
}

// In-memory cache for marketplace listing OG images
const marketplaceOgImageCache = new Map<number, string>();
const marketplaceOgImageGenerating = new Set<number>();

/**
 * Get the S3 key for a marketplace listing's OG image
 */
function getMarketplaceOgImageS3Key(listingId: number): string {
  return `og-images/marketplace-${listingId}.png`;
}

/**
 * Check if marketplace OG image already exists in S3.
 * Returns null if not found or on error.
 */
async function getExistingMarketplaceS3Url(listingId: number): Promise<string | null> {
  try {
    const s3Key = getMarketplaceOgImageS3Key(listingId);
    const { url } = await storageGet(s3Key);
    const checkResponse = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    if (checkResponse.ok) {
      marketplaceOgImageCache.set(listingId, url);
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compose a marketplace listing OG image:
 * - Dark navy background (1200x630)
 * - Product image on the left (60% width)
 * - Right panel: BOXIUM logo + title + price badge (yellow) + condition badge
 * - Bottom bar with brand tagline
 */
export async function composeMarketplaceOgImage(
  imageUrl: string,
  title: string,
  priceHkd: number,
  condition: string
): Promise<Buffer | null> {
  try {
    const [productBuffer, logoBuffer] = await Promise.all([
      fetchImageBuffer(imageUrl),
      fetchImageBuffer(BOXIUM_LOGO_URL),
    ]);

    // --- Product image: fill left 60% of canvas ---
    const productAreaW = Math.round(OG_WIDTH * 0.60);
    const productAreaH = OG_HEIGHT;
    const resizedProduct = await sharp(productBuffer)
      .resize(productAreaW, productAreaH, { fit: "cover", position: "centre" })
      .toBuffer();

    // --- Logo: top-right area ---
    const logoMeta = await sharp(logoBuffer).metadata();
    const logoAspect = (logoMeta.width || 2048) / (logoMeta.height || 1228);
    const logoW = 180;
    const logoH = Math.round(logoW / logoAspect);
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoW, logoH, { fit: "fill" })
      .toBuffer();

    // --- Right panel text via SVG overlay ---
    const rightX = productAreaW + 20; // right panel starts here
    const rightW = OG_WIDTH - productAreaW - 20;
    const logoLeft = productAreaW + Math.round((OG_WIDTH - productAreaW - logoW) / 2);
    const logoTop = 30;

    // Truncate title for display
    const displayTitle = title.length > 50 ? title.slice(0, 48) + "…" : title;
    // Split title into two lines if needed
    const titleLine1 = displayTitle.slice(0, 24);
    const titleLine2 = displayTitle.length > 24 ? displayTitle.slice(24) : "";

    // Condition label translation
    const conditionMap: Record<string, string> = {
      mint: "Mint",
      near_mint: "Near Mint",
      excellent: "Excellent",
      good: "Good",
      played: "Played",
      poor: "Poor",
    };
    const conditionLabel = conditionMap[condition] || condition;

    // Price formatted
    const priceStr = `HKD ${priceHkd.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    // SVG for right-panel text elements
    const svgOverlay = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Vertical divider line -->
  <line x1="${productAreaW}" y1="0" x2="${productAreaW}" y2="${OG_HEIGHT}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  <!-- Title text -->
  <text x="${rightX + Math.round(rightW / 2)}" y="${logoTop + logoH + 40}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${titleLine1.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>
  ${titleLine2 ? `<text x="${rightX + Math.round(rightW / 2)}" y="${logoTop + logoH + 70}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${titleLine2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>` : ""}
  <!-- Price badge background (yellow) -->
  <rect x="${rightX + 20}" y="${OG_HEIGHT / 2 - 10}" width="${rightW - 40}" height="64" rx="10" fill="#FEDD00"/>
  <!-- Price text -->
  <text x="${rightX + Math.round(rightW / 2)}" y="${OG_HEIGHT / 2 + 30}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#06038D" text-anchor="middle" dominant-baseline="middle">${priceStr.replace(/&/g, "&amp;")}</text>
  <!-- Condition badge background -->
  <rect x="${rightX + Math.round(rightW / 2) - 60}" y="${OG_HEIGHT / 2 + 70}" width="120" height="34" rx="8" fill="rgba(255,255,255,0.15)"/>
  <!-- Condition text -->
  <text x="${rightX + Math.round(rightW / 2)}" y="${OG_HEIGHT / 2 + 87}" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${conditionLabel.replace(/&/g, "&amp;")}</text>
  <!-- Bottom brand bar -->
  <rect x="0" y="${OG_HEIGHT - 44}" width="${OG_WIDTH}" height="44" fill="#06038D"/>
  <text x="${OG_WIDTH / 2}" y="${OG_HEIGHT - 16}" font-family="Arial, sans-serif" font-size="15" fill="white" text-anchor="middle" dominant-baseline="middle">BOXIUM PTCG • boxium.asia</text>
</svg>`;

    const svgBuffer = Buffer.from(svgOverlay);

    // Compose: dark background + product image (left) + logo (right-top) + SVG overlay
    const composed = await sharp({
      create: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        channels: 3,
        background: { r: 10, g: 10, b: 30 }, // dark navy
      },
    })
      .composite([
        { input: resizedProduct, left: 0, top: 0 },
        { input: resizedLogo, left: logoLeft, top: logoTop },
        { input: svgBuffer, left: 0, top: 0 },
      ])
      .png({ quality: 90 })
      .toBuffer();

    return composed;
  } catch (err) {
    console.error("[OG Composer] Failed to compose marketplace image:", err);
    return null;
  }
}

/**
 * Get OG image URL for a marketplace listing.
 * - Returns cached URL immediately if available
 * - If not cached, starts background generation and returns null (caller uses card image)
 */
export async function composeAndCacheMarketplaceOgImage(
  listingId: number,
  imageUrl: string,
  title: string,
  priceHkd: number,
  condition: string
): Promise<string | null> {
  // 1. Check in-memory cache
  const cached = marketplaceOgImageCache.get(listingId);
  if (cached) return cached;

  // 2. Check S3 (with 3s timeout)
  const s3Url = await Promise.race([
    getExistingMarketplaceS3Url(listingId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
  if (s3Url) return s3Url;

  // 3. Not cached — generate in background
  if (!marketplaceOgImageGenerating.has(listingId)) {
    marketplaceOgImageGenerating.add(listingId);
    (async () => {
      try {
        const composed = await composeMarketplaceOgImage(imageUrl, title, priceHkd, condition);
        if (!composed) return;
        const s3Key = getMarketplaceOgImageS3Key(listingId);
        const { url } = await storagePut(s3Key, composed, "image/png");
        marketplaceOgImageCache.set(listingId, url);
        console.log(`[OG Composer] Marketplace background generation complete for listing ${listingId}: ${url}`);
      } catch (err) {
        console.error(`[OG Composer] Marketplace background generation failed for listing ${listingId}:`, err);
      } finally {
        marketplaceOgImageGenerating.delete(listingId);
      }
    })().catch(() => {});
  }

  return null; // Caller will use fallback image
}
