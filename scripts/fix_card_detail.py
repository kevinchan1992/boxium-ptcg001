#!/usr/bin/env python3
"""Fix hardcoded Chinese strings in CardDetail.tsx"""
import re

FILE = "/home/ubuntu/boxium-ptcg/client/src/pages/CardDetail.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# Replacements: (old, new)
replacements = [
    # grades constant - needs to be inside component or use t()
    # We'll keep "PSA 10" as-is (it's a grade label, not UI text) but translate "中古"
    # Actually grades is used as filter buttons, so we need to handle it differently
    # Let's convert it to use t() inside the component
    
    # Toast messages
    ('toast.success("已加入收藏")', 't("cardDetail.addedToWatchlist")'),
    ('toast.error("此卡牌已在收藏列表中")', 't("cardDetail.alreadyInWatchlist")'),
    ('toast.error("加入收藏失敗：" + error.message)', 't("cardDetail.addWatchlistFailed", { msg: error.message })'),
    ('toast.success("已從收藏中移除")', 't("cardDetail.removedFromWatchlist")'),
    ('toast.error("移除收藏失敗：" + error.message)', 't("cardDetail.removeWatchlistFailed", { msg: error.message })'),
    ('toast.error("請先登入才能使用收藏功能"); setLocation("/login")', 't("cardDetail.loginToWatchlist"); setLocation("/login")'),
    
    # Price source labels in the calculation function
    ('"最近 10 筆"', 't("cardDetail.recentN", { n: 10 })'),
    ('`最近 ${validCount} 筆`', 't("cardDetail.recentN", { n: validCount })'),
    ('`${validCount} 筆`', 't("cardDetail.nRecords", { n: validCount })'),
    ('"最近 5 筆"', 't("cardDetail.recentN", { n: 5 })'),
    ('"14 天"', 't("cardDetail.days14")'),
    ('"30 天"', 't("cardDetail.days30")'),
    ('"全部記錄"', 't("cardDetail.allRecords")'),
    
    # SEO/meta strings - these are for page title/description, keep in zh-TW but use t()
    # Actually these are in JSX attributes, let's handle them
    
    # JSON-LD descriptions
    ('"BOXIUM TCG 市集最低上架價格"', 't("cardDetail.marketLowestPrice")'),
    ('"PSA 10 近期成交價格區間"', 't("cardDetail.psa10PriceRange")'),
    
    # UI text
    ('{"從追蹤中移除" : "追蹤"}', '{t("cardDetail.removeFromTracking") : t("cardDetail.track")}'),
    ('{watchlistStatus?.isInWatchlist ? "從追蹤中移除" : "追蹤"}', '{watchlistStatus?.isInWatchlist ? t("cardDetail.removeFromTracking") : t("cardDetail.track")}'),
    ('"請先登入才能使用收藏功能"', 't("cardDetail.loginToWatchlist")'),
    ('加入收藏清單', '{t("cardDetail.addToCollection")}'),
    
    # Price stats labels
    ('{isSealedProduct ? \'參考均價\' : \'近期成交中位數\'}', '{isSealedProduct ? t("cardDetail.referenceAvgPrice") : t("cardDetail.recentMedian")}'),
    ("`基於最近 ${mainPriceRecordCount} 筆成交加權平均（單盒價）`", 't("cardDetail.basedOnRecentWeightedAvg", { n: mainPriceRecordCount })'),
    ("`基於 ${mainPriceRecordCount} 筆成交記錄`", 't("cardDetail.basedOnNRecords", { n: mainPriceRecordCount })'),
    ('<p className="text-[9px] text-zinc-500">7 天趨勢</p>', '<p className="text-[9px] text-zinc-500">{t("cardDetail.trend7days")}</p>'),
    ('{isSealedProduct ? \'最新成交\' : \'7天加權均價\'}', '{isSealedProduct ? t("cardDetail.latestTrade") : t("cardDetail.weighted7dAvg")}'),
    ('<p className="text-[8px] text-zinc-600 mt-0.5">{auxPriceRecordCount} 筆</p>', '<p className="text-[8px] text-zinc-600 mt-0.5">{t("cardDetail.nRecords", { n: auxPriceRecordCount })}</p>'),
    ('{isSealedProduct ? \'最近總金額\' : \'最近單筆\'}', '{isSealedProduct ? t("cardDetail.recentTotalAmount") : t("cardDetail.recentSingle")}'),
    ('{latestTrade.quantity}個盒', '{t("cardDetail.nBoxes", { n: latestTrade.quantity })}'),
    ('<p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">30天價格帶</p>', '<p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">{t("cardDetail.priceRange30d")}</p>'),
    ('<p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">最高成交</p>', '<p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">{t("cardDetail.highestTrade")}</p>'),
    ("`參考均價基於最近 ${mainPriceRecordCount} 筆 SNKRDUNK 成交計算單盒價（加権平均）`", 't("cardDetail.sealedPriceNote", { n: mainPriceRecordCount })'),
    ("`中位數基於 ${mainPriceRecordCount} 筆 PSA 10 成交記錄（${mainPriceSource}）`", 't("cardDetail.medianNote", { n: mainPriceRecordCount, source: mainPriceSource })'),
    
    # Loading/empty states
    ('正在載入 {activeGrade} 成交記錄...', '{t("cardDetail.loadingGradeRecords", { grade: activeGrade })}'),
    ('單盒價', '{t("cardDetail.perBoxPrice")}'),
    
    # eBay section
    ('eBay 在售商品', '{t("cardDetail.ebayListings")}'),
    ('<span className="text-xs text-zinc-500">（按價格排序）</span>', '<span className="text-xs text-zinc-500">{t("cardDetail.sortedByPrice")}</span>'),
    ('刷新', '{t("common.refresh")}'),
    ('<span className="ml-2 text-sm text-zinc-400">正在搜尋 eBay 在售商品...</span>', '<span className="ml-2 text-sm text-zinc-400">{t("cardDetail.searchingEbay")}</span>'),
    ('<p className="text-zinc-500 text-sm">目前 eBay 沒有找到相關在售商品</p>', '<p className="text-zinc-500 text-sm">{t("cardDetail.noEbayListings")}</p>'),
    ('<p className="text-zinc-600 text-xs mt-1">可嘗試刷新或稍後再查看</p>', '<p className="text-zinc-600 text-xs mt-1">{t("cardDetail.tryRefreshLater")}</p>'),
    ('賣家: {item.seller}', '{t("cardDetail.seller")}: {item.seller}'),
    ('前往購買', '{t("cardDetail.goToBuy")}'),
    ('共 {ebayListings.length} 件在售商品・價格已換算為 HKD・點擊前往 eBay 購買', '{t("cardDetail.ebayListingsSummary", { count: ebayListings.length })}'),
    
    # Related cards section
    ('<h3 className="text-base font-semibold text-white">同系列卡牌</h3>', '<h3 className="text-base font-semibold text-white">{t("cardDetail.sameSeriesCards")}</h3>'),
    ('查看更多', '{t("common.viewMore")}'),
    ('aria-label="同系列卡牌列表"', 'aria-label={t("cardDetail.sameSeriesCardsList")}'),
    ('<span className="text-zinc-600 text-xs">無圖</span>', '<span className="text-zinc-600 text-xs">{t("common.noImage")}</span>'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Replaced: {old[:60]}")
    else:
        print(f"  ✗ NOT FOUND: {old[:60]}")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal replacements: {count}")
