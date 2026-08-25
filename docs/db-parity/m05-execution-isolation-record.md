# BOXIUM M05：Lab 合成資料完整性執行紀錄

**狀態：完成；Lab-only。Production changes：none。**

| Control | Evidence |
|---|---|
| Target | `ekqd…lqew` Singapore Supabase Lab only。 |
| Migration | `m05_validated_high_confidence_constraints` 成功套用十條 high-confidence FK。 |
| Physical FK | `cards→games`、`sealedProducts→games`、`posts→categories/users`、`post_tags→posts/tags`、`post_versions→posts/users`、`userCollections→users/cards`。 |
| Fixture | 單一原子 `DO $m05$` block 只使用 `910001–910099` 和 `m05-fixture@lab.invalid`。 |
| Positive cases | Valid card/content/collection relation insert completed。 |
| Negative cases | Orphan card/post/join/version/collection、`post_tags.tagId` NOT NULL、`users.email` unique violations were all caught as expected。 |
| Delete behavior | RESTRICT（game/user）、SET NULL（post category）與 CASCADE（post tags/version）were all verified。 |
| Cleanup | `m05_fixture_rows_remaining = 0`; subsequent inventory confirms all 95 tables show 0 rows。 |
| Exclusions | M06 role/grant、RLS/policy、Data API enablement、Production source data、runtime connection、shadow/dual write not touched。 |
| RLS | Remains deferred by approved decision while Data API stays disabled. |

The ten constraints are a validated subset, not a blanket conversion of S1's 136 logical candidates. Polymorphic, audit/log, inventory, auction, pool, grading and WhatsApp relations stay without physical FKs pending dedicated synthetic ownership tests.
