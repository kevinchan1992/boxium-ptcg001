# BOXIUM PTCG — Cloudflare Workers OG Tag 注入器

## 解決的問題

生產環境使用 Cloudflare 作為反向代理，所有請求（包括社交媒體爬蟲）都直接收到靜態 `index.html`，Express 的 OG SSR 路由完全被繞過。這導致 WhatsApp / Facebook / Telegram 分享連結時，只顯示網站預設圖片，而非卡牌圖片。

**解決方案**：在 Cloudflare Workers 邊緣層攔截爬蟲請求，從 Express API 取得卡牌資料，動態注入 OG tags 後再回傳給爬蟲。

## 架構說明

```
爬蟲請求 /card/123
    │
    ▼
Cloudflare Workers (og-worker.js)
    │
    ├── 並行發出兩個請求：
    │   ├── 1. 向 origin 取得靜態 index.html
    │   └── 2. 向 Express API 取得卡牌 OG meta
    │           (GET /api/og-meta/123)
    │
    ▼
注入動態 OG tags 到 HTML
    │
    ▼
回傳給爬蟲（含卡牌圖片、名稱、描述）
```

## 部署步驟

### 方法一：Cloudflare Dashboard（推薦，無需安裝工具）

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 選擇 `boxium.asia` 域名
3. 左側選單點選 **Workers & Pages**
4. 點選 **Create** → **Create Worker**
5. 將 `og-worker.js` 的內容貼入編輯器
6. 點選 **Save and Deploy**
7. 回到 Workers 列表，點選剛建立的 Worker
8. 進入 **Settings** → **Triggers** → **Add Route**
9. 新增以下路由規則：
   - Route: `boxium.asia/card/*`
   - Zone: `boxium.asia`
10. 再新增一條：
    - Route: `boxium.asia/marketplace/*`
    - Zone: `boxium.asia`

### 方法二：Wrangler CLI

```bash
# 安裝 Wrangler
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 在 cloudflare-workers 目錄執行
cd cloudflare-workers

# 建立 wrangler.toml（見下方）
# 部署
wrangler deploy
```

**wrangler.toml 範例：**
```toml
name = "boxium-og-worker"
main = "og-worker.js"
compatibility_date = "2024-01-01"

[[routes]]
pattern = "boxium.asia/card/*"
zone_name = "boxium.asia"

[[routes]]
pattern = "boxium.asia/marketplace/*"
zone_name = "boxium.asia"
```

## 驗證是否生效

### 方法一：curl 模擬爬蟲
```bash
# 模擬 WhatsApp 爬蟲請求
curl -A "WhatsApp/2.0" -s "https://boxium.asia/card/1" | grep -E "og:title|og:image|og:description"
```

預期輸出應包含卡牌名稱，而非預設的「BOXIUM PTCG - 寶可夢卡牌市場數據平台」。

### 方法二：Facebook Sharing Debugger
前往 https://developers.facebook.com/tools/debug/ 輸入 `https://boxium.asia/card/1`

### 方法三：查看 Response Header
Worker 注入成功時，回應 header 會包含：
```
X-OG-Injected: true
```

## API 端點說明

Worker 會呼叫以下 Express API 取得卡牌資料：

```
GET /api/og-meta/:cardId
```

**回應格式：**
```json
{
  "title": "卡牌名稱 - BOXIUM PTCG",
  "description": "系列名稱 | PSA 10 價格追蹤",
  "image": "https://s3.../og-image-with-logo.png",
  "url": "https://boxium.asia/card/123"
}
```

`image` 欄位為已合成 BOXIUM LOGO 水印的卡牌圖片（1200x630px），由 Sharp 即時合成並快取至 S3。

## 注意事項

- Worker 對爬蟲回應設定 `Cache-Control: no-store`，確保每次都取得最新資料
- `/api/og-meta/:cardId` 端點本身有 1 小時快取（`Cache-Control: public, max-age=3600`）
- 若 API 回應失敗，Worker 會直接回傳原始靜態 HTML（降級處理）
- 非爬蟲的普通用戶請求不受影響，直接透傳到 origin
