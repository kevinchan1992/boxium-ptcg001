-- Migration: Add auction deposit fields to auctionBids
-- and high-value risk control + payment fields to marketplaceListings

-- Add deposit fields to auctionBids
ALTER TABLE `auctionBids`
  ADD COLUMN `depositAmountHkd` decimal(10,2),
  ADD COLUMN `depositPaymentIntentId` varchar(200),
  ADD COLUMN `depositStatus` enum('none','held','released','captured') NOT NULL DEFAULT 'none',
  ADD COLUMN `depositHeldAt` timestamp,
  ADD COLUMN `depositReleasedAt` timestamp;

-- Add high-value risk control + auction payment fields to marketplaceListings
ALTER TABLE `marketplaceListings`
  ADD COLUMN `isHighValueReview` boolean NOT NULL DEFAULT false,
  ADD COLUMN `auctionPaymentSessionId` varchar(200),
  ADD COLUMN `auctionPaymentStatus` enum('pending','paid','failed','expired'),
  ADD COLUMN `auctionPaymentPaidAt` timestamp,
  ADD COLUMN `auctionOrderId` int;
