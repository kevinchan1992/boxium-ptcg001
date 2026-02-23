CREATE TABLE `postShares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`shareType` enum('facebook','whatsapp','copy_link') NOT NULL,
	`sharedAt` timestamp NOT NULL DEFAULT (now()),
	`userAgent` text,
	`ipAddress` varchar(45),
	CONSTRAINT `postShares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `postId_idx` ON `postShares` (`postId`);--> statement-breakpoint
CREATE INDEX `shareType_idx` ON `postShares` (`shareType`);--> statement-breakpoint
CREATE INDEX `sharedAt_idx` ON `postShares` (`sharedAt`);