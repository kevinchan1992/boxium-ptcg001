-- Add upgradeItemIds to gradingSubmissions to track which items were selected for tier upgrade
ALTER TABLE `gradingSubmissions` ADD COLUMN IF NOT EXISTS `upgradeItemIds` varchar(512) NULL AFTER `upgradeNewTierId`;
