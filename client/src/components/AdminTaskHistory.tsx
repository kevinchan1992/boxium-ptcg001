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
import { RefreshCw, Trash2, ChevronLeft, ChevronRight, BarChart3, Clock, CheckCircle2, XCircle, Loader2, Pause } from "lucide-react";
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

function getStatusBadge(status: string) {
  switch (status) {
    case "running":
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" />運行中</Badge>;
    case "completed":
      return <Badge className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />已完成</Badge>;
    case "failed":
      return <Badge className="bg-red-600 hover:bg-red-700 text-white"><XCircle className="w-3 h-3 mr-1" />失敗</Badge>;
    case "paused":
      return <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white"><Pause className="w-3 h-3 mr-1" />已暫停</Badge>;
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

  const deleteTaskMutation = trpc.admin.deleteTask.useMutation({
    onSuccess: () => {
      toast.success("任務記錄已刪除");
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const totalPages = historyData ? Math.ceil(historyData.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">總任務數</span>
              </div>
              <p className="text-2xl font-bold text-white">{statsData.totalTasks}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Loader2 className="w-4 h-4" />
                <span className="text-sm">運行中</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{statsData.runningTasks}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">已完成</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{statsData.completedTasks}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
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
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              過去 7 天統計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-400">總執行次數</p>
                <p className="text-xl font-bold text-white">{statsData.last7DaysStats.totalRuns}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">成功次數</p>
                <p className="text-xl font-bold text-green-400">{statsData.last7DaysStats.successfulRuns}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">失敗次數</p>
                <p className="text-xl font-bold text-red-400">{statsData.last7DaysStats.failedRuns}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">平均執行時間</p>
                <p className="text-xl font-bold text-white">{formatDuration(statsData.last7DaysStats.avgDurationMs)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">總處理項目</p>
                <p className="text-xl font-bold text-white">{statsData.last7DaysStats.totalItemsProcessed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task History Table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-white text-lg">任務歷史記錄</CardTitle>
              <CardDescription className="text-gray-400">
                顯示所有 SNKRDUNK 批量更新任務的執行歷史
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="w-[130px] bg-gray-800 border-gray-700 text-white">
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
              <Button variant="outline" size="sm" onClick={() => refetch()} className="border-gray-700 text-gray-300 hover:text-white">
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-red-800 text-red-400 hover:text-red-300 hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4 mr-1" />
                    清理舊記錄
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-900 border-gray-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">確認清理舊記錄？</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      將保留最近 50 條記錄，刪除其餘已完成或失敗的任務記錄。運行中和暫停的任務不會被刪除。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-gray-800 border-gray-700 text-gray-300">取消</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => cleanOldTasksMutation.mutate({ keepCount: 50 })}
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
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : !historyData?.tasks.length ? (
            <div className="text-center py-12 text-gray-400">
              暫無任務記錄
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400">ID</TableHead>
                      <TableHead className="text-gray-400">狀態</TableHead>
                      <TableHead className="text-gray-400">進度</TableHead>
                      <TableHead className="text-gray-400">成功</TableHead>
                      <TableHead className="text-gray-400">失敗</TableHead>
                      <TableHead className="text-gray-400">開始時間</TableHead>
                      <TableHead className="text-gray-400">耗時</TableHead>
                      <TableHead className="text-gray-400">錯誤信息</TableHead>
                      <TableHead className="text-gray-400">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.tasks.map((task) => (
                      <TableRow key={task.id} className="border-gray-800 hover:bg-gray-800/50">
                        <TableCell className="text-gray-300 font-mono text-sm">{task.id}</TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell className="text-gray-300">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">{task.processedItems.toLocaleString()} / {task.totalItems.toLocaleString()}</span>
                            <div className="w-24 bg-gray-700 rounded-full h-1.5">
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
                        <TableCell className="text-red-400 font-mono">{task.failureCount.toLocaleString()}</TableCell>
                        <TableCell className="text-gray-300 text-sm whitespace-nowrap">{formatDateTime(task.startedAt)}</TableCell>
                        <TableCell className="text-gray-300 text-sm whitespace-nowrap">{formatDuration(task.durationMs)}</TableCell>
                        <TableCell className="text-gray-400 text-sm max-w-[200px] truncate" title={task.errorMessage || ""}>
                          {task.errorMessage || "-"}
                        </TableCell>
                        <TableCell>
                          {(task.status === "completed" || task.status === "failed") && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-gray-900 border-gray-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white">確認刪除任務 #{task.id}？</AlertDialogTitle>
                                  <AlertDialogDescription className="text-gray-400">
                                    此操作不可撤銷，將永久刪除此任務記錄。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-gray-800 border-gray-700 text-gray-300">取消</AlertDialogCancel>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-400">
                    共 {historyData.total} 條記錄，第 {page} / {totalPages} 頁
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="border-gray-700 text-gray-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="border-gray-700 text-gray-300"
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
