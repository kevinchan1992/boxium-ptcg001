import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Supports email, Google OAuth, and Facebook OAuth authentication
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }), // Null for OAuth users
  name: text("name"),
  avatar: text("avatar"), // Profile picture URL
  emailVerified: boolean("emailVerified").default(false).notNull(), // Email verification status
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: index("email_idx").on(table.email),
  };
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * OAuth accounts table - stores OAuth provider linkages
 */
export const oauthAccounts = mysqlTable("oauthAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  provider: mysqlEnum("provider", ["google", "facebook"]).notNull(), // OAuth provider
  providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(), // Provider's user ID
  accessToken: text("accessToken"), // OAuth access token (optional, for future use)
  refreshToken: text("refreshToken"), // OAuth refresh token (optional)
  expiresAt: timestamp("expiresAt"), // Token expiration time
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("userId_idx").on(table.userId),
    providerAccountIdx: index("provider_account_idx").on(table.provider, table.providerAccountId),
  };
});

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type InsertOAuthAccount = typeof oauthAccounts.$inferInsert;

/**
 * Sessions table - stores user login sessions
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  token: varchar("token", { length: 255 }).notNull().unique(), // Session token (JWT)
  ipAddress: varchar("ipAddress", { length: 45 }), // User's IP address
  userAgent: text("userAgent"), // User's browser/device info
  expiresAt: timestamp("expiresAt").notNull(), // Session expiration time
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("userId_idx").on(table.userId),
    tokenIdx: index("token_idx").on(table.token),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
  };
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

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
  expiresAt: timestamp("expiresAt").notNull(), // When the cold cache expires (6 hours after cachedAt)
  hotExpiresAt: timestamp("hotExpiresAt").notNull(), // When the hot cache expires (1 hour after cachedAt)
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

/**
 * eBay listings cache table - stores cached eBay API results
 */
export const ebayListingsCache = mysqlTable("ebayListingsCache", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  searchQuery: varchar("searchQuery", { length: 500 }).notNull(), // eBay search query
  listings: text("listings").notNull(), // JSON array of listings
  cachedAt: timestamp("cachedAt").defaultNow().notNull(), // When the cache was created
  expiresAt: timestamp("expiresAt").notNull(), // When the cold cache expires (6 hours after cachedAt)
  hotExpiresAt: timestamp("hotExpiresAt").notNull(), // When the hot cache expires (1 hour after cachedAt)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => {
  return {
    cardIdIdx: index("cardId_idx").on(table.cardId),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
    hotExpiresAtIdx: index("hotExpiresAt_idx").on(table.hotExpiresAt),
  };
});

export type EbayListingsCache = typeof ebayListingsCache.$inferSelect;
export type InsertEbayListingsCache = typeof ebayListingsCache.$inferInsert;

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
  nameEn: varchar("nameEn", { length: 100 }),
  nameJa: varchar("nameJa", { length: 100 }),
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
  
  // Multi-language fields
  titleEn: text("titleEn"),
  titleJa: text("titleJa"),
  excerptEn: text("excerptEn"),
  excerptJa: text("excerptJa"),
  contentEn: text("contentEn"), // Markdown format
  contentJa: text("contentJa"), // Markdown format
  
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
 * Article generation history table - stores AI article generation requests and results
 */
export const articleGenerationHistory = mysqlTable("articleGenerationHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // User who initiated the generation
  
  // Input information
  inputType: mysqlEnum("inputType", ["url", "text"]).notNull(), // Input type: URL or text
  inputContent: text("inputContent").notNull(), // URL or original text content
  detectedLanguage: varchar("detectedLanguage", { length: 10 }), // Detected language (zh-TW, en, ja)
  
  // Generation settings
  targetLanguage: varchar("targetLanguage", { length: 10 }), // Target language for generated article
  style: varchar("style", { length: 50 }), // Article style (news, analysis, guide, etc.)
  
  // Generation results
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  generatedTitle: text("generatedTitle"), // Generated article title
  generatedContent: text("generatedContent"), // Generated article content (Markdown)
  generatedExcerpt: text("generatedExcerpt"), // Generated excerpt
  generatedSlug: varchar("generatedSlug", { length: 255 }), // Generated URL slug
  
  // Related information
  postId: int("postId"), // If saved as a post, store the post ID
  errorMessage: text("errorMessage"), // Error message if generation failed
  
  // Metadata
  processingTimeMs: int("processingTimeMs"), // Processing time in milliseconds
  tokensUsed: int("tokensUsed"), // Number of tokens used for generation
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ArticleGenerationHistory = typeof articleGenerationHistory.$inferSelect;
export type InsertArticleGenerationHistory = typeof articleGenerationHistory.$inferInsert;

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
 * Notifications table - stores user notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  type: mysqlEnum("type", ["price_alert", "system", "trade", "announcement"]).notNull(), // Notification type
  title: text("title").notNull(), // Notification title
  content: text("content").notNull(), // Notification content
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(), // Notification priority
  isRead: boolean("isRead").default(false).notNull(), // Whether notification has been read
  relatedCardId: int("relatedCardId"), // Optional: related card ID for price alerts
  relatedUrl: text("relatedUrl"), // Optional: URL to navigate when clicked
  metadata: text("metadata"), // Optional: JSON metadata (e.g., old price, new price)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"), // When notification was read
}, (table) => {
  return {
    userIdIdx: index("userId_idx").on(table.userId),
    isReadIdx: index("isRead_idx").on(table.isRead),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  };
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
