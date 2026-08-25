# BOXIUM S1：資料語義契約凍結

**狀態：S1 design-only；此文件不改變 runtime、資料庫或任何資料。**

> 所有後續 PostgreSQL schema、fixture、query conversion 與 migration 都必須遵守本文件。任何需要改變本節業務語義的工作，必須另行經產品與資料遷移審核批准。

| 契約 | 固定規則 | PostgreSQL mapping implication |
|---|---|---|
| Production authority | Production MySQL／TiDB 在 migration 穩定前是唯一業務權威。 | S1/S2 不得讀取、匯出、寫入或切換 Production DSN。 |
| TCG game IDs | Pokemon=`1`、One Piece=`2`、Yu-Gi-Oh=`3`、Dragon Ball=`60001`、Union Arena=`60002`、Weiss Schwarz=`60003`、Gundam=`60004`. | `games.id` 必須保留 identity value，不能以 sequence 重新編號。 |
| `productType` | `single_card` 與 `sealed_product` 是價格、資料來源、收藏與搜尋分流的資料契約。 | 需以 enum/check 保存，所有關鍵 query 必須保留此條件；polymorphic card/product ID 不能自動加入單一 FK。 |
| 價格精確度 | 價格、FX、庫存成本、訂單與支付金額不得用 float。 | 使用 `numeric(precision, scale)`，在 TypeScript 保持 decimal string／精確值語義。 |
| UTC persistence | 商業時間以 UTC instant 儲存，前端僅負責轉換顯示時區。 | 目標為 `timestamptz`；每個 source timestamp 必須經來源時區決策表驗證，尤其 HKT 邊界。 |
| 熱門卡牌資格 | 僅計算近七日、`source=snkrdunk`、`grade=PSA 10`、非 bulk 的合資格成交。 | `priceHistory` 的 source／grade／isSuspectedBulk／soldAt index 及 query 需保留。 |
| 價格歷史冪等 | `recordHash` 與既有複合 unique 用於防止抓取重覆。 | PostgreSQL `ON CONFLICT` 必須選擇明確 conflict target，NULL unique semantics 需有 fixture。 |
| Auth/Storage freeze | 保留 Manus OAuth、existing session model 與 S3。 | 不引入 Supabase Auth、Storage、Realtime、frontend Data API 或 RLS migration。 |
| Server-side access | Express/tRPC 是唯一 DB access boundary。 | Lab Data API 保持停用；不建立 `VITE_*` Supabase key 或 browser client。 |

## 禁止自動推論的項目

| 項目 | 原因 | 需要的後續證據 |
|---|---|---|
| 將每個 `*Id` 欄位變成 FK | Source schema 沒有宣告 Drizzle FK，且 `productType` 有 polymorphic relationship。 | Synthetic orphan/nullable/polymorphic fixtures 與顯式 S2 mapping review。 |
| 將所有 text JSON 轉 `jsonb` | 部分 payload 可能依賴原始 text、寬鬆 JSON 或無索引 query。 | Payload shape、query path、GIN/expression index 需求與 migration fallback。 |
| 將所有 timestamp 視為 HKT | 會導致拍賣、成交、排程與價格 8 小時偏移。 | 來源時區決策表與 HKT boundary fixture。 |
| 將 MySQL default／on-update 原樣當 DB trigger | PostgreSQL 與 Drizzle runtime behavior 不同。 | Concurrent writer、raw SQL update 與 retry fixture。 |
