CREATE TABLE `dataSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`source` enum('snkrdunk','ebay','tcgplayer','other') NOT NULL,
	`sourceUrl` text NOT NULL,
	`sourceIdentifier` varchar(128),
	`isActive` int NOT NULL DEFAULT 1,
	`lastFetchedAt` timestamp,
	`lastFetchStatus` varchar(32),
	`fetchErrorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dataSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskType` varchar(64) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`targetId` int,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`errorMessage` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduledTasks_id` PRIMARY KEY(`id`)
);
