import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      // Redirect to home page after successful login
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

    loginMutation.mutate({
      username: formData.username,
      password: formData.password,
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
            登入 BOXIUM PTCG
          </h1>
          <p className="text-gray-600 mt-2">
            歡迎回來！請登入您的帳號
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
              使用者名稱
            </label>
            <Input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              placeholder="輸入使用者名稱"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密碼
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="輸入密碼"
            />
          </div>

          <Button
            type="submit"
            className="w-full py-3 text-base font-semibold"
            style={{ backgroundColor: "#06038d", color: "white" }}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登入中...
              </>
            ) : (
              "登入"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          還沒有帳號？{" "}
          <Link href="/register">
            <span className="font-semibold cursor-pointer" style={{ color: "#06038d" }}>
              立即註冊
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
          <Link href="/profile">
            <Button
              variant="outline"
              className="w-full py-3 text-base font-semibold border-2"
              style={{ borderColor: "#06038d", color: "#06038d" }}
            >
              使用 Manus OAuth 登入
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
