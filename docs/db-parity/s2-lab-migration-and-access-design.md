# BOXIUM S2：Lab Migration、Access Role 與 Data API 保護設計

**狀態：設計審核文件；不是 migration，禁止執行。**

> 本文件描述日後如何**只在已驗證的 Supabase Lab**套用 schema。它沒有建立 migration file、SQL script、connection、role、table、index、grant、secret value 或測試資料；不得將任何範例複製到 SQL Editor 或自動化 pipeline，直至使用者另行批准「S2 套用 Lab migration」。

## 1. 不可變更的安全邊界

| 邊界 | S2 設計決定 |
|---|---|
| Production authority | BOXIUM Production MySQL／TiDB 仍為唯一業務權威；本文件不得改變 `server/db.ts`、`DATABASE_URL`、Cloud Run、GitHub production workflow、Heartbeat 或任何 runtime。 |
| Supabase scope | 只使用 Gate B 建立的獨立 Lab project；不可引用 Production project、credential、data export 或 webhook payload。 |
| Frontend access | 不加入 `@supabase/supabase-js`、REST、GraphQL、Realtime、`VITE_*` database key 或 browser DSN。 |
| Auth／Storage | 保持 Manus OAuth、既有 session model 與 S3；不建立 Supabase Auth、Storage、Realtime 或 RLS migration 專案。 |
| Execution | 不建立可套用 migration，亦不執行 DDL、DML、`db:push`、fixture、PITR、role creation 或 secret fill。 |

Supabase 說明在不使用 client library、REST 或 GraphQL 時，可停用 Data API，且停用後自動產生 REST endpoints 不會回應。[1] Gate B 已在 Lab 完成停用；S2 僅將其列為不可回退的驗收條件。

## 2. 建議的未來 Lab-only migration order

下表是 **migration manifest 的設計順序**。每一步在日後都需要獨立的 preflight、Lab allowlist 與 transaction/rollback evidence；此刻均為 `NOT EXECUTED`。

| 設計序號 | 未來名稱 | 目的 | 先決條件 | 明確禁止事項 | 回退策略 |
|---|---|---|---|---|---|
| M00 | `lab-target-preflight` | 驗證 environment label、project ref、approved host、DB name、migration role 與 Data API disabled。 | `SUPABASE_LAB_*` 值日後由受管 secret store 注入。 | 不接受 MySQL host、Production host、空 label 或 `VITE_*`。 | Fail closed；不開 connection 或不執行 SQL。 |
| M01 | `baseline-access-boundary` | 定義 runtime/migrator separation 與 future default-privilege baseline。 | M00 evidence。 | 不啟用 Data API、Supabase Auth/Storage/Realtime。 | Revoke newly granted runtime privileges；Data API 保持 disabled。 |
| M02 | `enum-and-domain-types` | 依 `schema.pg.ts` 建立 enum/type；不導入 data。 | 最新 source snapshot hash 與 enum lifecycle review。 | 直接把未知 historic string 當 enum value。 | In Lab 可只 drop 尚未被 table 使用的 new type；已引用需 forward fix。 |
| M03 | `base-tables-identity` | 建立 95 table 的 identity、column、default 和 primary key baseline。 | S1 95-table mapping仍與 source hash 相符。 | 加入未驗證 FK、填入 data、reset sequence。 | Transactional DDL rollback；失敗時 drop only newly-created empty Lab objects。 |
| M04 | `indexes-and-unique` | 按 query contract 建立必需 index/unique；保留 index decision register。 | S2 raw SQL/index design review。 | 逐一盲目照搬所有 MySQL index，或先建昂貴 GIN index。 | Drop only the new index after `EXPLAIN` review。 |
| M05 | `validated-constraints` | 只加入經 synthetic fixtures 證明的 FK/check/composite key。 | S3 fixture test and explicit constraint approval。 | 將 136 logical ID candidate 自動轉 FK。 | Drop newly-added constraint；不修改 source data。 |
| M06 | `runtime-grants` | 只讓 runtime role 操作已審核的 `public` business tables/sequences。 | Role smoke test, no-Data-API probe plan. | 授予 `anon`、`authenticated` 或 browser role 業務資料存取。 | Revoke runtime grant and disable application path by server-side flag。 |
| M07 | `schema-fingerprint` | 記錄 enum/table/column/index/constraint fingerprint，與 S1 matrix comparison。 | M02–M06 migration evidence。 | 宣稱 data parity 或 Production readiness。 | 保留 report；必要時 rollback latest Lab-only migration。 |

### Schema namespace decision

S1 draft 使用 application-compatible `pgTable` physical names，設計上仍使用 PostgreSQL `public` schema。原因是現有 application table name 已是 contract，且 BOXIUM 不開放 Data API；改用新 application schema 會同時引入 Drizzle namespace、search-path 和 query rewrite 風險。為防止未來意外 Data API exposure，保護方式是保持 Data API disabled、移除 Data API role default privileges，並只向自訂 server runtime role 授權，而不是在本期改變 schema namespace。[1]

## 3. Runtime / migration credential separation

