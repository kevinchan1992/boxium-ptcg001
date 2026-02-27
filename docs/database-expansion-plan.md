# 數據庫擴展方案 - 支持多種 TCG 和產品類型

## 📋 方案概述

**目標**：
1. 支持多種 TCG 遊戲（Pokémon、Yu-Gi-Oh!、Magic、One Piece 等）
2. 支持多種產品類型（單卡、卡盒、補充包等）
3. 保持現有數據完整性
4. 確保數據分類準確性（手動選擇）

**核心設計**：
- 使用獨立的 `games` 表管理遊戲類型（方案 2）
- 保留 `cards` 表用於單卡，創建 `sealedProducts` 表用於卡盒（方案 C）
- 在添加數據源時手動選擇遊戲類型和產品類型（方案 A）

---

## 🗄️ 數據庫結構設計

### 1. 新增 `games` 表（遊戲類型管理）

```sql
CREATE TABLE games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL COMMENT '遊戲代碼（例如：pokemon, yugioh, magic）',
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

-- 插入初始遊戲數據
INSERT INTO games (code, name, nameJa, nameZh, publisher, sortOrder) VALUES
  ('pokemon', 'Pokémon TCG', 'ポケモンカードゲーム', '寶可夢集換式卡牌遊戲', 'The Pokémon Company', 1),
  ('one_piece', 'One Piece Card Game', 'ONE PIECEカードゲーム', '海賊王卡牌遊戲', 'Bandai', 2);
```

### 2. 修改 `cards` 表（單卡）

```sql
-- 添加 gameId 字段
ALTER TABLE cards 
  ADD COLUMN gameId INT NOT NULL DEFAULT 1 COMMENT '遊戲類型 ID（外鍵關聯 games 表）',
  ADD FOREIGN KEY fk_cards_gameId (gameId) REFERENCES games(id),
  ADD INDEX idx_cards_gameId (gameId);

-- 為現有數據設置默認值（Pokémon TCG）
UPDATE cards SET gameId = 1 WHERE gameId = 0;
```

### 3. 新增 `sealedProducts` 表（密封產品：卡盒、補充包等）

```sql
CREATE TABLE sealedProducts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gameId INT NOT NULL COMMENT '遊戲類型 ID（外鍵關聯 games 表）',
  name TEXT NOT NULL COMMENT '產品名稱',
  nameJa TEXT COMMENT '日文名稱',
  nameZh TEXT COMMENT '中文名稱',
  boxType ENUM('booster_box', 'other') NOT NULL COMMENT '產品類型（booster_box=卡盒, other=其他）',
  itemCount INT COMMENT '包含數量（例如：一盒包含 30 包）',
  setName TEXT COMMENT '系列名稱',
  series TEXT COMMENT '擴展包系列',
  imageUrl TEXT COMMENT '產品圖片 URL',
  releaseDate TIMESTAMP COMMENT '發售日期',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY fk_sealed_gameId (gameId) REFERENCES games(id),
  INDEX idx_sealed_gameId (gameId),
  INDEX idx_sealed_boxType (boxType)
) COMMENT='密封產品表（卡盒、補充包等）';
```

### 4. 修改 `dataSources` 表（數據源）

```sql
-- 添加遊戲類型和產品類型字段
ALTER TABLE dataSources 
  ADD COLUMN gameId INT COMMENT '遊戲類型 ID（外鍵關聯 games 表）',
  ADD COLUMN productType ENUM('single_card', 'sealed_product') DEFAULT 'single_card' NOT NULL COMMENT '產品類型',
  ADD FOREIGN KEY fk_datasources_gameId (gameId) REFERENCES games(id),
  ADD INDEX idx_datasources_gameId (gameId),
  ADD INDEX idx_datasources_productType (productType);

-- 為現有數據設置默認值（Pokémon TCG + 單卡）
UPDATE dataSources SET gameId = 1, productType = 'single_card' WHERE gameId IS NULL;
ALTER TABLE dataSources MODIFY COLUMN gameId INT NOT NULL;
```

### 5. 修改 `priceHistory` 表（價格歷史）

```sql
-- 添加產品類型字段
ALTER TABLE priceHistory 
  ADD COLUMN productType ENUM('single_card', 'sealed_product') DEFAULT 'single_card' NOT NULL COMMENT '產品類型',
  ADD INDEX idx_price_productType (productType);

-- 為現有數據設置默認值（單卡）
UPDATE priceHistory SET productType = 'single_card' WHERE productType IS NULL;
```

