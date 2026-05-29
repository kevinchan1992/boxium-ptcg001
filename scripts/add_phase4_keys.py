#!/usr/bin/env python3
import json

LOCALE_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"
FILES = {
    "zh-TW": f"{LOCALE_DIR}/zh-TW.json",
    "en": f"{LOCALE_DIR}/en.json",
    "ja": f"{LOCALE_DIR}/ja.json",
}

NEW_KEYS = {
    "resendVerification": {
        "title": {"zh-TW": "重新發送驗證電郵", "en": "Resend Verification Email", "ja": "確認メールを再送"},
        "subtitle": {"zh-TW": "輸入您的電郵地址，我們將重新發送驗證連結", "en": "Enter your email address and we will resend the verification link", "ja": "メールアドレスを入力してください。確認リンクを再送します"},
        "enterEmail": {"zh-TW": "請輸入電郵地址", "en": "Please enter your email address", "ja": "メールアドレスを入力してください"},
        "sendCooldown": {"zh-TW": "發送驗證電郵（{{seconds}} 秒後）", "en": "Send Verification Email ({{seconds}}s)", "ja": "確認メールを送信（{{seconds}}秒後）"},
        "sendButton": {"zh-TW": "發送驗證電郵", "en": "Send Verification Email", "ja": "確認メールを送信"},
        "backToLogin": {"zh-TW": "返回登入", "en": "Back to Login", "ja": "ログインに戻る"},
        "emailSent": {"zh-TW": "電郵已發送！", "en": "Email Sent!", "ja": "メールを送信しました！"},
        "sentTo": {"zh-TW": "驗證電郵已發送至", "en": "Verification email sent to", "ja": "確認メールを送信しました："},
        "checkInbox": {"zh-TW": "請查看您的收件箱（包括垃圾郵件），點擊驗證連結完成帳號啟用。", "en": "Please check your inbox (including spam) and click the verification link to activate your account.", "ja": "受信トレイ（迷惑メールフォルダも含む）をご確認いただき、確認リンクをクリックしてアカウントを有効化してください。"},
        "linkExpiry": {"zh-TW": "驗證連結將於 24 小時後過期。", "en": "The verification link will expire in 24 hours.", "ja": "確認リンクは24時間後に期限切れになります。"},
        "resendCooldown": {"zh-TW": "重新發送（{{seconds}} 秒後）", "en": "Resend ({{seconds}}s)", "ja": "再送（{{seconds}}秒後）"},
        "resend": {"zh-TW": "重新發送", "en": "Resend", "ja": "再送"},
    },
    "resetPassword": {
        "failed": {"zh-TW": "重設密碼失敗，連結可能已過期", "en": "Password reset failed, the link may have expired", "ja": "パスワードのリセットに失敗しました。リンクが期限切れの可能性があります"},
        "passwordTooShort": {"zh-TW": "密碼至少需要 8 個字元", "en": "Password must be at least 8 characters", "ja": "パスワードは8文字以上必要です"},
        "passwordMismatch": {"zh-TW": "兩次輸入的密碼不一致", "en": "Passwords do not match", "ja": "パスワードが一致しません"},
        "invalidLink": {"zh-TW": "無效的連結", "en": "Invalid Link", "ja": "無効なリンク"},
        "invalidLinkDesc": {"zh-TW": "此密碼重設連結無效或已過期。", "en": "This password reset link is invalid or has expired.", "ja": "このパスワードリセットリンクは無効または期限切れです。"},
        "backToLogin": {"zh-TW": "返回登入", "en": "Back to Login", "ja": "ログインに戻る"},
        "title": {"zh-TW": "重設密碼", "en": "Reset Password", "ja": "パスワードをリセット"},
        "subtitle": {"zh-TW": "請輸入您的新密碼", "en": "Please enter your new password", "ja": "新しいパスワードを入力してください"},
        "newPassword": {"zh-TW": "新密碼", "en": "New Password", "ja": "新しいパスワード"},
        "passwordPlaceholder": {"zh-TW": "至少 8 個字元", "en": "At least 8 characters", "ja": "8文字以上"},
        "confirmPassword": {"zh-TW": "確認新密碼", "en": "Confirm New Password", "ja": "新しいパスワードを確認"},
        "confirmPlaceholder": {"zh-TW": "再次輸入新密碼", "en": "Re-enter new password", "ja": "新しいパスワードを再入力"},
        "resetting": {"zh-TW": "重設中...", "en": "Resetting...", "ja": "リセット中..."},
        "confirmReset": {"zh-TW": "確認重設密碼", "en": "Confirm Reset", "ja": "リセットを確認"},
        "successTitle": {"zh-TW": "密碼已重設！", "en": "Password Reset!", "ja": "パスワードをリセットしました！"},
        "successDesc": {"zh-TW": "您的密碼已成功更新，即將跳轉至登入頁面...", "en": "Your password has been updated. Redirecting to login...", "ja": "パスワードが更新されました。ログインページに移動します..."},
        "errorTitle": {"zh-TW": "重設失敗", "en": "Reset Failed", "ja": "リセット失敗"},
    },
    "verifyEmail": {
        "failed": {"zh-TW": "驗證失敗，請重試", "en": "Verification failed, please try again", "ja": "確認に失敗しました。もう一度お試しください"},
        "verifying": {"zh-TW": "正在驗證電郵地址...", "en": "Verifying email address...", "ja": "メールアドレスを確認中..."},
        "verifyingDesc": {"zh-TW": "請稍候，正在處理您的驗證請求", "en": "Please wait while we process your verification request", "ja": "確認リクエストを処理中です。しばらくお待ちください"},
        "success": {"zh-TW": "電郵驗證成功！🎉", "en": "Email Verified! 🎉", "ja": "メール確認完了！🎉"},
        "successDesc": {"zh-TW": "您的帳號已成功啟用，歡迎加入 BOXIUM TCG！", "en": "Your account has been activated. Welcome to BOXIUM TCG!", "ja": "アカウントが有効化されました。BOXIUM TCGへようこそ！"},
        "redirecting": {"zh-TW": "正在為您跳轉至主頁...", "en": "Redirecting to home page...", "ja": "ホームページに移動します..."},
        "goHome": {"zh-TW": "立即前往主頁", "en": "Go to Home", "ja": "ホームへ"},
        "errorTitle": {"zh-TW": "驗證失敗", "en": "Verification Failed", "ja": "確認失敗"},
        "resendEmail": {"zh-TW": "重新發送驗證電郵", "en": "Resend Verification Email", "ja": "確認メールを再送"},
        "backToHome": {"zh-TW": "返回主頁", "en": "Back to Home", "ja": "ホームに戻る"},
        "invalidLink": {"zh-TW": "無效的驗證連結", "en": "Invalid Verification Link", "ja": "無効な確認リンク"},
        "invalidLinkDesc": {"zh-TW": "此驗證連結無效。請從電郵中點擊驗證連結，或重新發送驗證電郵。", "en": "This verification link is invalid. Please click the link from your email or request a new one.", "ja": "この確認リンクは無効です。メールのリンクをクリックするか、新しいリンクをリクエストしてください。"},
    },
    "wishlist": {
        "loginNow": {"zh-TW": "立即登入", "en": "Login Now", "ja": "今すぐログイン"},
        "goToMarket": {"zh-TW": "前往商城", "en": "Go to Market", "ja": "マーケットへ"},
        "savedOn": {"zh-TW": "收藏於 {{date}}", "en": "Saved on {{date}}", "ja": "{{date}}に保存"},
    },
    "maintenance": {
        "gradingTitle": {"zh-TW": "鑑定服務維護中", "en": "Grading Service Maintenance", "ja": "鑑定サービスメンテナンス中"},
        "gradingDesc": {"zh-TW": "PSA 代客鑑定服務目前正在進行系統維護，暫時無法接受新申請。", "en": "PSA grading service is currently under maintenance and temporarily not accepting new applications.", "ja": "PSA代行鑑定サービスは現在システムメンテナンス中で、新規申請を一時的に受け付けていません。"},
        "sellerTitle": {"zh-TW": "賣家中心維護中", "en": "Seller Center Maintenance", "ja": "セラーセンターメンテナンス中"},
        "sellerDesc": {"zh-TW": "賣家中心目前正在進行系統維護，暫時無法上架商品或管理訂單。", "en": "Seller Center is currently under maintenance. Listing items and managing orders are temporarily unavailable.", "ja": "セラーセンターは現在システムメンテナンス中で、商品の出品や注文管理が一時的にご利用いただけません。"},
        "contactSupport": {"zh-TW": "維護期間如有查詢，請聯絡 BOXIUM 客服。", "en": "For inquiries during maintenance, please contact BOXIUM support.", "ja": "メンテナンス中のお問い合わせは、BOXIUMサポートまでご連絡ください。"},
    },
    "pwa": {
        "installLabel": {"zh-TW": "安裝 BOXIUM 應用程式", "en": "Install BOXIUM App", "ja": "BOXIUMアプリをインストール"},
        "addToHome": {"zh-TW": "加入主畫面", "en": "Add to Home Screen", "ja": "ホーム画面に追加"},
        "openLikeApp": {"zh-TW": "像 App 一樣快速開啟 BOXIUM", "en": "Open BOXIUM like a native app", "ja": "アプリのようにBOXIUMを素早く起動"},
        "install": {"zh-TW": "安裝", "en": "Install", "ja": "インストール"},
        "addToHomeLabel": {"zh-TW": "加入主畫面說明", "en": "Add to Home Screen instructions", "ja": "ホーム画面への追加手順"},
        "tapBottom": {"zh-TW": "點擊底部", "en": "Tap the bottom", "ja": "下部をタップ"},
        "share": {"zh-TW": "分享", "en": "Share", "ja": "共有"},
        "thenChoose": {"zh-TW": "→ 選擇", "en": "→ then choose", "ja": "→ 選択"},
    },
    "imageLightbox": {
        "closeHint": {"zh-TW": "點擊任意位置或按 Esc 關閉", "en": "Click anywhere or press Esc to close", "ja": "任意の場所をクリックするかEscキーで閉じる"},
    },
    "priceTrendChart": {
        "snkrdunkBox": {"zh-TW": "SNKRDUNK 卡盒", "en": "SNKRDUNK Box", "ja": "SNKRDUNKボックス"},
        "snkrdunkPsa10": {"zh-TW": "SNKRDUNK PSA 10", "en": "SNKRDUNK PSA 10", "ja": "SNKRDUNK PSA 10"},
    },
}

def deep_set(d, keys, value):
    for key in keys[:-1]:
        if key not in d:
            d[key] = {}
        d = d[key]
    if keys[-1] not in d:
        d[keys[-1]] = value
        return True
    return False

def flatten_keys(d, prefix=""):
    result = []
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict) and not any(lang in v for lang in ["zh-TW", "en", "ja"]):
            result.extend(flatten_keys(v, full_key))
        else:
            result.append((full_key, v))
    return result

locale_data = {}
for lang, path in FILES.items():
    with open(path, 'r', encoding='utf-8') as f:
        locale_data[lang] = json.load(f)

flat_keys = flatten_keys(NEW_KEYS)
added_count = {lang: 0 for lang in FILES}
for key_path, translations in flat_keys:
    for lang in FILES:
        keys = key_path.split(".")
        value = translations.get(lang, translations.get("zh-TW", ""))
        if deep_set(locale_data[lang], keys, value):
            added_count[lang] += 1

for lang, path in FILES.items():
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(locale_data[lang], f, ensure_ascii=False, indent=2)
    print(f"Saved {path}: added {added_count[lang]} new keys")

print("Done!")
