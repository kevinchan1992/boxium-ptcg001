# BOXIUM S2：Migration／Role／Timezone／JSONB／Raw SQL 設計隔離紀錄

**狀態：完成，等待使用者審核；僅限設計文件，未執行任何資料庫操作。**

## Supabase Lab Change Record

| 欄位 | 紀錄 |
|---|---|
| Change ID | `LAB-20260825-003` |
| Gate | S2 design review |
| Approved scope | 僅建立 migration、role、timezone、JSONB 與 raw SQL conversion 設計。 |
| Target | GitHub `chore/supabase-lab-schema-parity` branch 的 design artifacts。 |
| Lab target | 已建立的 BOXIUM Supabase Lab；本關卡不連線、不執行任何 SQL。 |
| Production resources/data | `none` — 未讀取、未修改、未寫入。 |
| Allowed output | Markdown／CSV design register、migration order、role model、test/rollback design。 |
| Explicitly prohibited | `db:push`、DDL/DML、role/grant creation、secret fill、fixture、PITR restore、Data API enable、runtime connection、Cloud Run/GitHub production/Heartbeat modification。 |
| Rollback / cleanup | 刪除 staging-only S2 artifacts；無任何 Lab/Production state 需要回復。 |

## Required final evidence

| 類別 | S2 pass condition |
|---|---|
| Branch isolation | S2 files only exist on the staging-only branch; GitHub `main` is unchanged. |
| Runtime isolation | No `server/db.ts`、Production DSN、Cloud Run、GitHub production environment/workflow 或 Heartbeat modification. |
| Secret isolation | No connection URL, password, project key, service role credential or `VITE_*` DB value in source, document, log or commit. |
| Lab isolation | Lab remains empty and no migration/SQL/fixture/role is applied. |
| Data API | Gate B disabled setting remains unchanged; no client SDK/API design is introduced. |

## 完成證據

| 驗證 | 結果 |
|---|---|
| S2 artifacts | 已建立 migration/access design、temporal/JSONB/raw SQL design、official research source register與 S2 design report。 |
| Source inputs | 延用 S1 95-table matrix、230 timestamp field inventory、JSON-like column inventory與 510 raw SQL trace entry manifest。 |
| Formatting | `git diff --check` 通過。 |
| Secret/direct-access scan | 未發現 PostgreSQL/MySQL DSN、password、anon key、service role credential或 browser `VITE_*` database key。 |
| Database action | 沒有連線/讀取/寫入 Supabase Lab 或 Production database；未執行 DDL、DML、migration、fixture、grant或 role creation。 |
| Runtime/Production action | 沒有修改 `server/db.ts`、runtime DSN、Cloud Run、GitHub production workflow/environment、Heartbeat、S3/Auth或 Production data。 |
| Data API | 設計維持 Gate B 的 disabled state；沒有 re-enable 或引入 browser client。 |
| GitHub branch proof | S2 artifact commit 為 `6c56c80d60943b7cb4d72c77a3c110f96c15b909`，僅位於 `chore/supabase-lab-schema-parity`。GitHub `main` 維持 `89e75cdd1fa810aa2799d8706f47d359a00e602f`。 |

## 後續需另行批准的操作

S2 設計不授權 M00–M07 execution、secret value fill、Lab role/grant creation、schema/table/index/constraint apply、synthetic fixture、PITR drill、shadow read、dual-write或任何 Production runtime/data action。未來每種動作均須使用者明確批准，並維持 Lab allowlist preflight。
