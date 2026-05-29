#!/usr/bin/env python3
"""Batch fix remaining hardcoded Chinese strings in critical non-admin pages."""
import re, json, os

BASE = '/home/ubuntu/boxium-ptcg'

def fix_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            count += 1
    with open(path, 'w') as f:
        f.write(content)
    print(f"Fixed {count}/{len(replacements)} in: {os.path.basename(path)}")

# ── About.tsx ────────────────────────────────────────────────────────────────
fix_file(f'{BASE}/client/src/pages/About.tsx', [
    ('關於 BOXIUM', '{t("about.title")}'),
    ('BOXIUM 是一個專為集換式卡牌（TCG）愛好者打造的市場格價平台', '{t("about.subtitle")}'),
    ('我們的使命', '{t("about.mission.title")}'),
    ('聯絡我們', '{t("about.contact.title")}'),
    ('返回首頁', '{t("common.backToHome")}'),
])

# ── SetBrowse.tsx ────────────────────────────────────────────────────────────
with open(f'{BASE}/client/src/pages/SetBrowse.tsx') as f:
    sb = f.read()

sb_replacements = [
    ('搜尋系列...', '{t("setBrowse.searchPlaceholder")}'),
    ('所有系列', '{t("setBrowse.allSeries")}'),
    ('沒有找到符合的系列', '{t("setBrowse.noResults")}'),
    ('載入中...', '{t("common.loading")}'),
    ('返回', '{t("common.back")}'),
    ('卡牌數量', '{t("setBrowse.cardCount")}'),
    ('張卡牌', '{t("setBrowse.cards")}'),
]
for old, new in sb_replacements:
    sb = sb.replace(old, new)
with open(f'{BASE}/client/src/pages/SetBrowse.tsx', 'w') as f:
    f.write(sb)
print(f"Fixed SetBrowse.tsx")

# ── PricingSearch.tsx ────────────────────────────────────────────────────────
with open(f'{BASE}/client/src/pages/PricingSearch.tsx') as f:
    ps = f.read()
ps_replacements = [
    ('搜尋卡牌...', '{t("pricingSearch.placeholder")}'),
    ('搜尋結果', '{t("pricingSearch.results")}'),
    ('找不到相符的卡牌', '{t("pricingSearch.noResults")}'),
    ('載入中...', '{t("common.loading")}'),
    ('查看詳情', '{t("common.viewDetails")}'),
    ('最新價格', '{t("pricingSearch.latestPrice")}'),
    ('無價格資料', '{t("pricingSearch.noPrice")}'),
]
for old, new in ps_replacements:
    ps = ps.replace(old, new)
with open(f'{BASE}/client/src/pages/PricingSearch.tsx', 'w') as f:
    f.write(ps)
print(f"Fixed PricingSearch.tsx")

# ── PricingDetail.tsx ────────────────────────────────────────────────────────
with open(f'{BASE}/client/src/pages/PricingDetail.tsx') as f:
    pd = f.read()
pd_replacements = [
    ('價格走勢', '{t("pricingDetail.priceTrend")}'),
    ('最高價', '{t("pricingDetail.highPrice")}'),
    ('最低價', '{t("pricingDetail.lowPrice")}'),
    ('平均價', '{t("pricingDetail.avgPrice")}'),
    ('成交記錄', '{t("pricingDetail.transactions")}'),
    ('暫無成交記錄', '{t("pricingDetail.noTransactions")}'),
    ('載入中...', '{t("common.loading")}'),
    ('返回搜尋', '{t("common.backToSearch")}'),
    ('加入收藏', '{t("common.addToWishlist")}'),
    ('已加入收藏', '{t("common.addedToWishlist")}'),
    ('日期', '{t("pricingDetail.date")}'),
    ('價格', '{t("pricingDetail.price")}'),
    ('來源', '{t("pricingDetail.source")}'),
    ('等級', '{t("pricingDetail.grade")}'),
]
for old, new in pd_replacements:
    pd = pd.replace(old, new)
with open(f'{BASE}/client/src/pages/PricingDetail.tsx', 'w') as f:
    f.write(pd)
print(f"Fixed PricingDetail.tsx")

# ── MarketplaceListing.tsx ───────────────────────────────────────────────────
with open(f'{BASE}/client/src/pages/MarketplaceListing.tsx') as f:
    ml = f.read()
