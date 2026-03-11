import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatHKLocale } from "@/lib/formatDate";
import { Loader2, Plus, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { BatchTaskProgressBar } from "@/components/BatchTaskProgressBar";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";




export function AdminDataSources() {
  const [snkrdunkUrl, setSnkrdunkUrl] = useState("");
  const [gameId, setGameId] = useState<number>(1); // Default to Pokémon
  const [productType, setProductType] = useState<"single_card" | "sealed_product">("single_card"); // Default to single_card
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [batchResults, setBatchResults] = useState<{success: number; failed: number; errors: string[]; duplicates: number; progress?: string; failedUrls?: string[]}>({ success: 0, failed: 0, errors: [], duplicates: 0 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchUpdateStatus, setBatchUpdateStatus] = useState<Record<number, 'pending' | 'updating' | 'success' | 'failed'>>({});
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const pausedRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const [gameFilter, setGameFilter] = useState<number | undefined>(undefined); // undefined = all games

  // Clear selected items when filter changes
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, searchQuery, gameFilter]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const utils = trpc.useUtils();
  const gamesQuery = trpc.admin.getGames.useQuery();
  const dataSourcesQuery = trpc.admin.getDataSources.useQuery({ 
    page, 
    pageSize,
    search: searchQuery || undefined,
    status: statusFilter,
    gameId: gameFilter,
  });
  const statsQuery = trpc.admin.getDataSourceStats.useQuery();
  const allFilteredIdsQuery = trpc.admin.getAllFilteredDataSourceIds.useQuery({
    search: searchQuery || undefined,
    status: statusFilter,
    gameId: gameFilter,
  });
  const allUrlsQuery = trpc.admin.getAllDataSourceUrls.useQuery(); // Get all URLs for deduplication




  const addDataSourceMutation = trpc.admin.addSnkrdunkSource.useMutation({
    onSuccess: () => {
      toast.success("SNKRDUNK 數據源已添加");
      setSnkrdunkUrl("");
      utils.admin.getDataSources.invalidate();
    },
    onError: (error: any) => {
      toast.error(`添加失敗: ${error.message}`);
    },
  });

  const refreshDataSourceMutation = trpc.admin.refreshDataSource.useMutation({
    onSuccess: () => {
      toast.success("數據源已更新");
      utils.admin.getDataSources.invalidate();
    },
    onError: (error: any) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const cleanDuplicatesMutation = trpc.admin.cleanDuplicateDataSources.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      utils.admin.getDataSources.invalidate();
      setSelectedIds([]); // Clear selection after cleanup
    },
    onError: (error: any) => {
      toast.error(`清理失敗: ${error.message}`);
    },
  });

  const deleteFailedMutation = trpc.admin.deleteFailedDataSources.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      utils.admin.getDataSources.invalidate();

    },
    onError: (error: any) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });



  const handleCleanDuplicates = () => {
    if (confirm('確定要清理重複的數據源嗎？系統將保留最後添加的版本（最新），刪除其他重複項。')) {
      cleanDuplicatesMutation.mutate();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snkrdunkUrl.trim()) {
      toast.error("請輸入 SNKRDUNK 連結");
      return;
    }

    // Split by newlines and filter out empty lines
    const urls = snkrdunkUrl
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      toast.error("請輸入至少一個 SNKRDUNK 連結");
      return;
    }

    // Validate all URLs
    const invalidUrls = urls.filter(url => !url.includes("snkrdunk.com"));
    if (invalidUrls.length > 0) {
      toast.error(`發現 ${invalidUrls.length} 個無效連結，請確保所有連結都來自 snkrdunk.com`);
      return;
    }

    // Deduplicate URLs - use all URLs from database, not just current page
    const existingUrls = allUrlsQuery.data || [];
    const uniqueUrls = Array.from(new Set(urls)); // Remove duplicates within input
    // Normalize URLs for comparison (remove query params and fragments)
    const normalizeUrl = (url: string) => url.split('?')[0].split('#')[0];
    const normalizedExistingUrls = existingUrls.map(normalizeUrl);
    const newUrls = uniqueUrls.filter(url => !normalizedExistingUrls.includes(normalizeUrl(url))); // Remove existing URLs
    let duplicateCount = urls.length - newUrls.length;

    if (newUrls.length === 0) {
      toast.error(`所有 URL 都已存在，無需添加`);
      setBatchResults({ success: 0, failed: 0, errors: [], duplicates: duplicateCount });
      return;
    }

    if (duplicateCount > 0) {
      toast.info(`已過濾 ${duplicateCount} 個重複 URL`);
    }

    setIsSubmitting(true);
    setBatchResults({ success: 0, failed: 0, errors: [], duplicates: duplicateCount });
    
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const failedUrls: string[] = [];

    try {
      // Process URLs in parallel batches with rate limiting
      const BATCH_SIZE = 50; // Process 50 URLs at a time to avoid rate limits
      const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
      
      pausedRef.current = false;
      setIsPaused(false);
      
      for (let i = 0; i < newUrls.length; i += BATCH_SIZE) {
        // Check if paused
        while (pausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const batch = newUrls.slice(i, i + BATCH_SIZE);
        const batchEnd = Math.min(i + BATCH_SIZE, newUrls.length);
        setBatchResults(prev => ({ ...prev, progress: `處理中 ${batchEnd}/${newUrls.length}` }));
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(url => addDataSourceMutation.mutateAsync({ url, gameId, productType }))
        );
        
        // Add delay between batches to avoid rate limits (except for last batch)
        if (i + BATCH_SIZE < newUrls.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        
        // Count successes, failures, and duplicates
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const response = result.value as any;
            if (response?.status === 'duplicate') {
              // Duplicate URL - count as skipped, not failed
              duplicateCount++;
            } else {
              successCount++;
            }
          } else {
            // Check if error is due to duplicate
            const errorMsg = (result.reason as any)?.message || '未知錯誤';
            if (errorMsg.includes('already exists')) {
              // Duplicate URL - count as skipped, not failed
              duplicateCount++;
            } else {
              // Real error - count as failed
              failedCount++;
              const url = batch[index];
              errors.push(`${url}: ${errorMsg}`);
              failedUrls.push(url);
            }
          }
        });
      }

      const endTime = Date.now();
      const durationSeconds = ((endTime - startTime) / 1000).toFixed(1);
      const avgSpeed = (newUrls.length / (endTime - startTime) * 1000).toFixed(1);
      
      setBatchResults({ success: successCount, failed: failedCount, errors, duplicates: duplicateCount, failedUrls });
      
      if (successCount > 0) {
        setPage(1); // 跳轉到第一頁查看新添加的數據源
        toast.success(`成功添加 ${successCount} 個數據源${failedCount > 0 ? `，失敗 ${failedCount} 個` : ''}(耗時 ${durationSeconds} 秒，平均 ${avgSpeed} URL/秒)`);
        if (failedCount === 0) {
          setSnkrdunkUrl("");
        }
      } else {
        toast.error(`所有 ${failedCount} 個數據源添加失敗`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = (dataSourceId: number) => {
    refreshDataSourceMutation.mutate({ dataSourceId });
  };

  const handleRetryFailed = () => {
    if (!batchResults.failedUrls || batchResults.failedUrls.length === 0) {
      return;
    }
    
    // Fill the input with failed URLs
    const failedUrlsText = batchResults.failedUrls.join('\n');
    setSnkrdunkUrl(failedUrlsText);
    
    // Clear the batch results
    setBatchResults({ success: 0, failed: 0, errors: [], duplicates: 0 });
    
    // Show a toast to inform the user
    toast.info(`已填入 ${batchResults.failedUrls.length} 個失敗 URL，請點擊「添加數據源」按鈕重試`);
  };



  const updateEnglishNamesMutation = trpc.admin.updateCardEnglishNames.useMutation({
    onSuccess: (result) => {
      toast.success(`已更新 ${result.updated} 張卡牌的英文名稱`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} 張卡牌更新失敗`);
      }
      utils.admin.getDataSources.invalidate();
    },
    onError: (error: any) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  // === 持久化批量更新 ===
  const [snkrdunkTaskId, setSnkrdunkTaskId] = useState<number | null>(null);

  // 啟動 SNKRDUNK 批量更新
  const startSnkrdunkBatchUpdateMutation = trpc.admin.startPersistentSnkrdunkBatchUpdate.useMutation({
    onSuccess: (result) => {
      setSnkrdunkTaskId(result.taskId);
      toast.success(result.message);
    },
    onError: (error: any) => {
      toast.error(`啟動 SNKRDUNK 批量更新失敗: ${error.message}`);
    },
  });

  // 輪詢 SNKRDUNK 任務進度
  const { data: snkrdunkTaskProgress } = trpc.admin.getPersistentTaskProgress.useQuery(
    { taskType: 'batch_snkrdunk_update' },
    {
      enabled: true, // 總是啟用，以支持跨會話恢復
      refetchInterval: 3000, // 每 3 秒輪詢
    }
  );

  // 暫停/繼續/取消 SNKRDUNK 任務
  const pauseSnkrdunkTaskMutation = trpc.admin.pausePersistentTask.useMutation({
    onSuccess: () => {
      toast.info("SNKRDUNK 批量更新已暫停");
    },
  });

  const resumeSnkrdunkTaskMutation = trpc.admin.resumePersistentTask.useMutation({
    onSuccess: () => {
      toast.info("SNKRDUNK 批量更新已繼續");
    },
  });

  const cancelSnkrdunkTaskMutation = trpc.admin.cancelPersistentTask.useMutation({
    onSuccess: () => {
      toast.success("已取消 SNKRDUNK 批量更新任務");
      utils.admin.getDataSources.invalidate();
      setSnkrdunkTaskId(null);
    },
    onError: (error: any) => {
      toast.error(`取消任務失敗: ${error.message}`);
    },
  });

  // 當任務完成時，顯示通知並刷新數據
  useEffect(() => {
    if (snkrdunkTaskProgress && snkrdunkTaskProgress.status === 'completed') {
      toast.success(`SNKRDUNK 批量更新完成！成功: ${snkrdunkTaskProgress.successCount}，失敗: ${snkrdunkTaskProgress.failureCount}`);
      utils.admin.getDataSources.invalidate();
      setSnkrdunkTaskId(null);
    }
  }, [snkrdunkTaskProgress?.status]);

  const deleteDataSourceMutation = trpc.admin.deleteDataSource.useMutation({
    onSuccess: () => {
      toast.success("數據源已刪除");
      utils.admin.getDataSources.invalidate();
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error("請選擇要刪除的數據源");
      return;
    }

    if (!confirm(`確定要刪除 ${selectedIds.length} 個數據源嗎？`)) {
      return;
    }

    for (const id of selectedIds) {
      try {
        await deleteDataSourceMutation.mutateAsync({ dataSourceId: id });
      } catch (error) {
        console.error(`Failed to delete data source ${id}:`, error);
      }
    }

    toast.success(`已刪除 ${selectedIds.length} 個數據源`);
    setSelectedIds([]);
    utils.admin.getDataSources.invalidate();
  };

  const toggleSelectAll = () => {
    if (!allFilteredIdsQuery.data) return;
    
    // Check if all filtered items are selected
    const allFilteredIds = allFilteredIdsQuery.data;
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      // Deselect all
      setSelectedIds([]);
    } else {
      // Select all filtered items
      setSelectedIds(allFilteredIds);
      toast.success(`已選擇 ${allFilteredIds.length} 個數據源`);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 批量更新選中的數據源
  const handleBatchUpdate = async () => {
    if (selectedIds.length === 0) {
      toast.error("請選擇要更新的數據源");
      return;
    }

    toast.info(`開始批量更新 ${selectedIds.length} 個數據源...`);


    setIsBatchUpdating(true);
    
    // 初始化所有選中項目的狀態為 pending
    const initialStatus: Record<number, 'pending' | 'updating' | 'success' | 'failed'> = {};
    selectedIds.forEach(id => {
      initialStatus[id] = 'pending';
    });
    setBatchUpdateStatus(initialStatus);

    let successCount = 0;
    let failedCount = 0;

    // 逐個更新數據源
    for (const id of selectedIds) {
      try {
        // 更新狀態為 updating
        setBatchUpdateStatus(prev => ({ ...prev, [id]: 'updating' }));

        // 調用更新 API
        await refreshDataSourceMutation.mutateAsync({ dataSourceId: id });
        
        // 更新狀態為 success
        setBatchUpdateStatus(prev => ({ ...prev, [id]: 'success' }));
        successCount++;

        // 每次更新後延遲 500ms，避免 API 限制
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`Failed to update data source ${id}:`, error);
        // 更新狀態為 failed
        setBatchUpdateStatus(prev => ({ ...prev, [id]: 'failed' }));
        failedCount++;
      }
    }

    setIsBatchUpdating(false);
    
    // 刷新數據源列表
    utils.admin.getDataSources.invalidate();

    // 顯示結果
    if (failedCount === 0) {
      toast.success(`成功更新 ${successCount} 個數據源`);
    } else {
      toast.warning(`更新完成：成功 ${successCount} 個，失敗 ${failedCount} 個`);
    }

    // 3 秒後清除狀態
    setTimeout(() => {
      setBatchUpdateStatus({});
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">數據源管理</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">管理卡牌數據源與價格更新</p>
      </div>

          {/* Add SNKRDUNK Source */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">
              手動添加 SNKRDUNK 數據源
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Game Type Selector */}
              <div>
                <Label htmlFor="game-type" className="text-foreground">
                  遊戲類型 *
                </Label>
                <Select value={gameId.toString()} onValueChange={(value) => setGameId(parseInt(value))} disabled={isSubmitting}>
                  <SelectTrigger id="game-type" className="mt-2">
                    <SelectValue placeholder="選擇遊戲類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Pokémon TCG</SelectItem>
                    <SelectItem value="2">One Piece Card Game</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  選擇卡牌所屬的遊戲類型
                </p>
              </div>

              {/* Product Type Selector */}
              <div>
                <Label htmlFor="product-type" className="text-foreground">
                  產品類型 *
                </Label>
                <Select value={productType} onValueChange={(value: "single_card" | "sealed_product") => setProductType(value)} disabled={isSubmitting}>
                  <SelectTrigger id="product-type" className="mt-2">
                    <SelectValue placeholder="選擇產品類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_card">單卡</SelectItem>
                    <SelectItem value="sealed_product">卡盒</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  選擇是單張卡牌還是卡盒產品
                </p>
              </div>

              <div>
                <Label htmlFor="snkrdunk-url" className="text-foreground">
                  SNKRDUNK 卡牌連結
                </Label>
                <Textarea
                  id="snkrdunk-url"
                  placeholder="https://snkrdunk.com/apparels/455596#1&#10;https://snkrdunk.com/apparels/455597#1&#10;https://snkrdunk.com/apparels/455598#1&#10;&#10;每行一個連結，支援批量添加"
                  value={snkrdunkUrl}
                  onChange={(e) => setSnkrdunkUrl(e.target.value)}
                  className="mt-2 min-h-[120px] font-mono text-sm"
                  disabled={isSubmitting}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  系統將自動抓取卡牌圖片與「最近の売買履歴」價格數據。支援批量添加，每行一個連結。
                </p>
                {batchResults.progress && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      {batchResults.progress}
                    </p>
                  </div>
                )}
                {(batchResults.success > 0 || batchResults.failed > 0 || batchResults.duplicates > 0) && !batchResults.progress ? (
                  <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="text-green-600 font-medium">✓ 成功: {batchResults.success}</span>
                      <span className="text-red-600 font-medium">✗ 失敗: {batchResults.failed}</span>
                      {batchResults.duplicates > 0 && (
                        <span className="text-yellow-600 font-medium">⚠ 已過濾重複: {batchResults.duplicates}</span>
                      )}
                    </div>
                    {batchResults.errors.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">失敗詳情:</p>
                          {batchResults.failedUrls && batchResults.failedUrls.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRetryFailed}
                              className="text-xs h-7"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              重試失敗項目 ({batchResults.failedUrls.length})
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {batchResults.errors.map((error, idx) => (
                            <p key={idx} className="text-xs text-red-600 font-mono">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      處理中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      添加數據源
                    </>
                  )}
                </Button>
                {isSubmitting && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      pausedRef.current = !pausedRef.current;
                      setIsPaused(pausedRef.current);
                      if (pausedRef.current) {
                        toast.info("已暫停，點擊繼續按鈕恢復處理");
                      } else {
                        toast.info("已繼續處理");
                      }
                    }}
                    className="flex-1 sm:flex-none"
                  >
                    {isPaused ? "繼續" : "暫停"}
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* Management Tools */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">
              管理工具
            </h2>
            <div className="flex gap-4 flex-wrap">
              <Button
                onClick={() => startSnkrdunkBatchUpdateMutation.mutate()}
                disabled={startSnkrdunkBatchUpdateMutation.isPending || (snkrdunkTaskProgress?.status === 'running' || snkrdunkTaskProgress?.status === 'paused')}
                variant="outline"
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                {startSnkrdunkBatchUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    啟動中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    批量更新所有卡牌 SNKRDUNK 價格
                  </>
                )}
              </Button>
            </div>

            {/* 批量更新進度條 */}
            <div className="mt-6 space-y-4">
              {snkrdunkTaskProgress && (snkrdunkTaskProgress.status === 'running' || snkrdunkTaskProgress.status === 'paused') && (
                <BatchTaskProgressBar
                  taskType="SNKRDUNK"
                  progress={snkrdunkTaskProgress}
                  onPause={() => pauseSnkrdunkTaskMutation.mutate({ taskId: snkrdunkTaskProgress.taskId })}
                  onResume={() => resumeSnkrdunkTaskMutation.mutate({ taskId: snkrdunkTaskProgress.taskId })}
                  onCancel={() => cancelSnkrdunkTaskMutation.mutate({ taskId: snkrdunkTaskProgress.taskId })}
                  isPauseLoading={pauseSnkrdunkTaskMutation.isPending}
                  isResumeLoading={resumeSnkrdunkTaskMutation.isPending}
                />
              )}

            </div>
          </Card>

          {/* Data Sources List */}
          <Card className="p-6 bg-card border-border">
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <Input
                type="text"
                placeholder="搜尋卡牌名稱（中/日文）或 URL..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1); // Reset to first page when searching
                }}
                className="max-w-sm"
              />
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">遊戲類別：</Label>
                <Select
                  value={gameFilter === undefined ? "all" : String(gameFilter)}
                  onValueChange={(value) => {
                    setGameFilter(value === "all" ? undefined : Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="全部遊戲" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部遊戲</SelectItem>
                    {gamesQuery.data?.map((game) => (
                      <SelectItem key={game.id} value={String(game.id)}>
                        {game.nameZh || game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">狀態篩選：</Label>
                <Select value={statusFilter} onValueChange={(value: any) => {
                  setStatusFilter(value);
                  setPage(1); // Reset to first page when filtering
                }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      全部 {statsQuery.data ? `(${statsQuery.data.total})` : ''}
                    </SelectItem>
                    <SelectItem value="success">
                      成功 {statsQuery.data ? `(${statsQuery.data.success})` : ''}
                    </SelectItem>
                    <SelectItem value="pending">
                      待處理 {statsQuery.data ? `(${statsQuery.data.pending})` : ''}
                    </SelectItem>
                    <SelectItem value="failed">
                      失敗 {statsQuery.data ? `(${statsQuery.data.failed})` : ''}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(searchQuery || gameFilter !== undefined || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setGameFilter(undefined);
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  清除篩選
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-base sm:text-lg font-semibold text-foreground">
                  數據源列表
                  {(searchQuery || gameFilter !== undefined || statusFilter !== "all") && dataSourcesQuery.data && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      篩選結果：{dataSourcesQuery.data.total} 條
                    </span>
                  )}
                </h2>
                {dataSourcesQuery.data && dataSourcesQuery.data?.data?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedIds.length === dataSourcesQuery.data?.data?.length}
                      onCheckedChange={toggleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                      全選
                    </label>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleBatchUpdate}
                      disabled={isBatchUpdating}
                    >
                      {isBatchUpdating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      批量更新 ({selectedIds.length})
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBatchDelete}
                      disabled={deleteDataSourceMutation.isPending}
                    >
                      {deleteDataSourceMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      刪除 ({selectedIds.length})
                    </Button>
                  </>
                )}
                {/* 調用後端 API 獲取所有數據源的 URL 列表（不分頁），確保能清理平台內重複的URL */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCleanDuplicates}
                  disabled={cleanDuplicatesMutation.isPending}
                  title="清理重複的數據源（保留最後添加的）"
                >
                  {cleanDuplicatesMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  清理重複
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dataSourcesQuery.refetch()}
                  disabled={dataSourcesQuery.isLoading}
                >
                  {dataSourcesQuery.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {dataSourcesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : dataSourcesQuery.data && dataSourcesQuery.data?.data?.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  // Backend now handles search filtering, no need for frontend filtering
                  const displayData = dataSourcesQuery.data?.data || [];
                  
                  if (displayData.length === 0 && searchQuery) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        找不到符合「{searchQuery}」的數據源
                      </div>
                    );
                  }
                  
                  return displayData.map((source: any) => (
                  <div
                    key={source.id}
                    className="flex items-start justify-between gap-4 p-4 bg-background rounded-lg border border-border"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Checkbox
                        id={`select-${source.id}`}
                        checked={selectedIds.includes(source.id)}
                        onCheckedChange={() => toggleSelect(source.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {source.source.toUpperCase()}
                        </span>
                        {source.isActive === 1 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        {/* Game Type Badge - dynamic from games table */}
                        {(() => {
                          const game = gamesQuery.data?.find(g => g.id === source.gameId);
                          return (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                              {game ? (game.nameZh || game.name) : (source.gameId ? `Game #${source.gameId}` : '未知')}
                            </span>
                          );
                        })()}
                        {/* Product Type Badge */}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                          {source.productType === 'single_card' ? '單卡' : '卡盒'}
                        </span>
                        {/* 更新狀態顯示 */}
                        {batchUpdateStatus[source.id] && (
                          <span className={
                            batchUpdateStatus[source.id] === 'pending'
                              ? "text-xs text-yellow-500 font-medium"
                              : batchUpdateStatus[source.id] === 'updating'
                              ? "text-xs text-blue-500 font-medium flex items-center gap-1"
                              : batchUpdateStatus[source.id] === 'success'
                              ? "text-xs text-green-500 font-medium"
                              : "text-xs text-red-500 font-medium"
                          }>
                            {batchUpdateStatus[source.id] === 'pending' && '待處理'}
                            {batchUpdateStatus[source.id] === 'updating' && (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                更新中
                              </>
                            )}
                            {batchUpdateStatus[source.id] === 'success' && '✓ 成功'}
                            {batchUpdateStatus[source.id] === 'failed' && '✗ 失敗'}
                          </span>
                        )}
                      </div>
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {source.sourceUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {source.lastFetchedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            最後更新: {formatHKLocale(source.lastFetchedAt)}
                          </span>
                        )}
                        {source.lastFetchStatus && (
                          <span
                            className={
                              source.lastFetchStatus === "success"
                                ? "text-green-500"
                                : source.lastFetchStatus === "failed"
                                ? "text-red-500"
                                : "text-yellow-500"
                            }
                          >
                            狀態: {source.lastFetchStatus}
                          </span>
                        )}
                        </div>
                        {source.fetchErrorMessage && (
                        <p className="text-xs text-red-500">
                          錯誤: {source.fetchErrorMessage}
                        </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {source.card?.imageUrl && (
                        <img
                          src={source.card.imageUrl}
                          alt={source.card.name || "Card"}
                          className="w-20 h-28 object-cover rounded-md border border-border"
                        />
                      )}
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefresh(source.id)}
                          disabled={refreshDataSourceMutation.isPending}
                          title="更新 SNKRDUNK 價格"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                尚未添加任何數據源
              </div>
            )}
            
            {/* 分頁控件 */}
            {dataSourcesQuery.data && dataSourcesQuery.data.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="text-sm text-muted-foreground">
                  第 {page} / {dataSourcesQuery.data.totalPages} 頁，共 {dataSourcesQuery.data.total} 筆
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                  >
                    首頁
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    上一頁
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(dataSourcesQuery.data!.totalPages, p + 1))}
                    disabled={page === dataSourcesQuery.data.totalPages}
                  >
                    下一頁
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(dataSourcesQuery.data!.totalPages)}
                    disabled={page === dataSourcesQuery.data.totalPages}
                  >
                    末頁
                  </Button>
                </div>
              </div>
            )}
          </Card>
    </div>
  );
}
