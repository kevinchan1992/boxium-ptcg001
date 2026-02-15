CREATE TABLE `userSearchLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`searchQuery` text NOT NULL,
	`searchType` enum('card_name','set_name','card_number','general') NOT NULL,
	`resultCount` int NOT NULL DEFAULT 0,
	`cardId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userSearchLogs_id` PRIMARY KEY(`id`)
);
