import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CreditCard, Smartphone, Package, Star, Shield, Truck, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2 } from "lucide-react";

const ALIPAY_QR_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";
const conditionLabel: Record<string, string> = {
  psa10: "PSA 10", psa9: "PSA 9", psa8_below: "PSA 8 以下",
  bgs10: "BGS 10", bgs9: "BGS 9", bgs8_below: "BGS 8 以下",
  tag10: "TAG 10", tag9_below: "TAG 9 以下",
  raw_a: "A品 (Raw)", raw_b: "B品 (Raw)", raw_c: "C品 (Raw)", raw_d: "D品 (Raw)",
};

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
  const [alipayStep, setAlipayStep] = useState<"qr" | "upload" | "done">("qr");
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const { data: listing, isLoading } = trpc.marketplace.getListing.useQuery(
    { id },
    { enabled: !!id }
  );
  const { data: me } = trpc.auth.me.useQuery();

  const createStripeOrderMutation = trpc.marketplace.createStripeOrder.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success("正在跳轉到 Stripe 付款頁面...");
      }
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
                <Badge className="bg-green-100 text-green-800">
                  {conditionLabel[listing.condition] ?? listing.condition}
                </Badge>
                <Badge variant="outline" className={listing.sellerType === "platform" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>
                  {listing.sellerType === "platform" ? "🏻 BOXIUM 官方" : "👤 個人賣家"}
                </Badge>
                {!isAvailable && <Badge variant="outline" className="bg-red-100 text-red-800">已售出</Badge>}
              </div>
              <h1 className="text-2xl font-bold">{listing.title}</h1>
              {listing.description && <p className="text-muted-foreground mt-2">{listing.description}</p>}
              {/* Seller info for C2C listings */}
              {listing.sellerType === "seller" && (listing as any).sellerProfile && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{(listing as any).sellerProfile.displayName}</span>
                  <span>·</span>
                  <span>已售出 {(listing as any).sellerProfile.totalSales} 件</span>
                  {(listing as any).sellerProfile.ratingCount > 0 && (
                    <><span>·</span><span>{(listing as any).sellerProfile.ratingCount} 個評價</span></>
                  )}
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
                <Button
                  className="w-full bg-[#06038d] hover:bg-[#0804b8] text-white h-12 text-base"
                  disabled={!me || createStripeOrderMutation.isPending}
                  onClick={() => createStripeOrderMutation.mutate({ listingId: listing.id })}
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
              </div>
            ) : (
              <Button disabled className="w-full h-12">商品已售出</Button>
            )}

            <Separator />
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
                onClick={() => setAlipayStep("upload")}>
                我已完成付款，上傳截圖
              </Button>
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
                  onClick={() => createAlipayOrderMutation.mutate({ listingId: listing.id, proofImageUrl: proofUrl })}
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
    </div>
  );
}
