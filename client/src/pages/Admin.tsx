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
  const [batchResults, setBatchResults] = useState<{success: number; failed: number; errors: string[]; duplicates: number; progress?: string}>({ success: 0, failed: 0, errors: [], duplicates: 0 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isAutoCrawling, setIsAutoCrawling] = useState(false);
  const [autoCrawlResults, setAutoCrawlResults] = useState<{totalFound: number; newUrls: number; duplicates: number; successCount: number; failedCount: number; duration?: string; failedUrls?: Array<{url: string; error: string}>} | null>(null);
  const [crawlProgress, setCrawlProgress] = useState<{isRunning: boolean; currentPage: number; totalPages: number; processedUrls: number; totalUrls: number; successCount: number; failedCount: number; startTime: number} | null>(null);

  const utils = trpc.useUtils();
  const dataSourcesQuery = trpc.admin.getDataSources.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const crawlProgressQuery = trpc.admin.getCrawlProgress.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin" && isAutoCrawling,
    refetchInterval: isAutoCrawling ? 2000 : false, // Poll every 2 seconds when crawling
  });

  // Update local progress state when query data changes
  useEffect(() => {
    if (crawlProgressQuery.data) {
      setCrawlProgress(crawlProgressQuery.data);
      
      // Stop polling when crawl is complete
      if (!crawlProgressQuery.data.isRunning && isAutoCrawling) {
        setIsAutoCrawling(false);
      }
    }
  }, [crawlProgressQuery.data, isAutoCrawling]);

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
    
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      // Process URLs sequentially to avoid overwhelming the server
      for (let i = 0; i < newUrls.length; i++) {
        const url = newUrls[i];
        setBatchResults(prev => ({ ...prev, progress: `處理中 ${i + 1}/${newUrls.length}` }));
        
        try {
          await addDataSourceMutation.mutateAsync({ url });
          successCount++;
        } catch (error: any) {
          failedCount++;
          errors.push(`${url}: ${error.message}`);
        }
      }

      setBatchResults({ success: successCount, failed: failedCount, errors, duplicates: duplicateCount });
      
      if (successCount > 0) {
        toast.success(`成功添加 ${successCount} 個數據源${failedCount > 0 ? `，失敗 ${failedCount} 個` : ''}`);
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

  const autoCrawlMutation = trpc.admin.autoCrawlSnkrdunk.useMutation({
    onSuccess: (data) => {
      setAutoCrawlResults(data);
      toast.success(`自動抓取完成！成功添加 ${data.successCount} 個卡牌`);
      utils.admin.getDataSources.invalidate();
    },
    onError: (error: any) => {
      toast.error(`自動抓取失敗: ${error.message}`);
    },
  });

  const handleAutoCrawl = async (testMode: boolean = false) => {
    const endPage = testMode ? 10 : 1575;
    const confirmMessage = testMode
      ? '確定要開始測試模式抓取嗎？\n\n這將抓取前 10 頁的卡牌數據，約需 5-10 分鐘。'
      : '確定要開始自動抓取所有 SNKRDUNK 卡牌嗎？\n\n這將抓取約 1575 頁的卡牌數據，可能需要較長時間（約 13-15 小時）。\n\n建議在非高峰時段執行此操作。';

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsAutoCrawling(true);
    setAutoCrawlResults(null);
    
    try {
      await autoCrawlMutation.mutateAsync({ startPage: 1, endPage });
    } finally {
      setIsAutoCrawling(false);
    }
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
            <p className="text-muted-foreground">管理卡牌數據源與價格更新</p>
          </div>

          {/* Auto Crawl SNKRDUNK */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              自動抓取 SNKRDUNK
            </h2>
            <p className="text-muted-foreground mb-4">
              自動抓取所有 SNKRDUNK 寶可夢卡牌數據（約 1575 頁）。系統將自動去重，只添加新卡牌。
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={() => handleAutoCrawl(true)}
                disabled={isAutoCrawling}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isAutoCrawling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    抓取中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    測試模式（前 10 頁）
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleAutoCrawl(false)}
                disabled={isAutoCrawling}
                variant="default"
                className="w-full sm:w-auto"
              >
                {isAutoCrawling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    抓取中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    完整抓取（1575 頁）
                  </>
                )}
              </Button>
            </div>
            {crawlProgress && crawlProgress.isRunning && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                    抓取中...
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700 dark:text-blue-300">已處理 URL</span>
                    <span className="font-bold text-blue-700 dark:text-blue-300">
                      {crawlProgress.processedUrls} / {crawlProgress.totalUrls}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${crawlProgress.totalUrls > 0 ? (crawlProgress.processedUrls / crawlProgress.totalUrls) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                    <div>
                      <p className="text-blue-600 dark:text-blue-400">成功</p>
                      <p className="text-xl font-bold text-green-600">{crawlProgress.successCount}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 dark:text-blue-400">失敗</p>
                      <p className="text-xl font-bold text-red-600">{crawlProgress.failedCount}</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    預估剩餘時間：{Math.ceil((crawlProgress.totalUrls - crawlProgress.processedUrls) * 0.5 / 60)} 分鐘
                  </p>
                </div>
              </div>
            )}
            {autoCrawlResults && !crawlProgress?.isRunning && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">總共找到</p>
                    <p className="text-2xl font-bold text-foreground">{autoCrawlResults.totalFound}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">新增卡牌</p>
                    <p className="text-2xl font-bold text-green-600">{autoCrawlResults.successCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">已過濾重複</p>
                    <p className="text-2xl font-bold text-yellow-600">{autoCrawlResults.duplicates}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">失敗</p>
                    <p className="text-2xl font-bold text-red-600">{autoCrawlResults.failedCount}</p>
                  </div>
                  {autoCrawlResults.duration && (
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-muted-foreground">耗時</p>
                      <p className="text-lg font-bold text-foreground">{autoCrawlResults.duration}</p>
                    </div>
                  )}
                </div>
                {autoCrawlResults.failedUrls && autoCrawlResults.failedUrls.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm font-semibold text-red-600 mb-2">
                      失敗 URL 列表（{autoCrawlResults.failedUrls.length} 個）
                    </p>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {autoCrawlResults.failedUrls.map((failed, idx) => (
                        <div key={idx} className="p-2 bg-red-50 dark:bg-red-950 rounded text-xs">
                          <p className="font-mono text-red-700 dark:text-red-300 break-all">
                            {failed.url}
                          </p>
                          <p className="text-red-600 dark:text-red-400 mt-1">
                            錯誤：{failed.error}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

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
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">失敗詳情:</p>
                        {batchResults.errors.map((error, idx) => (
                          <p key={idx} className="text-xs text-red-600 font-mono">{error}</p>
                        ))}
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
