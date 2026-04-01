#!/usr/bin/env python3
"""
Extract hardcoded Chinese text from user-facing pages and generate i18n translation entries.
This script scans all non-Admin TSX files and produces new translation keys.
"""
import json, re, os

BASE = "/home/ubuntu/boxium-ptcg/client/src"

# Load existing translations
with open(f"{BASE}/locales/zh-TW.json") as f:
    zh = json.load(f)

def flatten(d, prefix=''):
    items = {}
    for k, v in d.items():
        full = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            items.update(flatten(v, full))
        else:
            items[full] = v
    return items

existing_zh_values = set(flatten(zh).values())

# User-facing files to scan (excluding Admin components which are admin-only)
user_facing_files = [
    "pages/Home.tsx",
    "pages/Marketplace.tsx",
    "pages/MarketplaceListing.tsx",
    "pages/AuctionDetail.tsx",
    "pages/Cart.tsx",
    "pages/Orders.tsx",
    "pages/OrderDetail.tsx",
    "pages/Profile.tsx",
    "pages/Research.tsx",
    "pages/CardDetail.tsx",
    "pages/Pricing.tsx",
    "pages/PricingDetail.tsx",
    "pages/PricingSearch.tsx",
    "pages/SearchResults.tsx",
    "pages/Trending.tsx",
    "pages/Blog.tsx",
    "pages/BlogPost.tsx",
    "pages/Login.tsx",
    "pages/Register.tsx",
    "pages/Notifications.tsx",
    "pages/Wishlist.tsx",
    "pages/Unsubscribe.tsx",
    "pages/SellerDashboard.tsx",
    "pages/SellerPublicProfile.tsx",
    "components/TopNav.tsx",
    "components/Footer.tsx",
    "components/OrderStatusStepper.tsx",
    "components/CardSelectionDialog.tsx",
]

zh_pattern = re.compile(r'[\u4e00-\u9fff]')

results = {}
for filepath in user_facing_files:
    full_path = os.path.join(BASE, filepath)
    if not os.path.exists(full_path):
        continue
    with open(full_path) as f:
        content = f.read()
    
    # Find all Chinese text strings
    # Match strings in quotes
    for m in re.finditer(r'"([^"]*[\u4e00-\u9fff][^"]*)"', content):
        text = m.group(1).strip()
        if text and text not in existing_zh_values and len(text) > 1:
            if text not in ['zh-TW', 'zh-HK']:
                results.setdefault(filepath, set()).add(text)
    
    for m in re.finditer(r"'([^']*[\u4e00-\u9fff][^']*)'", content):
        text = m.group(1).strip()
        if text and text not in existing_zh_values and len(text) > 1:
            if text not in ['zh-TW', 'zh-HK']:
                results.setdefault(filepath, set()).add(text)

# Print summary
total = sum(len(v) for v in results.values())
print(f"Total unique hardcoded Chinese strings not in i18n: {total}")
print()
for filepath, texts in sorted(results.items()):
    print(f"\n=== {filepath} ({len(texts)} strings) ===")
    for t in sorted(texts)[:20]:
        print(f"  {t[:80]}")
    if len(texts) > 20:
        print(f"  ... and {len(texts) - 20} more")
