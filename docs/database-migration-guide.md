# BOXIUM PTCG 數據庫遷移指南

## 📋 遷移概覽

**目標：** 將數據庫從 Manus TiDB (MySQL) 遷移到 Supabase (PostgreSQL)

**狀態：** 表結構已創建，數據導入待完成

**數據規模：**
- 總記錄數：125,681 條
- 總數據量：46 MB
- 表數量：26 個

---

## ✅ 已完成步驟

### Step 1: Supabase 項目創建
- **Project ID:** sagyfroktrfnnhepmvzu
- **Region:** AWS ap-southeast-2 (Sydney)
- **PostgreSQL 版本:** 17.6
- **連接測試:** ✅ 成功

### Step 2: 表結構創建
所有 26 個表已成功創建：
- users
- cards
- priceHistory
- watchlist
- marketTrends
- dataSources
- scheduledTasks
- snkrdunkListingsCache
- ebayListingsCache
- firecrawlUsage
- systemSettings
- favorites
- searchStats
- categories
- tags
- posts
- post_tags
- priceUpdateSchedule
- scheduleConfig
- trendingCardsCache

**SQL 腳本位置：** `/home/ubuntu/boxium-ptcg/scripts/create-all-tables.sql`

---

## 🔄 待完成步驟

### Step 3: 數據導入

#### 方法 1：使用 Supabase Dashboard（推薦）
1. 登入 Supabase Dashboard: https://supabase.com/dashboard/project/sagyfroktrfnnhepmvzu
2. 前往 Table Editor
3. 使用 CSV 導入功能逐表導入數據

#### 方法 2：使用 pgloader（推薦用於大量數據）
```bash
# 安裝 pgloader
sudo apt-get install pgloader

# 創建 pgloader 配置文件
cat > /tmp/migration.load << 'EOF'
LOAD DATABASE
  FROM mysql://user:password@host:port/database
  INTO postgresql://postgres.sagyfroktrfnnhepmvzu:Aa63020887%40%40@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres

WITH include drop, create tables, create indexes, reset sequences

SET maintenance_work_mem to '128MB', work_mem to '12MB'

CAST type datetime to timestamptz
     drop default drop not null using zero-dates-to-null,
     type date drop not null drop default using zero-dates-to-null;
EOF

# 執行遷移
pgloader /tmp/migration.load
```

#### 方法 3：使用自定義腳本
已準備的腳本：
- `/home/ubuntu/boxium-ptcg/scripts/migrate-data-simple.ts`
- 需要解決連接池認證問題

**已知問題：**
- Supabase connection pooler 的認證問題
- 密碼中的特殊字符 `@@` 需要 URL 編碼為 `%40%40`
- Circuit breaker 觸發後需要等待冷卻時間

### Step 4: 數據完整性驗證

#### 驗證腳本
```sql
-- 檢查記錄數量
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'cards', COUNT(*) FROM cards
UNION ALL
SELECT 'priceHistory', COUNT(*) FROM "priceHistory"
UNION ALL
SELECT 'dataSources', COUNT(*) FROM "dataSources"
UNION ALL
SELECT 'scheduledTasks', COUNT(*) FROM "scheduledTasks"
UNION ALL
SELECT 'snkrdunkListingsCache', COUNT(*) FROM "snkrdunkListingsCache"
UNION ALL
SELECT 'ebayListingsCache', COUNT(*) FROM "ebayListingsCache"
UNION ALL
SELECT 'firecrawlUsage', COUNT(*) FROM "firecrawlUsage"
UNION ALL
SELECT 'searchStats', COUNT(*) FROM "searchStats"
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'tags', COUNT(*) FROM tags
UNION ALL
SELECT 'posts', COUNT(*) FROM posts
UNION ALL
SELECT 'priceUpdateSchedule', COUNT(*) FROM "priceUpdateSchedule"
UNION ALL
SELECT 'scheduleConfig', COUNT(*) FROM "scheduleConfig"
UNION ALL
SELECT 'trendingCardsCache', COUNT(*) FROM "trendingCardsCache";
```

**預期結果：**
- users: 1
- cards: 16,339
- priceHistory: 91,232
- dataSources: 15,344
- scheduledTasks: 2,519
- snkrdunkListingsCache: 26
- ebayListingsCache: 33
- firecrawlUsage: 4
- searchStats: 151
- categories: 5
- tags: 1
- posts: 1
- priceUpdateSchedule: 1
- scheduleConfig: 1
- trendingCardsCache: 5

