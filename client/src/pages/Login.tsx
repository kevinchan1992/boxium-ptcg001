import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, Mail, KeyRound, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const IS_DEV = import.meta.env.DEV;

// Detect if running inside a Capacitor native app (iOS/Android)
const isCapacitor = () => !!(window as any).Capacitor?.isNativePlatform?.();

// Open OAuth URL: use in-app browser (SFSafariViewController) on iOS, normal redirect on web
async function openOAuthUrl(url: string) {
  if (isCapacitor()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
    } catch {
      // Fallback to window.location if plugin fails
      window.location.href = url;
    }
  } else {
    window.location.href = url;
  }
}

/* ─── Boxium Logo Particle Canvas ───────────────────────────────────── */
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgLoadedRef = useRef(false);

  const createParticle = useCallback(
    (id: number, width: number, height: number): Particle => ({
      id,
      x: Math.random() * width,
      y: Math.random() * height,
      // Very slow drift — like dust motes in still air
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      // Small logo particles — visible but unobtrusive
      size: 22 + Math.random() * 32,
      // Dim and translucent — stays in background
      opacity: 0.06 + Math.random() * 0.10,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.004,
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load the white outline logo image
    const img = new Image();
    img.src = "/boxium-logo-outline.png";
    imgRef.current = img;
    img.onload = () => { imgLoadedRef.current = true; };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // ~50 sparse particles across the screen
      particlesRef.current = Array.from({ length: 50 }, (_, i) =>
        createParticle(i, canvas.width, canvas.height)
      );
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (imgLoadedRef.current && imgRef.current) {
        const img = imgRef.current;
        particlesRef.current.forEach((p) => {
          // Drift
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.rotationSpeed;

          // Wrap around edges with padding
          const pad = p.size;
          if (p.x < -pad) p.x = canvas.width + pad;
          if (p.x > canvas.width + pad) p.x = -pad;
          if (p.y < -pad) p.y = canvas.height + pad;
          if (p.y > canvas.height + pad) p.y = -pad;

          // Draw logo particle
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          // Maintain logo aspect ratio
          const aspect = img.width / img.height;
          const w = p.size * aspect;
          const h = p.size;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
        });
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}

/* ─── Main Login Page ────────────────────────────────────────────────── */
// Boxium brand colours
const BRAND_BLUE = "#06038d";   // deep navy blue (logo background)
const BRAND_YELLOW = "#f5c518"; // bright yellow (logo text)

export default function Login() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
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

  // When running in Capacitor: listen for in-app browser close event
  // After OAuth completes, the SFSafariViewController closes and we refresh auth state
  useEffect(() => {
    if (!isCapacitor()) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { Browser } = await import('@capacitor/browser');
        const listener = await Browser.addListener('browserFinished', async () => {
          // Browser closed — refresh auth state to pick up new session cookie
          await utils.auth.me.invalidate();
        });
        cleanup = () => listener.remove();
      } catch { /* ignore */ }
    })();
    return () => { cleanup?.(); };
  }, [utils]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const forgotPasswordMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => setForgotSent(true),
    onError: (err) => toast.error(err.message || t("login.sendFailed")),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const message = params.get("message");
    if (error === "blocked" && message) {
      setErrorMessage(decodeURIComponent(message));
    } else if (error === "user_creation_failed") {
      setErrorMessage(t("login.accountCreateFailed"));
    } else if (error === "auth_failed") {
      setErrorMessage(t("login.googleLoginFailed"));
    } else if (error === "no_email") {
      setErrorMessage(t("login.googleEmailFailed"));
    } else if (error === "apple_denied") {
      setErrorMessage(t("login.appleLoginCancelled"));
    } else if (error === "apple_auth_failed") {
      setErrorMessage(t("login.appleLoginFailed"));
    } else if (error === "apple_user_creation_failed") {
      setErrorMessage(t("login.appleAccountCreateFailed"));
    } else if (error === "apple_no_code") {
      setErrorMessage(t("login.appleVerifyFailed"));
    } else if (error === "apple_invalid_token") {
      setErrorMessage(t("login.appleTokenInvalid"));
    }
  }, []);

  const resendMutation = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: () => toast.success(t("login.verifyEmailResent")),
    onError: () => toast.error(t("login.sendFailed")),
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
      const msg = error.message || t("login.loginFailed");
      if (msg === "EMAIL_NOT_VERIFIED") {
        setEmailNotVerified(true);
        setIsLoading(false);
        return;
      }
      setEmailNotVerified(false);
      if (msg.includes("blocked") || msg.includes("封鎖")) {
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
    openOAuthUrl(`${origin}/api/auth/google?origin=${encodeURIComponent(origin)}&returnTo=/`);
  };

  const handleAppleLogin = () => {
    const origin = window.location.origin;
    openOAuthUrl(`${origin}/api/auth/apple?origin=${encodeURIComponent(origin)}&returnTo=/`);
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
        toast.success(`[DEV] Logged in as ${data.user.name || data.user.email}`);
        setTimeout(() => { window.location.href = "/"; }, 200);
      } else {
        toast.error("Dev login failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      toast.error("Dev login failed: " + e.message);
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <>
      {/* ── Split Screen Layout ── */}
      <div className="flex lg:flex-row h-screen overflow-hidden w-full">

        {/* ══════════════════════════════════════════════════════════
            LEFT PANEL — Brand Showcase (PC only, hidden on mobile)
        ══════════════════════════════════════════════════════════ */}
        <div
          className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center overflow-hidden"
          style={{ background: "#06038D" }}
        >
          {/* Giant watermark text */}
          <div
            className="absolute top-10 left-10 font-black uppercase select-none leading-tight"
            style={{
              color: "rgba(255,255,255,0.05)",
              fontSize: "7vw",
              letterSpacing: "0.2em",
              lineHeight: 1.1,
            }}
          >
            ENTER<br />THE<br />VAULT
          </div>

          {/* Decorative yellow accent lines */}
          <div
            className="absolute top-0 right-0 w-1 h-full"
            style={{ background: "#FEDD00" }}
          />

          {/* Tilted card visual */}
          <div
            className="relative z-10 mb-10"
            style={{ transform: "rotate(12deg)" }}
          >
            <div
              className="w-40 h-56 rounded-sm flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FEDD00 0%, #e6c800 100%)",
                boxShadow: "8px 8px 0px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              <img
                src="/boxium-logo.png"
                alt="BOXIUM"
                className="w-28 h-auto"
                style={{ filter: "brightness(0) saturate(100%) invert(0%) sepia(0%) saturate(0%) hue-rotate(0deg)" }}
              />
            </div>
          </div>

          {/* Magazine tagline */}
          <div className="relative z-10 text-center px-12">
            <p
              className="font-serif italic text-2xl tracking-wider mb-2"
              style={{ color: "#FEDD00" }}
            >
              "Where Passion Meets Valuables."
            </p>
            <p
              className="text-sm uppercase"
              style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em" }}
            >
              Welcome to the Apex of TCG Collecting.
            </p>
          </div>

          {/* Bottom brand label */}
          <div
            className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4"
          >
            <div className="h-px w-12" style={{ background: "rgba(254,221,0,0.4)" }} />
            <span
              className="text-xs uppercase tracking-[0.25em] font-mono"
              style={{ color: "rgba(254,221,0,0.6)" }}
            >
              BOXIUM TCG
            </span>
            <div className="h-px w-12" style={{ background: "rgba(254,221,0,0.4)" }} />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            RIGHT PANEL — Login Form (full width on mobile)
        ══════════════════════════════════════════════════════════ */}
        <div className="w-full lg:w-1/2 bg-white flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-sm mx-auto px-8 py-12">

          {/* Logo + brand */}
          <div className="flex flex-col items-center mb-10">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM"
              className="h-14 w-auto mb-5"
            />
            <h1 className="text-2xl font-bold tracking-wide text-zinc-900">
              {t("login.title")}
            </h1>
            <p className="text-sm mt-1.5 text-zinc-400">
              {t("login.subtitle")}
            </p>
          </div>

          {/* Error / Verification alerts */}
          {errorMessage && (
            <Alert
              variant="destructive"
              className="mb-4 border-red-200 bg-red-50 text-red-700 rounded-none"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          {emailNotVerified && (
            <Alert className="mb-4 border-l-4 border-l-[#FEDD00] border-zinc-200 bg-zinc-50 rounded-none">
              <Mail className="h-4 w-4" style={{ color: "#06038D" }} />
              <AlertDescription className="text-zinc-700">
                <p className="font-semibold mb-1">{t("login.emailNotVerified")}</p>
                <p className="text-sm mb-2">{t("login.checkInbox")}</p>
                <button
                  type="button"
                  className="text-sm underline disabled:opacity-50"
                  style={{ color: "#06038D" }}
                  disabled={resendMutation.isPending}
                  onClick={() => resendMutation.mutate({ email })}
                >
                  {resendMutation.isPending
                    ? t("login.sending")
                    : t("login.resendVerifyEmail")}
                </button>
              </AlertDescription>
            </Alert>
          )}

          {/* Email / Password form */}
          <form onSubmit={handleSubmit} className="space-y-5 mb-6">
            <div className="space-y-1">
              <Label
                htmlFor="email"
                className="text-xs tracking-widest uppercase block text-zinc-500"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 rounded-none border-0 border-b border-zinc-900/10 bg-transparent text-zinc-900 placeholder:text-zinc-300 focus:border-[#FEDD00] focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors px-0"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="password"
                className="text-xs tracking-widest uppercase block text-zinc-500"
              >
                {t("login.form.passwordLabel")}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 rounded-none border-0 border-b border-zinc-900/10 bg-transparent text-zinc-900 placeholder:text-zinc-300 focus:border-[#FEDD00] focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors px-0"
              />
            </div>

            {/* Primary CTA — Deep blue with yellow text, no rounded corners */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-none font-bold tracking-widest text-sm transition-all active:translate-y-0.5 disabled:opacity-60 uppercase mt-2"
              style={{
                background: "#06038D",
                color: "#FEDD00",
              }}
            >
              {isLoading ? t("login.loggingIn") : t("login.loginButton")}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors underline-offset-2 hover:underline"
              >
                {t("login.forgotPassword")}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-3 bg-white text-zinc-400 tracking-widest">
                {t("login.orUseSocial")}
              </span>
            </div>
          </div>

          {/* Social login buttons */}
          <div className="space-y-3">
            <button
              type="button"
              className="w-full h-11 rounded-sm flex items-center justify-center gap-2.5 font-medium text-sm text-zinc-700 transition-all hover:bg-zinc-50 active:bg-zinc-100"
              style={{ border: "1px solid #e4e4e7" }}
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t("login.loginWithGoogle")}
            </button>

            <button
              type="button"
              className="w-full h-11 rounded-sm flex items-center justify-center gap-2.5 font-medium text-sm text-zinc-700 transition-all hover:bg-zinc-50 active:bg-zinc-100"
              style={{ border: "1px solid #e4e4e7" }}
              onClick={handleAppleLogin}
              disabled={isLoading}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
              </svg>
              {t("login.loginWithApple")}
            </button>
          </div>

          {/* Footer links */}
          <div className="mt-8 space-y-2 text-center">
            <p className="text-sm text-zinc-500">
              {t("login.noAccount")}{" "}
              <Link
                href="/register"
                className="font-bold hover:underline"
                style={{ color: "#06038D" }}
              >
                {t("login.registerNow")}
              </Link>
            </p>
            <p className="text-xs text-zinc-300">
              {t("login.agreeToTerms")}{" "}
              <a
                href="https://boxium.asia/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
              >
                {t("login.privacyPolicy")}
              </a>
            </p>
          </div>

          {/* DEV ONLY */}
          {IS_DEV && (
            <div className="mt-5">
              <div className="relative mb-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-dashed border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 font-mono font-semibold tracking-wider text-zinc-400 bg-white">
                    ⚠ DEV ONLY
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full font-mono text-xs gap-2 rounded-none"
                style={{ borderColor: "#06038D", color: "#06038D" }}
                onClick={handleDevLogin}
                disabled={devLoading}
              >
                {devLoading ? t("login.loggingIn") : "⚡ Dev Quick Login (Admin id=1)"}
              </Button>
            </div>
          )}

          </div>{/* end inner form container */}
        </div>{/* end right panel */}
      </div>{/* end split screen */}

      {/* 忘記密碼 Dialog */}
      <Dialog
        open={showForgotPassword}
        onOpenChange={(open) => {
          setShowForgotPassword(open);
          if (!open) {
            setForgotSent(false);
            setForgotEmail("");
          }
        }}
      >
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: `${BRAND_BLUE}20` }}
              >
                <KeyRound className="w-4 h-4" style={{ color: BRAND_BLUE }} />
              </div>
              <DialogTitle>{t("login.forgotPasswordTitle")}</DialogTitle>
            </div>
            <DialogDescription>
              {forgotSent
                ? t("login.resetEmailSent")
                : t("login.enterEmailForReset")}
            </DialogDescription>
          </DialogHeader>

          {forgotSent ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-sm text-center text-gray-600">
                {t("login.sentTo")} <strong>{forgotEmail}</strong>
              </p>
              <p className="text-xs text-gray-400 text-center">
                {t("login.checkSpam")}
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-sm font-medium">
                  {t("login.emailAddress")}
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotPasswordMutation.isPending}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {forgotSent ? (
              <Button
                className="w-full"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotSent(false);
                  setForgotEmail("");
                }}
              >
                {t("common.done")}
              </Button>
            ) : (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForgotPassword(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  className="flex-1 font-semibold"
                  style={{ background: BRAND_BLUE, color: BRAND_YELLOW }}
                  onClick={() =>
                    forgotPasswordMutation.mutate({ email: forgotEmail })
                  }
                  disabled={!forgotEmail || forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending
                    ? t("login.sending")
                    : t("login.sendResetLink")}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