| 身分 | 日後用途 | Connection path | Privilege boundary | Secret slot | 本 S2 狀態 |
|---|---|---|---|---|---|
| `boxium_lab_migrator` | 僅 CI-controlled Lab schema migration、schema fingerprint、rollback procedure。 | Direct/session connection only, not runtime transaction pooler. | DDL owner or delegated controlled DDL capability; never used by Express/tRPC, GitHub scraper, Heartbeat or frontend. | `SUPABASE_LAB_DATABASE_URL_MIGRATIONS` | Name only; value remains empty. |
| `boxium_lab_runtime` | 未來 Express/tRPC server-side application CRUD。 | Supavisor transaction pooler, port 6543, SSL; `prepare:false`. | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`; only granted DML/sequence usage for explicitly approved business objects. | `SUPABASE_LAB_DATABASE_URL_RUNTIME` | Name only; role is not created. |
| `postgres` / project owner | Supabase-controlled bootstrap only. | Direct/session only; confined to manually approved Lab bootstrap. | Never placed in runtime, client, GitHub job, Heartbeat or frontend environment. | None in BOXIUM runtime contract. | Not used. |
| `anon`, `authenticated`, `service_role` | Supabase Data API roles, not BOXIUM application identities. | No BOXIUM client connection. | No BOXIUM business-table grants in the design baseline; Data API remains disabled. | None. | Not used. |

Supabase documents that runtime Data API reachability depends on grants plus RLS, and notes that existing projects may give new public tables/functions automatic default privileges. The future defensive baseline therefore revokes default table/function/sequence privileges from the Data API roles. This is an additional defense; the primary control remains a disabled Data API and server-side only access.[1]

### Future grant model — design only

The following are **semantics**, not runnable commands in this stage:

| Object type | `boxium_lab_runtime` | `boxium_lab_migrator` | `anon` / `authenticated` / `service_role` |
|---|---|---|---|
| `public` schema | `USAGE` only after M06. | `USAGE`, controlled `CREATE` during migration. | No BOXIUM application grant. |
| Business tables | Explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` only on the approved 95-table set. | Owns/migrates schema; no application traffic. | No BOXIUM application grant. |
| Identity sequences | `USAGE`, `SELECT` only for approved inserts. | Owns/creates. | No BOXIUM application grant. |
| Functions | No implicit `EXECUTE`; explicit allowlist only if a server-only function is later approved. | Creates/changes through reviewed migration. | No BOXIUM application grant. |
| Auth/Storage schemas | None. | None. | Scope excluded. |

## 4. Pooler and connection contract

Future Cloud Run runtime must use the Lab transaction pooler connection, SSL and `prepare:false`; it must not share a connection credential with schema migration. Supabase notes that transaction pooler backend connections can preserve session-level settings, so application code must never issue session-level `SET`, and maintenance work that requires session state must use a separate direct/session connection.[2] Supabase also documents that transaction pooling does not support prepared statements.[3]

| Check | Runtime expectation | Migration expectation | Fail-closed behavior |
|---|---|---|---|
| Environment | `SUPABASE_LAB_ENVIRONMENT=lab` | same label | Any other label aborts before connection. |
| Host | Exact configured Lab pooler host matching `SUPABASE_LAB_ALLOWED_POOLER_HOST`. | Lab direct/session host, separately allowlisted. | Unknown / MySQL / Production host aborts. |
| Port | `6543`. | Direct/session route appropriate to approved migration path; never runtime `6543` by default. | Wrong port aborts. |
| Driver | Postgres driver with `prepare:false`; bounded pool after Lab load test. | One controlled migration client; no app pool reuse. | Prepared statement / session config error aborts. |
| Logging | Redact URL/password; log only safe target label and short project-ref fingerprint. | Same. | Any DSN/password in logs is a security incident and stops work. |

## 5. Data API and direct-access proof plan

No browser client or HTTP Data API probe will be run during this S2 design stage. Before M01 or M06 is ever applied, the future Lab validation must demonstrate all conditions below without exposing credentials:

| Check | Expected result | Evidence record |
|---|---|---|
| Dashboard configuration | Lab `Enable Data API` remains off. | Timestamped non-secret configuration review. |
| Browser/source scan | No `@supabase/*` browser import; no project URL/anon key/`VITE_*` DB value. | CI grep/dependency output. |
| Anonymous REST/GraphQL endpoint | No business data is returned; expected disabled endpoint behavior. | HTTP status only, no sensitive payload. |
| Database grants | `anon`, `authenticated`, `service_role` do not have BOXIUM application grants. | Catalog query result containing only role/object names. |
| Server access path | Only Express/tRPC process uses runtime role. | Configuration test and audit record. |

## 6. S2 acceptance requirements

S2 design is complete only when the later executor can answer **all** questions below without guessing:

1. Which source snapshot generated the 95-table draft, and does its SHA-256 still match?
2. Which role uses Lab transaction pooler, which uses Lab direct/session migration connection, and why are they separate?
3. Why do Data API roles have no BOXIUM application grant even though Data API is disabled?
4. Which M05 constraints are withheld until S3 synthetic fixture results?
5. What exact evidence causes M00 to fail before connecting to a non-Lab target?

No answer may rely on a Production connection, a hard-coded secret, or an assumed FK/timestamp/JSON shape.

## 參考資料

[1]: ./s2-research-sources.md "BOXIUM S2：官方研究來源與設計依據"
[2]: https://supabase.com/docs/guides/troubleshooting/resolving-cannot-execute-update-in-a-read-only-transaction-on-transaction-pooler-connections-ef582c "Supabase：Transaction pooler session state"
[3]: https://supabase.com/docs/guides/troubleshooting/error-prepared-statement-xxx-already-exists-3laqeM "Supabase：Prepared statements and poolers"
[4]: ./s1-schema-inventory-mapping-report.md "BOXIUM S1：Schema Inventory 與 PostgreSQL Mapping 設計報告"
