# BOXIUM S2-A：Disabled Migration Bundle 隔離紀錄

**狀態：完成，等待使用者審核；只完成離線 generation 與本機文件/DDL 檢查。**

| 欄位 | 紀錄 |
|---|---|
| Change ID | `LAB-20260825-004` |
| Approved scope | 產生但不套用 Lab migration files。 |
| Target | GitHub `chore/supabase-lab-schema-parity` branch 的 `docs/db-parity/migrations/lab-disabled/`。 |
| Connection policy | `drizzle.lab-draft.config.ts` 故意不含 `dbCredentials`；允許 `generate`，不允許 connection。 |
| Lab / Production data | `none` — 本關卡不得連線、讀取、寫入或修改。 |
| Disabled convention | Generated SQL 使用 `.sql.disabled`；不在任何 migration discovery path。 |
| Explicitly prohibited | migrate/push/db:push/SQL Editor/psql/MCP SQL、role/grant/secret/fixture、runtime/Cloud Run/GitHub production workflow/Heartbeat 變更。 |
| Cleanup | 移除本 branch 的 disabled bundle；無 DB 狀態須回復。 |

## 完成證據

| 驗證 | 結果 |
|---|---|
| Generation route | Drizzle CLI／ORM published latest 組合仍無法編譯實際 S1 schema draft，回傳 `Please install latest version of drizzle-orm`；依使用者批准改用可重現的手工 parser `scripts/generate-s2a-disabled-sql-bundle.mjs`。 |
| M02 | `manual/M02-enum-and-domain-types.sql.disabled` 含 96 enum proposals。 |
| M03 | `manual/M03-base-tables-and-identity.sql.disabled` 含 S1 mapped 95 table proposals。 |
| M04 | `manual/M04-indexes-and-unique.sql.disabled` 含 206 named index/unique proposals，與 `schema.pg.ts` named index set 相符。 |
| M05/M06 | 未建立 M05 constraints 或 M06 grants file；bundle scan 亦不含 `FOREIGN KEY`、`CREATE ROLE`、`GRANT` 或 `REVOKE`。 |
| Disabled state | `docs/db-parity/migrations/lab-disabled/` 中沒有 `.sql`；全部 DDL 使用 `.sql.disabled`。 |
| Connection / secret scan | 無 PostgreSQL/MySQL DSN、password、browser DB key 或 project credential。 |
| Test | `server/s2aDisabledBundle.test.ts`：2/2 tests passed，驗證 count、M05/M06 omission 和禁止 token。 |
| Manifest integrity | `package.json` SHA-256 `b6b44c473c58a6f21f4c351eaefe9f1c75081e78f5b1c3c361711ed84f163959`；`pnpm-lock.yaml` SHA-256 `550abec90cebb89f4a3ce0458998fb10e0d3061e8c61ad9c804c7a26da46cab5`。最新版 CLI 使用 `/tmp` 無憑證 config 對實際 `schema.pg.ts` retry 前後雜湊一致；沒有寫入 manifest/lockfile。 |
| node_modules cleanup | `node_modules/drizzle-orm` 已維持 / 還原至 locked `0.45.2` symlink；沒有 temporary replacement 留在 staging project。 |
| Database / Production | 未連線、讀取或寫入 Supabase Lab 或 Production；未執行 DDL、DML、fixture、role/grant、secret、runtime、Cloud Run、GitHub production workflow/environment 或 Heartbeat 變更。 |
| GitHub branch proof | Disabled bundle commit 為 `da3c0ed22e80cdd668856cef8838f8f1ab8f8990`，僅位於 `chore/supabase-lab-schema-parity`；GitHub `main` 保持 `89e75cdd1fa810aa2799d8706f47d359a00e602f`。 |

## Remaining prohibition

本 bundle 不能套用。使用者仍須另行批准 S2-B，且通過 Lab target preflight、Data API disabled、migration secret managed-store fill、PITR eligibility 與 source snapshot recheck，才可討論對空白 Lab 執行任何 schema baseline。
