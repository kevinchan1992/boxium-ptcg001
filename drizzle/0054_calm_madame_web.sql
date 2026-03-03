CREATE TABLE `marketplaceListings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerType` enum('platform','seller') NOT NULL,
	`sellerId` int,
	`title` varchar(200) NOT NULL,
	`description` text,
	`condition` enum('mint','near_mint','excellent','good','played','poor','sealed') NOT NULL,
	`cardId` int,
	`sealedProductId` int,
	`price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`images` text,
	`status` enum('draft','pending_review','active','sold','removed') NOT NULL DEFAULT 'draft',
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplaceListings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`listingId` int NOT NULL,
	`sellerId` int,
	`sellerType` enum('platform','seller') NOT NULL,
	`title` varchar(200) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`payoutStatus` enum('pending','processing','paid','failed') NOT NULL DEFAULT 'pending',
	`stripeTransferId` varchar(200),
	`paidOutAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplaceOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNo` varchar(50) NOT NULL,
	`buyerId` int NOT NULL,
	`paymentMethod` enum('stripe','alipay_hk') NOT NULL,
	`paymentStatus` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`stripePaymentIntentId` varchar(200),
	`alipayTradeNo` varchar(100),
	`alipayProofImageUrl` text,
	`subtotal` decimal(10,2) NOT NULL,
	`platformFee` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total` decimal(10,2) NOT NULL,
	`shippingAddress` text,
	`orderStatus` enum('pending_payment','payment_received','processing','shipped','delivered','completed','cancelled','disputed') NOT NULL DEFAULT 'pending_payment',
	`paidAt` timestamp,
	`shippedAt` timestamp,
	`deliveredAt` timestamp,
	`completedAt` timestamp,
	`autoCompleteAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`adminNote` text,
	CONSTRAINT `marketplaceOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplacePayouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'HKD',
	`stripeTransferId` varchar(200),
	`status` enum('pending','processing','paid','failed') NOT NULL DEFAULT 'pending',
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `marketplacePayouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sellerProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`bio` text,
	`stripeConnectId` varchar(100),
	`stripeConnectStatus` enum('pending','active','restricted','disabled') NOT NULL DEFAULT 'pending',
	`isActive` boolean NOT NULL DEFAULT false,
	`totalSales` int NOT NULL DEFAULT 0,
	`rating` decimal(3,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sellerProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ml_sellerType_idx` ON `marketplaceListings` (`sellerType`);--> statement-breakpoint
CREATE INDEX `ml_sellerId_idx` ON `marketplaceListings` (`sellerId`);--> statement-breakpoint
CREATE INDEX `ml_status_idx` ON `marketplaceListings` (`status`);--> statement-breakpoint
CREATE INDEX `ml_cardId_idx` ON `marketplaceListings` (`cardId`);--> statement-breakpoint
CREATE INDEX `moi_orderId_idx` ON `marketplaceOrderItems` (`orderId`);--> statement-breakpoint
CREATE INDEX `moi_listingId_idx` ON `marketplaceOrderItems` (`listingId`);--> statement-breakpoint
CREATE INDEX `moi_sellerId_idx` ON `marketplaceOrderItems` (`sellerId`);--> statement-breakpoint
CREATE INDEX `mo_orderNo_idx` ON `marketplaceOrders` (`orderNo`);--> statement-breakpoint
CREATE INDEX `mo_buyerId_idx` ON `marketplaceOrders` (`buyerId`);--> statement-breakpoint
CREATE INDEX `mo_orderStatus_idx` ON `marketplaceOrders` (`orderStatus`);--> statement-breakpoint
CREATE INDEX `mo_paymentStatus_idx` ON `marketplaceOrders` (`paymentStatus`);--> statement-breakpoint
CREATE INDEX `mp_sellerId_idx` ON `marketplacePayouts` (`sellerId`);--> statement-breakpoint
CREATE INDEX `mp_status_idx` ON `marketplacePayouts` (`status`);--> statement-breakpoint
CREATE INDEX `sp_userId_idx` ON `sellerProfiles` (`userId`);