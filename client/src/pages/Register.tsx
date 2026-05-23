import { parseApiError } from "@/lib/parseApiError";
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";

// Shared full-screen magazine background
function MagazineBg({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0f2e 0%, #0d1a4a 40%, #0a1535 70%, #060d24 100%)" }}
    >
      {/* Watermark grid */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true" style={{ opacity: 0.045 }}>
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
              transform: "rotate(-15deg)",
              filter: "brightness(10)",
            }}
          />
        ))}
      </div>
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(30,80,200,0.18) 0%, transparent 70%)" }}
      />
      {/* Top gold line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a84c 30%, #f0d080 50%, #c9a84c 70%, transparent)" }}
      />
      {children}
      {/* Bottom gold line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a84c 30%, #c9a84c 70%, transparent)", opacity: 0.4 }}
      />
    </div>
  );
}

export default function Register() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      if (data.requiresEmailVerification) {
        setRegisteredEmail(email);
        setIsLoading(false);
      } else {
        toast.success(t("register.successToast"));
        setTimeout(() => { window.location.href = "/"; }, 100);
      }
    },
    onError: (error) => {
      toast.error(parseApiError(error));
      setIsLoading(false);
    },
  });

  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const resendMutation = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: () => { toast.success("驗證電郵已重新發送！"); startCooldown(); },
    onError: (error) => {
      const msg = error.message || "發送失敗，請稍後再試";
      toast.error(msg);
      if (error.data?.code === 'TOO_MANY_REQUESTS') startCooldown();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error(t("register.passwordMismatch")); return; }
    if (password.length < 8) { toast.error(t("register.passwordTooShort")); return; }
    if (!/[A-Z]/.test(password)) { toast.error(t("register.passwordRequiresUppercase")); return; }
    if (!/[a-z]/.test(password)) { toast.error(t("register.passwordRequiresLowercase")); return; }
    if (!/[0-9]/.test(password)) { toast.error(t("register.passwordRequiresNumber")); return; }
    setIsLoading(true);
    try { await registerMutation.mutateAsync({ email, password, name: name || undefined }); } catch {}
  };

  // ── Email verification pending screen ──
  if (registeredEmail) {
    return (
      <MagazineBg>
        <div className="relative z-10 w-full max-w-sm mx-auto px-6 py-10 text-center">
          <img src="/boxium-logo.png" alt="BOXIUM" className="h-14 w-auto mx-auto mb-6" style={{ filter: "drop-shadow(0 0 16px rgba(201,168,76,0.5))" }} />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.4)" }}
          >
            <Mail className="h-8 w-8" style={{ color: "#c9a84c" }} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">請驗證您的電郵地址</h2>
          <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>我們已發送驗證電郵至</p>
          <div
            className="rounded-lg p-4 mb-5"
            style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}
          >
            <p className="font-semibold break-all" style={{ color: "#f0d080" }}>{registeredEmail}</p>
          </div>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            請查看您的收件箱（包括垃圾郵件），點擊驗證連結完成帳號啟用。<br />
            驗證連結將於 <strong className="text-white/60">24 小時</strong>後過期。
          </p>
          <Button
            className="w-full h-11 mb-3"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
            disabled={resendMutation.isPending || resendCooldown > 0}
            onClick={() => resendMutation.mutate({ email: registeredEmail! })}
          >
            <Mail className="h-4 w-4 mr-2" />
            {resendMutation.isPending ? "發送中..." : resendCooldown > 0 ? `重新發送（${resendCooldown} 秒後）` : "重新發送驗證電郵"}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-white/50 hover:text-white/80"
            onClick={() => setLocation("/login")}
          >
            返回登入
          </Button>
        </div>
      </MagazineBg>
    );
  }

  // ── Registration form ──
  return (
    <MagazineBg>
      <div className="relative z-10 w-full max-w-sm mx-auto px-6 py-8">
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-7">
          <img
            src="/boxium-logo.png"
            alt="BOXIUM"
            className="h-14 w-auto mb-4"
            style={{ filter: "drop-shadow(0 0 16px rgba(201,168,76,0.5))" }}
          />
          <div className="flex items-center gap-3 mb-1">
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, #c9a84c)" }} />
            <span className="text-xs tracking-[0.3em] uppercase" style={{ color: "#c9a84c" }}>Trading Card Platform</span>
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, #c9a84c, transparent)" }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide mt-2">{t("register.title")}</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>創建您的 BOXIUM PTCG 帳號</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/70 text-xs tracking-wider uppercase">Email</Label>
            <Input
              id="email" type="email" placeholder="your@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required disabled={isLoading}
              className="border-white/15 text-white placeholder:text-white/30 focus:border-[#c9a84c]/60 h-11"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-white/70 text-xs tracking-wider uppercase">{t("register.nameLabel")}</Label>
            <Input
              id="name" type="text" placeholder={t("register.namePlaceholder")}
              value={name} onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className="border-white/15 text-white placeholder:text-white/30 focus:border-[#c9a84c]/60 h-11"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-white/70 text-xs tracking-wider uppercase">{t("register.passwordLabel")}</Label>
            <Input
              id="password" type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required disabled={isLoading}
              className="border-white/15 text-white placeholder:text-white/30 focus:border-[#c9a84c]/60 h-11"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>至少 8 個字符，包含大小寫字母和數字</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-white/70 text-xs tracking-wider uppercase">{t("register.confirmPasswordLabel")}</Label>
            <Input
              id="confirmPassword" type="password" placeholder="••••••••"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              required disabled={isLoading}
              className="border-white/15 text-white placeholder:text-white/30 focus:border-[#c9a84c]/60 h-11"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 font-semibold tracking-wide text-sm"
            style={{ background: "linear-gradient(135deg, #c9a84c, #f0d080, #c9a84c)", color: "#0a0f2e" }}
            disabled={isLoading}
          >
            {isLoading ? "註冊中..." : "註冊"}
          </Button>
        </form>

        <div className="space-y-2 text-center">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            已經有帳號？{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "#c9a84c" }}>
              立即登入
            </Link>
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            註冊即表示你同意我們的{" "}
            <a href="https://boxium.asia/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
              隱私政策
            </a>
          </p>
        </div>
      </div>
    </MagazineBg>
  );
}
