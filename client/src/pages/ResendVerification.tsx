import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, CheckCircle, ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo_004f9905.png"
              alt="BOXIUM"
              className="h-10 object-contain"
            />
          </div>
          {!sent ? (
            <>
              <CardTitle className="text-2xl text-center">重新發送驗證電郵</CardTitle>
              <CardDescription className="text-center">
                輸入您的電郵地址，我們將重新發送驗證連結
              </CardDescription>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-2xl text-center text-green-700">電郵已發送！</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">電郵地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={resendMutation.isPending || cooldown > 0}
              >
                {resendMutation.isPending ? (
                  "發送中..."
                ) : cooldown > 0 ? (
                  <><Mail className="h-4 w-4 mr-2" />發送驗證電郵（{cooldown} 秒後）</>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    發送驗證電郵
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setLocation("/login")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回登入
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground text-sm">
                驗證電郵已發送至 <strong>{email}</strong>。<br />
                請查看您的收件箱（包括垃圾郵件），點擊驗證連結完成帳號啟用。
              </p>
              <p className="text-muted-foreground text-xs">
                驗證連結將於 24 小時後過期。
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={cooldown > 0}
                onClick={() => { setSent(false); }}
              >
                {cooldown > 0 ? `重新發送（${cooldown} 秒後）` : "重新發送"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setLocation("/login")}
              >
                返回登入
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
