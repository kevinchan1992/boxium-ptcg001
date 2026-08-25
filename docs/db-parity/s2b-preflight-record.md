# BOXIUM S2-B：M00 Lab Target Preflight 稽核紀錄

**狀態：M00 fail closed；尚未套用任何 migration。**

> 本紀錄只記錄 S2-B M00 的非機密 preflight evidence。任何條件失敗即不得呼叫 DDL migration。Production MySQL／TiDB、application runtime、Cloud Run、GitHub production workflow/environment、Heartbeat、S3/Auth與 Production data 全部不在 scope。

## Target allowlist

| 檢查 | Required | Observed | 結果 |
|---|---|---|---|
| Project ref | `ekqdgoewlvrrwpgulqew` only | `ekqdgoewlvrrwpgulqew` | Pass |
| Region | Singapore `ap-southeast-1` | `ap-southeast-1` | Pass |
| Status | Healthy | `ACTIVE_HEALTHY` | Pass |
| Organization | Boxium approved organization only | `ngcdwdnzjvjznriekamy` | Pass |
| Display name | Gate B intended `BOXIUM Supabase Lab` | Current Supabase display name is `BOXIUM TCG` | **Recorded naming drift; ref/region/org are the binding allowlist. No rename is attempted.** |
| Database engine | PostgreSQL Lab only | PostgreSQL 17 | Pass |
| Production target | Must never be selected | No Production MySQL/TiDB or other Supabase ref queried | Pass |

## Data API and secret boundary

| Check | Result |
|---|---|
| Data API dashboard state | **Disabled**. Dashboard states “No schemas can be queried” and `/rest/v1/` will return errors. |
| Browser/client scope | No frontend Supabase SDK, REST/GraphQL/Realtime code or `VITE_*` database key is introduced. |
| GitHub Lab slots | The five approved `SUPABASE_LAB_*` names exist in the isolated `supabase-lab` environment; values are not read, logged or changed. |
| Migration authority | S2-B DDL, if allowed by all preflight checks, is sent only through the authenticated Supabase management connector for the exact allowlisted ref. No DSN is exposed, copied to GitHub, or placed in application runtime. |
| Runtime/migration roles | M06 is absent. `boxium_lab_runtime` and `boxium_lab_migrator` are not created and no application secret is filled in this baseline stage. |

## Source and recovery preflight

| Check | Result | Gate effect |
|---|---|---|
| S1 source snapshot | Approved M02–M04 manifest requires `c78e658defe2232014f4f33d0a0f48cde10e716d1ded66c9c8cf4ef4bb937750`; current staging source is `e34a10ee3f03e4dc1ab7bbca05875fc6c1aa514abb86cb09192e4f977f74c0b4`. The hashes do **not** match. | **Fail closed: no DDL allowed.** |
| Empty baseline | Lab `public` tables = `[]`; migration history = `[]`. | Pass, but insufficient to override snapshot failure |
| PITR eligibility | Organization plan is `free`; no PITR entitlement/restore drill evidence is available through the management API. No import, fixture or production data is in S2-B. | Baseline does not import data, but PITR remains a mandatory blocker for later import/restore gates |
| M05/M06 | Constraints and grants remain absent. | Mandatory |

## Preflight outcome

M00 **must not proceed**. The Lab target, region, health, empty schema/migration history, Data API-disabled dashboard state and secret-name separation satisfy isolation evidence. However, the approved disabled bundle was built against the managed source snapshot `c78e…7750`, while the current staging branch source hash is `e34a…c0b4`. The difference is not inferred or overwritten. No `apply_migration`, SQL execution, schema object, role, grant, secret value, fixture or data action was attempted.

The only safe next action is a new user-approved **S1 refresh**: compare the two source snapshots, regenerate/review the PostgreSQL mapping and disabled M02–M04 bundle, then submit a new S2-B apply approval. Production remains untouched.
