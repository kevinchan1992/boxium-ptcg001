ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` enum('password','google') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;