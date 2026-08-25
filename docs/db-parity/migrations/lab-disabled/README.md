# BOXIUM Supabase Lab：S2-A Disabled Migration Bundle

**狀態：只供審核，不能套用。**

> 此目錄不是 `drizzle/`、不是 `supabase/migrations/`，也沒有 connection credential。其 SQL artifact 使用 `.sql.disabled` 副檔名，因此不可被標準 migration runner 發現。任何人不得重新命名、移動或套用它們，除非使用者另行批准精確的 Lab-only execution gate。

## Bundle 規則

| 項目 | S2-A 規則 |
|---|---|
| Source | 只讀 `drizzle/schema.pg.ts` S1 design draft；其 source snapshot 必須在 execution 前重驗。 |
| Generation | 由 `scripts/generate-s2a-disabled-sql-bundle.mjs` 只讀解析草案並輸出 manual review DDL；此替代方案是因目前 published Drizzle CLI／ORM 組合不能編譯該 S1 草案。 |
| Output | 所有 DDL 均是 `.sql.disabled`，並由 `scripts/s2a-disabled-bundle.test.ts` 驗證；不在任何 migration runner discovery path。 |
| Forbidden | `drizzle-kit migrate`、`drizzle-kit push`、`pnpm db:push`、SQL Editor、`psql`、Supabase MCP SQL、fixture、role/grant/secret 任何修改。 |
| Scope | 不連線 Supabase Lab；不讀取或改寫 Production MySQL/TiDB；不更改 Cloud Run、runtime、GitHub production workflow/environment、Heartbeat、S3 或 Auth。 |

## Planned Migration Sequence

| Order | Design ID | S2-A artifact state | Execution gate required later |
|---|---|---|---|
| 00 | `lab-target-preflight` | Manifest only; no connection code. | S2-B |
| 01 | `baseline-access-boundary` | Manifest only; no role/grant SQL. | S2-B |
| 02 | `enum-and-domain-types` | Included only as disabled generated DDL where Drizzle draft defines it. | S2-B |
| 03 | `base-tables-identity` | Included only as disabled generated DDL. | S2-B |
| 04 | `indexes-and-unique` | Included only as disabled generated DDL. | S2-B after index review |
| 05 | `validated-constraints` | Explicitly absent; logical FK/PK decisions await synthetic evidence. | S2-C |
| 06 | `runtime-grants` | Explicitly absent; roles/grants await S3 evidence. | S2-C |
| 07 | `schema-fingerprint` | Manifest only; requires a separately approved read-only Lab catalogue check. | Later gate |

## Manual Bundle Contents

| File | Traceability | Scope |
|---|---|---|
| `manual/M02-enum-and-domain-types.sql.disabled` | `drizzle/schema.pg.ts` 的 96 個 `pgEnum` definition。 | 僅 enum type proposal。 |
| `manual/M03-base-tables-and-identity.sql.disabled` | S1 95-table mapping。 | 僅 table/column/identity/default/declared unique proposal；沒有 logical FK。 |
| `manual/M04-indexes-and-unique.sql.disabled` | `drizzle/schema.pg.ts` 的 206 個 named index/unique definition。 | 僅 source-declared named index proposal；需日後 query-plan review。 |
| `manual/bundle-summary.json` | 可機讀 count 和 omitted-stage record。 | 不含 credentials 或 connection metadata。 |

M05 與 M06 不會有 `.sql.disabled` file：前者需要 synthetic relation evidence，後者需要獨立 role/access test 和 Data API disabled proof。這兩個 omission 是安全控制，而不是缺漏。

## Manual Review Requirements

The resulting disabled DDL must still be reviewed for all S2 blockers: T6/T7 time semantics, JSONB candidates, exact raw SQL conflict targets, table `post_tags` key design, and the 136 logical FK candidates. Generation is not validation and is not an authority to apply anything.
