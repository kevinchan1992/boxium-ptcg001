CREATE TABLE `trendingCardsCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`rank` int NOT NULL,
	`priceChange7d` decimal(10,2) NOT NULL,
	`oldPrice` decimal(10,2) NOT NULL,
	`currentPrice` decimal(10,2) NOT NULL,
	`calculatedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trendingCardsCache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `blogArticles`;--> statement-breakpoint
DROP TABLE `dataSourceHealth`;--> statement-breakpoint
DROP TABLE `scheduleExecutionHistory`;--> statement-breakpoint
DROP TABLE `userSearchLogs`;