# BOXIUM S2：Lab Migration 設計審核報告

**狀態：完成設計審核，等待使用者確認；未執行 migration 或資料庫寫入。**

> S2 只在 GitHub `chore/supabase-lab-schema-parity` branch 產生 design artifacts。沒有新增、修改或刪除 Supabase Lab 的 table、role、grant、index、constraint、function、secret、fixture 或資料；Production MySQL／TiDB、runtime、Cloud Run、GitHub production workflow/environment、Heartbeat、S3 和 Manus OAuth 亦完全未被操作。[1]

## 1. S2 設計結論

S2 將未來 Lab work 拆成 M00–M07 的 fail-closed migration order，並把 identity、connection、Data API、timestamp、JSONB 和 raw SQL 的高風險決策前移到實際 DDL 之前。此順序的重點不是更快建立 schema，而是防止錯誤 target、過度權限、時區漂移、JSON shape 假設或錯誤 conflict target 在空白 Lab 之外擴散。[2]

| 領域 | S2 design decision | 執行狀態 |
|---|---|---|
| Migration order | M00 preflight → M01 access baseline → M02 enum/domain → M03 tables/identity → M04 indexes/unique → M05 validated constraints → M06 runtime grants → M07 schema fingerprint。 | **Not executed** |
| Runtime role | `boxium_lab_runtime` 僅走 Lab transaction pooler、port 6543、SSL、`prepare:false`；不具 DDL/role management。 | **Role not created** |
| Migration role | `boxium_lab_migrator` 使用 direct/session connection，與 runtime credential 分離，僅留給日後受控 Lab migration。 | **Role/secret not created** |
| Data API | 維持 Gate B 已停用；Data API roles 無 BOXIUM business grant，default privilege future revoke 只作設計。 | **No setting/grant changed** |
| Timestamp | 230 source field 分為 T1–T7 semantic groups；商業 moment 目標為 UTC `timestamptz`，calendar-like field 须獨立判定。 | **No type migration** |
| JSONB | 只標示候選；PII/webhook/audit payload 維持 text，沒有自動 text→JSONB 轉換。 | **No data/type change** |
| Raw SQL | 510 trace entries 先去重為 query units，再明確指定 `ON CONFLICT`、time range、index、fixture 和 assertion。 | **No source code port** |

## 2. 核心安全設計

### 2.1 Target / credential fail-closed

未來 M00 必須在開 connection 前同時驗證 `SUPABASE_LAB_ENVIRONMENT=lab`、Lab project identity、approved host 和角色用途。runtime 與 migration secret name 已在 Gate B 建立為空 slot，但 S2 不填值；任何 MySQL host、Production host、缺少 label、錯誤 port、browser-exposed `VITE_*` key 或 log 中的 DSN 都會中止工作。這項控制確保「Lab-only」不是只靠人手記憶。[2]

### 2.2 Least privilege without Supabase Auth/RLS scope creep

BOXIUM 繼續以 Express/tRPC 和 Manus OAuth 管理業務授權。Data API 維持停用，且 `anon`、`authenticated`、`service_role` 不獲 BOXIUM business table grant。Supabase 說明停用 Data API 時自動 REST endpoint 不會回應；grant revoke 仍提供第二層防禦，避免日後有設定漂移時意外 exposure。[3]

這不是 Supabase Auth/RLS migration。S2 不建立 Supabase user profile、RLS policy 或 frontend Supabase SDK；一切 schema access 仍以 server-side runtime role 為入口。

### 2.3 Serverless pooler discipline

transaction pooler 適合未來短命 Serverless application connection，但 session-level setting 可能污染被重用的 backend connection；需要特定 session state 的 migration/maintenance 必須分開走 direct/session path。prepared statement 也不可用於 transaction pooling，因此 runtime driver contract 固定 `prepare:false`。[4] [5]

## 3. 資料語義設計

