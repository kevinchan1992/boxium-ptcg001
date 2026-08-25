/*
 * AUTO-GENERATED S1 DESIGN DRAFT — DO NOT APPLY.
 *
 * Source: drizzle/schema_new.ts (MySQL/TiDB). This file is an inventory-backed
 * PostgreSQL mapping proposal only. It must not be imported by production code,
 * executed with db:push, or used to create any Lab schema before S2 approval.
 *
 * Key intentional design decisions:
 * - MySQL timestamp fields are proposed as timestamptz, pending the S1 UTC field decision register.
 * - Inline MySQL enums become per-table PostgreSQL enum types.
 * - MySQL auto-increment becomes generated-by-default identity.
 * - MySQL onUpdateNow becomes Drizzle runtime $onUpdate; database-side trigger policy remains an S2 decision.
 * - The source schema declares no Drizzle .references(); logical relations remain deferred for explicit review.
 */

import { bigint, boolean, decimal, index, integer, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const sealedProductsBoxTypeEnum = pgEnum('enum_sealed_products_box_type', ["booster_box", "other"]);
export const usersLoginMethodEnum = pgEnum('enum_users_login_method', ["password", "google", "apple"]);
export const usersRoleEnum = pgEnum('enum_users_role', ["user", "admin"]);
export const usersVipPlanEnum = pgEnum('enum_users_vip_plan', ["none", "monthly", "yearly"]);
export const priceHistoryProductTypeEnum = pgEnum('enum_price_history_product_type', ["single_card", "sealed_product"]);
export const priceHistorySourceEnum = pgEnum('enum_price_history_source', ["snkrdunk", "ebay", "tcgplayer", "other"]);
export const watchlistProductTypeEnum = pgEnum('enum_watchlist_product_type', ["single_card", "sealed_product"]);
export const viewHistoryProductTypeEnum = pgEnum('enum_view_history_product_type', ["single_card", "sealed_product"]);
export const scraperPerformanceLogsSourceEnum = pgEnum('enum_scraper_performance_logs_source', ["snkrdunk", "ebay"]);
export const scraperPerformanceLogsOperationTypeEnum = pgEnum('enum_scraper_performance_logs_operation_type', ["single", "batch"]);
export const scraperPerformanceLogsStatusEnum = pgEnum('enum_scraper_performance_logs_status', ["success", "error", "timeout"]);
export const dataSourcesProductTypeEnum = pgEnum('enum_data_sources_product_type', ["single_card", "sealed_product"]);
export const dataSourcesSourceEnum = pgEnum('enum_data_sources_source', ["snkrdunk", "ebay", "tcgplayer", "other"]);
export const scheduledTasksStatusEnum = pgEnum('enum_scheduled_tasks_status', ["pending", "running", "completed", "failed", "paused"]);
export const firecrawlUsageStatusEnum = pgEnum('enum_firecrawl_usage_status', ["success", "failed", "quota_exceeded"]);
export const searchStatsSearchMethodEnum = pgEnum('enum_search_stats_search_method', ["image", "text"]);
export const userSearchLogsSourceEnum = pgEnum('enum_user_search_logs_source', ["search_page", "card_click", "trending_page", "home_page"]);
export const postsStatusEnum = pgEnum('enum_posts_status', ["draft", "published"]);
export const postsDataSourceEnum = pgEnum('enum_posts_data_source', ["manual", "ai-generated", "mixed"]);
export const articleGenerationHistoryInputTypeEnum = pgEnum('enum_article_generation_history_input_type', ["url", "text"]);
export const articleGenerationHistoryStatusEnum = pgEnum('enum_article_generation_history_status', ["pending", "processing", "completed", "failed"]);
export const scheduleExecutionHistoryExecutionTypeEnum = pgEnum('enum_schedule_execution_history_execution_type', ["scheduled", "manual", "catchup"]);
export const scheduleExecutionHistoryStatusEnum = pgEnum('enum_schedule_execution_history_status', ["running", "completed", "failed"]);
export const postSharesShareTypeEnum = pgEnum('enum_post_shares_share_type', ["facebook", "whatsapp", "copy_link"]);
export const trendingRankingsCacheRankingTypeEnum = pgEnum('enum_trending_rankings_cache_ranking_type', ["price_increase", "price_decrease", "search_popularity"]);
export const sellerProfilesStripeConnectStatusEnum = pgEnum('enum_seller_profiles_stripe_connect_status', ["not_started", "pending", "active", "verified", "restricted", "disabled"]);
export const marketplaceListingsSellerTypeEnum = pgEnum('enum_marketplace_listings_seller_type', ["platform", "seller"]);
export const marketplaceListingsConditionEnum = pgEnum('enum_marketplace_listings_condition', ["psa10", "psa9", "psa8_below", "bgs10", "bgs9", "bgs8_below", "tag10", "tag9_below", "raw_a", "raw_b", "raw_c", "raw_d"]);
export const marketplaceListingsTcgSeriesEnum = pgEnum('enum_marketplace_listings_tcg_series', ["pokemon", "onepiece", "yugioh", "dragonball", "unionarena", "weiss", "gundam", "mtg", "other"]);
export const marketplaceListingsStatusEnum = pgEnum('enum_marketplace_listings_status', ["draft", "pending_review", "active", "reserved", "sold", "removed"]);
export const marketplaceListingsListingModeEnum = pgEnum('enum_marketplace_listings_listing_mode', ["buy_now", "offer", "auction"]);
export const marketplaceListingsAuctionStatusEnum = pgEnum('enum_marketplace_listings_auction_status', [
    "draft", "pending_review", "scheduled", "active",
    "ending_soon", "ended_sold", "ended_no_bid", "cancelled", "rejected"
  ]);
export const marketplaceListingsAuctionPaymentStatusEnum = pgEnum('enum_marketplace_listings_auction_payment_status', ["pending", "paid", "failed", "expired"]);
export const marketplaceOrdersSellerTypeEnum = pgEnum('enum_marketplace_orders_seller_type', ["platform", "seller"]);
export const marketplaceOrdersPaymentMethodEnum = pgEnum('enum_marketplace_orders_payment_method', ["stripe", "alipay_hk"]);
export const marketplaceOrdersAlipayProofStatusEnum = pgEnum('enum_marketplace_orders_alipay_proof_status', ["pending_review", "approved", "rejected"]);
export const marketplaceOrdersPaymentStatusEnum = pgEnum('enum_marketplace_orders_payment_status', ["pending", "paid", "failed", "refunded", "cancelled"]);
export const marketplaceOrdersOrderStatusEnum = pgEnum('enum_marketplace_orders_order_status', [
    "pending_payment",
    "paid_held",
    "payment_received",
    "processing",
    "shipped",
    "delivered",
    "completed",
    "cancelled",
    "disputed",
    "refunded"
  ]);
export const marketplaceOrdersShippingMethodEnum = pgEnum('enum_marketplace_orders_shipping_method', ["sf_express", "hk_post", "sf_cod", "hongkong_post", "other", "meetup"]);
export const marketplaceOrdersDisputePriorityEnum = pgEnum('enum_marketplace_orders_dispute_priority', ["high", "medium", "low"]);
export const marketplaceOrdersPayoutStatusEnum = pgEnum('enum_marketplace_orders_payout_status', ["not_applicable", "pending", "processing", "completed", "paid", "failed", "hold"]);
export const marketplaceOrdersAlipayRefundStatusEnum = pgEnum('enum_marketplace_orders_alipay_refund_status', ["not_applicable", "pending", "processing", "completed"]);
export const marketplaceOrdersOrderSourceEnum = pgEnum('enum_marketplace_orders_order_source', ["direct", "offer", "auction"]);
export const cartOrdersPaymentStatusEnum = pgEnum('enum_cart_orders_payment_status', ["pending", "succeeded", "failed", "refunded"]);
export const marketplaceOrderItemsSellerTypeEnum = pgEnum('enum_marketplace_order_items_seller_type', ["platform", "seller"]);
export const marketplaceOrderItemsPayoutStatusEnum = pgEnum('enum_marketplace_order_items_payout_status', ["pending", "processing", "paid", "failed"]);
export const marketplacePayoutsStatusEnum = pgEnum('enum_marketplace_payouts_status', ["pending", "processing", "paid", "failed"]);
export const userShippingAddressesAddressTypeEnum = pgEnum('enum_user_shipping_addresses_address_type', ["normal", "sf_station"]);
export const offersStatusEnum = pgEnum('enum_offers_status', ["pending", "accepted", "rejected", "expired", "cancelled"]);
export const listingReportsReasonEnum = pgEnum('enum_listing_reports_reason', ["fake_item", "wrong_description", "prohibited_item", "scam", "other"]);
export const listingReportsStatusEnum = pgEnum('enum_listing_reports_status', ["pending", "reviewed", "dismissed", "actioned"]);
export const emailLogsStatusEnum = pgEnum('enum_email_logs_status', ["sent", "failed", "skipped"]);
export const orderMessagesSenderRoleEnum = pgEnum('enum_order_messages_sender_role', ["buyer", "seller", "admin"]);
export const disputeMediaUploaderRoleEnum = pgEnum('enum_dispute_media_uploader_role', ["buyer", "seller", "admin"]);
export const disputeMediaMediaTypeEnum = pgEnum('enum_dispute_media_media_type', ["image", "video"]);
export const auctionBidsStatusEnum = pgEnum('enum_auction_bids_status', ["active", "outbid", "winning", "retracted"]);
export const auctionBidsDepositStatusEnum = pgEnum('enum_auction_bids_deposit_status', ["none", "held", "released", "captured"]);
export const auctionAgreementsRoleEnum = pgEnum('enum_auction_agreements_role', ["buyer", "seller"]);
export const auctionViolationsTypeEnum = pgEnum('enum_auction_violations_type', ["no_payment", "fake_bid", "seller_cancel"]);
export const auctionViolationsPenaltyEnum = pgEnum('enum_auction_violations_penalty', ["warning", "ban_7d", "ban_30d", "permanent"]);
export const listingModerationLogsListingModeEnum = pgEnum('enum_listing_moderation_logs_listing_mode', ["direct", "auction"]);
export const listingModerationLogsActionEnum = pgEnum('enum_listing_moderation_logs_action', [
    "delist", "restore", "batch_delist", "batch_restore", "flag_risk", "clear_flag", "edit",
  ]);
export const platformRulesCategoryEnum = pgEnum('enum_platform_rules_category', ["listing", "auction", "payment", "shipping", "conduct", "seller"]);
export const sellerRiskProfilesRiskLevelEnum = pgEnum('enum_seller_risk_profiles_risk_level', ["low", "medium", "high", "critical"]);
export const securityEventsTypeEnum = pgEnum('enum_security_events_type', ["BOT_BLOCKED", "RATE_LIMITED", "UPLOAD_REJECTED", "MANUAL_BLOCK"]);
export const gradingBatchesStatusEnum = pgEnum('enum_grading_batches_status', ["open", "closed", "shipped", "returned"]);
export const gradingSubmissionsStatusEnum = pgEnum('enum_grading_submissions_status', [
    "awaiting_payment",
    "pending_review",
    "pending_shipment",
    "received",
    "submitted_to_psa",
    "grading",
    "graded",
    "payment_overdue",
    "paid",
    "returned",
    "completed",
    "cancelled"
  ]);
export const gradingSubmissionsPaymentMethodEnum = pgEnum('enum_grading_submissions_payment_method', ["stripe", "alipay_hk"]);
export const gradingSubmissionsAlipayProofStatusEnum = pgEnum('enum_grading_submissions_alipay_proof_status', ["pending_review", "approved", "rejected"]);
export const gradingSubmissionsAlipayProofAiResultEnum = pgEnum('enum_grading_submissions_alipay_proof_ai_result', ["pass", "warning", "fail"]);
export const gradingSubmissionsAlipayProofAiConfidenceEnum = pgEnum('enum_grading_submissions_alipay_proof_ai_confidence', ["high", "medium", "low"]);
export const gradingSubmissionItemsCardLanguageEnum = pgEnum('enum_grading_submission_items_card_language', ["zh_tw", "ja", "en", "ko", "other"]);
export const gradingSubmissionItemsConditionEnum = pgEnum('enum_grading_submission_items_condition', ["mint", "near_mint", "excellent"]);
export const gradingSubmissionItemsItemStatusEnum = pgEnum('enum_grading_submission_items_item_status', [
    "pending",
    "received",
    "submitted",
    "graded",
    "returned"
  ]);
export const cardInventoryItemTypeEnum = pgEnum('enum_card_inventory_item_type', ["card", "sealed"]);
export const cardInventoryBuyPriceCurrencyEnum = pgEnum('enum_card_inventory_buy_price_currency', ["HKD", "JPY", "USD"]);
export const cardInventoryStatusEnum = pgEnum('enum_card_inventory_status', ["holding", "sold"]);
export const cardInventorySellPriceCurrencyEnum = pgEnum('enum_card_inventory_sell_price_currency', ["HKD", "JPY", "USD"]);
export const companyCardInventoryItemTypeEnum = pgEnum('enum_company_card_inventory_item_type', ["card", "sealed"]);
export const companyCardInventoryBuyPriceCurrencyEnum = pgEnum('enum_company_card_inventory_buy_price_currency', ["HKD", "JPY", "USD"]);
export const companyCardInventoryStatusEnum = pgEnum('enum_company_card_inventory_status', ["holding", "sold"]);
export const companyCardInventorySellPriceCurrencyEnum = pgEnum('enum_company_card_inventory_sell_price_currency', ["HKD", "JPY", "USD"]);
export const whatsappWebhookEventsProcessingStateEnum = pgEnum('enum_whatsapp_webhook_events_processing_state', ["received", "processed", "ignored", "failed"]);
export const whatsappTradeIntakesActionEnum = pgEnum('enum_whatsapp_trade_intakes_action', ["buy", "sell"]);
export const whatsappTradeIntakesCurrencyEnum = pgEnum('enum_whatsapp_trade_intakes_currency', ["HKD"]);
export const whatsappTradeIntakesStatusEnum = pgEnum('enum_whatsapp_trade_intakes_status', ["processing", "completed", "needs_review", "ignored", "failed"]);
export const whatsappTradeIntakesMatchedProductTypeEnum = pgEnum('enum_whatsapp_trade_intakes_matched_product_type', ["card", "sealed"]);
export const exportJobsTypeEnum = pgEnum('enum_export_jobs_type', ["excel", "pdf"]);
export const exportJobsStatusEnum = pgEnum('enum_export_jobs_status', ["pending", "processing", "done", "error"]);
export const searchTokensProductTypeEnum = pgEnum('enum_search_tokens_product_type', ["single_card", "sealed_product"]);
export const searchTokensTokenTypeEnum = pgEnum('enum_search_tokens_token_type', ["name_en", "name_ja", "card_number", "series", "rarity"]);
export const cardTradeItemsDirectionEnum = pgEnum('enum_card_trade_items_direction', ["in", "out"]);
export const poolsStatusEnum = pgEnum('enum_pools_pool_status', ["draft", "active", "completed", "archived"]);
export const poolRewardsRewardTypeEnum = pgEnum('enum_pool_rewards_pr_reward_type', ["rainbow", "gold", "blue", "hidden", "milestone"]);
export const userVaultStatusEnum = pgEnum('enum_user_vault_uv_status', ["in_vault", "processing_buyback", "sold_to_official", "shipping_requested", "shipped"]);
export const pointTransactionsTypeEnum = pgEnum('enum_point_transactions_pt_type', ["topup", "purchase", "buyback", "refund", "admin_adjust"]);

export const games = pgTable("games", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  nameJa: varchar("nameJa", { length: 128 }),
  nameZh: varchar("nameZh", { length: 128 }),
  publisher: varchar("publisher", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  icon: text("icon"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  codeIdx: index("idx_games_code").on(table.code),
  isActiveIdx: index("idx_games_isActive").on(table.isActive),
}));

export const fxRates = pgTable("fxRates", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  baseCurrency: varchar("baseCurrency", { length: 3 }).notNull(),
  quoteCurrency: varchar("quoteCurrency", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  rateDate: varchar("rateDate", { length: 10 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull().default("frankfurter"),
  fetchedAt: timestamp("fetchedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dailyProviderPairUnique: uniqueIndex("uniq_fx_rates_daily_provider_pair").on(
    table.provider,
    table.baseCurrency,
    table.quoteCurrency,
    table.rateDate,
  ),
  latestPairIdx: index("idx_fx_rates_pair_date").on(table.baseCurrency, table.quoteCurrency, table.rateDate),
}));

export const sealedProducts = pgTable("sealedProducts", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  gameId: integer("gameId").notNull(),
  name: text("name").notNull(),
  nameJa: text("nameJa"),
  nameZh: text("nameZh"),
  boxType: sealedProductsBoxTypeEnum("boxType").notNull().default("booster_box"),
  itemCount: integer("itemCount"),
  setName: text("setName"),
  series: text("series"),
  imageUrl: text("imageUrl"),
  releaseDate: timestamp("releaseDate", { withTimezone: true }),
  styleCode: text("styleCode"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  gameIdIdx: index("idx_sealed_gameId").on(table.gameId),
  boxTypeIdx: index("idx_sealed_boxType").on(table.boxType),
}));

export const users = pgTable("users", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  googleId: varchar("googleId", { length: 128 }),
  appleId: varchar("appleId", { length: 128 }),
  loginMethod: usersLoginMethodEnum("loginMethod").notNull(),
  role: usersRoleEnum("role").default("user").notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
  phone: varchar("phone", { length: 30 }),
  phoneVerified: boolean("phoneVerified").default(false).notNull(),
  phoneVerifyToken: varchar("phoneVerifyToken", { length: 128 }),
  phoneVerifyExpires: bigint("phoneVerifyExpires", { mode: "number" }),
  isBlocked: boolean("isBlocked").default(false).notNull(),
  blockReason: text("blockReason"),
  emailVerificationToken: varchar("emailVerificationToken", { length: 128 }),
  emailVerificationExpiry: timestamp("emailVerificationExpiry", { withTimezone: true }),
  vipPlan: usersVipPlanEnum("vipPlan").default("none").notNull(),
  vipExpiresAt: timestamp("vipExpiresAt", { withTimezone: true }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  vaultShareImageUrl: text("vaultShareImageUrl"),
});

export const cards = pgTable("cards", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: varchar("cardId", { length: 128 }).notNull().unique(),
  snkrdunkId: varchar("snkrdunkId", { length: 32 }).unique(),
  gameId: integer("gameId").notNull().default(1),
  name: text("name").notNull(),
  nameJa: text("nameJa"),
  series: text("series"),
  setName: text("setName"),
  cardNumber: varchar("cardNumber", { length: 32 }),
  rarity: varchar("rarity", { length: 64 }),
  language: varchar("language", { length: 16 }).default("en"),
  releaseDate: timestamp("releaseDate", { withTimezone: true }),
  imageUrl: text("imageUrl"),
  imageUrlHiRes: text("imageUrlHiRes"),
  artist: text("artist"),
  description: text("description"),
  types: text("types"),
  hp: integer("hp"),
  psaSpecId: varchar("psaSpecId", { length: 32 }),
  psaMatchedAt: timestamp("psaMatchedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  gameIdIdx: index("idx_cards_gameId").on(table.gameId),
  nameIdx: index("cards_name_idx").on(table.name),
  nameJaIdx: index("cards_nameJa_idx").on(table.nameJa),
  cardNumberIdx: index("cards_cardNumber_idx").on(table.cardNumber), // 加速 cardNumber 搜尋
  psaSpecIdIdx: index("cards_psaSpecId_idx").on(table.psaSpecId), // PSA spec ID lookup
}));

