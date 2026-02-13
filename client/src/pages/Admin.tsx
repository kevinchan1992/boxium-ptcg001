import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { getLoginUrl } from "@/const";

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [snkrdunkUrl, setSnkrdunkUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResults, setBatchResults] = useState<{success: number; failed: number; errors: string[]; duplicates: number; progress?: string; failedUrls?: string[]}>({ success: 0, failed: 0, errors: [], duplicates: 0 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const utils = trpc.useUtils();
  const dataSourcesQuery = trpc.admin.getDataSources.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const schedulerStatusQuery = trpc.admin.getSchedulerStatus.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const triggerManualUpdateMutation = trpc.admin.triggerManualUpdateAll.useMutation({
    onSuccess: () => {
      toast.success("已觸發全量更新，正在背景處理...");
      schedulerStatusQuery.refetch();
      setTimeout(() => {
        utils.admin.getDataSources.invalidate();
      }, 5000);
    },
    onError: (error: any) => {
      toast.error(`觸發失敗: ${error.message}`);
    },
  });



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
      schedulerStatusQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  const firecrawlStatsQuery = trpc.admin.getFirecrawlUsageStats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60000, // Refresh every minute
  });

  const handleCleanDuplicates = () => {
    if (confirm('確定要清理重複的數據源嗎？系統將保留最早添加的版本，刪除其他重複項。')) {
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

    // Deduplicate URLs
    const existingUrls = dataSourcesQuery.data?.map((ds: any) => ds.sourceUrl) || [];
    const uniqueUrls = Array.from(new Set(urls)); // Remove duplicates within input
    const newUrls = uniqueUrls.filter(url => !existingUrls.includes(url)); // Remove existing URLs
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
      
      for (let i = 0; i < newUrls.length; i += BATCH_SIZE) {
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
        
        // Count successes and failures
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successCount++;
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
      
      setBatchResults({ success: successCount, failed: failedCount, errors, duplicates: duplicateCount, failedUrls });
      
      if (successCount > 0) {
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
    if (selectedIds.length === dataSourcesQuery.data?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(dataSourcesQuery.data?.map((ds: any) => ds.id) || []);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center px-8">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-foreground">管理員後台</h1>
            <p className="text-lg text-muted-foreground">
              請先登入以訪問管理員功能
            </p>
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              variant="default"
            >
              登入
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (user?.role !== "admin") {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center px-8">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-foreground">權限不足</h1>
            <p className="text-lg text-muted-foreground">
              您沒有訪問管理員後台的權限
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen py-8 px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">管理員後台</h1>
            <p className="text-muted-foreground">管理卡牙數據源與價格更新</p>
          </div>

          {/* Firecrawl Quota Monitor */}
          {firecrawlStatsQuery.data && (
            <Card className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">Firecrawl 配額監控</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => firecrawlStatsQuery.refetch()}
                  disabled={firecrawlStatsQuery.isRefetching}
                >
                  {firecrawlStatsQuery.isRefetching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      重新整理...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重新整理
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Calls */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">總調用次數</h3>
                  <p className="text-2xl font-bold text-foreground">
                    {firecrawlStatsQuery.data.totalCalls}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    成功: {firecrawlStatsQuery.data.successCalls}
                  </p>
                </div>

                {/* Credits Used */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">已使用配額</h3>
                  <p className="text-2xl font-bold text-foreground">
                    {firecrawlStatsQuery.data.totalCreditsUsed}
                  </p>
                  {firecrawlStatsQuery.data.quotaLimit && (
                    <p className="text-xs text-muted-foreground mt-1">
                      / {firecrawlStatsQuery.data.quotaLimit}
                    </p>
                  )}
                </div>

                {/* Failed Calls */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">失敗次數</h3>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {firecrawlStatsQuery.data.failedCalls}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    配額超限: {firecrawlStatsQuery.data.quotaExceededCalls}
                  </p>
                </div>

                {/* Usage Percentage */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">使用率</h3>
                  {firecrawlStatsQuery.data.quotaLimit ? (
                    <>
                      <p className="text-2xl font-bold text-foreground">
                        {firecrawlStatsQuery.data.quotaUsagePercent?.toFixed(1)}%
                      </p>
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            (firecrawlStatsQuery.data.quotaUsagePercent || 0) >= 90
                              ? 'bg-red-500'
                              : (firecrawlStatsQuery.data.quotaUsagePercent || 0) >= 80
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(firecrawlStatsQuery.data.quotaUsagePercent || 0, 100)}%` }}
                        />
                      </div>
                      {(firecrawlStatsQuery.data.quotaUsagePercent || 0) >= 80 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                          ⚠️ 配額即將用盡
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">未設定配額限制</p>
                  )}
                </div>
              </div>

              {/* Quota Exceeded Warning */}
              {(firecrawlStatsQuery.data.quotaExceededCalls || 0) > 0 && (
                <div className="mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-red-900 dark:text-red-100">配額已超限</h3>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        已有 {firecrawlStatsQuery.data.quotaExceededCalls} 次調用因配額不足而失敗。
                        請聯繫 Manus 支援團隊 (<a href="https://help.manus.im" target="_blank" rel="noopener noreferrer" className="underline">https://help.manus.im</a>) 升級配額。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Scheduler Status Panel */}
          {schedulerStatusQuery.data && (
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">排程器狀態</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerManualUpdateMutation.mutate()}
                  disabled={triggerManualUpdateMutation.isPending || schedulerStatusQuery.data.isRunning}
                >
                  {triggerManualUpdateMutation.isPending || schedulerStatusQuery.data.isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      立即更新所有數據源
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Next Update Time */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-medium text-foreground">下次自動更新</h3>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {schedulerStatusQuery.data.nextUpdateAt
                      ? new Date(schedulerStatusQuery.data.nextUpdateAt).toLocaleString('zh-TW', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '無排程'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    總計 {schedulerStatusQuery.data.totalActiveSources} 個活躍數據源
                  </p>
                </div>

                {/* Last 24 Hours Stats */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-medium text-foreground">最近 24 小時</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {schedulerStatusQuery.data.last24Hours.successCount}
                    </span>
                    <span className="text-sm text-muted-foreground">成功</span>
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400 ml-3">
                      {schedulerStatusQuery.data.last24Hours.failedCount}
                    </span>
                    <span className="text-sm text-muted-foreground">失敗</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    共 {schedulerStatusQuery.data.last24Hours.totalUpdates} 次更新
                  </p>
                </div>

                {/* Current Progress or Failed Queue */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  {schedulerStatusQuery.data.currentProgress ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                        <h3 className="font-medium text-foreground">正在更新</h3>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {schedulerStatusQuery.data.currentProgress.processedUrls} / {schedulerStatusQuery.data.currentProgress.totalUrls}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        成功: {schedulerStatusQuery.data.currentProgress.successCount} | 失敗: {schedulerStatusQuery.data.currentProgress.failedCount}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h3 className="font-medium text-foreground">失敗佇列</h3>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {schedulerStatusQuery.data.failedSources.length}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {schedulerStatusQuery.data.failedSources.length > 0
                          ? `最近失敗的數據源`
                          : `無失敗記錄`}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Failed Sources Details */}
              {schedulerStatusQuery.data.failedSources.length > 0 && (
                <div className="mt-4 bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-foreground">失敗詳情 (顯示最近 10 筆)</h3>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`確定要刪除所有 ${schedulerStatusQuery.data?.failedSources.length || 0} 個失敗的數據源嗎？此操作無法復原。`)) {
                          deleteFailedMutation.mutate();
                        }
                      }}
                      disabled={deleteFailedMutation.isPending}
                    >
                      {deleteFailedMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          刪除中...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          清理所有失敗記錄
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {schedulerStatusQuery.data.failedSources.map((failed: any) => (
                      <div key={failed.id} className="text-sm bg-red-50 dark:bg-red-950/30 p-2 rounded">
                        <p className="font-mono text-xs text-muted-foreground truncate">
                          {failed.sourceUrl}
                        </p>
                        <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                          {failed.errorMessage || '未知錯誤'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}



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
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
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
            </form>
          </Card>

          {/* Data Sources List */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-semibold text-foreground">
                  數據源列表
                </h2>
                {dataSourcesQuery.data && dataSourcesQuery.data.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedIds.length === dataSourcesQuery.data.length}
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
                  title="清理重複的數據源（保留最早添加的）"
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
            ) : dataSourcesQuery.data && dataSourcesQuery.data.length > 0 ? (
              <div className="space-y-4">
                {dataSourcesQuery.data.map((source: any) => (
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefresh(source.id)}
                        disabled={refreshDataSourceMutation.isPending}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                尚未添加任何數據源
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
