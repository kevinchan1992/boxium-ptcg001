import re
path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

# Use regex for lines with specific indentation
replacements_re = [
    # Save changes button
    (r'              儲存更改\n', '              {t("seller.editListing.saveChanges")}\n'),
    # Fee tier
    (r'                          <span>適用第 \{tier\} 級費率（\{ratePercent\}%）</span>', 
     '                          <span>{t("seller.feeTier", { tier, rate: ratePercent })}</span>'),
    (r'                          <span>預計平台費 -HKD \{fee\.toFixed\(2\)\}</span>',
     '                          <span>{t("seller.estimatedFeeAmount", { amount: fee.toFixed(2) })}</span>'),
    (r'                          <span>預計實收</span>',
     '                          <span>{t("seller.estimatedReceive")}</span>'),
    # Based on records
    (r'\(基於 \{conditionPriceData\.recordCount\} 筆成交\)',
     '{t("seller.basedOnRecords", { count: conditionPriceData.recordCount })}'),
    # Min offer placeholder
    (r'placeholder="留空表示不設下限"', 'placeholder={t("seller.newListing.minOfferPlaceholder")}'),
    # Cancel buttons
    (r'              取消\n', '              {t("common.cancel")}\n'),
    # Agree and list
    (r'              我同意並繼續上架\n', '              {t("seller.auctionTerms.agreeAndList")}\n'),
    # Auction terms title
    (r'              拍賣賣家條款\n', '              {t("seller.auctionTerms.title")}\n'),
    # Auction terms intro
    (r'            <p className="font-semibold text-white">上架拍賣前，請仔細閱讀並同意以下賣家責任條款：</p>',
     '            <p className="font-semibold text-white">{t("seller.auctionTerms.intro")}</p>'),
    # Terms sections
    (r'<p className="font-bold text-\[#FEDD00\] text-xs mb-1">✅ 商品真實性保證</p>',
     '<p className="font-bold text-[#FEDD00] text-xs mb-1">✅ {t("seller.auctionTerms.authenticityTitle")}</p>'),
    (r'<p className="font-bold text-\[#FEDD00\] text-xs mb-1">📦 出貨責任</p>',
     '<p className="font-bold text-[#FEDD00] text-xs mb-1">📦 {t("seller.auctionTerms.shippingTitle")}</p>'),
    (r'<p className="font-bold text-\[#FEDD00\] text-xs mb-1">🚫 撤拍限制</p>',
     '<p className="font-bold text-[#FEDD00] text-xs mb-1">🚫 {t("seller.auctionTerms.withdrawTitle")}</p>'),
    (r'<p className="font-bold text-\[#FEDD00\] text-xs mb-1">💰 平台服務費</p>',
     '<p className="font-bold text-[#FEDD00] text-xs mb-1">💰 {t("seller.auctionTerms.feeTitle")}</p>'),
]

count = 0
for pattern, replacement in replacements_re:
    new_content, n = re.subn(pattern, replacement, content, count=1)
    if n > 0:
        content = new_content
        count += 1
    else:
        print(f"✗ Regex not found: {pattern[:80]}...")

# Long text replacements (auction terms content)
long_replacements = [
    # Authenticity content
    ('<p className="text-xs">賣家須確保所上架商品為本人合法持有，商品描述、品相評級及圖片須如實反映商品狀況，不得虛假陳述或誇大。若商品為仿冒品或描述與實物不符，平台有權立即下架並封禁帳戶。',
     '<p className="text-xs">{t("seller.auctionTerms.authenticityContent")}'),
    # Shipping content
    ('<p className="text-xs">拍賣結標且買家完成付款後，賣家須於 <strong>3 個工作天內</strong>安排出貨，並在平台填寫有效追蹤號碼。逾期未出貨將被記錄違規，影響帳戶評分及上',
     '<p className="text-xs">{t("seller.auctionTerms.shippingContent")}'),
    # Withdraw content
    ('<p className="text-xs">拍賣一經上架並有人出價後，賣家<strong>不得</strong>無故撤回拍賣。如需撤拍，須提前聯絡平台客服說明原因。惡意撤拍將視同違規處理，首次警告，再犯將',
     '<p className="text-xs">{t("seller.auctionTerms.withdrawContent")}'),
    # Fee content
    ('<p className="text-xs">每筆成功成交的拍賣，平台將收取成交金額 <strong>5%</strong> 作為服務費，於買家付款後自動扣除。賣家實際到手金額為成交價扣除服務費後的餘額。<',
     '<p className="text-xs">{t("seller.auctionTerms.feeContent")}'),
    # New seller content
    ('<p className="text-xs">完成成交少於 5 次的新賣家，拍賣起拍價上限為 <strong>HK$5,000</strong>。起拍價超過 HK$10,000 的拍賣屬於高價風控監控範圍，將',
     '<p className="text-xs">{t("seller.auctionTerms.newSellerContent")}'),
    # Violation content
    ('<p className="text-xs">賣家違規（虛假描述、惡意撤拍、逾期不出貨等）將依以下程序處理：首次違規：警告 → 第二次：7 天限制上架 → 第三次：30 天封禁 → 第四次：永久封禁。</p>',
     '<p className="text-xs">{t("seller.auctionTerms.violationContent")}</p>'),
    # Protection content
    ('<p className="text-xs">平台設有買賣雙方評價系統。拍賣完成後，買家可對賣家評分，評分記錄公開顯示於賣家個人頁面。賣家亦可對買家評分，共同維護平台交易環境。</p>',
     '<p className="text-xs">{t("seller.auctionTerms.protectionContent")}</p>'),
    # Shipping proof required
    ('⚠️ {t("seller.shipping.proofRequired")}',
     '⚠️ {t("seller.shipping.proofRequired")}'),
    # SF Express placeholder
    ("'例：SF1234567890'", "t('seller.shipping.sfExpressPlaceholder')"),
    # Bulk delete toast (fix the broken one)
    ("toast.success(t('seller.bulkDeleteSuccess', { count: data.deletedCount, cancelCount: data.cancelledOrdersCount }) + (data.cancelledOrdersCount > 0 ? '' : '') || `已刪除 ${data.deletedCount} 件商品${data.cancelledOrdersCount > 0 ? `，已取消 ${data.cancelledOrdersCount} 個待",
     "toast.success(t('seller.bulkDeleteSuccess', { count: data.deletedCount, cancelCount: data.cancelledOrdersCount })) || toast.success(`已刪除 ${data.deletedCount} 件商品${data.cancelledOrdersCount > 0 ? `，已取消 ${data.cancelledOrdersCount} 個待"),
    # Maintenance page back to home
    ('<a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-full hover:bg-yellow-300 transition-colors">',
     '<a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-full hover:bg-yellow-300 transition-colors">'),
]

for old, new in long_replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f"✗ Not found: {old[:80]}...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! {count} replacements made")
