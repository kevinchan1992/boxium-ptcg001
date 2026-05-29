filepath = "/home/ubuntu/boxium-ptcg/client/src/components/TradeSheet.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add useTranslation import
content = content.replace(
    'import { useState, useCallback, useEffect, useRef } from "react";',
    'import { useState, useCallback, useEffect, useRef } from "react";\nimport { useTranslation } from "react-i18next";'
)

# Add const { t } = useTranslation(); inside TradeSheet function
# Find the function body start
content = content.replace(
    'export function TradeSheet(',
    'export function TradeSheet('
)
# Find the first useState after the function declaration
old_hook = 'export function TradeSheet({'
# Find position and insert t hook
idx = content.find('export function TradeSheet(')
# Find the first const inside the function
brace_pos = content.find('{', idx)
# Insert after the opening brace
insert_pos = brace_pos + 1
content = content[:insert_pos] + '\n  const { t } = useTranslation();' + content[insert_pos:]

replacements = [
    # TradeCardSlot labels
    ('>換出卡牌</span>', '>{t("trade.outCards")}</span>'),
    ('>換入卡牌</span>', '>{t("trade.inCards")}</span>'),
    ('/>從收藏選\n', '/>{t("trade.fromCollection")}\n'),
    ('title="拍照識別"', 'title={t("trade.cameraIdentify")}'),
    ('>拍照</span>', '>{t("trade.photo")}</span>'),
    ('>搜尋換入卡</span>', '>{t("trade.searchIn")}</span>'),
    ('>搜尋</span>', '>{t("trade.search")}</span>'),
    ('點擊「從收藏選」或「搜尋」加入換出卡牌', '{t("trade.addOutHint")}'),
    ('搜尋並加入換入的新卡牌（將自動加入收藏）', '{t("trade.addInHint")}'),
    # Total value
    ('>換出</span>', '>{t("trade.out")}</span>'),
    ('>換入</span>', '>{t("trade.in")}</span>'),
    # Add more
    ('>再加一張</span>', '>{t("trade.addMore")}</span>'),
    # Trade history
    ('>以卡換卡記錄</span>', '>{t("trade.historyTitle")}</span>'),
    ('>交換日期</span>', '>{t("trade.date")}</span>'),
    # Cash adjustment
    ('補差金額（選填）', '{t("trade.cashAdj")}'),
    ('placeholder="正數=收到 負數=付出"', 'placeholder={t("trade.cashAdjPlaceholder")}'),
    ('>正數 = 對方補差給你，負數 = 你補差給對方</p>', '>{t("trade.cashAdjHint")}</p>'),
    ('備註（選填）', '{t("trade.notes")}'),
    ('placeholder="交換地點、備忘..."', 'placeholder={t("trade.notesPlaceholder")}'),
    # Validation
    ('>請加入至少一張換出卡牌和一張換入卡牌</p>', '>{t("trade.validationError")}</p>'),
    # Buttons
    ('>確認記錄交換</span>', '>{t("trade.confirm")}</span>'),
    # Card detail dialog
    ('設定換出卡牌資料', '{t("trade.setOutCardData")}'),
    ('設定換入卡牌資料', '{t("trade.setInCardData")}'),
    # Grading
    ('>評級機構</Label>', '>{t("trade.grader")}</Label>'),
    ('>RAW（未評級）</SelectItem>', '>{t("trade.raw")}</SelectItem>'),
    ('>評級</Label>', '>{t("trade.grade")}</Label>'),
    ('>數量</Label>', '>{t("trade.quantity")}</Label>'),
    ('>估值 HKD</Label>', '>{t("trade.valuation")}</Label>'),
    ('>查詢市場價中...</span>', '>{t("trade.fetchingPrice")}</span>'),
    ('>市場參考價</span>', '>{t("trade.marketRef")}</span>'),
    ('placeholder="輸入估值"', 'placeholder={t("trade.valuationPlaceholder")}'),
    # Add to list button
    ('加入換出清單', '{t("trade.addToOutList")}'),
    ('加入換入清單', '{t("trade.addToInList")}'),
    # Collection picker
    ('>從收藏選擇換出卡牌</span>', '>{t("trade.pickFromCollection")}</span>'),
    ('>載入收藏中...</span>', '>{t("trade.loadingCollection")}</span>'),
    ('>收藏清單為空</div>', '>{t("trade.emptyCollection")}</div>'),
    # Already traded
    ('↔ 已換出', '{t("trade.alreadyTraded")}'),
    # Toast messages
    ('toast.success("交換記錄已儲存，換入卡牌已加入收藏！")', 'toast.success(t("trade.savedSuccess"))'),
    ('`儲存失敗：${e.message}`', 't("trade.saveFailed", { msg: e.message })'),
    ('`已加入${pendingDirection === \'out\' ? \'換出\' : \'換入\'}清單：${pendingCard.name}`',
     't("trade.addedToList", { dir: pendingDirection === "out" ? t("trade.out") : t("trade.in"), name: pendingCard.name })'),
    ('"此卡牌已加入換出清單"', 't("trade.alreadyInOutList")'),
    # Saving state
    ('>儲存中...</>', '>{t("trade.saving")}</>'),
    # Estimate label
    ('>估値 HKD</span>', '>{t("trade.estimateHKD")}</span>'),
    # Cash adjustment display
    ('+ "" : ""}{formatCurrency(cashAdj)} 補差', '+ "" : ""}{formatCurrency(cashAdj)} {t("trade.cashDiff")}'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"✓ {old[:50]}...")
    else:
        print(f"✗ NOT FOUND: {old[:50]}...")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! {count}/{len(replacements)} replacements made.")
