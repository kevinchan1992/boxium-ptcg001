import json

LOCALE_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"

new_keys = {
    "orderDetail": {
        "sfExpress": {"zh-TW": "順豐速遞", "en": "SF Express", "ja": "SF Express"},
        "hkPost": {"zh-TW": "香港郵政", "en": "HK Post", "ja": "香港郵政"},
        "chunghwaPost": {"zh-TW": "中華郵政", "en": "Chunghwa Post", "ja": "中華郵政"},
        "blackCat": {"zh-TW": "黑貓宅急便", "en": "Black Cat Yamato", "ja": "ヤマト運輸"},
        "other": {"zh-TW": "其他快遞", "en": "Other Courier", "ja": "その他"},
        "courier": {"zh-TW": "快遞", "en": "Courier", "ja": "宅配"},
        "query": {"zh-TW": "查詢", "en": "Track", "ja": "追跡"},
        "statusDesc": {
            "pendingPayment": {"zh-TW": "等待買家完成付款", "en": "Waiting for buyer to complete payment", "ja": "買い手の支払いを待っています"},
            "paidHeld": {"zh-TW": "付款已確認，等待賣家出貨", "en": "Payment confirmed, waiting for seller to ship", "ja": "支払い確認済み、出荷待ち"},
            "paymentReceived": {"zh-TW": "付款已確認，等待賣家處理", "en": "Payment confirmed, waiting for seller to process", "ja": "支払い確認済み、処理待ち"},
            "processing": {"zh-TW": "賣家正在準備出貨", "en": "Seller is preparing to ship", "ja": "出荷準備中"},
            "shipped": {"zh-TW": "商品已寄出，請耐心等候", "en": "Item shipped, please wait patiently", "ja": "発送済み、お待ちください"},
            "delivered": {"zh-TW": "商品已送達，請確認收貨", "en": "Item delivered, please confirm receipt", "ja": "配達済み、受け取り確認をお願いします"},
            "completed": {"zh-TW": "訂單已完成", "en": "Order completed", "ja": "注文完了"},
            "cancelled": {"zh-TW": "訂單已取消", "en": "Order cancelled", "ja": "注文キャンセル"},
        },
        "allVerified": {"zh-TW": "三項驗證全部通過", "en": "All 3 verifications passed", "ja": "3項目の検証がすべて通過"},
        "verifyNotComplete": {"zh-TW": "驗證未完全通過", "en": "Verification not fully passed", "ja": "検証が完全に通過していません"},
        "verifyFailed": {"zh-TW": "驗證未通過，請檢查以下項目", "en": "Verification failed, please check the following", "ja": "検証失敗、以下を確認してください"},
        "reuploadScreenshotBtn": {"zh-TW": "重新上傳截圖", "en": "Re-upload screenshot", "ja": "スクリーンショットを再アップロード"},
        "reselectScreenshot": {"zh-TW": "重新選擇截圖", "en": "Reselect screenshot", "ja": "スクリーンショットを再選択"},
        "clickToSelectScreenshot": {"zh-TW": "點擊選擇截圖", "en": "Click to select screenshot", "ja": "クリックしてスクリーンショットを選択"},
        "screenshotHint": {"zh-TW": "支援 JPG、PNG，最大 5MB", "en": "Supports JPG, PNG, max 5MB", "ja": "JPG、PNG対応、最大5MB"},
        "submitOrder": {"zh-TW": "提交訂單", "en": "Submit Order", "ja": "注文を提出"},
        "submitOrderPending": {"zh-TW": "提交訂單（待核對）", "en": "Submit Order (Pending Review)", "ja": "注文を提出（確認待ち）"},
        "alipayQrAlt": {"zh-TW": "支付寶 HK QR Code", "en": "Alipay HK QR Code", "ja": "Alipay HK QRコード"},
        "checkOrderDetails": {"zh-TW": "請查看訂單詳情", "en": "Please check order details", "ja": "注文詳細を確認してください"},
        "uploadAlipayScreenshotHint": {"zh-TW": "請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致", "en": "Please upload Alipay HK payment success screenshot, system will auto-verify the amount", "ja": "Alipay HKの支払い成功スクリーンショットをアップロードしてください"},
        "paymentScreenshot": {"zh-TW": "付款截圖", "en": "Payment Screenshot", "ja": "支払いスクリーンショット"},
        "paymentScreenshotAlt": {"zh-TW": "付款截圖", "en": "Payment screenshot", "ja": "支払いスクリーンショット"},
        "aiVerifying": {"zh-TW": "AI 正在驗證付款金額...", "en": "AI is verifying payment amount...", "ja": "AIが支払い金額を確認中..."},
        "reviewTimeHint": {"zh-TW": "⏱ 通常 1-2 個工作天內確認，請耐心等候。如有疑問請聯絡客服。", "en": "⏱ Usually confirmed within 1-2 business days. Contact support if needed.", "ja": "⏱ 通常1〜2営業日以内に確認されます。"},
        "noAlipayScreenshot": {"zh-TW": "⚠️ 尚未上傳支付寶 HK 付款截圖", "en": "⚠️ Alipay HK payment screenshot not uploaded yet", "ja": "⚠️ Alipay HKの支払いスクリーンショットがまだアップロードされていません"},
        "uploadPaymentScreenshot": {"zh-TW": "📷 上傳付款截圖", "en": "📷 Upload Payment Screenshot", "ja": "📷 支払いスクリーンショットをアップロード"},
        "orderCreatedAt": {"zh-TW": "訂單建立", "en": "Order Created", "ja": "注文作成"},
        "orderUpdatedAt": {"zh-TW": "最後更新", "en": "Last Updated", "ja": "最終更新"},
        "screenshotSubmitted": {"zh-TW": "截圖已提交", "en": "Screenshot Submitted", "ja": "スクリーンショット提出済み"},
        "uploadAlipayScreenshot": {"zh-TW": "上傳支付寶 HK 截圖", "en": "Upload Alipay HK Screenshot", "ja": "Alipay HKスクリーンショットをアップロード"},
        "screenshotSubmittedTitle": {"zh-TW": "截圖已提交！", "en": "Screenshot Submitted!", "ja": "スクリーンショット提出完了！"},
        "adminWillConfirm": {"zh-TW": "管理員核對收款後將確認你的訂單", "en": "Admin will confirm your order after verifying payment", "ja": "管理者が支払いを確認後、注文を確定します"},
        "amountDue": {"zh-TW": "需付金額", "en": "Amount Due", "ja": "支払い金額"},
        "alipayScreenshotRequirements": {"zh-TW": "請上傳支付寶 HK 付款成功截圖，截圖須清晰顯示金額、收款方及「成功」狀態", "en": "Please upload Alipay HK payment success screenshot showing amount, payee and 'Success' status clearly", "ja": "金額、受取人、「成功」ステータスが明確に表示されたAlipay HK支払い成功スクリーンショットをアップロードしてください"},
        "shippingProofAlt": {"zh-TW": "出貨憑證", "en": "Shipping proof", "ja": "発送証明"},
        "reuploadScreenshotBtn": {"zh-TW": "重新上傳截圖", "en": "Re-upload screenshot", "ja": "再アップロード"},
        "uploadImage": {"zh-TW": "上傳圖片", "en": "Upload Image", "ja": "画像をアップロード"},
        "sellerReceiveOn": {"zh-TW": "賣家將於", "en": "Seller will receive payment on", "ja": "出品者は"},
        "afterReceiveDispute": {"zh-TW": "後收款，期間你可申請爭議", "en": "after which you can file a dispute", "ja": "に入金予定、その間は異議申し立て可能"},
        "auctionPayLimit": {"zh-TW": "拍賣付款限時", "en": "Auction payment time limit", "ja": "オークション支払い制限時間"},
        "auctionAutoCancel": {"zh-TW": "逾時訂單將自動取消，商品重新上架拍賣", "en": "Order will be auto-cancelled if not paid, item will be re-listed", "ja": "期限切れの注文は自動キャンセルされ、商品は再出品されます"},
        "autoCancel": {"zh-TW": "超時後訂單將自動取消，商品重新上架", "en": "Order will be auto-cancelled after timeout, item will be re-listed", "ja": "タイムアウト後に注文は自動キャンセルされます"},
        "pleasePaySoon": {"zh-TW": "請盡快完成付款", "en": "Please complete payment soon", "ja": "早めにお支払いください"},
        "confirmShipment": {"zh-TW": "確認出貨", "en": "Confirm Shipment", "ja": "発送確認"},
        "cancelOrder": {"zh-TW": "取消訂單", "en": "Cancel Order", "ja": "注文をキャンセル"},
        "cancelConfirmNote": {"zh-TW": "確認要取消此訂單？取消後訂單將無法恢復。", "en": "Are you sure you want to cancel this order? This cannot be undone.", "ja": "この注文をキャンセルしますか？キャンセル後は元に戻せません。"},
        "applyDispute": {"zh-TW": "申請爭議", "en": "Apply Dispute", "ja": "異議申し立て"},
        "rateSeller": {"zh-TW": "評價賣家", "en": "Rate Seller", "ja": "出品者を評価"},
        "trackingPlaceholder": {"zh-TW": "例：SF1234567890", "en": "e.g. SF1234567890", "ja": "例：SF1234567890"},
        "logisticsInfo": {"zh-TW": "物流資訊", "en": "Logistics Info", "ja": "配送情報"},
        "trackingCopied": {"zh-TW": "追蹤號碼已複製", "en": "Tracking number copied", "ja": "追跡番号をコピーしました"},
        "trackingNo": {"zh-TW": "追蹤號碼", "en": "Tracking No.", "ja": "追跡番号"},
        "orderNo": {"zh-TW": "訂單", "en": "Order", "ja": "注文"},
        "address": {"zh-TW": "地址", "en": "Address", "ja": "住所"},
        "paid": {"zh-TW": "已付款", "en": "Paid", "ja": "支払済み"},
        "unrecognized": {"zh-TW": "未識別", "en": "Unrecognized", "ja": "未認識"},
        "payee": {"zh-TW": "收款方", "en": "Payee", "ja": "受取人"},
        "amount": {"zh-TW": "金額", "en": "Amount", "ja": "金額"},
        "status": {"zh-TW": "狀態", "en": "Status", "ja": "ステータス"},
        "disputeWaitingAdmin": {"zh-TW": "爭議處理中，等待管理員介入", "en": "Dispute in progress, waiting for admin", "ja": "異議処理中、管理者の介入待ち"},
        "disputeInProgress": {"zh-TW": "爭議處理中", "en": "Dispute in Progress", "ja": "異議処理中"},
        "adminWillProcess": {"zh-TW": "管理員將介入處理此爭議", "en": "Admin will process this dispute", "ja": "管理者がこの異議を処理します"},
        "disputeReason": {"zh-TW": "爭議原因", "en": "Dispute Reason", "ja": "異議理由"},
        "submitEvidenceTitle": {"zh-TW": "提交爭議證據", "en": "Submit Dispute Evidence", "ja": "異議証拠を提出"},
        "submitEvidenceDesc": {"zh-TW": "上傳相關截圖或照片作為爭議證明", "en": "Upload screenshots or photos as dispute evidence", "ja": "スクリーンショットや写真を証拠としてアップロード"},
        "goUploadEvidence": {"zh-TW": "前往上傳證據", "en": "Go Upload Evidence", "ja": "証拠をアップロードする"},
        "disputeResult": {"zh-TW": "爭議結果", "en": "Dispute Result", "ja": "異議結果"},
        "orderCancelled": {"zh-TW": "訂單已取消", "en": "Order Cancelled", "ja": "注文キャンセル済み"},
        "timeline": {
            "orderCreated": {"zh-TW": "訂單建立", "en": "Order Created", "ja": "注文作成"},
            "paymentConfirmed": {"zh-TW": "付款確認", "en": "Payment Confirmed", "ja": "支払い確認"},
            "sellerProcessing": {"zh-TW": "賣家處理中", "en": "Seller Processing", "ja": "出品者処理中"},
            "shipped": {"zh-TW": "已出貨", "en": "Shipped", "ja": "発送済み"},
            "completed": {"zh-TW": "訂單完成", "en": "Order Completed", "ja": "注文完了"},
        },
        "goToPay": {"zh-TW": "前往付款", "en": "Go to Pay", "ja": "支払いへ"},
        "paymentMethod": {"zh-TW": "選擇付款方式", "en": "Select Payment Method", "ja": "支払い方法を選択"},
        "selectPayMethod": {"zh-TW": "選擇付款方式", "en": "Select Payment Method", "ja": "支払い方法を選択"},
        "orderSubmitted": {"zh-TW": "訂單已提交", "en": "Order Submitted", "ja": "注文提出済み"},
        "alipayHkPay": {"zh-TW": "支付寶 HK 付款", "en": "Alipay HK Payment", "ja": "Alipay HK支払い"},
        "paymentAmount": {"zh-TW": "需付金額：", "en": "Amount Due: ", "ja": "支払い金額："},
        "scanQrOrClick": {"zh-TW": "掃描 QR Code 或點擊連結付款", "en": "Scan QR Code or click the link to pay", "ja": "QRコードをスキャンするかリンクをクリックして支払い"},
        "openAlipayOnPhone": {"zh-TW": "在手機上開啟支付寶 HK", "en": "Open Alipay HK on phone", "ja": "スマホでAlipay HKを開く"},
        "fillOrderNumber": {"zh-TW": "付款備注請填寫訂單編號", "en": "Please fill in the order number in payment remarks", "ja": "支払い備考に注文番号を記入してください"},
        "copyId": {"zh-TW": "複製", "en": "Copy", "ja": "コピー"},
        "listingIdCopied": {"zh-TW": "訂單編號已複製", "en": "Order ID copied", "ja": "注文IDをコピーしました"},
        "fillShippingAddress": {"zh-TW": "請填寫收貨地址", "en": "Please fill in shipping address", "ja": "配送先住所を入力してください"},
        "addressForSeller": {"zh-TW": "賣家將根據此地址安排出貨", "en": "Seller will arrange shipment to this address", "ja": "出品者はこの住所に発送します"},
        "recipientName": {"zh-TW": "收件人姓名", "en": "Recipient Name", "ja": "受取人名"},
        "contactPhone": {"zh-TW": "聯絡電話", "en": "Contact Phone", "ja": "連絡先電話"},
        "detailedAddress": {"zh-TW": "詳細地址", "en": "Detailed Address", "ja": "詳細住所"},
        "region": {"zh-TW": "地區", "en": "Region", "ja": "地域"},
        "hongKongIsland": {"zh-TW": "香港島", "en": "Hong Kong Island", "ja": "香港島"},
        "kowloon": {"zh-TW": "九龍", "en": "Kowloon", "ja": "九龍"},
        "newTerritories": {"zh-TW": "新界", "en": "New Territories", "ja": "新界"},
        "hongKong": {"zh-TW": "香港", "en": "Hong Kong", "ja": "香港"},
        "hongKongAny": {"zh-TW": "香港（任何地區）", "en": "Hong Kong (Any Region)", "ja": "香港（全地域）"},
        "requiredFields": {"zh-TW": "* 為必填欄位", "en": "* Required fields", "ja": "* は必須項目"},
        "nextUploadScreenshot": {"zh-TW": "下一步：上傳截圖", "en": "Next: Upload Screenshot", "ja": "次へ：スクリーンショットをアップロード"},
        "clickToUploadScreenshot": {"zh-TW": "點擊上傳付款截圖", "en": "Click to upload payment screenshot", "ja": "クリックして支払いスクリーンショットをアップロード"},
        "ifConfirmedPaid": {"zh-TW": "如已確認付款成功", "en": "If payment is confirmed", "ja": "支払いが確認された場合"},
        "manualReviewNote": {"zh-TW": "可繼續提交，管理員將人工核對", "en": "You may proceed, admin will manually verify", "ja": "続行できます、管理者が手動で確認します"},
        "submitDispute": {"zh-TW": "提交爭議", "en": "Submit Dispute", "ja": "異議を提出"},
        "submitRating": {"zh-TW": "提交評價", "en": "Submit Rating", "ja": "評価を提出"},
        "cooldownEndedProcessing": {"zh-TW": "冷靜期已結束，款項處理中", "en": "Cooldown ended, payment processing", "ja": "クールダウン終了、支払い処理中"},
    },
    "common": {
        "hours": {"zh-TW": "小時", "en": "hours", "ja": "時間"},
        "minutes": {"zh-TW": "分鐘", "en": "minutes", "ja": "分"},
        "back": {"zh-TW": "返回", "en": "Back", "ja": "戻る"},
        "done": {"zh-TW": "完成", "en": "Done", "ja": "完了"},
        "cancel": {"zh-TW": "取消", "en": "Cancel", "ja": "キャンセル"},
        "submitting": {"zh-TW": "提交中...", "en": "Submitting...", "ja": "提出中..."},
        "uploading": {"zh-TW": "上傳中", "en": "Uploading", "ja": "アップロード中"},
    }
}

def deep_merge(base, new_data):
    for key, value in new_data.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        elif key not in base:
            base[key] = value

for lang in ["zh-TW", "en", "ja"]:
    path = f"{LOCALE_DIR}/{lang}.json"
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    
    def extract_lang(keys_dict, lang):
        result = {}
        for k, v in keys_dict.items():
            if isinstance(v, dict):
                if lang in v:
                    result[k] = v[lang]
                else:
                    result[k] = extract_lang(v, lang)
        return result
    
    lang_keys = extract_lang(new_keys, lang)
    deep_merge(data, lang_keys)
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {lang}.json")

print("Done!")
