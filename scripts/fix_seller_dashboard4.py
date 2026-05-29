path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Generate share image
    ('{generatingImage ? "生成中... " : "生成分享圖片"}', '{generatingImage ? t("common.generating") : t("seller.generateShareImage")}'),
    
    # Order completed in earnings
    ('                   已完成\n', '                   {t("seller.status.completed")}\n'),
    
    # Edit auction button
    ('                           編輯拍賣\n', '                           {t("seller.editAuction")}\n'),
    
    # CSV import fields (these are CSV column name fallbacks, keep as-is for backward compat)
    # But we can translate the UI labels
    
    # Bulk delete toast
    ("toast.success(`已刪除 ${data.deletedCount} 件商品${data.cancelledOrdersCount > 0 ? `，已取消 ${data.cancelledOrdersCount} 個待",
     "toast.success(t('seller.bulkDeleteSuccess', { count: data.deletedCount, cancelCount: data.cancelledOrdersCount }) + (data.cancelledOrdersCount > 0 ? '' : '') || `已刪除 ${data.deletedCount} 件商品${data.cancelledOrdersCount > 0 ? `，已取消 ${data.cancelledOrdersCount} 個待"),
    
    # View product link
    ('               查看商品 →', '               {t("seller.viewProduct")} →'),
    
    # Maintenance page back to home
    ('href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 round',
     'href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 round'),
    
    # Apply to sell
    ('               申請成為賣家', '               {t("seller.applyToSell")}'),
    
    # Stripe setup desc
    ('{t("seller.stripeSetupDesc")} <strong>Stripe</strong> 自動轉帳給你。',
     '{t("seller.stripeSetupDesc")}'),
    
    # Nav tabs
    ('                   我的商品\n', '                   {t("seller.myProducts")}\n'),
    ('                   我的拍賣\n', '                   {t("seller.myAuctions")}\n'),
    ('                   訂單管理\n', '                   {t("seller.orderManagement")}\n'),
    ('                   買家出價\n', '                   {t("seller.buyerOffers")}\n'),
    ('                   收款記錄\n', '                   {t("seller.revenueRecord")}\n'),
    
    # Empty listing hint
    ('<p className="text-sm text-gray-400">點擊上方「立即上架」開始吸引買家</p>',
     '<p className="text-sm text-gray-400">{t("seller.emptyListingHint")}</p>'),
    
    # Batch mode toggle
    ('{batchMode ? "取消批量" : "批量管理"}', '{batchMode ? t("seller.cancelBatch") : t("seller.batchManage")}'),
    
    # View toggle titles
    ('title="列表視圖"', 'title={t("seller.listView")}'),
    ('title="網格視圖"', 'title={t("seller.gridView")}'),
    
    # Bulk action buttons
    ("return `下架 (${deactivatableCount})`;", "return `${t('seller.delist')} (${deactivatableCount})`;"),
    ('                                     重新上架 ({relistableIds.length})', '                                     {t("seller.relist")} ({relistableIds.length})'),
    ('                                     刪除 ({deletableIds.length})', '                                     {t("common.delete")} ({deletableIds.length})'),
    
    # Empty category
    ('<p className="text-sm">此類別無商品</p>', '<p className="text-sm">{t("seller.noCategoryItems")}</p>'),
    
    # Grid listing status
    ('{isActive ? "上架" : isSold ? "售出" : isRemoved ? "下架" : listing.status}',
     '{isActive ? t("seller.listingActive") : isSold ? t("seller.listingSold") : isRemoved ? t("seller.listingRemoved") : listing.status}'),
    
    # Order filter tabs
    ("{ key: 'all', label: '全部' }", "{ key: 'all', label: t('common.all') }"),
    ("{ key: 'pending', label: '待確認' }", "{ key: 'pending', label: t('seller.orderTab.pending') }"),
    ("{ key: 'active', label: '進行中' }", "{ key: 'active', label: t('seller.orderTab.active') }"),
    ("{ key: 'done', label: '已完成' }", "{ key: 'done', label: t('seller.orderTab.done') }"),
    
    # Empty orders
    ("<p>{(myOrders?.length ?? 0) > 0 ? '沒有符合條件的訂單' : '尚無訂單'}</p>",
     "<p>{(myOrders?.length ?? 0) > 0 ? t('seller.noMatchingOrders') : t('seller.noOrders')}</p>"),
    
    # Order details
    ("alt={item.title ?? '商品'}", "alt={item.title ?? t('seller.product')}"),
    ('<p>📦 收件人：{item.shippingName} {item.shippingPhone}</p>',
     '<p>📦 {t("seller.recipient")}：{item.shippingName} {item.shippingPhone}</p>'),
    ('<p>📍 地址：{(() => {',
     '<p>📍 {t("seller.address")}：{(() => {'),
    ("return <p>📦 收件人：{item.shippingName} {item.shippingPhone}</p>;",
     "return <p>📦 {t('seller.recipient')}：{item.shippingName} {item.shippingPhone}</p>;"),
    ('{item.trackingNumber && <p>🚚 追蹤號：{item.trackingNumber}</p>}',
     '{item.trackingNumber && <p>🚚 {t("seller.trackingNo")}：{item.trackingNumber}</p>}'),
    ('{item.shippedAt && <p>📅 出貨日期：{new Date(item.shippedAt).toLocaleDateString(\'zh-HK\')}</p>}',
     '{item.shippedAt && <p>📅 {t("seller.shippedDate")}：{new Date(item.shippedAt).toLocaleDateString(\'zh-HK\')}</p>}'),
    
    # Shipped status
    ('🚚 已寄出{item.trackingNumber ? `，追蹤號：${item.trackingNumber}` : \'\'}',
     '{t("seller.shippedStatus")}{item.trackingNumber ? `，${t("seller.trackingNo")}：${item.trackingNumber}` : \'\'}'),
    
    # Dispute
    ('<p className="font-semibold flex items-center gap-1"><span>⚠️</span> 買家申請爭議，等待管理員處理</p>',
     '<p className="font-semibold flex items-center gap-1"><span>⚠️</span> {t("seller.disputeOpened")}</p>'),
    ('{item.disputeReason && <p>申訴原因：{item.disputeReason}</p>}',
     '{item.disputeReason && <p>{t("seller.disputeReason")}：{item.disputeReason}</p>}'),
    ('{item.disputeOpenedAt && <p>申訴時間：{new Date(item.disputeOpenedAt).toLocaleDateString(\'zh-HK',
     '{item.disputeOpenedAt && <p>{t("seller.disputeOpenedAt")}：{new Date(item.disputeOpenedAt).toLocaleDateString(\'zh-HK'),
    ('<p className="font-semibold">爭議結果：</p>', '<p className="font-semibold">{t("seller.disputeResult")}：</p>'),
    ('{item.disputeResolvedAt && <p>處理時間：{new Date(item.disputeResolvedAt).toLocaleDateString(\'z',
     '{item.disputeResolvedAt && <p>{t("seller.disputeResolvedAt")}：{new Date(item.disputeResolvedAt).toLocaleDateString(\'z'),
    
    # Order completed payout
    ('訂單已完成，收到 HKD {parseFloat(item.sellerReceivableHkd ?? item.priceHkd ?? \'0\').toFixed(2)}',
     '{t("seller.orderCompletedPayout", { amount: parseFloat(item.sellerReceivableHkd ?? item.priceHkd ?? \'0\').toFixed(2) })}'),
    
    # Payout hold
    ('{hasExpired ? \'💰 正在處理放款\' : \'預計放款時間\'}',
     '{hasExpired ? t("seller.processingPayout") : t("seller.estimatedPayout")}'),
    ("? '冷靜期已結束，系統正在處理轉帳給你'", "? t('seller.cooldownEnded')"),
    ("⚠️ 48 小時冷靜期中，買家可申請爭議，到期後自動放款",
     "{t('seller.cooldownWarning')}"),
    
    # Fill shipping / view detail
    ('<Package className="w-3 h-3 mr-1" />填寫出貨資料', '<Package className="w-3 h-3 mr-1" />{t("seller.fillShipping")}'),
    ('<ExternalLink className="w-3 h-3" />查看詳情', '<ExternalLink className="w-3 h-3" />{t("seller.viewDetails")}'),
    
    # Offer filter labels
    ("const labels = { all: '全部', pending: '待回覆', accepted: '已接受', rejected: '已拒絕' };",
     "const labels = { all: t('common.all'), pending: t('seller.offerStatus.pending'), accepted: t('seller.offerStatus.accepted'), rejected: t('seller.offerStatus.rejected') };"),
    
    # Empty offers
    ('<p className="text-sm">沒有符合條件的出價</p>', '<p className="text-sm">{t("seller.noMatchingOffers")}</p>'),
    
    # Offer status badge
    ('{offer.status === \'pending\' ? \'待回覆\' : offer.status === \'accepted\' ? \'已接受\' : \'已拒絕\'}',
     '{offer.status === \'pending\' ? t(\'seller.offerStatus.pending\') : offer.status === \'accepted\' ? t(\'seller.offerStatus.accepted\') : t(\'seller.offerStatus.rejected\')}'),
    
    # Offer listing alt
    ("alt={offer.listingTitle || '商品'}", "alt={offer.listingTitle || t('seller.product')}"),
    
    # Offer listing title
    ("{offer.listingTitle || '商品'}", "{offer.listingTitle || t('seller.product')}"),
    
    # Go to product
    ('                                       前往商品', '                                       {t("seller.goToProduct")}'),
    
    # Offer expired
    ('<Clock className="w-3 h-3" />已過期', '<Clock className="w-3 h-3" />{t("seller.offerExpired")}'),
    
    # Offer time remaining
    ("`還有 ${diffDays} 天 ${remHours} 小時到期`", "`${t('seller.offerExpiresIn', { days: diffDays, hours: remHours })}`"),
    ("`還有 ${Math.floor(diffHours)} 小時到期`", "`${t('seller.offerExpiresInHours', { hours: Math.floor(diffHours) })}`"),
    
    # Accept/reject offer
    ('<Check className="w-3 h-3 mr-1" />接受出價', '<Check className="w-3 h-3 mr-1" />{t("seller.acceptOffer")}'),
    ('<X className="w-3 h-3 mr-1" />拒絕', '<X className="w-3 h-3 mr-1" />{t("seller.rejectOffer")}'),
    
    # Go to product (second)
    ('<ExternalLink className="w-3 h-3" />前往商品', '<ExternalLink className="w-3 h-3" />{t("seller.goToProduct")}'),
    
    # CSV template hints
    ('<p>• min_offer: 最低出價金額（可留空）</p>', '<p>• min_offer: {t("seller.csvHint.minOffer")}</p>'),
    ('<p>• image_url: 公開圖片 URL，多張用 | 分隔（可留空）</p>', '<p>• image_url: {t("seller.csvHint.imageUrl")}</p>'),
    
    # Preview CSV
    ('<p className="text-sm font-semibold text-[#06038D]">預覽 {csvRows.length} 件商品</p>',
     '<p className="text-sm font-semibold text-[#06038D]">{t("seller.csvPreview", { count: csvRows.length })}</p>'),
    
    # Download CSV template
    ('下載範本 CSV', '{t("seller.downloadCsvTemplate")}'),
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
