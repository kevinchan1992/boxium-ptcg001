# BOXIUM 拍賣功能開發方案

**版本：** v1.0  
**日期：** 2026-03-30  
**作者：** Manus AI

---

## 一、方案總覽

本文件根據三份參考文件的核心建議，結合 BOXIUM PTCG 平台現有架構（Marketplace、訂單系統、Stripe Connect、爭議處理、訊息系統），整理出一套可落地的拍賣功能開發方案。方案的核心原則是：**拍賣不是獨立系統，而是市集內的一種交易模式**，與現有直購（Buy Now）和議價（Offer）共用同一套用戶、商品、訂單、訊息、爭議、通知和 Stripe Connect 結算架構。

---

## 二、市集分區設計

### 2.1 市集雙分區架構

現有 `/marketplace` 頁面將分為兩個主要分區，透過頂部 Tab 切換：

| 分區 | 路由 | 說明 |
|------|------|------|
| **商城** (Shop) | `/marketplace?tab=shop` | 現有的直購 + 議價交易，保持不變 |
| **拍賣** (Auction) | `/marketplace?tab=auction` | 新增的拍賣競價交易 |

兩個分區共用同一套篩選器（TCG 遊戲系列、品相、排序），但各自有獨立的商品列表和展示邏輯。預設顯示「商城」分區，確保現有用戶體驗不受影響。

### 2.2 分區 UI 設計

商城分區沿用現有的 ProductCard 網格佈局。拍賣分區則採用強調「倒數計時」和「當前最高價」的卡片設計，每張拍賣卡片需顯示：

- 商品縮圖與 TCG 系列標籤
- 當前最高出價（或起標價）
- 出價次數
- 結標倒數計時器（動態更新）
- 「保留價已達」/「保留價未達」標記（如適用）
- 「一口價」快捷按鈕（如適用）

---

## 三、交易模式定義

平台將支援三種交易模式，透過 `listingMode` 欄位區分：

| 模式 | `listingMode` 值 | 說明 |
|------|-------------------|------|
| **直購** | `buy_now` | 現有模式，買家按標價直接購買 |
| **議價** | `offer` | 現有模式，買家提出出價，賣家接受/拒絕 |
| **拍賣** | `auction` | 新增模式，限時競價，最高出價者得標 |

三種模式共用 `marketplaceListings` 表，透過 `listingMode` 欄位區分。現有的 `buy_now` 和 `offer` 模式不受影響，`listingMode` 欄位預設為 `buy_now`，確保向後相容。

---

## 四、資料庫設計

### 4.1 `marketplaceListings` 表新增欄位

在現有表上擴展拍賣相關欄位，而非建立獨立的拍賣表。這樣做的好處是所有商品共用同一套審核流程、搜尋索引和管理後台。

| 欄位 | 類型 | 說明 |
|------|------|------|
| `listingMode` | enum(`buy_now`, `offer`, `auction`) | 交易模式，預設 `buy_now` |
| `auctionStartAt` | timestamp | 拍賣開始時間（審核通過後生效） |
| `auctionEndAt` | timestamp | 拍賣結束時間 |
| `startingBid` | decimal(10,2) | 起標價（HKD） |
| `reservePrice` | decimal(10,2) | 保留價（可選，未達此價則流拍） |
| `buyNowPrice` | decimal(10,2) | 一口價（可選，買家可直接以此價購買） |
| `bidIncrement` | decimal(10,2) | 最小加價幅度（預設 5 HKD） |
| `currentHighestBid` | decimal(10,2) | 當前最高出價 |
| `currentHighestBidderId` | int | 當前最高出價者 user ID |
| `bidCount` | int | 總出價次數 |
| `auctionStatus` | enum | 拍賣狀態（見 4.3） |
| `antiSnipingMinutes` | int | 防狙擊延長分鐘數（預設 5） |
| `antiSnipingExtensions` | int | 已延長次數（上限 3 次） |
| `hasReserveMet` | boolean | 是否已達保留價 |
| `winnerId` | int | 最終得標者 user ID |
| `winningBidId` | int | 最終得標出價記錄 ID |
| `auctionTermsVersion` | varchar(20) | 賣家同意的拍賣條款版本 |

