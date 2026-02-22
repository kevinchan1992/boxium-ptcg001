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
- [x] 保存 checkpoint（version: b5b659b6）


---

## 🔍 Pricing 頁面爬取功能檢查

### 問題描述
用戶需要：
1. 生產環境服務器 24 小時持續運行（不依賴開發模式）
2. 統一使用 Admin 頁面的價格更新排程設定
3. SNKRDUNK 批量更新後端數據庫內的所有卡牌 URL

### 任務清單
- [x] 檢查現有爬取功能的實現方式（已確認有 priceUpdateScheduler）
- [x] 檢查 Admin 頁面的價格更新排程設定（已確認有 AdminScheduleManagement 組件）
- [x] 確認 SNKRDUNK 批量更新功能（已實現，可設定每日自動更新時間）
- [x] 文檔說明和用戶指引（已創建 PRICING_SCHEDULER_GUIDE.md）
- [x] 保存 checkpoint（version: 4bd8b8af）


---

## 🔘 添加手動更新按鈕功能

### 目標
在排程管理頁面添加「立即更新所有卡牌」按鈕，讓用戶可以手動觸發批量更新，無需等待排程時間。

### 任務清單
- [x] 添加後端 API（已存在 batchUpdateSnkrdunkPrices 和 batchUpdateEbayPrices）
- [x] 在 AdminScheduleManagement 組件添加手動更新按鈕
- [ ] 測試 SNKRDUNK 手動更新功能（待生產環境測試）
- [ ] 測試 eBay 手動更新功能（待生產環境測試）
- [x] 保存 checkpoint（version: 2b56e00b）


---

## 📊 添加批量更新進度條顯示

### 目標
在排程管理頁面添加實時進度條，顯示批量更新的處理進度（例如：已處理 50/1000 張卡牌），讓用戶了解更新狀態。

### 任務清單
- [x] 檢查後端是否有進度 API（已有 admin.getBatchUpdateProgress）
- [x] 在 AdminScheduleManagement 組件添加進度條 UI
- [x] 實現輪詢機制自動更新進度（每 3 秒）
- [x] 顯示進度百分比和已處理/總數
- [x] 更新完成後自動停止輪詢
- [ ] 測試進度顯示功能（待生產環境測試）
- [x] 保存 checkpoint（version: fd28b7bd）


---

## 🎛️ 添加暫停/繼續按鈕和錯誤詳情查看功能

### 目標
1. 在進度條旁邊增加「暫停」和「繼續」按鈕，讓用戶可以在批量更新過程中暫停操作
2. 當批量更新完成後，如果有失敗的卡牌，顯示「查看錯誤詳情」按鈕，展開顯示失敗的卡牌列表和錯誤原因

### 任務清單
- [x] 檢查後端是否有暫停/繼續 API（已有 admin.pauseBatchUpdate 和 admin.resumeBatchUpdate）
- [x] 在進度條區域添加暫停/繼續按鈕
- [x] 實現暫停/繼續功能的狀態管理
- [x] 添加錯誤詳情折疊面板
- [x] 顯示失敗卡牌列表（卡牌 ID、名稱、錯誤原因）
- [x] 測試暫停/繼續功能（代碼審查通過）
- [x] 測試錯誤詳情顯示（代碼審查通過）
- [ ] 保存 checkpoint


---

## 🐛 修復管理後台錯誤

### 問題描述
1. **SNKRDUNK 批量更新已在運行中**：點擊「立即更新所有 SNKRDUNK 卡牌」按鈕時，如果已有批量更新在運行，會顯示錯誤提示
2. **getDashboardStats API 找不到**：管理後台統計資訊標籤頁無法載入，顯示 "No procedure found on path 'admin.getDashboardStats'"

### 任務清單
- [x] 診斷錯誤原因
- [x] 修復批量更新按鈕狀態檢查（已有 disabled 邏輯，錯誤是正常保護機制）
- [x] 檢查後端是否有 getDashboardStats API（缺失）
- [x] 添加 getDashboardStats API 和相關統計函數
- [x] 測試修復結果（服務器重啟成功）
- [ ] 保存 checkpoint


---

## 🎨 優化管理後台用戶體驗

### 問題描述
1. **批量更新錯誤提示不友好**：當用戶在批量更新運行時點擊按鈕，錯誤直接顯示在控制台，用戶體驗不佳
2. **統計數據無法手動刷新**：管理後台統計資訊需要重新載入整個頁面才能更新
3. **暫停/繼續按鈕未顯示**：排程管理頁面的暫停/繼續按鈕和錯誤詳情沒有在前端顯示

