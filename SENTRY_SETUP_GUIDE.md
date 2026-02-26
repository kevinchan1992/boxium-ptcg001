# Sentry 錯誤監控設置指南

## 📋 概述

Sentry 是一個集中式錯誤追蹤系統，可以幫助您快速定位和修復生產環境問題。本指南將引導您完成 Sentry 的設置和配置。

---

## 🚀 快速開始

### 1. 創建 Sentry 帳號

1. 訪問 [https://sentry.io](https://sentry.io)
2. 註冊免費帳號（每月 5,000 個錯誤免費）
3. 創建新專案，選擇 **JavaScript** 作為平台

### 2. 獲取 DSN（Data Source Name）

創建專案後，Sentry 會提供兩個 DSN：

- **Frontend DSN**：用於前端錯誤監控
- **Backend DSN**：用於後端錯誤監控

DSN 格式如下：
```
https://<key>@<organization>.ingest.sentry.io/<project-id>
```

### 3. 配置環境變量

#### 方法 A：使用 Manus 管理介面（推薦）

1. 打開 Manus 管理介面
2. 進入「Settings」→「Secrets」
3. 添加以下環境變量：
   - `VITE_SENTRY_DSN_FRONTEND`：前端 DSN
   - `SENTRY_DSN_BACKEND`：後端 DSN

#### 方法 B：使用 `webdev_request_secrets` 工具

如果您正在與 Manus AI 對話，可以直接要求 AI 幫您設置：

```
請幫我設置 Sentry DSN：
- VITE_SENTRY_DSN_FRONTEND: https://xxx@xxx.ingest.sentry.io/xxx
- SENTRY_DSN_BACKEND: https://xxx@xxx.ingest.sentry.io/xxx
```

### 4. 重啟開發服務器

設置環境變量後，重啟開發服務器以應用配置：

```bash
# 在 Manus 管理介面點擊「Restart Server」按鈕
# 或者在終端執行：
pnpm dev
```

### 5. 驗證設置

檢查服務器日誌，應該看到：

```
[Sentry] Initialized for development environment
```

如果看到以下訊息，表示 DSN 未配置：

```
[Sentry] DSN not configured, error monitoring disabled
```

---

## 🔍 功能特性

### 前端錯誤監控

- **自動捕獲未處理的錯誤**：所有 JavaScript 錯誤會自動發送到 Sentry
- **API 查詢錯誤**：tRPC query 錯誤會被捕獲並附帶 queryKey 和 queryHash
- **API 變更錯誤**：tRPC mutation 錯誤會被捕獲並附帶 mutationId
- **Session Replay**：錯誤發生時會錄製用戶操作回放（10% 採樣率）
- **Performance Monitoring**：追蹤頁面載入時間和 API 響應時間

### 後端錯誤監控

- **tRPC 錯誤捕獲**：所有 tRPC procedure 錯誤會自動發送到 Sentry
- **錯誤上下文**：包含 procedure 路徑、輸入參數、用戶信息
- **Performance Monitoring**：追蹤 API 響應時間和數據庫查詢性能
- **Profiling**：分析 CPU 使用率和函數執行時間

---

## 📊 查看錯誤報告

### 1. 登入 Sentry Dashboard

訪問 [https://sentry.io](https://sentry.io) 並登入您的帳號。

### 2. 查看錯誤列表

在 Sentry Dashboard 中，您可以看到：

- **錯誤數量**：按時間統計的錯誤數量
- **錯誤類型**：按錯誤類型分組
- **受影響用戶**：有多少用戶遇到該錯誤
- **錯誤趨勢**：錯誤是增加還是減少

### 3. 查看錯誤詳情

點擊任何錯誤，可以看到：

- **錯誤堆棧**：完整的錯誤堆棧追蹤
- **用戶信息**：用戶 email、瀏覽器、操作系統
- **請求上下文**：API 路徑、輸入參數、queryKey
- **Session Replay**：用戶操作回放視頻（如果啟用）
- **麵包屑**：錯誤發生前的用戶操作歷史

---

## 🎯 最佳實踐

### 1. 過濾預期錯誤

某些錯誤是預期的（例如：用戶未登入），不需要發送到 Sentry。

**前端過濾範例（已實現）：**

```typescript
// client/src/main.tsx
if (error?.message?.includes("Please login") || error?.data?.code === "UNAUTHORIZED") {
  return; // 不發送到 Sentry
}
```

### 2. 添加自定義標籤

為錯誤添加自定義標籤，方便分類和搜尋：

```typescript
Sentry.captureException(error, {
  tags: {
    feature: 'pricing',
    source: 'snkrdunk',
  },
});
```

### 3. 設置用戶上下文

在用戶登入後，設置用戶信息：

```typescript
Sentry.setUser({
  email: user.email,
  id: user.id,
});
```

### 4. 調整採樣率

生產環境建議降低採樣率以節省配額：

```typescript
// 前端
tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,

// 後端
tracesSampleRate: environment === "production" ? 0.1 : 1.0,
```

---

## 🔧 進階配置

### 1. 設置 Release 版本

追蹤哪個版本的代碼產生錯誤：

```typescript
Sentry.init({
  dsn: "...",
  release: "boxium-ptcg@1.0.0",
});
```

### 2. 設置 Environment

區分不同環境的錯誤：

```typescript
Sentry.init({
  dsn: "...",
  environment: "production", // 或 "staging", "development"
});
```

### 3. 自定義錯誤邊界

在 React 組件中捕獲錯誤：

```typescript
import * as Sentry from "@sentry/react";

const ErrorFallback = ({ error }) => (
  <div>
    <h2>出錯了！</h2>
    <button onClick={() => window.location.reload()}>重新載入</button>
  </div>
);

<Sentry.ErrorBoundary fallback={ErrorFallback}>
  <App />
</Sentry.ErrorBoundary>
```

---

## 💰 費用說明

### 免費方案

- **5,000 個錯誤/月**
- **10,000 個 Performance 事件/月**
- **50 個 Session Replay/月**
- **1 個專案**
- **30 天數據保留**

### 付費方案

如果免費配額不夠，可以升級到付費方案：

- **Team 方案**：$26/月（50,000 個錯誤/月）
- **Business 方案**：$80/月（200,000 個錯誤/月）

---

## 🐛 故障排除

### 問題 1：錯誤沒有發送到 Sentry

**檢查清單：**

1. 確認 DSN 已正確配置（檢查環境變量）
2. 確認服務器已重啟（應用新的環境變量）
3. 檢查服務器日誌是否顯示 `[Sentry] Initialized`
4. 確認錯誤沒有被過濾（檢查 `if` 條件）

### 問題 2：錯誤太多，超過配額

**解決方案：**

1. 調整採樣率（降低到 0.05 或 0.01）
2. 過濾更多預期錯誤
3. 升級到付費方案

### 問題 3：Session Replay 不工作

**檢查清單：**

1. 確認前端 DSN 已配置
2. 確認 `replayIntegration` 已啟用
3. 檢查採樣率設置（`replaysSessionSampleRate` 和 `replaysOnErrorSampleRate`）

---

## 📚 相關資源

- [Sentry 官方文檔](https://docs.sentry.io/)
- [Sentry React 集成](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Node.js 集成](https://docs.sentry.io/platforms/node/)
- [Sentry tRPC 集成](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)

---

## ✅ 測試驗證

運行以下命令驗證 Sentry 集成：

```bash
pnpm test sentry
```

應該看到所有 12 個測試通過：

```
✓ Sentry Integration (12)
  ✓ Backend Configuration (4)
  ✓ Frontend Configuration (4)
  ✓ Configuration Structure (2)
  ✓ Error Context (2)
```

---

## 🎉 完成！

恭喜！您已成功設置 Sentry 錯誤監控系統。現在您可以：

1. 在 Sentry Dashboard 查看實時錯誤報告
2. 快速定位和修復生產環境問題
3. 主動發現問題（而不是等用戶報告）
4. 提升系統穩定性和用戶體驗

如有任何問題，請參考 [Sentry 官方文檔](https://docs.sentry.io/) 或聯繫技術支持。