### 4.2 新增 `auctionBids` 表

獨立的出價記錄表，完整保留競價歷史，方便爭議追查和數據分析。

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | int PK | 自增主鍵 |
| `listingId` | int FK | 關聯 `marketplaceListings` |
| `bidderId` | int FK | 出價者 user ID |
| `amount` | decimal(10,2) | 出價金額（HKD） |
| `status` | enum(`active`, `outbid`, `winning`, `retracted`) | 出價狀態 |
| `ipHash` | varchar(64) | IP 雜湊（風控用） |
| `userAgent` | text | User-Agent（安全審計用） |
| `createdAt` | timestamp | 出價時間 |

### 4.3 拍賣狀態 `auctionStatus` 枚舉

拍賣狀態獨立於商品 `status`，形成以下流程：

```
draft → pending_review → scheduled → active → ending_soon → ended_sold / ended_no_bid
                                                                ↓
                                                            cancelled
```

| 狀態 | 說明 |
|------|------|
| `draft` | 賣家草稿 |
| `pending_review` | 等待管理員審核 |
| `scheduled` | 審核通過，等待開始時間 |
| `active` | 拍賣進行中 |
| `ending_soon` | 距結標 ≤ 15 分鐘（前端顯示用） |
| `ended_sold` | 正常結標且有得標者 |
| `ended_no_bid` | 結標但無人出價或未達保留價（流拍） |
| `cancelled` | 管理員取消或賣家在開始前取消 |

結標後的訂單狀態（`pending_payment` → `paid_held` → `shipped` → `completed` 等）沿用現有 `marketplaceOrders.orderStatus`，不在拍賣狀態中重複。

### 4.4 `marketplaceOrders` 表新增欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `orderSource` | enum(`direct`, `offer`, `auction`) | 訂單來源，預設 `direct` |
| `auctionId` | int | 關聯拍賣商品 ID（可為空） |
| `winningBidId` | int | 關聯得標出價記錄 ID（可為空） |

### 4.5 新增 `auctionAgreements` 表（條款確認記錄）

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | int PK | 自增主鍵 |
| `userId` | int FK | 用戶 ID |
| `role` | enum(`buyer`, `seller`) | 角色 |
| `termsVersion` | varchar(20) | 條款版本號 |
| `agreedAt` | timestamp | 同意時間 |
| `ipHash` | varchar(64) | IP 雜湊 |

### 4.6 新增 `auctionViolations` 表（違規記錄）

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | int PK | 自增主鍵 |
| `userId` | int FK | 違規用戶 ID |
| `type` | enum(`no_payment`, `fake_bid`, `seller_cancel`) | 違規類型 |
| `listingId` | int | 關聯商品 |
| `orderId` | int | 關聯訂單（如適用） |
| `penalty` | enum(`warning`, `ban_7d`, `ban_30d`, `permanent`) | 懲罰等級 |
| `banExpiresAt` | timestamp | 封禁到期時間 |
| `adminNote` | text | 管理員備註 |
| `createdAt` | timestamp | 記錄時間 |

---

## 五、核心業務流程

### 5.1 賣家建立拍賣

1. 賣家在「出售商品」頁面選擇交易模式為「拍賣」。
2. 填寫拍賣資訊：標題、描述、圖片、品相、TCG 系列、起標價、結標時間。
3. 可選設定：保留價、一口價、最小加價幅度（預設 5 HKD）、防狙擊延長分鐘數（預設 5 分鐘）。
4. 勾選賣家拍賣條款：「我確認有貨、我願意按最高出價成交、我接受平台規則」。
5. 提交後進入 `pending_review` 狀態，沿用現有審核流程。
6. 管理員審核通過後，狀態變為 `scheduled`（如設定了未來開始時間）或直接 `active`。

