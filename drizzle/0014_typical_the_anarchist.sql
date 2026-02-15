CREATE TABLE `scheduleConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleType` varchar(64) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`cronExpression` varchar(64) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Hong_Kong',
	`description` text,
	`lastExecutedAt` timestamp,
	`nextExecutionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduleConfig_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduleConfig_scheduleType_unique` UNIQUE(`scheduleType`)
);
--> statement-breakpoint
CREATE TABLE `scheduleExecutionHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleType` varchar(64) NOT NULL,
	`executionType` enum('scheduled','manual') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`ebaySuccessCount` int NOT NULL DEFAULT 0,
	`ebayFailureCount` int NOT NULL DEFAULT 0,
	`ebayRecordsAdded` int NOT NULL DEFAULT 0,
	`snkrdunkSuccessCount` int NOT NULL DEFAULT 0,
	`snkrdunkFailureCount` int NOT NULL DEFAULT 0,
	`snkrdunkRecordsAdded` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduleExecutionHistory_id` PRIMARY KEY(`id`)
);
