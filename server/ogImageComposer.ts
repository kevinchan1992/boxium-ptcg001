/**
 * OG Image Composer
 * Composites a card image with the BOXIUM logo watermark in the top-left corner.
 * Returns a PNG buffer suitable for serving as og:image.
 */
import sharp from "sharp";

const BOXIUM_LOGO_URL = "https://boxiumptcg.manus.space/boxium-logo.png";
const DEFAULT_OG_IMAGE = "https://boxiumptcg.manus.space/og-image.png";

// Target output dimensions for OG image (1200x630 is the recommended og:image size)
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Logo dimensions: resize logo to ~20% of card width, placed at top-left with padding
const LOGO_WIDTH = 200;
const LOGO_PADDING = 20;

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
 * Compose a card image with BOXIUM logo watermark.
 * @param cardImageUrl - The URL of the card image
 * @returns PNG buffer with logo watermark, or null if composition fails
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
    // For portrait cards (typical TCG cards), place card on left-center area
    const cardAspect = cardW / cardH;
    
    // Fit card into OG canvas while maintaining aspect ratio
    let fitW: number, fitH: number;
    if (cardAspect > OG_WIDTH / OG_HEIGHT) {
      // Wider than canvas ratio - fit by width
      fitW = OG_WIDTH;
      fitH = Math.round(OG_WIDTH / cardAspect);
    } else {
      // Taller than canvas ratio - fit by height
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
        {
          input: resizedCard,
          left: cardLeft,
          top: cardTop,
        },
        // BOXIUM logo at top-left corner with padding
        {
          input: resizedLogo,
          left: LOGO_PADDING,
          top: LOGO_PADDING,
        },
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
