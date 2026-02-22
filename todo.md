# BOXIUM PTCG 專案待辦事項

## 🚨 緊急問題：登出後自動跳轉到 Manus 認證系統

### 問題描述
- 用戶點擊登出後
- 應該返回主頁並保持未登入狀態
- 但實際上平台彈出 Manus 認證系統，要求用戶登入

### 診斷步驟
- [x] 檢查 TopNav 中的登出處理邏輯（代碼正確）
- [x] 檢查 window.location.href = "/" 是否正確執行（正確）
- [x] 檢查主頁是否有自動跳轉到登入的邏輯（沒有）
- [x] 確認已部署最新版本到生產環境（已部署 af5a94fc）
- [ ] 問題仍然存在，需要進一步檢查

### 可能原因
- window.location.href 會觸發完整頁面重新加載
- 在重新加載過程中可能有其他邏輯觸發
- 需要改用 router.push 或其他方式

### 修復任務
- [x] 修復登出邏輯（改用 navigate + 延遲 reload）
- [x] 測試登出流程（開發環境測試成功）
- [x] 保存 checkpoint（version: 1b99817d）
- [ ] 部署到生產環境測試

### 修復詳情
- 原來使用 `window.location.href = "/"` 會觸發完整頁面重新加載
- 現在改用 `navigate("/", { replace: true })` 先導航
- 然後延遲 100ms 再 `window.location.reload()` 以清除狀態

## 🚨 緊急問題：新註冊用戶登入後顯示權限錯誤

### 問題描述
- 新註冊的用戶使用 Manus OAuth 登入後
- 顯示 "You don't have permission to view this page. To continue, please switch to an account with access."
- 無法訪問平台任何頁面
- 這是 Manus 平台本身的權限錯誤訊息

### 診斷步驟
- [ ] 檢查 OAuth 回調處理邏輯
- [ ] 檢查用戶創建和權限設置
- [ ] 檢查是否有權限驗證中間件阻擋新用戶
- [ ] 檢查 Manus OAuth 配置

### 修復任務
- [ ] 修復 OAuth 回調邏輯
- [ ] 確保新用戶正確創建並有訪問權限
- [ ] 測試新用戶註冊和登入流程
- [ ] 保存 checkpoint

## 🔥 重大變更：完全移除登入認證系統

### 目標
- 將平台改為完全公開，無需登入
- 管理後台保留但設為公開訪問
- 刪除所有用戶相關功能和數據

### 移除清單

#### 前端頁面和組件
- [x] 刪除 /favorites 我的收藏頁面
- [x] 刪除 /dashboard 儀表板頁面
- [x] 移除 TopNav 中的用戶菜單和登入按鈕
- [x] 移除 ProtectedRoute 組件
- [x] 移除 AdminRoute 組件
- [x] 移除 OAuthErrorToast 組件
- [x] 移除 useAuth hook
- [x] 移除 FavoriteButton 組件
- [x] 移除 NotificationCenter 組件
- [x] 移除 const.ts (getLoginUrl)
- [x] 更新 App.tsx 路由配置

#### 後端 API 和認證
- [ ] 刪除 OAuth 回調路由
- [ ] 刪除認證相關 tRPC procedures
- [ ] 移除 authenticateRequest 中間件
- [ ] 移除 protectedProcedure
- [ ] 刪除 SDK OAuth 相關代碼

#### 數據庫
- [ ] 刪除 users 表
- [ ] 刪除 sessions 表
- [ ] 刪除 oauthAccounts 表
- [ ] 刪除 emailVerificationTokens 表
- [ ] 刪除 passwordResetTokens 表
- [ ] 執行數據庫遷移

#### 測試
- [ ] 測試主頁公開訪問
- [ ] 測試管理後台公開訪問
- [ ] 測試所有功能正常運作
- [ ] 確認無認證相關錯誤

#### 完成
- [ ] 保存 checkpoint
- [ ] 部署到生產環境


---

## ✅ 新策略：最小改動方案（保留認證系統代碼）

### 背景
- 由於完全移除認證系統涉及大量代碼修改，風險較高
- 用戶計劃日後重新開發認證系統
- 需要優先修改平台其他功能

### 新方案
- ✅ 回滾到 checkpoint 1b99817d（穩定版本）
- 只隱藏前端的登入相關UI元素
- 保留所有後端認證代碼不變
- 所有頁面已經是公開的，不需要修改路由

### 任務清單
- [x] 隱藏 TopNav 中的登入/註冊按鈕（已經沒有）
- [x] 隱藏卡牌詳情頁的收藏按鈕（已經沒有）
- [x] 測試所有頁面公開訪問（首頁、管理後台均測試成功）
- [x] 保存 checkpoint（version: 45863d27）
- [ ] 部署到生產環境


---

## 📱 手機版響應式設計優化

### 問題描述
1. Research 頁面（卡牌研究）的卡牌圖片在手機上排成單列，應該改為 2 列（像 Pricing 頁面一樣）
2. Pricing 詳細頁面的文字太小，應該改為跟 Research 詳細頁面一樣大（更清晰可讀）
3. 手機菜單導航項目的文字太大，需要縮小

### 任務清單
- [x] 修改 Research 頁面卡牌圖片排版為 2 列（手機版）
- [x] 調整 Pricing 詳細頁面文字大小（改為更細更清晰）
- [x] 修復手機菜單導航項目文字過大問題（text-lg → text-base）
- [x] 測試手機版顯示效果（桃面正常顯示）
- [ ] 保存 checkpoint
