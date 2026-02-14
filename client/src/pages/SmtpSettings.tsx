import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

export default function SmtpSettings() {
  const [, setLocation] = useLocation();
  const { user, loading, isAdmin } = useAdmin();
  const isAuthenticated = !!user;
  const [formData, setFormData] = useState({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    fromEmail: "",
    fromName: "BOXIUM PTCG",
  });
  const [testEmail, setTestEmail] = useState("");

  // Get current SMTP settings
  const { data: settings, isLoading: settingsLoading } = trpc.admin.getSmtpSettings.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort || "587",
        smtpUser: settings.smtpUser || "",
        smtpPass: "", // Don't show password
        fromEmail: settings.fromEmail || "",
        fromName: settings.fromName || "BOXIUM PTCG",
      });
    }
  }, [settings]);

  const saveSmtpMutation = trpc.admin.saveSmtpSettings.useMutation({
    onSuccess: () => {
      toast.success("SMTP 設定已保存");
    },
    onError: (error) => {
      toast.error(`保存失敗: ${error.message}`);
    },
  });

  const testSmtpMutation = trpc.admin.testSmtpConnection.useMutation({
    onSuccess: () => {
      toast.success("測試郵件已發送！請檢查您的收件箱");
    },
    onError: (error) => {
      toast.error(`發送失敗: ${error.message}`);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSmtpMutation.mutate(formData);
  };

  const handleTest = () => {
    if (!testEmail) {
      toast.error("請輸入測試郵箱地址");
      return;
    }
    testSmtpMutation.mutate({ email: testEmail });
  };

  if (loading || settingsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-lg mb-4">請先登入</p>
          <Button onClick={() => setLocation("/login")}>
            前往登入
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (user?.role !== "admin") {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <p className="text-lg">您沒有權限訪問此頁面</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">SMTP 郵件服務設定</h1>
          <p className="text-gray-600">
            配置 SMTP 服務器以啟用密碼重置和郵箱驗證功能
          </p>
        </div>

        <div className="grid gap-6">
          {/* SMTP Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP 服務器配置
              </CardTitle>
              <CardDescription>
                配置您的 SMTP 郵件服務器。支持 Gmail、SendGrid、Mailgun 等服務。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smtpHost">SMTP 主機</Label>
                    <Input
                      id="smtpHost"
                      value={formData.smtpHost}
                      onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtpPort">SMTP 端口</Label>
                    <Input
                      id="smtpPort"
                      value={formData.smtpPort}
                      onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value })}
                      placeholder="587"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="smtpUser">SMTP 用戶名</Label>
                  <Input
                    id="smtpUser"
                    type="email"
                    value={formData.smtpUser}
                    onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                    placeholder="your-email@gmail.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="smtpPass">SMTP 密碼</Label>
                  <Input
                    id="smtpPass"
                    type="password"
                    value={formData.smtpPass}
                    onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
                    placeholder="留空表示不更改密碼"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Gmail 用戶請使用應用專用密碼，而不是您的 Gmail 密碼
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromEmail">發件人郵箱</Label>
                    <Input
                      id="fromEmail"
                      type="email"
                      value={formData.fromEmail}
                      onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                      placeholder="noreply@boxium.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="fromName">發件人名稱</Label>
                    <Input
                      id="fromName"
                      value={formData.fromName}
                      onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                      placeholder="BOXIUM PTCG"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={saveSmtpMutation.isPending}
                >
                  {saveSmtpMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      保存設定
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Test Email Card */}
          <Card>
            <CardHeader>
              <CardTitle>測試郵件發送</CardTitle>
              <CardDescription>
                發送測試郵件以驗證 SMTP 配置是否正確
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="輸入測試郵箱地址"
                  className="flex-1"
                />
                <Button
                  onClick={handleTest}
                  disabled={testSmtpMutation.isPending || !testEmail}
                >
                  {testSmtpMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      發送中...
                    </>
                  ) : (
                    "發送測試郵件"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card>
            <CardHeader>
              <CardTitle>常見 SMTP 服務器配置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">Gmail</h4>
                  <p className="text-gray-600">
                    主機: smtp.gmail.com | 端口: 587 | 需要應用專用密碼
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">SendGrid</h4>
                  <p className="text-gray-600">
                    主機: smtp.sendgrid.net | 端口: 587 | 用戶名: apikey
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Mailgun</h4>
                  <p className="text-gray-600">
                    主機: smtp.mailgun.org | 端口: 587
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
