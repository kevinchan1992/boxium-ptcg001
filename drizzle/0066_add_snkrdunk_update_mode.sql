-- Add snkrdunkUpdateMode to priceUpdateSchedule
-- 'platform' = use platform cron scheduler
-- 'github_actions' = GitHub Actions is primary (platform cron disabled)
ALTER TABLE `priceUpdateSchedule` ADD COLUMN IF NOT EXISTS `snkrdunkUpdateMode` varchar(32) NOT NULL DEFAULT 'github_actions' AFTER `snkrdunkLastCatchupAt`;
