# BOXIUM TCG — 手機 APP 打包指南

本文件說明如何將 BOXIUM TCG 網頁平台打包為 iOS 和 Android 原生 APP。

---

## 技術架構

| 項目 | 技術 |
|------|------|
| 框架 | Capacitor 8.3.4 |
| 前端 | React 19 + Vite 7 |
| APP ID | `asia.boxium.ptcg` |
| 版本 | `1.0.0` |
| Build 目錄 | `dist/public` |

---

## 前置要求

### iOS 打包
- macOS 系統（必須）
- Xcode 15 或以上
- Apple Developer Program 帳號（年費 USD $99）
- CocoaPods（`sudo gem install cocoapods`）

### Android 打包
- Android Studio（最新版）
- JDK 17 或以上
- Android SDK（API Level 33 或以上）

---

## 第一次設置

### 1. 安裝依賴

```bash
cd /path/to/boxium-ptcg
pnpm install
```

### 2. Build 前端

```bash
pnpm build
```

這會將前端打包到 `dist/public/` 目錄。

### 3. 初始化 Capacitor 平台

```bash
# 添加 iOS 平台
npx cap add ios

# 添加 Android 平台
npx cap add android
```

### 4. 同步代碼到原生項目

```bash
npx cap sync
```

---

## 日常開發流程

每次修改前端代碼後，需要重新 build 並同步：

```bash
# 1. Build 前端
pnpm build

# 2. 同步到原生項目
npx cap sync

# 3. 打開 Xcode 或 Android Studio
npx cap open ios
npx cap open android
```

---

## iOS 打包步驟

### 開發測試（真機）

1. 執行 `npx cap open ios` 打開 Xcode
2. 選擇目標設備（真機或模擬器）
3. 在 Xcode 中設置 Bundle ID：`asia.boxium.ptcg`
4. 在 Signing & Capabilities 中選擇你的 Apple Developer Team
5. 點擊 Run（▶）按鈕

### App Store 上架

1. 在 Xcode 中選擇 `Any iOS Device (arm64)` 作為目標
2. 選擇 `Product → Archive`
3. 在 Organizer 中選擇 `Distribute App`
4. 選擇 `App Store Connect` 並按指示上傳

### App Store Connect 設置

- **Bundle ID**: `asia.boxium.ptcg`
- **App Name**: BOXIUM TCG
- **Primary Language**: 繁體中文
- **Category**: 財經（Finance）或 工具（Utilities）
- **Age Rating**: 4+

### App Review Information（重要）

在提交審查時，在 App Review Information 的 Notes 欄位填寫：

```
BOXIUM TCG is a market data platform for Trading Card Games (TCG).

Key features:
- PSA 10 graded card price tracking (data aggregated from SNKRDUNK)
- 24-hour trending card rankings
- Secondary market listings for physical cards
- PSA grading submission service (physical card service)

Regarding payments:
- All marketplace transactions involve physical trading cards (tangible goods)
- PSA grading service is a physical card handling and mailing service
  (cards are physically shipped to PSA grading facility)
- No digital goods or in-app content is sold through this app
- Stripe is used for all payment processing under Apple's physical goods exemption

Test Account:
Email: [your test account email]
Password: [your test account password]
```

---

## Android 打包步驟

### 開發測試（真機）

1. 在 Android 設備上啟用「開發者模式」和「USB 調試」
2. 執行 `npx cap open android` 打開 Android Studio
3. 選擇目標設備
4. 點擊 Run（▶）按鈕

### Google Play 上架

1. 在 Android Studio 中選擇 `Build → Generate Signed Bundle / APK`
2. 選擇 `Android App Bundle (.aab)`
3. 創建或選擇 Keystore 文件（**重要：妥善保存 Keystore，遺失後無法更新 APP**）
4. 上傳到 Google Play Console

---

## 推播通知設置

### iOS (APNs)

1. 在 Apple Developer Portal 創建 APNs Key
2. 下載 `.p8` 文件
3. 在 Xcode 中啟用 Push Notifications capability
4. 將 APNs Key 上傳到後端推播服務

### Android (FCM)

1. 在 Firebase Console 創建項目
2. 下載 `google-services.json`
3. 放置到 `android/app/google-services.json`
4. 在 `android/build.gradle` 中加入 Google Services 插件

---

## Capacitor 配置說明

`capacitor.config.ts` 的關鍵配置：

```typescript
{
  appId: "asia.boxium.ptcg",          // Bundle ID / Package Name
  appName: "BOXIUM TCG",              // 顯示名稱
  webDir: "dist/public",              // Build 輸出目錄
  server: {
    // 開發時可設置為網頁 URL 以實現熱重載
    // url: "https://boxium.asia",
    // cleartext: true,
  },
  ios: {
    contentInset: "automatic",        // 自動處理 Safe Area
    backgroundColor: "#000000",       // 啟動背景色
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    backgroundColor: "#000000",       // 啟動背景色
    allowMixedContent: false,         // 安全性：禁止混合內容
    captureInput: true,               // 改善輸入框體驗
    webContentsDebuggingEnabled: false, // 生產環境關閉調試
  },
}
```

---

## 常見問題

### Q: `npx cap sync` 時出現錯誤

確保已執行 `pnpm build` 並且 `dist/public/index.html` 存在。

### Q: iOS 模擬器無法顯示內容

確保 `capacitor.config.ts` 中的 `webDir` 指向正確的 build 輸出目錄。

### Q: Safe Area 在 iPhone 上顯示不正確

確認 `index.html` 中的 viewport meta 包含 `viewport-fit=cover`（已配置）。

### Q: 推播通知在 iOS 上不工作

iOS 模擬器不支持推播通知，必須使用真機測試。

### Q: 套件版本衝突

**嚴禁使用 `--force` 或 `--legacy-peer-deps`**。

正確做法：
```bash
# 檢查衝突
pnpm why @capacitor/core

# 查看 peerDependencies
npm info @capacitor/push-notifications peerDependencies
```

---

## 版本記錄

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0.0 | 2026-05 | 初始 Capacitor 整合 |

---

## Stripe vs IAP 政策說明

BOXIUM TCG 的所有付費功能均涉及**實體商品或實體服務**：

1. **二手卡牌市集** — 實體卡牌交易，適用 Apple 實體商品豁免條款
2. **PSA 鑑定代辦** — 實體卡牌往返寄送服務，無數字商品交付

因此，所有交易均可合法使用 Stripe 而非 Apple IAP，無需支付 15-30% 平台抽成。

在 App Review Information 中必須明確說明上述服務性質，避免審查員誤判為數字商品。
