#!/usr/bin/env python3
"""Add missing marketplace i18n keys to all locale files."""
import json
import os

BASE = "/home/ubuntu/boxium-ptcg/client/src/locales"

new_keys = {
    "zh-TW": {
        "marketplace": {
            "official": "官方",
            "removeWishlist": "移除收藏",
            "addWishlist": "加入收藏",
            "viewDetails": "查看詳情",
            "onlyLeft": "僅剩{{count}}",
            "allSeries": "所有系列",
            "itemCount": "{{count}} 件",
            "pageTitle": "卡牌市集 - BOXIUM TCG | 買賣 TCG 卡牌",
            "pageDescription": "BOXIUM TCG 卡牌市集，提供 Pokémon、One Piece、遊戲王等 TCG 卡牌的買賣平台，安全、便捷、價格透明。",
            "pageKeywords": "TCG 市集, Pokémon 卡牌買賣, PSA 卡牌市集, BOXIUM TCG",
            "maintenance": {
                "title": "市集正在維護中",
                "message": "我們正在緊鑼密鼓地開發中，敬請期待！維護期間市集暫停對外開放，感謝您的耐心等候。"
            },
            "banner": {
                "title1": "TCG 卡牌交易平台",
                "subtitle1": "Pokémon · One Piece · Yu-Gi-Oh!",
                "cta1": "探索商城",
                "title2": "PSA 評級卡專區",
                "subtitle2": "精選 PSA 10 完美品相 · 限量珍藏",
                "cta2": "立即選購",
                "title3": "BOXIUM 官方上架",
                "subtitle3": "官方認證 · 品質保證 · 安心購買",
                "cta3": "查看官方商品"
            },
            "wishlist": {
                "added": "已加入收藏",
                "removed": "已移除收藏",
                "loginRequired": "請先登入才能收藏商品"
            },
            "tab": {
                "shop": "商城",
                "shopSub": "即買即賣",
                "auction": "拍賣",
                "auctionSub": "競價得標"
            },
            "filter": {
                "title": "篩選條件",
                "clearAll": "清除全部",
                "tcgSeries": "TCG 系列",
                "source": "商品來源",
                "allSources": "全部來源",
                "official": "官方商品",
                "individualSeller": "個人賣家",
                "condition": "品相篩選",
                "clear": "清除",
                "priceRange": "價格範圍 (HKD)",
                "minPrice": "最低",
                "maxPrice": "最高",
                "searchTag": "搜尋：{{search}}",
                "clearFilters": "清除篩選"
            },
            "sort": {
                "newest": "最新上架",
                "endingSoon": "即將結標",
                "priceAsc": "價格低→高",
                "priceDesc": "價格高→低"
            },
            "auction": {
                "total": "共 {{count}} 個拍賣",
                "empty": "暫無進行中的拍賣",
                "comingSoon": "即將開放拍賣功能，敬請期待！"
            },
            "shop": {
                "total": "共 {{count}} 件商品",
                "empty": "暫無商品",
                "emptyTitle": "暫無在售商品",
                "adjustFilter": "嘗試調整篩選條件以查看更多商品",
                "comingSoon": "商城即將上架更多精選卡牌，敬請期待！",
                "loadingMore": "載入更多商品...",
                "allShown": "已顯示全部 {{count}} 件商品"
            },
            "trust": {
                "buyerProtection": "買家保障",
                "buyerProtectionDesc": "商品與描述不符可退款",
                "priceTransparency": "價格透明",
                "priceTransparencyDesc": "SNKRDUNK 即時數據",
                "fastTrade": "快速交易",
                "fastTradeDesc": "付款後即時確認",
                "sellerRating": "賣家評分",
                "sellerRatingDesc": "真實買家評價"
            }
        },
        "common": {
            "loading": "載入中...",
            "prevPage": "上一頁",
            "nextPage": "下一頁",
            "page": "第 {{page}} 頁",
            "backToHome": "返回首頁",
            "search": "搜尋",
            "viewAll": "查看全部"
        }
    },
    "en": {
        "marketplace": {
            "official": "Official",
            "removeWishlist": "Remove from Wishlist",
            "addWishlist": "Add to Wishlist",
            "viewDetails": "View Details",
            "onlyLeft": "Only {{count}} left",
            "allSeries": "All Series",
            "itemCount": "{{count}} items",
            "pageTitle": "Card Marketplace - BOXIUM TCG | Buy & Sell TCG Cards",
            "pageDescription": "BOXIUM TCG Card Marketplace - Buy and sell Pokémon, One Piece, Yu-Gi-Oh! and other TCG cards safely and transparently.",
            "pageKeywords": "TCG marketplace, Pokémon card trading, PSA card market, BOXIUM TCG",
            "maintenance": {
                "title": "Marketplace Under Maintenance",
                "message": "We're working hard to improve the platform. The marketplace is temporarily closed during maintenance. Thank you for your patience."
            },
            "banner": {
                "title1": "TCG Card Trading Platform",
                "subtitle1": "Pokémon · One Piece · Yu-Gi-Oh!",
                "cta1": "Explore Shop",
                "title2": "PSA Graded Cards",
                "subtitle2": "PSA 10 Perfect Condition · Limited Collection",
                "cta2": "Shop Now",
                "title3": "BOXIUM Official Listings",
                "subtitle3": "Officially Certified · Quality Guaranteed · Safe Purchase",
                "cta3": "View Official Items"
            },
            "wishlist": {
                "added": "Added to wishlist",
                "removed": "Removed from wishlist",
                "loginRequired": "Please log in to add items to wishlist"
            },
            "tab": {
                "shop": "Shop",
                "shopSub": "Buy Instantly",
                "auction": "Auction",
                "auctionSub": "Bid & Win"
            },
            "filter": {
                "title": "Filters",
                "clearAll": "Clear All",
                "tcgSeries": "TCG Series",
                "source": "Source",
                "allSources": "All Sources",
                "official": "Official",
                "individualSeller": "Individual Seller",
                "condition": "Condition",
                "clear": "Clear",
                "priceRange": "Price Range (HKD)",
                "minPrice": "Min",
                "maxPrice": "Max",
                "searchTag": "Search: {{search}}",
                "clearFilters": "Clear Filters"
            },
            "sort": {
                "newest": "Newest",
                "endingSoon": "Ending Soon",
                "priceAsc": "Price: Low to High",
                "priceDesc": "Price: High to Low"
            },
            "auction": {
                "total": "{{count}} auction(s)",
                "empty": "No active auctions",
                "comingSoon": "Auction feature coming soon!"
            },
            "shop": {
                "total": "{{count}} item(s)",
                "empty": "No items available",
                "emptyTitle": "No items for sale",
                "adjustFilter": "Try adjusting filters to see more items",
                "comingSoon": "More cards coming soon!",
                "loadingMore": "Loading more items...",
                "allShown": "All {{count}} items shown"
            },
            "trust": {
                "buyerProtection": "Buyer Protection",
                "buyerProtectionDesc": "Refund if item doesn't match description",
                "priceTransparency": "Price Transparency",
                "priceTransparencyDesc": "Real-time SNKRDUNK data",
                "fastTrade": "Fast Transaction",
                "fastTradeDesc": "Confirmed immediately after payment",
                "sellerRating": "Seller Rating",
                "sellerRatingDesc": "Verified buyer reviews"
            }
        },
        "common": {
            "loading": "Loading...",
            "prevPage": "Previous",
            "nextPage": "Next",
            "page": "Page {{page}}",
            "backToHome": "Back to Home",
            "search": "Search",
            "viewAll": "View All"
        }
    },
    "ja": {
        "marketplace": {
            "official": "公式",
            "removeWishlist": "ウィッシュリストから削除",
            "addWishlist": "ウィッシュリストに追加",
            "viewDetails": "詳細を見る",
            "onlyLeft": "残り{{count}}点",
            "allSeries": "全シリーズ",
            "itemCount": "{{count}}件",
            "pageTitle": "カードマーケット - BOXIUM TCG | TCGカード売買",
            "pageDescription": "BOXIUM TCGカードマーケット - ポケモン、ワンピース、遊戯王などのTCGカードを安全に売買できます。",
            "pageKeywords": "TCGマーケット, ポケモンカード売買, PSAカード市場, BOXIUM TCG",
            "maintenance": {
                "title": "マーケットメンテナンス中",
                "message": "現在鋭意開発中です。メンテナンス期間中はマーケットを一時停止しています。ご理解ご協力をお願いします。"
            },
            "banner": {
                "title1": "TCGカード取引プラットフォーム",
                "subtitle1": "ポケモン · ワンピース · 遊戯王",
                "cta1": "ショップを探索",
                "title2": "PSAグレードカード専門",
                "subtitle2": "PSA10完璧品質 · 限定コレクション",
                "cta2": "今すぐ購入",
                "title3": "BOXIUM公式出品",
                "subtitle3": "公式認定 · 品質保証 · 安心購入",
                "cta3": "公式商品を見る"
            },
            "wishlist": {
                "added": "ウィッシュリストに追加しました",
                "removed": "ウィッシュリストから削除しました",
                "loginRequired": "ウィッシュリストに追加するにはログインしてください"
            },
            "tab": {
                "shop": "ショップ",
                "shopSub": "即時購入",
                "auction": "オークション",
                "auctionSub": "入札して落札"
            },
            "filter": {
                "title": "フィルター",
                "clearAll": "すべてクリア",
                "tcgSeries": "TCGシリーズ",
                "source": "出品元",
                "allSources": "すべての出品元",
                "official": "公式商品",
                "individualSeller": "個人出品者",
                "condition": "コンディション",
                "clear": "クリア",
                "priceRange": "価格帯 (HKD)",
                "minPrice": "最低",
                "maxPrice": "最高",
                "searchTag": "検索：{{search}}",
                "clearFilters": "フィルターをクリア"
            },
            "sort": {
                "newest": "新着順",
                "endingSoon": "終了間近",
                "priceAsc": "価格：安い順",
                "priceDesc": "価格：高い順"
            },
            "auction": {
                "total": "{{count}}件のオークション",
                "empty": "進行中のオークションなし",
                "comingSoon": "オークション機能は近日公開予定！"
            },
            "shop": {
                "total": "{{count}}件の商品",
                "empty": "商品なし",
                "emptyTitle": "販売中の商品なし",
                "adjustFilter": "フィルターを調整してより多くの商品を表示",
                "comingSoon": "近日中により多くのカードが入荷予定！",
                "loadingMore": "さらに読み込み中...",
                "allShown": "全{{count}}件を表示中"
            },
            "trust": {
                "buyerProtection": "購入者保護",
                "buyerProtectionDesc": "商品説明と異なる場合は返金",
                "priceTransparency": "価格の透明性",
                "priceTransparencyDesc": "SNKRDUNKリアルタイムデータ",
                "fastTrade": "迅速な取引",
                "fastTradeDesc": "支払い後即時確認",
                "sellerRating": "出品者評価",
                "sellerRatingDesc": "実際の購入者レビュー"
            }
        },
        "common": {
            "loading": "読み込み中...",
            "prevPage": "前へ",
            "nextPage": "次へ",
            "page": "{{page}}ページ",
            "backToHome": "ホームに戻る",
            "search": "検索",
            "viewAll": "すべて見る"
        }
    }
}

def deep_merge(base, updates):
    """Deep merge updates into base dict."""
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

for lang, keys in new_keys.items():
    filepath = os.path.join(BASE, f"{lang}.json")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    deep_merge(data, keys)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {filepath}")

print("Done!")
