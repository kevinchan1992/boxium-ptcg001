import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

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

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus("success");
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
    verifyMutation.mutate({ token: t });
  }, []);

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0f2347 70%, #0a1628 100%)" }}
    >
      {/* Gold top accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, #c9a227, transparent)" }} />

      <WatermarkGrid />

      {/* Content card */}
      <div className="relative z-10 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 object-contain" />
        </div>

        {/* Status content */}
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 mx-auto animate-spin" style={{ color: "#c9a227" }} />
              <div>
                <h2 className="text-xl font-bold text-white mb-2">正在驗證電郵地址...</h2>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>請稍候，正在處理您的驗證請求</p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-16 w-16 mx-auto text-green-400" />
              <div>
                <h2 className="text-xl font-bold text-white mb-2">電郵驗證成功！🎉</h2>
                <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                  您的帳號已成功啟用，歡迎加入 BOXIUM TCG！<br />
                  正在為您跳轉至主頁...
                </p>
              </div>
              <button
                onClick={() => { window.location.href = "/"; }}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "linear-gradient(135deg, #c9a227, #e8c547)", color: "#0a1628" }}
              >
                立即前往主頁
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 mx-auto text-red-400" />
              <div>
                <h2 className="text-xl font-bold text-white mb-2">驗證失敗</h2>
                <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>{errorMessage}</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setLocation("/resend-verification")}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
                >
                  <Mail className="h-4 w-4" />
                  重新發送驗證電郵
                </button>
                <button
                  onClick={() => setLocation("/")}
                  className="w-full py-3 rounded-xl text-sm transition-all"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  返回主頁
                </button>
              </div>
            </>
          )}

          {status === "no-token" && (
            <>
              <Mail className="h-16 w-16 mx-auto" style={{ color: "#c9a227" }} />
              <div>
                <h2 className="text-xl font-bold text-white mb-2">無效的驗證連結</h2>
                <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                  此驗證連結無效。請從電郵中點擊驗證連結，或重新發送驗證電郵。
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setLocation("/resend-verification")}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
                >
                  <Mail className="h-4 w-4" />
                  重新發送驗證電郵
                </button>
                <button
                  onClick={() => setLocation("/")}
                  className="w-full py-3 rounded-xl text-sm transition-all"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  返回主頁
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gold bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, #c9a227, transparent)" }} />
    </div>
  );
}
