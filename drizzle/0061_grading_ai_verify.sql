-- Add AI verification columns to gradingSubmissions
ALTER TABLE `gradingSubmissions` 
  ADD COLUMN IF NOT EXISTS `alipayProofAiResult` ENUM('pass','warning','fail'),
  ADD COLUMN IF NOT EXISTS `alipayProofAiConfidence` ENUM('high','medium','low'),
  ADD COLUMN IF NOT EXISTS `alipayProofAiSummary` TEXT,
  ADD COLUMN IF NOT EXISTS `alipayProofAiCheckedAt` TIMESTAMP;
