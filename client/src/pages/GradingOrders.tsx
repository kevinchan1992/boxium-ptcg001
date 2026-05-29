import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, ChevronRight, ChevronLeft, Plus, AlertCircle, CreditCard, Search } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  awaiting_payment: "bg-orange-100 text-orange-800 border-orange-200",
  pending_review: "bg-gray-100 text-gray-700 border-gray-200",
  pending_shipment: "bg-yellow-100 text-yellow-800 border-yellow-200",
  received: "bg-indigo-100 text-indigo-800 border-indigo-200",
  submitted_to_psa: "bg-purple-100 text-purple-800 border-purple-200",
  grading: "bg-violet-100 text-violet-800 border-violet-200",
  graded: "bg-green-100 text-green-800 border-green-200",
  payment_overdue: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-teal-100 text-teal-800 border-teal-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const PAYMENT_PENDING_STATUSES = new Set(["awaiting_payment", "payment_overdue"]);

type FilterTab = "all" | "action" | "in_progress" | "done";

const FILTER_TAB_KEYS: { key: FilterTab; statuses?: string[] }[] = [
  { key: "all" },
  { key: "action", statuses: ["awaiting_payment", "payment_overdue", "pending_shipment", "graded"] },
  { key: "in_progress", statuses: ["pending_review", "received", "submitted_to_psa", "grading"] },
  { key: "done", statuses: ["completed", "returned", "cancelled"] },
];

const PAGE_SIZE = 10;

export default function GradingOrders() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: me } = trpc.auth.me.useQuery();

  const tabStatuses = useMemo(() => {
    const tab = FILTER_TAB_KEYS.find((t) => t.key === activeTab);
    return tab?.statuses;
  }, [activeTab]);

  const queryInput = useMemo(() => {
    const base = {
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
    };
    if (!tabStatuses) return base;
    if (tabStatuses.length === 1) return { ...base, status: tabStatuses[0] };
    return { ...base, statuses: tabStatuses };
  }, [currentPage, debouncedSearch, tabStatuses]);

  const { data: serverData, isLoading } = trpc.grading.getMySubmissions.useQuery(queryInput, {
    enabled: !!me,
  });

  const submissions = serverData?.submissions ?? [];
  const totalPages = serverData?.totalPages ?? 1;
  const totalCount = serverData?.total ?? 0;

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
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('grading.orders.loginRequired')}</h2>
          <p className="text-gray-500 mb-6">{t('grading.orders.loginRequired')}</p>
          <a href="/login">
            <Button className="bg-[#06038d] hover:bg-[#06038d]/90 text-white">{t('grading.orders.loginBtn')}</Button>
          </a>
        </div>
      </div>
    );
  }

  const FILTER_TABS = [
    { key: "all" as FilterTab, label: t('grading.orders.tabs.all') },
    { key: "action" as FilterTab, label: t('grading.orders.tabs.action') },
    { key: "in_progress" as FilterTab, label: t('grading.orders.tabs.inProgress') },
    { key: "done" as FilterTab, label: t('grading.orders.tabs.done') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('grading.orders.title')}</h1>
          <Button
            size="sm"
            className="bg-[#06038d] hover:bg-[#06038d]/90 text-white gap-1"
            onClick={() => navigate("/grading/submit")}
          >
            <Plus className="h-4 w-4" />
            {t('grading.hero.submitBtn')}
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9 bg-white border-gray-200"
            placeholder={t('grading.orders.search')}
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
        ) : submissions.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {debouncedSearch ? t('grading.orders.empty') : t('grading.orders.emptyDesc')}
            </p>
            {!debouncedSearch && (
              <Button
                className="mt-4 bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                onClick={() => navigate("/grading/submit")}
              >
                {t('grading.orders.submitFirst')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 text-right">{t('grading.orders.cards', { count: totalCount })}</p>
            <div className="space-y-3">
              {submissions.map((sub: any) => {
                const statusColor = STATUS_COLOR[sub.status] ?? "bg-gray-100 text-gray-700 border-gray-200";
                const statusLabel = t(`grading.orders.status.${sub.status}`, { defaultValue: sub.status });
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
                          {new Date(sub.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {" · "}
                          {t('grading.orders.cards', { count: sub.itemCount ?? 0 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusColor}`}>
                          {statusLabel}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs text-gray-500">{t('grading.submit.totalFee')}</span>
                      <span className="font-bold text-gray-900">
                        HK${parseFloat(sub.totalFeeHkd).toLocaleString()}
                      </span>
                    </div>
                    {sub.status === "graded" && sub.paymentDeadline && (
                      <div className="mt-2 bg-orange-50 rounded-lg px-3 py-2 text-xs text-orange-700 font-semibold">
                        ⚠️ {new Date(sub.paymentDeadline).toLocaleDateString()}
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
                          {sub.status === "payment_overdue"
                            ? `⚠️ ${t('grading.orders.payNow')}`
                            : t('grading.orders.payNow')}
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
