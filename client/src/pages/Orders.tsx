import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Package, ArrowLeft, CheckCircle, Truck, Clock, XCircle, AlertCircle,
  ChevronDown, ChevronUp, MapPin, Phone, User, CreditCard, Loader2,
  Star, MessageSquare, Flag
} from "lucide-react";

const ORDER_STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="w-3.5 h-3.5" /> },
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

function OrderCard({ order }: { order: any }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
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

  const openDisputeMutation = trpc.marketplace.openDispute.useMutation({
    onSuccess: () => {
      toast.success("⚠️ 爭議申請已提交，管理員將盡快處理");
      setShowDisputeDialog(false);
      setDisputeReason("");
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
  const canDispute = ["shipped", "delivered", "payment_received", "processing"].includes(order.orderStatus);
  const isCompleted = order.orderStatus === "completed";
  const isPending = order.orderStatus === "pending_payment";
  const isDisputed = order.orderStatus === "disputed";
  const canReview = isCompleted && order.sellerType === "seller" && !existingReview;

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-muted-foreground font-mono">#{order.orderNo}</span>
            <OrderStatusBadge status={order.orderStatus} />
          </div>
          <p className="font-medium text-sm truncate">{order.listingTitle ?? "商品"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="text-right flex-shrink-0 space-y-1">
          <p className="font-bold text-[#06038d]">HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</p>
          <p className="text-xs text-muted-foreground capitalize">{order.paymentMethod?.replace("_", " ")}</p>
          <Link href={`/orders/${order.orderNo}`}>
            <Button variant="outline" size="sm" className="text-xs h-7 px-2">查看詳情</Button>
          </Link>
        </div>
      </div>

      {/* Action buttons */}
      {(canConfirm || canDispute || isPending || canReview || isDisputed) && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {canConfirm && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setShowConfirmDialog(true)}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />確認收貨
            </Button>
          )}
          {canDispute && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setShowDisputeDialog(true)}
            >
              <Flag className="w-4 h-4 mr-1.5" />申請爭議
            </Button>
          )}
          {canReview && (
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              onClick={() => setShowReviewDialog(true)}
            >
              <Star className="w-4 h-4 mr-1.5" />評價賣家
            </Button>
          )}
          {isCompleted && existingReview && (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              已評價 {existingReview.rating} 星
            </span>
          )}
          {isPending && order.paymentMethod === "stripe" && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />等待付款確認
            </span>
          )}
          {isDisputed && (
            <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />爭議處理中，請等待管理員回覆
            </span>
          )}
        </div>
      )}

      {/* Dispute info banner */}
      {isDisputed && order.disputeReason && (
        <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
          <div className="font-medium mb-1">爭議原因：</div>
          <div>{order.disputeReason}</div>
          {order.disputeResolution && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <div className="font-medium mb-1 text-green-700">處理結果：</div>
              <div className="text-green-700">{order.disputeResolution}</div>
            </div>
          )}
        </div>
      )}

      {/* Shipping info (if shipped) */}
      {(order.orderStatus === "shipped" || order.orderStatus === "delivered" || isCompleted) && order.trackingNumber && (
        <div className="mx-4 mb-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-indigo-800">
            <Truck className="w-4 h-4 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-medium">{order.shippingMethod ?? "快遞"}</span>
              <span className="mx-1">·</span>
              追蹤號：<span className="font-mono font-medium">{order.trackingNumber}</span>
            </div>
          </div>
        </div>
      )}

      {/* Auto-complete notice */}
      {order.orderStatus === "shipped" && order.autoCompleteAt && (
        <div className="mx-4 mb-3 text-xs text-muted-foreground bg-gray-50 border rounded-lg px-3 py-2">
          如未確認收貨，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單
        </div>
      )}

      {/* Expand toggle */}
      <button
        className="w-full px-4 py-2.5 border-t text-xs text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <><ChevronUp className="w-3.5 h-3.5" />收起詳情</> : <><ChevronDown className="w-3.5 h-3.5" />查看詳情</>}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t p-4 space-y-3 bg-muted/20">
          {shippingAddr && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">收貨資料</p>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground" />{shippingAddr.name}</div>
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{shippingAddr.phone}</div>
                <div className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <span>{shippingAddr.address}{shippingAddr.district ? `，${shippingAddr.district}` : ""}{shippingAddr.region ? `，${shippingAddr.region}` : ""}</span>
                </div>
              </div>
            </div>
          )}
          <Separator />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">付款資料</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">商品金額</span><span>HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span></div>
              <div className="flex justify-between font-medium"><span>總計</span><span className="text-[#06038d]">HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span></div>
            </div>
          </div>
          {order.listingId && (
            <Link href={`/marketplace/listing/${order.listingId}`}>
              <Button variant="outline" size="sm" className="w-full text-xs">查看商品頁面</Button>
            </Link>
          )}
        </div>
      )}

      {/* Confirm Receipt Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
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

export default function Orders() {
  const { data: me, isLoading: authLoading } = trpc.auth.me.useQuery();
  const { data: orders, isLoading } = trpc.marketplace.getMyOrders.useQuery(undefined, {
    enabled: !!me,
  });

  const user = me;
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Package className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="font-medium">請先登入查看訂單</p>
          <Link href="/login"><Button className="bg-[#06038d] text-white">登入</Button></Link>
        </div>
      </div>
    );
  }

  const activeOrders = (orders ?? []).filter(o => !["completed", "cancelled"].includes(o.orderStatus));
  const pastOrders = (orders ?? []).filter(o => ["completed", "cancelled"].includes(o.orderStatus));

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/marketplace">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">我的訂單</h1>
            <p className="text-sm text-muted-foreground">共 {orders?.length ?? 0} 筆訂單</p>
          </div>
        </div>

        {(!orders || orders.length === 0) ? (
          <div className="text-center py-16 space-y-3">
            <Package className="w-14 h-14 mx-auto text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">暫無訂單記錄</p>
            <Link href="/marketplace">
              <Button className="bg-[#06038d] text-white">前往商城購物</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {activeOrders.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />進行中的訂單（{activeOrders.length}）
                </h2>
                {activeOrders.map(order => <OrderCard key={order.id} order={order} />)}
              </section>
            )}
            {pastOrders.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />歷史訂單（{pastOrders.length}）
                </h2>
                {pastOrders.map(order => <OrderCard key={order.id} order={order} />)}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
