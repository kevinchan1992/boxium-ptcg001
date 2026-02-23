# Playwright 生產環境安裝問題修復指南

## 問題總結

**症狀：** 生產環境（boxium.asia）顯示「暫無在售商品」，SNKRDUNK 爬蟲無法運行

**錯誤信息：**
```
browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
```

**根本原因：** Playwright 瀏覽器未安裝在生產環境的 `/root/.cache/` 目錄下

## 環境差異分析

| 環境 | 用戶 | HOME 目錄 | Playwright 路徑 | 狀態 |
|------|------|-----------|----------------|------|
| **開發環境** | `ubuntu` | `/home/ubuntu` | `/home/ubuntu/.cache/ms-playwright/` | ✅ 已安裝 |
| **生產環境** | `root` | `/root` | `/root/.cache/ms-playwright/` | ❌ 未安裝 |

## 修復方案

### 已實施的改進

**增強版 ensure-playwright.sh 腳本特性：**

1. **詳細日誌輸出**
   - 時間戳、當前用戶、HOME 目錄
   - Node.js 和 pnpm 版本
   - Chromium 和 Headless Shell 檢查結果

2. **智能錯誤處理**
   - 移除 `set -e`，安裝失敗不阻止服務器啟動
   - 安裝日誌保存到 `/tmp/playwright-install.log`
   - 提供清晰的錯誤提示和手動安裝命令

3. **安裝驗證**
   - 安裝後檢查 Chromium 和 Headless Shell 目錄
   - 列出快取目錄內容（如果驗證失敗）

## 部署步驟

### 步驟 1：發布 Checkpoint 到生產環境

1. 在 Manus 管理介面點擊「Publish」按鈕
2. 等待部署完成

### 步驟 2：重啟服務器並查看日誌

重啟後，查看服務器啟動日誌，尋找以下關鍵信息：

**成功安裝的日誌：**
```
============================================================
[Playwright Setup] Playwright Auto-Install Script
============================================================
[Playwright Setup] Timestamp: 2026-02-23 12:00:00
[Playwright Setup] Current user: root
[Playwright Setup] HOME directory: /root
[Playwright Setup] Playwright cache: /root/.cache/ms-playwright
[Playwright Setup] Node.js version: v22.13.0
[Playwright Setup] pnpm version: 10.4.1
============================================================
[Playwright Setup] Checking Playwright installation...
[Playwright Setup] ❌ Chromium NOT found at: /root/.cache/ms-playwright/chromium-1208
[Playwright Setup] ❌ Headless Shell NOT found at: /root/.cache/ms-playwright/chromium_headless_shell-1208
[Playwright Setup] ❌ Playwright Chromium is NOT installed
[Playwright Setup] 🔧 Starting installation process...
[Playwright Setup] This may take 2-3 minutes (downloading ~280MB)...
============================================================
[Playwright Setup] Running: pnpm exec playwright install chromium
Downloading Chrome for Testing 145.0.7632.6 (playwright chromium v1208)...
Chrome for Testing 145.0.7632.6 downloaded to /root/.cache/ms-playwright/chromium-1208
Downloading FFmpeg (playwright ffmpeg v1011)...
FFmpeg downloaded to /root/.cache/ms-playwright/ffmpeg-1011
Downloading Chrome Headless Shell 145.0.7632.6...
Chrome Headless Shell downloaded to /root/.cache/ms-playwright/chromium_headless_shell-1208
============================================================
[Playwright Setup] ✅ Playwright Chromium installed successfully
[Playwright Setup] Verifying installation...
[Playwright Setup] ✅ Installation verified successfully
[Playwright Setup] Chromium path: /root/.cache/ms-playwright/chromium-1208
[Playwright Setup] Headless Shell path: /root/.cache/ms-playwright/chromium_headless_shell-1208
============================================================
[Playwright Setup] ✅ Setup complete. Playwright is ready.
============================================================
```

**已安裝的日誌（跳過安裝）：**
```
============================================================
[Playwright Setup] Playwright Auto-Install Script
============================================================
[Playwright Setup] Checking Playwright installation...
[Playwright Setup] ✅ Chromium found at: /root/.cache/ms-playwright/chromium-1208
[Playwright Setup] ✅ Headless Shell found at: /root/.cache/ms-playwright/chromium_headless_shell-1208
[Playwright Setup] ✅ Playwright Chromium is already installed
[Playwright Setup] Skipping installation...
============================================================
```

### 步驟 3：驗證安裝

#### 方法 1：使用 Admin 診斷工具

1. 登入 Admin 後台（https://boxium.asia/admin）
2. 進入「性能監控」標籤頁
3. 點擊「Playwright 狀態測試」按鈕
4. 查看測試結果：
   - ✅ **Browser launched successfully** - Playwright 已安裝
   - ❌ **Executable doesn't exist** - Playwright 未安裝