export const priceHistory = pgTable("priceHistory", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  productType: priceHistoryProductTypeEnum("productType").notNull().default("single_card"),
  source: priceHistorySourceEnum("source").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(),
  grade: varchar("grade", { length: 32 }),
  condition: varchar("condition", { length: 64 }),
  quantity: varchar("quantity", { length: 50 }),
  jpyPrice: integer("jpyPrice"),
  sourcePosition: integer("sourcePosition").default(0).notNull(),
  listingUrl: text("listingUrl"),
  soldAt: timestamp("soldAt", { withTimezone: true }),
  isSuspectedBulk: boolean("isSuspectedBulk").default(false).notNull(),
  recordHash: varchar("recordHash", { length: 64 }),
  title: varchar("title", { length: 512 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // UNIQUE index to prevent duplicate price history records
  // Uses jpyPrice (original JPY) instead of HKD price to avoid false duplicates from exchange rate fluctuations
  // sourcePosition allows multiple transactions on the same day with the same grade and price
  uniquePriceRecord: uniqueIndex("uniq_price_card_source_grade_soldAt_jpyPrice_pos").on(
    table.cardId,
    table.source,
    table.grade,
    table.soldAt,
    table.jpyPrice,
    table.sourcePosition
  ),
  // Secondary UNIQUE index on recordHash for fast idempotent upsert (NULL values are excluded from uniqueness)
  uniqueRecordHash: uniqueIndex("uniq_price_record_hash").on(table.recordHash),
  // Composite index for trending calculations (cardId + soldAt + source + grade)
  // Optimizes queries that filter by cardId, time range, source, and grade
  cardIdSoldAtSourceGradeIdx: index("cardId_soldAt_source_grade_idx").on(
    table.cardId,
    table.soldAt,
    table.source,
    table.grade
  ),
  // Index for soldAt to optimize time-based queries
  soldAtIdx: index("soldAt_idx").on(table.soldAt),
  // Index for source to optimize source-specific queries
  sourceIdx: index("source_idx").on(table.source),
  // Index for productType to optimize product type queries
  productTypeIdx: index("idx_price_productType").on(table.productType),
  // Composite index for card detail PSA 10 queries: (cardId, grade, soldAt DESC)
  // Optimizes: WHERE cardId = ? AND grade = 'PSA 10' ORDER BY soldAt DESC
  cardIdGradeSoldAtIdx: index("ph_cardId_grade_soldAt_idx").on(table.cardId, table.grade, table.soldAt),
  // Composite index for cross-card trending calculations: (source, grade, soldAt)
  // Optimizes: WHERE source = 'snkrdunk' AND grade = 'PSA 10' AND soldAt >= ?
  sourceGradeSoldAtIdx: index("ph_source_grade_soldAt_idx").on(table.source, table.grade, table.soldAt),
  // Covering index for _loadGlobalPriceMap query:
  // SELECT cardId, price FROM priceHistory
  // WHERE source='snkrdunk' AND grade='PSA 10' AND isSuspectedBulk=false
  // ORDER BY soldAt DESC LIMIT 10000
  // Without isSuspectedBulk in index, MySQL must do 591k+ row table lookups (3s+).
  // With this covering index, the query runs entirely in-index (~100ms).
  globalPriceMapIdx: index("ph_global_price_map_idx").on(
    table.source,
    table.grade,
    table.isSuspectedBulk,
    table.soldAt,
    table.cardId,
    table.price
  ),
}));

