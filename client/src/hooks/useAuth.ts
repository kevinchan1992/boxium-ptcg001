import { trpc } from "@/lib/trpc";

/**
 * useAuth hook - 獲取當前用戶資訊和登入狀態
 * 
 * @returns {Object} 包含 user（用戶資訊）和 isLoading（加載狀態）
 */
export function useAuth() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  
  return {
    user: user || null,
    isLoading,
  };
}
