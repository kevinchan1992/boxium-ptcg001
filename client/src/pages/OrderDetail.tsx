import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Package, CheckCircle, Truck, Clock, XCircle, AlertCircle,
  CreditCard, MapPin, Phone, User, Flag, Star, MessageSquare, Loader2,
  Copy, ExternalLink, ShieldCheck, CircleDot
} from "lucide-react";

function PayOrderButton({ orderId }: { orderId: number }) {
  const getCheckoutMutation = trpc.marketplace.getOrderCheckoutUrl.useMutation({
    onSuccess: (data) => {
      toast.success("正在轉向付款頁面...");
      window.open(data.checkoutUrl, "_blank");
    },
    onError: (e: any) => toast.error(e.message || "無法獲取付款連結"),
  });
  return (
    <Button
      className="text-white font-bold"
      style={{ backgroundColor: "#06038d" }}
      disabled={getCheckoutMutation.isPending}
      onClick={() => getCheckoutMutation.mutate({ orderId })}
    >
      {getCheckoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
      前往付款
    </Button>
  );
}

// Auto-complete countdown hook
function useAutoCompleteCountdown(autoCompleteAt: Date | string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; pct: number } | null>(null);
  useEffect(() => {
    if (!autoCompleteAt) return;
    const target = new Date(autoCompleteAt).getTime();
    const TOTAL_MS = 14 * 24 * 60 * 60 * 1000;
    const calc = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, pct: 100 }); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const elapsed = TOTAL_MS - diff;
      const pct = Math.min(100, Math.max(0, (elapsed / TOTAL_MS) * 100));
      setTimeLeft({ days, hours, minutes, pct });
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [autoCompleteAt]);
  return timeLeft;
}

// Carrier tracking URL mapping
const CARRIER_TRACKING: Record<string, { label: string; url: string | null }> = {
  sf_express: { label: "順豐速運 (SF Express)", url: "https://www.sf-express.com/hk/tc/dynamic_function/waybill/#search/bill-number/" },
  hkpost: { label: "香港郵政 (HK Post)", url: "https://www.hongkongpost.hk/en/mail_tracking/index.html?tracking_no=" },
  dhl: { label: "DHL", url: "https://www.dhl.com/hk-en/home/tracking.html?tracking-id=" },
  fedex: { label: "FedEx", url: "https://www.fedex.com/fedextrack/?trknbr=" },
  ups: { label: "UPS", url: "https://www.ups.com/track?tracknum=" },
  chunghwa_post: { label: "中華郵政", url: "https://postserv.post.gov.tw/pstmail/main_mail.jsp?targetTxn=EB100&query_type=1&searchItem=" },
  black_cat: { label: "黑貓宅急", url: "https://www.t-cat.com.tw/Inquire/Trace.aspx?no=" },
  other: { label: "其他", url: null },
};

function getCarrierLabel(shippingMethod: string | null | undefined): string {
  if (!shippingMethod) return "快遞";
  return CARRIER_TRACKING[shippingMethod]?.label ?? shippingMethod;
}

function getTrackingUrl(shippingMethod: string | null | undefined, trackingNumber: string): string | null {
  if (!shippingMethod) return null;
  const carrier = CARRIER_TRACKING[shippingMethod];
  if (!carrier?.url) return null;
  return carrier.url + encodeURIComponent(trackingNumber);
}

const ORDER_STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="w-4 h-4" />, desc: "等待買家完成付款" },
  payment_received: { label: "已收款", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <CreditCard className="w-4 h-4" />, desc: "付款已確認，等待賣家處理" },
  processing: { label: "處理中", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="w-4 h-4" />, desc: "賣家正在準備出貨" },
  shipped: { label: "已出貨", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Truck className="w-4 h-4" />, desc: "商品已寄出，請耐心等候" },
  delivered: { label: "已送達", color: "bg-teal-100 text-teal-800 border-teal-200", icon: <Truck className="w-4 h-4" />, desc: "商品已送達，請確認收貨" },
  completed: { label: "已完成", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle className="w-4 h-4" />, desc: "訂單已完成" },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600 border-gray-200", icon: <XCircle className="w-4 h-4" />, desc: "訂單已取消" },
  disputed: { label: "爭議中", color: "bg-red-100 text-red-800 border-red-200", icon: <AlertCircle className="w-4 h-4" />, desc: "爭議處理中，請等待管理員回覆" },
};

