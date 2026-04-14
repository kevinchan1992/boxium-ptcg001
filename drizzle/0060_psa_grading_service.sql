-- PSA Grading Service Tables Migration

CREATE TABLE IF NOT EXISTS `gradingServiceTiers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
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
  INDEX `gst_isActive_idx` (`isActive`),
  INDEX `gst_sortOrder_idx` (`sortOrder`)
);

CREATE TABLE IF NOT EXISTS `gradingBatches` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `batchName` varchar(128) NOT NULL,
  `cutoffDate` timestamp NOT NULL,
  `shippedDate` timestamp,
  `expectedReturnDate` timestamp,
  `status` enum('open','closed','shipped','returned') NOT NULL DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  INDEX `gb_status_idx` (`status`),
  INDEX `gb_cutoffDate_idx` (`cutoffDate`)
);

CREATE TABLE IF NOT EXISTS `gradingSubmissions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `orderNo` varchar(32) NOT NULL UNIQUE,
  `userId` int NOT NULL,
  `status` enum('pending_shipment','received','submitted_to_psa','grading','graded','payment_overdue','paid','returned','completed','cancelled') NOT NULL DEFAULT 'pending_shipment',
  `totalFeeHkd` decimal(10,2) NOT NULL,
  `paymentMethod` enum('stripe','alipay_hk'),
  `stripePaymentIntentId` varchar(128),
  `batchId` int,
  `shippingDeadline` timestamp,
  `paymentDeadline` timestamp,
  `gradedAt` timestamp,
  `adminNotes` text,
  `returnTrackingNo` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  INDEX `gs_userId_idx` (`userId`),
  INDEX `gs_status_idx` (`status`),
  INDEX `gs_orderNo_idx` (`orderNo`),
  INDEX `gs_batchId_idx` (`batchId`)
);

CREATE TABLE IF NOT EXISTS `gradingSubmissionItems` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
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
  INDEX `gsi_submissionId_idx` (`submissionId`),
  INDEX `gsi_tierId_idx` (`tierId`)
);

-- Insert initial 3 service tiers
INSERT INTO `gradingServiceTiers` (`name`, `feeHkd`, `maxDeclaredValueUsd`, `estimatedDaysMin`, `estimatedDaysMax`, `description`, `isActive`, `sortOrder`) VALUES
('Value Bulk', 275.00, 499.00, 90, 150, '最經濟之選，適合大量提交。鑑定完成後以批次寄回。', true, 1),
('Regular', 835.00, 499.00, 20, 30, '均衡之選，適合一般收藏卡片。', true, 2),
('Express', 1670.00, 2499.00, 8, 12, '快速鑑定，適合高價值卡片。', true, 3);
