# BOXIUM Production M06：Free-plan Server-side Security Design

**Status: design only. No role, grant, RLS policy, secret or application connection has been created.**

## Access model

BOXIUM will continue to use Manus OAuth, Express and tRPC as the only application access path. The new Supabase Production target has Data API disabled, so the browser will not use Supabase REST, GraphQL, Realtime, `supabase-js`, publishable keys or `VITE_*` database values. Supabase confirms that with Data API disabled, a project can be used like standard PostgreSQL via direct/pooler connections from trusted servers.[1]

| Actor | Intended access | Explicitly prohibited |
|---|---|---|
| Browser | Existing BOXIUM HTTPS → Express/tRPC only. | Direct Supabase client, Data API, database key or connection string. |
| BOXIUM runtime | A dedicated server-side runtime database role through a pooler connection; only the tables/operations required after schema mapping. | `postgres` superuser credential, migration DDL, browser exposure. |
| Migration runner | A separate, time-limited migration role used only by controlled schema/import tools. | Runtime traffic and client access. |
| Supabase built-in `anon` / `authenticated` | No public-table grants while Data API stays disabled. | Any BOXIUM business-table read/write path. |
| Operators | Dashboard/MCP only under explicit gate and non-secret audit records. | Role password disclosure, data export to logs/source control. |

## RLS decision

RLS protects exposed tables reached through client/API roles; Supabase requires both grants and policies for exposed schemas.[2] BOXIUM deliberately has no browser/API database access and retains Data API disabled. Therefore M06 will first deny/revoke client-role access and verify no direct path. It will **not** auto-generate 95 table-specific RLS policies before the runtime data model and policy tests exist; enabling RLS without valid policies can block service operation. A future dedicated RLS gate may enable it as defense in depth, with one allow/deny test suite per exposed table as Supabase recommends.[2]

## Required M06 gates before creation

1. Copy the reviewed M02–M05 schema only into the empty Production target, using the migration-only role once it exists; still no data import.
2. Create separate runtime and migration credential *slots* through managed secrets. Values may never appear in source, Git, logs, CLI arguments or user-facing evidence.
3. Apply one reviewed, idempotent M06 migration: role separation, `public` schema/client-role revocation, table grants for runtime only and default privilege rules.
4. Verify allow/deny paths using a disposable synthetic row and no browser Data API.
5. Add the runtime connection to the BOXIUM server only after a later import/reconciliation gate. The migration role must not be deployed with the application.

## References

[1]: https://supabase.com/docs/guides/database/secure-data "Securing your data"
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Row Level Security"
[3]: https://supabase.com/docs/guides/database/postgres/roles "Postgres Roles"
[4]: https://supabase.com/blog/supabase-security-2025-retro "Supabase Security Retro: 2025"