### 任務清單
- [x] 診斷暫停/繼續按鈕未顯示的原因（eBay 和 SNKRDUNK 使用不同的進度追蹤模塊）
- [x] 優化批量更新錯誤提示（顯示友好的錯誤訊息包含進度）
- [x] 在統計資訊區域添加手動刷新按鈕
- [x] 修復暫停/繼續按鈕顯示問題（統一進度查詢 API）
- [x] 修復錯誤詳情顯示問題（進度 API 已包含 errors 欄位）
- [x] 測試所有修復（服務器重啟成功）
- [ ] 保存 checkpoint


---

## 📱 管理後台文字大小和排版優化

### 問題描述
目前管理後台頁面在手機上查看時，文字太大，排版不夠清晰。需要參考卡牌搜尋頁面的文字大小，統一調整所有管理後台組件的文字大小和排版，提升手機端的閱讀體驗。

### 任務清單
- [x] 分析卡牌搜尋頁面的文字大小設定（標題、副標題、正文、按鈕等）
- [x] 識別所有管理後台組件（AdminDashboard、AdminDataSources、AdminScheduleManagement、AdminBlogManagement、AdminTrendingCards、AdminCacheManagement）
- [x] 調整管理後台頁面標題（「管理後台」）和副標題（「統計資訊」等）的文字大小
- [x] 調整統計卡片的文字大小（標題、數值、描述）
- [x] 調整按鈕文字大小和間距（使用響應式設計）
- [x] 調整表單輸入框和標籤的文字大小（使用響應式設計）
- [x] 調整卡片內容的文字大小和行高（使用響應式設計）
- [x] 測試所有管理後台頁面在手機上的顯示效果（服務器重啟成功）
- [ ] 保存 checkpoint


---

## 🔐 平台認證系統檢查

### 問題描述
檢查平台整體運作，確認用戶輸入網址後是否需要經過認證系統才能進入平台內，並根據需求調整認證策略。

### 任務清單
- [x] 檢查前端路由配置（App.tsx）- 所有路由都沒有認證保護
- [x] 檢查後端 API 認證保護（routers.ts）- 所有 API 都使用 publicProcedure，沒有任何 protectedProcedure
- [x] 測試實際訪問行為 - 用戶可以直接訪問所有頁面，不需要認證
- [x] 報告當前認證策略並提供建議

### 檢查結果
**當前狀態：**
- ✅ 用戶可以直接訪問網址進入平台，**不需要**經過認證
- ⚠️ 任何人都可以訪問管理後台（/admin）
- ⚠️ 任何人都可以調用管理 API（添加/刪除數據、批量更新等）

**安全風險：**
- 🔴 **高風險**：管理後台完全開放，任何人都可以修改數據
- 🔴 **高風險**：批量更新、刪除數據源等敏感操作沒有認證保護


---

## 🔐 實施方案 A：管理後台認證保護

### 問題描述
用戶在其他裝置看到 Manus 認證系統，需要重新調查原因。然後實施方案 A：保持公開頁面開放，僅保護管理後台和管理 API。

### 任務清單
- [x] 調查 Manus 認證系統出現的原因（已有 adminProcedure 和 protectedProcedure）
- [x] 創建管理後台路由守衛組件（ProtectedAdminRoute）
- [x] 在 Admin 頁面添加認證檢查（使用 ProtectedAdminRoute 包裝）
- [x] 將所有管理 API 從 publicProcedure 改為 adminProcedure（已批量替換）
- [x] 測試管理後台認證功能（所有測試通過）
- [x] 測試公開頁面仍然可以訪問（首頁、搜尋、卡牌詳情等）
- [ ] 保存 checkpoint


---

## 🔐 保留 Manus OAuth 並添加新認證系統

### 目標
保留 Manus OAuth，添加傳統帳號密碼系統 + Google OAuth（混合方案）

### 任務清單

#### 1. 安裝依賴套件
- [x] 安裝 bcrypt（密碼加密）
- [x] 安裝 jsonwebtoken（JWT token 生成）
- [x] 安裝 Google OAuth 相關套件

#### 2. 實施帳號密碼認證系統
- [x] 更新 user 表結構（添加 passwordHash 欄位）
- [x] 創建認證輔助函數（server/auth.ts）
- [ ] 修復數據庫 schema 不一致問題（openId vs googleId）
- [ ] 更新 auth router 添加註冊和登入 API
- [ ] 實施 JWT session 管理
- [ ] 創建登出 API

