path = "/home/ubuntu/boxium-ptcg/client/src/components/TradeHistorySection.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('<h3 className="font-bold text-white">交換記錄詳情</h3>',
     '<h3 className="font-bold text-white">{t("tradeHistory.detailTitle")}</h3>'),
    
    ('<span className="text-sm font-semibold" style={{ color: BRAND_BLUE }}>換出卡牌</span>',
     '<span className="text-sm font-semibold" style={{ color: BRAND_BLUE }}>{t("tradeHistory.cardsOut")}</span>'),
    
    ('<span className="ml-auto text-xs font-medium text-gray-500">共 {outItems.length} 張</span>',
     '<span className="ml-auto text-xs font-medium text-gray-500">{t("tradeHistory.totalCards", { count: outItems.length })}</span>'),
    
    ('換出總估值：<span className="font-semibold text-gray-700">HKD {outTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>',
     '{t("tradeHistory.totalOutValue")}：<span className="font-semibold text-gray-700">HKD {outTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>'),
    
    ('<span className="text-sm font-semibold" style={{ color: BRAND_BLUE }}>換入卡牌</span>',
     '<span className="text-sm font-semibold" style={{ color: BRAND_BLUE }}>{t("tradeHistory.cardsIn")}</span>'),
    
    ('<span className="ml-auto text-xs font-medium text-gray-500">共 {inItems.length} 張</span>',
     '<span className="ml-auto text-xs font-medium text-gray-500">{t("tradeHistory.totalCards", { count: inItems.length })}</span>'),
    
    ('換入總估值：<span className="font-semibold text-gray-700">HKD {inTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>',
     '{t("tradeHistory.totalInValue")}：<span className="font-semibold text-gray-700">HKD {inTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>'),
    
    ('<span className="text-sm text-gray-600">補差金額</span>',
     '<span className="text-sm text-gray-600">{t("tradeHistory.cashDiff")}</span>'),
    
    ('<span className="text-sm text-white/80">換入 − 換出差值</span>',
     '<span className="text-sm text-white/80">{t("tradeHistory.cashDiffDesc")}</span>'),
    
    ('            刪除記錄',
     '            {t("tradeHistory.deleteRecord")}'),
    
    ('            關閉',
     '            {t("common.close")}'),
    
    ('toast.success("交換記錄已刪除");',
     'toast.success(t("tradeHistory.deleteSuccess"));'),
    
    ('toast.error(`刪除失敗：${e.message}`);',
     'toast.error(`${t("tradeHistory.deleteFailed")}：${e.message}`);'),
    
    ('if (!confirm("確定要刪除此交換記錄嗎？此操作無法復原，換入的卡牌將從收藏中移除，換出的卡牌將恢復為正常狀態。")) return;',
     'if (!confirm(t("tradeHistory.deleteConfirm"))) return;'),
    
    ('<p className="text-gray-500 font-medium">尚無交換記錄</p>',
     '<p className="text-gray-500 font-medium">{t("tradeHistory.noRecords")}</p>'),
    
    ('<p className="text-gray-400 text-sm mt-1">在收藏清單中點擊 ⇄ 按鈕開始記錄以卡換卡</p>',
     '<p className="text-gray-400 text-sm mt-1">{t("tradeHistory.noRecordsDesc")}</p>'),
    
    ('共 {trades.length} 筆交換記錄',
     '{t("tradeHistory.totalRecords", { count: trades.length })}'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"✓ Replaced: {old[:60]}...")
    else:
        print(f"✗ Not found: {old[:60]}...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
