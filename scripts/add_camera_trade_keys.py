import json

LOCALES = {
    "zh-TW": "/home/ubuntu/boxium-ptcg/client/src/locales/zh-TW.json",
    "en": "/home/ubuntu/boxium-ptcg/client/src/locales/en.json",
    "ja": "/home/ubuntu/boxium-ptcg/client/src/locales/ja.json",
}

camera_keys = {
    "zh-TW": {
        "identified": "已識別：{{name}}",
        "identifyFailed": "識別失敗，請重試",
        "cameraStartFailed": "無法啟動相機，請使用上傳功能",
        "captureFailed": "無法擷取畫面",
        "autoScan": "自動識別",
        "guideText": "將卡牌對準框內，系統將自動識別",
        "identifySuccess": "識別成功！",
        "starting": "啟動相機中...",
        "album": "相簿",
        "flip": "翻轉",
        "analyzing": "AI 識別中",
        "poweredBy": "由 Gemini AI 驅動",
        "retake": "重新拍攝",
        "title": {
            "selectCard": "拍照選卡",
            "identify": "拍照識別",
            "analyzing": "AI 分析中...",
            "results": "識別結果",
            "noMatch": "識別完成",
            "permission": "相機權限"
        },
        "tip": {
            "title": "拍攝技巧",
            "desc": "確保卡牌名稱及卡號清晰可見，避免反光及陰影。卡牌充滿取景框時系統將自動識別。"
        },
        "lowLight": {
            "title": "低光模式",
            "desc": "降低亮度偵測門值至 15，適用於光線不足環境"
        },
        "permission": {
            "denied": "相機權限被拒絕",
            "desc": "請在瀏覽器設定中允許相機存取，或使用上傳圖片功能",
            "useUpload": "改用上傳圖片"
        },
        "progress": {
            "reading": "正在讀取卡牌資訊...",
            "matching": "比對卡牌資料庫...",
            "precise": "精準匹配中...",
            "finishing": "即將完成..."
        },
        "results": {
            "aiResult": "AI 識別結果",
            "found": "找到 {{count}} 個匹配結果，{{action}}",
            "selectToAdd": "請選擇要加入的卡牌",
            "selectCorrect": "請選擇正確的卡牌",
            "best": "最佳",
            "score": "{{score}}分"
        },
        "noMatch": {
            "aiIdentified": "AI 識別到的卡牌",
            "notInDb": "資料庫中未找到完全匹配的卡牌",
            "cannotIdentify": "無法識別卡牌",
            "ensureClear": "請確保圖片清晰且包含完整卡牌",
            "search": "搜尋「{{name}}」"
        }
    },
    "en": {
        "identified": "Identified: {{name}}",
        "identifyFailed": "Identification failed, please try again",
        "cameraStartFailed": "Cannot start camera, please use upload",
        "captureFailed": "Cannot capture frame",
        "autoScan": "Auto Scan",
        "guideText": "Align card in frame, system will auto-identify",
        "identifySuccess": "Identified!",
        "starting": "Starting camera...",
        "album": "Album",
        "flip": "Flip",
        "analyzing": "AI Identifying",
        "poweredBy": "Powered by Gemini AI",
        "retake": "Retake",
        "title": {
            "selectCard": "Photo Select",
            "identify": "Photo Identify",
            "analyzing": "AI Analyzing...",
            "results": "Results",
            "noMatch": "Identification Done",
            "permission": "Camera Permission"
        },
        "tip": {
            "title": "Shooting Tips",
            "desc": "Ensure card name and number are clearly visible, avoid glare and shadows. System auto-identifies when card fills the frame."
        },
        "lowLight": {
            "title": "Low Light Mode",
            "desc": "Lowers brightness detection threshold to 15, suitable for low-light environments"
        },
        "permission": {
            "denied": "Camera Permission Denied",
            "desc": "Please allow camera access in browser settings, or use the upload feature",
            "useUpload": "Use Upload Instead"
        },
        "progress": {
            "reading": "Reading card info...",
            "matching": "Matching database...",
            "precise": "Precise matching...",
            "finishing": "Almost done..."
        },
        "results": {
            "aiResult": "AI Identification Result",
            "found": "Found {{count}} matches, {{action}}",
            "selectToAdd": "select card to add",
            "selectCorrect": "select the correct card",
            "best": "Best",
            "score": "{{score}}pt"
        },
        "noMatch": {
            "aiIdentified": "AI Identified Card",
            "notInDb": "No exact match found in database",
            "cannotIdentify": "Cannot Identify Card",
            "ensureClear": "Please ensure image is clear and contains full card",
            "search": "Search \"{{name}}\""
        }
    },
    "ja": {
        "identified": "識別済み：{{name}}",
        "identifyFailed": "識別失敗、再試行してください",
        "cameraStartFailed": "カメラを起動できません、アップロードをご利用ください",
        "captureFailed": "フレームをキャプチャできません",
        "autoScan": "自動識別",
        "guideText": "カードをフレームに合わせると自動識別します",
        "identifySuccess": "識別成功！",
        "starting": "カメラ起動中...",
        "album": "アルバム",
        "flip": "反転",
        "analyzing": "AI識別中",
        "poweredBy": "Gemini AI 搭載",
        "retake": "再撮影",
        "title": {
            "selectCard": "撮影選択",
            "identify": "撮影識別",
            "analyzing": "AI分析中...",
            "results": "識別結果",
            "noMatch": "識別完了",
            "permission": "カメラ権限"
        },
        "tip": {
            "title": "撮影のコツ",
            "desc": "カード名とカード番号が明確に見えるようにし、反射や影を避けてください。カードがフレームいっぱいになると自動識別します。"
        },
        "lowLight": {
            "title": "低照度モード",
            "desc": "輝度検出閾値を15に下げ、照明不足の環境に適しています"
        },
        "permission": {
            "denied": "カメラ権限が拒否されました",
            "desc": "ブラウザ設定でカメラアクセスを許可するか、アップロード機能をご利用ください",
            "useUpload": "アップロードを使用"
        },
        "progress": {
            "reading": "カード情報を読み取り中...",
            "matching": "データベース照合中...",
            "precise": "精密マッチング中...",
            "finishing": "もうすぐ完了..."
        },
        "results": {
            "aiResult": "AI識別結果",
            "found": "{{count}}件のマッチが見つかりました、{{action}}",
            "selectToAdd": "追加するカードを選択",
            "selectCorrect": "正しいカードを選択",
            "best": "最良",
            "score": "{{score}}点"
        },
        "noMatch": {
            "aiIdentified": "AIが識別したカード",
            "notInDb": "データベースに完全一致が見つかりません",
            "cannotIdentify": "カードを識別できません",
            "ensureClear": "画像が鮮明でカード全体が含まれていることを確認してください",
            "search": "「{{name}}」を検索"
        }
    }
}

