# BOXIUM Controlled Data Copy Manifest

**Status: approved to inventory and prepare. Real-row copy has not started.**

| Step | Scope | Output | Safety rule |
|---|---|---|---|
| S0 | Read-only source inventory | Per-table counts and source schema SHA-256 only. | Never write data values or `DATABASE_URL` into files/logs. |
| S1 | Source quality checks | Per-table null/duplicate/FK-orphan summaries. | Read-only on MySQL/TiDB; no dump yet. |
| S2 | Encrypted batch package design | Batch boundaries, row checksum and replay ledger. | No public S3 object, browser transfer or Data API. |
| S3 | Batch copy | Server-side migration channel into the isolated Supabase Production target. | Stop after any error; MySQL/TiDB stays authoritative. |
| S4 | Reconciliation | Counts, primary-key checksum, critical timestamp/game/productType checks. | No runtime cutover on any mismatch. |

The current action is S0 only. It reads only row counts from the managed MySQL/TiDB database and writes no business data to the repository, Supabase, console or user-facing report.
