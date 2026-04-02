import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus("success");
      // Redirect to home after 3 seconds
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message || "驗證失敗，請重試");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setStatus("no-token");
      return;
    }
    setToken(t);
    verifyMutation.mutate({ token: t });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex justify-center">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo_004f9905.png"
              alt="BOXIUM"
              className="h-10 object-contain"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {status === "loading" && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
              </div>
              <div>
                <CardTitle className="text-xl mb-2">正在驗證電郵地址...</CardTitle>
                <p className="text-muted-foreground text-sm">請稍候，正在處理您的驗證請求</p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-xl mb-2 text-green-700">電郵驗證成功！🎉</CardTitle>
                <p className="text-muted-foreground text-sm mb-4">
                  您的帳號已成功啟用，歡迎加入 BOXIUM PTCG！<br />
                  正在為您跳轉至主頁...
                </p>
              </div>
              <Button onClick={() => { window.location.href = "/"; }} className="w-full">
                立即前往主頁
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex justify-center">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-xl mb-2 text-red-700">驗證失敗</CardTitle>
                <p className="text-muted-foreground text-sm mb-4">
                  {errorMessage}
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/resend-verification")}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  重新發送驗證電郵
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/")}
                  className="w-full"
                >
                  返回主頁
                </Button>
              </div>
            </>
          )}

          {status === "no-token" && (
            <>
              <div className="flex justify-center">
                <Mail className="h-16 w-16 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-xl mb-2">無效的驗證連結</CardTitle>
                <p className="text-muted-foreground text-sm mb-4">
                  此驗證連結無效。請從電郵中點擊驗證連結，或重新發送驗證電郵。
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/resend-verification")}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  重新發送驗證電郵
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/")}
                  className="w-full"
                >
                  返回主頁
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
