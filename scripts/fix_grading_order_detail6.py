path = "/home/ubuntu/boxium-ptcg/client/src/pages/GradingOrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Line 1863 - screenshot preview alt (second occurrence)
    ('alt="截圖預覽" className="mt-3 max-h-48', 'alt={t("grading.screenshotPreview")} className="mt-3 max-h-48'),
    # Line 1899-1901 - AI verify result labels
    ("'✅ AI 核對通過' :", 't("grading.aiVerifyPassed") :'),
    ("'⚠️ AI 核對小心' : '❌ AI 核對未通過'", 't("grading.aiVerifyWarning") : t("grading.aiVerifyFailed2")'),
    ("(可信度: {aiVerifyResult.confidence === 'high'", '({t("grading.confidence")}: {aiVerifyResult.confidence === \'high\''),
    # Line 1913 - amount
    ('>金額: HK${aiVerifyResult.detectedAmount}<', '>{t("grading.amount")}: HK${aiVerifyResult.detectedAmount}<'),
    # Line 1921 - order no
    ('>單號: {aiVerifyResult.detectedOrderNo}<', '>{t("grading.orderNoLabel")}: {aiVerifyResult.detectedOrderNo}<'),
    # Line 1933 - can still submit
    ('如確認付款已完成，仍可提交截圖由管理員手動核對。', '{t("grading.canStillSubmitForManualReview")}'),
    # Line 1978 - upload / submit
    ('{uploadingProof ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />上傳中...</> : "提交截圖"}', '{uploadingProof ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />{t("common.uploading")}</> : t("grading.submitScreenshot")}'),
    # Line 1989 - screenshot submitted
    ('<p className="font-bold text-green-800 mb-1">截圖已提交！</p>', '<p className="font-bold text-green-800 mb-1">{t("grading.screenshotSubmittedSuccess")}</p>'),
    # Line 1990 - admin will confirm (different text)
    ('<p className="text-sm text-green-700">管理員確認收款後，訂單將自動完成。如有查詢請聯絡 BOXIUM。</p>', '<p className="text-sm text-green-700">{t("grading.adminWillConfirmOrder")}</p>'),
    # Line 2001 - surcharge confirmed
    ('<p className="font-bold text-blue-800">差價已確認，等待 BOXIUM 寄回</p>', '<p className="font-bold text-blue-800">{t("grading.surchargePaidWaitingReturn")}</p>'),
    # Line 2004 - surcharge confirmed detail
    ('您的升級差價已確認收款，BOXIUM 正在安排將卡牌寄回至您的收貨地址。', '{t("grading.surchargePaidReturnNote")}'),
    # Line 2007 - SF COD note
    ('<span className="font-semibold">⚡ 順豐到付</span>：貨品將以順豐速遞到付方式寄回，請準備好運費。', '<span className="font-semibold">⚡ {t("grading.sfCOD")}</span>：{t("grading.sfCODNote")}'),
    # Line 2018 - BOXIUM shipped
    ('<p className="font-bold text-green-800">BOXIUM 已寄出，追蹤號碼</p>', '<p className="font-bold text-green-800">{t("grading.boxiumShipped")}</p>'),
    # Line 2021 - tracking note
    ('您的卡牌已由 BOXIUM 寄出，請使用以下追蹤號碼查詢包裹狀態。', '{t("grading.trackingNote")}'),
    # Line 2029 - tracking copied
    ('toast.success("追蹤號碼已複製");', 'toast.success(t("grading.trackingCopied"));'),
    # Line 2033 - copy button
    ('>複製<', '>{t("common.copy")}<'),
    # Line 2041 - SF query
    ('>順豐查詢<', '>{t("grading.sfQuery")}<'),
    # Line 2045 - SF COD note 2
    ('<p className="text-xs text-green-600 mt-2">⚡ 順豐速遞到付，請準備好運費收取包裹。</p>', '<p className="text-xs text-green-600 mt-2">⚡ {t("grading.sfCODPickupNote")}</p>'),
    # Line 2053 - customer address
    ('<span className="font-bold text-sm">客戶收貨地址</span>', '<span className="font-bold text-sm">{t("grading.customerAddress")}</span>'),
    # Line 2054 - after grading return note
    ('<span className="text-green-200 text-xs ml-1">（鑑定完成後，BOXIUM 將把卡牌寄回此地址）</span>', '<span className="text-green-200 text-xs ml-1">（{t("grading.afterGradingReturnNote")}）</span>'),
    # Line 2059 - recipient
    ('<span className="text-gray-500 text-xs">收件人</span>', '<span className="text-gray-500 text-xs">{t("grading.recipient")}</span>'),
    # Line 2063 - phone
    ('<span className="text-gray-500 text-xs">聯絡電話</span>', '<span className="text-gray-500 text-xs">{t("grading.phone")}</span>'),
    # Line 2068 - SF station
    ('<span className="text-gray-500 text-xs">順豐站</span>', '<span className="text-gray-500 text-xs">{t("grading.sfStation")}</span>'),
    # Line 2073 - address
    ('<span className="text-gray-500 text-xs">地址</span>', '<span className="text-gray-500 text-xs">{t("grading.address")}</span>'),
    # Line 2087 - card list
    ('<span className="font-bold text-gray-900 text-sm">卡牌清單（{submission.items.length} 張）</span>', '<span className="font-bold text-gray-900 text-sm">{t("grading.cardListWithCount", { count: submission.items.length })}</span>'),
    # Line 2144 - initial fee
    ('>初始代送費用<', '>{t("grading.initialFee")}<'),
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