### 5.2 買家出價

1. 買家進入拍賣詳情頁，查看商品資訊、當前最高價、倒數計時、出價記錄。
2. 首次參與拍賣時，需閱讀並勾選買家拍賣條款（記錄到 `auctionAgreements`）。
3. 輸入出價金額，系統驗證：
   - 金額 ≥ 當前最高價 + 最小加價幅度（首次出價則 ≥ 起標價）
   - 用戶未被封禁拍賣權限
   - 用戶不是賣家本人
4. 確認彈窗：「您將以 HKD X 出價，出價具約束力，得標後需在 24 小時內付款。確認出價？」
5. 出價成功後：
   - 更新 `currentHighestBid`、`currentHighestBidderId`、`bidCount`
   - 前一位最高出價者的出價狀態更新為 `outbid`
   - 發送站內通知 + Email 給被超越的出價者
   - 發送站內通知給賣家

### 5.3 防狙擊延長機制

若在結標前最後 `antiSnipingMinutes` 分鐘內有人出價，系統自動延長結標時間 `antiSnipingMinutes` 分鐘，最多延長 3 次。這可以有效防止「最後一秒狙擊」行為，讓所有出價者有公平的競爭機會。

### 5.4 一口價購買

如果賣家設定了 `buyNowPrice`，買家可隨時點擊「立即購買」以該價格成交。一口價購買會立即結束拍賣，建立訂單，進入付款流程。需注意：若已有出價且出價金額接近一口價，前端應提示買家考慮繼續競價。

### 5.5 結標處理

系統定時任務（每 30 秒）掃描所有 `auctionStatus = 'active'` 且 `auctionEndAt ≤ now()` 的拍賣：

1. **有出價且達保留價（或無保留價）**：標記 `winnerId`、`winningBidId`，狀態變 `ended_sold`，自動建立 `marketplaceOrders`（`orderSource = 'auction'`），訂單狀態 `pending_payment`。通知得標者付款、通知賣家成交。
2. **有出價但未達保留價**：狀態變 `ended_no_bid`（流拍），通知所有出價者流拍，通知賣家可重新上架。
3. **無人出價**：狀態變 `ended_no_bid`，通知賣家可重新上架。

### 5.6 中標後付款

得標者需在 **24 小時內** 完成付款（透過 Stripe Checkout），付款成功後訂單進入現有的 `paid_held → processing → shipped → delivered → completed` 流程。付款金額 = 得標價，平台費 = 得標價 × 5%，賣家實收 = 得標價 - 平台費。

### 5.7 棄標懲罰

若得標者在 24 小時內未付款：

1. 訂單自動取消（沿用現有 `paymentTimeoutCancelScheduler`）
2. 記錄一次 `no_payment` 違規到 `auctionViolations`
3. 根據累計違規次數自動懲罰：
   - 第 1 次：警告 + 站內通知
   - 第 2 次：封禁拍賣權限 7 天
   - 第 3 次及以上：封禁拍賣權限 30 天
4. 通知賣家，提供「重新上架」快捷入口

### 5.8 資金流與結算

拍賣訂單的資金流與現有市集訂單完全一致，採用 Stripe 的 **Separate Charges and Transfers** 模式：

1. 買家付款 → 資金進入平台 Stripe 帳戶（Stripe 託管）
2. 買家確認收貨（或 14 天自動完成）→ 平台透過 Stripe Connect Transfer 將款項（扣除 5% 平台費）劃轉至賣家 Stripe Connect 帳戶
3. 整個過程資金從未進入平台自有銀行帳戶

---

## 六、前端頁面架構

### 6.1 買家端

| 頁面 | 路由 | 說明 |
|------|------|------|
| 市集拍賣分區 | `/marketplace?tab=auction` | 拍賣商品列表，含篩選、排序、倒數計時 |
| 拍賣詳情頁 | `/marketplace/:id`（`listingMode=auction`） | 商品資訊、出價面板、出價記錄、倒數計時 |
| 出價彈窗 | 詳情頁內 Dialog | 金額輸入、條款確認、出價提交 |
| 我的競拍 | `/profile` 新增 Tab | 正在競拍、已得標待付款、歷史拍賣 |

