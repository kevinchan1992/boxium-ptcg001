CREATE TABLE `scraperPerformanceLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('snkrdunk','ebay') NOT NULL,
	`cardId` int,
	`operationType` enum('single','batch') NOT NULL,
	`status` enum('success','error','timeout') NOT NULL,
	`responseTime` int NOT NULL,
	`itemsProcessed` int DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scraperPerformanceLogs_id` PRIMARY KEY(`id`)
);
