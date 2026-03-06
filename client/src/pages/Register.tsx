import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Register() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("註冊成功！");
      // Wait a bit to ensure cookie is set before redirecting
      setTimeout(() => {
        window.location.href = "/";
        // Scroll to top after redirect
        window.scrollTo(0, 0);
      }, 100);
    },
    onError: (error) => {
      toast.error(error.message || "註冊失敗");
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password match
    if (password !== confirmPassword) {
      toast.error("密碼不一致");
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      toast.error("密碼至少需要 8 個字符");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error("密碼需要包含至少一個大寫字母");
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error("密碼需要包含至少一個小寫字母");
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error("密碼需要包含至少一個數字");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md bg-white text-gray-900 shadow-lg">
        <CardHeader className="space-y-4">
          {/* Company Logo */}
          <div className="flex justify-center">
            <img 
              src="/boxium-logo.png" 
              alt="BOXIUM LOGO" 
              className="h-20 w-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">註冊</CardTitle>
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
              <Label htmlFor="name">名稱（選填）</Label>
              <Input
                id="name"
                type="text"
                placeholder="您的名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                至少 8 個字符，包含大小寫字母和數字
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">確認密碼</Label>
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
          <div className="text-sm text-center text-gray-500">
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