export const watchlist = pgTable("watchlist", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  cardId: integer("cardId").notNull(),
  productType: watchlistProductTypeEnum("productType").notNull().default("single_card"),
  targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("HKD"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  productTypeIdx: index("idx_watchlist_productType").on(table.productType),
  userIdCardIdIdx: uniqueIndex("idx_watchlist_userId_cardId").on(table.userId, table.cardId, table.productType),
  userIdIdx: index("idx_watchlist_userId").on(table.userId),
}));

export const viewHistory = pgTable("viewHistory", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  cardId: integer("cardId").notNull(),
  productType: viewHistoryProductTypeEnum("productType").notNull().default("single_card"),
  viewedAt: timestamp("viewedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  productTypeIdx: index("idx_viewhistory_productType").on(table.productType),
  userIdViewedAtIdx: index("idx_viewhistory_userId_viewedAt").on(table.userId, table.viewedAt),
  cardIdIdx: index("idx_viewhistory_cardId").on(table.cardId),
}));

export const scraperPerformanceLogs = pgTable("scraperPerformanceLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  source: scraperPerformanceLogsSourceEnum("source").notNull(),
  cardId: integer("cardId"),
  operationType: scraperPerformanceLogsOperationTypeEnum("operationType").notNull(),
  status: scraperPerformanceLogsStatusEnum("status").notNull(),
  responseTime: integer("responseTime").notNull(),
  itemsProcessed: integer("itemsProcessed").default(0),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const marketTrends = pgTable("marketTrends", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  avgPrice: decimal("avgPrice", { precision: 10, scale: 2 }),
  minPrice: decimal("minPrice", { precision: 10, scale: 2 }),
  maxPrice: decimal("maxPrice", { precision: 10, scale: 2 }),
  volume: integer("volume"),
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(),
  source: varchar("source", { length: 32 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const dataSources = pgTable("dataSources", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  gameId: integer("gameId").notNull(),
  productType: dataSourcesProductTypeEnum("productType").notNull().default("single_card"),
  source: dataSourcesSourceEnum("source").notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  sourceIdentifier: varchar("sourceIdentifier", { length: 128 }),
  isActive: integer("isActive").default(1).notNull(),
  lastFetchedAt: timestamp("lastFetchedAt", { withTimezone: true }),
  lastUpdatedAt: timestamp("lastUpdatedAt", { withTimezone: true }),
  nextUpdateAt: timestamp("nextUpdateAt", { withTimezone: true }),
  lastFetchStatus: varchar("lastFetchStatus", { length: 32 }),
  fetchErrorMessage: text("fetchErrorMessage"),
  updateCount: integer("updateCount").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  gameIdIdx: index("idx_datasources_gameId").on(table.gameId),
  productTypeIdx: index("idx_datasources_productType").on(table.productType),
  cardIdSourceIdx: index("idx_datasources_cardId_source").on(table.cardId, table.source),
  sourceLastUpdatedAtIdx: index("idx_datasources_source_lastUpdatedAt").on(table.source, table.lastUpdatedAt),
  sourceIdentifierIdx: index("idx_datasources_sourceIdentifier").on(table.sourceIdentifier),
  isActiveSourceIdx: index("idx_datasources_isActive_source").on(table.isActive, table.source),
}));

export const scheduledTasks = pgTable("scheduledTasks", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  taskType: varchar("taskType", { length: 64 }).notNull(),
  externalRunId: varchar("externalRunId", { length: 128 }),
  status: scheduledTasksStatusEnum("status").default("pending").notNull(),
  targetId: integer("targetId"),
  totalItems: integer("totalItems"),
  processedItems: integer("processedItems").default(0),
  successCount: integer("successCount").default(0),
  failureCount: integer("failureCount").default(0),
  progress: integer("progress").default(0),
  startedAt: timestamp("startedAt", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  errorMessage: text("errorMessage"),
  metadata: text("metadata"),
  activeProcessingMs: integer("activeProcessingMs").default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  // The database is the idempotency lock for retried/concurrent GitHub callbacks.
  taskTypeExternalRunIdUnique: uniqueIndex("uniq_scheduled_task_external_run").on(table.taskType, table.externalRunId),
}));

export const snkrdunkListingsCache = pgTable("snkrdunkListingsCache", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  snkrdunkId: varchar("snkrdunkId", { length: 128 }).notNull(),
  listings: text("listings").notNull(),
  cachedAt: timestamp("cachedAt", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  hotExpiresAt: timestamp("hotExpiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => {
  return {
    cardIdIdx: index("cardId_idx").on(table.cardId),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
  };
});

export const ebayListingsCache = pgTable("ebayListingsCache", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  searchQuery: varchar("searchQuery", { length: 500 }).notNull(),
  listings: text("listings").notNull(),
  cachedAt: timestamp("cachedAt", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  hotExpiresAt: timestamp("hotExpiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => {
  return {
    cardIdIdx: index("cardId_idx").on(table.cardId),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
    hotExpiresAtIdx: index("hotExpiresAt_idx").on(table.hotExpiresAt),
  };
});

export const firecrawlUsage = pgTable("firecrawlUsage", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  operation: varchar("operation", { length: 32 }).notNull(),
  url: text("url"),
  status: firecrawlUsageStatusEnum("status").notNull(),
  errorMessage: text("errorMessage"),
  creditsUsed: integer("creditsUsed").default(1).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const systemSettings = pgTable("systemSettings", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  settingKey: varchar("settingKey", { length: 64 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const searchStats = pgTable("searchStats", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  searchMethod: searchStatsSearchMethodEnum("searchMethod").notNull(),
  searchDuration: integer("searchDuration").notNull(),
  resultsCount: integer("resultsCount").notNull(),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const userSearchLogs = pgTable("userSearchLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  searchQuery: varchar("searchQuery", { length: 255 }),
  source: userSearchLogsSourceEnum("source").notNull(),
  userId: integer("userId"),
  sessionId: varchar("sessionId", { length: 100 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  nameJa: varchar("nameJa", { length: 100 }),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  titleEn: text("titleEn"),
  titleJa: text("titleJa"),
  excerptEn: text("excerptEn"),
  excerptJa: text("excerptJa"),
  contentEn: text("contentEn"),
  contentJa: text("contentJa"),
  featuredImage: text("featuredImage"),
  category: varchar("category", { length: 100 }),
  categoryId: integer("categoryId"),
  status: postsStatusEnum("status").default("draft").notNull(),
  publishedAt: timestamp("publishedAt", { withTimezone: true }),
  viewCount: integer("viewCount").default(0).notNull(),
  authorId: integer("authorId").notNull(),
  dataSource: postsDataSourceEnum("dataSource").notNull(),
  relatedCardIds: text("relatedCardIds"),
  dataSnapshot: text("dataSnapshot"),
  metaTitle: varchar("metaTitle", { length: 255 }),
  metaDescription: text("metaDescription"),
  metaKeywords: text("metaKeywords"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const postTags = pgTable("post_tags", {
  postId: integer("postId").notNull(),
  tagId: integer("tagId").notNull(),
});

export const postVersions = pgTable("post_versions", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  postId: integer("postId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  featuredImage: text("featuredImage"),
  category: varchar("category", { length: 100 }),
  tags: text("tags"),
  metaKeywords: text("metaKeywords"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(),
});

export const uploadedImages = pgTable("uploaded_images", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  uploadedBy: integer("uploadedBy").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const articleGenerationHistory = pgTable("articleGenerationHistory", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  inputType: articleGenerationHistoryInputTypeEnum("inputType").notNull(),
  inputContent: text("inputContent").notNull(),
  detectedLanguage: varchar("detectedLanguage", { length: 10 }),
  targetLanguage: varchar("targetLanguage", { length: 10 }),
  style: varchar("style", { length: 50 }),
  status: articleGenerationHistoryStatusEnum("status").default("pending").notNull(),
  generatedTitle: text("generatedTitle"),
  generatedContent: text("generatedContent"),
  generatedExcerpt: text("generatedExcerpt"),
  generatedSlug: varchar("generatedSlug", { length: 255 }),
  postId: integer("postId"),
  errorMessage: text("errorMessage"),
  processingTimeMs: integer("processingTimeMs"),
  tokensUsed: integer("tokensUsed"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const priceUpdateSchedule = pgTable("priceUpdateSchedule", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  snkrdunkEnabled: boolean("snkrdunkEnabled").default(false).notNull(),
  snkrdunkUpdateTime: varchar("snkrdunkUpdateTime", { length: 8 }).default("02:00").notNull(),
  snkrdunkUpdateTime2: varchar("snkrdunkUpdateTime2", { length: 8 }),
  snkrdunkLastExecutedAt: timestamp("snkrdunkLastExecutedAt", { withTimezone: true }),
  snkrdunkLastCatchupAt: timestamp("snkrdunkLastCatchupAt", { withTimezone: true }),
  snkrdunkUpdateMode: varchar("snkrdunkUpdateMode", { length: 32 }).default("github_actions").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Hong_Kong").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const scheduleConfig = pgTable("scheduleConfig", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  scheduleType: varchar("scheduleType", { length: 64 }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Hong_Kong").notNull(),
  description: text("description"),
  lastExecutedAt: timestamp("lastExecutedAt", { withTimezone: true }),
  nextExecutionAt: timestamp("nextExecutionAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const trendingCardsCache = pgTable("trendingCardsCache", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  rank: integer("rank").notNull(),
  priceChange7d: decimal("priceChange7d", { precision: 10, scale: 2 }).notNull(),
  oldPrice: decimal("oldPrice", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(),
  calculatedAt: timestamp("calculatedAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  cardIdIdx: index("tcc_cardId_idx").on(table.cardId),
}));

export const notifications = pgTable("notifications", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  body: text("body"),
  linkUrl: text("linkUrl"),
  relatedId: integer("relatedId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("userId_idx").on(table.userId),
    isReadIdx: index("isRead_idx").on(table.isRead),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  };
});

export const scheduleExecutionHistory = pgTable("scheduleExecutionHistory", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  scheduleType: varchar("scheduleType", { length: 50 }).notNull(),
  executionType: scheduleExecutionHistoryExecutionTypeEnum("executionType").notNull(),
  status: scheduleExecutionHistoryStatusEnum("status").notNull(),
  startedAt: timestamp("startedAt", { withTimezone: true }).notNull(),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  durationMs: integer("durationMs"),
  snkrdunkSuccessCount: integer("snkrdunkSuccessCount").default(0),
  snkrdunkFailureCount: integer("snkrdunkFailureCount").default(0),
  snkrdunkRecordsAdded: integer("snkrdunkRecordsAdded").default(0),
  errorMessage: text("errorMessage"),
}, (table) => {
  return {
    scheduleTypeIdx: index("scheduleType_idx").on(table.scheduleType),
    startedAtIdx: index("startedAt_idx").on(table.startedAt),
  };
});

export const postShares = pgTable("postShares", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  postId: integer("postId").notNull(),
  shareType: postSharesShareTypeEnum("shareType").notNull(),
  sharedAt: timestamp("sharedAt", { withTimezone: true }).defaultNow().notNull(),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
}, (table) => {
  return {
    postIdIdx: index("postId_idx").on(table.postId),
    shareTypeIdx: index("shareType_idx").on(table.shareType),
    sharedAtIdx: index("sharedAt_idx").on(table.sharedAt),
  };
});

export const trendingRankingsCache = pgTable("trendingRankingsCache", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  rankingType: trendingRankingsCacheRankingTypeEnum("rankingType").notNull(),
  timeRange: integer("timeRange").notNull(),
  rankingData: text("rankingData").notNull(),
  calculatedAt: timestamp("calculatedAt", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    rankingTypeTimeRangeIdx: index("rankingType_timeRange_idx").on(table.rankingType, table.timeRange),
    calculatedAtIdx: index("calculatedAt_idx").on(table.calculatedAt),
  };
});

export const sellerProfiles = pgTable("sellerProfiles", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  stripeConnectId: varchar("stripeConnectId", { length: 100 }),
  stripeConnectStatus: sellerProfilesStripeConnectStatusEnum("stripeConnectStatus").default("pending").notNull(),
  stripeOnboardingUrl: text("stripeOnboardingUrl"),
  totalSales: integer("totalSales").default(0).notNull(),
  avgRating: decimal("avgRating", { precision: 3, scale: 2 }).default("0.00"),
  ratingCount: integer("ratingCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isSuspended: boolean("isSuspended").default(false).notNull(),
  suspensionReason: text("suspensionReason"),
  rejectReason: text("rejectReason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("sp_userId_idx").on(table.userId),
}));

export const marketplaceListings = pgTable("marketplaceListings", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  sellerType: marketplaceListingsSellerTypeEnum("sellerType").notNull(),
  sellerId: integer("sellerId"),
  cardId: integer("cardId"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  condition: marketplaceListingsConditionEnum("condition").notNull().default("raw_a"),
  language: varchar("language", { length: 20 }),
  tcgSeries: marketplaceListingsTcgSeriesEnum("tcgSeries").default("pokemon").notNull(),
  priceHkd: decimal("priceHkd", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  remainingQuantity: integer("remainingQuantity").default(1).notNull(),
  images: text("images"),
  status: marketplaceListingsStatusEnum("status").default("draft").notNull(),
  rejectedReason: text("rejectedReason"),
  adminDelisted: boolean("adminDelisted").default(false).notNull(),
  allowOffers: boolean("allowOffers").default(false).notNull(),
  minOfferHkd: decimal("minOfferHkd", { precision: 10, scale: 2 }),
  listingMode: marketplaceListingsListingModeEnum("listingMode").default("buy_now").notNull(),
  auctionStartAt: timestamp("auctionStartAt", { withTimezone: true }),
  auctionEndAt: timestamp("auctionEndAt", { withTimezone: true }),
  startingBid: decimal("startingBid", { precision: 10, scale: 2 }),
  reservePrice: decimal("reservePrice", { precision: 10, scale: 2 }),
  buyNowPrice: decimal("buyNowPrice", { precision: 10, scale: 2 }),
  bidIncrement: decimal("bidIncrement", { precision: 10, scale: 2 }).default("5.00"),
  currentHighestBid: decimal("currentHighestBid", { precision: 10, scale: 2 }),
  currentHighestBidderId: integer("currentHighestBidderId"),
  bidCount: integer("bidCount").default(0).notNull(),
  auctionStatus: marketplaceListingsAuctionStatusEnum("auctionStatus"),
  antiSnipingMinutes: integer("antiSnipingMinutes").default(5).notNull(),
  antiSnipingExtensions: integer("antiSnipingExtensions").default(0).notNull(),
  hasReserveMet: boolean("hasReserveMet").default(false).notNull(),
  winnerId: integer("winnerId"),
  winningBidId: integer("winningBidId"),
  auctionTermsVersion: varchar("auctionTermsVersion", { length: 20 }),
  isHighValueReview: boolean("isHighValueReview").default(false).notNull(),
  auctionPaymentSessionId: varchar("auctionPaymentSessionId", { length: 200 }),
  auctionPaymentStatus: marketplaceListingsAuctionPaymentStatusEnum("auctionPaymentStatus"),
  auctionPaymentPaidAt: timestamp("auctionPaymentPaidAt", { withTimezone: true }),
  auctionOrderId: integer("auctionOrderId"),
  viewCount: integer("viewCount").default(0).notNull(),
  listedAt: timestamp("listedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sellerTypeIdx: index("ml_sellerType_idx").on(table.sellerType),
  sellerIdIdx: index("ml_sellerId_idx").on(table.sellerId),
  statusIdx: index("ml_status_idx").on(table.status),
  cardIdIdx: index("ml_cardId_idx").on(table.cardId),
  listingModeIdx: index("ml_listingMode_idx").on(table.listingMode),
  auctionStatusIdx: index("ml_auctionStatus_idx").on(table.auctionStatus),
  auctionEndAtIdx: index("ml_auctionEndAt_idx").on(table.auctionEndAt),
  // Composite index for homepage/marketplace listing queries: status + listingMode + createdAt
  statusListingModeCreatedAtIdx: index("ml_status_listingMode_createdAt_idx").on(table.status, table.listingMode, table.createdAt),
  // Composite index for tcgSeries filter queries
  statusTcgSeriesCreatedAtIdx: index("ml_status_tcgSeries_createdAt_idx").on(table.status, table.tcgSeries, table.createdAt),
}));

export const marketplaceOrders = pgTable("marketplaceOrders", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderNo: varchar("orderNo", { length: 50 }).notNull(),
  buyerId: integer("buyerId").notNull(),
  listingId: integer("listingId").notNull(),
  sellerId: integer("sellerId"),
  sellerType: marketplaceOrdersSellerTypeEnum("sellerType").default("platform").notNull(),
  unitPriceHkd: decimal("unitPriceHkd", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  subtotalHkd: decimal("subtotalHkd", { precision: 10, scale: 2 }).notNull(),
  platformFeeRate: decimal("platformFeeRate", { precision: 5, scale: 4 }).default("0.0500").notNull(),
  platformFeeHkd: decimal("platformFeeHkd", { precision: 10, scale: 2 }).default("0.00").notNull(),
  sellerReceivableHkd: decimal("sellerReceivableHkd", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: marketplaceOrdersPaymentMethodEnum("paymentMethod").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 200 }),
  stripeChargeId: varchar("stripeChargeId", { length: 200 }),
  stripeTransferId: varchar("stripeTransferId", { length: 200 }),
  alipayProofImageUrl: text("alipayProofImageUrl"),
  alipayProofSubmittedAt: timestamp("alipayProofSubmittedAt", { withTimezone: true }),
  alipayReviewReminderSentAt: timestamp("alipayReviewReminderSentAt", { withTimezone: true }),
  alipayProofStatus: marketplaceOrdersAlipayProofStatusEnum("alipayProofStatus"),
  aiVerificationResult: text("aiVerificationResult"),
  paymentStatus: marketplaceOrdersPaymentStatusEnum("paymentStatus").default("pending").notNull(),
  paidAt: timestamp("paidAt", { withTimezone: true }),
  orderStatus: marketplaceOrdersOrderStatusEnum("orderStatus").default("pending_payment").notNull(),
  shippingName: varchar("shippingName", { length: 100 }),
  shippingPhone: varchar("shippingPhone", { length: 30 }),
  buyerPhone: varchar("buyerPhone", { length: 30 }),
  shippingAddress: text("shippingAddress"),
  shippingMethod: marketplaceOrdersShippingMethodEnum("shippingMethod"),
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  shippedAt: timestamp("shippedAt", { withTimezone: true }),
  autoCompleteAt: timestamp("autoCompleteAt", { withTimezone: true }),
  buyerConfirmedAt: timestamp("buyerConfirmedAt", { withTimezone: true }),
  payoutHoldUntil: timestamp("payoutHoldUntil", { withTimezone: true }),
  disputeOpenedAt: timestamp("disputeOpenedAt", { withTimezone: true }),
  disputeReason: text("disputeReason"),
  disputeEvidenceUrls: text("disputeEvidenceUrls"),
  disputeResolvedAt: timestamp("disputeResolvedAt", { withTimezone: true }),
  disputeResolution: text("disputeResolution"),
  disputeResolutionHistory: text("disputeResolutionHistory"),
  disputePriority: marketplaceOrdersDisputePriorityEnum("disputePriority").default("medium"),
  disputeDeadlineAt: timestamp("disputeDeadlineAt", { withTimezone: true }),
  shippingImageUrl: text("shippingImageUrl"),
  shippingReminderSentAt: timestamp("shippingReminderSentAt", { withTimezone: true }),
  paymentReminderSentAt: timestamp("paymentReminderSentAt", { withTimezone: true }),
  confirmReceiptReminderSentAt: timestamp("confirmReceiptReminderSentAt", { withTimezone: true }),
  payoutStatus: marketplaceOrdersPayoutStatusEnum("payoutStatus").default("pending").notNull(),
  stripeTransferError: text("stripeTransferError"),
  manualPayoutAt: timestamp("manualPayoutAt", { withTimezone: true }),
  manualPayoutNote: varchar("manualPayoutNote", { length: 500 }),
  manualPayoutProofUrl: text("manualPayoutProofUrl"),
  adminNote: text("adminNote"),
  paymentRejectionReason: text("paymentRejectionReason"),
  alipayRefundStatus: marketplaceOrdersAlipayRefundStatusEnum("alipayRefundStatus").default("not_applicable"),
  alipayRefundAmount: decimal("alipayRefundAmount", { precision: 10, scale: 2 }),
  alipayRefundRequestedAt: timestamp("alipayRefundRequestedAt", { withTimezone: true }),
  alipayRefundCompletedAt: timestamp("alipayRefundCompletedAt", { withTimezone: true }),
  alipayRefundNote: text("alipayRefundNote"),
  alipayRefundProofUrl: text("alipayRefundProofUrl"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 200 }),
  batchRef: varchar("batchRef", { length: 100 }),
  cartOrderId: integer("cartOrderId"),
  orderSource: marketplaceOrdersOrderSourceEnum("orderSource").default("direct").notNull(),
  auctionListingId: integer("auctionListingId"),
  auctionWinningBidId: integer("auctionWinningBidId"),
}, (table) => ({
  orderNoIdx: index("mo_orderNo_idx").on(table.orderNo),
  buyerIdIdx: index("mo_buyerId_idx").on(table.buyerId),
  orderStatusIdx: index("mo_orderStatus_idx").on(table.orderStatus),
  paymentStatusIdx: index("mo_paymentStatus_idx").on(table.paymentStatus),
  // Composite indexes for buyer/seller order queries with date ordering
  buyerIdCreatedAtIdx: index("mo_buyerId_createdAt_idx").on(table.buyerId, table.createdAt),
  sellerIdCreatedAtIdx: index("mo_sellerId_createdAt_idx").on(table.sellerId, table.createdAt),
  sellerIdStatusCreatedAtIdx: index("mo_sellerId_status_createdAt_idx").on(table.sellerId, table.orderStatus, table.createdAt),
  listingIdIdx: index("mo_listingId_idx").on(table.listingId),
  // P0-3 Fix: Prevent duplicate auction orders (race condition protection)
  // Each auction listing can only have one order
  auctionListingUniqueIdx: uniqueIndex("mo_unique_auction_listing").on(table.auctionListingId),
}));

export const cartOrders = pgTable("cartOrders", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  buyerId: integer("buyerId").notNull(),
  totalSubtotalHkd: decimal("totalSubtotalHkd", { precision: 10, scale: 2 }).notNull(),
  totalPlatformFeeHkd: decimal("totalPlatformFeeHkd", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalSellerReceivableHkd: decimal("totalSellerReceivableHkd", { precision: 10, scale: 2 }).notNull(),
  hasSellerItems: boolean("hasSellerItems").default(false).notNull(),
  availablePaymentMethods: varchar("availablePaymentMethods", { length: 50 }).notNull().default("stripe,alipay_hk"),
  paymentRestrictionReason: text("paymentRestrictionReason"),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 200 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 200 }),
  stripeChargeId: varchar("stripeChargeId", { length: 200 }),
  paymentStatus: cartOrdersPaymentStatusEnum("paymentStatus").default("pending").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  buyerIdIdx: index("co_buyerId_idx").on(table.buyerId),
  stripeSessionIdx: index("co_stripeSession_idx").on(table.stripeCheckoutSessionId),
  paymentStatusIdx: index("co_paymentStatus_idx").on(table.paymentStatus),
}));

export const marketplaceOrderItems = pgTable("marketplaceOrderItems", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderId: integer("orderId").notNull(),
  listingId: integer("listingId").notNull(),
  sellerId: integer("sellerId"),
  sellerType: marketplaceOrderItemsSellerTypeEnum("sellerType").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  payoutStatus: marketplaceOrderItemsPayoutStatusEnum("payoutStatus").default("pending").notNull(),
  stripeTransferId: varchar("stripeTransferId", { length: 200 }),
  paidOutAt: timestamp("paidOutAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("moi_orderId_idx").on(table.orderId),
  listingIdIdx: index("moi_listingId_idx").on(table.listingId),
  sellerIdIdx: index("moi_sellerId_idx").on(table.sellerId),
}));

export const marketplacePayouts = pgTable("marketplacePayouts", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderId: integer("orderId").notNull(),
  sellerId: integer("sellerId").notNull(),
  amountHkd: decimal("amountHkd", { precision: 10, scale: 2 }).notNull(),
  stripeTransferId: varchar("stripeTransferId", { length: 200 }),
  status: marketplacePayoutsStatusEnum("status").default("pending").notNull(),
  failureReason: text("failureReason"),
  retryCount: integer("retryCount").default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sellerIdIdx: index("mp_sellerId_idx").on(table.sellerId),
  statusIdx: index("mp_status_idx").on(table.status),
}));

export const marketplaceBanners = pgTable("marketplaceBanners", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: varchar("subtitle", { length: 300 }).default("").notNull(),
  cta: varchar("cta", { length: 100 }).default("立即選購").notNull(),
  ctaConditions: varchar("ctaConditions", { length: 500 }).default("[]").notNull(),
  ctaSellerType: varchar("ctaSellerType", { length: 20 }).default("all").notNull(),
  gradient: varchar("gradient", { length: 200 }).default("from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]").notNull(),
  accentColor: varchar("accentColor", { length: 20 }).default("#FFD700").notNull(),
  badge: varchar("badge", { length: 50 }).default("").notNull(),
  badgeClass: varchar("badgeClass", { length: 100 }).default("bg-yellow-400 text-[#06038d]").notNull(),
  emoji: varchar("emoji", { length: 10 }).default("🏆").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }).default("").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  isActiveIdx: index("mb_isActive_idx").on(table.isActive),
  sortOrderIdx: index("mb_sortOrder_idx").on(table.sortOrder),
}));

export const wishlists = pgTable("wishlists", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  listingId: integer("listingId").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("wl_userId_idx").on(table.userId),
  listingIdIdx: index("wl_listingId_idx").on(table.listingId),
  uniqueUserListing: index("wl_unique_user_listing").on(table.userId, table.listingId),
}));

