# 生產環境 Playwright 安裝失敗分析與解決方案

## 📋 問題總結

**現象：**
- ✅ 開發環境：Pricing 頁面正常顯示 PSA 10 在售商品（成功爬取 8 個商品）
- ❌ 生產環境（boxium.asia）：Pricing 頁面顯示「暫無在售商品」
- ✅ 已部署 checkpoint 5c973cd7（包含 Playwright 自動安裝腳本）
- ✅ 已重啟生產環境服務器

**開發環境測試結果：**
```
[SNKRDUNK Playwright] Total listings: 8 (8 on-sale + 4 sold, after deduplication)
[SNKRDUNK Playwright] Price range: HKD 3783.00 - HKD 5046.60
```

## 🔍 可能原因分析

### 1. Playwright 瀏覽器未成功安裝（最可能 ⭐⭐⭐⭐⭐）

**原因：**
- 生產環境可能沒有執行 `ensure-playwright.sh` 腳本
- 或者執行了但下載失敗（網絡問題、權限問題）
- 或者磁盤空間不足（Playwright 需要約 280 MB）

**證據：**
- 開發環境日誌顯示 Playwright 成功啟動並爬取數據
- 生產環境沒有相關日誌（可能是因為 Playwright 啟動失敗）

**驗證方法：**
檢查生產環境是否有以下文件：
```bash
ls -la /home/ubuntu/.cache/ms-playwright/chromium-1208/
ls -la /home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1208/
```

### 2. 生產環境缺少系統依賴庫（可能性 ⭐⭐⭐⭐）

**原因：**
Chromium 需要特定的 Linux 系統庫（如 libglib2.0-0, libnss3, libxss1 等），生產環境可能缺少這些庫。

**證據：**
- Playwright 安裝成功但啟動失敗
- 日誌中可能有類似 "error while loading shared libraries" 的錯誤

**驗證方法：**
```bash
ldd /home/ubuntu/.cache/ms-playwright/chromium-1208/chrome-linux/chrome
```

### 3. 網絡訪問限制（可能性 ⭐⭐⭐）

**原因：**
- 生產環境無法訪問 SNKRDUNK 網站（防火牆、IP 封鎖）
- 或者無法下載 Playwright 瀏覽器（無法訪問 Google CDN）

**驗證方法：**
```bash
curl -I https://snkrdunk.com
curl -I https://playwright.azureedge.net
```

### 4. 權限問題（可能性 ⭐⭐）

**原因：**
- 生產環境的用戶沒有執行權限
- 或者無法寫入 `/home/ubuntu/.cache/` 目錄

**驗證方法：**
```bash
whoami
ls -la /home/ubuntu/.cache/
```

### 5. 資源限制（可能性 ⭐）

**原因：**
- 生產環境內存不足（Chromium 需要至少 512 MB）
- 或者 CPU 限制導致 Playwright 啟動超時

**驗證方法：**
```bash
free -h
top
```

## 💡 解決方案

### 方案 1：創建診斷 API（推薦 ⭐⭐⭐⭐⭐）

**優點：**
- 可以在生產環境直接測試 Playwright 狀態
- 無需 SSH 訪問生產環境
- 提供詳細的錯誤信息

**實施步驟：**
1. 創建 `diagnostics.testPlaywrightStatus` API
2. 在 Admin 後台添加「測試 Playwright」按鈕
3. 顯示測試結果（成功/失敗、錯誤信息、瀏覽器路徑）

**代碼示例：**
```typescript
// server/routers/diagnostics.ts
testPlaywrightStatus: adminProcedure.query(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    await browser.close();
    return { success: true, message: 'Playwright is working' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}),
```

### 方案 2：優化 ensure-playwright.sh 腳本（推薦 ⭐⭐⭐⭐）

**優點：**
- 添加更詳細的日誌
- 檢查系統依賴
- 自動重試下載

**實施步驟：**
1. 添加系統依賴檢查
2. 添加下載進度顯示
3. 添加錯誤日誌輸出到文件

**代碼示例：**
```bash
#!/bin/bash

# 檢查系統依賴
echo "[Playwright Setup] Checking system dependencies..."
if ! command -v ldd &> /dev/null; then
  echo "[Playwright Setup] ❌ ldd command not found"
fi

# 檢查磁盤空間
DISK_SPACE=$(df -m /home/ubuntu | awk 'NR==2 {print $4}')
if [ "$DISK_SPACE" -lt 500 ]; then
  echo "[Playwright Setup] ⚠️ Low disk space: ${DISK_SPACE}MB"
fi

# 安裝 Playwright 並記錄日誌
pnpm exec playwright install chromium 2>&1 | tee /tmp/playwright-install.log
```

### 方案 3：使用 Playwright Docker 鏡像（如果 Manus 支持）

**優點：**
- 包含所有系統依賴
- 環境一致性高
- 無需手動安裝

**缺點：**
- 需要 Manus 平台支持 Docker
- 可能需要額外配置

**實施步驟：**
1. 創建 Dockerfile
2. 使用 `mcr.microsoft.com/playwright:v1.48.0` 作為基礎鏡像
3. 部署到 Manus 平台

### 方案 4：使用 Puppeteer 替代 Playwright

**優點：**
- 更輕量級
- 安裝更簡單
- 系統依賴更少

**缺點：**
- 需要重寫爬取代碼
- 功能可能不如 Playwright 強大

**實施步驟：**
1. 安裝 Puppeteer
2. 重寫 `snkrdunkPlaywright.ts` 為 `snkrdunkPuppeteer.ts`
3. 測試並部署

### 方案 5：聯繫 Manus 平台支持（最後手段）

**優點：**
- 可能獲得官方支持
- 了解平台限制

**缺點：**
- 需要等待回應
- 可能無法解決

**實施步驟：**
1. 提交支持請求到 https://help.manus.im
2. 說明問題和需求
3. 等待回應

## 🎯 推薦實施順序

1. **立即實施方案 1**：創建診斷 API，確認 Playwright 狀態
2. **根據診斷結果**：
   - 如果 Playwright 未安裝 → 實施方案 2（優化安裝腳本）
   - 如果缺少系統依賴 → 實施方案 3（Docker）或方案 5（聯繫支持）
   - 如果網絡問題 → 實施方案 5（聯繫支持）
3. **最後手段**：實施方案 4（Puppeteer 替代）

## 📝 下一步行動

1. 創建診斷 API 和前端測試按鈕
2. 在生產環境測試 Playwright 狀態
3. 根據測試結果選擇對應的解決方案
4. 保存 checkpoint 並部署
