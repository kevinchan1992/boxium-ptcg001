import { pgTable, unique, check, serial, varchar, text, timestamp, integer, boolean, numeric, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	email: varchar({ length: 320 }).notNull(),
	name: text(),
	loginMethod: varchar({ length: 64 }),
	role: varchar({ length: 20 }).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_openId_key").on(table.openId),
	unique("users_email_key").on(table.email),
	check("users_role_check", sql`(role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[])`),
]);

export const dataSources = pgTable("dataSources", {
	id: serial().primaryKey().notNull(),
	cardId: integer().notNull(),
	source: varchar({ length: 32 }).notNull(),
	sourceUrl: text().notNull(),
	sourceIdentifier: varchar({ length: 128 }),
	isActive: integer().default(1).notNull(),
	lastFetchedAt: timestamp({ mode: 'string' }),
	lastUpdatedAt: timestamp({ mode: 'string' }),
	nextUpdateAt: timestamp({ mode: 'string' }),
	lastFetchStatus: varchar({ length: 32 }),
	fetchErrorMessage: text(),
	updateCount: integer().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("dataSources_source_check", sql`(source)::text = ANY ((ARRAY['snkrdunk'::character varying, 'ebay'::character varying, 'tcgplayer'::character varying, 'other'::character varying])::text[])`),
]);

