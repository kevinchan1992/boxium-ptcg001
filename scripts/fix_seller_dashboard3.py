path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Generate share image button
    ('{generatingImage ? "生成中... " : "生成分享圖片"}', '{generatingImage ? t("common.generating") : t("seller.generateShareImage")}'),
    
    # Platform fee
    ('<p className="text-xs text-gray-400 mt-1">平台手續費 HKD {summary.totalFees.toFixed(0)}</p>',
     '<p className="text-xs text-gray-400 mt-1">{t("seller.platformFeeAmount", { amount: summary.totalFees.toFixed(0) })}</p>'),
    
    # Completed status in order list
    ('                   已完成\n', '                   {t("seller.status.completed")}\n'),
    
    # Edit auction
    ('                           編輯拍賣\n', '                           {t("seller.editAuction")}\n'),
    
    # Auction empty state
    ('{subTab === "active" ? "目前沒有進行中或已排程的拍賣" : subTab === "rejected" ? "沒有被拒絕的拍賣" : "尚無已結標的拍賣"}',
     '{subTab === "active" ? t("seller.noActiveAuctions") : subTab === "rejected" ? t("seller.noRejectedAuctions") : t("seller.noEndedAuctions")}'),
    ('<p className="text-gray-400 text-xs mt-1">在「我的商品」標簽中選擇「拍賣模式」上架新拍賣</p>',
     '<p className="text-gray-400 text-xs mt-1">{t("seller.noAuctionsHint")}</p>'),
    
    # Condition labels
    ("const conditionLabels: Record<string, string> = { raw_a: 'A品', raw_b: 'B品', raw_c: 'C品', psa10: 'PSA 10', psa9: 'PSA 9",
     "const conditionLabels: Record<string, string> = { raw_a: t('seller.grade.rawA'), raw_b: t('seller.grade.rawB'), raw_c: t('seller.grade.rawC'), psa10: 'PSA 10', psa9: 'PSA 9"),
    
    # Listing table headers
    ('<span>商品名稱</span>', '<span>{t("seller.productName")}</span>'),
    ('<span className="text-right pr-3">售價</span>', '<span className="text-right pr-3">{t("seller.price")}</span>'),
    ('<span className="text-center px-3 hidden md:block">庫存</span>', '<span className="text-center px-3 hidden md:block">{t("seller.stock")}</span>'),
    ('<span className="text-center px-3 hidden lg:block">品相</span>', '<span className="text-center px-3 hidden lg:block">{t("seller.condition")}</span>'),
    ('<span className="text-left">狀態</span>', '<span className="text-left">{t("seller.statusLabel")}</span>'),
    
    # Listing status
    ("{isActive ? '上架中' : isSold ? '已售出' : isRemoved ? (isAdminDelisted ? '強制下架' : '已下架') : listing.status}",
     "{isActive ? t('seller.listingActive') : isSold ? t('seller.listingSold') : isRemoved ? (isAdminDelisted ? t('seller.listingAdminDelisted') : t('seller.listingRemoved')) : listing.status}"),
    
    # Listing actions
    ('<Pencil className="w-3 h-3 mr-1" />編輯', '<Pencil className="w-3 h-3 mr-1" />{t("common.edit")}'),
    ('<EyeOff className="w-3 h-3 mr-1" />下架', '<EyeOff className="w-3 h-3 mr-1" />{t("seller.delist")}'),
    ('<Eye className="w-3 h-3 mr-1" />重新上架', '<Eye className="w-3 h-3 mr-1" />{t("seller.relist")}'),
    
    # Stock label
    ('<span className="text-xs text-gray-500">庫存：<strong className={`${listing.quantity === 0 ? \'text-red-50',
     '<span className="text-xs text-gray-500">{t("seller.stockLabel")}：<strong className={`${listing.quantity === 0 ? \'text-red-50'),
    
    # Total listings
    ('共 {listings.length} 件商品', '{t("seller.totalListings", { count: listings.length })}'),
    
    # Offer accept/reject
    ("toast.success(vars.action === 'accept' ? '已接受出價' : '已拒絕出價');",
     "toast.success(vars.action === 'accept' ? t('seller.offerAccepted') : t('seller.offerRejected'));"),
    
    # CSV import
    ("if (lines.length < 2) { toast.error('CSV 至少需要一行標題和一行資料'); return; }",
     "if (lines.length < 2) { toast.error(t('seller.csvMinRows')); return; }"),
    
    # Bulk actions
    ("toast.success(`已下架 ${data.count} 件商品`);", "toast.success(t('seller.bulkDelistSuccess', { count: data.count }));"),
    ("toast.success(`已重新上架 ${data.count} 件商品！`);", "toast.success(t('seller.bulkRelistSuccess', { count: data.count }));"),
    
    # View product
    ('               查看商品 →', '               {t("seller.viewProduct")} →'),
    
    # Stripe toasts
    ('toast.info("請先在 Stripe Dashboard 開通 Connect 功能，完成後返回此頁面再設定。", { duration: 8000 });',
     'toast.info(t("seller.stripeConnectHint"), { duration: 8000 });'),
    ('toast.info("正在跳轉到 Stripe 設定頁面...");', 'toast.info(t("seller.redirectingToStripe"));'),
    ('toast.info("正在跳轉到 Stripe Express Dashboard...");', 'toast.info(t("seller.redirectingToStripeDashboard"));'),
    ("toast.error('請先完成 Stripe Connect 收款帳戶設定，才能上架商品');", "toast.error(t('seller.stripeConnectRequired'));"),
    
    # Shipping carriers
    ('{ value: "sf_express", label: "🚚 順豐速運（運費到付）"', '{ value: "sf_express", label: `🚚 ${t("seller.carrier.sfExpress")}`'),
    ('{ value: "hk_post", label: "📮 香港郵政（平郵）"', '{ value: "hk_post", label: `📮 ${t("seller.carrier.hkPost")}`'),
    
    # Mark shipped
    ('toast.success("已標記為已寄出，已通知買家");', 'toast.success(t("seller.markedShipped"));'),
    
    # Login prompt
    ('<p className="text-lg font-medium">請先登入</p>', '<p className="text-lg font-medium">{t("common.pleaseLogin")}</p>'),
    ('>登入<', '>{t("common.login")}<'),
    
    # Maintenance
    ('<h1 className="text-3xl font-bold text-white mb-3">市集正在維護中</h1>',
     '<h1 className="text-3xl font-bold text-white mb-3">{t("marketplace.maintenance")}</h1>'),
    ('<p className="text-white/70 mb-6">我們正在緊鑼密鼓地開發中，敬請期待！</p>',
     '<p className="text-white/70 mb-6">{t("marketplace.maintenanceDesc")}</p>'),
    
    # Seller center header
    ('<h1 className="text-base font-bold text-white leading-tight">賣家中心</h1>',
     '<h1 className="text-base font-bold text-white leading-tight">{t("seller.title")}</h1>'),
    ('<p className="text-white/60 text-xs">管理商品、訂單和收款</p>',
     '<p className="text-white/60 text-xs">{t("seller.subtitle")}</p>'),
    ('<h1 className="text-3xl font-bold text-white">賣家中心</h1>',
     '<h1 className="text-3xl font-bold text-white">{t("seller.title")}</h1>'),
    ('<p className="text-white/70 text-sm mt-1">管理你的商品、訂單和收款</p>',
     '<p className="text-white/70 text-sm mt-1">{t("seller.subtitle")}</p>'),
    
    # Become seller
    ('<h2 className="text-xl font-bold mb-2" style={{ color: "#06038d" }}>成為 BOXIUM 賣家</h2>',
     '<h2 className="text-xl font-bold mb-2" style={{ color: "#06038d" }}>{t("seller.becomeSellerTitle")}</h2>'),
    ('在 BOXIUM 平台上架你的 TCG 卡牌，觸及更多買家。平台收取 5% 服務費，款項透過 Stripe 自動轉帳到你的帳戶。',
     '{t("seller.becomeSellerDesc")}'),
    ('               申請成為賣家', '               {t("seller.applyToSell")}'),
    
    # Application status
    ('<p className="font-medium text-red-900">申請未獲批准</p>', '<p className="font-medium text-red-900">{t("seller.applicationRejected")}</p>'),
    ('<p className="text-sm text-red-700 mt-1">原因：{(sellerProfile as any).rejectReason}</p>',
     '<p className="text-sm text-red-700 mt-1">{t("seller.rejectReason")}：{(sellerProfile as any).rejectReason}</p>'),
    ('<p className="text-xs text-red-600 mt-2">如有疑問，請聯絡平台客服。</p>',
     '<p className="text-xs text-red-600 mt-2">{t("seller.contactSupport")}</p>'),
    ('<p className="font-medium text-amber-900">申請審批中</p>', '<p className="font-medium text-amber-900">{t("seller.applicationPending")}</p>'),
    ('<p className="text-sm text-amber-700">你的賣家申請正在審批，通常需要 1-3 個工作天。</p>',
     '<p className="text-sm text-amber-700">{t("seller.applicationPendingDesc")}</p>'),
    
    # Stripe setup
    ('<p className="text-sm text-blue-700">完成 <strong>Stripe Connect</strong> 設定後才能收取款項。平台將透過 <strong>St',
     '<p className="text-sm text-blue-700">{t("seller.stripeSetupDesc")} <strong>St'),
    ('{stripeMutation.isPending ? "處理中..." : "設定 Stripe 帳戶"}', '{stripeMutation.isPending ? t("common.processing") : t("seller.setupStripe")}'),
    ('<p className="font-medium text-amber-900">Stripe 帳戶驗證中</p>', '<p className="font-medium text-amber-900">{t("seller.stripeVerifying")}</p>'),
    ('<p className="text-sm text-amber-700">你的 Stripe Express 帳戶已連結，正在等待 Stripe 完成驗證。驗證完成後即可自動收款。</p>',
     '<p className="text-sm text-amber-700">{t("seller.stripeVerifyingDesc")}</p>'),
    ('{stripeMutation.isPending ? "處理中..." : "繼續完成驗證"}', '{stripeMutation.isPending ? t("common.processing") : t("seller.continueVerification")}'),
    ('<p className="font-medium text-yellow-900">Stripe 帳戶需要補充資料</p>', '<p className="font-medium text-yellow-900">{t("seller.stripeNeedsInfo")}</p>'),
    ('<p className="text-sm text-yellow-700">你的 Stripe Connect 帳戶尚未完成驗證，請繼續完成設定流程。</p>',
     '<p className="text-sm text-yellow-700">{t("seller.stripeNeedsInfoDesc")}</p>'),
    ('{stripeMutation.isPending ? "處理中..." : "繼續完成設定"}', '{stripeMutation.isPending ? t("common.processing") : t("seller.continueSetup")}'),
    ('{stripeMutation.isPending ? "處理中..." : "重新設定"}', '{stripeMutation.isPending ? t("common.processing") : t("seller.resetStripe")}'),
    ('{stripeLoginMutation.isPending ? "處理中..." : "管理收款帳戶"}', '{stripeLoginMutation.isPending ? t("common.processing") : t("seller.manageStripe")}'),
    
    # Rating
    ('<p className="text-[11px] text-gray-500 leading-tight">評分 ({sellerProfile?.ratingCount ?? 0} 則)</p>',
     '<p className="text-[11px] text-gray-500 leading-tight">{t("seller.rating", { count: sellerProfile?.ratingCount ?? 0 })}</p>'),
    
    # Nav tabs
    ('                   我的商品\n', '                   {t("seller.myProducts")}\n'),
    ('                   我的拍賣\n', '                   {t("seller.myAuctions")}\n'),
    ('                   訂單管理\n', '                   {t("seller.orderManagement")}\n'),
    ('                   買家出價\n', '                   {t("seller.buyerOffers")}\n'),
    ('                   收款記錄\n', '                   {t("seller.revenueRecord")}\n'),
    
    # Second promo (listing)
    ('<p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">賣家中心</p>',
     '<p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">{t("seller.title")}</p>'),
    ('<h3 className="text-white font-bold text-lg leading-tight">上架你的商品</h3>',
     '<h3 className="text-white font-bold text-lg leading-tight">{t("seller.listYourProduct")}</h3>'),
    ('<p className="text-white/60 text-xs mt-1">只需 3 個步驟，即可在 Boxium 開賣</p>',
     '<p className="text-white/60 text-xs mt-1">{t("seller.listPromoDesc")}</p>'),
    ("toast.error('請先完成 Stripe Connect 收款帳戶設定，才能上架商品');",
     "toast.error(t('seller.stripeConnectRequired'));"),
    ('                        上架新商品', '                        {t("seller.listNewProduct")}'),
    ("{ step: '1', title: '填寫商品資料', desc: '名稱、品相、系列' }", "{ step: '1', title: t('seller.listStep1Title'), desc: t('seller.listStep1Desc') }"),
    ("{ step: '2', title: '設定售價', desc: '定價或拍賣模式' }", "{ step: '2', title: t('seller.listStep2Title'), desc: t('seller.listStep2Desc') }"),
    ("{ step: '3', title: '確認上架', desc: '商品即時公開' }", "{ step: '3', title: t('seller.listStep3Title'), desc: t('seller.listStep3Desc') }"),
    
    # Listing tabs
    ("{ key: 'all' as const, label: '全部', count: myListings?.length ?? 0 }", "{ key: 'all' as const, label: t('seller.listingTab.all'), count: myListings?.length ?? 0 }"),
    ("{ key: 'active' as const, label: '上架中', count: myListings?.filter((l: any) => l.status === 'active')", "{ key: 'active' as const, label: t('seller.listingTab.active'), count: myListings?.filter((l: any) => l.status === 'active')"),
    ("{ key: 'sold' as const, label: '已售出', count: myListings?.filter((l: any) => l.status === 'sold').len", "{ key: 'sold' as const, label: t('seller.listingTab.sold'), count: myListings?.filter((l: any) => l.status === 'sold').len"),
    ("{ key: 'removed' as const, label: '已下架', count: myListings?.filter((l: any) => l.status === 'removed'", "{ key: 'removed' as const, label: t('seller.listingTab.removed'), count: myListings?.filter((l: any) => l.status === 'removed'"),
    
    # Instant buy price label
    ('<Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">即時購價 (HK$) <span className="text',
     '<Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.instantBuyPrice")} (HK$) <span className="text'),
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