### 6.2 賣家端

| 頁面 | 路由 | 說明 |
|------|------|------|
| 建立拍賣 | `/seller/listings/new?mode=auction` | 拍賣商品上架表單 |
| 拍賣管理 | `/seller` 新增 Tab | 進行中拍賣、出價監控、已結標拍賣 |

### 6.3 管理後台

| 頁面 | 路由 | 說明 |
|------|------|------|
| 拍賣審核 | Admin → 市集管理 → 拍賣審核 | 審核拍賣上架申請 |
| 拍賣監控 | Admin → 市集管理 → 拍賣監控 | 查看所有進行中拍賣、出價記錄、異常標記 |
| 違規管理 | Admin → 市集管理 → 違規記錄 | 棄標記錄、封禁管理、黑名單 |

---

## 七、API 規格（tRPC Procedures）

### 7.1 拍賣商品

| Procedure | 類型 | 權限 | 說明 |
|-----------|------|------|------|
| `auction.create` | mutation | protected (seller) | 建立拍賣商品 |
| `auction.update` | mutation | protected (seller) | 編輯拍賣（僅 draft/pending_review 狀態） |
| `auction.getById` | query | public | 取得拍賣詳情（含當前最高價、出價次數） |
| `auction.list` | query | public | 拍賣列表（含篩選、排序、分頁） |
| `auction.getSellerAuctions` | query | protected (seller) | 賣家的拍賣列表 |
| `auction.cancel` | mutation | protected (seller/admin) | 取消拍賣（僅限未開始或管理員） |

### 7.2 出價

| Procedure | 類型 | 權限 | 說明 |
|-----------|------|------|------|
| `auction.placeBid` | mutation | protected | 提交出價 |
| `auction.getBids` | query | public | 取得拍賣出價記錄（隱藏出價者身份） |
| `auction.getMyBids` | query | protected | 取得我的出價記錄 |
| `auction.buyNow` | mutation | protected | 一口價購買 |

### 7.3 條款與違規

| Procedure | 類型 | 權限 | 說明 |
|-----------|------|------|------|
| `auction.agreeTerms` | mutation | protected | 同意拍賣條款 |
| `auction.checkTermsAgreed` | query | protected | 檢查是否已同意條款 |
| `auction.getViolations` | query | admin | 取得違規記錄 |
| `auction.addViolation` | mutation | admin | 手動新增違規記錄 |
| `auction.checkBanStatus` | query | protected | 檢查用戶拍賣封禁狀態 |

### 7.4 管理員

| Procedure | 類型 | 權限 | 說明 |
|-----------|------|------|------|
| `auction.adminList` | query | admin | 管理員拍賣列表（含所有狀態） |
| `auction.adminApprove` | mutation | admin | 審核通過拍賣 |
| `auction.adminReject` | mutation | admin | 審核拒絕拍賣 |
| `auction.adminCancel` | mutation | admin | 強制取消拍賣 |
| `auction.adminGetBids` | query | admin | 查看完整出價記錄（含出價者身份） |
| `auction.adminGetStats` | query | admin | 拍賣統計數據 |

---

## 八、定時任務（Schedulers）

| 任務 | 頻率 | 說明 |
|------|------|------|
| `auctionEndProcessor` | 每 30 秒 | 掃描已結標拍賣，執行結標邏輯（建立訂單/標記流拍） |
| `auctionStartProcessor` | 每分鐘 | 將 `scheduled` 且已到開始時間的拍賣設為 `active` |
| `auctionEndingSoonNotifier` | 每 5 分鐘 | 通知出價者拍賣即將結束（結標前 1 小時） |
| `auctionPaymentTimeout` | 沿用現有 | 24 小時未付款自動取消訂單 + 記錄違規 |

---

