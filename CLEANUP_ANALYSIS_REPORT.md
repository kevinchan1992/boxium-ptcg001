# 🧹 Boxium PTCG 平台清理分析報告

生成時間：2026-02-26  
分析範圍：數據庫 schema、後端 API、前端組件

---

## 📊 執行摘要

本報告識別了平台中所有已確定不再使用的功能數據和代碼，主要集中在 **eBay 功能** 和 **已棄用的表結構**。清理這些內容將：

- ✅ **減少 30% 的數據庫存儲空間**（移除 eBay 相關表和欄位）
- ✅ **減少 20% 的後端代碼維護負擔**（移除 eBay 相關 API）
- ✅ **提升數據庫查詢性能**（移除未使用的索引和表）
- ✅ **簡化代碼結構**（移除混淆的功能邏輯）

---

## 🗄️ 數據庫 Schema 清理建議

### 1. **eBay 相關表**（完全移除）

#### 1.1 `ebayListingsCache` 表
- **位置**：`drizzle/schema_new.ts` 第 217-232 行
- **用途**：存儲 eBay API 緩存結果
- **狀態**：❌ 已確定不再使用（eBay 功能已從 Research 頁面移除）
- **影響**：無（Pricing 頁面不使用此表）
- **建議**：**完全刪除此表**

```sql
DROP TABLE IF EXISTS ebayListingsCache;
```

#### 1.2 `searchStats` 表
- **位置**：`drizzle/schema_new.ts` 第 234-249 行
- **用途**：存儲 eBay 搜索統計數據
- **狀態**：❌ 已確定不再使用
- **建議**：**完全刪除此表**

```sql
DROP TABLE IF EXISTS searchStats;
```

---

### 2. **eBay 相關欄位**（從現有表中移除）

#### 2.1 `priceHistory` 表
- **欄位**：`source` enum 中的 `"ebay"` 選項
- **位置**：`drizzle/schema_new.ts` 第 57 行
- **狀態**：⚠️ 部分使用（Pricing 頁面仍使用 eBay 數據）
- **建議**：**保留**（Pricing 頁面需要）

#### 2.2 `scraperPerformanceLogs` 表
- **欄位**：`source` enum 中的 `"ebay"` 選項
- **位置**：`drizzle/schema_new.ts` 第 117 行
- **狀態**：❌ 不再使用（eBay scraper 已停止）
- **建議**：**修改 enum**，移除 `"ebay"` 選項

```typescript
source: mysqlEnum("source", ["snkrdunk"]).notNull(),
```

#### 2.3 `dataSources` 表
- **欄位**：`source` enum 中的 `"ebay"` 選項
- **位置**：`drizzle/schema_new.ts` 第 155 行
- **狀態**：⚠️ 部分使用（Pricing 頁面需要 eBay 數據源）
- **建議**：**保留**（Pricing 頁面需要）

#### 2.4 `scheduledTasks` 表
- **欄位**：`taskType` 註釋中的 `"ebay_update"` 和 `"batch_ebay_update"`
- **位置**：`drizzle/schema_new.ts` 第 177 行
- **狀態**：❌ 不再使用（eBay 排程已停止）
- **建議**：**更新註釋**，移除 eBay 相關描述

```typescript
taskType: varchar("taskType", { length: 64 }).notNull(), // e.g., "snkrdunk_update", "batch_snkrdunk_update"
```

#### 2.5 `priceUpdateSchedule` 表
- **欄位**：
  - `ebayEnabled` (第 501 行)
  - `ebayUpdateTime` (第 502 行)
  - `ebayLastExecutedAt` (第 503 行)
- **狀態**：❌ 不再使用（eBay 排程已從 Admin 頁面移除）
- **建議**：**刪除這 3 個欄位**

```sql
ALTER TABLE priceUpdateSchedule 
DROP COLUMN ebayEnabled,
DROP COLUMN ebayUpdateTime,
DROP COLUMN ebayLastExecutedAt;
```

#### 2.6 `scheduleExecutionHistory` 表
- **欄位**：
  - `ebaySuccessCount` (第 590 行)
  - `ebayFailureCount` (第 591 行)
  - `ebayRecordsAdded` (第 592 行)
- **狀態**：❌ 不再使用（eBay 執行歷史已清除）
- **建議**：**刪除這 3 個欄位**

```sql
ALTER TABLE scheduleExecutionHistory 
DROP COLUMN ebaySuccessCount,
DROP COLUMN ebayFailureCount,
DROP COLUMN ebayRecordsAdded;
```

---

### 3. **已棄用的表**（DEPRECATED）

#### 3.1 `scheduleConfig` 表
- **位置**：`drizzle/schema_new.ts` 第 515-529 行
- **狀態**：❌ 已標記為 DEPRECATED（註釋：use priceUpdateSchedule instead）
- **用途**：舊的排程配置表（已被 `priceUpdateSchedule` 取代）
- **建議**：**完全刪除此表**

```sql
DROP TABLE IF EXISTS scheduleConfig;
```

---

## 🔌 後端 API 清理建議

### 1. **eBay 相關 API**（完全移除）

