import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { TrendingUp, Clock, CheckCircle2 } from "lucide-react";

export function TaskPerformanceChart() {
  const { data: tasks } = trpc.admin.listBackgroundTasks.useQuery(
    { limit: 10 },
    { refetchInterval: 10000 }
  );

  // Process data for charts
  const chartData = tasks
    ?.filter((task) => task.status === "completed" || task.status === "failed")
    .map((task) => {
      const duration = task.startedAt && task.completedAt
        ? (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000 / 60
        : 0;
      const successRate = task.totalItems > 0
        ? (task.successCount / task.totalItems) * 100
        : 0;
      
      return {
        id: `#${task.id}`,
        duration: Math.round(duration),
        successRate: Math.round(successRate * 10) / 10,
        successCount: task.successCount,
        failureCount: task.failureCount,
        totalItems: task.totalItems,
      };
    })
    .reverse() || [];

  // Calculate statistics
  const stats = {
    avgDuration: chartData.length > 0
      ? Math.round(chartData.reduce((sum, d) => sum + d.duration, 0) / chartData.length)
      : 0,
    avgSuccessRate: chartData.length > 0
      ? Math.round((chartData.reduce((sum, d) => sum + d.successRate, 0) / chartData.length) * 10) / 10
      : 0,
    totalCompleted: tasks?.filter((t) => t.status === "completed").length || 0,
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均處理時間</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDuration} 分鐘</div>
            <p className="text-xs text-muted-foreground">最近 {chartData.length} 次任務</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均成功率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSuccessRate}%</div>
            <p className="text-xs text-muted-foreground">最近 {chartData.length} 次任務</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成任務</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompleted}</div>
            <p className="text-xs text-muted-foreground">總計</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Processing Time Trend */}
        <Card>
          <CardHeader>
            <CardTitle>處理時間趨勢</CardTitle>
            <CardDescription>最近任務的處理時間變化</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="id" />
                  <YAxis label={{ value: "分鐘", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="duration"
                    stroke="#8884d8"
                    name="處理時間"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                暫無數據
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>成功率趨勢</CardTitle>
            <CardDescription>最近任務的成功率變化</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="id" />
                  <YAxis label={{ value: "%", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successRate" fill="#10b981" name="成功率" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                暫無數據
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