## 九、通知規則

| 事件 | 通知對象 | 通知方式 |
|------|----------|----------|
| 新出價 | 賣家 | 站內通知 |
| 被超越 | 前最高出價者 | 站內通知 + Email |
| 拍賣即將結束（1 小時前） | 所有出價者 | 站內通知 |
| 拍賣結標（得標） | 得標者 | 站內通知 + Email |
| 拍賣結標（未得標） | 其他出價者 | 站內通知 |
| 拍賣結標（賣家） | 賣家 | 站內通知 + Email |
| 流拍 | 賣家 + 所有出價者 | 站內通知 |
| 付款提醒（12 小時） | 得標者 | 站內通知 + Email |
| 逾期未付款 | 得標者 + 賣家 | 站內通知 + Email |
| 拍賣審核通過/拒絕 | 賣家 | 站內通知 + Email |

---

## 十、條款與保障設計

### 10.1 買家條款重點

- 出價具有約束力，一旦提交不可隨意撤回。
- 得標後必須在 24 小時內完成付款。
- 逾期未付款視為棄標，將記錄違規並可能被限制拍賣權限。
- 爭議按平台現有流程處理。

### 10.2 賣家條款重點

- 上架即保證有貨，不得中途反悔。
- 必須按得標價格成交，不得拒絕履約。
- 必須在訂單確認後按時出貨。
- 惡意取消將受到懲罰（降低賣家評級、暫停拍賣權限）。

### 10.3 平台保障

- 所有拍賣商品需經管理員審核。
- 條款勾選記錄完整保留（含 IP、時間戳）。
- 出價記錄全程留痕，不可篡改。
- 出價者身份對外保密（僅顯示匿名化的出價記錄），防止私下騷擾。
- 違規累計自動觸發封禁，管理員可手動介入。

---

## 十一、MVP 開發範圍與分期

### Phase 1：MVP 核心（建議優先開發）

| 項目 | 說明 |
|------|------|
| 資料庫 Schema 擴展 | `marketplaceListings` 新增拍賣欄位、新增 `auctionBids` 表 |
| 市集分區 UI | Marketplace 頁面新增「拍賣」Tab |
| 賣家建立拍賣 | SellerDashboard 新增拍賣上架表單 |
| 管理員審核拍賣 | AdminMarketplace 新增拍賣審核 |
| 拍賣詳情頁 | 商品資訊 + 出價面板 + 倒數計時 + 出價記錄 |
| 出價功能 | 出價驗證 + 即時更新 + 條款確認 |
| 結標定時任務 | 自動結標 + 建立訂單 |
| 限時付款 | 24 小時付款期限 + 逾期取消 |
| 5% 平台費結算 | 沿用現有 Stripe Connect 結算邏輯 |

### Phase 2：體驗增強

| 項目 | 說明 |
|------|------|
| 防狙擊延長機制 | 最後 N 分鐘出價自動延長 |
| 一口價功能 | 買家可直接以一口價購買 |
| 保留價機制 | 未達保留價則流拍 |
| 棄標懲罰系統 | 違規記錄 + 自動封禁 |
| 拍賣通知完善 | 被超越通知、即將結標通知、結標通知 |
| 我的競拍頁面 | 買家查看自己的出價歷史和得標記錄 |

### Phase 3：進階功能（未來考慮）

| 項目 | 說明 |
|------|------|
| 自動代理出價（Proxy Bidding） | 用戶設定最高預算，系統自動按最小加價幅度競標 |
| 拍賣數據統計 | AdminDashboard 拍賣統計面板 |
| 賣家拍賣分析 | 成交率、平均溢價率等 |
| 拍賣保證金制度 | 出價前預授權小額金額 |
| 高價拍賣風控 | 新賣家額度限制、高價拍賣額外審核 |

---

## 十二、與現有系統的整合點

