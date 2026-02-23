import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  
  // 🔧 開發環境跳過認證檢查（不影響生產環境）
  const isDevelopment = import.meta.env.DEV;
  
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: !isDevelopment, // 開發環境不查詢用戶
  });

  useEffect(() => {
    // 開發環境直接允許訪問
    if (isDevelopment) {
      setIsChecking(false);
      return;
    }

    if (isLoading) {
      return;
    }

    // 生產環境：如果沒有用戶或不是管理員，重定向到首頁
    if (!user || user.role !== 'admin') {
      setLocation("/");
      return;
    }

    setIsChecking(false);
  }, [user, isLoading, setLocation, isDevelopment]);

  // 開發環境直接渲染內容
  if (isDevelopment) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">正在驗證權限...</p>
        </div>
      </div>
    );
  }

  // If user is admin, render children
  if (user && user.role === 'admin') {
    return <>{children}</>;
  }

  // Otherwise, don't render anything (will redirect)
  return null;
}
