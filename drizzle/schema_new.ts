import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Games table - manages TCG game types
 */
export const games = mysqlTable("games", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  nameJa: varchar("nameJa", { length: 128 }),
  nameZh: varchar("nameZh", { length: 128 }),
  publisher: varchar("publisher", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  icon: text("icon"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  codeIdx: index("idx_games_code").on(table.code),
  isActiveIdx: index("idx_games_isActive").on(table.isActive),
}));

export type Game = typeof games.$inferSelect;
export type InsertGame = typeof games.$inferInsert;

/**
 * Sealed products table - stores booster boxes and other sealed products
 */
export const sealedProducts = mysqlTable("sealedProducts", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("gameId").notNull(),
  name: text("name").notNull(),
  nameJa: text("nameJa"),
  nameZh: text("nameZh"),
  boxType: mysqlEnum("boxType", ["booster_box", "other"]).notNull().default("booster_box"),
  itemCount: int("itemCount"),
  setName: text("setName"),
  series: text("series"),
  imageUrl: text("imageUrl"),
  releaseDate: timestamp("releaseDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  gameIdIdx: index("idx_sealed_gameId").on(table.gameId),
  boxTypeIdx: index("idx_sealed_boxType").on(table.boxType),
}));

export type SealedProduct = typeof sealedProducts.$inferSelect;
export type InsertSealedProduct = typeof sealedProducts.$inferInsert;

/**
 * Users table - supports password and Google OAuth authentication
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  passwordHash: varchar("passwordHash", { length: 255 }), // bcrypt hash (nullable for OAuth users)
  googleId: varchar("googleId", { length: 128 }), // Google OAuth ID (nullable)
  loginMethod: mysqlEnum("loginMethod", ["password", "google"]).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
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
  snkrdunkId: varchar("snkrdunkId", { length: 32 }).unique(), // SNKRDUNK ID (extracted from SNKRDUNK URL)
  gameId: int("gameId").notNull().default(1), // Game type ID (foreign key to games table)
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
}, (table) => ({
  gameIdIdx: index("idx_cards_gameId").on(table.gameId),
}));

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

/**
 * Price history table - stores historical price data from various sources
 */
export const priceHistory = mysqlTable("priceHistory", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  productType: mysqlEnum("productType", ["single_card", "sealed_product"]).notNull().default("single_card"), // Product type
  source: mysqlEnum("source", ["snkrdunk", "ebay", "tcgplayer", "other"]).notNull(), // Price source
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Price value
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(), // Currency code
  grade: varchar("grade", { length: 32 }), // Card grade (e.g., "PSA 10", "BGS 9.5") - for single cards
  condition: varchar("condition", { length: 64 }), // Card condition
  quantity: varchar("quantity", { length: 50 }), // Quantity (e.g., "10盒", "1盒") - for sealed products
  listingUrl: text("listingUrl"), // URL to the listing
  soldAt: timestamp("soldAt"), // Transaction timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
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
}));

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

/**
 * Watchlist table - stores user's watched cards for price alerts
 */
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  cardId: int("cardId").notNull(), // Foreign key to cards table
  productType: mysqlEnum("productType", ["single_card", "sealed_product"]).notNull().default("single_card"), // Product type
  targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }), // Optional target price alert
  currency: varchar("currency", { length: 8 }).default("HKD"),
  notes: text("notes"), // User notes about this card
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  productTypeIdx: index("idx_watchlist_productType").on(table.productType),
}));

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;

/**
 * View history table - stores user's card viewing history
 */
export const viewHistory = mysqlTable("viewHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  cardId: int("cardId").notNull(), // Foreign key to cards table
  productType: mysqlEnum("productType", ["single_card", "sealed_product"]).notNull().default("single_card"), // Product type
  viewedAt: timestamp("viewedAt").defaultNow().notNull(), // Viewing timestamp
}, (table) => ({
  productTypeIdx: index("idx_viewhistory_productType").on(table.productType),
}));

export type ViewHistory = typeof viewHistory.$inferSelect;
export type InsertViewHistory = typeof viewHistory.$inferInsert;

/**
 * Scraper performance logs table - stores performance metrics for scraper operations
 */
export const scraperPerformanceLogs = mysqlTable("scraperPerformanceLogs", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["snkrdunk", "ebay"]).notNull(), // Scraper source
  cardId: int("cardId"), // Foreign key to cards table (nullable for batch operations)
  operationType: mysqlEnum("operationType", ["single", "batch"]).notNull(), // Single card or batch update
  status: mysqlEnum("status", ["success", "error", "timeout"]).notNull(), // Operation status
  responseTime: int("responseTime").notNull(), // Response time in milliseconds
  itemsProcessed: int("itemsProcessed").default(0), // Number of items processed
  errorMessage: text("errorMessage"), // Error message if failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScraperPerformanceLog = typeof scraperPerformanceLogs.$inferSelect;
export type InsertScraperPerformanceLog = typeof scraperPerformanceLogs.$inferInsert;

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
  gameId: int("gameId").notNull(), // Game type ID (foreign key to games table)
  productType: mysqlEnum("productType", ["single_card", "sealed_product"]).notNull().default("single_card"), // Product type
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
}, (table) => ({
  gameIdIdx: index("idx_datasources_gameId").on(table.gameId),
  productTypeIdx: index("idx_datasources_productType").on(table.productType),
}));

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
 * User search logs table - stores user search behavior on the platform
 * Used for trending cards by search popularity
 */
