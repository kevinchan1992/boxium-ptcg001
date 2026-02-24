import { useState, useEffect } from "react";
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
import { AdminPlaywrightTest } from "./AdminPlaywrightTest";

export function AdminCacheManagement() {
  const [cardIdInput, setCardIdInput] = useState("");
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [warmingInProgress, setWarmingInProgress] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch cache statistics
  const { data: cacheStats, refetch: refetchStats } = trpc.admin.getCacheStats.useQuery();
  
  // Fetch detailed cache statistics
  const { data: detailedStats, refetch: refetchDetailedStats } = trpc.admin.getDetailedCacheStats.useQuery();
  
  // Batch update state
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  });
  const [isPaused, setIsPaused] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  
  // Process batch mutation
  const processBatch = trpc.admin.processBatch.useMutation();
  
  // Task management mutations
  const startTask = trpc.admin.startBatchUpdateTask.useMutation();
  const updateProgress = trpc.admin.updateBatchUpdateProgress.useMutation();
  const completeTask = trpc.admin.completeBatchUpdateTask.useMutation();
  const stopTask = trpc.admin.stopBatchUpdateTask.useMutation();
  
  // Query task progress (poll every 3 seconds)
  const { data: taskProgress } = trpc.admin.getSnkrdunkCacheBatchUpdateProgress.useQuery(undefined, {
    refetchInterval: 3000,
    enabled: isBatchUpdating || currentTaskId !== null,
  });
  
  // Restore progress from database on mount
  useEffect(() => {
    if (taskProgress && taskProgress.status === 'running') {
      setCurrentTaskId(taskProgress.taskId);
      setIsBatchUpdating(true);
      setBatchProgress({
        current: taskProgress.processedItems,
        total: taskProgress.totalItems,
        success: taskProgress.successCount,
        failed: taskProgress.failureCount,
        skipped: 0, // Not tracked separately
      });
      
      // Resume processing from where it left off
      const currentBatchIndex = Math.floor(taskProgress.processedItems / 50);
      processBatches(currentBatchIndex);
    }
  }, [taskProgress]);

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
  
  // Batch update control functions
  const startHeartbeat = () => {
    // Send heartbeat every 10 seconds to keep sandbox alive
    const interval = setInterval(() => {
      // Simple query to keep connection alive
      refetchStats();
    }, 10000);
    setHeartbeatInterval(interval);
  };
  
  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }
  };
  
  const startBatchUpdate = async () => {
    if (!detailedStats) return;
    
    try {
      // Create task record in database
      const result = await startTask.mutateAsync();
      
      if (result.existing) {
        toast.info("已有批量更新任務運行中", {
          description: "將從上次位置繼續",
        });
        return;
      }
      
      setCurrentTaskId(result.taskId);
      setIsBatchUpdating(true);
      setIsPaused(false);
      setBatchProgress({
        current: 0,
        total: result.totalItems || 0,
        success: 0,
        failed: 0,
        skipped: 0,
      });
      
      // Start heartbeat
      startHeartbeat();
      
      // Start processing batches
      processBatches(0);
    } catch (error: any) {
      toast.error("啟動批量更新失敗", {
        description: error.message,
      });
    }
  };
  
  const processBatches = async (startIndex: number) => {
    const batchSize = 50;
    let currentIndex = startIndex;
    
    while (currentIndex * batchSize < (detailedStats?.needUpdate || 0)) {
      if (isPaused) {
        // Paused, wait for resume
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      try {
        const result = await processBatch.mutateAsync({
          batchIndex: currentIndex,
          batchSize,
        });
        
        // Update progress in state
        setBatchProgress(prev => ({
          ...prev,
          current: prev.current + result.processed,
          success: prev.success + result.results.success,
          failed: prev.failed + result.results.failed,
          skipped: prev.skipped + result.results.skipped,
        }));
        
        // Save progress to database
        if (currentTaskId) {
          await updateProgress.mutateAsync({
            taskId: currentTaskId,
            processed: result.processed,
            success: result.results.success,
            failed: result.results.failed,
            skipped: result.results.skipped,
            errors: result.results.errors,
          });
        }
        
        // Check if done
        if (!result.hasMore) {
          // Mark task as completed
          if (currentTaskId) {
            await completeTask.mutateAsync({ taskId: currentTaskId });
          }
          
          // Completed
          stopBatchUpdate();
          toast.success("批量更新完成", {
            description: `成功: ${batchProgress.success}, 失敗: ${batchProgress.failed}, 跳過: ${batchProgress.skipped}`,
          });
          refetchDetailedStats();
          refetchList();
          break;
        }
        
        currentIndex++;
        
        // Wait 2 seconds before next batch
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        toast.error("批次處理失敗", {
          description: error.message,
        });
        // Continue to next batch
        currentIndex++;
      }
    }
  };
  
  const pauseBatchUpdate = () => {
    setIsPaused(true);
    toast.info("已暫停批量更新");
  };
  
  const resumeBatchUpdate = () => {
    setIsPaused(false);
    toast.info("已繼續批量更新");
  };
  
  const stopBatchUpdate = () => {
    setIsBatchUpdating(false);
    setIsPaused(false);
    stopHeartbeat();
    toast.info("已停止批量更新");
  };

  const totalPages = cacheList ? Math.ceil(cacheList.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Playwright Test */}
      <AdminPlaywrightTest />

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

          {/* Detailed Cache Statistics */}
          {detailedStats && (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">快取狀態分布</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-900/20 border border-green-700 p-4 rounded-lg">
                  <p className="text-sm text-green-400 mb-1">✅ 熱快取 (&lt; 1 小時)</p>
                  <p className="text-2xl font-bold text-green-400">{detailedStats.hotCache}</p>
                  <p className="text-xs text-gray-400 mt-1">跳過</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-700 p-4 rounded-lg">
                  <p className="text-sm text-yellow-400 mb-1">🟡 冷快取 (1-6 小時)</p>
                  <p className="text-2xl font-bold text-yellow-400">{detailedStats.coldCache}</p>
                  <p className="text-xs text-gray-400 mt-1">跳過</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-700 p-4 rounded-lg">
                  <p className="text-sm text-orange-400 mb-1">⚠️ 過期快取 (&gt; 6 小時)</p>
                  <p className="text-2xl font-bold text-orange-400">{detailedStats.expiredCache}</p>
                  <p className="text-xs text-gray-400 mt-1">需要更新</p>
                </div>
                <div className="bg-red-900/20 border border-red-700 p-4 rounded-lg">
                  <p className="text-sm text-red-400 mb-1">❌ 無快取</p>
                  <p className="text-2xl font-bold text-red-400">{detailedStats.noCache}</p>
                  <p className="text-xs text-gray-400 mt-1">需要更新</p>
                </div>
              </div>
              
              <div className="bg-zinc-800 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">需要爬取</p>
                  <p className="text-xl font-bold text-white">{detailedStats.needUpdate} 張 ({((detailedStats.needUpdate / detailedStats.total) * 100).toFixed(1)}%)</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">預計時間</p>
                  <p className="text-sm font-medium text-white">
                    {detailedStats.estimatedTimeMinutes < 60 
                      ? `${detailedStats.estimatedTimeMinutes.toFixed(0)} 分鐘`
                      : `${(detailedStats.estimatedTimeMinutes / 60).toFixed(1)} 小時`
                    }
                  </p>
                </div>
              </div>
              
              {/* Batch Update Controls */}
              {!isBatchUpdating ? (
                <Button
                  onClick={startBatchUpdate}
                  disabled={detailedStats.needUpdate === 0}
                  className="w-full"
                  size="lg"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  開始批量更新 SNKRDUNK 數據
                </Button>
              ) : (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">總進度</span>
                      <span className="text-white font-medium">
                        {batchProgress.current} / {batchProgress.total} ({((batchProgress.current / batchProgress.total) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-900/20 p-3 rounded-lg">
                      <p className="text-xs text-green-400 mb-1">成功</p>
                      <p className="text-xl font-bold text-green-400">{batchProgress.success}</p>
                    </div>
                    <div className="bg-red-900/20 p-3 rounded-lg">
                      <p className="text-xs text-red-400 mb-1">失敗</p>
                      <p className="text-xl font-bold text-red-400">{batchProgress.failed}</p>
                    </div>
                    <div className="bg-gray-700 p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">跳過</p>
                      <p className="text-xl font-bold text-white">{batchProgress.skipped}</p>
                    </div>
                  </div>
                  
                  {/* Sandbox Status */}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400">沙盒狀態：活躍 (心跳正常)</span>
                  </div>
                  
                  {/* Control Buttons */}
                  <div className="flex gap-2">
                    {!isPaused ? (
                      <Button
                        onClick={pauseBatchUpdate}
                        variant="outline"
                        className="flex-1"
                      >
                        ⏸️ 暫停
                      </Button>
                    ) : (
                      <Button
                        onClick={resumeBatchUpdate}
                        className="flex-1"
                      >
                        ▶️ 繼續
                      </Button>
                    )}
                    <Button
                      onClick={stopBatchUpdate}
                      variant="destructive"
                      className="flex-1"
                    >
                      ⏹️ 停止
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStats();
              refetchDetailedStats();
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
