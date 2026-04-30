import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

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
  styleCode: text("styleCode"),
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
  phone: varchar("phone", { length: 30 }),
  isBlocked: boolean("isBlocked").default(false).notNull(),
  blockReason: text("blockReason"),
  emailVerificationToken: varchar("emailVerificationToken", { length: 128 }), // Token for email verification (null after verified)
  emailVerificationExpiry: timestamp("emailVerificationExpiry"), // Expiry time for the verification token
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
  jpyPrice: int("jpyPrice"), // Original JPY price - used for deduplication (stable, unaffected by exchange rate)
  sourcePosition: int("sourcePosition").default(0).notNull(), // Position in source API response (0-based); differentiates multiple same-day same-price transactions
  listingUrl: text("listingUrl"), // URL to the listing
  soldAt: timestamp("soldAt"), // Transaction timestamp
  isSuspectedBulk: boolean("isSuspectedBulk").default(false).notNull(), // Auto-flagged: price exceeds 4x the 30-day median for same grade → likely a bulk/lot transaction
  // SHA-256 stable deduplication key: hex(sha256(cardId|source|grade|soldAtDate|jpyPrice|sourcePosition))
  // Computed deterministically from normalised fields; NULL until backfill migration runs.
  recordHash: varchar("recordHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  activeProcessingMs: int("activeProcessingMs").default(0), // Actual processing time in ms (excludes hibernate/idle time, max ~596 hours)
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
  snkrdunkUpdateTime: varchar("snkrdunkUpdateTime", { length: 8 }).default("01:00").notNull(), // First daily update time (HH:mm format)
  snkrdunkUpdateTime2: varchar("snkrdunkUpdateTime2", { length: 8 }).default("13:00"), // Second daily update time (HH:mm format, null = disabled)
  snkrdunkLastExecutedAt: timestamp("snkrdunkLastExecutedAt"), // Last SNKRDUNK update execution time
  snkrdunkLastCatchupAt: timestamp("snkrdunkLastCatchupAt"), // Last catch-up execution time (used for cooldown — one catch-up per HKT day)
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
  type: varchar("type", { length: 50 }).notNull(), // Notification type
  title: text("title").notNull(), // Notification title
  body: text("body"), // Notification body content
  linkUrl: text("linkUrl"), // Optional: URL to navigate when clicked
  relatedId: int("relatedId"), // Optional: related entity ID
  isRead: boolean("isRead").default(false).notNull(), // Whether notification has been read
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  executionType: mysqlEnum("executionType", ["scheduled", "manual", "catchup"]).notNull(), // Scheduled or manual trigger
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

// ============================================================
// MARKETPLACE TABLES
// ============================================================

/**
 * Seller Profiles - stores C2C seller information and Stripe Connect details
 */
export const sellerProfiles = mysqlTable("sellerProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK to users table
  displayName: varchar("displayName", { length: 100 }).notNull(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  stripeConnectId: varchar("stripeConnectId", { length: 100 }), // Stripe Connect account ID
  stripeConnectStatus: mysqlEnum("stripeConnectStatus", ["not_started", "pending", "active", "verified", "restricted", "disabled"]).default("pending").notNull(),
  stripeOnboardingUrl: text("stripeOnboardingUrl"),
  totalSales: int("totalSales").default(0).notNull(),
  avgRating: decimal("avgRating", { precision: 3, scale: 2 }).default("0.00"),
  ratingCount: int("ratingCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(), // Auto-approved (all users can sell)
  isSuspended: boolean("isSuspended").default(false).notNull(), // Admin can freeze seller
  suspensionReason: text("suspensionReason"), // Reason for suspension
  rejectReason: text("rejectReason"), // Reason for rejection (shown to applicant)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("sp_userId_idx").on(table.userId),
}));
export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type InsertSellerProfile = typeof sellerProfiles.$inferInsert;

/**
 * Marketplace Listings - products for sale (both platform and C2C)
 */
export const marketplaceListings = mysqlTable("marketplaceListings", {
  id: int("id").autoincrement().primaryKey(),
  // Seller info
  sellerType: mysqlEnum("sellerType", ["platform", "seller"]).notNull(), // platform = BOXIUM direct, seller = C2C
  sellerId: int("sellerId"), // NULL for platform listings, sellerProfiles.id for C2C
  // Product info
  cardId: int("cardId"), // FK to cards table
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  condition: mysqlEnum("condition", ["psa10", "psa9", "psa8_below", "bgs10", "bgs9", "bgs8_below", "tag10", "tag9_below", "raw_a", "raw_b", "raw_c", "raw_d"]).notNull().default("raw_a"),
  language: varchar("language", { length: 20 }),
  tcgSeries: mysqlEnum("tcgSeries", ["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"]).default("pokemon").notNull(),
  // Pricing
  priceHkd: decimal("priceHkd", { precision: 10, scale: 2 }).notNull(), // HKD
  quantity: int("quantity").default(1).notNull(),
  remainingQuantity: int("remainingQuantity").default(1).notNull(),
  // Images (JSON array of URLs)
  images: text("images"), // JSON array of image URLs
  // Status
  status: mysqlEnum("status", ["draft", "pending_review", "active", "reserved", "sold", "removed"]).default("draft").notNull(),
  rejectedReason: text("rejectedReason"),
  adminDelisted: boolean("adminDelisted").default(false).notNull(), // true = Admin 強制下架，賣家無法重新上架
  // Offer settings
  allowOffers: boolean("allowOffers").default(false).notNull(),
  minOfferHkd: decimal("minOfferHkd", { precision: 10, scale: 2 }),
  // Listing mode (buy_now | offer | auction)
  listingMode: mysqlEnum("listingMode", ["buy_now", "offer", "auction"]).default("buy_now").notNull(),
  // Auction fields
  auctionStartAt: timestamp("auctionStartAt"),
  auctionEndAt: timestamp("auctionEndAt"),
  startingBid: decimal("startingBid", { precision: 10, scale: 2 }),
  reservePrice: decimal("reservePrice", { precision: 10, scale: 2 }),
  buyNowPrice: decimal("buyNowPrice", { precision: 10, scale: 2 }),
  bidIncrement: decimal("bidIncrement", { precision: 10, scale: 2 }).default("5.00"),
  currentHighestBid: decimal("currentHighestBid", { precision: 10, scale: 2 }),
  currentHighestBidderId: int("currentHighestBidderId"),
  bidCount: int("bidCount").default(0).notNull(),
  auctionStatus: mysqlEnum("auctionStatus", [
    "draft", "pending_review", "scheduled", "active",
    "ending_soon", "ended_sold", "ended_no_bid", "cancelled", "rejected"
  ]),
  antiSnipingMinutes: int("antiSnipingMinutes").default(5).notNull(),
  antiSnipingExtensions: int("antiSnipingExtensions").default(0).notNull(),
  hasReserveMet: boolean("hasReserveMet").default(false).notNull(),
  winnerId: int("winnerId"),
  winningBidId: int("winningBidId"),
  auctionTermsVersion: varchar("auctionTermsVersion", { length: 20 }),
  // High-value risk control
  isHighValueReview: boolean("isHighValueReview").default(false).notNull(), // true = requires extra admin review (startingBid > HKD 10000)
  // Auction payment (winner pays via Stripe after auction ends)
  auctionPaymentSessionId: varchar("auctionPaymentSessionId", { length: 200 }),
  auctionPaymentStatus: mysqlEnum("auctionPaymentStatus", ["pending", "paid", "failed", "expired"]),
  auctionPaymentPaidAt: timestamp("auctionPaymentPaidAt"),
  auctionOrderId: int("auctionOrderId"),
  // Metadata
  viewCount: int("viewCount").default(0).notNull(),
  listedAt: timestamp("listedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  sellerTypeIdx: index("ml_sellerType_idx").on(table.sellerType),
  sellerIdIdx: index("ml_sellerId_idx").on(table.sellerId),
  statusIdx: index("ml_status_idx").on(table.status),
  cardIdIdx: index("ml_cardId_idx").on(table.cardId),
  listingModeIdx: index("ml_listingMode_idx").on(table.listingMode),
  auctionStatusIdx: index("ml_auctionStatus_idx").on(table.auctionStatus),
  auctionEndAtIdx: index("ml_auctionEndAt_idx").on(table.auctionEndAt),
}));
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = typeof marketplaceListings.$inferInsert;

/**
 * Marketplace Orders - buyer orders
 */
export const marketplaceOrders = mysqlTable("marketplaceOrders", {
  id: int("id").autoincrement().primaryKey(),
  orderNo: varchar("orderNo", { length: 50 }).notNull(), // e.g. BOXIUM-20240101-001
  buyerId: int("buyerId").notNull(), // FK to users table
  listingId: int("listingId").notNull(), // FK to marketplaceListings
  sellerId: int("sellerId"), // FK to users table (null for platform listings)
  sellerType: mysqlEnum("sellerType", ["platform", "seller"]).default("platform").notNull(),
  unitPriceHkd: decimal("unitPriceHkd", { precision: 10, scale: 2 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  // Amounts (HKD)
  subtotalHkd: decimal("subtotalHkd", { precision: 10, scale: 2 }).notNull(),
  platformFeeRate: decimal("platformFeeRate", { precision: 5, scale: 4 }).default("0.0500").notNull(),
  platformFeeHkd: decimal("platformFeeHkd", { precision: 10, scale: 2 }).default("0.00").notNull(),
  sellerReceivableHkd: decimal("sellerReceivableHkd", { precision: 10, scale: 2 }).notNull(),
  // Payment
  paymentMethod: mysqlEnum("paymentMethod", ["stripe", "alipay_hk"]).notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 200 }),
  stripeChargeId: varchar("stripeChargeId", { length: 200 }),
  stripeTransferId: varchar("stripeTransferId", { length: 200 }),
  alipayProofImageUrl: text("alipayProofImageUrl"), // S3 URL of payment proof screenshot
  alipayProofSubmittedAt: timestamp("alipayProofSubmittedAt"), // When buyer submitted the proof screenshot
  alipayReviewReminderSentAt: timestamp("alipayReviewReminderSentAt"), // When 24hr reminder was sent to admin
  alipayProofStatus: mysqlEnum("alipayProofStatus", ["pending_review", "approved", "rejected"]), // Proof review status visible to buyer
  aiVerificationResult: text("aiVerificationResult"), // JSON: { verified, detectedAmount, confidence, reason }
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded", "cancelled"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"), // When payment was confirmed
  // Order status
  orderStatus: mysqlEnum("orderStatus", [
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
  ]).default("pending_payment").notNull(),
  // Shipping
  shippingName: varchar("shippingName", { length: 100 }),
  shippingPhone: varchar("shippingPhone", { length: 30 }),
  buyerPhone: varchar("buyerPhone", { length: 30 }),
  shippingAddress: text("shippingAddress"), // JSON
  shippingMethod: mysqlEnum("shippingMethod", ["sf_express", "hk_post", "sf_cod", "hongkong_post", "other", "meetup"]),
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  shippedAt: timestamp("shippedAt"),
  autoCompleteAt: timestamp("autoCompleteAt"), // 14 days after delivered
  buyerConfirmedAt: timestamp("buyerConfirmedAt"),
  payoutHoldUntil: timestamp("payoutHoldUntil"), // 48-hour cooling period after buyer confirms receipt; payout triggers only after this timestamp (and no active dispute)
  disputeOpenedAt: timestamp("disputeOpenedAt"),
  disputeReason: text("disputeReason"),
  disputeEvidenceUrls: text("disputeEvidenceUrls"), // JSON array of S3 URLs
  disputeResolvedAt: timestamp("disputeResolvedAt"),
  disputeResolution: text("disputeResolution"),
  disputeResolutionHistory: text("disputeResolutionHistory"), // JSON array of {timestamp, outcome, resolution, adminNote}
  disputePriority: mysqlEnum("disputePriority", ["high", "medium", "low"]).default("medium"),
  disputeDeadlineAt: timestamp("disputeDeadlineAt"), // P2 Fix #10: SLA deadline for dispute resolution
  shippingImageUrl: text("shippingImageUrl"), // S3 URL of shipping proof photo uploaded by seller
  shippingReminderSentAt: timestamp("shippingReminderSentAt"), // tracks when overdue reminder was sent
  paymentReminderSentAt: timestamp("paymentReminderSentAt"), // tracks when 12-hour payment reminder was sent
  confirmReceiptReminderSentAt: timestamp("confirmReceiptReminderSentAt"), // tracks when 7-day confirm receipt reminder was sent
  payoutStatus: mysqlEnum("payoutStatus", ["not_applicable", "pending", "processing", "completed", "paid", "failed", "hold"]).default("pending").notNull(),
  stripeTransferError: text("stripeTransferError"),
  manualPayoutAt: timestamp("manualPayoutAt"), // For alipay_hk orders: when admin manually paid out
  manualPayoutNote: varchar("manualPayoutNote", { length: 500 }), // Admin note for manual payout
  manualPayoutProofUrl: text("manualPayoutProofUrl"), // S3 URL of payment proof screenshot
  adminNote: text("adminNote"), // Admin internal note for this order
  paymentRejectionReason: text("paymentRejectionReason"), // Reason for rejecting alipay payment (shown to buyer)
  // P1 Fix #5: Alipay HK refund tracking
  alipayRefundStatus: mysqlEnum("alipayRefundStatus", ["not_applicable", "pending", "processing", "completed"]).default("not_applicable"),
  alipayRefundAmount: decimal("alipayRefundAmount", { precision: 10, scale: 2 }),
  alipayRefundRequestedAt: timestamp("alipayRefundRequestedAt"),
  alipayRefundCompletedAt: timestamp("alipayRefundCompletedAt"),
  alipayRefundNote: text("alipayRefundNote"), // Admin note for refund
  alipayRefundProofUrl: text("alipayRefundProofUrl"), // S3 URL of refund proof screenshot
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 200 }),
  batchRef: varchar("batchRef", { length: 100 }),
  cartOrderId: int("cartOrderId"),
  // Auction order fields
  orderSource: mysqlEnum("orderSource", ["direct", "offer", "auction"]).default("direct").notNull(),
  auctionListingId: int("auctionListingId"),
  auctionWinningBidId: int("auctionWinningBidId"),
}, (table) => ({
  orderNoIdx: index("mo_orderNo_idx").on(table.orderNo),
  buyerIdIdx: index("mo_buyerId_idx").on(table.buyerId),
  orderStatusIdx: index("mo_orderStatus_idx").on(table.orderStatus),
  paymentStatusIdx: index("mo_paymentStatus_idx").on(table.paymentStatus),
  // P0-3 Fix: Prevent duplicate auction orders (race condition protection)
  // Each auction listing can only have one order
  auctionListingUniqueIdx: uniqueIndex("mo_unique_auction_listing").on(table.auctionListingId),
}));
export type MarketplaceOrder = typeof marketplaceOrders.$inferSelect;
export type InsertMarketplaceOrder = typeof marketplaceOrders.$inferInsert;