### 6. 修改 `watchlist` 表（收藏夾）

```sql
-- 添加產品類型字段
ALTER TABLE watchlist 
  ADD COLUMN productType ENUM('single_card', 'sealed_product') DEFAULT 'single_card' NOT NULL COMMENT '產品類型',
  ADD INDEX idx_watchlist_productType (productType);
```

### 7. 修改 `viewHistory` 表（瀏覽歷史）

```sql
-- 添加產品類型字段
ALTER TABLE viewHistory 
  ADD COLUMN productType ENUM('single_card', 'sealed_product') DEFAULT 'single_card' NOT NULL COMMENT '產品類型',
  ADD INDEX idx_viewhistory_productType (productType);
```

---

## 🎨 前端界面設計

### 添加數據源表單

```
┌──────────────────────────────────────────────────┐
│  添加 SNKRDUNK 數據源                             │
├──────────────────────────────────────────────────┤
│                                                  │
│  SNKRDUNK URL: *                                 │
│  ┌────────────────────────────────────────────┐ │
│  │ https://snkrdunk.com/apparels/390228       │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  遊戲類型: *                                      │
│  ┌────────────────────────────────────────────┐ │
│  │ Pokémon TCG                            ▼  │ │
│  └────────────────────────────────────────────┘ │
│    選項：    選項：                                        │
    • Pokémon TCG (寶可夢集換式卡牌遊戲)          │
    • One Piece Card Game (海賊王卡牌遊戲)        │
│                                                  │
│  產品類型: *                                      │
│  ┌────────────────────────────────────────────┐ │
│   │ ● 單卡 (Single Card)                       │ │
  │ ○ 卡盒 (Booster Box)                       │ │  │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────┐  ┌────────────┐                │
│  │   取消     │  │ 添加數據源  │                │
│  └────────────┘  └────────────┘                │
└──────────────────────────────────────────────────┘
```

---

## 🔄 數據流程

### 添加數據源流程

```
1. 用戶輸入 SNKRDUNK URL
   ↓
2. 用戶手動選擇「遊戲類型」（例如：Pokémon TCG）
   ↓
3. 用戶手動選擇「產品類型」（例如：單卡）
   ↓
4. 系統爬取 SNKRDUNK 頁面，提取產品信息
   ↓
5. 根據產品類型，決定存儲位置：
   • 如果是「單卡」→ 創建/更新 cards 表記錄
   • 如果是「密封產品」→ 創建/更新 sealedProducts 表記錄
   ↓
6. 在 dataSources 表中記錄：
   • cardId 或 sealedProductId（根據產品類型）
   • gameId（遊戲類型 ID）
   • productType（產品類型）
   • sourceUrl（SNKRDUNK URL）
```

### 價格更新流程

```
1. 批量更新任務開始
   ↓
2. 從 dataSources 表讀取所有活躍的數據源
   ↓
3. 對每個數據源：
   a. 爬取 SNKRDUNK 頁面獲取最新價格
   b. 根據 productType 決定更新哪個表：
      • single_card → 更新 cards 表
      • sealed_product → 更新 sealedProducts 表
   c. 在 priceHistory 表中插入新的價格記錄
      • 包含 productType 字段
      • cardId 欄位改為通用的 productId
```

---

## 📊 查詢範例

### 查詢所有 Pokémon 單卡

```sql
SELECT c.*, g.name as gameName
FROM cards c
JOIN games g ON c.gameId = g.id
WHERE g.code = 'pokemon';
```

### 查詢所有 One Piece 卡盒

```sql
SELECT sp.*, g.name as gameName
FROM sealedProducts sp
JOIN games g ON sp.gameId = g.id
WHERE g.code = 'one_piece' AND sp.boxType = 'booster_box';
```

### 查詢某張卡的價格歷史（包含遊戲信息）

```sql
SELECT ph.*, c.name as cardName, g.name as gameName
FROM priceHistory ph
JOIN cards c ON ph.cardId = c.id AND ph.productType = 'single_card'
JOIN games g ON c.gameId = g.id
WHERE c.id = 300001
ORDER BY ph.createdAt DESC;
```

### 統一查詢所有產品（單卡 + 密封產品）

