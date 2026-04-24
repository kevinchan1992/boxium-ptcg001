import { useState, useMemo, useCallback } from "react";
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

const FILTER_TABS: { key: FilterTab; label: string; statuses?: string[] }[] = [
  { key: "all", label: "全部" },
  { key: "action", label: "需行動", statuses: ["awaiting_payment", "payment_overdue", "pending_shipment", "graded"] },
  { key: "in_progress", label: "進行中", statuses: ["pending_review", "received", "submitted_to_psa", "grading", "paid"] },
  { key: "done", label: "已完成", statuses: ["completed", "returned", "cancelled"] },
];

const PAGE_SIZE = 10;

export default function GradingOrders() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: me } = trpc.auth.me.useQuery();

  // Determine status filter based on active tab
  const statusFilter = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.key === activeTab);
    return tab?.statuses;
  }, [activeTab]);

  // Use backend pagination with search and status filter
  // For "action", "in_progress", "done" tabs, we pass a comma-separated status string
  // Backend supports single status; for multi-status tabs we fetch all and filter client-side
  const isMultiStatusTab = activeTab !== "all" && statusFilter && statusFilter.length > 1;

  const { data: serverData, isLoading } = trpc.grading.getMySubmissions.useQuery(
    isMultiStatusTab
      ? { page: 1, pageSize: 200, search: debouncedSearch } // fetch more for multi-status tabs
      : {
          page: currentPage,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: activeTab === "all" ? undefined : statusFilter?.[0],
        },
    { enabled: !!me }
  );

  // For multi-status tabs, filter client-side
  const filteredSubmissions = useMemo(() => {
    if (!serverData) return [];
    if (isMultiStatusTab && statusFilter) {
      const statusSet = new Set(statusFilter);
      return serverData.submissions.filter((s: any) => statusSet.has(s.status));
    }
    return serverData.submissions;
  }, [serverData, isMultiStatusTab, statusFilter]);

  // Pagination for multi-status tabs (client-side)
  const totalPages = isMultiStatusTab
    ? Math.max(1, Math.ceil(filteredSubmissions.length / PAGE_SIZE))
    : (serverData?.totalPages ?? 1);

  const paginated = useMemo(() => {
    if (isMultiStatusTab) {
      const start = (currentPage - 1) * PAGE_SIZE;
      return filteredSubmissions.slice(start, start + PAGE_SIZE);
    }
    return filteredSubmissions;
  }, [filteredSubmissions, isMultiStatusTab, currentPage]);

  const totalCount = isMultiStatusTab
    ? filteredSubmissions.length
    : (serverData?.total ?? 0);

  const handleTabChange = useCallback((tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => setDebouncedSearch(q), 400);
    setSearchTimer(timer);
  }, [searchTimer]);

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">請先登入</h2>
          <p className="text-gray-500 mb-6">查看鑑定訂單需要登入帳號</p>
          <a href="/login">
            <Button className="bg-[#06038d] hover:bg-[#06038d]/90 text-white">前往登入</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">我的鑑定申請</h1>
          <Button
            size="sm"
            className="bg-[#06038d] hover:bg-[#06038d]/90 text-white gap-1"
            onClick={() => navigate("/grading/submit")}
          >
            <Plus className="h-4 w-4" />
            新申請
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9 bg-white border-gray-200"
            placeholder="搜尋訂單號..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
                activeTab === tab.key
                  ? "bg-white text-[#06038d] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#06038d]" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {debouncedSearch ? "找不到符合的申請" : "暫無鑑定申請"}
            </p>
            {!debouncedSearch && (
              <Button
                className="mt-4 bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                onClick={() => navigate("/grading/submit")}
              >
                立即申請
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 text-right">共 {totalCount} 筆申請</p>
            <div className="space-y-3">
              {paginated.map((sub: any) => {
                const statusInfo = STATUS_MAP[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-700 border-gray-200" };
                const needsPayment = PAYMENT_PENDING_STATUSES.has(sub.status);
                return (
                  <div
                    key={sub.id}
                    className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:border-[#06038d]/30 hover:shadow-sm transition-all"
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
