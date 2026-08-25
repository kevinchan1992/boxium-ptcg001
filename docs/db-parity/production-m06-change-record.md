# BOXIUM Production M06 Server-only Change Record

**Target: `bzq…kjtr` only. No application credential or traffic is created by this change.**

| Control | M06 action |
|---|---|
| Runtime role | `boxium_runtime` is `NOLOGIN`, `NOINHERIT` and has only DML/sequence privileges in `public`; enum/type-operation needs are deferred to the later controlled runtime credential test. |
| Migration role | `boxium_migrator` is `NOLOGIN`, `NOINHERIT` and has DDL-capable object privileges for future controlled migrations. |
| Client roles | `anon` and `authenticated` lose schema/table/sequence/function/default privileges. |
| PUBLIC inheritance | Follow-up M06a revokes inherited schema/table/sequence/function/default privileges from PostgreSQL `PUBLIC`, so anon/authenticated cannot retain schema usage indirectly. |
| Data API | Remains disabled; no frontend DB key is created. |
| RLS | No RLS policy is applied in this step; it remains a dedicated later gate. |
| Credential | No `LOGIN`, password, connection string or managed secret value is created. A later gate must create credential slots and a login-binding mechanism outside source control. |
| Data/runtime | No row, production export/import, `DATABASE_URL`, Cloud Run, GitHub production workflow or existing MySQL/TiDB behavior is changed. |

## Completion evidence

`m06_prod_server_only_roles_and_client_revocation` and follow-up `m06a_prod_revoke_public_inherited_privileges` applied successfully. The first M06 attempt failed closed before migration history was written because PostgreSQL does not support `GRANT USAGE ON ALL TYPES`; the invalid statements were removed and the corrected migration was independently retested.

The final read-only privilege check confirms: `anon` schema usage = false; `anon` DML on `public.games` = false; `authenticated` schema usage = false; `authenticated` DML on `public.games` = false; `boxium_runtime` DML = true; `boxium_migrator` migration-table privileges = true. Data API remains disabled. RLS policies remain deliberately deferred; no tables contain data.
