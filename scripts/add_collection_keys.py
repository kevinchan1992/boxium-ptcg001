#!/usr/bin/env python3
import json

LOCALE_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"
FILES = {
    "zh-TW": f"{LOCALE_DIR}/zh-TW.json",
    "en": f"{LOCALE_DIR}/en.json",
    "ja": f"{LOCALE_DIR}/ja.json",
}

NEW_KEYS = {
    "collection": {
        "selectCardFirst": {"zh-TW": "請先選擇卡牌", "en": "Please select a card first", "ja": "先にカードを選択してください"},
        "selectGraderFirst": {"zh-TW": "請選擇評級公司", "en": "Please select a grading company", "ja": "グレーディング会社を選択してください"},
        "selectImageFirst": {"zh-TW": "請選擇圖片", "en": "Please select an image", "ja": "画像を選択してください"},
        "deletedNItems": {"zh-TW": "已刪除 {{count}} 筆收藏", "en": "Deleted {{count}} items", "ja": "{{count}}件のコレクションを削除しました"},
        "crop": {"zh-TW": "裁剪", "en": "Crop", "ja": "トリミング"},
        "cancelCrop": {"zh-TW": "取消裁剪", "en": "Cancel Crop", "ja": "トリミングをキャンセル"},
        "currentCollection": {"zh-TW": "現有收藏", "en": "Collection", "ja": "コレクション"},
        "traded": {"zh-TW": "已換走", "en": "Traded", "ja": "トレード済み"},
        "bulk": {"zh-TW": "批量", "en": "Bulk", "ja": "一括"},
        "deselectAll": {"zh-TW": "取消全選", "en": "Deselect All", "ja": "すべて選択解除"},
        "selectAllPage": {"zh-TW": "全選本頁", "en": "Select All on Page", "ja": "このページを全選択"},
        "selectedN": {"zh-TW": "已選 {{n}} 筆", "en": "{{n}} selected", "ja": "{{n}}件選択中"},
        "deleteN": {"zh-TW": "刪除 {{n}} 筆", "en": "Delete {{n}}", "ja": "{{n}}件削除"},
        "descending": {"zh-TW": "降序", "en": "Descending", "ja": "降順"},
        "ascending": {"zh-TW": "升序", "en": "Ascending", "ja": "昇順"},
        "noTradedCards": {"zh-TW": "尚無已換走的卡牌", "en": "No traded cards yet", "ja": "トレード済みのカードはまだありません"},
        "tradedCardHint": {"zh-TW": "在收藏清單中點擊 ⇄ 按鈕開始記錄以卡換卡", "en": "Click the ⇄ button in your collection to record card trades", "ja": "コレクションの⇄ボタンをクリックしてカードトレードを記録"},
        "pagination": {"zh-TW": "第 {{current}} / {{total}} 頁 · 共 {{items}} 筆", "en": "Page {{current}} / {{total}} · {{items}} items", "ja": "{{current}} / {{total}} ページ · 計 {{items}} 件"},
        "public": {"zh-TW": "公開", "en": "Public", "ja": "公開"},
        "tradedOn": {"zh-TW": "已換走 {{date}}", "en": "Traded {{date}}", "ja": "{{date}}にトレード"},
        "tradedOut": {"zh-TW": "已換出", "en": "Traded out", "ja": "トレード済み"},
        "purchasedOn": {"zh-TW": "{{date}} 購入", "en": "Purchased {{date}}", "ja": "{{date}}購入"},
        "tradeCard": {"zh-TW": "以卡換卡", "en": "Trade Card", "ja": "カードトレード"},
        "bulkDeleteConfirm": {"zh-TW": "批量刪除確認", "en": "Bulk Delete Confirmation", "ja": "一括削除の確認"},
        "bulkDeleteWarning": {"zh-TW": "確定要刪除已選的 {{n}} 筆收藏記錄？此操作無法復原。", "en": "Are you sure you want to delete {{n}} selected collection records? This action cannot be undone.", "ja": "選択した{{n}}件のコレクション記録を削除しますか？この操作は元に戻せません。"},
        "deleting": {"zh-TW": "刪除中...", "en": "Deleting...", "ja": "削除中..."},
        "confirmDeleteN": {"zh-TW": "確定刪除 {{n}} 筆", "en": "Confirm Delete {{n}}", "ja": "{{n}}件を削除する"},
    },
    "common": {
        "prevPage": {"zh-TW": "上一頁", "en": "Prev", "ja": "前へ"},
        "nextPage": {"zh-TW": "下一頁", "en": "Next", "ja": "次へ"},
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