export const marketplaceReviews = pgTable("marketplaceReviews", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderId: integer("orderId").notNull(),
  listingId: integer("listingId").notNull(),
  buyerId: integer("buyerId").notNull(),
  sellerId: integer("sellerId").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isAnonymous: boolean("isAnonymous").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("mr_orderId_idx").on(table.orderId),
  sellerIdIdx: index("mr_sellerId_idx").on(table.sellerId),
  buyerIdIdx: index("mr_buyerId_idx").on(table.buyerId),
  uniqueOrderReview: uniqueIndex("mr_unique_order").on(table.orderId),
}));

export const userShippingAddresses = pgTable("userShippingAddresses", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  label: varchar("label", { length: 50 }).default("預設地址").notNull(),
  addressType: userShippingAddressesAddressTypeEnum("addressType").default("normal").notNull(),
  recipientName: varchar("recipientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  district: varchar("district", { length: 50 }),
  region: varchar("region", { length: 50 }).default("香港").notNull(),
  sfStationCode: varchar("sfStationCode", { length: 20 }),
  sfStationName: varchar("sfStationName", { length: 100 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("usa_userId_idx").on(table.userId),
}));

export const offers = pgTable("offers", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  listingId: integer("listingId").notNull(),
  buyerId: integer("buyerId").notNull(),
  sellerId: integer("sellerId").notNull(),
  sellerProfileId: integer("sellerProfileId").notNull(),
  offerPriceHkd: decimal("offerPriceHkd", { precision: 10, scale: 2 }).notNull(),
  message: text("message"),
  status: offersStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  respondedAt: timestamp("respondedAt", { withTimezone: true }),
  rejectionReason: text("rejectionReason"),
  orderId: integer("orderId"),
  expiryReminderSentAt: timestamp("expiryReminderSentAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  listingIdIdx: index("offer_listingId_idx").on(table.listingId),
  buyerIdIdx: index("offer_buyerId_idx").on(table.buyerId),
  sellerIdIdx: index("offer_sellerId_idx").on(table.sellerId),
  statusIdx: index("offer_status_idx").on(table.status),
}));

