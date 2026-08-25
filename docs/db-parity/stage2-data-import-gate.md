# BOXIUM 階段二：資料匯入、PITR 與對帳 Gate

**狀態：阻擋；不得執行 Production 資料讀取、dump、傳輸或匯入。**

> M05 只證明十條 high-confidence relation 可在空的 Lab schema 與 synthetic fixtures 中運作。它不證明 Production MySQL/TiDB 歷史資料能滿足新 FK、timezone、JSON 或 unique constraints，亦不授權任何正式資料移動。

## Current gate decision

| Requirement | Current evidence | Gate result |
|---|---|---|
| Isolated Lab baseline | M02–M05 applied; 95 tables remain empty after fixture cleanup. | Passed for schema-only work. |
| Data API/browser access | Data API disabled; no browser DB client or `VITE_*` DB key. | Passed. |
| PITR entitlement | The Lab organization is on Free plan; no PITR entitlement or restore-drill evidence exists. | **Blocked**. |
| Restore drill | No restore to a known timestamp and no post-restore checksum proof. | **Blocked**. |
| Production export authorization | Not requested or approved. | **Blocked**. |
| Source data remediation report | No orphan/duplicate/timezone/JSON audit from Production data. | **Blocked**. |
| Dual-engine reconciliation plan | No table-level row-count/hash/discrepancy ledger execution. | **Blocked**. |

## Why PITR must be a prior decision

Supabase documents that PITR is an add-on for Pro, Team and Enterprise projects and also requires at least Small compute. PITR is billed hourly and is not covered by a spend cap; the published 7-day retention example is about USD 100/month, before compute.[1] [2] Restores make the project inaccessible for the restore duration, so every restore drill requires a Lab-only maintenance plan and success criteria.[1]

This is therefore a **cost and availability decision**, not an implementation detail. It must be explicitly approved before a Production-derived import is considered. The current Free Lab is adequate for schema and synthetic validation, but it is not an approved recovery platform for real data.

## Future import gate sequence

1. Approve the Lab plan/compute/PITR cost and separately enable it; record the exact recovery window without exposing credentials.
2. Generate only a data-quality report from a controlled, approved read-only Production export: row counts, nullability, duplicate keys, FK orphan candidates, timestamp UTC/HKT classifications and JSON parse failures. Do not import yet.
3. Run and evidence a Lab-only PITR restore drill on a disposable restore point. Acceptance requires restoration to the intended timestamp, schema/migration verification, zero unplanned data loss in the test window and a documented downtime observation.
4. Approve a minimum-scope, encrypted import channel using migration-only credentials. The import plan must preserve S3 and Manus OAuth, avoid Data API bulk imports, and have an idempotent, restartable order plus a discrepancy ledger.
5. Perform reconciliation before any shadow read: table counts, primary-key set checksums, per-table domain totals, price-history timestamp distribution, critical game IDs and productType integrity.

Supabase advises planning large production imports, ensuring backup and disk capacity, and using a bulk method appropriate to the source rather than API bulk import.[3] For a MySQL source, its documentation describes `pgloader` as a bulk option; BOXIUM must additionally satisfy the conversion and reconciliation gates above before choosing any execution tooling.[3]

## Explicit prohibitions

No S2 stage may change `DATABASE_URL`, insert Production data into Lab, export customer/session/payment/webhook data, enable Data API, use Supabase Auth/Storage/Realtime, connect the frontend directly, perform dual-write, or cut over Production. M06 roles/RLS policies and Phase 4 cutover are separate high-risk gates.

## References

[1]: https://supabase.com/docs/guides/platform/backups "Supabase Database Backups and PITR"
[2]: https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery "Manage Point-in-Time Recovery usage"
[3]: https://supabase.com/docs/guides/database/import-data "Import data into Supabase"