#### 方法 2：測試實際爬蟲功能

1. 訪問任意卡牌的 Pricing 頁面（例如：https://boxium.asia/pricing/1）
2. 等待 15-20 秒（首次爬取需要時間）
3. 查看是否顯示 PSA 10 在售商品
4. 如果顯示「暫無在售商品」，進入 Admin 快取管理清除該卡牌快取後重試

## 如果腳本沒有執行

如果服務器啟動日誌中**沒有**看到 `[Playwright Setup]` 開頭的日誌，說明腳本沒有執行。

### 可能原因

1. **Manus 平台不使用 `package.json` 的 `start` 命令**
   - 生產環境可能直接運行 `node dist/index.js`
   - 繞過了 `bash scripts/ensure-playwright.sh &&` 前綴

2. **腳本路徑錯誤或權限問題**
   - 腳本沒有執行權限
   - 腳本路徑在生產環境中不存在

### 解決方法：聯繫 Manus 平台支持

如果腳本確實沒有執行，需要聯繫 Manus 平台支持，詢問：

1. 生產環境的實際啟動命令是什麼？
2. 是否可以在啟動命令中添加 `bash scripts/ensure-playwright.sh &&` 前綴？
3. 是否可以在 Dockerfile 中預安裝 Playwright？
4. 是否可以使用 Playwright Docker 鏡像作為基礎鏡像？

## 常見問題排查

### Q1: 腳本執行了但安裝失敗

**症狀：** 看到 `[Playwright Setup] ❌ Failed to install Playwright Chromium`

**可能原因：**
- 網絡問題（無法訪問 `cdn.playwright.dev`）
- 磁盤空間不足（需要 ~280MB）
- 權限問題（無法寫入 `/root/.cache/`）

**解決方法：**
1. 查看 `/tmp/playwright-install.log` 獲取詳細錯誤信息
2. 檢查磁盤空間：`df -h`
3. 檢查網絡連接：`curl -I https://cdn.playwright.dev`
4. 檢查目錄權限：`ls -la /root/.cache/`

### Q2: 安裝成功但爬蟲仍然失敗

**症狀：** 安裝驗證通過，但 Pricing 頁面仍顯示「暫無在售商品」

**可能原因：**
- 系統依賴缺失（libnss3, libatk-bridge2.0-0 等）
- 容器環境限制（無法運行 Chromium）
- 舊的空快取仍然存在

**解決方法：**
```bash
# 1. 安裝系統依賴
pnpm exec playwright install-deps chromium

# 2. 清除舊快取
# 進入 Admin 後台 → 快取管理 → 清除問題卡牌的快取
```

### Q3: 每次重啟都需要重新安裝

**症狀：** 每次重啟服務器，Playwright 都會重新安裝

**可能原因：**
- 容器使用臨時存儲，重啟後清空
- `/root/.cache/` 目錄沒有持久化

**解決方法：**
- 聯繫 Manus 平台支持，要求持久化 `/root/.cache/` 目錄
- 或在 Dockerfile 中預安裝 Playwright

## 長期解決方案建議

### 選項 1：在 Dockerfile 中預安裝 Playwright（推薦）

如果生產環境使用 Docker，可以在 Dockerfile 中添加：

```dockerfile
# 安裝 Playwright 瀏覽器和系統依賴
RUN pnpm exec playwright install chromium
RUN pnpm exec playwright install-deps chromium
```

**優點：** 一次安裝，永久有效，不依賴啟動腳本  
**缺點：** 需要修改 Dockerfile（可能需要 Manus 平台支持）

### 選項 2：使用 Playwright Docker 鏡像

使用官方的 Playwright Docker 鏡像作為基礎鏡像：

```dockerfile
FROM mcr.microsoft.com/playwright:v1.49.0-jammy
```

**優點：** 所有依賴都已預裝，最穩定  
**缺點：** 需要修改部署配置（可能需要 Manus 平台支持）

### 選項 3：替換為 Puppeteer

如果 Playwright 持續有問題，可以考慮替換為 Puppeteer：

**優點：** 更輕量，安裝更簡單，更適合容器環境  
**缺點：** 需要重寫爬蟲代碼（約 1-2 小時工作量）

## 相關文件

- **自動安裝腳本**: `scripts/ensure-playwright.sh`
- **診斷 API**: `server/routers/diagnostics.ts`
- **Playwright Pool**: `server/services/playwrightPool.ts`
- **SNKRDUNK 爬蟲**: `server/services/snkrdunkPlaywright.ts`
- **原部署說明**: `DEPLOYMENT_PLAYWRIGHT.md`
- **問題分析**: `PLAYWRIGHT_PRODUCTION_ISSUE.md`
