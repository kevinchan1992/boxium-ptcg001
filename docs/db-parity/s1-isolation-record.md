# BOXIUM S1：Schema Inventory 與 Mapping 設計隔離紀錄

**狀態：完成，等待使用者審核；此文件只記錄 source-code-only analysis，未執行任何資料庫操作。**

## Supabase Lab Change Record

| 欄位 | 紀錄 |
|---|---|
| Change ID | `LAB-20260825-002` |
| Gate | C／S1 |
| Requested by | BOXIUM project owner |
| Approved by | BOXIUM project owner（明確批准「僅限 Lab 的 schema inventory 與 Postgres mapping 設計」） |
| Target environment | `lab` design artifacts and GitHub `chore/supabase-lab-schema-parity` only |
| Planned action | 解析目前 BOXIUM MySQL Drizzle schema 與 repository query source；產生 PostgreSQL mapping draft、型別轉換 register、raw SQL manifest 與資料契約文件。 |
| Production resources touched | `none` |
| Production data read/written | `none` |
| Supabase Lab connection／schema/data action | `none` |
| Secrets read/created/changed | `none` |
| Rollback / cleanup action | 刪除本 branch 的 S1-only artifacts；不需要、也不允許對 Production 執行回復。 |
| Timestamp (UTC) | `2026-08-25` |

## S1 強制邊界

| 允許 | 禁止 |
|---|---|
| 讀取 repository source、schema 與既有遷移文件；建立純文件／Drizzle draft。 | 連接 MySQL／TiDB、Supabase Lab 或任何 database；執行 DDL、DML、migration、fixture、`db:push` 或資料匯出。 |
| 將設計 artifacts 提交到 staging-only Git branch。 | 修改 GitHub `main`、Production workflow／environment、Cloud Run、Heartbeat、runtime DSN 或任何 Production secret。 |
| 記錄明確的未決 schema／FK／時區／raw SQL conversion 決策。 | 猜測 source FK、把 text JSON 自動轉 JSONB、或把 timestamp 一律解讀為 HKT。 |

## Source Snapshot 記錄

GitHub staging-only branch 由既有 `main` commit `89e75cdd1fa810aa2799d8706f47d359a00e602f` 分出，該 branch 的 `drizzle/schema_new.ts` 含 91 張 `mysqlTable` 定義。現行受管 BOXIUM project 的同名 schema 檔案含 95 張定義，檔案 SHA-256 為 `c78e658defe2232014f4f33d0a0f48cde10e716d1ded66c9c8cf4ef4bb937750`。

S1 的 inventory、mapping draft 與 manifest 將以這份**目前受管 source-code snapshot**為唯一輸入，並只將其衍生 artifact 提交到 staging-only branch；不會以較舊 branch schema 降低盤點範圍，也不會將任何 Production runtime 或資料庫設定帶入 branch。這是 source-code read-only analysis，不是 Production database access。

## S1 完成證據

| 驗證項目 | 結果 |
|---|---|
| Source schema inventory | 95 張 `mysqlTable` 定義全數對照；94 張宣告 primary key、0 張宣告 Drizzle `.references()`、189 個 secondary index、37 個 unique field/index。 |
| PostgreSQL mapping draft | 已產生 `drizzle/schema.pg.ts`，使用 `pgTable`、`pgEnum`、`numeric`、identity 與 `timestamptz` design proposal；檔首明確禁止 runtime import、`db:push` 或 migration apply。 |
| TypeScript validation | 現行受管 source tree 執行 `pnpm check` 通過；此 validation 沒有連線任何資料庫。 |
| Raw SQL manifest | 390 個 `sql` tag 和 120 個 `.execute()` call，合計 510 trace entries，均保存 file、line、owner、初步 PostgreSQL target design 和 `not_started` test status。 |
| Secret/direct-access scan | staging artifacts 不含 PostgreSQL/MySQL DSN、secret assignment、`VITE_*` Supabase key 或 `service_role` credential。 |
| Supabase Lab | 未連線、未讀取、未執行 DDL/DML/migration/fixture；Data API 無變更並維持關卡 B 的停用狀態。 |
| GitHub branch isolation | S1 artifacts 僅提交到 `chore/supabase-lab-schema-parity` commit `6e1fe273f15c963d76b3e2d2a9d6100fba014ba1`。GitHub `main` 仍為 `89e75cdd1fa810aa2799d8706f47d359a00e602f`，未被寫入。 |
| Production resources/data | MySQL／TiDB、Cloud Run、runtime secret、workflow、Heartbeat、production branch、S3/Auth behavior 與 Production data 均未讀取或修改。 |

## 仍需使用者批准的工作

S1 並未批准、更未執行：PostgreSQL physical FK/PK decision、timestamp semantic register、JSONB decision、raw SQL query-unit conversion、Lab migration、secret value 填寫、synthetic fixture、PITR/restore drill、shadow read、dual-write 或任何 Production runtime change。所有工作仍需要後續逐關明確批准。
