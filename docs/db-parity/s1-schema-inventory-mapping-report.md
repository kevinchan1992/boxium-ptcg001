# BOXIUM S1：Schema Inventory 與 PostgreSQL Mapping 設計報告

**狀態：完成 S1 設計，等待使用者審核；未套用任何 schema。**
**範圍：僅限 GitHub `chore/supabase-lab-schema-parity` branch 與已建立的空白 Supabase Lab。**

> 此報告的結論只來自目前受管 repository 的 source-code snapshot、`drizzle/schema_new.ts` 與既有遷移文件。S1 沒有連線、讀取、匯出或改寫 BOXIUM Production MySQL／TiDB；亦沒有對 Supabase Lab 執行 DDL、DML、migration、fixture、`db:push` 或任何 secret 填值。[1]

## 1. 執行結論

S1 已建立一套可重現、可審核的 PostgreSQL mapping 基線。現行 MySQL Drizzle schema 有 **95** 張表，其中 **94** 張宣告 primary key、**0** 張以 Drizzle `.references()` 宣告 foreign key、並含 **189** 個 secondary index 與 **37** 個 unique field／index。這代表表結構可被完整盤點，但外鍵不可自動推論或直接寫入 PostgreSQL；S2 前必須以 synthetic fixture 驗證每個 logical relation、polymorphic relation 與既有 orphan 資料容忍度。[2]

| S1 交付物 | 結果 | 是否可直接執行 |
|---|---|---|
| `schema-matrix.md` | 95/95 MySQL 表均有 Postgres target、PK、logical FK 狀態、unique/default、index count 與 domain owner。 | 否；純設計。 |
| `drizzle/schema.pg.ts` | 使用 `pgTable`、`pgEnum`、Postgres type 的 95 表草案。 | 否；禁止 `db:push`、migration import 與 runtime import。 |
| `type-conversion-register.md` | 型別數量、轉換風險與 fixture 準則。 | 否；純設計。 |
| `raw-sql-parity.csv` | 510 個 source trace entry（390 `sql` tag + 120 `.execute()` call），每筆含檔案、行號、owner、分類與 target design。 | 否；所有 entries 仍為 `not_started` 測試狀態。 |
| `business-data-contracts.md` | 固定 `productType`、TCG game ID、PSA 10 熱門資格、UTC、decimal、Auth/S3 範圍凍結。 | 是；作為後續設計與測試的 contract。 |

## 2. Source Snapshot 與差異控制

S1 artifacts 依目前受管 repository 的 95-table `drizzle/schema_new.ts` snapshot 產生，source SHA-256 為 `c78e658defe2232014f4f33d0a0f48cde10e716d1ded66c9c8cf4ef4bb937750`。staging-only branch 的起點是 GitHub `main` commit `89e75cdd1fa810aa2799d8706f47d359a00e602f`，其中舊版 source schema 僅有 91 張表。

因此，branch 保存的是 **95-table source snapshot 的衍生設計 artifact**，而不是擅自將受管 runtime、MySQL schema、Production configuration 或資料帶入 GitHub。此安排避免以舊 branch schema 縮減設計範圍；任何實作階段都應先核對 source snapshot hash，出現 drift 時必須重新產生 inventory，而不是手動修補 migration。[1]

## 3. PostgreSQL Mapping 設計

現有 MySQL `int().autoincrement()` 對應為 PostgreSQL `integer().generatedByDefaultAsIdentity()`；MySQL enum 對應為 table-scoped `pgEnum`；MySQL `timestamp` 暫定為 `timestamptz` 設計提案；`decimal` 維持 exact `numeric(precision, scale)`。這些是 schema **design proposals**，尚非已批准的 migration。[3]

| MySQL／Drizzle source | PostgreSQL proposal | S2 前不可跳過的決定 |
|---|---|---|
| `mysqlTable` | 相同 physical table name 的 `pgTable` | 維持 application identifier，除非另有明確 naming migration。 |
| `int().autoincrement()` | `integer().generatedByDefaultAsIdentity()` | 日後如有獲批准 import，sequence reset 必須以目標最大 ID 為依據。 |
| `mysqlEnum` | Table-scoped `pgEnum` | Enum value 的新增、廢止與 rollback 需有 migration lifecycle。 |
| `decimal` | 同 precision/scale 的 `numeric` | 價格、FX、訂單與 payment 不可變成 JavaScript float。 |
| `timestamp` | `timestamp(..., { withTimezone: true })` | 每個 business timestamp 必須完成 UTC／HKT local date／pure date 判定。 |
| `.onUpdateNow()` | Drizzle `$onUpdate(() => new Date())` placeholder | 必須決定 application-side update 或 database trigger，並用 concurrent-writer fixture 驗證。 |
| Text-stored JSON | 保持 `text`，僅在有明確 query/index需求時轉 `jsonb` | 要先驗證 payload shape、null／malformed JSON、query path 與 GIN/expression index。 |

### 外鍵與 Primary Key 風險

現行 schema 沒有以 Drizzle 宣告任何 `.references()`。雖然 inventory 識別出 **136** 個 integer／bigint logical ID candidates，但這些只用來安排 review，絕不可當作「已可建立 FK」。`productType` 造成的 card／sealed product polymorphism、nullable external ID、歷史 orphan row 及循環 reference 都會影響 S2 constraint 設計。

特別是 `post_tags` 在 source 沒有 primary key，S2 需先以 synthetic relation fixture 驗證 `(postId, tagId)` 是否可安全成為 composite primary key 或 unique constraint。未經這些驗證，不得把 source schema 的關係限制強化為 PostgreSQL physical FK。[2]

