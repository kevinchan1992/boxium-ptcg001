import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, ChevronRight, Plus, AlertCircle } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "等待付款", color: "bg-amber-100 text-amber-800 border-amber-200" },
  paid: { label: "已付款", color: "bg-blue-100 text-blue-800 border-blue-200" },
  received: { label: "已收件", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  submitted_to_psa: { label: "已出團", color: "bg-purple-100 text-purple-800 border-purple-200" },
  grading: { label: "鑑定中", color: "bg-violet-100 text-violet-800 border-violet-200" },
  graded: { label: "鑑定完成", color: "bg-green-100 text-green-800 border-green-200" },
  payment_pending: { label: "待付款", color: "bg-orange-100 text-orange-800 border-orange-200" },
  returned: { label: "已寄回", color: "bg-teal-100 text-teal-800 border-teal-200" },
  completed: { label: "已完成", color: "bg-gray-100 text-gray-700 border-gray-200" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-700 border-red-200" },
};

export default function GradingOrders() {
  const [, navigate] = useLocation();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: submissions, isLoading } = trpc.grading.getMySubmissions.useQuery(undefined, {
    enabled: !!me,
  });

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
        <div className="flex items-center justify-between mb-6">
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

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#06038d]" />
          </div>
        ) : !submissions || submissions.length === 0 ? (
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
        ) : (
          <div className="space-y-3">
            {submissions.map((sub: any) => {
              const statusInfo = STATUS_MAP[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-700 border-gray-200" };
              return (
                <div
                  key={sub.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-[#06038d] hover:shadow-md transition-all"
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
                        {sub.totalItems} 張卡牌
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
                  {/* Overdue warning */}
                  {sub.status === "graded" && sub.paymentDeadline && (
                    <div className="mt-2 bg-orange-50 rounded-lg px-3 py-2 text-xs text-orange-700 font-semibold">
                      ⚠️ 請於 {new Date(sub.paymentDeadline).toLocaleDateString("zh-HK")} 前完成付款
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
