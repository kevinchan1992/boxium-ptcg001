# BOXIUM Free-plan Supabase 遷移：備份與回退設計

**Status: design only. No Production data has been read, exported or imported.**

## 簡單原則

BOXIUM 會使用免費 Supabase Production project，但在未使用 PITR 的情況下，不能假設可在幾分鐘內把 Supabase 還原到任意時間點。因此遷移期間最重要的安全網是：**現有 MySQL/TiDB 保持不變且繼續可用，直到 Supabase 已完成資料核對、影子讀取和切換後穩定期。**

如果 Supabase 匯入失敗或資料核對不通過，平台不會停機：平台仍繼續使用 MySQL/TiDB，Supabase target 只會被清空／重建並重新進行受控匯入。Production `DATABASE_URL` 在真正批准 cutover 前不會變更。

## Free-plan recovery workflow

| Stage | What happens | Recovery action |
|---|---|---|
| Before export | Capture a read-only manifest: source schema version, per-table row counts, primary-key ranges, domain totals and critical timestamp/game/productType checks. | If manifest generation fails, do not export. MySQL/TiDB remains authoritative. |
| Controlled import | Write data only through a migration-only server-side channel into the empty Supabase target; maintain a resumable import ledger and table checksums. | Stop the import, discard/recreate only the unserved Supabase target, then retry from the immutable source. |
| Reconciliation | Compare source/target counts, key sets, totals and exception ledger before any application read path. | Any mismatch blocks shadow read and preserves MySQL/TiDB as the platform database. |
| Shadow/dual write | Feature flags retain MySQL/TiDB as the write authority until discrepancy thresholds are zero. | Disable the flag in seconds; no user-facing application path depends on Supabase. |
| Approved cutover | Keep MySQL/TiDB read-only but available for an agreed rollback window. | Switch the server-side database mode back to MySQL/TiDB; investigate Supabase separately. |

## Data-handling rules

No database dump, PII, session, payment, webhook payload or credential may be committed, put in browser storage, exposed in logs, or uploaded to BOXIUM's public static S3 bucket. Any one-time migration payload must use a server-side managed secret for transit and a private, encrypted workspace; it must be deleted after its checksum/reconciliation record is retained. Migration documents contain only counts, hashes and non-secret evidence.

## What Free plan does and does not change

The Free plan is sufficient to create and validate the target database. It does not provide the paid PITR recovery process chosen earlier. Supabase recommends that free-tier projects regularly create their own logical export; BOXIUM will not automate such an export until a private encrypted destination, retention period and runbook are separately chosen.[1]

This design does not authorize data export, import, M06 credentials, application code changes, Data API enablement, Supabase Auth/Storage/Realtime, shadow read, dual write or cutover. It defines the recovery contract these later gates must satisfy.

## References

[1]: https://supabase.com/docs/guides/platform/backups "Supabase Database Backups"
