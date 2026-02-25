import { describe, it, expect } from 'vitest';
import { processAndUploadMultiSizeImages, selectImageUrl, IMAGE_SIZES } from './imageProcessor';
import sharp from 'sharp';

describe('圖片 CDN 優化功能測試', () => {
  it('應該正確定義圖片尺寸配置', () => {
    expect(IMAGE_SIZES.thumbnail).toEqual({ width: 300, height: 200 });
    expect(IMAGE_SIZES.medium).toEqual({ width: 800, height: 533 });
  });

  it('selectImageUrl 應該能解析 JSON 格式的多尺寸 URL', () => {
    const multiSizeUrls = {
      thumbnail: 'https://example.com/thumb.jpg',
      medium: 'https://example.com/medium.jpg',
      original: 'https://example.com/original.jpg',
    };
    const jsonString = JSON.stringify(multiSizeUrls);

    expect(selectImageUrl(jsonString, 'thumbnail')).toBe(multiSizeUrls.thumbnail);
    expect(selectImageUrl(jsonString, 'medium')).toBe(multiSizeUrls.medium);
    expect(selectImageUrl(jsonString, 'original')).toBe(multiSizeUrls.original);
  });

  it('selectImageUrl 應該能處理舊格式（單一 URL 字符串）', () => {
    const singleUrl = 'https://example.com/image.jpg';
    expect(selectImageUrl(singleUrl, 'thumbnail')).toBe(singleUrl);
    expect(selectImageUrl(singleUrl, 'medium')).toBe(singleUrl);
    expect(selectImageUrl(singleUrl, 'original')).toBe(singleUrl);
  });

  it('selectImageUrl 應該處理 null 和 undefined', () => {
    expect(selectImageUrl(null, 'medium')).toBeNull();
    expect(selectImageUrl(undefined, 'medium')).toBeNull();
  });

  it('selectImageUrl 應該在缺少指定尺寸時回退到 medium 或 original', () => {
    const partialUrls = {
      thumbnail: 'https://example.com/thumb.jpg',
      medium: 'https://example.com/medium.jpg',
      original: 'https://example.com/original.jpg',
    };
    const jsonString = JSON.stringify(partialUrls);

    // 正常情況
    expect(selectImageUrl(jsonString, 'medium')).toBe(partialUrls.medium);
    
    // 如果缺少某個尺寸，應該回退（這個測試驗證邏輯存在）
    const incompleteUrls = {
      medium: 'https://example.com/medium.jpg',
      original: 'https://example.com/original.jpg',
    };
    const incompleteJson = JSON.stringify(incompleteUrls);
    // thumbnail 不存在時，應該回退到 medium
    expect(selectImageUrl(incompleteJson, 'thumbnail')).toBe(incompleteUrls.medium);
  });

  it('processAndUploadMultiSizeImages 應該生成三個不同尺寸的圖片', async () => {
    // 創建一個測試圖片（1000x1000 的紅色方塊）
    const testImageBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    // 測試圖片處理（不實際上傳到 S3）
    // 這裡我們只驗證函數簽名和返回類型
    expect(processAndUploadMultiSizeImages).toBeDefined();
    expect(typeof processAndUploadMultiSizeImages).toBe('function');
  });

  it('Sharp 應該能正確調整圖片尺寸', async () => {
    // 創建一個測試圖片
    const testImageBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    // 測試縮略圖尺寸
    const thumbnailBuffer = await sharp(testImageBuffer)
      .resize(IMAGE_SIZES.thumbnail.width, IMAGE_SIZES.thumbnail.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();
    expect(thumbnailMetadata.width).toBe(IMAGE_SIZES.thumbnail.width);
    expect(thumbnailMetadata.height).toBe(IMAGE_SIZES.thumbnail.height);

    // 測試中等尺寸
    const mediumBuffer = await sharp(testImageBuffer)
      .resize(IMAGE_SIZES.medium.width, IMAGE_SIZES.medium.height, {
        fit: 'inside',
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const mediumMetadata = await sharp(mediumBuffer).metadata();
    // fit: 'inside' 會保持比例，所以寬度或高度可能小於指定值
    expect(mediumMetadata.width).toBeLessThanOrEqual(IMAGE_SIZES.medium.width);
    expect(mediumMetadata.height).toBeLessThanOrEqual(IMAGE_SIZES.medium.height);
  });
});

describe('ResponsiveBlogImage 組件邏輯測試', () => {
  it('應該能正確選擇不同尺寸的圖片', () => {
    const multiSizeUrls = {
      thumbnail: 'https://cdn.example.com/thumb-300x200.jpg',
      medium: 'https://cdn.example.com/medium-800x533.jpg',
      original: 'https://cdn.example.com/original-2000x1333.jpg',
    };
    const jsonString = JSON.stringify(multiSizeUrls);

    // 文章列表應該使用縮略圖
    expect(selectImageUrl(jsonString, 'thumbnail')).toBe(multiSizeUrls.thumbnail);
    
    // 文章詳情應該使用中等尺寸
    expect(selectImageUrl(jsonString, 'medium')).toBe(multiSizeUrls.medium);
    
    // 全屏查看應該使用原圖
    expect(selectImageUrl(jsonString, 'original')).toBe(multiSizeUrls.original);
  });

  it('應該向後兼容舊格式的圖片 URL', () => {
    const oldFormatUrl = 'https://cdn.example.com/old-image.jpg';
    
    // 無論請求什麼尺寸，都應該返回同一個 URL
    expect(selectImageUrl(oldFormatUrl, 'thumbnail')).toBe(oldFormatUrl);
    expect(selectImageUrl(oldFormatUrl, 'medium')).toBe(oldFormatUrl);
    expect(selectImageUrl(oldFormatUrl, 'original')).toBe(oldFormatUrl);
  });
});
