import React, { useState, useCallback, useRef, useEffect } from "react";
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
import { Package, ShoppingBag, DollarSign, ExternalLink, Plus, AlertCircle, CheckCircle, Clock, ImagePlus, Loader2, X, Star, Tag, Wallet, MessageSquare, Share2, Link2, Check, ImageDown, Layers, ChevronRight } from "lucide-react";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import { generateShareImage, downloadShareImage } from "@/hooks/useShareImage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
      <Label className="text-[#06038D] font-semibold">商品圖片（最多 {maxImages} 張）</Label>
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
          className="border-2 border-dashed border-[#06038D]/30 rounded-lg p-4 text-center cursor-pointer hover:border-[#06038D] hover:bg-[#06038D]/5 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-[#06038D]/60">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">上傳中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-[#06038D]/60">
              <ImagePlus className="w-6 h-6 text-[#06038D]/50" />
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
  payment_received: { label: "已收款", color: "bg-blue-100 text-blue-800" },
  processing: { label: "處理中", color: "bg-purple-100 text-purple-800" },
  shipped: { label: "已寄出", color: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "已送達", color: "bg-teal-100 text-teal-800" },
  completed: { label: "已完成", color: "bg-green-100 text-green-800" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-800" },
  disputed: { label: "爭議中", color: "bg-orange-100 text-orange-800" },
};