ml_replacements = [
    ('加入購物車', '{t("common.addToCart")}'),
    ('立即購買', '{t("common.buyNow")}'),
    ('已售出', '{t("marketplace.sold")}'),
    ('庫存不足', '{t("marketplace.outOfStock")}'),
    ('賣家資訊', '{t("marketplace.sellerInfo")}'),
    ('商品描述', '{t("marketplace.description")}'),
    ('商品詳情', '{t("marketplace.details")}'),
    ('運費說明', '{t("marketplace.shippingInfo")}'),
    ('返回市集', '{t("common.backToMarket")}'),
    ('分享', '{t("common.share")}'),
    ('收藏', '{t("common.wishlist")}'),
    ('數量', '{t("marketplace.quantity")}'),
    ('小計', '{t("marketplace.subtotal")}'),
    ('確認購買', '{t("marketplace.confirmPurchase")}'),
    ('取消', '{t("common.cancel")}'),
    ('載入中...', '{t("common.loading")}'),
    ('找不到此商品', '{t("marketplace.notFound")}'),
    ('此商品已下架', '{t("marketplace.unlisted")}'),
    ('品相', '{t("marketplace.condition")}'),
    ('評價', '{t("marketplace.rating")}'),
    ('筆成交', '{t("marketplace.sales")}'),
]
for old, new in ml_replacements:
    ml = ml.replace(old, new)
with open(f'{BASE}/client/src/pages/MarketplaceListing.tsx', 'w') as f:
    f.write(ml)
print(f"Fixed MarketplaceListing.tsx")

# ── GradingSubmit.tsx ────────────────────────────────────────────────────────
with open(f'{BASE}/client/src/pages/GradingSubmit.tsx') as f:
    gs = f.read()
gs_replacements = [
    ('送評申請', '{t("grading.submitTitle")}'),
    ('提交送評', '{t("grading.submit")}'),
    ('提交中...', '{t("common.submitting")}'),
    ('取消', '{t("common.cancel")}'),
    ('上一步', '{t("common.prevStep")}'),
    ('下一步', '{t("common.nextStep")}'),
    ('確認提交', '{t("grading.confirmSubmit")}'),
    ('卡牌資訊', '{t("grading.cardInfo")}'),
    ('送評等級', '{t("grading.serviceLevel")}'),
    ('聯絡資訊', '{t("grading.contactInfo")}'),
    ('付款方式', '{t("grading.paymentMethod")}'),
    ('申請摘要', '{t("grading.summary")}'),
    ('選擇卡牌', '{t("grading.selectCard")}'),
    ('卡牌名稱', '{t("grading.cardName")}'),
    ('卡牌編號', '{t("grading.cardNumber")}'),
    ('卡牌系列', '{t("grading.cardSet")}'),
    ('數量', '{t("grading.quantity")}'),
    ('備註', '{t("grading.notes")}'),
    ('姓名', '{t("grading.name")}'),
    ('電話', '{t("grading.phone")}'),
    ('地址', '{t("grading.address")}'),
    ('送評費用', '{t("grading.fee")}'),
    ('合計', '{t("grading.total")}'),
    ('申請成功', '{t("grading.success")}'),
    ('申請失敗', '{t("grading.failed")}'),
]
for old, new in gs_replacements:
    gs = gs.replace(old, new)
with open(f'{BASE}/client/src/pages/GradingSubmit.tsx', 'w') as f:
    f.write(gs)
print(f"Fixed GradingSubmit.tsx")

# ── CardSelectionDialog.tsx ──────────────────────────────────────────────────
with open(f'{BASE}/client/src/components/CardSelectionDialog.tsx') as f:
    csd = f.read()
csd_replacements = [
    ('選擇卡牌', '{t("cardSelection.title")}'),
    ('搜尋卡牌...', '{t("cardSelection.searchPlaceholder")}'),
    ('找不到相符的卡牌', '{t("cardSelection.noResults")}'),
    ('取消', '{t("common.cancel")}'),
    ('確認', '{t("common.confirm")}'),
    ('載入中...', '{t("common.loading")}'),
    ('確認選擇', '{t("cardSelection.confirmSelect")}'),
    ('已選擇', '{t("cardSelection.selected")}'),
    ('清除', '{t("common.clear")}'),
]
for old, new in csd_replacements:
    csd = csd.replace(old, new)
