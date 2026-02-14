CREATE TABLE `revoked_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`revokedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `revoked_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `revoked_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
