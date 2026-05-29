import json
import os

# Find i18n files
i18n_base = None
for root, dirs, files in os.walk('.'):
    for f in files:
        if f == 'zh-TW.json':
            path = os.path.join(root, f)
            if 'i18n' in path or 'locales' in path:
                i18n_base = os.path.dirname(path)
                break
    if i18n_base:
        break

if not i18n_base:
    # Try to find by listing
    import subprocess
    result = subprocess.run(['find', '.', '-name', 'zh-TW.json'], capture_output=True, text=True)
    paths = result.stdout.strip().split('\n')
    if paths:
        i18n_base = os.path.dirname(paths[0])

print(f"i18n base: {i18n_base}")

new_keys = {
    "gradingSubmit": {
        "terms": {
            "0": "本人確認所提交的卡牌為本人合法擁有，並非贓物或侵權物品。如日後發現卡牌來源有問題，本人須承擔一切法律責任。",
            "1": "本人明白 PSA 鑑定結果為最終結果，BOXIUM 無法干預評分，亦不保證任何特定評分。對評分結果有任何異議，須直接向 PSA 提出，BOXIUM 不負責跟進。",
            "2": "本人明白卡片一經提交 PSA 後，申請不可取消，費用亦不予退還。如需在 BOXIUM 收件後取消，須於 48 小時內書面通知並支付 HK$50 行政費。",
            "3": "本人明白客人自費寄件至 BOXIUM 的過程由客人自行承擔風險，BOXIUM 不負責寄件途中的遺失或損壞。強烈建議客人購買運輸保險。",
            "4": "本人明白鑑定完成後須於 30 天內完成付款。逾期未付款，BOXIUM 保留對相關卡片自行處理之權利，包括但不限於出售、捐贈或銷毀，客人將不獲任何賠償。",
            "5": "本人明白 BOXIUM 對 PSA 之任何服務中斷、政策變更、價格調整或其他不可抗力因素概不負責。",
            "6": "本人明白價格或會因應官方調整而更改，恕不另行通知。鑑定期以工作天計算，實際時間會根據官方實際情況而定，不包括運輸時間。",
            "7": "本人明白 BOXIUM 只作代理服務，卡牌鑑定期間由 PSA 負責保管，BOXIUM 不對 PSA 保管期間的任何損失負責。",
            "8": "本人明白提交申請即代表同意 BOXIUM 收集及使用本人的個人資料（包括姓名、聯絡方式及卡牌資料）用於處理本次申請。",
            "9": "本人確認所填寫的資料屬實，如有虛假陳述，BOXIUM 保留拒絕服務及追究責任的權利。"
        },
        "draft": {
            "justNow": "剛才",
            "minutesAgo": "{{count}} 分鐘前",
            "hoursAgo": "{{count}} 小時前",
            "yesterday": "昨天",
            "daysAgo": "{{count}} 天前",
            "tomorrow": "明天",
            "withinOneDay": "1 天內",
            "expiresWarning": "草稿將於{{when}}自動刪除，請盡快繼續申請",
            "foundDraft": "發現上次未完成的",
            "cardCount": "共 {{types}} 種卡牌（{{qty}} 張）",
            "tierSelected": "已選層級",
            "selectedTier": "已選層級：",
            "continueDraft": "繼續上次的申請",
            "deleteDraft": "刪除草稿，開新申請"
        },
        "address": {
            "regionDefault": "香港"
        },
        "toast": {
            "submitFailed": "提交失敗：{{msg}}",
            "addressSaved": "地址已儲存到個人中心",
            "needOneCard": "至少需要一張卡牌",
            "selectTier": "請選擇服務層級",
            "selectCardData": "請為每張卡牌選擇卡牌資料",
            "fillCardName": "請填寫卡牌名稱",
            "agreeTerms": "請先閱讀並同意服務條款",
            "fillNamePhone": "請填寫收件人姓名和電話",
            "selectSFStation": "請選擇順豐自提站",
            "fillAddress": "請填寫詳細地址"
        },
        "loginRequired": {
            "title": "請先登入",
            "desc": "提交 PSA 鑑定申請需要登入帳號",
            "btn": "登入 / 註冊"
        },
        "pageTitle": "PSA 代客鑑定申請",
        "pageDesc": "填寫卡牌資料，提交後請打印申請單連同卡牌寄出",
        "selectTier": {
            "title": "選擇服務層級",
            "desc": "此次申請的所有卡牌將使用相同服務層級",
            "nextStep": "下一步：填寫卡牌資料",
            "selected": "已選服務層級",
            "change": "更改"
        },
        "addCard": "新增卡牌",
        "feeCalc": "{{qty}} 張 × HK${{fee}}",
        "totalFee": "合計 HK${{fee}}",
        "nextConfirm": "下一步：確認提交",
        "feeBreakdown": "費用明細",
        "unknownCard": "未知卡牌",
        "totalPSAFee": "代送 PSA 費用合計",
        "cardCountFeeNote": "共 {{count}} 張卡牌 · 費用已包含 BOXIUM 代辦服務費",
        "returnAddress": {
            "title": "客戶收貨地址",
            "subtitle": "（鑑定完成後回寄）"
        },
        "sfCOD": "順豐到付",
        "sfCODDesc": "所有回寄貨物均以順豐到付方式寄出，達付時預計進行收貨。如選擇順豐自提站，請確保站點已開放接件。",
        "noSavedAddress": "您尚未儲存任何收貨地址",
        "fillAddressOr": "請在下方填寫收貨地址，或先前往",
        "saveCommonAddress": "儲存常用地址。",
        "savedAddresses": "已儲存地址",
        "enterNewAddress": "輸入新地址",
        "defaultLabel": "預設",
        "sfStation": "順豐站",
        "sfStationCode": "順豐站",
        "useOtherAddress": "使用其他地址",
        "recipientName": "收件人姓名",
        "recipientNamePlaceholder": "例：陳大文",
        "phone": "聯絡電話",
        "phonePlaceholder": "例：9123 4567",
        "regularAddress": "一般地址",
        "sfPickupStation": "順豐自提站",
        "detailedAddress": "詳細地址",
        "addressPlaceholder": "例：九龍旺角彌敦道 123 號 XX 大廈 5 樓 A 室",
        "district": "地區",
        "districtPlaceholder": "例：旺角",
        "city": "城市",
        "cityPlaceholder": "香港",
        "searchSFStation": "搜尋順豐自提站",
        "sfStationPlaceholder": "輸入站點名稱或地區，如：旺角、屬山、852FTL",
        "noStationFound": "找不到符合的站點",
        "saveAddressToProfile": "儲存此地址到個人中心，方便下次使用",
        "backToSavedAddresses": "← 返回選擇已儲存地址",
        "termsTitle": "服務條款",
        "agreeTermsLabel": "我已閱讀並同意以上所有服務條款，並確認所提交資料屬實。",
        "backToEdit": "返回修改",
        "submitApplication": "提交申請",
        "changeCard": "更換",
        "success": {
            "title": "申請已成功提交！",
            "payNow": "請立即完成付款，否則申請將無法進入處理流程",
            "cardCountFee": "共 {{count}} 張卡牌 · 費用合計",
            "goToDetail": "前往申請詳情頁完成付款",
            "nextStepsTitle": "付款後的下一步",
            "step1": "付款確認後，系統將自動發送確認通知（站內訊息 + Email），包含 BOXIUM 送件地址",
            "step2": "請打印申請單，連同卡牌自費寄至 BOXIUM 指定地址（順豐站 852Z351）",
            "step3": "BOXIUM 確認收件後，代辦 PSA 申報及專業包裝，每月 2 次出團直送美國 PSA",
            "viewAllApplications": "查看所有申請記錄"
        }
    }
}

