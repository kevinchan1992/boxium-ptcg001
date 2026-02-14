import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestResetMutation.mutate({ email });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">檢查您的郵箱</h2>
            <p className="text-gray-600 mb-6">
              如果該電子郵件存在於我們的系統中，我們已發送密碼重置連結到您的郵箱。
            </p>
            <p className="text-sm text-gray-500 mb-6">
              請檢查您的收件箱（包括垃圾郵件文件夾），並點擊郵件中的連結重置密碼。
            </p>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full"
              style={{ backgroundColor: "#06038d" }}
            >
              返回登入
            </Button>
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
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">
              忘記密碼
            </h1>
            <p className="text-gray-600 mt-2">
              輸入您的電子郵件地址，我們將發送密碼重置連結給您
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {requestResetMutation.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {requestResetMutation.error.message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                電子郵件
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="輸入您的電子郵件"
              />
            </div>

            <Button
              type="submit"
              className="w-full py-3 text-base font-semibold"
              style={{ backgroundColor: "#06038d", color: "white" }}
              disabled={requestResetMutation.isPending}
            >
              {requestResetMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  發送中...
                </>
              ) : (
                "發送重置連結"
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
