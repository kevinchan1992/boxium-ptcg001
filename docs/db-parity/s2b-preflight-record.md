# BOXIUM S2-B：M00 Lab Target Preflight 稽核紀錄

**狀態：完成；M00 preflight 已通過，M02–M04 baseline 已僅套用至 allowlisted Lab。**

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
| S1 source snapshot | Approved M02–M04 manifest and refreshed staging source are both `c78e658defe2232014f4f33d0a0f48cde10e716d1ded66c9c8cf4ef4bb937750`; refreshed `schema.pg.ts` is `20fb61c16bcb8babe3a780806979412e91471fa4b4869f656e602847bd4346ab`. | Pass |
| Empty baseline | Lab `public` tables = `[]`; migration history = `[]`. | Pass, but insufficient to override snapshot failure |
| PITR eligibility | Organization plan is `free`; no PITR entitlement/restore drill evidence is available through the management API. No import, fixture or production data is in S2-B. | Baseline does not import data, but PITR remains a mandatory blocker for later import/restore gates |
| M05/M06 | Constraints and grants remain absent. | Mandatory |

## Preflight outcome

M00 initially failed because the staging working tree carried an older 91-table source snapshot while the approved S1 mapping already represented the current 95-table managed snapshot. Under the approved S1-refresh, the current snapshot was copied only into the staging-only branch, S1 inventory/mapping and the manual M02–M04 disabled bundle were regenerated, and the bundle test passed 2/2. The refreshed source and bundle manifest now match exactly.

M00 now **passes** for the already-approved Lab-only M02–M04 apply. The Lab target, region, health, empty schema/migration history, Data API-disabled dashboard state and secret-name separation satisfy isolation evidence. The organization is Free and does not supply PITR entitlement/restore evidence; because S2-B is an empty-schema baseline with no production data, import or fixture, that is recorded as a blocker for later data import/restore gates, not a reason to broaden this baseline. M05 constraints, M06 grants, runtime secret values and all Production actions remain prohibited.

The security decision at `s2b-security-decision.md` records user approval to keep Data API disabled and defer RLS/policy work until a dedicated security gate. The observed RLS-disabled advisory is therefore tracked, not remediated automatically.

## Applied baseline and M04 correction evidence

| Stage | Outcome | Safety evidence |
|---|---|---|
| M02 | Applied successfully to allowlisted Lab only. | Migration history records `m02_enum_and_domain_types`; no data or role/grant SQL. |
| M03 | Applied successfully to allowlisted Lab only. | Migration history records `m03_base_tables_and_identity`; no M05/M06 SQL. |
| Initial M04 | Failed with PostgreSQL `42P07` on duplicate `cardId_idx`. | The failed migration was not recorded in migration history; only M02/M03 remain. |
| M04 correction | The disabled generator now detects schema-wide duplicate source index names and renames the four collisions deterministically with `__<tableName>`. | `index-name-resolution.json` records `cardId_idx` and `expiresAt_idx` resolutions for both listing-cache tables; 2/2 bundle tests pass and all 206 emitted names are unique. |
| M04 retry boundary | Rebuild input solely from corrected `.sql.disabled` artifact, verify no M04 history entry, then invoke the exact allowlisted Lab ref once. | No Production ref, role/grant, FK, fixture or Data API change is permitted. |

## Completion

The resolved M04 baseline applied successfully as `m04_indexes_and_unique_resolved`. Final Lab history therefore contains exactly M02 enum/types, M03 base tables and M04 resolved indexes. M05 constraints and M06 grants remain absent; no data was imported or inserted.
