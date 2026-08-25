# BOXIUM 正式資料庫策略：MySQL/TiDB 維持權威紀錄

**使用者決定：維持現有 MySQL/TiDB 作為 BOXIUM 正式系統資料庫。**

## 立即生效範圍

| 範圍 | 決定 |
|---|---|
| 正式讀寫 | 繼續由現有 MySQL/TiDB 處理。 |
| Supabase Production target | 保留空資料 schema 與 server-only security validation，不接收真實資料或使用者流量。 |
| Supabase Lab | 保留 schema／synthetic FK 驗證用途。 |
| Data API | 兩個 Supabase project 維持 disabled。 |
| Runtime | 不設定 Supabase runtime credential，不改 `DATABASE_URL`、`server/db.ts`、Cloud Run 或現有 MySQL/TiDB runtime。 |
| Data movement | 停止 Production data export、import、對帳、shadow read、dual-write、replication 及 cutover。 |

## 最終隔離驗證

新 Supabase Production target 已重新盤點為 95 張 schema table、每張表 `0` rows；因此沒有任何 BOXIUM 真實資料存在於該 target。Supabase Advisor 仍提示這 95 張表尚未啟用 RLS。此項不會被自動修改：Data API 已停用，且 M06 已撤銷 `PUBLIC`、`anon` 與 `authenticated` 的 `public` schema access；RLS/policies 只有在使用者未來重新批准 Supabase runtime 遷移時，才會以獨立安全 gate 設計及套用。

Supabase Lab 亦重新盤點為 95 張 schema table、每張表 `0` rows，證明 M05 synthetic fixtures 已完全清除。Lab Advisor 同樣指出 RLS 尚未啟用；因 Lab 不含真實資料且 Data API 維持 disabled，沒有自動套用 RLS。若未來重新啟用任何 client-facing API，必須先取得使用者批准並完成獨立的 RLS/policy gate。

## 決定依據

受控 inventory 顯示現有來源約 2.14 GiB，且完整 `priceHistory` 約 1.55 GiB；Supabase Free project 的 database size 上限為 500 MB，超出會進入 read-only mode。因此，在不升級 Supabase Pro／其他足夠儲存方案的前提下，完整保持 BOXIUM 功能與歷史資料的資料庫切換不可安全執行。[1] [2]

未來如需重啟遷移，必須有新的明確使用者批准，並重新進行 source snapshot、容量、成本、備份／回退、runtime credential、資料品質及 cutover gate。

## References

[1]: https://supabase.com/pricing "Supabase Pricing"
[2]: https://supabase.com/docs/guides/platform/database-size "Understanding Database and Disk Size"
