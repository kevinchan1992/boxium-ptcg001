import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Database, AlertCircle, Flame, List, ExternalLink } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import { AdminPuppeteerTest } from "./AdminPuppeteerTest";

export function AdminCacheManagement() {
  const [cardIdInput, setCardIdInput] = useState("");
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [warmingInProgress, setWarmingInProgress] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch cache statistics
  const { data: cacheStats, refetch: refetchStats } = trpc.admin.getCacheStats.useQuery();

  // Fetch cache list
  const { data: cacheList, refetch: refetchList, isLoading: isLoadingList } = trpc.admin.getAllCacheList.useQuery({
    page: currentPage,
    pageSize,
  });

  // Clear specific card cache mutation
  const clearCardCache = trpc.admin.clearCardCache.useMutation({
    onSuccess: (result) => {
      toast.success("緩存已清除", {
        description: `已清除卡牌 ${cardIdInput} 的 ${result.deletedCount} 條緩存記錄`,
      });
      setCardIdInput("");
      refetchStats();
      refetchList();
    },
    onError: (error) => {
      toast.error("清除失敗", {
        description: error.message,
      });
    },
  });

  // Clear single card cache mutation (from list)
  const clearSingleCardCache = trpc.admin.clearSingleCardCache.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      refetchStats();
      refetchList();
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
      refetchList();
    },
    onError: (error) => {
      setWarmingInProgress(false);
      toast.error("快取預熱失敗", {
        description: error.message,
      });
    },
  });

  // Clear all cache mutation
  const clearAllCacheBatch = trpc.admin.clearAllCacheBatch.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      refetchStats();
      refetchList();
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
    clearAllCacheBatch.mutate();
  };

  const handleTriggerCacheWarming = () => {
    setWarmingInProgress(true);
    triggerCacheWarming.mutate({ cardLimit: 20 });
  };

  const handleClearSingleCache = (cardId: number) => {
    clearSingleCardCache.mutate({ cardId });
  };

  const totalPages = cacheList ? Math.ceil(cacheList.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Puppeteer Test */}
      <AdminPuppeteerTest />

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
            onClick={() => {
              refetchStats();
              refetchList();
            }}
            className="w-full md:w-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新統計
          </Button>
        </CardContent>
      </Card>

      {/* Cache List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
            <List className="w-4 h-4 sm:w-5 sm:h-5" />
            緩存列表
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs sm:text-sm">
            查看所有卡牌的緩存狀態，包含過期時間和商品數量
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-400">載入中...</span>
            </div>
          ) : cacheList && cacheList.data.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableHead className="text-gray-300">卡牌圖片</TableHead>
                      <TableHead className="text-gray-300">卡牌名稱</TableHead>
                      <TableHead className="text-gray-300">卡號</TableHead>
                      <TableHead className="text-gray-300">商品數量</TableHead>
                      <TableHead className="text-gray-300">熱快取過期</TableHead>
                      <TableHead className="text-gray-300">冷快取過期</TableHead>
                      <TableHead className="text-gray-300">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cacheList.data.map((cache) => {
                      const now = new Date();
                      const hotExpired = new Date(cache.hotExpiresAt) < now;
                      const coldExpired = new Date(cache.expiresAt) < now;

                      return (
                        <TableRow key={cache.id} className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell>
                            {cache.cardImageUrl ? (
                              <img 
                                src={cache.cardImageUrl} 
                                alt={cache.cardName || "Card"} 
                                className="w-12 h-16 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-16 bg-zinc-700 rounded flex items-center justify-center text-gray-500 text-xs">
                                無圖
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            {cache.cardName || "未知卡牌"}
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {cache.cardNumber || "N/A"}
                          </TableCell>
                          <TableCell className="text-white">
                            {cache.itemCount} 個
                          </TableCell>
                          <TableCell>
                            <span className={hotExpired ? "text-red-400" : "text-green-400"}>
                              {hotExpired ? "已過期" : "有效"}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(cache.hotExpiresAt).toLocaleString("zh-TW", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={coldExpired ? "text-red-400" : "text-green-400"}>
                              {coldExpired ? "已過期" : "有效"}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(cache.expiresAt).toLocaleString("zh-TW", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClearSingleCache(cache.cardId)}
                                disabled={clearSingleCardCache.isPending}
                                className="text-xs"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                清除
                              </Button>
                              <Link href={`/pricing/${cache.cardId}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  查看
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    第 {currentPage} 頁，共 {totalPages} 頁（總共 {cacheList.total} 條記錄）
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      上一頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      下一頁
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              目前沒有任何緩存記錄
            </div>
          )}
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
            disabled={clearAllCacheBatch.isPending}
            className="w-full md:w-auto"
          >
            {clearAllCacheBatch.isPending ? (
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
