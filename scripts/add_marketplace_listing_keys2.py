#!/usr/bin/env python3
import json

# Paths
LOCALE_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"
FILES = {
    "zh-TW": f"{LOCALE_DIR}/zh-TW.json",
    "en": f"{LOCALE_DIR}/en.json",
    "ja": f"{LOCALE_DIR}/ja.json",
}

NEW_KEYS = {
    "marketplaceListing": {
        "creditCardPayment": {
            "zh-TW": "信用卡付款",
            "en": "Credit Card Payment",
            "ja": "クレジットカード支払い",
        },
        "validLockerCode": {
            "zh-TW": "✓ 有效智能櫃編號",
            "en": "✓ Valid locker code",
            "ja": "✓ 有効なロッカーコード",
        },
        "validStationCode": {
            "zh-TW": "✓ 有效順豐站編號",
            "en": "✓ Valid SF station code",
            "ja": "✓ 有効なSFステーションコード",
        },
        "clearSelectedAddress": {
            "zh-TW": "清除已選地址",
            "en": "Clear Selected Address",
            "ja": "選択した住所をクリア",
        },
        "loginToAddCart": {
            "zh-TW": "登入後加入購物車",
            "en": "Login to Add to Cart",
            "ja": "ログインしてカートに追加",
        },
        "donePayFillAddress": {
            "zh-TW": "我已完成付款，填寫收貨地址",
            "en": "I have paid, fill in shipping address",
            "ja": "支払い完了、配送先住所を入力",
        },
        "alipay": {
            "nextUploadScreenshot": {
                "zh-TW": "下一步：上傳截圖",
                "en": "Next: Upload Screenshot",
                "ja": "次へ：スクリーンショットをアップロード",
            },
        },
        "address": {
            "region": {
                "hongkong": {
                    "zh-TW": "香港（不指定）",
                    "en": "Hong Kong (Any)",
                    "ja": "香港（指定なし）",
                },
            },
        },
        "viewProfile": {
            "zh-TW": "查看主頁",
            "en": "View Profile",
            "ja": "プロフィールを見る",
        },
        "loginToOffer": {
            "zh-TW": "請先登入才能出價",
            "en": "Please login to make an offer",
            "ja": "出価するにはログインしてください",
        },
        "share": {
            "whatsapp": {
                "zh-TW": "WhatsApp 分享",
                "en": "Share via WhatsApp",
                "ja": "WhatsAppで共有",
            },
        },
        "copyId": {
            "zh-TW": "複製編號",
            "en": "Copy ID",
            "ja": "IDをコピー",
        },
        "goToPay": {
            "zh-TW": "前往付款",
            "en": "Go to Payment",
            "ja": "支払いへ進む",
        },
        "medium": {
            "zh-TW": "中",
            "en": "Medium",
            "ja": "中",
        },
        "low": {
            "zh-TW": "低",
            "en": "Low",
            "ja": "低",
        },
        "reuploadScreenshot": {
            "zh-TW": "重新上傳截圖",
            "en": "Re-upload Screenshot",
            "ja": "スクリーンショットを再アップロード",
        },
    },
    "common": {
        "back": {
            "zh-TW": "返回",
            "en": "Back",
            "ja": "戻る",
        },
        "close": {
            "zh-TW": "關閉",
            "en": "Close",
            "ja": "閉じる",
        },
        "processing": {
            "zh-TW": "提交中",
            "en": "Processing",
            "ja": "処理中",
        },
        "cancel": {
            "zh-TW": "取消",
            "en": "Cancel",
            "ja": "キャンセル",
        },
    },
}

def deep_set(d, keys, value):
    """Set a nested key in a dict, only if it doesn't already exist."""
    for key in keys[:-1]:
        if key not in d:
            d[key] = {}
        d = d[key]
    if keys[-1] not in d:
        d[keys[-1]] = value
        return True
    return False

def flatten_keys(d, prefix=""):
    """Flatten nested dict to list of (key_path, value) tuples."""
    result = []
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict) and not any(lang in v for lang in ["zh-TW", "en", "ja"]):
            result.extend(flatten_keys(v, full_key))
        else:
            result.append((full_key, v))
    return result

def add_keys_to_locale(locale_data, key_path, translations, lang):
    """Add a key to the locale data."""
    keys = key_path.split(".")
    value = translations.get(lang, translations.get("zh-TW", ""))
    return deep_set(locale_data, keys, value)

# Load all locale files
locale_data = {}
for lang, path in FILES.items():
    with open(path, 'r', encoding='utf-8') as f:
        locale_data[lang] = json.load(f)

# Flatten the new keys
flat_keys = flatten_keys(NEW_KEYS)

# Add keys to each locale
added_count = {lang: 0 for lang in FILES}
for key_path, translations in flat_keys:
    for lang in FILES:
        if add_keys_to_locale(locale_data[lang], key_path, translations, lang):
            added_count[lang] += 1

# Save all locale files
for lang, path in FILES.items():
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(locale_data[lang], f, ensure_ascii=False, indent=2)
    print(f"Saved {path}: added {added_count[lang]} new keys")

print("Done!")
