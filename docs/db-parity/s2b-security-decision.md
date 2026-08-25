# BOXIUM S2-B：Lab Data API 與 RLS 安全決策

**狀態：已由使用者批准，適用至 M06 前。**

> 決策：維持 Supabase Lab **Data API disabled**，並在 M06 runtime-grant gate 前不啟用 RLS 或建立 RLS policy。BOXIUM 仍維持 Express/tRPC server-side only 的資料庫存取邊界；不引入 frontend Supabase client、REST、GraphQL、Realtime、`VITE_*` database key、Supabase Auth 或 Storage。

## 決策理由與效果

| 項目 | 已批准狀態 | 限制 |
|---|---|---|
| Data API | Disabled | `/rest/v1/` 對 schema query 維持錯誤行為；不得重新啟用。 |
| RLS | Deferred | 95 張 baseline table 維持 RLS disabled；不得在沒有完整 policy 設計與 access test 的情況下自動啟用。 |
| M06 grants | Absent | 沒有建立 runtime role、Data API business-table grants、`anon`／`authenticated` grants或 browser client path。 |
| Runtime connection | Absent | 沒有填入 runtime/migration DSN，也沒有把 Lab 接入 Express、Cloud Run、GitHub workflow 或 Heartbeat。 |
| Production | Isolated | 既有 MySQL／TiDB、`DATABASE_URL`、Cloud Run、S3、Manus OAuth、GitHub main/production environment與資料維持不變。 |

## Advisor interpretation

Schema inventory 會提示「RLS disabled」，因基線表確實尚未啟用 RLS。這是需要追蹤的防禦層，但在 Data API disabled、沒有 browser key、沒有 M06 role/grant 與沒有 application runtime connection 的目前範圍中，不會自動轉換為可從 BOXIUM 前端直連的資料面。直接執行 RLS remediation 而未先設計 policy，會令未來 access path 全部被拒絕，因此不在 S2-B 自動處理。[1]

## 後續獨立安全 gate

未來 RLS/policy gate 必須先完成 role matrix、server-only access proof、Data API disabled recheck、每張表 policy rationale、negative `anon`/`authenticated` probes、runtime role smoke tests、migration rollback plan與 synthetic-only fixture validation。該 gate 另行批准前，任何 RLS、policy、role、grant或 Data API setting change 均禁止。

## Reference

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase — Row Level Security"
