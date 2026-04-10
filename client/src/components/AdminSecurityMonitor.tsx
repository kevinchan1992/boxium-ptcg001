/**
 * AdminSecurityMonitor
 *
 * Admin panel for monitoring security events, blocked IPs, and bot detection.
 * Provides real-time view of rate limit hits, bot detections, and manual IP management.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Ban, Unlock, RefreshCw, AlertTriangle, Activity, Globe, Bot } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Event type badge colours ──────────────────────────────────────── */
const EVENT_BADGE: Record<string, { label: string; className: string }> = {
  rate_limit:    { label: "限流",     className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  bot_detected:  { label: "Bot 偵測", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  manual_block:  { label: "手動封鎖", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  upload_reject: { label: "上傳拒絕", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  cors_reject:   { label: "CORS 拒絕",className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

function EventBadge({ type }: { type: string }) {
  const cfg = EVENT_BADGE[type] ?? { label: type, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleString("zh-HK", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

/* ─── Stats Cards ────────────────────────────────────────────────────── */
function StatsCards({ stats }: { stats: any }) {
  if (!stats) return null;
  const cards = [
    { label: "過去 1 小時事件", value: stats.last1h ?? 0, icon: <Activity className="w-4 h-4" />, color: "text-blue-400" },
    { label: "過去 24 小時事件", value: stats.last24h ?? 0, icon: <Shield className="w-4 h-4" />, color: "text-yellow-400" },
    { label: "已封鎖 IP 數", value: stats.blockedIpCount ?? 0, icon: <Ban className="w-4 h-4" />, color: "text-red-400" },
    { label: "Bot 偵測次數", value: stats.botDetections ?? 0, icon: <Bot className="w-4 h-4" />, color: "text-purple-400" },
    { label: "限流觸發次數", value: stats.rateLimitHits ?? 0, icon: <AlertTriangle className="w-4 h-4" />, color: "text-orange-400" },
    { label: "手動封鎖次數", value: stats.manualBlocks ?? 0, icon: <Globe className="w-4 h-4" />, color: "text-pink-400" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((c) => (
        <Card key={c.label} className="bg-white/[0.03] border-white/[0.08]">
          <CardContent className="p-4">
            <div className={cn("mb-2", c.color)}>{c.icon}</div>
            <div className="text-2xl font-bold text-white">{c.value.toLocaleString()}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Block IP Dialog ────────────────────────────────────────────────── */
function BlockIpDialog({
  open,
  onClose,
  onBlock,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onBlock: (ip: string, reason: string) => void;
  loading: boolean;
}) {
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!ip.trim() || !reason.trim()) return;
    onBlock(ip.trim(), reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            手動封鎖 IP
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="block-ip">IP 地址</Label>
            <Input
              id="block-ip"
              placeholder="例如：1.2.3.4"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="block-reason">封鎖原因</Label>
            <Input
              id="block-reason"
              placeholder="例如：惡意爬蟲、暴力登入..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>取消</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !ip.trim() || !reason.trim()}
          >
            {loading ? "封鎖中..." : "確認封鎖"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function AdminSecurityMonitor() {
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [logLimit, setLogLimit] = useState(100);

  const utils = trpc.useUtils();

  const statsQuery = trpc.security.getStats.useQuery(undefined, { refetchInterval: 30_000 });
  const logQuery = trpc.security.getLog.useQuery({ limit: logLimit }, { refetchInterval: 30_000 });
  const blockedQuery = trpc.security.getBlockedIps.useQuery(undefined, { refetchInterval: 30_000 });
  const userAgentsQuery = trpc.security.getTopUserAgents.useQuery({ limit: 10 }, { refetchInterval: 60_000 });

  const blockMutation = trpc.security.blockIp.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "封鎖成功");
      setBlockDialogOpen(false);
      utils.security.getBlockedIps.invalidate();
      utils.security.getStats.invalidate();
    },
    onError: (err) => toast.error(`封鎖失敗：${err.message}`),

  });

  const unblockMutation = trpc.security.unblockIp.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "解封成功");
      utils.security.getBlockedIps.invalidate();
      utils.security.getStats.invalidate();
    },
    onError: (err) => toast.error(`解封失敗：${err.message}`),
  });

  const handleRefresh = () => {
    utils.security.getStats.invalidate();
    utils.security.getLog.invalidate();
    utils.security.getBlockedIps.invalidate();
    utils.security.getTopUserAgents.invalidate();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">安全監控</h1>
            <p className="text-sm text-gray-400">Rate Limiting · Bot Detection · IP 封鎖管理</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBlockDialogOpen(true)}
            className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <Ban className="w-3.5 h-3.5" />
            手動封鎖 IP
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新整理
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards stats={statsQuery.data} />

      {/* Tabs */}
      <Tabs defaultValue="log">
        <TabsList className="mb-4">
          <TabsTrigger value="log">事件日誌</TabsTrigger>
          <TabsTrigger value="blocked">已封鎖 IP</TabsTrigger>
          <TabsTrigger value="useragents">可疑 User-Agent</TabsTrigger>
        </TabsList>

        {/* ── Event Log ── */}
        <TabsContent value="log">
          <Card className="bg-white/[0.02] border-white/[0.08]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">最近安全事件</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">顯示筆數：</span>
                {[50, 100, 200].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLogLimit(n)}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded transition-colors",
                      logLimit === n
                        ? "bg-[#06038d] text-white"
                        : "text-gray-400 hover:text-gray-200"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-gray-400 text-xs w-36">時間</TableHead>
                      <TableHead className="text-gray-400 text-xs">類型</TableHead>
                      <TableHead className="text-gray-400 text-xs">IP</TableHead>
                      <TableHead className="text-gray-400 text-xs">路徑</TableHead>
                      <TableHead className="text-gray-400 text-xs">原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">載入中...</TableCell>
                      </TableRow>
                    ) : (logQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">暫無安全事件記錄</TableCell>
                      </TableRow>
                    ) : (logQuery.data ?? []).map((event: any, i: number) => (
                      <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-xs text-gray-400 font-mono whitespace-nowrap">
                          {formatTs(event.ts)}
                        </TableCell>
                        <TableCell><EventBadge type={event.type} /></TableCell>
                        <TableCell className="text-xs text-gray-300 font-mono">{event.ip}</TableCell>
                        <TableCell className="text-xs text-gray-400 max-w-[200px] truncate" title={event.path}>
                          {event.path}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[240px] truncate" title={event.reason}>
                          {event.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Blocked IPs ── */}
        <TabsContent value="blocked">
          <Card className="bg-white/[0.02] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">
                已封鎖 IP 列表
                <Badge variant="outline" className="ml-2 text-xs">
                  {(blockedQuery.data ?? []).length} 個
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-gray-400 text-xs">IP 地址</TableHead>
                      <TableHead className="text-gray-400 text-xs">封鎖原因</TableHead>
                      <TableHead className="text-gray-400 text-xs w-36">封鎖時間</TableHead>
                      <TableHead className="text-gray-400 text-xs w-20">事件數</TableHead>
                      <TableHead className="text-gray-400 text-xs w-20">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockedQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">載入中...</TableCell>
                      </TableRow>
                    ) : (blockedQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">目前沒有被封鎖的 IP</TableCell>
                      </TableRow>
                    ) : (blockedQuery.data ?? []).map((item: any) => (
                      <TableRow key={item.ip} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-sm text-red-300 font-mono">{item.ip}</TableCell>
                        <TableCell className="text-xs text-gray-400 max-w-[240px] truncate" title={item.reason}>
                          {item.reason}
                        </TableCell>
                        <TableCell className="text-xs text-gray-400 font-mono whitespace-nowrap">
                          {formatTs(item.blockedAt)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-300">{item.eventCount}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unblockMutation.mutate({ ip: item.ip })}
                            disabled={unblockMutation.isPending}
                            className="h-7 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          >
                            <Unlock className="w-3 h-3 mr-1" />
                            解封
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Top User-Agents ── */}
        <TabsContent value="useragents">
          <Card className="bg-white/[0.02] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">可疑 User-Agent 排行</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-gray-400 text-xs">#</TableHead>
                      <TableHead className="text-gray-400 text-xs">User-Agent</TableHead>
                      <TableHead className="text-gray-400 text-xs w-24">觸發次數</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userAgentsQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">載入中...</TableCell>
                      </TableRow>
                    ) : (userAgentsQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">暫無可疑 User-Agent 記錄</TableCell>
                      </TableRow>
                    ) : (userAgentsQuery.data ?? []).map((item: any, i: number) => (
                      <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-xs text-gray-500 w-8">{i + 1}</TableCell>
                        <TableCell className="text-xs text-gray-300 font-mono max-w-[400px] truncate" title={item.ua}>
                          {item.ua || "(空白)"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30">
                            {item.count}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Block IP Dialog */}
      <BlockIpDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        onBlock={(ip, reason) => blockMutation.mutate({ ip, reason })}
        loading={blockMutation.isPending}
      />
    </div>
  );
}
