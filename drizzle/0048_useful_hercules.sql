CREATE TABLE `trendingRankingsCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rankingType` enum('price_increase','price_decrease','search_popularity') NOT NULL,
	`timeRange` int NOT NULL,
	`rankingData` text NOT NULL,
	`calculatedAt` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trendingRankingsCache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rankingType_timeRange_idx` ON `trendingRankingsCache` (`rankingType`,`timeRange`);--> statement-breakpoint
CREATE INDEX `calculatedAt_idx` ON `trendingRankingsCache` (`calculatedAt`);