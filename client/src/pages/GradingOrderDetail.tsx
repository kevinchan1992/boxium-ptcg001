import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Printer,
  Package,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  AlertCircle,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_STEPS = [
  { key: "pending_payment", label: "申請提交" },
  { key: "received", label: "BOXIUM 收件" },
  { key: "submitted_to_psa", label: "已出團" },
  { key: "grading", label: "鑑定中" },
  { key: "graded", label: "鑑定完成" },
  { key: "completed", label: "已完成" },
];

const STATUS_ORDER = [
  "pending_payment", "paid", "received", "submitted_to_psa", "grading", "graded", "payment_pending", "returned", "completed"
];

function getStepIndex(status: string) {
  const map: Record<string, number> = {
    pending_payment: 0,
    paid: 0,
    received: 1,
    submitted_to_psa: 2,
    grading: 3,
    graded: 4,
    payment_pending: 4,
    returned: 5,
    completed: 5,
  };
  return map[status] ?? 0;
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "等待收件",
  paid: "等待收件",
  received: "已收件",
  submitted_to_psa: "已出團",
  grading: "鑑定中",
  graded: "鑑定完成",
  payment_pending: "待付款",
  returned: "已寄回",
  completed: "已完成",
  cancelled: "已取消",
};

// ─── Printable Slip ───────────────────────────────────────────────────────────
function PrintableSlip({ submission }: { submission: any }) {
  return (
    <div className="hidden print:block p-8 font-sans text-black bg-white">
      {/* Header */}
      <div className="border-2 border-black p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">BOXIUM × PSA 代客鑑定申請單</h1>
            <p className="text-sm mt-1">請將此申請單打印後連同卡牌一起寄出</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold font-mono">{submission.orderNo}</p>
            <p className="text-sm">
              {new Date(submission.createdAt).toLocaleDateString("zh-HK", {
                year: "numeric", month: "long", day: "numeric"
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      <div className="border border-black p-4 mb-4">
        <h2 className="font-bold text-base mb-2">📦 送件地址</h2>
        <p className="font-bold">順豐站 852Z351</p>
        <p>香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>
        <p className="text-sm mt-2 font-semibold text-red-600">
          ⚠️ 請確保此申請單與卡牌一同寄出，否則無法處理您的申請
        </p>
      </div>

      {/* Card list */}
      <div className="border border-black p-4 mb-4">
        <h2 className="font-bold text-base mb-3">卡牌清單（共 {submission.items.length} 張）</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1 pr-3 w-8">#</th>
              <th className="text-left py-1 pr-3">卡牌名稱</th>
              <th className="text-left py-1 pr-3">系列 / 編號</th>
              <th className="text-left py-1 pr-3">服務層級</th>
              <th className="text-left py-1 pr-3">狀況</th>
              <th className="text-right py-1">費用</th>
            </tr>
          </thead>
          <tbody>
            {submission.items.map((item: any, idx: number) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="py-2 pr-3">{idx + 1}</td>
                <td className="py-2 pr-3 font-semibold">{item.cardName}</td>
                <td className="py-2 pr-3 text-xs">
                  {[item.cardSet, item.cardNumber].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="py-2 pr-3">{item.tier?.name ?? "—"}</td>
                <td className="py-2 pr-3">{item.condition}</td>
                <td className="py-2 text-right">
                  HK${item.tier ? parseFloat(item.tier.feeHkd).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-3 font-bold text-right">代送 PSA 費用合計（鑑定後付款）</td>
              <td className="pt-3 font-bold text-right">
                HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      <div className="border border-black p-4 mb-4 text-sm">
        <h2 className="font-bold mb-2">重要事項</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>請使用有追蹤號碼的寄件方式，並自行購買保險。</li>
          <li>卡片請妥善包裝，建議使用硬卡套及泡泡紙保護。</li>
          <li>鑑定完成後，系統將通知您付款，請於 <strong>30 天內</strong> 完成付款。</li>
          <li>逾期未付款，平台保留對相關卡片自行處理之權利。</li>
          <li>如有查詢，請透過平台訊息聯絡 BOXIUM。</li>
        </ol>
      </div>

      {/* Signature */}
      <div className="flex gap-8 mt-6">
        <div className="flex-1 border-t border-black pt-2">
          <p className="text-sm">客人簽署：</p>
        </div>
        <div className="flex-1 border-t border-black pt-2">
          <p className="text-sm">日期：</p>
        </div>
        <div className="flex-1 border-t border-black pt-2">
          <p className="text-sm">BOXIUM 收件確認：</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GradingOrderDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "alipay_hk">("stripe");
  const [payingLoading, setPayingLoading] = useState(false);

  const submissionId = parseInt(params.id ?? "0", 10);
  const { data: submission, isLoading } = trpc.grading.getSubmissionDetail.useQuery(
    { id: submissionId },
    { enabled: submissionId > 0 }
  );

  const createPaymentMutation = trpc.grading.createPaymentIntent.useMutation({
    onSuccess: (data: any) => {
      setPayingLoading(false);
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success("正在跳轉至付款頁面...");
      }
    },
    onError: (err: any) => {
      setPayingLoading(false);
      toast.error(`付款失敗：${err.message}`);
    },
  });

  const handlePay = () => {
    setPayingLoading(true);
    createPaymentMutation.mutate({
      submissionId,
      paymentMethod,
      origin: window.location.origin,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#06038d]" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">找不到申請</h2>
          <Button variant="outline" onClick={() => navigate("/grading/orders")}>
            返回我的申請
          </Button>
        </div>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(submission.status);
  const isCancelled = submission.status === "cancelled";
  const isGraded = submission.status === "graded" || submission.status === "payment_pending";
  const isCompleted = submission.status === "completed" || submission.status === "returned";

  return (
    <>
      {/* Printable slip (hidden on screen) */}
      <PrintableSlip submission={submission} />

      {/* Screen view */}
      <div className="min-h-screen bg-gray-50 py-8 px-4 print:hidden">
        <div className="max-w-2xl mx-auto">
          {/* Back + Print */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate("/grading/orders")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">返回我的申請</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="border-[#06038d] text-[#06038d] hover:bg-blue-50"
            >
              <Printer className="h-4 w-4 mr-2" />
              打印申請單
            </Button>
          </div>

          {/* Order header */}
          <div className="bg-[#06038d] text-white rounded-xl p-5 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-200 text-xs mb-1">申請單號</p>
                <p className="font-bold text-lg font-mono">{submission.orderNo}</p>
                <p className="text-blue-200 text-xs mt-1">
                  {new Date(submission.createdAt).toLocaleDateString("zh-HK", {
                    year: "numeric", month: "long", day: "numeric"
                  })}
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                isCancelled ? "bg-red-500" : isCompleted ? "bg-green-500" : "bg-yellow-400 text-[#06038d]"
              }`}>
                {STATUS_LABEL[submission.status] ?? submission.status}
              </span>
            </div>
          </div>

          {/* Progress stepper */}
          {!isCancelled && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">申請進度</h3>
              <div className="flex items-start">
                {STATUS_STEPS.map((step, idx) => {
                  const done = currentStepIdx > idx;
                  const active = currentStepIdx === idx;
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center">
                      <div className="flex items-center w-full">
                        <div className={`flex-1 h-0.5 ${idx === 0 ? "invisible" : done || active ? "bg-[#06038d]" : "bg-gray-200"}`} />
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          done ? "bg-green-500" : active ? "bg-[#06038d] ring-4 ring-blue-100" : "bg-gray-200"
                        }`}>
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          ) : active ? (
                            <Clock className="h-3.5 w-3.5 text-white" />
                          ) : (
                            <span className="text-xs text-gray-400">{idx + 1}</span>
                          )}
                        </div>
                        <div className={`flex-1 h-0.5 ${idx === STATUS_STEPS.length - 1 ? "invisible" : done ? "bg-[#06038d]" : "bg-gray-200"}`} />
                      </div>
                      <p className={`text-xs mt-1.5 text-center leading-tight ${active ? "text-[#06038d] font-bold" : done ? "text-green-600" : "text-gray-400"}`}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shipping notice (before received) */}
          {(submission.status === "pending_payment" || submission.status === "paid") && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex gap-3">
                <MapPin className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800 mb-1">請將卡牌寄至以下地址</p>
                  <p className="text-sm text-amber-700 font-semibold">📦 順豐站 852Z351</p>
                  <p className="text-sm text-amber-700">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ 請打印申請單連同卡牌一起寄出，否則無法處理您的申請
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100 h-8 text-xs"
                    onClick={() => window.print()}
                  >
                    <Printer className="h-3 w-3 mr-1.5" />
                    打印申請單
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Batch info */}
          {submission.batch && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-purple-800 text-sm mb-1">出團批次資訊</p>
              <div className="text-xs text-purple-700 space-y-0.5">
                <p>批次：{submission.batch.name}</p>
                {submission.batch.shippedAt && (
                  <p>出團日期：{new Date(submission.batch.shippedAt).toLocaleDateString("zh-HK")}</p>
                )}
                {submission.batch.estimatedReturnAt && (
                  <p>預計回件：{new Date(submission.batch.estimatedReturnAt).toLocaleDateString("zh-HK")}</p>
                )}
              </div>
            </div>
          )}

          {/* Grading results + payment */}
          {isGraded && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-bold text-green-800">鑑定完成！請完成付款</p>
              </div>
              {/* PSA results per item */}
              <div className="space-y-2 mb-4">
                {submission.items.filter((i: any) => i.psaGrade).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
                    <span className="text-sm font-semibold text-gray-800">{item.cardName}</span>
                    <div className="flex items-center gap-2">
                      {item.psaGrade && (
                        <span className="bg-[#06038d] text-white text-xs font-bold px-2 py-0.5 rounded">
                          PSA {item.psaGrade}
                        </span>
                      )}
                      {item.psaCertNo && (
                        <a
                          href={`https://www.psacard.com/cert/${item.psaCertNo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#06038d] hover:underline flex items-center gap-0.5"
                        >
                          #{item.psaCertNo}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment deadline */}
              {submission.paymentDeadline && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-4 text-sm text-orange-700">
                  ⚠️ 請於 <strong>{new Date(submission.paymentDeadline).toLocaleDateString("zh-HK")}</strong> 前完成付款，逾期平台保留對卡片自行處理之權利。
                </div>
              )}

              {/* Payment method */}
              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">選擇付款方式</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["stripe", "alipay_hk"] as const).map((method) => (
                    <label
                      key={method}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === method ? "border-[#06038d] bg-blue-50" : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        className="accent-[#06038d]"
                      />
                      <span className="text-sm font-semibold">
                        {method === "stripe" ? "💳 信用卡" : "📱 支付寶 HK"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-green-200">
                <div>
                  <p className="text-sm text-gray-600">應付金額</p>
                  <p className="text-2xl font-bold text-[#06038d]">
                    HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
                  </p>
                </div>
                <Button
                  onClick={handlePay}
                  disabled={payingLoading}
                  className="bg-[#06038d] hover:bg-[#06038d]/90 text-white px-6"
                >
                  {payingLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />處理中...</>
                  ) : (
                    <><CreditCard className="h-4 w-4 mr-2" />立即付款</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Card list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#06038d]" />
              <span className="font-bold text-gray-900 text-sm">卡牌清單（{submission.items.length} 張）</span>
            </div>
            <div className="divide-y divide-gray-100">
              {submission.items.map((item: any, idx: number) => (
                <div key={item.id} className="p-4 flex items-start gap-3">
                  {item.cardImageUrl ? (
                    <img
                      src={item.cardImageUrl}
                      alt={item.cardName}
                      className="w-10 h-14 object-contain rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.cardName}</p>
                    {(item.cardSet || item.cardNumber) && (
                      <p className="text-xs text-gray-500">
                        {[item.cardSet, item.cardNumber].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{item.tier?.name ?? "—"}</Badge>
                      <span className="text-xs text-gray-400">{item.condition}</span>
                    </div>
                    {item.psaGrade && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="bg-[#06038d] text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          PSA {item.psaGrade}
                        </span>
                        {item.psaCertNo && (
                          <span className="text-xs text-gray-500">#{item.psaCertNo}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-[#06038d] text-sm flex-shrink-0">
                    HK${item.tier ? parseFloat(item.tier.feeHkd).toLocaleString() : "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-600 font-semibold">代送 PSA 費用合計</span>
              <span className="font-bold text-[#06038d] text-lg">
                HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Admin notes */}
          {submission.adminNotes && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-blue-800 text-sm mb-1">BOXIUM 備注</p>
              <p className="text-sm text-blue-700">{submission.adminNotes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
