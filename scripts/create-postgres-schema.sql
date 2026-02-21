-- PostgreSQL Schema for BOXIUM PTCG
-- Converted from MySQL schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL UNIQUE,
  name TEXT,
  "loginMethod" VARCHAR(64),
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  "cardId" VARCHAR(128) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  "nameJa" TEXT,
  series TEXT,
  "setName" TEXT,
  "cardNumber" VARCHAR(32),
  rarity VARCHAR(64),
  language VARCHAR(16) DEFAULT 'en',
  "releaseDate" TIMESTAMP,
  "imageUrl" TEXT,
  "imageUrlHiRes" TEXT,
  artist TEXT,
  description TEXT,
  types TEXT,
  hp INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Price history table
CREATE TABLE IF NOT EXISTS "priceHistory" (
  id SERIAL PRIMARY KEY,
  "cardId" INTEGER NOT NULL,
  source VARCHAR(32) NOT NULL CHECK (source IN ('snkrdunk', 'ebay', 'tcgplayer', 'other')),
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'HKD',
  grade VARCHAR(32),
  condition VARCHAR(64),
  "listingUrl" TEXT,
  "soldAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "cardId" INTEGER NOT NULL,
  "targetPrice" DECIMAL(10, 2),
  currency VARCHAR(8) DEFAULT 'HKD',
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Market trends table
CREATE TABLE IF NOT EXISTS "marketTrends" (
  id SERIAL PRIMARY KEY,
  "cardId" INTEGER NOT NULL,
  date TIMESTAMP NOT NULL,
  "avgPrice" DECIMAL(10, 2),
  "minPrice" DECIMAL(10, 2),
  "maxPrice" DECIMAL(10, 2),
  volume INTEGER,
  currency VARCHAR(8) NOT NULL DEFAULT 'HKD',
  source VARCHAR(32),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Data sources table
CREATE TABLE IF NOT EXISTS "dataSources" (
  id SERIAL PRIMARY KEY,
  "cardId" INTEGER NOT NULL,
  source VARCHAR(32) NOT NULL CHECK (source IN ('snkrdunk', 'ebay', 'tcgplayer', 'other')),
  "sourceUrl" TEXT NOT NULL,
  "sourceIdentifier" VARCHAR(128),
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "lastFetchedAt" TIMESTAMP,
  "lastUpdatedAt" TIMESTAMP,
  "nextUpdateAt" TIMESTAMP,
  "lastFetchStatus" VARCHAR(32),
  "fetchErrorMessage" TEXT,
  "updateCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS "scheduledTasks" (
  id SERIAL PRIMARY KEY,
  "taskType" VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused')),
  "targetId" INTEGER,
  "totalItems" INTEGER,
  "processedItems" INTEGER DEFAULT 0,
  "successCount" INTEGER DEFAULT 0,
  "failureCount" INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "errorMessage" TEXT,
  metadata TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SNKRDUNK listings cache table
CREATE TABLE IF NOT EXISTS "snkrdunkListingsCache" (
  id SERIAL PRIMARY KEY,
  "cardId" INTEGER NOT NULL,
  "snkrdunkId" VARCHAR(128) NOT NULL,
  listings TEXT NOT NULL,
  "cachedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL,
  "hotExpiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "snkrdunkListingsCache_cardId_idx" ON "snkrdunkListingsCache"("cardId");
CREATE INDEX IF NOT EXISTS "snkrdunkListingsCache_expiresAt_idx" ON "snkrdunkListingsCache"("expiresAt");

-- eBay listings cache table
CREATE TABLE IF NOT EXISTS "ebayListingsCache" (
  id SERIAL PRIMARY KEY,
  "cardId" INTEGER NOT NULL,
  "searchQuery" VARCHAR(500) NOT NULL,
  listings TEXT NOT NULL,
  "cachedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL,
  "hotExpiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ebayListingsCache_cardId_idx" ON "ebayListingsCache"("cardId");
CREATE INDEX IF NOT EXISTS "ebayListingsCache_expiresAt_idx" ON "ebayListingsCache"("expiresAt");
CREATE INDEX IF NOT EXISTS "ebayListingsCache_hotExpiresAt_idx" ON "ebayListingsCache"("hotExpiresAt");

-- Firecrawl usage table
CREATE TABLE IF NOT EXISTS "firecrawlUsage" (
  id SERIAL PRIMARY KEY,
  operation VARCHAR(32) NOT NULL,
  url TEXT,
  status VARCHAR(32) NOT NULL CHECK (status IN ('success', 'failed', 'quota_exceeded')),
  "errorMessage" TEXT,
  "creditsUsed" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- System settings table
CREATE TABLE IF NOT EXISTS "systemSettings" (
  id SERIAL PRIMARY KEY,
  "settingKey" VARCHAR(64) NOT NULL UNIQUE,
  "settingValue" TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "cardId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Search stats table
CREATE TABLE IF NOT EXISTS "searchStats" (
  id SERIAL PRIMARY KEY,
  "cardId" INTEGER NOT NULL,
  "searchMethod" VARCHAR(32) NOT NULL CHECK ("searchMethod" IN ('image', 'text')),
  "searchDuration" INTEGER NOT NULL,
  "resultsCount" INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  "featuredImage" TEXT,
  "categoryId" INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  "publishedAt" TIMESTAMP,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "authorId" INTEGER NOT NULL,
  "dataSource" VARCHAR(32) NOT NULL CHECK ("dataSource" IN ('manual', 'ai-generated', 'mixed')),
  "relatedCardIds" TEXT,
  "dataSnapshot" TEXT,
  "metaTitle" VARCHAR(255),
  "metaDescription" TEXT,
  "metaKeywords" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Post tags relation table
CREATE TABLE IF NOT EXISTS post_tags (
  "postId" INTEGER NOT NULL,
  "tagId" INTEGER NOT NULL
);

-- Price update schedule table
CREATE TABLE IF NOT EXISTS "priceUpdateSchedule" (
  id SERIAL PRIMARY KEY,
  "snkrdunkEnabled" BOOLEAN NOT NULL DEFAULT false,
  "snkrdunkUpdateTime" VARCHAR(8) NOT NULL DEFAULT '09:00',
  "snkrdunkLastExecutedAt" TIMESTAMP,
  "ebayEnabled" BOOLEAN NOT NULL DEFAULT false,
  "ebayUpdateTime" VARCHAR(8) NOT NULL DEFAULT '21:00',
  "ebayLastExecutedAt" TIMESTAMP,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Hong_Kong',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Schedule config table
CREATE TABLE IF NOT EXISTS "scheduleConfig" (
  id SERIAL PRIMARY KEY,
  "scheduleType" VARCHAR(64) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  "cronExpression" VARCHAR(64) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Hong_Kong',
  description TEXT,
  "lastExecutedAt" TIMESTAMP,
  "nextExecutionAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Trending cards cache table
CREATE TABLE IF NOT EXISTS "trendingCardsCache" (
  id SERIAL PRIMARY KEY,
  "cardId" INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  "priceChange7d" DECIMAL(10, 2) NOT NULL,
  "oldPrice" DECIMAL(10, 2) NOT NULL,
  "currentPrice" DECIMAL(10, 2) NOT NULL,
  "calculatedAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
