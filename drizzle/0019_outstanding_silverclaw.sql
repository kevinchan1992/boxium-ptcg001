ALTER TABLE `scheduledTasks` MODIFY COLUMN `status` enum('pending','running','completed','failed','paused') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `scheduledTasks` ADD `totalItems` int;--> statement-breakpoint
ALTER TABLE `scheduledTasks` ADD `processedItems` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `scheduledTasks` ADD `successCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `scheduledTasks` ADD `failureCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `scheduledTasks` ADD `progress` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `scheduledTasks` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;