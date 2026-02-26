# eBay Cleanup Progress Notes

## Completed
- [x] getEbaySoldItems - 停用（返回空陣列）
- [x] updateEbayPrices - 停用（throw error + 原始代碼已註釋）

## Remaining in routers.ts
- [ ] batchUpdateEbayPrices - 需要停用
- [ ] getBatchUpdateProgress - 需要移除 eBay 部分
- [ ] pauseBatchUpdate - 需要移除 eBay 部分
- [ ] resumeBatchUpdate - 需要移除 eBay 部分
- [ ] startPersistentEbayBatchUpdate - 需要停用
- [ ] getPersistentTaskProgress - 需要移除 batch_ebay_update 選項
- [ ] updateScheduleSettings - 需要移除 ebayEnabled/ebayUpdateTime
- [ ] getScheduleExecutionHistory - 已返回空陣列（ebay: []）

## Remaining in frontend
- [ ] AdminDashboard.tsx - 移除 eBay 數據源健康監控
- [ ] AdminScheduleManagement.tsx - 移除 eBay 排程設定
- [ ] AdminScraperPerformance.tsx - 移除 eBay 搜尋統計
- [ ] BatchTaskProgressBar.tsx - 移除 eBay 批量更新進度

## Files to delete (Phase 2)
- server/ebayService.ts
- server/ebayImageSearch.ts
- server/persistentEbayBatchUpdate.ts
- server/batchUpdateProgress.ts
- server/ebay.test.ts
- server/test-ebay-gardevoir.ts
- server/test-ebay-image-search.ts
- server/services/ebay.ts (if not needed by searchEbayMarketPrice)

## Files to KEEP
- server/ebay.ts - searchEbayItems, convertUsdToHkd (used by searchEbayMarketPrice)
