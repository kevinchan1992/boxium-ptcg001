import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

const IS_DEV = import.meta.env.DEV;

export default function Login() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  // ── Redirect already-logged-in users away from /login ──
  const { data: currentUser, isLoading: authLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 0, // always check fresh auth state on login page
  });
  useEffect(() => {
    if (!authLoading && currentUser) {
      // User is already logged in, redirect to home or returnTo param
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") || "/";
      setLocation(returnTo);
    }
  }, [currentUser, authLoading, setLocation]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle error params from Google OAuth redirect (e.g. blocked user)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const message = params.get("message");

    if (error === "blocked" && message) {
      setErrorMessage(decodeURIComponent(message));
    } else if (error === "user_creation_failed") {
      setErrorMessage("帳號建立失敗，請稍後再試或聯絡客服");
    } else if (error === "auth_failed") {
      setErrorMessage("Google 登入失敗，請稍後再試");
    } else if (error === "no_email") {
      setErrorMessage("無法取得 Google 帳號 Email，請確認授權設定");
    }
  }, []);

  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const resendMutation = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: () => toast.success("驗證電郵已重新發送！"),
    onError: () => toast.error("發送失敗，請稍後再試"),
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setErrorMessage(null);
      setEmailNotVerified(false);
      toast.success(t("login.toast.loginSuccess"));
      // Wait a bit to ensure cookie is set before redirecting
      setTimeout(() => {
        window.location.href = "/";
        // Scroll to top after redirect
        window.scrollTo(0, 0);
      }, 100);
    },
    onError: (error) => {
      const msg = error.message || "登入失敗";
      // Handle email not verified case
      if (msg === "EMAIL_NOT_VERIFIED") {
        setEmailNotVerified(true);
        setIsLoading(false);
        return;
      }
      setEmailNotVerified(false);
      // Show blocked errors in the alert banner, other errors as toast
      if (msg.includes("封鎖") || msg.includes("blocked")) {
        setErrorMessage(msg);
      } else {
        toast.error(msg);
      }
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      await loginMutation.mutateAsync({ email, password });
    } catch (error) {
      // Error handled in onError
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth flow with origin parameter
    const origin = window.location.origin;
    // Always return to home page after Google login
    window.location.href = `/api/auth/google?origin=${encodeURIComponent(origin)}&returnTo=/`;
  };

  const handleAppleLogin = () => {
    const origin = window.location.origin;
    window.location.href = `/api/auth/apple?origin=${encodeURIComponent(origin)}&returnTo=/`;
  };

  // Dev-only: bypass auth by calling the mock-login endpoint
  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      const res = await fetch("/api/dev/mock-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`[DEV] 已以 ${data.user.name || data.user.email} 身份登入`);
        setTimeout(() => { window.location.href = "/"; }, 200);
      } else {
        toast.error("Dev 登入失敗: " + (data.error || "未知錯誤"));
      }
    } catch (e: any) {
      toast.error("Dev 登入失敗: " + e.message);
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          {/* Company Logo */}
          <div className="flex justify-center">
            <img 
              src="/boxium-logo.png" 
              alt="BOXIUM LOGO" 
              className="h-20 w-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t("login.title")}</CardTitle>
          <CardDescription className="text-center">
            輸入您的帳號密碼以登入 BOXIUM PTCG
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Blocked / Error Alert Banner */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Email Not Verified Banner */}
          {emailNotVerified && (
            <Alert className="mb-4 border-amber-300 bg-amber-50">
              <Mail className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <p className="font-semibold mb-1">您的電郵尚未驗證</p>
                <p className="text-sm mb-2">請查看您的收件算，點擊驗證連結完成帳號啟用。</p>
                <button
                  type="button"
                  className="text-sm underline text-amber-700 hover:text-amber-900 disabled:opacity-50"
                  disabled={resendMutation.isPending}
                  onClick={() => resendMutation.mutate({ email })}
                >
                  {resendMutation.isPending ? "發送中..." : "重新發送驗證電郵"}
                </button>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("login.form.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "登入中..." : "登入"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google 登入
          </Button>

          {/* Sign in with Apple — required by Apple App Store guidelines (4.8.0) */}
          <Button
            type="button"
            variant="outline"
            className="w-full mt-3 bg-black text-white border-black hover:bg-gray-900 hover:text-white"
            onClick={handleAppleLogin}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
            </svg>
            使用 Apple 登入
          </Button>

          {/* ── DEV ONLY: mock login bypass ── */}
          {IS_DEV && (
            <div className="mt-4">
              <div className="relative mb-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-dashed border-amber-400/60" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-amber-500 font-mono font-semibold tracking-wider">
                    ⚠ DEV ONLY
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-amber-400 text-amber-600 hover:bg-amber-50 font-mono text-xs gap-2"
                onClick={handleDevLogin}
                disabled={devLoading}
              >
                {devLoading ? "登入中..." : "⚡ 開發模式快速登入 (Admin id=1)"}
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            還沒有帳號？{" "}
            <Link href="/register" className="text-primary hover:underline">
              立即註冊
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            登入即表示你同意我們的{" "}
            <a href="https://boxium.asia/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              隱私政策
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
