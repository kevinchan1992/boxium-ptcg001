ALTER TABLE `dataSources` ADD `lastUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `dataSources` ADD `nextUpdateAt` timestamp;--> statement-breakpoint
ALTER TABLE `dataSources` ADD `updateCount` int DEFAULT 0 NOT NULL;