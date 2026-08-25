# BOXIUM 正式 Supabase 資料庫遷移：Activation Gate

**Status: zero-fee route; schema/security baseline complete, real data copy remains blocked pending a dedicated gate.**

## 已完成的基礎

BOXIUM 現有 MySQL/TiDB runtime 未被改動；獨立 Supabase target `BOXIUM Production PostgreSQL`（Singapore）已建立、Data API 已停用，並與 schema/synthetic Lab 分離。M02–M05 schema baseline與M06 non-login server-only access controls已套用，但所有95張表仍為空，尚不代表資料或應用程式已遷移。

## 目前阻擋條件

| Gate | Evidence | Result |
|---|---|---|
| Organization plan | Boxium organization reports `free`; user chose zero-fee route. | Manual backup/recovery route required. |
| Production target | 95-table M02–M05 baseline, all rows zero; no runtime connection. | Safe schema baseline only. |
| PITR | No entitlement, recovery window or restore drill. | Not used under user-selected Free plan. |
| Compute | No paid compute upgrade. | Free-plan operating constraint. |
| Recovery drill | No Lab/Production-target restore to timestamp and no post-restore checksum proof. | **Blocked**. |
| Production data scope | No export approval, read-only quality audit or encrypted import channel. | **Blocked**. |
| M06 access | Non-login runtime/migration roles and client-role revocations applied; no managed secret/login binding or runtime connection. | Partially passed; credential gate remains. |
| Runtime/cutover | `DATABASE_URL`, application database driver, pooler, shadow/dual-write, kill switch and load tests are absent. | **Blocked**. |

## First important decision: Supabase plan and recovery budget

Supabase documents that PITR requires a Pro, Team or Enterprise plan and at least Small compute. PITR is a separately billed hourly add-on and not covered by a spend cap. Published seven-day retention pricing is USD 0.137/hour (about USD 100/month), before the plan and Small compute charges.[1] [2]

The user must explicitly approve the actual plan/compute/PITR charges shown in the Supabase dashboard before any upgrade or PITR enablement. After that approval, the first mutation is **not data import**: it is a Lab-only restore drill to an agreed timestamp, followed by schema/migration/zero-unplanned-data-loss evidence.

## Controlled sequence after plan approval

1. Enable the approved plan, Small compute and seven-day PITR on the separate Production target; record non-secret entitlement evidence.
2. Create a disposable restore rehearsal target or use an approved Lab recovery point; validate restore timing, schema/migration state and a known synthetic checksum.
3. Obtain a separate authorization for a read-only Production MySQL/TiDB data-quality inventory only. This report must identify nullability, duplicate keys, orphan candidates, UTC/HKT timestamp interpretation, JSON parse errors, game IDs and `productType` anomalies; it must not export/import records yet.
4. Design a controlled import manifest using migration-only credentials and an encrypted server-side channel. Data API bulk import and browser access remain prohibited.
5. Import only after user approval of the quality report and manifest; reconcile primary-key sets, row counts, domain totals and a discrepancy ledger before shadow read.
6. Only after M06, shadow read, dual-write, pooler load tests, kill-switch rehearsal and a maintenance approval may Production `DATABASE_URL` be considered for change.

## Non-negotiable exclusions

Do not use Supabase Auth, Storage, Realtime, Data API browser clients or `VITE_*` database keys. Retain Manus OAuth and S3. No production data, secret value, connection string or runtime configuration enters source control or user-facing documents.

## References

[1]: https://supabase.com/docs/guides/platform/backups "Supabase Database Backups and Point-in-Time Recovery"
[2]: https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery "Manage Point-in-Time Recovery usage"
