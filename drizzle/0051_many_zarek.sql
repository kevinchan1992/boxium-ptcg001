CREATE TABLE `games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`nameJa` varchar(128),
	`nameZh` varchar(128),
	`publisher` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`icon` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `games_id` PRIMARY KEY(`id`),
	CONSTRAINT `games_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sealedProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameId` int NOT NULL,
	`name` text NOT NULL,
	`nameJa` text,
	`nameZh` text,
	`boxType` enum('booster_box','other') NOT NULL DEFAULT 'booster_box',
	`itemCount` int,
	`setName` text,
	`series` text,
	`imageUrl` text,
	`releaseDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sealedProducts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cards` ADD `gameId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `dataSources` ADD `gameId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `dataSources` ADD `productType` enum('single_card','sealed_product') DEFAULT 'single_card' NOT NULL;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD `productType` enum('single_card','sealed_product') DEFAULT 'single_card' NOT NULL;--> statement-breakpoint
ALTER TABLE `viewHistory` ADD `productType` enum('single_card','sealed_product') DEFAULT 'single_card' NOT NULL;--> statement-breakpoint
ALTER TABLE `watchlist` ADD `productType` enum('single_card','sealed_product') DEFAULT 'single_card' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_games_code` ON `games` (`code`);--> statement-breakpoint
CREATE INDEX `idx_games_isActive` ON `games` (`isActive`);--> statement-breakpoint
CREATE INDEX `idx_sealed_gameId` ON `sealedProducts` (`gameId`);--> statement-breakpoint
CREATE INDEX `idx_sealed_boxType` ON `sealedProducts` (`boxType`);--> statement-breakpoint
CREATE INDEX `idx_cards_gameId` ON `cards` (`gameId`);--> statement-breakpoint
CREATE INDEX `idx_datasources_gameId` ON `dataSources` (`gameId`);--> statement-breakpoint
CREATE INDEX `idx_datasources_productType` ON `dataSources` (`productType`);--> statement-breakpoint
CREATE INDEX `idx_price_productType` ON `priceHistory` (`productType`);--> statement-breakpoint
CREATE INDEX `idx_viewhistory_productType` ON `viewHistory` (`productType`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_productType` ON `watchlist` (`productType`);