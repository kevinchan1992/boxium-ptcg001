ALTER TABLE `marketplaceOrders` ADD `stripeSessionId` varchar(200);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `trackingNo` varchar(100);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `sellerId` int;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `sellerType` enum('platform','seller') DEFAULT 'platform' NOT NULL;