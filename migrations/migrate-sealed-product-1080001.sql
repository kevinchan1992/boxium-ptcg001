-- Migration script: Move sealed product (ID 1080001) from cards table to sealedProducts table

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

-- Record the new sealedProduct ID (will be auto-incremented)
SET @newSealedProductId = LAST_INSERT_ID();

-- Step 2: Update dataSources table to point to the new sealedProduct
-- Note: We need to add a new column to dataSources to distinguish between cards and sealedProducts
-- For now, we'll keep cardId but remember it now points to sealedProducts table for productType='sealed_product'

-- Step 3: Update priceHistory table
-- Update all price history records for this card to point to the new sealedProduct
-- and set productType to 'sealed_product'
UPDATE priceHistory
SET productType = 'sealed_product'
WHERE cardId = 1080001;

-- Step 4: Update watchlist table (if any)
UPDATE watchlist
SET productType = 'sealed_product'
WHERE cardId = 1080001;

-- Step 5: Update viewHistory table (if any)
UPDATE viewHistory
SET productType = 'sealed_product'
WHERE cardId = 1080001;

-- Note: We are NOT deleting the card from cards table yet
-- We'll keep it for backward compatibility and delete it after confirming everything works

SELECT 'Migration completed. New sealedProduct ID:' as message, @newSealedProductId as newId;
