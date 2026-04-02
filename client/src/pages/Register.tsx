import { parseApiError } from "@/lib/parseApiError";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Mail, CheckCircle } from "lucide-react";

export default function Register() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      if (data.requiresEmailVerification) {
        // Show verification pending screen
        setRegisteredEmail(email);
        setIsLoading(false);
      } else {
        // Fallback: direct login (shouldn't happen for password accounts)
        toast.success(t("register.successToast"));
        setTimeout(() => {
          window.location.href = "/";
        }, 100);
      }
    },
    onError: (error) => {
      toast.error(parseApiError(error));
      setIsLoading(false);
    },
  });

  const resendMutation = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: () => {
      toast.success("驗證電郵已重新發送！");
    },
    onError: () => {
      toast.error("發送失敗，請稍後再試");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password match
    if (password !== confirmPassword) {
      toast.error(t("register.passwordMismatch"));
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      toast.error(t("register.passwordTooShort"));
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error(t("register.passwordRequiresUppercase"));
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error(t("register.passwordRequiresLowercase"));
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error(t("register.passwordRequiresNumber"));
      return;
    }

    setIsLoading(true);
    
    try {
      await registerMutation.mutateAsync({ 
        email, 
        password,
        name: name || undefined 
      });
    } catch (error) {
      // Error handled in onError
    }
  };

  // Show verification pending screen after successful registration
  if (registeredEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img src="/boxium-logo.png" alt="BOXIUM LOGO" className="h-16 w-auto" />
            </div>
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">請驗證您的電郵地址</CardTitle>
            <CardDescription>
              我們已發送驗證電郵至
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-800 text-lg break-all">{registeredEmail}</p>
            </div>
            <p className="text-muted-foreground text-sm">
              請查看您的收件算（包括垃圾郵件），點擊驗證連結完成帳號啟用。<br />
              驗證連結將於 <strong>24 小時</strong>後過期。
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={resendMutation.isPending}
              onClick={() => resendMutation.mutate({ email: registeredEmail })}
            >
              {resendMutation.isPending ? "發送中..." : (
                <><Mail className="h-4 w-4 mr-2" />重新發送驗證電郵</>
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setLocation("/login")}>
              返回登入
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          {/* Company Logo */}
          <div className="flex justify-center">
            <img 
              src="/boxium-logo.png" 
              alt="BOXIUM LOGO" 
              className="h-20 w-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t("register.title")}</CardTitle>
          <CardDescription className="text-center">
            創建您的 BOXIUM PTCG 帳號
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("register.nameLabel")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("register.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("register.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                至少 8 個字符，包含大小寫字母和數字
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("register.confirmPasswordLabel")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "註冊中..." : "註冊"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            已經有帳號？{" "}
            <Link href="/login" className="text-primary hover:underline">
              立即登入
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
