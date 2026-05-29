#!/usr/bin/env python3
"""Fix hardcoded Chinese strings in remaining pages"""
import os

BASE = "/home/ubuntu/boxium-ptcg/client/src"

def fix_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            count += 1
        else:
            print(f"  ✗ NOT FOUND in {os.path.basename(path)}: {old[:50]}")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  Fixed {count}/{len(replacements)} in {os.path.basename(path)}")
    return count

# ─── ResendVerification.tsx ───────────────────────────────────────────────────
fix_file(f"{BASE}/pages/ResendVerification.tsx", [
    ('toast.error(error.message || "發送失敗，請稍後再試")', 'toast.error(error.message || t("login.sendFailed"))'),
    ('toast.error("請輸入電郵地址")', 'toast.error(t("resendVerification.enterEmail"))'),
    ('<h2 className="text-2xl font-bold text-white mb-2">重新發送驗證電郵</h2>', '<h2 className="text-2xl font-bold text-white mb-2">{t("resendVerification.title")}</h2>'),
    ('輸入您的電郵地址，我們將重新發送驗證連結', '{t("resendVerification.subtitle")}'),
    ('電郵地址', '{t("login.emailAddress")}'),
    ('? "發送中..."', '? t("login.sending")'),
    ('? `發送驗證電郵（${cooldown} 秒後）`', '? t("resendVerification.sendCooldown", { seconds: cooldown })'),
    (': "發送驗證電郵"}', ': t("resendVerification.sendButton")}'),
    ('>返回登入</Button>', '>{t("resendVerification.backToLogin")}</Button>'),
    ('<h2 className="text-2xl font-bold text-white">電郵已發送！</h2>', '<h2 className="text-2xl font-bold text-white">{t("resendVerification.emailSent")}</h2>'),
    ('驗證電郵已發送至 <strong className="text-white">{email}</strong>。<br />', '{t("resendVerification.sentTo")} <strong className="text-white">{email}</strong>.<br />'),
    ('請查看您的收件箱（包括垃圾郵件），點擊驗證連結完成帳號啟用。', '{t("resendVerification.checkInbox")}'),
    ('驗證連結將於 24 小時後過期。', '{t("resendVerification.linkExpiry")}'),
    ('{cooldown > 0 ? `重新發送（${cooldown} 秒後）` : "重新發送"}', '{cooldown > 0 ? t("resendVerification.resendCooldown", { seconds: cooldown }) : t("resendVerification.resend")}'),
])

# ─── ResetPassword.tsx ────────────────────────────────────────────────────────
fix_file(f"{BASE}/pages/ResetPassword.tsx", [
    ('setErrorMessage(error.message || "重設密碼失敗，連結可能已過期")', 'setErrorMessage(error.message || t("resetPassword.failed"))'),
    ('toast.error("密碼至少需要 8 個字元")', 'toast.error(t("resetPassword.passwordTooShort"))'),
    ('toast.error("兩次輸入的密碼不一致")', 'toast.error(t("resetPassword.passwordMismatch"))'),
    ('<h2 className="text-xl font-bold text-white mb-2">無效的連結</h2>', '<h2 className="text-xl font-bold text-white mb-2">{t("resetPassword.invalidLink")}</h2>'),
    ('<p className="text-sm text-white/60 mb-6">此密碼重設連結無效或已過期。</p>', '<p className="text-sm text-white/60 mb-6">{t("resetPassword.invalidLinkDesc")}</p>'),
])

# ─── VerifyEmail.tsx ──────────────────────────────────────────────────────────
fix_file(f"{BASE}/pages/VerifyEmail.tsx", [
    ('setErrorMessage(error.message || "驗證失敗，請重試")', 'setErrorMessage(error.message || t("verifyEmail.failed"))'),
    ('<h2 className="text-xl font-bold text-white mb-2">正在驗證電郵地址...</h2>', '<h2 className="text-xl font-bold text-white mb-2">{t("verifyEmail.verifying")}</h2>'),
    ('<h2 className="text-xl font-bold text-white mb-2">電郵驗證成功！🎉</h2>', '<h2 className="text-xl font-bold text-white mb-2">{t("verifyEmail.success")}</h2>'),
    ('您的帳號已成功啟用，歡迎加入 BOXIUM TCG！<br />', '{t("verifyEmail.successDesc")}<br />'),
])