| 現有模組 | 整合方式 |
|----------|----------|
| `marketplaceListings` | 新增 `listingMode` 和拍賣相關欄位，共用審核流程 |
| `marketplaceOrders` | 新增 `orderSource`、`auctionId`、`winningBidId` 欄位 |
| `sellerProfiles` | 拍賣要求賣家 Stripe Connect 狀態為 `active` |
| Stripe Connect | 完全沿用現有 Separate Charges and Transfers 模式 |
| `orderMessages` | 拍賣訂單共用現有訊息系統 |
| 爭議系統 | 拍賣訂單可開啟爭議，流程與普通訂單一致 |
| 通知系統 | 沿用 `createNotification` + `sendEmail`，新增拍賣模板 |
| 物流系統 | 完全沿用現有物流方式（順豐、面交等） |
| 管理後台 | AdminMarketplace 新增拍賣管理 Tab |

---

## 十三、技術實作建議

### 13.1 即時更新策略

拍賣詳情頁的「當前最高價」和「倒數計時」需要接近即時的更新體驗。考慮到平台目前使用 Polling 而非 WebSocket，建議：

- 拍賣詳情頁：每 **5 秒** 輪詢一次當前最高價和出價次數
- 拍賣列表頁：每 **15 秒** 輪詢一次
- 倒數計時：前端本地計算，不依賴後端（僅在出價時同步伺服器時間）

### 13.2 並發出價處理

多人同時出價時需防止競態條件。建議在 `placeBid` procedure 中使用資料庫事務（transaction）+ 樂觀鎖（optimistic locking），確保出價金額驗證和更新是原子操作。

### 13.3 結標任務的可靠性

結標定時任務是拍賣系統的核心，必須確保：

- 使用 `node-cron` 每 30 秒執行一次（沿用現有 scheduler 架構）
- 每次執行使用資料庫事務，確保結標和建立訂單是原子操作
- 記錄執行日誌，便於排查問題
- 設定超時保護，避免單次執行阻塞

### 13.4 檔案結構建議

```
server/routers/auction.ts          ← 拍賣 tRPC router
server/db/auction.ts               ← 拍賣資料庫查詢函數
server/services/schedulers/
  auctionEndProcessor.ts           ← 結標定時任務
  auctionStartProcessor.ts         ← 開始定時任務
  auctionEndingSoonNotifier.ts     ← 即將結標通知
client/src/pages/AuctionDetail.tsx ← 拍賣詳情頁
client/src/components/BidPanel.tsx ← 出價面板組件
client/src/components/BidHistory.tsx ← 出價記錄組件
client/src/components/AuctionCard.tsx ← 拍賣卡片組件
client/src/components/AuctionCountdown.tsx ← 倒數計時組件
```

---

## 十四、風險與注意事項

1. **並發出價的資料一致性**：必須使用資料庫事務和鎖機制，避免同一時間多人出價導致金額錯誤。
2. **結標任務的單點故障**：建議加入重試機制和告警，確保結標任務不會因為單次失敗而遺漏。
3. **時區問題**：所有時間戳使用 UTC 存儲，前端根據用戶時區顯示。倒數計時使用伺服器時間校準。
4. **保留價的隱私**：保留價金額不應對買家公開，僅顯示「已達保留價」/「未達保留價」。
5. **賣家 Stripe Connect 狀態**：結標建立訂單時，需驗證賣家 Stripe Connect 狀態為 `active`，否則阻止建立並通知管理員。
6. **向後相容**：`listingMode` 預設為 `buy_now`，確保現有商品和訂單不受影響。`orderSource` 預設為 `direct`，確保現有訂單不受影響。

---

## 十五、名稱規範與合規

對外文件和用戶介面中，應使用以下表述：

- 「平台提供交易撮合與結算服務」
- 「成交後按規則向賣家結算」
- 「平台收取 5% 服務費」
- 「資金由 Stripe 託管，確認收貨後自動轉給賣家」

避免使用「代收代付」等可能引起監管疑慮的表述。技術上，這是 Stripe 的 Separate Charges and Transfers 標準模式，資金從未進入平台自有銀行帳戶。
