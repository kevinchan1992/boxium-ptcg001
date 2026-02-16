CREATE TABLE `priceUpdateSchedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snkrdunkEnabled` boolean NOT NULL DEFAULT false,
	`snkrdunkUpdateTime` varchar(8) NOT NULL DEFAULT '09:00',
	`snkrdunkLastExecutedAt` timestamp,
	`ebayEnabled` boolean NOT NULL DEFAULT false,
	`ebayUpdateTime` varchar(8) NOT NULL DEFAULT '21:00',
	`ebayLastExecutedAt` timestamp,
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Hong_Kong',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `priceUpdateSchedule_id` PRIMARY KEY(`id`)
);