export const listingReports = pgTable("listingReports", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  listingId: integer("listingId").notNull(),
  reporterId: integer("reporterId").notNull(),
  reason: listingReportsReasonEnum("reason").notNull(),
  details: text("details"),
  status: listingReportsStatusEnum("status").default("pending").notNull(),
  adminNote: text("adminNote"),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  listingIdIdx: index("lr_listingId_idx").on(table.listingId),
  reporterIdIdx: index("lr_reporterId_idx").on(table.reporterId),
  statusIdx: index("lr_status_idx").on(table.status),
}));

export const orderStatusHistory = pgTable("orderStatusHistory", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderId: integer("orderId").notNull(),
  fromStatus: varchar("fromStatus", { length: 50 }),
  toStatus: varchar("toStatus", { length: 50 }).notNull(),
  operatorId: integer("operatorId"),
  operatorName: varchar("operatorName", { length: 100 }),
  note: varchar("note", { length: 500 }),
  entryType: varchar("entryType", { length: 20 }).default('status_change').notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("osh_orderId_idx").on(table.orderId),
  createdAtIdx: index("osh_createdAt_idx").on(table.createdAt),
}));

export const marketplaceSearchLogs = pgTable("marketplaceSearchLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  keyword: varchar("keyword", { length: 200 }).notNull(),
  tcgSeries: varchar("tcgSeries", { length: 50 }),
  userId: integer("userId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  keywordIdx: index("msl_keyword_idx").on(table.keyword),
  createdAtIdx: index("msl_createdAt_idx").on(table.createdAt),
}));

export const cartItems = pgTable("cartItems", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  listingId: integer("listingId").notNull(),
  addedAt: timestamp("addedAt", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
}, (table) => ({
  userIdIdx: index("cart_userId_idx").on(table.userId),
  listingIdIdx: index("cart_listingId_idx").on(table.listingId),
  uniqueUserListing: uniqueIndex("cart_user_listing_unique").on(table.userId, table.listingId),
}));

export const emailUnsubscribes = pgTable("emailUnsubscribes", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  emailType: varchar("emailType", { length: 64 }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  unsubscribedAt: timestamp("unsubscribedAt", { withTimezone: true }).defaultNow().notNull(),
  resubscribedAt: timestamp("resubscribedAt", { withTimezone: true }),
}, (table) => ({
  userIdIdx: index("eu_userId_idx").on(table.userId),
  emailIdx: index("eu_email_idx").on(table.email),
  tokenIdx: uniqueIndex("eu_token_idx").on(table.token),
}));

export const emailLogs = pgTable("emailLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  toEmail: varchar("toEmail", { length: 255 }).notNull(),
  toUserId: integer("toUserId"),
  subject: varchar("subject", { length: 500 }).notNull(),
  emailType: varchar("emailType", { length: 64 }).notNull(),
  status: emailLogsStatusEnum("status").notNull().default("sent"),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt", { withTimezone: true }).defaultNow().notNull(),
  dedupeKey: varchar("dedupeKey", { length: 200 }),
}, (table) => ({
  toEmailIdx: index("el_toEmail_idx").on(table.toEmail),
  toUserIdIdx: index("el_toUserId_idx").on(table.toUserId),
  emailTypeIdx: index("el_emailType_idx").on(table.emailType),
  statusIdx: index("el_status_idx").on(table.status),
  sentAtIdx: index("el_sentAt_idx").on(table.sentAt),
  dedupeKeyIdx: index("el_dedupeKey_idx").on(table.dedupeKey),
}));

export const adminAuditLogs = pgTable("adminAuditLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  adminId: integer("adminId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 50 }).notNull(),
  targetId: integer("targetId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  adminIdIdx: index("aal_adminId_idx").on(table.adminId),
  actionIdx: index("aal_action_idx").on(table.action),
  targetIdx: index("aal_target_idx").on(table.targetType, table.targetId),
  createdAtIdx: index("aal_createdAt_idx").on(table.createdAt),
}));

export const marketplaceWhitelist = pgTable("marketplaceWhitelist", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  addedBy: integer("addedBy").notNull(),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex("mw_userId_idx").on(table.userId),
}));

