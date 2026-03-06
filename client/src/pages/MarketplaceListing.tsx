import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CreditCard, Smartphone, Package, Star, Shield, Truck, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2, HelpCircle, Tag, Flag, User, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CONDITION_BADGE, CONDITION_FULL, CONDITION_TOOLTIP, CONDITION_GROUP_COLOR, CONDITION_GROUPS, type ConditionValue } from "@/lib/conditions";

const ALIPAY_QR_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";

function getConditionGroup(condition: string): string {
  for (const g of CONDITION_GROUPS) {
    if (g.items.some(i => i.value === condition)) return g.group;
  }
  return "";
}

function ListingImageGallery({ images, title }: { images: string[] | null; title: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const imgs = images && images.length > 0 ? images : null;

  if (!imgs) {
    return (
      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center border border-gray-200">
        <div className="text-center text-gray-400">
          <Package className="w-20 h-20 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">暫無商品圖片</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm group">
        <img
          src={imgs[activeIdx]}
          alt={`${title} - 圖片 ${activeIdx + 1}`}
          className="w-full h-full object-contain p-2"
        />
        {imgs.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx(i => (i - 1 + imgs.length) % imgs.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveIdx(i => (i + 1) % imgs.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {imgs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`rounded-full transition-all ${i === activeIdx ? "w-5 h-2 bg-[#06038d]" : "w-2 h-2 bg-gray-300 hover:bg-gray-400"}`}
                />
              ))}
            </div>
          </>
        )}
        {/* Image counter */}
        {imgs.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {activeIdx + 1} / {imgs.length}
          </div>
        )}
      </div>
      {/* Thumbnails */}
      {imgs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {imgs.map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeIdx
                  ? "border-[#06038d] shadow-md scale-105"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <img src={url} alt={`縮圖 ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SellerReviewsSection({ sellerId }: { sellerId: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data } = trpc.marketplace.getSellerReviews.useQuery(
    { sellerId: sellerId, page: 1, pageSize: 5 },
    { enabled: !!sellerId }
  );
  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  if (total === 0) return null;
  const shown = expanded ? reviews : reviews.slice(0, 2);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">買家評價（{total} 則）</p>
      {shown.map((r: any) => (
        <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
              ))}
            </div>
            <span className="text-gray-400">{new Date(r.createdAt).toLocaleDateString("zh-HK")}</span>
          </div>
          {r.comment && <p className="text-gray-700 leading-relaxed">{r.comment}</p>}
        </div>
      ))}
      {total > 2 && (
        <button
          className="text-xs text-[#06038d] hover:underline font-medium"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? "收起評價" : `查看全部 ${total} 則評價 →`}
        </button>
      )}
    </div>
  );
}

type VerifyResult = {
  verified: boolean;
  payeeVerified: boolean;
  detectedPayee: string | null;
  amountVerified: boolean;
  detectedAmount: number | null;
  currency: string | null;
  statusVerified: boolean;
  detectedStatus: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export default function MarketplaceListing() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [showAlipay, setShowAlipay] = useState(false);
  const [completedOrderNo, setCompletedOrderNo] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [alipayStep, setAlipayStep] = useState<"qr" | "shipping" | "upload" | "done">("qr");
  const [alipayShippingForm, setAlipayShippingForm] = useState({ name: "", phone: "", address: "", district: "", region: "香港" });
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [showShippingDialog, setShowShippingDialog] = useState(false);
  const [shippingForm, setShippingForm] = useState({ name: "", phone: "", address: "", district: "", region: "香港" });
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<number | null>(null);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const { data: me } = trpc.auth.me.useQuery();

  const { data: savedAddresses } = trpc.marketplace.getMyShippingAddresses.useQuery(
    undefined,
    { enabled: !!me }
  );

  useEffect(() => {
    if (showShippingDialog && savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find((a: any) => a.isDefault) || savedAddresses[0];
      if (defaultAddr && !shippingForm.name) {
        setShippingForm({ name: defaultAddr.recipientName, phone: defaultAddr.phone, address: defaultAddr.address, district: defaultAddr.district || "", region: defaultAddr.region });
        setSelectedSavedAddressId(defaultAddr.id);
      }
    }
  }, [showShippingDialog, savedAddresses]);

  const { data: listing, isLoading } = trpc.marketplace.getListing.useQuery(
    { id },
    { enabled: !!id }
  );

  const createStripeOrderMutation = trpc.marketplace.createStripeOrder.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success("正在跳轉到 Stripe 付款頁面...");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const makeOfferMutation = trpc.marketplace.makeOffer.useMutation({
    onSuccess: () => {
      toast.success("出價已送出！賣家將盡快回覆。");
      setShowOfferDialog(false);
      setOfferAmount("");
      setOfferMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  const reportListingMutation = trpc.marketplace.reportListing.useMutation({
    onSuccess: () => {
      toast.success("舉報已提交，我們將盡快審核。");
      setShowReportDialog(false);
      setReportReason("");
      setReportDetails("");
    },
    onError: (e) => toast.error(e.message),
  });

  const createAlipayOrderMutation = trpc.marketplace.createAlipayOrder.useMutation({
    onSuccess: (data) => {
      setCompletedOrderNo(data.orderNo);
      setAlipayStep("done");
    },
    onError: (e) => toast.error(e.message),
  });

  const verifyPaymentProofMutation = trpc.marketplace.verifyPaymentProof.useMutation({
    onSuccess: (data) => {
      setVerifyResult(data as VerifyResult);
      setIsVerifying(false);
      if (data.verified) {
        toast.success("✅ 付款金額驗證成功！");
      } else {
        toast.error("⚠️ 付款金額不符，請重新確認");
      }
    },
    onError: (e) => {
      setIsVerifying(false);
      toast.error("驗證失敗：" + e.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("截圖不能超過 5MB"); return; }
    setIsUploading(true);
    setVerifyResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-payment-proof", { method: "POST", body: formData });
      if (!res.ok) throw new Error("上傳失敗");
      const { url } = await res.json();
      setProofUrl(url);
      toast.success("截圖已上傳，正在 AI 驗證金額...");
      setIsVerifying(true);
      const price = parseFloat((listing as any)?.priceHkd ?? "0");
      verifyPaymentProofMutation.mutate({
        proofImageUrl: url,
        expectedAmountHkd: price,
      });
    } catch {
      toast.error("截圖上傳失敗，請重試");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-6 bg-gray-200 rounded-lg w-24 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded-lg w-3/4" />
            <div className="h-6 bg-gray-200 rounded-lg w-1/2" />
            <div className="h-24 bg-gray-200 rounded-xl" />
            <div className="h-12 bg-gray-200 rounded-xl" />
            <div className="h-12 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );

  if (!listing) return (
    <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl p-10 shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">商品不存在或已下架</h2>
        <p className="text-gray-500 mb-6 text-sm">此商品可能已被賣家移除或售出</p>
        <Link href="/marketplace">
          <Button className="bg-[#06038d] hover:bg-[#0804b8] text-white">返回商城</Button>
        </Link>
      </div>
    </div>
  );

  const price = parseFloat(listing.priceHkd as string);
  const isAvailable = listing.status === "active" && listing.quantity > 0;
  const rawImages = listing.images;
  const images: string[] | null = (() => {
    if (!rawImages) return null;
    if (Array.isArray(rawImages)) return rawImages as string[];
    if (typeof rawImages === "string") {
      try { const parsed = JSON.parse(rawImages); return Array.isArray(parsed) ? parsed : null; }
      catch { return null; }
    }
    return null;
  })();

  const canSubmitAlipay = proofUrl && verifyResult?.verified === true;
  const conditionGroup = getConditionGroup(listing.condition);
  const conditionGroupColor = CONDITION_GROUP_COLOR[conditionGroup] ?? "bg-gray-100 text-gray-700";
  const conditionBadgeColor = CONDITION_BADGE[listing.condition as ConditionValue] ?? "bg-gray-100 text-gray-700 border border-gray-300";
  const conditionFull = CONDITION_FULL[listing.condition as ConditionValue] ?? listing.condition;
  const conditionTooltip = CONDITION_TOOLTIP[listing.condition as ConditionValue] ?? "";
  const isPlatformSeller = listing.sellerType === "platform";
  const sellerProfile = (listing as any).sellerProfile;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="py-5">
          <Link href="/marketplace">
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#06038d] transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              返回商城
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
          {/* Left: Image Gallery */}
          <div className="lg:sticky lg:top-24">
            <ListingImageGallery images={images} title={listing.title} />
          </div>

          {/* Right: Product Info */}
          <div className="space-y-5">
            {/* Tags / Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-help">
                      {conditionGroup && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${conditionGroupColor}`}>
                          {conditionGroup}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${conditionBadgeColor}`}>
                        {conditionFull}
                      </span>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-semibold mb-1">{conditionFull}</p>
                    {conditionTooltip && <p className="text-gray-500 text-xs">{conditionTooltip}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-2.5 py-1 ${
                  isPlatformSeller
                    ? "bg-[#06038d]/10 text-[#06038d] border-[#06038d]/20"
                    : "bg-orange-50 text-orange-700 border-orange-200"
                }`}
              >
                {isPlatformSeller ? "🏪 BOXIUM 官方" : "👤 個人賣家"}
              </Badge>
              {!isAvailable && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs font-semibold px-2.5 py-1">
                  已售出
                </Badge>
              )}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{listing.title}</h1>
              {listing.description && (
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">{listing.description}</p>
              )}
            </div>

            {/* Seller Info (C2C) */}
            {!isPlatformSeller && sellerProfile && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#06038d] to-[#0804b8] flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/seller/${sellerProfile.id}`}>
                      <p className="font-semibold text-gray-900 hover:text-[#06038d] transition-colors cursor-pointer truncate">
                        {sellerProfile.displayName}
                      </p>
                    </Link>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        已售 {sellerProfile.totalSales} 件
                      </span>
                      {sellerProfile.ratingCount > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold text-gray-700">{parseFloat(sellerProfile.avgRating ?? "0").toFixed(1)}</span>
                          <span>({sellerProfile.ratingCount})</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/seller/${sellerProfile.id}`}>
                    <Button variant="outline" size="sm" className="text-xs border-gray-200 text-gray-600 hover:border-[#06038d] hover:text-[#06038d]">
                      查看主頁
                    </Button>
                  </Link>
                </div>
                <SellerReviewsSection sellerId={sellerProfile.id} />
              </div>
            )}

            {/* Price Block */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">售價</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-[#06038d]">
                      {price.toLocaleString("zh-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-lg font-semibold text-gray-500">HKD</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">庫存</p>
                  <p className="text-lg font-bold text-gray-700">{listing.quantity} 件</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {completedOrderNo ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-green-800 font-semibold text-lg">訂單已提交！</p>
                <p className="text-sm text-green-600 mt-1">訂單號：<span className="font-mono font-semibold">{completedOrderNo}</span></p>
                <Link href="/orders">
                  <Button className="mt-4 bg-green-600 hover:bg-green-700 text-white" size="sm">查看我的訂單</Button>
                </Link>
              </div>
            ) : isAvailable ? (
              <div className="space-y-3">
                {!me && (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>請先<Link href="/login" className="font-semibold underline mx-1 text-amber-900">登入</Link>才能購買商品</span>
                  </div>
                )}
                <Button
                  className="w-full bg-[#06038d] hover:bg-[#0804b8] text-white h-13 text-base font-semibold shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transition-all"
                  disabled={!me || createStripeOrderMutation.isPending}
                  onClick={() => { if (!me) return; setShowShippingDialog(true); }}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  {createStripeOrderMutation.isPending ? "處理中..." : "信用卡 / Apple Pay 付款"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-13 text-base font-semibold border-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all"
                  disabled={!me}
                  onClick={() => { setAlipayStep("qr"); setProofUrl(""); setVerifyResult(null); setShowAlipay(true); }}
                >
                  <Smartphone className="w-5 h-5 mr-2" />支付寶 HK 付款
                </Button>
                {(listing as any).allowOffers && (
                  <Button
                    variant="outline"
                    className="w-full h-13 text-base font-semibold border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all"
                    disabled={!me}
                    onClick={() => setShowOfferDialog(true)}
                  >
                    <Tag className="w-5 h-5 mr-2" />出價洽議
                  </Button>
                )}
              </div>
            ) : (
              <Button disabled className="w-full h-13 text-base font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
                商品已售出
              </Button>
            )}

            {/* Trust Signals */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">購物保障</p>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <span>商品與描述不符可申請退款</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <span>本地順豐到付 / 自取（詳情請聯絡賣家）</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <Star className="w-4 h-4 text-yellow-500" />
                </div>
                <span>付款後 14 天自動確認完成交易</span>
              </div>
            </div>

            {/* Report */}
            {me && (
              <div className="pt-1">
                <Separator className="mb-3" />
                <button
                  onClick={() => setShowReportDialog(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />舉報此商品
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alipay HK Payment Dialog */}
      <Dialog open={showAlipay} onOpenChange={() => setShowAlipay(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              支付寶 HK 付款
            </DialogTitle>
          </DialogHeader>

          {alipayStep === "qr" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700 font-medium">付款金額</p>
                <p className="text-2xl font-extrabold text-blue-900 mt-1">HKD {price.toFixed(2)}</p>
                <p className="text-xs text-blue-600 mt-1 truncate">{listing.title}</p>
              </div>
              <div className="text-center space-y-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ALIPAY_QR_URL)}`}
                  alt="支付寶 HK QR Code"
                  className="w-48 h-48 mx-auto rounded-2xl border-4 border-white shadow-lg"
                />
                <a href={ALIPAY_QR_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium">
                  <Smartphone className="w-4 h-4" />在手機上開啟支付寶 HK
                </a>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-semibold mb-1">⚠️ 付款備注請填寫：</p>
                <p className="font-mono bg-amber-100 px-2 py-1 rounded mt-1">{listing.title.substring(0, 30)}</p>
              </div>
              <Button className="w-full bg-[#06038d] hover:bg-[#0804b8] text-white font-semibold"
                onClick={() => setAlipayStep("shipping")}>
                我已完成付款，填寫收貨地址 →
              </Button>
            </div>
          )}

          {alipayStep === "shipping" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                <p className="font-semibold">填寫收貨地址</p>
                <p className="text-xs mt-1 text-blue-600">收貨地址將提供給賣家安排寄送</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">收件人姓名 *</Label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-white" placeholder="例：陳大文" value={alipayShippingForm.name} onChange={e => setAlipayShippingForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">聯絡電話 *</Label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-white" placeholder="例：9123 4567" value={alipayShippingForm.phone} onChange={e => setAlipayShippingForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">詳細地址 *</Label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-white" placeholder="例：旺角彌敦道 123 號 ABC 大廈 5 樓 A 室" value={alipayShippingForm.address} onChange={e => setAlipayShippingForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">地區</Label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-white" placeholder="例：旺角" value={alipayShippingForm.district} onChange={e => setAlipayShippingForm(f => ({ ...f, district: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">區域</Label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-white" value={alipayShippingForm.region} onChange={e => setAlipayShippingForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="香港島">香港島</option>
                    <option value="九龍">九龍</option>
                    <option value="新界">新界</option>
                    <option value="香港">香港（不指定）</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400">* 必填欄位。如不需要寄送可跳過。</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAlipayStep("qr")}>← 返回</Button>
                <Button
                  className="flex-1 bg-[#06038d] hover:bg-[#0804b8] text-white font-semibold"
                  disabled={!alipayShippingForm.name.trim() || !alipayShippingForm.phone.trim() || !alipayShippingForm.address.trim()}
                  onClick={() => setAlipayStep("upload")}
                >
                  下一步：上傳截圖 →
                </Button>
              </div>
            </div>
          )}

          {alipayStep === "upload" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                <p className="font-semibold">付款金額：HKD {price.toFixed(2)}</p>
                <p className="text-xs mt-1 text-blue-600">請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致。</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-2 block">付款截圖 *</Label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-gray-300 transition-colors">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Loader2 className="w-8 h-8 animate-spin text-[#06038d]" />
                      <p className="text-sm">上傳中...</p>
                    </div>
                  ) : proofUrl ? (
                    <div className="space-y-3">
                      <img src={proofUrl} alt="付款截圖" className="max-h-40 mx-auto rounded-xl object-contain border border-gray-200" />
                      {isVerifying ? (
                        <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AI 正在驗證付款金額...</span>
                        </div>
                      ) : verifyResult ? (
                        <div className={`rounded-xl p-3 text-sm space-y-2 ${verifyResult.verified ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
                          <div className="flex items-center gap-2 font-semibold">
                            {verifyResult.verified
                              ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">三項驗證全部通過</span></>
                              : <><XCircle className="w-4 h-4 text-orange-600" /><span className="text-orange-800">驗證未完全通過</span></>
                            }
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { ok: verifyResult.payeeVerified, label: `收款方：${verifyResult.detectedPayee ?? "未識別"}${!verifyResult.payeeVerified ? " （需為「零度有限公司」）" : ""}` },
                              { ok: verifyResult.amountVerified, label: `金額：${verifyResult.currency ?? "HKD"} ${verifyResult.detectedAmount ?? "未識別"}${!verifyResult.amountVerified ? ` （需為 HKD ${price.toFixed(2)}）` : ""}` },
                              { ok: verifyResult.statusVerified, label: `狀態：${verifyResult.detectedStatus ?? "未識別"}${!verifyResult.statusVerified ? " （需為「成功」）" : ""}` },
                            ].map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                {item.ok
                                  ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                  : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                }
                                <span className={item.ok ? "text-green-700" : "text-red-700"}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                          <p className={`text-xs ${verifyResult.verified ? "text-green-700" : "text-orange-700"}`}>{verifyResult.reason}</p>
                          <p className="text-xs text-gray-400">AI 信心度：{verifyResult.confidence === "high" ? "高" : verifyResult.confidence === "medium" ? "中" : "低"}</p>
                          {!verifyResult.verified && (
                            <button className="text-xs text-blue-600 underline font-medium" onClick={() => { setProofUrl(""); setVerifyResult(null); }}>
                              重新上傳截圖
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="proof-upload" />
                      <label htmlFor="proof-upload" className="cursor-pointer">
                        <div className="text-4xl mb-2">📷</div>
                        <p className="text-sm font-medium text-gray-600">點擊上傳截圖</p>
                        <p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 5MB</p>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              {verifyResult && !verifyResult.verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <p className="font-semibold">⚠️ 如確認已付款，可繼續提交</p>
                  <p className="mt-1">訂單將標記為「待人工核對」，管理員將在 1-2 個工作天內確認。</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setAlipayStep("qr")}>← 返回</Button>
                <Button
                  className="bg-[#06038d] hover:bg-[#0804b8] text-white font-semibold"
                  disabled={!proofUrl || isVerifying || isUploading || createAlipayOrderMutation.isPending}
                  onClick={() => createAlipayOrderMutation.mutate({
                    listingId: listing.id,
                    proofImageUrl: proofUrl,
                    shippingAddress: alipayShippingForm.name.trim() ? {
                      name: alipayShippingForm.name.trim(),
                      phone: alipayShippingForm.phone.trim(),
                      address: alipayShippingForm.address.trim(),
                      district: alipayShippingForm.district.trim() || undefined,
                      region: alipayShippingForm.region,
                    } : undefined,
                  })}
                >
                  {createAlipayOrderMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</>
                  ) : canSubmitAlipay ? "✅ 提交訂單" : "提交訂單（待核對）"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {alipayStep === "done" && (
            <div className="text-center space-y-4 py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <p className="font-bold text-xl text-gray-900">訂單已提交！</p>
                <p className="text-sm text-gray-500 mt-2">我們將在核對收款後確認你的訂單，通常需要 1-2 個工作天。</p>
              </div>
              <Button className="w-full bg-[#06038d] hover:bg-[#0804b8] text-white font-semibold" onClick={() => setShowAlipay(false)}>關閉</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Shipping Address Dialog */}
      <Dialog open={showShippingDialog} onOpenChange={(open) => { setShowShippingDialog(open); if (!open) { setShippingForm({ name: "", phone: "", address: "", district: "", region: "香港" }); setSelectedSavedAddressId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#06038d]" />
              填寫收貨地址
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {savedAddresses && savedAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">已儲存地址</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {savedAddresses.map((addr: any) => (
                    <button key={addr.id} type="button"
                      onClick={() => { setSelectedSavedAddressId(addr.id); setShippingForm({ name: addr.recipientName, phone: addr.phone, address: addr.address, district: addr.district || "", region: addr.region }); }}
                      className={`w-full text-left rounded-xl border-2 px-3 py-2.5 text-sm transition-all ${
                        selectedSavedAddressId === addr.id ? "border-[#06038d] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <span className="font-semibold text-gray-900">{addr.label}</span>
                      <span className="text-gray-500 ml-2 text-xs">{addr.recipientName} · {addr.phone}</span>
                      <br />
                      <span className="text-gray-400 text-xs">{addr.district ? `${addr.district}，` : ""}{addr.address}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">或手動填寫以下欄位</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-name" className="text-xs font-semibold text-gray-600">收件人姓名 *</Label>
                <input id="ship-name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]" placeholder="例：陳大文" value={shippingForm.name} onChange={e => setShippingForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-phone" className="text-xs font-semibold text-gray-600">聯絡電話 *</Label>
                <input id="ship-phone" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]" placeholder="例：9123 4567" value={shippingForm.phone} onChange={e => setShippingForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship-address" className="text-xs font-semibold text-gray-600">詳細地址 *</Label>
              <input id="ship-address" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]" placeholder="例：旺角彌敦道 123 號 ABC 大廈 5 樓 A 室" value={shippingForm.address} onChange={e => setShippingForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-district" className="text-xs font-semibold text-gray-600">地區</Label>
                <input id="ship-district" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]" placeholder="例：旺角" value={shippingForm.district} onChange={e => setShippingForm(f => ({ ...f, district: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-region" className="text-xs font-semibold text-gray-600">區域</Label>
                <select id="ship-region" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-white" value={shippingForm.region} onChange={e => setShippingForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="香港島">香港島</option>
                  <option value="九龍">九龍</option>
                  <option value="新界">新界</option>
                  <option value="香港">香港（不指定）</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">* 必填欄位。收貨地址將提供給賣家安排寄送。</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowShippingDialog(false)}>取消</Button>
            <Button
              className="bg-[#06038d] hover:bg-[#0804b8] text-white font-semibold"
              disabled={!shippingForm.name.trim() || !shippingForm.phone.trim() || !shippingForm.address.trim() || createStripeOrderMutation.isPending}
              onClick={() => {
                setShowShippingDialog(false);
                createStripeOrderMutation.mutate({
                  listingId: listing.id,
                  shippingAddress: {
                    name: shippingForm.name.trim(),
                    phone: shippingForm.phone.trim(),
                    address: shippingForm.address.trim(),
                    district: shippingForm.district.trim() || undefined,
                    region: shippingForm.region,
                  },
                });
              }}
            >
              {createStripeOrderMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</>
                : <><CreditCard className="w-4 h-4 mr-2" />前往付款</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" />出價洽議
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                出價金額（HKD）
                {listing?.minOfferHkd && (
                  <span className="text-gray-400 font-normal ml-1">（最低 HKD {parseFloat(listing.minOfferHkd as string).toFixed(0)}）</span>
                )}
              </Label>
              <Input
                type="number"
                placeholder="請輸入出價金額"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="bg-white border-gray-200 text-gray-900"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">留言（可選）</Label>
              <Textarea
                placeholder="可以說明出價原因或其他要求..."
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                rows={3}
                className="bg-white border-gray-200 text-gray-900 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowOfferDialog(false)}>取消</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              disabled={!offerAmount || parseFloat(offerAmount) <= 0 || makeOfferMutation.isPending}
              onClick={() => {
                if (!listing || !me) return;
                const sellerId = (listing as any).sellerId;
                if (!sellerId) return;
                makeOfferMutation.mutate({
                  listingId: listing.id,
                  offerPriceHkd: parseFloat(offerAmount),
                  message: offerMessage || undefined,
                });
              }}
            >
              {makeOfferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "送出出價"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />舉報商品
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">舉報原因</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                  <SelectValue placeholder="請選擇舉報原因" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fake_item">假貨 / 詐騙</SelectItem>
                  <SelectItem value="wrong_description">商品與描述不符</SelectItem>
                  <SelectItem value="prohibited_item">禁售商品</SelectItem>
                  <SelectItem value="scam">詐騙行為</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">詳細說明（可選）</Label>
              <Textarea
                placeholder="請詳述舉報原因..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                className="bg-white border-gray-200 text-gray-900 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReportDialog(false)}>取消</Button>
            <Button
              variant="destructive"
              disabled={!reportReason || reportListingMutation.isPending}
              onClick={() => {
                if (!listing) return;
                reportListingMutation.mutate({
                  listingId: listing.id,
                  reason: reportReason as "fake_item" | "wrong_description" | "prohibited_item" | "scam" | "other",
                  details: reportDetails || undefined,
                });
              }}
            >
              {reportListingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "提交舉報"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