// ─── ShareButton ─────────────────────────────────────────────────────────────
function ShareButton({
  listingUrl, shareText, title, priceHkd, coverImg, condition
}: {
  listingUrl: string;
  shareText: string;
  title: string;
  priceHkd?: string;
  coverImg?: string | null;
  condition?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);

  const handleGenerateShareImage = async () => {
    setGeneratingImage(true);
    try {
      const dataUrl = await generateShareImage({
        title,
        priceHkd: priceHkd ?? "0",
        imageUrl: coverImg,
        condition,
      });
      downloadShareImage(dataUrl, `boxium-${title.slice(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-')}.png`);
      toast.success("分享圖片已下載！");
    } catch (err) {
      console.error(err);
      toast.error("生成圖片失敗，請稍後再試");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(listingUrl);
      setCopied(true);
      toast.success("連結已複製！");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("複製失敗，請手動複製連結");
    }
  };

  const shareOptions = [
    {
      label: "Facebook",
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
      color: "text-[#1877F2]",
      onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}&quote=${encodeURIComponent(shareText)}`, "_blank", "width=600,height=400"),
    },
    {
      label: "WhatsApp",
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
      color: "text-[#25D366]",
      onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + listingUrl)}`, "_blank"),
    },
    {
      label: "X (Twitter)",
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
      color: "text-gray-900",
      onClick: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(listingUrl)}`, "_blank", "width=600,height=400"),
    },
    {
      label: "Instagram Story",
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
      color: "text-[#E1306C]",
      onClick: () => {
        navigator.clipboard.writeText(listingUrl);
        toast.info("連結已複製！請貼到 Instagram Story 中分享");
      },
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0 border-gray-200 text-gray-500 hover:border-[#06038d] hover:text-[#06038d] hover:bg-blue-50 transition-colors"
          title="分享商品"
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-700">分享商品</p>
          <p className="text-[10px] text-gray-400 truncate mt-0.5">{title}</p>
        </div>
        {shareOptions.map((opt) => (
          <DropdownMenuItem
            key={opt.label}
            onClick={opt.onClick}
            className="flex items-center gap-2.5 cursor-pointer py-2"
          >
            <span className={opt.color}>{opt.icon}</span>
            <span className="text-sm text-gray-700">{opt.label}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleGenerateShareImage}
          disabled={generatingImage}
          className="flex items-center gap-2.5 cursor-pointer py-2"
        >
          {generatingImage ? (
            <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
          ) : (
            <ImageDown className="w-4 h-4 text-purple-500" />
          )}
          <span className="text-sm text-gray-700">
            {generatingImage ? "生成中... " : "生成分享圖片"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleCopyLink}
          className="flex items-center gap-2.5 cursor-pointer py-2"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Link2 className="w-4 h-4 text-gray-500" />
          )}
          <span className={`text-sm ${copied ? "text-green-600 font-medium" : "text-gray-700"}`}>
            {copied ? "已複製！" : "複製連結"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function SellerDashboard() {
  const [showApply, setShowApply] = useState(false);
  const [showNewListing, setShowNewListing] = useState(false);
  const [listingStep, setListingStep] = useState<1 | 2 | 3>(1);
  const [applyForm, setApplyForm] = useState({ displayName: "", bio: "" });
  const [listingForm, setListingForm] = useState({
    title: "", description: "", condition: "raw_a", price: "", quantity: "1",
    minOffer: "", acceptOffers: false,
  });
  const [listingImages, setListingImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);

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
  const { data: sellerOffers } = trpc.marketplace.getSellerOffers.useQuery(
    undefined, { enabled: !!sellerProfile, refetchInterval: 60000 }
  );
  const pendingSellerOffersCount = sellerOffers?.filter((o: any) => o.status === 'pending').length ?? 0;

  const utils = trpc.useUtils();
  const respondToOfferMutation = trpc.marketplace.respondToOffer.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'accept' ? '已接受出價' : '已拒絕出價');
      utils.marketplace.getMyOffers.invalidate();
      utils.marketplace.getSellerOffers.invalidate();
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
      setListingForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", minOffer: "", acceptOffers: false });
      setListingStep(1);
      setListingImages([]);
      setSelectedCard(null);
      refetchListings();
    },
    onError: (e) => toast.error(e.message),
  });

  const stripeMutation = trpc.marketplace.startStripeConnectOnboarding.useMutation({
    onSuccess: (data) => {
      if (!data.connectEnabled) {
        // Stripe Connect not enabled on platform - open Stripe Dashboard to enable it
        window.open("https://dashboard.stripe.com/connect", "_blank");
        toast.info("請先在 Stripe Dashboard 開通 Connect 功能，完成後返回此頁面再設定。", { duration: 8000 });
      } else {
        toast.info("正在跳轉到 Stripe 設定頁面...");
        window.open(data.onboardingUrl, "_blank");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const stripeLoginMutation = trpc.marketplace.getStripeExpressDashboardLink.useMutation({
    onSuccess: (data) => {
      toast.info("正在跳轉到 Stripe Express Dashboard...");
      window.open(data.url, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });

  const syncStripeMutation = trpc.marketplace.syncStripeConnectStatus.useMutation({
    onSuccess: (data) => {
      if (data.status !== sellerProfile?.stripeConnectStatus) {
        refetchProfile();
      }
    },
  });

  // Auto-sync Stripe status on load if seller has a connectId
  useEffect(() => {
    if (sellerProfile?.stripeConnectId && sellerProfile.stripeConnectStatus !== "active") {
      syncStripeMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerProfile?.id]);

  const [shipDialog, setShipDialog] = useState<{ open: boolean; orderId: number; orderNo: string }>({ open: false, orderId: 0, orderNo: "" });
  const [shipForm, setShipForm] = useState({ shippingMethod: "sf_express", trackingNumber: "" });
  const CARRIERS = [
    { value: "sf_express", label: "順豐速運 (SF Express)", trackingUrl: "https://www.sf-express.com/hk/tc/dynamic_function/waybill/#search/bill-number/" },
    { value: "hkpost", label: "香港郵政 (HK Post)", trackingUrl: "https://www.hongkongpost.hk/en/mail_tracking/index.html?tracking_no=" },
    { value: "dhl", label: "DHL", trackingUrl: "https://www.dhl.com/hk-en/home/tracking.html?tracking-id=" },
    { value: "fedex", label: "FedEx", trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=" },
    { value: "ups", label: "UPS", trackingUrl: "https://www.ups.com/track?tracknum=" },
    { value: "chunghwa_post", label: "中華郵政", trackingUrl: "https://postserv.post.gov.tw/pstmail/main_mail.jsp?targetTxn=EB100&query_type=1&searchItem=" },
    { value: "black_cat", label: "黑貓宅急", trackingUrl: "https://www.t-cat.com.tw/Inquire/Trace.aspx?no=" },
    { value: "other", label: "其他", trackingUrl: null },
  ];
  const markShippedMutation = trpc.marketplace.markOrderShipped.useMutation({
    onSuccess: () => {
      toast.success("已標記為已寄出，已通知買家");
      setShipDialog({ open: false, orderId: 0, orderNo: "" });
      setShipForm({ shippingMethod: "", trackingNumber: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!me) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-lg font-medium">請先登入</p>
        <Link href="/login"><Button className="mt-4">登入</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero Banner ── */}
      <div
        className="relative"
        style={{ background: `linear-gradient(135deg, #06038d 0%, #0a06b5 100%)` }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-8">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0"
              style={{ background: "#FEDD00", borderColor: "white" }}
            >
              <ShoppingBag className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <div className="text-center md:text-left pb-1 flex-1">
              <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-white">賣家中心</h1>
                {sellerProfile?.isActive && (
                  <Button onClick={() => setShowNewListing(true)} className="text-sm font-bold" style={{ background: "#FEDD00", color: "#06038d" }}>
                    <Plus className="w-4 h-4 mr-1" />上架新商品
                  </Button>
                )}
              </div>
              <p className="text-white/70 text-sm mt-1">管理你的商品、訂單和收款</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 pb-16">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-6">

        {!sellerProfile && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "#f0f4ff" }}>
              <ShoppingBag className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#06038d" }}>成為 BOXIUM 賣家</h2>
            <p className="text-gray-500 mb-6 max-w-md">
              在 BOXIUM 平台上架你的寶可夢卡牡，觸及更多買家。平台收取 5% 服務費，款項透過 Stripe 自動轉帳到你的帳戶。
            </p>
            <Button onClick={() => setShowApply(true)} className="bg-[#06038d] hover:bg-[#0804b8] text-white font-bold">
              申請成為賣家
            </Button>
          </div>
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
            {sellerProfile.stripeConnectStatus === "pending" && !sellerProfile.stripeConnectId && (
              <Card className="border-blue-200 bg-blue-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900">設定 Stripe 收款帳戶</p>
                      <p className="text-sm text-blue-700">完成 Stripe Connect 設定後才能收取款項。平台將透過 Stripe 自動轉帳給你。</p>
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
            {sellerProfile.stripeConnectStatus === "pending" && sellerProfile.stripeConnectId && (
              <Card className="border-amber-200 bg-amber-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-900">Stripe 帳戶驗證中</p>
                      <p className="text-sm text-amber-700">你的 Stripe Express 帳戶已連結，正在等待 Stripe 完成驗證。驗證完成後即可自動收款。</p>
                    </div>
                  </div>
                  <Button onClick={() => stripeMutation.mutate()} disabled={stripeMutation.isPending}
                    variant="outline" className="border-amber-600 text-amber-700 hover:bg-amber-100">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeMutation.isPending ? "處理中..." : "繼續完成驗證"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {sellerProfile.stripeConnectStatus === "restricted" && (
              <Card className="border-yellow-200 bg-yellow-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-900">Stripe 帳戶需要補充資料</p>
                      <p className="text-sm text-yellow-700">你的 Stripe Connect 帳戶尚未完成驗證，請繼續完成設定流程。</p>
                    </div>
                  </div>
                  <Button onClick={() => stripeMutation.mutate()} disabled={stripeMutation.isPending}
                    variant="outline" className="border-yellow-600 text-yellow-700 hover:bg-yellow-100">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeMutation.isPending ? "處理中..." : "繼續完成設定"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {sellerProfile.stripeConnectStatus === "disabled" && (
              <Card className="border-red-200 bg-red-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-900">Stripe 帳戶已停用</p>
                      <p className="text-sm text-red-700">你的 Stripe Connect 帳戶已被停用，請聯絡 Stripe 支援或重新申請。</p>
                    </div>
                  </div>
                  <Button onClick={() => stripeMutation.mutate()} disabled={stripeMutation.isPending}
                    variant="outline" className="border-red-600 text-red-700 hover:bg-red-100">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeMutation.isPending ? "處理中..." : "重新設定"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {sellerProfile.stripeConnectStatus === "active" && (
              <Card className="border-green-200 bg-green-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-green-800 font-medium">Stripe 收款帳戶已啟用 ✅</p>
                      <p className="text-sm text-green-700">買家付款後，平台將自動透過 Stripe 轉帳至你的帳戶（扣除 5% 平台服務費）。</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => stripeLoginMutation.mutate()}
                    disabled={stripeLoginMutation.isPending}
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-100"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeLoginMutation.isPending ? "處理中..." : "管理收款帳戶"}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-gray-100 shadow-sm p-4" style={{ background: "#f8faff" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#e8edff" }}>
                    <Package className="w-5 h-5" style={{ color: "#06038d" }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{myListings?.length ?? 0}</p>
                    <p className="text-xs text-gray-500">上架商品</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 shadow-sm p-4" style={{ background: "#f8faff" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#e8edff" }}>
                    <ShoppingBag className="w-5 h-5" style={{ color: "#06038d" }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{salesStats?.completedOrders ?? sellerProfile.totalSales}</p>
                    <p className="text-xs text-gray-500">已完成訂單</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 shadow-sm p-4" style={{ background: "#f8faff" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#fff8e0" }}>
                    <DollarSign className="w-5 h-5" style={{ color: "#b8860b" }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "#06038d" }}>HK${(salesStats?.thisMonthRevenue ?? 0).toFixed(0)}</p>
                    <p className="text-xs text-gray-500">本月收益</p>
                      {salesStats && salesStats.lastMonthRevenue > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: salesStats.thisMonthRevenue >= salesStats.lastMonthRevenue ? '#22c55e' : '#ef4444' }}>
                          {salesStats.thisMonthRevenue >= salesStats.lastMonthRevenue ? '▲' : '▼'}
                          {Math.abs(((salesStats.thisMonthRevenue - salesStats.lastMonthRevenue) / salesStats.lastMonthRevenue) * 100).toFixed(0)}% 與上月比
                        </p>
                      )}
                    </div>
                  </div>
              </div>
              <div className="rounded-xl border border-gray-100 shadow-sm p-4" style={{ background: "#f8faff" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#fff8e0" }}>
                    <Star className="w-5 h-5" style={{ color: "#b8860b" }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{parseFloat(sellerProfile.avgRating as string ?? '0').toFixed(1)}</p>
                    <p className="text-xs text-gray-500">評分 ({sellerProfile.ratingCount} 則)</p>
                  </div>
                </div>
              </div>
            </div>

            <BrandTabs defaultValue="listings">
              <BrandTabsList>
                <BrandTabsTrigger value="listings" icon={<Package className="w-4 h-4" />} label="我的商品">我的商品</BrandTabsTrigger>
                <BrandTabsTrigger value="orders" icon={<ShoppingBag className="w-4 h-4" />} label="訂單管理">訂單管理</BrandTabsTrigger>
                <BrandTabsTrigger value="offers" icon={<MessageSquare className="w-4 h-4" />} label="出價洿議">
                  出價洿議
                  {pendingSellerOffersCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {pendingSellerOffersCount > 99 ? '99+' : pendingSellerOffersCount}
                    </span>
                  )}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="payouts" icon={<Wallet className="w-4 h-4" />} label="放款記錄">放款記錄</BrandTabsTrigger>
              </BrandTabsList>

              <BrandTabsContent value="listings" className="mt-4">
                {!myListings?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>尚未上架任何商品</p>
                    <Button className="mt-4 bg-[#06038d] hover:bg-[#0804b8] text-white" onClick={() => setShowNewListing(true)}>上架第一件商品</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myListings.map((listing) => {
                      let coverImg: string | null = null;
                      try {
                        const imgs = listing.images ? JSON.parse(listing.images as string) : null;
                        coverImg = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                      } catch {}
                      const isSold = listing.status === "sold";
                      const listingUrl = `${window.location.origin}/marketplace/${listing.id}`;
                      const shareText = `「${listing.title}」 HKD ${parseFloat(listing.priceHkd as string).toFixed(2)} - BOXIUM PTCG`;
                      return (
                        <div key={listing.id} className={`bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden${isSold ? " opacity-80" : ""}`}>
                          {/* Brand Header Bar */}
                          <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                            <span className="text-xs text-white/80 font-medium">庫存 {listing.quantity}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              listing.status === "active" ? "bg-green-400/20 text-green-200 border border-green-400/30" :
                              listing.status === "pending_review" ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/30" :
                              listing.status === "sold" ? "bg-blue-400/20 text-blue-200 border border-blue-400/30" :
                              "bg-white/20 text-white/70 border border-white/30"
                            }`}>
                              {listing.status === "active" ? "上架中" :
                               listing.status === "pending_review" ? "審核中" :
                               listing.status === "sold" ? "已售出" : listing.status}
                            </span>
                          </div>
                          {/* Card Body */}
                          <div className="flex items-center gap-4 p-4 flex-wrap">
                            <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                              {coverImg ? (
                                <img src={coverImg} alt={listing.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-white font-black text-[9px] tracking-tight text-center leading-tight">BOX<br/>IUM</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate text-gray-900">{listing.title}</p>
                              <p className="text-sm text-gray-600 mt-0.5">
                                HKD {parseFloat(listing.priceHkd as string).toFixed(2)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isSold && (
                                <Link href={`/marketplace/${listing.id}`}>
                                  <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-[#06038d] text-[#06038d] hover:bg-blue-50">查看詳情</Button>
                                </Link>
                              )}
                              {/* Share Button */}
                              <ShareButton
                                listingUrl={listingUrl}
                                shareText={shareText}
                                title={listing.title}
                                priceHkd={listing.priceHkd as string}
                                coverImg={coverImg}
                                condition={listing.condition ?? undefined}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </BrandTabsContent>

              <BrandTabsContent value="orders" className="mt-4">
                {!myOrders?.length ? (
                  <div className="text-center py-12 text-gray-400">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>尚無訂單</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(myOrders as any[]).map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                        {/* Brand Header Bar */}
                        <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                          <span className="text-xs text-white/80 font-medium">
                            {item.orderNo ? `#${item.orderNo}` : `#${item.id}`}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.orderStatus === "completed" ? "bg-green-400/20 text-green-200 border border-green-400/30" :
                            item.orderStatus === "payment_received" ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/30" :
                            item.orderStatus === "shipped" ? "bg-blue-400/20 text-blue-200 border border-blue-400/30" :
                            item.orderStatus === "disputed" ? "bg-red-400/20 text-red-200 border border-red-400/30" :
                            "bg-white/20 text-white/70 border border-white/30"
                          }`}>
                            {orderStatusLabel[item.orderStatus]?.label ?? item.orderStatus}
                          </span>
                        </div>
                        {/* Card Body */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate text-gray-900">{item.title}</p>
                              <p className="text-sm text-gray-600 mt-0.5">
                                HKD {parseFloat(item.priceHkd as string).toFixed(2)} × {item.quantity}
                              </p>
                            </div>
                            {(["processing", "payment_received"].includes(item.orderStatus)) && (
                              <Button size="sm" className="bg-[#06038d] hover:bg-[#0804b8] text-white flex-shrink-0"
                                onClick={() => {
                                  setShipDialog({ open: true, orderId: item.orderId ?? item.id, orderNo: item.orderNo ?? "" });
                                  setShipForm({ shippingMethod: "sf_express", trackingNumber: "" });
                                }}>
                                填寫出貨資料
                              </Button>
                            )}
                          </div>
                          {item.shippingName && (
                            <div className="text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                              <p>📦 收件人：{item.shippingName} {item.shippingPhone}</p>
                              <p>📍 地址：{(() => {
                                try {
                                  const addr = typeof item.shippingAddress === 'string' ? JSON.parse(item.shippingAddress) : item.shippingAddress;
                                  if (addr && typeof addr === 'object') {
                                    const parts = [addr.address, addr.district, addr.region].filter(Boolean);
                                    return parts.join(', ');
                                  }
                                  return item.shippingAddress;
                                } catch {
                                  return item.shippingAddress;
                                }
                              })()}</p>
                              {item.trackingNumber && <p>🚚 追蹤號：{item.trackingNumber}</p>}
                            </div>
                          )}
                        </div>
                      </div>
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
                            <p className="font-medium">HKD {parseFloat(payout.amountHkd ?? payout.amount ?? 0).toFixed(2)}</p>
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
                              {offer.message && <p className="text-xs text-gray-700 mt-1">{offer.message}</p>}
                              <p className="text-xs text-gray-500 mt-1">{new Date(offer.createdAt).toLocaleDateString('zh-HK')}</p>
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
      </div>
      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent bottomSheet className="sm:max-w-md">
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

      <Dialog open={showNewListing} onOpenChange={(open) => { setShowNewListing(open); if (!open) setListingStep(1); }}>
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
          {/* Step Header */}
          <div className="px-5 pt-5 pb-4" style={{backgroundColor: '#06038D', borderBottom: '3px solid #FEDD00'}}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">上架新商品</h2>
              <button onClick={() => setShowNewListing(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Step Indicator */}
            <div className="flex items-center gap-0">
              {[{ n: 1, label: "基本資料" }, { n: 2, label: "定價設定" }, { n: 3, label: "確認上架" }].map(({ n, label }, idx) => (
                <React.Fragment key={n}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      listingStep > n ? "bg-[#FEDD00] text-[#06038D]" :
                      listingStep === n ? "bg-[#FEDD00] text-[#06038D] ring-4 ring-[#FEDD00]/30" :
                      "bg-white/20 text-white/50"
                    }`}>
                      {listingStep > n ? <Check className="w-3.5 h-3.5" /> : n}
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${
                      listingStep >= n ? "text-[#FEDD00]" : "text-white/40"
                    }`}>{label}</span>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${
                      listingStep > n ? "bg-[#FEDD00]" : "bg-white/20"
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-white">

            {/* Step 1: Basic Info */}
            {listingStep === 1 && (
              <>
                <ImageUploader images={listingImages} onChange={setListingImages} />
                {/* Card Picker */}
                <div>
                  <Label className="text-[#06038D] font-semibold">關聯卡牌（選填）</Label>
                  {selectedCard ? (
                    <div className="mt-1 flex items-center gap-3 p-2.5 rounded-lg border border-[#06038D]/30 bg-[#06038D]/5">
                      {selectedCard.imageUrl ? (
                        <img src={selectedCard.imageUrl} alt={selectedCard.name} className="w-10 h-14 object-cover rounded-md border border-gray-200 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Layers className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#06038D] truncate">{selectedCard.name}</p>
                        {selectedCard.nameJa && selectedCard.nameJa !== selectedCard.name && (
                          <p className="text-xs text-gray-500 truncate">{selectedCard.nameJa}</p>
                        )}
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {selectedCard.cardNumber && <span className="text-[10px] text-gray-400">{selectedCard.cardNumber}</span>}
                          {selectedCard.rarity && <span className="text-[10px] text-[#06038D]/70">{selectedCard.rarity}</span>}
                        </div>
                        {selectedCard.referencePrice && (
                          <p className="text-[10px] text-[#06038D]/80 font-medium mt-0.5">市場均價 HKD {parseFloat(String(selectedCard.referencePrice)).toFixed(0)}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[#06038D] hover:bg-[#06038D]/10" onClick={() => setShowCardPicker(true)}>改變</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500" onClick={() => setSelectedCard(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mt-1 w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-dashed border-[#06038D]/30 text-sm text-[#06038D]/60 hover:border-[#06038D] hover:text-[#06038D] hover:bg-[#06038D]/5 transition-colors"
                      onClick={() => setShowCardPicker(true)}
                    >
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        點擊搜索並關聯卡牌
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <Label className="text-[#06038D] font-semibold">商品名稱 *</Label>
                  <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" placeholder="例如：Charizard ex 噴火龍 SAR"
                    value={listingForm.title}
                    onChange={(e) => setListingForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[#06038D] font-semibold">商品描述</Label>
                  <Textarea className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" placeholder="描述卡牌狀況、版本等..."
                    value={listingForm.description}
                    onChange={(e) => setListingForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[#06038D] font-semibold">品相 *</Label>
                    <Select value={listingForm.condition} onValueChange={(v) => setListingForm(p => ({ ...p, condition: v }))}>
                      <SelectTrigger className="mt-1 bg-white border-[#06038D]/30 text-[#06038D]"><SelectValue /></SelectTrigger>
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
                    <Label className="text-[#06038D] font-semibold">數量 *</Label>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] focus:border-[#06038D]" type="number" min="1" value={listingForm.quantity}
                      onChange={(e) => setListingForm(p => ({ ...p, quantity: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Pricing */}
            {listingStep === 2 && (
              <>
                <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3.5">
                  <p className="text-xs font-semibold text-[#06038D] mb-1">商品摘要</p>
                  <p className="text-sm font-bold text-[#06038D] truncate">{listingForm.title}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-[#06038D]/60">{conditionOptions.flatMap(g => g.items).find(i => i.value === listingForm.condition)?.label ?? listingForm.condition}</span>
                    <span className="text-xs text-[#06038D]/40">·</span>
                    <span className="text-xs text-[#06038D]/60">數量 {listingForm.quantity}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-[#06038D] font-semibold">售價（HKD）*</Label>
                  {selectedCard?.referencePrice && (
                    <p className="text-xs text-[#06038D]/70 mt-0.5 mb-1">參考市場均價：HKD {parseFloat(String(selectedCard.referencePrice)).toFixed(0)}</p>
                  )}
                  <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="4" step="0.01" placeholder="最低 HKD 4.00"
                    value={listingForm.price}
                    onChange={(e) => setListingForm(p => ({ ...p, price: e.target.value }))} />
                  {listingForm.price && parseFloat(listingForm.price) < 4.00 && (
                    <p className="text-xs text-red-400 mt-1">定價不能低於 HKD 4.00（Stripe 信用卡付款最低限額）</p>
                  )}
                  {listingForm.price && parseFloat(listingForm.price) >= 4 && selectedCard?.referencePrice && (() => {
                    const diff = ((parseFloat(listingForm.price) - parseFloat(String(selectedCard.referencePrice))) / parseFloat(String(selectedCard.referencePrice))) * 100;
                    return (
                      <p className={`text-xs mt-1 ${diff < -15 ? "text-amber-600" : diff > 15 ? "text-green-600" : "text-gray-500"}`}>
                        {diff > 0 ? `高於市場均價 ${diff.toFixed(0)}%` : `低於市場均價 ${Math.abs(diff).toFixed(0)}%`}
                      </p>
                    );
                  })()}
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[#06038D]/20 bg-[#06038D]/5">
                    <div>
                      <p className="text-sm font-medium text-[#06038D]">接受出價洿議</p>
                      <p className="text-xs text-[#06038D]/50">買家可提交低於定價的出價</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setListingForm(p => ({ ...p, acceptOffers: !p.acceptOffers }))}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        listingForm.acceptOffers ? "bg-[#FEDD00]" : "bg-gray-200"
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform ${
                        listingForm.acceptOffers ? "translate-x-5.5 left-0.5 bg-[#06038D]" : "left-0.5 bg-white"
                      }`} />
                    </button>
                  </div>
                  {listingForm.acceptOffers && (
                    <div>
                      <Label className="text-[#06038D] font-semibold">最低接受出價（HKD，選填）</Label>
                      <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="4" step="0.01" placeholder="留空表示不設下限"
                        value={listingForm.minOffer}
                        onChange={(e) => setListingForm(p => ({ ...p, minOffer: e.target.value }))} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 3: Confirm */}
            {listingStep === 3 && (
              <>
                <div className="space-y-3">
                  {listingImages.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {listingImages.map((url, i) => (
                        <img key={i} src={url} alt={`圖片 ${i+1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                      ))}
                    </div>
                  )}
                    <div className="rounded-xl border border-[#06038D]/20 divide-y divide-[#06038D]/10 overflow-hidden bg-white">
                    <div className="flex items-start justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">商品名稱</span>
                      <span className="text-sm font-medium text-[#06038D] text-right">{listingForm.title}</span>
                    </div>
                    {selectedCard && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">關聯卡牌</span>
                        <span className="text-sm text-[#06038D] text-right">{selectedCard.name}</span>
                      </div>
                    )}
                    {listingForm.description && (
                      <div className="flex items-start justify-between px-4 py-3">
                        <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">描述</span>
                        <span className="text-sm text-[#06038D]/80 text-right line-clamp-3">{listingForm.description}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">品相</span>
                      <span className="text-sm text-[#06038D]">{conditionOptions.flatMap(g => g.items).find(i => i.value === listingForm.condition)?.label ?? listingForm.condition}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">數量</span>
                      <span className="text-sm text-[#06038D]">{listingForm.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">售價</span>
                      <span className="text-base font-bold text-[#06038D]">HKD {parseFloat(listingForm.price || "0").toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">出價洿議</span>
                      <span className="text-sm text-[#06038D]">{listingForm.acceptOffers ? `接受${listingForm.minOffer ? `（最低 HKD ${listingForm.minOffer}）` : ""}` : "不接受"}</span>
                    </div>
                  </div>
                  <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-xs text-[#06038D]">
                    <p className="font-medium">提交後等待審核</p>
                    <p className="mt-0.5">商品將在管理員審核通過後公開顯示，通常需要 1-2 個工作天。</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="px-5 py-4 flex gap-2 bg-white" style={{borderTop: '1px solid rgba(6,3,141,0.15)'}}>
            {listingStep === 1 && (
              <Button variant="outline" className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white" onClick={() => setShowNewListing(false)}>取消</Button>
            )}
            {listingStep > 1 && (
              <Button variant="outline" className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white" onClick={() => setListingStep(s => (s - 1) as 1 | 2 | 3)}>上一步</Button>
            )}
            {listingStep < 3 && (
              <Button
                className="flex-1 bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
                disabled={listingStep === 1 ? !listingForm.title : (listingStep === 2 ? (!listingForm.price || parseFloat(listingForm.price) < 4.00) : false)}
                onClick={() => setListingStep(s => (s + 1) as 1 | 2 | 3)}
              >
                下一步
              </Button>
            )}
            {listingStep === 3 && (
              <Button
                className="flex-1 bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
                disabled={createListingMutation.isPending}
                onClick={() => createListingMutation.mutate({
                  title: listingForm.title,
                  description: listingForm.description || undefined,
                  condition: listingForm.condition as any,
                  price: parseFloat(listingForm.price),
                  quantity: parseInt(listingForm.quantity),
                  images: listingImages.length > 0 ? listingImages : undefined,
                  cardId: selectedCard?.id ?? undefined,
                  minOfferHkd: listingForm.acceptOffers && listingForm.minOffer ? parseFloat(listingForm.minOffer) : undefined,
                })}
              >
                {createListingMutation.isPending ? "提交中..." : "提交審核"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Picker Dialog */}
      <CardPickerDialog
        open={showCardPicker}
        onOpenChange={setShowCardPicker}
        selectedCardId={selectedCard?.id ?? null}
        onSelect={(card) => {
          setSelectedCard(card);
          // Auto-fill title if empty
          if (!listingForm.title.trim()) {
            setListingForm(p => ({ ...p, title: card.name }));
          }
        }}
      />

      {/* Ship Dialog */}
      <Dialog open={shipDialog.open} onOpenChange={(o) => setShipDialog(d => ({ ...d, open: o }))}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>填寫出貨資料</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {shipDialog.orderNo && <p className="text-xs text-muted-foreground">訂單號：{shipDialog.orderNo}</p>}
            <div className="space-y-1.5">
              <Label>物流公司 <span className="text-red-500">*</span></Label>
              <Select value={shipForm.shippingMethod} onValueChange={(v) => setShipForm(f => ({ ...f, shippingMethod: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇物流公司" /></SelectTrigger>
                <SelectContent>
                  {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>追蹤號碼 <span className="text-red-500">*</span></Label>
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
              disabled={!shipForm.shippingMethod || !shipForm.trackingNumber || markShippedMutation.isPending}
              onClick={() => markShippedMutation.mutate({
                orderId: shipDialog.orderId,
                shippingMethod: shipForm.shippingMethod,
                trackingNo: shipForm.trackingNumber,
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
