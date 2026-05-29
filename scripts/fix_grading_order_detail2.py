import re

path = "/home/ubuntu/boxium-ptcg/client/src/pages/GradingOrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # 404 page
    ('<h2 className="text-xl font-bold text-gray-900 mb-2">找不到申請</h2>', '<h2 className="text-xl font-bold text-gray-900 mb-2">{t("grading.notFound")}</h2>'),
    ('>返回我的申請<', '>{t("grading.backToMyApplications")}<'),
    # Back button
    ('<span className="text-sm">返回我的申請</span>', '<span className="text-sm">{t("grading.backToMyApplications")}</span>'),
    # Print button
    ('>打印申請單<', '>{t("grading.printSlip")}<'),
    # Upgrade surcharge success
    ('<p className="font-bold text-green-800 text-base">升級差價補付成功！</p>', '<p className="font-bold text-green-800 text-base">{t("grading.upgradeSurchargeSuccess")}</p>'),
    ('<p className="text-sm text-green-600">申請單號：<span className="font-mono font-bold">{submission.orderNo}', '<p className="text-sm text-green-600">{t("grading.orderNo")}：<span className="font-mono font-bold">{submission.orderNo}'),
    ('<p className="text-sm font-bold text-gray-800 mb-2">補付摘要</p>', '<p className="text-sm font-bold text-gray-800 mb-2">{t("grading.surchargeSummary")}</p>'),
    ('<span className="text-gray-500">新服務層級：</span>', '<span className="text-gray-500">{t("grading.newTier")}：</span>'),
    ('{(submission as any).upgradeNewTierName ?? \'已升級\'}', '{(submission as any).upgradeNewTierName ?? t("grading.upgraded")}'),
    ('<span className="text-gray-500">補付差價：</span>', '<span className="text-gray-500">{t("grading.surchargeDiff")}：</span>'),
    ('<span className="text-gray-500">新總費用：</span>', '<span className="text-gray-500">{t("grading.newTotalFee")}：</span>'),
    ('<span className="text-gray-500">卡牌數量：</span>\n                    <span className="font-semibold text-gray-800">{submission.items.length} 張</span>', '<span className="text-gray-500">{t("grading.cardCount")}：</span>\n                    <span className="font-semibold text-gray-800">{t("grading.cardCountValue", { count: submission.items.length })}</span>'),
    # Payment success
    ('<p className="font-bold text-green-800 text-base">付款成功！申請已確認</p>', '<p className="font-bold text-green-800 text-base">{t("grading.paymentSuccess")}</p>'),
    ('<p className="text-sm font-bold text-gray-800 mb-2">申請摘要</p>', '<p className="text-sm font-bold text-gray-800 mb-2">{t("grading.applicationSummary")}</p>'),
    ('<span className="text-gray-500">卡牌數量：</span>\n                    <span className="font-semibold text-gray-800">{submission.items.length} 張</span>', '<span className="text-gray-500">{t("grading.cardCount")}：</span>\n                    <span className="font-semibold text-gray-800">{t("grading.cardCountValue", { count: submission.items.length })}</span>'),
    ('<span className="text-gray-500">服務層級：</span>', '<span className="text-gray-500">{t("grading.serviceTier")}：</span>'),
    ('<span className="text-gray-500">已付金額：</span>', '<span className="text-gray-500">{t("grading.amountPaid")}：</span>'),
    ('<span className="text-gray-500">申請日期：</span>', '<span className="text-gray-500">{t("grading.applicationDate")}：</span>'),
    # Next step
    ('<p className="text-sm font-bold text-amber-800 mb-1">📦 下一步：寄出您的卡牌</p>', '<p className="text-sm font-bold text-amber-800 mb-1">📦 {t("grading.nextStepSendCards")}</p>'),
    ('<p className="text-xs text-amber-700 mb-1">請打印申請單，連同卡牌一起寄至：</p>', '<p className="text-xs text-amber-700 mb-1">{t("grading.printAndSendTo")}</p>'),
    ('<p className="text-xs font-semibold text-amber-800">順豐站 852Z351 · BOXIUM · 55090102</p>', '<p className="text-xs font-semibold text-amber-800">SF Station 852Z351 · BOXIUM · 55090102</p>'),
    ('<p className="text-xs text-amber-700">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>', '<p className="text-xs text-amber-700">{t("grading.boxiumAddressFull")}</p>'),
    # Print button 2
    ('>立即打印申請單<', '>{t("grading.printSlipNow")}<'),
    # Order number label
    ('<p className="text-blue-200 text-xs mb-1">申請單號</p>', '<p className="text-blue-200 text-xs mb-1">{t("grading.applicationNo")}</p>'),
    # Status labels
    ('{isAlipayRejected ? "截圖被拒絕" : isAlipayPendingReview ? "截圖待審核" :', '{isAlipayRejected ? t("grading.screenshotRejected") : isAlipayPendingReview ? t("grading.screenshotPendingReview") :'),
    # Payment created
    ('<p className="font-bold text-green-800">申請已建立！請完成付款</p>', '<p className="font-bold text-green-800">{t("grading.applicationCreatedPayNow")}</p>'),
    ('<p className="text-sm text-green-700 mb-4">付款確認後申請將自動進入處理。</p>', '<p className="text-sm text-green-700 mb-4">{t("grading.paymentConfirmNote")}</p>'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"Replaced: {old[:60]}")
    else:
        print(f"NOT FOUND: {old[:60]}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
