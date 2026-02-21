import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute - 保護需要登入的路由
 * 
 * 如果用戶未登入，重定向到登入頁面
 * 登入後會返回原頁面
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // 顯示加載狀態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#06038d] mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  // 如果未登入，重定向到登入頁面
  if (!user) {
    // TODO: 實作登入後返回原頁面功能
    const loginUrl = getLoginUrl();
    window.location.href = loginUrl;
    return null;
  }

  // 已登入，顯示內容
  return <>{children}</>;
}
