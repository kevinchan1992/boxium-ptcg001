ALTER TABLE `priceUpdateSchedule` DROP COLUMN `ebayEnabled`;--> statement-breakpoint
ALTER TABLE `priceUpdateSchedule` DROP COLUMN `ebayUpdateTime`;--> statement-breakpoint
ALTER TABLE `priceUpdateSchedule` DROP COLUMN `ebayLastExecutedAt`;--> statement-breakpoint
ALTER TABLE `scheduleExecutionHistory` DROP COLUMN `ebaySuccessCount`;--> statement-breakpoint
ALTER TABLE `scheduleExecutionHistory` DROP COLUMN `ebayFailureCount`;--> statement-breakpoint
ALTER TABLE `scheduleExecutionHistory` DROP COLUMN `ebayRecordsAdded`;