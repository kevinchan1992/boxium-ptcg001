# Google Search Console 設定指南

本指南將幫助您設定 Google Search Console，加速 Google 索引您的網站並顯示 BOXIUM LOGO。

---

## 步驟 1：驗證網站所有權

1. **前往 Google Search Console**
   - 訪問：https://search.google.com/search-console
   - 使用您的 Google 帳號登入

2. **添加資源（Property）**
   - 點擊左上角的「新增資源」
   - 選擇「網域」或「網址前置字元」
   - 輸入：`https://boxium.asia`

3. **驗證所有權（選擇其中一種方法）**

   **方法 A：HTML 檔案上傳（推薦）**
   - Google 會提供一個驗證檔案（例如 `google1234567890abcdef.html`）
   - 下載該檔案
   - 將檔案上傳到 `client/public/` 目錄
   - 重新部署網站
   - 在 Google Search Console 點擊「驗證」

   **方法 B：HTML 標籤**
   - Google 會提供一個 meta 標籤（例如 `<meta name="google-site-verification" content="..." />`）
   - 將該標籤添加到 `client/index.html` 的 `<head>` 區域
   - 重新部署網站
   - 在 Google Search Console 點擊「驗證」

   **方法 C：DNS 記錄（需要域名管理權限）**
   - Google 會提供一個 TXT 記錄
   - 在您的域名 DNS 設定中添加該 TXT 記錄
   - 等待 DNS 傳播（可能需要幾小時）
   - 在 Google Search Console 點擊「驗證」

---

## 步驟 2：提交 Sitemap

1. **在 Google Search Console 左側選單中選擇「Sitemap」**

2. **輸入 Sitemap URL**
   ```
   https://boxium.asia/sitemap.xml
   ```

3. **點擊「提交」**

4. **等待 Google 處理**
   - Google 會開始爬取您的 sitemap
   - 通常需要幾小時到幾天

---

## 步驟 3：請求重新索引首頁

1. **在 Google Search Console 頂部搜尋框中輸入**
   ```
   https://boxium.asia/
   ```

2. **點擊「要求建立索引」**

3. **等待 Google 處理**
   - Google 會優先爬取您的首頁
   - 通常需要幾小時到幾天

---

## 步驟 4：檢查 Favicon 顯示

1. **使用 Google Rich Results Test**
   - 訪問：https://search.google.com/test/rich-results
   - 輸入：`https://boxium.asia`
   - 檢查是否顯示 BOXIUM LOGO

2. **清除瀏覽器快取**
   - 按 `Ctrl+Shift+Delete`（Windows）或 `Cmd+Shift+Delete`（Mac）
   - 選擇「圖片和檔案」
   - 清除快取
   - 重新訪問 `https://boxium.asia`

3. **等待 Google 更新搜尋結果**
   - Google 通常需要 **1-7 天**更新搜尋結果中的 favicon
   - 耐心等待，favicon 會自動更新

---

## 常見問題

### Q: 為什麼 Google 搜尋結果還沒有顯示 BOXIUM LOGO？

**A:** Google 需要時間重新爬取和索引您的網站。即使 favicon 已經正確設定，Google 可能還在使用舊的快取數據。通常需要 1-7 天才會更新。

### Q: 如何加速 Google 索引？

**A:** 
1. 提交 sitemap.xml 到 Google Search Console
2. 使用「要求建立索引」功能
3. 確保網站內容經常更新
4. 建立高品質的外部連結

### Q: Favicon 在瀏覽器中顯示正常，但 Google 搜尋結果中沒有？

**A:** 這是正常的。瀏覽器會立即載入 favicon，但 Google 需要時間重新爬取和更新搜尋結果。請耐心等待。

---

## 技術細節

### 已設定的 Favicon 文件

- `/favicon.ico` - 16x16 和 32x32（支援舊版瀏覽器）
- `/favicon-16x16.png` - 16x16 PNG
- `/favicon-32x32.png` - 32x32 PNG
- `/favicon-192x192.png` - 192x192 PNG（Android Chrome）
- `/favicon-512x512.png` - 512x512 PNG（Apple Touch Icon）

### 已設定的 Meta Tags

```html
<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
<link rel="apple-touch-icon" sizes="512x512" href="/favicon-512x512.png" />

<!-- Open Graph -->
<meta property="og:image" content="https://boxium.asia/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### JSON-LD 結構化數據

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "BOXIUM PTCG",
  "url": "https://boxium.asia",
  "logo": "https://boxium.asia/boxium-logo.png"
}
```

---

## 需要幫助？

如果您在設定過程中遇到任何問題，請參考：
- Google Search Console 說明中心：https://support.google.com/webmasters
- Google Rich Results Test：https://search.google.com/test/rich-results
- Google PageSpeed Insights：https://pagespeed.web.dev/

---

**最後更新：2026-02-26**
