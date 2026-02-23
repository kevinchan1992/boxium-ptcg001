import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Database, AlertCircle, Flame } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AdminCacheManagement() {
  const [cardIdInput, setCardIdInput] = useState("");
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [warmingInProgress, setWarmingInProgress] = useState(false);

  // Fetch cache statistics
  const { data: cacheStats, refetch: refetchStats } = trpc.admin.getCacheStats.useQuery();

  // Clear specific card cache mutation
  const clearCardCache = trpc.admin.clearCardCache.useMutation({
    onSuccess: (result) => {
      toast.success("緩存已清除", {
        description: `已清除卡牌 ${cardIdInput} 的 ${result.deletedCount} 條緩存記錄`,
      });
      setCardIdInput("");
      refetchStats();
    },
    onError: (error) => {
      toast.error("清除失敗", {
        description: error.message,
      });
    },
  });

  // Trigger cache warming mutation
  const triggerCacheWarming = trpc.admin.triggerCacheWarming.useMutation({
    onSuccess: (result) => {
      setWarmingInProgress(false);
      toast.success("快取預熱完成", {
        description: `成功: ${result.successCount}/${result.totalCards}, 失敗: ${result.failureCount}, 耗時: ${(result.duration / 1000).toFixed(2)}秒`,
      });
      refetchStats();
    },
    onError: (error) => {
      setWarmingInProgress(false);
      toast.error("快取預熱失敗", {
        description: error.message,
      });
    },
  });

  // Clear all cache mutation
  const clearAllCache = trpc.admin.clearAllCache.useMutation({
    onSuccess: (result) => {
      toast.success("所有緩存已清除", {
        description: `已清除 ${result.deletedCount} 條緩存記錄`,
      });
      refetchStats();
      setShowClearAllDialog(false);
    },
    onError: (error) => {
      toast.error("清除失敗", {
        description: error.message,
      });
      setShowClearAllDialog(false);
    },
  });

  const handleClearCardCache = () => {
    const cardId = parseInt(cardIdInput, 10);
    if (isNaN(cardId) || cardId <= 0) {
      toast.error("無效的卡牌 ID", {
        description: "請輸入有效的卡牌 ID（正整數）",
      });
      return;
    }
    clearCardCache.mutate({ cardId });
  };

  const handleClearAllCache = () => {
    clearAllCache.mutate();
  };

  const handleTriggerCacheWarming = () => {
    setWarmingInProgress(true);
    triggerCacheWarming.mutate({ cardLimit: 20 });
  };

  return (
    <div className="space-y-6">
      {/* Cache Statistics */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
            <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            緩存統計
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs sm:text-sm">
            查看當前 SNKRDUNK 價格緩存狀態
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cacheStats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">總緩存數量</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{cacheStats.totalCount}</p>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">最舊緩存</p>
                <p className="text-sm font-medium text-white">
                  {cacheStats.oldestCache 
                    ? new Date(cacheStats.oldestCache).toLocaleString("zh-TW")
                    : "N/A"}
                </p>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">最新緩存</p>
                <p className="text-sm font-medium text-white">
                  {cacheStats.newestCache 
                    ? new Date(cacheStats.newestCache).toLocaleString("zh-TW")
                    : "N/A"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-400">載入中...</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            className="w-full md:w-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新統計
          </Button>
        </CardContent>
      </Card>

      {/* Cache Warming */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
            快取預熱
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs sm:text-sm">
            預先爬取熱門卡牌數據，減少用戶首次查詢等待時間
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-300">
              <p className="font-medium mb-1">使用說明</p>
              <p>快取預熱將自動爬取最近更新的 20 張卡牌的 SNKRDUNK 價格數據，預計需要 3-5 分鐘。預熱完成後，用戶訪問這些卡牌時將立即顯示價格數據，無需等待爬取。</p>
            </div>
          </div>

          <BrandButton
            onClick={handleTriggerCacheWarming}
            disabled={warmingInProgress}
            className="w-full md:w-auto"
          >
            {warmingInProgress ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                預熱中...
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 mr-2" />
                開始快取預熱
              </>
            )}
          </BrandButton>
        </CardContent>
      </Card>

      {/* Clear Specific Card Cache */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">清除指定卡牌緩存</CardTitle>
          <CardDescription className="text-gray-400">
            輸入卡牌 ID 清除該卡牌的 SNKRDUNK 價格緩存，強制重新抓取最新數據
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cardId" className="text-gray-300">卡牌 ID</Label>
            <div className="flex gap-2">
              <Input
                id="cardId"
                type="number"
                placeholder="例如: 180001"
                value={cardIdInput}
                onChange={(e) => setCardIdInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <BrandButton
                onClick={handleClearCardCache}
                disabled={clearCardCache.isPending || !cardIdInput}
                className="whitespace-nowrap"
              >
                {clearCardCache.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    清除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除緩存
                  </>
                )}
              </BrandButton>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">使用說明</p>
              <p>清除緩存後，下次訪問該卡牌的 Pricing 頁面時，系統將自動重新抓取 SNKRDUNK 最新價格數據。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clear All Cache */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">清除所有緩存</CardTitle>
          <CardDescription className="text-gray-400">
            清除所有卡牌的 SNKRDUNK 價格緩存，強制重新抓取所有數據
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <p className="font-medium mb-1">警告</p>
              <p>此操作將清除所有緩存數據，下次訪問 Pricing 頁面時將重新抓取所有卡牌的價格數據，可能需要較長時間。</p>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setShowClearAllDialog(true)}
            disabled={clearAllCache.isPending}
            className="w-full md:w-auto"
          >
            {clearAllCache.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                清除中...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                清除所有緩存
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">確認清除所有緩存？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              此操作將清除所有 {cacheStats?.totalCount || 0} 條 SNKRDUNK 價格緩存記錄。
              清除後，系統將在下次訪問時重新抓取所有卡牌的最新價格數據。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllCache}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              確認清除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