### Step 5: 更新環境變數

使用 `webdev_request_secrets` 工具更新 DATABASE_URL：

```typescript
await webdev_request_secrets({
  secrets: [{
    key: "DATABASE_URL",
    value: "postgresql://postgres.sagyfroktrfnnhepmvzu:Aa63020887%40%40@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
    description: "Supabase PostgreSQL 數據庫連接字符串"
  }]
});
```

### Step 6: 更新 Drizzle 配置

修改 `server/db.ts`：

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema.js";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

修改 `drizzle/schema.ts`：

```typescript
// 將所有 mysqlTable 改為 pgTable
// 將所有 mysqlEnum 改為 pgEnum
// 將 int().autoincrement() 改為 serial()
// 將 datetime() 改為 timestamp()
// 將 text() 保持不變
```

### Step 7: 測試所有功能

#### 測試清單
- [ ] 用戶登入
- [ ] 卡牌搜尋
- [ ] 卡牌詳情頁顯示
- [ ] 價格歷史查詢
- [ ] Admin 頁面數據源管理
- [ ] Admin 頁面批量更新
- [ ] SNKRDUNK 爬蟲功能
- [ ] eBay API 整合
- [ ] 圖片搜尋功能
- [ ] 價格趨勢圖表

### Step 8: 保存 Checkpoint

完成測試後保存 checkpoint：

```bash
webdev_save_checkpoint({
  description: "完成數據庫從 Manus TiDB 遷移到 Supabase"
});
```

---

## 🔗 連接信息

### Supabase 連接信息

**Connection String (Pooler):**
```
postgresql://postgres.sagyfroktrfnnhepmvzu:Aa63020887%40%40@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
```

**Connection String (Direct):**
```
postgresql://postgres.sagyfroktrfnnhepmvzu:Aa63020887%40%40@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
```

**psql 命令:**
```bash
PGPASSWORD='Aa63020887@@' psql -h aws-1-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.sagyfroktrfnnhepmvzu -d postgres
```

**Service Role Key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZ3lmcm9rdHJmbm5oZXBtdnp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYzMTQ3OCwiZXhwIjoyMDg3MjA3NDc4fQ.u3ltGs5HZegc_glNLF6zmyoqLvG6iqxc9PXxZpbVWVo
```

### Manus TiDB 連接信息

從環境變數 `DATABASE_URL` 獲取。

---

## ⚠️ 注意事項

### 密碼特殊字符處理
密碼 `Aa63020887@@` 中的 `@@` 在 URL 中需要編碼為 `%40%40`。

### Connection Pooler vs Direct Connection
- **Pooler (5432):** 適合應用程序連接，有連接池管理
- **Direct (6543):** 適合管理操作和數據導入，無連接池限制

### Circuit Breaker
如果遇到 "Circuit breaker open" 錯誤，需要等待 5-10 分鐘後重試。

### 數據類型轉換
- MySQL `int` → PostgreSQL `integer`
- MySQL `datetime` → PostgreSQL `timestamp`
- MySQL `text` → PostgreSQL `text`
- MySQL `tinyint(1)` (boolean) → PostgreSQL `boolean`
- MySQL `decimal(10,2)` → PostgreSQL `decimal(10,2)`

---

## 📚 相關文件

- SQL 腳本：`/home/ubuntu/boxium-ptcg/scripts/create-all-tables.sql`
- 遷移腳本：`/home/ubuntu/boxium-ptcg/scripts/migrate-data-simple.ts`
- Schema 定義：`/home/ubuntu/boxium-ptcg/drizzle/schema.ts`
- 數據庫配置：`/home/ubuntu/boxium-ptcg/server/db.ts`

---

## 🎯 下次會話行動計劃

1. 使用 pgloader 或 Supabase Dashboard 完成數據導入
2. 驗證數據完整性（記錄數量和關鍵數據）
3. 更新環境變數 DATABASE_URL
4. 修改 Drizzle schema 和 db.ts
5. 安裝 postgres-js 套件
6. 重啟服務並測試所有功能
7. 保存最終 checkpoint

---

**文檔創建時間：** 2026-02-21  
**當前 Checkpoint：** 4d1a209a  
**遷移狀態：** 表結構已創建，數據導入待完成
