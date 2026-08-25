# BOXIUM S2：Timezone、JSONB 與 Raw SQL Conversion 設計登記冊

**狀態：設計審核；未產生 migration、未連線或寫入任何資料庫。**

> S1 掃描到 230 個 `timestamp(...)` source field、95 張表、390 個 `sql` tag 與 120 個 `.execute()` call。本文件將它們分派到可被後續驗證的 decision groups，而非猜測 MySQL／TiDB 中既有資料的時區、JSON validity 或 conflict semantics。[1]

## 1. Timezone policy

所有真正的商業 moment 以 UTC instant 存取，目標設計為 PostgreSQL `timestamptz`。`timestamptz` 表示一個全球時間點；資料庫 session 或 UI 的顯示 timezone 不得改變它的實際 instant。BOXIUM 的 HKT 只用於顯示與清楚定義的 business-day bucket，不能把 HKT local datetime 在未判定欄位語義前直接當 UTC 匯入。

| Group | Source field families | S2 target design | Required source-semantic proof before any migration |
|---|---|---|---|
| T1 system/audit moments | 全部 `createdAt`、`updatedAt`、`processedAt`、`readAt*`、`viewedAt`、`fetchedAt`、`cachedAt`、`calculatedAt`、`receivedAt`。 | `timestamptz`; database/application default emits UTC instant. | Synthetic insert/readback proves the instant is stable across `UTC` and `Asia/Hong_Kong` display sessions. |
| T2 market observations | `priceHistory.soldAt`、`dataSources.lastFetchedAt`／`lastUpdatedAt`、cache expiry、scraper timestamps。 | `timestamptz`. | Each upstream source parser must record whether source provides epoch, offset timestamp, date-only or HKT text; date-only input is never silently promoted to midnight UTC. |
| T3 auction/transaction/deadline moments | `auctionStartAt`、`auctionEndAt`、`auctionPaymentPaidAt`、`paymentDeadline`、`shippingDeadline`、`offer.expiresAt`、cart expiry、order payment/shipping/dispute/payout times。 | `timestamptz`. | UTC/HKT boundary fixtures prove anti-sniping, payment expiry and TTL have identical elapsed duration. |
| T4 scheduled work moments | `scheduledTasks.*At`、`scheduleExecutionHistory.*At`、`scheduleConfig.*At`、price update execution/catchup times。 | `timestamptz`. | Heartbeat/GitHub schedule contract specifies trigger instant and HKT display; no session-level timezone setting in transaction pooler. |
| T5 account/security moments | verification expiry, VIP expiry, user sign-in, blocked IP expiry, webhook processing and security event timestamps. | `timestamptz`. | Expiry comparisons use UTC instant, and session display never changes authorization outcome. |
| T6 likely business calendar dates — **unresolved** | `cards.releaseDate`, `sealedProducts.releaseDate`, `cardInventory.buyDate`／`sellDate`, `companyCardInventory.buyDate`／`sellDate`, `whatsappTradeIntakes.tradeDate`, `marketTrends.date`, `gradingBatches.cutoffDate`／`expectedReturnDate`. | Candidate PostgreSQL `date`, not automatically `timestamptz`. | Code-use review plus synthetic fixture must show date-only semantics. If any field represents a precise deadline/moment, retain `timestamptz` and add an explicit display timezone rule. |
| T7 mixed operational/business fields — **unresolved** | `gradingBatches.shippedDate`, `posts.publishedAt`, `pools.publishedAt`, `userCollections.purchasedAt`／`tradedAt`. | Individual decision required. | Each must identify whether source carries instant, local day, or external date-only data. |

### Sentinel fixture plan — future S3 only

| Fixture | Expected proof |
|---|---|
| `2025-12-31T16:00:00Z` / `2026-01-01 00:00:00 HKT` | HKT business-day boundary does not become an incorrect UTC date. |
| `2026-01-31T15:59:59Z` / `2026-01-31 23:59:59 HKT` | Month report bucket and next-month range are correct. |
| Exact `soldAt` at 7-day lookback boundary | PSA 10 trending eligibility has no off-by-one hour/day defect. |
| Leap-day and year-end date-only values | `date` candidate fields survive round trip without timezone shift. |
| Auction end + anti-sniping extension | Elapsed duration is invariant in UTC and HKT display. |
| Expiry around cold-start/retry | TTL comparison uses instant, not client/local wall clock. |

