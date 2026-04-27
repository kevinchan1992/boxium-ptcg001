-- Add batchCostHkd to gradingBatches to track PSA grading cost per batch
ALTER TABLE `gradingBatches` ADD COLUMN IF NOT EXISTS `batchCostHkd` decimal(10,2) DEFAULT '0.00' AFTER `status`;