```sql
-- 使用 UNION 合併查詢
SELECT 
  c.id,
  'single_card' as productType,
  g.name as gameName,
  c.name,
  c.imageUrl,
  c.createdAt
FROM cards c
JOIN games g ON c.gameId = g.id

UNION ALL

SELECT 
  sp.id,
  'sealed_product' as productType,
  g.name as gameName,
  sp.name,
  sp.imageUrl,
  sp.createdAt
FROM sealedProducts sp
JOIN games g ON sp.gameId = g.id

ORDER BY createdAt DESC
LIMIT 50;
```

---

## 🔧 數據遷移步驟

### 步驟 1：創建新表和字段

```sql
-- 1. 創建 games 表
CREATE TABLE games (...);
INSERT INTO games (...) VALUES (...);

-- 2. 創建 sealedProducts 表
CREATE TABLE sealedProducts (...);

-- 3. 修改現有表
ALTER TABLE cards ADD COLUMN gameId INT NOT NULL DEFAULT 1;
ALTER TABLE dataSources ADD COLUMN gameId INT, ADD COLUMN productType ENUM(...);
ALTER TABLE priceHistory ADD COLUMN productType ENUM(...);
ALTER TABLE watchlist ADD COLUMN productType ENUM(...);
ALTER TABLE viewHistory ADD COLUMN productType ENUM(...);
```

### 步驟 2：遷移現有數據

```sql
-- 將所有現有卡牌設置為 Pokémon TCG
UPDATE cards SET gameId = 1 WHERE gameId = 0;

-- 將所有現有數據源設置為 Pokémon TCG + 單卡
UPDATE dataSources SET gameId = 1, productType = 'single_card' WHERE gameId IS NULL;

-- 將所有現有價格歷史設置為單卡
UPDATE priceHistory SET productType = 'single_card';

-- 將所有現有收藏夾設置為單卡
UPDATE watchlist SET productType = 'single_card';

-- 將所有現有瀏覽歷史設置為單卡
UPDATE viewHistory SET productType = 'single_card';
```

### 步驟 3：添加外鍵約束

```sql
ALTER TABLE cards ADD FOREIGN KEY (gameId) REFERENCES games(id);
ALTER TABLE dataSources ADD FOREIGN KEY (gameId) REFERENCES games(id);
ALTER TABLE sealedProducts ADD FOREIGN KEY (gameId) REFERENCES games(id);
```

### 步驟 4：添加索引

```sql
CREATE INDEX idx_cards_gameId ON cards(gameId);
CREATE INDEX idx_datasources_gameId ON dataSources(gameId);
CREATE INDEX idx_datasources_productType ON dataSources(productType);
CREATE INDEX idx_price_productType ON priceHistory(productType);
```

---

## ✅ 驗證清單

- [ ] `games` 表創建成功，包含 7 種 TCG 遊戲
- [ ] `sealedProducts` 表創建成功
- [ ] `cards` 表添加 `gameId` 字段
- [ ] `dataSources` 表添加 `gameId` 和 `productType` 字段
- [ ] `priceHistory` 表添加 `productType` 字段
- [ ] 所有現有數據遷移完成（設置為 Pokémon TCG + 單卡）
- [ ] 外鍵約束添加成功
- [ ] 索引創建成功
- [ ] 前端表單更新（添加遊戲類型和產品類型選擇器）
- [ ] 後端 API 更新（支持新的字段）
- [ ] 批量更新邏輯更新（支持不同產品類型）
- [ ] 測試添加 Pokémon 單卡
- [ ] 測試添加 Pokémon 卡盒
- [ ] 測試添加 One Piece 單卡
- [ ] 測試價格更新功能
- [ ] 測試查詢功能

---

## 📝 注意事項

1. **數據完整性**：所有現有的 36,215 個 SNKRDUNK 數據源將自動設置為「Pokémon TCG + 單卡」
2. **向後兼容**：現有的查詢和 API 不會受到影響（因為添加了默認值）
3. **擴展性**：未來新增遊戲類型只需在 `games` 表插入一行數據
4. **手動確認**：每次添加數據源都需要手動選擇遊戲類型和產品類型，確保準確性

---

## 🚀 下一步

1. 執行數據庫遷移腳本
2. 更新後端 API（tRPC procedures）
3. 更新前端界面（添加數據源表單）
4. 測試所有功能
5. 保存 checkpoint
