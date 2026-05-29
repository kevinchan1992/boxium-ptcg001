path = "/home/ubuntu/boxium-ptcg/client/src/pages/GradingOrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Line 1376 & 1278 - confirm cancel (still remaining)
    ('<span className="text-xs text-red-700 font-semibold">確定要取消此申請？</span>', '<span className="text-xs text-red-700 font-semibold">{t("grading.confirmCancel")}</span>'),
    # Line 1378 - confirm cancel button (still remaining)
    ('{cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認取消"}', '{cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("grading.confirmCancelBtn")}'),
    # Line 1608 - scan QR
    ('<p className="text-xs text-gray-500">掃描 QR code 或點擊連結完成付款</p>', '<p className="text-xs text-gray-500">{t("grading.scanQROrClickLink")}</p>'),
    # Line 1612 - upload screenshot note
    ('<p className="text-xs text-gray-500 mb-3">付款後請上傳截圖，管理員確認後補付將完成。</p>', '<p className="text-xs text-gray-500 mb-3">{t("grading.uploadScreenshotAfterPay")}</p>'),
    # Line 1620 - screenshot preview alt
    ('alt="截圖預覽" className="mt-3 max-h-', 'alt={t("grading.screenshotPreview")} className="mt-3 max-h-'),
    # Line 1638 - submit failed
    ("toast.error(e.message || '提交失敗');", "toast.error(e.message || t(\"grading.submitFailed\"));"),
    # Line 1646 - upload / submit screenshot
    ('{uploadingUpgradeProof ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />上傳中...</> : \'提交截圖\'}', '{uploadingUpgradeProof ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("common.uploading")}</> : t("grading.submitScreenshot")}'),
    # Line 1655 - surcharge screenshot submitted
    ('<p className="font-bold text-orange-800">補付截圖已提交！</p>', '<p className="font-bold text-orange-800">{t("grading.surchargeScreenshotSubmitted")}</p>'),
    # Line 1656 - admin will confirm
    ('<p className="text-sm text-orange-700 mt-1">管理員將於 24 小時內確認補付。</p>', '<p className="text-sm text-orange-700 mt-1">{t("grading.adminConfirmSurchargeWithin24h")}</p>'),
    # Line 1670-1673 - AI verify result
    ("? 'AI 核對通過，等待管理員確認'", ': t("grading.aiPassedWaitAdmin")'),
    ("? 'AI 核對有警告，管理員將人工審核'", ': t("grading.aiWarningManualReview")'),
    (": 'AI 核對未通過，請確認截圖是否正確'}", ": t(\"grading.aiFailedCheckScreenshot\")}"),
    # Line 1679 - AI verifying wait
    ('>AI 核對中，請稍候…<', '>{t("grading.aiVerifyingWait")}<'),
    # Line 1693 - grading complete pay now
    ('<p className="font-bold text-green-800">鑑定完成！請完成付款</p>', '<p className="font-bold text-green-800">{t("grading.gradingCompletePayNow")}</p>'),
    # Line 1725 - payment deadline warning
    ('⚠️ 請於 <strong>{new Date(submission.paymentDeadline).toLocaleDateString("zh-HK")}</strong> 前完成付款，逾期平台保留', '⚠️ {t("grading.payBeforeDeadline", { date: new Date(submission.paymentDeadline).toLocaleDateString() })}'),
    # Line 1733 - select payment method
    ('<p className="text-sm font-semibold text-black mb-2">選擇付款方式</p>', '<p className="text-sm font-semibold text-black mb-2">{t("grading.selectPaymentMethod")}</p>'),
    # Line 1763 - credit/debit card
    ('<span className="text-xs font-semibold text-black">信用卡 / 扣帳卡</span>', '<span className="text-xs font-semibold text-black">{t("grading.creditDebitCard")}</span>'),
    # Line 1785 - alipay HK
    ('<span className="text-xs font-semibold text-black">支付寶 HK</span>', '<span className="text-xs font-semibold text-black">{t("grading.alipayHK")}</span>'),
    # Line 1793 - amount due
    ('<p className="text-sm text-black">應付金額</p>', '<p className="text-sm text-black">{t("grading.amountDue")}</p>'),
    # Line 1823 - scan alipay QR
    ('<span className="font-bold text-black text-sm">掃描支付寶 HK QR Code 付款</span>', '<span className="font-bold text-black text-sm">{t("grading.scanAlipayQR")}</span>'),
    # Line 1830 - or click link
    ('<p className="text-xs text-gray-500 mt-2">或點擊連結付款：</p>', '<p className="text-xs text-gray-500 mt-2">{t("grading.orClickLinkToPay")}</p>'),
    # Line 1840 - payment amount
    ('<p className="text-xs font-bold text-black mb-1">付款金額</p>', '<p className="text-xs font-bold text-black mb-1">{t("grading.paymentAmount")}</p>'),
    # Line 1842 - remark order no
    ('備注請填寫申請單號：{submission.orderNo}', '{t("grading.remarkFillOrderNo", { orderNo: submission.orderNo })}'),
    # Line 1852 - AI auto verify
    ('<span className="text-xs text-[#06038d] font-semibold">AI 自動核對</span>', '<span className="text-xs text-[#06038d] font-semibold">{t("grading.aiAutoVerify")}</span>'),
    # Line 1855 - upload alipay screenshot
    ('<p className="text-xs text-gray-500 mb-3">完成付款後，請上傳支付寶 HK 付款成功截圖。系統將自動使用 AI 核對金額和單號。</p>', '<p className="text-xs text-gray-500 mb-3">{t("grading.uploadAlipayScreenshot")}</p>'),
    # Line 1871 - AI verifying
    ('<p className="text-xs font-semibold text-[#06038d]">AI 核對中...</p>', '<p className="text-xs font-semibold text-[#06038d]">{t("grading.aiVerifying")}</p>'),
    # Line 1872 - AI analyzing
    ('<p className="text-xs text-blue-600">正在分析截圖內容，核對金額和單號</p>', '<p className="text-xs text-blue-600">{t("grading.aiAnalyzing")}</p>'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"Replaced: {old[:60]}")
    else:
        print(f"NOT FOUND: {old[:60]}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! {count} replacements made")
