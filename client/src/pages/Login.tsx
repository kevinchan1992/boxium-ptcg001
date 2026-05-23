import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

const IS_DEV = import.meta.env.DEV;

export default function Login() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: currentUser, isLoading: authLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 0,
  });
  useEffect(() => {
    if (!authLoading && currentUser) {
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
  const [emailNotVerified, setEmailNotVerified] = useState(false);

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

  const resendMutation = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: () => toast.success("驗證電郵已重新發送！"),
    onError: () => toast.error("發送失敗，請稍後再試"),
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setErrorMessage(null);
      setEmailNotVerified(false);
      toast.success(t("login.toast.loginSuccess"));
      setTimeout(() => {
        window.location.href = "/";
        window.scrollTo(0, 0);
      }, 100);
    },
    onError: (error) => {
      const msg = error.message || "登入失敗";
      if (msg === "EMAIL_NOT_VERIFIED") {
        setEmailNotVerified(true);
        setIsLoading(false);
        return;
      }
      setEmailNotVerified(false);
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
    } catch {}
  };

  const handleGoogleLogin = () => {
    const origin = window.location.origin;
    window.location.href = `/api/auth/google?origin=${encodeURIComponent(origin)}&returnTo=/`;
  };

  const handleAppleLogin = () => {
    const origin = window.location.origin;
    window.location.href = `/api/auth/apple?origin=${encodeURIComponent(origin)}&returnTo=/`;
  };

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
    <div
      className="min-h-screen w-full relative flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0f2e 0%, #0d1a4a 40%, #0a1535 70%, #060d24 100%)" }}
    >
      {/* ── Watermark grid of BOXIUM logos ── */}
      <div
        className="absolute inset-0 pointer-events-none select-none"
        aria-hidden="true"
        style={{ opacity: 0.045 }}
      >
        {Array.from({ length: 48 }).map((_, i) => (
          <img
            key={i}
            src="/boxium-logo-white.png"
            alt=""
            style={{
              position: "absolute",
              width: "120px",
              left: `${(i % 6) * 18 - 2}%`,
              top: `${Math.floor(i / 6) * 14 - 2}%`,
              transform: `rotate(-15deg)`,
              mixBlendMode: "screen" as const,
            }}
          />
        ))}
      </div>

      {/* ── Subtle radial glow in center ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(30,80,200,0.18) 0%, transparent 70%)",
        }}
      />

      {/* ── Thin gold accent line at top ── */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a84c 30%, #f0d080 50%, #c9a84c 70%, transparent)" }}
      />

      {/* ── Main form panel ── */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-6 py-8">

        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/boxium-logo.png"
            alt="BOXIUM"
            className="h-16 w-auto mb-4"
            style={{ filter: "drop-shadow(0 0 16px rgba(201,168,76,0.5))" }}
          />
          <div className="flex items-center gap-3 mb-1">
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, #c9a84c)" }} />
            <span className="text-xs tracking-[0.2em] uppercase whitespace-nowrap" style={{ color: "#c9a84c" }}>Trading Card Platform</span>
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, #c9a84c, transparent)" }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide mt-2">{t("login.title")}</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>輸入您的帳號密碼以登入 BOXIUM PTCG</p>
        </div>

        {/* Error / Verification alerts */}
        {errorMessage && (
          <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-950/60 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {emailNotVerified && (
          <Alert className="mb-4 border-amber-500/40 bg-amber-950/50">
            <Mail className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200">
              <p className="font-semibold mb-1">您的電郵尚未驗證</p>
              <p className="text-sm mb-2">請查看您的收件箱，點擊驗證連結完成帳號啟用。</p>
              <button
                type="button"
                className="text-sm underline text-amber-400 hover:text-amber-300 disabled:opacity-50"
                disabled={resendMutation.isPending}
                onClick={() => resendMutation.mutate({ email })}
              >
                {resendMutation.isPending ? "發送中..." : "重新發送驗證電郵"}
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Email / Password form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/70 text-xs tracking-wider uppercase text-center block">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-[#c9a84c]/60 focus:ring-[#c9a84c]/20 h-11"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-white/70 text-xs tracking-wider uppercase text-center block">{t("login.form.passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-[#c9a84c]/60 focus:ring-[#c9a84c]/20 h-11"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 font-semibold tracking-wide text-sm"
            style={{ background: "linear-gradient(135deg, #c9a84c, #f0d080, #c9a84c)", color: "#0a0f2e" }}
            disabled={isLoading}
          >
            {isLoading ? "登入中..." : "登入"}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-3 text-white/35" style={{ background: "transparent" }}>或使用社交帳號</span>
          </div>
        </div>

        {/* Social login buttons */}
        <div className="space-y-3">
          <Button
            type="button"
            className="w-full h-11 font-medium text-sm"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            使用 Google 登入
          </Button>

          <Button
            type="button"
            className="w-full h-11 font-medium text-sm"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
            onClick={handleAppleLogin}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
            </svg>
            使用 Apple 登入
          </Button>
        </div>

        {/* Footer links */}
        <div className="mt-7 space-y-2 text-center">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            還沒有帳號？{" "}
            <Link href="/register" className="font-semibold hover:underline" style={{ color: "#c9a84c" }}>
              立即註冊
            </Link>
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            登入即表示你同意我們的{" "}
            <a href="https://boxium.asia/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
              隱私政策
            </a>
          </p>
        </div>

        {/* DEV ONLY */}
        {IS_DEV && (
          <div className="mt-5">
            <div className="relative mb-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-dashed border-amber-400/40" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 text-amber-500 font-mono font-semibold tracking-wider" style={{ background: "transparent" }}>
                  ⚠ DEV ONLY
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-400/50 text-amber-400 hover:bg-amber-950/50 font-mono text-xs gap-2"
              onClick={handleDevLogin}
              disabled={devLoading}
            >
              {devLoading ? "登入中..." : "⚡ 開發模式快速登入 (Admin id=1)"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Bottom thin gold line ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a84c 30%, #c9a84c 70%, transparent)", opacity: 0.4 }}
      />
    </div>
  );
}
