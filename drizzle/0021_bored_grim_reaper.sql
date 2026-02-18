CREATE TABLE `snkrdunkListingsCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`snkrdunkId` varchar(128) NOT NULL,
	`listings` text NOT NULL,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `snkrdunkListingsCache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cardId_idx` ON `snkrdunkListingsCache` (`cardId`);--> statement-breakpoint
CREATE INDEX `expiresAt_idx` ON `snkrdunkListingsCache` (`expiresAt`);