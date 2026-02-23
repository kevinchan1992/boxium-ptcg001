# Playwright 部署說明

## 問題描述

生產環境（boxium.asia）的 Pricing 頁面無法顯示 SNKRDUNK 的 PSA 10 在售商品，持續顯示「暫無在售商品」。

## 根本原因

**Playwright 瀏覽器二進制文件未安裝**

錯誤信息：
```
Executable doesn't exist at /home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
```

開發環境能正常工作是因為開發沙盒已經安裝了 Playwright 瀏覽器，但生產環境沒有。

## 解決方案

### 步驟 1：部署新版本代碼

首先，將最新的代碼部署到生產環境（包含快取修復和診斷工具）。

### 步驟 2：安裝 Playwright 瀏覽器

在生產環境服務器上執行以下命令：

```bash
cd /path/to/boxium-ptcg
pnpm exec playwright install chromium
```

**預期輸出：**
```
Downloading Chrome for Testing 145.0.7632.6 (playwright chromium v1208)...
Chrome for Testing 145.0.7632.6 downloaded to /home/ubuntu/.cache/ms-playwright/chromium-1208
Downloading FFmpeg (playwright ffmpeg v1011)...
FFmpeg downloaded to /home/ubuntu/.cache/ms-playwright/ffmpeg-1011
Downloading Chrome Headless Shell 145.0.7632.6...
Chrome Headless Shell downloaded to /home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1208
```

**安裝時間：** 約 2-3 分鐘（取決於網絡速度）
**所需磁盤空間：** 約 280 MB

### 步驟 3：重啟服務器

安裝完成後，重啟 Node.js 服務器以確保所有更改生效。

### 步驟 4：測試驗證

1. **訪問 Pricing 頁面**
   - 打開 https://boxium.asia/pricing
   - 搜索任意卡牌（例如：Pikachu）
   - 點擊卡牌進入詳情頁面

2. **預期結果**
   - 應該能看到 PSA 10 在售商品列表
   - 顯示價格、圖片、鏈接等信息
   - 不再顯示「暫無在售商品」

3. **檢查日誌**
   - 查看服務器日誌，應該能看到類似以下的成功日誌：
   ```
   [SNKRDUNK Playwright] Starting comprehensive scrape for SNKRDUNK ID: 737036
   [SNKRDUNK Playwright] Extraction complete in 16.72s: 18 total listings, 17 PSA 10 on-sale listings
   [Pricing Router] Saved 17 SNKRDUNK listings to cache
   ```

## 測試結果（開發環境）

在開發環境安裝 Playwright 瀏覽器後，所有測試都通過：

- ✅ **Browser launched successfully** - Playwright 瀏覽器啟動成功
- ✅ **Page navigation successful** - 成功訪問 SNKRDUNK 網站
- ✅ **SNKRDUNK scraping successful** - 成功爬取 17 個 PSA 10 在售商品

示例輸出：
```
Found 17 listings
Sample listing: {
  price: 16637.40,
  grade: 'PSA 10',
  url: 'https://snkrdunk.com/en/trading-cards/used/listings/...',
  currency: 'HKD',
  isPsa10: true,
  status: 'on-sale'
}
```

## 診斷工具

如果部署後仍然有問題，可以使用內建的診斷 API（僅限 Admin 用戶）：

### 1. 測試 Playwright 瀏覽器

```typescript
// 在瀏覽器控制台執行
const result = await trpc.diagnostics.testPlaywright.query();
console.log(result);
```

預期輸出：
```json
{
  "success": true,
  "browserLaunched": true,
  "pageLoaded": true,
  "snkrdunkAccessible": true,
  "duration": 10000,
  "logs": [
    "[...] ✅ Browser launched successfully",
    "[...] ✅ Page created successfully",
    "[...] ✅ SNKRDUNK website accessible"
  ]
}
```

### 2. 測試 SNKRDUNK 爬取

```typescript
// 在瀏覽器控制台執行
const result = await trpc.diagnostics.testSnkrdunkScraping.query({ snkrdunkId: '737036' });
console.log(result);
```

預期輸出：
```json
{
  "success": true,
  "listings": [...],
  "duration": 18000,
  "logs": [
    "[...] ✅ Scraping successful: 17 listings found"
  ]
}
```

## 注意事項

1. **磁盤空間**
   - 確保生產環境有足夠的磁盤空間（至少 500 MB）
   - Playwright 瀏覽器文件較大（約 280 MB）

2. **網絡訪問**
   - 確保生產環境能訪問 `cdn.playwright.dev`（下載瀏覽器）
   - 確保生產環境能訪問 `snkrdunk.com`（爬取數據）

3. **系統依賴**
   - Playwright 需要一些系統庫（libnss3, libatk-bridge2.0-0 等）
   - 如果遇到依賴問題，執行：
     ```bash
     pnpm exec playwright install-deps chromium
     ```

4. **權限問題**
   - 確保應用程序有權限寫入 `/home/ubuntu/.cache/ms-playwright/`
   - 如果遇到權限問題，檢查文件夾權限

## 常見問題

### Q: 安裝後仍然顯示「暫無在售商品」？

A: 可能是快取問題。解決方法：
1. 進入 Admin 後台
2. 點擊「緩存管理」標籤頁
3. 找到問題卡牌並點擊「清除」按鈕
4. 重新訪問該卡牌的 Pricing 頁面

### Q: 瀏覽器啟動失敗？

A: 檢查系統依賴是否完整：
```bash
pnpm exec playwright install-deps chromium
```

### Q: 爬取超時？

A: 可能是網絡問題或 SNKRDUNK 網站響應慢。檢查：
1. 生產環境是否能訪問 SNKRDUNK
2. 網絡速度是否正常
3. 查看服務器日誌中的詳細錯誤信息

## 相關文件

- **診斷 API**: `server/routers/diagnostics.ts`
- **診斷測試**: `server/diagnostics.test.ts`
- **Playwright Pool**: `server/services/playwrightPool.ts`
- **SNKRDUNK 爬取**: `server/services/snkrdunkPlaywright.ts`
- **Pricing Router**: `server/routers/pricing.ts`

## 聯繫支持

如果按照上述步驟操作後仍然有問題，請提供以下信息：

1. 服務器日誌（最近 100 行）
2. 診斷 API 的輸出結果
3. 瀏覽器控制台的錯誤信息
4. 系統信息（OS、Node.js 版本、可用磁盤空間）
