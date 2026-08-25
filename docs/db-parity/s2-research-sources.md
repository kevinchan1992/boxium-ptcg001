# BOXIUM S2：官方研究來源與設計依據

**狀態：設計研究；未執行 SQL、migration、Lab connection 或任何資料寫入。**

| 主題 | 官方來源 | 已保存的設計發現 | S2 採用方式 |
|---|---|---|---|
| Data API 與 PostgreSQL grants | [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api) | Supabase 說明 Data API 的可達性先由 PostgreSQL grants 決定，RLS 再控制可見資料列；而既有 project 的新 public table/function 可能帶有 `anon`、`authenticated`、`service_role` 的 default privileges。 | BOXIUM 不使用 frontend Data API；S2 只設計「Data API 維持停用」加上 defensive default-privilege revoke。 |
| 完全停用 Data API | [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api) | 官方指明當應用不使用 client library、REST 或 GraphQL 時，可在 Dashboard 停用 Data API；停用後自動產生的 REST endpoint 不會回應，不依賴 grants/RLS。 | 關卡 B 已在 `BOXIUM Supabase Lab` 完成此設定；S2 不會重新啟用，也不引入 REST／GraphQL／browser client。 |
| Default privilege 防護 | [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api#default-privileges-for-new-tables-and-functions) | 官方提供撤銷 `anon`／`authenticated`／`service_role` 對未來 public table、function、sequence 預設權限的 SQL 範例。 | S2 只提供後續 Lab-only migration 的**設計片段**，不可執行；runtime role 改為自訂最小權限 login role，不使用 `service_role`。 |
| Transaction pooler session state | [Supabase — Transaction pooler read-only troubleshooting](https://supabase.com/docs/guides/troubleshooting/resolving-cannot-execute-update-in-a-read-only-transaction-on-transaction-pooler-connections-ef582c) | 官方說明 transaction pooler（常見 port 6543）會重用 backend connection，session-level settings 可能殘留；需要特定 session state 的 maintenance 工作應用 direct connection。 | Runtime 使用 transaction pooler 並禁止 session-level `SET`；migration/maintenance design 與 runtime connection 分離，且 migration 不得共用 runtime pooler credential。 |
| Prepared statement compatibility | [Supabase — Prepared statement troubleshooting](https://supabase.com/docs/guides/troubleshooting/error-prepared-statement-xxx-already-exists-3laqeM) | 官方指出 PgBouncer／transaction pooling 不支援 prepared statement。 | BOXIUM future serverless runtime contract 固定 `prepare: false`；在 S2 僅設計 configuration test，尚不建立連線。 |
| JSONB 選擇 | [Supabase — Managing JSON and unstructured data](https://supabase.com/docs/guides/database/json) | 官方建議多數不定結構 payload 使用 `jsonb`，但提醒不應過度使用；已知、穩定且需要 relational query 的欄位應保持結構化。 | 只有經 query usage 和 valid-JSON fixture 證明需要的 text payload 才可轉 JSONB；其餘保持 `text`，不作推測式轉換。 |
| Index 選擇 | [Supabase — Query Optimization](https://supabase.com/docs/guides/database/query-optimization) | 官方建議 index 必須對應實際 filter/join/order query pattern，並以 query plan 驗證；過度索引會損害 write。 | S2 不自動把所有 MySQL index 同名照抄；先將 critical query index 設計標為必需，其他留待 Lab `EXPLAIN`／synthetic load test。 |

> 以上資料是設計依據，不構成執行授權。所有 SQL 都必須在使用者另外批准後，且只可對已驗證的 Lab project 套用。
