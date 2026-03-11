/**
 * OG Image Composer
 * Composites a card image with the BOXIUM logo watermark in the top-left corner.
 * Uploads the result to S3 and caches the URL to avoid repeated composition.
 */
import sharp from "sharp";
import { storagePut } from "./storage";

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
 * Compose a card image with BOXIUM logo watermark, upload to S3, and return the public URL.
 * Results are cached in memory to avoid repeated composition.
 * @param cardId - The card database ID (used as cache key)
 * @param cardImageUrl - The URL of the card image
 * @returns S3 public URL of the composed image, or null if composition fails
 */
export async function composeAndCacheOgImage(cardId: number, cardImageUrl: string): Promise<string | null> {
  // Return cached URL if available
  const cached = ogImageCache.get(cardId);
  if (cached) return cached;

  try {
    const composed = await composeOgImage(cardImageUrl);
    if (!composed) return null;

    // Upload to S3 with a stable key based on cardId
    const s3Key = `og-images/card-${cardId}.png`;
    const { url } = await storagePut(s3Key, composed, "image/png");

    // Cache the S3 URL in memory
    ogImageCache.set(cardId, url);
    return url;
  } catch (err) {
    console.error(`[OG Composer] Failed to compose/upload image for card ${cardId}:`, err);
    return null;
  }
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
 * Get the default OG image URL (fallback)
 */
export function getDefaultOgImageUrl(): string {
  return DEFAULT_OG_IMAGE;
}