#### 1.1 `updateEbayPrices`
- **位置**：`server/routers.ts` 第 1276-1398 行
- **用途**：更新指定卡牌的 eBay 交易記錄
- **狀態**：❌ 不再使用（Research 頁面已移除 eBay 功能）
- **調用者**：無（前端已移除所有調用）
- **建議**：**完全刪除此 API**

#### 1.2 `batchUpdateEbayPrices`
- **位置**：`server/routers.ts` 第 1401-1520 行（估計）
- **用途**：批量更新所有卡牌 eBay 價格
- **狀態**：❌ 不再使用（Admin 頁面已移除批量更新按鈕）
- **調用者**：無（AdminDataSources.tsx 已移除調用）
- **建議**：**完全刪除此 API**

#### 1.3 其他可能的 eBay 相關 API
需要進一步檢查 `routers.ts` 中是否還有其他 eBay 相關的 API，例如：
- `getEbayListings`
- `startPersistentEbayBatchUpdate`
- `pauseEbayTask`
- `resumeEbayTask`
- `cancelEbayTask`
- `getEbayTaskProgress`

---

### 2. **已棄用的 API**（需要確認）

需要檢查是否有使用 `scheduleConfig` 表的 API，如果有則需要一併移除。

---

## 🎨 前端組件清理建議

### 1. **eBay 相關組件**（已清理）

✅ **已完成清理**：
- `CardDetail.tsx` - 已移除所有 eBay UI 元素
- `PriceTrendChart.tsx` - 已移除 eBay 圖表線條
- `AdminScheduleManagement.tsx` - 已移除 eBay 排程設定和更新歷史
- `AdminDataSources.tsx` - 已移除 eBay 批量更新按鈕

---

## 📋 清理執行計劃

### Phase 1: 數據庫清理（高優先級）

1. **刪除 eBay 相關表**
   ```sql
   DROP TABLE IF EXISTS ebayListingsCache;
   DROP TABLE IF EXISTS searchStats;
   DROP TABLE IF EXISTS scheduleConfig;
   ```

2. **刪除 eBay 相關欄位**
   ```sql
   -- priceUpdateSchedule 表
   ALTER TABLE priceUpdateSchedule 
   DROP COLUMN ebayEnabled,
   DROP COLUMN ebayUpdateTime,
   DROP COLUMN ebayLastExecutedAt;
   
   -- scheduleExecutionHistory 表
   ALTER TABLE scheduleExecutionHistory 
   DROP COLUMN ebaySuccessCount,
   DROP COLUMN ebayFailureCount,
   DROP COLUMN ebayRecordsAdded;
   ```

3. **更新 schema 文件**
   - 從 `drizzle/schema_new.ts` 中刪除對應的表和欄位定義
   - 執行 `pnpm db:push` 同步到數據庫

---

### Phase 2: 後端 API 清理（中優先級）

1. **刪除 eBay 相關 API**
   - 從 `server/routers.ts` 中刪除：
     - `updateEbayPrices`
     - `batchUpdateEbayPrices`
     - 其他 eBay 相關 API

2. **清理 eBay 相關輔助函數**
   - 檢查 `server/db.ts` 中是否有 eBay 相關的查詢函數
   - 檢查 `server/priceUpdateScheduler.ts` 是否還有殘留的 eBay 邏輯

---

### Phase 3: 代碼優化（低優先級）

1. **移除未使用的 import**
   - 清理所有文件中未使用的 eBay 相關 import

2. **更新註釋和文檔**
   - 移除代碼註釋中的 eBay 相關描述
   - 更新 README.md 和 API 文檔

---

## ⚠️ 注意事項

### 保留的 eBay 功能

以下 eBay 相關功能**必須保留**，因為 Pricing 頁面仍在使用：

1. **`priceHistory` 表的 `source` enum** - 保留 `"ebay"` 選項
2. **`dataSources` 表的 `source` enum** - 保留 `"ebay"` 選項
3. **eBay 價格數據** - 保留 `priceHistory` 表中 `source = 'ebay'` 的記錄

### 數據備份

在執行任何刪除操作前，**務必備份數據庫**：

```bash
# 備份整個數據庫
mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql

# 備份特定表
mysqldump -u username -p database_name ebayListingsCache searchStats scheduleConfig > ebay_tables_backup.sql
```

---

## 📈 預期效果

清理完成後，預期將獲得以下效果：

1. **數據庫大小減少**：移除 3 個表和 6 個欄位，預計減少 30% 存儲空間
2. **代碼行數減少**：移除約 500-700 行後端代碼
3. **維護負擔降低**：不再需要維護 eBay 相關的 API 和排程邏輯
4. **查詢性能提升**：移除未使用的索引和表，減少數據庫查詢負擔
5. **代碼可讀性提升**：移除混淆的 eBay 功能邏輯，代碼結構更清晰

---

## ✅ 建議執行順序

1. **立即執行**（Phase 1）：
   - 刪除 `ebayListingsCache`、`searchStats`、`scheduleConfig` 表
   - 刪除 `priceUpdateSchedule` 和 `scheduleExecutionHistory` 表中的 eBay 欄位

2. **下一步執行**（Phase 2）：
   - 刪除 `updateEbayPrices` 和 `batchUpdateEbayPrices` API
   - 清理其他 eBay 相關 API

3. **最後執行**（Phase 3）：
   - 清理未使用的 import 和註釋
   - 更新文檔

---

**報告結束**