/**
 * Cart Orders - P1 Master order grouping multiple sub-orders from one checkout
 * One cart order = one Stripe Checkout Session = one payment
 * stripeChargeId is critical for Stripe Connect Transfers (source_transaction)
 */
export const cartOrders = mysqlTable("cartOrders", {
  id: int("id").autoincrement().primaryKey(),
  buyerId: int("buyerId").notNull(), // FK to users
  totalSubtotalHkd: decimal("totalSubtotalHkd", { precision: 10, scale: 2 }).notNull(),
  totalPlatformFeeHkd: decimal("totalPlatformFeeHkd", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalSellerReceivableHkd: decimal("totalSellerReceivableHkd", { precision: 10, scale: 2 }).notNull(),
  hasSellerItems: boolean("hasSellerItems").default(false).notNull(), // true if any sub-order is from a C2C seller
  availablePaymentMethods: varchar("availablePaymentMethods", { length: 50 }).notNull().default("stripe,alipay_hk"), // CSV: "stripe" or "stripe,alipay_hk"
  paymentRestrictionReason: text("paymentRestrictionReason"), // Human-readable reason shown to buyer
  // Stripe identifiers
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 200 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 200 }),
  stripeChargeId: varchar("stripeChargeId", { length: 200 }), // CRITICAL: needed as source_transaction for Stripe Transfers
  // Payment status of the master order
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "succeeded", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  buyerIdIdx: index("co_buyerId_idx").on(table.buyerId),
  stripeSessionIdx: index("co_stripeSession_idx").on(table.stripeCheckoutSessionId),
  paymentStatusIdx: index("co_paymentStatus_idx").on(table.paymentStatus),
}));
export type CartOrder = typeof cartOrders.$inferSelect;
export type InsertCartOrder = typeof cartOrders.$inferInsert;

