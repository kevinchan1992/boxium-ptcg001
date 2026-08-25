# BOXIUM S1：MySQL／TiDB → PostgreSQL Schema Matrix

**狀態：S1 read-only inventory；設計草案，未套用至任何資料庫。**

> 本文件只由 `drizzle/schema_new.ts` 與 repository source code 衍生。沒有連線、讀取、匯出或修改 BOXIUM Production MySQL／TiDB；也沒有對 Supabase Lab 執行 DDL、DML、migration 或 fixture 寫入。

## Inventory 摘要

| 項目 | 結果 |
|---|---:|
| MySQL source table definitions | 95 |
| Proposed PostgreSQL table definitions | 95 |
| Tables with declared source primary key | 94 |
| Drizzle-declared source foreign keys | 0 |
| Logical FK candidates requiring explicit S2 decision | 136 |
| Declared secondary indexes | 189 |
| Declared unique fields／indexes | 37 |

現行 source schema **沒有**使用 Drizzle `.references()` 宣告外鍵。因此下表的「FK／logical relation」是依欄位命名和程式碼註解建立的設計候選，不是可直接套用的 constraint。S2 前必須先用 synthetic fixture 驗證 orphan、nullable relationship 與 polymorphic `productType` 關係，才可決定哪些 PostgreSQL FK 可以實體化。

## 逐表對照

