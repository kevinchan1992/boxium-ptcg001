import { useState } from "react";
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
      {TIMELINE_STEPS.map((step, idx) => {
        const stepStatusIdx = STATUS_ORDER.indexOf(step.key);
        const isDone = currentIdx > stepStatusIdx;
        const isCurrent = currentIdx === stepStatusIdx;
        const isPending = currentIdx < stepStatusIdx;

        // Get timestamp for this step
        let timestamp: Date | null = null;
        if (step.key === "pending_payment") timestamp = order.createdAt ? new Date(order.createdAt) : null;
        else if (step.key === "payment_received" && (order.paymentStatus === "paid" || isDone || isCurrent)) {
          // Use updatedAt as approximation
          timestamp = order.updatedAt ? new Date(order.updatedAt) : null;
        }
        else if (step.key === "shipped" && order.shippedAt) timestamp = new Date(order.shippedAt);
        else if (step.key === "completed" && order.buyerConfirmedAt) timestamp = new Date(order.buyerConfirmedAt);

        return (
          <div key={step.key} className="flex gap-4 pb-6 last:pb-0">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                isDone
                  ? "bg-green-500 border-green-500 text-white"
                  : isCurrent
                  ? "bg-[#06038d] border-[#06038d] text-white shadow-lg shadow-blue-200"
                  : "bg-white border-gray-200 text-gray-300"
              }`}>
                {isDone ? <CheckCircle className="w-4 h-4" /> : step.icon}
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 mt-1 min-h-[20px] ${isDone ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 pt-1.5 pb-2">
              <div className="flex items-center justify-between gap-2">
                <p className={`font-medium text-sm ${isPending ? "text-muted-foreground" : "text-foreground"}`}>
                  {step.label}
                </p>
                {timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {timestamp.toLocaleDateString("zh-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {/* Extra info for shipped step */}
              {step.key === "shipped" && isCurrent && order.trackingNumber && (
                <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
                  <span className="font-medium">{order.shippingMethod ?? "快遞"}</span>
                  <span className="mx-1">·</span>
                  追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span>
                </div>
              )}
              {/* Auto-complete notice */}
              {step.key === "completed" && isPending && order.orderStatus === "shipped" && order.autoCompleteAt && (
                <p className="text-xs text-muted-foreground mt-1">
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
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.marketplace.getOrderByNo.useQuery(
    { orderNo },
    { enabled: !!orderNo }
  );

  const confirmReceiptMutation = trpc.marketplace.confirmReceipt.useMutation({
    onSuccess: () => {
      toast.success("✅ 已確認收貨，款項將轉帳給賣家");
      setShowConfirmDialog(false);
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openDisputeMutation = trpc.marketplace.openDispute.useMutation({
    onSuccess: () => {
      toast.success("⚠️ 爭議申請已提交，管理員將盡快處理");
      setShowDisputeDialog(false);
      setDisputeReason("");
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Package className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="font-medium">訂單不存在或無權查看</p>
          <Link href="/orders"><Button variant="outline">返回訂單列表</Button></Link>
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
  const canDispute = isBuyer && ["shipped", "delivered", "payment_received", "processing"].includes(order.orderStatus);
  const isCompleted = order.orderStatus === "completed";
  const canReview = isBuyer && isCompleted && order.sellerType === "seller" && !review;

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">訂單詳情</h1>
            <button
              className="text-xs text-muted-foreground font-mono flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => { navigator.clipboard.writeText(order.orderNo); toast.success("訂單號已複製"); }}
            >
              #{order.orderNo}
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusInfo.color}`}>
                {statusInfo.icon}
              </div>
              <div className="min-w-0">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{statusInfo.desc}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-[#06038d] text-base sm:text-lg">HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</p>
              <p className="text-xs text-muted-foreground capitalize">{order.paymentMethod?.replace("_", " ")}</p>
            </div>
          </div>

          {/* Action Buttons */}
          {(canConfirm || canDispute || canReview) && (
            <div className="px-4 pb-4 flex flex-wrap gap-2 border-t pt-3">
              {canConfirm && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowConfirmDialog(true)}>
                  <CheckCircle className="w-4 h-4 mr-1.5" />確認收貨
                </Button>
              )}
              {canDispute && (
                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDisputeDialog(true)}>
                  <Flag className="w-4 h-4 mr-1.5" />申請爭議
                </Button>
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
                {review.comment && <span className="ml-1 text-muted-foreground">· {review.comment}</span>}
              </span>
            </div>
          )}
        </div>

        {/* Order Timeline */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#06038d]" />訂單進度
          </h2>
          <OrderTimeline order={order} />
        </div>

        {/* Shipping Tracking */}
        {order.trackingNumber && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-indigo-900 text-sm">物流資訊</p>
                <p className="text-sm text-indigo-700 mt-1">
                  <span className="font-medium">{order.shippingMethod ?? "快遞"}</span>
                  <span className="mx-2">·</span>
                  追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span>
                  <button
                    className="ml-2 text-indigo-500 hover:text-indigo-700"
                    onClick={() => { navigator.clipboard.writeText(order.trackingNumber!); toast.success("追蹤號已複製"); }}
                  >
                    <Copy className="w-3.5 h-3.5 inline" />
                  </button>
                </p>
                {order.shippedAt && (
                  <p className="text-xs text-indigo-600 mt-1">
                    出貨時間：{new Date(order.shippedAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {order.autoCompleteAt && order.orderStatus === "shipped" && (
                  <p className="text-xs text-indigo-500 mt-1">
                    如未確認收貨，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Product Info */}
        {listing && (
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">商品資訊</h2>
            <div className="flex items-start gap-3">
              {listing.images && (() => {
                const imgs = typeof listing.images === "string" ? (() => { try { return JSON.parse(listing.images as string); } catch { return null; } })() : listing.images;
                return imgs?.[0] ? (
                  <img src={imgs[0]} alt={listing.title} className="w-16 h-20 object-contain rounded-lg border bg-muted flex-shrink-0" />
                ) : null;
              })()}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{listing.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{listing.condition}</p>
                <p className="text-sm font-bold text-[#06038d] mt-1">HKD {parseFloat(listing.priceHkd as string).toFixed(2)}</p>
              </div>
              <Link href={`/marketplace/${listing.id}`}>
                <Button variant="outline" size="sm" className="text-xs flex-shrink-0">
                  <ExternalLink className="w-3 h-3 mr-1" />查看
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Shipping Address */}
        {shippingAddr && (
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">收貨資料</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>{shippingAddr.name}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>{shippingAddr.phone}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
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
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">付款摘要</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">商品金額</span>
              <span>HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">付款方式</span>
              <span className="capitalize">{order.paymentMethod === "alipay_hk" ? "支付寶 HK" : "Stripe 信用卡"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">付款狀態</span>
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
        <div className="text-xs text-muted-foreground space-y-1 px-1">
          <p>訂單建立：{new Date(order.createdAt).toLocaleString("zh-HK")}</p>
          <p>最後更新：{new Date(order.updatedAt).toLocaleString("zh-HK")}</p>
        </div>
      </div>

      {/* Confirm Receipt Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
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
      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent className="max-w-sm">
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
            <div className="text-xs text-muted-foreground text-right">{disputeReason.length}/1000</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDisputeDialog(false)}>取消</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={openDisputeMutation.isPending || disputeReason.trim().length < 10}
              onClick={() => openDisputeMutation.mutate({ orderId: order.id, reason: disputeReason.trim() })}
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
        <DialogContent className="max-w-sm">
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
