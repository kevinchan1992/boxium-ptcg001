CREATE TABLE `userSearchLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`searchQuery` varchar(255),
	`source` enum('search_page','card_click','trending_page','home_page') NOT NULL,
	`userId` int,
	`sessionId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userSearchLogs_id` PRIMARY KEY(`id`)
);
