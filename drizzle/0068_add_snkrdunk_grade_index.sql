-- Create snkrdunkGradeIndex table for fast grade-based card search
-- This normalizes the JSON listings into indexed rows, eliminating full-table JSON scan
CREATE TABLE IF NOT EXISTS `snkrdunkGradeIndex` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `cardId` int NOT NULL,
  `grade` varchar(64) NOT NULL,
  `minPrice` decimal(12,2) NOT NULL,
  `listingCount` int NOT NULL DEFAULT 1,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX `sgi_grade_idx` ON `snkrdunkGradeIndex` (`grade`);
CREATE INDEX `sgi_cardId_grade_idx` ON `snkrdunkGradeIndex` (`cardId`, `grade`);
CREATE INDEX `sgi_minPrice_idx` ON `snkrdunkGradeIndex` (`minPrice`);