**No-Go rule:** Any T6/T7 field without a written semantic decision blocks M03 migration generation for that column. No production timestamp is read in order to resolve it during S2.

## 2. JSONB decision register

Supabase recommends `jsonb` for most genuinely unstructured data but warns against replacing known relational fields with JSON. S2 therefore converts no column automatically; each decision ties a potential type change to data-shape, query and privacy proof.[2]

| Source column | Current intended shape | S2 decision | Reason and required future test |
|---|---|---|---|
| `cards.types` | JSON array of card types. | **Candidate JSONB**. | Non-sensitive, typed array; test valid array/null, array element query, and no app string-serialization regression. |
| `scheduledTasks.metadata` | Job errors/progress metadata. | **Candidate JSONB**. | Queryable operational payload, but must verify historic invalid JSON and error-log redaction. |
| `snkrdunkListingsCache.listings`, `ebayListingsCache.listings` | Cached market listing arrays. | **Candidate JSONB, deferred index**. | Cache payload is structurally JSON, but no GIN index until actual predicate/`EXPLAIN` evidence. |
| `posts.relatedCardIds`, `posts.dataSnapshot` | Related card IDs / content snapshot. | **Keep text initially**. | No proven server-side JSON predicate; exact snapshot serialization compatibility is more important. |
| `trendingRankingsCache.rankingData` | Cached ranking array. | **Keep text initially**. | Cache is read as whole object; no demonstrated relational/JSON query need. |
| `marketplaceListings.images`, `marketplaceBanners.ctaConditions`, `productCategories.tags` | JSON arrays with predictable shape. | **Candidate JSONB**. | Require code-path review, valid JSON fixture and rendering round-trip. Do not migrate solely because default is `[]`. |
| `marketplaceOrders.aiVerificationResult`, `disputeEvidenceUrls`, `disputeResolutionHistory`, `gradingSubmissions.adminNotesHistory` | Review/evidence data, potentially sensitive. | **Keep text until privacy/query review**. | Preserve original serialization; no JSON query/index is approved. |
| `marketplaceOrders.shippingAddress`, `gradingSubmissions.returnAddress` | PII address payload. | **Keep text; no JSONB conversion in this project phase**. | Scope excludes new PII access/indexing model; S3 must never use Production data. |
| `whatsappWebhookEvents.payloadJson`, `whatsappTradeIntakes.matchEvidenceJson`, `whatsappWebhookEvents` raw payloads | Webhook/AI evidence payload. | **Keep text**. | Exact payload/replay/audit semantics and PII sensitivity dominate; no inferred JSONB conversion. |
| `adminAuditLogs.details`, `listingModerationLogs.metadata`, `security event/details` | Audit context. | **Keep text**. | Require retention/redaction policy before any structural conversion. |

### JSONB hard rules

1. A JSONB candidate must pass `valid JSON`, `null`, `empty array/object`, numeric-vs-string and nested-array fixture cases before migration.
2. A JSONB column does not receive a GIN or expression index until a concrete query predicate, selectivity expectation and Lab `EXPLAIN` result exist.[3]
3. JSONB must not duplicate a known relational value such as `cardId`, monetary amount, status, user ID or timestamp merely for convenience.
4. A JSONB migration cannot be backfilled from Production in this phase; S3 uses synthetic payloads only.
5. Any payload containing address, phone, identity, payment evidence or raw webhook content remains text until a separate privacy/security review explicitly approves a change.

## 3. Raw SQL conversion design

The 510 S1 entries are trace records, not 510 unique queries: some entries pair a `sql` tag with its enclosing `.execute()`. S2 requires de-duplication into a **query unit** keyed by `file + statement boundary + purpose`; each unit then receives a target syntax, conflict target, index dependency, fixture and assertion before code porting.

