/**
 * 響應式博客圖片組件
 * 根據顯示位置自動選擇合適的圖片尺寸
 */

interface MultiSizeImageUrls {
  thumbnail: string;
  medium: string;
  original: string;
}

interface ResponsiveBlogImageProps {
  /** 圖片數據（可以是 JSON 字符串或單一 URL） */
  imageData: string | null | undefined;
  /** 顯示尺寸：thumbnail（文章列表）、medium（文章詳情）、original（全屏） */
  size?: 'thumbnail' | 'medium' | 'original';
  /** 替代文字 */
  alt: string;
  /** 自定義 className */
  className?: string;
}

/**
 * 解析圖片數據並選擇合適的 URL
 */
function selectImageUrl(
  imageData: string | null | undefined,
  size: 'thumbnail' | 'medium' | 'original' = 'medium'
): string | null {
  if (!imageData) return null;

  try {
    // 嘗試解析為 JSON（新格式：多尺寸對象）
    const urls: MultiSizeImageUrls = JSON.parse(imageData);
    return urls[size] || urls.medium || urls.original;
  } catch {
    // 解析失敗，說明是舊格式（單一 URL 字符串）
    return imageData;
  }
}

export function ResponsiveBlogImage({
  imageData,
  size = 'medium',
  alt,
  className = '',
}: ResponsiveBlogImageProps) {
  const imageUrl = selectImageUrl(imageData, size);

  if (!imageUrl) {
    return null;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
}