en_keys = {
    "gradingSubmit": {
        "terms": {
            "0": "I confirm that the cards submitted are legally owned by me and are not stolen or counterfeit goods. If the source of the cards is found to be problematic in the future, I shall bear all legal responsibilities.",
            "1": "I understand that PSA grading results are final. BOXIUM cannot intervene in grading and does not guarantee any specific grade. Any disputes regarding grading must be raised directly with PSA; BOXIUM is not responsible for follow-up.",
            "2": "I understand that once cards are submitted to PSA, the application cannot be cancelled and fees are non-refundable. If cancellation is needed after BOXIUM receives the cards, written notice must be given within 48 hours and an administrative fee of HK$50 will apply.",
            "3": "I understand that shipping cards to BOXIUM at my own expense is at my own risk. BOXIUM is not responsible for loss or damage during shipping. Purchasing shipping insurance is strongly recommended.",
            "4": "I understand that payment must be completed within 30 days after grading is done. If payment is overdue, BOXIUM reserves the right to dispose of the cards, including but not limited to selling, donating, or destroying them, without any compensation.",
            "5": "I understand that BOXIUM is not responsible for any service interruptions, policy changes, price adjustments, or other force majeure events from PSA.",
            "6": "I understand that prices may change due to official adjustments without prior notice. Grading time is calculated in business days and actual time depends on PSA's actual situation, excluding shipping time.",
            "7": "I understand that BOXIUM acts as an agent only. Cards are kept by PSA during the grading period. BOXIUM is not responsible for any losses during PSA's custody.",
            "8": "I understand that submitting this application means I agree to BOXIUM collecting and using my personal data (including name, contact information, and card details) for processing this application.",
            "9": "I confirm that the information provided is accurate. If there is any false statement, BOXIUM reserves the right to refuse service and pursue liability."
        },
        "draft": {
            "justNow": "Just now",
            "minutesAgo": "{{count}} min ago",
            "hoursAgo": "{{count}} hr ago",
            "yesterday": "Yesterday",
            "daysAgo": "{{count}} days ago",
            "tomorrow": "tomorrow",
            "withinOneDay": "within 1 day",
            "expiresWarning": "Draft will be deleted {{when}}, please continue soon",
            "foundDraft": "Found unfinished draft",
            "cardCount": "{{types}} types ({{qty}} cards)",
            "tierSelected": "Tier selected",
            "selectedTier": "Selected tier: ",
            "continueDraft": "Continue last application",
            "deleteDraft": "Delete draft, start new"
        },
        "address": {
            "regionDefault": "Hong Kong"
        },
        "toast": {
            "submitFailed": "Submit failed: {{msg}}",
            "addressSaved": "Address saved to profile",
            "needOneCard": "At least one card is required",
            "selectTier": "Please select a service tier",
            "selectCardData": "Please select card data for each card",
            "fillCardName": "Please fill in the card name",
            "agreeTerms": "Please read and agree to the terms of service",
            "fillNamePhone": "Please fill in recipient name and phone",
            "selectSFStation": "Please select an SF Express station",
            "fillAddress": "Please fill in the detailed address"
        },
        "loginRequired": {
            "title": "Please Log In",
            "desc": "You need to log in to submit a PSA grading application",
            "btn": "Log In / Register"
        },
        "pageTitle": "PSA Grading Service Application",
        "pageDesc": "Fill in card details, then print the application form and send it with your cards",
        "selectTier": {
            "title": "Select Service Tier",
            "desc": "All cards in this application will use the same service tier",
            "nextStep": "Next: Fill Card Details",
            "selected": "Selected Service Tier",
            "change": "Change"
        },
        "addCard": "Add Card",
        "feeCalc": "{{qty}} cards × HK${{fee}}",
        "totalFee": "Total HK${{fee}}",
        "nextConfirm": "Next: Confirm Submission",
        "feeBreakdown": "Fee Breakdown",
        "unknownCard": "Unknown Card",
        "totalPSAFee": "Total PSA Proxy Fee",
        "cardCountFeeNote": "{{count}} cards total · Fee includes BOXIUM service charge",
        "returnAddress": {
            "title": "Return Address",
            "subtitle": "(Return shipping after grading)"
        },
        "sfCOD": "SF Express COD",
        "sfCODDesc": "All return shipments are sent via SF Express COD. Please ensure SF stations are open for pickup if selected.",
        "noSavedAddress": "No saved address found",
        "fillAddressOr": "Please fill in an address below, or go to",
        "saveCommonAddress": "to save a common address.",
        "savedAddresses": "Saved Addresses",
        "enterNewAddress": "Enter New Address",
        "defaultLabel": "Default",
        "sfStation": "SF Station",
        "sfStationCode": "SF Station",
        "useOtherAddress": "Use Other Address",
        "recipientName": "Recipient Name",
        "recipientNamePlaceholder": "e.g. Chan Tai Man",
        "phone": "Phone",
        "phonePlaceholder": "e.g. 9123 4567",
        "regularAddress": "Regular Address",
        "sfPickupStation": "SF Pickup Station",
        "detailedAddress": "Detailed Address",
        "addressPlaceholder": "e.g. Flat A, 5/F, XX Building, 123 Nathan Road, Mong Kok, Kowloon",
        "district": "District",
        "districtPlaceholder": "e.g. Mong Kok",
        "city": "City",
        "cityPlaceholder": "Hong Kong",
        "searchSFStation": "Search SF Station",
        "sfStationPlaceholder": "Enter station name or area, e.g. Mong Kok, 852FTL",
        "noStationFound": "No matching station found",
        "saveAddressToProfile": "Save this address to profile for future use",
        "backToSavedAddresses": "← Back to saved addresses",
        "termsTitle": "Terms of Service",
        "agreeTermsLabel": "I have read and agree to all terms of service above, and confirm that the information submitted is accurate.",
        "backToEdit": "Back to Edit",
        "submitApplication": "Submit Application",
        "changeCard": "Change",
        "success": {
            "title": "Application Submitted Successfully!",
            "payNow": "Please complete payment now, otherwise the application cannot be processed",
            "cardCountFee": "{{count}} cards total · Total fee",
            "goToDetail": "Go to Application Detail to Complete Payment",
            "nextStepsTitle": "Next Steps After Payment",
            "step1": "After payment confirmation, the system will send a confirmation notification (in-app + Email) with BOXIUM's shipping address",
            "step2": "Please print the application form and ship your cards to BOXIUM's designated address (SF Station 852Z351) at your own expense",
            "step3": "After BOXIUM confirms receipt, we will handle PSA declaration and professional packaging, with 2 shipments to PSA in the US per month",
            "viewAllApplications": "View All Applications"
        }
    }
}

