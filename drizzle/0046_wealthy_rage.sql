CREATE TABLE `post_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`excerpt` text,
	`content` text NOT NULL,
	`featuredImage` text,
	`category` varchar(100),
	`tags` text,
	`metaKeywords` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	CONSTRAINT `post_versions_id` PRIMARY KEY(`id`)
);
