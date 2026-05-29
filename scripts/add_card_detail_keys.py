#!/usr/bin/env python3
import json

LOCALE_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"
FILES = {
    "zh-TW": f"{LOCALE_DIR}/zh-TW.json",
    "en": f"{LOCALE_DIR}/en.json",
    "ja": f"{LOCALE_DIR}/ja.json",
}

NEW_KEYS = {
    "cardDetail": {
        "addedToWatchlist": {"zh-TW": "已加入收藏", "en": "Added to watchlist", "ja": "ウォッチリストに追加しました"},
        "alreadyInWatchlist": {"zh-TW": "此卡牌已在收藏列表中", "en": "This card is already in your watchlist", "ja": "このカードはすでにウォッチリストにあります"},
        "addWatchlistFailed": {"zh-TW": "加入收藏失敗：{{msg}}", "en": "Failed to add to watchlist: {{msg}}", "ja": "ウォッチリストへの追加に失敗しました：{{msg}}"},
        "removedFromWatchlist": {"zh-TW": "已從收藏中移除", "en": "Removed from watchlist", "ja": "ウォッチリストから削除しました"},
        "removeWatchlistFailed": {"zh-TW": "移除收藏失敗：{{msg}}", "en": "Failed to remove from watchlist: {{msg}}", "ja": "ウォッチリストからの削除に失敗しました：{{msg}}"},
        "loginToWatchlist": {"zh-TW": "請先登入才能使用收藏功能", "en": "Please login to use watchlist", "ja": "ウォッチリストを使用するにはログインしてください"},
        "recentN": {"zh-TW": "最近 {{n}} 筆", "en": "Recent {{n}}", "ja": "直近{{n}}件"},
        "nRecords": {"zh-TW": "{{n}} 筆", "en": "{{n}} records", "ja": "{{n}}件"},
        "days14": {"zh-TW": "14 天", "en": "14 days", "ja": "14日"},
        "days30": {"zh-TW": "30 天", "en": "30 days", "ja": "30日"},
        "allRecords": {"zh-TW": "全部記錄", "en": "All records", "ja": "全記録"},
        "marketLowestPrice": {"zh-TW": "BOXIUM TCG 市集最低上架價格", "en": "BOXIUM TCG marketplace lowest price", "ja": "BOXIUM TCGマーケット最低出品価格"},
        "psa10PriceRange": {"zh-TW": "PSA 10 近期成交價格區間", "en": "PSA 10 recent transaction price range", "ja": "PSA 10 直近取引価格帯"},
        "removeFromTracking": {"zh-TW": "從追蹤中移除", "en": "Remove from tracking", "ja": "追跡から削除"},
        "track": {"zh-TW": "追蹤", "en": "Track", "ja": "追跡"},
        "addToCollection": {"zh-TW": "加入收藏清單", "en": "Add to Collection", "ja": "コレクションに追加"},
        "referenceAvgPrice": {"zh-TW": "參考均價", "en": "Reference Avg Price", "ja": "参考平均価格"},
        "recentMedian": {"zh-TW": "近期成交中位數", "en": "Recent Median Price", "ja": "直近取引中央値"},
        "basedOnRecentWeightedAvg": {"zh-TW": "基於最近 {{n}} 筆成交加權平均（單盒價）", "en": "Based on {{n}} recent weighted avg (per box)", "ja": "直近{{n}}件の加重平均（1箱あたり）"},
        "basedOnNRecords": {"zh-TW": "基於 {{n}} 筆成交記錄", "en": "Based on {{n}} transaction records", "ja": "{{n}}件の取引記録に基づく"},
        "trend7days": {"zh-TW": "7 天趨勢", "en": "7-day Trend", "ja": "7日トレンド"},
        "latestTrade": {"zh-TW": "最新成交", "en": "Latest Trade", "ja": "最新取引"},
        "weighted7dAvg": {"zh-TW": "7天加權均價", "en": "7-day Weighted Avg", "ja": "7日加重平均"},
        "recentTotalAmount": {"zh-TW": "最近總金額", "en": "Recent Total Amount", "ja": "直近合計金額"},
        "recentSingle": {"zh-TW": "最近單筆", "en": "Recent Single", "ja": "直近1件"},
        "nBoxes": {"zh-TW": "{{n}}個盒", "en": "{{n}} boxes", "ja": "{{n}}箱"},
        "priceRange30d": {"zh-TW": "30天價格帶", "en": "30-day Price Range", "ja": "30日価格帯"},
        "highestTrade": {"zh-TW": "最高成交", "en": "Highest Trade", "ja": "最高取引"},
        "sealedPriceNote": {"zh-TW": "參考均價基於最近 {{n}} 筆 SNKRDUNK 成交計算單盒價（加権平均）", "en": "Reference avg based on {{n}} recent SNKRDUNK trades (weighted avg per box)", "ja": "参考平均は直近{{n}}件のSNKRDUNK取引から計算（加重平均/1箱）"},
        "medianNote": {"zh-TW": "中位數基於 {{n}} 筆 PSA 10 成交記錄（{{source}}）", "en": "Median based on {{n}} PSA 10 records ({{source}})", "ja": "中央値は{{n}}件のPSA 10取引記録（{{source}}）に基づく"},
        "loadingGradeRecords": {"zh-TW": "正在載入 {{grade}} 成交記錄...", "en": "Loading {{grade}} records...", "ja": "{{grade}}の取引記録を読み込み中..."},
        "perBoxPrice": {"zh-TW": "單盒價", "en": "Per Box", "ja": "1箱あたり"},
        "ebayListings": {"zh-TW": "eBay 在售商品", "en": "eBay Listings", "ja": "eBay出品商品"},
        "sortedByPrice": {"zh-TW": "（按價格排序）", "en": "(sorted by price)", "ja": "（価格順）"},
        "searchingEbay": {"zh-TW": "正在搜尋 eBay 在售商品...", "en": "Searching eBay listings...", "ja": "eBay出品商品を検索中..."},
        "noEbayListings": {"zh-TW": "目前 eBay 沒有找到相關在售商品", "en": "No eBay listings found", "ja": "eBayに関連する出品商品が見つかりません"},
        "tryRefreshLater": {"zh-TW": "可嘗試刷新或稍後再查看", "en": "Try refreshing or check back later", "ja": "更新するか後でもう一度確認してください"},
        "seller": {"zh-TW": "賣家", "en": "Seller", "ja": "出品者"},
        "goToBuy": {"zh-TW": "前往購買", "en": "Go to Buy", "ja": "購入へ"},
        "ebayListingsSummary": {"zh-TW": "共 {{count}} 件在售商品・價格已換算為 HKD・點擊前往 eBay 購買", "en": "{{count}} listings · Prices converted to HKD · Click to buy on eBay", "ja": "{{count}}件の出品・価格はHKDに換算済み・クリックしてeBayで購入"},
        "sameSeriesCards": {"zh-TW": "同系列卡牌", "en": "Same Series Cards", "ja": "同シリーズカード"},
        "sameSeriesCardsList": {"zh-TW": "同系列卡牌列表", "en": "Same series cards list", "ja": "同シリーズカードリスト"},
        "gradeUsed": {"zh-TW": "中古", "en": "Used", "ja": "中古"},
        "priceInfo": {"zh-TW": "價格資訊", "en": "Price Info", "ja": "価格情報"},
        "cardImage": {"zh-TW": "卡牌圖像", "en": "card image", "ja": "カード画像"},
        "psa10PriceTitle": {"zh-TW": "PSA 10 價格", "en": "PSA 10 Price", "ja": "PSA 10 価格"},
        "priceTrendTitle": {"zh-TW": "價格走勢", "en": "Price Trend", "ja": "価格トレンド"},
        "pageDescription": {"zh-TW": "查看 {{name}} 的即時市場價格、PSA 10 成交記錄及價格走勢分析。", "en": "View {{name}} real-time market price, PSA 10 transaction records and price trend analysis.", "ja": "{{name}}のリアルタイム市場価格、PSA 10取引記録、価格トレンド分析を見る。"},
        "jsonLdDescription": {"zh-TW": "{{name}} 寶可夢卡牌 - 查看即時市場價格、PSA 10 成交記錄及價格走勢分析。", "en": "{{name}} Pokémon TCG card - View real-time market price, PSA 10 records and price trend analysis.", "ja": "{{name}} ポケモンカード - リアルタイム市場価格、PSA 10記録、価格トレンド分析。"},
    },
    "common": {
        "refresh": {"zh-TW": "刷新", "en": "Refresh", "ja": "更新"},
        "viewMore": {"zh-TW": "查看更多", "en": "View More", "ja": "もっと見る"},
        "noImage": {"zh-TW": "無圖", "en": "No image", "ja": "画像なし"},
    }
}

def deep_set(d, keys, value):
    for key in keys[:-1]:
        if key not in d:
            d[key] = {}
        d = d[key]
    if keys[-1] not in d:
        d[keys[-1]] = value
        return True
    return False

def flatten_keys(d, prefix=""):
    result = []
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict) and not any(lang in v for lang in ["zh-TW", "en", "ja"]):
            result.extend(flatten_keys(v, full_key))
        else:
            result.append((full_key, v))
    return result

locale_data = {}
for lang, path in FILES.items():
    with open(path, 'r', encoding='utf-8') as f:
        locale_data[lang] = json.load(f)

flat_keys = flatten_keys(NEW_KEYS)
added_count = {lang: 0 for lang in FILES}
for key_path, translations in flat_keys:
    for lang in FILES:
        keys = key_path.split(".")
        value = translations.get(lang, translations.get("zh-TW", ""))
        if deep_set(locale_data[lang], keys, value):
            added_count[lang] += 1

for lang, path in FILES.items():
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(locale_data[lang], f, ensure_ascii=False, indent=2)
    print(f"Saved {path}: added {added_count[lang]} new keys")

print("Done!")