// Timeline steps in order
const TIMELINE_STEPS = [
  { key: "pending_payment", label: "訂單建立", icon: <CircleDot className="w-4 h-4" /> },
  { key: "payment_received", label: "付款確認", icon: <CreditCard className="w-4 h-4" /> },
  { key: "processing", label: "賣家處理中", icon: <Package className="w-4 h-4" /> },
  { key: "shipped", label: "已出貨", icon: <Truck className="w-4 h-4" /> },
  { key: "completed", label: "確認收貨", icon: <CheckCircle className="w-4 h-4" /> },
];

const STATUS_ORDER = ["pending_payment", "payment_received", "processing", "shipped", "delivered", "completed"];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function OrderTimeline({ order }: { order: any }) {
  const currentIdx = STATUS_ORDER.indexOf(order.orderStatus);
  const isDisputed = order.orderStatus === "disputed";
  const isCancelled = order.orderStatus === "cancelled";

  if (isCancelled) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 text-gray-500">
          <XCircle className="w-6 h-6" />
          <div>
            <p className="font-medium text-gray-700">訂單已取消</p>
            <p className="text-sm text-gray-500">此訂單已被取消</p>
          </div>
        </div>
      </div>
    );
  }

  if (isDisputed) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <div>
            <p className="font-medium">爭議處理中</p>
            <p className="text-sm text-red-500">管理員將在 1-3 個工作天內處理</p>
          </div>
        </div>
        {order.disputeReason && (
          <div className="mt-3 pt-3 border-t border-red-200">
            <p className="text-xs font-medium text-red-700 mb-1">爭議原因：</p>
            <p className="text-sm text-red-800">{order.disputeReason}</p>
          </div>
        )}
        {order.disputeResolution && (
          <div className="mt-3 pt-3 border-t border-red-200">
            <p className="text-xs font-medium text-green-700 mb-1">處理結果：</p>
            <p className="text-sm text-green-700">{order.disputeResolution}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <style>{`
        @keyframes checkmark-pop {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(6, 3, 141, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(6, 3, 141, 0); }
          100% { box-shadow: 0 0 0 0 rgba(6, 3, 141, 0); }
        }
        @keyframes line-fill {
          0% { transform: scaleY(0); transform-origin: top; }
          100% { transform: scaleY(1); transform-origin: top; }
        }
        @keyframes fade-slide-in {
          0% { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .timeline-done-icon { animation: checkmark-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .timeline-current-pulse { animation: pulse-ring 2s ease-in-out infinite; }
        .timeline-line-fill { animation: line-fill 0.5s ease-out both; }
        .timeline-step-content { animation: fade-slide-in 0.35s ease-out both; }
      `}</style>
      {TIMELINE_STEPS.map((step, idx) => {
        const stepStatusIdx = STATUS_ORDER.indexOf(step.key);
        const isDone = currentIdx > stepStatusIdx;
        const isCurrent = currentIdx === stepStatusIdx;
        const isPending = currentIdx < stepStatusIdx;

        // Get timestamp for this step
        let timestamp: Date | null = null;
        if (step.key === "pending_payment") timestamp = order.createdAt ? new Date(order.createdAt) : null;
        else if (step.key === "payment_received" && (order.paymentStatus === "paid" || isDone || isCurrent)) {
          timestamp = order.updatedAt ? new Date(order.updatedAt) : null;
        }
        else if (step.key === "shipped" && order.shippedAt) timestamp = new Date(order.shippedAt);
        else if (step.key === "completed" && order.buyerConfirmedAt) timestamp = new Date(order.buyerConfirmedAt);

        return (
          <div key={step.key} className="flex gap-4 pb-6 last:pb-0"
            style={{ animationDelay: `${idx * 0.08}s` }}>
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300 ${
                isDone
                  ? "bg-green-500 border-green-500 text-white timeline-done-icon"
                  : isCurrent
                  ? "bg-[#06038d] border-[#06038d] text-white timeline-current-pulse"
                  : "bg-white border-gray-200 text-gray-300"
              }`}
              style={isDone ? { animationDelay: `${idx * 0.1}s` } : undefined}>
                {isDone ? (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      style={{
                        strokeDasharray: 14,
                        strokeDashoffset: 0,
                        animation: `checkmark-draw 0.35s ease-out ${idx * 0.1}s both`
                      }}
                    />
                    <style>{`
                      @keyframes checkmark-draw {
                        0% { stroke-dashoffset: 14; }
                        100% { stroke-dashoffset: 0; }
                      }
                    `}</style>
                  </svg>
                ) : step.icon}
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 mt-1 min-h-[20px] transition-all duration-500 ${
                  isDone ? "bg-green-300 timeline-line-fill" : "bg-gray-200"
                }`}
                style={isDone ? { animationDelay: `${idx * 0.1 + 0.3}s` } : undefined}
                />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 pt-1.5 pb-2 timeline-step-content"
              style={{ animationDelay: `${idx * 0.08 + 0.05}s` }}>
              <div className="flex items-center justify-between gap-2">
                <p className={`font-medium text-sm transition-colors duration-300 ${isPending ? "text-gray-400" : "text-gray-900"}`}>
                  {step.label}
                  {isCurrent && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </span>
                  )}
                </p>
                {timestamp && (
                  <span className="text-xs text-gray-500">
                    {timestamp.toLocaleDateString("zh-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {/* Extra info for shipped step */}
              {step.key === "shipped" && isCurrent && order.trackingNumber && (() => {
                const trackUrl = getTrackingUrl(order.shippingMethod, order.trackingNumber);
                return (
                  <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
                    <span className="font-medium">{getCarrierLabel(order.shippingMethod)}</span>
                    <span className="mx-1">·</span>
                    追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span>
                    {trackUrl && (
                      <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 underline">
                        查詢<ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })()}
              {/* Auto-complete notice */}
              {step.key === "completed" && isPending && order.orderStatus === "shipped" && order.autoCompleteAt && (
                <p className="text-xs text-gray-500 mt-1">
                  系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  const params = useParams<{ orderNo: string }>();
  const orderNo = params.orderNo ?? "";
  const [, navigate] = useLocation();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.marketplace.getOrderByNo.useQuery(
    { orderNo },
    { enabled: !!orderNo }
  );

  const buyerCancelMutation = trpc.marketplace.buyerCancelOrder.useMutation({
    onSuccess: () => {
      toast.success("❌ 訂單已取消");
      setShowCancelDialog(false);
      setCancelReason("");
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmReceiptMutation = trpc.marketplace.confirmReceipt.useMutation({
    onSuccess: () => {
      toast.success("✅ 已確認收貨，款項將轉帳給賣家");
      setShowConfirmDialog(false);
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadDisputeEvidenceMutation = trpc.marketplace.uploadDisputeEvidence.useMutation();

  const openDisputeMutation = trpc.marketplace.openDispute.useMutation({
    onSuccess: () => {
      toast.success("⚠️ 爭議申請已提交，管理員將盡快處理");
      setShowDisputeDialog(false);
      setDisputeReason("");
      setDisputeEvidenceUrls([]);
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>, orderId: number) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (disputeEvidenceUrls.length + files.length > 3) {
      toast.error("最多可上傳 3 張截圖");
      return;
    }
    setIsUploadingEvidence(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { toast.error("圖片不能超過 5MB"); continue; }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadDisputeEvidenceMutation.mutateAsync({
          orderId,
          imageBase64: base64,
          mimeType: file.type,
        });
        newUrls.push(result.url);
      }
      setDisputeEvidenceUrls(prev => [...prev, ...newUrls]);
      toast.success(`已上傳 ${newUrls.length} 張截圖`);
    } catch {
      toast.error("上傳失敗，請重試");
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = "";
    }
  };

  const submitReviewMutation = trpc.marketplace.submitReview.useMutation({
    onSuccess: () => {
      toast.success("⭐ 評價已提交，感謝你的反饋！");
      setShowReviewDialog(false);
      setReviewComment("");
      setReviewRating(5);
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-complete countdown - MUST be called unconditionally before any conditional returns
  const autoCompleteCountdown = useAutoCompleteCountdown(
    data?.order?.orderStatus === "shipped" ? data?.order?.autoCompleteAt : null
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-40 animate-pulse" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }} />
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 space-y-4 animate-pulse">
          <div className="h-48 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}>
            <Package className="w-10 h-10" style={{ color: "#06038d", opacity: 0.4 }} />
          </div>
          <p className="font-medium text-gray-700">訂單不存在或無權查看</p>
          <Link href="/orders"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">返回訂單列表</Button></Link>
        </div>
      </div>
    );
  }

  const { order, items, listing, review, isBuyer, isSeller } = data;

  const shippingAddr = (() => {
    if (!order.shippingAddress) return null;
    try { return JSON.parse(order.shippingAddress as string); } catch { return null; }
  })();

  const statusInfo = ORDER_STATUS_LABEL[order.orderStatus] ?? { label: order.orderStatus, color: "bg-gray-100 text-gray-600 border-gray-200", icon: null, desc: "" };
  const canConfirm = isBuyer && (order.orderStatus === "shipped" || order.orderStatus === "delivered");
  // Calculate dispute window: 7 days from shipment
  const DISPUTE_WINDOW_DAYS = 7;
  const disputeDeadline = order.shippedAt ? (() => {
    const d = new Date(order.shippedAt);
    d.setDate(d.getDate() + DISPUTE_WINDOW_DAYS);
    return d;
  })() : null;
  const disputeDaysLeft = disputeDeadline ? Math.ceil((disputeDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isWithinDisputeWindow = disputeDaysLeft !== null ? disputeDaysLeft > 0 : true; // if no shippedAt, allow dispute
  const canDispute = isBuyer && ["shipped", "delivered", "payment_received", "processing"].includes(order.orderStatus) && isWithinDisputeWindow;
  const isCompleted = order.orderStatus === "completed";
  const canReview = isBuyer && isCompleted && order.sellerType === "seller" && !review;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Hero Banner ── */}
      <div
        className="relative"
        style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
        <div className="max-w-2xl mx-auto px-4 pt-10 pb-8">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0"
              style={{ background: "#FEDD00", borderColor: "white" }}
            >
              <ShieldCheck className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <div className="text-center md:text-left pb-1 flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-white">訂單詳情</h1>
              <button
                className="text-white/70 text-sm font-mono flex items-center gap-1 mt-1 hover:text-white transition-colors mx-auto md:mx-0"
                onClick={() => { navigator.clipboard.writeText(order.orderNo); toast.success("訂單號已複製"); }}
              >
                #{order.orderNo}
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <Link href="/orders">
              <Button size="sm" className="font-bold" style={{ background: "#FEDD00", color: "#06038d" }}>
                <ArrowLeft className="w-4 h-4 mr-1" />返回訂單
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 space-y-5">

        {/* Status Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusInfo.color}`}>
                {statusInfo.icon}
              </div>
              <div className="min-w-0">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <p className="text-xs text-gray-600 mt-0.5 truncate">{statusInfo.desc}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-[#06038d] text-base sm:text-lg">HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</p>
              <p className="text-xs text-gray-500 capitalize">{order.paymentMethod?.replace("_", " ")}</p>
            </div>
          </div>

          {/* Action Buttons - pending_payment: show pay button + cancel button */}
          {isBuyer && order.orderStatus === "pending_payment" && order.paymentMethod === "stripe" && (
            <div className="px-4 pb-4 flex flex-wrap gap-2 border-t pt-3">
              <PayOrderButton orderId={order.id} />
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="w-4 h-4 mr-1.5" />取消訂單
              </Button>
            </div>
          )}
          {isBuyer && order.orderStatus === "pending_payment" && order.paymentMethod === "alipay_hk" && (
            <div className="px-4 pb-4 border-t pt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />等待支付寶 HK 付款確認
              </span>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="w-4 h-4 mr-1.5" />取消訂單
              </Button>
            </div>
          )}
          {/* Action Buttons */}
          {(canConfirm || canDispute || canReview) && (
            <div className="px-4 pb-4 flex flex-wrap gap-2 border-t pt-3">
              {canConfirm && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowConfirmDialog(true)}>
                  <CheckCircle className="w-4 h-4 mr-1.5" />確認收貨
                </Button>
              )}
              {canDispute && (
                <div className="flex flex-col gap-0.5">
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDisputeDialog(true)}>
                    <Flag className="w-4 h-4 mr-1.5" />申請爭議
                  </Button>
                  {disputeDaysLeft !== null && disputeDaysLeft <= 3 && disputeDaysLeft > 0 && (
                    <p className="text-[10px] text-red-500">還有 {disputeDaysLeft} 天可申請</p>
                  )}
                </div>
              )}
              {isBuyer && ["shipped", "delivered"].includes(order.orderStatus) && !isWithinDisputeWindow && (
                <p className="text-xs text-gray-500 self-center">爬議申請期限已過（7 天）</p>
              )}
              {canReview && (
                <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => setShowReviewDialog(true)}>
                  <Star className="w-4 h-4 mr-1.5" />評價賣家
                </Button>
              )}
            </div>
          )}
          {isCompleted && review && (
            <div className="px-4 pb-4 border-t pt-3">
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                已評價 {review.rating} 星
                {review.comment && <span className="ml-1 text-gray-600">· {review.comment}</span>}
              </span>
            </div>
          )}
        </div>

        {/* Order Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "#06038d" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "#06038d" }} />訂單進度
          </h2>
          <OrderTimeline order={order} />
        </div>

        {/* Shipping Tracking */}
        {order.trackingNumber && (() => {
          const trackUrl = getTrackingUrl(order.shippingMethod, order.trackingNumber);
          return (
            <div className="rounded-xl p-4" style={{ backgroundColor: "#f0f4ff", border: "1px solid #c7d2fe" }}>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-indigo-900 text-sm">物流資訊</p>
                  <p className="text-sm text-indigo-700 mt-1">
                    <span className="font-medium">{getCarrierLabel(order.shippingMethod)}</span>
                    <span className="mx-2">·</span>
                    追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span>
                    <button
                      className="ml-2 text-indigo-500 hover:text-indigo-700"
                      onClick={() => { navigator.clipboard.writeText(order.trackingNumber!); toast.success("追蹤號已複製"); }}
                    >
                      <Copy className="w-3.5 h-3.5 inline" />
                    </button>
                  </p>
                  {trackUrl && (
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      點擊查詢追蹤狀態
                    </a>
                  )}
                  {order.shippedAt && (
                    <p className="text-xs text-indigo-600 mt-1">
                      出貨時間：{new Date(order.shippedAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {order.autoCompleteAt && order.orderStatus === "shipped" && (
                    <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-indigo-700">自動確認收貨倒計時</p>
                        {autoCompleteCountdown && (
                          <span className="text-xs font-bold text-indigo-800">
                            {autoCompleteCountdown.days > 0 && `${autoCompleteCountdown.days} 天 `}
                            {autoCompleteCountdown.hours} 小時 {autoCompleteCountdown.minutes} 分鐘
                          </span>
                        )}
                      </div>
                      {autoCompleteCountdown && (
                        <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${autoCompleteCountdown.pct}%`,
                              background: autoCompleteCountdown.pct > 80
                                ? "linear-gradient(90deg, #06038d, #e53e3e)"
                                : "linear-gradient(90deg, #06038d, #4f46e5)"
                            }}
                          />
                        </div>
                      )}
                      <p className="text-xs text-indigo-500 mt-1">
                        如未手動確認，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Product Info */}
        {listing && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-gray-900">
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: "#06038d" }}>商品資訊</h2>
            <div className="flex items-start gap-3">
              {(() => {
                const imgs = listing.images
                  ? (typeof listing.images === "string"
                    ? (() => { try { return JSON.parse(listing.images as string); } catch { return null; } })()
                    : listing.images)
                  : null;
                return imgs?.[0] ? (
                  <img src={imgs[0]} alt={listing.title} className="w-16 h-20 object-contain rounded-lg border bg-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-16 h-20 rounded-lg border border-gray-200 flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                    <span className="text-white font-black text-xs tracking-tight text-center leading-tight">BOX<br/>IUM</span>
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{listing.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{listing.condition}</p>
                <p className="text-sm font-bold text-[#06038d] mt-1">HKD {parseFloat(listing.priceHkd as string).toFixed(2)}</p>
              </div>
              <Link href={`/marketplace/${listing.id}`}>
                <Button variant="outline" size="sm" className="text-xs flex-shrink-0 text-gray-700 border-gray-300 bg-white hover:bg-gray-50">
                  <ExternalLink className="w-3 h-3 mr-1" />查看
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Shipping Address */}
        {shippingAddr && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-gray-900">
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: "#06038d" }}>收貨資料</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{shippingAddr.name}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{shippingAddr.phone}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>
                  {shippingAddr.address}
                  {shippingAddr.district ? `，${shippingAddr.district}` : ""}
                  {shippingAddr.region ? `，${shippingAddr.region}` : ""}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: "#06038d" }}>付款摘要</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">商品金額</span>
              <span className="text-gray-800">HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">付款方式</span>
              <span className="text-gray-800 capitalize">{order.paymentMethod === "alipay_hk" ? "支付寶 HK" : "Stripe 信用卡"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">付款狀態</span>
              <span className={order.paymentStatus === "paid" ? "text-green-600 font-medium" : "text-amber-600"}>
                {order.paymentStatus === "paid" ? "已付款" : order.paymentStatus === "pending" ? "待付款" : order.paymentStatus === "refunded" ? "已退款" : order.paymentStatus}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>總計</span>
              <span className="text-[#06038d]">HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Order Meta */}
        <div className="text-xs text-gray-500 space-y-1 px-1">
          <p>訂單建立：{new Date(order.createdAt).toLocaleString("zh-HK")}</p>
          <p>最後更新：{new Date(order.updatedAt).toLocaleString("zh-HK")}</p>
        </div>
      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => { setShowCancelDialog(open); if (!open) setCancelReason(""); }}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" />取消訂單</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">確認要取消此訂單？取消後訂單將無法恢復。</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              只有「待付款」狀態的訂單可以取消。付款後如需退款請申請爭議。
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">取消原因（選填）</p>
              <Textarea
                placeholder="請說明取消原因，例如：誤購、不需要等"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
                className="text-sm"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>保留訂單</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={buyerCancelMutation.isPending}
              onClick={() => buyerCancelMutation.mutate({ orderId: order.id, reason: cancelReason.trim() || undefined })}
            >
              {buyerCancelMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</>
                : <><XCircle className="w-4 h-4 mr-2" />確認取消</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Receipt Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader><DialogTitle>確認收貨</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">確認已收到商品後，款項將立即轉帳給賣家。此操作不可撤銷。</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              請確認商品狀態與描述相符後再確認收貨。如有問題，請先申請爭議。
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>取消</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={confirmReceiptMutation.isPending}
              onClick={() => confirmReceiptMutation.mutate({ orderId: order.id })}
            >
              {confirmReceiptMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</>
                : <><CheckCircle className="w-4 h-4 mr-2" />確認收貨</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={(open) => { setShowDisputeDialog(open); if (!open) { setDisputeEvidenceUrls([]); setDisputeReason(""); } }}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />申請爭議
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">請詳細描述問題，管理員將在 1-3 個工作天內處理。</p>
            <Textarea
              placeholder="請描述問題，例如：商品與描述不符、未收到商品、商品損壞等（至少 10 字）"
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              {disputeReason.trim().length < 10 && disputeReason.length > 0 ? (
                <p className="text-xs text-red-500">還需輸入 {10 - disputeReason.trim().length} 個字</p>
              ) : disputeReason.trim().length >= 10 ? (
                <p className="text-xs text-green-600">✓ 內容已符合要求</p>
              ) : (
                <p className="text-xs text-muted-foreground">至少輸入 10 個字</p>
              )}
              <span className="text-xs text-muted-foreground">{disputeReason.length}/1000</span>
            </div>
            {/* Evidence Image Upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium">證據截圖（選項，最多 3 張）</p>
              <div className="flex flex-wrap gap-2">
                {disputeEvidenceUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                    <img src={url} alt={`證據 ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setDisputeEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-700"
                    >×</button>
                  </div>
                ))}
                {disputeEvidenceUrls.length < 3 && (
                  <label className={`w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors ${isUploadingEvidence ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploadingEvidence
                      ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      : <><span className="text-2xl text-muted-foreground">+</span><span className="text-[10px] text-muted-foreground">上傳圖片</span></>}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleEvidenceUpload(e, order.id)}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">支援 JPG、PNG，單張不超過 5MB</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDisputeDialog(false)}>取消</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={openDisputeMutation.isPending || disputeReason.trim().length < 10 || isUploadingEvidence}
              onClick={() => openDisputeMutation.mutate({ orderId: order.id, reason: disputeReason.trim(), evidenceUrls: disputeEvidenceUrls.length > 0 ? disputeEvidenceUrls : undefined })}
            >
              {openDisputeMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</>
                : <><Flag className="w-4 h-4 mr-2" />提交爭議</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />評價賣家
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">評分</p>
              <StarRating value={reviewRating} onChange={setReviewRating} />
              <p className="text-xs text-muted-foreground">
                {reviewRating === 1 && "非常不滿意"}
                {reviewRating === 2 && "不滿意"}
                {reviewRating === 3 && "一般"}
                {reviewRating === 4 && "滿意"}
                {reviewRating === 5 && "非常滿意"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">評語（選填）</p>
              <Textarea
                placeholder="分享你的購物體驗..."
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                rows={3}
                className="text-sm"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground text-right">{reviewComment.length}/500</div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>取消</Button>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              disabled={submitReviewMutation.isPending || reviewRating === 0}
              onClick={() => submitReviewMutation.mutate({
                orderId: order.id,
                rating: reviewRating,
                comment: reviewComment.trim() || undefined,
              })}
            >
              {submitReviewMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</>
                : <><MessageSquare className="w-4 h-4 mr-2" />提交評價</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
