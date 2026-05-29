#!/usr/bin/env python3
import json

LOCALE_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"
FILES = {
    "zh-TW": f"{LOCALE_DIR}/zh-TW.json",
    "en": f"{LOCALE_DIR}/en.json",
    "ja": f"{LOCALE_DIR}/ja.json",
}

NEW_KEYS = {
    "sellerPublicProfile": {
        "auctionEnded": {"zh-TW": "已結標", "en": "Ended", "ja": "終了"},
        "timeLeftDH": {"zh-TW": "{{d}}天 {{h}}時", "en": "{{d}}d {{h}}h", "ja": "{{d}}日{{h}}時間"},
        "timeLeftHM": {"zh-TW": "{{h}}時 {{m}}分", "en": "{{h}}h {{m}}m", "ja": "{{h}}時間{{m}}分"},
        "timeLeftMS": {"zh-TW": "{{m}}分 {{s}}秒", "en": "{{m}}m {{s}}s", "ja": "{{m}}分{{s}}秒"},
        "calculating": {"zh-TW": "計算中...", "en": "Calculating...", "ja": "計算中..."},
        "bidding": {"zh-TW": "競標中", "en": "Bidding", "ja": "入札中"},
        "currentBid": {"zh-TW": "當前出價", "en": "Current Bid", "ja": "現在の入札額"},
        "startingBid": {"zh-TW": "起拍價", "en": "Starting Bid", "ja": "開始価格"},
        "nBids": {"zh-TW": "{{n}} 次出價", "en": "{{n}} bids", "ja": "{{n}}件の入札"},
        "sellerNotFound": {"zh-TW": "找不到此賣家的資料", "en": "Seller not found", "ja": "このセラーの情報が見つかりません"},
        "backToMarket": {"zh-TW": "返回商城", "en": "Back to Market", "ja": "マーケットに戻る"},
        "premiumSeller": {"zh-TW": "優質賣家", "en": "Premium Seller", "ja": "プレミアムセラー"},
        "activeSeller": {"zh-TW": "活躍賣家", "en": "Active Seller", "ja": "アクティブセラー"},
        "auctioning": {"zh-TW": "拍賣中", "en": "Auctioning", "ja": "オークション中"},
        "nReviews": {"zh-TW": "{{n}} 評價", "en": "{{n}} reviews", "ja": "{{n}}件のレビュー"},
        "nSales": {"zh-TW": "{{n}} 筆成交", "en": "{{n}} sales", "ja": "{{n}}件の取引"},
        "memberSince": {"zh-TW": "加入於 {{date}}", "en": "Member since {{date}}", "ja": "{{date}}から参加"},
        "forSale": {"zh-TW": "在售商品", "en": "For Sale", "ja": "販売中"},
        "activeAuctions": {"zh-TW": "進行中拍賣", "en": "Active Auctions", "ja": "進行中のオークション"},
        "buyerReviews": {"zh-TW": "買家評價", "en": "Buyer Reviews", "ja": "購入者レビュー"},
        "noListings": {"zh-TW": "此賣家暫無在售商品", "en": "This seller has no listings", "ja": "このセラーには現在出品がありません"},
        "noAuctions": {"zh-TW": "暫無進行中拍賣", "en": "No active auctions", "ja": "進行中のオークションはありません"},
        "noAuctionsDesc": {"zh-TW": "此賣家目前沒有競標中的商品", "en": "This seller has no active auction items", "ja": "このセラーには現在オークション中の商品がありません"},
        "noReviews": {"zh-TW": "此賣家暫無買家評價", "en": "This seller has no buyer reviews", "ja": "このセラーには購入者レビューがありません"},
        "anonymousBuyer": {"zh-TW": "匿名買家", "en": "Anonymous Buyer", "ja": "匿名の購入者"},
        "showingReviews": {"zh-TW": "顯示最新 {{shown}} 則，共 {{total}} 則評價", "en": "Showing latest {{shown}} of {{total}} reviews", "ja": "{{total}}件中最新{{shown}}件を表示"},
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