/**
 * Marketplace Order Items - line items for each order
 */
export const marketplaceOrderItems = mysqlTable("marketplaceOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // FK to marketplaceOrders
  listingId: int("listingId").notNull(), // FK to marketplaceListings
  sellerId: int("sellerId"), // NULL for platform items, sellerProfiles.id for C2C
  sellerType: mysqlEnum("sellerType", ["platform", "seller"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(), // snapshot at time of purchase
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // HKD, snapshot
  quantity: int("quantity").default(1).notNull(),
  // Payout tracking for C2C sellers
  payoutStatus: mysqlEnum("payoutStatus", ["pending", "processing", "paid", "failed"]).default("pending").notNull(),
  stripeTransferId: varchar("stripeTransferId", { length: 200 }),
  paidOutAt: timestamp("paidOutAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("moi_orderId_idx").on(table.orderId),
  listingIdIdx: index("moi_listingId_idx").on(table.listingId),
  sellerIdIdx: index("moi_sellerId_idx").on(table.sellerId),
}));
export type MarketplaceOrderItem = typeof marketplaceOrderItems.$inferSelect;
export type InsertMarketplaceOrderItem = typeof marketplaceOrderItems.$inferInsert;

/**
 * Marketplace Payouts - payout records for C2C sellers
 */
export const marketplacePayouts = mysqlTable("marketplacePayouts", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // FK to marketplaceOrders
  sellerId: int("sellerId").notNull(), // FK to sellerProfiles
  amountHkd: decimal("amountHkd", { precision: 10, scale: 2 }).notNull(), // HKD amount
  stripeTransferId: varchar("stripeTransferId", { length: 200 }),
  status: mysqlEnum("status", ["pending", "processing", "paid", "failed"]).default("pending").notNull(),
  failureReason: text("failureReason"),
  retryCount: int("retryCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  sellerIdIdx: index("mp_sellerId_idx").on(table.sellerId),
  statusIdx: index("mp_status_idx").on(table.status),
}));
export type MarketplacePayout = typeof marketplacePayouts.$inferSelect;
export type InsertMarketplacePayout = typeof marketplacePayouts.$inferInsert;

