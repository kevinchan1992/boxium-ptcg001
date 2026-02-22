DROP TABLE `emailVerificationTokens`;--> statement-breakpoint
DROP TABLE `oauthAccounts`;--> statement-breakpoint
DROP TABLE `passwordResetTokens`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
DROP INDEX `email_idx` ON `users`;--> statement-breakpoint
ALTER TABLE `users` ADD `openId` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `loginMethod` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_openId_unique` UNIQUE(`openId`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `passwordHash`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `avatar`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `emailVerified`;