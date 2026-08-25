# BOXIUM 首頁成交統計與 Supabase Free 容量評估

**評估時間：2026-08-25。資料處理：只讀 table count 與 `information_schema` metadata，沒有讀取、輸出或保存任何商業資料列內容。**

## 為甚麼首頁是 237 萬，而全庫是 808 萬？

首頁的「成交價格記錄」不是全資料庫列數。`cards.getStats` 會呼叫 `getTotalPriceRecordCount()`，其 SQL 只讀取 `priceHistory` 的 TiDB `information_schema.TABLE_ROWS` 估算值，並在記憶體快取最多七日。因此，畫面當時回傳 **2,357,612** 是對 `priceHistory` 的快速估算，不是逐筆精確 `COUNT(*)`。

本次受控來源 inventory 對 `priceHistory` 執行了精確 `COUNT(*)`，結果為 **1,809,467**。兩者差異是 TiDB table-statistics estimate 與首頁 cache 的預期限制，並不代表另有 54 萬筆成交資料遺失或額外被搬遷。

| 指標 | 數值 | 意義 |
|---|---:|---|
| 首頁成交價格記錄 | 2,357,612 | `priceHistory` 的近似、快取顯示數字。 |
| `priceHistory` 精確列數 | 1,809,467 | 實際成交／價格歷史列。 |
| 全來源表列數 | 8,088,434 | 94 張現有 MySQL/TiDB 表全部相加。 |
| `searchTokens` | 5,842,562 | 供卡牌搜尋使用、可由卡牌資料重建的索引列，不是成交。 |
| 目標特有表 | `articleGenerationHistory` | 目標 schema 有、來源目前沒有的空表；不影響本次列數。 |

## 現有 MySQL/TiDB 資料庫有多大？

來源 `information_schema` metadata 顯示資料約 **1,470.91 MB**、索引約 **830.62 MB**，合計約 **2,194.91 MiB（約 2.14 GiB）**。這是已使用的資料／索引 footprint，不是供應商帳戶的「剩餘可用磁碟」；目前受管 MySQL/TiDB 連線沒有提供可安全查詢的容量 quota／剩餘空間介面。

| 資料類別 | 列數 | 估計資料＋索引容量 | 說明 |
|---|---:|---:|---|
| 核心／業務資料 | 2,015,585 | 1,643.82 MiB | 當中 `priceHistory` 單表為 1,587.91 MiB。 |
| 可重建搜尋索引 | 5,869,955 | 472.79 MiB | 主要是 `searchTokens`；不屬成交歷史。 |
| 可重建快取 | 74,218 | 40.95 MiB | 包含 SNKRDUNK／eBay listing cache 與排行快取。 |
| 營運日誌 | 128,676 | 37.35 MiB | 包含 scraper、搜尋與 security logs。 |
| **合計** | **8,088,434** | **2,194.91 MiB** | 不含 Supabase 新 project 本身約 40–60 MB 系統空間。 |

## 不升級 Pro 能否完整搬遷？

> **不能安全地完整搬遷。** Supabase Free project 的 database size 上限是 500 MB；超過後會進入 read-only mode，平台無法再寫入資料。[1] [2]

即使完全不搬 `searchTokens`、快取及營運日誌，單是完整 `priceHistory` 就約 **1,587.91 MiB**，超過 Free 上限約三倍。加上 cards、users、訂單與其他核心表、PostgreSQL 索引及 project 系統空間，完整的正式 BOXIUM 資料庫不能放進 Free plan。

| 零付費選擇 | 可否讓 Supabase 成為完整正式資料庫 | 代價 |
|---|---|---|
| 完整搬遷所有資料 | 不可行 | 超過 500 MB 後會唯讀。 |
| 只搬核心資料、移除所有價格歷史 | 技術上或可控制容量 | 首頁、價格圖、成交歷史與研究功能會失去歷史資料；屬產品範圍改動。 |
| 只搬最近部分價格歷史／保留日級聚合 | 有機會，但需另行量測與改造 | MySQL/TiDB 仍須作 raw history archive，Supabase 不再是唯一系統資料庫。 |
| 維持 MySQL/TiDB | 可行 | 不會改變平台與既有歷史功能。 |

## 結論

若要求「BOXIUM 全部正式資料都轉到 Supabase，並保留現有功能與完整成交歷史」，Supabase Pro（或其他具足夠儲存的付費 PostgreSQL）是必要條件，不是可選優化。若堅持零付費，只能縮減遷移資料範圍，並接受歷史資料留在 MySQL/TiDB 或刪減平台功能；在作出該產品決定前，不應開始真正資料複製。

## References

[1]: https://supabase.com/pricing "Supabase Pricing"
[2]: https://supabase.com/docs/guides/platform/database-size "Understanding Database and Disk Size"
