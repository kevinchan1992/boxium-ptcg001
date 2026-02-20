import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { BatchTaskProgressBar } from "@/components/BatchTaskProgressBar";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";


// 單卡 eBay 價格更新按鈕組件
function UpdateEbayButton({ cardId }: { cardId: number }) {
  const utils = trpc.useUtils();
  const updateEbayMutation = trpc.admin.updateEbayPrices.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        utils.admin.getDataSources.invalidate();
      } else {
        toast.warning(result.message);
      }
    },
    onError: (error: any) => {
      toast.error(`更新 eBay 價格失敗: ${error.message}`);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => updateEbayMutation.mutate({ cardId })}
      disabled={updateEbayMutation.isPending}
      title="更新 eBay 市場參考價"
      className="text-xs"
    >
      {updateEbayMutation.isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        "eBay"
      )}
    </Button>
  );
}

export function AdminDataSources() {
  const [snkrdunkUrl, setSnkrdunkUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [batchResults, setBatchResults] = useState<{success: number; failed: number; errors: string[]; duplicates: number; progress?: string; failedUrls?: string[]; cancelled?: boolean}>({ success: 0, failed: 0, errors: [], duplicates: 0 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const utils = trpc.useUtils();
  const dataSourcesQuery = trpc.admin.getDataSources.useQuery({
    page: currentPage,
    pageSize,
    searchQuery: searchQuery || undefined,
  });




  const addDataSourceMutation = trpc.admin.addSnkrdunkSource.useMutation({
    onSuccess: () => {
      toast.success("SNKRDUNK 數據源已添加");
      setSnkrdunkUrl("");
      setCurrentPage(1); // Jump to first page to see new data source
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

    // Normalize URL function (same as backend)
    const normalizeUrl = (url: string) => url.split('?')[0].split('#')[0];
    
    // Deduplicate URLs with normalization
    const existingUrls = dataSourcesQuery.data?.data?.map((ds: any) => normalizeUrl(ds.sourceUrl)) || [];
    const uniqueUrls = Array.from(new Set(urls.map(normalizeUrl))); // Remove duplicates within input
    const urlMap = new Map(urls.map(url => [normalizeUrl(url), url])); // Map normalized to original
    const newNormalizedUrls = uniqueUrls.filter(normalized => !existingUrls.includes(normalized));
    const newUrls = newNormalizedUrls.map(normalized => urlMap.get(normalized)!); // Get original URLs
    const duplicateCount = urls.length - newUrls.length;

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
      const BATCH_SIZE = 5; // Process 5 URLs at a time to avoid rate limits
      const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
      
      pausedRef.current = false;
      cancelledRef.current = false;
      setIsPaused(false);
      
      for (let i = 0; i < newUrls.length; i += BATCH_SIZE) {
        // Check if cancelled
        if (cancelledRef.current) {
          setBatchResults(prev => ({ ...prev, progress: undefined, cancelled: true }));
          toast.info(`任務已取消。已處理 ${successCount + failedCount} / ${newUrls.length} 個 URL`);
          break;
        }
        
        // Check if paused
        while (pausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const batch = newUrls.slice(i, i + BATCH_SIZE);
        const batchEnd = Math.min(i + BATCH_SIZE, newUrls.length);
        setBatchResults(prev => ({ ...prev, progress: `處理中 ${batchEnd}/${newUrls.length}` }));
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(url => addDataSourceMutation.mutateAsync({ url }))
        );
        
        // Add delay between batches to avoid rate limits (except for last batch)
        if (i + BATCH_SIZE < newUrls.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        
        // Count successes, failures, and skipped
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const data = result.value as any;
            if (data.skipped) {
              // Skipped due to duplicate, don't count as failure
              // Already counted in duplicateCount
            } else {
              successCount++;
            }
          } else {
            failedCount++;
            const url = batch[index];
            const errorMsg = (result.reason as any)?.message || '未知錯誤';
            errors.push(`${url}: ${errorMsg}`);
            failedUrls.push(url);
          }
        });
      }

      const endTime = Date.now();
      const durationSeconds = ((endTime - startTime) / 1000).toFixed(1);
      const avgSpeed = (newUrls.length / (endTime - startTime) * 1000).toFixed(1);
      
      // Only show completion message if not cancelled
      if (!cancelledRef.current) {
        setBatchResults({ success: successCount, failed: failedCount, errors, duplicates: duplicateCount, failedUrls });
      }
      
      if (successCount > 0 && !cancelledRef.current) {
        toast.success(`成功添加 ${successCount} 個數據源${failedCount > 0 ? `，失敗 ${failedCount} 個` : ''}（耗時 ${durationSeconds} 秒，平均 ${avgSpeed} URL/秒）`);
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
  const [ebayTaskId, setEbayTaskId] = useState<number | null>(null);
  const [snkrdunkTaskId, setSnkrdunkTaskId] = useState<number | null>(null);

  // 啟動 eBay 批量更新
  const startEbayBatchUpdateMutation = trpc.admin.startPersistentEbayBatchUpdate.useMutation({
    onSuccess: (result) => {
      setEbayTaskId(result.taskId);
      toast.success(result.message);
    },
    onError: (error: any) => {
      toast.error(`啟動 eBay 批量更新失敗: ${error.message}`);
    },
  });

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

  // 輪詢 eBay 任務進度
  const { data: ebayTaskProgress } = trpc.admin.getPersistentTaskProgress.useQuery(
    { taskType: 'batch_ebay_update' },
    {
      enabled: true, // 總是啟用，以支持跨會話恢復
      refetchInterval: 3000, // 每 3 秒輪詢
    }
  );

  // 輪詢 SNKRDUNK 任務進度
  const { data: snkrdunkTaskProgress } = trpc.admin.getPersistentTaskProgress.useQuery(
    { taskType: 'batch_snkrdunk_update' },
    {
      enabled: true, // 總是啟用，以支持跨會話恢復
      refetchInterval: 3000, // 每 3 秒輪詢
    }
  );

  // 暫停/繼續/取消 eBay 任務
  const pauseEbayTaskMutation = trpc.admin.pausePersistentTask.useMutation({
    onSuccess: () => {
      toast.info("eBay 批量更新已暫停");
    },
  });

  const resumeEbayTaskMutation = trpc.admin.resumePersistentTask.useMutation({
    onSuccess: () => {
      toast.info("eBay 批量更新已繼續");
    },
  });

  const cancelEbayTaskMutation = trpc.admin.cancelPersistentTask.useMutation({
    onSuccess: () => {
      toast.success("已取消 eBay 批量更新任務");
      utils.admin.getDataSources.invalidate();
      setEbayTaskId(null);
    },
    onError: (error: any) => {
      toast.error(`取消任務失敗: ${error.message}`);
    },
  });

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
    if (ebayTaskProgress && ebayTaskProgress.status === 'completed') {
      toast.success(`eBay 批量更新完成！成功: ${ebayTaskProgress.successCount}，失敗: ${ebayTaskProgress.failureCount}`);
      utils.admin.getDataSources.invalidate();
      setEbayTaskId(null);
    }
  }, [ebayTaskProgress?.status]);

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
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === dataSourcesQuery.data?.data?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(dataSourcesQuery.data?.data?.map((ds: any) => ds.id) || []);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">數據源管理</h2>
        <p className="text-muted-foreground">管理卡牌數據源與價格更新</p>
      </div>

          {/* Add SNKRDUNK Source */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              手動添加 SNKRDUNK 數據源
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        {batchResults.progress}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          cancelledRef.current = true;
                          toast.info("正在取消任務...");
                        }}
                        className="text-xs h-7 bg-white dark:bg-gray-800"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        取消
                      </Button>
                    </div>
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
                      {batchResults.cancelled && (
                        <span className="text-orange-600 font-medium">⚠ 任務已取消</span>
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
            <h2 className="text-2xl font-semibold text-foreground mb-4">
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
              <Button
                onClick={() => startEbayBatchUpdateMutation.mutate()}
                disabled={startEbayBatchUpdateMutation.isPending || (ebayTaskProgress?.status === 'running' || ebayTaskProgress?.status === 'paused')}
                variant="outline"
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                {startEbayBatchUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    啟動中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    批量更新所有卡牌 eBay 價格
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
              {ebayTaskProgress && (ebayTaskProgress.status === 'running' || ebayTaskProgress.status === 'paused') && (
                <BatchTaskProgressBar
                  taskType="eBay"
                  progress={ebayTaskProgress}
                  onPause={() => pauseEbayTaskMutation.mutate({ taskId: ebayTaskProgress.taskId })}
                  onResume={() => resumeEbayTaskMutation.mutate({ taskId: ebayTaskProgress.taskId })}
                  onCancel={() => cancelEbayTaskMutation.mutate({ taskId: ebayTaskProgress.taskId })}
                  isPauseLoading={pauseEbayTaskMutation.isPending}
                  isResumeLoading={resumeEbayTaskMutation.isPending}
                />
              )}
            </div>
          </Card>

          {/* Data Sources List */}
          <Card className="p-6 bg-card border-border">
            <div className="mb-4">
              <Input
                type="text"
                placeholder="搜尋卡牌名稱或 URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-semibold text-foreground">
                  數據源列表
                </h2>
                {dataSourcesQuery.data?.data && dataSourcesQuery.data.data.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedIds.length === dataSourcesQuery.data.data.length}
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
                )}
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
            ) : dataSourcesQuery.data?.data && dataSourcesQuery.data.data.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const filteredData = dataSourcesQuery.data.data.filter((source: any) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      source.card?.name?.toLowerCase().includes(query) ||
                      source.sourceUrl?.toLowerCase().includes(query)
                    );
                  });
                  
                  if (filteredData.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        找不到符合「{searchQuery}」的數據源
                      </div>
                    );
                  }
                  
                  return filteredData.map((source: any) => (
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
                        <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {source.source.toUpperCase()}
                        </span>
                        {source.isActive === 1 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
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
                            最後更新: {new Date(source.lastFetchedAt).toLocaleString("zh-HK")}
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
                        {source.cardId && (
                          <UpdateEbayButton cardId={source.cardId} />
                        )}
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
            
            {/* Pagination */}
            {dataSourcesQuery.data && dataSourcesQuery.data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    每頁顯示
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-muted-foreground">
                    第 {dataSourcesQuery.data.page} / {dataSourcesQuery.data.totalPages} 頁，共 {dataSourcesQuery.data.total} 筆
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    首頁
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    上一頁
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(dataSourcesQuery.data!.totalPages, prev + 1))}
                    disabled={currentPage === dataSourcesQuery.data.totalPages}
                  >
                    下一頁
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(dataSourcesQuery.data!.totalPages)}
                    disabled={currentPage === dataSourcesQuery.data.totalPages}
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