/**
 * Marketplace Banners - admin-managed banner slides for the marketplace carousel
 */
export const marketplaceBanners = mysqlTable("marketplaceBanners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: varchar("subtitle", { length: 300 }).default("").notNull(),
  cta: varchar("cta", { length: 100 }).default("立即選購").notNull(),
  ctaConditions: varchar("ctaConditions", { length: 500 }).default("[]").notNull(), // JSON array of condition values
  ctaSellerType: varchar("ctaSellerType", { length: 20 }).default("all").notNull(), // "all" | "platform" | "seller"
  gradient: varchar("gradient", { length: 200 }).default("from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]").notNull(),
  accentColor: varchar("accentColor", { length: 20 }).default("#FFD700").notNull(),
  badge: varchar("badge", { length: 50 }).default("").notNull(),
  badgeClass: varchar("badgeClass", { length: 100 }).default("bg-yellow-400 text-[#06038d]").notNull(),
  emoji: varchar("emoji", { length: 10 }).default("🏆").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }).default("").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  isActiveIdx: index("mb_isActive_idx").on(table.isActive),
  sortOrderIdx: index("mb_sortOrder_idx").on(table.sortOrder),
}));
export type MarketplaceBanner = typeof marketplaceBanners.$inferSelect;
export type InsertMarketplaceBanner = typeof marketplaceBanners.$inferInsert;

/**
 * Wishlists - users can save marketplace listings to their wishlist
 */
export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK to users
  listingId: int("listingId").notNull(), // FK to marketplaceListings
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("wl_userId_idx").on(table.userId),
  listingIdIdx: index("wl_listingId_idx").on(table.listingId),
  uniqueUserListing: index("wl_unique_user_listing").on(table.userId, table.listingId),
}));
export type Wishlist = typeof wishlists.$inferSelect;
export type InsertWishlist = typeof wishlists.$inferInsert;

/**
 * Marketplace Reviews - buyers can leave reviews for sellers after order completion
 */
export const marketplaceReviews = mysqlTable("marketplaceReviews", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  listingId: int("listingId").notNull(),
  buyerId: int("buyerId").notNull(),
  sellerId: int("sellerId").notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  isAnonymous: boolean("isAnonymous").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("mr_orderId_idx").on(table.orderId),
  sellerIdIdx: index("mr_sellerId_idx").on(table.sellerId),
  buyerIdIdx: index("mr_buyerId_idx").on(table.buyerId),
  uniqueOrderReview: uniqueIndex("mr_unique_order").on(table.orderId),
}));
export type MarketplaceReview = typeof marketplaceReviews.$inferSelect;
export type InsertMarketplaceReview = typeof marketplaceReviews.$inferInsert;


/**
 * User Shipping Addresses - saved addresses for checkout
 */
export const userShippingAddresses = mysqlTable("userShippingAddresses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 50 }).default("預設地址").notNull(),
  addressType: mysqlEnum("addressType", ["normal", "sf_station"]).default("normal").notNull(),
  recipientName: varchar("recipientName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  district: varchar("district", { length: 50 }),
  region: varchar("region", { length: 50 }).default("香港").notNull(),
  sfStationCode: varchar("sfStationCode", { length: 20 }), // SF Express station code e.g. HK-0001
  sfStationName: varchar("sfStationName", { length: 100 }), // SF Express station display name
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("usa_userId_idx").on(table.userId),
}));
export type UserShippingAddress = typeof userShippingAddresses.$inferSelect;
export type InsertUserShippingAddress = typeof userShippingAddresses.$inferInsert;

/**
 * Offers - buyers can make offers on listings that allow it
 */
export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(), // FK to marketplaceListings
  buyerId: int("buyerId").notNull(), // FK to users
  sellerId: int("sellerId").notNull(), // FK to users (via sellerProfiles.userId)
  sellerProfileId: int("sellerProfileId").notNull(), // FK to sellerProfiles
  offerPriceHkd: decimal("offerPriceHkd", { precision: 10, scale: 2 }).notNull(),
  message: text("message"), // optional message from buyer
  status: mysqlEnum("status", ["pending", "accepted", "rejected", "expired", "cancelled"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // 48 hours from creation
  respondedAt: timestamp("respondedAt"),
  rejectionReason: text("rejectionReason"),
  // If accepted, this links to the resulting order
  orderId: int("orderId"),
  expiryReminderSentAt: timestamp("expiryReminderSentAt"), // set when 6-hour expiry reminder is sent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  listingIdIdx: index("offer_listingId_idx").on(table.listingId),
  buyerIdIdx: index("offer_buyerId_idx").on(table.buyerId),
  sellerIdIdx: index("offer_sellerId_idx").on(table.sellerId),
  statusIdx: index("offer_status_idx").on(table.status),
}));
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;

/**
 * ListingReports - buyers can report suspicious or rule-violating listings
 */
export const listingReports = mysqlTable("listingReports", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(), // FK to marketplaceListings
  reporterId: int("reporterId").notNull(), // FK to users
  reason: mysqlEnum("reason", ["fake_item", "wrong_description", "prohibited_item", "scam", "other"]).notNull(),
  details: text("details"),
  status: mysqlEnum("status", ["pending", "reviewed", "dismissed", "actioned"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  listingIdIdx: index("lr_listingId_idx").on(table.listingId),
  reporterIdIdx: index("lr_reporterId_idx").on(table.reporterId),
  statusIdx: index("lr_status_idx").on(table.status),
}));
export type ListingReport = typeof listingReports.$inferSelect;
export type InsertListingReport = typeof listingReports.$inferInsert;

/**
 * Order Status History - tracks every status change for admin audit trail
 */
export const orderStatusHistory = mysqlTable("orderStatusHistory", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // FK to marketplaceOrders
  fromStatus: varchar("fromStatus", { length: 50 }), // previous status (null for first entry)
  toStatus: varchar("toStatus", { length: 50 }).notNull(), // new status
  operatorId: int("operatorId"), // FK to users (null = system)
  operatorName: varchar("operatorName", { length: 100 }), // snapshot of operator name
  note: varchar("note", { length: 500 }), // optional admin note
  entryType: varchar("entryType", { length: 20 }).default('status_change').notNull(), // 'status_change' | 'note'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("osh_orderId_idx").on(table.orderId),
  createdAtIdx: index("osh_createdAt_idx").on(table.createdAt),
}));
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type InsertOrderStatusHistory = typeof orderStatusHistory.$inferInsert;

