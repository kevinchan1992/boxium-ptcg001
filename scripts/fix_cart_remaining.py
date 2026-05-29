#!/usr/bin/env python3
"""Fix remaining hardcoded Chinese in Cart.tsx"""
import re

path = 'client/src/pages/Cart.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Line 54 - comment, skip
    # Line 65 - comment, skip
    # Line 714
    ("付款時限剩餘：{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}",
     "{t('cart.paymentTimeLeft', { hours: String(timeLeft.hours).padStart(2, '0'), minutes: String(timeLeft.minutes).padStart(2, '0'), seconds: String(timeLeft.seconds).padStart(2, '0') })}"),
    # Line 721
    ('<span className="text-xs text-red-700 font-semibold">付款時限已到，訂單即將自動取消</span>',
     '<span className="text-xs text-red-700 font-semibold">{t(\'cart.paymentExpired\')}</span>'),
    # Line 744
    ('{isActive && <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0">使用中</Badge>}',
     '{isActive && <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0">{t(\'cart.inUse\')}</Badge>}'),
    # Line 744 - auction badge
    ('<Trophy className="w-2.5 h-2.5 mr-1" />拍賣得標',
     '<Trophy className="w-2.5 h-2.5 mr-1" />{t(\'cart.auctionWon\')}'),
    # Line 750
    ('<p className="text-xs text-gray-400 mt-1">訂單 #{order.orderNo}</p>',
     '<p className="text-xs text-gray-400 mt-1">{t(\'cart.orderNo\', { no: order.orderNo })}</p>'),
    # Line 763
    ('<Smartphone className="w-3 h-3 mr-1" />支付寶 HK',
     '<Smartphone className="w-3 h-3 mr-1" />{t(\'cart.alipayHk\')}'),
    # Line 774
    ('<span className="text-sm font-semibold text-blue-800">支付寶 HK 付款</span>',
     '<span className="text-sm font-semibold text-blue-800">{t(\'cart.alipayPayment\')}</span>'),
    # Line 781
    ('alt="支付寶 HK QR Code"',
     'alt={t(\'cart.alipayQrAlt\')}'),
    # Line 784
    ('<p className="text-xs text-blue-600 mt-1">掃描 QR code 付款，付款後請截圖上傳付款證明</p>',
     '<p className="text-xs text-blue-600 mt-1">{t(\'cart.alipayQrInstruction\')}</p>'),
    # Line 788
    ('前往訂單上傳付款證明',
     '{t(\'cart.goToOrderUploadProof\')}'),
    # Line 836
    ('setTimeLeft(`${hours} 小時 ${minutes} 分鐘`);',
     "setTimeLeft(t('cart.timeLeftFormat', { hours, minutes }));"),
    # Line 854
    ('賣家已接受你的出價！請在 <span className="font-bold">{timeLeft}</span> 內完成付款',
     '{t(\'cart.offerAccepted\', { timeLeft })}'),
    # Line 863
    ('出價已過期，將以原價 <span className="font-bold">HK${Number(item.priceHkd).toFixed(0)}</span> 購買',
     '{t(\'cart.offerExpired\', { price: Number(item.priceHkd).toFixed(0) })}'),
    # Line 903
    ('待付款 →',
     '{t(\'cart.pendingPayment\')}'),
    # Line 1039
    ('toast.error("請上傳圖片格式的截圖（JPG、PNG 等）");',
     "toast.error(t('cart.uploadImageOnly'));"),
    # Line 1043
    ('toast.error("截圖大小不能超過 10MB");',
     "toast.error(t('cart.uploadSizeLimit'));"),
    # Line 1168
    ('toast.error(`以下商品已下架或售出，已自動從購物車移除：${names}`);',
     "toast.error(t('cart.itemsRemoved', { names }));"),
    # Line 1208
    ('toast.success(`已建立 ${result.orderNos.length} 個訂單，正在跳轉至 Stripe 付款頁面...`);',
     "toast.success(t('cart.ordersCreatedStripe', { count: result.orderNos.length }));"),
    # Line 1310
    ('<p className="text-xs text-gray-500 mb-3">請選擇送貨方式，然後在下一步填寫送貨地址。</p>',
     '<p className="text-xs text-gray-500 mb-3">{t(\'cart.selectShippingMethod\')}</p>'),
    # Line 1324
    ('<span className="font-bold text-sm text-gray-800">順豐速運</span>',
     '<span className="font-bold text-sm text-gray-800">{t(\'cart.sfExpress\')}</span>'),
    # Line 1325
    ('<span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ">運費另計</span>',
     '<span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ">{t(\'cart.freightExtra\')}</span>'),
    # Line 1327
    ('<p className="text-xs text-gray-500 ml-6">運費由順豐速運收取，取件時支付，金額視重量及地址而定</p>',
     '<p className="text-xs text-gray-500 ml-6">{t(\'cart.sfFeeNote\')}</p>'),
    # Line 1339
    ('<span className="font-bold text-sm text-gray-800">香港郵政（平郵）</span>',
     '<span className="font-bold text-sm text-gray-800">{t(\'cart.hkPost\')}</span>'),
    # Line 1342
    ('<p className="text-xs text-gray-500 ml-6">本地平郵寄送，運費 HK$10 將自動計入訂單總額</p>',
     '<p className="text-xs text-gray-500 ml-6">{t(\'cart.hkPostFeeNote\')}</p>'),
    # Line 1378
    ('"預設地址"',
     "t('cart.defaultAddress')"),
    # Line 1387
    ('<Truck className="w-3 h-3" />順豐自提：{addr.sfStationName || addr.sfStationCode}',
     '<Truck className="w-3 h-3" />{t(\'cart.sfPickup\', { name: addr.sfStationName || addr.sfStationCode })}'),
    # Line 1391
    ('<MapPin className="w-3 h-3" />{addr.address || "地址"}',
     '<MapPin className="w-3 h-3" />{addr.address || t(\'cart.address\')}'),
    # Line 1409
    ('手動填寫其他地址',
     '{t(\'cart.manualAddress\')}'),
    # Line 1429
    ('前往個人中心新增地址',
     '{t(\'cart.goToProfileAddAddress\')}'),
    # Line 1441
    ('<p className="font-semibold text-[#06038D] mb-1">📦 順豐速運條款</p>',
     '<p className="font-semibold text-[#06038D] mb-1">{t(\'cart.sfTermsTitle\')}</p>'),
    # Line 1442
    ('<p className="leading-relaxed">【如寄順豐自提網點可享運費優惠】請於下單時提供收件人名、電話，並選擇你的順豐網點。運費金額將自動計算並於結帳時顯示。</p>',
     '<p className="leading-relaxed">{t(\'cart.sfTerms1\')}</p>'),
    # Line 1443
    ('<p className="mt-1 leading-relaxed">【客戶須知】由於順豐已暫停經SMS短訊方式發送取件訊息，所有取件訊息已改為透過順豐香港App發送，請確保已下載順豐香港App。</p>',
     '<p className="mt-1 leading-relaxed">{t(\'cart.sfTerms2\')}</p>'),
    # Line 1449
    ('<Label className="text-xs text-gray-600 mb-1 block">收件人姓名 *</Label>',
     '<Label className="text-xs text-gray-600 mb-1 block">{t(\'cart.recipientName\')}</Label>'),
    # Line 1451
    ('placeholder="收件人全名"',
     'placeholder={t(\'cart.recipientNamePlaceholder\')}'),
    # Line 1458
    ('<Label className="text-xs text-gray-600 mb-1 block">聯絡電話 *</Label>',
     '<Label className="text-xs text-gray-600 mb-1 block">{t(\'cart.contactPhone\')}</Label>'),
    # Line 1470
    ('<Label className="text-xs text-gray-600 mb-2 block">收件地址方式</Label>',
     '<Label className="text-xs text-gray-600 mb-2 block">{t(\'cart.addressMethod\')}</Label>'),
    # Line 1482
    ('<span>順豐點 / 智能櫃</span>',
     '<span>{t(\'cart.sfStation\')}</span>'),
    # Line 1494
    ('<span>手動輸入地址</span>',
     '<span>{t(\'cart.manualInput\')}</span>'),
    # Line 1503
    ('<Label className="text-xs text-gray-600 mb-1 block">順豐地區 *</Label>',
     '<Label className="text-xs text-gray-600 mb-1 block">{t(\'cart.sfRegion\')}</Label>'),
    # Line 1796
    ('`建立訂單，並合並為一筆 HK$${(activeSubtotal + (pendingAuctionOrders ?? []).reduce((s, o) => s + Number(o.totalHkd), 0)).toFixed(0)} 的 Stripe 付款`',
     "t('cart.createOrdersStripe', { total: (activeSubtotal + (pendingAuctionOrders ?? []).reduce((s, o) => s + Number(o.totalHkd), 0)).toFixed(0) })"),
    # Line 1804
    ('將為 {activeItems.length} 件商品建立 {activeItems.length} 個訂單，確認後顯示支付寶 HK 收款 QR 碼，掃碼支付合計金額。',
     '{t(\'cart.createOrdersAlipay\', { count: activeItems.length })}'),
    # Line 1827
    ('我已閱讀並同意平台的{" "}',
     '{t(\'cart.agreeTermsPrefix\')}{" "}'),
    # Line 1829
    ('買賣條款',
     '{t(\'cart.termsLink\')}'),
    # Line 1831
    ('，包括退款政策（收貨後 48 小時內申請）及平台規則。',
     '{t(\'cart.agreeTermsSuffix\')}'),
    # Line 1847
    ('<span>正在建立訂單...</span>',
     '<span>{t(\'cart.creatingOrders\')}</span>'),
    # Line 1866
    ('<p className="text-xs font-semibold text-[#06038D] mb-2">訂單已建立，請完成支付寶 HK 付款</p>',
     '<p className="text-xs font-semibold text-[#06038D] mb-2">{t(\'cart.orderCreatedAlipay\')}</p>'),
    # Line 1876
    ('<span>合計付款金額</span>',
     '<span>{t(\'cart.totalPayment\')}</span>'),
    # Line 1883
    ('<p className="text-sm font-medium text-gray-700">請用 AlipayHK App 掃描以下 QR 碼付款</p>',
     '<p className="text-sm font-medium text-gray-700">{t(\'cart.scanAlipayQr\')}</p>'),
    # Line 1886
    ('alt="支付寶 HK QR Code"',
     'alt={t(\'cart.alipayQrAlt\')}'),
    # Line 1891
    ('<Smartphone className="w-4 h-4" />在手機上開啟支付寶 HK',
     '<Smartphone className="w-4 h-4" />{t(\'cart.openAlipayMobile\')}'),
    # Line 1897
    ('<p className="font-medium">付款備注請填寫訂單編號：</p>',
     '<p className="font-medium">{t(\'cart.paymentRemarkInstruction\')}</p>'),
    # Line 1905
    ('toast.success("訂單編號已複製！請貼上到支付寶備注欄位");',
     "toast.success(t('cart.orderNoCopied'));"),
    # Line 1909
    ('<Copy className="w-3 h-3" />複製',
     '<Copy className="w-3 h-3" />{t(\'cart.copy\')}'),
    # Line 1912
    ('<p className="text-amber-600 mt-1">⚠️ 請務必在支付寶備注欄填寫以上編號，方便核對付款</p>',
     '<p className="text-amber-600 mt-1">{t(\'cart.alipayRemarkWarning\')}</p>'),
    # Line 1916
    ('<p>ℹ️ 完成支付寶 HK 付款後，請點擊下方按鈕進入下一步上傳截圖。管理員審核後訂單即生效。</p>',
     '<p>{t(\'cart.alipayCompleteInstruction\')}</p>'),
    # Line 1929
    ('<h3 className="text-lg font-bold text-gray-800 mb-1">截圖已成功上傳！</h3>',
     '<h3 className="text-lg font-bold text-gray-800 mb-1">{t(\'cart.screenshotUploaded\')}</h3>'),
    # Line 1930
    ('<p className="text-sm text-gray-500">管理員將在 1 個工作天內審核你的付款截圖，審核通過後訂單即生效。</p>',
     '<p className="text-sm text-gray-500">{t(\'cart.screenshotReviewNote\')}</p>'),
    # Line 1933
    ('<p className="font-medium mb-1">✅ 訂單已建立，截圖待審核</p>',
     '<p className="font-medium mb-1">{t(\'cart.orderCreatedPendingReview\')}</p>'),
    # Line 1935
    ('<p className="mt-1">你可以在「我的訂單」頁面查看訂單狀態。</p>',
     '<p className="mt-1">{t(\'cart.checkOrderStatus\')}</p>'),
    # Line 1941
    ('<p className="text-xs font-semibold text-[#06038D] mb-2">上傳支付寶 HK 付款截圖</p>',
     '<p className="text-xs font-semibold text-[#06038D] mb-2">{t(\'cart.uploadAlipayScreenshot\')}</p>'),
    # Line 1942
    ('<p className="text-xs text-gray-600 leading-relaxed">請上傳支付寶 HK 付款成功的截圖，截圖需清晰顯示：</p>',
     '<p className="text-xs text-gray-600 leading-relaxed">{t(\'cart.uploadScreenshotInstruction\')}</p>'),
    # Line 1950
    ('<p className="text-xs font-medium text-amber-800 mb-1">訂單編號（請確認已在備注填寫）：</p>',
     '<p className="text-xs font-medium text-amber-800 mb-1">{t(\'cart.orderNoConfirm\')}</p>'),
    # Line 1966
    ('alt="付款截圖預覽"',
     'alt={t(\'cart.paymentScreenshotPreview\')}'),
    # Line 1967
    ('"已選擇"',
     't(\'cart.selected\')'),
    # Line 1974
    ('<p className="text-sm font-medium text-gray-600">點擊上傳付款截圖</p>',
     '<p className="text-sm font-medium text-gray-600">{t(\'cart.clickToUploadScreenshot\')}</p>'),
    # Line 1975
    ('<p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 10MB</p>',
     '<p className="text-xs text-gray-400 mt-1">{t(\'cart.uploadFileTypes\')}</p>'),
    # Line 1982
    ('<p className="text-xs text-gray-500 text-center">已選擇：{proofFile.name}（{(proofFile.size / 1024 / 1024).toFixed(1)}MB）</p>',
     '<p className="text-xs text-gray-500 text-center">{t(\'cart.selectedFile\', { name: proofFile.name, size: (proofFile.size / 1024 / 1024).toFixed(1) })}</p>'),
    # Line 1997
    ('>取消</Button>',
     '>{t(\'common.cancel\')}</Button>'),
    # Line 2015
    ('>上一步</Button>',
     '>{t(\'common.back\')}</Button>'),
    # Line 2021
    ('<h3 className="text-base font-bold text-gray-900 mb-2">返回上一步？</h3>',
     '<h3 className="text-base font-bold text-gray-900 mb-2">{t(\'cart.goBackTitle\')}</h3>'),
    # Line 2022
    ('<p className="text-sm text-gray-600 mb-5">已填寫的送貨資料將不會保留，確定要返回送貨方式選擇頁面嗎？</p>',
     '<p className="text-sm text-gray-600 mb-5">{t(\'cart.goBackConfirm\')}</p>'),
    # Line 2036
    ('>下一步：填寫地址</Button>',
     '>{t(\'cart.nextFillAddress\')}</Button>'),
    # Line 2044
    ('>下一步：確認付款</Button>',
     '>{t(\'cart.nextConfirmPayment\')}</Button>'),
    # Line 2054
    ('"驗證庫存中..."',
     "t('cart.verifyingInventory')"),
    # Line 2056
    ('`建立中 ${batchProgress.done}/${batchProgress.total}...`',
     "t('cart.creatingProgress', { done: batchProgress.done, total: batchProgress.total })"),
    # Line 2058
    ('"處理中..."',
     "t('cart.processing')"),
    # Line 2060
    ('`確認結帳（${activeItems.length} 件）`',
     "t('cart.confirmCheckout', { count: activeItems.length })"),
    # Line 2061
    (': "確認結帳"}',
     ": t('cart.confirmCheckoutSimple')}"),
    # Line 2070
    ('我已完成付款 → 上傳截圖',
     '{t(\'cart.paymentDoneUpload\')}'),
    # Line 2089
    ('"提交付款截圖"',
     "t('cart.submitPaymentScreenshot')"),
    # Line 2098
    ('>前往我的訂單</Button>',
     '>{t(\'cart.goToMyOrders\')}</Button>'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f'NOT FOUND: {repr(old[:60])}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Replaced {count}/{len(replacements)} strings')