export const orderMessages = pgTable("orderMessages", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderId: integer("orderId").notNull(),
  orderNo: varchar("orderNo", { length: 64 }).notNull(),
  senderId: integer("senderId").notNull(),
  senderRole: orderMessagesSenderRoleEnum("senderRole").notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  isSystemMessage: boolean("isSystemMessage").default(false).notNull(),
  readByBuyer: boolean("readByBuyer").default(false).notNull(),
  readBySeller: boolean("readBySeller").default(false).notNull(),
  readByAdmin: boolean("readByAdmin").default(false).notNull(),
  readAtBuyer: timestamp("readAtBuyer", { withTimezone: true }),
  readAtSeller: timestamp("readAtSeller", { withTimezone: true }),
  readAtAdmin: timestamp("readAtAdmin", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("om_orderId_idx").on(table.orderId),
  orderNoIdx: index("om_orderNo_idx").on(table.orderNo),
  senderIdx: index("om_senderId_idx").on(table.senderId),
  createdAtIdx: index("om_createdAt_idx").on(table.createdAt),
}));

export const disputeMedia = pgTable("disputeMedia", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderId: integer("orderId").notNull(),
  orderNo: varchar("orderNo", { length: 64 }).notNull(),
  uploaderId: integer("uploaderId").notNull(),
  uploaderRole: disputeMediaUploaderRoleEnum("uploaderRole").notNull(),
  mediaUrl: text("mediaUrl").notNull(),
  mediaType: disputeMediaMediaTypeEnum("mediaType").default("image").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: integer("fileSize"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("dm_orderId_idx").on(table.orderId),
  orderNoIdx: index("dm_orderNo_idx").on(table.orderNo),
  uploaderIdx: index("dm_uploaderId_idx").on(table.uploaderId),
}));

export const auctionBids = pgTable("auctionBids", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  listingId: integer("listingId").notNull(),
  bidderId: integer("bidderId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: auctionBidsStatusEnum("status").default("active").notNull(),
  ipHash: varchar("ipHash", { length: 64 }),
  userAgent: text("userAgent"),
  depositAmountHkd: decimal("depositAmountHkd", { precision: 10, scale: 2 }),
  depositPaymentIntentId: varchar("depositPaymentIntentId", { length: 200 }),
  depositStatus: auctionBidsDepositStatusEnum("depositStatus").default("none").notNull(),
  depositHeldAt: timestamp("depositHeldAt", { withTimezone: true }),
  depositReleasedAt: timestamp("depositReleasedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  listingIdIdx: index("ab_listingId_idx").on(table.listingId),
  bidderIdIdx: index("ab_bidderId_idx").on(table.bidderId),
  statusIdx: index("ab_status_idx").on(table.status),
}));

export const auctionAgreements = pgTable("auctionAgreements", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  role: auctionAgreementsRoleEnum("role").notNull(),
  termsVersion: varchar("termsVersion", { length: 20 }).notNull(),
  agreedAt: timestamp("agreedAt", { withTimezone: true }).defaultNow().notNull(),
  ipHash: varchar("ipHash", { length: 64 }),
}, (table) => ({
  userIdIdx: index("aa_userId_idx").on(table.userId),
  userRoleVersionIdx: uniqueIndex("aa_user_role_version_idx").on(table.userId, table.role, table.termsVersion),
}));

export const auctionViolations = pgTable("auctionViolations", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  type: auctionViolationsTypeEnum("type").notNull(),
  listingId: integer("listingId"),
  orderId: integer("orderId"),
  penalty: auctionViolationsPenaltyEnum("penalty").notNull(),
  banExpiresAt: timestamp("banExpiresAt", { withTimezone: true }),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("av_userId_idx").on(table.userId),
  typeIdx: index("av_type_idx").on(table.type),
}));

export const listingModerationLogs = pgTable("listingModerationLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  listingId: integer("listingId").notNull(),
  listingMode: listingModerationLogsListingModeEnum("listingMode").notNull().default("direct"),
  adminId: integer("adminId").notNull(),
  adminName: varchar("adminName", { length: 100 }),
  action: listingModerationLogsActionEnum("action").notNull(),
  reason: text("reason"),
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  listingIdIdx: index("lml_listingId_idx").on(table.listingId),
  adminIdIdx: index("lml_adminId_idx").on(table.adminId),
  createdAtIdx: index("lml_createdAt_idx").on(table.createdAt),
}));

export const platformRules = pgTable("platformRules", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  category: platformRulesCategoryEnum("category").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("pr_category_idx").on(table.category),
  isActiveIdx: index("pr_isActive_idx").on(table.isActive),
}));

export const productCategories = pgTable("productCategories", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  parentId: integer("parentId"),
  tcgSeries: varchar("tcgSeries", { length: 50 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex("pc_slug_idx").on(table.slug),
  isActiveIdx: index("pc_isActive_idx").on(table.isActive),
}));

export const sellerRiskProfiles = pgTable("sellerRiskProfiles", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  sellerId: integer("sellerId").notNull(),
  riskLevel: sellerRiskProfilesRiskLevelEnum("riskLevel").default("low").notNull(),
  totalListings: integer("totalListings").default(0).notNull(),
  delistedCount: integer("delistedCount").default(0).notNull(),
  reportCount: integer("reportCount").default(0).notNull(),
  disputeCount: integer("disputeCount").default(0).notNull(),
  lastReviewAt: timestamp("lastReviewAt", { withTimezone: true }),
  adminNote: text("adminNote"),
  isWatched: boolean("isWatched").default(false).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sellerIdIdx: uniqueIndex("srp_sellerId_idx").on(table.sellerId),
  riskLevelIdx: index("srp_riskLevel_idx").on(table.riskLevel),
  isWatchedIdx: index("srp_isWatched_idx").on(table.isWatched),
}));

export const securityEvents = pgTable("securityEvents", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  type: securityEventsTypeEnum("type").notNull(),
  ip: varchar("ip", { length: 45 }).notNull(),
  userAgent: text("userAgent"),
  path: varchar("path", { length: 500 }),
  reason: varchar("reason", { length: 500 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ipIdx: index("se_ip_idx").on(table.ip),
  typeIdx: index("se_type_idx").on(table.type),
  createdAtIdx: index("se_createdAt_idx").on(table.createdAt),
}));

export const blockedIps = pgTable("blockedIps", {
  ip: varchar("ip", { length: 45 }).primaryKey(),
  reason: varchar("reason", { length: 500 }).notNull(),
  blockedBy: varchar("blockedBy", { length: 100 }).default("admin").notNull(),
  blockedAt: timestamp("blockedAt", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }),
  isActive: boolean("isActive").default(true).notNull(),
}, (table) => ({
  isActiveIdx: index("bi_isActive_idx").on(table.isActive),
}));

export const adminIpWhitelist = pgTable("adminIpWhitelist", {
  ip: varchar("ip", { length: 45 }).primaryKey(),
  addedBy: varchar("addedBy", { length: 100 }).default("admin").notNull(),
  note: varchar("note", { length: 200 }),
  addedAt: timestamp("addedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const gradingServiceTiers = pgTable("gradingServiceTiers", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  feeHkd: decimal("feeHkd", { precision: 10, scale: 2 }).notNull(),
  maxDeclaredValueUsd: decimal("maxDeclaredValueUsd", { precision: 10, scale: 2 }).notNull(),
  estimatedDaysMin: integer("estimatedDaysMin").notNull(),
  estimatedDaysMax: integer("estimatedDaysMax").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  isActiveIdx: index("gst_isActive_idx").on(table.isActive),
  sortOrderIdx: index("gst_sortOrder_idx").on(table.sortOrder),
}));

export const gradingBatches = pgTable("gradingBatches", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  batchName: varchar("batchName", { length: 128 }).notNull(),
  cutoffDate: timestamp("cutoffDate", { withTimezone: true }).notNull(),
  shippedDate: timestamp("shippedDate", { withTimezone: true }),
  expectedReturnDate: timestamp("expectedReturnDate", { withTimezone: true }),
  status: gradingBatchesStatusEnum("status").default("open").notNull(),
  batchCostHkd: decimal("batchCostHkd", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  statusIdx: index("gb_status_idx").on(table.status),
  cutoffDateIdx: index("gb_cutoffDate_idx").on(table.cutoffDate),
}));

export const gradingSubmissions = pgTable("gradingSubmissions", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderNo: varchar("orderNo", { length: 32 }).notNull().unique(),
  userId: integer("userId").notNull(),
  status: gradingSubmissionsStatusEnum("status").default("awaiting_payment").notNull(),
  totalFeeHkd: decimal("totalFeeHkd", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: gradingSubmissionsPaymentMethodEnum("paymentMethod"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  batchId: integer("batchId"),
  shippingDeadline: timestamp("shippingDeadline", { withTimezone: true }),
  paymentDeadline: timestamp("paymentDeadline", { withTimezone: true }),
  gradedAt: timestamp("gradedAt", { withTimezone: true }),
  adminNotes: text("adminNotes"),
  adminNotesHistory: text("adminNotesHistory"),
  returnTrackingNo: varchar("returnTrackingNo", { length: 128 }),
  paymentDueAt: timestamp("paymentDueAt", { withTimezone: true }),
  day15ReminderSentAt: timestamp("day15ReminderSentAt", { withTimezone: true }),
  day25ReminderSentAt: timestamp("day25ReminderSentAt", { withTimezone: true }),
  alipayProofImageUrl: text("alipayProofImageUrl"),
  alipayProofStatus: gradingSubmissionsAlipayProofStatusEnum("alipayProofStatus"),
  alipayProofSubmittedAt: timestamp("alipayProofSubmittedAt", { withTimezone: true }),
  alipayProofRejectionReason: text("alipayProofRejectionReason"),
  alipayProofAiResult: gradingSubmissionsAlipayProofAiResultEnum("alipayProofAiResult"),
  alipayProofAiConfidence: gradingSubmissionsAlipayProofAiConfidenceEnum("alipayProofAiConfidence"),
  alipayProofAiSummary: text("alipayProofAiSummary"),
  alipayProofAiCheckedAt: timestamp("alipayProofAiCheckedAt", { withTimezone: true }),
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  trackingSubmittedAt: timestamp("trackingSubmittedAt", { withTimezone: true }),
  paidAt: timestamp("paidAt", { withTimezone: true }),
  upgradeCheckoutSessionId: varchar("upgradeCheckoutSessionId", { length: 128 }),
  upgradeDiffFeeHkd: decimal("upgradeDiffFeeHkd", { precision: 10, scale: 2 }),
  upgradeNewTierId: integer("upgradeNewTierId"),
  upgradeItemIds: varchar("upgradeItemIds", { length: 512 }),
  upgradeCheckoutAt: timestamp("upgradeCheckoutAt", { withTimezone: true }),
  upgradePaidAt: timestamp("upgradePaidAt", { withTimezone: true }),
  upgradeReminderSentAt: timestamp("upgradeReminderSentAt", { withTimezone: true }),
  returnAddress: text("returnAddress"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userIdIdx: index("gs_userId_idx").on(table.userId),
  statusIdx: index("gs_status_idx").on(table.status),
  orderNoIdx: index("gs_orderNo_idx").on(table.orderNo),
  batchIdIdx: index("gs_batchId_idx").on(table.batchId),
}));

export const gradingSubmissionItems = pgTable("gradingSubmissionItems", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  submissionId: integer("submissionId").notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  cardSet: varchar("cardSet", { length: 256 }),
  cardNumber: varchar("cardNumber", { length: 64 }),
  cardLanguage: gradingSubmissionItemsCardLanguageEnum("cardLanguage").default("en").notNull(),
  cardImageUrl: text("cardImageUrl"),
  tierId: integer("tierId").notNull(),
  feeHkd: decimal("feeHkd", { precision: 10, scale: 2 }).notNull(),
  condition: gradingSubmissionItemsConditionEnum("condition").default("near_mint").notNull(),
  notes: text("notes"),
  psaCertNumber: varchar("psaCertNumber", { length: 64 }),
  psaGrade: varchar("psaGrade", { length: 16 }),
  itemStatus: gradingSubmissionItemsItemStatusEnum("itemStatus").default("pending").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  submissionIdIdx: index("gsi_submissionId_idx").on(table.submissionId),
  tierIdIdx: index("gsi_tierId_idx").on(table.tierId),
}));

