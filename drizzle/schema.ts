import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
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
  source: mysqlEnum("source", ["snkrdunk", "ebay", "other"]).notNull(), // Price source
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
 * Auctions table - stores auction listings
 */
export const auctions = mysqlTable("auctions", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  sellerId: int("sellerId").notNull(), // Foreign key to users table
  title: text("title").notNull(),
  description: text("description"),
  startingPrice: decimal("startingPrice", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(),
  buyNowPrice: decimal("buyNowPrice", { precision: 10, scale: 2 }), // Optional buy now price
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(),
  grade: varchar("grade", { length: 32 }), // Card grade
  condition: varchar("condition", { length: 64 }), // Card condition
  imageUrls: text("imageUrls"), // JSON array of image URLs
  status: mysqlEnum("status", ["active", "ended", "cancelled"]).default("active").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = typeof auctions.$inferInsert;

/**
 * Bids table - stores auction bids
 */
export const bids = mysqlTable("bids", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(), // Foreign key to auctions table
  bidderId: int("bidderId").notNull(), // Foreign key to users table
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bid = typeof bids.$inferSelect;
export type InsertBid = typeof bids.$inferInsert;

/**
 * Offers table - stores buy/sell offers
 */
export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(), // Foreign key to cards table
  userId: int("userId").notNull(), // Foreign key to users table
  type: mysqlEnum("type", ["buy", "sell"]).notNull(), // Offer type
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("HKD").notNull(),
  grade: varchar("grade", { length: 32 }), // Card grade
  condition: varchar("condition", { length: 64 }), // Card condition
  description: text("description"),
  status: mysqlEnum("status", ["active", "accepted", "cancelled"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;

/**
 * Reviews table - stores user reviews and ratings
 */
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  reviewerId: int("reviewerId").notNull(), // Foreign key to users table (reviewer)
  reviewedUserId: int("reviewedUserId").notNull(), // Foreign key to users table (reviewed user)
  auctionId: int("auctionId"), // Optional foreign key to auctions table
  rating: int("rating").notNull(), // Rating (1-5)
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

/**
 * Watchlist table - stores user's watched cards
 */
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  cardId: int("cardId").notNull(), // Foreign key to cards table
  targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }), // Optional target price alert
  currency: varchar("currency", { length: 8 }).default("HKD"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;
