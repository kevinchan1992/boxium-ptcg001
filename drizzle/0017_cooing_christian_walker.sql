CREATE TABLE `dataSourceHealth` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('snkrdunk','ebay') NOT NULL,
	`status` enum('healthy','degraded','down') NOT NULL DEFAULT 'healthy',
	`successRate` decimal(5,2) NOT NULL DEFAULT '100.00',
	`avgResponseTime` int NOT NULL DEFAULT 0,
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`consecutiveFailures` int NOT NULL DEFAULT 0,
	`totalRequests` int NOT NULL DEFAULT 0,
	`totalSuccesses` int NOT NULL DEFAULT 0,
	`totalFailures` int NOT NULL DEFAULT 0,
	`lastErrorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dataSourceHealth_id` PRIMARY KEY(`id`)
);