ja_keys = {
    "gradingSubmit": {
        "terms": {
            "0": "提出するカードは合法的に所有しており、盗品や侵害品ではないことを確認します。",
            "1": "PSAのグレーディング結果は最終的なものであり、BOXIUMはグレーディングに介入できず、特定のグレードを保証しません。",
            "2": "カードをPSAに提出した後、申請はキャンセルできず、費用は返金されません。",
            "3": "BOXIUMへの自費配送は自己責任です。BOXIUMは配送中の紛失や損傷に責任を負いません。",
            "4": "グレーディング完了後30日以内に支払いを完了する必要があります。",
            "5": "BOXIUMはPSAのサービス中断、ポリシー変更、価格調整などに責任を負いません。",
            "6": "価格は予告なく変更される場合があります。グレーディング期間は営業日で計算されます。",
            "7": "BOXIUMは代理サービスのみを提供します。グレーディング期間中のカードはPSAが管理します。",
            "8": "申請を提出することで、BOXIUMが個人情報を収集・使用することに同意します。",
            "9": "提供した情報が正確であることを確認します。"
        },
        "draft": {
            "justNow": "たった今",
            "minutesAgo": "{{count}}分前",
            "hoursAgo": "{{count}}時間前",
            "yesterday": "昨日",
            "daysAgo": "{{count}}日前",
            "tomorrow": "明日",
            "withinOneDay": "1日以内",
            "expiresWarning": "下書きは{{when}}に削除されます",
            "foundDraft": "未完了の下書きが見つかりました",
            "cardCount": "{{types}}種類（{{qty}}枚）",
            "tierSelected": "ティア選択済み",
            "selectedTier": "選択ティア：",
            "continueDraft": "前回の申請を続ける",
            "deleteDraft": "下書きを削除して新規申請"
        },
        "address": {
            "regionDefault": "香港"
        },
        "toast": {
            "submitFailed": "送信失敗：{{msg}}",
            "addressSaved": "住所をプロフィールに保存しました",
            "needOneCard": "少なくとも1枚のカードが必要です",
            "selectTier": "サービスティアを選択してください",
            "selectCardData": "各カードのカードデータを選択してください",
            "fillCardName": "カード名を入力してください",
            "agreeTerms": "利用規約を読んで同意してください",
            "fillNamePhone": "受取人名と電話番号を入力してください",
            "selectSFStation": "SF Expressステーションを選択してください",
            "fillAddress": "詳細住所を入力してください"
        },
        "loginRequired": {
            "title": "ログインが必要です",
            "desc": "PSAグレーディング申請を提出するにはログインが必要です",
            "btn": "ログイン / 登録"
        },
        "pageTitle": "PSA代理グレーディング申請",
        "pageDesc": "カード情報を入力し、申請書を印刷してカードと一緒に送付してください",
        "selectTier": {
            "title": "サービスティアを選択",
            "desc": "この申請のすべてのカードに同じサービスティアが適用されます",
            "nextStep": "次へ：カード情報を入力",
            "selected": "選択済みサービスティア",
            "change": "変更"
        },
        "addCard": "カードを追加",
        "feeCalc": "{{qty}}枚 × HK${{fee}}",
        "totalFee": "合計 HK${{fee}}",
        "nextConfirm": "次へ：送信確認",
        "feeBreakdown": "料金明細",
        "unknownCard": "不明なカード",
        "totalPSAFee": "PSA代理料金合計",
        "cardCountFeeNote": "合計{{count}}枚 · 料金にはBOXIUMサービス料が含まれます",
        "returnAddress": {
            "title": "返送先住所",
            "subtitle": "（グレーディング完了後に返送）"
        },
        "sfCOD": "SF Express 着払い",
        "sfCODDesc": "すべての返送はSF Express着払いで行われます。",
        "noSavedAddress": "保存済みの住所がありません",
        "fillAddressOr": "以下に住所を入力するか、",
        "saveCommonAddress": "で住所を保存してください。",
        "savedAddresses": "保存済み住所",
        "enterNewAddress": "新しい住所を入力",
        "defaultLabel": "デフォルト",
        "sfStation": "SFステーション",
        "sfStationCode": "SFステーション",
        "useOtherAddress": "別の住所を使用",
        "recipientName": "受取人名",
        "recipientNamePlaceholder": "例：山田太郎",
        "phone": "電話番号",
        "phonePlaceholder": "例：9123 4567",
        "regularAddress": "通常住所",
        "sfPickupStation": "SF受取ステーション",
        "detailedAddress": "詳細住所",
        "addressPlaceholder": "例：〇〇ビル5F A室",
        "district": "地区",
        "districtPlaceholder": "例：旺角",
        "city": "都市",
        "cityPlaceholder": "香港",
        "searchSFStation": "SFステーションを検索",
        "sfStationPlaceholder": "ステーション名または地区を入力",
        "noStationFound": "該当するステーションが見つかりません",
        "saveAddressToProfile": "この住所をプロフィールに保存",
        "backToSavedAddresses": "← 保存済み住所に戻る",
        "termsTitle": "利用規約",
        "agreeTermsLabel": "上記の利用規約をすべて読んで同意し、提出した情報が正確であることを確認します。",
        "backToEdit": "編集に戻る",
        "submitApplication": "申請を送信",
        "changeCard": "変更",
        "success": {
            "title": "申請が正常に送信されました！",
            "payNow": "今すぐお支払いを完了してください。そうしないと申請を処理できません",
            "cardCountFee": "合計{{count}}枚 · 合計料金",
            "goToDetail": "申請詳細ページで支払いを完了",
            "nextStepsTitle": "支払い後の次のステップ",
            "step1": "支払い確認後、確認通知（アプリ内 + メール）が送信されます",
            "step2": "申請書を印刷し、カードをBOXIUMの指定住所に自費で送付してください",
            "step3": "BOXIUMが受領確認後、PSA申告と専門梱包を代行します",
            "viewAllApplications": "すべての申請を表示"
        }
    }
}

def deep_merge(base, updates):
    for k, v in updates.items():
        if k in base and isinstance(base[k], dict) and isinstance(v, dict):
            deep_merge(base[k], v)
        else:
            base[k] = v

# Load and update each locale file
locales = {
    'zh-TW': new_keys,
    'en': en_keys,
    'ja': ja_keys,
}

for locale, keys in locales.items():
    path = os.path.join(i18n_base, f'{locale}.json')
    if not os.path.exists(path):
        print(f"File not found: {path}")
        continue
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    deep_merge(data, keys)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {path}")

print("Done!")
