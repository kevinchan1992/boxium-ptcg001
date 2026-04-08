# BOXIUM PTCG - 系統測試 Bug 報告

## 嚴重 Bug (Critical)

### BUG-1: C2C 賣家在訂單詳情頁面沒有出貨按鈕
- **位置**: `client/src/pages/OrderDetail.tsx`
- **問題**: 當訂單 `sellerType === 'seller'`（C2C 賣家），且狀態為 `paid_held / payment_received / processing` 時，OrderDetail 頁面**沒有**出貨按鈕。只有 `isAdmin && sellerType === 'platform'` 才有出貨按鈕。C2C 賣家必須去 SellerDashboard 操作，但 OrderDetail 頁面沒有任何提示引導他們去 SellerDashboard。
- **影響**: C2C 賣家在訂單詳情頁面看不到任何行動按鈕，體驗很差。
- **修復**: 在 OrderDetail 頁面為 C2C 賣家（`isSeller && order.sellerType === 'seller'`）添加出貨按鈕，或至少添加引導連結到 SellerDashboard。

### BUG-2: RC3 重複上架檢查未過濾 sellerId
- **位置**: `server/routers/marketplace.ts` 第 944-950 行
- **問題**: `createListing` 中的重複上架檢查使用 `getPublicListings({ sellerType: 'seller', pageSize: 100, page: 1 })` 查詢所有賣家的商品，然後 `find` 匹配 `cardId` 和 `condition`。這會導致：如果賣家 A 已上架某張卡，賣家 B 嘗試上架同一張卡時會被誤判為重複。
- **影響**: 不同賣家無法上架同一張卡片，嚴重影響商城功能。
- **修復**: 重複上架檢查應使用 `getSellerListings(seller.id)` 只查詢當前賣家的商品。

### BUG-3: openDispute 後端不允許 paid_held 狀態，但前端 canDispute 包含 paid_held
- **位置**: 
  - 後端: `server/routers/marketplace.ts` 第 3353 行 `allowedStatuses = ["shipped", "delivered", "payment_received", "processing"]`
  - 前端: `client/src/pages/OrderDetail.tsx` 第 950 行 `canDispute = ... ["shipped", "delivered", "payment_received", "processing", "paid_held"]`
- **問題**: 前端顯示 paid_held 狀態可以申請爭議，但後端會拒絕。
- **影響**: 用戶點擊爭議按鈕後會收到後端錯誤，體驗差。
- **修復**: 後端 allowedStatuses 添加 `paid_held`，或前端 canDispute 移除 `paid_held`。

### BUG-4: partial 爭議結果的 finalStatus 設置錯誤
- **位置**: `server/routers/marketplace.ts` 第 3585 行
- **問題**: `const finalStatus = outcome === "refund_buyer" ? "cancelled" : "completed";`
  當 `outcome === "partial"` 時，finalStatus 也是 `"completed"`，但 partial 結果通常是部分退款，不應直接完成訂單。
- **影響**: partial 爭議結果會直接把訂單標記為 completed，邏輯不合理。
- **修復**: partial 結果應有獨立的狀態處理，或至少設置為 `"completed"` 並在 resolution 中說明部分退款情況。

## 中等 Bug (Medium)

### BUG-5: 文字 Typo - 「爬議」應為「爭議」
- **位置**: `client/src/pages/OrderDetail.tsx` 第 1170 行
- **問題**: `<p className="text-xs text-gray-500 self-center">爬議申請期限已過（7 天）</p>` 中「爬議」應為「爭議」。
- **修復**: 改為「爭議申請期限已過（7 天）」。

### BUG-6: SellerDashboard Step 1 缺少圖片上傳驗證
- **位置**: `client/src/pages/SellerDashboard.tsx` 第 3566-3582 行
- **問題**: Step 1 的「下一步」按鈕只驗證 `title.length >= 3`，沒有驗證 `listingImages.length > 0`。雖然後端有圖片驗證，但前端沒有提前驗證，用戶可能走到 Step 3 才發現圖片沒上傳。
- **修復**: Step 1 的下一步按鈕應同時驗證 `listingImages.length > 0`。

### BUG-7: 拍賣 auctionEndAt 沒有「必須在未來」的前端驗證
- **位置**: `client/src/pages/SellerDashboard.tsx` Step 2 驗證邏輯
- **問題**: Step 2 的「下一步」按鈕對拍賣模式只驗證 `!listingForm.startingBid`，沒有驗證 `auctionEndAt` 是否已設定且在未來。後端也沒有驗證 `endAt > now`。
- **影響**: 賣家可能設定過去的結束時間，導致拍賣立即結束。
- **修復**: 前端 Step 2 驗證應包含 `!listingForm.auctionEndAt`；後端 auction.create 應驗證 `endAt > now`。

### BUG-8: Cart meetup 模式下 canProceedStep1 邏輯不完整
- **位置**: `client/src/pages/Cart.tsx` 第 1061-1072 行
- **問題**: 當 `form.shippingMethod === "meetup"` 時，`canProceedStep1` 直接 `return true`，沒有任何驗證。面交模式下應該至少要求填寫聯絡電話（`recipientPhone`）。
- **修復**: meetup 模式下應驗證 `recipientPhone` 是否已填寫。

## 輕微問題 (Minor)

### BUG-9: C2C 賣家在 OrderDetail 頁面沒有任何操作引導
- **位置**: `client/src/pages/OrderDetail.tsx`
- **問題**: 當 `isSeller && order.sellerType === 'seller'` 且狀態為 `paid_held / payment_received / processing` 時，頁面沒有任何提示告訴賣家需要去 SellerDashboard 出貨。
- **修復**: 添加提示信息「請前往賣家後台完成出貨」並附上連結。

### BUG-10: canDispute 在 disputed 狀態下沒有明確排除
- **位置**: `client/src/pages/OrderDetail.tsx` 第 950 行
- **問題**: `canDispute` 的狀態列表不包含 `disputed`，所以已在爭議中的訂單不會顯示爭議按鈕，這是正確的。但沒有明確的提示告訴用戶訂單已在爭議中。
- **修復**: 當 `order.orderStatus === 'disputed'` 時，顯示「爭議處理中」的提示。