export const scheduledTasks = pgTable("scheduledTasks", {
	id: serial().primaryKey().notNull(),
	taskType: varchar({ length: 64 }).notNull(),
	status: varchar({ length: 32 }).default('pending').notNull(),
	targetId: integer(),
	totalItems: integer(),
	processedItems: integer().default(0),
	successCount: integer().default(0),
	failureCount: integer().default(0),
	progress: integer().default(0),
	startedAt: timestamp({ mode: 'string' }),
	completedAt: timestamp({ mode: 'string' }),
	errorMessage: text(),
	metadata: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("scheduledTasks_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'paused'::character varying])::text[])`),
]);

export const firecrawlUsage = pgTable("firecrawlUsage", {
	id: serial().primaryKey().notNull(),
	operation: varchar({ length: 32 }).notNull(),
	url: text(),
	status: varchar({ length: 32 }).notNull(),
	errorMessage: text(),
	creditsUsed: integer().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("firecrawlUsage_status_check", sql`(status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'quota_exceeded'::character varying])::text[])`),
]);

export const postTags = pgTable("post_tags", {
	postId: integer().notNull(),
	tagId: integer().notNull(),
});

export const priceUpdateSchedule = pgTable("priceUpdateSchedule", {
	id: serial().primaryKey().notNull(),
	snkrdunkEnabled: boolean().default(false).notNull(),
	snkrdunkUpdateTime: varchar({ length: 8 }).default('09:00').notNull(),
	snkrdunkLastExecutedAt: timestamp({ mode: 'string' }),
	ebayEnabled: boolean().default(false).notNull(),
	ebayUpdateTime: varchar({ length: 8 }).default('21:00').notNull(),
	ebayLastExecutedAt: timestamp({ mode: 'string' }),
	timezone: varchar({ length: 64 }).default('Asia/Hong_Kong').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const scheduleConfig = pgTable("scheduleConfig", {
	id: serial().primaryKey().notNull(),
	scheduleType: varchar({ length: 64 }).notNull(),
	enabled: boolean().default(false).notNull(),
	cronExpression: varchar({ length: 64 }).notNull(),
	timezone: varchar({ length: 64 }).default('Asia/Hong_Kong').notNull(),
	description: text(),
	lastExecutedAt: timestamp({ mode: 'string' }),
	nextExecutionAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("scheduleConfig_scheduleType_key").on(table.scheduleType),
]);

export const trendingCardsCache = pgTable("trendingCardsCache", {
	id: serial().primaryKey().notNull(),
	cardId: integer().notNull(),
	rank: integer().notNull(),
	priceChange7D: numeric({ precision: 10, scale:  2 }).notNull(),
	oldPrice: numeric({ precision: 10, scale:  2 }).notNull(),
	currentPrice: numeric({ precision: 10, scale:  2 }).notNull(),
	calculatedAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const cards = pgTable("cards", {
	id: serial().primaryKey().notNull(),
	cardId: varchar({ length: 128 }).notNull(),
	name: text().notNull(),
	nameJa: text(),
	series: text(),
	setName: text(),
	cardNumber: varchar({ length: 32 }),
	rarity: varchar({ length: 64 }),
	language: varchar({ length: 16 }).default('en'),
	releaseDate: timestamp({ mode: 'string' }),
	imageUrl: text(),
	imageUrlHiRes: text(),
	artist: text(),
	description: text(),
	types: text(),
	hp: integer(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("cards_cardId_key").on(table.cardId),
]);

export const priceHistory = pgTable("priceHistory", {
	id: serial().primaryKey().notNull(),
	cardId: integer().notNull(),
	source: varchar({ length: 32 }).notNull(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	currency: varchar({ length: 8 }).default('HKD').notNull(),
	grade: varchar({ length: 32 }),
	condition: varchar({ length: 64 }),
	listingUrl: text(),
	soldAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("priceHistory_source_check", sql`(source)::text = ANY ((ARRAY['snkrdunk'::character varying, 'ebay'::character varying, 'tcgplayer'::character varying, 'other'::character varying])::text[])`),
]);

export const watchlist = pgTable("watchlist", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	cardId: integer().notNull(),
	targetPrice: numeric({ precision: 10, scale:  2 }),
	currency: varchar({ length: 8 }).default('HKD'),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const marketTrends = pgTable("marketTrends", {
	id: serial().primaryKey().notNull(),
	cardId: integer().notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	avgPrice: numeric({ precision: 10, scale:  2 }),
	minPrice: numeric({ precision: 10, scale:  2 }),
	maxPrice: numeric({ precision: 10, scale:  2 }),
	volume: integer(),
	currency: varchar({ length: 8 }).default('HKD').notNull(),
	source: varchar({ length: 32 }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const snkrdunkListingsCache = pgTable("snkrdunkListingsCache", {
	id: serial().primaryKey().notNull(),
	cardId: integer().notNull(),
	snkrdunkId: varchar({ length: 128 }).notNull(),
	listings: text().notNull(),
	cachedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	hotExpiresAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("snkrdunkListingsCache_cardId_idx").using("btree", table.cardId.asc().nullsLast().op("int4_ops")),
	index("snkrdunkListingsCache_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
]);

export const ebayListingsCache = pgTable("ebayListingsCache", {
	id: serial().primaryKey().notNull(),
	cardId: integer().notNull(),
	searchQuery: varchar({ length: 500 }).notNull(),
	listings: text().notNull(),
	cachedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	hotExpiresAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ebayListingsCache_cardId_idx").using("btree", table.cardId.asc().nullsLast().op("int4_ops")),
	index("ebayListingsCache_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("ebayListingsCache_hotExpiresAt_idx").using("btree", table.hotExpiresAt.asc().nullsLast().op("timestamp_ops")),
]);

export const systemSettings = pgTable("systemSettings", {
	id: serial().primaryKey().notNull(),
	settingKey: varchar({ length: 64 }).notNull(),
	settingValue: text().notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("systemSettings_settingKey_key").on(table.settingKey),
]);

export const favorites = pgTable("favorites", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	cardId: integer().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const searchStats = pgTable("searchStats", {
	id: serial().primaryKey().notNull(),
	cardId: integer().notNull(),
	searchMethod: varchar({ length: 32 }).notNull(),
	searchDuration: integer().notNull(),
	resultsCount: integer().notNull(),
	success: boolean().default(true).notNull(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("searchStats_searchMethod_check", sql`("searchMethod")::text = ANY ((ARRAY['image'::character varying, 'text'::character varying])::text[])`),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("categories_slug_key").on(table.slug),
]);

export const tags = pgTable("tags", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 50 }).notNull(),
	slug: varchar({ length: 50 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("tags_name_key").on(table.name),
	unique("tags_slug_key").on(table.slug),
]);

export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	slug: varchar({ length: 255 }).notNull(),
	excerpt: text(),
	content: text().notNull(),
	featuredImage: text(),
	categoryId: integer(),
	status: varchar({ length: 32 }).default('draft').notNull(),
	publishedAt: timestamp({ mode: 'string' }),
	viewCount: integer().default(0).notNull(),
	authorId: integer().notNull(),
	dataSource: varchar({ length: 32 }).notNull(),
	relatedCardIds: text(),
	dataSnapshot: text(),
	metaTitle: varchar({ length: 255 }),
	metaDescription: text(),
	metaKeywords: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("posts_slug_key").on(table.slug),
	check("posts_dataSource_check", sql`("dataSource")::text = ANY ((ARRAY['manual'::character varying, 'ai-generated'::character varying, 'mixed'::character varying])::text[])`),
	check("posts_status_check", sql`(status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying])::text[])`),
]);
