# BOXIUM 資料庫遷移：階段二選擇 B 停止紀錄

**決策：不升級 Supabase Lab、不啟用 PITR；維持 schema／synthetic-only。**

| Area | Approved boundary |
|---|---|
| Lab | Keep the existing Singapore Lab schema and synthetic-test evidence only. |
| PITR / compute / plan | Do not purchase, upgrade, enable, configure or test. |
| Production data | Do not read, export, dump, copy, transform, transmit, import or reconcile Production MySQL/TiDB data. |
| M06 | Do not create runtime/migration roles, grants, RLS policies, connection strings or managed secret values. |
| Direct access | Keep Data API disabled; do not add browser Supabase clients, REST/GraphQL/Realtime or `VITE_*` database keys. |
| Runtime | Do not modify `DATABASE_URL`, `server/db.ts`, Cloud Run, application feature flags, shadow read or dual-write. |
| Cutover | Do not schedule maintenance, deploy a database switch, change GitHub production environments/workflows or perform Production smoke tests. |

The current Lab has M02–M05 schema/constraint evidence and no residual fixture data. It is not an approved data-recovery, production-data or runtime target. Any future reversal of this decision requires a new explicit approval that separately identifies cost, recovery objectives, allowed data class and rollback evidence.
