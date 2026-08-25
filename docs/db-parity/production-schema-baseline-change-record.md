# BOXIUM Production Supabase Schema Baseline Change Record

**Target: `bzq…kjtr` only. Change scope: M02–M05 schema DDL only.**

| Preflight | Expected state |
|---|---|
| Target identity | `BOXIUM Production PostgreSQL`, Singapore, distinct from Lab `ekqd…lqew`. |
| Direct access | Data API remains disabled. |
| Before DDL | Empty public schema and empty custom migration history. |
| Source | Reviewed, current M02–M05 `.sql.disabled` artifacts from staging-only branch. |
| Data | No export, import, fixture or application traffic. |
| Forbidden | `DATABASE_URL`, runtime credentials, role/grant, RLS/policy, browser access, Data API enablement, S3/Auth changes and all MySQL/TiDB changes. |

## Apply order

1. M02 enum/domain types.
2. M03 base tables/identity.
3. M04 globally unique named indexes/unique constraints.
4. M05 ten validated high-confidence foreign keys.

Each step is separately verified before the next. An error stops subsequent stages. With no imported data or runtime traffic, recovery is limited to the separate target: preserve MySQL/TiDB as authority and investigate/recreate the empty target only under a new approved change record.

## Completion evidence

| Migration | Result |
|---|---|
| `m02_prod_enum_and_domain_types` | Applied successfully. |
| `m03_prod_base_tables_and_identity` | Applied successfully. |
| `m04_prod_indexes_and_unique_resolved` | Applied successfully with globally unique PostgreSQL index names. |
| `m05_prod_validated_high_confidence_constraints` | Applied successfully; ten high-confidence FK constraints. |
| Data inventory | 95 tables, all 0 rows. No Production MySQL/TiDB data was read or imported. |