# ─── Wishlist.tsx ─────────────────────────────────────────────────────────────
fix_file(f"{BASE}/pages/Wishlist.tsx", [
    ('>立即登入</Button>', '>{t("wishlist.loginNow")}</Button>'),
    ('>返回商城</Button>', '>{t("sellerPublicProfile.backToMarket")}</Button>'),
    ('共 {wishlistItems.length} 件', '{t("wishlist.totalItems", { n: wishlistItems.length })}'),
    ('>前往商城</Button>', '>{t("wishlist.goToMarket")}</Button>'),
    ('收藏於 {new Date(item.createdAt).toLocaleDateString("zh-HK")}', '{t("wishlist.savedOn", { date: new Date(item.createdAt).toLocaleDateString() })}'),
])

# ─── GradingMaintenanceGuard.tsx ──────────────────────────────────────────────
fix_file(f"{BASE}/components/GradingMaintenanceGuard.tsx", [
    ('>鑑定服務維護中</h2>', '>{t("maintenance.gradingTitle")}</h2>'),
    ('>PSA 代客鑑定服務目前正在進行系統維護，暫時無法接受新申請。</p>', '>{t("maintenance.gradingDesc")}</p>'),
    ('>維護期間如有查詢，請聯絡 BOXIUM 客服。</p>', '>{t("maintenance.contactSupport")}</p>'),
    ('>返回首頁</Button>', '>{t("common.backToHome")}</Button>'),
])

# ─── SellerCenterMaintenanceGuard.tsx ─────────────────────────────────────────
fix_file(f"{BASE}/components/SellerCenterMaintenanceGuard.tsx", [
    ('>賣家中心維護中</h2>', '>{t("maintenance.sellerTitle")}</h2>'),
    ('>賣家中心目前正在進行系統維護，暫時無法上架商品或管理訂單。</p>', '>{t("maintenance.sellerDesc")}</p>'),
    ('>維護期間如有查詢，請聯絡 BOXIUM 客服。</p>', '>{t("maintenance.contactSupport")}</p>'),
    ('>返回首頁</Button>', '>{t("common.backToHome")}</Button>'),
])

# ─── PwaInstallPrompt.tsx ─────────────────────────────────────────────────────
fix_file(f"{BASE}/components/PwaInstallPrompt.tsx", [
    ('aria-label="安裝 BOXIUM 應用程式"', 'aria-label={t("pwa.installLabel")}'),
    ('<p className="text-sm font-bold text-white leading-tight">加入主畫面</p>', '<p className="text-sm font-bold text-white leading-tight">{t("pwa.addToHome")}</p>'),
    ('像 App 一樣快速開啟 BOXIUM', '{t("pwa.openLikeApp")}'),
    ('>安裝</Button>', '>{t("pwa.install")}</Button>'),
    ('aria-label="加入主畫面說明"', 'aria-label={t("pwa.addToHomeLabel")}'),
])

# ─── ImageLightbox.tsx ────────────────────────────────────────────────────────
fix_file(f"{BASE}/components/ImageLightbox.tsx", [
    ('aria-label="關閉"', 'aria-label={t("common.close")}'),
    ('點擊任意位置或按 Esc 關閉', '{t("imageLightbox.closeHint")}'),
])

# ─── MobileSearchOverlay.tsx ──────────────────────────────────────────────────
fix_file(f"{BASE}/components/MobileSearchOverlay.tsx", [
    ('aria-label="圖片搜尋"', 'aria-label={t("search.imageSearch")}'),
    ('title="圖片搜尋"', 'title={t("search.imageSearch")}'),
])

# ─── CardSearchDropdown.tsx ───────────────────────────────────────────────────
fix_file(f"{BASE}/components/CardSearchDropdown.tsx", [
    ('title="拍照識別卡牌"', 'title={t("search.photoIdentify")}'),
])

# ─── TopNav.tsx ───────────────────────────────────────────────────────────────
fix_file(f"{BASE}/components/TopNav.tsx", [
    ('title="全部已讀"', 'title={t("notifications.markAllRead")}'),
])

# ─── PriceTrendChart.tsx ──────────────────────────────────────────────────────
fix_file(f"{BASE}/components/PriceTrendChart.tsx", [
    ('name={isSealedProduct ? "SNKRDUNK 卡盒" : "SNKRDUNK PSA 10"}', 'name={isSealedProduct ? t("priceTrendChart.snkrdunkBox") : t("priceTrendChart.snkrdunkPsa10")}'),
])

print("\nDone!")
