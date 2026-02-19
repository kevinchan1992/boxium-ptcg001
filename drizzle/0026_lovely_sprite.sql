CREATE TABLE `ebayListingsCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`searchQuery` varchar(500) NOT NULL,
	`listings` text NOT NULL,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`hotExpiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ebayListingsCache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cardId_idx` ON `ebayListingsCache` (`cardId`);--> statement-breakpoint
CREATE INDEX `expiresAt_idx` ON `ebayListingsCache` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `hotExpiresAt_idx` ON `ebayListingsCache` (`hotExpiresAt`);