# 數據庫遷移總結報告

## 📊 遷移進度

### ✅ 已完成階段

1. **Supabase 項目創建**
   - 數據庫：PostgreSQL 17.6
   - 地區：ap-southeast-2 (Sydney)
   - 連接池：Transaction mode (端口 6543)

2. **表結構創建**
   - 成功創建所有 26 個表
   - 所有索引和約束已就緒

3. **數據導入**
   - ✅ users: 1 條記錄
   - ✅ cards: 16,339 條記錄
   - ✅ dataSources: 15,344 條記錄
   - ✅ priceHistory: 91,232 條記錄
   - ✅ scheduledTasks: 2,519 條記錄
   - ✅ snkrdunkListingsCache: 26 條記錄
   - ✅ ebayListingsCache: 33 條記錄
   - ✅ firecrawlUsage: 4 條記錄
   - ✅ searchStats: 151 條記錄
   - ✅ categories: 5 條記錄
   - ✅ tags: 1 條記錄
   - ✅ posts: 1 條記錄
   - ✅ priceUpdateSchedule: 1 條記錄
   - ✅ scheduleConfig: 1 條記錄
   - ✅ trendingCardsCache: 5 條記錄
   - **總計：125,662 條記錄成功遷移**

4. **數據完整性驗證**
   - ✅ 所有表記錄數量與預期一致
   - ✅ 無數據丟失

### ⚠️ 遇到的技術挑戰

1. **Schema 語法差異**
   - MySQL `int()` vs PostgreSQL `integer()` / `serial()`
   - MySQL `datetime()` vs PostgreSQL `timestamp()`
   - MySQL `onDuplicateKeyUpdate()` vs PostgreSQL `onConflictDoUpdate()`
   - MySQL `onUpdateNow()` vs PostgreSQL 不支持（需要觸發器）

2. **Enum 定義方式**
   - PostgreSQL 需要先定義 enum 類型，然後引用
   - Inline enum 語法不兼容

3. **Insert 返回值**
   - MySQL 使用 `result[0].insertId`
   - PostgreSQL 需要使用 `.returning()` 語法

4. **Drizzle ORM 版本**
   - `drizzle-orm/mysql2` vs `drizzle-orm/postgres-js`
   - 需要安裝 `postgres` 套件

### 🔄 當前狀態

**系統已回退到穩定狀態**
- 使用 Manus TiDB (MySQL 兼容)
- 所有功能正常運作
- 無數據丟失

**Supabase 數據庫狀態**
- ✅ 表結構完整
- ✅ 數據已導入（125,662 條記錄）
- ⏸️ 應用未切換到 Supabase

## 🎯 下次遷移建議

### 方案 A：使用 Drizzle Kit 自動遷移

```bash
# 1. 安裝 PostgreSQL 依賴
pnpm add postgres drizzle-orm@latest

# 2. 更新 drizzle.config.ts
# 改為使用 PostgreSQL 驅動

# 3. 使用 Drizzle Kit 自動生成遷移
pnpm drizzle-kit generate:pg

# 4. 應用遷移
pnpm drizzle-kit push:pg
```

### 方案 B：手動轉換（需要仔細處理）

1. **Schema 轉換清單**
   - [ ] 更新 imports: `drizzle-orm/mysql-core` → `drizzle-orm/pg-core`
   - [ ] 更新表函數: `mysqlTable` → `pgTable`
   - [ ] 更新數據類型: `int()` → `integer()`, `serial()`
   - [ ] 更新日期類型: `datetime()` → `timestamp()`
   - [ ] 移除 `onUpdateNow()` 調用
   - [ ] 定義所有 enum 類型
   - [ ] 更新 enum 引用

2. **代碼修改清單**
   - [ ] 更新 `server/db.ts` 驅動
   - [ ] 替換所有 `insertId` 為 `.returning()`
   - [ ] 替換所有 `affectedRows` 為 `.length`
   - [ ] 更新 `onDuplicateKeyUpdate` 為 `onConflictDoUpdate`

3. **測試清單**
   - [ ] 用戶認證流程
   - [ ] 卡牌搜尋功能
   - [ ] 價格歷史查詢
   - [ ] Admin 批量操作
   - [ ] 圖片搜尋功能

### 方案 C：使用 pgloader（最簡單）

```bash
# 1. 安裝 pgloader
sudo apt-get install pgloader

# 2. 創建遷移配置
# 從 MySQL 直接遷移到 PostgreSQL

# 3. 執行遷移
pgloader mysql://... postgresql://...
```

## 📝 連接信息

### Supabase PostgreSQL
- **Host**: aws-1-ap-southeast-2.pooler.supabase.com
- **Port**: 6543 (Transaction mode) / 5432 (Direct)
- **Database**: postgres
- **User**: postgres.sagyfroktrfnnhepmvzu
- **Password**: Aa63020887@@
- **SSL**: Required

### 連接字符串
```
postgresql://postgres.sagyfroktrfnnhepmvzu:Aa63020887%40%40@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
```

## 🔧 遷移腳本位置

- `/home/ubuntu/boxium-ptcg/scripts/create-postgres-schema.sql` - PostgreSQL 表結構
- `/home/ubuntu/boxium-ptcg/scripts/migrate-data-final.ts` - 數據遷移腳本（已驗證可用）
- `/home/ubuntu/boxium-ptcg/docs/database-migration-guide.md` - 詳細遷移指南

## ⏭️ 建議行動

1. **短期（保持現狀）**
   - 繼續使用 Manus TiDB
   - 所有功能正常運作
   - 無需立即遷移

2. **中期（準備遷移）**
   - 研究 Drizzle Kit 自動遷移工具
   - 準備完整的測試計劃
   - 在測試環境驗證

3. **長期（完成遷移）**
   - 選擇最合適的遷移方案
   - 預留充足的時間（2-3 小時）
   - 確保有回退計劃

---

**遷移時間估算：**
- 方案 A (Drizzle Kit): 1-2 小時
- 方案 B (手動轉換): 3-4 小時
- 方案 C (pgloader): 30-60 分鐘

**推薦方案：方案 A (Drizzle Kit)** - 平衡了自動化和控制度