export const gradingReviews = pgTable("gradingReviews", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  submissionId: integer("submissionId").notNull().unique(),
  userId: integer("userId").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  submissionIdIdx: index("gr_submissionId_idx").on(table.submissionId),
  userIdIdx: index("gr_userId_idx").on(table.userId),
}));

export const cardInventory = pgTable("cardInventory", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  itemType: cardInventoryItemTypeEnum("itemType").default("card").notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardSet: varchar("cardSet", { length: 256 }),
  cardNumber: varchar("cardNumber", { length: 64 }),
  grade: varchar("grade", { length: 32 }),
  buyPriceCurrency: cardInventoryBuyPriceCurrencyEnum("buyPriceCurrency").default("HKD").notNull(),
  buyPriceOriginal: decimal("buyPriceOriginal", { precision: 12, scale: 2 }).notNull(),
  buyPriceHkd: decimal("buyPriceHkd", { precision: 12, scale: 2 }).notNull(),
  buyExchangeRate: decimal("buyExchangeRate", { precision: 10, scale: 4 }).default("1.0000"),
  buyDate: timestamp("buyDate", { withTimezone: true }).notNull(),
  buySource: varchar("buySource", { length: 256 }),
  status: cardInventoryStatusEnum("status").default("holding").notNull(),
  sellPriceCurrency: cardInventorySellPriceCurrencyEnum("sellPriceCurrency").default("HKD"),
  sellPriceOriginal: decimal("sellPriceOriginal", { precision: 12, scale: 2 }),
  sellPriceHkd: decimal("sellPriceHkd", { precision: 12, scale: 2 }),
  sellExchangeRate: decimal("sellExchangeRate", { precision: 10, scale: 4 }),
  sellDate: timestamp("sellDate", { withTimezone: true }),
  sellChannel: varchar("sellChannel", { length: 256 }),
  imageUrl: text("imageUrl"),
  s3ImageUrl: text("s3ImageUrl"),
  linkedCardId: integer("linkedCardId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  statusIdx: index("ci_status_idx").on(table.status),
  buyDateIdx: index("ci_buyDate_idx").on(table.buyDate),
  itemTypeIdx: index("ci_itemType_idx").on(table.itemType),
}));

export const companyCardInventory = pgTable("companyCardInventory", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  itemType: companyCardInventoryItemTypeEnum("itemType").default("card").notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardSet: varchar("cardSet", { length: 256 }),
  cardNumber: varchar("cardNumber", { length: 64 }),
  grade: varchar("grade", { length: 32 }),
  buyPriceCurrency: companyCardInventoryBuyPriceCurrencyEnum("buyPriceCurrency").default("HKD").notNull(),
  buyPriceOriginal: decimal("buyPriceOriginal", { precision: 12, scale: 2 }).notNull(),
  buyPriceHkd: decimal("buyPriceHkd", { precision: 12, scale: 2 }).notNull(),
  buyExchangeRate: decimal("buyExchangeRate", { precision: 10, scale: 4 }).default("1.0000"),
  buyDate: timestamp("buyDate", { withTimezone: true }).notNull(),
  buySource: varchar("buySource", { length: 256 }),
  status: companyCardInventoryStatusEnum("status").default("holding").notNull(),
  sellPriceCurrency: companyCardInventorySellPriceCurrencyEnum("sellPriceCurrency").default("HKD"),
  sellPriceOriginal: decimal("sellPriceOriginal", { precision: 12, scale: 2 }),
  sellPriceHkd: decimal("sellPriceHkd", { precision: 12, scale: 2 }),
  sellExchangeRate: decimal("sellExchangeRate", { precision: 10, scale: 4 }),
  sellDate: timestamp("sellDate", { withTimezone: true }),
  sellChannel: varchar("sellChannel", { length: 256 }),
  imageUrl: text("imageUrl"),
  s3ImageUrl: text("s3ImageUrl"),
  linkedCardId: integer("linkedCardId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  statusIdx: index("cci_status_idx").on(table.status),
  buyDateIdx: index("cci_buyDate_idx").on(table.buyDate),
  itemTypeIdx: index("cci_itemType_idx").on(table.itemType),
}));

export const whatsappWebhookEvents = pgTable("whatsappWebhookEvents", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  idMessage: varchar("idMessage", { length: 255 }).notNull().unique(),
  typeWebhook: varchar("typeWebhook", { length: 64 }).notNull(),
  groupChatId: varchar("groupChatId", { length: 255 }),
  senderChatId: varchar("senderChatId", { length: 255 }),
  processingState: whatsappWebhookEventsProcessingStateEnum("processingState").default("received").notNull(),
  payloadJson: text("payloadJson").notNull(),
  errorMessage: text("errorMessage"),
  receivedAt: timestamp("receivedAt", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processedAt", { withTimezone: true }),
}, (table) => ({
  groupReceivedIdx: index("wwe_group_received_idx").on(table.groupChatId, table.receivedAt),
}));

export const whatsappTradeIntakes = pgTable("whatsappTradeIntakes", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  commandMessageId: varchar("commandMessageId", { length: 255 }).notNull().unique(),
  groupChatId: varchar("groupChatId", { length: 255 }).notNull(),
  senderChatId: varchar("senderChatId", { length: 255 }).notNull(),
  action: whatsappTradeIntakesActionEnum("action").notNull(),
  rawCommand: text("rawCommand").notNull(),
  tradeDate: timestamp("tradeDate", { withTimezone: true }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: whatsappTradeIntakesCurrencyEnum("currency").default("HKD").notNull(),
  requestedInventoryId: integer("requestedInventoryId"),
  status: whatsappTradeIntakesStatusEnum("status").default("processing").notNull(),
  matchedProductType: whatsappTradeIntakesMatchedProductTypeEnum("matchedProductType"),
  matchedProductId: integer("matchedProductId"),
  matchScore: decimal("matchScore", { precision: 8, scale: 2 }),
  matchEvidenceJson: text("matchEvidenceJson"),
  cardInventoryId: integer("cardInventoryId"),
  reviewReason: text("reviewReason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  statusCreatedIdx: index("wti_status_created_idx").on(table.status, table.createdAt),
  senderCreatedIdx: index("wti_sender_created_idx").on(table.senderChatId, table.createdAt),
  personalInventoryIdx: index("wti_card_inventory_idx").on(table.cardInventoryId),
}));

export const whatsappTradeMedia = pgTable("whatsappTradeMedia", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  mediaMessageId: varchar("mediaMessageId", { length: 255 }).notNull().unique(),
  intakeId: integer("intakeId"),
  groupChatId: varchar("groupChatId", { length: 255 }).notNull(),
  senderChatId: varchar("senderChatId", { length: 255 }).notNull(),
  s3Key: text("s3Key").notNull(),
  s3Url: text("s3Url").notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  byteSize: integer("byteSize").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  receivedAt: timestamp("receivedAt", { withTimezone: true }).defaultNow().notNull(),
  consumedAt: timestamp("consumedAt", { withTimezone: true }),
}, (table) => ({
  pendingMediaIdx: index("wtm_pending_media_idx").on(table.groupChatId, table.senderChatId, table.consumedAt, table.receivedAt),
  intakeMediaIdx: index("wtm_intake_media_idx").on(table.intakeId),
}));

export const exportJobs = pgTable("exportJobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  type: exportJobsTypeEnum("type").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  status: exportJobsStatusEnum("status").default("pending").notNull(),
  progress: integer("progress").default(0),
  currentItem: integer("currentItem").default(0),
  totalItems: integer("totalItems").default(0),
  downloadUrl: text("downloadUrl"),
  errorMessage: text("errorMessage"),
  expiresAt: timestamp("expiresAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const gradingBannerImages = pgTable("gradingBannerImages", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  imageUrl: text("imageUrl").notNull(),
  imageKey: varchar("imageKey", { length: 512 }).notNull(),
  altText: varchar("altText", { length: 256 }),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  sortOrderIdx: index("gbi_sortOrder_idx").on(table.sortOrder),
  isActiveIdx: index("gbi_isActive_idx").on(table.isActive),
}));

export const searchTokens = pgTable("searchTokens", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  productType: searchTokensProductTypeEnum("productType").notNull().default("single_card"),
  token: varchar("token", { length: 128 }).notNull(),
  tokenType: searchTokensTokenTypeEnum("tokenType").notNull(),
}, (table) => ({
  // Primary search index: token prefix lookup
  tokenIdx: index("st_token_idx").on(table.token),
  // Composite index for token prefix search with product type filter
  tokenProductTypeIdx: index("st_token_productType_idx").on(table.token, table.productType),
  // Index for rebuilding tokens for a specific card
  cardIdIdx: index("st_cardId_idx").on(table.cardId),
  // Composite for cardId + productType (used when deleting/rebuilding tokens for a card)
  cardIdProductTypeIdx: index("st_cardId_productType_idx").on(table.cardId, table.productType),
}));

export const snkrdunkGradeIndex = pgTable("snkrdunkGradeIndex", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  grade: varchar("grade", { length: 64 }).notNull(),
  minPrice: decimal("minPrice", { precision: 12, scale: 2 }).notNull(),
  listingCount: integer("listingCount").notNull().default(1),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  // Primary lookup: grade → matching cardIds (used in searchCardsByGrade)
  gradeIdx: index("sgi_grade_idx").on(table.grade),
  // Composite for (cardId, grade) uniqueness checks and per-card cleanup
  cardIdGradeIdx: index("sgi_cardId_grade_idx").on(table.cardId, table.grade),
  // For sorting results by price
  minPriceIdx: index("sgi_minPrice_idx").on(table.minPrice),
}));

export const userCollections = pgTable("userCollections", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  cardId: integer("cardId").notNull(),
  grader: varchar("grader", { length: 16 }).notNull(),
  grade: varchar("grade", { length: 32 }),
  quantity: integer("quantity").notNull().default(1),
  purchasePrice: decimal("purchasePrice", { precision: 10, scale: 2 }),
  purchasedAt: timestamp("purchasedAt", { withTimezone: true }),
  notes: text("notes"),
  isPublic: boolean("isPublic").notNull().default(false),
  tradedAt: timestamp("tradedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userIdIdx: index("uc_userId_idx").on(table.userId),
  cardIdIdx: index("uc_cardId_idx").on(table.cardId),
  isPublicIdx: index("uc_isPublic_idx").on(table.isPublic),
  userCardIdx: index("uc_userId_cardId_idx").on(table.userId, table.cardId),
  tradedAtIdx: index("uc_tradedAt_idx").on(table.tradedAt),
}));

