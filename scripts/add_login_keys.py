#!/usr/bin/env python3
import json

LOCALE_DIR = "/home/ubuntu/boxium-ptcg/client/src/locales"
FILES = {
    "zh-TW": f"{LOCALE_DIR}/zh-TW.json",
    "en": f"{LOCALE_DIR}/en.json",
    "ja": f"{LOCALE_DIR}/ja.json",
}

NEW_KEYS = {
    "login": {
        "sendFailed": {"zh-TW": "發送失敗，請稍後再試", "en": "Send failed, please try again later", "ja": "送信に失敗しました。後でもう一度お試しください"},
        "accountCreateFailed": {"zh-TW": "帳號建立失敗，請稍後再試或聯絡客服", "en": "Account creation failed, please try again or contact support", "ja": "アカウント作成に失敗しました。後でもう一度試すかサポートにお問い合わせください"},
        "googleLoginFailed": {"zh-TW": "Google 登入失敗，請稍後再試", "en": "Google login failed, please try again", "ja": "Googleログインに失敗しました。後でもう一度お試しください"},
        "googleEmailFailed": {"zh-TW": "無法取得 Google 帳號 Email，請確認授權設定", "en": "Unable to get Google account email, please check authorization settings", "ja": "GoogleアカウントのEmailを取得できません。認証設定を確認してください"},
        "appleLoginCancelled": {"zh-TW": "Apple 登入已取消", "en": "Apple login cancelled", "ja": "Appleログインがキャンセルされました"},
        "appleLoginFailed": {"zh-TW": "Apple 登入失敗，請稍後再試或使用其他登入方式", "en": "Apple login failed, please try again or use another login method", "ja": "Appleログインに失敗しました。後でもう一度試すか別のログイン方法をお使いください"},
        "appleAccountCreateFailed": {"zh-TW": "Apple 帳號建立失敗，請稍後再試或聯絡客服", "en": "Apple account creation failed, please try again or contact support", "ja": "Appleアカウント作成に失敗しました。後でもう一度試すかサポートにお問い合わせください"},
        "appleVerifyFailed": {"zh-TW": "Apple 登入驗證失敗，請重試", "en": "Apple login verification failed, please retry", "ja": "Appleログインの確認に失敗しました。再試行してください"},
        "appleTokenInvalid": {"zh-TW": "Apple 登入 Token 無效，請重試", "en": "Apple login token invalid, please retry", "ja": "AppleログインのTokenが無効です。再試行してください"},
        "verifyEmailResent": {"zh-TW": "驗證電郵已重新發送！", "en": "Verification email resent!", "ja": "確認メールを再送しました！"},
        "loginFailed": {"zh-TW": "登入失敗", "en": "Login failed", "ja": "ログインに失敗しました"},
        "subtitle": {"zh-TW": "輸入您的帳號密碼以登入 BOXIUM TCG", "en": "Enter your credentials to login to BOXIUM TCG", "ja": "BOXIUM TCGにログインするための認証情報を入力してください"},
        "emailNotVerified": {"zh-TW": "您的電郵尚未驗證", "en": "Your email is not verified", "ja": "メールアドレスが確認されていません"},
        "checkInbox": {"zh-TW": "請查看您的收件箱，點擊驗證連結完成帳號啟用。", "en": "Please check your inbox and click the verification link to activate your account.", "ja": "受信トレイを確認し、確認リンクをクリックしてアカウントを有効化してください。"},
        "sending": {"zh-TW": "發送中...", "en": "Sending...", "ja": "送信中..."},
        "resendVerifyEmail": {"zh-TW": "重新發送驗證電郵", "en": "Resend Verification Email", "ja": "確認メールを再送"},
        "loggingIn": {"zh-TW": "登入中...", "en": "Logging in...", "ja": "ログイン中..."},
        "loginButton": {"zh-TW": "登入", "en": "Login", "ja": "ログイン"},
        "forgotPassword": {"zh-TW": "忘記密碼？", "en": "Forgot password?", "ja": "パスワードをお忘れですか？"},
        "orUseSocial": {"zh-TW": "或使用社交帳號", "en": "Or use social account", "ja": "またはソーシャルアカウントを使用"},
        "loginWithGoogle": {"zh-TW": "使用 Google 登入", "en": "Login with Google", "ja": "Googleでログイン"},
        "loginWithApple": {"zh-TW": "使用 Apple 登入", "en": "Login with Apple", "ja": "Appleでログイン"},
        "noAccount": {"zh-TW": "還沒有帳號？", "en": "Don't have an account?", "ja": "アカウントをお持ちでないですか？"},
        "registerNow": {"zh-TW": "立即註冊", "en": "Register now", "ja": "今すぐ登録"},
        "agreeToTerms": {"zh-TW": "登入即表示你同意我們的", "en": "By logging in, you agree to our", "ja": "ログインすることで、当社の"},
        "privacyPolicy": {"zh-TW": "隱私政策", "en": "Privacy Policy", "ja": "プライバシーポリシー"},
        "forgotPasswordTitle": {"zh-TW": "忘記密碼", "en": "Forgot Password", "ja": "パスワードをお忘れですか"},
        "resetEmailSent": {"zh-TW": "重設密碼的電郵已發送，請檢查你的收件包。", "en": "Password reset email sent, please check your inbox.", "ja": "パスワードリセットメールを送信しました。受信トレイを確認してください。"},
        "enterEmailForReset": {"zh-TW": "輸入你的註冊 Email，我們會發送重設密碼的連結。", "en": "Enter your registered email and we'll send you a password reset link.", "ja": "登録したメールアドレスを入力してください。パスワードリセットリンクをお送りします。"},
        "sentTo": {"zh-TW": "已發送至", "en": "Sent to", "ja": "送信先："},
        "checkSpam": {"zh-TW": "若沒收到電郵，請檢查垃圾郵件夾。", "en": "If you didn't receive the email, please check your spam folder.", "ja": "メールが届かない場合は、迷惑メールフォルダを確認してください。"},
        "emailAddress": {"zh-TW": "Email 地址", "en": "Email Address", "ja": "メールアドレス"},
        "sendResetLink": {"zh-TW": "發送重設連結", "en": "Send Reset Link", "ja": "リセットリンクを送信"},
    },
    "common": {
        "done": {"zh-TW": "完成", "en": "Done", "ja": "完了"},
        "cancel": {"zh-TW": "取消", "en": "Cancel", "ja": "キャンセル"},
    }
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
