CREATE TABLE `tcgMarketPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`tcgCardId` varchar(64) NOT NULL,
	`tcgLow` decimal(10,2),
	`tcgMid` decimal(10,2),
	`tcgHigh` decimal(10,2),
	`tcgMarket` decimal(10,2),
	`cmAvg` decimal(10,2),
	`cmTrend` decimal(10,2),
	`cmAvg7` decimal(10,2),
	`cmAvg30` decimal(10,2),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tcgMarketPrices_id` PRIMARY KEY(`id`),
	CONSTRAINT `tcgmp_tcgCardId_uniq` UNIQUE(`tcgCardId`)
);
--> statement-breakpoint
CREATE TABLE `webhookLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`rawPayload` text,
	`errorLog` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhookLogs_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhookLogs_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerifyToken` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerifyExpires` bigint;--> statement-breakpoint
CREATE INDEX `tcgmp_cardId_idx` ON `tcgMarketPrices` (`cardId`);--> statement-breakpoint
CREATE INDEX `webhookLogs_status_idx` ON `webhookLogs` (`status`);--> statement-breakpoint
CREATE INDEX `webhookLogs_eventType_idx` ON `webhookLogs` (`eventType`);--> statement-breakpoint
CREATE INDEX `webhookLogs_createdAt_idx` ON `webhookLogs` (`createdAt`);