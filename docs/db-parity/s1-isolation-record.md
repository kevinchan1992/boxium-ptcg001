# BOXIUM S1：Schema Inventory 與 Mapping 設計隔離紀錄

**狀態：執行中；此文件只記錄 source-code-only analysis，未執行任何資料庫操作。**

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
