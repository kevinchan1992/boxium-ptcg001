import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, ChevronRight, ChevronLeft, Plus, AlertCircle, CreditCard, Search } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "待付款", color: "bg-orange-100 text-orange-800 border-orange-200" },
  pending_review: { label: "審核中", color: "bg-gray-100 text-gray-700 border-gray-200" },
  pending_shipment: { label: "待寄件", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  received: { label: "BOXIUM 已收件", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  submitted_to_psa: { label: "已出團", color: "bg-purple-100 text-purple-800 border-purple-200" },
  grading: { label: "鑑定中", color: "bg-violet-100 text-violet-800 border-violet-200" },
  graded: { label: "鑑定完成", color: "bg-green-100 text-green-800 border-green-200" },
  payment_overdue: { label: "付款逾期", color: "bg-red-100 text-red-800 border-red-200" },
  paid: { label: "已付款", color: "bg-blue-100 text-blue-800 border-blue-200" },
  returned: { label: "已寄回", color: "bg-teal-100 text-teal-800 border-teal-200" },
  completed: { label: "已完成", color: "bg-gray-100 text-gray-700 border-gray-200" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-700 border-red-200" },
};

const PAYMENT_PENDING_STATUSES = new Set(["awaiting_payment", "payment_overdue"]);

type FilterTab = "all" | "action" | "in_progress" | "done";
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "action", label: "需行動" },
  { key: "in_progress", label: "進行中" },
  { key: "done", label: "已完成" },
];
const ACTION_STATUSES = new Set(["awaiting_payment", "payment_overdue", "pending_shipment", "graded"]);
const IN_PROGRESS_STATUSES = new Set(["pending_review", "received", "submitted_to_psa", "grading", "paid"]);
const DONE_STATUSES = new Set(["completed", "returned", "cancelled"]);

const PAGE_SIZE = 10;

export default function GradingOrders() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: me } = trpc.auth.me.useQuery();
  const { data: submissions, isLoading } = trpc.grading.getMySubmissions.useQuery(undefined, {
    enabled: !!me,
  });

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    if (!submissions) return [];
    let list = submissions as any[];
    if (activeTab === "action") list = list.filter((s) => ACTION_STATUSES.has(s.status));
    else if (activeTab === "in_progress") list = list.filter((s) => IN_PROGRESS_STATUSES.has(s.status));
    else if (activeTab === "done") list = list.filter((s) => DONE_STATUSES.has(s.status));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) => {
        const idStr = String(s.id).toLowerCase();
        const orderNo = (s.orderNo || "").toLowerCase();
        const tierName = (s.tierName || "").toLowerCase();
        return idStr.includes(q) || orderNo.includes(q) || tierName.includes(q);
      });
    }
    return list;
  }, [submissions, activeTab, searchQuery]);

  const counts = useMemo(() => {
    if (!submissions) return { all: 0, action: 0, in_progress: 0, done: 0 };
    const list = submissions as any[];
    return {
      all: list.length,
      action: list.filter((s) => ACTION_STATUSES.has(s.status)).length,
      in_progress: list.filter((s) => IN_PROGRESS_STATUSES.has(s.status)).length,
      done: list.filter((s) => DONE_STATUSES.has(s.status)).length,
    };
  }, [submissions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">請先登入</h2>
          <p className="text-gray-500 mb-6">查看鑑定訂單需要登入帳號</p>
          <a href="/login">
            <Button className="bg-[#06038d] hover:bg-[#06038d]/90 text-white w-full">
              登入 / 註冊
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">我的鑑定申請</h1>
            <p className="text-gray-500 text-sm mt-1">追蹤您的 PSA 代客鑑定進度</p>
          </div>
          <Button
            onClick={() => navigate("/grading/submit")}
            className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            新申請
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          {FILTER_TABS.map((tab) => {
            const count = counts[tab.key];
            const isActive = activeTab === tab.key;
            const hasUrgent = tab.key === "action" && count > 0;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#06038d] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                      isActive
                        ? "bg-white/20 text-white"
                        : hasUrgent
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜尋申請編號、訂單號..."
            className="pl-9 bg-white border-gray-200 text-sm"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#06038d]" />
          </div>
        ) : !submissions || (submissions as any[]).length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">尚無鑑定申請</h3>
            <p className="text-gray-400 text-sm mb-6">立即提交您的第一張卡牌進行 PSA 鑑定</p>
            <Button
              onClick={() => navigate("/grading/submit")}
              className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
            >
              立即申請
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {searchQuery ? `找不到符合「${searchQuery}」的申請` : "此分類暫無申請"}
            </p>
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                className="mt-2 text-xs text-[#06038d] underline"
              >
                清除搜尋
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Results count */}
            <p className="text-xs text-gray-400 mb-3">
              共 {filtered.length} 筆
              {totalPages > 1 && `，第 ${currentPage} / ${totalPages} 頁`}
            </p>

            <div className="space-y-3">
              {paginated.map((sub: any) => {
                const statusInfo = STATUS_MAP[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-700 border-gray-200" };
                const needsPayment = PAYMENT_PENDING_STATUSES.has(sub.status);
                return (
                  <div
                    key={sub.id}
                    className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-all ${
                      needsPayment
                        ? "border-orange-300 hover:border-orange-500 hover:shadow-md"
                        : "border-gray-200 hover:border-[#06038d] hover:shadow-md"
                    }`}
                    onClick={() => navigate(`/grading/orders/${sub.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[#06038d] text-sm font-mono">{sub.orderNo}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(sub.createdAt).toLocaleDateString("zh-HK", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {" · "}
                          {sub.itemCount ?? 0} 張卡牌
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs text-gray-500">代送 PSA 費用</span>
                      <span className="font-bold text-gray-900">
                        HK${parseFloat(sub.totalFeeHkd).toLocaleString()}
                      </span>
                    </div>
                    {sub.status === "graded" && sub.paymentDeadline && (
                      <div className="mt-2 bg-orange-50 rounded-lg px-3 py-2 text-xs text-orange-700 font-semibold">
                        ⚠️ 請於 {new Date(sub.paymentDeadline).toLocaleDateString("zh-HK")} 前完成付款
                      </div>
                    )}
                    {needsPayment && (
                      <div
                        className="mt-3 pt-3 border-t border-orange-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/grading/orders/${sub.id}`);
                        }}
                      >
                        <Button
                          size="sm"
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          {sub.status === "payment_overdue" ? "⚠️ 立即付款（已逾期）" : "前往付款"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="gap-1 bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一頁
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "..." ? (
                        <span key={`e-${idx}`} className="px-2 text-gray-400 text-sm">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                            currentPage === p
                              ? "bg-[#06038d] text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="gap-1 bg-white"
                >
                  下一頁
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