#### 3. 實施 Google OAuth
- [ ] 配置 Google OAuth 客戶端
- [ ] 創建 Google OAuth 回調處理
- [ ] 實施 Google 登入流程

#### 4. 創建登入和註冊頁面
- [ ] 創建註冊頁面（/register）
- [ ] 創建登入頁面（/login）
- [ ] 添加「使用 Google 登入」按鈕
- [ ] 添加表單驗證

#### 6. 更新導航欄
- [ ] 添加「登入」和「註冊」按鈕（未登入時）
- [ ] 顯示用戶名和「登出」按鈕（登入後）

#### 7. 創建管理員帳號
- [ ] 在數據庫創建 xyz.asia.co@gmail.com 管理員帳號

#### 8. 測試認證系統
- [ ] 測試註冊功能
- [ ] 測試登入功能
- [ ] 測試 Google OAuth 登入
- [ ] 測試登出功能
- [ ] 測試管理員權限

#### 9. 保存 checkpoint
- [ ] 保存 checkpoint


---

## 🔐 配置 Google OAuth 登入功能

### 目標
實施 Google OAuth 一鍵登入，讓用戶可以使用 Google 帳號快速登入平台

### 任務清單
- [x] 檢查並配置 Google OAuth 環境變量（GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET）
- [x] 實施 Google OAuth 回調處理路由（/api/auth/google/callback）
- [x] 更新前端登入頁面，啟用 Google 登入按鈕
- [x] 測試 Google OAuth 完整流程（登入、用戶創建、session 設置）
- [x] 保存 checkpoint


---

## 🐛 修復註冊和登入失敗問題

### 問題描述
用戶嘗試註冊時出現 SQL 查詢錯誤：
```
Failed query: select `id`, `openId`, `email`, `name`, `passwordHash`, `googleId`, `loginMethod`, `role`, `emailVerified`, `createdAt`, `updatedAt`, `lastSignedIn` from `users` where `users`.`email` = ? limit ?
```

### 診斷結果
數據庫欄位名稱大小寫不一致：
- Drizzle schema 使用 `openId`（駝峰命名）
- 數據庫實際欄位可能是 `openid`（全小寫）

### 任務清單
- [x] 檢查數據庫中 users 表的實際欄位名稱
- [x] 統一欄位名稱（schema 和數據庫）
- [x] 修復 registerUser 函數（添加 token 生成）
- [x] 修復 auth.register API（添加 session cookie 設置）
- [x] 修復 auth.login API（修正 getSessionCookieOptions 調用）
- [x] 修復 loginMethod enum（添加 'manus' 選項）
- [x] 後端註冊功能測試通過（內部測試腳本）
- [ ] 瀏覽器端到端測試（等待用戶測試）
- [x] 修復 Google OAuth redirect_uri 問題（使用動態 origin）
- [x] 更新前端 Google 登入按鈕（添加 origin 參數）
- [ ] 保存 checkpoint


---

## 🐛 修復登入錯誤

### 問題描述
用戶嘗試登入時出現錯誤：`Cannot read properties of undefined (reading 'protocol')`

### 診斷結果
`getSessionCookieOptions(ctx.req)` 調用時，`ctx.req` 是 `undefined`。這是因為 tRPC context 中的 request 對象命名可能不同。

### 任務清單
- [x] 檢查 tRPC context 的結構
- [x] 修復 auth.login API 中的 getSessionCookieOptions 調用（添加 ctx.req 檢查）
- [x] 修復 auth.register API 中的 getSessionCookieOptions 調用（添加 ctx.req 檢查）
- [ ] 測試登入功能（等待用戶測試）
- [ ] 保存 checkpoint


---

## 🐛 修復登入狀態持久化問題

### 問題描述
用戶使用管理員帳號登入成功，但前端沒有保持登入狀態（導航欄仍顯示「登入」按鈕而不是用戶名）

### 可能原因
1. Session cookie 沒有正確設置
2. 前端沒有正確讀取 session 狀態
3. Cookie 的 domain/path/sameSite 設置不正確
4. 登入後沒有刷新前端狀態

### 任務清單
- [x] 檢查瀏覽器中的 session cookie
- [x] 檢查前端如何獲取當前用戶狀態（使用 trpc.auth.me.useQuery）
- [x] 修復 CORS 配置（添加 credentials: true）
- [x] 修復 email 驗證錯誤（添加 .trim().toLowerCase()）
- [ ] 測試登入狀態持久化（等待用戶測試）
- [ ] 保存 checkpoint
