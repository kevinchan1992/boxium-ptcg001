# BOXIUM PTCG 交易流程全面分析報告

**文件版本**：v1.0  
**分析日期**：2026-03-27  
**分析範圍**：前後端完整交易流程、付款邏輯、訂單狀態機、邊緣案例

---

## 目錄

1. [平台架構概覽](#1-平台架構概覽)
2. [商品類型與付款方式矩陣](#2-商品類型與付款方式矩陣)
3. [訂單狀態機](#3-訂單狀態機)
4. [交易場景一：單件商品 Stripe 直接購買（C2C 賣家商品）](#4-交易場景一)
5. [交易場景二：單件商品 Alipay HK 購買（平台自營商品）](#5-交易場景二)
6. [交易場景三：購物車批量結帳（Stripe）](#6-交易場景三)
7. [交易場景四：購物車批量結帳（Alipay HK）](#7-交易場景四)
8. [交易場景五：出價洽議後付款](#8-交易場景五)
9. [交易場景六：訂單取消與退款](#9-交易場景六)
10. [交易場景七：爭議處理](#10-交易場景七)
11. [賣家放款流程](#11-賣家放款流程)
12. [自動化排程機制](#12-自動化排程機制)
13. [已識別的邏輯問題與風險](#13-已識別的邏輯問題與風險)
14. [改善建議](#14-改善建議)

---

## 1. 平台架構概覽

BOXIUM PTCG 是一個面向香港市場的 TCG（集換式卡牌遊戲）交易平台，支援 Pokémon 和 One Piece 兩個遊戲系列。平台採用雙軌商業模式：

**商品類型**：

| 類型 | `sellerType` | 說明 | 付款方式 |
|------|-------------|------|---------|
| 平台自營 | `platform` | BOXIUM 官方直接銷售 | Stripe 或 Alipay HK |
| C2C 個人賣家 | `seller` | 第三方賣家上架 | **僅限 Stripe** |

**核心技術棧**：React + TypeScript + tRPC + Prisma（Drizzle ORM）+ MySQL/TiDB，部署於 Manus 平台。

**付款整合**：
- **Stripe**：信用卡/借記卡付款，支援 Destination Charge（C2C 訂單直接轉帳至賣家 Stripe Connect 帳戶）
- **Alipay HK**：靜態 QR Code 掃碼付款，需人工審核截圖確認收款

---

## 2. 商品類型與付款方式矩陣

平台在前後端均實施了嚴格的付款方式限制：

### 前端限制（`Cart.tsx`）

購物車結帳時，若購物車中包含任何 C2C 賣家商品，系統會自動將付款方式切換為 Stripe，並禁用 Alipay HK 選項：

```typescript
// P0: Auto-switch to Stripe if Alipay HK is selected but cart has seller items
useEffect(() => {
  if (hasSellerItems && form.paymentMethod === "alipay_hk") {
    setForm((f) => ({ ...f, paymentMethod: "stripe" }));
  }
}, [hasSellerItems, form.paymentMethod, setForm]);
```

### 後端限制（`marketplace.ts`）

三個後端端點均有對應的 sellerType 驗證：

| 端點 | 限制邏輯 |
|------|---------|
| `createOrder` | `alipay_hk + sellerType=seller` → 拋出 BAD_REQUEST |
| `createBatchAlipayOrder` | 任何 item 的 `sellerType=seller` → 拋出 BAD_REQUEST |
| `createAlipayOrder` | **無 sellerType 限制** ⚠️（見問題 #1） |

### Stripe 最低金額限制

Stripe 要求最低 HKD 4.00 的付款金額。若商品金額低於此閾值，前端顯示警告提示使用 Alipay HK，後端亦會拋出錯誤。

---

## 3. 訂單狀態機

### `orderStatus` 完整狀態流轉

```
pending_payment
    │
    ├─── [Stripe 付款成功 / Alipay 管理員確認] ──→ payment_received
    │                                                      │
    │                                                      ▼
    │                                                  processing
    │                                                      │
    │                                                      ▼
    │                                                   shipped ──→ [14天後自動] ──→ completed
    │                                                      │                              │
    │                                                      ▼                              │
    │                                                  delivered                          │
    │                                                      │                              │
    │                                                      └──→ [買家確認] ──→ completed ──┘
    │
    ├─── [超時未付款] ──→ cancelled
    │
    └─── [任意階段] ──→ disputed
                              │
                              └──→ [爭議解決] ──→ completed / refunded / cancelled
```

### `paymentStatus` 狀態

| 值 | 含義 |
|----|------|
| `pending` | 等待付款 |
| `paid` | 已付款確認 |
| `failed` | 付款失敗 |
| `refunded` | 已退款 |
| `cancelled` | 已取消 |

### `alipayProofStatus` 狀態

| 值 | 含義 |
|----|------|
| `pending_review` | 截圖已上傳，等待管理員審核 |
| `approved` | 管理員已確認收款 |
| `rejected` | 截圖被拒絕，需重新上傳 |

### `payoutStatus` 狀態（賣家放款）

| 值 | 含義 |
|----|------|
| `not_applicable` | 不適用（平台自營商品） |
| `pending` | 等待放款 |
| `processing` | 放款處理中 |
| `completed` | Stripe Transfer 已完成 |
| `paid` | 手動放款已完成 |
| `failed` | 放款失敗 |
| `hold` | 暫緩放款 |

---

## 4. 交易場景一：單件商品 Stripe 直接購買（C2C 賣家商品）

### 完整流程

**步驟 1：買家瀏覽商品**
- 訪問 `/marketplace/:id`（`MarketplaceListing.tsx`）
- 頁面顯示商品資訊、賣家評分、市場價格對比

**步驟 2：買家點擊「加入購物車」**
- 呼叫 `trpc.marketplace.addToCart`
- 後端驗證商品狀態（active）和庫存
- 加入購物車後顯示飛入動畫和 toast 提示

**步驟 3：買家進入購物車結帳**
- 訪問 `/cart`，開啟結帳 Dialog
- **Step 1**：選擇送貨方式（順豐到付 SF COD / 面交）
  - 可選擇已儲存地址或填寫新地址
  - 面交訂單需填寫買家電話
- **Step 2**：確認訂單資訊和付款方式
  - C2C 商品：自動選擇 Stripe，Alipay HK 選項被禁用

**步驟 4：建立訂單**
- 呼叫 `trpc.marketplace.createBatchStripeOrder`
- 後端執行：
  1. 驗證所有商品狀態
  2. 取消同一商品的舊 Alipay 訂單（若存在）
  3. **原子性庫存預留**（`reserveListingStock`）
  4. 建立訂單記錄（`orderStatus: pending_payment`）
  5. 建立 Stripe Checkout Session（含所有商品 line items）
  6. 更新訂單的 `stripeSessionId`

**步驟 5：Stripe 付款**
- 買家被重定向至 Stripe Checkout 頁面
- 支援信用卡和 Alipay（Stripe 原生 Alipay，非 Alipay HK）
- 付款成功後重定向至 `/cart?success=true&orders=...`

**步驟 6：Stripe Webhook 處理**
- 接收 `checkout.session.completed` 事件
- 更新訂單：`paymentStatus: paid`，`orderStatus: payment_received`
- 標記商品為 `sold`
- 通知買家付款成功（App 通知 + Email）
- 通知賣家新訂單（App 通知 + Email）

**步驟 7：賣家處理訂單**
- 賣家在 `/seller` 頁面看到新訂單
- 賣家標記出貨（填寫物流單號）
  - 呼叫 `trpc.marketplace.adminUpdateOrderStatus`（賣家使用此端點）
  - `orderStatus: shipped`，設定 `autoCompleteAt = 14天後`
- 買家收到出貨通知

**步驟 8：訂單完成**
- **方式 A**：買家手動確認收貨
  - 呼叫 `trpc.marketplace.confirmReceipt`
  - `orderStatus: completed`，觸發 `executeSellerPayout`
- **方式 B**：14 天後自動完成
  - 排程每小時執行，檢查 `autoCompleteAt <= now`
  - 自動設定 `orderStatus: completed`，觸發 `executeSellerPayout`

**步驟 9：賣家放款**
- `executeSellerPayout` 建立 Stripe Transfer
- 從平台帳戶轉帳至賣家 Stripe Connect 帳戶
- 金額 = `sellerReceivableHkd`（扣除平台手續費後）

---

## 5. 交易場景二：單件商品 Alipay HK 購買（平台自營商品）

### 完整流程

**步驟 1-2**：同場景一（瀏覽商品、加入購物車）

**步驟 3：Alipay HK 付款流程**（在商品詳情頁直接購買）
- 買家點擊「支付寶 HK 付款」按鈕（`showAlipay` Dialog）
- **Step QR**：顯示靜態 Alipay HK QR Code
  - 提示買家在備注欄填寫商品編號
  - 點擊「我已付款」進入下一步
- **Step Shipping**：填寫收貨地址
  - 可選擇已儲存地址
  - 支援順豐自提站搜尋
- **Step Upload**：上傳付款截圖
  - 呼叫 `trpc.marketplace.verifyPaymentProof`（AI 驗證）
  - AI 驗證三項：收款方（零度有限公司）、金額、付款狀態（成功）
  - 驗證通過：顯示「✅ 提交訂單」按鈕
  - 驗證未通過：顯示警告但仍可提交（待人工核對）

**步驟 4：建立 Alipay 訂單**
- 呼叫 `trpc.marketplace.createAlipayOrder`
- 後端執行：
  1. 驗證商品狀態和庫存
  2. 若存在舊 Stripe 訂單，取消之
  3. 若存在舊 Alipay 訂單，更新截圖（冪等性）
  4. 建立新訂單（`paymentMethod: alipay_hk`，`orderStatus: pending_payment`）
  5. 通知管理員審核

**步驟 5：管理員審核**
- 管理員在 `/admin` → 商場管理 → 查看待審核訂單
- 查看截圖，確認收款資訊
- **核准**：呼叫 `adminConfirmAlipayPayment`
  - `paymentStatus: paid`，`orderStatus: payment_received`
  - 標記商品為 `sold`
  - 通知買家付款已確認
- **拒絕**：呼叫 `adminRejectAlipayPayment`
  - 重置訂單至 `pending_payment`，清除截圖
  - 設定 `alipayProofStatus: rejected`，記錄拒絕原因
  - 通知買家重新上傳截圖（App 通知 + Email）

**步驟 6：買家重新提交（若被拒絕）**
- 買家在訂單詳情頁看到拒絕原因
- 呼叫 `trpc.marketplace.resubmitAlipayProof` 重新上傳
- 管理員再次審核

**步驟 7-9**：同場景一（出貨、確認收貨、完成）

> **注意**：平台自營商品的放款不涉及 Stripe Transfer，`payoutStatus` 設為 `not_applicable`。管理員可使用 `adminManualPayout` 記錄離線銀行轉帳。

---

## 6. 交易場景三：購物車批量結帳（Stripe）

### 完整流程

**步驟 1**：買家將多件商品加入購物車

**步驟 2**：購物車預檢
- 結帳前重新驗證所有商品狀態（`getMyCart.fetch()`）
- 若有商品已下架，自動移除並提示買家

**步驟 3**：建立批量 Stripe 訂單
- 呼叫 `trpc.marketplace.createBatchStripeOrder`
- 後端執行：
  1. 驗證所有商品（含庫存預留）
  2. 建立 CartOrder（主訂單記錄）
  3. 為每件商品建立獨立子訂單
  4. 建立**單一** Stripe Checkout Session（包含所有商品的 line items）
  5. 更新所有子訂單的 `stripeSessionId`

**步驟 4**：Stripe 付款（單次付款覆蓋所有訂單）

**步驟 5**：Webhook 處理批量訂單
- 從 `metadata.batch_order_nos` 解析所有訂單號
- 逐一更新每個子訂單的狀態
- 各訂單獨立通知買家和賣家

**步驟 6-9**：各子訂單獨立進行出貨和完成流程

### 批量訂單的特殊邏輯

- 每個子訂單有獨立的 `orderNo`，但共享同一個 `stripeSessionId`
- `batchRef` 欄位記錄批次標識，用於關聯查詢
- `cartOrderId` 欄位連結至主 CartOrder 記錄
- 各子訂單可獨立取消（不影響其他子訂單）

---

## 7. 交易場景四：購物車批量結帳（Alipay HK）

### 完整流程

**步驟 1**：購物車預檢（同場景三）

**步驟 2**：付款方式限制
- 若購物車含任何 C2C 賣家商品，Alipay HK 選項被禁用
- 後端 `createBatchAlipayOrder` 亦有相同限制

**步驟 3**：建立批量 Alipay 訂單
- 呼叫 `trpc.marketplace.createBatchAlipayOrder`
- 後端建立多個獨立訂單（每件商品一個）

**步驟 4**：顯示 QR Code（Step 3）
- 購物車結帳 Dialog 進入 Step 3（掃碼付款）
- 顯示靜態 Alipay HK QR Code
- 顯示所有訂單號，提示買家在備注欄填寫

**步驟 5**：上傳截圖（Step 4）
- 買家上傳一張截圖（適用於所有批量訂單）
- 呼叫 `trpc.marketplace.submitBatchAlipayProof`
- 同一截圖 URL 關聯至所有訂單

**步驟 6-9**：管理員批量審核，各訂單獨立完成

---

## 8. 交易場景五：出價洽議後付款

### 出價流程

**步驟 1**：買家出價
- 呼叫 `trpc.marketplace.makeOffer`
- 最低出價 = 定價的 70%（前端驗證）
- 出價有效期：預設 48 小時（可配置）

**步驟 2**：賣家回應
- 賣家在 `/seller` 頁面看到出價通知
- 可接受或拒絕出價
- 接受後：`offer.status: accepted`，通知買家

**步驟 3**：買家付款
- 買家在商品頁看到「賣家已接受出價！」橫幅
- 使用出價金額（`effectivePrice = offerPriceHkd`）付款
- 可選擇「加入購物車付款」或直接 Stripe/Alipay 付款

**步驟 4**：訂單建立
- 付款時傳入 `offerId`，後端使用出價金額而非定價
- 後端驗證 offer 屬於當前買家且狀態為 `accepted`

### 出價超時處理

- 排程每 10 分鐘執行，檢查已接受出價是否超過 24 小時未付款
- 超時後：`offer.status: expired`，通知買家

---

## 9. 交易場景六：訂單取消與退款

### 買家取消（`pending_payment` 狀態）

- 呼叫 `trpc.marketplace.buyerCancelOrder`
- 僅允許 `pending_payment` 狀態取消
- 恢復商品庫存（`restoreListingStock`）
- 標記相關 offer 為 `expired`

### 自動取消（付款超時）

- 排程每 10 分鐘執行
- 超時時間從 `systemSettings` 讀取（預設可配置）
- 取消訂單、恢復庫存、通知買家和賣家

### Stripe 退款

- 管理員可透過 `adminUpdateOrderStatus` 設定 `cancelled` 狀態
- 若訂單已付款（`paymentStatus: paid`），後端自動呼叫 Stripe Refund API
- 退款金額 = 原付款金額

### Alipay HK 退款

- 無自動退款機制（Alipay HK 靜態 QR 無法程式化退款）
- 需管理員手動處理離線退款
- 可在 `adminNote` 欄位記錄退款備注

---

## 10. 交易場景七：爭議處理

### 爭議開啟

- 買家在訂單詳情頁提交爭議（`orderStatus: disputed`）
- 需填寫爭議原因，可上傳圖片/影片作為證據
- 爭議期間不可確認收貨

### 爭議處理

- 管理員在後台查看爭議詳情和證據
- 可更新爭議優先級（high/medium/low）
- 爭議解決後記錄至 `disputeResolutionHistory`

### 爭議結果

- **買家勝訴**：訂單取消並退款
- **賣家勝訴**：訂單正常完成，觸發賣家放款
- **部分退款**：管理員手動處理

---

## 11. 賣家放款流程

### Stripe Transfer（C2C 訂單）

放款由 `executeSellerPayout` 函數集中處理，在以下三個時機觸發：

| 觸發時機 | 函數 |
|---------|------|
| 買家手動確認收貨 | `confirmReceipt` |
| 14 天自動完成 | `autoCompleteOrdersScheduler` |
| 管理員手動完成訂單 | `adminUpdateOrderStatus` |

**放款邏輯**：
1. 驗證訂單狀態（`completed`）和賣家 Stripe Connect 狀態（`active`）
2. 查找 Stripe PaymentIntent 的 Charge ID（`source_transaction`）
3. 建立 Stripe Transfer：從平台帳戶轉帳至賣家 `stripeConnectId`
4. 更新 `payoutStatus: completed`，記錄 `stripeTransferId`

**冪等性保護**：若 `payoutStatus` 已為 `completed`，跳過放款。

### 手動放款（Alipay HK 訂單）

- 管理員呼叫 `adminManualPayout`
- 記錄 `manualPayoutAt`、`manualPayoutNote`、`manualPayoutProofUrl`
- 通知賣家款項已放款

---

## 12. 自動化排程機制

| 排程名稱 | 執行頻率 | 功能 |
|---------|---------|------|
| `autoCompleteOrdersScheduler` | 每小時 | 14 天後自動完成已出貨訂單 |
| `paymentTimeoutCancelScheduler` | 每 10 分鐘 | 取消超時未付款訂單 |
| `shippingReminderScheduler` | 每小時 | 提醒賣家 3 天內未出貨的訂單 |
| `confirmReceiptReminderScheduler` | 每小時 | 提醒買家確認收貨（出貨後 7 天） |
| `startAlipayReviewReminderScheduler` | 每小時 | 提醒管理員審核超過 24 小時的截圖 |
| `offerExpirationScheduler` | 定期 | 自動過期已到期的出價 |
| `trendingCardsScheduler` | 每日 06:00 HKT | 更新熱門卡牌排行 |

---

## 13. 已識別的邏輯問題與風險

### 問題 #1：`createAlipayOrder` 缺少 C2C 賣家限制 ⚠️ 高風險

**位置**：`server/routers/marketplace.ts`，`createAlipayOrder` 端點

**問題描述**：`createAlipayOrder`（單件商品直接購買）沒有驗證 `listing.sellerType`，理論上允許買家對 C2C 賣家商品使用 Alipay HK 付款。雖然前端在商品詳情頁沒有直接顯示 Alipay HK 按鈕（Alipay 按鈕需要手動觸發 `showAlipay`），但若有人直接呼叫 API，可以繞過此限制。

**影響**：C2C 賣家可能收到 Alipay HK 訂單，但平台無法自動向賣家放款（Alipay HK 是平台收款，不是賣家收款）。

**修復建議**：在 `createAlipayOrder` 中加入以下驗證：
```typescript
if (listing.sellerType === "seller") {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "個人賣家商品僅支援 Stripe 信用卡付款",
  });
}
```

---

### 問題 #2：Alipay HK 批量訂單使用單一截圖 ⚠️ 中風險

**位置**：`Cart.tsx`，`submitBatchAlipayProof`

**問題描述**：購物車批量 Alipay 結帳時，買家只需上傳一張截圖，該截圖 URL 會關聯至所有批量訂單。若買家購買了多件商品，截圖中的金額應為所有商品的總金額，但 AI 驗證只驗證單件商品的金額。

**影響**：
- AI 驗證可能誤判（截圖金額 = 總金額，但驗證時比對的是單件金額）
- 管理員需要人工核對，增加審核負擔

**修復建議**：批量訂單的 AI 驗證應比對總金額，或在截圖上傳時明確提示買家截圖金額應為所有訂單的總和。

---

### 問題 #3：`checkout.session.expired` 不自動取消訂單 ⚠️ 中風險

**位置**：`server/_core/index.ts`，Stripe Webhook 處理

**問題描述**：當 Stripe Checkout Session 過期時，Webhook 只通知買家，但不取消對應的訂單。訂單仍停留在 `pending_payment` 狀態，商品庫存仍被鎖定。雖然付款超時排程最終會取消訂單，但存在時間差（最長 10 分鐘）。

**影響**：商品可能被短暫鎖定，其他買家無法購買。

**修復建議**：在 `checkout.session.expired` Webhook 中，同時取消對應訂單並恢復庫存。

---

### 問題 #4：`adminManualPayout` 的條件判斷邏輯錯誤 ⚠️ 低風險

**位置**：`server/routers/marketplace.ts`，`adminManualPayout`

**問題描述**：
```typescript
if (order.paymentMethod !== 'alipay_hk' && order.sellerType !== 'seller') {
  throw new TRPCError({ ... });
}
```
此條件使用 `&&`，意味著只有當「不是 Alipay HK 訂單」**且**「不是 C2C 賣家訂單」時才拋出錯誤。這允許了：
- Stripe 付款的 C2C 賣家訂單（`paymentMethod=stripe, sellerType=seller`）使用手動放款
- Alipay HK 的平台自營訂單（`paymentMethod=alipay_hk, sellerType=platform`）使用手動放款

這可能是預期行為（管理員需要靈活處理），但邏輯表達不夠清晰。

**修復建議**：加入更明確的條件判斷，或在代碼中添加詳細注釋說明設計意圖。

---

### 問題 #5：批量 Stripe 訂單的 Webhook 處理中，單件訂單路徑缺少 CartOrder 更新 ⚠️ 低風險

**位置**：`server/_core/index.ts`，`checkout.session.completed` 處理

**問題描述**：Webhook 處理分為「批量訂單」和「單件訂單」兩個路徑。在單件訂單路徑中，有嘗試更新 `cartOrder`，但邏輯較複雜，可能存在 CartOrder 未正確更新的情況。

---

### 問題 #6：面交訂單的聯絡電話洩露時機 ⚠️ 隱私風險

**位置**：`server/routers/marketplace.ts`，`getOrderByNo`

**問題描述**：面交訂單在 `orderStatus = completed` 後才揭露賣家電話和買家電話。但在訂單完成前，買賣雙方可能需要聯絡安排面交時間和地點。

**影響**：買賣雙方在訂單完成前無法直接聯絡，可能導致面交安排困難。

**修復建議**：考慮在 `orderStatus = shipped`（或面交訂單的對應狀態）時揭露聯絡電話，或提供平台內部通訊功能。

---

### 問題 #7：Alipay HK 訂單的退款流程不完整 ⚠️ 業務風險

**問題描述**：Alipay HK 訂單取消後，平台沒有自動退款機制。管理員需要手動處理退款，但系統沒有追蹤退款狀態的欄位（只有 `manualPayoutNote`）。

**影響**：退款流程不透明，買家無法追蹤退款進度。

**修復建議**：新增 `alipayRefundStatus` 欄位，並建立退款記錄表。

---

### 問題 #8：賣家出貨後 `orderStatus` 跳過 `processing` 狀態 ⚠️ 低風險

**問題描述**：`adminUpdateOrderStatus` 允許賣家直接將訂單從 `payment_received` 設為 `shipped`，跳過 `processing` 狀態。雖然 `processing` 狀態在排程通知中有使用，但狀態機沒有強制執行順序。

---

## 14. 改善建議

### 優先級 P0（立即修復）

**1. 修復 `createAlipayOrder` 的 C2C 限制**

在 `createAlipayOrder` 中加入 `sellerType` 驗證，防止 C2C 賣家商品使用 Alipay HK 付款。這是安全漏洞，可能導致資金流向錯誤。

**2. 修復 `checkout.session.expired` 自動取消訂單**

在 Stripe Webhook 中，`checkout.session.expired` 事件應同時取消訂單並恢復庫存，而不只是通知買家。

---

### 優先級 P1（近期改善）

**3. 批量 Alipay 訂單的 AI 驗證改善**

批量訂單的截圖驗證應比對**總金額**，並在 UI 中明確顯示「請轉帳總金額 HKD X.XX」。

**4. 面交訂單的聯絡機制**

在訂單狀態為 `payment_received` 或 `processing` 時，允許買賣雙方透過平台內部訊息系統聯絡，或在訂單確認後立即揭露聯絡電話。

**5. Alipay HK 退款追蹤**

新增退款記錄和狀態追蹤，讓買家能看到退款進度。

---

### 優先級 P2（長期優化）

**6. 訂單狀態機強制執行**

在後端加入狀態轉換驗證，確保訂單按照預定順序流轉（例如：不允許從 `pending_payment` 直接跳到 `completed`）。

**7. 批量訂單的原子性**

目前批量訂單建立是逐一處理的，若中途失敗可能導致部分訂單建立、部分失敗。考慮使用資料庫事務確保原子性。

**8. 賣家放款失敗的重試機制**

`executeSellerPayout` 失敗後，目前只記錄錯誤日誌，沒有自動重試機制。建議新增放款重試排程，自動重試失敗的放款。

**9. 訂單超時時間的動態配置**

付款超時時間已從 `systemSettings` 讀取，但 Alipay HK 審核 SLA（24 小時）是硬編碼的。建議統一從 `systemSettings` 讀取所有時間配置。

**10. 爭議處理的自動化**

目前爭議處理完全依賴管理員手動操作，建議加入爭議處理 SLA 追蹤和自動升級機制。

---

## 附錄：關鍵 API 端點清單

| 端點 | 類型 | 功能 |
|------|------|------|
| `marketplace.createStripeOrder` | mutation | 單件商品 Stripe 直接購買 |
| `marketplace.createAlipayOrder` | mutation | 單件商品 Alipay HK 直接購買 |
| `marketplace.createBatchStripeOrder` | mutation | 購物車批量 Stripe 結帳 |
| `marketplace.createBatchAlipayOrder` | mutation | 購物車批量 Alipay HK 結帳 |
| `marketplace.submitAlipayProof` | mutation | 上傳單件 Alipay 截圖 |
| `marketplace.submitBatchAlipayProof` | mutation | 上傳批量 Alipay 截圖 |
| `marketplace.resubmitAlipayProof` | mutation | 重新上傳被拒絕的截圖 |
| `marketplace.confirmReceipt` | mutation | 買家確認收貨 |
| `marketplace.buyerCancelOrder` | mutation | 買家取消訂單 |
| `marketplace.makeOffer` | mutation | 買家出價 |
| `marketplace.verifyPaymentProof` | mutation | AI 驗證付款截圖 |
| `marketplace.adminConfirmAlipayPayment` | adminMutation | 管理員確認 Alipay 收款 |
| `marketplace.adminBatchConfirmAlipayPayment` | adminMutation | 管理員批量確認 Alipay 收款 |
| `marketplace.adminRejectAlipayPayment` | adminMutation | 管理員拒絕 Alipay 截圖 |
| `marketplace.adminUpdateOrderStatus` | adminMutation | 管理員更新訂單狀態 |
| `marketplace.adminManualPayout` | adminMutation | 管理員手動放款 |

---

*本報告基於代碼分析，建議在實際測試環境中驗證所有流程。*
