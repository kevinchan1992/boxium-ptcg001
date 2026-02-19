import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Only supports Manus OAuth authentication
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(), // Manus OAuth user ID
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  loginMethod: varchar("loginMethod", { length: 64 }), // Always "oauth"
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Cards table - stores Pokémon TCG card information
 */
export const cards = mysqlTable("cards", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 128 }).notNull().unique(), // External API card ID
  name: text("name").notNull(),
  nameJa: text("nameJa"), // Japanese name
  series: text("series"), // Expansion Pack series
  setName: text("setName"), // Set name
  cardNumber: varchar("cardNumber", { length: 32 }), // Card number (e.g., "110/80")
  rarity: varchar("rarity", { length: 64 }), // Rarity (e.g., "HR", "SR", "RR")
  language: varchar("language", { length: 16 }).default("en"), // Language version
  releaseDate: timestamp("releaseDate"), // Release date
  imageUrl: text("imageUrl"), // Card image URL
  imageUrlHiRes: text("imageUrlHiRes"), // High resolution image URL
  artist: text("artist"), // Card artist
  description: text("description"), // Card description
  types: text("types"), // Pokemon types (JSON array)
  hp: int("hp"), // HP value
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

/**
 * Price history table - stores historical price data from various sources
 */
export const priceHistory = mysqlTable("priceHistory", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  source: mysqlEnum("source", ["snkrdunk", "ebay", "tcgplayer", "other"]).notNull(), // Price source
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Price value
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(), // Currency code
  grade: varchar("grade", { length: 32 }), // Card grade (e.g., "PSA 10", "BGS 9.5")
  condition: varchar("condition", { length: 64 }), // Card condition
  listingUrl: text("listingUrl"), // URL to the listing
  soldAt: timestamp("soldAt"), // Transaction timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

/**
 * Watchlist table - stores user's watched cards for price alerts
 */
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  cardId: int("cardId").notNull(), // Foreign key to cards table
  targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }), // Optional target price alert
  currency: varchar("currency", { length: 8 }).default("HKD"),
  notes: text("notes"), // User notes about this card
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;

/**
 * Market trends table - stores aggregated market data for analysis
 */
