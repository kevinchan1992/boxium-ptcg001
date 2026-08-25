# BOXIUM M05：外鍵與合成資料完整性驗證計畫

**範圍：僅限已 allowlist 的 Supabase Lab；無 Production data、無 runtime connection、無 M06 grants。**

> 現行 source schema 沒有 Drizzle `.references()` 宣告，而 S1 盤點了 136 個 logical candidates。因此 M05 不會把候選關係批次實體化；只驗證欄位命名、nullable contract 與 ownership 都足夠明確的九條關係。多型 `productType`、`relatedId`、`targetId` 與其他 unresolved relation 維持無 FK。[1]

## M05 physical constraint scope

| Constraint | Child → parent | Delete rule | Synthetic test |
|---|---|---|---|
| `m05_cards_game` | `cards.gameId` → `games.id` | `RESTRICT` | Orphan card rejected；game deletion rejected while card exists。 |
| `m05_sealed_products_game` | `sealedProducts.gameId` → `games.id` | `RESTRICT` | Orphan sealed product rejected。 |
| `m05_posts_category` | `posts.categoryId` → `categories.id` | `SET NULL` | Deleting a fixture category sets the child relation to null。 |
| `m05_posts_author` | `posts.authorId` → `users.id` | `RESTRICT` | Orphan post rejected；user deletion rejected while post exists。 |
| `m05_post_tags_post` | `post_tags.postId` → `posts.id` | `CASCADE` | Deleting a fixture post removes join rows。 |
| `m05_post_tags_tag` | `post_tags.tagId` → `tags.id` | `CASCADE` | Orphan join row rejected。 |
| `m05_post_versions_post` | `post_versions.postId` → `posts.id` | `CASCADE` | Orphan post version rejected。 |
| `m05_post_versions_creator` | `post_versions.createdBy` → `users.id` | `RESTRICT` | Orphan creator rejected。 |
| `m05_user_collections_user` / `m05_user_collections_card` | `userCollections.userId` → `users.id`; `userCollections.cardId` → `cards.id` | `RESTRICT` | Orphan collection row rejected。 |

## Deliberate exclusions

`priceHistory`、`watchlist`、`viewHistory`、`dataSources`與`searchTokens`的 `cardId` 都會隨 `productType` 指向 card 或 sealed product，不可建立單一 FK。Marketplace auction winner/bid/order fields、jobs/logs target IDs、inventory links、WhatsApp trade IDs與pool/grading relations也仍需要 synthetic ownership scenarios，不在本 M05 實體化。

M05 不新增新的 domain `CHECK` 或未在 source 出現的 unique constraint。Baseline 已有 `NOT NULL`、enum與 unique constraints；fixture 測試會驗證一個 `NOT NULL` case與兩個既有 unique/FK negative cases，而非猜測 Production 商業規則。

## Fixture and cleanup protocol

All synthetic rows use the reserved integer range `910001`–`910099` and `m05-fixture@lab.invalid` only. The test transaction creates a game, user, card, sealed product, category, tag, posts, post version, join rows and user collection; it then tests valid paths, reject paths and configured delete rules. It deletes children before parents and commits only after all assertions pass. A post-transaction count probe must return zero rows for every fixture table.

No user email, card name, image, transaction, payment, session, webhook payload or other Production datum may enter Lab. The fixture record is synthetic and ephemeral.

## Preconditions and rollback

The Lab ref must equal `ekqd…lqew`; Data API must still be disabled; M02/M03/M04 migration history must exist; all 95 baseline tables must still contain zero rows before the test; M06 must remain absent. If any preflight fails, no M05 DDL or fixture DML runs. The rollback for a failed M05 apply is a separately approved Lab-only `DROP CONSTRAINT` plan; fixture failure itself rolls back the test transaction.

## References

[1]: ./schema-matrix.md "S1 logical foreign-key candidate inventory"
