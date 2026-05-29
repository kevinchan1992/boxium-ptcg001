import re
path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Maintenance back to home
    ('返回主頁', '{t("common.backToHome")}'),
    
    # Apply to sell (second occurrence)
    ('               申請成為賣家', '               {t("seller.applyToSell")}'),
    
    # Select all / deselect all
    ('{selectedIds.size === filteredListings.length ? "取消全選" : "全選"}',
     '{selectedIds.size === filteredListings.length ? t("common.deselectAll") : t("common.selectAll")}'),
    
    # Payout date format
    ("payoutHoldUntil.toLocaleString('zh-HK', { month: 'long', day: 'numeric', ho",
     "payoutHoldUntil.toLocaleString(undefined, { month: 'long', day: 'numeric', ho"),
    
    # CSV template row
    ("const csv = 'title,description,condition,price,quantity,tcg_series,allow_offers,min_offer,image_url\\n示",
     "const csv = 'title,description,condition,price,quantity,tcg_series,allow_offers,min_offer,image_url\\n示"),
    
    # CSV preview "無"
    ('<span className="text-gray-300 text-[10px]">無</span>', '<span className="text-gray-300 text-[10px]">{t("common.none")}</span>'),
    
    # CSV upload progress
    ('{csvRows.filter(r => r._status === \'done\').length} / {csvRows.length} 件完成',
     '{t("seller.csvProgress", { done: csvRows.filter(r => r._status === \'done\').length, total: csvRows.length })}'),
    ('<span className="text-xs text-red-500">{csvRows.filter(r => r._status === \'error\').length} 件失敗</span>',
     '<span className="text-xs text-red-500">{t("seller.csvFailed", { count: csvRows.filter(r => r._status === \'error\').length })}</span>'),
    
    # CSV validation error
    ("if (isNaN(priceNum) || priceNum <= 0) throw new Error('售價格式錯誤');",
     "if (isNaN(priceNum) || priceNum <= 0) throw new Error(t('seller.csvPriceError'));"),
    
    # CSV upload error
    ("if (data?.error) throw new Error(data.error.message ?? '上架失敗');",
     "if (data?.error) throw new Error(data.error.message ?? t('seller.csvListingFailed'));"),
    
    # CSV batch success
    ("toast.success(`批量上架完成！${doneCount} 件商品已上架`);",
     "toast.success(t('seller.csvBatchSuccess', { count: doneCount }));"),
    
    # CSV confirm button
    ("'全部完成'", "t('seller.csvAllDone')"),
    ("`確認上架 ${csvRows.filter(r => r._status === 'pending' || r._status === 'error').length} 件商品`",
     "t('seller.csvConfirmList', { count: csvRows.filter(r => r._status === 'pending' || r._status === 'error').length })"),
    
    # Apply form
    ('<Label>顯示名稱 *</Label>', '<Label>{t("seller.displayName")} *</Label>'),
    ('placeholder="例如：CardMaster HK"', 'placeholder={t("seller.displayNamePlaceholder")}'),
    ('<Label>自我介紹</Label>', '<Label>{t("seller.bio")}</Label>'),
    ('placeholder="介紹你的賣家背景..."', 'placeholder={t("seller.bioPlaceholder")}'),
    ('<p className="font-medium">平台服務費：5%</p>', '<p className="font-medium">{t("seller.platformFeeRate")}</p>'),
    ('<p className="mt-1">款項透過 Stripe Connect 自動轉帳到你的銀行帳戶，通常 2-3 個工作天到帳。</p>',
     '<p className="mt-1">{t("seller.stripePayoutDesc")}</p>'),
    ('{applyMutation.isPending ? "提交中..." : "提交申請"}', '{applyMutation.isPending ? t("common.submitting") : t("seller.submitApplication")}'),
    
    # Reject offer dialog
    ('<DialogTitle className="text-lg font-bold" style={{ color: "#06038d" }}>拒絕出價</DialogTitle>',
     '<DialogTitle className="text-lg font-bold" style={{ color: "#06038d" }}>{t("seller.rejectOfferTitle")}</DialogTitle>'),
    ('<p className="text-sm text-gray-600">你可以選擇填寫拒絕原因，買家將會收到通知。</p>',
     '<p className="text-sm text-gray-600">{t("seller.rejectOfferDesc")}</p>'),
    ('<Label className="text-sm font-medium text-gray-700">拒絕原因（選填）</Label>',
     '<Label className="text-sm font-medium text-gray-700">{t("seller.rejectReasonLabel")}</Label>'),
    ('placeholder="例如：此出價低於我的底價，請重新出價...（最多 300 字）"',
     'placeholder={t("seller.rejectReasonPlaceholder")}'),
    ('<p className="text-xs text-amber-700">⚠️ 拒絕後買家將收到通知，此操作不可撤回。</p>',
     '<p className="text-xs text-amber-700">⚠️ {t("seller.rejectOfferWarning")}</p>'),
    ('{respondToOfferMutation.isPending ? "處理中..." : "確認拒絕"}',
     '{respondToOfferMutation.isPending ? t("common.processing") : t("seller.confirmReject")}'),
    
    # Edit listing dialog
    ('<VisuallyHidden><DialogTitle>編輯商品資訊</DialogTitle></VisuallyHidden>',
     '<VisuallyHidden><DialogTitle>{t("seller.editListingTitle")}</DialogTitle></VisuallyHidden>'),
    ('<h2 className="text-base font-bold text-white">編輯商品資訊</h2>',
     '<h2 className="text-base font-bold text-white">{t("seller.editListingTitle")}</h2>'),
    ('<p className="text-xs text-gray-500 mt-0.5">現售價 HKD {parseFloat(editingListing.priceHkd as string).toF',
     '<p className="text-xs text-gray-500 mt-0.5">{t("seller.currentPrice")} HKD {parseFloat(editingListing.priceHkd as string).toF'),
    ('<p className="text-xs text-gray-400">庫存 {editingListing.quantity} 件</p>',
     '<p className="text-xs text-gray-400">{t("seller.stockCount", { count: editingListing.quantity })}</p>'),
    ('<p className="text-xs font-semibold text-amber-800">此商品有進行中的訂單</p>',
     '<p className="text-xs font-semibold text-amber-800">{t("seller.activeOrderWarning")}</p>'),
    ('<p className="text-xs text-amber-700 mt-0.5">已售出 {editingListing.quantity - editingListing.remainingQu',
     '<p className="text-xs text-amber-700 mt-0.5">{t("seller.soldCount", { count: editingListing.quantity - editingListing.remainingQu'),
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
