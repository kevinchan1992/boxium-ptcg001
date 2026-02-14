import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Register() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });
  const [error, setError] = useState("");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      // Redirect to home page after successful registration
      setLocation("/");
      window.location.reload(); // Reload to update auth state
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("密碼不一致");
      return;
    }

    if (formData.password.length < 6) {
      setError("密碼至少需要 6 個字元");
      return;
    }

    registerMutation.mutate({
      username: formData.username,
      email: formData.email,
      password: formData.password,
      name: formData.name || undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#f8f9fa" }}>
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link href="/">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM Logo"
              className="h-16 mx-auto mb-4 cursor-pointer"
            />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: "#06038d" }}>
            註冊 BOXIUM PTCG
          </h1>
          <p className="text-gray-600 mt-2">
            創建您的帳號，開始追蹤卡牌價格
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              使用者名稱 *
            </label>
            <Input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              minLength={3}
              maxLength={64}
              placeholder="輸入使用者名稱"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              電子郵件 *
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="輸入電子郵件"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              姓名（選填）
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="輸入您的姓名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密碼 *
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
              placeholder="至少 6 個字元"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              確認密碼 *
            </label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              minLength={6}
              placeholder="再次輸入密碼"
            />
          </div>

          <Button
            type="submit"
            className="w-full py-3 text-base font-semibold"
            style={{ backgroundColor: "#06038d", color: "white" }}
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                註冊中...
              </>
            ) : (
              "註冊"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          已經有帳號？{" "}
          <Link href="/login">
            <span className="font-semibold cursor-pointer" style={{ color: "#06038d" }}>
              立即登入
            </span>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">或</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full py-3 text-base font-semibold border-2"
            style={{ borderColor: "#06038d", color: "#06038d" }}
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
          >
            使用 Manus OAuth 登入
          </Button>
        </div>
      </Card>
    </div>
  );
}
