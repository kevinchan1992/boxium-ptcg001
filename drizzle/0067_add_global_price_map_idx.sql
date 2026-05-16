-- Add covering index for _loadGlobalPriceMap query:
-- SELECT cardId, price FROM priceHistory
-- WHERE source='snkrdunk' AND grade='PSA 10' AND isSuspectedBulk=false
-- ORDER BY soldAt DESC LIMIT 10000
-- Without isSuspectedBulk in index, MySQL must do 591k+ row table lookups (3s+).
-- With this covering index, the query runs entirely in-index (~100ms).
CREATE INDEX `ph_global_price_map_idx` ON `priceHistory` (`source`, `grade`, `isSuspectedBulk`, `soldAt`, `cardId`, `price`);
