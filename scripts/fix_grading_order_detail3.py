path = "/home/ubuntu/boxium-ptcg/client/src/pages/GradingOrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Address and print note
    ('<p className="text-sm text-amber-700">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>', '<p className="text-sm text-amber-700">{t("grading.boxiumAddressFull")}</p>'),
    ('⚠️ 請打印申請單連同卡牌一起寄出，否則無法處理您的申請', '⚠️ {t("grading.printSlipWarning")}'),
    ('打印申請單\n                  </Button>', '{t("grading.printSlip")}\n                  </Button>'),
    # Tracking number section
    ('📦 寄出後，請提交順豐追蹤號碼', '📦 {t("grading.submitTrackingAfterSend")}'),
    # Payment method labels
    ('>信用卡 / 扣帳卡<', '>{t("grading.creditDebitCard")}<'),
    ('>支付寶 HK<', '>{t("grading.alipayHK")}<'),
    ('>應付金額<', '>{t("grading.amountDue")}<'),
    ('>掃描支付寶 HK QR Code 付款<', '>{t("grading.scanAlipayQR")}<'),
    ('>或點擊連結付款：<', '>{t("grading.orClickLinkToPay")}<'),
    ('>付款金額<', '>{t("grading.paymentAmount")}<'),
    ('備注請填寫申請單號：{submission.orderNo}', '{t("grading.remarkFillOrderNo", { orderNo: submission.orderNo })}'),
    ('>AI 自動核對<', '>{t("grading.aiAutoVerify")}<'),
    ('完成付款後，請上傳支付寶 HK 付款成功截圖。系統將自動使用 AI 核對金額和單號。', '{t("grading.uploadAlipayScreenshot")}'),
    ('alt="截圖預覽"', 'alt={t("grading.screenshotPreview")}'),
    ('>AI 核對中...<', '>{t("grading.aiVerifying")}<'),
    ('>正在分析截圖內容，核對金額和單號<', '>{t("grading.aiAnalyzing")}<'),
    ("'✅ AI 核對通過' :", 't("grading.aiVerifyPassed") :'),
    ("'⚠️ AI 核對小心' : '❌ AI 核對未通過'", 't("grading.aiVerifyWarning") : t("grading.aiVerifyFailed2")'),
    ("(可信度: {aiVerifyResult.confidence === 'high'", '({t("grading.confidence")}: {aiVerifyResult.confidence === \'high\''),
    ('>金額: HK${aiVerifyResult.detectedAmount}<', '>{t("grading.amount")}: HK${aiVerifyResult.detectedAmount}<'),
    ('>單號: {aiVerifyResult.detectedOrderNo}<', '>{t("grading.orderNoLabel")}: {aiVerifyResult.detectedOrderNo}<'),
    ('如確認付款已完成，仍可提交截圖由管理員手動核對。', '{t("grading.canStillSubmitForManualReview")}'),
    ('>返回<', '>{t("common.back")}<'),
    ('>重新核對<', '>{t("grading.reVerify")}<'),
    ('{uploadingProof ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />上傳中...</> : "提交截圖"}', '{uploadingProof ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />{t("common.uploading")}</> : t("grading.submitScreenshot")}'),
    ('<p className="font-bold text-green-800 mb-1">截圖已提交！</p>', '<p className="font-bold text-green-800 mb-1">{t("grading.screenshotSubmittedSuccess")}</p>'),
    ('<p className="text-sm text-green-700">管理員確認收款後，申請將自動進入處理。如有查詢請聯絡 BOXIUM。</p>', '<p className="text-sm text-green-700">{t("grading.adminWillConfirm")}</p>'),
    ('>取消申請<', '>{t("grading.cancelApplication")}<'),
    ('>確定要取消此申請？<', '>{t("grading.confirmCancel")}<'),
    ('{cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認取消"}', '{cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("grading.confirmCancelBtn")}'),
    ('<p className="font-bold text-blue-800">支付寳 HK 截圖已提交，等待管理員確認</p>', '<p className="font-bold text-blue-800">{t("grading.alipayScreenshotPending")}</p>'),
    ('<p className="text-sm text-blue-700 mb-4">管理員將於 24 小時內確認收款，確認後申請將自動進入處理。</p>', '<p className="text-sm text-blue-700 mb-4">{t("grading.adminConfirmWithin24h")}</p>'),
    ('>已提交截圖：<', '>{t("grading.submittedScreenshot")}：<'),
    ('alt="付款截圖"', 'alt={t("grading.paymentScreenshot")}'),
    ("? 'AI 核對通過，等待管理員確認'", ': t("grading.aiPassedWaitAdmin")'),
    ("? 'AI 核對有警告，管理員將人工審核'", ': t("grading.aiWarningManualReview")'),
    (": 'AI 核對未通過，請確認截圖是否正確'}", ": t(\"grading.aiFailedCheckScreenshot\")}"),
    ('>AI 核對中，請稍候…<', '>{t("grading.aiVerifyingWait")}<'),
    ('<p className="font-bold text-red-800">截圖已被拒絕，請重新上傳</p>', '<p className="font-bold text-red-800">{t("grading.screenshotRejectedReupload")}</p>'),
    ('<p className="text-xs text-red-600">管理員尚未確認此截圖為有效付款証明</p>', '<p className="text-xs text-red-600">{t("grading.adminNotConfirmedProof")}</p>'),
    ('>拒絕原因：<', '>{t("grading.rejectionReason")}：<'),
    ('>被拒絕的截圖：<', '>{t("grading.rejectedScreenshot")}：<'),
    ('alt="被拒絕的截圖"', 'alt={t("grading.rejectedScreenshot")}'),
    ('<p className="text-sm font-bold text-red-800 mb-3">重新上傳付款截圖</p>', '<p className="text-sm font-bold text-red-800 mb-3">{t("grading.reuploadPaymentScreenshot")}</p>'),
    ('alt="新截圖"', 'alt={t("grading.newScreenshot")}'),
    ('>點擊選擇新截圖<', '>{t("grading.clickToSelectNewScreenshot")}<'),
    ('>支持 JPG、PNG 格式<', '>{t("grading.supportedFormats")}<'),
    ('>AI 核對中，請稍候…<', '>{t("grading.aiVerifyingWait")}<'),
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
