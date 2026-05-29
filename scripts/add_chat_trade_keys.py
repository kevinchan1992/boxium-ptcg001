import json

LOCALES = {
    "zh-TW": "/home/ubuntu/boxium-ptcg/client/src/locales/zh-TW.json",
    "en": "/home/ubuntu/boxium-ptcg/client/src/locales/en.json",
    "ja": "/home/ubuntu/boxium-ptcg/client/src/locales/ja.json",
}

new_keys = {
    "zh-TW": {
        "messageCenter": {
            "title": "訊息中心",
            "noMessages": "暫無訊息",
            "noHistory": "暫無訊息記錄",
            "noHistoryDesc": "購買或出售商品後，可在此與對方溝通",
            "selectChat": "選擇一個對話",
            "selectChatDesc": "從左側選擇訂單訊息",
            "inputPlaceholder": "輸入訊息… (Enter 發送)"
        },
        "orderChat": {
            "title": "訂單訊息",
            "noMessages": "暫無訊息。你可以在此與",
            "noMessagesSuffix": "溝通。",
            "read": "已讀",
            "inputPlaceholder": "輸入訊息...",
            "inputHint": "按 Enter 發送 · Shift+Enter 換行"
        },
        "tradeHistory": {
            "detailTitle": "交換記錄詳情",
            "cardsOut": "換出卡牌",
            "cardsIn": "換入卡牌",
            "totalCards": "共 {{count}} 張",
            "totalOutValue": "換出總估值",
            "totalInValue": "換入總估值",
            "cashDiff": "補差金額",
            "cashDiffDesc": "換入 − 換出差值",
            "deleteRecord": "刪除記錄",
            "deleteSuccess": "交換記錄已刪除",
            "deleteFailed": "刪除失敗",
            "deleteConfirm": "確定要刪除此交換記錄嗎？此操作無法復原，換入的卡牌將從收藏中移除，換出的卡牌將恢復為正常狀態。",
            "noRecords": "尚無交換記錄",
            "noRecordsDesc": "在收藏清單中點擊 ⇄ 按鈕開始記錄以卡換卡",
            "totalRecords": "共 {{count}} 筆交換記錄"
        },
        "orderStatusLabel": {
            "pendingPayment": "待付款",
            "paid": "已付款",
            "processing": "處理中",
            "shipped": "已出貨",
            "delivered": "已送達",
            "completed": "已完成",
            "cancelled": "已取消",
            "refunded": "已退款",
            "disputed": "爭議中"
        },
        "common": {
            "buyer": "買家",
            "seller": "賣家",
            "admin": "管理員",
            "sendFailed": "發送失敗",
            "imageTooLarge": "圖片不能超過 5MB",
            "image": "圖片",
            "preview": "預覽",
            "attachment": "附圖",
            "order": "訂單",
            "viewOrder": "查看訂單",
            "with": "與",
            "or": "或",
            "collapse": "收起",
            "expand": "展開",
            "close": "關閉"
        }
    },
    "en": {
        "messageCenter": {
            "title": "Message Center",
            "noMessages": "No messages",
            "noHistory": "No message history",
            "noHistoryDesc": "After buying or selling, you can communicate with the other party here",
            "selectChat": "Select a conversation",
            "selectChatDesc": "Select an order message from the left",
            "inputPlaceholder": "Type a message… (Enter to send)"
        },
        "orderChat": {
            "title": "Order Messages",
            "noMessages": "No messages yet. You can communicate with the",
            "noMessagesSuffix": "here.",
            "read": "Read",
            "inputPlaceholder": "Type a message...",
            "inputHint": "Press Enter to send · Shift+Enter for new line"
        },
        "tradeHistory": {
            "detailTitle": "Trade Record Details",
            "cardsOut": "Cards Out",
            "cardsIn": "Cards In",
            "totalCards": "{{count}} cards total",
            "totalOutValue": "Total Out Value",
            "totalInValue": "Total In Value",
            "cashDiff": "Cash Adjustment",
            "cashDiffDesc": "In − Out Difference",
            "deleteRecord": "Delete Record",
            "deleteSuccess": "Trade record deleted",
            "deleteFailed": "Delete failed",
            "deleteConfirm": "Are you sure you want to delete this trade record? This action cannot be undone. Cards received will be removed from your collection, and cards given away will be restored to normal status.",
            "noRecords": "No trade records yet",
            "noRecordsDesc": "Click the ⇄ button in your collection list to start recording card trades",
            "totalRecords": "{{count}} trade records total"
        },
        "orderStatusLabel": {
            "pendingPayment": "Pending Payment",
            "paid": "Paid",
            "processing": "Processing",
            "shipped": "Shipped",
            "delivered": "Delivered",
            "completed": "Completed",
            "cancelled": "Cancelled",
            "refunded": "Refunded",
            "disputed": "Disputed"
        },
        "common": {
            "buyer": "Buyer",
            "seller": "Seller",
            "admin": "Admin",
            "sendFailed": "Send failed",
            "imageTooLarge": "Image cannot exceed 5MB",
            "image": "Image",
            "preview": "Preview",
            "attachment": "Attachment",
            "order": "Order",
            "viewOrder": "View Order",
            "with": "with",
            "or": "or",
            "collapse": "Collapse",
            "expand": "Expand",
            "close": "Close"
        }
    },
    "ja": {
        "messageCenter": {
            "title": "メッセージセンター",
            "noMessages": "メッセージなし",
            "noHistory": "メッセージ履歴なし",
            "noHistoryDesc": "購入または販売後、ここで相手と連絡が取れます",
            "selectChat": "会話を選択",
            "selectChatDesc": "左側から注文メッセージを選択",
            "inputPlaceholder": "メッセージを入力… (Enterで送信)"
        },
        "orderChat": {
            "title": "注文メッセージ",
            "noMessages": "メッセージはありません。ここで",
            "noMessagesSuffix": "と連絡が取れます。",
            "read": "既読",
            "inputPlaceholder": "メッセージを入力...",
            "inputHint": "Enterで送信 · Shift+Enterで改行"
        },
        "tradeHistory": {
            "detailTitle": "トレード記録の詳細",
            "cardsOut": "渡したカード",
            "cardsIn": "受け取ったカード",
            "totalCards": "合計 {{count}} 枚",
            "totalOutValue": "渡したカードの合計推定価値",
            "totalInValue": "受け取ったカードの合計推定価値",
            "cashDiff": "差額調整",
            "cashDiffDesc": "受取 − 渡し 差額",
            "deleteRecord": "記録を削除",
            "deleteSuccess": "トレード記録を削除しました",
            "deleteFailed": "削除失敗",
            "deleteConfirm": "このトレード記録を削除してもよいですか？この操作は元に戻せません。受け取ったカードはコレクションから削除され、渡したカードは通常の状態に戻ります。",
            "noRecords": "トレード記録はありません",
            "noRecordsDesc": "コレクションリストの ⇄ ボタンをクリックしてカードトレードの記録を開始",
            "totalRecords": "合計 {{count}} 件のトレード記録"
        },
        "orderStatusLabel": {
            "pendingPayment": "支払い待ち",
            "paid": "支払い済み",
            "processing": "処理中",
            "shipped": "発送済み",
            "delivered": "配達済み",
            "completed": "完了",
            "cancelled": "キャンセル",
            "refunded": "返金済み",
            "disputed": "紛争中"
        },
        "common": {
            "buyer": "購入者",
            "seller": "販売者",
            "admin": "管理者",
            "sendFailed": "送信失敗",
            "imageTooLarge": "画像は5MB以下にしてください",
            "image": "画像",
            "preview": "プレビュー",
            "attachment": "添付画像",
            "order": "注文",
            "viewOrder": "注文を見る",
            "with": "と",
            "or": "または",
            "collapse": "折りたたむ",
            "expand": "展開",
            "close": "閉じる"
        }
    }
}

def deep_merge(base, updates):
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

for locale, path in LOCALES.items():
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    deep_merge(data, new_keys[locale])
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Updated {locale}")

print("\nDone!")
