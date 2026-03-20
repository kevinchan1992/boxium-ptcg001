import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, CheckCircle, XCircle, MinusCircle, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent: { label: "已發送", color: "bg-green-100 text-green-800", icon: <CheckCircle className="w-3 h-3" /> },
  failed: { label: "發送失敗", color: "bg-red-100 text-red-800", icon: <XCircle className="w-3 h-3" /> },
  skipped: { label: "已跳過(退訂)", color: "bg-gray-100 text-gray-600", icon: <MinusCircle className="w-3 h-3" /> },
};

const EMAIL_TYPES = [
  { value: "all", label: "全部類型" },
  { value: "general", label: "一般" },
  { value: "offer", label: "出價通知" },
  { value: "order", label: "訂單" },
  { value: "welcome", label: "歡迎信" },
  { value: "review", label: "評價" },
  { value: "seller", label: "賣家" },
  { value: "system", label: "系統" },
  { value: "admin", label: "管理員" },
];

export default function AdminEmailLogs() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "sent" | "failed" | "skipped">("all");
  const [emailType, setEmailType] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const PAGE_SIZE = 50;

  const { data: stats, refetch: refetchStats } = trpc.email.getStats.useQuery();
  const { data, isLoading, refetch } = trpc.email.listLogs.useQuery({
    page,
    pageSize: PAGE_SIZE,
    status,
    emailType: emailType === "all" ? undefined : emailType,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
    refetchStats();
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
              <div className="text-xs text-blue-600">總計</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.sent}</div>
              <div className="text-xs text-green-600">已發送</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
              <div className="text-xs text-red-600">發送失敗</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.skipped}</div>
              <div className="text-xs text-gray-600">退訂跳過</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">{stats.last24h}</div>
              <div className="text-xs text-purple-600">過去 24 小時</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#1a0dab]" />
              電郵發送記錄
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filter Row */}
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="sent">已發送</SelectItem>
                <SelectItem value="failed">發送失敗</SelectItem>
                <SelectItem value="skipped">退訂跳過</SelectItem>
              </SelectContent>
            </Select>

            <Select value={emailType} onValueChange={(v) => { setEmailType(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="類型" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-36 h-8 text-sm"
              placeholder="開始日期"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-36 h-8 text-sm"
              placeholder="結束日期"
            />

            <div className="flex gap-1 flex-1 min-w-[200px]">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜尋收件人或主旨..."
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={handleSearch} className="h-8 px-3">
                <Search className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">時間</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">收件人</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">主旨</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">類型</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">載入中...</td>
                  </tr>
                ) : !data?.logs.length ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <div>沒有符合條件的電郵記錄</div>
                    </td>
                  </tr>
                ) : (
                  data.logs.map((log) => {
                    const statusInfo = STATUS_LABELS[log.status] ?? STATUS_LABELS.sent;
                    return (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.sentAt).toLocaleString("zh-HK", {
                            timeZone: "Asia/Hong_Kong",
                            year: "2-digit",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono">
                          <div className="max-w-[160px] truncate" title={log.toEmail}>
                            {log.toEmail}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="max-w-[240px] truncate" title={log.subject}>
                            {log.subject}
                          </div>
                          {log.errorMessage && (
                            <div className="text-red-500 text-xs mt-0.5 truncate max-w-[240px]" title={log.errorMessage}>
                              ⚠ {log.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                            {log.emailType}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>共 {data.total} 筆，第 {page}/{totalPages} 頁</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-2"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