with open(f'{BASE}/client/src/components/CardSelectionDialog.tsx', 'w') as f:
    f.write(csd)
print(f"Fixed CardSelectionDialog.tsx")

# ── TopicClusterView.tsx ─────────────────────────────────────────────────────
with open(f'{BASE}/client/src/components/TopicClusterView.tsx') as f:
    tcv = f.read()
tcv_replacements = [
    ('主題群組', '{t("topicCluster.title")}'),
    ('載入中...', '{t("common.loading")}'),
    ('找不到主題', '{t("topicCluster.notFound")}'),
    ('返回', '{t("common.back")}'),
    ('相關文章', '{t("topicCluster.relatedArticles")}'),
    ('查看全部', '{t("common.viewAll")}'),
    ('閱讀更多', '{t("common.readMore")}'),
]
for old, new in tcv_replacements:
    tcv = tcv.replace(old, new)
with open(f'{BASE}/client/src/components/TopicClusterView.tsx', 'w') as f:
    f.write(tcv)
print(f"Fixed TopicClusterView.tsx")

# ── DisputeMediaUpload.tsx ───────────────────────────────────────────────────
with open(f'{BASE}/client/src/components/DisputeMediaUpload.tsx') as f:
    dmu = f.read()
dmu_replacements = [
    ('上傳圖片', '{t("dispute.uploadImage")}'),
    ('上傳影片', '{t("dispute.uploadVideo")}'),
    ('上傳中...', '{t("common.uploading")}'),
    ('刪除', '{t("common.delete")}'),
    ('取消', '{t("common.cancel")}'),
    ('確認', '{t("common.confirm")}'),
    ('檔案過大', '{t("dispute.fileTooLarge")}'),
    ('不支援的檔案格式', '{t("dispute.unsupportedFormat")}'),
    ('最多上傳', '{t("dispute.maxFiles")}'),
    ('張圖片', '{t("dispute.images")}'),
    ('個影片', '{t("dispute.videos")}'),
]
for old, new in dmu_replacements:
    dmu = dmu.replace(old, new)
with open(f'{BASE}/client/src/components/DisputeMediaUpload.tsx', 'w') as f:
    f.write(dmu)
print(f"Fixed DisputeMediaUpload.tsx")

# ── BatchTaskProgressBar.tsx ─────────────────────────────────────────────────
with open(f'{BASE}/client/src/components/BatchTaskProgressBar.tsx') as f:
    btp = f.read()
btp_replacements = [
    ('處理中...', '{t("batch.processing")}'),
    ('已完成', '{t("batch.completed")}'),
    ('失敗', '{t("batch.failed")}'),
    ('取消', '{t("common.cancel")}'),
    ('批次任務進度', '{t("batch.title")}'),
    ('共', '{t("batch.total")}'),
    ('項', '{t("batch.items")}'),
    ('成功', '{t("batch.success")}'),
    ('錯誤', '{t("batch.error")}'),
]
for old, new in btp_replacements:
    btp = btp.replace(old, new)
with open(f'{BASE}/client/src/components/BatchTaskProgressBar.tsx', 'w') as f:
    f.write(btp)
print(f"Fixed BatchTaskProgressBar.tsx")

# ── CardPickerDialog.tsx ─────────────────────────────────────────────────────
with open(f'{BASE}/client/src/components/CardPickerDialog.tsx') as f:
    cpd = f.read()
cpd_replacements = [
    ('選擇卡牌', '{t("cardPicker.title")}'),
    ('搜尋卡牌...', '{t("cardPicker.searchPlaceholder")}'),
    ('找不到相符的卡牌', '{t("cardPicker.noResults")}'),
    ('取消', '{t("common.cancel")}'),
    ('確認', '{t("common.confirm")}'),
    ('載入中...', '{t("common.loading")}'),
    ('確認選擇', '{t("cardPicker.confirmSelect")}'),
]
for old, new in cpd_replacements:
    cpd = cpd.replace(old, new)
with open(f'{BASE}/client/src/components/CardPickerDialog.tsx', 'w') as f:
    f.write(cpd)
print(f"Fixed CardPickerDialog.tsx")

print("\nAll critical pages fixed!")
