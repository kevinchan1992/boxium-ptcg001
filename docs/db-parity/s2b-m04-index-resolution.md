# BOXIUM S2-B：M04 PostgreSQL Index Name Collision Resolution

**狀態：已離線驗證，準備僅在 allowlisted Lab 重試 M04。**

> PostgreSQL index names are schema-wide identifiers. MySQL source declarations reused `cardId_idx` and `expiresAt_idx` on different cache tables, which is legal in MySQL but invalid in a shared PostgreSQL `public` schema. The first M04 apply therefore failed as expected with `42P07`; it did not record a migration or leave an M04 migration history entry.

## Deterministic resolution

| Source index name | Table | PostgreSQL M04 name |
|---|---|---|
| `cardId_idx` | `snkrdunkListingsCache` | `cardId_idx__snkrdunkListingsCache` |
| `expiresAt_idx` | `snkrdunkListingsCache` | `expiresAt_idx__snkrdunkListingsCache` |
| `cardId_idx` | `ebayListingsCache` | `cardId_idx__ebayListingsCache` |
| `expiresAt_idx` | `ebayListingsCache` | `expiresAt_idx__ebayListingsCache` |

The generator preserves all non-colliding names. For a collision it appends `__<tableName>`; if that would exceed PostgreSQL's 63-byte identifier limit, it truncates deterministically and adds an eight-character SHA-256 suffix. The bundled `index-name-resolution.json` is the auditable source-to-target mapping.

## Revalidation

The rebuilt M04 contains 206 index/unique proposals with 206 globally distinct PostgreSQL identifiers. The bundle test passes 2/2 and continues to reject DSN, role/grant and foreign-key SQL. M05 and M06 remain absent. The retry is limited to the same empty-data Lab and does not broaden the approved S2-B scope.