export const userSearchLogs = mysqlTable("userSearchLogs", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Card that was searched/clicked
  searchQuery: varchar("searchQuery", { length: 255 }), // Search query (if from search page)
  source: mysqlEnum("source", ["search_page", "card_click", "trending_page", "home_page"]).notNull(), // Where the search came from
  userId: int("userId"), // Optional: user ID if logged in
  sessionId: varchar("sessionId", { length: 100 }), // Session ID for anonymous users
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserSearchLog = typeof userSearchLogs.$inferSelect;
export type InsertUserSearchLog = typeof userSearchLogs.$inferInsert;

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
  category: varchar("category", { length: 100 }), // Category name (e.g., "市場分析", "卡牌評測")
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
 * Post versions table - stores historical versions of posts for version control
 */
export const postVersions = mysqlTable("post_versions", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(), // Markdown format
  featuredImage: text("featuredImage"),
  category: varchar("category", { length: 100 }),
  tags: text("tags"), // Comma-separated tags
  metaKeywords: text("metaKeywords"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(), // User ID who created this version
});

export type PostVersion = typeof postVersions.$inferSelect;
export type InsertPostVersion = typeof postVersions.$inferInsert;

/**
 * Uploaded images table - stores uploaded image information for blog posts
 */
export const uploadedImages = mysqlTable("uploaded_images", {
  id: int("id").autoincrement().primaryKey(),
  url: text("url").notNull(), // S3 URL
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 file key
  fileName: varchar("fileName", { length: 255 }).notNull(), // Original file name
  fileSize: int("fileSize").notNull(), // File size in bytes
  mimeType: varchar("mimeType", { length: 100 }).notNull(), // MIME type (e.g., "image/png")
  uploadedBy: int("uploadedBy").notNull(), // User ID who uploaded the image
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UploadedImage = typeof uploadedImages.$inferSelect;
export type InsertUploadedImage = typeof uploadedImages.$inferInsert;

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


/**
 * Schedule Execution History table - stores price update schedule execution records
 */
export const scheduleExecutionHistory = mysqlTable("scheduleExecutionHistory", {
  id: int("id").autoincrement().primaryKey(),
  scheduleType: varchar("scheduleType", { length: 50 }).notNull(), // e.g., "snkrdunk_daily_update", "ebay_daily_update"
  executionType: mysqlEnum("executionType", ["scheduled", "manual"]).notNull(), // Scheduled or manual trigger
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"), // Execution duration in milliseconds
  snkrdunkSuccessCount: int("snkrdunkSuccessCount").default(0),
  snkrdunkFailureCount: int("snkrdunkFailureCount").default(0),
  snkrdunkRecordsAdded: int("snkrdunkRecordsAdded").default(0),
  errorMessage: text("errorMessage"),
}, (table) => {
  return {
    scheduleTypeIdx: index("scheduleType_idx").on(table.scheduleType),
    startedAtIdx: index("startedAt_idx").on(table.startedAt),
  };
});

export type ScheduleExecutionHistory = typeof scheduleExecutionHistory.$inferSelect;
export type InsertScheduleExecutionHistory = typeof scheduleExecutionHistory.$inferInsert;


/**
 * Post Shares table - tracks article share statistics
 */
export const postShares = mysqlTable("postShares", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(), // Foreign key to posts table
  shareType: mysqlEnum("shareType", ["facebook", "whatsapp", "copy_link"]).notNull(), // Share platform
  sharedAt: timestamp("sharedAt").defaultNow().notNull(), // When the share occurred
  userAgent: text("userAgent"), // Optional: browser user agent for analytics
  ipAddress: varchar("ipAddress", { length: 45 }), // Optional: IP address (IPv4/IPv6)
}, (table) => {
  return {
    postIdIdx: index("postId_idx").on(table.postId),
    shareTypeIdx: index("shareType_idx").on(table.shareType),
    sharedAtIdx: index("sharedAt_idx").on(table.sharedAt),
  };
});

export type PostShare = typeof postShares.$inferSelect;
export type InsertPostShare = typeof postShares.$inferInsert;

/**
 * Trending Rankings Cache table - stores cached trending rankings data
 * Reduces database query pressure by caching calculated rankings
 */
export const trendingRankingsCache = mysqlTable("trendingRankingsCache", {
  id: int("id").autoincrement().primaryKey(),
  rankingType: mysqlEnum("rankingType", ["price_increase", "price_decrease", "search_popularity"]).notNull(), // Type of ranking
  timeRange: int("timeRange").notNull(), // Time range in days (e.g., 30)
  rankingData: text("rankingData").notNull(), // JSON array of ranked cards with full details
  calculatedAt: timestamp("calculatedAt").notNull(), // When this ranking was calculated
  expiresAt: timestamp("expiresAt").notNull(), // When this cache expires
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    rankingTypeTimeRangeIdx: index("rankingType_timeRange_idx").on(table.rankingType, table.timeRange),
    calculatedAtIdx: index("calculatedAt_idx").on(table.calculatedAt),
  };
});

export type TrendingRankingsCache = typeof trendingRankingsCache.$inferSelect;
export type InsertTrendingRankingsCache = typeof trendingRankingsCache.$inferInsert;
