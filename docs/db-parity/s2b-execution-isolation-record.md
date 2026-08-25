# BOXIUM S2-B：Lab Baseline Execution Isolation Record

**Result: completed in Lab only; Production changes: none.**

| Boundary | Evidence |
|---|---|
| Supabase target | All DDL used only project ref `ekqd…lqew`, the Gate B Singapore Lab allowlist. |
| Schema scope | M02–M04 only. M05 constraints and M06 grants have no applied migration. |
| Data scope | Schema inventory reports 95 tables and 0 rows in every table. No fixture, import, dump or production payload was used. |
| Direct access | Data API remains disabled; no frontend SDK, REST/GraphQL/Realtime client or `VITE_*` database key was added. |
| RLS | Deferred by user decision until an independent security gate; no policies were auto-applied. |
| Recovery | Failed original M04 did not create a migration record. The successful schema baseline is limited to empty Lab objects; future rollback requires a separately approved Lab-only plan. |
| Managed Production project | `git status --short` returned clean. |
| GitHub main | Remained `89e75cdd1fa810aa2799d8706f47d359a00e602f`. |
| Excluded systems | No Production MySQL/TiDB connection, `DATABASE_URL`, Cloud Run, GitHub production environment/workflow, Heartbeat, S3/Auth or domain configuration was read or changed. |
