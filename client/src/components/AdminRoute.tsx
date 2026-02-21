import { ReactNode } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * AdminRoute - 保護需要管理員權限的路由
 * 
 * 如果用戶未登入，重定向到登入頁面
 * 如果用戶不是管理員，顯示無權限頁面
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

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
    return <Redirect to="/login" />;
  }

  // 如果不是管理員，顯示無權限頁面
  if (user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md px-6">
          <ShieldAlert className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">無權限訪問</h1>
          <p className="text-gray-600 mb-8">
            抱歉，您沒有權限訪問此頁面。此頁面僅限管理員訪問。
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
          >
            返回首頁
          </Button>
        </div>
      </div>
    );
  }

  // 已登入且是管理員，顯示內容
  return <>{children}</>;
}