/**
 * Marketplace Search Logs - records search keywords for hot search statistics
 */
export const marketplaceSearchLogs = mysqlTable("marketplaceSearchLogs", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 200 }).notNull(),
  tcgSeries: varchar("tcgSeries", { length: 50 }),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  keywordIdx: index("msl_keyword_idx").on(table.keyword),
  createdAtIdx: index("msl_createdAt_idx").on(table.createdAt),
}));
export type MarketplaceSearchLog = typeof marketplaceSearchLogs.$inferSelect;
export type InsertMarketplaceSearchLog = typeof marketplaceSearchLogs.$inferInsert;

/**
 * Cart Items - stores items added to user's shopping cart
 * Each row represents one listing in a user's cart (qty always 1 for single cards)
 */
export const cartItems = mysqlTable("cartItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK to users
  listingId: int("listingId").notNull(), // FK to marketplaceListings
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // 14 days after addedAt
}, (table) => ({
  userIdIdx: index("cart_userId_idx").on(table.userId),
  listingIdIdx: index("cart_listingId_idx").on(table.listingId),
  uniqueUserListing: uniqueIndex("cart_user_listing_unique").on(table.userId, table.listingId),
}));
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;


/**
 * Email Unsubscribe - stores user email notification preferences
 * Users can unsubscribe from specific email types or all emails.
 */
export const emailUnsubscribes = mysqlTable("emailUnsubscribes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  // null = unsubscribe from all; specific type = unsubscribe from that type only
  emailType: varchar("emailType", { length: 64 }), // e.g. "offer", "order", "review", "system", null = all
  token: varchar("token", { length: 64 }).notNull().unique(), // used in unsubscribe link
  unsubscribedAt: timestamp("unsubscribedAt").defaultNow().notNull(),
  resubscribedAt: timestamp("resubscribedAt"), // null = still unsubscribed
}, (table) => ({
  userIdIdx: index("eu_userId_idx").on(table.userId),
  emailIdx: index("eu_email_idx").on(table.email),
  tokenIdx: uniqueIndex("eu_token_idx").on(table.token),
}));
export type EmailUnsubscribe = typeof emailUnsubscribes.$inferSelect;
export type InsertEmailUnsubscribe = typeof emailUnsubscribes.$inferInsert;

/**
 * Email Log - records every email sent by the platform
 */
export const emailLogs = mysqlTable("emailLogs", {
  id: int("id").autoincrement().primaryKey(),
  toEmail: varchar("toEmail", { length: 255 }).notNull(),
  toUserId: int("toUserId"), // nullable (e.g. system emails)
  subject: varchar("subject", { length: 500 }).notNull(),
  emailType: varchar("emailType", { length: 64 }).notNull(), // "offer", "order", "welcome", "review", etc.
  status: mysqlEnum("status", ["sent", "failed", "skipped"]).notNull().default("sent"),
  errorMessage: text("errorMessage"), // populated on failure
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  dedupeKey: varchar("dedupeKey", { length: 200 }), // e.g. 'order_shipped_buyer_123' — prevents duplicate sends
}, (table) => ({
  toEmailIdx: index("el_toEmail_idx").on(table.toEmail),
  toUserIdIdx: index("el_toUserId_idx").on(table.toUserId),
  emailTypeIdx: index("el_emailType_idx").on(table.emailType),
  statusIdx: index("el_status_idx").on(table.status),
  sentAtIdx: index("el_sentAt_idx").on(table.sentAt),
  dedupeKeyIdx: index("el_dedupeKey_idx").on(table.dedupeKey),
}));
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;


/**
 * Admin Audit Logs - tracks all admin actions for accountability
 */
export const adminAuditLogs = mysqlTable("adminAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(), // FK to users table
  action: varchar("action", { length: 100 }).notNull(), // e.g. "confirm_alipay", "suspend_seller", "resolve_dispute"
  targetType: varchar("targetType", { length: 50 }).notNull(), // e.g. "order", "seller", "listing"
  targetId: int("targetId"), // ID of the affected record
  details: text("details"), // JSON string with before/after or context
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  adminIdIdx: index("aal_adminId_idx").on(table.adminId),
  actionIdx: index("aal_action_idx").on(table.action),
  targetIdx: index("aal_target_idx").on(table.targetType, table.targetId),
  createdAtIdx: index("aal_createdAt_idx").on(table.createdAt),
}));
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;

export const marketplaceWhitelist = mysqlTable("marketplaceWhitelist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  addedBy: int("addedBy").notNull(),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex("mw_userId_idx").on(table.userId),
}));
export type MarketplaceWhitelist = typeof marketplaceWhitelist.$inferSelect;
export type InsertMarketplaceWhitelist = typeof marketplaceWhitelist.$inferInsert;


/**
 * P1 Fix #4: Order Messages - Internal messaging system for order communication
 * Allows buyers, sellers, and admins to communicate within an order context.
 * Replaces the need to expose phone numbers before order completion.
 */
export const orderMessages = mysqlTable("orderMessages", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // FK to marketplaceOrders
  orderNo: varchar("orderNo", { length: 64 }).notNull(),
  senderId: int("senderId").notNull(), // FK to users
  senderRole: mysqlEnum("senderRole", ["buyer", "seller", "admin"]).notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"), // optional image attachment (S3 URL)
  isSystemMessage: boolean("isSystemMessage").default(false).notNull(), // for auto-generated messages
  readByBuyer: boolean("readByBuyer").default(false).notNull(),
  readBySeller: boolean("readBySeller").default(false).notNull(),
  readByAdmin: boolean("readByAdmin").default(false).notNull(),
  readAtBuyer: timestamp("readAtBuyer"),
  readAtSeller: timestamp("readAtSeller"),
  readAtAdmin: timestamp("readAtAdmin"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("om_orderId_idx").on(table.orderId),
  orderNoIdx: index("om_orderNo_idx").on(table.orderNo),
  senderIdx: index("om_senderId_idx").on(table.senderId),
  createdAtIdx: index("om_createdAt_idx").on(table.createdAt),
}));
export type OrderMessage = typeof orderMessages.$inferSelect;
export type InsertOrderMessage = typeof orderMessages.$inferInsert;

/**
 * Dispute Media — evidence uploaded by buyers/sellers during a dispute
 * Stores S3 URLs for images/videos attached to a disputed order.
 */
