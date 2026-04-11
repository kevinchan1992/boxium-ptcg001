/**
 * AdminSecurityMonitor (v2)
 *
 * Admin panel for monitoring security events, blocked IPs, and bot detection.
 * v2 changes:
 *  - "即時日誌" tab: in-memory cache (fast, last 500 events)
 *  - "資料庫記錄" tab: persistent DB log (survives restarts, paginated)
 *  - "已封鎖 IP" tab: shows DB-persisted blocked IPs (survives restarts)
 *  - "可疑 UA" tab: top User-Agents from memory cache
 *  - Stats cards updated to use new field names from security.ts v2
 *  - Alert badge: shows when 20+ events in last 5 min
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
import {
  Shield, Ban, Unlock, RefreshCw, AlertTriangle, Activity, Globe, Bot,
  Database, Wifi, ChevronLeft, ChevronRight, ShieldCheck, Zap, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Event type badge colours ──────────────────────────────────────── */
const EVENT_BADGE: Record<string, { label: string; className: string }> = {
  BOT_BLOCKED:     { label: "Bot 偵測", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  RATE_LIMITED:    { label: "限流",     className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  MANUAL_BLOCK:    { label: "手動封鎖", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  UPLOAD_REJECTED: { label: "上傳拒絕", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  // Legacy (in-memory)
  rate_limit:      { label: "限流",     className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  bot_detected:    { label: "Bot 偵測", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  manual_block:    { label: "手動封鎖", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  upload_reject:   { label: "上傳拒絕", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
};

function EventBadge({ type }: { type: string }) {
  const cfg = EVENT_BADGE[type] ?? { label: type, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function formatTs(ts: number | Date | string) {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleString("zh-HK", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

/* ─── Stats Cards ────────────────────────────────────────────────────── */
function StatsCards({ stats, alertActive }: { stats: any; alertActive: boolean }) {
  if (!stats) return null;
  const cards = [
    { label: "過去 1 小時事件", value: stats.last1hEvents ?? stats.last1h ?? 0, icon: <Activity className="w-4 h-4" />, color: "text-blue-400" },
    { label: "過去 24 小時事件", value: stats.last24hEvents ?? stats.last24h ?? 0, icon: <Shield className="w-4 h-4" />, color: "text-yellow-400" },
    { label: "持久化封鎖 IP", value: stats.manuallyBlockedCount ?? stats.blockedIpCount ?? 0, icon: <Database className="w-4 h-4" />, color: "text-red-400" },
    { label: "Bot 偵測", value: stats.byType?.BOT_BLOCKED ?? stats.botDetections ?? 0, icon: <Bot className="w-4 h-4" />, color: "text-purple-400" },
    { label: "限流觸發", value: stats.byType?.RATE_LIMITED ?? stats.rateLimitHits ?? 0, icon: <AlertTriangle className="w-4 h-4" />, color: "text-orange-400" },
    { label: "手動封鎖", value: stats.byType?.MANUAL_BLOCK ?? stats.manualBlocks ?? 0, icon: <Globe className="w-4 h-4" />, color: "text-pink-400" },
  ];
  return (
    <div className="space-y-3">
      {alertActive && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>⚠️ 告警：過去 5 分鐘內偵測到大量安全事件，已自動通知管理員。</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
    </div>
  );
}

/* ─── Block IP Dialog ────────────────────────────────────────────────── */
function BlockIpDialog({
  open, onClose, onBlock, loading,
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
            手動封鎖 IP（持久化到資料庫）
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="block-ip">IP 地址</Label>
            <Input id="block-ip" placeholder="例如：1.2.3.4" value={ip} onChange={(e) => setIp(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="block-reason">封鎖原因</Label>
            <Input id="block-reason" placeholder="例如：惡意爬蟲、暴力登入..." value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5" />
          </div>
          <p className="text-xs text-gray-500">封鎖記錄將儲存到資料庫，伺服器重啟後仍然有效。</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>取消</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading || !ip.trim() || !reason.trim()}>
            {loading ? "封鎖中..." : "確認封鎖"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Pagination Controls ────────────────────────────────────────────── */
function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] text-xs text-gray-400">
      <span>共 {total.toLocaleString()} 筆，第 {page}/{totalPages} 頁</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function AdminSecurityMonitor() {
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [logLimit, setLogLimit] = useState(100);
  const [dbPage, setDbPage] = useState(1);
  const [rlPage, setRlPage] = useState(1);
  const DB_LIMIT = 50;

  const utils = trpc.useUtils();

  // In-memory queries (fast, real-time)
  const statsQuery = trpc.security.getStats.useQuery(undefined, { refetchInterval: 15_000 });
  const logQuery = trpc.security.getLog.useQuery({ limit: logLimit }, { refetchInterval: 15_000 });
  const blockedMemQuery = trpc.security.getBlockedIps.useQuery(undefined, { refetchInterval: 30_000 });
  const userAgentsQuery = trpc.security.getTopUserAgents.useQuery({ limit: 10 }, { refetchInterval: 60_000 });

  // DB queries (persistent, survives restarts)
  const dbLogQuery = trpc.security.getDbLog.useQuery(
    { limit: DB_LIMIT, offset: (dbPage - 1) * DB_LIMIT },
    { refetchInterval: 30_000 }
  );
  const dbBlockedQuery = trpc.security.getDbBlockedIps.useQuery(
    { activeOnly: true },
    { refetchInterval: 30_000 }
  );

  // Rate Limit monitoring
  const rlQuery = trpc.security.getRateLimitLog.useQuery(
    { limit: DB_LIMIT, offset: (rlPage - 1) * DB_LIMIT },
    { refetchInterval: 30_000 }
  );

  // Admin IP Whitelist
  const whitelistQuery = trpc.security.getWhitelistedIps.useQuery(undefined, { refetchInterval: 30_000 });
  const whitelistMyIpMutation = trpc.security.whitelistMyIp.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.security.getWhitelistedIps.invalidate();
    },
    onError: (err) => toast.error(`白名單失敗：${err.message}`),
  });
  const removeFromWhitelistMutation = trpc.security.removeFromWhitelist.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.security.getWhitelistedIps.invalidate();
    },
    onError: (err) => toast.error(`移除失敗：${err.message}`),
  });

  // Alert: 20+ events in last 5 min
  const stats = statsQuery.data as any;
  const alertActive = (stats?.last1hEvents ?? 0) >= 20;

  const blockMutation = trpc.security.blockIp.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "封鎖成功（已持久化到資料庫）");
      setBlockDialogOpen(false);
      utils.security.getBlockedIps.invalidate();
      utils.security.getDbBlockedIps.invalidate();
      utils.security.getStats.invalidate();
    },
    onError: (err) => toast.error(`封鎖失敗：${err.message}`),
  });

  const unblockMutation = trpc.security.unblockIp.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? "解封成功（已更新資料庫）");
      utils.security.getBlockedIps.invalidate();
      utils.security.getDbBlockedIps.invalidate();
      utils.security.getStats.invalidate();
    },
    onError: (err) => toast.error(`解封失敗：${err.message}`),
  });

  const handleRefresh = () => {
    utils.security.getStats.invalidate();
    utils.security.getLog.invalidate();
    utils.security.getBlockedIps.invalidate();
    utils.security.getTopUserAgents.invalidate();
    utils.security.getDbLog.invalidate();
    utils.security.getDbBlockedIps.invalidate();
    utils.security.getRateLimitLog.invalidate();
    utils.security.getWhitelistedIps.invalidate();
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
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              安全監控
              {alertActive && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] animate-pulse">
                  ⚠️ 告警
                </Badge>
              )}
            </h1>
            <p className="text-sm text-gray-400">Rate Limiting · Bot Detection · IP 封鎖管理（持久化）</p>
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
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            重新整理
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards stats={statsQuery.data} alertActive={alertActive} />

      {/* Tabs */}
      <Tabs defaultValue="live">
        <TabsList className="mb-4">
          <TabsTrigger value="live" className="gap-1.5">
            <Wifi className="w-3.5 h-3.5" />
            即時日誌
          </TabsTrigger>
          <TabsTrigger value="db" className="gap-1.5">
            <Database className="w-3.5 h-3.5" />
            資料庫記錄
          </TabsTrigger>
          <TabsTrigger value="blocked">已封鎖 IP（持久化）</TabsTrigger>
          <TabsTrigger value="useragents">可疑 User-Agent</TabsTrigger>
          <TabsTrigger value="ratelimit" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            限流監控
          </TabsTrigger>
          <TabsTrigger value="whitelist" className="gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            白名單管理
          </TabsTrigger>
        </TabsList>

        {/* ── Live Log (in-memory) ── */}
        <TabsContent value="live">
          <Card className="bg-white/[0.02] border-white/[0.08]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-medium text-gray-300">即時安全事件（記憶體快取，最多 500 筆）</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">伺服器重啟後清空；完整歷史請查「資料庫記錄」標籤</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">顯示：</span>
                {[50, 100, 200].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLogLimit(n)}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded transition-colors",
                      logLimit === n ? "bg-[#06038d] text-white" : "text-gray-400 hover:text-gray-200"
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
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">載入中...</TableCell></TableRow>
                    ) : (logQuery.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">暫無安全事件記錄</TableCell></TableRow>
                    ) : (logQuery.data ?? []).map((event: any, i: number) => (
                      <TableRow key={event.id ?? i} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-xs text-gray-400 font-mono whitespace-nowrap">
                          {formatTs(event.timestamp ?? event.ts ?? event.createdAt)}
                        </TableCell>
                        <TableCell><EventBadge type={event.type} /></TableCell>
                        <TableCell className="text-xs text-gray-300 font-mono">{event.ip}</TableCell>
                        <TableCell className="text-xs text-gray-400 max-w-[200px] truncate" title={event.path}>{event.path}</TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[240px] truncate" title={event.reason}>{event.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DB Log (persistent) ── */}
        <TabsContent value="db">
          <Card className="bg-white/[0.02] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">資料庫安全記錄（持久化，伺服器重啟後仍保留）</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">所有事件均寫入資料庫，此處顯示完整歷史記錄</p>
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
                    {dbLogQuery.isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">載入中...</TableCell></TableRow>
                    ) : (dbLogQuery.data?.events ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">資料庫暫無安全事件記錄</TableCell></TableRow>
                    ) : (dbLogQuery.data?.events ?? []).map((event: any) => (
                      <TableRow key={event.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-xs text-gray-400 font-mono whitespace-nowrap">
                          {formatTs(event.createdAt)}
                        </TableCell>
                        <TableCell><EventBadge type={event.type} /></TableCell>
                        <TableCell className="text-xs text-gray-300 font-mono">{event.ip}</TableCell>
                        <TableCell className="text-xs text-gray-400 max-w-[200px] truncate" title={event.path ?? ""}>{event.path}</TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[240px] truncate" title={event.reason ?? ""}>{event.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(dbLogQuery.data?.total ?? 0) > 0 && (
                <Pagination
                  page={dbPage}
                  total={dbLogQuery.data?.total ?? 0}
                  limit={DB_LIMIT}
                  onPage={setDbPage}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Blocked IPs (DB-persisted) ── */}
        <TabsContent value="blocked">
          <Card className="bg-white/[0.02] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">
                已封鎖 IP（資料庫持久化）
                <Badge variant="outline" className="ml-2 text-xs">
                  {(dbBlockedQuery.data ?? []).length} 個
                </Badge>
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">封鎖記錄儲存在資料庫，伺服器重啟後仍然有效</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-gray-400 text-xs">IP 地址</TableHead>
                      <TableHead className="text-gray-400 text-xs">封鎖原因</TableHead>
                      <TableHead className="text-gray-400 text-xs">封鎖者</TableHead>
                      <TableHead className="text-gray-400 text-xs w-36">封鎖時間</TableHead>
                      <TableHead className="text-gray-400 text-xs w-20">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbBlockedQuery.isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">載入中...</TableCell></TableRow>
                    ) : (dbBlockedQuery.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">目前沒有被封鎖的 IP</TableCell></TableRow>
                    ) : (dbBlockedQuery.data ?? []).map((item: any) => (
                      <TableRow key={item.ip} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-sm text-red-300 font-mono">{item.ip}</TableCell>
                        <TableCell className="text-xs text-gray-400 max-w-[240px] truncate" title={item.reason}>{item.reason}</TableCell>
                        <TableCell className="text-xs text-gray-500">{item.blockedBy ?? "admin"}</TableCell>
                        <TableCell className="text-xs text-gray-400 font-mono whitespace-nowrap">
                          {formatTs(item.blockedAt)}
                        </TableCell>
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
              <CardTitle className="text-sm font-medium text-gray-300">可疑 User-Agent 排行（即時）</CardTitle>
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
                      <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-8">載入中...</TableCell></TableRow>
                    ) : (userAgentsQuery.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-8">暫無可疑 User-Agent 記錄</TableCell></TableRow>
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

        {/* ── Rate Limit Monitor ── */}
        <TabsContent value="ratelimit">
          <div className="space-y-4">
            {/* Top IPs */}
            {(rlQuery.data?.topIps ?? []).length > 0 && (
              <Card className="bg-white/[0.02] border-white/[0.08]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    高頻限流 IP 排行（前 20 名）
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">觸發限流次數最多的 IP，可判斷是否為真實攻擊行為</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.06] hover:bg-transparent">
                          <TableHead className="text-gray-400 text-xs">#</TableHead>
                          <TableHead className="text-gray-400 text-xs">IP 地址</TableHead>
                          <TableHead className="text-gray-400 text-xs w-28">觸發次數</TableHead>
                          <TableHead className="text-gray-400 text-xs w-36">最後時間</TableHead>
                          <TableHead className="text-gray-400 text-xs w-24">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(rlQuery.data?.topIps ?? []).map((item: any, i: number) => (
                          <TableRow key={item.ip} className="border-white/[0.04] hover:bg-white/[0.02]">
                            <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                            <TableCell className="text-sm text-yellow-300 font-mono">{item.ip}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs border-yellow-500/30 ${item.hitCount >= 50 ? 'text-red-400 border-red-500/30' : item.hitCount >= 20 ? 'text-orange-400 border-orange-500/30' : 'text-yellow-400'}`}>
                                {item.hitCount} 次
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-gray-400 font-mono whitespace-nowrap">
                              {item.lastSeen ? formatTs(item.lastSeen) : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => blockMutation.mutate({ ip: item.ip, reason: `高頻限流自動封鎖（${item.hitCount}次）` })}
                                disabled={blockMutation.isPending}
                                className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Ban className="w-3 h-3 mr-1" />
                                封鎖
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rate Limit Event Log */}
            <Card className="bg-white/[0.02] border-white/[0.08]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300">限流觸發記錄（資料庫持久化）</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">所有 RATE_LIMITED 事件，可判斷是否為真實攻擊行為而非正常用戶被誤封</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.06] hover:bg-transparent">
                        <TableHead className="text-gray-400 text-xs w-36">時間</TableHead>
                        <TableHead className="text-gray-400 text-xs">IP</TableHead>
                        <TableHead className="text-gray-400 text-xs">路徑</TableHead>
                        <TableHead className="text-gray-400 text-xs">原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rlQuery.isLoading ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-8">載入中...</TableCell></TableRow>
                      ) : (rlQuery.data?.events ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-8">暫無限流觸發記錄</TableCell></TableRow>
                      ) : (rlQuery.data?.events ?? []).map((event: any) => (
                        <TableRow key={event.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell className="text-xs text-gray-400 font-mono whitespace-nowrap">
                            {formatTs(event.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs text-yellow-300 font-mono">{event.ip}</TableCell>
                          <TableCell className="text-xs text-gray-400 max-w-[200px] truncate" title={event.path ?? ''}>{event.path}</TableCell>
                          <TableCell className="text-xs text-gray-500 max-w-[240px] truncate" title={event.reason ?? ''}>{event.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {(rlQuery.data?.total ?? 0) > 0 && (
                  <Pagination
                    page={rlPage}
                    total={rlQuery.data?.total ?? 0}
                    limit={DB_LIMIT}
                    onPage={setRlPage}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Admin IP Whitelist ── */}
        <TabsContent value="whitelist">
          <Card className="bg-white/[0.02] border-white/[0.08]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                    管理員 IP 白名單
                    <Badge variant="outline" className="ml-1 text-xs text-green-400 border-green-500/30">
                      {(whitelistQuery.data ?? []).length} 個
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">白名單內的 IP 將豁免所有請求限流。已持久化到資料庫，伺服器重啟後自動載入。</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => whitelistMyIpMutation.mutate()}
                  disabled={whitelistMyIpMutation.isPending}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {whitelistMyIpMutation.isPending ? '處理中...' : '將我的 IP 加入白名單'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-gray-400 text-xs">IP 地址</TableHead>
                      <TableHead className="text-gray-400 text-xs">添加者</TableHead>
                      <TableHead className="text-gray-400 text-xs">添加時間</TableHead>
                      <TableHead className="text-gray-400 text-xs w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whitelistQuery.isLoading ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-8">載入中...</TableCell></TableRow>
                    ) : (whitelistQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8">
                          <div className="text-gray-500 text-sm">白名單為空</div>
                          <div className="text-gray-600 text-xs mt-1">點擊「將我的 IP 加入白名單」以豁免限流</div>
                        </TableCell>
                      </TableRow>
                    ) : (whitelistQuery.data ?? []).map((entry: any) => {
                      const ip = typeof entry === 'string' ? entry : entry.ip;
                      const addedBy = typeof entry === 'object' ? entry.addedBy : 'admin';
                      const addedAt = typeof entry === 'object' && entry.addedAt ? new Date(entry.addedAt).toLocaleString() : '-';
                      return (
                        <TableRow key={ip} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell className="text-sm text-green-300 font-mono">{ip}</TableCell>
                          <TableCell className="text-xs text-gray-400">{addedBy}</TableCell>
                          <TableCell className="text-xs text-gray-400">{addedAt}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromWhitelistMutation.mutate({ ip })}
                              disabled={removeFromWhitelistMutation.isPending}
                              className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              移除
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 py-3 border-t border-white/[0.06] bg-yellow-500/5">
                  <p className="text-xs text-green-400/80 flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  白名單已持久化到資料庫，伺服器重啟後會自動載入，豁免設定永久有效。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