export const cardTrades = pgTable("cardTrades", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  tradedAt: timestamp("tradedAt", { withTimezone: true }).notNull(),
  tradePartner: varchar("tradePartner", { length: 128 }),
  cashAdjustment: decimal("cashAdjustment", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userIdIdx: index("ct_userId_idx").on(table.userId),
  tradedAtIdx: index("ct_tradedAt_idx").on(table.tradedAt),
}));

export const cardTradeItems = pgTable("cardTradeItems", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  tradeId: integer("tradeId").notNull(),
  direction: cardTradeItemsDirectionEnum("direction").notNull(),
  collectionId: integer("collectionId"),
  cardId: integer("cardId").notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  grader: varchar("grader", { length: 16 }).notNull().default("RAW"),
  grade: varchar("grade", { length: 32 }),
  quantity: integer("quantity").notNull().default(1),
  estimatedValue: decimal("estimatedValue", { precision: 10, scale: 2 }),
  newCollectionId: integer("newCollectionId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tradeIdIdx: index("cti_tradeId_idx").on(table.tradeId),
  collectionIdIdx: index("cti_collectionId_idx").on(table.collectionId),
  newCollectionIdIdx: index("cti_newCollectionId_idx").on(table.newCollectionId),
}));

export const orders = pgTable("orders", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderNo: varchar("orderNo", { length: 64 }).notNull().unique(),
  buyerId: integer("buyerId").notNull(),
  totalAmountHkd: decimal("totalAmountHkd", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 32 }).notNull(),
  paymentStatus: varchar("paymentStatus", { length: 32 }).default("pending").notNull(),
  orderStatus: varchar("orderStatus", { length: 32 }).default("pending_payment").notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  alipayProofUrl: text("alipayProofUrl"),
  alipayProofStatus: varchar("alipayProofStatus", { length: 32 }),
  paidAt: timestamp("paidAt", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  cancelledAt: timestamp("cancelledAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  buyerIdIdx: index("orders_buyerId_idx").on(table.buyerId),
  orderNoIdx: index("orders_orderNo_idx").on(table.orderNo),
  orderStatusIdx: index("orders_orderStatus_idx").on(table.orderStatus),
  paymentStatusIdx: index("orders_paymentStatus_idx").on(table.paymentStatus),
  createdAtIdx: index("orders_createdAt_idx").on(table.createdAt),
}));

export const orderItems = pgTable("orderItems", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  orderId: integer("orderId").notNull(),
  sellerId: integer("sellerId").notNull(),
  listingId: integer("listingId").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  priceAtPurchaseHkd: decimal("priceAtPurchaseHkd", { precision: 10, scale: 2 }).notNull(),
  shippingStatus: varchar("shippingStatus", { length: 32 }).default("pending").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 128 }),
  shippedAt: timestamp("shippedAt", { withTimezone: true }),
  deliveredAt: timestamp("deliveredAt", { withTimezone: true }),
  sellerNote: text("sellerNote"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  orderIdIdx: index("orderItems_orderId_idx").on(table.orderId),
  sellerIdIdx: index("orderItems_sellerId_idx").on(table.sellerId),
  listingIdIdx: index("orderItems_listingId_idx").on(table.listingId),
  shippingStatusIdx: index("orderItems_shippingStatus_idx").on(table.shippingStatus),
}));

export const webhookLogs = pgTable("webhookLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  eventId: varchar("eventId", { length: 128 }).notNull().unique(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  rawPayload: text("rawPayload"),
  errorLog: text("errorLog"),
  retryCount: integer("retryCount").default(0).notNull(),
  processedAt: timestamp("processedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  statusIdx: index("webhookLogs_status_idx").on(table.status),
  eventTypeIdx: index("webhookLogs_eventType_idx").on(table.eventType),
  createdAtIdx: index("webhookLogs_createdAt_idx").on(table.createdAt),
}));

export const tcgMarketPrices = pgTable("tcgMarketPrices", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  cardId: integer("cardId").notNull(),
  tcgCardId: varchar("tcgCardId", { length: 64 }).notNull(),
  tcgLow: decimal("tcgLow", { precision: 10, scale: 2 }),
  tcgMid: decimal("tcgMid", { precision: 10, scale: 2 }),
  tcgHigh: decimal("tcgHigh", { precision: 10, scale: 2 }),
  tcgMarket: decimal("tcgMarket", { precision: 10, scale: 2 }),
  cmAvg: decimal("cmAvg", { precision: 10, scale: 2 }),
  cmTrend: decimal("cmTrend", { precision: 10, scale: 2 }),
  cmAvg7: decimal("cmAvg7", { precision: 10, scale: 2 }),
  cmAvg30: decimal("cmAvg30", { precision: 10, scale: 2 }),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  cardIdIdx: index("tcgmp_cardId_idx").on(table.cardId),
  tcgCardIdUniq: uniqueIndex("tcgmp_tcgCardId_uniq").on(table.tcgCardId),
}));

export const pools = pgTable("pools", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverImageUrl: text("coverImageUrl"),
  totalSlots: integer("totalSlots").notNull().default(100),
  pricePoints: integer("pricePoints").notNull().default(1000),
  officialBuybackPoints: integer("officialBuybackPoints").notNull().default(300),
  visibleCardCost: integer("visibleCardCost").notNull().default(300),
  miscCost: integer("miscCost").notNull().default(0),
  status: poolsStatusEnum("pool_status").notNull().default("draft"),
  maintenanceMode: boolean("maintenanceMode").notNull().default(false),
  maintenanceMessage: varchar("maintenanceMessage", { length: 500 }),
  sortOrder: integer("sortOrder").notNull().default(0),
  publishedAt: timestamp("publishedAt", { withTimezone: true }),
  tags: text("tags"),
  returnRate: integer("returnRate"),
  freeTrialEnabled: boolean("freeTrialEnabled").notNull().default(false),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const poolRewards = pgTable("poolRewards", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  poolId: integer("poolId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  rewardType: poolRewardsRewardTypeEnum("pr_rewardType").notNull().default("hidden"),
  effectTier: varchar("effectTier", { length: 50 }),
  cost: integer("cost").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  triggerAt: integer("triggerAt"),
  imageUrl: text("imageUrl"),
  cardId: integer("cardId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const poolSlots = pgTable("poolSlots", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  poolId: integer("poolId").notNull(),
  slotIndex: integer("slotIndex").notNull(),
  rewardId: integer("rewardId"),
  visibleCardName: varchar("visibleCardName", { length: 255 }),
  isDrawn: boolean("isDrawn").notNull().default(false),
  drawnByUserId: integer("drawnByUserId"),
  drawnAt: timestamp("drawnAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const userVault = pgTable("userVault", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  poolSlotId: integer("poolSlotId").notNull(),
  poolId: integer("poolId").notNull(),
  rewardId: integer("rewardId").notNull().default(0),
  slotIndex: integer("slotIndex").notNull().default(0),
  poolTitle: varchar("poolTitle", { length: 255 }),
  cardName: varchar("cardName", { length: 255 }),
  cardImageUrl: text("cardImageUrl"),
  effectTier: integer("effectTier").notNull().default(3),
  isMilestone: smallint("isMilestone").notNull().default(0),
  milestoneCardName: varchar("milestoneCardName", { length: 255 }),
  milestoneCardImageUrl: text("milestoneCardImageUrl"),
  status: userVaultStatusEnum("uv_status").notNull().default("in_vault"),
  buybackPoints: integer("buybackPoints"),
  shippingAddressId: integer("shippingAddressId"),
  shippingTrackingNumber: varchar("shippingTrackingNumber", { length: 128 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const userPointBalance = pgTable("userPointBalance", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull().unique(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const pointTransactions = pgTable("pointTransactions", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  type: pointTransactionsTypeEnum("pt_type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: bigint("balanceAfter", { mode: "number" }).notNull(),
  note: varchar("note", { length: 500 }),
  referenceId: varchar("referenceId", { length: 100 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const freeTrialDraws = pgTable("freeTrialDraws", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  poolId: integer("poolId").notNull(),
  slotIndex: integer("slotIndex").notNull(),
  rewardId: integer("rewardId"),
  rewardName: varchar("rewardName", { length: 255 }),
  rewardImageUrl: text("rewardImageUrl"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const aiScanUsage = pgTable("aiScanUsage", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userMonthIdx: uniqueIndex("idx_aiScanUsage_userId_yearMonth").on(table.userId, table.yearMonth),
}));

export const wallEntries = pgTable("wallEntries", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("userId").notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  avatarUrl: text("avatarUrl"),
  totalValue: bigint("totalValue", { mode: "number" }).notNull().default(0),
  topCardId: integer("topCardId"),
  topCardName: varchar("topCardName", { length: 255 }),
  topCardImageUrl: text("topCardImageUrl"),
  topCardGrade: varchar("topCardGrade", { length: 32 }),
  topCardGrader: varchar("topCardGrader", { length: 32 }),
  topCardValue: bigint("topCardValue", { mode: "number" }).default(0),
  card2Name: varchar("card2Name", { length: 255 }),
  card2ImageUrl: text("card2ImageUrl"),
  card2Grade: varchar("card2Grade", { length: 32 }),
  card2Grader: varchar("card2Grader", { length: 32 }),
  card2Value: bigint("card2Value", { mode: "number" }).default(0),
  card3Name: varchar("card3Name", { length: 255 }),
  card3ImageUrl: text("card3ImageUrl"),
  card3Grade: varchar("card3Grade", { length: 32 }),
  card3Grader: varchar("card3Grader", { length: 32 }),
  card3Value: bigint("card3Value", { mode: "number" }).default(0),
  card4Name: varchar("card4Name", { length: 255 }),
  card4ImageUrl: text("card4ImageUrl"),
  card4Grade: varchar("card4Grade", { length: 32 }),
  card4Grader: varchar("card4Grader", { length: 32 }),
  card4Value: bigint("card4Value", { mode: "number" }).default(0),
  card5Name: varchar("card5Name", { length: 255 }),
  card5ImageUrl: text("card5ImageUrl"),
  card5Grade: varchar("card5Grade", { length: 32 }),
  card5Grader: varchar("card5Grader", { length: 32 }),
  card5Value: bigint("card5Value", { mode: "number" }).default(0),
  sighs: integer("sighs").notNull().default(0),
  posterUrl: text("posterUrl"),
  isPublic: boolean("isPublic").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex("idx_wallEntries_userId").on(table.userId),
  totalValueIdx: index("idx_wallEntries_totalValue").on(table.totalValue),
  sighsIdx: index("idx_wallEntries_sighs").on(table.sighs),
}));

export const wallComments = pgTable("wallComments", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  entryId: integer("entryId").notNull(),
  userId: integer("userId").notNull(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  content: varchar("content", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  entryIdIdx: index("idx_wallComments_entryId").on(table.entryId),
  userIdIdx: index("idx_wallComments_userId").on(table.userId),
}));

export const wallSighLogs = pgTable("wallSighLogs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  entryId: integer("entryId").notNull(),
  userId: integer("userId").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  entryUserIdx: uniqueIndex("idx_wallSighLogs_entry_user").on(table.entryId, table.userId),
}));
