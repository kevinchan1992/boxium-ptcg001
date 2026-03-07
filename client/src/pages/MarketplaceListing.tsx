import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CreditCard, Smartphone, Package, Star, Shield, Truck, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2, HelpCircle, Tag, Flag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CONDITION_BADGE, CONDITION_FULL, CONDITION_TOOLTIP, CONDITION_GROUP_COLOR, CONDITION_GROUPS, type ConditionValue } from "@/lib/conditions";

const ALIPAY_QR_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";

// Helper: get the group name for a condition value
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
      <div className="aspect-[3/4] bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center border">
        <div className="text-center text-muted-foreground">
          <Package className="w-16 h-16 mx-auto mb-2 opacity-30" />
          <p className="text-sm">商品圖片</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-[3/4] bg-muted rounded-2xl overflow-hidden border group">
        <img
          src={imgs[activeIdx]}
          alt={`${title} - 圖片 ${activeIdx + 1}`}
          className="w-full h-full object-contain"
        />
        {imgs.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx(i => (i - 1 + imgs.length) % imgs.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveIdx(i => (i + 1) % imgs.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {imgs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === activeIdx ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {/* Thumbnails */}
      {imgs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {imgs.map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activeIdx ? "border-[#06038d]" : "border-border hover:border-muted-foreground"}`}
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
    <div className="mt-2 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">賣家評價（{total} 則）</div>
      {shown.map((r: any) => (
        <div key={r.id} className="bg-muted/40 rounded-lg p-2.5 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
              ))}
            </div>
            <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("zh-HK")}</span>
          </div>
          {r.comment && <p className="text-foreground">{r.comment}</p>}
        </div>
      ))}
      {total > 2 && (
        <button
          className="text-xs text-[#06038d] hover:underline"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? "收起" : `查看全部 ${total} 則評價`}
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

  // Fetch saved addresses for auto-fill
  const { data: savedAddresses } = trpc.marketplace.getMyShippingAddresses.useQuery(
    undefined,
    { enabled: !!me }
  );

  // Auto-fill shipping form with default address when dialog opens
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

  // SEO: Set Open Graph meta tags for social sharing (WhatsApp, Facebook, etc.)
  useEffect(() => {
    if (!listing) return;
    const price = parseFloat(listing.priceHkd as string);
    const rawImages = listing.images;
    const images: string[] | null = (() => {
      if (!rawImages) return null;
      if (Array.isArray(rawImages)) return rawImages as string[];
      if (typeof rawImages === "string") {
        try { const parsed = JSON.parse(rawImages); return Array.isArray(parsed) ? parsed : null; } catch { return null; }
      }
      return null;
    })();
    const imageUrl = images && images.length > 0 ? images[0] : "";
    const title = `${listing.title} - HKD ${price.toFixed(2)} | BOXIUM PTCG`;
    const description = listing.description
      ? `${listing.description.slice(0, 120)}${listing.description.length > 120 ? "..." : ""} | HKD ${price.toFixed(2)}`
      : `商品狀況：${listing.condition} | 價格：HKD ${price.toFixed(2)} | BOXIUM PTCG 卡牌商城`;

    // Update document title
    document.title = title;

    // Helper to set or create a meta tag
    const setMeta = (property: string, content: string, useProperty = true) => {
      const attr = useProperty ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const pageUrl = window.location.href;
    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:url", pageUrl);
    setMeta("og:type", "product");
    setMeta("og:site_name", "BOXIUM PTCG");
    if (imageUrl) setMeta("og:image", imageUrl);
    setMeta("og:price:amount", price.toFixed(2));
    setMeta("og:price:currency", "HKD");
    // Twitter Card
    setMeta("twitter:card", imageUrl ? "summary_large_image" : "summary", false);
    setMeta("twitter:title", title, false);
    setMeta("twitter:description", description, false);
    if (imageUrl) setMeta("twitter:image", imageUrl, false);

    // Cleanup: restore default title on unmount
    return () => {
      document.title = "BOXIUM PTCG";
    };
  }, [listing]);

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
      
      // Auto-trigger AI verification
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
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  );

  if (!listing) return (
    <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-lg font-medium">商品不存在或已下架</p>
        <Link href="/marketplace"><Button className="mt-4">返回商城</Button></Link>
      </div>
    </div>
  );

  const price = parseFloat(listing.priceHkd as string);
  const isAvailable = listing.status === "active" && listing.quantity > 0;
  // images may come back as a JSON string from the DB (e.g. '["url1"]') or already as an array
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

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/marketplace">
          <Button variant="outline" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />返回商城
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ListingImageGallery images={images} title={listing.title} />

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 cursor-help">
                        {/* Group badge */}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CONDITION_GROUP_COLOR[getConditionGroup(listing.condition)] ?? "bg-gray-100 text-gray-700"}`}>
                          {getConditionGroup(listing.condition)}
                        </span>
                        {/* Specific grade badge */}
                        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${CONDITION_BADGE[listing.condition as ConditionValue] ?? "bg-gray-100 text-gray-700 border border-gray-300"}`}>
                          {CONDITION_FULL[listing.condition as ConditionValue] ?? listing.condition}
                        </span>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-sm">
                      <p className="font-semibold mb-1">{CONDITION_FULL[listing.condition as ConditionValue] ?? listing.condition}</p>
                      <p className="text-muted-foreground">{CONDITION_TOOLTIP[listing.condition as ConditionValue] ?? ""}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Badge variant="outline" className={listing.sellerType === "platform" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>
                  {listing.sellerType === "platform" ? "🏻 BOXIUM 官方" : "👤 個人賣家"}
                </Badge>
                {!isAvailable && <Badge variant="outline" className="bg-red-100 text-red-800">已售出</Badge>}
              </div>
              <h1 className="text-2xl font-bold">{listing.title}</h1>
              {listing.description && <p className="text-muted-foreground mt-2">{listing.description}</p>}
              {/* Seller info for C2C listings */}
              {listing.sellerType === "seller" && (listing as any).sellerProfile && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground">{(listing as any).sellerProfile.displayName}</span>
                    <span>·</span>
                    <span>已售出 {(listing as any).sellerProfile.totalSales} 件</span>
                    {(listing as any).sellerProfile.ratingCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-foreground">{parseFloat((listing as any).sellerProfile.avgRating ?? "0").toFixed(1)}</span>
                          <span>({(listing as any).sellerProfile.ratingCount} 個評價)</span>
                        </span>
                      </>
                    )}
                  </div>
                  <SellerReviewsSection sellerId={(listing as any).sellerProfile.id} />
                </div>
              )}
            </div>

            <div className="bg-card border rounded-xl p-4">
              <span className="text-3xl font-bold text-[#06038d] dark:text-blue-400">
                HKD {price.toFixed(2)}
              </span>
              <p className="text-sm text-muted-foreground mt-1">庫存：{listing.quantity} 件</p>
            </div>

            {completedOrderNo ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-green-800 font-medium">✅ 訂單已提交</p>
                <p className="text-sm text-green-700 mt-1">訂單號：{completedOrderNo}</p>
              </div>
            ) : isAvailable ? (
              <div className="space-y-3">
                {!me && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    請先<Link href="/login" className="font-medium underline mx-1">登入</Link>才能購買
                  </div>
                )}
                {price < 4.00 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    此商品金額低於 Stripe 最低付款限額（HKD 4.00），請使用支付寶 HK 付款。
                  </div>
                )}
                <Button
                  className="w-full bg-[#06038d] hover:bg-[#0804b8] text-white h-12 text-base disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!me || createStripeOrderMutation.isPending || price < 4.00}
                  onClick={() => { if (!me) return; setShowShippingDialog(true); }}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  {createStripeOrderMutation.isPending ? "處理中..." : "信用卡 / Apple Pay 付款"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 text-base border-blue-300 text-blue-700 hover:bg-blue-50"
                  disabled={!me}
                  onClick={() => { setAlipayStep("qr"); setProofUrl(""); setVerifyResult(null); setShowAlipay(true); }}
                >
                  <Smartphone className="w-5 h-5 mr-2" />支付寶 HK 付款
                </Button>
                {(listing as any).allowOffers && (
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base border-yellow-400 text-yellow-600 hover:bg-yellow-50"
                    disabled={!me}
                    onClick={() => setShowOfferDialog(true)}
                  >
                    <Tag className="w-5 h-5 mr-2" />出價洽議
                  </Button>
                )}
              </div>
            ) : (
              <Button disabled className="w-full h-12">商品已售出</Button>
            )}

            <Separator />
            {me && (
              <button
                onClick={() => setShowReportDialog(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />舉報此商品
              </button>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Shield className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>買家保障：商品與描述不符可申請退款</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>本地順豐到付 / 自取（詳情請聯絡賣家）</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span>付款後 14 天自動確認完成交易</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alipay HK Payment Dialog */}
      <Dialog open={showAlipay} onOpenChange={() => setShowAlipay(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>支付寶 HK 付款</DialogTitle></DialogHeader>

          {alipayStep === "qr" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-medium text-blue-900">
                  付款金額：<span className="text-lg font-bold">HKD {price.toFixed(2)}</span>
                </p>
                <p className="text-blue-700 mt-1">{listing.title}</p>
              </div>
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">請掃描 QR Code 或點擊連結付款</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ALIPAY_QR_URL)}`}
                  alt="支付寶 HK QR Code"
                  className="w-48 h-48 mx-auto rounded-xl border-4 border-white shadow-lg"
                />
                <a href={ALIPAY_QR_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm">
                  <Smartphone className="w-4 h-4" />在手機上開啟支付寶 HK
                </a>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-medium">付款備注請填寫：</p>
                <p className="font-mono mt-1">{listing.title.substring(0, 30)}</p>
              </div>
              <Button className="w-full bg-[#06038d] hover:bg-[#0804b8] text-white"
                onClick={() => setAlipayStep("shipping")}>
                我已完成付款，填寫收貨地址
              </Button>
            </div>
          )}

          {alipayStep === "shipping" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium">請填寫收貨地址</p>
                <p className="text-xs mt-1">收貨地址將提供給賣家安排寄送</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>收件人姓名 *</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-background" placeholder="例：陳大文" value={alipayShippingForm.name} onChange={e => setAlipayShippingForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>聯絡電話 *</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-background" placeholder="例：9123 4567" value={alipayShippingForm.phone} onChange={e => setAlipayShippingForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>詳細地址 *</Label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-background" placeholder="例：旺角彌敦道 123 號 ABC 大廈 5 樓 A 室" value={alipayShippingForm.address} onChange={e => setAlipayShippingForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>地區</Label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-background" placeholder="例：旺角" value={alipayShippingForm.district} onChange={e => setAlipayShippingForm(f => ({ ...f, district: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>區域</Label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-background" value={alipayShippingForm.region} onChange={e => setAlipayShippingForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="香港島">香港島</option>
                    <option value="九龍">九龍</option>
                    <option value="新界">新界</option>
                    <option value="香港">香港（不指定）</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">* 必填欄位。如不需要寄送可跳過。</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAlipayStep("qr")}>返回</Button>
                <Button
                  className="flex-1 bg-[#06038d] hover:bg-[#0804b8] text-white"
                  disabled={!alipayShippingForm.name.trim() || !alipayShippingForm.phone.trim() || !alipayShippingForm.address.trim()}
                  onClick={() => setAlipayStep("upload")}
                >
                  下一步：上傳截圖
                </Button>
              </div>
            </div>
          )}

          {alipayStep === "upload" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium">付款金額：HKD {price.toFixed(2)}</p>
                <p className="mt-1">請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致。</p>
              </div>
              <div>
                <Label>付款截圖 *</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm">上傳中...</p>
                    </div>
                  ) : proofUrl ? (
                    <div className="space-y-3">
                      <img src={proofUrl} alt="付款截圖" className="max-h-40 mx-auto rounded object-contain" />
                      {isVerifying ? (
                        <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AI 正在驗證付款金額...</span>
                        </div>
                      ) : verifyResult ? (
                        <div className={`rounded-lg p-3 text-sm space-y-2 ${verifyResult.verified ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
                          <div className="flex items-center gap-2 font-medium mb-2">
                            {verifyResult.verified
                              ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">三項驗證全部通過</span></>
                              : <><XCircle className="w-4 h-4 text-orange-600" /><span className="text-orange-800">驗證未完全通過</span></>
                            }
                          </div>
                          {/* Three check items */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              {verifyResult.payeeVerified
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              }
                              <span className={verifyResult.payeeVerified ? "text-green-700" : "text-red-700"}>
                                收款方：{verifyResult.detectedPayee ?? "未識別"}
                                {!verifyResult.payeeVerified && " （需為「零度有限公司」）"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {verifyResult.amountVerified
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              }
                              <span className={verifyResult.amountVerified ? "text-green-700" : "text-red-700"}>
                                金額：{verifyResult.currency ?? "HKD"} {verifyResult.detectedAmount ?? "未識別"}
                                {!verifyResult.amountVerified && ` （需為 HKD ${price.toFixed(2)}）`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {verifyResult.statusVerified
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              }
                              <span className={verifyResult.statusVerified ? "text-green-700" : "text-red-700"}>
                                狀態：{verifyResult.detectedStatus ?? "未識別"}
                                {!verifyResult.statusVerified && " （需為「成功」）"}
                              </span>
                            </div>
                          </div>
                          <p className={`text-xs mt-1 ${verifyResult.verified ? "text-green-700" : "text-orange-700"}`}>
                            {verifyResult.reason}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            AI 信心度：{verifyResult.confidence === "high" ? "高" : verifyResult.confidence === "medium" ? "中" : "低"}
                          </p>
                          {!verifyResult.verified && (
                            <button
                              className="mt-1 text-xs text-blue-600 underline"
                              onClick={() => { setProofUrl(""); setVerifyResult(null); }}
                            >
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
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-sm text-muted-foreground">點擊上傳截圖</p>
                        <p className="text-xs text-muted-foreground mt-1">支援 JPG、PNG，最大 5MB</p>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin override note */}
              {verifyResult && !verifyResult.verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <p className="font-medium">⚠️ 如確認已付款，可繼續提交</p>
                  <p className="mt-1">訂單將標記為「待人工核對」，管理員將在 1-2 個工作天內確認。</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setAlipayStep("qr")}>返回</Button>
                <Button
                  className="bg-[#06038d] hover:bg-[#0804b8] text-white"
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
            <div className="text-center space-y-4 py-4">
              <div className="text-5xl">✅</div>
              <p className="font-medium text-lg">訂單已提交！</p>
              <p className="text-sm text-muted-foreground">
                我們將在核對收款後確認你的訂單，通常需要 1-2 個工作天。
              </p>
              <Button className="w-full" onClick={() => setShowAlipay(false)}>關閉</Button>
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
                      className={`w-full text-left rounded-lg border-2 px-3 py-2 text-sm transition-all ${
                        selectedSavedAddressId === addr.id ? "border-[#06038d] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <span className="font-semibold">{addr.label}</span>
                      <span className="text-gray-500 ml-2">{addr.recipientName} · {addr.phone}</span>
                      <br />
                      <span className="text-gray-400 text-xs">{addr.district ? `${addr.district}，` : ""}{addr.address}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">或手動填寫以下欄位</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-name">收件人姓名 *</Label>
                <input
                  id="ship-name"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]"
                  placeholder="例：陳大文"
                  value={shippingForm.name}
                  onChange={e => setShippingForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-phone">聯絡電話 *</Label>
                <input
                  id="ship-phone"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]"
                  placeholder="例：9123 4567"
                  value={shippingForm.phone}
                  onChange={e => setShippingForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship-address">詳細地址 *</Label>
              <input
                id="ship-address"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]"
                placeholder="例：旺角彌敦道 123 號 ABC 大廈 5 樓 A 室"
                value={shippingForm.address}
                onChange={e => setShippingForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ship-district">地區</Label>
                <input
                  id="ship-district"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d]"
                  placeholder="例：旺角"
                  value={shippingForm.district}
                  onChange={e => setShippingForm(f => ({ ...f, district: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ship-region">區域</Label>
                <select
                  id="ship-region"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] bg-background"
                  value={shippingForm.region}
                  onChange={e => setShippingForm(f => ({ ...f, region: e.target.value }))}
                >
                  <option value="香港島">香港島</option>
                  <option value="九龍">九龍</option>
                  <option value="新界">新界</option>
                  <option value="香港">香港（不指定）</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">* 必填欄位。收貨地址將提供給賣家安排寄送。</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowShippingDialog(false)}>取消</Button>
            <Button
              className="bg-[#06038d] hover:bg-[#0804b8] text-white"
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
              {createStripeOrderMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</> : <><CreditCard className="w-4 h-4 mr-2" />前往付款</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-yellow-500" />出價洿議
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
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
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">留言（可選）</Label>
              <Textarea
                placeholder="可以說明出價原因或其他要求..."
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                rows={3}
                className="bg-white/5 border-white/20 text-white resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowOfferDialog(false)}>取消</Button>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
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
              <Label className="text-sm font-medium mb-1.5 block">舉報原因</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
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
              <Label className="text-sm font-medium mb-1.5 block">詳細說明（可選）</Label>
              <Textarea
                placeholder="請詳述舉報原因..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                className="bg-white/5 border-white/20 text-white resize-none"
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
