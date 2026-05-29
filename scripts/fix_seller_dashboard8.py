import re
path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Line 3110 - associate card optional label
    ('（選填）', '{t("common.optional")}'),
    # Line 3193 - condition label + quantity
    ('?.label ?? listingForm.condition} · 數量 {listingForm.quantity}', 
     '?.label ?? listingForm.condition} · {t("seller.newListing.quantity")} {listingForm.quantity}'),
    # Line 3272 - market price label
    ('市場均價：HKD ${conditionPriceData.avgPrice.toLocaleString()}',
     '${t("seller.marketPrice")}：HKD ${conditionPriceData.avgPrice.toLocaleString()}'),
    # Line 3285 - price input placeholder
    ('placeholder="最低 HKD 4.00"', 'placeholder={t("seller.editListing.minPrice")}'),
    # Line 3381 - reserve price placeholder
    ('placeholder="留空表示無底價"', 'placeholder={t("seller.newListing.reservePricePlaceholder")}'),
    # Line 3389 - buy now price placeholder
    ('placeholder="留空表示無即買價"', 'placeholder={t("seller.newListing.buyNowPricePlaceholder")}'),
    # Line 3575 - accept offers display
    ('`（最低 HKD ${listingForm.minOffer}）`', '`（${t("seller.newListing.minOffer")} HKD ${listingForm.minOffer}）`'),
    (': "不接受"}', ': t("seller.newListing.notAccepting")}'),
    # Line 3608 - auction end time suffix
    ("+ '（上架後起算）'", "+ `（${t('seller.newListing.afterListing')}）`"),
    # Line 3788 - submit button
    ('"提交中..."', 't("common.submitting")'),
    ('"確認上架"', 't("seller.newListing.confirmList")'),
    # Line 4077 - cancel button in delete dialog
    ('              取消\n', '              {t("common.cancel")}\n'),
    # Line 1617 - back to home link text
    ('gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-full hover:bg-yellow-300 transition-colors">\n        ',
     'gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-full hover:bg-yellow-300 transition-colors">\n        '),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f"✗ Not found: {old[:80]}...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! {count}/{len(replacements)} replacements made")
