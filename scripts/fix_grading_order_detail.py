import re

path = "/home/ubuntu/boxium-ptcg/client/src/pages/GradingOrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # ReviewSection
    ('toast.success("感謝您的評價！");', 'toast.success(t("grading.reviewThanks"));'),
    ('toast.error(err.message || "提交評價失敗")', 'toast.error(err.message || t("grading.reviewSubmitFailed"))'),
    ('✅ 您已提交評價', '✅ {t("grading.reviewSubmitted")}'),
    ('⭐ 為本次鑑定服務評分', '⭐ {t("grading.rateService")}'),
    ('["", "很差", "差", "普通", "好", "非常好"][rating]', '["", t("grading.ratingVeryBad"), t("grading.ratingBad"), t("grading.ratingOk"), t("grading.ratingGood"), t("grading.ratingExcellent")][rating]'),
    ('placeholder="分享您的鑑定體驗（選填）"', 'placeholder={t("grading.reviewPlaceholder")}'),
    ('          公開顯示此評價\n        </label>', '          {t("grading.makePublic")}\n        </label>'),
    ('{submitReview.isPending ? "提交中..." : "提交評價"}', '{submitReview.isPending ? t("common.submitting") : t("grading.submitReview")}'),
    # Main component toasts
    ('toast.success("截圖已提交，等待管理員確認收款");', 'toast.success(t("grading.screenshotSubmitted"));'),
    ('toast.error(`提交失敗：${err.message}`)', 'toast.error(`${t("grading.submitFailed")}：${err.message}`)'),
    ('toast.success("申請已取消");', 'toast.success(t("grading.applicationCancelled"));'),
    ('toast.error(`取消失敗：${err.message}`)', 'toast.error(`${t("grading.cancelFailed")}：${err.message}`)'),
    ('toast.error(`AI 核對失敗：${err.message}`)', 'toast.error(`${t("grading.aiVerifyFailed")}：${err.message}`)'),
    ('toast.error("圖片壓縮失敗，請重試");', 'toast.error(t("grading.imageCompressFailed"));'),
    ('toast.success("截圖已重新提交，等待管理員再次確認");', 'toast.success(t("grading.screenshotResubmitted"));'),
    ('toast.error(`重新提交失敗：${err.message}`)', 'toast.error(`${t("grading.resubmitFailed")}：${err.message}`)'),
    ('toast.success("追蹤號碼已提交，管理員將確認收件");', 'toast.success(t("grading.trackingSubmitted"));'),
    ('toast.success("正在跳轉至付款頁面...");', 'toast.success(t("grading.redirectingToPayment"));'),
    ('toast.error(`付款失敗：${err.message}`)', 'toast.error(`${t("grading.paymentFailed")}：${err.message}`)'),
    ('toast.success("正在跳轉至補付差價頁面...");', 'toast.success(t("grading.redirectingToSurcharge"));'),
    ('toast.error(`重新付款失敗：${err.message}`)', 'toast.error(`${t("grading.repayFailed")}：${err.message}`)'),
    # PrintableSlip hardcoded Chinese
    ('>PSA 代客鑑定申請單<', '>{t("grading.psaApplicationTitle")}<'),
    ('>請將此申請單打印後連同卡牌一起寄出<', '>{t("grading.printAndSendNote")}<'),
    ('>共 {submission.items.length} 張卡牌<', '>{t("grading.totalCards", { count: submission.items.length })}<'),
    ('>送件地址（寄給 BOXIUM）<', '>{t("grading.sendToBoxiumAddress")}<'),
    ('>收件人：<', '>{t("grading.recipient")}：<'),
    ('>電話：<', '>{t("grading.phone")}：<'),
    ('>方式：<', '>{t("grading.method")}：<'),
    ('>地址：<', '>{t("grading.address")}：<'),
    ('>⚠️ 請連同申請單一起寄出<', '>{t("grading.sendWithSlip")}<'),
    ('>客戶收貨地址（鑑定後回寄）<', '>{t("grading.returnAddress")}<'),
    ('>未填寫收貨地址<', '>{t("grading.noReturnAddress")}<'),
    ('>卡牌名稱<', '>{t("grading.cardName")}<'),
    ('>重要事項<', '>{t("grading.importantNotes")}<'),
    ('<li>請使用有追蹤號碼的寄件方式，並自行購買保險。</li>', '<li>{t("grading.noteTracking")}</li>'),
    ('<li>卡片請妥善包裝，建議使用硬卡套及泡泡紙保護。</li>', '<li>{t("grading.notePackaging")}</li>'),
    ('<li>鑑定費用已於申請時預付，鑑定完成後無需額外付款。</li>', '<li>{t("grading.notePrepaid")}</li>'),
    ('<li>如有查詢，請透過平台訊息聯絡 BOXIUM。</li>', '<li>{t("grading.noteContact")}</li>'),
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
