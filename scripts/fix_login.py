#!/usr/bin/env python3
"""Fix hardcoded Chinese strings in Login.tsx"""

FILE = "/home/ubuntu/boxium-ptcg/client/src/pages/Login.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Error messages in useEffect/handlers
    ('toast.error(err.message || "發送失敗，請稍後再試")', 'toast.error(err.message || t("login.sendFailed"))'),
    ('setErrorMessage("帳號建立失敗，請稍後再試或聯絡客服")', 'setErrorMessage(t("login.accountCreateFailed"))'),
    ('setErrorMessage("Google 登入失敗，請稍後再試")', 'setErrorMessage(t("login.googleLoginFailed"))'),
    ('setErrorMessage("無法取得 Google 帳號 Email，請確認授權設定")', 'setErrorMessage(t("login.googleEmailFailed"))'),
    ('setErrorMessage("Apple 登入已取消")', 'setErrorMessage(t("login.appleLoginCancelled"))'),
    ('setErrorMessage("Apple 登入失敗，請稍後再試或使用其他登入方式")', 'setErrorMessage(t("login.appleLoginFailed"))'),
    ('setErrorMessage("Apple 帳號建立失敗，請稍後再試或聯絡客服")', 'setErrorMessage(t("login.appleAccountCreateFailed"))'),
    ('setErrorMessage("Apple 登入驗證失敗，請重試")', 'setErrorMessage(t("login.appleVerifyFailed"))'),
    ('setErrorMessage("Apple 登入 Token 無效，請重試")', 'setErrorMessage(t("login.appleTokenInvalid"))'),
    ('onSuccess: () => toast.success("驗證電郵已重新發送！"),', 'onSuccess: () => toast.success(t("login.verifyEmailResent")),'),
    ('onError: () => toast.error("發送失敗，請稍後再試"),', 'onError: () => toast.error(t("login.sendFailed")),'),
    ('const msg = error.message || "登入失敗";', 'const msg = error.message || t("login.loginFailed");'),
    
    # DEV mode messages
    ('toast.success(`[DEV] 已以 ${data.user.name || data.user.email} 身份登入`)', 'toast.success(`[DEV] Logged in as ${data.user.name || data.user.email}`)'),
    ('toast.error("Dev 登入失敗: " + (data.error || "未知錯誤"))', 'toast.error("Dev login failed: " + (data.error || "Unknown error"))'),
    ('toast.error("Dev 登入失敗: " + e.message)', 'toast.error("Dev login failed: " + e.message)'),
    
    # UI text
    ('<p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>輸入您的帳號密碼以登入 BOXIUM TCG</p>', '<p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{t("login.subtitle")}</p>'),
    ('<p className="font-semibold mb-1">您的電郵尚未驗證</p>', '<p className="font-semibold mb-1">{t("login.emailNotVerified")}</p>'),
    ('<p className="text-sm mb-2">請查看您的收件箱，點擊驗證連結完成帳號啟用。</p>', '<p className="text-sm mb-2">{t("login.checkInbox")}</p>'),
    ('{resendMutation.isPending ? "發送中..." : "重新發送驗證電郵"}', '{resendMutation.isPending ? t("login.sending") : t("login.resendVerifyEmail")}'),
    ('{isLoading ? "登入中..." : "登入"}', '{isLoading ? t("login.loggingIn") : t("login.loginButton")}'),
    ('忘記密碼？', '{t("login.forgotPassword")}'),
    ('<span className="px-3 text-white/35" style={{ background: "transparent" }}>或使用社交帳號</span>', '<span className="px-3 text-white/35" style={{ background: "transparent" }}>{t("login.orUseSocial")}</span>'),
    ('使用 Google 登入', '{t("login.loginWithGoogle")}'),
    ('使用 Apple 登入', '{t("login.loginWithApple")}'),
    ('還沒有帳號？{" "}', '{t("login.noAccount")}{" "}'),
    ('立即註冊', '{t("login.registerNow")}'),
    ('登入即表示你同意我們的{" "}', '{t("login.agreeToTerms")}{" "}'),
    ('隱私政策', '{t("login.privacyPolicy")}'),
    ('{devLoading ? "登入中..." : "⚡ 開發模式快速登入 (Admin id=1)"}', '{devLoading ? t("login.loggingIn") : "⚡ Dev Quick Login (Admin id=1)"}'),
    
    # Forgot password dialog
    ('<DialogTitle>忘記密碼</DialogTitle>', '<DialogTitle>{t("login.forgotPasswordTitle")}</DialogTitle>'),
    ('? "重設密碼的電郵已發送，請檢查你的收件包。"', '? t("login.resetEmailSent")'),
    (': "輸入你的註冊 Email，我們會發送重設密碼的連結。"}', ': t("login.enterEmailForReset")}'),
    ('已發送至 <strong>{forgotEmail}</strong>', '{t("login.sentTo")} <strong>{forgotEmail}</strong>'),
    ('<p className="text-xs text-gray-400 text-center">若沒收到電郵，請檢查垃圾郵件夺。</p>', '<p className="text-xs text-gray-400 text-center">{t("login.checkSpam")}</p>'),
    ('<Label htmlFor="forgot-email" className="text-sm font-medium">Email 地址</Label>', '<Label htmlFor="forgot-email" className="text-sm font-medium">{t("login.emailAddress")}</Label>'),
    ('>完成</Button>', '>{t("common.done")}</Button>'),
    ('>取消</Button>', '>{t("common.cancel")}</Button>'),
    ('{forgotPasswordMutation.isPending ? "發送中..." : "發送重設連結"}', '{forgotPasswordMutation.isPending ? t("login.sending") : t("login.sendResetLink")}'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  ✓ Replaced: {old[:60]}")
    else:
        print(f"  ✗ NOT FOUND: {old[:60]}")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal replacements: {count}")
