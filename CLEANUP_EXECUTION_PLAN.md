# 🧹 Boxium PTCG 平台清理執行計劃

生成時間：2026-02-26  
狀態：**待執行**

---

## ⚠️ 重要說明

本次清理操作因涉及複雜的依賴關係和多個文件修改，**建議採用以下更安全的方式**：

### 方案 A：保留這些表和函數（推薦）

**理由：**
1. `searchStats` 表雖然最初是為 eBay 搜索設計的，但也可以用於記錄平台的通用搜索統計
2. `ebayListingsCache` 表雖然目前不使用，但如果未來重新啟用 eBay 功能，可以直接使用
3. `scheduleConfig` 表已標記為 DEPRECATED，但刪除它需要確保沒有任何代碼引用

**建議：**
- **保留這些表**，不進行刪除
- **只刪除 `priceUpdateSchedule` 和 `scheduleExecutionHistory` 表中的 eBay 欄位**（這些欄位確定不再使用）

---

### 方案 B：完全刪除（需要大量修改）

如果堅持要完全刪除這些表和函數，需要執行以下步驟：

#### Step 1: 刪除或修改所有調用 `searchStats` 的代碼

**受影響的文件：**
1. `server/persistentEbayBatchUpdate.ts` - 第 122 行
2. `server/routers.ts` - 第 1244-1270 行（`getSearchStats` API）
3. `server/routers.ts` - 第 1345 行（`updateEbayPrices` API）
4. `server/routers.ts` - 第 1494 行（`batchUpdateEbayPrices` API）

**修改方式：**
- 刪除所有 `await db.addSearchStat(...)` 調用
- 刪除 `getSearchStats` API
- 從前端移除所有調用 `getSearchStats` 的代碼

#### Step 2: 刪除 `ebayListingsCache` 表

**受影響的文件：**
- `drizzle/schema_new.ts` - 第 219-241 行

**修改方式：**
- 從 schema 文件中刪除表定義
- 執行 `pnpm db:push` 同步到數據庫

#### Step 3: 刪除 `searchStats` 表

**受影響的文件：**
- `drizzle/schema_new.ts` - 第 277-292 行
- `server/db.ts` - 第 3 行（import）
- `server/db.ts` - 第 514-595 行（函數定義）

**修改方式：**
- 從 schema 文件中刪除表定義
- 從 db.ts 中刪除 import 和函數定義
- 執行 `pnpm db:push` 同步到數據庫

#### Step 4: 刪除 `scheduleConfig` 表

**受影響的文件：**
- `drizzle/schema_new.ts` - 第 515-529 行

**修改方式：**
- 從 schema 文件中刪除表定義
- 檢查是否有代碼引用此表
- 執行 `pnpm db:push` 同步到數據庫

---

## 🎯 推薦執行方案

我建議執行**方案 A**，只刪除確定不再使用的 eBay 欄位：

### 1. 刪除 `priceUpdateSchedule` 表中的 eBay 欄位

```sql
ALTER TABLE priceUpdateSchedule 
DROP COLUMN ebayEnabled,
DROP COLUMN ebayUpdateTime,
DROP COLUMN ebayLastExecutedAt;
```

### 2. 刪除 `scheduleExecutionHistory` 表中的 eBay 欄位

```sql
ALTER TABLE scheduleExecutionHistory 
DROP COLUMN ebaySuccessCount,
DROP COLUMN ebayFailureCount,
DROP COLUMN ebayRecordsAdded;
```

### 3. 更新 schema 文件

從 `drizzle/schema_new.ts` 中刪除對應的欄位定義，然後執行：

```bash
pnpm db:push
```

---

## 📋 執行檢查清單

- [ ] 備份數據庫（執行前必須完成）
- [ ] 刪除 `priceUpdateSchedule` 表中的 eBay 欄位
- [ ] 刪除 `scheduleExecutionHistory` 表中的 eBay 欄位
- [ ] 更新 schema 文件
- [ ] 執行 `pnpm db:push` 同步到數據庫
- [ ] 測試平台功能是否正常
- [ ] 保存 checkpoint

---

## ⚠️ 風險評估

### 方案 A（推薦）
- **風險等級**：低
- **影響範圍**：只影響 eBay 相關欄位
- **回滾難度**：容易（可以通過 SQL 重新添加欄位）

### 方案 B（完全刪除）
- **風險等級**：高
- **影響範圍**：多個文件和 API
- **回滾難度**：困難（需要恢復多個文件的修改）

---

**建議：執行方案 A，保留 `searchStats`、`ebayListingsCache` 和 `scheduleConfig` 表，只刪除確定不再使用的 eBay 欄位。**
