import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FailedCard {
  cardId: number;
  name: string;
  error: string;
  retryCount: number;
}

export function TaskHistory() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const { data: tasks, refetch } = trpc.admin.listBackgroundTasks.useQuery(
    { limit: 50 },
    { refetchInterval: 5000 }
  );

  const filteredTasks = tasks?.filter((task) => {
    if (statusFilter === "all") return true;
    return task.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
      completed: { variant: "default", label: "已完成" },
      failed: { variant: "destructive", label: "失敗" },
      cancelled: { variant: "outline", label: "已取消" },
      running: { variant: "secondary", label: "運行中" },
      pending: { variant: "outline", label: "等待中" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {status === "running" && <RefreshCw className="h-3 w-3 animate-spin" />}
        {config.label}
      </Badge>
    );
  };

  const formatDuration = (startedAt: Date | string | null, completedAt: Date | string | null) => {
    if (!startedAt || !completedAt) return "-";
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}分 ${seconds}秒`;
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSuccessRate = (successCount: number, totalItems: number) => {
    if (totalItems === 0) return "0.0%";
    return ((successCount / totalItems) * 100).toFixed(1) + "%";
  };

  const toggleExpand = (taskId: number) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const getFailedCards = (failedCardsJson: string | null): FailedCard[] => {
    if (!failedCardsJson) return [];
    try {
      return JSON.parse(failedCardsJson);
    } catch {
      return [];
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>任務歷史記錄</CardTitle>
            <CardDescription>查看過去的緩存更新任務執行記錄</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="failed">失敗</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
                <SelectItem value="running">運行中</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>任務 ID</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>開始時間</TableHead>
              <TableHead>完成時間</TableHead>
              <TableHead>處理時間</TableHead>
              <TableHead>總卡牌數</TableHead>
              <TableHead>成功</TableHead>
              <TableHead>失敗</TableHead>
              <TableHead>成功率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks?.map((task) => {
              const failedCards = getFailedCards(task.failedCards);
              const hasFailedCards = failedCards.length > 0;
              const isExpanded = expandedTaskId === task.id;

              return (
                <>
                  <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => hasFailedCards && toggleExpand(task.id)}>
                      {hasFailedCards && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">#{task.id}</TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>{formatDateTime(task.startedAt)}</TableCell>
                    <TableCell>{formatDateTime(task.completedAt)}</TableCell>
                    <TableCell>{formatDuration(task.startedAt, task.completedAt)}</TableCell>
                    <TableCell>{task.totalItems}</TableCell>
                    <TableCell className="text-green-600 font-medium">{task.successCount}</TableCell>
                    <TableCell className="text-red-600 font-medium">{task.failureCount}</TableCell>
                    <TableCell>{getSuccessRate(task.successCount, task.totalItems)}</TableCell>
                  </TableRow>
                  {isExpanded && hasFailedCards && (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-muted/30">
                        <div className="p-4">
                          <h4 className="font-semibold mb-2 text-sm">
                            失敗卡牌列表 ({failedCards.length} 張)
                          </h4>
                          <div className="max-h-[300px] overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>卡牌 ID</TableHead>
                                  <TableHead>卡牌名稱</TableHead>
                                  <TableHead>錯誤信息</TableHead>
                                  <TableHead>重試次數</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {failedCards.map((card, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-mono text-sm">{card.cardId}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{card.name}</TableCell>
                                    <TableCell className="max-w-[300px] truncate text-red-600 text-sm">
                                      {card.error}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{card.retryCount} 次</Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
            {(!filteredTasks || filteredTasks.length === 0) && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  暫無任務記錄
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
