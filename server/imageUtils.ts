/**
 * Image processing utilities for eBay image search
 */

import axios from "axios";

/**
 * Download an image from a URL and convert it to Base64 format
 * @param imageUrl - The URL of the image to download
 * @returns Base64 encoded string of the image
 */
export async function downloadAndEncodeImage(imageUrl: string): Promise<string> {
  try {
    console.log(`[Image] Downloading image from: ${imageUrl}`);
    
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000, // 15 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // Convert array buffer to Base64
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    
    console.log(`[Image] Successfully encoded image, size: ${base64.length} characters`);
    return base64;
  } catch (error: any) {
    console.error(`[Image] Error downloading/encoding image: ${error.message}`);
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

/**
 * Validate if a URL is a valid image URL
 * @param url - The URL to validate
 * @returns true if the URL appears to be a valid image URL
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check if URL ends with common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Get the best image URL from a card object
 * Prioritizes high-resolution images over standard ones
 * @param card - Card object with imageUrl and/or imageUrlHiRes
 * @returns The best available image URL, or null if none available
 */
export function getBestImageUrl(card: { imageUrl?: string | null; imageUrlHiRes?: string | null }): string | null {
  // Prioritize high-resolution image
  if (card.imageUrlHiRes && isValidImageUrl(card.imageUrlHiRes)) {
    return card.imageUrlHiRes;
  }
  
  // Fallback to standard image
  if (card.imageUrl && isValidImageUrl(card.imageUrl)) {
    return card.imageUrl;
  }
  
  return null;
}
