-- Cleanup dead/unused columns from marketplaceOrders and marketplaceListings
-- These columns had 0 data in DB and were never read by any code

-- marketplaceOrders: remove unused Alipay tracking fields and expired payment fields
ALTER TABLE `marketplaceOrders` DROP COLUMN `alipayAcquirementId`;
ALTER TABLE `marketplaceOrders` DROP COLUMN `alipayMerchantTransId`;
ALTER TABLE `marketplaceOrders` DROP COLUMN `trackingNo`;
ALTER TABLE `marketplaceOrders` DROP COLUMN `paymentExpiresAt`;

-- marketplaceListings: remove unused reference price and favorite count fields
ALTER TABLE `marketplaceListings` DROP COLUMN `refMarketPriceHkd`;
ALTER TABLE `marketplaceListings` DROP COLUMN `refMarketPriceDate`;
ALTER TABLE `marketplaceListings` DROP COLUMN `favoriteCount`;
