ALTER TABLE `cards` ADD `snkrdunkId` varchar(32);--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_snkrdunkId_unique` UNIQUE(`snkrdunkId`);