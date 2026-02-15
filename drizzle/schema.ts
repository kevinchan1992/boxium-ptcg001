import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

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
  taskType: varchar("taskType", { length: 64 }).notNull(), // e.g., "snkrdunk_update", "ebay_update"
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  targetId: int("targetId"), // ID of the target (e.g., cardId or dataSourceId)
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  metadata: text("metadata"), // JSON metadata about the task
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = typeof scheduledTasks.$inferInsert;

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
 * Schedule config table - stores batch update schedule configuration
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
 * Schedule execution history table - stores batch update execution history
 */
export const scheduleExecutionHistory = mysqlTable("scheduleExecutionHistory", {
  id: int("id").autoincrement().primaryKey(),
  scheduleType: varchar("scheduleType", { length: 64 }).notNull(), // e.g., "batch_update_daily"
  executionType: mysqlEnum("executionType", ["scheduled", "manual"]).notNull(), // Scheduled or manual
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  ebaySuccessCount: int("ebaySuccessCount").default(0).notNull(),
  ebayFailureCount: int("ebayFailureCount").default(0).notNull(),
  ebayRecordsAdded: int("ebayRecordsAdded").default(0).notNull(),
  snkrdunkSuccessCount: int("snkrdunkSuccessCount").default(0).notNull(),
  snkrdunkFailureCount: int("snkrdunkFailureCount").default(0).notNull(),
  snkrdunkRecordsAdded: int("snkrdunkRecordsAdded").default(0).notNull(),
  errorMessage: text("errorMessage"), // Error message if execution failed
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"), // Execution duration in milliseconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduleExecutionHistory = typeof scheduleExecutionHistory.$inferSelect;
export type InsertScheduleExecutionHistory = typeof scheduleExecutionHistory.$inferInsert;

/**
 * User search logs table - tracks user search queries for popular search analysis
 */
export const userSearchLogs = mysqlTable("userSearchLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Optional: Foreign key to users table (null for anonymous)
  searchQuery: text("searchQuery").notNull(), // User's search query
  searchType: mysqlEnum("searchType", ["card_name", "set_name", "card_number", "general"]).notNull(), // Type of search
  resultCount: int("resultCount").default(0).notNull(), // Number of results returned
  cardId: int("cardId"), // Optional: If user clicked on a specific card
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserSearchLog = typeof userSearchLogs.$inferSelect;
export type InsertUserSearchLog = typeof userSearchLogs.$inferInsert;

/**
 * Blog articles table - stores market insight blog articles
 */
export const blogArticles = mysqlTable("blogArticles", {
  id: int("id").autoincrement().primaryKey(),
  title: text("title").notNull(), // Article title
  slug: varchar("slug", { length: 256 }).notNull().unique(), // URL-friendly slug
  summary: text("summary"), // Short summary/excerpt
  content: text("content").notNull(), // Full article content (markdown)
  category: mysqlEnum("category", ["market_analysis", "investment_trends", "card_research", "news", "guide"]).notNull(),
  featuredImageUrl: text("featuredImageUrl"), // Featured image URL
  authorId: int("authorId"), // Foreign key to users table (optional)
  authorName: varchar("authorName", { length: 128 }), // Author display name
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"), // Publication date
  viewCount: int("viewCount").default(0).notNull(), // View count
  likeCount: int("likeCount").default(0).notNull(), // Like count
  tags: text("tags"), // JSON array of tags
  relatedCardIds: text("relatedCardIds"), // JSON array of related card IDs
  sourceData: text("sourceData"), // JSON of source data (images, market data, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlogArticle = typeof blogArticles.$inferSelect;
export type InsertBlogArticle = typeof blogArticles.$inferInsert;


