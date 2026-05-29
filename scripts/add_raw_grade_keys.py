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
        "gradeA": {"zh-TW": "A品", "en": "Grade A", "ja": "Aランク"},
        "gradeB": {"zh-TW": "B品", "en": "Grade B", "ja": "Bランク"},
        "gradeC": {"zh-TW": "C品", "en": "Grade C", "ja": "Cランク"},
        "gradeD": {"zh-TW": "D品", "en": "Grade D", "ja": "Dランク"},
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
