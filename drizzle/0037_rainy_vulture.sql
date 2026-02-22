ALTER TABLE `users` MODIFY COLUMN `loginMethod` enum('password','google','manus') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_openId_unique` UNIQUE(`openId`);