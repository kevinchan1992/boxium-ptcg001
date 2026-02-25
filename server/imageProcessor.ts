import sharp from 'sharp';
import { storagePut } from './storage';

/**
 * 圖片尺寸配置
 */
export const IMAGE_SIZES = {
  thumbnail: { width: 300, height: 200 },
  medium: { width: 800, height: 533 },
  // original: 保持原始尺寸
} as const;

export type ImageSize = keyof typeof IMAGE_SIZES | 'original';

/**
 * 多尺寸圖片 URL 結構
 */
export interface MultiSizeImageUrls {
  thumbnail: string;
  medium: string;
  original: string;
}

/**
 * 生成隨機後綴（防止 URL 枚舉）
 */
function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * 處理並上傳多尺寸圖片
 * @param imageBuffer 原始圖片 Buffer
 * @param basePath S3 存儲路徑前綴（例如：'blog-images'）
 * @param filename 原始文件名
 * @returns 多尺寸圖片 URL 對象
 */
export async function processAndUploadMultiSizeImages(
  imageBuffer: Buffer,
  basePath: string,
  filename: string
): Promise<MultiSizeImageUrls> {
  const timestamp = Date.now();
  const randomStr = randomSuffix();
  const baseFilename = filename.replace(/\.[^/.]+$/, ''); // 移除副檔名
  
  // 獲取原始圖片格式
  const metadata = await sharp(imageBuffer).metadata();
  const format = metadata.format || 'jpeg';
  const ext = format === 'jpeg' ? 'jpg' : format;

  // 生成縮略圖（300x200）
  const thumbnailBuffer = await sharp(imageBuffer)
    .resize(IMAGE_SIZES.thumbnail.width, IMAGE_SIZES.thumbnail.height, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  const thumbnailKey = `${basePath}/${baseFilename}-thumb-${timestamp}-${randomStr}.jpg`;
  const { url: thumbnailUrl } = await storagePut(thumbnailKey, thumbnailBuffer, 'image/jpeg');

  // 生成中等尺寸（800x533）
  const mediumBuffer = await sharp(imageBuffer)
    .resize(IMAGE_SIZES.medium.width, IMAGE_SIZES.medium.height, {
      fit: 'inside', // 保持比例，不裁剪
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  const mediumKey = `${basePath}/${baseFilename}-medium-${timestamp}-${randomStr}.jpg`;
  const { url: mediumUrl } = await storagePut(mediumKey, mediumBuffer, 'image/jpeg');

  // 上傳原圖（優化但保持原始尺寸）
  const originalBuffer = await sharp(imageBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  const originalKey = `${basePath}/${baseFilename}-original-${timestamp}-${randomStr}.${ext}`;
  const { url: originalUrl } = await storagePut(originalKey, originalBuffer, `image/${format}`);

  return {
    thumbnail: thumbnailUrl,
    medium: mediumUrl,
    original: originalUrl,
  };
}

/**
 * 從多尺寸 URL 對象中選擇合適的尺寸
 * @param urls 多尺寸 URL 對象
 * @param size 需要的尺寸
 * @returns 對應尺寸的 URL
 */
export function selectImageUrl(urls: MultiSizeImageUrls | string | null | undefined, size: ImageSize = 'medium'): string | null {
  // 處理 null 和 undefined
  if (!urls) {
    return null;
  }

  // 如果是字符串，嘗試解析為 JSON
  if (typeof urls === 'string') {
    try {
      // 嘗試解析為 JSON（新格式：多尺寸對象）
      const parsedUrls: MultiSizeImageUrls = JSON.parse(urls);
      return parsedUrls[size] || parsedUrls.medium || parsedUrls.original;
    } catch {
      // 解析失敗，說明是舊格式（單一 URL 字符串）
      return urls;
    }
  }

  // 如果是對象（多尺寸對象），返回對應尺寸
  return urls[size] || urls.medium || urls.original;
}
