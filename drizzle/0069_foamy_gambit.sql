CREATE TABLE `adminAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`targetType` varchar(50) NOT NULL,
	`targetId` int,
	`details` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `adminIpWhitelist` (
	`ip` varchar(45) NOT NULL,
	`addedBy` varchar(100) NOT NULL DEFAULT 'admin',
	`note` varchar(200),
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminIpWhitelist_ip` PRIMARY KEY(`ip`)
);
--> statement-breakpoint
CREATE TABLE `auctionAgreements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('buyer','seller') NOT NULL,
	`termsVersion` varchar(20) NOT NULL,
	`agreedAt` timestamp NOT NULL DEFAULT (now()),
	`ipHash` varchar(64),
	CONSTRAINT `auctionAgreements_id` PRIMARY KEY(`id`),
	CONSTRAINT `aa_user_role_version_idx` UNIQUE(`userId`,`role`,`termsVersion`)
);
--> statement-breakpoint
CREATE TABLE `auctionBids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`bidderId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('active','outbid','winning','retracted') NOT NULL DEFAULT 'active',
	`ipHash` varchar(64),
	`userAgent` text,
	`depositAmountHkd` decimal(10,2),
	`depositPaymentIntentId` varchar(200),
	`depositStatus` enum('none','held','released','captured') NOT NULL DEFAULT 'none',
	`depositHeldAt` timestamp,
	`depositReleasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auctionBids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auctionViolations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('no_payment','fake_bid','seller_cancel') NOT NULL,
	`listingId` int,
	`orderId` int,
	`penalty` enum('warning','ban_7d','ban_30d','permanent') NOT NULL,
	`banExpiresAt` timestamp,
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auctionViolations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blockedIps` (
	`ip` varchar(45) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`blockedBy` varchar(100) NOT NULL DEFAULT 'admin',
	`blockedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `blockedIps_ip` PRIMARY KEY(`ip`)
);
--> statement-breakpoint
CREATE TABLE `cardInventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemType` enum('card','sealed') NOT NULL DEFAULT 'card',
	`cardName` varchar(512) NOT NULL,
	`cardSet` varchar(256),
	`cardNumber` varchar(64),
	`grade` varchar(32),
	`buyPriceCurrency` enum('HKD','JPY','USD') NOT NULL DEFAULT 'HKD',
	`buyPriceOriginal` decimal(12,2) NOT NULL,
	`buyPriceHkd` decimal(12,2) NOT NULL,
	`buyExchangeRate` decimal(10,4) DEFAULT '1.0000',
	`buyDate` timestamp NOT NULL,
	`buySource` varchar(256),
	`status` enum('holding','sold') NOT NULL DEFAULT 'holding',
	`sellPriceCurrency` enum('HKD','JPY','USD') DEFAULT 'HKD',
	`sellPriceOriginal` decimal(12,2),
	`sellPriceHkd` decimal(12,2),
	`sellExchangeRate` decimal(10,4),
	`sellDate` timestamp,
	`sellChannel` varchar(256),
	`imageUrl` text,
	`s3ImageUrl` text,
	`linkedCardId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cardInventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cardTradeItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tradeId` int NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`collectionId` int,
	`cardId` int NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`grader` varchar(16) NOT NULL DEFAULT 'RAW',
	`grade` varchar(32),
	`quantity` int NOT NULL DEFAULT 1,
	`estimatedValue` decimal(10,2),
	`newCollectionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cardTradeItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cardTrades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tradedAt` timestamp NOT NULL,
	`tradePartner` varchar(128),
	`cashAdjustment` decimal(10,2) DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cardTrades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`listingId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `cartItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_user_listing_unique` UNIQUE(`userId`,`listingId`)
);
--> statement-breakpoint
CREATE TABLE `cartOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyerId` int NOT NULL,
	`totalSubtotalHkd` decimal(10,2) NOT NULL,
	`totalPlatformFeeHkd` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalSellerReceivableHkd` decimal(10,2) NOT NULL,
	`hasSellerItems` boolean NOT NULL DEFAULT false,
	`availablePaymentMethods` varchar(50) NOT NULL DEFAULT 'stripe,alipay_hk',
	`paymentRestrictionReason` text,
	`stripeCheckoutSessionId` varchar(200),
	`stripePaymentIntentId` varchar(200),
	`stripeChargeId` varchar(200),
	`paymentStatus` enum('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cartOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `disputeMedia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`orderNo` varchar(64) NOT NULL,
	`uploaderId` int NOT NULL,
	`uploaderRole` enum('buyer','seller','admin') NOT NULL,
	`mediaUrl` text NOT NULL,
	`mediaType` enum('image','video') NOT NULL DEFAULT 'image',
	`fileName` varchar(255),
	`fileSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `disputeMedia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`toEmail` varchar(255) NOT NULL,
	`toUserId` int,
	`subject` varchar(500) NOT NULL,
	`emailType` varchar(64) NOT NULL,
	`status` enum('sent','failed','skipped') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`dedupeKey` varchar(200),
	CONSTRAINT `emailLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailUnsubscribes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(255) NOT NULL,
	`emailType` varchar(64),
	`token` varchar(64) NOT NULL,
	`unsubscribedAt` timestamp NOT NULL DEFAULT (now()),
	`resubscribedAt` timestamp,
	CONSTRAINT `emailUnsubscribes_id` PRIMARY KEY(`id`),
	CONSTRAINT `emailUnsubscribes_token_unique` UNIQUE(`token`),
	CONSTRAINT `eu_token_idx` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `exportJobs` (
	`id` varchar(36) NOT NULL,
	`type` enum('excel','pdf') NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`status` enum('pending','processing','done','error') NOT NULL DEFAULT 'pending',
	`progress` int DEFAULT 0,
	`currentItem` int DEFAULT 0,
	`totalItems` int DEFAULT 0,
	`downloadUrl` text,
	`errorMessage` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exportJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gradingBannerImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(512) NOT NULL,
	`altText` varchar(256),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gradingBannerImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gradingBatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchName` varchar(128) NOT NULL,
	`cutoffDate` timestamp NOT NULL,
	`shippedDate` timestamp,
	`expectedReturnDate` timestamp,
	`status` enum('open','closed','shipped','returned') NOT NULL DEFAULT 'open',
	`batchCostHkd` decimal(10,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gradingBatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gradingReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`isPublic` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gradingReviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `gradingReviews_submissionId_unique` UNIQUE(`submissionId`)
);
--> statement-breakpoint
CREATE TABLE `gradingServiceTiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`feeHkd` decimal(10,2) NOT NULL,
	`maxDeclaredValueUsd` decimal(10,2) NOT NULL,
	`estimatedDaysMin` int NOT NULL,
	`estimatedDaysMax` int NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gradingServiceTiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gradingSubmissionItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`cardName` varchar(256) NOT NULL,
	`cardSet` varchar(256),
	`cardNumber` varchar(64),
	`cardLanguage` enum('zh_tw','ja','en','ko','other') NOT NULL DEFAULT 'en',
	`cardImageUrl` text,
	`tierId` int NOT NULL,
	`feeHkd` decimal(10,2) NOT NULL,
	`condition` enum('mint','near_mint','excellent') NOT NULL DEFAULT 'near_mint',
	`notes` text,
	`psaCertNumber` varchar(64),
	`psaGrade` varchar(16),
	`itemStatus` enum('pending','received','submitted','graded','returned') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gradingSubmissionItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gradingSubmissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNo` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('awaiting_payment','pending_review','pending_shipment','received','submitted_to_psa','grading','graded','payment_overdue','paid','returned','completed','cancelled') NOT NULL DEFAULT 'awaiting_payment',
	`totalFeeHkd` decimal(10,2) NOT NULL,
	`paymentMethod` enum('stripe','alipay_hk'),
	`stripePaymentIntentId` varchar(128),
	`batchId` int,
	`shippingDeadline` timestamp,
	`paymentDeadline` timestamp,
	`gradedAt` timestamp,
	`adminNotes` text,
	`adminNotesHistory` text,
	`returnTrackingNo` varchar(128),
	`paymentDueAt` timestamp,
	`day15ReminderSentAt` timestamp,
	`day25ReminderSentAt` timestamp,
	`alipayProofImageUrl` text,
	`alipayProofStatus` enum('pending_review','approved','rejected'),
	`alipayProofSubmittedAt` timestamp,
	`alipayProofRejectionReason` text,
	`alipayProofAiResult` enum('pass','warning','fail'),
	`alipayProofAiConfidence` enum('high','medium','low'),
	`alipayProofAiSummary` text,
	`alipayProofAiCheckedAt` timestamp,
	`trackingNumber` varchar(100),
	`trackingSubmittedAt` timestamp,
	`paidAt` timestamp,
	`upgradeCheckoutSessionId` varchar(128),
	`upgradeDiffFeeHkd` decimal(10,2),
	`upgradeNewTierId` int,
	`upgradeItemIds` varchar(512),
	`upgradeCheckoutAt` timestamp,
	`upgradePaidAt` timestamp,
	`upgradeReminderSentAt` timestamp,
	`returnAddress` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gradingSubmissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `gradingSubmissions_orderNo_unique` UNIQUE(`orderNo`)
);
--> statement-breakpoint
CREATE TABLE `listingModerationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`listingMode` enum('direct','auction') NOT NULL DEFAULT 'direct',
	`adminId` int NOT NULL,
	`adminName` varchar(100),
	`action` enum('delist','restore','batch_delist','batch_restore','flag_risk','clear_flag','edit') NOT NULL,
	`reason` text,
	`previousStatus` varchar(50),
	`newStatus` varchar(50),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `listingModerationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listingReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`reporterId` int NOT NULL,
	`reason` enum('fake_item','wrong_description','prohibited_item','scam','other') NOT NULL,
	`details` text,
	`status` enum('pending','reviewed','dismissed','actioned') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `listingReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceBanners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`subtitle` varchar(300) NOT NULL DEFAULT '',
	`cta` varchar(100) NOT NULL DEFAULT '立即選購',
	`ctaConditions` varchar(500) NOT NULL DEFAULT '[]',
	`ctaSellerType` varchar(20) NOT NULL DEFAULT 'all',
	`gradient` varchar(200) NOT NULL DEFAULT 'from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]',
	`accentColor` varchar(20) NOT NULL DEFAULT '#FFD700',
	`badge` varchar(50) NOT NULL DEFAULT '',
	`badgeClass` varchar(100) NOT NULL DEFAULT 'bg-yellow-400 text-[#06038d]',
	`emoji` varchar(10) NOT NULL DEFAULT '🏆',
	`imageUrl` varchar(500) NOT NULL DEFAULT '',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplaceBanners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`listingId` int NOT NULL,
	`buyerId` int NOT NULL,
	`sellerId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`isAnonymous` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplaceReviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `mr_unique_order` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceSearchLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(200) NOT NULL,
	`tcgSeries` varchar(50),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplaceSearchLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceWhitelist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`addedBy` int NOT NULL,
	`note` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplaceWhitelist_id` PRIMARY KEY(`id`),
	CONSTRAINT `mw_userId_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`buyerId` int NOT NULL,
	`sellerId` int NOT NULL,
	`sellerProfileId` int NOT NULL,
	`offerPriceHkd` decimal(10,2) NOT NULL,
	`message` text,
	`status` enum('pending','accepted','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`respondedAt` timestamp,
	`rejectionReason` text,
	`orderId` int,
	`expiryReminderSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`sellerId` int NOT NULL,
	`listingId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`priceAtPurchaseHkd` decimal(10,2) NOT NULL,
	`shippingStatus` varchar(32) NOT NULL DEFAULT 'pending',
	`trackingNumber` varchar(128),
	`shippedAt` timestamp,
	`deliveredAt` timestamp,
	`sellerNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderMessages` (
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
	`readAtBuyer` timestamp,
	`readAtSeller` timestamp,
	`readAtAdmin` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderStatusHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`fromStatus` varchar(50),
	`toStatus` varchar(50) NOT NULL,
	`operatorId` int,
	`operatorName` varchar(100),
	`note` varchar(500),
	`entryType` varchar(20) NOT NULL DEFAULT 'status_change',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderStatusHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNo` varchar(64) NOT NULL,
	`buyerId` int NOT NULL,
	`totalAmountHkd` decimal(10,2) NOT NULL,
	`paymentMethod` varchar(32) NOT NULL,
	`paymentStatus` varchar(32) NOT NULL DEFAULT 'pending',
	`orderStatus` varchar(32) NOT NULL DEFAULT 'pending_payment',
	`stripeSessionId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`alipayProofUrl` text,
	`alipayProofStatus` varchar(32),
	`paidAt` timestamp,
	`completedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNo_unique` UNIQUE(`orderNo`)
);
--> statement-breakpoint
CREATE TABLE `platformRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('listing','auction','payment','shipping','conduct','seller') NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platformRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`parentId` int,
	`tcgSeries` varchar(50),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `pc_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `searchTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`productType` enum('single_card','sealed_product') NOT NULL DEFAULT 'single_card',
	`token` varchar(128) NOT NULL,
	`tokenType` enum('name_en','name_ja','card_number','series','rarity') NOT NULL,
	CONSTRAINT `searchTokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securityEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('BOT_BLOCKED','RATE_LIMITED','UPLOAD_REJECTED','MANUAL_BLOCK') NOT NULL,
	`ip` varchar(45) NOT NULL,
	`userAgent` text,
	`path` varchar(500),
	`reason` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securityEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sellerRiskProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`totalListings` int NOT NULL DEFAULT 0,
	`delistedCount` int NOT NULL DEFAULT 0,
	`reportCount` int NOT NULL DEFAULT 0,
	`disputeCount` int NOT NULL DEFAULT 0,
	`lastReviewAt` timestamp,
	`adminNote` text,
	`isWatched` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sellerRiskProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `srp_sellerId_idx` UNIQUE(`sellerId`)
);
--> statement-breakpoint
CREATE TABLE `snkrdunkGradeIndex` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`grade` varchar(64) NOT NULL,
	`minPrice` decimal(12,2) NOT NULL,
	`listingCount` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `snkrdunkGradeIndex_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userCollections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` int NOT NULL,
	`grader` varchar(16) NOT NULL,
	`grade` varchar(32),
	`quantity` int NOT NULL DEFAULT 1,
	`purchasePrice` decimal(10,2),
	`purchasedAt` timestamp,
	`notes` text,
	`isPublic` boolean NOT NULL DEFAULT false,
	`tradedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userCollections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userShippingAddresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(50) NOT NULL DEFAULT '預設地址',
	`addressType` enum('normal','sf_station') NOT NULL DEFAULT 'normal',
	`recipientName` varchar(100) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`address` varchar(255) NOT NULL,
	`district` varchar(50),
	`region` varchar(50) NOT NULL DEFAULT '香港',
	`sfStationCode` varchar(20),
	`sfStationName` varchar(100),
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userShippingAddresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`listingId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `favorites`;--> statement-breakpoint
ALTER TABLE `marketplaceListings` MODIFY COLUMN `condition` enum('psa10','psa9','psa8_below','bgs10','bgs9','bgs8_below','tag10','tag9_below','raw_a','raw_b','raw_c','raw_d') NOT NULL DEFAULT 'raw_a';--> statement-breakpoint
ALTER TABLE `marketplaceListings` MODIFY COLUMN `status` enum('draft','pending_review','active','reserved','sold','removed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `marketplaceOrders` MODIFY COLUMN `paymentStatus` enum('pending','paid','failed','refunded','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `marketplaceOrders` MODIFY COLUMN `orderStatus` enum('pending_payment','paid_held','payment_received','processing','shipped','delivered','completed','cancelled','disputed','refunded') NOT NULL DEFAULT 'pending_payment';--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `priceUpdateSchedule` MODIFY COLUMN `snkrdunkUpdateTime` varchar(8) NOT NULL DEFAULT '02:00';--> statement-breakpoint
ALTER TABLE `scheduleExecutionHistory` MODIFY COLUMN `executionType` enum('scheduled','manual','catchup') NOT NULL;--> statement-breakpoint
ALTER TABLE `sellerProfiles` MODIFY COLUMN `stripeConnectStatus` enum('not_started','pending','active','verified','restricted','disabled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `sellerProfiles` MODIFY COLUMN `isActive` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` enum('password','google','apple') NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `language` varchar(20);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `tcgSeries` enum('pokemon','onepiece','yugioh','dragonball','mtg','other') DEFAULT 'pokemon' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `priceHkd` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `remainingQuantity` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `rejectedReason` text;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `adminDelisted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `allowOffers` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `minOfferHkd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `listingMode` enum('buy_now','offer','auction') DEFAULT 'buy_now' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionStartAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionEndAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `startingBid` decimal(10,2);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `reservePrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `buyNowPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `bidIncrement` decimal(10,2) DEFAULT '5.00';--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `currentHighestBid` decimal(10,2);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `currentHighestBidderId` int;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `bidCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionStatus` enum('draft','pending_review','scheduled','active','ending_soon','ended_sold','ended_no_bid','cancelled','rejected');--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `antiSnipingMinutes` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `antiSnipingExtensions` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `hasReserveMet` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `winnerId` int;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `winningBidId` int;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionTermsVersion` varchar(20);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `isHighValueReview` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionPaymentSessionId` varchar(200);--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionPaymentStatus` enum('pending','paid','failed','expired');--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionPaymentPaidAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `auctionOrderId` int;--> statement-breakpoint
ALTER TABLE `marketplaceListings` ADD `listedAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `listingId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `unitPriceHkd` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `quantity` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `subtotalHkd` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `platformFeeRate` decimal(5,4) DEFAULT '0.0500' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `platformFeeHkd` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `sellerReceivableHkd` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `stripeChargeId` varchar(200);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `stripeTransferId` varchar(200);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayProofSubmittedAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayReviewReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayProofStatus` enum('pending_review','approved','rejected');--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `aiVerificationResult` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `shippingName` varchar(100);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `shippingPhone` varchar(30);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `buyerPhone` varchar(30);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `shippingMethod` enum('sf_express','hk_post','sf_cod','hongkong_post','other','meetup');--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `trackingNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `buyerConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `payoutHoldUntil` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputeOpenedAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputeReason` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputeEvidenceUrls` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputeResolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputeResolution` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputeResolutionHistory` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputePriority` enum('high','medium','low') DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `disputeDeadlineAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `shippingImageUrl` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `shippingReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `paymentReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `confirmReceiptReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `payoutStatus` enum('not_applicable','pending','processing','completed','paid','failed','hold') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `stripeTransferError` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `manualPayoutAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `manualPayoutNote` varchar(500);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `manualPayoutProofUrl` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `paymentRejectionReason` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayRefundStatus` enum('not_applicable','pending','processing','completed') DEFAULT 'not_applicable';--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayRefundAmount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayRefundRequestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayRefundCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayRefundNote` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `alipayRefundProofUrl` text;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `batchRef` varchar(100);--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `cartOrderId` int;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `orderSource` enum('direct','offer','auction') DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `auctionListingId` int;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD `auctionWinningBidId` int;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` ADD `orderId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` ADD `amountHkd` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` ADD `retryCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `body` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `linkUrl` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `relatedId` int;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD `jpyPrice` int;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD `sourcePosition` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD `isSuspectedBulk` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD `recordHash` varchar(64);--> statement-breakpoint
ALTER TABLE `priceUpdateSchedule` ADD `snkrdunkUpdateTime2` varchar(8);--> statement-breakpoint
ALTER TABLE `priceUpdateSchedule` ADD `snkrdunkLastCatchupAt` timestamp;--> statement-breakpoint
ALTER TABLE `priceUpdateSchedule` ADD `snkrdunkUpdateMode` varchar(32) DEFAULT 'github_actions' NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduledTasks` ADD `activeProcessingMs` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sellerProfiles` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `sellerProfiles` ADD `stripeOnboardingUrl` text;--> statement-breakpoint
ALTER TABLE `sellerProfiles` ADD `avgRating` decimal(3,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `sellerProfiles` ADD `ratingCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sellerProfiles` ADD `isSuspended` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sellerProfiles` ADD `suspensionReason` text;--> statement-breakpoint
ALTER TABLE `sellerProfiles` ADD `rejectReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `appleId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(30);--> statement-breakpoint
ALTER TABLE `users` ADD `isBlocked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `blockReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationToken` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationExpiry` timestamp;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` ADD CONSTRAINT `mo_unique_auction_listing` UNIQUE(`auctionListingId`);--> statement-breakpoint
ALTER TABLE `priceHistory` ADD CONSTRAINT `uniq_price_card_source_grade_soldAt_jpyPrice_pos` UNIQUE(`cardId`,`source`,`grade`,`soldAt`,`jpyPrice`,`sourcePosition`);--> statement-breakpoint
ALTER TABLE `priceHistory` ADD CONSTRAINT `uniq_price_record_hash` UNIQUE(`recordHash`);--> statement-breakpoint
ALTER TABLE `watchlist` ADD CONSTRAINT `idx_watchlist_userId_cardId` UNIQUE(`userId`,`cardId`,`productType`);--> statement-breakpoint
CREATE INDEX `aal_adminId_idx` ON `adminAuditLogs` (`adminId`);--> statement-breakpoint
CREATE INDEX `aal_action_idx` ON `adminAuditLogs` (`action`);--> statement-breakpoint
CREATE INDEX `aal_target_idx` ON `adminAuditLogs` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `aal_createdAt_idx` ON `adminAuditLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `aa_userId_idx` ON `auctionAgreements` (`userId`);--> statement-breakpoint
CREATE INDEX `ab_listingId_idx` ON `auctionBids` (`listingId`);--> statement-breakpoint
CREATE INDEX `ab_bidderId_idx` ON `auctionBids` (`bidderId`);--> statement-breakpoint
CREATE INDEX `ab_status_idx` ON `auctionBids` (`status`);--> statement-breakpoint
CREATE INDEX `av_userId_idx` ON `auctionViolations` (`userId`);--> statement-breakpoint
CREATE INDEX `av_type_idx` ON `auctionViolations` (`type`);--> statement-breakpoint
CREATE INDEX `bi_isActive_idx` ON `blockedIps` (`isActive`);--> statement-breakpoint
CREATE INDEX `ci_status_idx` ON `cardInventory` (`status`);--> statement-breakpoint
CREATE INDEX `ci_buyDate_idx` ON `cardInventory` (`buyDate`);--> statement-breakpoint
CREATE INDEX `ci_itemType_idx` ON `cardInventory` (`itemType`);--> statement-breakpoint
CREATE INDEX `cti_tradeId_idx` ON `cardTradeItems` (`tradeId`);--> statement-breakpoint
CREATE INDEX `cti_collectionId_idx` ON `cardTradeItems` (`collectionId`);--> statement-breakpoint
CREATE INDEX `cti_newCollectionId_idx` ON `cardTradeItems` (`newCollectionId`);--> statement-breakpoint
CREATE INDEX `ct_userId_idx` ON `cardTrades` (`userId`);--> statement-breakpoint
CREATE INDEX `ct_tradedAt_idx` ON `cardTrades` (`tradedAt`);--> statement-breakpoint
CREATE INDEX `cart_userId_idx` ON `cartItems` (`userId`);--> statement-breakpoint
CREATE INDEX `cart_listingId_idx` ON `cartItems` (`listingId`);--> statement-breakpoint
CREATE INDEX `co_buyerId_idx` ON `cartOrders` (`buyerId`);--> statement-breakpoint
CREATE INDEX `co_stripeSession_idx` ON `cartOrders` (`stripeCheckoutSessionId`);--> statement-breakpoint
CREATE INDEX `co_paymentStatus_idx` ON `cartOrders` (`paymentStatus`);--> statement-breakpoint
CREATE INDEX `dm_orderId_idx` ON `disputeMedia` (`orderId`);--> statement-breakpoint
CREATE INDEX `dm_orderNo_idx` ON `disputeMedia` (`orderNo`);--> statement-breakpoint
CREATE INDEX `dm_uploaderId_idx` ON `disputeMedia` (`uploaderId`);--> statement-breakpoint
CREATE INDEX `el_toEmail_idx` ON `emailLogs` (`toEmail`);--> statement-breakpoint
CREATE INDEX `el_toUserId_idx` ON `emailLogs` (`toUserId`);--> statement-breakpoint
CREATE INDEX `el_emailType_idx` ON `emailLogs` (`emailType`);--> statement-breakpoint
CREATE INDEX `el_status_idx` ON `emailLogs` (`status`);--> statement-breakpoint
CREATE INDEX `el_sentAt_idx` ON `emailLogs` (`sentAt`);--> statement-breakpoint
CREATE INDEX `el_dedupeKey_idx` ON `emailLogs` (`dedupeKey`);--> statement-breakpoint
CREATE INDEX `eu_userId_idx` ON `emailUnsubscribes` (`userId`);--> statement-breakpoint
CREATE INDEX `eu_email_idx` ON `emailUnsubscribes` (`email`);--> statement-breakpoint
CREATE INDEX `gbi_sortOrder_idx` ON `gradingBannerImages` (`sortOrder`);--> statement-breakpoint
CREATE INDEX `gbi_isActive_idx` ON `gradingBannerImages` (`isActive`);--> statement-breakpoint
CREATE INDEX `gb_status_idx` ON `gradingBatches` (`status`);--> statement-breakpoint
CREATE INDEX `gb_cutoffDate_idx` ON `gradingBatches` (`cutoffDate`);--> statement-breakpoint
CREATE INDEX `gr_submissionId_idx` ON `gradingReviews` (`submissionId`);--> statement-breakpoint
CREATE INDEX `gr_userId_idx` ON `gradingReviews` (`userId`);--> statement-breakpoint
CREATE INDEX `gst_isActive_idx` ON `gradingServiceTiers` (`isActive`);--> statement-breakpoint
CREATE INDEX `gst_sortOrder_idx` ON `gradingServiceTiers` (`sortOrder`);--> statement-breakpoint
CREATE INDEX `gsi_submissionId_idx` ON `gradingSubmissionItems` (`submissionId`);--> statement-breakpoint
CREATE INDEX `gsi_tierId_idx` ON `gradingSubmissionItems` (`tierId`);--> statement-breakpoint
CREATE INDEX `gs_userId_idx` ON `gradingSubmissions` (`userId`);--> statement-breakpoint
CREATE INDEX `gs_status_idx` ON `gradingSubmissions` (`status`);--> statement-breakpoint
CREATE INDEX `gs_orderNo_idx` ON `gradingSubmissions` (`orderNo`);--> statement-breakpoint
CREATE INDEX `gs_batchId_idx` ON `gradingSubmissions` (`batchId`);--> statement-breakpoint
CREATE INDEX `lml_listingId_idx` ON `listingModerationLogs` (`listingId`);--> statement-breakpoint
CREATE INDEX `lml_adminId_idx` ON `listingModerationLogs` (`adminId`);--> statement-breakpoint
CREATE INDEX `lml_createdAt_idx` ON `listingModerationLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `lr_listingId_idx` ON `listingReports` (`listingId`);--> statement-breakpoint
CREATE INDEX `lr_reporterId_idx` ON `listingReports` (`reporterId`);--> statement-breakpoint
CREATE INDEX `lr_status_idx` ON `listingReports` (`status`);--> statement-breakpoint
CREATE INDEX `mb_isActive_idx` ON `marketplaceBanners` (`isActive`);--> statement-breakpoint
CREATE INDEX `mb_sortOrder_idx` ON `marketplaceBanners` (`sortOrder`);--> statement-breakpoint
CREATE INDEX `mr_orderId_idx` ON `marketplaceReviews` (`orderId`);--> statement-breakpoint
CREATE INDEX `mr_sellerId_idx` ON `marketplaceReviews` (`sellerId`);--> statement-breakpoint
CREATE INDEX `mr_buyerId_idx` ON `marketplaceReviews` (`buyerId`);--> statement-breakpoint
CREATE INDEX `msl_keyword_idx` ON `marketplaceSearchLogs` (`keyword`);--> statement-breakpoint
CREATE INDEX `msl_createdAt_idx` ON `marketplaceSearchLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `offer_listingId_idx` ON `offers` (`listingId`);--> statement-breakpoint
CREATE INDEX `offer_buyerId_idx` ON `offers` (`buyerId`);--> statement-breakpoint
CREATE INDEX `offer_sellerId_idx` ON `offers` (`sellerId`);--> statement-breakpoint
CREATE INDEX `offer_status_idx` ON `offers` (`status`);--> statement-breakpoint
CREATE INDEX `orderItems_orderId_idx` ON `orderItems` (`orderId`);--> statement-breakpoint
CREATE INDEX `orderItems_sellerId_idx` ON `orderItems` (`sellerId`);--> statement-breakpoint
CREATE INDEX `orderItems_listingId_idx` ON `orderItems` (`listingId`);--> statement-breakpoint
CREATE INDEX `orderItems_shippingStatus_idx` ON `orderItems` (`shippingStatus`);--> statement-breakpoint
CREATE INDEX `om_orderId_idx` ON `orderMessages` (`orderId`);--> statement-breakpoint
CREATE INDEX `om_orderNo_idx` ON `orderMessages` (`orderNo`);--> statement-breakpoint
CREATE INDEX `om_senderId_idx` ON `orderMessages` (`senderId`);--> statement-breakpoint
CREATE INDEX `om_createdAt_idx` ON `orderMessages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `osh_orderId_idx` ON `orderStatusHistory` (`orderId`);--> statement-breakpoint
CREATE INDEX `osh_createdAt_idx` ON `orderStatusHistory` (`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_buyerId_idx` ON `orders` (`buyerId`);--> statement-breakpoint
CREATE INDEX `orders_orderNo_idx` ON `orders` (`orderNo`);--> statement-breakpoint
CREATE INDEX `orders_orderStatus_idx` ON `orders` (`orderStatus`);--> statement-breakpoint
CREATE INDEX `orders_paymentStatus_idx` ON `orders` (`paymentStatus`);--> statement-breakpoint
CREATE INDEX `orders_createdAt_idx` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `pr_category_idx` ON `platformRules` (`category`);--> statement-breakpoint
CREATE INDEX `pr_isActive_idx` ON `platformRules` (`isActive`);--> statement-breakpoint
CREATE INDEX `pc_isActive_idx` ON `productCategories` (`isActive`);--> statement-breakpoint
CREATE INDEX `st_token_idx` ON `searchTokens` (`token`);--> statement-breakpoint
CREATE INDEX `st_token_productType_idx` ON `searchTokens` (`token`,`productType`);--> statement-breakpoint
CREATE INDEX `st_cardId_idx` ON `searchTokens` (`cardId`);--> statement-breakpoint
CREATE INDEX `st_cardId_productType_idx` ON `searchTokens` (`cardId`,`productType`);--> statement-breakpoint
CREATE INDEX `se_ip_idx` ON `securityEvents` (`ip`);--> statement-breakpoint
CREATE INDEX `se_type_idx` ON `securityEvents` (`type`);--> statement-breakpoint
CREATE INDEX `se_createdAt_idx` ON `securityEvents` (`createdAt`);--> statement-breakpoint
CREATE INDEX `srp_riskLevel_idx` ON `sellerRiskProfiles` (`riskLevel`);--> statement-breakpoint
CREATE INDEX `srp_isWatched_idx` ON `sellerRiskProfiles` (`isWatched`);--> statement-breakpoint
CREATE INDEX `sgi_grade_idx` ON `snkrdunkGradeIndex` (`grade`);--> statement-breakpoint
CREATE INDEX `sgi_cardId_grade_idx` ON `snkrdunkGradeIndex` (`cardId`,`grade`);--> statement-breakpoint
CREATE INDEX `sgi_minPrice_idx` ON `snkrdunkGradeIndex` (`minPrice`);--> statement-breakpoint
CREATE INDEX `uc_userId_idx` ON `userCollections` (`userId`);--> statement-breakpoint
CREATE INDEX `uc_cardId_idx` ON `userCollections` (`cardId`);--> statement-breakpoint
CREATE INDEX `uc_isPublic_idx` ON `userCollections` (`isPublic`);--> statement-breakpoint
CREATE INDEX `uc_userId_cardId_idx` ON `userCollections` (`userId`,`cardId`);--> statement-breakpoint
CREATE INDEX `uc_tradedAt_idx` ON `userCollections` (`tradedAt`);--> statement-breakpoint
CREATE INDEX `usa_userId_idx` ON `userShippingAddresses` (`userId`);--> statement-breakpoint
CREATE INDEX `wl_userId_idx` ON `wishlists` (`userId`);--> statement-breakpoint
CREATE INDEX `wl_listingId_idx` ON `wishlists` (`listingId`);--> statement-breakpoint
CREATE INDEX `wl_unique_user_listing` ON `wishlists` (`userId`,`listingId`);--> statement-breakpoint
CREATE INDEX `cards_name_idx` ON `cards` (`name`);--> statement-breakpoint
CREATE INDEX `cards_nameJa_idx` ON `cards` (`nameJa`);--> statement-breakpoint
CREATE INDEX `cards_cardNumber_idx` ON `cards` (`cardNumber`);--> statement-breakpoint
CREATE INDEX `idx_datasources_cardId_source` ON `dataSources` (`cardId`,`source`);--> statement-breakpoint
CREATE INDEX `idx_datasources_source_lastUpdatedAt` ON `dataSources` (`source`,`lastUpdatedAt`);--> statement-breakpoint
CREATE INDEX `idx_datasources_sourceIdentifier` ON `dataSources` (`sourceIdentifier`);--> statement-breakpoint
CREATE INDEX `idx_datasources_isActive_source` ON `dataSources` (`isActive`,`source`);--> statement-breakpoint
CREATE INDEX `ml_listingMode_idx` ON `marketplaceListings` (`listingMode`);--> statement-breakpoint
CREATE INDEX `ml_auctionStatus_idx` ON `marketplaceListings` (`auctionStatus`);--> statement-breakpoint
CREATE INDEX `ml_auctionEndAt_idx` ON `marketplaceListings` (`auctionEndAt`);--> statement-breakpoint
CREATE INDEX `ml_status_listingMode_createdAt_idx` ON `marketplaceListings` (`status`,`listingMode`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ml_status_tcgSeries_createdAt_idx` ON `marketplaceListings` (`status`,`tcgSeries`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mo_buyerId_createdAt_idx` ON `marketplaceOrders` (`buyerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mo_sellerId_createdAt_idx` ON `marketplaceOrders` (`sellerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mo_sellerId_status_createdAt_idx` ON `marketplaceOrders` (`sellerId`,`orderStatus`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mo_listingId_idx` ON `marketplaceOrders` (`listingId`);--> statement-breakpoint
CREATE INDEX `ph_cardId_grade_soldAt_idx` ON `priceHistory` (`cardId`,`grade`,`soldAt`);--> statement-breakpoint
CREATE INDEX `ph_source_grade_soldAt_idx` ON `priceHistory` (`source`,`grade`,`soldAt`);--> statement-breakpoint
CREATE INDEX `tcc_cardId_idx` ON `trendingCardsCache` (`cardId`);--> statement-breakpoint
CREATE INDEX `idx_viewhistory_userId_viewedAt` ON `viewHistory` (`userId`,`viewedAt`);--> statement-breakpoint
CREATE INDEX `idx_viewhistory_cardId` ON `viewHistory` (`cardId`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_userId` ON `watchlist` (`userId`);--> statement-breakpoint
ALTER TABLE `marketplaceListings` DROP COLUMN `sealedProductId`;--> statement-breakpoint
ALTER TABLE `marketplaceListings` DROP COLUMN `price`;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` DROP COLUMN `alipayTradeNo`;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` DROP COLUMN `trackingNo`;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` DROP COLUMN `subtotal`;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` DROP COLUMN `platformFee`;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` DROP COLUMN `total`;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` DROP COLUMN `deliveredAt`;--> statement-breakpoint
ALTER TABLE `marketplaceOrders` DROP COLUMN `completedAt`;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` DROP COLUMN `orderItemId`;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` DROP COLUMN `amount`;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` DROP COLUMN `currency`;--> statement-breakpoint
ALTER TABLE `marketplacePayouts` DROP COLUMN `paidAt`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `content`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `priority`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `relatedCardId`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `relatedUrl`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `metadata`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `readAt`;--> statement-breakpoint
ALTER TABLE `sellerProfiles` DROP COLUMN `rating`;