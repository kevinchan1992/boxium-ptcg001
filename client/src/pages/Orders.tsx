import { useState, useEffect, useRef, useCallback } from "react";
import { parseApiError } from "@/lib/parseApiError";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";
import { OrderStatusStepper } from "@/components/OrderStatusStepper";
import {
  Package, ArrowLeft, CheckCircle, Truck, Clock, XCircle, AlertCircle,
  ChevronDown, ChevronUp, MapPin, Phone, User, CreditCard, Loader2,
  Star, Flag, Tag, Camera, ImageIcon, RotateCcw, ShoppingCart, Search,
  Eye, ChevronRight
} from "lucide-react";
import { useTranslation } from "react-i18next";

const ORDER_STATUS_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  paid_held:       { label: "已付款", color: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  payment_received:{ label: "已收款", color: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  processing:      { label: "處理中", color: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  shipped:         { label: "已出貨", color: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
  delivered:       { label: "已送達", color: "bg-teal-100 text-teal-800 border-teal-200", dot: "bg-teal-500" },
  completed:       { label: "已完成", color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  cancelled:       { label: "已取消", color: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" },
  disputed:        { label: "爭議中", color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
};

function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS_LABEL[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button"
          onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)} className="focus:outline-none">
          <Star className={`w-7 h-7 transition-colors ${star <= (hovered || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function OfferPaymentButton({ offerId, amount }: { offerId: number; amount: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [alipayStep, setAlipayStep] = useState(false);
  const createOfferCheckout = trpc.marketplace.createOfferCheckout.useMutation({
    onSuccess: (data) => {
      if (data.paymentMethod === "stripe") { setOpen(false); window.location.href = (data as any).checkoutUrl; }
      else { setAlipayStep(true); }
    },
    onError: (e: any) => toast.error(e.message || "無法建立付款"),
  });
  return (
    <>
      <Button size="sm" className="text-white font-bold h-7 text-xs px-2.5" style={{ backgroundColor: "#06038d" }}
        onClick={() => { setOpen(true); setAlipayStep(false); }}>
        <CreditCard className="w-3.5 h-3.5 mr-1" />付款
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAlipayStep(false); }}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader><DialogTitle className="text-lg font-bold" style={{ color: "#06038d" }}>選擇付款方式</DialogTitle></DialogHeader>
          {!alipayStep ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-500">{t("orders.payment.amount")}<span className="font-bold text-gray-900">HKD {parseFloat(amount).toFixed(2)}</span></p>
              <button className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#06038d] hover:bg-[#f0f4ff] transition-all text-left group"
                disabled={createOfferCheckout.isPending} onClick={() => createOfferCheckout.mutate({ offerId, paymentMethod: "stripe" })}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#635bff" }}><CreditCard className="w-6 h-6 text-white" /></div>
                <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 group-hover:text-[#06038d]">{t("orders.payment.stripeCreditCard")}</p><p className="text-xs text-gray-500">{t("orders.payment.cardTypes")}</p></div>
                {createOfferCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <span className="text-gray-300 group-hover:text-[#06038d] text-lg">›</span>}
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#1677ff] hover:bg-[#f0f7ff] transition-all text-left group"
                disabled={createOfferCheckout.isPending} onClick={() => createOfferCheckout.mutate({ offerId, paymentMethod: "alipay_hk" })}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#1677ff" }}><span className="text-white font-bold text-lg">支</span></div>
                <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 group-hover:text-[#1677ff]">{t("orders.payment.alipayHK")}</p><p className="text-xs text-gray-500">{t("orders.payment.alipayHKWallet")}</p></div>
                {createOfferCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <span className="text-gray-300 group-hover:text-[#1677ff] text-lg">›</span>}
              </button>
              <p className="text-xs text-gray-400 text-center pt-1">{t("orders.payment.encrypted")}</p>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#e6f4ff" }}><span className="text-3xl">📲</span></div>
              <div><p className="font-semibold text-gray-900">{t("orders.payment.alipayHKPageOpened")}</p><p className="text-sm text-gray-500 mt-1">{t("orders.payment.alipayHKCompletePayment")}</p></div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left"><p className="text-xs text-amber-700 font-medium">{t("orders.payment.alipayHKScreenshotRequired")}</p><p className="text-xs text-amber-600 mt-0.5">{t("orders.payment.alipayHKUploadScreenshot")}</p></div>
              <Button className="w-full text-white font-bold" style={{ backgroundColor: "#06038d" }} onClick={() => setOpen(false)}>我已完成付款</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Order Row Detail Drawer (expanded inline) ──────────────────────────────
function OrderRowDetail({ order, onClose }: { order: any; onClose: () => void }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>([]);
  const [disputeEvidenceMimeTypes, setDisputeEvidenceMimeTypes] = useState<string[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const confirmReceiptMutation = trpc.marketplace.confirmReceipt.useMutation({
    onSuccess: () => { toast.success("✅ 已確認收貨，款項將轉帳給賣家"); setShowConfirmDialog(false); utils.marketplace.getMyOrders.invalidate(); },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const uploadDisputeEvidenceMutation = trpc.marketplace.uploadDisputeEvidence.useMutation();
  const openDisputeMutation = trpc.marketplace.openDispute.useMutation({
    onSuccess: () => { toast.success("⚠️ 爭議申請已提交"); setShowDisputeDialog(false); setDisputeReason(""); setDisputeEvidenceUrls([]); utils.marketplace.getMyOrders.invalidate(); },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const submitReviewMutation = trpc.marketplace.submitReview.useMutation({
    onSuccess: () => { toast.success("⭐ 評價已提交！"); setShowReviewDialog(false); setReviewComment(""); setReviewRating(5); utils.marketplace.getMyOrders.invalidate(); },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const cancelMutation = trpc.marketplace.buyerCancelOrder.useMutation({
    onSuccess: () => { toast.success(t("orders.action.orderCancelled")); utils.marketplace.getMyOrders.invalidate(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const { data: existingReview } = trpc.marketplace.getOrderReview.useQuery(
    { orderId: order.id }, { enabled: order.orderStatus === "completed" && order.sellerType === "seller" }
  );

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (disputeEvidenceUrls.length + files.length > 3) { toast.error("最多可上傳 3 個檔案"); return; }
    setIsUploadingEvidence(true);
    try {
      const newUrls: string[] = []; const newMimeTypes: string[] = [];
      for (const file of files) {
        const isVideo = file.type.startsWith("video/");
        const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) { toast.error(isVideo ? "影片不能超過 30MB" : "圖片不能超過 5MB"); continue; }
        const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        const result = await uploadDisputeEvidenceMutation.mutateAsync({ orderId: order.id, fileBase64: base64, mimeType: file.type });
        newUrls.push(result.url); newMimeTypes.push(result.mimeType ?? file.type);
      }
      setDisputeEvidenceUrls(prev => [...prev, ...newUrls]); setDisputeEvidenceMimeTypes(prev => [...prev, ...newMimeTypes]);
      toast.success(`已上傳 ${newUrls.length} 個檔案`);
    } catch { toast.error("上傳失敗，請重試"); } finally { setIsUploadingEvidence(false); e.target.value = ""; }
  };

  const shippingAddr = (() => { if (!order.shippingAddress) return null; try { return JSON.parse(order.shippingAddress); } catch { return null; } })();
  const canConfirm = ["shipped", "delivered"].includes(order.orderStatus);
  const canDispute = ["shipped", "delivered", "payment_received", "processing"].includes(order.orderStatus);
  const isCompleted = order.orderStatus === "completed";
  const isPending = order.orderStatus === "pending_payment";
  const isDisputed = order.orderStatus === "disputed";
  const isWaitingShipment = ["paid_held", "payment_received", "processing"].includes(order.orderStatus);
  const canReview = isCompleted && order.sellerType === "seller" && !existingReview;

  const imgs = (() => { try { return JSON.parse(order.listingImages ?? '[]'); } catch { return []; } })();
  const thumb = imgs[0];

  return (
    <div className="bg-[#f8f9fc] border-t border-[#06038d]/10 p-4 space-y-4">
      {/* Product + Shipping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Product */}
        <div className="bg-white rounded-xl border border-gray-100 p-3 flex gap-3">
          {thumb ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0"><img src={thumb} alt={order.listingTitle} className="w-full h-full object-cover" /></div>
          ) : (
            <div className="w-16 h-16 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0"><span className="text-2xl">🃏</span></div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 line-clamp-2">{order.listingTitle ?? "商品"}</p>
            <p className="text-xs text-gray-400 mt-1">{new Date(order.createdAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}</p>
            {order.paymentMethod && (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full capitalize mt-1 inline-block">
                {order.paymentMethod === 'stripe' ? '信用卡' : order.paymentMethod === 'alipay_hk' ? '支付寶HK' : order.paymentMethod}
              </span>
            )}
          </div>
        </div>
        {/* Shipping */}
        {shippingAddr && (
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#06038d" }}>收件資料</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-gray-700"><User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /><span className="font-medium">{shippingAddr.name}</span></div>
              <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /><span>{shippingAddr.phone}</span></div>
              <div className="flex items-start gap-2 text-sm text-gray-700"><MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" /><span>{shippingAddr.address}{shippingAddr.district ? `，${shippingAddr.district}` : ""}{shippingAddr.region ? `，${shippingAddr.region}` : ""}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Order Progress */}
      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#06038d" }}>訂單進度</p>
        <OrderStatusStepper orderStatus={order.orderStatus} shippingMethod={order.shippingMethod} role="buyer"
          timestamps={{ createdAt: order.createdAt, paidAt: order.paidAt ?? null, shippedAt: order.shippedAt, deliveredAt: order.autoCompleteAt ?? null, completedAt: order.buyerConfirmedAt ?? null }} />
      </div>

      {/* Status Banners */}
      <div className="space-y-2">
        {isDisputed && order.disputeReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
            <div className="font-semibold mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />爭議原因</div>
            <div className="text-red-700">{order.disputeReason}</div>
            {order.disputeResolution && <div className="mt-2 pt-2 border-t border-red-200"><div className="font-semibold mb-0.5 text-green-700">處理結果：</div><div className="text-green-700">{order.disputeResolution}</div></div>}
          </div>
        )}
        {(order.orderStatus === "shipped" || order.orderStatus === "delivered" || isCompleted) && order.trackingNumber && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2 text-indigo-800">
            <Truck className="w-3.5 h-3.5 flex-shrink-0" />
            <div className="text-xs"><span className="font-semibold">{order.shippingMethod === 'sf_express' ? '🚚 順豐速運' : order.shippingMethod === 'hk_post' ? '📮 香港郵政（平郵）' : order.shippingMethod ?? '快遞'}</span><span className="mx-1.5 text-indigo-300">|</span>追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span></div>
          </div>
        )}
        {order.orderStatus === "shipped" && order.autoCompleteAt && (
          <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3 flex-shrink-0" />如未確認收貨，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單
          </div>
        )}
        {order.paymentMethod === "alipay_hk" && order.alipayProofStatus === "pending_review" && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" />截圖審核中，請耐心等待管理員確認</div>
        )}
        {order.paymentMethod === "alipay_hk" && order.alipayProofStatus === "approved" && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />截圖已核准，付款確認完成</div>
        )}
        {order.paymentMethod === "alipay_hk" && order.alipayProofStatus === "rejected" && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />截圖審核未通過，請重新上傳</div>
            {order.paymentRejectionReason && <div className="text-red-600 pl-5">原因：{order.paymentRejectionReason}</div>}
          </div>
        )}
        {order.paymentMethod === "alipay_hk" && !order.alipayProofStatus && order.orderStatus === "pending_payment" && !order.alipayProofImageUrl && (
          <Link href={`/orders/${order.orderNo}`}>
            <div className="text-xs text-[#06038d] bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-1.5 cursor-pointer hover:bg-blue-100 transition-colors"><ImageIcon className="w-3.5 h-3.5" />尚未上傳付款截圖，點此前往上傳</div>
          </Link>
        )}
        {isWaitingShipment && (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />付款成功，等待賣家出貨中</div>
        )}
        {isDisputed && !order.disputeReason && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />爭議處理中，請等待管理員回覆</div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/orders/${order.orderNo}`}>
          <Button size="sm" variant="outline" className="h-8 text-xs text-[#06038d] border-[#06038d]/30 hover:bg-[#06038d]/5">
            <Eye className="w-3.5 h-3.5 mr-1" />查看詳情
          </Button>
        </Link>
        {canConfirm && (
          <Button size="sm" className="h-8 text-xs font-bold bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowConfirmDialog(true)}>
            <CheckCircle className="w-3.5 h-3.5 mr-1" />確認收貨
          </Button>
        )}
        {canDispute && (
          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDisputeDialog(true)}>
            <Flag className="w-3.5 h-3.5 mr-1" />申請爭議
          </Button>
        )}
        {canReview && (
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100" onClick={() => setShowReviewDialog(true)}>
            <Star className="w-3.5 h-3.5 mr-1" />評價賣家
          </Button>
        )}
        {isCompleted && existingReview && (
          <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 h-8 flex items-center gap-1.5 font-medium">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />已評價 {existingReview.rating} 星
          </span>
        )}
        {isPending && (
          <>
            <Link href="/cart">
              <Button size="sm" className="h-8 text-xs font-bold text-white" style={{ backgroundColor: "#06038d" }}>
                <ShoppingCart className="w-3.5 h-3.5 mr-1" />前往購物車付款
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="h-8 text-xs font-semibold border-red-300 text-red-600 hover:bg-red-50"
              disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate({ orderId: order.id })}>
              {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}取消訂單
            </Button>
          </>
        )}
        {order.listingId && (
          <Link href={`/marketplace/${order.listingId}`}>
            <Button size="sm" variant="outline" className="h-8 text-xs text-gray-600 border-gray-200 hover:bg-gray-50">查看商品</Button>
          </Link>
        )}
      </div>

      {/* Confirm Receipt Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("orders.action.confirmReceipt")}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">{t("orders.dialog.confirmReceipt.description")}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800"><AlertCircle className="w-3.5 h-3.5 inline mr-1" />請確認商品狀態與描述相符後再確認收貨。如有問題，請先申請爭議。</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>{t("orders.action.cancel")}</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={confirmReceiptMutation.isPending}
              onClick={() => confirmReceiptMutation.mutate({ orderId: order.id })}>
              {confirmReceiptMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("orders.dialog.confirmReceipt.processing")}</> : <><CheckCircle className="w-4 h-4 mr-2" />{t("orders.action.confirmReceipt")}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={(open) => { setShowDisputeDialog(open); if (!open) { setDisputeReason(""); setDisputeEvidenceUrls([]); } }}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Flag className="w-5 h-5 text-red-500" />申請爭議</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">{t("orders.dialog.fileDispute.description")}</p>
            <Textarea placeholder={t("orders.dialog.fileDispute.placeholder")} value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={4} className="text-sm" />
            <div className="flex items-center justify-between">
              {disputeReason.trim().length < 10 && disputeReason.length > 0 ? <p className="text-xs text-red-500">還需輸入 {10 - disputeReason.trim().length} 個字</p> : disputeReason.trim().length >= 10 ? <p className="text-xs text-green-600">{t("orders.dialog.fileDispute.charCount.ok")}</p> : <p className="text-xs text-muted-foreground">{t("orders.dialog.fileDispute.charCount.min")}</p>}
              <span className="text-xs text-muted-foreground">{disputeReason.length}/1000</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("orders.dialog.fileDispute.evidence")}</p>
              <div className="flex gap-2 flex-wrap">
                {disputeEvidenceUrls.map((url, i) => {
                  const isVideo = (disputeEvidenceMimeTypes[i] ?? "").startsWith("video/");
                  return (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-black">
                      {isVideo ? <video src={url} className="w-full h-full object-cover" muted playsInline /> : <img src={url} alt={`證據 ${i + 1}`} className="w-full h-full object-cover" />}
                      {isVideo && <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-xs px-1 rounded">{t("orders.dialog.fileDispute.evidence.videoLabel")}</span>}
                      <button type="button" onClick={() => { setDisputeEvidenceUrls(prev => prev.filter((_, idx) => idx !== i)); setDisputeEvidenceMimeTypes(prev => prev.filter((_, idx) => idx !== i)); }} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/80">×</button>
                    </div>
                  );
                })}
                {disputeEvidenceUrls.length < 3 && (
                  <label className={`w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors ${isUploadingEvidence ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploadingEvidence ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <><span className="text-2xl text-muted-foreground">+</span><span className="text-xs text-muted-foreground mt-0.5">上傳</span></>}
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleEvidenceUpload} />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">支援圖片（JPG/PNG/WebP，最大5MB）或影片（MP4/WebM，最大30MB）</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDisputeDialog(false); setDisputeReason(""); setDisputeEvidenceUrls([]); setDisputeEvidenceMimeTypes([]); }}>{t("orders.action.cancel")}</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={openDisputeMutation.isPending || disputeReason.trim().length < 10 || isUploadingEvidence}
              onClick={() => openDisputeMutation.mutate({ orderId: order.id, reason: disputeReason, evidenceUrls: disputeEvidenceUrls })}>
              {openDisputeMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中</> : <><Flag className="w-4 h-4 mr-2" />提交爭議</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" />評價賣家</DialogTitle></DialogHeader>
          <div className="py-2 space-y-4">
            <div className="flex flex-col items-center gap-2"><p className="text-sm text-muted-foreground">請為此次交易評分</p><StarRating value={reviewRating} onChange={setReviewRating} /></div>
            <Textarea placeholder="分享你的購物體驗（選填）" value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} className="text-sm" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>{t("orders.action.cancel")}</Button>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" disabled={submitReviewMutation.isPending}
              onClick={() => submitReviewMutation.mutate({ orderId: order.id, rating: reviewRating, comment: reviewComment || undefined })}>
              {submitReviewMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中</> : <><Star className="w-4 h-4 mr-2" />提交評價</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Compact Order Table Row ────────────────────────────────────────────────
function OrderTableRow({ order, highlight }: { order: any; highlight?: boolean }) {
  const [expanded, setExpanded] = useState(!!highlight);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight) {
      setExpanded(true);
      const timer = setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
      return () => clearTimeout(timer);
    }
  }, [highlight]);

  const imgs = (() => { try { return JSON.parse(order.listingImages ?? '[]'); } catch { return []; } })();
  const thumb = imgs[0];

  return (
    <div ref={rowRef} className={`border-b border-gray-100 last:border-0 ${highlight ? "border-l-4 border-l-[#FEDD00]" : ""}`}>
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#f8f9ff] ${expanded ? "bg-[#f0f4ff]" : ""} ${highlight ? "bg-yellow-50" : ""}`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0">
          {thumb ? <img src={thumb} alt={order.listingTitle} className="w-full h-full object-cover" /> : <span className="text-lg">🃏</span>}
        </div>
        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{order.listingTitle ?? "商品"}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-gray-400 font-mono">{order.orderNo}</span>
            {/* Mobile: amount + date inline */}
            <span className="text-xs font-bold sm:hidden" style={{ color: '#06038d' }}>HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span>
            <span className="text-[11px] text-gray-400 sm:hidden">{new Date(order.createdAt).toLocaleDateString("zh-HK")}</span>
          </div>
        </div>
        {/* Desktop: amount */}
        <span className="text-sm font-bold whitespace-nowrap hidden sm:inline" style={{ color: "#06038d" }}>HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span>
        {/* Status */}
        <div className="flex-shrink-0"><StatusBadge status={order.orderStatus} /></div>
        {/* Desktop: date */}
        <span className="text-xs text-gray-400 whitespace-nowrap hidden md:inline">{new Date(order.createdAt).toLocaleDateString("zh-HK")}</span>
        {/* Desktop: payment */}
        <span className="text-xs text-gray-500 hidden lg:inline">
          {order.paymentMethod === 'stripe' ? '信用卡' : order.paymentMethod === 'alipay_hk' ? '支付寶HK' : order.paymentMethod ?? '—'}
        </span>
        {/* Expand chevron */}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100">
          <OrderRowDetail order={order} onClose={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
}

// ── Batch Order Group (table-based) ───────────────────────────────────────
function BatchOrderGroup({ group, highlightOrderNo }: { group: { key: string; isBatch: boolean; orders: any[] }; highlightOrderNo: string }) {
  const { orders: groupOrders, isBatch } = group;
  const [expanded, setExpanded] = useState(groupOrders.some(o => o.orderNo === highlightOrderNo));

  if (!isBatch || groupOrders.length === 1) {
    return <OrderTableRow order={groupOrders[0]} highlight={!!highlightOrderNo && groupOrders[0].orderNo === highlightOrderNo} />;
  }

  const totalHkd = groupOrders.reduce((sum, o) => sum + parseFloat(o.subtotalHkd ?? "0"), 0);
  const statusCounts = groupOrders.reduce((acc: Record<string, number>, o) => { acc[o.orderStatus] = (acc[o.orderStatus] ?? 0) + 1; return acc; }, {});
  const dominantStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pending_payment";

  return (
    <div className="border-b border-[#06038d]/20 last:border-0">
      {/* Batch group header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-[#f0f4ff] hover:bg-[#e8edff] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#06038d" }}>
          <Package className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "#06038d" }}>批量訂單 · {groupOrders.length} 件商品</p>
          <p className="text-[11px] text-gray-500">總計 HKD {totalHkd.toFixed(2)}</p>
        </div>
        <StatusBadge status={dominantStatus} />
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {/* Expanded individual orders */}
      {expanded && (
        <div className="border-t border-[#06038d]/10">
          {groupOrders.map(o => (
            <OrderTableRow key={o.id} order={o} highlight={!!highlightOrderNo && o.orderNo === highlightOrderNo} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── My Offers Tab ──────────────────────────────────────────────────────────
function MyOffersTab({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data: offers, isLoading } = trpc.marketplace.getMyOffers.useQuery(undefined as any);
  const cancelOfferMutation = trpc.marketplace.cancelOffer.useMutation({
    onSuccess: () => toast.success("出價已取消"),
    onError: (e) => toast.error(parseApiError(e)),
  });
  const offerStatusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: "待回覆", color: "bg-yellow-100 text-yellow-800" },
    accepted: { label: "已接受", color: "bg-green-100 text-green-800" },
    rejected: { label: "已拒絕", color: "bg-red-100 text-red-800" },
    expired: { label: "已過期", color: "bg-gray-100 text-gray-600" },
    cancelled: { label: t("orders.status.cancelled"), color: "bg-gray-100 text-gray-600" },
  };
  if (isLoading) return <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>;
  if (!offers || offers.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}><Tag className="w-8 h-8" style={{ color: "#06038d", opacity: 0.3 }} /></div>
        <p className="font-medium text-gray-500">暫無出價記錄</p>
        <Link href="/marketplace"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">前往商城出價</Button></Link>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Desktop header */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500">
        <div className="w-10 flex-shrink-0"></div>
        <span className="flex-1">商品</span>
        <span>出價金額</span>
        <span>狀態</span>
        <span className="hidden md:inline">日期</span>
        <span>操作</span>
      </div>
      {offers.map((offer: any) => {
        const imgs = (() => { try { return JSON.parse(offer.listingImages ?? '[]'); } catch { return []; } })();
        const thumb = imgs[0];
        return (
          <div key={offer.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-[#f8f9ff] transition-colors">
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0">
              {thumb ? <img src={thumb} alt={offer.listingTitle} className="w-full h-full object-cover" /> : <span className="text-lg">🃏</span>}
            </div>
            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{offer.listingTitle ?? "商品"}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-gray-400">出價 #{offer.id}</span>
                {/* Mobile: price inline */}
                <span className="text-xs font-bold sm:hidden" style={{ color: '#06038d' }}>HKD {parseFloat(offer.offerPriceHkd).toFixed(2)}</span>
              </div>
              {offer.status === "accepted" && <p className="text-xs text-green-600 font-medium mt-0.5">✅ 賣家已接受，請盡快付款</p>}
              {offer.status === "pending" && <p className="text-xs text-amber-600 mt-0.5">到期: {new Date(offer.expiresAt).toLocaleString("zh-HK")}</p>}
            </div>
            {/* Desktop: price */}
            <span className="text-sm font-bold whitespace-nowrap hidden sm:inline" style={{ color: "#06038d" }}>HKD {parseFloat(offer.offerPriceHkd).toFixed(2)}</span>
            {/* Status */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${offerStatusLabel[offer.status]?.color ?? "bg-gray-100"}`}>{offerStatusLabel[offer.status]?.label ?? offer.status}</span>
            {/* Desktop: date */}
            <span className="text-xs text-gray-400 hidden md:inline whitespace-nowrap">{new Date(offer.createdAt).toLocaleDateString("zh-HK")}</span>
            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link href={`/shop/${offer.listingId}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs text-[#06038d] border-[#06038d]/40 hover:bg-[#06038d]/5 px-2">查看</Button>
              </Link>
              {offer.status === "pending" && (
                <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 px-2"
                  disabled={cancelOfferMutation.isPending} onClick={() => cancelOfferMutation.mutate({ offerId: offer.id })}>取消</Button>
              )}
              {offer.status === "accepted" && offer.orderId && (
                <Link href="/cart"><Button size="sm" className="h-7 text-xs text-white font-bold px-2" style={{ backgroundColor: "#06038d" }}><ShoppingCart className="w-3 h-3 mr-1" />付款</Button></Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Orders Page ───────────────────────────────────────────────────────
export default function Orders() {
  const { t } = useTranslation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const paymentSuccess = searchParams.get("payment") === "success";
  const highlightOrderNo = searchParams.get("orderNo") ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: me, isLoading: authLoading } = trpc.auth.me.useQuery();
  const { data: orders, isLoading } = trpc.marketplace.getMyOrders.useQuery(undefined, { enabled: !!me });
  const user = me;

  useEffect(() => {
    if (paymentSuccess && highlightOrderNo) {
      toast.success(`🎉 付款成功！訂單 #${highlightOrderNo} 已確認，請等待賣家出貨。`, { duration: 6000 });
    }
  }, [paymentSuccess, highlightOrderNo]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-40" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }} />
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}><Package className="w-10 h-10" style={{ color: "#06038d", opacity: 0.4 }} /></div>
          <p className="font-medium text-gray-700">請先登入查看訂單</p>
          <Link href="/login"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">登入</Button></Link>
        </div>
      </div>
    );
  }

  // Group orders by cartOrderId / batchRef
  const groupOrders = (orderList: any[]) => {
    const groups: Map<string, { key: string; isBatch: boolean; orders: any[] }> = new Map();
    for (const o of orderList) {
      const groupKey = o.cartOrderId ? `cart-${o.cartOrderId}` : o.batchRef ? `batch-${o.batchRef}` : `single-${o.id}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, isBatch: !!(o.cartOrderId || o.batchRef), orders: [] });
      groups.get(groupKey)!.orders.push(o);
    }
    return Array.from(groups.values());
  };

  // Status filter tabs
  const statusTabs = [
    { key: "all", label: "全部" },
    { key: "pending_payment", label: "待付款" },
    { key: "active", label: "進行中" },
    { key: "completed", label: "已完成" },
    { key: "cancelled", label: "已取消" },
  ];

  const filteredOrders = (orders ?? []).filter((o: any) => {
    const matchSearch = !searchQuery || o.orderNo?.toLowerCase().includes(searchQuery.toLowerCase()) || (o.listingTitle ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" ? true
      : statusFilter === "active" ? !["completed", "cancelled", "pending_payment"].includes(o.orderStatus)
      : o.orderStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredGroups = groupOrders(filteredOrders);
  const totalCount = (orders ?? []).length;
  const countByStatus = (key: string) => {
    if (key === "all") return totalCount;
    if (key === "active") return (orders ?? []).filter((o: any) => !["completed", "cancelled", "pending_payment"].includes(o.orderStatus)).length;
    return (orders ?? []).filter((o: any) => o.orderStatus === key).length;
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <div className="relative" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-8">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0" style={{ background: "#FEDD00", borderColor: "white" }}>
              <Package className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <div className="text-center md:text-left pb-1 flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{t("orders.myOrders")}</h1>
              <p className="text-white/70 text-sm mt-1">共 {totalCount} 筆訂單</p>
            </div>
            <Link href="/marketplace">
              <Button size="sm" className="font-bold" style={{ background: "#FEDD00", color: "#06038d" }}>
                <ArrowLeft className="w-4 h-4 mr-1" />返回商城
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
        <BrandTabs defaultValue="orders" variant="light">
          <BrandTabsList className="mb-4">
            <BrandTabsTrigger value="orders" icon={<Package className="w-4 h-4" />} label={t("orders.myOrders")}>
              我的訂單
              {totalCount > 0 && <span className="ml-1 bg-[#06038d] text-white text-xs rounded-full px-1.5 py-0.5">{totalCount}</span>}
            </BrandTabsTrigger>
            <BrandTabsTrigger value="offers" icon={<Tag className="w-4 h-4" />} label="我的出價">我的出價</BrandTabsTrigger>
          </BrandTabsList>

          <BrandTabsContent value="orders">
            {(!orders || orders.length === 0) ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}><Package className="w-8 h-8" style={{ color: "#06038d", opacity: 0.3 }} /></div>
                <p className="font-medium text-gray-500">暫無訂單記錄</p>
                <Link href="/marketplace"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">前往商城購物</Button></Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜尋訂單號或商品名稱..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-white border-gray-200 text-sm"
                  />
                </div>

                {/* Status filter tabs */}
                <div className="flex gap-2 flex-wrap">
                  {statusTabs.map(tab => {
                    const count = countByStatus(tab.key);
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border ${
                          statusFilter === tab.key
                            ? "text-white border-transparent shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:border-[#06038d]/40 hover:text-[#06038d]"
                        }`}
                        style={statusFilter === tab.key ? { backgroundColor: "#06038d", borderColor: "#06038d" } : {}}
                      >
                        {tab.label}
                        {count > 0 && <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${statusFilter === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Table */}
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">沒有符合條件的訂單</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Header row - desktop only */}
                    <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500">
                      <div className="w-10 flex-shrink-0"></div>
                      <span className="flex-1">商品 / 訂單號</span>
                      <span className="hidden sm:inline">金額</span>
                      <span>狀態</span>
                      <span className="hidden md:inline">日期</span>
                      <span className="hidden lg:inline">付款方式</span>
                      <div className="w-4"></div>
                    </div>
                    {filteredGroups.map(group => (
                      <BatchOrderGroup key={group.key} group={group} highlightOrderNo={highlightOrderNo} />
                    ))}
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                      共 {filteredOrders.length} 筆訂單
                    </div>
                  </div>
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
