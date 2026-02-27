# 卡盒問題調查結果

## 1. SNKRDUNK API 結構
- `productNumber` = "pkmn-tcg-M2" → 這就是用戶要的 スタイルコード
- 成交歷史中 `size` 欄位 = 數量（如 "3個", "10個", "1個"）
- `condition` 欄位在卡盒中為空
- 目前爬取代碼用 `item.condition` 存 quantity，但實際上應該用 `item.size`

## 2. 重複卡盒問題
- sealedProducts 表有 11 條記錄，其中 2 組重複
- addSnkrdunkSource 中沒有檢查 sealedProduct 是否已存在（TODO 註解已標記）
- deleteDataSource 只刪除 dataSources 表記錄，不刪除 sealedProducts 表記錄
- 需要：刪除 dataSource 時也要刪除對應的 sealedProduct 和 priceHistory

## 3. 成交數量顯示
- API 返回 `size` 欄位（如 "3個"），但爬取代碼用 `item.condition`（空值）
- 需要改為用 `item.size` 來存儲 quantity
- 前端顯示 "-" 是因為 quantity 為 null

## 4. 參考價格邏輯（僅卡盒）
- 目前：所有成交記錄的平均價格
- 應改為：最新一筆成交價格 ÷ 成交數量（提取數字部分）