| MySQL/TiDB pattern | PostgreSQL design | Required assertion |
|---|---|---|
| Backtick identifier | Prefer Drizzle generated identifier; otherwise quote deliberate camelCase identifier using PostgreSQL rules. | Query operates against the intended table/column, not a lower-cased accidental identifier. |
| `ON DUPLICATE KEY UPDATE` | Drizzle `onConflictDoUpdate` or SQL `ON CONFLICT (<named key>) DO UPDATE`. | One insert, duplicate retry, and concurrent retry use the same row idempotently. |
| `INSERT IGNORE` | `ON CONFLICT DO NOTHING` only for a named expected uniqueness conflict. | Invalid type/FK/check errors still fail rather than being swallowed. |
| `IFNULL(a,b)` | `COALESCE(a,b)`. | `null`, zero, empty string and decimal string contract are distinct. |
| `DATE_FORMAT(ts, '%Y-%m')` | For reports, use a precise UTC/HKT month range; use `to_char` only for displayed grouping label after timezone decision. | Month-boundary fixture is index-friendly and returns no row from adjacent HKT month. |
| `DATE_ADD(NOW(), INTERVAL n DAY)` | Parameterized PostgreSQL interval / current timestamp arithmetic; no `sql.raw` duration concatenation. | Cart/offer TTL represents exact elapsed duration and rejects unsafe parameter values. |
| `GROUP_CONCAT` | `string_agg(expression, delimiter ORDER BY explicit_order)`. | Ordering, null treatment and delimiter match the business contract. |
| MySQL date normalization script | Explicit `timestamptz` parsing after T1–T7 decision. | No unexplainable 8-hour shift; invalid values fail the import test. |
| Raw pagination | Stable `ORDER BY` plus primary key tie-breaker. | Repeated page scan has no duplication or omission. |

### High-risk query-unit decisions

| Source query family | Observed source location | PostgreSQL target decision | Blocking condition |
|---|---|---|---|
| Price-history ingestion/upsert | `scripts/githubActionsBatchUpdate.mjs`, `scripts/tcgdexPriceSync.mjs`, card router. | Prefer `recordHash` as idempotency key **only when non-null and deterministic**. The composite key is fallback only after validating PostgreSQL NULL semantics for `grade`, `soldAt` and `jpyPrice`. | No `ON CONFLICT` target until a fixture covers null/non-null dedup fields and duplicate replay. |
| Scheduled task idempotency | `scheduledTasks.taskType + externalRunId`. | Use the named composite unique constraint for non-null external run IDs; legacy null `externalRunId` must not be falsely treated as a conflict. | No automatic rewrite until null legacy-task behavior has a fixture. |
| User cart refresh | `cartItems` uses unique `(userId, listingId)`. | `ON CONFLICT (userId, listingId) DO UPDATE` only after T3 confirms `addedAt`/`expiresAt` instant semantics. | No raw interval/string interpolation. |
| Marketplace monthly report | `server/db.ts` uses `DATE_FORMAT(createdAt, '%Y-%m')`, aggregate and group/order expressions. | Filter with `[monthStart, nextMonthStart)` in the explicitly selected business timezone; create label separately. | No direct `to_char` predicate before index and HKT-month fixture review. |
| Sold-at normalisation | `server/normalize-soldat.mjs`. | Replace MySQL parsing only after price-history source-timezone register is approved. | Any unknown external date format blocks conversion. |
| Price-history duplicate cleanup | `server/scripts/dedup-price-history.mjs` aggregation. | Use `string_agg` with explicit order only if textual aggregation remains needed; otherwise relational grouping. | Must match duplicate selection/deletion result with synthetic data. |
| Cart expiry write | `server/routers/marketplace.ts` combines upsert, `NOW()` and `DATE_ADD`. | Use a transaction-safe PostgreSQL upsert and parameterized duration. | Must not reintroduce a prepared statement/session-state requirement on runtime pooler. |

## 4. Raw SQL conversion workflow

| Step | Design artifact | Pass condition |
|---|---|---|
| Q1 | Deduplicated query-unit manifest derived from `raw-sql-parity.csv`. | Every unit links to all source trace IDs; no hidden raw SQL remains. |
| Q2 | Per-unit target syntax and owner. | Named conflict target, type cast, timezone basis, ordering and index dependency are recorded. |
| Q3 | Synthetic fixture matrix. | Includes nulls, decimal strings, HKT boundaries, retry/concurrency and JSON payload variants where relevant. |
| Q4 | Lab-only integration assertions. | Executed only after S2 apply and S3 approval; no Production query/data comparison in this stage. |
| Q5 | Conversion decision / rollback record. | Each port is independently revertible to MySQL-only runtime; no runtime switch occurs here. |

## References

[1]: ./s1-schema-inventory-mapping-report.md "BOXIUM S1：Schema Inventory 與 PostgreSQL Mapping 設計報告"
[2]: ./s2-research-sources.md "Supabase JSONB design findings"
[3]: https://supabase.com/docs/guides/database/query-optimization "Supabase：Query Optimization"
[4]: ./raw-sql-parity.csv "BOXIUM S1：Raw SQL Parity Manifest"
