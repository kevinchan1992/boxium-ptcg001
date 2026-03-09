-- Step 1: Add jpyPrice column to priceHistory table
ALTER TABLE `priceHistory` ADD `jpyPrice` int;--> statement-breakpoint

-- Step 2: Backfill jpyPrice from existing HKD price (reverse convert: HKD / 0.055 ≈ JPY)
-- This is approximate; the batch update will re-scrape and set accurate values
UPDATE `priceHistory` SET `jpyPrice` = ROUND(`price` / 0.055) WHERE `source` = 'snkrdunk' AND `jpyPrice` IS NULL;--> statement-breakpoint

-- Step 3: Drop the old UNIQUE INDEX that used HKD price
DROP INDEX `uniq_price_card_source_grade_soldAt_price` ON `priceHistory`;--> statement-breakpoint

-- Step 4: Remove duplicate records before creating new UNIQUE INDEX
-- Keep only the record with the smallest id for each (cardId, source, grade, soldAt, jpyPrice) group
DELETE ph FROM `priceHistory` ph
INNER JOIN (
  SELECT MIN(id) as keep_id, cardId, source, grade, soldAt, jpyPrice
  FROM `priceHistory`
  WHERE source = 'snkrdunk'
  GROUP BY cardId, source, grade, soldAt, jpyPrice
  HAVING COUNT(*) > 1
) dups ON ph.cardId = dups.cardId 
  AND ph.source = dups.source 
  AND (ph.grade = dups.grade OR (ph.grade IS NULL AND dups.grade IS NULL))
  AND ph.soldAt = dups.soldAt 
  AND (ph.jpyPrice = dups.jpyPrice OR (ph.jpyPrice IS NULL AND dups.jpyPrice IS NULL))
  AND ph.id != dups.keep_id;--> statement-breakpoint

-- Step 5: Create new UNIQUE INDEX using jpyPrice (stable, not affected by exchange rate)
CREATE UNIQUE INDEX `uniq_price_card_source_grade_soldAt_jpyPrice` ON `priceHistory` (`cardId`, `source`, `grade`, `soldAt`, `jpyPrice`);