export const disputeMedia = mysqlTable("disputeMedia", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  orderNo: varchar("orderNo", { length: 64 }).notNull(),
  uploaderId: int("uploaderId").notNull(), // FK to users
  uploaderRole: mysqlEnum("uploaderRole", ["buyer", "seller", "admin"]).notNull(),
  mediaUrl: text("mediaUrl").notNull(), // S3 URL
  mediaType: mysqlEnum("mediaType", ["image", "video"]).default("image").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: int("fileSize"), // bytes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("dm_orderId_idx").on(table.orderId),
  orderNoIdx: index("dm_orderNo_idx").on(table.orderNo),
  uploaderIdx: index("dm_uploaderId_idx").on(table.uploaderId),
}));
export type DisputeMedia = typeof disputeMedia.$inferSelect;
export type InsertDisputeMedia = typeof disputeMedia.$inferInsert;

// ============================================================
// AUCTION FEATURE TABLES
// ============================================================

/**
 * Auction Bids - records every bid placed on an auction listing
 */
export const auctionBids = mysqlTable("auctionBids", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  bidderId: int("bidderId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["active", "outbid", "winning", "retracted"]).default("active").notNull(),
  ipHash: varchar("ipHash", { length: 64 }),
  userAgent: text("userAgent"),
  // Deposit (pre-authorization) fields
  depositAmountHkd: decimal("depositAmountHkd", { precision: 10, scale: 2 }),
  depositPaymentIntentId: varchar("depositPaymentIntentId", { length: 200 }),
  depositStatus: mysqlEnum("depositStatus", ["none", "held", "released", "captured"]).default("none").notNull(),
  depositHeldAt: timestamp("depositHeldAt"),
  depositReleasedAt: timestamp("depositReleasedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  listingIdIdx: index("ab_listingId_idx").on(table.listingId),
  bidderIdIdx: index("ab_bidderId_idx").on(table.bidderId),
  statusIdx: index("ab_status_idx").on(table.status),
}));
export type AuctionBid = typeof auctionBids.$inferSelect;
export type InsertAuctionBid = typeof auctionBids.$inferInsert;

/**
 * Auction Agreements - records buyer/seller terms acceptance
 */
export const auctionAgreements = mysqlTable("auctionAgreements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["buyer", "seller"]).notNull(),
  termsVersion: varchar("termsVersion", { length: 20 }).notNull(),
  agreedAt: timestamp("agreedAt").defaultNow().notNull(),
  ipHash: varchar("ipHash", { length: 64 }),
}, (table) => ({
  userIdIdx: index("aa_userId_idx").on(table.userId),
  userRoleVersionIdx: uniqueIndex("aa_user_role_version_idx").on(table.userId, table.role, table.termsVersion),
}));
export type AuctionAgreement = typeof auctionAgreements.$inferSelect;
export type InsertAuctionAgreement = typeof auctionAgreements.$inferInsert;

/**
 * Auction Violations - tracks rule violations
 */
export const auctionViolations = mysqlTable("auctionViolations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["no_payment", "fake_bid", "seller_cancel"]).notNull(),
  listingId: int("listingId"),
  orderId: int("orderId"),
  penalty: mysqlEnum("penalty", ["warning", "ban_7d", "ban_30d", "permanent"]).notNull(),
  banExpiresAt: timestamp("banExpiresAt"),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("av_userId_idx").on(table.userId),
  typeIdx: index("av_type_idx").on(table.type),
}));
export type AuctionViolation = typeof auctionViolations.$inferSelect;
export type InsertAuctionViolation = typeof auctionViolations.$inferInsert;

/**
 * Listing Moderation Logs - audit trail for all admin actions on listings
 */
export const listingModerationLogs = mysqlTable("listingModerationLogs", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  listingMode: mysqlEnum("listingMode", ["direct", "auction"]).notNull().default("direct"),
  adminId: int("adminId").notNull(),
  adminName: varchar("adminName", { length: 100 }),
  action: mysqlEnum("action", [
    "delist", "restore", "batch_delist", "batch_restore", "flag_risk", "clear_flag", "edit",
  ]).notNull(),
  reason: text("reason"),
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  listingIdIdx: index("lml_listingId_idx").on(table.listingId),
  adminIdIdx: index("lml_adminId_idx").on(table.adminId),
  createdAtIdx: index("lml_createdAt_idx").on(table.createdAt),
}));
export type ListingModerationLog = typeof listingModerationLogs.$inferSelect;
export type InsertListingModerationLog = typeof listingModerationLogs.$inferInsert;

/**
 * Platform Rules - configurable rules and policies
 */
export const platformRules = mysqlTable("platformRules", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", ["listing", "auction", "payment", "shipping", "conduct", "seller"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("pr_category_idx").on(table.category),
  isActiveIdx: index("pr_isActive_idx").on(table.isActive),
}));
export type PlatformRule = typeof platformRules.$inferSelect;
export type InsertPlatformRule = typeof platformRules.$inferInsert;

/**
 * Product Categories - configurable categories for marketplace listings
 */
export const productCategories = mysqlTable("productCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  parentId: int("parentId"),
  tcgSeries: varchar("tcgSeries", { length: 50 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex("pc_slug_idx").on(table.slug),
  isActiveIdx: index("pc_isActive_idx").on(table.isActive),
}));
export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;

/**
 * Seller Risk Profiles - tracks seller risk signals for governance
 */
export const sellerRiskProfiles = mysqlTable("sellerRiskProfiles", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"]).default("low").notNull(),
  totalListings: int("totalListings").default(0).notNull(),
  delistedCount: int("delistedCount").default(0).notNull(),
  reportCount: int("reportCount").default(0).notNull(),
  disputeCount: int("disputeCount").default(0).notNull(),
  lastReviewAt: timestamp("lastReviewAt"),
  adminNote: text("adminNote"),
  isWatched: boolean("isWatched").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  sellerIdIdx: uniqueIndex("srp_sellerId_idx").on(table.sellerId),
  riskLevelIdx: index("srp_riskLevel_idx").on(table.riskLevel),
  isWatchedIdx: index("srp_isWatched_idx").on(table.isWatched),
}));
export type SellerRiskProfile = typeof sellerRiskProfiles.$inferSelect;
export type InsertSellerRiskProfile = typeof sellerRiskProfiles.$inferInsert;

/**
 * Security Events - persistent log of bot blocks, rate limits, upload rejections, manual blocks
 * Replaces in-memory securityLog array; survives server restarts
 */
