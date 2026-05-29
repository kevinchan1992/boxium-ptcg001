path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

import re

# Fix the generating image button (has special space character)
old1 = '生成中...\u2003'
if old1 in content:
    content = content.replace(f'{{generatingImage ? "{old1}" : "生成分享圖片"}}', '{generatingImage ? t("common.generating") : t("seller.generateShareImage")}')
    print("✓ Fixed generating image")
else:
    # Try with regular space
    content = content.replace('{generatingImage ? "生成中... " : "生成分享圖片"}', '{generatingImage ? t("common.generating") : t("seller.generateShareImage")}')
    print("✓ Fixed generating image (regular space)")

# Fix completed status in earnings tab
content = re.sub(r'(\s+)已完成(\s*\n)', lambda m: m.group(1) + '{t("seller.status.completed")}' + m.group(2), content, count=3)
print("✓ Fixed completed status")

# Fix edit auction button
content = re.sub(r'(\s+)編輯拍賣(\s*\n)', lambda m: m.group(1) + '{t("seller.editAuction")}' + m.group(2), content, count=2)
print("✓ Fixed edit auction")

# Fix view product
content = content.replace('              查看商品 →', '              {t("seller.viewProduct")} →')
print("✓ Fixed view product")

# Fix apply to sell
content = content.replace('               申請成為賣家', '               {t("seller.applyToSell")}')
print("✓ Fixed apply to sell")

# Fix nav tabs (with exact whitespace)
content = re.sub(r'(\s{19})我的商品(\s*\n)', lambda m: m.group(1) + '{t("seller.myProducts")}' + m.group(2), content)
content = re.sub(r'(\s{19})我的拍賣(\s*\n)', lambda m: m.group(1) + '{t("seller.myAuctions")}' + m.group(2), content)
content = re.sub(r'(\s{19})訂單管理(\s*\n)', lambda m: m.group(1) + '{t("seller.orderManagement")}' + m.group(2), content)
content = re.sub(r'(\s{19})買家出價(\s*\n)', lambda m: m.group(1) + '{t("seller.buyerOffers")}' + m.group(2), content)
content = re.sub(r'(\s{19})收款記錄(\s*\n)', lambda m: m.group(1) + '{t("seller.revenueRecord")}' + m.group(2), content)
print("✓ Fixed nav tabs")

# Fix relist/delete batch buttons
content = re.sub(r'重新上架 \(\{relistableIds\.length\}\)', '{t("seller.relist")} ({relistableIds.length})', content)
content = re.sub(r'刪除 \(\{deletableIds\.length\}\)', '{t("common.delete")} ({deletableIds.length})', content)
print("✓ Fixed batch buttons")

# Fix go to product
content = re.sub(r'(\s{39})前往商品(\s*\n)', lambda m: m.group(1) + '{t("seller.goToProduct")}' + m.group(2), content)
print("✓ Fixed go to product")

# Fix maintenance page back link
content = content.replace(
    '<a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-full hover:bg-yellow-300 transition-colors">\n          返回主頁\n        </a>',
    '<a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-full hover:bg-yellow-300 transition-colors">\n          {t("common.backToHome")}\n        </a>'
)

# Fix Stripe setup desc (partial match)
content = content.replace(
    '{t("seller.stripeSetupDesc")} <strong>Stripe</strong> 自動轉帳給你。',
    '{t("seller.stripeSetupDesc")}'
)
print("✓ Fixed stripe setup desc")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