| MySQL source table | PostgreSQL target table | Columns | Source type families | PK | FK／logical relation（待決定） | Unique | Defaulted fields | Secondary indexes | Owner |
|---|---|---:|---|---|---|---|---|---:|---|
| `games` | `games` | 11 | int, varchar, boolean, text, timestamp | id | none declared | code | isActive, sortOrder, createdAt, updatedAt | 2 | TCG catalog |
| `fxRates` | `fxRates` | 7 | int, varchar, decimal, timestamp | id | none declared | uniq_fx_rates_daily_provider_pair: <br>    provider,<br>    baseCurrency,<br>    quoteCurrency,<br>    rateDate,<br>   | provider, fetchedAt | 1 | Pricing & market data |
| `sealedProducts` | `sealedProducts` | 14 | int, text, mysqlEnum, timestamp | id | gameId → games.id | none declared | boxType, createdAt, updatedAt | 2 | TCG catalog |
| `users` | `users` | 25 | int, varchar, text, mysqlEnum, boolean, timestamp, bigint | id | none declared | email | role, emailVerified, createdAt, updatedAt, lastSignedIn, phoneVerified, isBlocked, vipPlan | 0 | Identity & user experience |
| `cards` | `cards` | 22 | int, varchar, text, timestamp | id | gameId → games.id | cardId; snkrdunkId | gameId, language, createdAt, updatedAt | 5 | TCG catalog |
| `priceHistory` | `priceHistory` | 17 | int, mysqlEnum, decimal, varchar, text, timestamp, boolean | id | cardId → cards.id (conditional where productType=single_card) | uniq_price_card_source_grade_soldAt_jpyPrice_pos: <br>    cardId,<br>    source,<br>    grade,<br>    soldAt,<br>    jpyPrice,<br>    sourcePosition<br>  ; uniq_price_record_hash: recordHash | productType, currency, sourcePosition, isSuspectedBulk, createdAt | 7 | Pricing & market data |
| `watchlist` | `watchlist` | 8 | int, mysqlEnum, decimal, varchar, text, timestamp | id | userId → users.id; cardId → cards.id (conditional where productType=single_card) | idx_watchlist_userId_cardId: userId, cardId, productType | productType, currency, createdAt | 2 | Identity & user experience |
| `viewHistory` | `viewHistory` | 5 | int, mysqlEnum, timestamp | id | userId → users.id; cardId → cards.id (conditional where productType=single_card) | none declared | productType, viewedAt | 3 | Platform domain (manual owner assignment required) |
| `scraperPerformanceLogs` | `scraperPerformanceLogs` | 9 | int, mysqlEnum, text, timestamp | id | cardId → cards.id | none declared | itemsProcessed, createdAt | 0 | Pricing & market data |
| `marketTrends` | `marketTrends` | 10 | int, timestamp, decimal, varchar | id | cardId → cards.id | none declared | currency, createdAt | 0 | Pricing & market data |
| `dataSources` | `dataSources` | 16 | int, mysqlEnum, text, varchar, timestamp | id | cardId → cards.id (conditional where productType=single_card); gameId → games.id | none declared | productType, isActive, updateCount, createdAt, updatedAt | 6 | Pricing & market data |
| `scheduledTasks` | `scheduledTasks` | 17 | int, varchar, mysqlEnum, timestamp, text | id | targetId → logical relation unresolved — require S2 constraint decision | uniq_scheduled_task_external_run: taskType, externalRunId | status, processedItems, successCount, failureCount, progress, activeProcessingMs, createdAt, updatedAt | 0 | Operations & platform |
| `snkrdunkListingsCache` | `snkrdunkListingsCache` | 9 | int, varchar, text, timestamp | id | cardId → cards.id | none declared | cachedAt, createdAt, updatedAt | 2 | Pricing & market data |
| `ebayListingsCache` | `ebayListingsCache` | 9 | int, varchar, text, timestamp | id | cardId → cards.id | none declared | cachedAt, createdAt, updatedAt | 3 | Pricing & market data |
| `firecrawlUsage` | `firecrawlUsage` | 7 | int, varchar, text, mysqlEnum, timestamp | id | none declared | none declared | creditsUsed, createdAt | 0 | Operations & platform |
| `systemSettings` | `systemSettings` | 5 | int, varchar, text, timestamp | id | none declared | settingKey | updatedAt | 0 | Operations & platform |
| `searchStats` | `searchStats` | 8 | int, mysqlEnum, boolean, text, timestamp | id | cardId → cards.id | none declared | success, createdAt | 0 | Operations & platform |
| `userSearchLogs` | `userSearchLogs` | 7 | int, varchar, mysqlEnum, timestamp | id | cardId → cards.id; userId → users.id | none declared | createdAt | 0 | Identity & user experience |
| `categories` | `categories` | 7 | int, varchar, text, timestamp | id | none declared | slug | createdAt | 0 | Platform domain (manual owner assignment required) |
| `tags` | `tags` | 4 | int, varchar, timestamp | id | none declared | name; slug | createdAt | 0 | Content & media metadata |
| `posts` | `posts` | 26 | int, text, varchar, mysqlEnum, timestamp | id | categoryId → categories.id; authorId → users.id | slug | status, viewCount, createdAt, updatedAt | 0 | Content & media metadata |
| `post_tags` | `post_tags` | 2 | int | none declared | postId → posts.id; tagId → tags.id | none declared | none | 0 | Content & media metadata |
| `post_versions` | `post_versions` | 11 | int, varchar, text, timestamp | id | postId → posts.id; createdBy → users.id | none declared | createdAt | 0 | Content & media metadata |
| `uploaded_images` | `uploaded_images` | 8 | int, text, varchar, timestamp | id | uploadedBy → users.id | none declared | createdAt | 0 | Content & media metadata |
| `articleGenerationHistory` | `articleGenerationHistory` | 18 | int, mysqlEnum, text, varchar, timestamp | id | userId → users.id; postId → posts.id | none declared | status, createdAt, updatedAt | 0 | Content & media metadata |
| `priceUpdateSchedule` | `priceUpdateSchedule` | 10 | int, boolean, varchar, timestamp | id | none declared | none declared | snkrdunkEnabled, snkrdunkUpdateTime, snkrdunkUpdateMode, timezone, createdAt, updatedAt | 0 | Pricing & market data |
| `scheduleConfig` | `scheduleConfig` | 10 | int, varchar, boolean, text, timestamp | id | none declared | scheduleType | enabled, timezone, createdAt, updatedAt | 0 | Operations & platform |
| `trendingCardsCache` | `trendingCardsCache` | 8 | int, decimal, timestamp | id | cardId → cards.id | none declared | createdAt | 1 | TCG catalog |
| `notifications` | `notifications` | 9 | int, varchar, text, boolean, timestamp | id | userId → users.id; relatedId → logical relation unresolved — require S2 constraint decision | none declared | isRead, createdAt | 3 | Identity & user experience |
| `scheduleExecutionHistory` | `scheduleExecutionHistory` | 11 | int, varchar, mysqlEnum, timestamp, text | id | none declared | none declared | snkrdunkSuccessCount, snkrdunkFailureCount, snkrdunkRecordsAdded | 2 | Operations & platform |
| `postShares` | `postShares` | 6 | int, mysqlEnum, timestamp, text, varchar | id | postId → posts.id | none declared | sharedAt | 3 | Content & media metadata |
| `trendingRankingsCache` | `trendingRankingsCache` | 7 | int, mysqlEnum, text, timestamp | id | none declared | none declared | createdAt | 2 | Pricing & market data |
| `sellerProfiles` | `sellerProfiles` | 17 | int, varchar, text, mysqlEnum, decimal, boolean, timestamp | id | userId → users.id | none declared | stripeConnectStatus, totalSales, avgRating, ratingCount, isActive, isSuspended, createdAt, updatedAt | 1 | Platform domain (manual owner assignment required) |
| `marketplaceListings` | `marketplaceListings` | 44 | int, mysqlEnum, varchar, text, decimal, boolean, timestamp | id | sellerId → users.id; cardId → cards.id; currentHighestBidderId → logical relation unresolved — require S2 constraint decision; winnerId → logical relation unresolved — require S2 constraint decision; winningBidId → logical relation unresolved — require S2 constraint decision; auctionOrderId → logical relation unresolved — require S2 constraint decision | none declared | condition, tcgSeries, quantity, remainingQuantity, status, adminDelisted, allowOffers, listingMode, bidIncrement, bidCount, antiSnipingMinutes, antiSnipingExtensions, hasReserveMet, isHighValueReview, viewCount, createdAt, updatedAt | 9 | Pricing & market data |
| `marketplaceOrders` | `marketplaceOrders` | 67 | int, varchar, mysqlEnum, decimal, text, timestamp | id | buyerId → users.id; listingId → marketplaceListings.id; sellerId → users.id; cartOrderId → logical relation unresolved — require S2 constraint decision; auctionListingId → logical relation unresolved — require S2 constraint decision; auctionWinningBidId → logical relation unresolved — require S2 constraint decision | mo_unique_auction_listing: auctionListingId | sellerType, quantity, platformFeeRate, platformFeeHkd, paymentStatus, orderStatus, disputePriority, payoutStatus, alipayRefundStatus, createdAt, updatedAt, orderSource | 8 | Pricing & market data |
| `cartOrders` | `cartOrders` | 14 | int, decimal, boolean, varchar, text, mysqlEnum, timestamp | id | buyerId → users.id | none declared | totalPlatformFeeHkd, hasSellerItems, availablePaymentMethods, paymentStatus, createdAt, updatedAt | 3 | Marketplace & transactions |
| `marketplaceOrderItems` | `marketplaceOrderItems` | 12 | int, mysqlEnum, varchar, decimal, timestamp | id | orderId → marketplaceOrders.id; listingId → marketplaceListings.id; sellerId → users.id | none declared | quantity, payoutStatus, createdAt | 3 | Pricing & market data |
| `marketplacePayouts` | `marketplacePayouts` | 10 | int, decimal, varchar, mysqlEnum, text, timestamp | id | orderId → marketplaceOrders.id; sellerId → users.id | none declared | status, retryCount, createdAt, updatedAt | 2 | Pricing & market data |
| `marketplaceBanners` | `marketplaceBanners` | 16 | int, varchar, boolean, timestamp | id | none declared | none declared | subtitle, cta, ctaConditions, ctaSellerType, gradient, accentColor, badge, badgeClass, emoji, imageUrl, sortOrder, isActive, createdAt, updatedAt | 2 | Pricing & market data |
| `wishlists` | `wishlists` | 4 | int, timestamp | id | userId → users.id; listingId → marketplaceListings.id | none declared | createdAt | 3 | Platform domain (manual owner assignment required) |
| `marketplaceReviews` | `marketplaceReviews` | 9 | int, text, boolean, timestamp | id | orderId → marketplaceOrders.id; listingId → marketplaceListings.id; buyerId → users.id; sellerId → users.id | mr_unique_order: orderId | isAnonymous, createdAt | 3 | Pricing & market data |
| `userShippingAddresses` | `userShippingAddresses` | 14 | int, varchar, mysqlEnum, boolean, timestamp | id | userId → users.id | none declared | label, addressType, region, isDefault, createdAt, updatedAt | 1 | Marketplace & transactions |
| `offers` | `offers` | 15 | int, decimal, text, mysqlEnum, timestamp | id | listingId → marketplaceListings.id; buyerId → users.id; sellerId → users.id; sellerProfileId → logical relation unresolved — require S2 constraint decision; orderId → marketplaceOrders.id | none declared | status, createdAt, updatedAt | 4 | Marketplace & transactions |
| `listingReports` | `listingReports` | 9 | int, mysqlEnum, text, timestamp | id | listingId → marketplaceListings.id; reporterId → logical relation unresolved — require S2 constraint decision | none declared | status, createdAt | 3 | Marketplace & transactions |
| `orderStatusHistory` | `orderStatusHistory` | 9 | int, varchar, timestamp | id | orderId → marketplaceOrders.id; operatorId → logical relation unresolved — require S2 constraint decision | none declared | entryType, createdAt | 2 | Marketplace & transactions |
| `marketplaceSearchLogs` | `marketplaceSearchLogs` | 5 | int, varchar, timestamp | id | userId → users.id | none declared | createdAt | 2 | Pricing & market data |
| `cartItems` | `cartItems` | 5 | int, timestamp | id | userId → users.id; listingId → marketplaceListings.id | cart_user_listing_unique: userId, listingId | addedAt | 2 | Platform domain (manual owner assignment required) |
| `emailUnsubscribes` | `emailUnsubscribes` | 7 | int, varchar, timestamp | id | userId → users.id | token; eu_token_idx: token | unsubscribedAt | 2 | Platform domain (manual owner assignment required) |
| `emailLogs` | `emailLogs` | 9 | int, varchar, mysqlEnum, text, timestamp | id | toUserId → logical relation unresolved — require S2 constraint decision | none declared | status, sentAt | 6 | Operations & platform |
| `adminAuditLogs` | `adminAuditLogs` | 8 | int, varchar, text, timestamp | id | adminId → logical relation unresolved — require S2 constraint decision; targetId → logical relation unresolved — require S2 constraint decision | none declared | createdAt | 4 | Operations & platform |
| `marketplaceWhitelist` | `marketplaceWhitelist` | 5 | int, varchar, timestamp | id | userId → users.id | mw_userId_idx: userId | createdAt | 0 | Pricing & market data |
| `orderMessages` | `orderMessages` | 15 | int, varchar, mysqlEnum, text, boolean, timestamp | id | orderId → marketplaceOrders.id; senderId → logical relation unresolved — require S2 constraint decision | none declared | isSystemMessage, readByBuyer, readBySeller, readByAdmin, createdAt | 4 | Marketplace & transactions |
| `disputeMedia` | `disputeMedia` | 10 | int, varchar, mysqlEnum, text, timestamp | id | orderId → marketplaceOrders.id; uploaderId → logical relation unresolved — require S2 constraint decision | none declared | mediaType, createdAt | 3 | Platform domain (manual owner assignment required) |
| `auctionBids` | `auctionBids` | 13 | int, decimal, mysqlEnum, varchar, text, timestamp | id | listingId → marketplaceListings.id; bidderId → logical relation unresolved — require S2 constraint decision | none declared | status, depositStatus, createdAt | 3 | Marketplace & transactions |
| `auctionAgreements` | `auctionAgreements` | 6 | int, mysqlEnum, varchar, timestamp | id | userId → users.id | aa_user_role_version_idx: userId, role, termsVersion | agreedAt | 1 | Marketplace & transactions |
| `auctionViolations` | `auctionViolations` | 9 | int, mysqlEnum, timestamp, text | id | userId → users.id; listingId → marketplaceListings.id; orderId → marketplaceOrders.id | none declared | createdAt | 2 | Marketplace & transactions |
| `listingModerationLogs` | `listingModerationLogs` | 11 | int, mysqlEnum, varchar, text, timestamp | id | listingId → marketplaceListings.id; adminId → logical relation unresolved — require S2 constraint decision | none declared | listingMode, createdAt | 3 | Marketplace & transactions |
| `platformRules` | `platformRules` | 8 | int, mysqlEnum, varchar, text, boolean, timestamp | id | none declared | none declared | isActive, sortOrder, createdAt, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `productCategories` | `productCategories` | 9 | int, varchar, text, boolean, timestamp | id | parentId → logical relation unresolved — require S2 constraint decision | pc_slug_idx: slug | isActive, sortOrder, createdAt | 1 | Platform domain (manual owner assignment required) |
| `sellerRiskProfiles` | `sellerRiskProfiles` | 11 | int, mysqlEnum, timestamp, text, boolean | id | sellerId → users.id | srp_sellerId_idx: sellerId | riskLevel, totalListings, delistedCount, reportCount, disputeCount, isWatched, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `securityEvents` | `securityEvents` | 7 | int, mysqlEnum, varchar, text, timestamp | id | none declared | none declared | createdAt | 3 | Platform domain (manual owner assignment required) |
| `blockedIps` | `blockedIps` | 6 | varchar, timestamp, boolean | ip | none declared | none declared | blockedBy, blockedAt, isActive | 1 | Platform domain (manual owner assignment required) |
| `adminIpWhitelist` | `adminIpWhitelist` | 4 | varchar, timestamp | ip | none declared | none declared | addedBy, addedAt | 0 | Platform domain (manual owner assignment required) |
| `gradingServiceTiers` | `gradingServiceTiers` | 11 | int, varchar, decimal, text, boolean, timestamp | id | none declared | none declared | isActive, sortOrder, createdAt, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `gradingBatches` | `gradingBatches` | 9 | int, varchar, timestamp, mysqlEnum, decimal | id | none declared | none declared | status, batchCostHkd, createdAt, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `gradingSubmissions` | `gradingSubmissions` | 38 | int, varchar, mysqlEnum, decimal, timestamp, text | id | userId → users.id; batchId → logical relation unresolved — require S2 constraint decision; upgradeNewTierId → logical relation unresolved — require S2 constraint decision | orderNo | status, createdAt, updatedAt | 4 | Platform domain (manual owner assignment required) |
| `gradingSubmissionItems` | `gradingSubmissionItems` | 16 | int, varchar, mysqlEnum, text, decimal, timestamp | id | submissionId → logical relation unresolved — require S2 constraint decision; tierId → logical relation unresolved — require S2 constraint decision | none declared | cardLanguage, condition, itemStatus, createdAt, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `gradingReviews` | `gradingReviews` | 8 | int, text, boolean, timestamp | id | submissionId → logical relation unresolved — require S2 constraint decision; userId → users.id | submissionId | isPublic, createdAt, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `cardInventory` | `cardInventory` | 25 | int, mysqlEnum, varchar, decimal, timestamp, text | id | linkedCardId → logical relation unresolved — require S2 constraint decision | none declared | itemType, buyPriceCurrency, buyExchangeRate, status, sellPriceCurrency, createdAt, updatedAt | 3 | TCG catalog |
| `companyCardInventory` | `companyCardInventory` | 25 | int, mysqlEnum, varchar, decimal, timestamp, text | id | linkedCardId → logical relation unresolved — require S2 constraint decision | none declared | itemType, buyPriceCurrency, buyExchangeRate, status, sellPriceCurrency, createdAt, updatedAt | 3 | TCG catalog |
| `whatsappWebhookEvents` | `whatsappWebhookEvents` | 10 | int, varchar, mysqlEnum, text, timestamp | id | none declared | idMessage | processingState, receivedAt | 1 | Platform domain (manual owner assignment required) |
| `whatsappTradeIntakes` | `whatsappTradeIntakes` | 19 | int, varchar, mysqlEnum, text, timestamp, decimal | id | requestedInventoryId → logical relation unresolved — require S2 constraint decision; matchedProductId → logical relation unresolved — require S2 constraint decision; cardInventoryId → logical relation unresolved — require S2 constraint decision | commandMessageId | currency, status, createdAt, updatedAt | 3 | Marketplace & transactions |
| `whatsappTradeMedia` | `whatsappTradeMedia` | 12 | int, varchar, text, timestamp | id | intakeId → logical relation unresolved — require S2 constraint decision | mediaMessageId | receivedAt | 2 | Marketplace & transactions |
| `exportJobs` | `exportJobs` | 13 | varchar, mysqlEnum, int, text, timestamp | id | none declared | none declared | status, progress, currentItem, totalItems, createdAt, updatedAt | 0 | Platform domain (manual owner assignment required) |
| `gradingBannerImages` | `gradingBannerImages` | 8 | int, text, varchar, boolean, timestamp | id | none declared | none declared | sortOrder, isActive, createdAt, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `searchTokens` | `searchTokens` | 5 | int, mysqlEnum, varchar | id | cardId → cards.id (conditional where productType=single_card) | none declared | productType | 4 | Platform domain (manual owner assignment required) |
| `snkrdunkGradeIndex` | `snkrdunkGradeIndex` | 6 | int, varchar, decimal, timestamp | id | cardId → cards.id | none declared | listingCount, updatedAt | 3 | Pricing & market data |
| `userCollections` | `userCollections` | 13 | int, varchar, decimal, timestamp, text, boolean | id | userId → users.id; cardId → cards.id | none declared | quantity, isPublic, createdAt, updatedAt | 5 | Identity & user experience |
| `cardTrades` | `cardTrades` | 8 | int, timestamp, varchar, decimal, text | id | userId → users.id | none declared | cashAdjustment, createdAt, updatedAt | 2 | TCG catalog |
| `cardTradeItems` | `cardTradeItems` | 12 | int, mysqlEnum, varchar, decimal, timestamp | id | tradeId → logical relation unresolved — require S2 constraint decision; collectionId → logical relation unresolved — require S2 constraint decision; cardId → cards.id; newCollectionId → logical relation unresolved — require S2 constraint decision | none declared | grader, quantity, createdAt | 3 | TCG catalog |
| `orders` | `orders` | 16 | int, varchar, decimal, text, timestamp | id | buyerId → users.id | orderNo | paymentStatus, orderStatus, createdAt, updatedAt | 5 | Marketplace & transactions |
| `orderItems` | `orderItems` | 13 | int, decimal, varchar, timestamp, text | id | orderId → marketplaceOrders.id; sellerId → users.id; listingId → marketplaceListings.id | none declared | quantity, shippingStatus, createdAt, updatedAt | 4 | Marketplace & transactions |
| `webhookLogs` | `webhookLogs` | 10 | int, varchar, text, timestamp | id | none declared | eventId | status, retryCount, createdAt, updatedAt | 3 | Operations & platform |
| `tcgMarketPrices` | `tcgMarketPrices` | 13 | int, varchar, decimal, timestamp | id | cardId → cards.id | tcgmp_tcgCardId_uniq: tcgCardId | updatedAt, createdAt | 1 | TCG catalog |
| `pools` | `pools` | 19 | int, varchar, text, mysqlEnum, boolean, timestamp | id | none declared | none declared | totalSlots, pricePoints, officialBuybackPoints, visibleCardCost, miscCost, status, maintenanceMode, sortOrder, freeTrialEnabled, createdAt, updatedAt | 0 | Platform domain (manual owner assignment required) |
| `poolRewards` | `poolRewards` | 11 | int, varchar, mysqlEnum, text, timestamp | id | poolId → logical relation unresolved — require S2 constraint decision; cardId → cards.id | none declared | rewardType, cost, quantity, createdAt | 0 | Platform domain (manual owner assignment required) |
| `poolSlots` | `poolSlots` | 9 | int, varchar, boolean, timestamp | id | poolId → logical relation unresolved — require S2 constraint decision; rewardId → logical relation unresolved — require S2 constraint decision; drawnByUserId → logical relation unresolved — require S2 constraint decision | none declared | isDrawn, createdAt | 0 | Platform domain (manual owner assignment required) |
| `userVault` | `userVault` | 18 | int, varchar, text, tinyint, mysqlEnum, timestamp | id | userId → users.id; poolSlotId → logical relation unresolved — require S2 constraint decision; poolId → logical relation unresolved — require S2 constraint decision; rewardId → logical relation unresolved — require S2 constraint decision; shippingAddressId → logical relation unresolved — require S2 constraint decision | none declared | rewardId, slotIndex, effectTier, isMilestone, status, createdAt | 0 | Identity & user experience |
| `userPointBalance` | `userPointBalance` | 4 | int, bigint, timestamp | id | userId → users.id | userId | balance, updatedAt | 0 | Identity & user experience |
| `pointTransactions` | `pointTransactions` | 8 | int, mysqlEnum, bigint, varchar, timestamp | id | userId → users.id | none declared | createdAt | 0 | Marketplace & transactions |
| `freeTrialDraws` | `freeTrialDraws` | 8 | int, varchar, text, timestamp | id | userId → users.id; poolId → logical relation unresolved — require S2 constraint decision; rewardId → logical relation unresolved — require S2 constraint decision | none declared | createdAt | 0 | Platform domain (manual owner assignment required) |
| `aiScanUsage` | `aiScanUsage` | 5 | int, varchar, timestamp | id | userId → users.id | idx_aiScanUsage_userId_yearMonth: userId, yearMonth | count, updatedAt | 0 | Operations & platform |
| `wallEntries` | `wallEntries` | 36 | int, varchar, text, bigint, boolean, timestamp | id | userId → users.id; topCardId → logical relation unresolved — require S2 constraint decision | userId; idx_wallEntries_userId: userId | totalValue, topCardValue, card2Value, card3Value, card4Value, card5Value, sighs, isPublic, createdAt, updatedAt | 2 | Platform domain (manual owner assignment required) |
| `wallComments` | `wallComments` | 6 | int, varchar, timestamp | id | entryId → logical relation unresolved — require S2 constraint decision; userId → users.id | none declared | createdAt | 2 | Platform domain (manual owner assignment required) |
| `wallSighLogs` | `wallSighLogs` | 4 | int, timestamp | id | entryId → logical relation unresolved — require S2 constraint decision; userId → users.id | idx_wallSighLogs_entry_user: entryId, userId | createdAt | 0 | Operations & platform |

