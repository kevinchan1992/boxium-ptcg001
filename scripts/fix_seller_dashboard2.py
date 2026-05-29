path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Status helpers (continued)
    ("if (s === 'shipped') return '已寄出，等待買家確認';", "if (s === 'shipped') return t('seller.statusHelper.shipped');"),
    ("if (s === 'delivered') return '買家確認收貨中';", "if (s === 'delivered') return t('seller.statusHelper.delivered');"),
    ("if (s === 'completed') return '訂單已完成';", "if (s === 'completed') return t('seller.statusHelper.completed');"),
    ("if (s === 'cancelled') return '訂單已取消';", "if (s === 'cancelled') return t('seller.statusHelper.cancelled');"),
    ("if (s === 'dispute' || s === 'disputed') return '爭議處理中';", "if (s === 'dispute' || s === 'disputed') return t('seller.statusHelper.disputed');"),
    ("if (s === 'refunded') return '已退款';", "if (s === 'refunded') return t('seller.statusHelper.refunded');"),
    
    # Shipping proof lightbox
    ('alt="出貨憑證" isOpen={lightboxOpen}', 'alt={t("seller.shippingProofAlt")} isOpen={lightboxOpen}'),
    
    # Show/hide step
    ("<span>{showStep ? '收起' : '查看進度'}</span>", "<span>{showStep ? t('common.collapse') : t('seller.viewProgress')}</span>"),
    
    # Share panel
    ('toast.success("分享圖片已下載！");', 'toast.success(t("seller.shareImageDownloaded"));'),
    ('toast.error("生成圖片失敗，請稍後再試");', 'toast.error(t("seller.shareImageFailed"));'),
    ('toast.success("連結已複製！");', 'toast.success(t("seller.linkCopied"));'),
    ('toast.error("複製失敗，請手動複製連結");', 'toast.error(t("seller.copyFailed"));'),
    ('toast.info("連結已複製！請貼到 Instagram Story 中分享");', 'toast.info(t("seller.instagramCopyHint"));'),
    ('title="分享商品"', 'title={t("seller.shareProduct")}'),
    ('<p className="text-xs font-semibold text-gray-700">分享商品</p>', '<p className="text-xs font-semibold text-gray-700">{t("seller.shareProduct")}</p>'),
    ('{generatingImage ? "生成中... " : "生成分享圖片"}', '{generatingImage ? t("common.generating") : t("seller.generateShareImage")}'),
    ('{copied ? "已複製！" : "複製連結"}', '{copied ? t("seller.copied") : t("seller.copyLink")}'),
    
    # Revenue section
    ('以下為平台透過 Stripe 轉帳至你帳戶的收款記錄。所有金額均已扣除 5% 平台手續費。如有疑問請聯絡客服。',
     '{t("seller.revenueDesc")}'),
    ('<p className="text-xs text-gray-400 mt-1">待出貨/運送中 {summary.pendingCount} 筆</p>',
     '<p className="text-xs text-gray-400 mt-1">{t("seller.pendingOrders", { count: summary.pendingCount })}</p>'),
    ('<p className="text-xs text-gray-500 mb-1">累計销售額</p>',
     '<p className="text-xs text-gray-500 mb-1">{t("seller.totalSales")}</p>'),
    ('<p className="text-xs text-white/70 mb-1">累計淨收入</p>',
     '<p className="text-xs text-white/70 mb-1">{t("seller.totalNetIncome")}</p>'),
    ('<p className="text-xs text-white/60 mt-1">扣除平台手續費後實際收款金額</p>',
     '<p className="text-xs text-white/60 mt-1">{t("seller.netIncomeDesc")}</p>'),
    ('<p className="text-xs text-amber-700 font-medium">待收款金額（進行中訂單）</p>',
     '<p className="text-xs text-amber-700 font-medium">{t("seller.pendingIncome")}</p>'),
    ('<p className="text-xs text-amber-600 mt-1">訂單完成後轉入累計淨收入</p>',
     '<p className="text-xs text-amber-600 mt-1">{t("seller.pendingIncomeDesc")}</p>'),
    ('<p className="text-sm font-semibold text-gray-700 mb-3">近 6 個月收益趨勢</p>',
     '<p className="text-sm font-semibold text-gray-700 mb-3">{t("seller.revenueChart")}</p>'),
    ("formatter={(value) => [`HKD ${Number(value ?? 0).toFixed(0)}`, '淨收入'] as [string, string]}",
     "formatter={(value) => [`HKD ${Number(value ?? 0).toFixed(0)}`, t('seller.netIncome')] as [string, string]}"),
    ('<span>已完成訂單數：{monthlyData.reduce((s: number, m: any) => s + m.orders, 0)} 筆</span>',
     '<span>{t("seller.completedOrders", { count: monthlyData.reduce((s: number, m: any) => s + m.orders, 0) })}</span>'),
    ('<span>本月：{monthlyData[monthlyData.length - 1]?.orders ?? 0} 筆</span>',
     '<span>{t("seller.thisMonth", { count: monthlyData[monthlyData.length - 1]?.orders ?? 0 })}</span>'),
    ('<p>尚無已完成訂單</p>', '<p>{t("seller.noCompletedOrders")}</p>'),
    ('<p className="text-sm mt-1">訂單完成後將顯示收款明細</p>', '<p className="text-sm mt-1">{t("seller.noCompletedOrdersDesc")}</p>'),
    ('<p className="text-sm font-medium text-gray-600">收款明細（{orders.length} 筆）</p>',
     '<p className="text-sm font-medium text-gray-600">{t("seller.paymentDetails", { count: orders.length })}</p>'),
    ('<span className="text-xs text-white/80 font-medium">訂單 #{order.orderNo ?? order.id}</span>',
     '<span className="text-xs text-white/80 font-medium">{t("common.order")} #{order.orderNo ?? order.id}</span>'),
    ('                   已完成', '                   {t("seller.status.completed")}'),
    ("alt={order.title || '商品'}", "alt={order.title || t('seller.product')}"),
    ("完成日期：{order.completedAt ? new Date(order.completedAt).toLocaleDateString('zh-HK') : new Date(order",
     "{t('seller.completedDate')}：{order.completedAt ? new Date(order.completedAt).toLocaleDateString('zh-HK') : new Date(order"),
    ('<span className="text-gray-500">平台手續費 ({parseFloat(order.platformFeeRate ?? \'0.05\') * 100}%)</span>',
     '<span className="text-gray-500">{t("seller.platformFee", { rate: parseFloat(order.platformFeeRate ?? \'0.05\') * 100 })}</span>'),
    
    # Listing form
    ('取消', '{t("common.cancel")}'),
    ('儲存修改', '{t("common.saveChanges")}'),
    
    # Auction status
    ("toast.success('已重新上架拍賣');", "toast.success(t('seller.auctionRelisted'));"),
    ("endedSoldLabel = '已成交'; endedSoldCls = 'bg-green-100 text-green-700';", "endedSoldLabel = t('seller.auctionSold'); endedSoldCls = 'bg-green-100 text-green-700';"),
    ("endedSoldLabel = '已取消'; endedSoldCls = 'bg-red-100 text-red-600';", "endedSoldLabel = t('seller.status.cancelled'); endedSoldCls = 'bg-red-100 text-red-600';"),
    ("endedSoldLabel = '已得標（待付款）'; endedSoldCls = 'bg-[#06038D]/10 text-[#06038D]';", "endedSoldLabel = t('seller.auctionWonPending'); endedSoldCls = 'bg-[#06038D]/10 text-[#06038D]';"),
    ('active:         { label: "競拍中",   cls: "bg-blue-100 text-blue-700" }', 'active:         { label: t("seller.auctionStatus.active"),      cls: "bg-blue-100 text-blue-700" }'),
    ('ending_soon:    { label: "即將結標", cls: "bg-orange-100 text-orange-700" }', 'ending_soon:    { label: t("seller.auctionStatus.endingSoon"),  cls: "bg-orange-100 text-orange-700" }'),
    ('scheduled:      { label: "已排程",   cls: "bg-indigo-100 text-indigo-700" }', 'scheduled:      { label: t("seller.auctionStatus.scheduled"),   cls: "bg-indigo-100 text-indigo-700" }'),
    ('ended_no_bid:   { label: "流標",     cls: "bg-gray-100 text-gray-500" }', 'ended_no_bid:   { label: t("seller.auctionStatus.endedNoBid"),  cls: "bg-gray-100 text-gray-500" }'),
    ('ended:          { label: "已結標",   cls: "bg-green-100 text-green-700" }', 'ended:          { label: t("seller.auctionStatus.ended"),       cls: "bg-green-100 text-green-700" }'),
    ('sold:           { label: "已成交",   cls: "bg-green-100 text-green-700" }', 'sold:           { label: t("seller.auctionStatus.sold"),        cls: "bg-green-100 text-green-700" }'),
    ('{ setTimeLeft("已結標"); return; }', '{ setTimeLeft(t("seller.auctionEnded")); return; }'),
    
    # Auction promo
    ('<p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">拍賣中心</p>',
     '<p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">{t("seller.auctionCenter")}</p>'),
    ('<h3 className="text-white font-bold text-lg leading-tight">開設你的第一場拍賣</h3>',
     '<h3 className="text-white font-bold text-lg leading-tight">{t("seller.startFirstAuction")}</h3>'),
    ('<p className="text-white/60 text-xs mt-1">讓買家競價，以最佳價格成交</p>',
     '<p className="text-white/60 text-xs mt-1">{t("seller.auctionPromoDesc")}</p>'),
    ('                開始拍賣', '                {t("seller.startAuction")}'),
    ("{ step: '1', title: '設定起拍價', desc: '最低入場價格' }", "{ step: '1', title: t('seller.auctionStep1Title'), desc: t('seller.auctionStep1Desc') }"),
    ("{ step: '2', title: '選擇天數', desc: '3 日或 7 日拍賣' }", "{ step: '2', title: t('seller.auctionStep2Title'), desc: t('seller.auctionStep2Desc') }"),
    ("{ step: '3', title: '等候競價', desc: '自動通知結果' }", "{ step: '3', title: t('seller.auctionStep3Title'), desc: t('seller.auctionStep3Desc') }"),
    
    # Auction tabs
    ('{ key: "active", label: "進行中", count: activeAuctions.length }', '{ key: "active", label: t("seller.auctionTab.active"), count: activeAuctions.length }'),
    ('{ key: "ended", label: "已結標", count: endedAuctions.length }', '{ key: "ended", label: t("seller.auctionTab.ended"), count: endedAuctions.length }'),
    ('{ key: "rejected", label: "已下架", count: rejectedAuctions.length }', '{ key: "rejected", label: t("seller.auctionTab.rejected"), count: rejectedAuctions.length }'),
    
    # Auction detail labels
    ('<p className="text-xs font-semibold text-indigo-700">預計開始時間</p>',
     '<p className="text-xs font-semibold text-indigo-700">{t("seller.scheduledStart")}</p>'),
    ('<p className="text-xs text-gray-400">{"起標價"}</p>',
     '<p className="text-xs text-gray-400">{t("seller.startingBid")}</p>'),
    ('<p className="text-xs text-gray-400">目前最高出價</p>',
     '<p className="text-xs text-gray-400">{t("seller.currentHighBid")}</p>'),
    ('<p className="text-sm font-bold text-gray-400">{"尚無出價"}</p>',
     '<p className="text-sm font-bold text-gray-400">{t("seller.noBids")}</p>'),
    ('<p className="text-xs text-gray-400">出價次數</p>',
     '<p className="text-xs text-gray-400">{t("seller.bidCount")}</p>'),
    ('<p className="text-sm font-bold text-gray-700">{auction.bidCount} 次</p>',
     '<p className="text-sm font-bold text-gray-700">{t("seller.bidCountValue", { count: auction.bidCount })}</p>'),
    ('<p className="text-xs text-gray-400">即買價</p>',
     '<p className="text-xs text-gray-400">{t("seller.buyNowPrice")}</p>'),
    ('<p className="text-xs text-gray-400">{"剩餘時間"}</p>',
     '<p className="text-xs text-gray-400">{t("seller.timeLeft")}</p>'),
    ('<p className="text-xs text-orange-500 font-semibold">{"即將結標"}</p>',
     '<p className="text-xs text-orange-500 font-semibold">{t("seller.endingSoon")}</p>'),
    ('                           查看拍賣', '                           {t("seller.viewAuction")}'),
    ('<p className="text-xs font-semibold text-red-600 mb-1">下架原因：</p>',
     '<p className="text-xs font-semibold text-red-600 mb-1">{t("seller.rejectReason")}：</p>'),
    ("auction.rejectedReason || '未提", "auction.rejectedReason || t('seller.noRejectReason"),
    ('                           編輯拍賣', '                           {t("seller.editAuction")}'),
    ("{resubmitMutation.isPending ? '提交中...' : '重新上架'}", "{resubmitMutation.isPending ? t('common.submitting') : t('seller.relistAuction')}"),
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
