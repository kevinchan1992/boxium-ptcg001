import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";
import { Package, ShoppingBag, DollarSign, ExternalLink, Plus, AlertCircle, CheckCircle, Clock, ImagePlus, Loader2, X, Star, Tag } from "lucide-react";
import { Link } from "wouter";

// ─── ImageUploader ────────────────────────────────────────────────────────────
function ImageUploader({
  images,
  onChange,
  maxImages = 5,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
  maxImages?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const remaining = maxImages - images.length;
      if (remaining <= 0) { toast.error(`最多上傳 ${maxImages} 張圖片`); return; }
      const toUpload = Array.from(files).slice(0, remaining);
      setUploading(true);
      try {
        const uploaded: string[] = [];
        for (const file of toUpload) {
          if (!file.type.startsWith("image/")) { toast.error(`${file.name} 不是圖片`); continue; }
          if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} 超過 10MB`); continue; }
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload-marketplace-image", { method: "POST", body: fd });
          if (!res.ok) throw new Error("上傳失敗");
          const { url } = await res.json();
          uploaded.push(url);
        }
        if (uploaded.length > 0) { onChange([...images, ...uploaded]); toast.success(`已上傳 ${uploaded.length} 張圖片`); }
      } catch (e: any) {
        toast.error(e.message || "圖片上傳失敗");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [images, onChange, maxImages]
  );

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }, [handleFiles]);

  return (
    <div className="space-y-2">
      <Label>商品圖片（最多 {maxImages} 張）</Label>
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              <img src={url} alt={`商品圖 ${idx + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
              {idx === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">封面</span>}
            </div>
          ))}
        </div>
      )}
      {images.length < maxImages && (
        <div
          className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">上傳中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImagePlus className="w-6 h-6" />
              <span className="text-sm">點擊或拖放圖片上傳</span>
              <span className="text-xs">支援 JPG、PNG、WebP，每張最大 10MB</span>
            </div>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}

const conditionOptions = [
  { group: "PSA", items: [
    { value: "psa10", label: "PSA 10" },
    { value: "psa9", label: "PSA 9" },
    { value: "psa8_below", label: "PSA 8 以下" },
  ]},
  { group: "BGS", items: [
    { value: "bgs10", label: "BGS 10" },
    { value: "bgs9", label: "BGS 9" },
    { value: "bgs8_below", label: "BGS 8 以下" },
  ]},
  { group: "TAG", items: [
    { value: "tag10", label: "TAG 10" },
    { value: "tag9_below", label: "TAG 9 以下" },
  ]},
  { group: "Raw 卡", items: [
    { value: "raw_a", label: "A品" },
    { value: "raw_b", label: "B品" },
    { value: "raw_c", label: "C品" },
    { value: "raw_d", label: "D品" },
  ]},
];

const orderStatusLabel: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800" },
  paid_held: { label: "已付款", color: "bg-blue-100 text-blue-800" },
  processing: { label: "處理中", color: "bg-purple-100 text-purple-800" },
  shipped: { label: "已寄出", color: "bg-indigo-100 text-indigo-800" },
  completed: { label: "已完成", color: "bg-green-100 text-green-800" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-800" },
};

export default function SellerDashboard() {
  const [showApply, setShowApply] = useState(false);
  const [showNewListing, setShowNewListing] = useState(false);
  const [applyForm, setApplyForm] = useState({ displayName: "", bio: "" });
  const [listingForm, setListingForm] = useState({
    title: "", description: "", condition: "raw_a", price: "", quantity: "1",
  });
  const [listingImages, setListingImages] = useState<string[]>([]);

  const { data: me } = trpc.auth.me.useQuery();
  const { data: sellerProfile, refetch: refetchProfile } = trpc.marketplace.getMySellerProfile.useQuery(
    undefined, { enabled: !!me }
  );
  const { data: myListings, refetch: refetchListings } = trpc.marketplace.getMyListings.useQuery(
    undefined, { enabled: !!sellerProfile }
  );
  const { data: myOrders } = trpc.marketplace.getMySellerOrders.useQuery(
    undefined, { enabled: !!sellerProfile }
  );
  const { data: myPayouts } = trpc.marketplace.getMyPayouts.useQuery(
    undefined, { enabled: !!sellerProfile }
  );
  const { data: salesStats } = trpc.marketplace.getSellerSalesStats.useQuery(
    undefined, { enabled: !!sellerProfile }
  );
  const { data: myOffers } = trpc.marketplace.getMyOffers.useQuery(
    undefined, { enabled: !!sellerProfile }
  );

  const utils = trpc.useUtils();
  const respondToOfferMutation = trpc.marketplace.respondToOffer.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'accept' ? '已接受出價' : '已拒絕出價');
      utils.marketplace.getMyOffers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const applyMutation = trpc.marketplace.applyAsSeller.useMutation({
    onSuccess: () => { toast.success("申請已提交，等待審批"); setShowApply(false); refetchProfile(); },
    onError: (e) => toast.error(e.message),
  });

  const createListingMutation = trpc.marketplace.createListing.useMutation({
    onSuccess: () => {
      toast.success("商品已提交審核");
      setShowNewListing(false);
      setListingForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1" });
      setListingImages([]);
      refetchListings();
    },
    onError: (e) => toast.error(e.message),
  });

  const stripeMutation = trpc.marketplace.startStripeConnectOnboarding.useMutation({
    onSuccess: (data) => { window.open(data.onboardingUrl, "_blank"); },
    onError: (e) => toast.error(e.message),
  });

  const [shipDialog, setShipDialog] = useState<{ open: boolean; orderId: number; orderNo: string }>({ open: false, orderId: 0, orderNo: "" });
  const [shipForm, setShipForm] = useState({ shippingMethod: "", trackingNumber: "" });
  const markShippedMutation = trpc.marketplace.markOrderShipped.useMutation({
    onSuccess: () => {
      toast.success("已標記為已寄出，已通知買家");
      setShipDialog({ open: false, orderId: 0, orderNo: "" });
      setShipForm({ shippingMethod: "", trackingNumber: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!me) return (
    <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-lg font-medium">請先登入</p>
        <Link href="/login"><Button className="mt-4">登入</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">賣家中心</h1>
            <p className="text-muted-foreground text-sm mt-1">管理你的商品、訂單和收款</p>
          </div>
          {sellerProfile?.isActive && (
            <Button onClick={() => setShowNewListing(true)} className="bg-[#06038d] hover:bg-[#0804b8] text-white">
              <Plus className="w-4 h-4 mr-2" />上架新商品
            </Button>
          )}
        </div>

        {!sellerProfile && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="w-16 h-16 mb-4 text-muted-foreground opacity-40" />
              <h2 className="text-xl font-semibold mb-2">成為 BOXIUM 賣家</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                在 BOXIUM 平台上架你的寶可夢卡牌，觸及更多買家。平台收取 5% 服務費，款項透過 Stripe 自動轉帳到你的帳戶。
              </p>
              <Button onClick={() => setShowApply(true)} className="bg-[#06038d] hover:bg-[#0804b8] text-white">
                申請成為賣家
              </Button>
            </CardContent>
          </Card>
        )}

        {sellerProfile && !sellerProfile.isActive && (
          <Card className={(sellerProfile as any).rejectReason ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
            <CardContent className="flex items-start gap-4 py-6">
              {(sellerProfile as any).rejectReason ? (
                <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-8 h-8 text-amber-600 flex-shrink-0" />
              )}
              <div>
                {(sellerProfile as any).rejectReason ? (
                  <>
                    <p className="font-medium text-red-900">申請未獲批准</p>
                    <p className="text-sm text-red-700 mt-1">原因：{(sellerProfile as any).rejectReason}</p>
                    <p className="text-xs text-red-600 mt-2">如有疑問，請聯絡平台客服。</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-amber-900">申請審批中</p>
                    <p className="text-sm text-amber-700">你的賣家申請正在審批，通常需要 1-3 個工作天。</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {sellerProfile?.isActive && (
          <>
            {sellerProfile.stripeConnectStatus !== "active" && (
              <Card className="border-blue-200 bg-blue-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900">設定 Stripe 收款帳戶</p>
                      <p className="text-sm text-blue-700">完成 Stripe Connect 設定後才能收取款項</p>
                    </div>
                  </div>
                  <Button onClick={() => stripeMutation.mutate()} disabled={stripeMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeMutation.isPending ? "處理中..." : "設定 Stripe 帳戶"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {sellerProfile.stripeConnectStatus === "active" && (
              <Card className="border-green-200 bg-green-50 mb-6">
                <CardContent className="flex items-center gap-3 py-4">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <p className="text-green-800 font-medium">Stripe 收款帳戶已連接</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{myListings?.length ?? 0}</p>
                      <p className="text-xs text-muted-foreground">上架商品</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{salesStats?.completedOrders ?? sellerProfile.totalSales}</p>
                      <p className="text-xs text-muted-foreground">已完成訂單</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">HK${(salesStats?.thisMonthRevenue ?? 0).toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">本月收益</p>
                      {salesStats && salesStats.lastMonthRevenue > 0 && (
                        <p className="text-xs mt-0.5 " style={{ color: salesStats.thisMonthRevenue >= salesStats.lastMonthRevenue ? '#22c55e' : '#ef4444' }}>
                          {salesStats.thisMonthRevenue >= salesStats.lastMonthRevenue ? '▲' : '▼'}
                          {Math.abs(((salesStats.thisMonthRevenue - salesStats.lastMonthRevenue) / salesStats.lastMonthRevenue) * 100).toFixed(0)}% 與上月比
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Star className="w-8 h-8 text-amber-500" />
                    <div>
                      <p className="text-2xl font-bold">{parseFloat(sellerProfile.avgRating as string ?? '0').toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">評分 ({sellerProfile.ratingCount} 則)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <BrandTabs defaultValue="listings">
              <BrandTabsList>
                <BrandTabsTrigger value="listings">我的商品</BrandTabsTrigger>
                <BrandTabsTrigger value="orders">訂單管理</BrandTabsTrigger>
                <BrandTabsTrigger value="offers">
                  出價洿議
                  {myOffers && myOffers.filter((o: any) => o.status === 'pending').length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-yellow-500 text-black rounded-full">
                      {myOffers.filter((o: any) => o.status === 'pending').length}
                    </span>
                  )}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="payouts">放款記錄</BrandTabsTrigger>
              </BrandTabsList>

              <BrandTabsContent value="listings" className="mt-4">
                {!myListings?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>尚未上架任何商品</p>
                    <Button className="mt-4" onClick={() => setShowNewListing(true)}>上架第一件商品</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myListings.map((listing) => {
                      let coverImg: string | null = null;
                      try {
                        const imgs = listing.images ? JSON.parse(listing.images as string) : null;
                        coverImg = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                      } catch {}
                      return (
                        <Card key={listing.id}>
                          <CardContent className="flex items-center gap-4 py-3 flex-wrap">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
                              {coverImg ? (
                                <img src={coverImg} alt={listing.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-6 h-6 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{listing.title}</p>
                              <p className="text-sm text-muted-foreground">
                                HKD {parseFloat(listing.priceHkd as string).toFixed(2)} · 庫存 {listing.quantity}
                              </p>
                            </div>
                            <Badge className={
                              listing.status === "active" ? "bg-green-100 text-green-800" :
                              listing.status === "pending_review" ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-800"
                            }>
                              {listing.status === "active" ? "上架中" :
                               listing.status === "pending_review" ? "審核中" :
                               listing.status === "sold" ? "已售出" : listing.status}
                            </Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </BrandTabsContent>

              <BrandTabsContent value="orders" className="mt-4">
                {!myOrders?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>尚無訂單</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(myOrders as any[]).map((item) => (
                      <Card key={item.id}>
                        <CardContent className="py-4 space-y-2">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.title}</p>
                              <p className="text-sm text-muted-foreground">
                                HKD {parseFloat(item.priceHkd as string).toFixed(2)} × {item.quantity}
                              </p>
                              {item.orderNo && <p className="text-xs text-muted-foreground">訂單號：{item.orderNo}</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={orderStatusLabel[item.orderStatus]?.color ?? "bg-gray-100 text-gray-800"}>
                                {orderStatusLabel[item.orderStatus]?.label ?? item.orderStatus}
                              </Badge>
                              {item.orderStatus === "processing" && (
                                <Button size="sm" className="bg-[#06038d] hover:bg-[#0804b8] text-white"
                                  onClick={() => {
                                    setShipDialog({ open: true, orderId: item.orderId, orderNo: item.orderNo ?? "" });
                                    setShipForm({ shippingMethod: "", trackingNumber: "" });
                                  }}>
                                  填寫出貨資料
                                </Button>
                              )}
                            </div>
                          </div>
                          {item.shippingName && (
                            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 space-y-0.5">
                              <p>📦 收件人：{item.shippingName} {item.shippingPhone}</p>
                              <p>📍 地址：{item.shippingAddress}</p>
                              {item.trackingNumber && <p>🚚 追蹤號：{item.trackingNumber}</p>}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </BrandTabsContent>

              <BrandTabsContent value="payouts" className="mt-4">
                {!myPayouts?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>尚無放款記錄</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(myPayouts as any[]).map((payout) => (
                      <Card key={payout.id}>
                        <CardContent className="flex items-center justify-between py-4">
                          <div>
                            <p className="font-medium">HKD {parseFloat(payout.amount).toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(payout.createdAt).toLocaleDateString("zh-HK")}
                            </p>
                          </div>
                          <Badge className={payout.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            {payout.status === "completed" ? "已放款" : "處理中"}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </BrandTabsContent>

              <BrandTabsContent value="offers" className="mt-4">
                {!myOffers?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>尚無出價洿議</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(myOffers as any[]).map((offer) => (
                      <Card key={offer.id}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{offer.listingTitle || '商品'}</p>
                              <p className="text-lg font-bold text-yellow-600 mt-0.5">HKD {parseFloat(offer.offerPriceHkd).toFixed(2)}</p>
                              {offer.message && <p className="text-xs text-muted-foreground mt-1">{offer.message}</p>}
                              <p className="text-xs text-muted-foreground mt-1">{new Date(offer.createdAt).toLocaleDateString('zh-HK')}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={
                                offer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                offer.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {offer.status === 'pending' ? '待回覆' : offer.status === 'accepted' ? '已接受' : '已拒絕'}
                              </Badge>
                              {offer.status === 'pending' && (
                                <div className="flex gap-2">
                                  <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                    disabled={respondToOfferMutation.isPending}
                                    onClick={() => respondToOfferMutation.mutate({ offerId: offer.id, action: 'accept' })}
                                  >接受</Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                    disabled={respondToOfferMutation.isPending}
                                    onClick={() => respondToOfferMutation.mutate({ offerId: offer.id, action: 'reject' })}
                                  >拒絕</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </BrandTabsContent>
            </BrandTabs>
          </>
        )}
      </div>

      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent>
          <DialogHeader><DialogTitle>申請成為賣家</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>顯示名稱 *</Label>
              <Input className="mt-1" placeholder="例如：CardMaster HK"
                value={applyForm.displayName}
                onChange={(e) => setApplyForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label>自我介紹</Label>
              <Textarea className="mt-1" placeholder="介紹你的賣家背景..."
                value={applyForm.bio}
                onChange={(e) => setApplyForm(p => ({ ...p, bio: e.target.value }))} />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium">平台服務費：5%</p>
              <p className="mt-1">款項透過 Stripe Connect 自動轉帳到你的銀行帳戶，通常 2-3 個工作天到帳。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApply(false)}>取消</Button>
            <Button className="bg-[#06038d] hover:bg-[#0804b8] text-white"
              disabled={!applyForm.displayName || applyMutation.isPending}
              onClick={() => applyMutation.mutate({ displayName: applyForm.displayName, bio: applyForm.bio || undefined })}>
              {applyMutation.isPending ? "提交中..." : "提交申請"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewListing} onOpenChange={setShowNewListing}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>上架新商品</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <ImageUploader images={listingImages} onChange={setListingImages} />
            <div>
              <Label>商品名稱 *</Label>
              <Input className="mt-1" placeholder="例如：Charizard ex 噴火龍 SAR"
                value={listingForm.title}
                onChange={(e) => setListingForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>商品描述</Label>
              <Textarea className="mt-1" placeholder="描述卡牌狀況、版本等..."
                value={listingForm.description}
                onChange={(e) => setListingForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>品相 *</Label>
                <Select value={listingForm.condition} onValueChange={(v) => setListingForm(p => ({ ...p, condition: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {conditionOptions.map(group => (
                      <div key={group.group}>
                        <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wide">{group.group}</div>
                        {group.items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>數量 *</Label>
                <Input className="mt-1" type="number" min="1" value={listingForm.quantity}
                  onChange={(e) => setListingForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>售價（HKD）*</Label>
              <Input className="mt-1" type="number" min="4" step="0.01" placeholder="最低 HKD 4.00"
                value={listingForm.price}
                onChange={(e) => setListingForm(p => ({ ...p, price: e.target.value }))} />
              {listingForm.price && parseFloat(listingForm.price) < 4.00 && (
                <p className="text-xs text-red-500 mt-1">定價不能低於 HKD 4.00（Stripe 信用卡付款最低限額）</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewListing(false)}>取消</Button>
            <Button className="bg-[#06038d] hover:bg-[#0804b8] text-white"
              disabled={!listingForm.title || !listingForm.price || parseFloat(listingForm.price) < 4.00 || createListingMutation.isPending}
              onClick={() => createListingMutation.mutate({
                title: listingForm.title,
                description: listingForm.description || undefined,
                condition: listingForm.condition as any,
                price: parseFloat(listingForm.price),
                quantity: parseInt(listingForm.quantity),
                images: listingImages.length > 0 ? listingImages : undefined,
              })}>
              {createListingMutation.isPending ? "提交中..." : "提交審核"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={shipDialog.open} onOpenChange={(o) => setShipDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>填寫出貨資料</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {shipDialog.orderNo && <p className="text-xs text-muted-foreground">訂單號：{shipDialog.orderNo}</p>}
            <div className="space-y-1.5">
              <Label>物流公司</Label>
              <Input
                placeholder="例：順豐速運、SF Express、香港郵政..."
                value={shipForm.shippingMethod}
                onChange={(e) => setShipForm(f => ({ ...f, shippingMethod: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>追蹤號碼（選填）</Label>
              <Input
                placeholder="例：SF1234567890"
                value={shipForm.trackingNumber}
                onChange={(e) => setShipForm(f => ({ ...f, trackingNumber: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShipDialog(d => ({ ...d, open: false }))}>取消</Button>
            <Button
              className="bg-[#06038d] hover:bg-[#0804b8] text-white"
              disabled={!shipForm.shippingMethod || markShippedMutation.isPending}
              onClick={() => markShippedMutation.mutate({
                orderId: shipDialog.orderId,
                shippingMethod: shipForm.shippingMethod,
                trackingNo: shipForm.trackingNumber || undefined,
              })}
            >
              {markShippedMutation.isPending ? "處理中..." : "確認出貨"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