export const securityEvents = mysqlTable("securityEvents", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["BOT_BLOCKED", "RATE_LIMITED", "UPLOAD_REJECTED", "MANUAL_BLOCK"]).notNull(),
  ip: varchar("ip", { length: 45 }).notNull(),
  userAgent: text("userAgent"),
  path: varchar("path", { length: 500 }),
  reason: varchar("reason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ipIdx: index("se_ip_idx").on(table.ip),
  typeIdx: index("se_type_idx").on(table.type),
  createdAtIdx: index("se_createdAt_idx").on(table.createdAt),
}));
export type DbSecurityEvent = typeof securityEvents.$inferSelect;
export type InsertDbSecurityEvent = typeof securityEvents.$inferInsert;

/**
 * Blocked IPs - persistent manual block list; survives server restarts
 */
export const blockedIps = mysqlTable("blockedIps", {
  ip: varchar("ip", { length: 45 }).primaryKey(),
  reason: varchar("reason", { length: 500 }).notNull(),
  blockedBy: varchar("blockedBy", { length: 100 }).default("admin").notNull(),
  blockedAt: timestamp("blockedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
}, (table) => ({
  isActiveIdx: index("bi_isActive_idx").on(table.isActive),
}));
export type BlockedIp = typeof blockedIps.$inferSelect;
export type InsertBlockedIp = typeof blockedIps.$inferInsert;

export const adminIpWhitelist = mysqlTable("adminIpWhitelist", {
  ip: varchar("ip", { length: 45 }).primaryKey(),
  addedBy: varchar("addedBy", { length: 100 }).default("admin").notNull(),
  note: varchar("note", { length: 200 }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});
export type AdminIpWhitelist = typeof adminIpWhitelist.$inferSelect;
export type InsertAdminIpWhitelist = typeof adminIpWhitelist.$inferInsert;


// ─────────────────────────────────────────────────────────────────────────────
// PSA Grading Service Tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PSA Grading Service Tiers - Admin-manageable service levels
 */
export const gradingServiceTiers = mysqlTable("gradingServiceTiers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  feeHkd: decimal("feeHkd", { precision: 10, scale: 2 }).notNull(),
  maxDeclaredValueUsd: decimal("maxDeclaredValueUsd", { precision: 10, scale: 2 }).notNull(),
  estimatedDaysMin: int("estimatedDaysMin").notNull(),
  estimatedDaysMax: int("estimatedDaysMax").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  isActiveIdx: index("gst_isActive_idx").on(table.isActive),
  sortOrderIdx: index("gst_sortOrder_idx").on(table.sortOrder),
}));
export type GradingServiceTier = typeof gradingServiceTiers.$inferSelect;
export type InsertGradingServiceTier = typeof gradingServiceTiers.$inferInsert;

/**
 * PSA Grading Batches - Submission batches (出團批次)
 */
export const gradingBatches = mysqlTable("gradingBatches", {
  id: int("id").autoincrement().primaryKey(),
  batchName: varchar("batchName", { length: 128 }).notNull(),
  cutoffDate: timestamp("cutoffDate").notNull(),
  shippedDate: timestamp("shippedDate"),
  expectedReturnDate: timestamp("expectedReturnDate"),
  status: mysqlEnum("status", ["open", "closed", "shipped", "returned"]).default("open").notNull(),
  batchCostHkd: decimal("batchCostHkd", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("gb_status_idx").on(table.status),
  cutoffDateIdx: index("gb_cutoffDate_idx").on(table.cutoffDate),
}));
export type GradingBatch = typeof gradingBatches.$inferSelect;
export type InsertGradingBatch = typeof gradingBatches.$inferInsert;

/**
 * PSA Grading Submissions - Customer grading applications
 */
export const gradingSubmissions = mysqlTable("gradingSubmissions", {
  id: int("id").autoincrement().primaryKey(),
  orderNo: varchar("orderNo", { length: 32 }).notNull().unique(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", [
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
  ]).default("awaiting_payment").notNull(),
  totalFeeHkd: decimal("totalFeeHkd", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["stripe", "alipay_hk"]),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  batchId: int("batchId"),
  shippingDeadline: timestamp("shippingDeadline"),
  paymentDeadline: timestamp("paymentDeadline"),
  gradedAt: timestamp("gradedAt"),
  adminNotes: text("adminNotes"),
  adminNotesHistory: text("adminNotesHistory"), // JSON array of {timestamp, note, adminName, statusAtTime}
  returnTrackingNo: varchar("returnTrackingNo", { length: 128 }),
  paymentDueAt: timestamp("paymentDueAt"),
  day15ReminderSentAt: timestamp("day15ReminderSentAt"),
  day25ReminderSentAt: timestamp("day25ReminderSentAt"),
  alipayProofImageUrl: text("alipayProofImageUrl"),
  alipayProofStatus: mysqlEnum("alipayProofStatus", ["pending_review", "approved", "rejected"]),
  alipayProofSubmittedAt: timestamp("alipayProofSubmittedAt"),
  alipayProofRejectionReason: text("alipayProofRejectionReason"),
  // AI verification fields for alipay proof
  alipayProofAiResult: mysqlEnum("alipayProofAiResult", ["pass", "warning", "fail"]),
  alipayProofAiConfidence: mysqlEnum("alipayProofAiConfidence", ["high", "medium", "low"]),
  alipayProofAiSummary: text("alipayProofAiSummary"),
  alipayProofAiCheckedAt: timestamp("alipayProofAiCheckedAt"),
  // Buyer shipping tracking
  trackingNumber: varchar("trackingNumber", { length: 100 }), // SF Express tracking number submitted by buyer
  trackingSubmittedAt: timestamp("trackingSubmittedAt"),
  // Initial grading fee payment
  paidAt: timestamp("paidAt"), // When the initial grading fee was confirmed (pay-first flow: pending_shipment; post-grading flow: completed)
  // Tier upgrade fields (admin can upgrade tier after grading, user pays the diff)
  upgradeCheckoutSessionId: varchar("upgradeCheckoutSessionId", { length: 128 }),
  upgradeDiffFeeHkd: decimal("upgradeDiffFeeHkd", { precision: 10, scale: 2 }),
  upgradeNewTierId: int("upgradeNewTierId"),
  upgradeItemIds: varchar("upgradeItemIds", { length: 512 }), // Comma-separated item IDs that were upgraded
  upgradeCheckoutAt: timestamp("upgradeCheckoutAt"), // When the upgrade checkout was created
  upgradePaidAt: timestamp("upgradePaidAt"),
  upgradeReminderSentAt: timestamp("upgradeReminderSentAt"), // Last time overdue reminder was sent (for dedup)
  returnAddress: text("returnAddress"), // JSON: { recipientName, phone, address, district, region, sfStationCode?, sfStationName? }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("gs_userId_idx").on(table.userId),
  statusIdx: index("gs_status_idx").on(table.status),
  orderNoIdx: index("gs_orderNo_idx").on(table.orderNo),
  batchIdIdx: index("gs_batchId_idx").on(table.batchId),
}));
export type GradingSubmission = typeof gradingSubmissions.$inferSelect;
export type InsertGradingSubmission = typeof gradingSubmissions.$inferInsert;

