#!/usr/bin/env python3
"""Add contact page translation keys to all 3 locale files."""
import json

LOCALES_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"

NEW_KEYS = {
    "zh-TW": {
        "contact": {
            "heroTitle": "有任何問題？",
            "heroSubtitle": "我們隨時為您服務",
            "heroDesc": "無論是交易問題、功能建議或合作洽詢，歡迎透過以下方式與 BOXIUM 團隊聯繫。",
            "channels": "聯絡管道",
            "emailDesc": "一般查詢及技術支援",
            "facebookDesc": "追蹤最新消息與活動",
            "instagramDesc": "卡牌開箱與市場動態",
            "whatsappDesc": "即時訊息查詢",
            "responseTime": "回覆時間",
            "emailInquiry": "電郵查詢",
            "emailResponseTime": "1–2 個工作天",
            "socialResponseTime": "通常 24 小時內",
            "serviceHours": "服務時間：週一至週五 10:00–18:00 (HKT)",
            "faq1Q": "如何成為賣家？",
            "faq1A": "登入後前往「我的賣場」，完成 Stripe Connect 認證即可開始上架商品。",
            "faq2Q": "交易出現問題怎麼辦？",
            "faq2A": "請透過訂單頁面的「聯絡賣家」功能溝通，或直接發送電郵至 boxium.asia@gmail.com。",
            "faq3Q": "如何申請 PSA 鑑定服務？",
            "faq3A": "前往「PSA 鑑定」頁面填寫申請表格，我們的團隊將在 1-2 個工作天內回覆。",
            "faq4Q": "數據更新頻率是多少？",
            "faq4A": "我們的系統每 12 小時自動更新一次價格數據，確保您獲得最新的市場資訊。",
            "sendMessage": "發送訊息",
            "formSubtitle": "填寫表格，我們將盡快回覆您",
            "successFullDesc": "感謝您的留言，我們將在 1–2 個工作天內透過電郵回覆您。",
            "sendAgain": "再次發送",
            "selectSubject": "請選擇主題",
            "subjectTrade": "交易問題",
            "subjectAccount": "帳號問題",
            "subjectGrading": "PSA 鑑定查詢",
            "subjectData": "數據問題",
            "subjectFeature": "功能建議",
            "subjectBusiness": "商業合作",
            "subjectOther": "其他",
            "directEmailNote": "訊息將直接發送至我們的信箱，或直接發送電郵至",
        },
    },
    "en": {
        "contact": {
            "heroTitle": "Have any questions?",
            "heroSubtitle": "We're always here for you",
            "heroDesc": "Whether it's trading issues, feature suggestions, or business inquiries, feel free to reach out to the BOXIUM team.",
            "channels": "Contact Channels",
            "emailDesc": "General inquiries and technical support",
            "facebookDesc": "Follow latest news and events",
            "instagramDesc": "Card unboxing and market trends",
            "whatsappDesc": "Instant message inquiries",
            "responseTime": "Response Time",
            "emailInquiry": "Email inquiries",
            "emailResponseTime": "1–2 business days",
            "socialResponseTime": "Usually within 24 hours",
            "serviceHours": "Service hours: Mon–Fri 10:00–18:00 (HKT)",
            "faq1Q": "How do I become a seller?",
            "faq1A": "After logging in, go to 'My Store' and complete Stripe Connect verification to start listing items.",
            "faq2Q": "What if there's a problem with a transaction?",
            "faq2A": "Please communicate through the 'Contact Seller' feature on the order page, or email us directly at boxium.asia@gmail.com.",
            "faq3Q": "How do I apply for PSA grading service?",
            "faq3A": "Go to the 'PSA Grading' page and fill out the application form. Our team will respond within 1-2 business days.",
            "faq4Q": "How often is data updated?",
            "faq4A": "Our system automatically updates price data every 12 hours to ensure you get the latest market information.",
            "sendMessage": "Send Message",
            "formSubtitle": "Fill out the form and we'll reply as soon as possible",
            "successFullDesc": "Thank you for your message. We will reply via email within 1–2 business days.",
            "sendAgain": "Send Again",
            "selectSubject": "Select a subject",
            "subjectTrade": "Trading Issue",
            "subjectAccount": "Account Issue",
            "subjectGrading": "PSA Grading Inquiry",
            "subjectData": "Data Issue",
            "subjectFeature": "Feature Suggestion",
            "subjectBusiness": "Business Cooperation",
            "subjectOther": "Other",
            "directEmailNote": "Message will be sent directly to our inbox, or email us at",
        },
    },
    "ja": {
        "contact": {
            "heroTitle": "ご質問がありますか？",
            "heroSubtitle": "いつでもお手伝いします",
            "heroDesc": "取引の問題、機能の提案、ビジネスのお問い合わせなど、BOXIUMチームにお気軽にご連絡ください。",
            "channels": "連絡チャンネル",
            "emailDesc": "一般的なお問い合わせとテクニカルサポート",
            "facebookDesc": "最新ニュースとイベントをフォロー",
            "instagramDesc": "カード開封と市場動向",
            "whatsappDesc": "インスタントメッセージでのお問い合わせ",
            "responseTime": "返信時間",
            "emailInquiry": "メールでのお問い合わせ",
            "emailResponseTime": "1〜2営業日",
            "socialResponseTime": "通常24時間以内",
            "serviceHours": "営業時間：月〜金 10:00〜18:00 (HKT)",
            "faq1Q": "セラーになるにはどうすればいいですか？",
            "faq1A": "ログイン後、「マイストア」に移動してStripe Connect認証を完了すると、商品の出品を開始できます。",
            "faq2Q": "取引に問題が発生した場合はどうすればいいですか？",
            "faq2A": "注文ページの「セラーに連絡」機能を通じてコミュニケーションするか、boxium.asia@gmail.comに直接メールしてください。",
            "faq3Q": "PSAグレーディングサービスに申し込むにはどうすればいいですか？",
            "faq3A": "「PSAグレーディング」ページで申請フォームに記入してください。チームが1〜2営業日以内に返信します。",
            "faq4Q": "データはどのくらいの頻度で更新されますか？",
            "faq4A": "システムは12時間ごとに価格データを自動更新し、最新の市場情報を提供します。",
            "sendMessage": "メッセージを送信",
            "formSubtitle": "フォームに記入していただければ、できるだけ早くご返信します",
            "successFullDesc": "メッセージありがとうございます。1〜2営業日以内にメールでご返信いたします。",
            "sendAgain": "再送信",
            "selectSubject": "件名を選択",
            "subjectTrade": "取引の問題",
            "subjectAccount": "アカウントの問題",
            "subjectGrading": "PSAグレーディングのお問い合わせ",
            "subjectData": "データの問題",
            "subjectFeature": "機能の提案",
            "subjectBusiness": "ビジネス協力",
            "subjectOther": "その他",
            "directEmailNote": "メッセージは直接受信箱に送信されます。または直接メールしてください",
        },
    },
}


def deep_merge(base, updates, path=""):
    added = 0
    for key, value in updates.items():
        current_path = f"{path}.{key}" if path else key
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            added += deep_merge(base[key], value, current_path)
        elif key not in base:
            base[key] = value
            print(f"  + {current_path}")
            added += 1
    return added


total_added = 0
for lang, updates in NEW_KEYS.items():
    path = f"{LOCALES_DIR}/{lang}.json"
    print(f"\nProcessing {lang}.json...")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    added = deep_merge(data, updates)
    total_added += added
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"  => Added {added} new keys")

print(f"\nTotal: Added {total_added} keys")
