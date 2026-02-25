CREATE TABLE `uploaded_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uploaded_images_id` PRIMARY KEY(`id`)
);
