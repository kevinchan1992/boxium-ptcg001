import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("無效的重置連結");
      setLocation("/login");
    }
  }, [token, setLocation]);

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setResetSuccess(true);
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    },
    onError: (error) => {
      toast.error(error.message || "密碼重置失敗");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("密碼與確認密碼不符");
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error("密碼長度至少 6 個字符");
      return;
    }

    if (!token) {
      toast.error("無效的重置連結");
      return;
    }

    resetPasswordMutation.mutate({
      token,
      newPassword: formData.newPassword,
    });
  };

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">密碼重置成功！</h2>
            <p className="text-gray-600 mb-6">
              您的密碼已成功重置。正在跳轉到登入頁面...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">
              重置密碼
            </h1>
            <p className="text-gray-600 mt-2">
              請輸入您的新密碼
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新密碼
              </label>
              <Input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                required
                placeholder="輸入新密碼（至少 6 個字符）"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                確認新密碼
              </label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                placeholder="再次輸入新密碼"
              />
            </div>

            <Button
              type="submit"
              className="w-full py-3 text-base font-semibold"
              style={{ backgroundColor: "#06038d", color: "white" }}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  重置中...
                </>
              ) : (
                "重置密碼"
              )}
            </Button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                返回登入
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
