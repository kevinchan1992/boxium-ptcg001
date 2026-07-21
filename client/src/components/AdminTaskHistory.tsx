import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatHKLocale } from "@/lib/formatDate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Trash2, ChevronLeft, ChevronRight, BarChart3, Clock, CheckCircle2, XCircle, Loader2, Pause, RotateCcw, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}分${remainingSeconds}秒`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}時${remainingMinutes}分`;
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  return formatHKLocale(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatSpeed(processedItems: number, activeProcessingMs: number | null): string {
  if (!activeProcessingMs || activeProcessingMs < 1000) return "-";
  const speed = processedItems / (activeProcessingMs / 1000);
  if (speed >= 1) return `${speed.toFixed(1)}/s`;
  return `${(speed * 60).toFixed(1)}/min`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "running":
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-slate-900"><Loader2 className="w-3 h-3 mr-1 animate-spin" />運行中</Badge>;
    case "completed":
      return <Badge className="bg-green-600 hover:bg-green-700 text-slate-900"><CheckCircle2 className="w-3 h-3 mr-1" />已完成</Badge>;
    case "failed":
      return <Badge className="bg-red-600 hover:bg-red-700 text-slate-900"><XCircle className="w-3 h-3 mr-1" />失敗</Badge>;
    case "paused":
      return <Badge className="bg-yellow-600 hover:bg-yellow-700 text-slate-900"><Pause className="w-3 h-3 mr-1" />已暫停</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getTaskTypeName(taskType: string): string {
  switch (taskType) {
    case "batch_snkrdunk_update":
      return "SNKRDUNK 批量更新";
    case "batch_ebay_update":
      return "eBay 批量更新（已停用）";
    case "batch_add_data_sources":
      return "批量添加數據源";
    default:
      return taskType;
  }
}

type TaskError = { cardName: string; error: string; timestamp?: string };

function FailureDetailsDialog({
  taskId,
  failureCount,
  recentErrors,
}: {
  taskId: number;
  failureCount: number;
  recentErrors: TaskError[];
}) {
  const [open, setOpen] = useState(false);

  if (failureCount === 0) {
    return <span className="text-green-400 font-mono">0</span>;
  }

  // Group errors by type
  const errorGroups: Record<string, { count: number; examples: string[] }> = {};
  for (const e of recentErrors) {
    // Normalize error message to group similar errors
    const key = e.error
      .replace(/\d+/g, "N")
      .replace(/https?:\/\/[^\s]+/g, "[URL]")
      .substring(0, 80);
    if (!errorGroups[key]) {
      errorGroups[key] = { count: 0, examples: [] };
    }
    errorGroups[key].count++;
    if (errorGroups[key].examples.length < 3) {
      errorGroups[key].examples.push(e.cardName);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-red-400 font-mono hover:text-red-300 hover:underline cursor-pointer transition-colors"
        title="點擊查看失敗詳情"
      >
        {failureCount.toLocaleString()}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-slate-200 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              任務 #{taskId} 失敗詳情（共 {failureCount.toLocaleString()} 個）
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {recentErrors.length === 0 ? (
              <p className="text-slate-500 text-sm">暫無詳細錯誤記錄（舊版任務未記錄錯誤詳情）</p>
            ) : (
              <>
                {/* Error type summary */}
                <div>
                  <h4 className="text-slate-400 text-sm font-medium mb-2">錯誤類型分佈（最近 {recentErrors.length} 個）</h4>
                  <div className="space-y-2">
                    {Object.entries(errorGroups)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([key, group]) => (
                        <div key={key} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-red-300 text-xs font-mono flex-1 break-all">{key}</p>
                            <Badge className="bg-red-50 text-red-400 border-red-800 shrink-0">
                              {group.count}次
                            </Badge>
                          </div>
                          {group.examples.length > 0 && (
                            <p className="text-slate-400 text-xs mt-1">
                              例：{group.examples.join("、")}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Individual errors */}
                <div>
                  <h4 className="text-slate-400 text-sm font-medium mb-2">最近失敗記錄</h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {recentErrors.slice().reverse().map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-slate-200">
                        <span className="text-slate-400 shrink-0 w-4">{i + 1}.</span>
                        <span className="text-slate-400 shrink-0 max-w-[160px] truncate" title={e.cardName}>{e.cardName}</span>
                        <span className="text-red-400 flex-1 break-all">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="bg-blue-50 border border-blue-800 rounded-lg p-3">
              <p className="text-blue-300 text-xs">
                <strong>常見失敗原因：</strong>
                <br />• <strong>HTTP 429</strong>：SNKRDUNK API 限流，系統會自動重試
                <br />• <strong>HTTP 404</strong>：卡牌在 SNKRDUNK 已下架或不存在
                <br />• <strong>Timeout</strong>：網絡超時，下次批量更新會自動重試
                <br />• <strong>No data</strong>：該卡牌在 SNKRDUNK 無交易記錄
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AdminTaskHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const pageSize = 10;

  const { data: historyData, isLoading, refetch } = trpc.admin.getTaskHistory.useQuery({
    page,
    pageSize,
    status: statusFilter === "all" ? undefined : statusFilter,
    taskType: "batch_snkrdunk_update",
  }, { refetchInterval: 10000 });

  const { data: statsData } = trpc.admin.getTaskStats.useQuery(undefined, { refetchInterval: 30000 });

  const cleanOldTasksMutation = trpc.admin.cleanOldTasks.useMutation({
    onSuccess: (data) => {
      toast.success(`清理完成，已刪除 ${data.deletedCount} 條舊記錄`);
      refetch();
    },
    onError: (error) => {
      toast.error(`清理失敗：${error.message}`);
    },
  });

  const cleanOldRecordsMutation = trpc.admin.cleanOldRecords.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(
          `清理完成！已刪除 ${data.deletedTasks} 條任務記錄、${data.deletedHistory} 條排程歷史（30 天前）`,
          { duration: 6000 }
        );
      } else {
        toast.error('清理失敗，請稍後再試');
      }
      refetch();
    },
    onError: (error) => {
      toast.error(`清理失敗：${error.message}`);
    },
  });

  const deleteTaskMutation = trpc.admin.deleteTask.useMutation({
    onSuccess: () => {
      toast.success("任務記錄已刪除");
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const resumeTaskMutation = trpc.admin.resumeFailedBatchTask.useMutation({
    onSuccess: (data) => {
      toast.success(data.message, { duration: 5000 });
      refetch();
    },
    onError: (error) => {
      toast.error(`恢復失敗：${error.message}`);
    },
  });

  const totalPages = historyData ? Math.ceil(historyData.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">總任務數</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{statsData.totalTasks}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Loader2 className="w-4 h-4" />
                <span className="text-sm">運行中</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{statsData.runningTasks}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">已完成</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{statsData.completedTasks}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">失敗</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{statsData.failedTasks}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Last 7 Days Summary */}
      {statsData?.last7DaysStats && (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              過去 7 天統計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-slate-500">總執行次數</p>
                <p className="text-xl font-bold text-slate-900">{statsData.last7DaysStats.totalRuns}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">成功次數</p>
                <p className="text-xl font-bold text-green-400">{statsData.last7DaysStats.successfulRuns}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">失敗次數</p>
                <p className="text-xl font-bold text-red-400">{statsData.last7DaysStats.failedRuns}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">平均執行時間</p>
                <p className="text-xl font-bold text-slate-900">{formatDuration(statsData.last7DaysStats.avgDurationMs)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">總處理項目</p>
                <p className="text-xl font-bold text-slate-900">{statsData.last7DaysStats.totalItemsProcessed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task History Table */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-slate-900 text-lg">任務歷史記錄</CardTitle>
              <CardDescription className="text-slate-500">
                顯示所有 SNKRDUNK 批量更新任務的執行歷史
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="w-[130px] bg-slate-50 border-slate-200 text-slate-900">
                  <SelectValue placeholder="篩選狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部狀態</SelectItem>
                  <SelectItem value="running">運行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失敗</SelectItem>
                  <SelectItem value="paused">已暫停</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-200 text-slate-400 hover:text-slate-900">
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-800 text-red-400 hover:text-red-300 hover:bg-red-50"
                    disabled={cleanOldRecordsMutation.isPending}
                  >
                    {cleanOldRecordsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    清理舊記錄
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white border-slate-200 shadow-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-slate-900">確認清理 30 天前的記錄？</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-500">
                      將刪除 <span className="text-orange-400 font-medium">30 天前</span>的所有已完成或失敗的任務記錄，以及排程執行歷史。運行中和暫停的任務不會被刪除。此操作不可逆。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-50 border-slate-200 text-slate-400">取消</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => cleanOldRecordsMutation.mutate({ daysToKeep: 30 })}
                    >
                      確認清理
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
          ) : !historyData?.tasks.length ? (
            <div className="text-center py-12 text-slate-500">
              暫無任務記錄
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="text-slate-500">ID</TableHead>
                      <TableHead className="text-slate-500">狀態</TableHead>
                      <TableHead className="text-slate-500">進度</TableHead>
                      <TableHead className="text-slate-500">成功</TableHead>
                      <TableHead className="text-slate-500">
                        <span title="點擊失敗數字可查看詳情">失敗 ⓘ</span>
                      </TableHead>
                      <TableHead className="text-slate-500">開始時間</TableHead>
                      <TableHead className="text-slate-500">
                        <span title="掛牆時間（含 sandbox 休眠）">耗時</span>
                      </TableHead>
                      <TableHead className="text-slate-500">
                        <span title="實際處理速度（排除 sandbox 休眠時間）" className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-yellow-400" />速度
                        </span>
                      </TableHead>
                      <TableHead className="text-slate-500">錯誤信息</TableHead>
                      <TableHead className="text-slate-500">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.tasks.map((task) => (
                      <TableRow key={task.id} className="border-slate-200 hover:bg-slate-50/50">
                        <TableCell className="text-slate-400 font-mono text-sm">{task.id}</TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell className="text-slate-400">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">{task.processedItems.toLocaleString()} / {task.totalItems.toLocaleString()}</span>
                            <div className="w-24 bg-slate-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  task.status === "running" ? "bg-blue-500" :
                                  task.status === "completed" ? "bg-green-500" :
                                  task.status === "failed" ? "bg-red-500" : "bg-yellow-500"
                                }`}
                                style={{ width: `${Math.min(task.progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-green-400 font-mono">{task.successCount.toLocaleString()}</TableCell>
                        <TableCell>
                          <FailureDetailsDialog
                            taskId={task.id}
                            failureCount={task.failureCount}
                            recentErrors={(task as any).recentErrors || []}
                          />
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm whitespace-nowrap">{formatDateTime(task.startedAt)}</TableCell>
                        <TableCell className="text-slate-400 text-sm whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span>{formatDuration(task.durationMs)}</span>
                            {(task as any).activeProcessingMs && (task as any).activeProcessingMs > 0 && (
                              <span className="text-xs text-yellow-500/70" title="實際處理時間（排除休眠）">
                                實際 {formatDuration((task as any).activeProcessingMs)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-yellow-400 text-sm font-mono">
                          {formatSpeed(task.processedItems, (task as any).activeProcessingMs)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm max-w-[180px] truncate" title={task.errorMessage || ""}>
                          {task.errorMessage || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                          {task.status === "failed" && task.processedItems > 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-50 h-8 w-8 p-0" title="從上次進度恢復">
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white border-slate-200 shadow-sm">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-slate-900">從上次進度恢復任務 #{task.id}？</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-500">
                                    將跳過已處理的 {task.processedItems.toLocaleString()} 個產品，從上次停止的位置繼續執行批量更新。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-slate-50 border-slate-200 text-slate-400">取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => resumeTaskMutation.mutate({ taskId: task.id })}
                                  >
                                    確認恢復
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {(task.status === "completed" || task.status === "failed") && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-50 h-8 w-8 p-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white border-slate-200 shadow-sm">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-slate-900">確認刪除任務 #{task.id}？</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-500">
                                    此操作不可撤銷，將永久刪除此任務記錄。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-slate-50 border-slate-200 text-slate-400">取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteTaskMutation.mutate({ taskId: task.id })}
                                  >
                                    確認刪除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    共 {historyData.total} 條記錄，第 {page} / {totalPages} 頁
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="border-slate-200 text-slate-400"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="border-slate-200 text-slate-400"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
