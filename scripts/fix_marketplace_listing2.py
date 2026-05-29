#!/usr/bin/env python3
import re

path = "client/src/pages/MarketplaceListing.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Line 163-168: PSA/BGS/TAG condition arrays - these are data keys, not UI text, keep as-is
    # but the formatter label "均價" needs fixing
    ('formatter={(value) => [`HKD ${Number(value ?? 0).toLocaleString()}`, "均價"] as [str',
     'formatter={(value) => [`HKD ${Number(value ?? 0).toLocaleString()}`, t("marketplaceListing.avgPrice")] as [str'),
    
    # Line 510: 前往付款
    ('>前往付款<',
     '>{t("marketplaceListing.goToPay")}<'),
    
    # Line 871: 已預留 badge
    ('className="bg-amber-50 text',
     'className="bg-amber-50 text'),  # skip - need context
    
    # Line 984: 查看主頁
    ('>查看主頁<',
     '>{t("marketplaceListing.viewHomepage")}<'),
    
    # Line 1076: 請先登入才能出價
    ('>請先登入才能出價<',
     '>{t("marketplaceListing.loginToBid")}<'),
    
    # Line 1086: 出價洽議
    ('/>出價洽議<',
     '/>{t("marketplaceListing.makeOffer")}<'),
    
    # Line 1121: WhatsApp 分享
    ('>WhatsApp 分享<',
     '>{t("marketplaceListing.whatsappShare")}<'),
    
    # Line 1240: 出價
    ('>出價<',
     '>{t("marketplaceListing.bid")}<'),
    
    # Line 1302: 複製編號
    ('>複製編號<',
     '>{t("marketplaceListing.copyNumber")}<'),
    
    # Line 1309: 我已完成付款，填寫收貨地址
    ('>我已完成付款，填寫收貨地址<',
     '>{t("marketplaceListing.completedPaymentFillAddress")}<'),
    
    # Line 1329: 清除地址 button
    ('onClick={() => { setAlipayShippingForm({ name: "", phone: "", address: "", d',
     'onClick={() => { setAlipayShippingForm({ name: "", phone: "", address: "", d'),  # skip - need context
    
    # Line 1397: region options
    ('{["香港島", "九龍", "新界"].map(r => <option key={r} value={r}>{r}</option>)}',
     '{[t("marketplaceListing.hkIsland"), t("marketplaceListing.kowloon"), t("marketplaceListing.newTerritories")].map(r => <option key={r} value={r}>{r}</option>)}'),
    
    # Line 1434: SF station placeholder
    ('placeholder="例：852Z351 或 H852001P"',
     'placeholder={t("marketplaceListing.sfStationPlaceholder")}'),
    
    # Line 1467-1470: region options in shipping form
    ('<option value="香港島">香港島</option>\n                        <option value="九龍">九龍</option>\n                        <option value="新界">新界</option>',
     '<option value={t("marketplaceListing.hkIsland")}>{t("marketplaceListing.hkIsland")}</option>\n                        <option value={t("marketplaceListing.kowloon")}>{t("marketplaceListing.kowloon")}</option>\n                        <option value={t("marketplaceListing.newTerritories")}>{t("marketplaceListing.newTerritories")}</option>'),
    
    # Line 1484: 下一步：上傳截圖
    ('>下一步：上傳截圖<',
     '>{t("marketplaceListing.nextUploadScreenshot")}<'),
    
    # Line 1536: 重新上傳截圖
    ('>重新上傳截圖<',
     '>{t("marketplaceListing.reuploadScreenshot")}<'),
    
    # Line 1575: region: "香港"
    ('region: "香港",',
     'region: t("marketplaceListing.hongkong"),'),
    
    # Line 1588: 處理中 button
    ('createAlipayOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-',
     'createAlipayOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-'),  # skip - need context
    
    # Line 1600: 核對收款說明
    ('>我們將在核對收款後確認你的訂單，通常需要 1-2 個工作天。<',
     '>{t("marketplaceListing.orderConfirmNote")}<'),
    
    # Line 1611: 填寫收貨地址 dialog title
    ('<VisuallyHidden><DialogTitle>填寫收貨地址</DialogTitle></VisuallyHidden>',
     '<VisuallyHidden><DialogTitle>{t("marketplaceListing.fillShippingAddress")}</DialogTitle></VisuallyHidden>'),
    
    # Line 1618: 填寫收貨地址 header
    ('"text-white font-bold text-lg">填寫收貨地址<',
     '"text-white font-bold text-lg">{t("marketplaceListing.fillShippingAddress")}<'),
    
    # Line 1635: 清除已選地址
    ('> 清除已選地址<',
     '> {t("marketplaceListing.clearSelectedAddress")}<'),
    
    # Line 1666: 聯絡電話 label
    ('htmlFor="ship-phone">聯絡電話 *<',
     'htmlFor="ship-phone">{t("marketplaceListing.contactPhone")}<'),
    
    # Line 1673: 詳細地址 label
    ('htmlFor="ship-address">詳細地址 *<',
     'htmlFor="ship-address">{t("marketplaceListing.detailedAddress")}<'),
    
    # Line 1684-1686: region options in shipping dialog
    ('<option value="香港島">香港島</option>\n                      <option value="九龍">九龍</option>\n                      <option value="新界">新界</option>',
     '<option value={t("marketplaceListing.hkIsland")}>{t("marketplaceListing.hkIsland")}</option>\n                      <option value={t("marketplaceListing.kowloon")}>{t("marketplaceListing.kowloon")}</option>\n                      <option value={t("marketplaceListing.newTerritories")}>{t("marketplaceListing.newTerritories")}</option>'),
    
    # Line 1697: SF type filter
    ("([['all', '全部'], ['station', '順豐站'], ['locker', '智能櫃']] as const).map(([val, labe",
     "([['all', t('marketplaceListing.all')], ['station', t('marketplaceListing.sfStation')], ['locker', t('marketplaceListing.locker')]] as const).map(([val, labe"),
    
    # Line 1708: 全部地區
    ('<option value="">全部地區</option>',
     '<option value="">{t("marketplaceListing.allRegions")}</option>'),
    
    # Line 1709: region options
    ('{["香港島", "九龍", "新界"].map(r => <option key={r} value={r}>{r}</option>)}',
     '{[t("marketplaceListing.hkIsland"), t("marketplaceListing.kowloon"), t("marketplaceListing.newTerritories")].map(r => <option key={r} value={r}>{r}</option>)}'),
    
    # Line 1739: 或手動輸入順豐站/智能櫃編號
    ('>或手動輸入順豐站/智能櫃編號<',
     '>{t("marketplaceListing.orManualSfCode")}<'),
    
    # Line 1783: region: "香港" (second occurrence)
    ('region: "香港",',
     'region: t("marketplaceListing.hongkong"),'),
    
    # Line 1900: 舉報商品 dialog title
    ('<VisuallyHidden><DialogTitle>舉報商品</DialogTitle></VisuallyHidden>',
     '<VisuallyHidden><DialogTitle>{t("marketplaceListing.reportListing")}</DialogTitle></VisuallyHidden>'),
    
    # Line 2018: 登入後加入購物車
    ('>登入後加入購物車<',
     '>{t("marketplaceListing.loginToAddCart")}<'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f"NOT FOUND: {repr(old[:60])}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} strings")
