#!/usr/bin/env python3
"""Add missing translation keys to all 3 locale files."""
import json
import sys

LOCALES_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"

# New keys to add
NEW_KEYS = {
    "zh-TW": {
        "common": {
            "grading": "PSA 鑑定",
        },
        "topnav": {
            "tipResearch": "搜尋 55,000+ 張卡牌的市場行情",
            "tipPricing": "比較各平台即時卡牌成交價格",
            "tipGrading": "PSA 代客鑑定，專業團隊負責寄送",
            "tipMarketplace": "安全買賣 TCG 卡牌，支援拍賣",
            "order": "訂單",
            "imageMessage": "圖片訊息",
            "viewAllNotifications": "查看全部通知",
            "profile": "個人中心",
        },
    },
    "en": {
        "common": {
            "grading": "PSA Grading",
        },
        "topnav": {
            "tipResearch": "Search market data for 55,000+ cards",
            "tipPricing": "Compare real-time card prices across platforms",
            "tipGrading": "PSA grading service, professional team handles shipping",
            "tipMarketplace": "Safe TCG card trading, supports auctions",
            "order": "Order",
            "imageMessage": "Image message",
            "viewAllNotifications": "View all notifications",
            "profile": "My Profile",
        },
    },
    "ja": {
        "common": {
            "grading": "PSA グレーディング",
        },
        "topnav": {
            "tipResearch": "55,000枚以上のカードの市場データを検索",
            "tipPricing": "各プラットフォームのリアルタイムカード価格を比較",
            "tipGrading": "PSA代行グレーディング、専門チームが発送を担当",
            "tipMarketplace": "安全なTCGカード売買、オークション対応",
            "order": "注文",
            "imageMessage": "画像メッセージ",
            "viewAllNotifications": "すべての通知を見る",
            "profile": "マイページ",
        },
    },
}


def deep_merge(base, updates):
    """Merge updates into base dict recursively."""
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            if key not in base:
                base[key] = value
                print(f"  Added: {key} = {value!r}")
            else:
                print(f"  Skipped (exists): {key} = {base[key]!r}")
    return base


for lang, updates in NEW_KEYS.items():
    path = f"{LOCALES_DIR}/{lang}.json"
    print(f"\nProcessing {lang}.json...")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    deep_merge(data, updates)
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"  Saved {path}")

print("\nDone!")
