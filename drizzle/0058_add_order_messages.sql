CREATE TABLE IF NOT EXISTS `orderMessages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `orderNo` varchar(64) NOT NULL,
  `senderId` int NOT NULL,
  `senderRole` enum('buyer','seller','admin') NOT NULL,
  `content` text NOT NULL,
  `imageUrl` text,
  `isSystemMessage` boolean NOT NULL DEFAULT false,
  `readByBuyer` boolean NOT NULL DEFAULT false,
  `readBySeller` boolean NOT NULL DEFAULT false,
  `readByAdmin` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `orderMessages_id` PRIMARY KEY(`id`)
);
CREATE INDEX `om_orderId_idx` ON `orderMessages` (`orderId`);
CREATE INDEX `om_orderNo_idx` ON `orderMessages` (`orderNo`);
CREATE INDEX `om_senderId_idx` ON `orderMessages` (`senderId`);
CREATE INDEX `om_createdAt_idx` ON `orderMessages` (`createdAt`);
