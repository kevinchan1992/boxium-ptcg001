import re

path = "client/src/pages/MarketplaceListing.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Image alt texts
    ('alt={`${title} - 圖片 ${activeIdx + 1}`}', 'alt={`${title} - ${t("marketplaceListing.image")} ${activeIdx + 1}`}'),
    ('<ZoomIn className="w-3 h-3" />點擊放大', '<ZoomIn className="w-3 h-3" />{t("marketplaceListing.clickToZoom")}'),
    ('alt={`縮圖 ${i + 1}`}', 'alt={`${t("marketplaceListing.thumbnail")} ${i + 1}`}'),
    # Condition labels
    ('psa8_below: ["PSA 8以下", "PSA8以下"]', 'psa8_below: [t("marketplaceListing.cond.psa8_below"), t("marketplaceListing.cond.psa8_below_short")]'),
    ('bgs8_below: ["BGS 9以下", "BGS9以下"]', 'bgs8_below: [t("marketplaceListing.cond.bgs8_below"), t("marketplaceListing.cond.bgs8_below_short")]'),
    ('tag9_below: ["ARS9", "ARS8以下"]', 'tag9_below: [t("marketplaceListing.cond.ars9"), t("marketplaceListing.cond.ars8_below")]'),
    # Price chart
    ('暫無 <span className="font-semibold">{conditionLabel}</span> 品相的交易數據，以下為所有品相的市場參考價', '{t("marketplaceListing.noConditionData")} <span className="font-semibold">{conditionLabel}</span> {t("marketplaceListing.showingAllConditions")}'),
    ('"持平"', 't("marketplaceListing.trendFlat")'),
    ('比市場均價{vsListing > 0 ? "低" : "高"} {Math.abs(vsListing).toFixed(1)}%', '{t("marketplaceListing.vsMarket")} {vsListing > 0 ? t("marketplaceListing.below") : t("marketplaceListing.above")} {Math.abs(vsListing).toFixed(1)}%'),
    ('{d}天', '{d}{t("common.days")}'),
    ('["均價"] as [string, string]', '[t("marketplaceListing.avgPrice")] as [string, string]'),
    ('數據來源：BOXIUM{isGradeFallback ? \' · 所有品相（參考）\' : condition && CONDITION_FULL[c', 't("marketplaceListing.dataSource") + (isGradeFallback ? t("marketplaceListing.allConditionsRef") : condition && CONDITION_FULL[c'),
    # Reviews
    ('{expanded ? "收起" : `查看全部 ${total} 則評價`}', '{expanded ? t("common.collapse") : t("marketplaceListing.viewAllReviews", { count: total })}'),
    ('同一賣家的其他商品', '{t("marketplaceListing.otherSellerItems")}'),
    # Payment
    ('onError: (e: any) => toast.error(e.message || "無法獲取付款連結")', 'onError: (e: any) => toast.error(e.message || t("marketplaceListing.cannotGetPaymentLink"))'),
    ('>前往付款<', '>{t("marketplaceListing.goToPayment")}<'),
    # Wishlist
    ('toast.success(res.wishlisted ? "已加入收藏" : "已移除收藏")', 'toast.success(res.wishlisted ? t("common.addedToWishlist") : t("common.removedFromWishlist"))'),
    # SEO description
    (': `商品狀況：${listing.condition} | 價格：HKD ${price.toFixed(2)} | BOXIUM TCG 卡牌商城`', ': `${t("marketplaceListing.seoCondition")}：${listing.condition} | ${t("marketplaceListing.seoPrice")}：HKD ${price.toFixed(2)} | BOXIUM TCG`'),
    # Verification
    ('onError: (e) => { setIsVerifying(false); toast.error("驗證失敗：" + e.message); }', 'onError: (e) => { setIsVerifying(false); toast.error(t("marketplaceListing.verifyFailed") + "：" + e.message); }'),
    ('if (!res.ok) throw new Error("上傳失敗")', 'if (!res.ok) throw new Error(t("marketplaceListing.uploadFailed"))'),
    # Seller type
    ('{listing.sellerType === "platform" ? "🏻 BOXIUM 官方" : "👤 個人賣家"}', '{listing.sellerType === "platform" ? t("marketplaceListing.officialSeller") : t("marketplaceListing.privateSeller")}'),
    # TCG series
    ('listing.tcgSeries === "mtg" ? "MTG" : "其他 TCG"}', 'listing.tcgSeries === "mtg" ? "MTG" : t("marketplaceListing.otherTCG")}'),
    # Reserved badge
    ('"bg-amber-50 text-amber-700 border-am', '"bg-amber-50 text-amber-700 border-am'),  # skip - already has translation
    # Quantity
    ('<p className="text-white/60 text-xs mt-1">庫存：{listing.quantity} 件</p>', '<p className="text-white/60 text-xs mt-1">{t("marketplaceListing.stock")}：{listing.quantity} {t("marketplaceListing.pieces")}</p>'),
    # Seller profile
    ('{sellerProfile.displayName || "個人賣家"}', '{sellerProfile.displayName || t("marketplaceListing.privateSeller")}'),
    ('<span>已售 {sellerProfile.totalSales} 件</span>', '<span>{t("marketplaceListing.totalSold", { count: sellerProfile.totalSales })}</span>'),
    ('>查看主頁<', '>{t("marketplaceListing.viewProfile")}<'),
    # Order status
    ('<p className="text-sm text-green-700 mt-1">訂單號：{completedOrderNo}</p>', '<p className="text-sm text-green-700 mt-1">{t("marketplaceListing.orderNo")}：{completedOrderNo}</p>'),
    ('<p className="text-amber-800 font-semibold">此商品正在爭議處理中</p>', '<p className="text-amber-800 font-semibold">{t("marketplaceListing.disputeInProgress")}</p>'),
    ('<p className="text-sm text-amber-700 mt-1">管理員正在處理相關爭議，商品暫時無法購買</p>', '<p className="text-sm text-amber-700 mt-1">{t("marketplaceListing.disputeDesc")}</p>'),
    # Login prompt
    ('<span>請先<Link href="/login" className="font-semibold underline mx-1">登入</Link>才能購買</span>', '<span>{t("marketplaceListing.loginToBuy1")}<Link href="/login" className="font-semibold underline mx-1">{t("common.login")}</Link>{t("marketplaceListing.loginToBuy2")}</span>'),
    # Offer
    ('<p className="font-bold text-green-800 text-base leading-tight">出價金額：HKD {effectivePrice.toFixed', '<p className="font-bold text-green-800 text-base leading-tight">{t("marketplaceListing.offerAmount")}：HKD {effectivePrice.toFixed'),
    ('<p className="text-xs text-gray-500">出價將於 {new Date(myPendingOffer.expiresAt).toLocaleString("zh-H', '<p className="text-xs text-gray-500">{t("marketplaceListing.offerExpires")} {new Date(myPendingOffer.expiresAt).toLocaleString('),
    ('<Tag className="w-4 h-4 mr-2" />出價洽議', '<Tag className="w-4 h-4 mr-2" />{t("marketplaceListing.makeOffer")}'),
    ('>請先登入才能出價<', '>{t("marketplaceListing.loginToOffer")}<'),
    # Share
    ('>WhatsApp 分享<', '>{t("marketplaceListing.shareWhatsApp")}<'),
    ('{copiedLink ? \'已複製！\' : \'複製連結\'}', '{copiedLink ? t("common.copied") : t("marketplaceListing.copyLink")}'),
    ('<Flag className="w-3.5 h-3.5" />舉報此商品', '<Flag className="w-3.5 h-3.5" />{t("marketplaceListing.reportItem")}'),
    # Order submitted
    ('<span>訂單已提交 #{completedOrderNo}</span>', '<span>{t("marketplaceListing.orderSubmitted")} #{completedOrderNo}</span>'),
    ('<span>爭議處理中，暫時無法購買</span>', '<span>{t("marketplaceListing.disputeNoBuy")}</span>'),
    ('>出價<', '>{t("marketplaceListing.offer")}<'),
    # Alipay payment
    ('付款金額：<span className="text-lg">HKD {effectivePrice.toFixed(2)}</span>', '{t("marketplaceListing.paymentAmount")}：<span className="text-lg">HKD {effectivePrice.toFixed(2)}</span>'),
    ('alt="支付寶 HK QR Code"', 'alt={t("marketplaceListing.alipayQR")}'),
    ('<Smartphone className="w-4 h-4" />在手機上開啟支付寶 HK', '<Smartphone className="w-4 h-4" />{t("marketplaceListing.openAlipayMobile")}'),
    ('>複製編號<', '>{t("common.copyCode")}<'),
    # Shipping form (alipay)
    ('<X className="w-3 h-3" /> 清除已選地址', '<X className="w-3 h-3" /> {t("common.clearAddress")}'),
    ('`順豐自提站 ${addr.sfStationCode}`', '`${t("profile.sfPickup")} ${addr.sfStationCode}`'),
    ('<Label>聯絡電話 *</Label>', '<Label>{t("profile.contactPhone")} *</Label>'),
    ('[\'all\', \'全部\'], [\'station\', \'順豐站\'], [\'locker\', \'智能櫃\']', '[\'all\', t("common.all")], [\'station\', t("profile.sfStation")], [\'locker\', t("profile.sfLocker")]'),
    ('<option value="">全部地區</option>', '<option value="">{t("profile.allRegions")}</option>'),
    ('{alipayShippingForm.sfStationName || "順豐自提站"}', '{alipayShippingForm.sfStationName || t("profile.sfPickup")}'),
    ('<Label className="text-xs text-gray-500">或手動輸入順豐站/智能櫃編號</Label>', '<Label className="text-xs text-gray-500">{t("profile.orEnterStationCode")}</Label>'),
    ("'✓ 有效智能櫃編號' : '✓ 有效順豐站編號", 't("marketplaceListing.validLocker") : t("marketplaceListing.validStation")'),
    ('<Label>詳細地址 *</Label>', '<Label>{t("marketplaceListing.detailedAddress")} *</Label>'),
    ('<Label>地區</Label>', '<Label>{t("marketplaceListing.district")}</Label>'),
    ('<Label>區域</Label>', '<Label>{t("marketplaceListing.region")}</Label>'),
    ('<p className="text-xs text-gray-400">* 必填欄位。如不需要寄送可跳過。</p>', '<p className="text-xs text-gray-400">{t("marketplaceListing.requiredFields")}</p>'),
    ('>下一步：上傳截圖<', '>{t("marketplaceListing.nextUploadScreenshot")}<'),
    ('<p className="font-bold text-[#06038D]">付款金額：HKD {price.toFixed(2)}</p>', '<p className="font-bold text-[#06038D]">{t("marketplaceListing.paymentAmount")}：HKD {price.toFixed(2)}</p>'),
    ('<p className="text-gray-500 mt-1">請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致。</p>', '<p className="text-gray-500 mt-1">{t("marketplaceListing.uploadAlipayScreenshotDesc")}</p>'),
    ('<Label>付款截圖 *</Label>', '<Label>{t("marketplaceListing.paymentScreenshot")} *</Label>'),
    ('<p className="text-sm">上傳中...</p>', '<p className="text-sm">{t("common.uploading")}...</p>'),
    ('alt="付款截圖"', 'alt={t("marketplaceListing.paymentScreenshot")}'),
    ('<span>AI 正在驗證付款金額...</span>', '<span>{t("marketplaceListing.aiVerifying")}</span>'),
    ('<><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">三項驗', '<><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">{t("marketplaceListing.allVerified")}'),
    ('<><XCircle className="w-4 h-4 text-orange-600" /><span className="text-orange-800">驗證未完全', '<><XCircle className="w-4 h-4 text-orange-600" /><span className="text-orange-800">{t("marketplaceListing.verifyIncomplete")}'),
    ('`收款方：${verifyResult.detectedPayee ?? "未識別"}${!ver', '`${t("marketplaceListing.payee")}：${verifyResult.detectedPayee ?? t("marketplaceListing.unrecognized")}${!ver'),
    ('`金額：${verifyResult.currency ?? "HKD"} ${verifyRe', '`${t("marketplaceListing.amount")}：${verifyResult.currency ?? "HKD"} ${verifyRe'),
    ('`狀態：${verifyResult.detectedStatus ?? "未識別"}${!ve', '`${t("marketplaceListing.status")}：${verifyResult.detectedStatus ?? t("marketplaceListing.unrecognized")}${!ve'),
    ('AI 信心度：{verifyResult.confidence === "high" ? "高" : verify', '{t("marketplaceListing.aiConfidence")}：{verifyResult.confidence === "high" ? t("marketplaceListing.high") : verify'),
    ('>重新上傳截圖<', '>{t("marketplaceListing.reuploadScreenshot")}<'),
    ('<p className="text-sm text-gray-500">點擊上傳截圖</p>', '<p className="text-sm text-gray-500">{t("marketplaceListing.clickToUpload")}</p>'),
    ('<p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 5MB</p>', '<p className="text-xs text-gray-400 mt-1">{t("marketplaceListing.supportedFormats")}</p>'),
    ('<p className="font-medium">⚠️ 如確認已付款，可繼續提交</p>', '<p className="font-medium">{t("marketplaceListing.confirmPaidWarning")}</p>'),
    ('<p className="mt-1">訂單將標記為「待人工核對」，管理員將在 1-2 個工作天內確認。</p>', '<p className="mt-1">{t("marketplaceListing.manualReviewNote")}</p>'),
    ('`順豐自提站 ${alipayShippingForm.sfStationCode}`', '`${t("profile.sfPickup")} ${alipayShippingForm.sfStationCode}`'),
    # Shipping form (stripe)
    ('<p className="text-xs text-gray-400">* 必填欄位。收貨地址將提供給賣家安排寄送。</p>', '<p className="text-xs text-gray-400">{t("marketplaceListing.requiredFieldsSeller")}</p>'),
    ('{shippingForm.sfStationName || "順豐自提站"}', '{shippingForm.sfStationName || t("profile.sfPickup")}'),
    ('`順豐自提站 ${shippingForm.sfStationCode}`', '`${t("profile.sfPickup")} ${shippingForm.sfStationCode}`'),
    ('{createStripeOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</> : <><C', '{createStripeOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("common.processing")}...</> : <><C'),
    # Offer dialog
    ('<p className="text-gray-500">市價</p>', '<p className="text-gray-500">{t("marketplaceListing.marketPrice")}</p>'),
    ('<p className="text-xs text-gray-500 mt-1">最低可出價：<span className="font-semibold text-[#06038D]">HKD {mi', '<p className="text-xs text-gray-500 mt-1">{t("marketplaceListing.minOffer")}：<span className="font-semibold text-[#06038D]">HKD {mi'),
    ('<Label className="text-sm font-medium mb-1.5 block text-[#06038D]">出價金額（HKD） *</Label>', '<Label className="text-sm font-medium mb-1.5 block text-[#06038D]">{t("marketplaceListing.offerAmountLabel")} *</Label>'),
    ('placeholder="請輸入出價金額"', 'placeholder={t("marketplaceListing.offerAmountPlaceholder")}'),
    ('出價金額不能低於定價的 70%（最低 HKD {minOfferPrice.toFixed(0)}）', '{t("marketplaceListing.offerMinWarning", { min: minOfferPrice.toFixed(0) })}'),
    ('<Label className="text-sm font-medium mb-1.5 block text-[#06038D]">留言（可選）</Label>', '<Label className="text-sm font-medium mb-1.5 block text-[#06038D]">{t("marketplaceListing.offerMessage")}</Label>'),
    ('placeholder="可以說明出價原因或其他要求..."', 'placeholder={t("marketplaceListing.offerMessagePlaceholder")}'),
    ('{makeOfferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "送出出價"}', '{makeOfferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("marketplaceListing.submitOffer")}'),
    # Report dialog
    ('<h2 className="text-white font-bold text-lg">舉報商品</h2>', '<h2 className="text-white font-bold text-lg">{t("marketplaceListing.reportItem")}</h2>'),
    ('<Label className="text-sm font-medium mb-1.5 block">舉報原因</Label>', '<Label className="text-sm font-medium mb-1.5 block">{t("marketplaceListing.reportReason")}</Label>'),
    ('<SelectValue placeholder="請選擇舉報原因" />', '<SelectValue placeholder={t("marketplaceListing.selectReportReason")} />'),
    ('<SelectItem value="fake_item">假貨 / 詐騙</SelectItem>', '<SelectItem value="fake_item">{t("marketplaceListing.reportFake")}</SelectItem>'),
    ('<SelectItem value="wrong_description">商品與描述不符</SelectItem>', '<SelectItem value="wrong_description">{t("marketplaceListing.reportWrongDesc")}</SelectItem>'),
    ('<SelectItem value="prohibited_item">禁售商品</SelectItem>', '<SelectItem value="prohibited_item">{t("marketplaceListing.reportProhibited")}</SelectItem>'),
    ('<SelectItem value="scam">詐騙行為</SelectItem>', '<SelectItem value="scam">{t("marketplaceListing.reportScam")}</SelectItem>'),
    ('<SelectItem value="other">其他</SelectItem>', '<SelectItem value="other">{t("common.other")}</SelectItem>'),
    ('<Label className="text-sm font-medium mb-1.5 block">詳細說明（可選）</Label>', '<Label className="text-sm font-medium mb-1.5 block">{t("marketplaceListing.reportDetails")}</Label>'),
    ('placeholder="請詳述舉報原因..."', 'placeholder={t("marketplaceListing.reportDetailsPlaceholder")}'),
    ('{reportListingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "提交舉報"}', '{reportListingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("marketplaceListing.submitReport")}'),
    # Cart
    ('toast.success("已加入購物車", {', 'toast.success(t("common.addedToCart"), {'),
    ('label: "查看購物車"', 'label: t("common.viewCart")'),
    ('const msg = err.message || "加入購物車失敗"', 'const msg = err.message || t("marketplaceListing.addToCartFailed")'),
    ('>登入後加入購物車<', '>{t("marketplaceListing.loginToCart")}<'),
    ('{isAcceptedOffer ? "已在購物車（待付款）" : "已在購物車"}', '{isAcceptedOffer ? t("marketplaceListing.inCartPending") : t("marketplaceListing.inCart")}'),
    ('{isAcceptedOffer ? "前往購物車付款" : "前往購物車"}', '{isAcceptedOffer ? t("marketplaceListing.goToCartPay") : t("common.viewCart")}'),
    ('{addToCartMutation.isPending ? "加入中..." : showSuccess ? "已加入✓" : isAcceptedOffer ? "加入購物車付款" : "加入購物車"}', '{addToCartMutation.isPending ? t("marketplaceListing.adding") : showSuccess ? t("marketplaceListing.added") : isAcceptedOffer ? t("marketplaceListing.addToCartPay") : t("common.addToCart")}'),
    # Ship district/region labels
    ('<Label htmlFor="ship-district">地區</Label>', '<Label htmlFor="ship-district">{t("marketplaceListing.district")}</Label>'),
    ('<Label htmlFor="ship-region">區域</Label>', '<Label htmlFor="ship-region">{t("marketplaceListing.region")}</Label>'),
    # Trend
    ('`${stats.trend === "flat" ? "持平" : `${stats.trendPct > 0 ? "+" : ""}${stats.trendPct.toFixed(1)}%`}`', '`${stats.trend === "flat" ? t("marketplaceListing.trendFlat") : `${stats.trendPct > 0 ? "+" : ""}${stats.trendPct.toFixed(1)}%`}`'),
    ('7天趨勢：{stats.trend === "flat" ? "持平" : `${stats.trendPct > 0 ? "+" : ""}${stats.trendPct.toFixed(1)}%`}', '{t("marketplaceListing.trend7d")}：{stats.trend === "flat" ? t("marketplaceListing.trendFlat") : `${stats.trendPct > 0 ? "+" : ""}${stats.trendPct.toFixed(1)}%`}'),
]

count = 0
not_found = []
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        not_found.append(old[:80])

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done! {count} replacements made")
if not_found:
    print(f"\nNOT FOUND ({len(not_found)}):")
    for s in not_found:
        print(f"  - {s}")