| 問題 | S2 rule | 仍需的 evidence |
|---|---|---|
| HKT 與 UTC | HKT 只作 display / business-day bucket；真正 time instant 不可受 session timezone 改變。 | HKT month boundary、7-day PSA 10 trend、auction/offer expiry、schedule retry synthetic fixture。 |
| Date-only fields | `releaseDate`、inventory buy/sell date、`tradeDate`、market trend date、grading calendar fields不假設為 UTC moment。 | Per-field code-use / source-format decision；缺少就不產生 column migration。 |
| Price/FX | 保持 numeric/exact decimal contract。 | Decimal string aggregation and checksum fixture。 |
| `productType` | single-card/sealed-product polymorphic relation 不自動成 FK。 | Synthetic orphan/nullable/polymorphic relation fixture。 |
| PII and raw payload | address、payment evidence、webhook/raw WhatsApp payload 不轉 JSONB。 | Separate privacy/security review. |

## 4. Raw SQL priority design

S1 找到的 510 trace entries包含 tag/execute pairing，S2 要求先做 query-unit de-duplication，而不是把每一行機械替換。最高風險是 price-history idempotency、scheduled task lock、cart expiry upsert、monthly HKT report 和 sold-at normalisation。[6]

| Query family | S2 conversion rule | Execution blocker |
|---|---|---|
| Price history | `recordHash` 僅在 non-null/deterministic 時可作 conflict target；composite key 須先測 PostgreSQL NULL behavior。 | Null grade/soldAt/jpyPrice dedup fixture absent. |
| Scheduled task | `(taskType, externalRunId)` 只為 non-null GitHub run ID 發揮 lock；legacy null 必須獨立處理。 | Legacy task retry behavior undefined. |
| Cart TTL | `(userId, listingId)` named conflict target + parameterized interval。 | T3 time semantics/test absent. |
| Month report | 用 explicit HKT/UTC range filter；display label 才可用 `to_char`。 | Boundary/index `EXPLAIN` evidence absent. |
| JSON/aggregation | `jsonb` and `string_agg` only after payload/order/null fixture。 | Query-unit fixture absent. |

## 5. S2 exit checklist

S2 design review is complete. It is **not** authorization to carry out M00–M07. The next execution request must explicitly choose the exact maximum scope; all unapproved rows remain prohibited.

| Future action | Required separate approval | Additional preflight |
|---|---|---|
| Create/check migration files only | `批准 S2-A：產生但不套用 Lab migration files` | Source snapshot hash unchanged; no connection/secret value. |
| Apply M00–M04 to empty Lab | `批准 S2-B：只在 Lab 套用 M00–M04 schema baseline` | Lab project ref/host allowlist, Data API disabled proof, migration secret entered via managed store, PITR eligibility check. |
| Add FKs/checks/grants | `批准 S2-C：只在 Lab 套用 validated constraints/runtime grants` | S3 synthetic fixture results and explicit per-constraint review. |
| Write synthetic data | `批准 S3：只在 Lab 寫入 synthetic fixtures` | Fixture privacy review, no Production export/PII/webhook payload. |
| Any runtime/Production change | Separate later gate only. | All Gate 0 controls, PITR restore drill, load test and reconciliation evidence. |

## 6. Artifacts for review

| File | Purpose |
|---|---|
| `s2-lab-migration-and-access-design.md` | M00–M07 sequence, roles, pooler contract, grant baseline, Data API proof plan. |
| `s2-temporal-jsonb-raw-sql-design.md` | T1–T7 timestamp semantics, JSONB register and raw SQL conversion rules. |
| `s2-research-sources.md` | Current Supabase documentation sources used for security, pooler and JSONB design. |
| `s2-isolation-record.md` | No-Lab-write/no-Production-change audit record. |

## References

[1]: ./s2-isolation-record.md "BOXIUM S2：Migration／Role／Timezone／JSONB／Raw SQL 設計隔離紀錄"
[2]: ./s2-lab-migration-and-access-design.md "BOXIUM S2：Lab Migration、Access Role 與 Data API 保護設計"
[3]: https://supabase.com/docs/guides/api/securing-your-api "Supabase：Securing your API"
[4]: https://supabase.com/docs/guides/troubleshooting/resolving-cannot-execute-update-in-a-read-only-transaction-on-transaction-pooler-connections-ef582c "Supabase：Transaction pooler state"
[5]: https://supabase.com/docs/guides/troubleshooting/error-prepared-statement-xxx-already-exists-3laqeM "Supabase：Prepared statement support"
[6]: ./s2-temporal-jsonb-raw-sql-design.md "BOXIUM S2：Timezone、JSONB 與 Raw SQL Conversion 設計登記冊"
