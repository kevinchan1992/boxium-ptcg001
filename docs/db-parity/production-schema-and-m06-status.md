# BOXIUM Supabase Production：Schema 與 M06 狀態

**Status: empty production target secured; actual BOXIUM data has not been copied.**

The standalone Singapore Supabase Production project now contains the reviewed M02–M05 schema baseline: 95 empty tables, 96 enum/domain types, 206 index/unique proposals and ten validated high-confidence foreign keys. M06 then created non-login `boxium_runtime` and `boxium_migrator` database roles, revoked direct `anon`/`authenticated` privileges, and removed access inherited through `PUBLIC`.

| Verification | Result |
|---|---|
| Data API | Disabled. |
| `anon` / `authenticated` public schema usage | `false` / `false`. |
| `anon` / `authenticated` DML on `public.games` | `false` / `false`. |
| `boxium_runtime` DML on `public.games` | `true`. |
| `boxium_migrator` migration-table privileges | `true`. |
| Rows | All 95 tables report 0 rows. |
| Runtime credential | Not created; the roles are intentionally `NOLOGIN`. |
| RLS | Policies deliberately deferred. Data API is disabled and external client roles have no public-schema access. |
| Current BOXIUM runtime | Still MySQL/TiDB; `DATABASE_URL` and application code are unchanged. |

## Next required gate

Before the platform can use Supabase, a controlled read/copy of the current BOXIUM database is required. This is a high-impact operation because it handles real Production data. The next gate must create a non-secret backup manifest, read-only quality inventory, encrypted server-side transfer plan, reconciliation criteria and recovery evidence before copying a single real row. No actual data export, import, `LOGIN` credential, app connection, shadow read or cutover has been authorized by this document.