## S1 PostgreSQL 設計規則

| Source construct | Proposed PostgreSQL design | S1／S2 decision point |
|---|---|---|
| `mysqlTable` | Same physical table name with `pgTable` | Preserve application-facing identifiers unless a separately approved naming migration is planned. |
| `int().autoincrement()` | `integer().generatedByDefaultAsIdentity()` | S2 must define sequence reset after any approved import. |
| `mysqlEnum` | Per-table `pgEnum` in the S1 draft | S2 must review enum lifecycle and decide whether future values require enum migration or `varchar + check`. |
| MySQL `timestamp` | `timestamp(..., { withTimezone: true })` design proposal | Per-column timezone semantic register is mandatory before any data import. |
| `.onUpdateNow()` | Drizzle `$onUpdate(() => new Date())` design placeholder | S2 must decide server application update vs database trigger and test concurrent writers. |
| JSON carried in `text` | Keep as `text` in initial draft unless query contract requires `jsonb` | S1 type register identifies high-risk fields; no data transformation has occurred. |
| No source `.references()` | No physical FK is auto-generated | Add only explicitly approved, data-validated constraints in S2. |

## S1 Acceptance Status

| Requirement | Status |
|---|---|
| All source tables mapped | Complete — 95/95. |
| Every mapping names PK, logical FK status, unique/default and owner | Complete; undeclared source constraints are explicitly flagged rather than guessed. |
| Existing MySQL schema unchanged | Complete — no source file edited. |
| Supabase Lab schema unchanged | Complete — no migration／DDL executed. |
| Production resources/data unchanged | Complete — source-code-only analysis. |

## Next Gate (not approved by this document)

The companion `drizzle/schema.pg.ts` is a **non-executable S1 draft**. It must not be imported by runtime code, supplied to `db:push`, or applied to Supabase Lab until the user separately approves S2.
