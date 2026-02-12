CREATE TABLE `auctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`sellerId` int NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`startingPrice` decimal(10,2) NOT NULL,
	`currentPrice` decimal(10,2) NOT NULL,
	`buyNowPrice` decimal(10,2),
	`currency` varchar(8) NOT NULL DEFAULT 'HKD',
	`grade` varchar(32),
	`condition` varchar(64),
	`imageUrls` text,
	`status` enum('active','ended','cancelled') NOT NULL DEFAULT 'active',
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auctions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`bidderId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'HKD',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(128) NOT NULL,
	`name` text NOT NULL,
	`nameJa` text,
	`series` text,
	`setName` text,
	`cardNumber` varchar(32),
	`rarity` varchar(64),
	`language` varchar(16) DEFAULT 'en',
	`releaseDate` timestamp,
	`imageUrl` text,
	`imageUrlHiRes` text,
	`artist` text,
	`description` text,
	`types` text,
	`hp` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `cards_cardId_unique` UNIQUE(`cardId`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('buy','sell') NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'HKD',
	`grade` varchar(32),
	`condition` varchar(64),
	`description` text,
	`status` enum('active','accepted','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`source` enum('snkrdunk','ebay','other') NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'HKD',
	`grade` varchar(32),
	`condition` varchar(64),
	`listingUrl` text,
	`soldAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewerId` int NOT NULL,
	`reviewedUserId` int NOT NULL,
	`auctionId` int,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` int NOT NULL,
	`targetPrice` decimal(10,2),
	`currency` varchar(8) DEFAULT 'HKD',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_id` PRIMARY KEY(`id`)
);
