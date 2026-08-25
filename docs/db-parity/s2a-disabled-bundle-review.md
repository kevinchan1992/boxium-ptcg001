# BOXIUM S2-A：Manual Disabled Migration Bundle 審核報告

**狀態：完成，僅供審核；所有 DDL 均不可套用。**

> 此 bundle 是 S1 `schema.pg.ts` mapping 的離線審核輸出，而非 schema deployment。它只存在於 `chore/supabase-lab-schema-parity`，不含 DSN/secret，也沒有對 Supabase Lab 或任何 Production 系統建立連線。

## Bundle 結論

| Stage | Artifact | Coverage | Status |
|---|---|---:|---|
| M02 | `M02-enum-and-domain-types.sql.disabled` | 96 enum proposals | Disabled, review only |
| M03 | `M03-base-tables-and-identity.sql.disabled` | 95 table proposals | Disabled, review only |
| M04 | `M04-indexes-and-unique.sql.disabled` | 206 named index/unique proposals | Disabled, review only |
| M05 | No file | No FK/check/composite-key proposal | **Intentionally absent** |
| M06 | No file | No role/grant proposal | **Intentionally absent** |
| M07 | Manifest only | No Lab catalogue query | **Intentionally absent** |

The manual generator is deterministic against the S1 mapping and fails if it cannot parse exactly 95 `pgTable` declarations. The unit test verifies the emitted enum/table/index count, rejects DSN and role/grant/FK tokens, and confirms the M05/M06 omission. This does not prove PostgreSQL execution correctness; it proves only that the requested review artifact is complete, traceable and isolated.[1]

## Security controls retained

| Control | Evidence |
|---|---|
| No executable discovery path | Artifacts live under `docs/db-parity/migrations/lab-disabled/manual/`, not `drizzle/` or `supabase/migrations/`; all DDL suffixes are `.sql.disabled`. |
| No database connection | Generator only reads local `drizzle/schema.pg.ts`; `DATABASE_URL` was unset for generation/test. |
| No direct access scope creep | Bundle has no Data API enablement, frontend SDK, `VITE_*` database values, Supabase Auth/Storage/Realtime or RLS content. |
| M05 relation safety | No inferred physical FK; source has no declared Drizzle `.references()` and logical candidates await synthetic fixtures. |
| M06 least privilege safety | No role/grant SQL; runtime/migration role design remains design-only pending future explicit gate. |
| Dependency integrity | Registry 與 staging lock 均為 `drizzle-orm 0.45.2`、`drizzle-kit 0.31.10` 的 published latest。最新版 CLI 以無憑證 temporary config 對實際 S1 `schema.pg.ts` retry 仍回傳 version error，且 retry 前後 `package.json`/`pnpm-lock.yaml` SHA-256 完全一致；locked `drizzle-orm` remains 0.45.2. |

## Deliberately unresolved items

S2-A does not approve execution. The following items block any later apply request: T6/T7 date semantics, JSONB candidates, price-history and scheduled-task conflict targets, M05 relation fixture evidence, M06 access test evidence, Lab target preflight, Data API disabled proof, PITR eligibility and source snapshot recheck.[2] [3]

## References

[1]: ./migrations/lab-disabled/README.md "S2-A Disabled Migration Bundle rules"
[2]: ./s2-lab-migration-and-access-design.md "BOXIUM S2：Lab Migration、Access Role 與 Data API 保護設計"
[3]: ./s2-temporal-jsonb-raw-sql-design.md "BOXIUM S2：Timezone、JSONB 與 Raw SQL Conversion 設計登記冊"
[4]: ./s2a-isolation-record.md "BOXIUM S2-A：Disabled Migration Bundle 隔離紀錄"
