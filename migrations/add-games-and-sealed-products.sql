-- 數據庫擴展遷移腳本
-- 目標：支持多種 TCG 遊戲和兩種產品類型（單卡、卡盒）

-- ============================================
-- 步驟 1：創建 games 表（遊戲類型管理）
-- ============================================

CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL COMMENT '遊戲代碼（例如：pokemon, one_piece）',
  name VARCHAR(128) NOT NULL COMMENT '英文名稱',
  nameJa VARCHAR(128) COMMENT '日文名稱',
  nameZh VARCHAR(128) COMMENT '中文名稱',
  publisher VARCHAR(128) COMMENT '發行商',
  isActive BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
  sortOrder INT DEFAULT 0 COMMENT '排序順序',
  icon TEXT COMMENT '遊戲圖標 URL',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_games_code (code),
  INDEX idx_games_isActive (isActive)
) COMMENT='TCG 遊戲類型表';

-- 插入初始遊戲數據（Pokémon 和 One Piece）
INSERT INTO games (code, name, nameJa, nameZh, publisher, sortOrder) VALUES
  ('pokemon', 'Pokémon TCG', 'ポケモンカードゲーム', '寶可夢集換式卡牌遊戲', 'The Pokémon Company', 1),
  ('one_piece', 'One Piece Card Game', 'ONE PIECEカードゲーム', '海賊王卡牌遊戲', 'Bandai', 2)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  nameJa = VALUES(nameJa),
  nameZh = VALUES(nameZh),
  publisher = VALUES(publisher),
  sortOrder = VALUES(sortOrder);

-- ============================================
-- 步驟 2：創建 sealedProducts 表（卡盒產品）
-- ============================================

CREATE TABLE IF NOT EXISTS sealedProducts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gameId INT NOT NULL COMMENT '遊戲類型 ID（外鍵關聯 games 表）',
  name TEXT NOT NULL COMMENT '產品名稱',
  nameJa TEXT COMMENT '日文名稱',
  nameZh TEXT COMMENT '中文名稱',
  boxType ENUM('booster_box', 'other') NOT NULL DEFAULT 'booster_box' COMMENT '產品類型（booster_box=卡盒, other=其他）',
  itemCount INT COMMENT '包含數量（例如：一盒包含 30 包）',
  setName TEXT COMMENT '系列名稱',
  series TEXT COMMENT '擴展包系列',
  imageUrl TEXT COMMENT '產品圖片 URL',
  releaseDate TIMESTAMP COMMENT '發售日期',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sealed_gameId (gameId),
  INDEX idx_sealed_boxType (boxType)
) COMMENT='密封產品表（卡盒等）';

-- ============================================
-- 步驟 3：修改 cards 表（添加 gameId 欄位）
-- ============================================

-- 檢查 gameId 欄位是否已存在
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'cards' 
    AND COLUMN_NAME = 'gameId'
);

-- 如果不存在則添加
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE cards ADD COLUMN gameId INT NOT NULL DEFAULT 1 COMMENT ''遊戲類型 ID（外鍵關聯 games 表）''',
  'SELECT ''Column gameId already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_cards_gameId ON cards(gameId);

-- ============================================
-- 步驟 4：修改 dataSources 表
-- ============================================

-- 添加 gameId 欄位
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'dataSources' 
    AND COLUMN_NAME = 'gameId'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE dataSources ADD COLUMN gameId INT COMMENT ''遊戲類型 ID（外鍵關聯 games 表）''',
  'SELECT ''Column gameId already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 productType 欄位
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'dataSources' 
    AND COLUMN_NAME = 'productType'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE dataSources ADD COLUMN productType ENUM(''single_card'', ''sealed_product'') DEFAULT ''single_card'' NOT NULL COMMENT ''產品類型''',
  'SELECT ''Column productType already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 為現有數據設置默認值（Pokémon TCG + 單卡）
UPDATE dataSources SET gameId = 1, productType = 'single_card' WHERE gameId IS NULL;

-- 將 gameId 設置為 NOT NULL
ALTER TABLE dataSources MODIFY COLUMN gameId INT NOT NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_datasources_gameId ON dataSources(gameId);
CREATE INDEX IF NOT EXISTS idx_datasources_productType ON dataSources(productType);

-- ============================================
-- 步驟 5：修改 priceHistory 表
-- ============================================

-- 添加 productType 欄位
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'priceHistory' 
    AND COLUMN_NAME = 'productType'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE priceHistory ADD COLUMN productType ENUM(''single_card'', ''sealed_product'') DEFAULT ''single_card'' NOT NULL COMMENT ''產品類型''',
  'SELECT ''Column productType already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_price_productType ON priceHistory(productType);

-- ============================================
-- 步驟 6：修改 watchlist 表
-- ============================================

-- 添加 productType 欄位
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'watchlist' 
    AND COLUMN_NAME = 'productType'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE watchlist ADD COLUMN productType ENUM(''single_card'', ''sealed_product'') DEFAULT ''single_card'' NOT NULL COMMENT ''產品類型''',
  'SELECT ''Column productType already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_watchlist_productType ON watchlist(productType);

-- ============================================
-- 步驟 7：修改 viewHistory 表
-- ============================================

-- 添加 productType 欄位
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'viewHistory' 
    AND COLUMN_NAME = 'productType'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE viewHistory ADD COLUMN productType ENUM(''single_card'', ''sealed_product'') DEFAULT ''single_card'' NOT NULL COMMENT ''產品類型''',
  'SELECT ''Column productType already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_viewhistory_productType ON viewHistory(productType);

-- ============================================
-- 步驟 8：添加外鍵約束
-- ============================================

-- 為 cards 表添加外鍵
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'cards' 
    AND CONSTRAINT_NAME = 'fk_cards_gameId'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE cards ADD CONSTRAINT fk_cards_gameId FOREIGN KEY (gameId) REFERENCES games(id)',
  'SELECT ''Foreign key fk_cards_gameId already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 為 dataSources 表添加外鍵
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'dataSources' 
    AND CONSTRAINT_NAME = 'fk_datasources_gameId'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE dataSources ADD CONSTRAINT fk_datasources_gameId FOREIGN KEY (gameId) REFERENCES games(id)',
  'SELECT ''Foreign key fk_datasources_gameId already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 為 sealedProducts 表添加外鍵
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'sealedProducts' 
    AND CONSTRAINT_NAME = 'fk_sealed_gameId'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE sealedProducts ADD CONSTRAINT fk_sealed_gameId FOREIGN KEY (gameId) REFERENCES games(id)',
  'SELECT ''Foreign key fk_sealed_gameId already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 完成
-- ============================================

SELECT 'Database migration completed successfully!' AS message;
