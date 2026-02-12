CREATE TABLE `marketTrends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`date` timestamp NOT NULL,
	`avgPrice` decimal(10,2),
	`minPrice` decimal(10,2),
	`maxPrice` decimal(10,2),
	`volume` int,
	`currency` varchar(8) NOT NULL DEFAULT 'HKD',
	`source` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketTrends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `auctions`;--> statement-breakpoint
DROP TABLE `bids`;--> statement-breakpoint
DROP TABLE `offers`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `priceHistory` MODIFY COLUMN `source` enum('snkrdunk','ebay','tcgplayer','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `watchlist` ADD `notes` text;