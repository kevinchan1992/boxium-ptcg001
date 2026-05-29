path = "/home/ubuntu/boxium-ptcg/client/src/pages/GradingOrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Line 871 - order no label (duplicate)
    ('<p className="text-sm text-green-600">申請單號：<span className="font-mono font-bold">{submission.orderNo}', '<p className="text-sm text-green-600">{t("grading.orderNo")}：<span className="font-mono font-bold">{submission.orderNo}'),
    # Line 948 - payment method label
    ('<p className="text-sm font-semibold text-black mb-2">選擇付款方式</p>', '<p className="text-sm font-semibold text-black mb-2">{t("grading.selectPaymentMethod")}</p>'),
    # Line 1278 & 1376 - confirm cancel
    ('<span className="text-xs text-red-700 font-semibold">確定要取消此申請？</span>', '<span className="text-xs text-red-700 font-semibold">{t("grading.confirmCancel")}</span>'),
    # Line 1280 & 1378 - confirm cancel button
    ('{cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認取消"}', '{cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("grading.confirmCancelBtn")}'),
    # Line 1351 - resubmit AI result
    ("{resubmitAiResult.result === 'pass' ? 'AI 核對通過' : resubmitAiResult.result === 'warning' ?", "{resubmitAiResult.result === 'pass' ? t(\"grading.aiVerifyPassed\") : resubmitAiResult.result === 'warning' ?"),
    # Line 1362 - submitting
    ('<><Loader2 className="h-4 w-4 mr-2 animate-spin" />提交中…</>', '<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.submitting")}</>'),
    # Line 1364 - resubmit screenshot
    ('<>重新提交截圖</>', '<>{t("grading.resubmitScreenshot")}</>'),
    # Line 1427 - send address
    ('<p className="font-bold text-amber-800 mb-1">請將卡牌寄至以下地址</p>', '<p className="font-bold text-amber-800 mb-1">{t("grading.sendCardsToAddress")}</p>'),
    # Line 1428 - SF station
    ('<p className="text-sm text-amber-700 font-semibold">📦 順豐站 852Z351</p>', '<p className="text-sm text-amber-700 font-semibold">📦 SF Station 852Z351</p>'),
    # Line 1449 - tracking submitted
    ('<p className="text-xs text-green-700">已提交追蹤號碼</p>', '<p className="text-xs text-green-700">{t("grading.trackingSubmittedLabel")}</p>'),
    # Line 1459 - tracking placeholder
    ('placeholder="輸入順豐追蹤號碼（如：SF1234567890HK）"', 'placeholder={t("grading.trackingPlaceholder")}'),
    # Line 1472 - submit button
    ('{trackingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "提交"}', '{trackingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.submit")}'),
    # Line 1488 - tracking submitted success
    ('<p className="font-bold text-blue-800 mb-1">已提交順豐追蹤號碼，BOXIUM 正在等待收件</p>', '<p className="font-bold text-blue-800 mb-1">{t("grading.trackingSubmittedWaiting")}</p>'),
    # Line 1489 - auto update note
    ('<p className="text-sm text-blue-700 mb-2">收件後將自動更新狀態為「已收件」。</p>', '<p className="text-sm text-blue-700 mb-2">{t("grading.autoUpdateReceived")}</p>'),
    # Line 1491 - tracking number label
    ('<p className="text-xs text-blue-600">順豐追蹤號碼</p>', '<p className="text-xs text-blue-600">{t("grading.sfTrackingNumber")}</p>'),
    # Line 1501 - batch info
    ('<p className="font-bold text-purple-800 text-sm mb-1">出團批次資訊</p>', '<p className="font-bold text-purple-800 text-sm mb-1">{t("grading.batchInfo")}</p>'),
    # Line 1503 - batch name
    ("<p>批次：{(submission.batch as any).batchName ?? (submission.batch as any).name ?? '未知'}</p>", "<p>{t(\"grading.batchName\")}：{(submission.batch as any).batchName ?? (submission.batch as any).name ?? t(\"common.unknown\")}</p>"),
    # Line 1505 - shipped date
    ("<p>出團日期：{new Date((submission.batch as any).shippedDate ?? (submission.batch as any).shippedAt).toLoca", "<p>{t(\"grading.shippedDate\")}：{new Date((submission.batch as any).shippedDate ?? (submission.batch as any).shippedAt).toLoca"),
    # Line 1508 - expected return
    ("<p>預計回件：{new Date((submission.batch as any).expectedReturnDate ?? (submission.batch as any).estimatedR", "<p>{t(\"grading.expectedReturn\")}：{new Date((submission.batch as any).expectedReturnDate ?? (submission.batch as any).estimatedR"),
    # Line 1524 - screenshot rejected
    ('<p className="text-sm font-semibold text-red-700">截圖審核未通過，請重新上傳</p>', '<p className="text-sm font-semibold text-red-700">{t("grading.screenshotRejectedReupload")}</p>'),
    # Line 1525 - rejection reason
    ('<p className="text-xs text-red-600 mt-0.5">拒絕原因：{(submission as any).alipayProofRejectionReason}', '<p className="text-xs text-red-600 mt-0.5">{t("grading.rejectionReason")}：{(submission as any).alipayProofRejectionReason}'),
    # Line 1534 - upgrade notice
    ('<p className="font-bold text-orange-800 mb-1">服務層級已升級，請補付差價</p>', '<p className="font-bold text-orange-800 mb-1">{t("grading.upgradedPaySurcharge")}</p>'),
    # Line 1536-1537 - upgrade details
    ('您的申請已升級至 <strong>{(submission as any).upgradeNewTierName ?? \'新層級\'}</strong>，\n                         需補付差價 <strong className="text-orange-900">HK${parseFloat((submission as any).upgradeDiffFeeHkd |', 't("grading.upgradedToTier", { tier: (submission as any).upgradeNewTierName ?? t("grading.newTier") })}\n                       </p>\n                       <p className="text-sm text-orange-700">{t("grading.surchargeDiffAmount")}: <strong className="text-orange-900">HK${parseFloat((submission as any).upgradeDiffFeeHkd |'),
    # Line 1539 - new total fee
    ('<p className="text-xs text-orange-600">新總費用：HK${parseFloat(submission.totalFeeHkd).toLocaleString(', '<p className="text-xs text-orange-600">{t("grading.newTotalFee")}：HK${parseFloat(submission.totalFeeHkd).toLocaleString('),
    # Line 1544 - select payment method
    ('<p className="text-xs font-semibold text-orange-800 mb-2">選擇補付方式</p>', '<p className="text-xs font-semibold text-orange-800 mb-2">{t("grading.selectSurchargeMethod")}</p>'),
    # Line 1551 - credit card
    ('<span className="text-xs font-semibold text-orange-900">信用卡 / Stripe</span>', '<span className="text-xs font-semibold text-orange-900">{t("grading.creditCardStripe")}</span>'),
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
