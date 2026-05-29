/**
 * PwaInstallPrompt
 * 顯示「加入主畫面」安裝提示橫幅
 * - Android Chrome：攔截 beforeinstallprompt 事件，顯示自訂橫幅
 * - iOS Safari：偵測 standalone 未安裝時，顯示操作說明
 * - 已安裝或用戶關閉後，30 天內不再顯示
 */

import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { useTranslation } from "react-i18next";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 30;

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  } catch {}
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isDismissed() || isInStandaloneMode()) return;

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroid(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari: show manual instructions
    if (isIos() && !isInStandaloneMode()) {
      // Delay slightly so it doesn't flash on first load
      const timer = setTimeout(() => setShowIos(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      dismiss();
    }
    setDeferredPrompt(null);
    setShowAndroid(false);
  };

  const handleDismiss = () => {
    dismiss();
    setShowAndroid(false);
    setShowIos(false);
  };

  // Android install banner
  if (showAndroid) {
    return (
      <div
        className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+8px)] left-3 right-3 z-50 md:hidden"
        role="banner"
        aria-label={t("pwa.installLabel")}
      >
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
          style={{ background: "#06038D", border: "2px solid #FEDD00" }}
        >
          <img
            src="/favicon-192x192.png"
            alt="BOXIUM"
            className="w-10 h-10 rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">{t("pwa.addToHome")}</p>
            <p className="text-xs text-white/60 mt-0.5 leading-tight">
              {t("pwa.openLikeApp")}
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0"
            style={{ background: "#FEDD00", color: "#06038D" }}
          >
            <Download className="w-3.5 h-3.5" />
            {t("pwa.install")}
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // iOS install instructions
  if (showIos) {
    return (
      <div
        className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+8px)] left-3 right-3 z-50 md:hidden"
        role="banner"
        aria-label={t("pwa.addToHomeLabel")}
      >
        <div
          className="rounded-2xl px-4 py-3 shadow-2xl"
          style={{ background: "#06038D", border: "2px solid #FEDD00" }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <img
                src="/favicon-192x192.png"
                alt="BOXIUM"
                className="w-8 h-8 rounded-xl flex-shrink-0"
              />
              <p className="text-sm font-bold text-white">{t("pwa.addToHome")}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span>{t("pwa.tapBottom")}</span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-white font-medium"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <Share className="w-3 h-3" />
              {t("pwa.share")}
            </span>
            <span>{t("pwa.thenChoose")}</span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-white font-medium"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {t("pwa.addToHome")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
