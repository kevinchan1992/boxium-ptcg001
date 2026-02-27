-- Migration script: Move card ID 1080001 from cards table to sealedProducts table
-- This card is actually a sealed box product, not a single card

START TRANSACTION;

-- Step 1: Insert the sealed product into sealedProducts table
INSERT INTO sealedProducts (
  gameId,
  name,
  nameJa,
  boxType,
  imageUrl,
  releaseDate,
  createdAt,
  updatedAt
)
SELECT 
  gameId,
  name,
  nameJa,
  'booster_box' as boxType,
  imageUrl,
  releaseDate,
  createdAt,
  updatedAt
FROM cards
WHERE id = 1080001;

-- Get the new sealedProduct ID
SET @newSealedProductId = LAST_INSERT_ID();

-- Step 2: Update dataSources table to point to the new sealedProduct
-- Note: The cardId column in dataSources will now point to sealedProducts table for productType='sealed_product'
UPDATE dataSources
SET cardId = @newSealedProductId
WHERE cardId = 1080001 AND productType = 'sealed_product';

-- Step 3: Update priceHistory table
UPDATE priceHistory
SET cardId = @newSealedProductId,
    productType = 'sealed_product'
WHERE cardId = 1080001;

-- Step 4: Update watchlist table (if any)
UPDATE watchlist
SET cardId = @newSealedProductId,
    productType = 'sealed_product'
WHERE cardId = 1080001;

-- Step 5: Update viewHistory table (if any)
UPDATE viewHistory
SET cardId = @newSealedProductId,
    productType = 'sealed_product'
WHERE cardId = 1080001;

-- Step 6: Delete the old card from cards table
DELETE FROM cards WHERE id = 1080001;

-- Verify the migration
SELECT 'Migration completed. New sealedProduct ID:' as message, @newSealedProductId as newId;

SELECT 'Sealed Product:' as info;
SELECT * FROM sealedProducts WHERE id = @newSealedProductId;

SELECT 'Data Source:' as info;
SELECT * FROM dataSources WHERE cardId = @newSealedProductId AND productType = 'sealed_product';

SELECT 'Price History Count:' as info, COUNT(*) as total FROM priceHistory WHERE cardId = @newSealedProductId;

COMMIT;
