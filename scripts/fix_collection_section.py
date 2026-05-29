#!/usr/bin/env python3
"""Fix hardcoded Chinese strings in CollectionSection.tsx"""

FILE = "/home/ubuntu/boxium-ptcg/client/src/components/CollectionSection.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # RAW grades - these are grade labels, replace with translation keys
    ('RAW: ["A品", "B品", "C品", "D品"],', 'RAW: ["RAW_A", "RAW_B", "RAW_C", "RAW_D"],'),
    
    # Toast messages
    ('toast.error("請先選擇卡牌")', 't("collection.selectCardFirst")'),
    ('toast.error("請選擇評級公司")', 't("collection.selectGraderFirst")'),
    ('toast.error("請選擇圖片")', 't("collection.selectImageFirst")'),
    ('toast.success(`已刪除 ${successCount} 筆收藏`)', 't("collection.deletedNItems", { count: successCount })'),
    
    # UI text - crop
    ('>裁剪</Button>', '>{t("collection.crop")}</Button>'),
    ('onClick={() => setShowCropView(false)} className="flex-1">取消裁剪</Button>', 'onClick={() => setShowCropView(false)} className="flex-1">{t("collection.cancelCrop")}</Button>'),
    
    # Tab labels
    ('>現有收藏</button>', '>{t("collection.currentCollection")}</button>'),
    ('>已換走</button>', '>{t("collection.traded")}</button>'),
    
    # Bulk mode
    ('{bulkMode ? \'取消\' : \'批量\'}', '{bulkMode ? t("common.cancel") : t("collection.bulk")}'),
    ('{isAllSelected ? \'取消全選\' : \'全選本頁\'}', '{isAllSelected ? t("collection.deselectAll") : t("collection.selectAllPage")}'),
    ('已選 {selectedIds.size} 筆', '{t("collection.selectedN", { n: selectedIds.size })}'),
    ('刪除 {selectedIds.size} 筆', '{t("collection.deleteN", { n: selectedIds.size })}'),
    
    # Sort order
    ('{sortOrder === "desc" ? "降序" : "升序"}', '{sortOrder === "desc" ? t("collection.descending") : t("collection.ascending")}'),
    
    # Empty states
    ('<p className="text-gray-600 font-semibold mb-2">尚無已換走的卡牌</p>', '<p className="text-gray-600 font-semibold mb-2">{t("collection.noTradedCards")}</p>'),
    ('<p className="text-sm text-gray-400 max-w-xs mx-auto">在收藏清單中點擊 ⇄ 按鈕開始記錄以卡換卡</p>', '<p className="text-sm text-gray-400 max-w-xs mx-auto">{t("collection.tradedCardHint")}</p>'),
    
    # Pagination
    ('第 {currentPage} / {totalPages} 頁 · 共 {totalItems} 筆', '{t("collection.pagination", { current: currentPage, total: totalPages, items: totalItems })}'),
    
    # Item labels
    ('<Eye className="w-3 h-3" />公開', '<Eye className="w-3 h-3" />{t("collection.public")}'),
    ('↔ 已換走 {new Date(item.tradedAt).toLocaleDateString(\'zh-HK\', { month: \'2-digit\', day: \'2-digit\' })}', '↔ {t("collection.tradedOn", { date: new Date(item.tradedAt).toLocaleDateString(undefined, { month: \'2-digit\', day: \'2-digit\' }) })}'),
    ('↔ 已換出', '↔ {t("collection.tradedOut")}'),
    ('{new Date(item.purchasedAt).toLocaleDateString(\'zh-HK\', { year: \'numeric\', month: \'2-digit\', day: \'2-digit\' })} 購入', '{t("collection.purchasedOn", { date: new Date(item.purchasedAt).toLocaleDateString(undefined, { year: \'numeric\', month: \'2-digit\', day: \'2-digit\' }) })}'),
    ('title="以卡換卡"', 'title={t("collection.tradeCard")}'),
    
    # Pagination buttons
    ('<ChevronDown className="w-3.5 h-3.5 rotate-90" />上一頁', '<ChevronDown className="w-3.5 h-3.5 rotate-90" />{t("common.prevPage")}'),
    ('下一頁<ChevronDown className="w-3.5 h-3.5 -rotate-90" />', '{t("common.nextPage")}<ChevronDown className="w-3.5 h-3.5 -rotate-90" />'),
    
    # Delete dialog
    ('<AlertDialogTitle className="text-gray-900 font-black">批量刪除確認</AlertDialogTitle>', '<AlertDialogTitle className="text-gray-900 font-black">{t("collection.bulkDeleteConfirm")}</AlertDialogTitle>'),
    ('確定要刪除已選的 <span className="font-black text-gray-900">{selectedIds.size} 筆</span> 收藏記錄？此操作無法復原。', '{t("collection.bulkDeleteWarning", { n: selectedIds.size })}'),
    ('>取消</AlertDialogCancel>', '>{t("common.cancel")}</AlertDialogCancel>'),
    ('? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />刪除中...</>', '? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />{t("collection.deleting")}</>'),
    (': `確定刪除 ${selectedIds.size} 筆`}', ': t("collection.confirmDeleteN", { n: selectedIds.size })}'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Replaced: {old[:60]}")
    else:
        print(f"  ✗ NOT FOUND: {old[:60]}")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal replacements: {count}")