## 4. Raw SQL Compatibility Inventory

目前 repository source 掃描到 **390** 個 `sql` template tag 與 **120** 個 `.execute()` call，合計 **510** 個 trace entry。這是比早期規劃中的舊估算更完整的 source inventory；同一個 raw query 可能同時產生 tag 與 execute entry，故它不能直接當成 510 個獨立 query。S2 必須以 file+line+query boundary 做 de-duplication，並為每一個**獨立 query unit**記錄 PostgreSQL 寫法、conflict target、supporting index、fixture 及 automated assertion。[4]

| 初步分類 | Trace entries | S2 conversion focus |
|---|---:|---|
| MySQL identifier quoting | 446 | 將 backticks 移除或讓 Drizzle 管理 quoting；確認 camelCase identifiers 的 SQL contract。 |
| Date/time functions | 35 | 轉為 `date_trunc`、`to_char`、PostgreSQL interval；以 UTC/HKT boundary fixture 比對。 |
| Raw select | 18 | 驗證 casts、join、stable order、pagination 與 index plan。 |
| Upsert | 7 | 以明確 `ON CONFLICT (...) DO UPDATE` target 取代；不得依賴 MySQL `ON DUPLICATE KEY UPDATE`。 |
| Aggregation | 2 | 評估 `GROUP_CONCAT`→`string_agg`、ordering 與 null behavior。 |
| Raw update／fragment | 2 | 驗證 `RETURNING`、affected-row 与 parameters contract。 |

## 5. 已凍結的資料語義

| 契約 | S1 mapping rule |
|---|---|
| TCG game ID | Pokemon=`1`、One Piece=`2`、Yu-Gi-Oh=`3`、Dragon Ball=`60001`、Union Arena=`60002`、Weiss Schwarz=`60003`、Gundam=`60004`。日後 import 不可重新編號。 |
| `productType` | `single_card`／`sealed_product` 是 cardinality、價格、資料源與搜尋的核心分流；任何 `priceHistory` query 必須保留。 |
| PSA 10 熱門資格 | 僅近 7 日、`source=snkrdunk`、`grade=PSA 10`、`isSuspectedBulk=false` 的成交可用。 |
| UTC | 商業 moment 以 UTC storage 為標準，UI 才轉為使用者顯示時區。 |
| Price precision | 價格、FX、inventory cost、order 與 payment 保持 exact decimal；不用 float checksum。 |
| Scope freeze | 維持 Manus OAuth、session model 與 S3；不引入 Supabase Auth、Storage、Realtime、frontend Data API 或 RLS migration。 |

## 6. S2 前的 Go／No-Go 清單

下列項目尚未完成，故 **S1 不構成 S2 實作授權**：

| 未決項目 | 必要證據 | 若缺少證據 |
|---|---|---|
| 136 logical FK candidates | Synthetic orphan、nullable、polymorphic 和 circular-relation fixture，並逐項批准 physical constraint。 | 不建立 FK。 |
| Timestamp semantic register | 所有 auction、price history、order、offer、schedule 與 webhook time field 的 source timezone 判定。 | 不套用 `timestamptz` migration。 |
| Text JSON decision register | 每個 JSON-like text field 的 payload shape、query needs 和 index design。 | 不轉 JSONB。 |
| Raw SQL query-unit manifest | 510 trace entries de-duplicate 後達 100% owner／Postgres target／test-plan coverage。 | 不 port runtime／script query。 |
| Pooler and secret configuration | Lab-only pooler host、runtime/migration role separation、`prepare:false` tests；仍不可填入本關卡的空白 secret slot。 | 不建立 application DB connection。 |
| PITR / restore | Lab plan eligibility、owner、retention policy 與 restore drill plan。 | 不進行任何 data import 或 dual-write planning。 |

## 7. 驗證結果與 Production 保護

| 驗證 | 結果 |
|---|---|
| 95-table generator assertion | 通過。 |
| PostgreSQL schema draft TypeScript check | `pnpm check` 通過；未連線任何 database。 |
| Supabase Lab schema | 未改動；S1 未執行 migration／SQL。 |
| Data API | 維持關卡 B 已停用狀態；S1 未修改。 |
| Production MySQL／TiDB、Cloud Run、Heartbeat、workflow、secret、runtime driver | 未讀取、未修改、未切換。 |
| GitHub scope | S1 artifact 僅位於 `chore/supabase-lab-schema-parity` 工作副本；不得合併到 `main`。 |

## 8. 建議的下一步

請審閱 S1 artifacts 與本報告。若要繼續，下一份明確批准應只允許 **S2 設計審核**：選定 physical FK／PK、timestamp semantic register、JSONB decision register、raw SQL query-unit conversion plan、Lab migration order、runtime/migration role model及 Data API 保持停用的驗證設計。該批准本身**不應**套用 migration、建立表、填入 secret 或寫入 synthetic fixture；那些動作仍須再取得專門授權。

## 參考資料

[1]: ./s1-isolation-record.md "BOXIUM S1：Schema Inventory 與 Mapping 設計隔離紀錄"
[2]: ./schema-matrix.md "BOXIUM S1：MySQL／TiDB → PostgreSQL Schema Matrix"
[3]: ./type-conversion-register.md "BOXIUM S1：型別轉換清冊"
[4]: ./raw-sql-parity.csv "BOXIUM S1：Raw SQL Parity Manifest"
[5]: ./business-data-contracts.md "BOXIUM S1：資料語義契約凍結"
[6]: ../supabase-staging-gate-b-isolation-record.md "BOXIUM Supabase Lab/Staging：關卡 B 隔離執行紀錄"
