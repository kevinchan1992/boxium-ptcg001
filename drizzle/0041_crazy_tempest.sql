CREATE TABLE `scheduleExecutionHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleType` varchar(50) NOT NULL,
	`executionType` enum('scheduled','manual') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`durationMs` int,
	`snkrdunkSuccessCount` int DEFAULT 0,
	`snkrdunkFailureCount` int DEFAULT 0,
	`snkrdunkRecordsAdded` int DEFAULT 0,
	`ebaySuccessCount` int DEFAULT 0,
	`ebayFailureCount` int DEFAULT 0,
	`ebayRecordsAdded` int DEFAULT 0,
	`errorMessage` text,
	CONSTRAINT `scheduleExecutionHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `scheduleType_idx` ON `scheduleExecutionHistory` (`scheduleType`);--> statement-breakpoint
CREATE INDEX `startedAt_idx` ON `scheduleExecutionHistory` (`startedAt`);