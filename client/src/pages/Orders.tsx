import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";
import { OrderStatusStepper } from "@/components/OrderStatusStepper";
import {
  Package, ArrowLeft, CheckCircle, Truck, Clock, XCircle, AlertCircle,
  ChevronDown, ChevronUp, MapPin, Phone, User, CreditCard, Loader2,
  Star, MessageSquare, Flag, Tag, Camera, ImageIcon, RotateCcw
} from "lucide-react";

const ORDER_STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="w-3.5 h-3.5" /> },
  paid_held: { label: "已付款，等待出貨", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="w-3.5 h-3.5" /> },
  payment_received: { label: "已收款", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <CreditCard className="w-3.5 h-3.5" /> },
  processing: { label: "已付款，等待出貨", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="w-3.5 h-3.5" /> },
  shipped: { label: "已出貨", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Truck className="w-3.5 h-3.5" /> },
  delivered: { label: "已送達", color: "bg-teal-100 text-teal-800 border-teal-200", icon: <Truck className="w-3.5 h-3.5" /> },
  completed: { label: "已完成", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600 border-gray-200", icon: <XCircle className="w-3.5 h-3.5" /> },
  disputed: { label: "爭議中", color: "bg-red-100 text-red-800 border-red-200", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

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

function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS_LABEL[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

function OfferPaymentButton({ offerId, amount }: { offerId: number; amount: string }) {
  const [open, setOpen] = useState(false);
  const [alipayStep, setAlipayStep] = useState(false);
  const createOfferCheckout = trpc.marketplace.createOfferCheckout.useMutation({
    onSuccess: (data) => {
      if (data.paymentMethod === "stripe") {
        setOpen(false);
        window.location.href = (data as any).checkoutUrl;
      } else {
        // Alipay HK: show QR code step
        setAlipayStep(true);
      }
    },
    onError: (e: any) => toast.error(e.message || "無法建立付款"),
  });

  return (
    <>
      <Button
        size="sm"
        className="text-white font-bold"
        style={{ backgroundColor: "#06038d" }}
        onClick={() => { setOpen(true); setAlipayStep(false); }}
      >
        <CreditCard className="w-4 h-4 mr-1.5" />
        立即付款
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAlipayStep(false); }}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: "#06038d" }}>
              選擇付款方式
            </DialogTitle>
          </DialogHeader>

          {!alipayStep ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-500">付款金額：<span className="font-bold text-gray-900">HKD {parseFloat(amount).toFixed(2)}</span></p>

              {/* Stripe */}
              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#06038d] hover:bg-[#f0f4ff] transition-all text-left group"
                disabled={createOfferCheckout.isPending}
                onClick={() => createOfferCheckout.mutate({ offerId, paymentMethod: "stripe" })}
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#635bff" }}>
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-[#06038d]">Stripe 信用卡</p>
                  <p className="text-xs text-gray-500">Visa / Mastercard / 其他信用卡</p>
                </div>
                {createOfferCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <span className="text-gray-300 group-hover:text-[#06038d] text-lg">›</span>}
              </button>

              {/* Alipay HK */}
              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#1677ff] hover:bg-[#f0f7ff] transition-all text-left group"
                disabled={createOfferCheckout.isPending}
                onClick={() => createOfferCheckout.mutate({ offerId, paymentMethod: "alipay_hk" })}
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#1677ff" }}>
                  <span className="text-white font-bold text-lg">支</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-[#1677ff]">支付寶 HK</p>
                  <p className="text-xs text-gray-500">AlipayHK 電子錢包付款</p>
                </div>
                {createOfferCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <span className="text-gray-300 group-hover:text-[#1677ff] text-lg">›</span>}
              </button>

              <p className="text-xs text-gray-400 text-center pt-1">所有付款均通過加密傳輸保護</p>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#e6f4ff" }}>
                <span className="text-3xl">📲</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">支付寶 HK 付款頁面已開啟</p>
                <p className="text-sm text-gray-500 mt-1">請在新視窗完成付款，然後回到此頁面上傳付款截圖</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                <p className="text-xs text-amber-700 font-medium">⚠️ 付款後需要</p>
                <p className="text-xs text-amber-600 mt-0.5">前往訂單詳情頁上傳支付寶付款截圖，以便管理員確認收款</p>
              </div>
              <Button className="w-full text-white font-bold" style={{ backgroundColor: "#06038d" }} onClick={() => setOpen(false)}>
                我已完成付款
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BuyerCancelButton({ orderId, onSuccess }: { orderId: number; onSuccess: () => void }) {
  const [showDialog, setShowDialog] = useState(false);
  const cancelMutation = trpc.marketplace.buyerCancelOrder.useMutation({
    onSuccess: () => {
      toast.success("訂單已取消");
      setShowDialog(false);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full h-9 text-xs font-semibold border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
        onClick={() => setShowDialog(true)}
      >
        <XCircle className="w-3.5 h-3.5 mr-1" />取消訂單
      </Button>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">確認取消訂單</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">確定要取消此訂單？取消後商品將重新上架。</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>返回</Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({ orderId })}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              確認取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrderCard({ order, highlight }: { order: any; highlight?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showStepper, setShowStepper] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-expand and scroll into view when highlighted after payment success
  useEffect(() => {
    if (highlight) {
      setExpanded(true);
      // Small delay to let the DOM settle before scrolling
      const timer = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [highlight]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>([]);
  const [disputeEvidenceMimeTypes, setDisputeEvidenceMimeTypes] = useState<string[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const utils = trpc.useUtils();

  const confirmReceiptMutation = trpc.marketplace.confirmReceipt.useMutation({
    onSuccess: () => {
      toast.success("✅ 已確認收貨，款項將轉帳給賣家");
      setShowConfirmDialog(false);
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadDisputeEvidenceMutation = trpc.marketplace.uploadDisputeEvidence.useMutation();

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>, orderId: number) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (disputeEvidenceUrls.length + files.length > 3) {
      toast.error("最多可上傳 3 個檔案");
      return;
    }
    setIsUploadingEvidence(true);
    try {
      const newUrls: string[] = [];
      const newMimeTypes: string[] = [];
      for (const file of files) {
        const isVideo = file.type.startsWith("video/");
        const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error(isVideo ? "影片不能超過 30MB" : "圖片不能超過 5MB");
          continue;
        }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadDisputeEvidenceMutation.mutateAsync({
          orderId,
          fileBase64: base64,
          mimeType: file.type,
        });
        newUrls.push(result.url);
        newMimeTypes.push(result.mimeType ?? file.type);
      }
      setDisputeEvidenceUrls(prev => [...prev, ...newUrls]);
      setDisputeEvidenceMimeTypes(prev => [...prev, ...newMimeTypes]);
      toast.success(`已上傳 ${newUrls.length} 個檔案`);
    } catch {
      toast.error("上傳失敗，請重試");
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = "";
    }
  };

  const openDisputeMutation = trpc.marketplace.openDispute.useMutation({
    onSuccess: () => {
      toast.success("⚠️ 爭議申請已提交，管理員將盡快處理");
      setShowDisputeDialog(false);
      setDisputeReason("");
      setDisputeEvidenceUrls([]);
      setDisputeEvidenceMimeTypes([]);
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
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: existingReview } = trpc.marketplace.getOrderReview.useQuery(
    { orderId: order.id },
    { enabled: order.orderStatus === "completed" && order.sellerType === "seller" }
  );

  const shippingAddr = (() => {
    if (!order.shippingAddress) return null;
    try { return JSON.parse(order.shippingAddress); } catch { return null; }
  })();

  const canConfirm = order.orderStatus === "shipped" || order.orderStatus === "delivered";
  // NOTE: paid_held is NOT in backend allowedStatuses for openDispute, so removed here to match backend
  const canDispute = ["shipped", "delivered", "payment_received", "processing"].includes(order.orderStatus);
  const isCompleted = order.orderStatus === "completed";
  const isPending = order.orderStatus === "pending_payment";
  const isDisputed = order.orderStatus === "disputed";
  const isWaitingShipment = ["paid_held", "payment_received", "processing"].includes(order.orderStatus);
  const canReview = isCompleted && order.sellerType === "seller" && !existingReview;

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-2xl overflow-hidden transition-all duration-700 ${
        highlight
          ? "border-2 border-[#FEDD00] shadow-[0_0_0_4px_rgba(254,221,0,0.25)]"
          : "border border-gray-100 shadow-sm hover:shadow-md"
      }`}
    >
      {/* ── Brand Header Bar ── */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/60 font-mono tracking-wider uppercase">訂單</span>
          <span className="text-xs text-white font-bold font-mono tracking-wide">#{order.orderNo}</span>
          {order.shippingMethod === 'meetup' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-900">
              🤝 面交
            </span>
          )}
        </div>
        <OrderStatusBadge status={order.orderStatus} />
      </div>

      {/* ── Product Info Row ── */}
      <div className="p-4">
        <div className="flex items-start gap-3.5">
          {/* Thumbnail */}
          {(() => {
            const imgs = (() => { try { return JSON.parse(order.listingImages ?? '[]'); } catch { return []; } })();
            const thumb = imgs[0];
            return thumb ? (
              <div className="flex-shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden border border-gray-100 bg-gray-50 shadow-sm">
                <img src={thumb} alt={order.listingTitle ?? '商品'} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-[72px] h-[72px] rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center shadow-sm">
                <span className="text-3xl">🃏</span>
              </div>
            );
          })()}
          {/* Product Details */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 line-clamp-2 leading-snug">{order.listingTitle ?? "商品"}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-base font-extrabold" style={{ color: "#06038d" }}>HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span>
              {order.paymentMethod && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full capitalize">
                  {order.paymentMethod === 'stripe' ? '信用卡' : order.paymentMethod === 'alipay_hk' ? '支付寶HK' : order.paymentMethod}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {new Date(order.createdAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          {/* View Detail Button */}
          <Link href={`/orders/${order.orderNo}`} className="flex-shrink-0">
            <Button variant="outline" size="sm" className="text-[11px] h-8 px-2.5 text-[#06038D] border-[#06038D]/30 hover:bg-[#06038D]/5 hover:border-[#06038D]/60 rounded-lg">
              詳情
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Order Progress Stepper (Collapsible) ── */}
      <div className="px-4 pb-3">
        <button
          className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-[#f0f4ff] border border-[#06038d]/10 hover:bg-[#e8edff] hover:border-[#06038d]/20 transition-all group"
          onClick={() => setShowStepper(s => !s)}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              order.orderStatus === 'completed' ? 'bg-green-500' :
              order.orderStatus === 'cancelled' ? 'bg-gray-400' :
              order.orderStatus === 'refunded' ? 'bg-teal-500' :
              order.orderStatus === 'disputed' ? 'bg-orange-500' :
              'bg-[#06038d] animate-pulse'
            }`} />
            <span className="text-xs font-semibold text-[#06038d]">
              {ORDER_STATUS_LABEL[order.orderStatus]?.label ?? order.orderStatus}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#06038d]/50 group-hover:text-[#06038d] transition-colors font-medium">
            <span>{showStepper ? '收起進度' : '查看進度'}</span>
            {showStepper ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>
        {showStepper && (
          <div className="mt-3 pt-3 border-t border-[#06038d]/10">
            <OrderStatusStepper
              orderStatus={order.orderStatus}
              shippingMethod={order.shippingMethod}
              role="buyer"
              timestamps={{
                createdAt: order.createdAt,
                paidAt: order.paidAt ?? null,
                shippedAt: order.shippedAt,
                deliveredAt: order.autoCompleteAt ?? null,
                completedAt: order.buyerConfirmedAt ?? null,
                meetupCompletedAt: order.buyerConfirmedAt ?? null,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Status Info Banners ── */}
      <div className="px-4 space-y-2 pb-2">
        {/* Dispute info */}
        {isDisputed && order.disputeReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
            <div className="font-semibold mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />爭議原因</div>
            <div className="text-red-700">{order.disputeReason}</div>
            {order.disputeResolution && (
              <div className="mt-2 pt-2 border-t border-red-200">
                <div className="font-semibold mb-0.5 text-green-700">處理結果：</div>
                <div className="text-green-700">{order.disputeResolution}</div>
              </div>
            )}
          </div>
        )}
        {/* Tracking info */}
        {(order.orderStatus === "shipped" || order.orderStatus === "delivered" || isCompleted) && order.trackingNumber && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-indigo-800">
              <Truck className="w-3.5 h-3.5 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">{order.shippingMethod ?? "快遞"}</span>
                <span className="mx-1.5 text-indigo-300">|</span>
                追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span>
              </div>
            </div>
          </div>
        )}
        {/* Auto-complete notice */}
        {order.orderStatus === "shipped" && order.autoCompleteAt && (
          <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3 flex-shrink-0" />
            如未確認收貨，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單
          </div>
        )}
        {/* Alipay proof status */}
        {order.paymentMethod === "alipay_hk" && order.alipayProofStatus === "pending_review" && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />截圖審核中，請耐心等待管理員確認
          </div>
        )}
        {order.paymentMethod === "alipay_hk" && order.alipayProofStatus === "approved" && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />截圖已核准，付款確認完成
          </div>
        )}
        {order.paymentMethod === "alipay_hk" && order.alipayProofStatus === "rejected" && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />截圖審核未通過，請重新上傳</div>
            {order.paymentRejectionReason && (
              <div className="text-red-600 pl-5">原因：{order.paymentRejectionReason}</div>
            )}
          </div>
        )}
        {order.paymentMethod === "alipay_hk" && !order.alipayProofStatus && order.orderStatus === "pending_payment" && !order.alipayProofImageUrl && (
          <Link href={`/orders/${order.orderNo}`}>
            <div className="text-xs text-[#06038d] bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-1.5 cursor-pointer hover:bg-blue-100 transition-colors">
              <ImageIcon className="w-3.5 h-3.5" />尚未上傳付款截圖，點此前往上傳
            </div>
          </Link>
        )}
        {isWaitingShipment && (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />付款成功，等待賣家出貨中
          </div>
        )}
        {isDisputed && !order.disputeReason && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />爭議處理中，請等待管理員回覆
          </div>
        )}
      </div>

      {/* ── Primary Action Buttons ── */}
      {(canConfirm || canDispute || isPending || canReview) && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex items-stretch gap-2">
            {canConfirm && (
              <Button
                size="sm"
                className="flex-1 h-10 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm"
                onClick={() => setShowConfirmDialog(true)}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />確認收貨
              </Button>
            )}
            {canDispute && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-10 text-xs font-semibold border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                onClick={() => setShowDisputeDialog(true)}
              >
                <Flag className="w-3.5 h-3.5 mr-1.5" />申請爭議
              </Button>
            )}
            {canReview && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-10 text-xs font-bold border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-xl"
                onClick={() => setShowReviewDialog(true)}
              >
                <Star className="w-3.5 h-3.5 mr-1.5" />評價賣家
              </Button>
            )}
            {isCompleted && existingReview && (
              <span className="flex-1 text-xs text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 h-10 flex items-center justify-center gap-1.5 font-medium">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                已評價 {existingReview.rating} 星
              </span>
            )}
            {isPending && (
              <>
                <Link href={`/orders/${order.orderNo}`} className="flex-1">
                  <Button size="sm" className="w-full h-10 text-xs font-bold text-white rounded-xl shadow-sm" style={{ backgroundColor: "#06038d" }}>
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />前往付款
                  </Button>
                </Link>
                <div className="flex-shrink-0"><BuyerCancelButton orderId={order.id} onSuccess={() => utils.marketplace.getMyOrders.invalidate()} /></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Expand / Collapse Details ── */}
      <button
        className="w-full px-4 py-2.5 border-t border-gray-100 text-[11px] text-gray-400 hover:text-[#06038d] hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 font-medium"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <><ChevronUp className="w-3.5 h-3.5" />收起收貨 / 付款資料</> : <><ChevronDown className="w-3.5 h-3.5" />展開收貨 / 付款資料</>}
      </button>

      {/* ── Expanded Details ── */}
      {expanded && (
        <div className="border-t border-gray-100 bg-[#f8f9fc] p-4 space-y-4">
          {shippingAddr && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#06038d" }}>收貨資料</p>
              <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">{shippingAddr.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>{shippingAddr.phone}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{shippingAddr.address}{shippingAddr.district ? `，${shippingAddr.district}` : ""}{shippingAddr.region ? `，${shippingAddr.region}` : ""}</span>
                </div>
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#06038d" }}>付款摘要</p>
            <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">商品金額</span>
                <span className="text-gray-800 font-medium">HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-800">總計</span>
                <span className="text-base font-extrabold" style={{ color: "#06038d" }}>HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span>
              </div>
            </div>
          </div>
          {order.listingId && (
            <Link href={`/marketplace/${order.listingId}`}>
              <Button variant="outline" size="sm" className="w-full text-xs border-[#06038d]/30 text-[#06038d] hover:bg-[#06038d] hover:text-white rounded-xl h-9">
                查看商品頁面
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Confirm Receipt Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>確認收貨</DialogTitle>
          </DialogHeader>
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

      {/* Open Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={(open) => { setShowDisputeDialog(open); if (!open) { setDisputeReason(""); setDisputeEvidenceUrls([]); } }}>
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
            {/* Evidence Upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium">證據檔案（選填，最多 3 個）</p>
              <div className="flex gap-2 flex-wrap">
                {disputeEvidenceUrls.map((url, i) => {
                  const isVideo = (disputeEvidenceMimeTypes[i] ?? "").startsWith("video/");
                  return (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-black">
                      {isVideo
                        ? <video src={url} className="w-full h-full object-cover" muted playsInline />
                        : <img src={url} alt={`證據 ${i + 1}`} className="w-full h-full object-cover" />}
                      {isVideo && <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-xs px-1 rounded">影片</span>}
                      <button
                        type="button"
                        onClick={() => {
                          setDisputeEvidenceUrls(prev => prev.filter((_, idx) => idx !== i));
                          setDisputeEvidenceMimeTypes(prev => prev.filter((_, idx) => idx !== i));
                        }}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/80"
                      >×</button>
                    </div>
                  );
                })}
                {disputeEvidenceUrls.length < 3 && (
                  <label className={`w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors ${isUploadingEvidence ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploadingEvidence
                      ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      : <>
                          <span className="text-2xl text-muted-foreground">+</span>
                          <span className="text-xs text-muted-foreground mt-0.5">上傳</span>
                        </>}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleEvidenceUpload(e, order.id)}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">支援圖片（JPG/PNG/WebP，最大5MB）或影片（MP4/WebM，最大30MB）</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDisputeDialog(false); setDisputeReason(""); setDisputeEvidenceUrls([]); setDisputeEvidenceMimeTypes([]); }}>取消</Button>
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

function MyOffersTab({ userId }: { userId: number }) {
  const utils = trpc.useUtils();
  const { data: offers, isLoading } = trpc.marketplace.getMyOffers.useQuery();
  const cancelOfferMutation = trpc.marketplace.cancelOffer.useMutation({
    onSuccess: () => { toast.success("出價已取消"); utils.marketplace.getMyOffers.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const offerStatusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: "待回覆", color: "bg-yellow-100 text-yellow-800" },
    accepted: { label: "已接受", color: "bg-green-100 text-green-800" },
    rejected: { label: "已拒絕", color: "bg-red-100 text-red-800" },
    expired: { label: "已過期", color: "bg-gray-100 text-gray-600" },
    cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600" },
  };
  if (isLoading) return <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>;
  if (!offers || offers.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}>
          <Tag className="w-8 h-8" style={{ color: "#06038d", opacity: 0.3 }} />
        </div>
        <p className="font-medium text-gray-500">暫無出價記錄</p>
        <Link href="/marketplace"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">前往商城出價</Button></Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {offers.map((offer: any) => (
        <div key={offer.id} className="rounded-2xl shadow-md overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "linear-gradient(90deg, #06038d 0%, #0a06b5 100%)" }}>
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">出價 #{offer.id}</span>
            </div>
            <Badge className={`text-xs ${offerStatusLabel[offer.status]?.color ?? "bg-gray-100"}`}>
              {offerStatusLabel[offer.status]?.label ?? offer.status}
            </Badge>
          </div>
          <div className="bg-white p-4 flex items-start gap-3">
            {/* Listing thumbnail */}
            {(() => {
              const imgs = (() => { try { return JSON.parse(offer.listingImages ?? '[]'); } catch { return []; } })();
              const thumb = imgs[0];
              return thumb ? (
                <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={thumb} alt={offer.listingTitle ?? '商品'} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex-shrink-0 w-14 h-14 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                  <span className="text-2xl">🃏</span>
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              {offer.listingTitle && <p className="font-semibold text-sm text-gray-900 truncate mb-0.5">{offer.listingTitle}</p>}
              <p className="font-medium text-gray-800">出價金額: <span style={{ color: "#06038d" }}>HKD {parseFloat(offer.offerPriceHkd).toFixed(2)}</span></p>
              {offer.message && <p className="text-sm text-gray-500 mt-1">留言: {offer.message}</p>}
              {offer.rejectionReason && <p className="text-sm text-red-500 mt-1">拒絕原因: {offer.rejectionReason}</p>}
              <p className="text-xs text-gray-400 mt-1">{new Date(offer.createdAt).toLocaleDateString("zh-HK")}</p>
              {offer.status === "pending" && (
                <p className="text-xs text-amber-600 mt-1">到期: {new Date(offer.expiresAt).toLocaleString("zh-HK")}</p>
              )}
              {offer.status === "accepted" && (
                <p className="text-xs text-green-600 mt-1 font-medium">✅ 賣家已接受出價，請盡快完成付款</p>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Link href={`/shop/${offer.listingId}`}>
                <Button size="sm" variant="outline" className="text-xs text-[#06038d] border-[#06038d]/40 hover:bg-[#06038d]/5">查看商品</Button>
              </Link>
              {offer.status === "pending" && (
                <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-600 hover:bg-red-50"
                  disabled={cancelOfferMutation.isPending}
                  onClick={() => cancelOfferMutation.mutate({ offerId: offer.id })}>
                  取消出價
                </Button>
              )}
              {offer.status === "accepted" && offer.orderId && (
                <OfferPaymentButton offerId={offer.id} amount={offer.offerPriceHkd} />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Orders() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const paymentSuccess = searchParams.get("payment") === "success";
  const highlightOrderNo = searchParams.get("orderNo") ?? "";

  // P3: BatchOrderGroup component - shows a collapsible group of related orders
  function BatchOrderGroup({ group, highlightOrderNo }: { group: { key: string; isBatch: boolean; orders: any[] }; highlightOrderNo: string }) {
    const { orders: groupOrders, isBatch } = group;
    const [expanded, setExpanded] = useState(groupOrders.some(o => o.orderNo === highlightOrderNo));
    if (!isBatch || groupOrders.length === 1) {
      return <OrderCard order={groupOrders[0]} highlight={!!highlightOrderNo && groupOrders[0].orderNo === highlightOrderNo} />;
    }
    const totalHkd = groupOrders.reduce((sum, o) => sum + parseFloat(o.subtotalHkd ?? "0"), 0);
    const statusCounts = groupOrders.reduce((acc: Record<string, number>, o) => {
      acc[o.orderStatus] = (acc[o.orderStatus] ?? 0) + 1;
      return acc;
    }, {});
    const dominantStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pending_payment";
    return (
      <div className="rounded-2xl border-2 overflow-hidden shadow-sm" style={{ borderColor: "#06038d" }}>
        {/* Master header */}
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-blue-50"
          style={{ background: "#f0f4ff" }}
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#06038d" }}>
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#06038d" }}>批量訂單 · {groupOrders.length} 件商品</p>
              <p className="text-xs text-gray-500">總計 HKD {totalHkd.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={dominantStatus} />
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </button>
        {/* Sub-orders */}
        {expanded && (
          <div className="divide-y divide-gray-100">
            {groupOrders.map((o, idx) => (
              <div key={o.id} className="px-2 py-2 bg-white">
                <div className="flex items-center gap-2 mb-1 px-2">
                  <span className="text-xs font-bold text-gray-400">子訂單 {idx + 1}</span>
                  <span className="text-xs text-gray-400">#{o.orderNo}</span>
                </div>
                <OrderCard order={o} highlight={!!highlightOrderNo && o.orderNo === highlightOrderNo} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const { data: me, isLoading: authLoading } = trpc.auth.me.useQuery();
  const { data: orders, isLoading } = trpc.marketplace.getMyOrders.useQuery(undefined, {
    enabled: !!me,
  });
  const user = me;

  // Show payment success toast once
  useEffect(() => {
    if (paymentSuccess && highlightOrderNo) {
      toast.success(`🎉 付款成功！訂單 #${highlightOrderNo} 已確認，請等待賣家出貨。`, {
        duration: 6000,
      });
    }
  }, [paymentSuccess, highlightOrderNo]);
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Skeleton Hero */}
        <div className="h-40" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }} />
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}>
            <Package className="w-10 h-10" style={{ color: "#06038d", opacity: 0.4 }} />
          </div>
          <p className="font-medium text-gray-700">請先登入查看訂單</p>
          <Link href="/login"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">登入</Button></Link>
        </div>
      </div>
    );
  }

  // P3: Group orders by cartOrderId (or batchRef for legacy) for Master+Sub display
  const groupOrders = (orderList: any[]) => {
    const groups: Map<string, { key: string; isBatch: boolean; orders: any[] }> = new Map();
    for (const o of orderList) {
      const groupKey = o.cartOrderId
        ? `cart-${o.cartOrderId}`
        : o.batchRef
        ? `batch-${o.batchRef}`
        : `single-${o.id}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          isBatch: !!(o.cartOrderId || o.batchRef),
          orders: [],
        });
      }
      groups.get(groupKey)!.orders.push(o);
    }
    return Array.from(groups.values());
  };

  const activeOrders = (orders ?? []).filter(o => !["completed", "cancelled"].includes(o.orderStatus));
  const pastOrders = (orders ?? []).filter(o => ["completed", "cancelled"].includes(o.orderStatus));
  const activeGroups = groupOrders(activeOrders);
  const pastGroups = groupOrders(pastOrders);

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
              <Package className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <div className="text-center md:text-left pb-1 flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-white">我的訂單</h1>
              <p className="text-white/70 text-sm mt-1">共 {orders?.length ?? 0} 筆訂單（{activeGroups.length + pastGroups.length} 組）</p>
            </div>
            <Link href="/marketplace">
              <Button size="sm" className="font-bold" style={{ background: "#FEDD00", color: "#06038d" }}>
                <ArrowLeft className="w-4 h-4 mr-1" />返回商城
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6">
        <BrandTabs defaultValue="orders" variant="light">
          <BrandTabsList className="mb-4">
            <BrandTabsTrigger value="orders" icon={<Package className="w-4 h-4" />} label="我的訂單">
              我的訂單
              {orders && orders.length > 0 && <span className="ml-1 bg-[#06038d] text-white text-xs rounded-full px-1.5 py-0.5">{orders.length}</span>}
            </BrandTabsTrigger>
            <BrandTabsTrigger value="offers" icon={<Tag className="w-4 h-4" />} label="我的出價">我的出價</BrandTabsTrigger>
          </BrandTabsList>
          <BrandTabsContent value="orders">
            {(!orders || orders.length === 0) ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}>
                  <Package className="w-8 h-8" style={{ color: "#06038d", opacity: 0.3 }} />
                </div>
                <p className="font-medium text-gray-500">暫無訂單記錄</p>
                <Link href="/marketplace">
                  <Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">前往商城購物</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-8">
                {activeOrders.length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-3 pb-2 border-b-2" style={{ color: "#06038d", borderColor: "#FEDD00" }}>
                      <CreditCard className="w-4 h-4" />進行中的訂單（{activeOrders.length}）
                    </h2>
                    <div className="space-y-3">
                      {activeGroups.map(group => <BatchOrderGroup key={group.key} group={group} highlightOrderNo={highlightOrderNo} />)}
                    </div>
                  </section>
                )}
                {pastOrders.length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-3 pb-2 border-b-2" style={{ color: "#06038d", borderColor: "#FEDD00" }}>
                      <CheckCircle className="w-4 h-4" />歷史訂單（{pastOrders.length}）
                    </h2>
                    <div className="space-y-3">
                      {pastGroups.map(group => <BatchOrderGroup key={group.key} group={group} highlightOrderNo={highlightOrderNo} />)}
                    </div>
                  </section>
                )}
              </div>
            )}
          </BrandTabsContent>
          <BrandTabsContent value="offers">
            <MyOffersTab userId={user.id} />
          </BrandTabsContent>
        </BrandTabs>
      </div>
    </div>
  );
}
