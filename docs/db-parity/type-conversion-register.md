# BOXIUM S1：型別轉換清冊

**狀態：設計登記冊；沒有轉換或寫入任何資料。**

| MySQL／Drizzle source family | Occurrences | Example | Proposed PostgreSQL／Drizzle mapping | Semantic risk | Required S2／S3 validation |
|---|---:|---|---|---|---|
| `bigint` | 9 | `users.phoneVerifyExpires` | `bigint({ mode })` | Retain source number/string contract explicitly; do not silently coerce precision-sensitive values. | S2 serialization contract test |
| `boolean` | 35 | `games.isActive` | `boolean` | Direct mapping; validate MySQL 0/1/null legacy rows before adding NOT NULL. | Synthetic null/false/true fixture |
| `decimal` | 65 | `fxRates.rate` | `numeric(precision, scale)` | Retain string／exact-decimal application contract; never substitute float. | Price, order and FX decimal checksum fixture |
| `int` | 311 | `games.id` | `integer` | Preserve JS number semantics; review IDs that may grow beyond signed 32-bit. | S2 fixture boundary and sequence check |
| `mysqlEnum` | 96 | `sealedProducts.boxType` | `pgEnum` | Per-table enum type generated in S1 draft; additions/removals require migration lifecycle plan. | Every allowed value plus invalid-value rejection fixture |
| `text` | 155 | `games.icon` | `text` or explicitly approved `jsonb` | Text JSON must not be auto-converted without query/shape review. | Null, malformed JSON, array/object fixture |
| `timestamp` | 230 | `games.createdAt` | `timestamptz` design proposal | UTC instant by default; source semantics must be recorded field-by-field before import. | HKT boundary/UTC conversion fixture |
| `tinyint` | 1 | `userVault.isMilestone` | `smallint` by default | Source intent is ambiguous because `tinyint` is distinct from Drizzle `boolean`. | Classify each field as boolean, status code, or small integer before migration |
| `varchar` | 247 | `games.code` | `varchar(length)` | Preserve max length; review collation/case-sensitive unique behavior. | Unicode and case-collision fixture |

## 不可自動決定的資料語義

| 類別 | S1 decision | Gate before data import |
|---|---|---|
| 商業 timestamp | 所有拍賣、成交、到期與排程時間需標明 UTC instant、HKT local date 或純日期。 | 任何不明確來源時區均為 No-Go。 |
| 價格與金額 | 保持 `numeric` 與 string/exact decimal contract。 | 不可使用 JavaScript float 做 checksum。 |
| Text JSON | 只在有 JSON query／index 需求、且 fixture 能驗證 shape 時，才轉 `jsonb`。 | `listings`、metadata、snapshot 等欄位須逐一決定。 |
| Enum | S1 draft 使用 `pgEnum`。 | 要先確認擴展值、historic value 和 deployment sequencing。 |
| Identity | 以 generated identity 取代 auto-increment。 | 日後才可在 approved import 後 reset sequence。 |
