/**
 * AdminVipDashboard — VIP Subscription & Revenue Management Console
 * Dark theme matching the admin panel (zinc-900 / zinc-800 palette)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
  DollarSign,
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
  const borderMap = {
    blue: "border-blue-500/30",
    gold: "border-yellow-500/30",
    green: "border-emerald-500/30",
    red: "border-red-500/30",
  };
  const iconBg = {
    blue: "bg-blue-500/20 text-blue-400",
    gold: "bg-yellow-500/20 text-yellow-400",
    green: "bg-emerald-500/20 text-emerald-400",
    red: "bg-red-500/20 text-red-400",
  };
  const valueColor = {
    blue: "text-white",
    gold: "text-[#D4AF37]",
    green: "text-emerald-300",
    red: "text-red-300",
  };

  return (
    <div
      className={`rounded-xl border ${borderMap[accent]} bg-zinc-900/70 backdrop-blur-sm p-5 flex flex-col gap-3`}
      style={{ boxShadow: "0 2px 20px 0 rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg[accent]}`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-bold tracking-tight ${valueColor[accent]}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        已付款
      </span>
    );
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        扣款中
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      已到期
    </span>
  );
}

// ── Plan Badge ─────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: "monthly" | "yearly" }) {
  if (plan === "monthly") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
        月費方案
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
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
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            VIP 訂閱與財務管理
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">即時訂閱數據與會員管理</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchStats(); utils.adminVip.getSubscriptions.invalidate(); }}
          className="gap-2 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
          刷新數據
        </Button>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="總 VIP 會員數"
          value={statsLoading ? "—" : (stats?.totalVips ?? 0)}
          sub={stats
            ? `本月新增 ${stats.newThisMonth} 人${stats.growthPct !== 0 ? `（${stats.growthPct > 0 ? "+" : ""}${stats.growthPct}%）` : ""}`
            : undefined}
          accent="blue"
        />
        <StatCard
          icon={<PieChart className="w-5 h-5" />}
          label="月費 VS 年費 比例"
          value={statsLoading ? "—" : `${stats?.monthlyCount ?? 0} : ${stats?.yearlyCount ?? 0}`}
          sub={stats
            ? `月費 ${stats.monthlyPct}%　年費 ${stats.yearlyPct}%`
            : undefined}
          accent="gold"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="本月預估 MRR"
          value={statsLoading ? "—" : `HKD ${stats?.mrr?.toLocaleString("zh-HK", { minimumFractionDigits: 0 }) ?? 0}`}
          sub="月費 × 38 + 年費 × 24.8"
          accent="green"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="待跟進帳戶"
          value={statsLoading ? "—" : (stats?.pendingAttention ?? 0)}
          sub={stats
            ? `扣款失敗 ${stats.failedPayments} · 即將到期 ${stats.expiringSoon}`
            : undefined}
          accent="red"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="總累計收益"
          value={statsLoading ? "—" : `HKD ${stats?.totalRevenue?.toLocaleString("zh-HK", { minimumFractionDigits: 0 }) ?? 0}`}
          sub={stats
            ? `月費 ${stats.totalMonthlyUsers} 人 · 年費 ${stats.totalYearlyUsers} 人`
            : undefined}
          accent="gold"
        />
      </div>

      {/* Filters + Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-zinc-800 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] flex gap-2">
            <input
              type="text"
              placeholder="搜尋 Email 或暱稱..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
            <button
              onClick={handleSearch}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#FEDD00] text-zinc-900 hover:bg-yellow-300 transition-colors shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value as any); setPage(1); }}
            className="h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-zinc-500 cursor-pointer"
          >
            <option value="all">全部方案</option>
            <option value="monthly">月費方案</option>
            <option value="yearly">年費方案</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-zinc-500 cursor-pointer"
          >
            <option value="all">全部狀態</option>
            <option value="active">已付款</option>
            <option value="expired">已到期</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800/50">
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">用戶</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">方案</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">狀態</th>
                <th className="text-right py-3 px-4 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">金額</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider hidden md:table-cell">開始訂閱</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">到期日</th>
                <th className="text-right py-3 px-4 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {subsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : subs?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-500">
                    <Crown className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>暫無 VIP 訂閱記錄</p>
                  </td>
                </tr>
              ) : (
                subs?.items.map((sub) => (
                  <tr key={sub.id} className="hover:bg-zinc-800/30 transition-colors">
                    {/* User */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={sub.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs bg-zinc-700 text-zinc-300">
                            {(sub.displayName || sub.name || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-100 truncate max-w-[120px]">
                            {sub.displayName || sub.name}
                          </div>
                          <div className="text-xs text-zinc-500 truncate max-w-[140px]">{sub.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Plan */}
                    <td className="py-3 px-4">
                      <PlanBadge plan={sub.vipPlan} />
                    </td>
                    {/* Status */}
                    <td className="py-3 px-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-mono text-zinc-200 font-medium">
                      HKD {sub.amountHkd}
                      <span className="text-zinc-500 font-normal text-xs">
                        /{sub.vipPlan === "monthly" ? "月" : "年"}
                      </span>
                    </td>
                    {/* Subscribed At */}
                    <td className="py-3 px-4 text-zinc-400 hidden md:table-cell">
                      {formatDate(sub.subscribedAt)}
                    </td>
                    {/* Expires At */}
                    <td className="py-3 px-4">
                      {sub.vipExpiresAt ? (
                        <span className={
                          new Date(sub.vipExpiresAt) < new Date()
                            ? "text-red-400 font-medium"
                            : new Date(sub.vipExpiresAt) < new Date(Date.now() + 7 * 86400000)
                            ? "text-yellow-400 font-medium"
                            : "text-zinc-300"
                        }>
                          {formatDate(sub.vipExpiresAt)}
                        </span>
                      ) : "—"}
                    </td>
                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
                          onClick={() => sendReminder.mutate({ userId: sub.id })}
                          disabled={sendReminder.isPending}
                          title="發送續訂提醒 Email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          onClick={() => {
                            setCancelTarget({ id: sub.id, name: sub.displayName || sub.name });
                            setCancelImmediately(false);
                          }}
                          title="取消訂閱"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">
              共 {subs.total} 筆　第 {subs.page} / {subs.totalPages} 頁
            </span>
            <div className="flex gap-1">
              <button
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
                disabled={page >= subs.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="w-5 h-5" />
              確認取消訂閱
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-zinc-400">
              <p>
                即將取消 <strong className="text-zinc-200">{cancelTarget?.name}</strong> 的 VIP 訂閱。
              </p>
              <div className="flex flex-col gap-2 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cancelType"
                    checked={!cancelImmediately}
                    onChange={() => setCancelImmediately(false)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-zinc-300">
                    <strong>到期後取消</strong>（推薦）— 保留至當前付費週期結束
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cancelType"
                    checked={cancelImmediately}
                    onChange={() => setCancelImmediately(true)}
                    className="accent-red-500"
                  />
                  <span className="text-sm text-red-400">
                    <strong>立即取消</strong> — 即時終止，不退款
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700">取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
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
