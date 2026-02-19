CREATE TABLE `backgroundTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskType` varchar(64) NOT NULL,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`totalItems` int NOT NULL DEFAULT 0,
	`processedItems` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`failureCount` int NOT NULL DEFAULT 0,
	`currentItem` text,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backgroundTasks_id` PRIMARY KEY(`id`)
);