trade_keys = {
    "zh-TW": {
        "outCards": "換出卡牌",
        "inCards": "換入卡牌",
        "fromCollection": "從收藏選",
        "cameraIdentify": "拍照識別",
        "photo": "拍照",
        "searchIn": "搜尋換入卡",
        "search": "搜尋",
        "addOutHint": "點擊「從收藏選」或「搜尋」加入換出卡牌",
        "addInHint": "搜尋並加入換入的新卡牌（將自動加入收藏）",
        "out": "換出",
        "in": "換入",
        "totalValue": "總估值",
        "addMore": "再加一張",
        "historyTitle": "以卡換卡記錄",
        "date": "交換日期",
        "cashAdj": "補差金額（選填）",
        "cashAdjPlaceholder": "正數=收到 負數=付出",
        "cashAdjHint": "正數 = 對方補差給你，負數 = 你補差給對方",
        "cashDiff": "補差",
        "notes": "備註（選填）",
        "notesPlaceholder": "交換地點、備忘...",
        "validationError": "請加入至少一張換出卡牌和一張換入卡牌",
        "confirm": "確認記錄交換",
        "setOutCardData": "設定換出卡牌資料",
        "setInCardData": "設定換入卡牌資料",
        "grader": "評級機構",
        "raw": "RAW（未評級）",
        "grade": "評級",
        "quantity": "數量",
        "valuation": "估值 HKD",
        "fetchingPrice": "查詢市場價中...",
        "marketRef": "市場參考價",
        "valuationPlaceholder": "輸入估值",
        "addToOutList": "換出清單",
        "addToInList": "換入清單",
        "addToList": "加入{{dir}}清單",
        "pickFromCollection": "從收藏選擇換出卡牌",
        "loadingCollection": "載入收藏中...",
        "emptyCollection": "收藏清單為空",
        "alreadyTraded": "↔ 已換出",
        "savedSuccess": "交換記錄已儲存，換入卡牌已加入收藏！",
        "saveFailed": "儲存失敗：{{msg}}",
        "addedToList": "已加入{{dir}}清單：{{name}}",
        "alreadyInOutList": "此卡牌已加入換出清單",
        "saving": "儲存中...",
        "estimateHKD": "估值 HKD"
    },
    "en": {
        "outCards": "Cards Out",
        "inCards": "Cards In",
        "fromCollection": "From Collection",
        "cameraIdentify": "Camera Identify",
        "photo": "Photo",
        "searchIn": "Search In",
        "search": "Search",
        "addOutHint": "Click \"From Collection\" or \"Search\" to add cards out",
        "addInHint": "Search and add cards in (will be auto-added to collection)",
        "out": "Out",
        "in": "In",
        "totalValue": " Total Value",
        "addMore": "Add More",
        "historyTitle": "Card Trade History",
        "date": "Trade Date",
        "cashAdj": "Cash Adjustment (Optional)",
        "cashAdjPlaceholder": "Positive=Received Negative=Paid",
        "cashAdjHint": "Positive = other party pays you, Negative = you pay other party",
        "cashDiff": "cash adj",
        "notes": "Notes (Optional)",
        "notesPlaceholder": "Trade location, memo...",
        "validationError": "Please add at least one card out and one card in",
        "confirm": "Confirm Trade Record",
        "setOutCardData": "Set Card Out Data",
        "setInCardData": "Set Card In Data",
        "grader": "Grader",
        "raw": "RAW (Ungraded)",
        "grade": "Grade",
        "quantity": "Quantity",
        "valuation": "Valuation HKD",
        "fetchingPrice": "Fetching market price...",
        "marketRef": "Market Reference",
        "valuationPlaceholder": "Enter valuation",
        "addToOutList": "Out List",
        "addToInList": "In List",
        "addToList": "Add to {{dir}} List",
        "pickFromCollection": "Pick from Collection",
        "loadingCollection": "Loading collection...",
        "emptyCollection": "Collection is empty",
        "alreadyTraded": "↔ Traded Out",
        "savedSuccess": "Trade recorded, cards in added to collection!",
        "saveFailed": "Save failed: {{msg}}",
        "addedToList": "Added to {{dir}} list: {{name}}",
        "alreadyInOutList": "This card is already in the out list",
        "saving": "Saving...",
        "estimateHKD": "Est. HKD"
    },
    "ja": {
        "outCards": "出すカード",
        "inCards": "もらうカード",
        "fromCollection": "コレクションから",
        "cameraIdentify": "カメラ識別",
        "photo": "撮影",
        "searchIn": "もらうカード検索",
        "search": "検索",
        "addOutHint": "「コレクションから」または「検索」で出すカードを追加",
        "addInHint": "もらうカードを検索して追加（自動的にコレクションに追加）",
        "out": "出す",
        "in": "もらう",
        "totalValue": "合計評価額",
        "addMore": "もう一枚追加",
        "historyTitle": "カード交換記録",
        "date": "交換日",
        "cashAdj": "差額補填（任意）",
        "cashAdjPlaceholder": "正数=受取 負数=支払",
        "cashAdjHint": "正数 = 相手から補填を受ける、負数 = あなたが補填を支払う",
        "cashDiff": "差額補填",
        "notes": "メモ（任意）",
        "notesPlaceholder": "交換場所、メモ...",
        "validationError": "出すカードともらうカードをそれぞれ1枚以上追加してください",
        "confirm": "交換を記録する",
        "setOutCardData": "出すカードデータを設定",
        "setInCardData": "もらうカードデータを設定",
        "grader": "グレーダー",
        "raw": "RAW（未評価）",
        "grade": "グレード",
        "quantity": "数量",
        "valuation": "評価額 HKD",
        "fetchingPrice": "市場価格取得中...",
        "marketRef": "市場参考価格",
        "valuationPlaceholder": "評価額を入力",
        "addToOutList": "出すリスト",
        "addToInList": "もらうリスト",
        "addToList": "{{dir}}リストに追加",
        "pickFromCollection": "コレクションから出すカードを選択",
        "loadingCollection": "コレクション読み込み中...",
        "emptyCollection": "コレクションが空です",
        "alreadyTraded": "↔ 交換済み",
        "savedSuccess": "交換記録を保存しました。もらうカードをコレクションに追加しました！",
        "saveFailed": "保存失敗：{{msg}}",
        "addedToList": "{{dir}}リストに追加：{{name}}",
        "alreadyInOutList": "このカードはすでに出すリストにあります",
        "saving": "保存中...",
        "estimateHKD": "評価額 HKD"
    }
}

for locale, path in LOCALES.items():
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    data['camera'] = camera_keys[locale]
    data['trade'] = trade_keys[locale]
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Updated {locale}")

print("\nDone!")
