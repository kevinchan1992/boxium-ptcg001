import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, CheckCircle, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

// Watermark grid (same as Login/Register)
const WatermarkGrid = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: 45 }).map((_, i) => (
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
          mixBlendMode: "screen" as const,
          opacity: 0.045,
        }}
      />
    ))}
  </div>
);

export default function ResendVerification() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const resendMutation = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: () => {
      setSent(true);
      startCooldown();
    },
    onError: (error) => {
      toast.error(error.message || t("login.sendFailed"));
      if (error.data?.code === 'TOO_MANY_REQUESTS') {
        startCooldown();
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t("resendVerification.enterEmail"));
      return;
    }
    resendMutation.mutate({ email });
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0f2347 70%, #0a1628 100%)" }}
    >
      {/* Gold top accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, #c9a227, transparent)" }} />

      <WatermarkGrid />

      {/* Content card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 object-contain" />
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {!sent ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">{t("resendVerification.title")}</h2>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {t("resendVerification.subtitle")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-center text-xs font-semibold tracking-widest" style={{ color: "#c9a227" }}>
                    {t("login.emailAddress")}
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-1"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "#c9a227"; e.target.style.boxShadow = "0 0 0 1px #c9a227"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={resendMutation.isPending || cooldown > 0}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #c9a227, #e8c547)", color: "#0a1628" }}
                >
                  <Mail className="h-4 w-4" />
                  {resendMutation.isPending
                    ? t("login.sending")
                    : cooldown > 0
                    ? t("resendVerification.sendCooldown", { seconds: cooldown })
                    : t("resendVerification.sendButton")}
                </button>

                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="w-full py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("resendVerification.backToLogin")}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto text-green-400" />
              <h2 className="text-2xl font-bold text-white">{t("resendVerification.emailSent")}</h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                {t("resendVerification.sentTo")} <strong className="text-white">{email}</strong>.<br />
                {t("resendVerification.checkInbox")}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t("resendVerification.linkExpiry")}
              </p>
              <button
                disabled={cooldown > 0}
                onClick={() => { setSent(false); }}
                className="w-full py-3 rounded-xl text-sm transition-all disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
              >
                {cooldown > 0 ? t("resendVerification.resendCooldown", { seconds: cooldown }) : t("resendVerification.resend")}
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="w-full py-3 rounded-xl text-sm transition-all"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {t("resendVerification.backToLogin")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gold bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, #c9a227, transparent)" }} />
    </div>
  );
}
