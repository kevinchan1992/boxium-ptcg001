import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

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

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "no-token">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setStatus("no-token");
    } else {
      setToken(t);
    }
  }, []);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setStatus("success");
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message || "重設密碼失敗，連結可能已過期");
    },
  });

  const handleSubmit = () => {
    if (!token) return;
    if (newPassword.length < 8) {
      toast.error("密碼至少需要 8 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("兩次輸入的密碼不一致");
      return;
    }
    setStatus("loading");
    resetMutation.mutate({ token, newPassword });
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0f2347 70%, #0a1628 100%)" }}
    >
      <WatermarkGrid />

      {/* Gold top line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a84c 30%, #c9a84c 70%, transparent)" }}
      />

      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-8 text-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Logo */}
        <div className="mb-6">
          <img src="/boxium-logo-white.png" alt="BOXIUM" className="h-8 mx-auto" />
        </div>

        {status === "no-token" && (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="w-14 h-14 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">無效的連結</h2>
            <p className="text-sm text-white/60 mb-6">此密碼重設連結無效或已過期。</p>
            <Button
              className="w-full font-semibold"
              style={{ background: "#06038d", color: "white" }}
              onClick={() => setLocation("/login")}
            >
              返回登入
            </Button>
          </>
        )}

        {(status === "idle" || status === "loading") && token && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <KeyRound className="w-7 h-7 text-yellow-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">重設密碼</h2>
            <p className="text-sm text-white/60 mb-6">請輸入您的新密碼</p>

            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-white/80 text-sm">新密碼</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="至少 8 個字元"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={status === "loading"}
                    className="pr-10"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-white/80 text-sm">確認新密碼</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="再次輸入新密碼"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={status === "loading"}
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                />
              </div>
            </div>

            <Button
              className="w-full mt-6 font-semibold h-11"
              style={{ background: "#06038d", color: "white" }}
              onClick={handleSubmit}
              disabled={status === "loading" || !newPassword || !confirmPassword}
            >
              {status === "loading" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />重設中...</>
              ) : "確認重設密碼"}
            </Button>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-14 h-14 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">密碼已重設！</h2>
            <p className="text-sm text-white/60 mb-6">您的密碼已成功更新，即將跳轉至登入頁面...</p>
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="w-14 h-14 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">重設失敗</h2>
            <p className="text-sm text-white/60 mb-6">{errorMessage}</p>
            <Button
              className="w-full font-semibold"
              style={{ background: "#06038d", color: "white" }}
              onClick={() => setLocation("/login")}
            >
              返回登入
            </Button>
          </>
        )}
      </div>

      {/* Gold bottom line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a84c 30%, #c9a84c 70%, transparent)", opacity: 0.4 }}
      />
    </div>
  );
}
