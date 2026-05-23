import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, CheckCircle, ArrowLeft } from "lucide-react";

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
      toast.error(error.message || "發送失敗，請稍後再試");
      if (error.data?.code === 'TOO_MANY_REQUESTS') {
        startCooldown();
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("請輸入電郵地址");
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
                <h2 className="text-2xl font-bold text-white mb-2">重新發送驗證電郵</h2>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  輸入您的電郵地址，我們將重新發送驗證連結
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-center text-xs font-semibold tracking-widest" style={{ color: "#c9a227" }}>
                    電郵地址
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
                    ? "發送中..."
                    : cooldown > 0
                    ? `發送驗證電郵（${cooldown} 秒後）`
                    : "發送驗證電郵"}
                </button>

                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="w-full py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回登入
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto text-green-400" />
              <h2 className="text-2xl font-bold text-white">電郵已發送！</h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                驗證電郵已發送至 <strong className="text-white">{email}</strong>。<br />
                請查看您的收件箱（包括垃圾郵件），點擊驗證連結完成帳號啟用。
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                驗證連結將於 24 小時後過期。
              </p>
              <button
                disabled={cooldown > 0}
                onClick={() => { setSent(false); }}
                className="w-full py-3 rounded-xl text-sm transition-all disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
              >
                {cooldown > 0 ? `重新發送（${cooldown} 秒後）` : "重新發送"}
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="w-full py-3 rounded-xl text-sm transition-all"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                返回登入
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
