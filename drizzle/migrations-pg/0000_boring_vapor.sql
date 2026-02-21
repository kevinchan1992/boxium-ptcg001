-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" text,
	"loginMethod" varchar(64),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_key" UNIQUE("openId"),
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "dataSources" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" integer NOT NULL,
	"source" varchar(32) NOT NULL,
	"sourceUrl" text NOT NULL,
	"sourceIdentifier" varchar(128),
	"isActive" integer DEFAULT 1 NOT NULL,
	"lastFetchedAt" timestamp,
	"lastUpdatedAt" timestamp,
	"nextUpdateAt" timestamp,
	"lastFetchStatus" varchar(32),
	"fetchErrorMessage" text,
	"updateCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dataSources_source_check" CHECK ((source)::text = ANY ((ARRAY['snkrdunk'::character varying, 'ebay'::character varying, 'tcgplayer'::character varying, 'other'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "scheduledTasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskType" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"targetId" integer,
	"totalItems" integer,
	"processedItems" integer DEFAULT 0,
	"successCount" integer DEFAULT 0,
	"failureCount" integer DEFAULT 0,
	"progress" integer DEFAULT 0,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"errorMessage" text,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduledTasks_status_check" CHECK ((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'paused'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "firecrawlUsage" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" varchar(32) NOT NULL,
	"url" text,
	"status" varchar(32) NOT NULL,
	"errorMessage" text,
	"creditsUsed" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "firecrawlUsage_status_check" CHECK ((status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'quota_exceeded'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"postId" integer NOT NULL,
	"tagId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priceUpdateSchedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"snkrdunkEnabled" boolean DEFAULT false NOT NULL,
	"snkrdunkUpdateTime" varchar(8) DEFAULT '09:00' NOT NULL,
	"snkrdunkLastExecutedAt" timestamp,
	"ebayEnabled" boolean DEFAULT false NOT NULL,
	"ebayUpdateTime" varchar(8) DEFAULT '21:00' NOT NULL,
	"ebayLastExecutedAt" timestamp,
	"timezone" varchar(64) DEFAULT 'Asia/Hong_Kong' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduleConfig" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheduleType" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"cronExpression" varchar(64) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Hong_Kong' NOT NULL,
	"description" text,
	"lastExecutedAt" timestamp,
	"nextExecutionAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduleConfig_scheduleType_key" UNIQUE("scheduleType")
);
--> statement-breakpoint
CREATE TABLE "trendingCardsCache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" integer NOT NULL,
	"rank" integer NOT NULL,
	"priceChange7d" numeric(10, 2) NOT NULL,
	"oldPrice" numeric(10, 2) NOT NULL,
	"currentPrice" numeric(10, 2) NOT NULL,
	"calculatedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" varchar(128) NOT NULL,
	"name" text NOT NULL,
	"nameJa" text,
	"series" text,
	"setName" text,
	"cardNumber" varchar(32),
	"rarity" varchar(64),
	"language" varchar(16) DEFAULT 'en',
	"releaseDate" timestamp,
	"imageUrl" text,
	"imageUrlHiRes" text,
	"artist" text,
	"description" text,
	"types" text,
	"hp" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cards_cardId_key" UNIQUE("cardId")
);
--> statement-breakpoint
CREATE TABLE "priceHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" integer NOT NULL,
	"source" varchar(32) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'HKD' NOT NULL,
	"grade" varchar(32),
	"condition" varchar(64),
	"listingUrl" text,
	"soldAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "priceHistory_source_check" CHECK ((source)::text = ANY ((ARRAY['snkrdunk'::character varying, 'ebay'::character varying, 'tcgplayer'::character varying, 'other'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"cardId" integer NOT NULL,
	"targetPrice" numeric(10, 2),
	"currency" varchar(8) DEFAULT 'HKD',
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketTrends" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" integer NOT NULL,
	"date" timestamp NOT NULL,
	"avgPrice" numeric(10, 2),
	"minPrice" numeric(10, 2),
	"maxPrice" numeric(10, 2),
	"volume" integer,
	"currency" varchar(8) DEFAULT 'HKD' NOT NULL,
	"source" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snkrdunkListingsCache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" integer NOT NULL,
	"snkrdunkId" varchar(128) NOT NULL,
	"listings" text NOT NULL,
	"cachedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"hotExpiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebayListingsCache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" integer NOT NULL,
	"searchQuery" varchar(500) NOT NULL,
	"listings" text NOT NULL,
	"cachedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"hotExpiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "systemSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"settingKey" varchar(64) NOT NULL,
	"settingValue" text NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "systemSettings_settingKey_key" UNIQUE("settingKey")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"cardId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searchStats" (
	"id" serial PRIMARY KEY NOT NULL,
	"cardId" integer NOT NULL,
	"searchMethod" varchar(32) NOT NULL,
	"searchDuration" integer NOT NULL,
	"resultsCount" integer NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "searchStats_searchMethod_check" CHECK (("searchMethod")::text = ANY ((ARRAY['image'::character varying, 'text'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_key" UNIQUE("name"),
	CONSTRAINT "tags_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"featuredImage" text,
	"categoryId" integer,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"publishedAt" timestamp,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"authorId" integer NOT NULL,
	"dataSource" varchar(32) NOT NULL,
	"relatedCardIds" text,
	"dataSnapshot" text,
	"metaTitle" varchar(255),
	"metaDescription" text,
	"metaKeywords" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_key" UNIQUE("slug"),
	CONSTRAINT "posts_dataSource_check" CHECK (("dataSource")::text = ANY ((ARRAY['manual'::character varying, 'ai-generated'::character varying, 'mixed'::character varying])::text[])),
	CONSTRAINT "posts_status_check" CHECK ((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying])::text[]))
);
--> statement-breakpoint
CREATE INDEX "snkrdunkListingsCache_cardId_idx" ON "snkrdunkListingsCache" USING btree ("cardId" int4_ops);--> statement-breakpoint
CREATE INDEX "snkrdunkListingsCache_expiresAt_idx" ON "snkrdunkListingsCache" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ebayListingsCache_cardId_idx" ON "ebayListingsCache" USING btree ("cardId" int4_ops);--> statement-breakpoint
CREATE INDEX "ebayListingsCache_expiresAt_idx" ON "ebayListingsCache" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ebayListingsCache_hotExpiresAt_idx" ON "ebayListingsCache" USING btree ("hotExpiresAt" timestamp_ops);
*/