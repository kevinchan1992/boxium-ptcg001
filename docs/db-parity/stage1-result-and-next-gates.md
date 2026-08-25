# BOXIUM 資料庫遷移：階段一完成與後續 Gate

**作者：Manus AI**  
**狀態：階段一（M05）完成；階段二至四未開始。**

## 階段一：外鍵、約束與合成 fixture

M05 已在隔離 Singapore Supabase Lab 成功建立十條高信心 foreign keys，並用單一原子 synthetic fixture transaction 驗證 valid relation、orphan rejection、existing unique/NOT NULL constraints，以及 `RESTRICT`、`SET NULL`、`CASCADE` delete semantics。所有測試值都位於保留 ID range `910001–910099`，執行結果為 `m05_fixture_rows_remaining = 0`；其後 95 張 Lab tables 均為 0 rows。[1]

| Outcome | Result |
|---|---|
| Physical FK | 10 constraints across cards/game, sealed product/game, content/category/author/tag/version, and user collection/user/card relations. |
| Relation integrity | Positive inserts pass; 5 orphan scenarios, 1 NOT NULL scenario and 1 unique scenario reject as designed. |
| Data isolation | No Production rows, PII, payment, session, webhook or card-market data entered Lab. |
| M05 scope boundary | 126+ other logical candidates remain unmaterialized, including polymorphic `productType` relations. |
| Lab state | M02–M05 schema exists; fixtures are fully cleared; Data API remains disabled. |

## 階段二：資料匯入與完整性對帳

這一階段目前**被安全 gate 阻擋**。Lab organization 是 Free plan，沒有 PITR entitlement 或 restore-drill evidence。Supabase documents that PITR is a paid add-on for Pro/Team/Enterprise, requires at least Small compute, is billed hourly outside the spend cap, and temporarily makes a project inaccessible while it restores.[2] [3]

| 必要條件 | 現況 | 可否開始資料匯入 |
|---|---|---|
| Lab schema/FK baseline | 已完成 | 不足夠 |
| Data API disabled | 已完成 | 不足夠 |
| PITR + restore drill | 未具備 | **否** |
| Production export approval | 未取得 | **否** |
| Source orphan/duplicate/timezone/JSON audit | 未做 | **否** |
| Row count/hash/discrepancy ledger | 未做 | **否** |

資料匯入前必須先作出 PITR／compute 的**成本與可用性決策**。之後才可在獨立 gate 下進行只讀 data-quality report、Lab restore drill、最小權限 migration channel、可重啟 import、row-count／key-set／domain-total reconciliation；任何 Production dump 或正式 import 均未被本階段授權。[2] [4]

## 階段三：M06 安全與權限控制

M06 未開始。你已批准暫時維持 **Data API disabled + 不啟用 RLS/policy**；這避免 browser direct access 進入 Lab，但不可以把這個空 schema 視為 Production-ready security configuration。M06 必須獨立設計並測試 server-only runtime role、separate migration role、least-privilege grants、RLS policies和拒絕路徑，再評估是否允許任何 Data API surface。[5]

## 階段四：Production cutover

Production cutover 未開始，且仍被下列事項阻擋：PITR restore proof、Production-derived data reconciliation、raw SQL conversion closure、pooler load test with `prepare: false`、shadow read/dual-write discrepancy ledger、M06 access proof、kill switch rehearsal及明確 maintenance window。**Production `DATABASE_URL`、Cloud Run、current MySQL/TiDB、GitHub production workflow/environment及Heartbeat均未被改動。**

## Current branch and safety state

All migration documents and disabled artifacts reside only in GitHub staging branch `chore/supabase-lab-schema-parity`; GitHub `main` and the managed Production working tree remain unchanged. The user selected **Option B**: no paid Lab/PITR upgrade and no Production data import planning. Until a new explicit reversal, I will not read/export/import Production data or start M06/cutover work.[6]

## References

[1]: ./m05-execution-isolation-record.md "M05 Lab synthetic integrity execution record"
[2]: ./stage2-data-import-gate.md "Stage 2 data import and PITR gate"
[3]: https://supabase.com/docs/guides/platform/backups "Supabase Database Backups and PITR"
[4]: https://supabase.com/docs/guides/database/import-data "Import data into Supabase"
[5]: ./s2b-security-decision.md "Data API-disabled and RLS-deferred decision"
[6]: ./stage2-choice-b-stop-record.md "Stage 2 Option B stop record"
