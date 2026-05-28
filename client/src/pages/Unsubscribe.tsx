import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const BOXIUM_LOGO = "https://static-assets-cdn.manus.space/webdev-static-assets/Mua4eQ38uVnrovHUJBRepi/boxium-logo-white.png";

const EMAIL_TYPE_LABELS: Record<string, string> = {
  offer: "出價通知",
  order: "訂單通知",
  review: "評價通知",
  seller: "賣家通知",
  system: "系統通知",
  welcome: "歡迎信",
  general: "一般通知",
  all: "所有電郵",
};

export default function Unsubscribe() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const action = params.get("action") ?? "unsubscribe"; // "unsubscribe" | "resubscribe"

  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const { data: info, isLoading: infoLoading, error: infoError } = trpc.email.getUnsubscribeInfo.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const unsubscribeMutation = trpc.email.unsubscribeByToken.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  const resubscribeMutation = trpc.email.resubscribeByToken.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  const isUnsubscribe = action !== "resubscribe";
  const emailTypeLabel = info?.emailType ? (EMAIL_TYPE_LABELS[info.emailType] ?? info.emailType) : "所有電郵";

  const handleAction = () => {
    if (!token) return;
    if (isUnsubscribe) {
      unsubscribeMutation.mutate({ token });
    } else {
      resubscribeMutation.mutate({ token });
    }
  };

  if (!token) {
    return (
      <UnsubscribePage>
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white mb-2">{t("unsubscribe.invalidLink.title")}</h2>
          <p className="text-gray-400 text-sm">{t("unsubscribe.invalidLink.description")}</p>
        </div>
      </UnsubscribePage>
    );
  }

  if (infoLoading) {
    return (
      <UnsubscribePage>
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-400">{t("unsubscribe.loading")}</p>
        </div>
      </UnsubscribePage>
    );
  }

  if (infoError) {
    return (
      <UnsubscribePage>
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white mb-2">{t("unsubscribe.linkInvalid.title")}</h2>
          <p className="text-gray-400 text-sm">{t("unsubscribe.linkInvalid.description")}</p>
          <p className="text-gray-500 text-xs mt-2">{t("unsubscribe.linkInvalid.contact")}</p>
        </div>
      </UnsubscribePage>
    );
  }

  if (done) {
    return (
      <UnsubscribePage>
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {isUnsubscribe ? "已成功退訂" : "已重新訂閱"}
          </h2>
          <p className="text-gray-400 text-sm">
            {isUnsubscribe
              ? `您已退訂來自 BOXIUM TCG 的「${emailTypeLabel}」。`
              : `您已重新訂閱來自 BOXIUM TCG 的「${emailTypeLabel}」。`}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {isUnsubscribe
              ? "您仍會收到重要的訂單確認和安全通知。"
              : "感謝您繼續訂閱 BOXIUM TCG 的電郵通知。"}
          </p>
          <a href="/" className="inline-flex items-center gap-1.5 mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回首頁
          </a>
        </div>
      </UnsubscribePage>
    );
  }

  return (
    <UnsubscribePage>
      <div className="text-center py-6">
        <Mail className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          {isUnsubscribe ? "確認退訂電郵通知" : "重新訂閱電郵通知"}
        </h2>

        {info && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 my-4 text-left">
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
              <span className="text-gray-500">{t("unsubscribe.confirm.emailAddressLabel")}</span>
              <span className="font-mono">{info.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className="text-gray-500">{t("unsubscribe.confirm.notificationTypeLabel")}</span>
              <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs">{emailTypeLabel}</span>
            </div>
          </div>
        )}

        <p className="text-gray-400 text-sm mb-6">
          {isUnsubscribe
            ? `點擊下方按鈕後，您將不再收到「${emailTypeLabel}」。重要的訂單確認和安全通知仍會照常發送。`
            : `點擊下方按鈕後，您將重新收到「${emailTypeLabel}」。`}
        </p>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        <div className="flex flex-row flex-wrap gap-3 justify-center">
          <Button
            onClick={handleAction}
            disabled={unsubscribeMutation.isPending || resubscribeMutation.isPending}
            className={`min-w-[120px] whitespace-nowrap ${isUnsubscribe
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-[#1a0dab] hover:bg-[#0804b8] text-white"}`}
          >
            {(unsubscribeMutation.isPending || resubscribeMutation.isPending) ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isUnsubscribe ? "確認退訂" : "確認重新訂閱"}
          </Button>
          <a href="/">
            <Button variant="outline" className="min-w-[120px] whitespace-nowrap border-white/20 text-gray-300 hover:bg-white/10">
              取消
            </Button>
          </a>
        </div>

        <p className="text-gray-600 text-xs mt-6">
          如有疑問，請聯絡客服：
          <a href="mailto:boxium.asia@gmail.com" className="text-blue-500 hover:underline ml-1">
            boxium.asia@gmail.com
          </a>
        </p>
      </div>
    </UnsubscribePage>
  );
}

function UnsubscribePage({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <a href="/">
            <img
              src={BOXIUM_LOGO}
              alt="BOXIUM TCG"
              className="h-10 mx-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </a>
          <p className="text-gray-500 text-xs mt-2">{t("unsubscribe.emailPreferences")}</p>
        </div>

        <Card className="bg-[#0d0d2b] border border-white/10">
          <CardContent className="p-6">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
