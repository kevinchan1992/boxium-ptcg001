/**
 * AdminVipDashboard — VIP Subscription & Revenue Management Console
 * White marble / platinum design with Executive Summary cards and interactive table
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Crown,
  Users,
  TrendingUp,
  AlertTriangle,
  PieChart,
  Mail,
  Ban,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { toast } from "sonner";

// ── Executive Summary Card ─────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "gold" | "green" | "red";
}) {
  const accentMap = {
    blue: "from-blue-50 to-white border-blue-100 text-blue-600",
    gold: "from-yellow-50 to-white border-yellow-100 text-yellow-600",
    green: "from-emerald-50 to-white border-emerald-100 text-emerald-600",
    red: "from-red-50 to-white border-red-100 text-red-600",
  };
  const iconBg = {
    blue: "bg-blue-100",
    gold: "bg-yellow-100",
    green: "bg-emerald-100",
    red: "bg-red-100",
  };
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${accentMap[accent]} p-5 shadow-sm flex flex-col gap-3`}
      style={{ boxShadow: "0 2px 16px 0 rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        已付款
      </span>
    );
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
        扣款中
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      已到期
    </span>
  );
}

// ── Plan Badge ─────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: "monthly" | "yearly" }) {
  if (plan === "monthly") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        月費方案
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-300">
      ✦ 年費方案
    </span>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export function AdminVipDashboard() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "monthly" | "yearly">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "past_due">("all");
  const [cancelTarget, setCancelTarget] = useState<{ id: number; name: string } | null>(null);
  const [cancelImmediately, setCancelImmediately] = useState(false);

  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.adminVip.getStats.useQuery(undefined, {
    staleTime: 60_000,
  });

  const { data: subs, isLoading: subsLoading } = trpc.adminVip.getSubscriptions.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
    planFilter,
    statusFilter,
  });

  const sendReminder = trpc.adminVip.sendRenewalReminder.useMutation({
    onSuccess: () => toast.success("續訂提醒 Email 已發送"),
    onError: (e) => toast.error(`發送失敗：${e.message}`),
  });

  const cancelSub = trpc.adminVip.cancelSubscription.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.adminVip.getSubscriptions.invalidate();
      utils.adminVip.getStats.invalidate();
      setCancelTarget(null);
    },
    onError: (e) => toast.error(`取消失敗：${e.message}`),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const formatDate = (d: Date | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            VIP 訂閱與財務管理
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">即時訂閱數據與會員管理</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchStats(); utils.adminVip.getSubscriptions.invalidate(); }}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          刷新數據
        </Button>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label="總 VIP 會員數"
          value={statsLoading ? "—" : (stats?.totalVips ?? 0)}
          sub={stats
            ? `本月新增 ${stats.newThisMonth} 人${stats.growthPct !== 0 ? `（${stats.growthPct > 0 ? "+" : ""}${stats.growthPct}%）` : ""}`
            : undefined}
          accent="blue"
        />
        <StatCard
          icon={<PieChart className="w-5 h-5 text-yellow-600" />}
          label="月費 vs 年費 比例"
          value={statsLoading ? "—" : `${stats?.monthlyCount ?? 0} : ${stats?.yearlyCount ?? 0}`}
          sub={stats
            ? `月費 ${stats.monthlyPct}%　年費 ${stats.yearlyPct}%`
            : undefined}
          accent="gold"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          label="本月預估 MRR"
          value={statsLoading ? "—" : `HKD ${stats?.mrr?.toLocaleString("zh-HK", { minimumFractionDigits: 0 }) ?? 0}`}
          sub="月費 × 38 + 年費 × 24.8"
          accent="green"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          label="待跟進帳戶"
          value={statsLoading ? "—" : (stats?.pendingAttention ?? 0)}
          sub={stats
            ? `扣款失敗 ${stats.failedPayments} · 即將到期 ${stats.expiringSoon}`
            : undefined}
          accent="red"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] flex gap-2">
            <Input
              placeholder="搜尋 Email 或暱稱..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-9"
            />
            <Button size="sm" onClick={handleSearch} className="h-9 px-3">
              <Search className="w-4 h-4" />
            </Button>
          </div>
          <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="方案篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部方案</SelectItem>
              <SelectItem value="monthly">月費方案</SelectItem>
              <SelectItem value="yearly">年費方案</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="狀態篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="active">已付款</SelectItem>
              <SelectItem value="expired">已到期</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">用戶</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">方案</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">狀態</th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">金額</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">開始訂閱</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">到期日</th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : subs?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Crown className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>暫無 VIP 訂閱記錄</p>
                  </td>
                </tr>
              ) : (
                subs?.items.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* User */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={sub.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                            {(sub.displayName || sub.name || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate max-w-[120px]">
                            {sub.displayName || sub.name}
                          </div>
                          <div className="text-xs text-gray-400 truncate max-w-[140px]">{sub.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Plan */}
                    <td className="py-3 px-3">
                      <PlanBadge plan={sub.vipPlan} />
                    </td>
                    {/* Status */}
                    <td className="py-3 px-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    {/* Amount */}
                    <td className="py-3 px-3 text-right font-mono text-gray-700 font-medium">
                      HKD {sub.amountHkd}
                      <span className="text-gray-400 font-normal text-xs">
                        /{sub.vipPlan === "monthly" ? "月" : "年"}
                      </span>
                    </td>
                    {/* Subscribed At */}
                    <td className="py-3 px-3 text-gray-500 hidden md:table-cell">
                      {formatDate(sub.subscribedAt)}
                    </td>
                    {/* Expires At */}
                    <td className="py-3 px-3">
                      {sub.vipExpiresAt ? (
                        <span className={
                          new Date(sub.vipExpiresAt) < new Date()
                            ? "text-red-500 font-medium"
                            : new Date(sub.vipExpiresAt) < new Date(Date.now() + 7 * 86400000)
                            ? "text-yellow-600 font-medium"
                            : "text-gray-600"
                        }>
                          {formatDate(sub.vipExpiresAt)}
                        </span>
                      ) : "—"}
                    </td>
                    {/* Actions */}
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => sendReminder.mutate({ userId: sub.id })}
                          disabled={sendReminder.isPending}
                          title="發送續訂提醒"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setCancelTarget({ id: sub.id, name: sub.displayName || sub.name });
                            setCancelImmediately(false);
                          }}
                          title="取消訂閱"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {subs && subs.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              共 {subs.total} 筆　第 {subs.page} / {subs.totalPages} 頁
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= subs.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" />
              確認取消訂閱
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                即將取消 <strong>{cancelTarget?.name}</strong> 的 VIP 訂閱。
              </p>
              <div className="flex flex-col gap-2 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cancelType"
                    checked={!cancelImmediately}
                    onChange={() => setCancelImmediately(false)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm">
                    <strong>到期後取消</strong>（推薦）— 保留至當前付費週期結束
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cancelType"
                    checked={cancelImmediately}
                    onChange={() => setCancelImmediately(true)}
                    className="accent-red-600"
                  />
                  <span className="text-sm text-red-600">
                    <strong>立即取消</strong> — 即時終止，不退款
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (cancelTarget) {
                  cancelSub.mutate({ userId: cancelTarget.id, immediately: cancelImmediately });
                }
              }}
            >
              確認取消訂閱
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
