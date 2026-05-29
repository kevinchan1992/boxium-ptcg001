path = "/home/ubuntu/boxium-ptcg/client/src/pages/OrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # PayOrderButton remaining
    ('<p className="text-gray-500 mt-1">請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致。</p>',
     '<p className="text-gray-500 mt-1">{t("orderDetail.uploadAlipayScreenshotHint")}</p>'),
    ('<Label>付款截圖 *</Label>', '<Label>{t("orderDetail.paymentScreenshot")} *</Label>'),
    ('alt="付款截圖"', 'alt={t("orderDetail.paymentScreenshotAlt")}'),
    # Tracking query link
    ('查詢<ExternalLink className="w-3 h-3" />', '{t("orderDetail.query")}<ExternalLink className="w-3 h-3" />'),
    # Auction payment limit
    ('{isAuctionOrder ? `拍賣付款限時 ${paymentTimeoutMinutes >=',
     '{isAuctionOrder ? `${t("orderDetail.auctionPayLimit")} ${paymentTimeoutMinutes >='),
    ("'逾時訂單將自動取消，商品重新上架拍賣' : '超時後訂單將自動取消，商品重新上架",
     "t('orderDetail.auctionAutoCancel') : t('orderDetail.autoCancel"),
    # Payout hold date
    ("`賣家將於 ${payoutHoldUntil.toLocaleString('zh-HK', { year: 'numeric', month: 'long', day: 'numeri",
     "`${t('orderDetail.sellerReceiveOn')} ${payoutHoldUntil.toLocaleString('zh-HK', { year: 'numeric', month: 'long', day: 'numeri"),
    # Confirm shipment button (duplicate)
    ('<Truck className="w-4 h-4 mr-1.5" />確認出貨', '<Truck className="w-4 h-4 mr-1.5" />{t("orderDetail.confirmShipment")}'),
    # Shipping proof lightbox alt
    ('alt="出貨憑證" isOpen={shippingProofLightbox}', 'alt={t("orderDetail.shippingProofAlt")} isOpen={shippingProofLightbox}'),
    # Alipay proof status
    ('⏱ 通常 <strong>1-2 個工作天</strong>內確認，請耐心等候。如有疑問請聯絡客服。',
     '{t("orderDetail.reviewTimeHint")}'),
    ('alt="付款截圖"', 'alt={t("orderDetail.paymentScreenshotAlt")}'),
    ('🔄 重新上傳截圖', '{t("orderDetail.reuploadScreenshotBtn")}'),
    ('<p className="text-xs text-amber-600">⚠️ 尚未上傳支付寶 HK 付款截圖</p>',
     '<p className="text-xs text-amber-600">{t("orderDetail.noAlipayScreenshot")}</p>'),
    ('📷 上傳付款截圖', '{t("orderDetail.uploadPaymentScreenshot")}'),
    # Order timestamps
    ('<p>訂單建立：{new Date(order.createdAt).toLocaleString("zh-HK")}</p>',
     '<p>{t("orderDetail.orderCreatedAt")}：{new Date(order.createdAt).toLocaleString("zh-HK")}</p>'),
    ('<p>最後更新：{new Date(order.updatedAt).toLocaleString("zh-HK")}</p>',
     '<p>{t("orderDetail.orderUpdatedAt")}：{new Date(order.updatedAt).toLocaleString("zh-HK")}</p>'),
    # Reupload dialog
    ('{reuploadVerifyResult?.verified ? "截圖已提交" : "上傳支付寶 HK 截圖"}',
     '{reuploadVerifyResult?.verified ? t("orderDetail.screenshotSubmitted") : t("orderDetail.uploadAlipayScreenshot")}'),
    ('<p className="text-xs text-white/70 mt-0.5">訂單 {order?.orderNo}</p>',
     '<p className="text-xs text-white/70 mt-0.5">{t("orderDetail.orderNo")} {order?.orderNo}</p>'),
    ('<p className="font-bold text-xl text-[#06038D]">截圖已提交！</p>',
     '<p className="font-bold text-xl text-[#06038D]">{t("orderDetail.screenshotSubmittedTitle")}</p>'),
    ('<p className="text-sm text-gray-500 mt-2">管理員核對收款後將確認你的訂單。</p>',
     '<p className="text-sm text-gray-500 mt-2">{t("orderDetail.adminWillConfirm")}</p>'),
    ('<span className="text-sm text-gray-500">需付金額</span>',
     '<span className="text-sm text-gray-500">{t("orderDetail.amountDue")}</span>'),
    ('<p className="text-xs text-gray-500 mt-2">請上傳支付寶 HK 付款成功截圖，截圖須清晰顯示金額、收款方及「成功」狀態。</p>',
     '<p className="text-xs text-gray-500 mt-2">{t("orderDetail.alipayScreenshotRequirements")}</p>'),
    ('<p className="text-sm font-semibold text-gray-700 mb-2">付款截圖 <span className="text-red-500">*</span></p>',
     '<p className="text-sm font-semibold text-gray-700 mb-2">{t("orderDetail.paymentScreenshot")} <span className="text-red-500">*</span></p>'),
    ('<p className="text-sm text-gray-500">上傳中，請稍候...</p>',
     '<p className="text-sm text-gray-500">{t("common.uploading")}...</p>'),
    ('<span>AI 正在驗證付款金額...</span>', '<span>{t("orderDetail.aiVerifying")}</span>'),
    ('驗證未通過，請檢查以下項目', '{t("orderDetail.verifyFailed")}'),
    ('{ ok: reuploadVerifyResult.payeeVerified, label: `收款方：${reuploadVerifyResult.detectedPay',
     '{ ok: reuploadVerifyResult.payeeVerified, label: `${t("orderDetail.payee")}：${reuploadVerifyResult.detectedPay'),
    ('{ ok: reuploadVerifyResult.amountVerified, label: `金額：${reuploadVerifyResult.currency ??',
     '{ ok: reuploadVerifyResult.amountVerified, label: `${t("orderDetail.amount")}：${reuploadVerifyResult.currency ??'),
    ('{ ok: reuploadVerifyResult.statusVerified, label: `狀態：${reuploadVerifyResult.detectedSta',
     '{ ok: reuploadVerifyResult.statusVerified, label: `${t("orderDetail.status")}：${reuploadVerifyResult.detectedSta'),
    ('🔄 重新選擇截圖', '{t("orderDetail.reselectScreenshot")}'),
    ('<p className="text-sm font-medium text-[#06038D]">點擊選擇截圖</p>',
     '<p className="text-sm font-medium text-[#06038D]">{t("orderDetail.clickToSelectScreenshot")}</p>'),
    ('<p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 5MB</p>',
     '<p className="text-xs text-gray-400 mt-1">{t("orderDetail.screenshotHint")}</p>'),
    ('>完成</', '>{t("common.done")}</'),
    ('>取消</', '>{t("common.cancel")}</'),
    # Cancel dialog
    ('<DialogTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" />取消訂',
     '<DialogTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" />{t("orderDetail.cancelOrder")}'),
    ('<p className="text-sm text-muted-foreground">確認要取消此訂單？取消後訂單將無法恢復。</p>',
     '<p className="text-sm text-muted-foreground">{t("orderDetail.cancelConfirmNote")}</p>'),
    # Dispute dialog
    ('<Flag className="w-5 h-5 text-red-500" />申請爭議', '<Flag className="w-5 h-5 text-red-500" />{t("orderDetail.applyDispute")}'),
    # Review dialog
    ('<Star className="w-5 h-5 text-yellow-400" />評價賣家', '<Star className="w-5 h-5 text-yellow-400" />{t("orderDetail.rateSeller")}'),
    # Submit buttons
    (': <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</>',
     ': <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("common.submitting")}</>'),
    # Shipping placeholder
    ('placeholder="例：SF1234567890"', 'placeholder={t("orderDetail.trackingPlaceholder")}'),
    # Shipping proof alt
    ('alt="出貨憑證" className="w-full max-h-40', 'alt={t("orderDetail.shippingProofAlt")} className="w-full max-h-40'),
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

print(f"Done! {count}/{len(replacements)} replacements made")
if not_found:
    print(f"\nNot found ({len(not_found)}):")
    for s in not_found[:15]:
        print(f"  ✗ {s}")