/**
 * PSA Grading Submission Items - Individual cards in each submission
 */
export const gradingSubmissionItems = mysqlTable("gradingSubmissionItems", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  cardSet: varchar("cardSet", { length: 256 }),
  cardNumber: varchar("cardNumber", { length: 64 }),
  cardLanguage: mysqlEnum("cardLanguage", ["zh_tw", "ja", "en", "ko", "other"]).default("en").notNull(),
  cardImageUrl: text("cardImageUrl"),
  tierId: int("tierId").notNull(),
  feeHkd: decimal("feeHkd", { precision: 10, scale: 2 }).notNull(),
  condition: mysqlEnum("condition", ["mint", "near_mint", "excellent"]).default("near_mint").notNull(),
  notes: text("notes"),
  psaCertNumber: varchar("psaCertNumber", { length: 64 }),
  psaGrade: varchar("psaGrade", { length: 16 }),
  itemStatus: mysqlEnum("itemStatus", [
    "pending",
    "received",
    "submitted",
    "graded",
    "returned"
  ]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  submissionIdIdx: index("gsi_submissionId_idx").on(table.submissionId),
  tierIdIdx: index("gsi_tierId_idx").on(table.tierId),
}));
export type GradingSubmissionItem = typeof gradingSubmissionItems.$inferSelect;
export type InsertGradingSubmissionItem = typeof gradingSubmissionItems.$inferInsert;

/**
 * PSA Grading Reviews - User reviews for completed grading submissions
 */
export const gradingReviews = mysqlTable("gradingReviews", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull().unique(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(), // 1-5
  comment: text("comment"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  submissionIdIdx: index("gr_submissionId_idx").on(table.submissionId),
  userIdIdx: index("gr_userId_idx").on(table.userId),
}));
export type GradingReview = typeof gradingReviews.$inferSelect;
export type InsertGradingReview = typeof gradingReviews.$inferInsert;


/**
 * Card Inventory - Buy/Sell records for company tax reporting
 * Tracks card purchases (buy-in) and sales (sell-out) with multi-currency support
 */
export const cardInventory = mysqlTable("cardInventory", {
  id: int("id").autoincrement().primaryKey(),
  // Item type: single card or sealed product (booster box, etc.)
  itemType: mysqlEnum("itemType", ["card", "sealed"]).default("card").notNull(),
  // Card/product identification
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardSet: varchar("cardSet", { length: 256 }),
  cardNumber: varchar("cardNumber", { length: 64 }),
  grade: varchar("grade", { length: 32 }), // e.g. PSA10, RAW, etc.
  // Buy-in details
  buyPriceCurrency: mysqlEnum("buyPriceCurrency", ["HKD", "JPY", "USD"]).default("HKD").notNull(),
  buyPriceOriginal: decimal("buyPriceOriginal", { precision: 12, scale: 2 }).notNull(),
  buyPriceHkd: decimal("buyPriceHkd", { precision: 12, scale: 2 }).notNull(), // converted to HKD
  buyExchangeRate: decimal("buyExchangeRate", { precision: 10, scale: 4 }).default("1.0000"), // rate used for conversion
  buyDate: timestamp("buyDate").notNull(),
  buySource: varchar("buySource", { length: 256 }), // e.g. 客戶回收, 拍賣, 市場購入
  // Status: holding (持有中) or sold (已賣出)
  status: mysqlEnum("status", ["holding", "sold"]).default("holding").notNull(),
  // Sell-out details (nullable until sold)
  sellPriceCurrency: mysqlEnum("sellPriceCurrency", ["HKD", "JPY", "USD"]).default("HKD"),
  sellPriceOriginal: decimal("sellPriceOriginal", { precision: 12, scale: 2 }),
  sellPriceHkd: decimal("sellPriceHkd", { precision: 12, scale: 2 }), // converted to HKD
  sellExchangeRate: decimal("sellExchangeRate", { precision: 10, scale: 4 }),
  sellDate: timestamp("sellDate"),
  sellChannel: varchar("sellChannel", { length: 256 }), // e.g. 平台自售, 拍賣, 直接賣出
  // Card image (from platform card database)
  imageUrl: text("imageUrl"), // image URL linked from platform cards table
  s3ImageUrl: text("s3ImageUrl"), // cached image URL in platform S3 (used for fast export)
  linkedCardId: int("linkedCardId"), // optional reference to cards.id
  // Notes
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("ci_status_idx").on(table.status),
  buyDateIdx: index("ci_buyDate_idx").on(table.buyDate),
  itemTypeIdx: index("ci_itemType_idx").on(table.itemType),
}));

export type CardInventory = typeof cardInventory.$inferSelect;
export type InsertCardInventory = typeof cardInventory.$inferInsert;

// ─── Export Jobs ─────────────────────────────────────────────────────────────
// Background export tasks (Excel/PDF) - avoids Cloud Run 60s timeout
export const exportJobs = mysqlTable("exportJobs", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  type: mysqlEnum("type", ["excel", "pdf"]).notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 0 = full year
  status: mysqlEnum("status", ["pending", "processing", "done", "error"]).default("pending").notNull(),
  progress: int("progress").default(0), // 0-100 percentage
  currentItem: int("currentItem").default(0), // current item index being processed
  totalItems: int("totalItems").default(0), // total items to process
  downloadUrl: text("downloadUrl"), // S3 URL when done
  errorMessage: text("errorMessage"),
  expiresAt: timestamp("expiresAt"), // Token expiry (for REST download auth)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ExportJob = typeof exportJobs.$inferSelect;
