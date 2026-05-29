with open('client/src/pages/GradingSubmit.tsx', encoding='utf-8') as f:
    lines = f.readlines()

# Line-based replacements (1-indexed)
line_replacements = {
    198: '                      {t("gradingSubmit.changeCard")}\n',
    666: '          toast.error(t("gradingSubmit.toast.selectSFStation"));\n',
    816: '                      <span>{t("gradingSubmit.draft.expiresWarning", { when: draftAgeDays >= 6.5 ? t("gradingSubmit.draft.tomorrow") : t("gradingSubmit.draft.withinOneDay") })}</span>\n',
    849: '                      <p className={`font-bold mb-0.5 ${isExpiringSoon ? \'text-orange-900\' : \'text-blue-900\'}`}>{t("gradingSubmit.draft.foundDraft")}\n',
    851: '                        {draftItemCount > 0 ? t("gradingSubmit.draft.cardCount", { types: draftItemCount, qty: draftTotalQty }) : t("gradingSubmit.draft.tierSelected")}\n',
    853: '                          <span className="ml-1">· {t("gradingSubmit.draft.selectedTier")}<strong>{draftTierName}</strong></span>\n',
    867: '                      {t("gradingSubmit.draft.continueDraft")}\n',
    875: '                      {t("gradingSubmit.draft.deleteDraft")}\n',
    1065: '                      {t("gradingSubmit.cardCountFeeNote", { count: items.reduce((sum, i) => sum + ((i as any).quantity ?? 1), 0) })}\n',
    1100: '                      <p className="font-bold mb-0.5">{t("gradingSubmit.noSavedAddress")}</p>\n',
    1101: '                      <p>{t("gradingSubmit.fillAddressOr")}\n',
    1122: '                      {t("gradingSubmit.savedAddresses")}\n',
    1134: '                      {t("gradingSubmit.enterNewAddress")}\n',
    1170: '                            <p className="text-xs text-gray-600 mt-0.5 truncate">{t("gradingSubmit.sfStationCode")} {addr.sfStationCode} · {addr.sfStationName}</p>\n',
    1185: '                      {t("gradingSubmit.useOtherAddress")}\n',
    1226: '                        <MapPin className="h-3.5 w-3.5" />{t("gradingSubmit.regularAddress")}\n',
    1237: '                        <Truck className="h-3.5 w-3.5" />{t("gradingSubmit.sfPickupStation")}\n',
    1249: '                            placeholder={t("gradingSubmit.addressPlaceholder")}\n',
    1259: '                              placeholder={t("gradingSubmit.districtPlaceholder")}\n',
    1268: '                              placeholder={t("gradingSubmit.cityPlaceholder")}\n',
    1285: '                            placeholder={t("gradingSubmit.sfStationPlaceholder")}\n',
    1313: '                                <p className="text-xs text-gray-500 text-center py-4">{t("gradingSubmit.noStationFound")}</p>\n',
}

# Handle multi-line replacements for label lines
label_replacements = {
    1196: '                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t("gradingSubmit.recipientName")} <span className="text-red-500">*</span></label>\n',
    1205: '                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t("gradingSubmit.phone")} <span className="text-red-500">*</span></label>\n',
    1245: '                          <label className="block text-xs font-semibold text-gray-700 mb-1">{t("gradingSubmit.detailedAddress")} <span className="text-red-500">*</span></label>\n',
    1255: '                            <label className="block text-xs font-semibold text-gray-700 mb-1">{t("gradingSubmit.district")}</label>\n',
    1264: '                            <label className="block text-xs font-semibold text-gray-700 mb-1">{t("gradingSubmit.city")}</label>\n',
    1279: '                        <label className="block text-xs font-semibold text-gray-700">{t("gradingSubmit.searchSFStation")} <span className="text-red-500">*</span></label>\n',
}

all_replacements = {**line_replacements, **label_replacements}

count = 0
for line_num, new_content in sorted(all_replacements.items()):
    idx = line_num - 1
    if idx < len(lines):
        lines[idx] = new_content
        count += 1

# Handle line 856 (contains dynamic text with isExpiringSoon)
idx = 856 - 1
if '· {formatDraf' in lines[idx] or '· {formatDraft' in lines[idx]:
    lines[idx] = '                          <span className={`ml-1 ${isExpiringSoon ? \'text-orange-500\' : \'text-blue-500\'}`}>· {formatDraftAge(draft.savedAt)}</span>\n'
    count += 1

# Handle success page lines
with open('client/src/pages/GradingSubmit.tsx', encoding='utf-8') as f:
    content = ''.join(lines)

# Fix remaining items
import re
replacements = [
    ('                   <p className="font-bold text-amber-800 text-sm">請立即完成付款，否則申請將無法進入處理流程</p>',
     '                   <p className="font-bold text-amber-800 text-sm">{t("gradingSubmit.success.payNow")}</p>'),
    ('                        儲存此地址到個人中心，方便下次使用',
     '                        {t("gradingSubmit.saveAddressToProfile")}'),
    ('                        ← 返回選擇已儲存地址',
     '                        {t("gradingSubmit.backToSavedAddresses")}'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f"NOT FOUND: {old[:60]}")

# Fix submittedData line
content = re.sub(
    r'共 \{submittedData\.cardCount\} 張卡牌 · 費用合計 (<span)',
    r'{t("gradingSubmit.success.cardCountFee", { count: submittedData.cardCount })} \1',
    content
)

with open('client/src/pages/GradingSubmit.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done! Applied {count} replacements")
