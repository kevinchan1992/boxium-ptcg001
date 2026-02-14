CREATE TABLE `searchStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`searchMethod` enum('image','text') NOT NULL,
	`searchDuration` int NOT NULL,
	`resultsCount` int NOT NULL,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `searchStats_id` PRIMARY KEY(`id`)
);
