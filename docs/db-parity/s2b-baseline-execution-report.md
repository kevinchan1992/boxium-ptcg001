# BOXIUM S2-B：Lab M00–M04 Schema Baseline 執行報告

**狀態：完成；只在隔離 Supabase Lab 執行。**

> BOXIUM Production MySQL／TiDB 仍是唯一業務權威。S2-B 僅在 allowlisted Lab project `ekqd…lqew` 套用空資料 schema baseline；沒有讀取、匯出或寫入 Production data，也沒有改動 application runtime、Cloud Run、GitHub production environment/workflow、Heartbeat、S3、Manus OAuth或 `server/db.ts`。

## 執行摘要

| 項目 | 結果 |
|---|---|
| Target | Supabase Lab ref `ekqd…lqew`，Singapore `ap-southeast-1`，狀態 `ACTIVE_HEALTHY`。 |
| M00 | Passed after approved S1-refresh：current source SHA-256 與 bundle manifest 均為 `c78e…7750`。 |
| M01 | 只記錄 access boundary；沒有 role、grant、runtime DSN 或 application connection。 |
| M02 | 成功套用 `m02_enum_and_domain_types`。 |
| M03 | 成功套用 `m03_base_tables_and_identity`。 |
| M04 | 初次因 PostgreSQL schema-wide index name collision (`cardId_idx`) fail closed；離線修正四個 collision 後，成功套用 `m04_indexes_and_unique_resolved`。 |
| Lab schema | 95 tables、95 tables with 0 rows、96 enum proposals、206 named index/unique proposals；沒有 physical FK。 |
| M05 | Intentionally absent：沒有 FK/check/composite constraints。 |
| M06 | Intentionally absent：沒有 runtime role、grant或 application DSN。 |
| Production | Managed Production working tree clean；GitHub `main` 保持 `89e75cdd`。 |

## Migration evidence

| Migration | Version | Scope |
|---|---|---|
| `m02_enum_and_domain_types` | `20260825065020` | 96 Lab enum/type baseline。 |
| `m03_base_tables_and_identity` | `20260825065054` | 95 empty business-table identity/column baseline。 |
| `m04_indexes_and_unique_resolved` | `20260825065416` | 206 index/unique baseline，含 4 table-scoped name resolutions。 |

The failed first M04 attempt is absent from migration history. Its PostgreSQL `42P07` error was isolated to duplicate MySQL index names. The regenerated M04 uses deterministic `__<tableName>` suffixes for `cardId_idx` and `expiresAt_idx` on the two listing-cache tables; all 206 emitted PostgreSQL names are unique.[1]

## Security and advisor outcome

| Check | Outcome |
|---|---|
| Data API | Remains disabled. No schema can be queried through Data API; no browser client/key was introduced. |
| RLS | The schema inventory reports RLS disabled on the 95 empty baseline tables. User explicitly chose to defer RLS/policies until a future standalone safety gate, rather than enable RLS without policies. |
| Security advisor | Returned no lints after baseline application. |
| Performance advisor | Reports `INFO` findings expected for fresh empty tables: unused indexes and `post_tags` without a primary key. No index or PK is changed in S2-B because this phase preserves source schema parity; these items require future query/fixture evidence. |
| PITR | The organization is on the Free plan and no PITR entitlement/restore-drill evidence exists. This does not import data, but it remains a hard blocker for a future data-import/restore gate. |
| Disabled-bundle test | `server/s2aDisabledBundle.test.ts` passed 2/2 after the M04 rename fix. |
| Static safety scan | Passed: no DSN, browser database key, executable `.sql`, M05/M06 SQL or direct-access artifact was introduced. |
| Full TypeScript check | Not completed in this 1 GB sandbox: the pre-existing watch processes and full-project `tsc` exhausted memory even with `--skipLibCheck`. No application runtime code was changed in S2-B; the focused bundle test and static checks passed. |

## Explicitly not done

S2-B does not introduce fixtures, Production data, shadow read, dual-write, runtime connection strings, runtime role/grants, Supabase Auth/Storage/Realtime, browser Data API, RLS policies, foreign keys, check constraints, `jsonb` conversion, raw SQL conversion, pooler load tests or cutover behavior.

## Follow-on gates

The next work remains separately scoped: M05 requires synthetic-only relation/constraint fixtures; M06 requires a dedicated server-only role/access/RLS safety gate; any data import requires PITR eligibility and a restore drill; runtime integration requires a new managed-secret and pooler/load-test gate. No follow-on gate starts automatically.

## References

[1]: ./s2b-m04-index-resolution.md "M04 index collision resolution"
[2]: ./s2b-security-decision.md "Data API and RLS decision"
[3]: https://supabase.com/docs/guides/database/database-linter "Supabase Database Linter"
