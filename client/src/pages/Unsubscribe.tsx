import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const BOXIUM_LOGO = "https://static-assets-cdn.manus.space/webdev-static-assets/Mua4eQ38uVnrovHUJBRepi/boxium-logo-white.png";

// EMAIL_TYPE_LABELS now uses i18n keys - see useEmailTypeLabel hook below

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
  const emailTypeLabelMap: Record<string, string> = {
    offer: t("unsubscribe.emailTypes.offer"),
    order: t("unsubscribe.emailTypes.order"),
    review: t("unsubscribe.emailTypes.review"),
    seller: t("unsubscribe.emailTypes.seller"),
    system: t("unsubscribe.emailTypes.system"),
    welcome: t("unsubscribe.emailTypes.welcome"),
    general: t("unsubscribe.emailTypes.general"),
    all: t("unsubscribe.emailTypes.all"),
  };
  const emailTypeLabel = info?.emailType ? (emailTypeLabelMap[info.emailType] ?? info.emailType) : t("unsubscribe.emailTypes.all");

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
            {isUnsubscribe ? t("unsubscribe.done.unsubscribeTitle") : t("unsubscribe.done.resubscribeTitle")}
          </h2>
          <p className="text-gray-400 text-sm">
            {isUnsubscribe
              ? t("unsubscribe.done.unsubscribeDesc", { label: emailTypeLabel })
              : t("unsubscribe.done.resubscribeDesc", { label: emailTypeLabel })}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {isUnsubscribe
              ? t("unsubscribe.done.unsubscribeNote")
              : t("unsubscribe.done.resubscribeNote")}
          </p>
          <a href="/" className="inline-flex items-center gap-1.5 mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t("common.backToHome")}
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
          {isUnsubscribe ? t("unsubscribe.confirm.unsubscribeTitle") : t("unsubscribe.confirm.resubscribeTitle")}
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
            ? t("unsubscribe.confirm.unsubscribeDesc", { label: emailTypeLabel })
            : t("unsubscribe.confirm.resubscribeDesc", { label: emailTypeLabel })}
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
            {isUnsubscribe ? t("unsubscribe.confirm.confirmUnsubscribe") : t("unsubscribe.confirm.confirmResubscribe")}
          </Button>
          <a href="/">
            <Button variant="outline" className="min-w-[120px] whitespace-nowrap border-white/20 text-gray-300 hover:bg-white/10">
              {t("common.cancel")}
            </Button>
          </a>
        </div>

        <p className="text-gray-600 text-xs mt-6">
          {t("unsubscribe.contactHint")}
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