export const marketTrends = mysqlTable("marketTrends", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  date: timestamp("date").notNull(), // Date of the trend data
  avgPrice: decimal("avgPrice", { precision: 10, scale: 2 }), // Average price
  minPrice: decimal("minPrice", { precision: 10, scale: 2 }), // Minimum price
  maxPrice: decimal("maxPrice", { precision: 10, scale: 2 }), // Maximum price
  volume: int("volume"), // Number of transactions
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(),
  source: varchar("source", { length: 32 }), // Data source
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketTrend = typeof marketTrends.$inferSelect;
export type InsertMarketTrend = typeof marketTrends.$inferInsert;

/**
 * Data sources table - stores external data source configurations (SNKRDUNK links, etc.)
 */
export const dataSources = mysqlTable("dataSources", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  source: mysqlEnum("source", ["snkrdunk", "ebay", "tcgplayer", "other"]).notNull(),
  sourceUrl: text("sourceUrl").notNull(), // URL to the source page
  sourceIdentifier: varchar("sourceIdentifier", { length: 128 }), // External ID from source
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = inactive
  lastFetchedAt: timestamp("lastFetchedAt"), // Last time data was fetched
  lastUpdatedAt: timestamp("lastUpdatedAt"), // Last time price data was updated
  nextUpdateAt: timestamp("nextUpdateAt"), // Scheduled time for next update
  lastFetchStatus: varchar("lastFetchStatus", { length: 32 }), // success, failed, pending
  fetchErrorMessage: text("fetchErrorMessage"), // Error message if fetch failed
  updateCount: int("updateCount").default(0).notNull(), // Number of times updated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DataSource = typeof dataSources.$inferSelect;
export type InsertDataSource = typeof dataSources.$inferInsert;

/**
 * Scheduled tasks table - tracks automatic update tasks
 */
export const scheduledTasks = mysqlTable("scheduledTasks", {
  id: int("id").autoincrement().primaryKey(),
  taskType: varchar("taskType", { length: 64 }).notNull(), // e.g., "snkrdunk_update", "ebay_update", "batch_ebay_update", "batch_snkrdunk_update"
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "paused"]).default("pending").notNull(),
  targetId: int("targetId"), // ID of the target (e.g., cardId or dataSourceId)
  totalItems: int("totalItems"), // Total number of items to process (for batch tasks)
  processedItems: int("processedItems").default(0), // Number of items processed
  successCount: int("successCount").default(0), // Number of successful items
  failureCount: int("failureCount").default(0), // Number of failed items
  progress: int("progress").default(0), // Progress percentage (0-100)
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  metadata: text("metadata"), // JSON metadata about the task (errors, details, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = typeof scheduledTasks.$inferInsert;

/**
 * SNKRDUNK listings cache table - stores cached Playwright scraping results
 */
export const snkrdunkListingsCache = mysqlTable("snkrdunkListingsCache", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  snkrdunkId: varchar("snkrdunkId", { length: 128 }).notNull(), // SNKRDUNK product ID
  listings: text("listings").notNull(), // JSON array of listings
  cachedAt: timestamp("cachedAt").defaultNow().notNull(), // When the cache was created
  expiresAt: timestamp("expiresAt").notNull(), // When the cache expires (1 hour after cachedAt)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => {
  return {
    cardIdIdx: index("cardId_idx").on(table.cardId),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
  };
});

export type SnkrdunkListingsCache = typeof snkrdunkListingsCache.$inferSelect;
export type InsertSnkrdunkListingsCache = typeof snkrdunkListingsCache.$inferInsert;

// Batch task progress interface
export interface BatchTaskProgress {
  taskId: number;
  taskType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  progress: number; // 0-100
  startedAt: Date | null;
  completedAt: Date | null;
  errors: Array<{ cardId: number; cardName: string; error: string }>;
}

/**
 * Firecrawl usage tracking table - tracks API usage for quota monitoring
 */
export const firecrawlUsage = mysqlTable("firecrawlUsage", {
  id: int("id").autoincrement().primaryKey(),
  operation: varchar("operation", { length: 32 }).notNull(), // scrape, crawl, search, etc.
  url: text("url"), // Target URL
  status: mysqlEnum("status", ["success", "failed", "quota_exceeded"]).notNull(),
  errorMessage: text("errorMessage"), // Error message if failed
  creditsUsed: int("creditsUsed").default(1).notNull(), // Credits consumed (default 1 per scrape)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FirecrawlUsage = typeof firecrawlUsage.$inferSelect;
export type InsertFirecrawlUsage = typeof firecrawlUsage.$inferInsert;

/**
 * System settings table - stores configuration like quota limits
 */
export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 64 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

/**
 * Favorites table - stores user's favorite cards
 */
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  cardId: int("cardId").notNull(), // Foreign key to cards table
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

/**
 * Search stats table - stores eBay search statistics for monitoring
 */
export const searchStats = mysqlTable("searchStats", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  searchMethod: mysqlEnum("searchMethod", ["image", "text"]).notNull(), // Search method used
  searchDuration: int("searchDuration").notNull(), // Search duration in milliseconds
  resultsCount: int("resultsCount").notNull(), // Number of results found
  success: boolean("success").default(true).notNull(), // Whether search was successful
  errorMessage: text("errorMessage"), // Error message if search failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchStat = typeof searchStats.$inferSelect;
export type InsertSearchStat = typeof searchStats.$inferInsert;

/**
 * Blog categories table - stores article categories
 */
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Blog tags table - stores article tags
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Blog posts table - stores blog articles
 */
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(), // Markdown format
  featuredImage: text("featuredImage"),
  categoryId: int("categoryId"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  viewCount: int("viewCount").default(0).notNull(),
  authorId: int("authorId").notNull(),
  
  // Data-driven related fields
  dataSource: mysqlEnum("dataSource", ["manual", "ai-generated", "mixed"]).notNull(),
  relatedCardIds: text("relatedCardIds"), // JSON array of card IDs
  dataSnapshot: text("dataSnapshot"), // JSON snapshot of data used
  
  // SEO related fields
  metaTitle: varchar("metaTitle", { length: 255 }),
  metaDescription: text("metaDescription"),
  metaKeywords: text("metaKeywords"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/**
 * Post tags relation table - many-to-many relationship between posts and tags
 */
export const postTags = mysqlTable("post_tags", {
  postId: int("postId").notNull(),
  tagId: int("tagId").notNull(),
});

export type PostTag = typeof postTags.$inferSelect;
export type InsertPostTag = typeof postTags.$inferInsert;

/**
 * Price update schedule table - stores daily automatic price update schedule
 */
export const priceUpdateSchedule = mysqlTable("priceUpdateSchedule", {
  id: int("id").autoincrement().primaryKey(),
  snkrdunkEnabled: boolean("snkrdunkEnabled").default(false).notNull(), // Whether SNKRDUNK update is enabled
  snkrdunkUpdateTime: varchar("snkrdunkUpdateTime", { length: 8 }).default("09:00").notNull(), // Daily update time (HH:mm format)
  snkrdunkLastExecutedAt: timestamp("snkrdunkLastExecutedAt"), // Last SNKRDUNK update execution time
  ebayEnabled: boolean("ebayEnabled").default(false).notNull(), // Whether eBay update is enabled
  ebayUpdateTime: varchar("ebayUpdateTime", { length: 8 }).default("21:00").notNull(), // Daily update time (HH:mm format)
  ebayLastExecutedAt: timestamp("ebayLastExecutedAt"), // Last eBay update execution time
  timezone: varchar("timezone", { length: 64 }).default("Asia/Hong_Kong").notNull(), // Timezone
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PriceUpdateSchedule = typeof priceUpdateSchedule.$inferSelect;
export type InsertPriceUpdateSchedule = typeof priceUpdateSchedule.$inferInsert;

/**
 * Schedule config table - stores batch update schedule configuration (DEPRECATED - use priceUpdateSchedule instead)
 */
export const scheduleConfig = mysqlTable("scheduleConfig", {
  id: int("id").autoincrement().primaryKey(),
  scheduleType: varchar("scheduleType", { length: 64 }).notNull().unique(), // e.g., "batch_update_daily"
  enabled: boolean("enabled").default(false).notNull(), // Whether schedule is enabled
  cronExpression: varchar("cronExpression", { length: 64 }).notNull(), // Cron expression
  timezone: varchar("timezone", { length: 64 }).default("Asia/Hong_Kong").notNull(), // Timezone
  description: text("description"), // Description of the schedule
  lastExecutedAt: timestamp("lastExecutedAt"), // Last execution time
  nextExecutionAt: timestamp("nextExecutionAt"), // Next scheduled execution time
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduleConfig = typeof scheduleConfig.$inferSelect;
export type InsertScheduleConfig = typeof scheduleConfig.$inferInsert;

/**
 * Trending cards cache table - stores daily calculated top 5 trending cards
 */
export const trendingCardsCache = mysqlTable("trendingCardsCache", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  rank: int("rank").notNull(), // Ranking position (1-5)
  priceChange7d: decimal("priceChange7d", { precision: 10, scale: 2 }).notNull(), // 7-day price change percentage
  oldPrice: decimal("oldPrice", { precision: 10, scale: 2 }).notNull(), // Price 7 days ago
  currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(), // Current price
  calculatedAt: timestamp("calculatedAt").notNull(), // When this was calculated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrendingCardsCache = typeof trendingCardsCache.$inferSelect;
export type InsertTrendingCardsCache = typeof trendingCardsCache.$inferInsert;


/**
 * Background tasks table - stores long-running background task information
 */
export const backgroundTasks = mysqlTable("backgroundTasks", {
  id: int("id").autoincrement().primaryKey(),
  taskType: varchar("taskType", { length: 64 }).notNull(), // Task type (e.g., "refresh_all_cards_cache")
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending").notNull(),
  totalItems: int("totalItems").default(0).notNull(), // Total number of items to process
  processedItems: int("processedItems").default(0).notNull(), // Number of items processed
  successCount: int("successCount").default(0).notNull(), // Number of successful items
  failureCount: int("failureCount").default(0).notNull(), // Number of failed items
  currentItem: text("currentItem"), // Current item being processed (JSON)
  errorMessage: text("errorMessage"), // Error message if failed
  failedCards: text("failedCards"), // Failed cards list (JSON array: [{cardId, name, error, retryCount}])
  startedAt: timestamp("startedAt"), // Task start time
  completedAt: timestamp("completedAt"), // Task completion time
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BackgroundTask = typeof backgroundTasks.$inferSelect;
export type InsertBackgroundTask = typeof backgroundTasks.$inferInsert;
