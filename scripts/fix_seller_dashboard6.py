import re
path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Edit listing form
    ('placeholder="商品描述（可選）"', 'placeholder={t("seller.editListing.descPlaceholder")}'),
    ('<Label className="text-[#06038D] font-semibold">售價（HKD）</Label>', '<Label className="text-[#06038D] font-semibold">{t("seller.editListing.priceLabel")}</Label>'),
    ('<p className="text-xs text-gray-400 mb-1">最低 HKD 4.00</p>', '<p className="text-xs text-gray-400 mb-1">{t("seller.editListing.minPrice")}</p>'),
    ('<Label className="text-[#06038D] font-semibold">庫存數量</Label>', '<Label className="text-[#06038D] font-semibold">{t("seller.editListing.stockLabel")}</Label>'),
    ('<p className="text-xs text-gray-400 mb-1">最少 1 件</p>', '<p className="text-xs text-gray-400 mb-1">{t("seller.editListing.minStock")}</p>'),
    ('if (isNaN(price) || price < 4) { toast.error("售價不能低於 HKD 4.00"); return; }',
     'if (isNaN(price) || price < 4) { toast.error(t("seller.editListing.priceError")); return; }'),
    ('if (isNaN(quantity) || quantity < 1) { toast.error("庫存數量不能小於 1"); return; }',
     'if (isNaN(quantity) || quantity < 1) { toast.error(t("seller.editListing.stockError")); return; }'),
    ('               儲存更改\n', '               {t("seller.editListing.saveChanges")}\n'),
    
    # New listing dialog
    ('<VisuallyHidden><DialogTitle>上架新商品</DialogTitle></VisuallyHidden>',
     '<VisuallyHidden><DialogTitle>{t("seller.newListing.title")}</DialogTitle></VisuallyHidden>'),
    ('<h2 className="text-base font-bold text-white">上架新商品</h2>',
     '<h2 className="text-base font-bold text-white">{t("seller.newListing.title")}</h2>'),
    ('{ n: 1, label: "基本資料" }', '{ n: 1, label: t("seller.newListing.step1") }'),
    ('{ n: 2, label: "定價設定" }', '{ n: 2, label: t("seller.newListing.step2") }'),
    
    # Image upload required
    ('<p className="text-xs text-red-500 -mt-2">* 請至少上傳一張商品圖片（必填）</p>',
     '<p className="text-xs text-red-500 -mt-2">* {t("seller.newListing.imageRequired")}</p>'),
    
    # PSA price reference
    ('PSA 10 市場均價 HKD {parseFloat(St', 't("seller.psa10MarketPrice") + " HKD " + parseFloat(St'),
    
    # Click to search card
    ('                        點擊搜索並關聯卡牌', '                        {t("seller.newListing.clickToSearchCard")}'),
    
    # Product name min length
    ('<p className="text-xs text-red-500 mt-1">商品名稱至少需要 3 個字元</p>',
     '<p className="text-xs text-red-500 mt-1">{t("seller.newListing.titleMinLength")}</p>'),
    
    # Buy now / auction mode descriptions
    ('"買家直接以定價購買"', 't("seller.newListing.mode.buyNowDesc")'),
    ('"買家競價，時限結標"', 't("seller.newListing.mode.auctionDesc")'),
    
    # Price label in new listing
    ('<Label className="text-[#06038D] font-semibold">售價（HKD）*</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.priceLabel")}</Label>'),
    
    # Market price loading
    ('<p className="text-xs text-[#06038D]/50">查詢市場均價中...</p>',
     '<p className="text-xs text-[#06038D]/50">{t("seller.newListing.loadingMarketPrice")}</p>'),
    
    # PSA 10 market price reference
    ('? `PSA 10 市場均價（參考）：HKD ${conditionPriceData.avgPrice.toLocaleString()}`',
     '? `${t("seller.psa10MarketPriceRef")}：HKD ${conditionPriceData.avgPrice.toLocaleString()}`'),
    
    # Based on N transactions
    ('`(基於最近 ${conditionPriceData.recordCount} 筆成交)`',
     '`(${t("seller.basedOnRecords", { count: conditionPriceData.recordCount })})`'),
    ('<span className="text-[10px] text-[#06038D]/40">(基於最近 {conditionPriceData.recordCount} 筆成交)</s',
     '<span className="text-[10px] text-[#06038D]/40">({t("seller.basedOnRecords", { count: conditionPriceData.recordCount })})</s'),
    
    # No price data for this condition
    ('<span className="text-[10px] text-amber-600">此品相無成交記錄，顯示 PSA 10 作參考</span>',
     '<span className="text-[10px] text-amber-600">{t("seller.noConditionRecords")}</span>'),
    ('<p className="text-xs text-[#06038D]/40">此品相目前無市場均價資料</p>',
     '<p className="text-xs text-[#06038D]/40">{t("seller.noMarketPriceData")}</p>'),
    
    # Price too low warning
    ('<p className="text-xs text-red-400 mt-1">定價不能低於 HKD 4.00（Stripe 信用卡付款最低限額）</p>',
     '<p className="text-xs text-red-400 mt-1">{t("seller.priceTooLow")}</p>'),
    
    # Market price label
    ("const condLabel = conditionPriceData.isFallback ? 'PSA 10 市場均價' : '市場均價';",
     "const condLabel = conditionPriceData.isFallback ? t('seller.psa10MarketPrice') : t('seller.marketPrice');"),
    
    # Price comparison
    ('{diff > 0 ? `高於${condLabel} ${diff.toFixed(0)}%` : `低於${condLabel} ${Math.abs(diff).toFixed(0)}%',
     '{diff > 0 ? `${t("seller.aboveMarket", { label: condLabel, pct: diff.toFixed(0) })}` : `${t("seller.belowMarket", { label: condLabel, pct: Math.abs(diff).toFixed(0) })}'),
    
    # Admin fee exempt
    ('<span>管理員帳號（免平台費）</span>', '<span>{t("seller.adminFeeExempt")}</span>'),
    ('<span>預計平台費 HKD 0.00</span>', '<span>{t("seller.estimatedFee")} HKD 0.00</span>'),
    ('<span>預計實收</span>', '<span>{t("seller.estimatedReceive")}</span>'),
    
    # Fee tier
    ('{`適用第 ${tier} 級費率（${ratePercent}%）`}', '{t("seller.feeTier", { tier, rate: ratePercent })}'),
    ('{`預計平台費 -HKD ${fee.toFixed(2)}`}', '{t("seller.estimatedFeeAmount", { amount: fee.toFixed(2) })}'),
    
    # Market reference price
    ('<p className="text-xs font-semibold text-[#06038D] mb-1">📊 市場參考價</p>',
     '<p className="text-xs font-semibold text-[#06038D] mb-1">📊 {t("seller.marketRefPrice")}</p>'),
    
    # Auction fields
    ('<Label className="text-[#06038D] font-semibold">起標價（HKD）*</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.startingBid")}</Label>'),
    ('<Label className="text-[#06038D] font-semibold">底價（HKD，選填）</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.reservePrice")}</Label>'),
    ('<p className="text-[10px] text-[#06038D]/50 mb-1">競價須達底價才會成交，底價不公開顯示</p>',
     '<p className="text-[10px] text-[#06038D]/50 mb-1">{t("seller.newListing.reservePriceHint")}</p>'),
    ('<Label className="text-[#06038D] font-semibold">即買價（HKD，選填）</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.buyNowPrice")}</Label>'),
    ('<p className="text-[10px] text-[#06038D]/50 mb-1">買家可以此價直接結標購買</p>',
     '<p className="text-[10px] text-[#06038D]/50 mb-1">{t("seller.newListing.buyNowPriceHint")}</p>'),
    ('<Label className="text-[#06038D] font-semibold">最低加價幅度（HKD）</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.bidIncrement")}</Label>'),
    ('<Label className="text-[#06038D] font-semibold">拍賣天數 *</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.auctionDays")}</Label>'),
    ('{days} 日\n', '{days} {t("common.days")}\n'),
    ('<Label className="text-[#06038D] font-semibold">開始時間（24小時制，留空表示立即開始）</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.startTime")}</Label>'),
    ('<span className="text-xs font-semibold text-green-700">立即開始</span>',
     '<span className="text-xs font-semibold text-green-700">{t("seller.newListing.startNow")}</span>'),
    ('<span className="text-xs text-green-600">— 上架後立即開始拍賣</span>',
     '<span className="text-xs text-green-600">— {t("seller.newListing.startNowDesc")}</span>'),
    ('<span className="text-xs text-[#06038D]/60">預計結標時間：</span>',
     '<span className="text-xs text-[#06038D]/60">{t("seller.newListing.estimatedEndTime")}：</span>'),
    ('<span className="text-xs text-red-500 ml-1">⚠️ 結標時間已過去，請重新設定</span>',
     '<span className="text-xs text-red-500 ml-1">⚠️ {t("seller.newListing.endTimePast")}</span>'),
    
    # Accept offers
    ('<p className="text-xs text-[#06038D]/50">買家可提交低於定價的出價</p>',
     '<p className="text-xs text-[#06038D]/50">{t("seller.newListing.acceptOffersHint")}</p>'),
    ('<Label className="text-[#06038D] font-semibold">最低接受出價（HKD，選填）</Label>',
     '<Label className="text-[#06038D] font-semibold">{t("seller.newListing.minOffer")}</Label>'),
    
    # Image alt text
    ('alt={`圖片 ${i+1}`}', 'alt={`${t("seller.newListing.imageAlt")} ${i+1}`}'),
    
    # Preview labels
    ('<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">關聯卡牌</span>',
     '<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.associateCard")}</span>'),
    
    # Accept offers in preview
    ('{listingForm.acceptOffers ? `接受${listingForm.minOffer',
     '{listingForm.acceptOffers ? `${t("seller.newListing.acceptsOffers")}${listingForm.minOffer'),
    
    ('<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">上架模式</span>',
     '<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.listingMode")}</span>'),
    ('<span className="text-sm font-bold text-[#06038D]">🔨 拍賣</span>',
     '<span className="text-sm font-bold text-[#06038D]">🔨 {t("seller.newListing.mode.auction")}</span>'),
    ('<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">底價</span>',
     '<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.reservePrice")}</span>'),
    ('<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">即買價</span>',
     '<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.buyNowPrice")}</span>'),
    ('<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">加價幅度</span>',
     '<span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.bidIncrement")}</span>'),
    
    # Accept offers hint (second occurrence in preview)
    ('<p className="text-xs text-[#06038D]/50">買家可提交低於定價的出價</p>',
     '<p className="text-xs text-[#06038D]/50">{t("seller.newListing.acceptOffersHint")}</p>'),
    ('<Label className="text-[#06038D] font-semibold text-xs">最低接受出價（HKD，選填）</Label>',
     '<Label className="text-[#06038D] font-semibold text-xs">{t("seller.newListing.minOffer")}</Label>'),
    ('placeholder="留空表示不設下限"', 'placeholder={t("seller.newListing.minOfferPlaceholder")}'),
    
    # Listing confirmation
    ('<p className="font-medium">確認後直接公開上架</p>', '<p className="font-medium">{t("seller.newListing.confirmPublish")}</p>'),
    ('<p className="font-medium">提交後立即公開上架</p>', '<p className="font-medium">{t("seller.newListing.confirmPublishAuction")}</p>'),
    ('<p className="mt-0.5">商品提交後將自動公開，展示於市集中供買家瀏覽。</p>', '<p className="mt-0.5">{t("seller.newListing.publishDesc")}</p>'),
    
    # Terms agreement
    ('               我已閱讀並同意\n', '               {t("seller.newListing.agreeTerms")}\n'),
    ('>買賣條款</a>', '>{t("seller.newListing.termsLink")}</a>'),
    ('               ，包括平台服務費率、拍賣規則及退款政策。\n', '               {t("seller.newListing.termsDesc")}\n'),
    
    # Next step button
    ('               下一步\n', '               {t("common.nextStep")}\n'),
    
    # Shipping dialog
    ('<DialogTitle className="text-[#06038d] font-bold">填寫出貨資料</DialogTitle>',
     '<DialogTitle className="text-[#06038d] font-bold">{t("seller.shipping.title")}</DialogTitle>'),
    ('{shipDialog.orderNo && <p className="text-xs text-gray-500">訂單號：<span className="font-mono font-semibold tex',
     '{shipDialog.orderNo && <p className="text-xs text-gray-500">{t("seller.shipping.orderNo")}：<span className="font-mono font-semibold tex'),
    ('<p className="text-xs font-semibold text-[#06038d] mb-1">📦 買家收件資訊</p>',
     '<p className="text-xs font-semibold text-[#06038d] mb-1">📦 {t("seller.shipping.buyerInfo")}</p>'),
    ('<p className="text-xs text-gray-700">收件人：{shipDialog.shippingName}{shipDialog.shippingPhone ? ` · ${ship',
     '<p className="text-xs text-gray-700">{t("seller.recipient")}：{shipDialog.shippingName}{shipDialog.shippingPhone ? ` · ${ship'),
    ('<p className="text-xs text-gray-700">地址：{(() => {',
     '<p className="text-xs text-gray-700">{t("seller.address")}：{(() => {'),
    ('<p className="text-xs font-semibold text-[#06038d] mb-1">📦 送貨方式說明</p>',
     '<p className="text-xs font-semibold text-[#06038d] mb-1">📦 {t("seller.shipping.methodTitle")}</p>'),
    ('<p className="text-xs text-gray-700">本平台僅支援以下兩種送貨方式，<strong>不支援面交或門市自取</strong>：</p>',
     '<p className="text-xs text-gray-700">{t("seller.shipping.methodDesc")}</p>'),
    ('<li>🚚 <strong>順豐速運</strong>（運費到付）：買家收貨時支付運費，請填寫有效追蹤號碼</li>',
     '<li>🚚 <strong>{t("seller.shipping.sfExpress")}</strong>：{t("seller.shipping.sfExpressDesc")}</li>'),
    ('<li>📮 <strong>香港郵政（平郵）</strong>：訂單金額已包含 HK$10 郵費，平郵無追蹤號碼，追蹤號碼欄可留空</li>',
     '<li>📮 <strong>{t("seller.shipping.hkPost")}</strong>：{t("seller.shipping.hkPostDesc")}</li>'),
    ('<Label className="text-gray-800 font-medium">送貨方式 <span className="text-red-500">*</span></Label>',
     '<Label className="text-gray-800 font-medium">{t("seller.shipping.methodLabel")} <span className="text-red-500">*</span></Label>'),
    ('placeholder="選擇送貨方式"', 'placeholder={t("seller.shipping.selectMethod")}'),
    ('{shipForm.shippingMethod !== \'hk_post\' && <span classNam', '{shipForm.shippingMethod !== \'hk_post\' && <span classNam'),
    ('placeholder={shipForm.shippingMethod === \'hk_post\' ? \'平郵可留空（如有追蹤號可填入）\' : \'例：SF1234567890\'}',
     'placeholder={shipForm.shippingMethod === \'hk_post\' ? t(\'seller.shipping.hkPostTrackingPlaceholder\') : \'例：SF1234567890\'}'),
    ('                    點擊預覽追蹤連結\n', '                    {t("seller.shipping.previewTracking")}\n'),
    ('<Label className="text-gray-800 font-medium">出貨憑證圖片 <span className="text-red-500">*</span></Label>',
     '<Label className="text-gray-800 font-medium">{t("seller.shipping.proofLabel")} <span className="text-red-500">*</span></Label>'),
    ('<p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">⚠️ 必須上傳出貨',
     '<p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">⚠️ {t("seller.shipping.proofRequired")}'),
    ('alt="出貨憑證"', 'alt={t("seller.shipping.proofAlt")}'),
    ('<span className="text-xs font-medium">點擊上傳出貨照片</span>',
     '<span className="text-xs font-medium">{t("seller.shipping.uploadPhoto")}</span>'),
    ('<span className="text-xs text-gray-400">支援 JPG、PNG（最大 10MB）</span>',
     '<span className="text-xs text-gray-400">{t("seller.shipping.uploadHint")}</span>'),
    ('if (file.size > 10 * 1024 * 1024) { toast.error("圖片大小不能超過 10MB"); return; }',
     'if (file.size > 10 * 1024 * 1024) { toast.error(t("seller.shipping.fileSizeError")); return; }'),
    ('{markShippedMutation.isPending ? "處理中..." : "確認出貨"}',
     '{markShippedMutation.isPending ? t("common.processing") : t("seller.shipping.confirmShip")}'),
    
    # Delete listing dialog
    ('<span className="text-white font-black text-lg">確認刪除商品</span>',
     '<span className="text-white font-black text-lg">{t("seller.deleteListing.title")}</span>'),
    ('您即將永久刪除以下 <strong className="text-[#06038D]">{deletableListings.length} 件</strong>商品，此操作不可復原：',
     '{t("seller.deleteListing.desc", { count: deletableListings.length })}'),
    ("{l.title || '(未命名商品)'}", "{l.title || t('seller.deleteListing.unnamed')}"),
    ("{l.status === 'active' ? '上架中' : '已下架'}", "{l.status === 'active' ? t('seller.listingActive') : t('seller.listingRemoved')}"),
    ('<p className="text-xs text-[#06038D] font-bold mb-1">注意事項</p>',
     '<p className="text-xs text-[#06038D] font-bold mb-1">{t("seller.deleteListing.notes")}</p>'),
    ('<p>• 商品將從資料庫永久刪除</p>', '<p>• {t("seller.deleteListing.note1")}</p>'),
    ('<p>• 如有待付款訂單，將自動更新為已取消</p>', '<p>• {t("seller.deleteListing.note2")}</p>'),
    ('<p>• 已售出商品不會被刪除</p>', '<p>• {t("seller.deleteListing.note3")}</p>'),
    ('               取消\n', '               {t("common.cancel")}\n'),
    ('<><Loader2 className="w-4 h-4 mr-1 animate-spin" />刪除中...</>',
     '<><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("common.deleting")}</>'),
    
    # Auction terms dialog
    ('如需查看完整條款，請訪問 <Link href="/auction/terms" className="text-[#FEDD00] underline">拍賣條款頁面</Link>',
     '{t("seller.auctionTerms.fullTermsLink")} <Link href="/auction/terms" className="text-[#FEDD00] underline">{t("seller.auctionTerms.pageLink")}</Link>'),
    ('               取消\n', '               {t("common.cancel")}\n'),
    ('               我同意並繼續上架\n', '               {t("seller.auctionTerms.agreeAndList")}\n'),
    
    # Seller terms content
    ('<p className="font-bold text-[#FEDD00] text-xs mb-1">🏷️ 新賣家限制</p>',
     '<p className="font-bold text-[#FEDD00] text-xs mb-1">🏷️ {t("seller.auctionTerms.newSellerTitle")}</p>'),
    ('<p className="font-bold text-[#FEDD00] text-xs mb-1">⚠️ 違規處理</p>',
     '<p className="font-bold text-[#FEDD00] text-xs mb-1">⚠️ {t("seller.auctionTerms.violationTitle")}</p>'),
    ('<p className="font-bold text-[#FEDD00] text-xs mb-1">🤝 買賣雙方保障</p>',
     '<p className="font-bold text-[#FEDD00] text-xs mb-1">🤝 {t("seller.auctionTerms.protectionTitle")}</p>'),
    
    # Tracking label
    ('<Label className="text-gray-800 font-medium">追蹤號碼 {shipForm.shippingMethod !== \'hk_post\' && <span classNam',
     '<Label className="text-gray-800 font-medium">{t("seller.shipping.trackingLabel")} {shipForm.shippingMethod !== \'hk_post\' && <span classNam'),
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
