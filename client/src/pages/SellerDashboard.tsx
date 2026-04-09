import React, { useState, useCallback, useRef, useEffect } from "react";
import { parseApiError } from "@/lib/parseApiError";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";
import { OrderStatusStepper } from "@/components/OrderStatusStepper";
import OrderChat from "@/components/OrderChat";
import { Package, ShoppingBag, DollarSign, ExternalLink, Plus, AlertCircle, CheckCircle, Clock, ImagePlus, Loader2, X, Star, Tag, Wallet, MessageSquare, Share2, Link2, Check, ImageDown, Layers, ChevronRight, Pencil, EyeOff, Eye, Trash2, CheckSquare, Square, ChevronDown, Phone, Users, Info, Gavel } from "lucide-react";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import { ImageLightbox } from "@/components/ImageLightbox";
import { generateShareImage, downloadShareImage } from "@/hooks/useShareImage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
// ─── PayoutProofThumbnail ────────────────────────────────────────────────────
function PayoutProofThumbnail({ url }: { url: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block mt-1 group relative w-20 h-14 rounded overflow-hidden border border-gray-200 hover:border-[#06038d] transition-colors"
        title={t("seller.payoutProof.viewAction")}
      >
        <img src={url} alt={t("seller.payoutProof.altText")} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </button>
      <p className="text-xs text-gray-500 mt-0.5">{t("seller.payoutProof.zoomHint")}</p>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-700 hover:bg-gray-100 z-10"
            >
              ×
            </button>
            <img src={url} alt={t("seller.payoutProof.altText")} className="max-w-full max-h-[85vh] rounded-lg shadow-xl object-contain" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center mt-2 text-xs text-white/70 hover:text-white underline"
            >
              在新標籤頁開啟原圖
            </a>
          </div>
        </div>
      )}
    </>
  );
}

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
  const { t } = useTranslation();
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
      <Label className="text-[#06038D] font-semibold">{t("seller.imageUploader.label")}</Label>
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              <img src={url} alt={`商品圖 ${idx + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
              {idx === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">{t("seller.imageUploader.coverPhoto")}</span>}
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
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">{t("seller.imageUploader.uploading")}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-[#06038D]/60">
              <ImagePlus className="w-6 h-6 text-[#06038D]/50" />
              <span className="text-sm">{t("seller.imageUploader.cta")}</span>
              <span className="text-xs">{t("seller.imageUploader.fileInfo")}</span>
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
  paid_held: { label: "已付款，請出貨", color: "bg-blue-100 text-blue-800" },
  payment_received: { label: "已收款，請出貨", color: "bg-blue-100 text-blue-800" },
  processing: { label: "處理中，請出貨", color: "bg-purple-100 text-purple-800" },
  shipped: { label: "已寄出", color: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "已送達", color: "bg-teal-100 text-teal-800" },
  completed: { label: "已完成", color: "bg-green-100 text-green-800" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-800" },
  disputed: { label: "爭議中", color: "bg-orange-100 text-orange-800" },
};

// ─── SellerShippingProof ────────────────────────────────────────────────────
function SellerShippingProof({ url }: { url: string }) {
  const { t } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return (
    <>
      <div className="mt-1.5">
        <p className="text-xs text-indigo-600 font-medium mb-1">{t("seller.shippingProof.label")}</p>
        <button
          onClick={() => setLightboxOpen(true)}
          className="relative group w-24 h-16 rounded-lg overflow-hidden border border-indigo-200 hover:border-[#06038d] transition-colors block"
          title={t("seller.shippingProof.zoomAction")}
        >
          <img src={url} alt="出貨憑證" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </button>
      </div>
      <ImageLightbox src={url} alt="出貨憑證" isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
}

// ─── SellerOrderStepper ─────────────────────────────────────────────────────
function SellerOrderStepper({ item }: { item: any }) {
  const [showStep, setShowStep] = useState(false);
  const statusText = (() => {
    const s = item.orderStatus;
    if (s === 'pending_payment') return '待買家付款';
    if (s === 'payment_review' || s === 'payment_submitted' || s === 'alipay_pending') return '付款審核中';
    if (s === 'paid' || s === 'paid_held' || s === 'payment_received' || s === 'processing') return '已收款，請出貨';
    if (s === 'shipped') return '已寄出，等待買家確認';
    if (s === 'delivered') return '買家確認收貨中';
    if (s === 'completed') return '訂單已完成';
    if (s === 'cancelled') return '訂單已取消';
    if (s === 'dispute' || s === 'disputed') return '爭議處理中';
    if (s === 'refunded') return '已退款';
    if (s === 'meetup_pending') return '等待面交';
    if (s === 'meetup_completed') return '面交已完成';
    return s;
  })();
  const isTerminal = ['completed', 'cancelled', 'refunded', 'meetup_completed'].includes(item.orderStatus);
  const isDispute = ['dispute', 'disputed'].includes(item.orderStatus);
  return (
    <div>
      <button
        className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-blue-50/60 border border-blue-100 hover:bg-blue-50 transition-colors group"
        onClick={() => setShowStep(s => !s)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isTerminal ? 'bg-green-500' :
            isDispute ? 'bg-orange-400' :
            item.orderStatus === 'cancelled' ? 'bg-red-400' :
            'bg-[#06038d] animate-pulse'
          }`} />
          <span className="text-xs font-medium text-[#06038d]">{statusText}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-[#06038d] transition-colors">
          <span>{showStep ? '收起' : '查看進度'}</span>
          {showStep ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>
      {showStep && (
        <div className="mt-2 pt-2 border-t border-blue-100">
          <OrderStatusStepper
            orderStatus={item.orderStatus}
            shippingMethod={item.shippingMethod}
            role="seller"
          />
        </div>
      )}
    </div>
  );
}

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

// ─── EarningsTab ─────────────────────────────────────────────────────────────
function EarningsTab() {
  const { t } = useTranslation();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: sellerProfile } = trpc.marketplace.getMySellerProfile.useQuery(
    undefined, { enabled: !!me }
  );
  const isAdmin = me?.role === 'admin';
   const { data: earningsData, isLoading } = trpc.marketplace.getSellerEarnings.useQuery(
    undefined, { enabled: !!sellerProfile || isAdmin }
  );
  const { data: salesStats } = trpc.marketplace.getSellerSalesStats.useQuery(
    undefined, { enabled: !!sellerProfile || isAdmin }
  );
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#06038d]" />
      </div>
    );
  }

   const summary = earningsData?.summary ?? { totalRevenue: 0, totalFees: 0, totalEarnings: 0, completedCount: 0, pendingCount: 0 };
  const orders = earningsData?.orders ?? [];
  const monthlyData = (salesStats as any)?.monthlyData ?? [];
  const pendingPayoutAmount = (salesStats as any)?.pendingPayoutAmount ?? 0;
  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          以下為平台透過 Stripe 轉帳至你帳戶的收款記錄。所有金額均已扣除 5% 平台手續費。如有疑問請聯絡客服。
        </p>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">{t("seller.stats.completedOrders")}</p>
          <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{summary.completedCount}</p>
          <p className="text-xs text-gray-400 mt-1">待出貨/運送中 {summary.pendingCount} 筆</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">累計销售額</p>
          <p className="text-2xl font-bold" style={{ color: "#06038d" }}>HKD {summary.totalRevenue.toFixed(0)}</p>
          <p className="text-xs text-gray-400 mt-1">平台手續費 HKD {summary.totalFees.toFixed(0)}</p>
        </div>
         <div className="col-span-2 bg-gradient-to-r from-[#06038d] to-[#0a06b5] rounded-2xl shadow-md p-4">
          <p className="text-xs text-white/70 mb-1">累計淨收入</p>
          <p className="text-3xl font-bold text-white">HKD {summary.totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-white/60 mt-1">扣除平台手續費後實際收款金額</p>
        </div>
        {pendingPayoutAmount > 0 && (
          <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-amber-600" />
              <p className="text-xs text-amber-700 font-medium">待收款金額（進行中訂單）</p>
            </div>
            <p className="text-2xl font-bold text-amber-700">HKD {pendingPayoutAmount.toFixed(2)}</p>
            <p className="text-xs text-amber-600 mt-1">訂單完成後轉入累計淨收入</p>
          </div>
        )}
      </div>
      {/* Monthly Revenue Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">近 6 個月收益趨勢</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `$${v}`} width={48} />
              <Tooltip
                formatter={(value: number) => [`HKD ${value.toFixed(0)}`, '淨收入']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Bar dataKey="revenue" fill="#06038d" radius={[4, 4, 0, 0]} name={t("seller.completedOrders.netIncome")} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>已完成訂單數：{monthlyData.reduce((s: number, m: any) => s + m.orders, 0)} 筆</span>
            <span>本月：{monthlyData[monthlyData.length - 1]?.orders ?? 0} 筆</span>
          </div>
        </div>
      )}
      {/* Orders List */}
      {!orders.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>尚無已完成訂單</p>
          <p className="text-sm mt-1">訂單完成後將顯示收款明細</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">收款明細（{orders.length} 筆）</p>
          {(orders as any[]).map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              {/* Brand Header Bar */}
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                <span className="text-xs text-white/80 font-medium">訂單 #{order.orderNo ?? order.id}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/20 text-green-200 border border-green-400/30">
                  已完成
                </span>
              </div>
              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Product Info */}
                <div className="flex items-start gap-3">
                  {(() => {
                    let imgUrl: string | null = null;
                    try {
                      const imgs = typeof order.listingImages === 'string'
                        ? JSON.parse(order.listingImages)
                        : order.listingImages;
                      if (Array.isArray(imgs) && imgs.length > 0) imgUrl = imgs[0];
                    } catch {}
                    return imgUrl ? (
                      <img src={imgUrl} alt={order.title || '商品'} className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{order.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      完成日期：{order.completedAt ? new Date(order.completedAt).toLocaleDateString('zh-HK') : new Date(order.updatedAt).toLocaleDateString('zh-HK')}
                    </p>
                  </div>
                </div>
                {/* Price Breakdown */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t("seller.completedOrders.orderAmount")}</span>
                    <span className="font-medium">HKD {parseFloat(order.subtotalHkd ?? '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">平台手續費 ({parseFloat(order.platformFeeRate ?? '0.05') * 100}%)</span>
                    <span className="text-red-500">- HKD {parseFloat(order.platformFeeHkd ?? '0').toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-1.5 flex justify-between">
                    <span className="font-semibold text-gray-800">{t("seller.completedOrders.netIncome")}</span>
                    <span className="font-bold text-green-600">HKD {parseFloat(order.sellerReceivableHkd ?? order.subtotalHkd ?? '0').toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SellerAuctionsTab ────────────────────────────────────────
function EditRejectedAuctionDialog({
  auction,
  open,
  onClose,
  onSaved,
}: {
  auction: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(auction?.title ?? '');
  const [description, setDescription] = useState(auction?.description ?? '');
  const [condition, setCondition] = useState(auction?.condition ?? 'raw_a');
  const [images, setImages] = useState<string[]>(() => {
    try {
      if (Array.isArray(auction?.imageUrls) && auction.imageUrls.length > 0) return auction.imageUrls;
      const parsed = typeof auction?.images === 'string' ? JSON.parse(auction.images) : auction?.images;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  const [startingBid, setStartingBid] = useState(String(auction?.startingBid ?? ''));
  const [bidIncrement, setBidIncrement] = useState(String(auction?.bidIncrement ?? '10'));
  const [buyNowPrice, setBuyNowPrice] = useState(auction?.buyNowPrice ? String(auction.buyNowPrice) : '');
  const [auctionEndAt, setAuctionEndAt] = useState(() => {
    if (!auction?.auctionEndAt) return '';
    const d = new Date(auction.auctionEndAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const updateMutation = trpc.auction.updateRejectedAuction.useMutation({
    onSuccess: () => { toast.success(t("seller.auctions.editRejected.saveSuccess")); onSaved(); onClose(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const handleSave = () => {
    const bid = parseFloat(startingBid);
    if (!bid || bid < 1) { toast.error(t("seller.auctions.editRejected.bidError")); return; }
    if (!auctionEndAt) { toast.error(t("seller.auctions.editRejected.endTimeError")); return; }
    updateMutation.mutate({
      listingId: auction.id,
      title: title || undefined,
      description: description || undefined,
      condition: condition || undefined,
      images,
      startingBid: bid,
      bidIncrement: parseFloat(bidIncrement) || 10,
      buyNowPrice: buyNowPrice ? parseFloat(buyNowPrice) : null,
      auctionEndAt: new Date(auctionEndAt),
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 border-0 rounded-2xl bg-white text-gray-900">
        {/* Header - BOXIUM deep blue */}
        <div className="bg-[#06038D] px-6 pt-5 pb-5 rounded-t-2xl relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-8 w-16 h-16 bg-[#FEDD00]/10 rounded-full translate-y-1/2" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FEDD00] rounded-xl flex items-center justify-center shrink-0 shadow-lg">
              <Pencil className="w-5 h-5 text-[#06038D]" />
            </div>
            <div>
              <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest">{t("seller.auctions.editRejected.title")}</p>
              <h2 className="text-lg font-black text-white leading-tight">{t("seller.auctions.editRejected.subtitle")}</h2>
            </div>
          </div>
        </div>

        {/* Rejection reason reminder */}
        {auction?.rejectedReason && (
          <div className="mx-5 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex gap-2.5">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-red-500 text-xs font-black">!</span>
            </div>
            <div>
              <p className="text-xs font-bold text-red-600 mb-0.5">{t("seller.apply.rejectionReason")}</p>
              <p className="text-xs text-red-700 leading-relaxed">{auction.rejectedReason}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="px-5 py-4 space-y-4 bg-white">
          <div>
            <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.auctions.editRejected.titleLabel")}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              className="mt-1.5 text-gray-900 bg-white border-gray-200 focus:border-[#06038D] focus:ring-[#06038D]/20 rounded-xl h-10"
              placeholder={t("seller.auctions.editRejected.titlePlaceholder")} />
          </div>
          <div>
            <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.auctions.editRejected.descriptionLabel")}</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              className="mt-1.5 text-gray-900 bg-white border-gray-200 focus:border-[#06038D] focus:ring-[#06038D]/20 rounded-xl min-h-[80px] resize-none"
              placeholder={t("seller.auctions.editRejected.descriptionPlaceholder")} />
          </div>
          <div>
            <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.auctions.editRejected.conditionLabel")}</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="mt-1.5 text-gray-900 bg-white border-gray-200 rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="raw_a">{t("seller.auctions.editRejected.condition.rawNew")}</SelectItem>
                <SelectItem value="raw_b">{t("seller.auctions.editRejected.condition.rawLightlyUsed")}</SelectItem>
                <SelectItem value="raw_c">{t("seller.auctions.editRejected.condition.rawUsed")}</SelectItem>
                <SelectItem value="psa10">PSA 10</SelectItem>
                <SelectItem value="psa9">PSA 9</SelectItem>
                <SelectItem value="psa8">PSA 8</SelectItem>
                <SelectItem value="bgs10">BGS 10</SelectItem>
                <SelectItem value="bgs9">BGS 9.5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.auctions.editRejected.startingBidLabel")}</Label>
              <Input type="number" value={startingBid} onChange={e => setStartingBid(e.target.value)}
                className="mt-1.5 text-gray-900 bg-white border-gray-200 focus:border-[#06038D] rounded-xl h-10" min={1} />
            </div>
            <div>
              <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.auctions.editRejected.bidIncrementLabel")}</Label>
              <Input type="number" value={bidIncrement} onChange={e => setBidIncrement(e.target.value)}
                className="mt-1.5 text-gray-900 bg-white border-gray-200 focus:border-[#06038D] rounded-xl h-10" min={1} />
            </div>
          </div>
          <div>
            <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">即時購價 (HK$) <span className="text-gray-400 normal-case font-normal">{t("seller.auctions.editRejected.optionalLabel")}</span></Label>
            <Input type="number" value={buyNowPrice} onChange={e => setBuyNowPrice(e.target.value)}
              className="mt-1.5 text-gray-900 bg-white border-gray-200 focus:border-[#06038D] rounded-xl h-10" min={1} placeholder={t("seller.auctions.editRejected.buyNowPricePlaceholder")} />
          </div>
          <div>
            <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.auctions.editRejected.auctionEndLabel")}</Label>
            <Input type="datetime-local" value={auctionEndAt} onChange={e => setAuctionEndAt(e.target.value)}
              className="mt-1.5 text-gray-900 bg-white border-gray-200 focus:border-[#06038D] rounded-xl h-10" />
          </div>
          <div>
            <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide mb-1.5 block">{t("seller.auctions.editRejected.imagesLabel")}</Label>
            <ImageUploader images={images} onChange={setImages} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2.5 border-t border-gray-100 pt-4 bg-white rounded-b-2xl">
          <Button variant="outline" onClick={onClose}
            className="flex-1 rounded-xl border-2 border-gray-200 text-gray-600 font-bold h-11 bg-white hover:bg-gray-50 hover:border-gray-300">
            取消
          </Button>
          <Button
            className="flex-[2] bg-[#06038D] hover:bg-[#0804b8] text-white rounded-xl font-black h-11 shadow-lg shadow-[#06038D]/20"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            儲存修改
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SellerAuctionsTab() {
  const [subTab, setSubTab] = useState<"active" | "ended" | "rejected">("active");
  const { data: auctions, isLoading, refetch } = trpc.auction.sellerAuctions.useQuery(
    { page: 1, pageSize: 50 },
    { refetchInterval: 20000 } // Poll every 20s for real-time bid updates
  );
  const utils = trpc.useUtils();
  const [editingAuction, setEditingAuction] = useState<any>(null);

  const resubmitMutation = trpc.auction.resubmitAuction.useMutation({
    onSuccess: () => {
      toast.success('已重新上架拍賣');
      refetch();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const allListings = auctions?.listings ?? [];
  const activeAuctions = allListings.filter((a: any) =>
    ["active", "scheduled", "ending_soon"].includes(a.auctionStatus)
  );
  const endedAuctions = allListings.filter((a: any) =>
    ["ended_sold", "ended_no_bid", "cancelled", "ended", "sold"].includes(a.auctionStatus)
  );
  const rejectedAuctions = allListings.filter((a: any) => a.auctionStatus === "rejected" || a.adminDelisted);

  const current = subTab === "active" ? activeAuctions : subTab === "ended" ? endedAuctions : rejectedAuctions;

  // Helper to parse images field (stored as JSON string or array)
  function getThumbUrl(auction: any): string | null {
    try {
      if (auction.imageUrls?.[0]) return auction.imageUrls[0];
      const imgs = typeof auction.images === 'string' ? JSON.parse(auction.images) : auction.images;
      if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
    } catch {}
    return null;
  }

  function AuctionStatusBadge({ status, auctionPaymentStatus }: { status: string; auctionPaymentStatus?: string | null }) {
  const { t } = useTranslation();
    let endedSoldLabel: string;
    let endedSoldCls: string;
    if (auctionPaymentStatus === 'paid') {
      endedSoldLabel = '已成交'; endedSoldCls = 'bg-green-100 text-green-700';
    } else if (auctionPaymentStatus === 'expired' || auctionPaymentStatus === 'failed') {
      endedSoldLabel = '已取消'; endedSoldCls = 'bg-red-100 text-red-600';
    } else {
      endedSoldLabel = '已得標（待付款）'; endedSoldCls = 'bg-[#06038D]/10 text-[#06038D]';
    }
    const map: Record<string, { label: string; cls: string }> = {
      active:         { label: "競拍中",   cls: "bg-blue-100 text-blue-700" },
      ending_soon:    { label: "即將結標", cls: "bg-orange-100 text-orange-700" },
      scheduled:      { label: "已排程",   cls: "bg-indigo-100 text-indigo-700" },
      pending_review: { label: t("seller.auctions.tab.filter.review"),   cls: "bg-yellow-100 text-yellow-700" },
      ended_sold:     { label: endedSoldLabel, cls: endedSoldCls },
      ended_no_bid:   { label: "流標",     cls: "bg-gray-100 text-gray-500" },
      ended:          { label: "已結標",   cls: "bg-green-100 text-green-700" },
      sold:           { label: "已成交",   cls: "bg-green-100 text-green-700" },
      cancelled:      { label: t("seller.orderStatus.cancelled"),   cls: "bg-gray-100 text-gray-500" },
      rejected:       { label: t("seller.auctions.tab.filter.rejected"),   cls: "bg-red-100 text-red-600" },
    };
    const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
  }

  function AuctionCountdown({ endAt }: { endAt: string | null }) {
  const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
      if (!endAt) { setTimeLeft("—"); return; }
      const update = () => {
        const diff = new Date(endAt).getTime() - Date.now();
        if (diff <= 0) { setTimeLeft("已結標"); return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
      };
      update();
      const t = setInterval(update, 1000);
      return () => clearInterval(t);
    }, [endAt]);
    const isUrgent = endAt && new Date(endAt).getTime() - Date.now() < 3600000;
    return <span className={`text-xs font-mono font-bold ${isUrgent ? "text-red-600" : "text-gray-600"}`}>{timeLeft}</span>;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#06038d]" /></div>;
  }

  // Need to access setShowNewListing and setListingForm from parent - use a context or event
  // Since this is a nested component, we'll use a custom event to trigger the parent
  const handleStartAuction = () => {
    // Dispatch a custom event that the parent SellerDashboard listens to
    window.dispatchEvent(new CustomEvent('boxium:openNewListing', { detail: { mode: 'auction' } }));
  };

  return (
    <div className="space-y-4">
      {/* Auction Quick Start Banner: show when no active auctions */}
      {allListings.length === 0 && (
        <div className="rounded-2xl overflow-hidden border-2 border-[#FEDD00] bg-gradient-to-br from-[#06038D] to-[#1a0a9e] shadow-lg">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">拍賣中心</p>
                <h3 className="text-white font-bold text-lg leading-tight">開設你的第一場拍賣</h3>
                <p className="text-white/60 text-xs mt-1">讓買家競價，以最佳價格成交</p>
              </div>
              <button
                className="shrink-0 bg-[#FEDD00] hover:bg-[#f0cc00] text-[#06038D] font-bold text-sm px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                onClick={handleStartAuction}
              >
                <Gavel className="w-4 h-4" />
                開始拍賣
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { step: '1', title: '設定起拍價', desc: '最低入場價格' },
                { step: '2', title: '選擇天數', desc: '3 日或 7 日拍賣' },
                { step: '3', title: '等候競價', desc: '自動通知結果' },
              ].map(s => (
                <div key={s.step} className="bg-white/10 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FEDD00] text-[#06038D] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                  <div>
                    <p className="text-white text-xs font-semibold leading-tight">{s.title}</p>
                    <p className="text-white/50 text-[10px] mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: "active", label: "進行中", count: activeAuctions.length },
          { key: "ended", label: "已結標", count: endedAuctions.length },
          { key: "rejected", label: "已下架", count: rejectedAuctions.length },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === t.key ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            style={subTab === t.key ? { background: t.key === 'rejected' ? '#dc2626' : '#06038d' } : {}}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                subTab === t.key ? "bg-white/25 text-white" : t.key === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {current.length === 0 ? (
        <div className="text-center py-12">
          <Gavel className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 text-sm">
            {subTab === "active" ? "目前沒有進行中或已排程的拍賣" : subTab === "rejected" ? "沒有被拒絕的拍賣" : "尚無已結標的拍賣"}
          </p>
          {subTab === "active" && (
            <p className="text-gray-400 text-xs mt-1">在「我的商品」標簽中選擇「拍賣模式」上架新拍賣</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {current.map((auction: any) => {
            const thumbUrl = getThumbUrl(auction);
            return (
            <div key={auction.id} className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow ${
              auction.auctionStatus === 'rejected' ? 'border-red-200 bg-red-50/30' : 'border-gray-100'
            }`}>
              <div className="flex items-start gap-3">
                {thumbUrl && (
                  <img
                    src={thumbUrl}
                    alt={auction.title}
                    className="w-14 h-14 object-cover rounded-lg border border-gray-100 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm truncate">{auction.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {auction.cardName && `${auction.cardName} · `}
                        {auction.grade && `PSA ${auction.grade}`}
                      </p>
                    </div>
                    <AuctionStatusBadge status={auction.auctionStatus} auctionPaymentStatus={auction.auctionPaymentStatus} />
                  </div>

                  {/* Scheduled auction info banner */}
                  {auction.auctionStatus === 'scheduled' && auction.auctionStartAt && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <span className="text-indigo-500 text-sm">🗓️</span>
                      <div>
                        <p className="text-xs font-semibold text-indigo-700">預計開始時間</p>
                        <p className="text-xs text-indigo-600">{new Date(auction.auctionStartAt).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-gray-400">{"起標價"}</p>
                        <p className="text-sm font-bold" style={{ color: "#06038d" }}>HK${parseFloat(auction.startingBid ?? '0').toLocaleString()}</p>
                      </div>
                      {auction.auctionStatus !== 'scheduled' && (
                        <div>
                          <p className="text-xs text-gray-400">目前最高出價</p>
                          {auction.currentHighestBid ? (
                            <p className="text-sm font-black text-[#FEDD00] bg-[#06038D] px-2 py-0.5 rounded-lg inline-block">
                              HK${parseFloat(auction.currentHighestBid).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-gray-400">{"尚無出價"}</p>
                          )}
                        </div>
                      )}
                      {auction.auctionStatus !== 'scheduled' && auction.bidCount !== undefined && (
                        <div>
                          <p className="text-xs text-gray-400">出價次數</p>
                          <p className="text-sm font-bold text-gray-700">{auction.bidCount} 次</p>
                        </div>
                      )}
                      {auction.auctionStatus === 'scheduled' && auction.buyNowPrice && (
                        <div>
                          <p className="text-xs text-gray-400">即買價</p>
                          <p className="text-sm font-bold text-emerald-600">HK${parseFloat(auction.buyNowPrice).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {auction.auctionStatus === "active" && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{"剩餘時間"}</p>
                          <AuctionCountdown endAt={auction.auctionEndAt} />
                        </div>
                      )}
                      {auction.auctionStatus === "ending_soon" && (
                        <div className="text-right">
                          <p className="text-xs text-orange-500 font-semibold">{"即將結標"}</p>
                          <AuctionCountdown endAt={auction.auctionEndAt} />
                        </div>
                      )}
                      {auction.auctionStatus !== 'rejected' && (
                        <a href={`/auction/${auction.id}`} target="_blank" rel="noopener noreferrer">
                          <button className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors">
                            查看拍賣
                          </button>
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Delist reason + edit + resubmit (governance mode: adminDelisted or rejected) */}
                  {(auction.auctionStatus === 'rejected' || auction.adminDelisted) && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-xs font-semibold text-red-600 mb-1">下架原因：</p>
                      <p className="text-xs text-red-700 mb-3">{auction.rejectedReason || '未提供原因'}</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 text-xs px-3 py-2 rounded-lg font-semibold border-2 border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors flex items-center justify-center gap-1.5"
                          onClick={() => setEditingAuction(auction)}
                        >
                          <Pencil className="w-3 h-3" />
                          編輯拍賣
                        </button>
                        <button
                          className="flex-1 text-xs px-3 py-2 rounded-lg font-semibold bg-[#06038d] text-white hover:bg-[#06038d]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                          disabled={resubmitMutation.isPending}
                          onClick={() => resubmitMutation.mutate({ listingId: auction.id })}
                        >
                          {resubmitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          {resubmitMutation.isPending ? '提交中...' : '重新上架'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Edit rejected auction dialog */}
      {editingAuction && (
        <EditRejectedAuctionDialog
          auction={editingAuction}
          open={!!editingAuction}
          onClose={() => setEditingAuction(null)}
          onSaved={() => { setEditingAuction(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── ListingTable: Mobile-friendly expandable row table for seller listings ──
function ListingTable({ listings, batchMode, selectedIds, toggleSelectId, isAdmin, deactivateMutation, reactivateMutation, openEditDialog, setListingForm, setListingImages, setSelectedCard, setListingStep, setShowNewListing, t }: {
  listings: any[];
  batchMode: boolean;
  selectedIds: Set<number>;
  toggleSelectId: (id: number) => void;
  isAdmin: boolean;
  deactivateMutation: any;
  reactivateMutation: any;
  openEditDialog: (listing: any) => void;
  setListingForm: (form: any) => void;
  setListingImages: (imgs: string[]) => void;
  setSelectedCard: (card: any) => void;
  setListingStep: (step: any) => void;
  setShowNewListing: (show: boolean) => void;
  t: any;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const conditionLabels: Record<string, string> = { raw_a: 'A品', raw_b: 'B品', raw_c: 'C品', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', bgs10: 'BGS 10' };
  const tcgLogos: Record<string, { logo: string; label: string }> = {
    pokemon:  { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif",  label: "Pokémon" },
    onepiece: { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif", label: "One Piece" },
    yugioh:   { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp",  label: "Yu-Gi-Oh!" },
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Desktop header row */}
      <div className="hidden sm:grid border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 px-4 py-2.5" style={{ gridTemplateColumns: '1fr auto auto auto auto' }}>
        {batchMode && <span className="w-6"></span>}
        <span>商品名稱</span>
        <span className="text-right pr-3">售價</span>
        <span className="text-center px-3 hidden md:block">庫存</span>
        <span className="text-center px-3 hidden lg:block">品相</span>
        <span className="text-left">狀態</span>
      </div>
      {listings.map((listing: any) => {
        let coverImg: string | null = null;
        try { const imgs = listing.images ? JSON.parse(listing.images as string) : null; coverImg = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null; } catch {}
        const isSold = listing.status === "sold";
        const isRemoved = listing.status === "removed";
        const isActive = listing.status === "active";
        const isAdminDelisted = !!(listing as any).adminDelisted;
        const isSelected = selectedIds.has(listing.id);
        const isExpanded = expandedId === listing.id;
        const seriesInfo = tcgLogos[listing.tcgSeries as string];
        const statusBadge = (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${
            isActive ? 'bg-green-50 text-green-700 border-green-200' :
            isSold ? 'bg-blue-50 text-blue-700 border-blue-200' :
            isRemoved ? 'bg-red-50 text-red-600 border-red-200' :
            'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500' : isSold ? 'bg-blue-500' : isRemoved ? 'bg-red-400' : 'bg-gray-400'}`} />
            {isActive ? '上架中' : isSold ? '已售出' : isRemoved ? (isAdminDelisted ? '強制下架' : '已下架') : listing.status}
          </span>
        );
        const actionButtons = (
          <div className="flex items-center gap-2 flex-wrap">
            {!isSold && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-[#06038d]/40 text-[#06038d] hover:bg-[#06038d]/5"
                onClick={(e) => { e.stopPropagation(); openEditDialog(listing); }}>
                <Pencil className="w-3 h-3 mr-1" />編輯
              </Button>
            )}
            {isActive && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-red-300 text-red-600 hover:bg-red-50"
                disabled={deactivateMutation.isPending}
                onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate({ id: listing.id }); }}>
                <EyeOff className="w-3 h-3 mr-1" />下架
              </Button>
            )}
            {isRemoved && !isAdminDelisted && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-green-500 text-green-700 hover:bg-green-50"
                disabled={reactivateMutation.isPending}
                onClick={(e) => { e.stopPropagation(); reactivateMutation.mutate({ id: listing.id, status: "active" }); }}>
                <Eye className="w-3 h-3 mr-1" />重新上架
              </Button>
            )}
            {isRemoved && isAdminDelisted && (
              <span className="text-xs text-red-500 font-medium">{t("seller.listings.card.adminDelisted")}</span>
            )}
            {(isSold || isActive) && (
              <Link href={`/marketplace/${listing.id}`}>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-gray-200 text-gray-500 hover:bg-gray-50">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-[#06038d]/30 text-[#06038d] hover:bg-[#06038d]/5"
                title={t("seller.listings.card.duplicateListingTooltip")}
                onClick={(e) => {
                  e.stopPropagation();
                  setListingForm({ title: listing.title ?? '', description: listing.description ?? '', condition: listing.condition ?? 'raw_a', price: parseFloat(listing.priceHkd as string).toFixed(2), quantity: String(listing.quantity ?? 1), tcgSeries: (listing as any).tcgSeries ?? 'pokemon', acceptOffers: !!(listing as any).allowOffers, minOffer: (listing as any).minOfferHkd ? String(parseFloat((listing as any).minOfferHkd)) : '', listingMode: 'buy_now', startingBid: '', reservePrice: '', buyNowPrice: '', bidIncrement: '10', auctionStartAt: '', auctionEndAt: '', auctionDurationDays: 7 });
                  setListingImages([]); setSelectedCard(null); setListingStep(1); setShowNewListing(true);
                  toast.info(t("seller.listings.card.duplicateSuccess"));
                }}>
                <Layers className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        );
        return (
          <div key={listing.id} className={`border-b border-gray-100 last:border-0 ${isSelected ? 'bg-[#f0f4ff]' : isSold ? 'bg-gray-50/60 opacity-75' : ''}`}>
            {/* Main row */}
            <div
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${batchMode && !isSold ? 'cursor-pointer' : 'cursor-pointer'} hover:bg-[#f8f9ff]`}
              onClick={() => {
                if (batchMode && !isSold) { toggleSelectId(listing.id); return; }
                if (!batchMode) setExpandedId(isExpanded ? null : listing.id);
              }}
            >
              {/* Batch checkbox */}
              {batchMode && !isSold && (
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#06038d] bg-[#06038d]' : 'border-gray-300'}`}>
                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
              )}
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0" style={!coverImg ? { background: 'linear-gradient(135deg, #06038d 0%, #0a06b5 100%)' } : {}}>
                {coverImg ? <img src={coverImg} alt={listing.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-white font-black text-[8px]">BOX</span></div>}
              </div>
              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-400 font-mono">#BOXIUM-{listing.id}</span>
                  {/* On mobile: show price inline */}
                  <span className="text-xs font-bold sm:hidden" style={{ color: '#06038D' }}>HKD {parseFloat(listing.priceHkd as string).toFixed(2)}</span>
                </div>
              </div>
              {/* Desktop: price + stock + condition */}
              <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: '#06038D' }}>HKD {parseFloat(listing.priceHkd as string).toFixed(2)}</span>
                <span className={`text-sm font-bold w-6 text-center hidden md:block ${listing.quantity === 0 ? 'text-red-500' : listing.quantity <= 2 ? 'text-amber-500' : 'text-gray-700'}`}>{listing.quantity}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap hidden lg:inline-flex">{conditionLabels[listing.condition as string] ?? listing.condition ?? '—'}</span>
              </div>
              {/* Status badge */}
              <div className="flex-shrink-0">{statusBadge}</div>
              {/* Expand chevron (non-batch mode) */}
              {!batchMode && (
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              )}
            </div>
            {/* Expanded action row */}
            {isExpanded && !batchMode && (
              <div className="px-4 pb-3 pt-1 bg-[#f8f9ff] border-t border-gray-100">
                {/* Extra meta on mobile */}
                <div className="flex items-center gap-3 mb-2.5 sm:hidden">
                  <span className="text-xs text-gray-500">庫存：<strong className={`${listing.quantity === 0 ? 'text-red-500' : listing.quantity <= 2 ? 'text-amber-500' : 'text-gray-700'}`}>{listing.quantity}</strong></span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{conditionLabels[listing.condition as string] ?? listing.condition ?? '—'}</span>
                  {seriesInfo && <img src={seriesInfo.logo} alt={seriesInfo.label} className="h-4 w-auto object-contain opacity-70" />}
                </div>
                {actionButtons}
              </div>
            )}
          </div>
        );
      })}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
        共 {listings.length} 件商品
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  const { t } = useTranslation();
  // ── Maintenance mode check (query placed before other hooks, guard after all hooks) ──
  const { data: accessData, isLoading: accessLoading } = trpc.marketplace.getMarketplaceAccess.useQuery();
  const [showApply, setShowApply] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingOfferId, setRejectingOfferId] = useState<number | null>(null);
  const [offerFilter, setOfferFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [rejectionReason, setRejectionReason] = useState("");
  const [showNewListing, setShowNewListing] = useState(false);
  const [listingStep, setListingStep] = useState<1 | 2 | 3>(1);
  const [showSellerTerms, setShowSellerTerms] = useState(false);
  const [pendingAuctionSubmit, setPendingAuctionSubmit] = useState(false);
  const [listingTermsAgreed, setListingTermsAgreed] = useState(false);
  const [applyForm, setApplyForm] = useState({ displayName: "", bio: "" });
  const [listingForm, setListingForm] = useState({
    title: "", description: "", condition: "raw_a", price: "", quantity: "1",
    minOffer: "", acceptOffers: false, tcgSeries: "pokemon" as string,
    // Auction fields
    listingMode: "buy_now" as "buy_now" | "auction",
    startingBid: "", reservePrice: "", buyNowPrice: "", bidIncrement: "10",
    auctionStartAt: "", auctionEndAt: "", auctionDurationDays: 3,
  });
  const [listingImages, setListingImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);

  // Dynamic condition-based price query
  const { data: conditionPriceData, isLoading: conditionPriceLoading } = trpc.cards.getPriceByCondition.useQuery(
    { cardId: selectedCard?.id ?? 0, condition: listingForm.condition },
    { enabled: !!selectedCard?.id && !!listingForm.condition }
  );

  const { data: me } = trpc.auth.me.useQuery();
  const { data: sellerProfile, refetch: refetchProfile } = trpc.marketplace.getMySellerProfile.useQuery(
    undefined, { enabled: !!me }
  );
  const isAdmin = me?.role === 'admin';
  const { data: myListings, refetch: refetchListings } = trpc.marketplace.getMyListings.useQuery(
    undefined, { enabled: !!sellerProfile || isAdmin }
  );
  const { data: myOrders } = trpc.marketplace.getMySellerOrders.useQuery(
    undefined, { enabled: !!sellerProfile || isAdmin }
  );
  const { data: salesStats } = trpc.marketplace.getSellerSalesStats.useQuery(
    undefined, { enabled: !!sellerProfile || isAdmin }
  );
  const { data: myOffers } = trpc.marketplace.getMyOffers.useQuery(
    undefined, { enabled: !!sellerProfile }
  );
  const { data: sellerOffers } = trpc.marketplace.getSellerOffers.useQuery(
    undefined, { enabled: !!sellerProfile || isAdmin, refetchInterval: 60000 }
  );
  const pendingSellerOffersCount = sellerOffers?.filter((o: any) => o.status === 'pending').length ?? 0;
  const { data: feeTiersData } = trpc.marketplace.getFeeTiers.useQuery();
  // 待確認訂單：截圖已提交待審核、支付寶待確認、待付款狀態
  const pendingOrdersCount = (myOrders as any[])?.filter((o: any) =>
    ['payment_submitted', 'alipay_pending', 'pending_payment'].includes(o.orderStatus)
  ).length ?? 0;

  const utils = trpc.useUtils();
  const respondToOfferMutation = trpc.marketplace.respondToOffer.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'accept' ? '已接受出價' : '已拒絕出價');
      utils.marketplace.getMyOffers.invalidate();
      utils.marketplace.getSellerOffers.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

   // ─── Listing filter state ─────────────────────────────────────────
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'sold' | 'removed'>('all');
  const [listingViewMode, setListingViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('seller-listing-view') as 'list' | 'grid') ?? 'list';
  });
  const [activeTab, setActiveTab] = useState<string>('listings');
  // ─── Order filter state ─────────────────────────────────────────
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'active' | 'done' | 'meetup'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // ─── Edit / Deactivate / Batch state ─────────────────────────────────────
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingListing, setEditingListing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", quantity: "" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  // ─── Bulk Upload state ────────────────────────────────────────────────────
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvRows, setCsvRows] = useState<Array<{
    title: string; description: string; condition: string; price: string;
    quantity: string; tcgSeries: string; allowOffers: string; minOffer: string;
    imageUrls: string[];
    _status: 'pending' | 'uploading' | 'done' | 'error'; _error?: string;
  }>>([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { toast.error('CSV 至少需要一行標題和一行資料'); return; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      // Support multiple image URLs separated by | or ; in image_url column
      const rawImgField = obj['image_url'] ?? obj['image_urls'] ?? obj['圖片'] ?? '';
      const imageUrls = rawImgField
        ? rawImgField.split(/[|;]/).map(u => u.trim()).filter(Boolean)
        : [];
      return {
        title: obj['title'] ?? obj['商品名稱'] ?? '',
        description: obj['description'] ?? obj['描述'] ?? '',
        condition: obj['condition'] ?? obj['品相'] ?? 'raw_a',
        price: obj['price'] ?? obj['售價'] ?? '',
        quantity: obj['quantity'] ?? obj['數量'] ?? '1',
        tcgSeries: obj['tcg_series'] ?? obj['系列'] ?? 'pokemon',
        allowOffers: obj['allow_offers'] ?? obj['允許出價'] ?? 'false',
        minOffer: obj['min_offer'] ?? obj['最低出價'] ?? '',
        imageUrls,
        _status: 'pending' as const,
      };
    }).filter(r => r.title);
    setCsvRows(rows);
  };

  const updateListingMutation = trpc.marketplace.updateMyListing.useMutation({
    onSuccess: () => {
      toast.success(t("seller.listings.updateSuccess"));
      setShowEditDialog(false);
      setEditingListing(null);
      refetchListings();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const deactivateMutation = trpc.marketplace.deleteMyListing.useMutation({
    onSuccess: () => { toast.success(t("seller.listings.deactivateSuccess")); refetchListings(); utils.marketplace.getMySellerProfile.invalidate(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const reactivateMutation = trpc.marketplace.updateMyListing.useMutation({
    onSuccess: () => { toast.success(t("seller.listings.reactivateSuccess")); refetchListings(); utils.marketplace.getMySellerProfile.invalidate(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const batchDeactivateMutation = trpc.marketplace.batchDeactivateListings.useMutation({
    onSuccess: (data) => {
      toast.success(`已下架 ${data.count} 件商品`);
      setSelectedIds(new Set());
      setBatchMode(false);
      refetchListings();
      utils.marketplace.getMySellerProfile.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const batchReactivateMutation = trpc.marketplace.batchReactivateListings.useMutation({
    onSuccess: (data) => {
      toast.success(`已重新上架 ${data.count} 件商品！`);
      setSelectedIds(new Set());
      setBatchMode(false);
      refetchListings();
      utils.marketplace.getMySellerProfile.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const batchDeleteMutation = trpc.marketplace.batchDeleteListings.useMutation({
    onSuccess: (data) => {
      toast.success(`已刪除 ${data.deletedCount} 件商品${data.cancelledOrdersCount > 0 ? `，已取消 ${data.cancelledOrdersCount} 個待付款訂單` : ''}`);
      setSelectedIds(new Set());
      setBatchMode(false);
      setShowDeleteConfirm(false);
      refetchListings();
      utils.marketplace.getMySellerProfile.invalidate();
    },
    onError: (e) => {
      toast.error(parseApiError(e));
      setShowDeleteConfirm(false);
    },
  });

  const openEditDialog = (listing: any) => {
    setEditingListing(listing);
    setEditForm({
      title: listing.title ?? "",
      description: listing.description ?? "",
      price: parseFloat(listing.priceHkd as string).toFixed(2),
      quantity: String(listing.quantity ?? 1),
    });
    setShowEditDialog(true);
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!myListings) return;
    if (selectedIds.size === myListings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(myListings.map((l: any) => l.id)));
    }
  };

  const applyMutation = trpc.marketplace.applyAsSeller.useMutation({
    onSuccess: () => { toast.success(t("seller.listings.applySellerSuccess")); setShowApply(false); refetchProfile(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const createListingMutation = trpc.marketplace.createListing.useMutation({
    onSuccess: () => {
      toast.success(t("seller.listings.createSuccess"));
      setShowNewListing(false);
      setListingForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", minOffer: "", acceptOffers: false, tcgSeries: "pokemon", listingMode: "buy_now", startingBid: "", reservePrice: "", buyNowPrice: "", bidIncrement: "10", auctionStartAt: "", auctionEndAt: "", auctionDurationDays: 7 });
      setListingStep(1);
      setListingImages([]);
      setSelectedCard(null);
      refetchListings();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const { data: sellerTermsData, refetch: refetchSellerTerms } = trpc.auction.checkTermsAgreement.useQuery(
    { role: 'seller' },
    { enabled: !!me }
  );
  const agreeSellerTermsMutation = trpc.auction.agreeToTerms.useMutation({
    onSuccess: () => {
      refetchSellerTerms();
      setShowSellerTerms(false);
      // Auto-submit auction if user was trying to submit
      if (pendingAuctionSubmit) {
        setPendingAuctionSubmit(false);
        createAuctionMutation.mutate({
          title: listingForm.title,
          description: listingForm.description || undefined,
          condition: listingForm.condition as any,
          quantity: parseInt(listingForm.quantity),
          images: listingImages.length > 0 ? listingImages : undefined,
          cardId: selectedCard?.id ?? undefined,
          tcgSeries: listingForm.tcgSeries as any,
          startingBid: parseFloat(listingForm.startingBid),
          reservePrice: listingForm.reservePrice ? parseFloat(listingForm.reservePrice) : undefined,
          buyNowPrice: listingForm.buyNowPrice ? parseFloat(listingForm.buyNowPrice) : undefined,
          bidIncrement: parseFloat(listingForm.bidIncrement || '10'),
          auctionStartAt: (() => {
            if (!listingForm.auctionStartAt) return undefined;
            const today = new Date();
            const [hh, mm] = listingForm.auctionStartAt.split(':').map(Number);
            return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0, 0);
          })(),
          auctionEndAt: new Date(listingForm.auctionEndAt),
        });
      }
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const createAuctionMutation = trpc.auction.create.useMutation({
    onSuccess: () => {
      toast.success(t("seller.auctions.createSuccess"));
      setShowNewListing(false);
      setListingForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", minOffer: "", acceptOffers: false, tcgSeries: "pokemon", listingMode: "buy_now", startingBid: "", reservePrice: "", buyNowPrice: "", bidIncrement: "10", auctionStartAt: "", auctionEndAt: "", auctionDurationDays: 7 });
      setListingStep(1);
      setListingImages([]);
      setSelectedCard(null);
      refetchListings();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const [newListingId, setNewListingId] = useState<number | null>(null);
  const adminCreateListingMutation = trpc.marketplace.adminCreatePlatformListing.useMutation({
    onSuccess: (data) => {
      const id = data?.id ?? null;
      setNewListingId(id);
      toast.success(
        <div className="flex items-center gap-3">
          <span>{t("seller.listings.adminCreateSuccess")}</span>
          {id && (
            <a
              href={`/marketplace/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold text-[#06038D] whitespace-nowrap"
            >
              查看商品 →
            </a>
          )}
        </div>,
        { duration: 8000 }
      );
      setShowNewListing(false);
      setListingForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", minOffer: "", acceptOffers: false, tcgSeries: "pokemon", listingMode: "buy_now", startingBid: "", reservePrice: "", buyNowPrice: "", bidIncrement: "10", auctionStartAt: "", auctionEndAt: "", auctionDurationDays: 7 });
      setListingStep(1);
      setSelectedCard(null);
      setListingImages([]);
      refetchListings();
    },
    onError: (e) => toast.error(parseApiError(e)),
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
    onError: (e) => toast.error(parseApiError(e)),
  });

  const stripeLoginMutation = trpc.marketplace.getStripeExpressDashboardLink.useMutation({
    onSuccess: (data) => {
      toast.info("正在跳轉到 Stripe Express Dashboard...");
      window.open(data.url, "_blank");
    },
    onError: (e) => toast.error(parseApiError(e)),
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

  // Listen for auction quick-start event from SellerAuctionsTab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!isAdmin && sellerProfile?.stripeConnectStatus !== 'active') {
        toast.error('請先完成 Stripe Connect 收款帳戶設定，才能上架商品');
        return;
      }
      if (detail?.mode === 'auction') {
        setListingForm(p => ({ ...p, listingMode: 'auction' }));
      }
      setShowNewListing(true);
    };
    window.addEventListener('boxium:openNewListing', handler);
    return () => window.removeEventListener('boxium:openNewListing', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, sellerProfile?.stripeConnectStatus]);

  const [shipDialog, setShipDialog] = useState<{ open: boolean; orderId: number; orderNo: string; shippingName?: string; shippingPhone?: string; shippingAddress?: string }>({ open: false, orderId: 0, orderNo: "" });
  const [shipForm, setShipForm] = useState({ shippingMethod: "sf_express", trackingNumber: "", shippingImageUrl: "" });
  const [shipImageUploading, setShipImageUploading] = useState(false);
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
  const [meetupConfirmDialog, setMeetupConfirmDialog] = useState<{ open: boolean; orderId: number; orderNo: string }>({ open: false, orderId: 0, orderNo: '' });
  const confirmMeetupMutation = trpc.marketplace.confirmMeetupOrder.useMutation({
    onSuccess: () => {
      toast.success('面交已確認，訂單已完成！');
      setMeetupConfirmDialog({ open: false, orderId: 0, orderNo: '' });
      utils.marketplace.getMySellerOrders.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const uploadShippingImageMutation = trpc.marketplace.uploadShippingImage.useMutation();
  const markShippedMutation = trpc.marketplace.markOrderShipped.useMutation({
    onSuccess: () => {
      toast.success("已標記為已寄出，已通知買家");
      setShipDialog({ open: false, orderId: 0, orderNo: "" });
      setShipForm({ shippingMethod: "", trackingNumber: "", shippingImageUrl: "" });
      utils.marketplace.getMySellerOrders.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

   if (!me) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-lg font-medium">請先登入</p>
        <Link href="/login"><Button className="mt-4 text-white font-bold" style={{ backgroundColor: "#06038d" }}>登入</Button></Link>
      </div>
    </div>
  );
  // ── Maintenance mode guard (after all hooks) ──
  if (accessLoading) return <div className="min-h-screen flex items-center justify-center bg-[#06038D]"><div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>;
  if (accessData && !accessData.allowed) return (
    <div className="min-h-screen bg-[#06038D] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-3">市集正在維護中</h1>
        <p className="text-white/70 mb-6">我們正在緊鑼密鼓地開發中，敬請期待！</p>
        <a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors">返回首頁</a>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ── Hero Banner (Mobile-first compact) ── */}
      <div
        className="relative"
        style={{ background: `linear-gradient(135deg, #06038d 0%, #0a06b5 100%)` }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-5">
          {/* Mobile: compact horizontal layout */}
          <div className="flex items-center gap-3 md:hidden">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#FEDD00" }}
            >
              <ShoppingBag className="w-5 h-5" style={{ color: "#06038d" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white leading-tight">賣家中心</h1>
              <p className="text-white/60 text-xs">管理商品、訂單和收款</p>
            </div>
          </div>
          {/* Desktop: original layout */}
          <div className="hidden md:block">
            <div className="mb-5">
              <Link href="/">
                <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 cursor-pointer p-1" />
              </Link>
            </div>
            <div className="flex flex-row items-end gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0"
                style={{ background: "#FEDD00", borderColor: "white" }}
              >
                <ShoppingBag className="w-10 h-10" style={{ color: "#06038d" }} />
              </div>
              <div className="text-left pb-1 flex-1">
                <h1 className="text-3xl font-bold text-white">賣家中心</h1>
                <p className="text-white/70 text-sm mt-1">管理你的商品、訂單和收款</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 mt-3 md:mt-6 pb-20 md:pb-16">
        <div className="bg-white rounded-2xl shadow-sm md:shadow-lg border border-gray-100 overflow-hidden p-3 sm:p-6">

        {!sellerProfile && !isAdmin && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "#f0f4ff" }}>
              <ShoppingBag className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#06038d" }}>成為 BOXIUM 賣家</h2>
            <p className="text-gray-500 mb-6 max-w-md">
              在 BOXIUM 平台上架你的 TCG 卡牌，觸及更多買家。平台收取 5% 服務費，款項透過 Stripe 自動轉帳到你的帳戶。
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

        {(sellerProfile?.isActive || isAdmin) && (
          <>
            {!isAdmin && sellerProfile?.stripeConnectStatus === "pending" && !sellerProfile?.stripeConnectId && (
              <Card className="border-blue-200 bg-blue-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-blue-900">{t("seller.payouts.stripeSetupButton")}</p>
                      <p className="text-sm text-blue-700">完成 <strong>Stripe Connect</strong> 設定後才能收取款項。平台將透過 <strong>Stripe</strong> 自動轉帳給你。</p>
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
            {!isAdmin && sellerProfile?.stripeConnectStatus === "pending" && sellerProfile?.stripeConnectId && (
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
            {!isAdmin && sellerProfile?.stripeConnectStatus === "restricted" && (
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
            {!isAdmin && sellerProfile?.stripeConnectStatus === "disabled" && (
              <Card className="border-red-200 bg-red-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-900">{t("seller.payouts.stripeDisabledTitle")}</p>
                      <p className="text-sm text-red-700">{t("seller.payouts.stripeDisabledDescription")}</p>
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
            {!isAdmin && sellerProfile?.stripeConnectStatus === "active" && (
              <Card className="border-green-200 bg-green-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-green-800 font-medium">{t("seller.payouts.stripeActiveTitle")}</p>
                      <p className="text-sm text-green-700">{t("seller.payouts.stripeActiveDescription")}</p>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-4 sm:mb-5">
              {/* Stat: 上架商品 */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-[#06038d]/30 transition-all active:scale-95" style={{ background: "#f8faff" }}
                onClick={() => { setActiveTab('listings'); setListingFilter('active'); }}
                title={t("seller.stats.activeListingsTooltip")}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#e8edff" }}>
                    <Package className="w-4 h-4" style={{ color: "#06038d" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight" style={{ color: "#06038d" }}>{myListings?.length ?? 0}</p>
                    <p className="text-[11px] text-gray-500 leading-tight">{t("seller.stats.activeListings")}</p>
                  </div>
                </div>
              </div>
              {/* Stat: 已完成訂單 */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-[#06038d]/30 transition-all active:scale-95" style={{ background: "#f8faff" }}
                onClick={() => setActiveTab('orders')}
                title={t("seller.stats.completedOrdersTooltip")}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#e8edff" }}>
                    <ShoppingBag className="w-4 h-4" style={{ color: "#06038d" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight" style={{ color: "#06038d" }}>{salesStats?.completedOrders ?? sellerProfile?.totalSales ?? 0}</p>
                    <p className="text-[11px] text-gray-500 leading-tight">{t("seller.stats.completedOrders")}</p>
                  </div>
                </div>
              </div>
              {/* Stat: 本月收益 */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-[#b8860b]/30 transition-all active:scale-95" style={{ background: "#f8faff" }}
                onClick={() => setActiveTab('earnings')}
                title={t("seller.stats.revenueTooltip")}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#fff8e0" }}>
                    <DollarSign className="w-4 h-4" style={{ color: "#b8860b" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight truncate" style={{ color: "#06038d" }}>HK${(salesStats?.thisMonthRevenue ?? 0).toFixed(0)}</p>
                    <p className="text-[11px] text-gray-500 leading-tight">{t("seller.stats.thisMonthRevenue")}</p>
                    {salesStats && salesStats.lastMonthRevenue > 0 && (
                      <p className="text-[10px] leading-tight" style={{ color: salesStats.thisMonthRevenue >= salesStats.lastMonthRevenue ? '#22c55e' : '#ef4444' }}>
                        {salesStats.thisMonthRevenue >= salesStats.lastMonthRevenue ? '▲' : '▼'}
                        {Math.abs(((salesStats.thisMonthRevenue - salesStats.lastMonthRevenue) / salesStats.lastMonthRevenue) * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {/* Stat: 評分 */}
              <div className="rounded-xl border border-gray-100 shadow-sm p-3" style={{ background: "#f8faff" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#fff8e0" }}>
                    <Star className="w-4 h-4" style={{ color: "#b8860b" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight" style={{ color: "#06038d" }}>{parseFloat((sellerProfile?.avgRating as string) ?? '0').toFixed(1)}</p>
                    <p className="text-[11px] text-gray-500 leading-tight">評分 ({sellerProfile?.ratingCount ?? 0} 則)</p>
                  </div>
                </div>
              </div>
            </div>

            <BrandTabs defaultValue="listings" value={activeTab} onValueChange={setActiveTab}>
              <BrandTabsList grid tabCount={5}>
                <BrandTabsTrigger value="listings" icon={<Package className="w-4 h-4" />} label={t("seller.tabs.myListings")} mobileLabel={t("seller.completedOrders.product")}>
                  我的商品
                </BrandTabsTrigger>
                <BrandTabsTrigger value="auctions" icon={<Gavel className="w-4 h-4" />} label={t("seller.auctions.tab.title")} mobileLabel={t("seller.tabs.myAuctionsMobile")}>
                  我的拍賣
                </BrandTabsTrigger>
                <BrandTabsTrigger value="orders" icon={<ShoppingBag className="w-4 h-4" />} label={t("seller.tabs.orderManagement")} mobileLabel={t("seller.stats.orders")}>
                  訂單管理
                  {pendingOrdersCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                    </span>
                  )}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="offers" icon={<MessageSquare className="w-4 h-4" />} label={t("seller.tabs.buyerOffers")} mobileLabel={t("seller.auctions.card.bids")}>
                  買家出價
                  {pendingSellerOffersCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {pendingSellerOffersCount > 99 ? '99+' : pendingSellerOffersCount}
                    </span>
                  )}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="earnings" icon={<DollarSign className="w-4 h-4" />} label={t("seller.tabs.earnings")} mobileLabel={t("seller.tabs.earningsMobile")}>
                  收款記錄
                </BrandTabsTrigger>
              </BrandTabsList>

              <BrandTabsContent value="listings" className="mt-4">
                {/* Listing Guide Card: always visible */}
                <div className="mb-4 rounded-2xl overflow-hidden border-2 border-[#FEDD00] bg-gradient-to-br from-[#06038D] to-[#1a0a9e] shadow-lg">
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">賣家中心</p>
                        <h3 className="text-white font-bold text-lg leading-tight">上架你的商品</h3>
                        <p className="text-white/60 text-xs mt-1">只需 3 個步驟，即可在 Boxium 開賣</p>
                      </div>
                      <button
                        className="shrink-0 bg-[#FEDD00] hover:bg-[#f0cc00] text-[#06038D] font-bold text-sm px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                        onClick={() => {
                          if (!isAdmin && sellerProfile?.stripeConnectStatus !== 'active') {
                            toast.error('請先完成 Stripe Connect 收款帳戶設定，才能上架商品');
                            return;
                          }
                          setShowNewListing(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        上架新商品
                      </button>
                    </div>
                    {/* Step guide */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { step: '1', title: '填寫商品資料', desc: '名稱、品相、系列' },
                        { step: '2', title: '設定售價', desc: '定價或拍賣模式' },
                        { step: '3', title: '確認上架', desc: '商品即時公開' },
                      ].map(s => (
                        <div key={s.step} className="bg-white/10 rounded-xl px-3 py-2.5 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#FEDD00] text-[#06038D] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                          <div>
                            <p className="text-white text-xs font-semibold leading-tight">{s.title}</p>
                            <p className="text-white/50 text-[10px] mt-0.5">{s.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Listing Filter Sidebar + Content */}
                {(() => {
                  const filterCategories = [
                    { key: 'all' as const, label: '全部', count: myListings?.length ?? 0 },
                    { key: 'active' as const, label: '上架中', count: myListings?.filter((l: any) => l.status === 'active').length ?? 0 },
                    { key: 'sold' as const, label: '已售出', count: myListings?.filter((l: any) => l.status === 'sold').length ?? 0 },
                    // Governance mode: no pending_review tab
                    { key: 'removed' as const, label: '已下架', count: myListings?.filter((l: any) => l.status === 'removed').length ?? 0 },
                  ];
                  const filteredListings = listingFilter === 'all'
                    ? (myListings ?? [])
                    : (myListings ?? []).filter((l: any) => l.status === listingFilter);
                  return (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      {/* Mobile: horizontal scroll tabs (shown on mobile only) */}
                      <div className="flex sm:hidden gap-2 overflow-x-auto pb-1 w-full flex-shrink-0">
                        {filterCategories.map(cat => (
                          <button
                            key={cat.key}
                            onClick={() => { setListingFilter(cat.key); setSelectedIds(new Set()); setBatchMode(false); }}
                            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              listingFilter === cat.key
                                ? 'bg-[#06038d] text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {cat.label}
                            <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                              listingFilter === cat.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>{cat.count}</span>
                          </button>
                        ))}
                      </div>
                      {/* Desktop: Left Sidebar (hidden on mobile) */}
                      <div className="hidden sm:flex flex-col gap-1 w-32 flex-shrink-0">
                        {filterCategories.map(cat => (
                          <button
                            key={cat.key}
                            onClick={() => { setListingFilter(cat.key); setSelectedIds(new Set()); setBatchMode(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                              listingFilter === cat.key
                                ? 'bg-[#06038d] text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <span>{cat.label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              listingFilter === cat.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>{cat.count}</span>
                          </button>
                        ))}
                      </div>
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                {!myListings?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2" style={{color:'#06038D', opacity:0.3}} />
                    <p className="text-sm text-gray-400">點擊上方「立即上架」開始吸引買家</p>
                  </div>
                ) : (
                  <div className={listingViewMode === 'grid' ? 'space-y-3' : 'space-y-3'}>
                    {/* Toolbar */}
                    <div className="space-y-2">
                      {/* Row 1: Main actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 border-[#06038d] text-[#06038d] hover:bg-blue-50"
                          onClick={() => { setBatchMode(v => !v); setSelectedIds(new Set()); }}
                        >
                          {batchMode ? <X className="w-3 h-3 mr-1" /> : <CheckSquare className="w-3 h-3 mr-1" />}
                          {batchMode ? "取消批量" : "批量管理"}
                        </Button>

                        {/* View mode toggle */}
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden ml-auto">
                          <button
                            className={`h-8 w-8 flex items-center justify-center transition-colors ${
                              listingViewMode === 'list' ? 'bg-[#06038d] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
                            }`}
                            onClick={() => { setListingViewMode('list'); localStorage.setItem('seller-listing-view', 'list'); }}
                            title="列表視圖"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                          </button>
                          <button
                            className={`h-8 w-8 flex items-center justify-center transition-colors ${
                              listingViewMode === 'grid' ? 'bg-[#06038d] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
                            }`}
                            onClick={() => { setListingViewMode('grid'); localStorage.setItem('seller-listing-view', 'grid'); }}
                            title="網格視圖"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                            </svg>
                          </button>
                        </div>

                      </div>
                      {/* Row 2: Batch actions (shown only in batch mode) */}
                      {batchMode && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="outline" className="text-xs h-8" onClick={toggleSelectAll}>
                            {selectedIds.size === filteredListings.length ? <CheckSquare className="w-3 h-3 mr-1" /> : <Square className="w-3 h-3 mr-1" />}
                            {selectedIds.size === filteredListings.length ? "取消全選" : "全選"}
                          </Button>
                          {selectedIds.size > 0 && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 border-red-400 text-red-600 hover:bg-red-50"
                                disabled={batchDeactivateMutation.isPending}
                                onClick={() => {
                                  // Governance mode: only active listings can be deactivated by seller
                                  const deactivatableIds = Array.from(selectedIds).filter(id => {
                                    const l = filteredListings.find((x: any) => x.id === id);
                                    return l && l.status === 'active';
                                  });
                                  if (deactivatableIds.length > 0) batchDeactivateMutation.mutate({ ids: deactivatableIds });
                                }}
                              >
                                <EyeOff className="w-3 h-3 mr-1" />
                                {(() => {
                                  const deactivatableCount = Array.from(selectedIds).filter(id => {
                                    const l = filteredListings.find((x: any) => x.id === id);
                                    return l && l.status === 'active';
                                  }).length;
                                  return `下架 (${deactivatableCount})`;
                                })()}
                              </Button>
{(() => {
                                // Only count non-sold listings that can be relisted
                                const relistableIds = Array.from(selectedIds).filter(id => {
                                  const l = filteredListings.find((x: any) => x.id === id);
                                  return l && l.status === 'removed' && !(l as any).adminDelisted;
                                });
                                if (relistableIds.length === 0) return null;
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-8 border-green-500 text-green-700 hover:bg-green-50"
                                    disabled={batchReactivateMutation.isPending}
                                    onClick={() => batchReactivateMutation.mutate({ ids: relistableIds })}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    重新上架 ({relistableIds.length})
                                  </Button>
                                );
                              })()}
                              {/* Batch Delete Button */}
                              {(() => {
                                // Only show delete for deletable listings (not sold)
                                const deletableIds = Array.from(selectedIds).filter(id => {
                                  const l = filteredListings.find((x: any) => x.id === id);
                                  return l && l.status !== 'sold';
                                });
                                if (deletableIds.length === 0) return null;
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-8 border-gray-400 text-gray-700 hover:bg-gray-50"
                                    disabled={batchDeleteMutation.isPending}
                                    onClick={() => setShowDeleteConfirm(true)}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    刪除 ({deletableIds.length})
                                  </Button>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {filteredListings.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">此類別無商品</p>
                      </div>
                    ) : listingViewMode === 'grid' ? (
                      /* ── Grid View ── */
                      <div className="grid grid-cols-2 gap-2.5">
                        {filteredListings.map((listing: any) => {
                          let coverImg: string | null = null;
                          try { const imgs = listing.images ? JSON.parse(listing.images as string) : null; coverImg = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null; } catch {}
                          const isSold = listing.status === "sold";
                          const isRemoved = listing.status === "removed";
                          const isActive = listing.status === "active";
                          const isAdminDelisted = !!(listing as any).adminDelisted;
                          const isSelected = selectedIds.has(listing.id);
                          return (
                            <div key={listing.id}
                              className={`bg-white rounded-2xl shadow-md border overflow-hidden transition-all ${isSelected ? "border-[#06038d] ring-2 ring-[#06038d]/20" : "border-gray-100"}${isSold ? " opacity-80" : ""}`}
                              onClick={batchMode && !isSold ? () => toggleSelectId(listing.id) : undefined}
                              style={batchMode && !isSold ? { cursor: "pointer" } : undefined}
                            >
                              <div className="relative">
                                <div className="aspect-square overflow-hidden" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                                  {coverImg ? <img src={coverImg} alt={listing.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-white font-black text-sm tracking-tight text-center leading-tight">BOX<br/>IUM</span></div>}
                                </div>
                                <span className={`absolute top-1.5 right-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isActive ? "bg-green-500 text-white" : isSold ? "bg-blue-500 text-white" : isRemoved ? "bg-red-500 text-white" : "bg-gray-500 text-white"}`}>
                                  {isActive ? "上架" : isSold ? "售出" : isRemoved ? "下架" : listing.status}
                                </span>
                                {batchMode && !isSold && (
                                  <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#FEDD00] bg-[#FEDD00]' : 'border-white bg-white/30'}`}>
                                    {isSelected && <Check className="w-3 h-3" style={{ color: '#06038D' }} />}
                                  </div>
                                )}
                              </div>
                              <div className="px-2.5 pt-2 pb-1">
                                <p className="font-semibold text-xs leading-snug text-gray-900 line-clamp-2 mb-1.5">{listing.title}</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-bold" style={{ color: '#06038D' }}>HKD {parseFloat(listing.priceHkd as string).toFixed(2)}</p>
                                  <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-100">×{listing.quantity}</span>
                                </div>
                              </div>
                              {!batchMode && (
                                <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
                                  {!isSold && <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-[#06038d] text-[#06038d] hover:bg-blue-50 flex-1" onClick={(e) => { e.stopPropagation(); openEditDialog(listing); }}><Pencil className="w-3 h-3 mr-1" />編輯</Button>}
                                  {isActive && <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-red-400 text-red-600 hover:bg-red-50 flex-1" disabled={deactivateMutation.isPending} onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate({ id: listing.id }); }}><EyeOff className="w-3 h-3 mr-1" />下架</Button>}
                                  {isRemoved && !isAdminDelisted && <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-green-500 text-green-700 hover:bg-green-50 flex-1" disabled={reactivateMutation.isPending} onClick={(e) => { e.stopPropagation(); reactivateMutation.mutate({ id: listing.id, status: "active" }); }}><Eye className="w-3 h-3 mr-1" />上架</Button>}
                                  {isRemoved && isAdminDelisted && <span className="text-[10px] text-red-500 font-medium">{t("seller.listings.card.adminDelisted")}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ── Compact Table View (list mode) ── */
                      <ListingTable
                        listings={filteredListings}
                        batchMode={batchMode}
                        selectedIds={selectedIds}
                        toggleSelectId={toggleSelectId}
                        isAdmin={isAdmin}
                        deactivateMutation={deactivateMutation}
                        reactivateMutation={reactivateMutation}
                        openEditDialog={openEditDialog}
                        setListingForm={setListingForm}
                        setListingImages={setListingImages}
                        setSelectedCard={setSelectedCard}
                        setListingStep={setListingStep}
                        setShowNewListing={setShowNewListing}
                        t={t}
                      />
                    )}
                  </div>
                )}
                      </div>
                    </div>
                  );
                })()}
              </BrandTabsContent>

              <BrandTabsContent value="orders" className="mt-4">
                {/* Order filter & search bar */}
                {(myOrders?.length ?? 0) > 0 && (
                  <div className="mb-4 space-y-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {([
                        { key: 'all', label: '全部' },
                        { key: 'pending', label: '待確認' },
                        { key: 'active', label: '進行中' },
                        { key: 'done', label: '已完成' },
                        { key: 'meetup', label: '🤝 面交' },
                      ] as const).map(f => (
                        <button
                          key={f.key}
                          onClick={() => setOrderStatusFilter(f.key)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                            orderStatusFilter === f.key
                              ? f.key === 'meetup' ? 'bg-amber-400 text-amber-900 border-amber-400' : 'bg-[#06038d] text-white border-[#06038d]'
                              : f.key === 'meetup' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-gray-600 border-gray-200 hover:border-[#06038d] hover:text-[#06038d]'
                          }`}
                        >
                          {f.label}
                          {f.key === 'all' && (
                            <span className="ml-1 opacity-60">({myOrders?.length ?? 0})</span>
                          )}
                          {f.key === 'meetup' && (
                            <span className="ml-1 opacity-70">({(myOrders as any[])?.filter((o: any) => o.shippingMethod === 'meetup').length ?? 0})</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={t("seller.orders.searchPlaceholder")}
                        value={orderSearchQuery}
                        onChange={e => setOrderSearchQuery(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] pr-8"
                      />
                      {orderSearchQuery && (
                        <button
                          onClick={() => setOrderSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {(() => {
                  const SELLER_ORDER_STATUS_GROUPS: Record<string, string[]> = {
                    all: [],
                    pending: ['payment_submitted', 'alipay_pending', 'pending_payment'],
                    active: ['payment_confirmed', 'payment_received', 'paid_held', 'processing', 'shipped', 'delivered'],
                    done: ['completed', 'cancelled', 'disputed'],
                    meetup: [],
                  };
                  let filtered = (myOrders as any[]) ?? [];
                  if (orderStatusFilter === 'meetup') {
                    filtered = filtered.filter(o => o.shippingMethod === 'meetup');
                  } else if (orderStatusFilter !== 'all') {
                    filtered = filtered.filter(o => SELLER_ORDER_STATUS_GROUPS[orderStatusFilter]?.includes(o.orderStatus));
                  }
                  if (orderSearchQuery.trim()) {
                    const q = orderSearchQuery.trim().toLowerCase();
                    filtered = filtered.filter(o =>
                      (o.orderNo ?? '').toLowerCase().includes(q) ||
                      (o.listingTitle ?? '').toLowerCase().includes(q)
                    );
                  }
                  if (!filtered.length) return (
                    <div className="text-center py-12 text-gray-400">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>{(myOrders?.length ?? 0) > 0 ? '沒有符合條件的訂單' : '尚無訂單'}</p>
                    </div>
                  );
                  return (
                  <div className="space-y-3">
                    {filtered.map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                        {/* Brand Header Bar */}
                        <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                          <span className="text-xs text-white/80 font-medium">
                            {item.orderNo ? `#${item.orderNo}` : `#${item.id}`}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {/* Meetup badge */}
                            {item.shippingMethod === 'meetup' && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/30 text-amber-200 border border-amber-400/40">
                                <Users className="w-3 h-3" />面交
                              </span>
                            )}
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
                        </div>
                        {/* Card Body */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            {/* Product Thumbnail */}
                            {(() => {
                              const imgs = (() => { try { return JSON.parse(item.listingImages ?? '[]'); } catch { return []; } })();
                              const thumb = imgs[0];
                              return thumb ? (
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                                  <img src={thumb} alt={item.title ?? '商品'} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                                  <span className="text-xl">🃏</span>
                                </div>
                              );
                            })()}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate text-gray-900">{item.title}</p>
                              <p className="text-sm text-gray-600 mt-0.5">
                                HKD {parseFloat(item.priceHkd as string).toFixed(2)} × {item.quantity}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{new Date(item.createdAt).toLocaleDateString('zh-HK')}</p>
                            </div>

                          </div>
                          {item.shippingName && (
                            <div className="text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                              {(() => {
                                try {
                                  const addr = typeof item.shippingAddress === 'string' ? JSON.parse(item.shippingAddress) : item.shippingAddress;
                                  const isMeetup = addr?.addressType === 'normal' || (!addr?.sfStationCode && !addr?.district);
                                  if (isMeetup && (item as any).buyerPhone) {
                                    return (
                                      <>
                                        <p>🤝 面交訂單</p>
                                        <p className="font-semibold text-[#06038D]">📞 買家電話：{(item as any).buyerPhone}</p>
                                        {addr?.address && addr.address !== '面交/其他' && <p>📍 備註：{addr.address}</p>}
                                      </>
                                    );
                                  }
                                  return (
                                    <>
                                      <p>📦 收件人：{item.shippingName} {item.shippingPhone}</p>
                                      <p>📍 地址：{(() => {
                                        const parts = [addr?.address, addr?.district, addr?.region].filter(Boolean);
                                        return parts.length > 0 ? parts.join(', ') : String(item.shippingAddress);
                                      })()}</p>
                                    </>
                                  );
                                } catch {
                                  return <p>📦 收件人：{item.shippingName} {item.shippingPhone}</p>;
                                }
                              })()}
                              {item.trackingNumber && <p>🚚 追蹤號：{item.trackingNumber}</p>}
                              {item.shippedAt && <p>📅 出貨日期：{new Date(item.shippedAt).toLocaleDateString('zh-HK')}</p>}
                              {(item as any).shippingImageUrl && (
                                <SellerShippingProof url={(item as any).shippingImageUrl} />
                              )}
                            </div>
                          )}
                          {/* Shipping proof for shipped orders without shippingName */}
                          {item.orderStatus === 'shipped' && !item.shippingName && (item as any).shippingImageUrl && (
                            <SellerShippingProof url={(item as any).shippingImageUrl} />
                          )}
                          {/* Order Status Stepper - Collapsible */}
                          <SellerOrderStepper item={item} />

                          {/* Show shipping status for shipped orders */}
                          {item.orderStatus === 'shipped' && !item.shippingName && (
                            <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                              🚚 已寄出{item.trackingNumber ? `，追蹤號：${item.trackingNumber}` : ''}
                            </div>
                          )}
                          {/* Disputed order info */}
                          {item.orderStatus === 'disputed' && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                              <p className="font-semibold flex items-center gap-1"><span>⚠️</span> 買家申請爭議，等待管理員處理</p>
                              {item.disputeReason && <p>申訴原因：{item.disputeReason}</p>}
                              {item.disputeOpenedAt && <p>申訴時間：{new Date(item.disputeOpenedAt).toLocaleDateString('zh-HK')}</p>}
                            </div>
                          )}
                          {/* Dispute resolved info */}
                          {item.disputeResolution && item.orderStatus !== 'disputed' && (
                            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-1">
                              <p className="font-semibold">爭議結果：</p>
                              <p>{item.disputeResolution.replace(/^\[.*?\]\s*/, '')}</p>
                              {item.disputeResolvedAt && <p>處理時間：{new Date(item.disputeResolvedAt).toLocaleDateString('zh-HK')}</p>}
                            </div>
                          )}
                          {/* Completed order summary */}
                          {item.orderStatus === 'completed' && (
                            <div className="space-y-1.5">
                              <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" />
                                訂單已完成，收到 HKD {parseFloat(item.sellerReceivableHkd ?? item.priceHkd ?? '0').toFixed(2)}
                              </div>
                              {/* Payout hold period info */}
                              {item.payoutStatus === 'processing' && (item as any).payoutHoldUntil && (() => {
                                const payoutHoldUntil = new Date((item as any).payoutHoldUntil);
                                const now = new Date();
                                const hoursLeft = Math.max(0, Math.ceil((payoutHoldUntil.getTime() - now.getTime()) / (1000 * 60 * 60)));
                                const hasExpired = now >= payoutHoldUntil;
                                return (
                                  <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1">
                                    <p className="font-semibold text-blue-800 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {hasExpired ? '💰 正在處理放款' : '預計放款時間'}
                                    </p>
                                    <p className="text-blue-700">
                                      {hasExpired
                                        ? '冷靜期已結束，系統正在處理轉帳給你'
                                        : `${payoutHoldUntil.toLocaleString('zh-HK', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (還有 ${hoursLeft} 小時)`
                                      }
                                    </p>
                                    {!hasExpired && (
                                      <p className="text-blue-600 text-[10px]">
                                        ⚠️ 48 小時冷靜期中，買家可申請爭議，到期後自動放款
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                              {/* Show buyer phone for completed meetup orders */}
                              {item.shippingMethod === 'meetup' && (item as any).buyerPhone && (
                                <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  <p className="font-semibold text-amber-800 flex items-center gap-1 mb-0.5">
                                    <Phone className="w-3 h-3" />買家聯絡電話
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-amber-900">{(item as any).buyerPhone}</span>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText((item as any).buyerPhone); toast.success('已複製電話號碼'); }}
                                      className="text-amber-600 hover:text-amber-800 transition-colors"
                                      title="複製電話號碼"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Bottom Action Bar */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            {/* Primary action: ship or meetup confirm */}
                            {["processing", "payment_received", "paid_held"].includes(item.orderStatus) && (
                              item.shippingMethod === 'meetup' ? (
                                <Button size="sm" className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                  onClick={() => setMeetupConfirmDialog({ open: true, orderId: item.orderId ?? item.id, orderNo: item.orderNo ?? '' })}>
                                  <Users className="w-3 h-3 mr-1" />確認已面交
                                </Button>
                              ) : (
                                <Button size="sm" className="flex-1 h-8 text-xs bg-[#06038d] hover:bg-[#0804b8] text-white"
                                  onClick={() => {
                                    setShipDialog({
                                      open: true,
                                      orderId: item.orderId ?? item.id,
                                      orderNo: item.orderNo ?? "",
                                      shippingName: item.shippingName ?? undefined,
                                      shippingPhone: item.shippingPhone ?? undefined,
                                      shippingAddress: item.shippingAddress ?? undefined,
                                    });
                                    setShipForm({ shippingMethod: "sf_express", trackingNumber: "", shippingImageUrl: "" });
                                  }}>
                                  <Package className="w-3 h-3 mr-1" />填寫出貨資料
                                </Button>
                              )
                            )}
                            {/* View detail link */}
                            {item.orderNo && (
                              <a
                                href={`/orders/${item.orderNo}`}
                                className={`inline-flex items-center justify-center gap-1 text-xs text-[#06038d] hover:text-[#0804b8] font-medium border border-[#06038d]/30 hover:border-[#06038d] rounded-lg px-3 h-8 transition-colors bg-white hover:bg-blue-50 ${
                                  ["processing", "payment_received", "paid_held"].includes(item.orderStatus) ? 'flex-shrink-0' : 'flex-1'
                                }`}
                              >
                                <ExternalLink className="w-3 h-3" />查看詳情
                              </a>
                            )}
                          </div>
                          {/* Order Chat - inline message component */}
                          {item.orderNo && (
                            <div className="mt-2">
                              <OrderChat orderNo={item.orderNo} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  );
                })()}
              </BrandTabsContent>



              <BrandTabsContent value="offers" className="mt-4">
                {/* Offer Filter Tabs */}
                {sellerOffers && sellerOffers.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => {
                      const labels = { all: '全部', pending: '待回覆', accepted: '已接受', rejected: '已拒絕' };
                      const counts = { all: sellerOffers.length, pending: sellerOffers.filter((o: any) => o.status === 'pending').length, accepted: sellerOffers.filter((o: any) => o.status === 'accepted').length, rejected: sellerOffers.filter((o: any) => o.status === 'rejected').length };
                      return (
                        <button key={f} onClick={() => setOfferFilter(f)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            offerFilter === f ? 'bg-[#06038d] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}>
                          {labels[f]} ({counts[f]})
                        </button>
                      );
                    })}
                  </div>
                )}
                {!sellerOffers?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t("seller.offers.noOffers")}</p>
                  </div>
                ) : (() => {
                  const filtered = offerFilter === 'all' ? sellerOffers : (sellerOffers as any[]).filter((o: any) => o.status === offerFilter);
                  if (filtered.length === 0) return (
                    <div className="text-center py-10 text-muted-foreground">
                      <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">沒有符合條件的出價</p>
                    </div>
                  );
                  return (
                  <div className="space-y-3">
                    {filtered.map((offer: any) => (
                      <div key={offer.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                        {/* Brand Header Bar */}
                        <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                          <span className="text-xs text-white/80 font-medium">
                            #{offer.id}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            offer.status === 'accepted'
                              ? 'bg-green-400/20 text-green-200 border border-green-400/30'
                              : offer.status === 'rejected'
                              ? 'bg-red-400/20 text-red-200 border border-red-400/30'
                              : 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/30'
                          }`}>
                            {offer.status === 'pending' ? '待回覆' : offer.status === 'accepted' ? '已接受' : '已拒絕'}
                          </span>
                        </div>
                        {/* Card Body */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            {/* Thumbnail + Info */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {(() => {
                                let imgUrl: string | null = null;
                                try {
                                  const imgs = typeof offer.listingImages === 'string'
                                    ? JSON.parse(offer.listingImages)
                                    : offer.listingImages;
                                  if (Array.isArray(imgs) && imgs.length > 0) imgUrl = imgs[0];
                                } catch {}
                                return imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={offer.listingTitle || '商品'}
                                    className="w-14 h-14 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-6 h-6 text-gray-300" />
                                  </div>
                                );
                              })()}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-semibold truncate text-gray-900 flex-1">{offer.listingTitle || '商品'}</p>
                                  {offer.listingId && (
                                    <Link href={`/listing/${offer.listingId}`} className="text-xs text-[#06038d] hover:underline flex-shrink-0">
                                      前往商品
                                    </Link>
                                  )}
                                </div>
                                {offer.listingId && (
                                  <p className="text-xs font-mono text-gray-400 mt-0.5">#BOXIUM-{offer.listingId}</p>
                                )}
                                <p className="text-lg font-bold text-[#06038d] mt-0.5">HKD {parseFloat(offer.offerPriceHkd).toFixed(2)}</p>
                                {offer.message && (
                                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 border border-gray-100 rounded px-2 py-1">{offer.message}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">{new Date(offer.createdAt).toLocaleDateString('zh-HK')}</p>
                                {/* Expiry Countdown - only show for pending offers */}
                                {offer.status === 'pending' && offer.expiresAt && (() => {
                                  const now = Date.now();
                                  const expiresTs = new Date(offer.expiresAt).getTime();
                                  const diffMs = expiresTs - now;
                                  if (diffMs <= 0) {
                                    return (
                                      <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                                        <Clock className="w-3 h-3" />已過期
                                      </span>
                                    );
                                  }
                                  const diffHours = diffMs / (1000 * 60 * 60);
                                  const diffDays = Math.floor(diffHours / 24);
                                  const remHours = Math.floor(diffHours % 24);
                                  const isUrgent = diffHours < 24; // less than 1 day
                                  const isWarning = diffHours < 48; // less than 2 days
                                  const label = diffDays > 0
                                    ? `還有 ${diffDays} 天 ${remHours} 小時到期`
                                    : `還有 ${Math.floor(diffHours)} 小時到期`;
                                  return (
                                    <span className={`inline-flex items-center gap-1 mt-1.5 text-xs font-medium rounded-full px-2 py-0.5 border ${
                                      isUrgent
                                        ? 'text-red-600 bg-red-50 border-red-200'
                                        : isWarning
                                        ? 'text-amber-600 bg-amber-50 border-amber-200'
                                        : 'text-gray-500 bg-gray-50 border-gray-200'
                                    }`}>
                                      <Clock className="w-3 h-3" />{label}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                            {/* Bottom Action Bar for offer */}
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                              {offer.status === 'pending' ? (
                                <>
                                  <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                                    disabled={respondToOfferMutation.isPending}
                                    onClick={() => respondToOfferMutation.mutate({ offerId: offer.id, action: 'accept' })}
                                  >
                                    <Check className="w-3 h-3 mr-1" />接受出價
                                  </Button>
                                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                    disabled={respondToOfferMutation.isPending}
                                    onClick={() => { setRejectingOfferId(offer.id); setRejectionReason(""); setShowRejectDialog(true); }}
                                  >
                                    <X className="w-3 h-3 mr-1" />拒絕
                                  </Button>
                                </>
                              ) : (
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                                  offer.status === 'accepted' ? 'bg-green-50 text-green-700 border border-green-200' :
                                  offer.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  'bg-gray-50 text-gray-600 border border-gray-200'
                                }`}>
                                  {offer.status === 'accepted' ? <>{t("seller.offers.card.status.accepted")}</> : offer.status === 'rejected' ? <>{t("seller.offers.card.status.rejected")}</> : <>{t("seller.offers.card.status.expired")}</>}
                                </span>
                              )}
                              {offer.listingId && (
                                <Link href={`/listing/${offer.listingId}`} className="inline-flex items-center gap-1 text-xs text-[#06038d] hover:text-[#0804b8] font-medium border border-[#06038d]/30 hover:border-[#06038d] rounded-lg px-3 h-8 transition-colors bg-white hover:bg-blue-50 flex-shrink-0">
                                  <ExternalLink className="w-3 h-3" />前往商品
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  );
                })()
              }
              </BrandTabsContent>
              <BrandTabsContent value="earnings" className="mt-4">
                <EarningsTab />
              </BrandTabsContent>
              <BrandTabsContent value="auctions" className="mt-4">
                <SellerAuctionsTab />
              </BrandTabsContent>
            </BrandTabs>
          </>
        )}
        </div>
      </div>
      {/* ─── Bulk Upload Dialog ─────────────────────────────────────────── */}
      <Dialog open={showBulkUpload} onOpenChange={(open) => { setShowBulkUpload(open); if (!open) { setCsvRows([]); setBulkUploading(false); } }}>
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-2xl">
          <VisuallyHidden><DialogTitle>{t("seller.bulkUpload.title")}</DialogTitle></VisuallyHidden>
          <div className="px-5 pt-5 pb-4" style={{backgroundColor: '#06038D', borderBottom: '3px solid #FEDD00'}}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-white">{t("seller.bulkUpload.title")}</h2>
              <button onClick={() => setShowBulkUpload(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-white/60 text-xs">{t("seller.bulkUpload.description")}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* CSV Template Download */}
            <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3">
              <p className="text-xs font-semibold text-[#06038D] mb-1">{t("seller.bulkUpload.fields.title")}</p>
              <p className="text-xs text-gray-500 font-mono">title, description, condition, price, quantity, tcg_series, allow_offers, min_offer, image_url</p>
              <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                <p>• condition: psa10 / psa9 / psa8_below / raw_a / raw_b / raw_c / raw_d</p>
                <p>• tcg_series: pokemon / onepiece / yugioh</p>
                <p>• allow_offers: true / false</p>
                <p>• min_offer: 最低出價金額（可留空）</p>
                <p>• image_url: 公開圖片 URL，多張用 | 分隔（可留空）</p>
              </div>
              <button
                className="mt-2 text-xs text-[#06038D] underline font-medium"
                onClick={() => {
                  const csv = 'title,description,condition,price,quantity,tcg_series,allow_offers,min_offer,image_url\n示範商品,全新未拆封,raw_a,500,1,pokemon,false,,https://example.com/image.jpg';
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'boxium-bulk-template.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                下載範本 CSV
              </button>
            </div>
            {/* File Upload */}
            {csvRows.length === 0 && (
              <div
                className="border-2 border-dashed border-[#06038D]/30 rounded-xl p-6 text-center cursor-pointer hover:border-[#06038D]/60 transition-colors"
                onClick={() => document.getElementById('csv-file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) { const reader = new FileReader(); reader.onload = (ev) => parseCsv(ev.target?.result as string); reader.readAsText(file); }
                }}
              >
                <Layers className="w-8 h-8 mx-auto mb-2 text-[#06038D]/40" />
                <p className="text-sm font-medium text-[#06038D]">{t("seller.bulkUpload.cta")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("seller.bulkUpload.fileTypes")}</p>
                <input id="csv-file-input" type="file" accept=".csv" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { const reader = new FileReader(); reader.onload = (ev) => parseCsv(ev.target?.result as string); reader.readAsText(file); }
                }} />
              </div>
            )}
            {/* Preview Table */}
            {csvRows.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#06038D]">預覽 {csvRows.length} 件商品</p>
                  <button className="text-xs text-gray-400 underline" onClick={() => setCsvRows([])}>{t("seller.bulkUpload.reupload")}</button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-[#06038D]/20">
                  <table className="w-full text-xs">
                    <thead className="bg-[#06038D] text-white">
                      <tr>
                        <th className="px-3 py-2 text-center">{t("seller.bulkUpload.table.image")}</th>
                        <th className="px-3 py-2 text-left">{t("seller.bulkUpload.table.productName")}</th>
                        <th className="px-3 py-2 text-left">{t("seller.auctions.editRejected.conditionLabel")}</th>
                        <th className="px-3 py-2 text-right">{t("seller.bulkUpload.table.price")}</th>
                        <th className="px-3 py-2 text-center">{t("seller.listings.card.quantity")}</th>
                        <th className="px-3 py-2 text-center">{t("seller.bulkUpload.table.series")}</th>
                        <th className="px-3 py-2 text-center">{t("seller.bulkUpload.table.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} className={`border-t border-[#06038D]/10 ${
                          row._status === 'done' ? 'bg-green-50' :
                          row._status === 'error' ? 'bg-red-50' :
                          row._status === 'uploading' ? 'bg-yellow-50' : 'bg-white'
                        }`}>
                          <td className="px-3 py-2 text-center">
                            {row.imageUrls.length > 0 ? (
                              <div className="flex items-center gap-1 justify-center">
                                <img src={row.imageUrls[0]} alt="" className="w-8 h-8 object-cover rounded border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                {row.imageUrls.length > 1 && <span className="text-[10px] text-gray-400">+{row.imageUrls.length - 1}</span>}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-[10px]">無</span>
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[120px] truncate">{row.title}</td>
                          <td className="px-3 py-2">{row.condition}</td>
                          <td className="px-3 py-2 text-right">HKD {parseFloat(row.price || '0').toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">{row.quantity}</td>
                          <td className="px-3 py-2 text-center">{row.tcgSeries}</td>
                          <td className="px-3 py-2 text-center">
                            {row._status === 'pending' && <span className="text-gray-400">{t("seller.bulkUpload.status.pending")}</span>}
                            {row._status === 'uploading' && <span className="text-yellow-600">{t("seller.bulkUpload.status.uploading")}</span>}
                            {row._status === 'done' && <span className="text-green-600">{t("seller.bulkUpload.status.done")}</span>}
                            {row._status === 'error' && <span className="text-red-600" title={row._error}>{t("seller.bulkUpload.status.error")}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          {csvRows.length > 0 && (
            <div className="px-5 py-4 bg-white" style={{borderTop: '1px solid rgba(6,3,141,0.15)'}}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">
                  {csvRows.filter(r => r._status === 'done').length} / {csvRows.length} 件完成
                </span>
                {csvRows.some(r => r._status === 'error') && (
                  <span className="text-xs text-red-500">{csvRows.filter(r => r._status === 'error').length} 件失敗</span>
                )}
              </div>
              <Button
                className="w-full font-bold"
                style={{ background: '#FEDD00', color: '#06038D' }}
                disabled={bulkUploading || csvRows.every(r => r._status === 'done')}
                onClick={async () => {
                  setBulkUploading(true);
                  const conditionMap: Record<string, string> = {
                    psa10: 'psa10', psa9: 'psa9', psa8_below: 'psa8_below',
                    bgs10: 'bgs10', bgs9: 'bgs9', bgs8_below: 'bgs8_below',
                    tag10: 'tag10', tag9_below: 'tag9_below',
                    raw_a: 'raw_a', raw_b: 'raw_b', raw_c: 'raw_c', raw_d: 'raw_d',
                  };
                  const seriesMap: Record<string, string> = { pokemon: 'pokemon', onepiece: 'onepiece', yugioh: 'yugioh' };
                  for (let i = 0; i < csvRows.length; i++) {
                    if (csvRows[i]._status === 'done') continue;
                    setCsvRows(prev => prev.map((r, idx) => idx === i ? { ...r, _status: 'uploading' } : r));
                    try {
                      const row = csvRows[i];
                      const priceNum = parseFloat(row.price);
                      if (isNaN(priceNum) || priceNum <= 0) throw new Error('售價格式錯誤');
                      // Use trpc client directly
                      await new Promise<void>((resolve, reject) => {
                        const utils2 = { resolve, reject };
                        void (async () => {
                          try {
                            // We need to call the mutation imperatively
                            const result = await fetch('/api/trpc/marketplace.adminCreatePlatformListing', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                json: {
                                  title: row.title,
                                  description: row.description || undefined,
                                  condition: conditionMap[row.condition] ?? 'raw_a',
                                  price: priceNum,
                                  quantity: parseInt(row.quantity) || 1,
                                  status: 'active',
                                  allowOffers: row.allowOffers === 'true',
                                  minOfferHkd: row.allowOffers === 'true' && row.minOffer ? parseFloat(row.minOffer) : undefined,
                                  tcgSeries: seriesMap[row.tcgSeries] ?? 'pokemon',
                                  images: row.imageUrls.length > 0 ? row.imageUrls.slice(0, 5) : undefined,
                                }
                              }),
                            });
                            if (!result.ok) throw new Error(`HTTP ${result.status}`);
                            const data = await result.json();
                            if (data?.error) throw new Error(data.error.message ?? '上架失敗');
                            utils2.resolve();
                          } catch (err) { utils2.reject(err); }
                        })();
                      });
                      setCsvRows(prev => prev.map((r, idx) => idx === i ? { ...r, _status: 'done' } : r));
                    } catch (err: any) {
                      setCsvRows(prev => prev.map((r, idx) => idx === i ? { ...r, _status: 'error', _error: err?.message ?? '未知錯誤' } : r));
                    }
                    // Small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 300));
                  }
                  setBulkUploading(false);
                  refetchListings();
                  const doneCount = csvRows.filter(r => r._status === 'done').length + 1;
                  toast.success(`批量上架完成！${doneCount} 件商品已上架`);
                }}
              >
                {bulkUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("seller.bulkUpload.uploadingButton")}</>
                ) : csvRows.every(r => r._status === 'done') ? (
                  '全部完成'
                ) : (
                  `確認上架 ${csvRows.filter(r => r._status === 'pending' || r._status === 'error').length} 件商品`
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("seller.apply.title")}</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setShowApply(false)}>{t("seller.auctions.editRejected.cancel")}</Button>
            <Button className="bg-[#06038d] hover:bg-[#0804b8] text-white"
              disabled={!applyForm.displayName || applyMutation.isPending}
              onClick={() => applyMutation.mutate({ displayName: applyForm.displayName, bio: applyForm.bio || undefined })}>
              {applyMutation.isPending ? "提交中..." : "提交申請"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Offer Dialog ──────────────────────────────────────────── */}
      <Dialog open={showRejectDialog} onOpenChange={(v) => { setShowRejectDialog(v); if (!v) { setRejectingOfferId(null); setRejectionReason(""); } }}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: "#06038d" }}>拒絕出價</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">你可以選擇填寫拒絕原因，買家將會收到通知。</p>
            <div>
              <Label className="text-sm font-medium text-gray-700">拒絕原因（選填）</Label>
              <Textarea
                className="mt-1.5 resize-none"
                placeholder="例如：此出價低於我的底價，請重新出價...（最多 300 字）"
                maxLength={300}
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{rejectionReason.length}/300</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">⚠️ 拒絕後買家將收到通知，此操作不可撤回。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-gray-700 bg-white" onClick={() => setShowRejectDialog(false)}>{t("seller.auctions.editRejected.cancel")}</Button>
            <Button
              className="text-white font-bold"
              style={{ backgroundColor: "#dc2626" }}
              disabled={respondToOfferMutation.isPending}
              onClick={() => {
                if (!rejectingOfferId) return;
                respondToOfferMutation.mutate(
                  { offerId: rejectingOfferId, action: 'reject', rejectionReason: rejectionReason.trim() || undefined },
                  {
                    onSuccess: () => {
                      setShowRejectDialog(false);
                      setRejectingOfferId(null);
                      setRejectionReason("");
                    },
                  }
                );
              }}
            >
              {respondToOfferMutation.isPending ? "處理中..." : "確認拒絕"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Listing Dialog ─────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setEditingListing(null); }}>
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
          <VisuallyHidden><DialogTitle>編輯商品資訊</DialogTitle></VisuallyHidden>
          {/* Header - same style as new listing */}
          <div className="px-5 pt-5 pb-4" style={{backgroundColor: '#06038D', borderBottom: '3px solid #FEDD00'}}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">編輯商品資訊</h2>
                {editingListing && (
                  <p className="text-xs text-white/60 mt-0.5 truncate max-w-[260px]">{editingListing.title}</p>
                )}
              </div>
              <button
                onClick={() => setShowEditDialog(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-white">
            {/* Summary card */}
            {editingListing && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#06038D]/20 bg-[#06038D]/5">
                {(() => {
                  let coverImg: string | null = null;
                  try {
                    const imgs = editingListing.images ? JSON.parse(editingListing.images as string) : null;
                    coverImg = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                  } catch {}
                  return coverImg ? (
                    <img src={coverImg} alt={editingListing.title} className="w-12 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #06038d 0%, #0a06b5 100%)' }}>
                      <span className="text-white font-black text-[8px] tracking-tight text-center leading-tight">BOX<br/>IUM</span>
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#06038D] truncate">{editingListing.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">現售價 HKD {parseFloat(editingListing.priceHkd as string).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">庫存 {editingListing.quantity} 件</p>
                </div>
              </div>
            )}

            {/* Warning: listing has active orders (remainingQuantity < quantity means stock was sold) */}
            {editingListing && editingListing.remainingQuantity !== undefined && editingListing.remainingQuantity < editingListing.quantity && (
              <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-xs font-semibold text-amber-800">此商品有進行中的訂單</p>
                  <p className="text-xs text-amber-700 mt-0.5">已售出 {editingListing.quantity - editingListing.remainingQuantity} 件，修改售價不影響已建立的訂單金額。</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-[#06038D] font-semibold">{t("seller.bulkUpload.table.productName")}</Label>
              <Input
                className="mt-1 bg-white text-black border-gray-300 placeholder:text-gray-400 focus:border-[#06038D]"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder={t("seller.bulkUpload.table.productName")}
              />
            </div>
            <div>
              <Label className="text-[#06038D] font-semibold">{t("seller.newListing.productDescription")}</Label>
              <Textarea
                className="mt-1 resize-none bg-white text-black border-gray-300 placeholder:text-gray-400 focus:border-[#06038D]"
                rows={3}
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="商品描述（可選）"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[#06038D] font-semibold">售價（HKD）</Label>
                <p className="text-xs text-gray-400 mb-1">最低 HKD 4.00</p>
                <Input
                  type="number"
                  min="4"
                  step="0.01"
                  className="bg-white text-black border-gray-300 placeholder:text-gray-400 focus:border-[#06038D]"
                  value={editForm.price}
                  onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="100.00"
                />
              </div>
              <div>
                <Label className="text-[#06038D] font-semibold">庫存數量</Label>
                <p className="text-xs text-gray-400 mb-1">最少 1 件</p>
                <Input
                  type="number"
                  min="1"
                  className="bg-white text-black border-gray-300 placeholder:text-gray-400 focus:border-[#06038D]"
                  value={editForm.quantity}
                  onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 bg-white flex gap-3">
            <Button variant="outline" className="flex-1 h-11 border-red-500 text-red-600 hover:bg-red-50" onClick={() => setShowEditDialog(false)}>{t("seller.auctions.editRejected.cancel")}</Button>
            <Button
              className="flex-1 h-11 font-bold text-base"
              style={{ background: '#FEDD00', color: '#06038D' }}
              disabled={updateListingMutation.isPending}
              onClick={() => {
                if (!editingListing) return;
                const price = parseFloat(editForm.price);
                const quantity = parseInt(editForm.quantity);
                if (isNaN(price) || price < 4) { toast.error("售價不能低於 HKD 4.00"); return; }
                if (isNaN(quantity) || quantity < 1) { toast.error("庫存數量不能小於 1"); return; }
                updateListingMutation.mutate({
                  id: editingListing.id,
                  title: editForm.title || undefined,
                  description: editForm.description || undefined,
                  price,
                  quantity,
                });
              }}
            >
              {updateListingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              儲存更改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewListing} onOpenChange={(open) => { setShowNewListing(open); if (!open) setListingStep(1); }}>
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
          <VisuallyHidden><DialogTitle>上架新商品</DialogTitle></VisuallyHidden>
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
              {[{ n: 1, label: "基本資料" }, { n: 2, label: "定價設定" }, { n: 3, label: t("seller.newListing.preview.submitListing") }].map(({ n, label }, idx) => (
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
                {listingImages.length === 0 && (
                  <p className="text-xs text-red-500 -mt-2">* 請至少上傳一張商品圖片（必填）</p>
                )}
                {/* Card Picker */}
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.associateCard")}</Label>
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
                          <p className="text-[10px] text-[#06038D]/80 font-medium mt-0.5">PSA 10 市場均價 HKD {parseFloat(String(selectedCard.referencePrice)).toLocaleString()}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[#06038D] hover:bg-[#06038D]/10" onClick={() => setShowCardPicker(true)}>{t("seller.newListing.changeCard")}</Button>
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
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.productName")}</Label>
                  <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" placeholder={t("seller.newListing.productNamePlaceholder")}
                    value={listingForm.title}
                    onChange={(e) => setListingForm(p => ({ ...p, title: e.target.value }))} />
                  {listingForm.title && listingForm.title.trim().length < 3 && (
                    <p className="text-xs text-red-500 mt-1">商品名稱至少需要 3 個字元</p>
                  )}
                </div>
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.productDescription")}</Label>
                  <Textarea className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" placeholder={t("seller.newListing.productDescriptionPlaceholder")}
                    value={listingForm.description}
                    onChange={(e) => setListingForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.tcgSeries")}</Label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {[
                      { value: "pokemon",  label: "Pokémon",   logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif" },
                      { value: "onepiece", label: "One Piece",  logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif" },
                      { value: "yugioh",   label: "Yu-Gi-Oh!",  logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp" },
                    ].map(series => (
                      <button
                        key={series.value}
                        type="button"
                        onClick={() => setListingForm(p => ({ ...p, tcgSeries: series.value }))}
                        className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                          listingForm.tcgSeries === series.value
                            ? "border-[#06038D] bg-[#06038D]/5 shadow-sm"
                            : "border-gray-200 bg-white hover:border-[#06038D]/40"
                        }`}
                      >
                        <img src={series.logo} alt={series.label} className="h-9 w-auto object-contain" />
                        <span className={`text-[10px] font-semibold ${
                          listingForm.tcgSeries === series.value ? "text-[#06038D]" : "text-gray-500"
                        }`}>{series.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Listing Mode Selector */}
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.listingMode")}</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {[
                      { value: "buy_now", label: t("seller.newListing.mode.buyNow"), icon: "🛒", desc: "買家直接以定價購買" },
                      { value: "auction", label: t("seller.tabs.myAuctionsMobile"), icon: "🔨", desc: "買家競價，時限結標" },
                    ].map(mode => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setListingForm(p => ({ ...p, listingMode: mode.value as any }))}
                        className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all text-left ${
                          listingForm.listingMode === mode.value
                            ? "border-[#06038D] bg-[#06038D]/5 shadow-sm"
                            : "border-gray-200 bg-white hover:border-[#06038D]/40"
                        }`}
                      >
                        <span className="text-xl">{mode.icon}</span>
                        <span className={`text-sm font-bold ${ listingForm.listingMode === mode.value ? "text-[#06038D]" : "text-gray-700" }`}>{mode.label}</span>
                        <span className="text-[10px] text-gray-400">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[#06038D] font-semibold">{t("seller.newListing.condition")}</Label>
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
                    <Label className="text-[#06038D] font-semibold">{t("seller.newListing.quantity")}</Label>
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
                    <span className="text-xs text-[#06038D]/40">·</span>
                    <span className="text-xs font-semibold text-[#06038D]">{listingForm.listingMode === 'auction' ? '🔨 拍賣' : '🛒 立即購買'}</span>
                  </div>
                </div>
                {/* Buy Now pricing */}
                {listingForm.listingMode === 'buy_now' && (
                <div>
                  <Label className="text-[#06038D] font-semibold">售價（HKD）*</Label>
                  {selectedCard && (
                    <div className="mt-1 mb-2">
                      {conditionPriceLoading ? (
                        <p className="text-xs text-[#06038D]/50">查詢市場均價中...</p>
                      ) : conditionPriceData?.avgPrice ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[#06038D]">
                            {conditionPriceData.isFallback
                              ? `PSA 10 市場均價（參考）：HKD ${conditionPriceData.avgPrice.toLocaleString()}`
                              : `${conditionOptions.flatMap(g => g.items).find(i => i.value === listingForm.condition)?.label ?? listingForm.condition} 市場均價：HKD ${conditionPriceData.avgPrice.toLocaleString()}`
                            }
                          </span>
                          <span className="text-[10px] text-[#06038D]/40">(基於最近 {conditionPriceData.recordCount} 筆成交)</span>
                          {conditionPriceData.isFallback && (
                            <span className="text-[10px] text-amber-600">此品相無成交記錄，顯示 PSA 10 作參考</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[#06038D]/40">此品相目前無市場均價資料</p>
                      )}
                    </div>
                  )}
                  <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="4" step="0.01" placeholder="最低 HKD 4.00"
                    value={listingForm.price}
                    onChange={(e) => setListingForm(p => ({ ...p, price: e.target.value }))} />
                  {listingForm.price && parseFloat(listingForm.price) < 4.00 && (
                    <p className="text-xs text-red-400 mt-1">定價不能低於 HKD 4.00（Stripe 信用卡付款最低限額）</p>
                  )}
                  {listingForm.price && parseFloat(listingForm.price) >= 4 && conditionPriceData?.avgPrice && (() => {
                    const refPrice = conditionPriceData.avgPrice;
                    const diff = ((parseFloat(listingForm.price) - refPrice) / refPrice) * 100;
                    const condLabel = conditionPriceData.isFallback ? 'PSA 10 市場均價' : '市場均價';
                    return (
                      <p className={`text-xs mt-1 ${diff < -15 ? "text-amber-600" : diff > 15 ? "text-green-600" : "text-gray-500"}`}>
                        {diff > 0 ? `高於${condLabel} ${diff.toFixed(0)}%` : `低於${condLabel} ${Math.abs(diff).toFixed(0)}%`}
                      </p>
                    );
                  })()}
                  {/* Real-time fee calculation - dynamic from API */}
                  {listingForm.price && parseFloat(listingForm.price) >= 4 && (() => {
                    const price = parseFloat(listingForm.price);
                    // Use dynamic fee tiers from API, fallback to hardcoded defaults
                    let rate = 0.055;
                    let tierIndex = 0;
                    if (feeTiersData && feeTiersData.length > 0) {
                      for (let i = 0; i < feeTiersData.length; i++) {
                        const t = feeTiersData[i];
                        if (!t.maxAmount || price <= t.maxAmount) {
                          rate = t.rate;
                          tierIndex = i;
                          break;
                        }
                      }
                    } else {
                      rate = price <= 5000 ? 0.055 : price <= 10000 ? 0.05 : 0.045;
                      tierIndex = price <= 5000 ? 0 : price <= 10000 ? 1 : 2;
                    }
                    const tier = tierIndex + 1;
                    const ratePercent = (rate * 100).toFixed(1).replace(/\.0$/, '');
                    const fee = price * rate;
                    const receivable = price - fee;
                    const tierBg = tier === 1 ? 'bg-yellow-50 border-yellow-200' : tier === 2 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';
                    const tierText = tier === 1 ? 'text-yellow-800' : tier === 2 ? 'text-blue-800' : 'text-green-800';
                    return (
                      <div className={`mt-2 rounded-lg border p-2.5 ${tierBg}`}>
                        <div className={`flex items-center justify-between text-xs font-semibold ${tierText}`}>
                          <span>適用第 {tier} 級費率（{ratePercent}%）</span>
                          <span>預計平台費 -HKD {fee.toFixed(2)}</span>
                        </div>
                        <div className={`flex items-center justify-between text-xs mt-1 opacity-75 ${tierText}`}>
                          <span>預計實收</span>
                          <span className="font-bold">HKD {receivable.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                )}

                {/* Auction pricing fields */}
                {listingForm.listingMode === 'auction' && (
                <div className="space-y-3">
                  {/* Market price reference */}
                  {selectedCard && conditionPriceData?.avgPrice && (
                    <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3">
                      <p className="text-xs font-semibold text-[#06038D] mb-1">📊 市場參考價</p>
                      <p className="text-sm font-bold text-[#06038D]">
                        HKD {conditionPriceData.avgPrice.toLocaleString()}
                        <span className="text-xs font-normal text-[#06038D]/50 ml-1">(基於 {conditionPriceData.recordCount} 筆成交)</span>
                      </p>
                    </div>
                  )}
                  {/* Starting bid */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">起標價（HKD）*</Label>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="1" step="1" placeholder="例：100"
                      value={listingForm.startingBid}
                      onChange={(e) => setListingForm(p => ({ ...p, startingBid: e.target.value }))} />
                  </div>
                  {/* Reserve price */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">底價（HKD，選填）</Label>
                    <p className="text-[10px] text-[#06038D]/50 mb-1">競價須達底價才會成交，底價不公開顯示</p>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="1" step="1" placeholder="留空表示無底價"
                      value={listingForm.reservePrice}
                      onChange={(e) => setListingForm(p => ({ ...p, reservePrice: e.target.value }))} />
                  </div>
                  {/* Buy now price */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">即買價（HKD，選填）</Label>
                    <p className="text-[10px] text-[#06038D]/50 mb-1">買家可以此價直接結標購買</p>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="1" step="1" placeholder="留空表示無即買價"
                      value={listingForm.buyNowPrice}
                      onChange={(e) => setListingForm(p => ({ ...p, buyNowPrice: e.target.value }))} />
                  </div>
                  {/* Bid increment */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">最低加價幅度（HKD）</Label>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] focus:border-[#06038D]" type="number" min="1" step="1"
                      value={listingForm.bidIncrement}
                      onChange={(e) => setListingForm(p => ({ ...p, bidIncrement: e.target.value }))} />
                  </div>
                  {/* Auction timing */}
                  <div className="space-y-3">
                    {/* Duration selector */}
                    <div>
                      <Label className="text-[#06038D] font-semibold">拍賣天數 *</Label>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        {[3, 7].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => {
                              setListingForm(p => {
                                const newDuration = days;
                                const pad = (n: number) => String(n).padStart(2, '0');
                                let newEndAt = p.auctionEndAt;
                                if (p.auctionStartAt && p.auctionStartAt.includes(':')) {
                                  // startAt is set: use today + chosen time
                                  const today = new Date();
                                  const [hh, mm] = p.auctionStartAt.split(':').map(Number);
                                  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0, 0);
                                  const end = new Date(start.getTime() + newDuration * 24 * 60 * 60 * 1000);
                                  newEndAt = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                                } else {
                                  // startAt is empty (immediate start): use now + duration
                                  const now = new Date();
                                  const end = new Date(now.getTime() + newDuration * 24 * 60 * 60 * 1000);
                                  newEndAt = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                                }
                                return { ...p, auctionDurationDays: newDuration, auctionEndAt: newEndAt };
                              });
                            }}
                            className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                              listingForm.auctionDurationDays === days
                                ? 'border-[#06038D] bg-[#06038D] text-white'
                                : 'border-[#06038D]/30 bg-white text-[#06038D] hover:border-[#06038D]/60'
                            }`}
                          >
                            {days} 日
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Start time - 24h time only, date = today */}
                    <div>
                      <Label className="text-[#06038D] font-semibold">開始時間（24小時制，留空表示立即開始）</Label>
                      <Input
                        className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] focus:border-[#06038D]"
                        type="time"
                        value={listingForm.auctionStartAt}
                        onChange={(e) => {
                          const timeVal = e.target.value; // "HH:MM"
                          setListingForm(p => {
                            const pad = (n: number) => String(n).padStart(2, '0');
                            let newEndAt = p.auctionEndAt;
                            if (timeVal && p.auctionDurationDays) {
                              // Build today's date with the chosen time
                              const today = new Date();
                              const [hh, mm] = timeVal.split(':').map(Number);
                              const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0, 0);
                              const end = new Date(start.getTime() + p.auctionDurationDays * 24 * 60 * 60 * 1000);
                              newEndAt = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                            } else if (!timeVal && p.auctionDurationDays) {
                              // startAt cleared: recalculate from now + duration
                              const now = new Date();
                              const end = new Date(now.getTime() + p.auctionDurationDays * 24 * 60 * 60 * 1000);
                              newEndAt = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                            }
                            return { ...p, auctionStartAt: timeVal, auctionEndAt: newEndAt };
                          });
                        }}
                      />
                    </div>
                    {/* Auto-calculated end time display */}
                    {listingForm.auctionEndAt && (
                      <div className={`space-y-1.5`}>
                        {!listingForm.auctionStartAt && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                            <span className="text-green-600 text-xs">⚡</span>
                            <span className="text-xs font-semibold text-green-700">立即開始</span>
                            <span className="text-xs text-green-600">— 上架後立即開始拍賣</span>
                          </div>
                        )}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${new Date(listingForm.auctionEndAt) <= new Date() ? 'bg-red-50 border-red-200' : 'bg-[#06038D]/5 border-[#06038D]/20'}`}>
                          <span className="text-xs text-[#06038D]/60">預計結標時間：</span>
                          <span className={`text-xs font-semibold ${new Date(listingForm.auctionEndAt) <= new Date() ? 'text-red-600' : 'text-[#06038D]'}`}>
                            {new Date(listingForm.auctionEndAt).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {new Date(listingForm.auctionEndAt) <= new Date() && (
                            <span className="text-xs text-red-500 ml-1">⚠️ 結標時間已過去，請重新設定</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                <div className="space-y-3 pt-1">
                  {listingForm.listingMode === 'buy_now' && (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-xl border border-[#06038D]/20 bg-[#06038D]/5">
                        <div>
                          <p className="text-sm font-medium text-[#06038D]">{t("seller.newListing.price.allowOffers")}</p>
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
                    </>
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
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.bulkUpload.table.productName")}</span>
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
                        <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.auctions.editRejected.descriptionLabel")}</span>
                        <span className="text-sm text-[#06038D]/80 text-right line-clamp-3">{listingForm.description}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.auctions.editRejected.conditionLabel")}</span>
                      <span className="text-sm text-[#06038D]">{conditionOptions.flatMap(g => g.items).find(i => i.value === listingForm.condition)?.label ?? listingForm.condition}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.listings.card.quantity")}</span>
                      <span className="text-sm text-[#06038D]">{listingForm.quantity}</span>
                    </div>
                    {listingForm.listingMode === 'buy_now' ? (
                      <>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.bulkUpload.table.price")}</span>
                          <span className="text-base font-bold text-[#06038D]">HKD {parseFloat(listingForm.price || "0").toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.tabs.buyerOffers")}</span>
                          <span className="text-sm text-[#06038D]">{listingForm.acceptOffers ? `接受${listingForm.minOffer ? `（最低 HKD ${listingForm.minOffer}）` : ""}` : "不接受"}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">上架模式</span>
                          <span className="text-sm font-bold text-[#06038D]">🔨 拍賣</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.auctions.card.startingBid")}</span>
                          <span className="text-base font-bold text-[#06038D]">HKD {parseFloat(listingForm.startingBid || "0").toLocaleString()}</span>
                        </div>
                        {listingForm.reservePrice && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">底價</span>
                            <span className="text-sm text-[#06038D]">HKD {parseFloat(listingForm.reservePrice).toLocaleString()} (不公開)</span>
                          </div>
                        )}
                        {listingForm.buyNowPrice && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">即買價</span>
                            <span className="text-sm font-semibold text-[#06038D]">HKD {parseFloat(listingForm.buyNowPrice).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">加價幅度</span>
                          <span className="text-sm text-[#06038D]">HKD {parseFloat(listingForm.bidIncrement || "10").toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.auctions.editRejected.auctionEndLabel")}</span>
                          <span className="text-sm text-[#06038D]">{listingForm.auctionEndAt
                            ? new Date(listingForm.auctionEndAt).toLocaleString('zh-HK')
                            : new Date(Date.now() + (listingForm.auctionDurationDays || 7) * 24 * 60 * 60 * 1000).toLocaleString('zh-HK') + '（上架後起算）'
                          }</span>
                        </div>
                      </>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-[#06038D]/20 bg-[#06038D]/5">
                        <div>
                          <p className="text-sm font-medium text-[#06038D]">{t("seller.newListing.price.allowOffers")}</p>
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
                          <Label className="text-[#06038D] font-semibold text-xs">最低接受出價（HKD，選填）</Label>
                          <Input
                            className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D] h-9 text-sm"
                            type="number"
                            min="4"
                            step="0.01"
                            placeholder="留空表示不設下限"
                            value={listingForm.minOffer}
                            onChange={(e) => setListingForm(p => ({ ...p, minOffer: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-xs text-[#06038D]">
                    {isAdmin ? (
                      <p className="font-medium">確認後直接公開上架</p>
                    ) : (
                      <>
                        <p className="font-medium">提交後立即公開上架</p>
                        <p className="mt-0.5">商品提交後將自動公開，展示於市集中供買家瀏覽。</p>
                      </>
                    )}
                  </div>

                  {/* Terms Agreement Checkbox */}
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-colors"
                    style={{ borderColor: listingTermsAgreed ? '#06038D' : 'rgba(6,3,141,0.2)', backgroundColor: listingTermsAgreed ? 'rgba(6,3,141,0.05)' : 'white' }}
                  >
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={listingTermsAgreed}
                        onChange={(e) => setListingTermsAgreed(e.target.checked)}
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        listingTermsAgreed ? 'border-[#06038D] bg-[#06038D]' : 'border-[#06038D]/40 bg-white'
                      }`}>
                        {listingTermsAgreed && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <span className="text-xs text-[#06038D]/80 leading-normal">
                      我已閱讀並同意
                      <a href="/auction/terms" target="_blank" rel="noopener noreferrer"
                        className="font-semibold text-[#06038D] underline underline-offset-2 hover:text-[#06038D]/70 mx-1"
                        onClick={(e) => e.stopPropagation()}
                      >買賣條款</a>
                      ，包括平台服務費率、拍賣規則及退款政策。
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="px-5 py-4 flex gap-2 bg-white" style={{borderTop: '1px solid rgba(6,3,141,0.15)'}}>
            {listingStep === 1 && (
              <Button variant="outline" className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white" onClick={() => setShowNewListing(false)}>{t("seller.auctions.editRejected.cancel")}</Button>
            )}
            {listingStep > 1 && (
              <Button variant="outline" className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white" onClick={() => setListingStep(s => (s - 1) as 1 | 2 | 3)}>{t("seller.newListing.back")}</Button>
            )}
            {listingStep < 3 && (
              <Button
                className="flex-1 bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
                disabled={
                  listingStep === 1 ? (!listingForm.title || listingForm.title.trim().length < 3 || listingImages.length === 0) :
                  listingStep === 2 ? (
                    listingForm.listingMode === 'auction'
                      ? (!listingForm.startingBid || !listingForm.auctionEndAt || new Date(listingForm.auctionEndAt) <= new Date())
                      : (!listingForm.price || parseFloat(listingForm.price) < 4.00)
                  ) : false
                }
                onClick={() => {
                  // When entering Step 2 in auction mode, auto-compute auctionEndAt with default 3 days
                  if (listingStep === 1 && listingForm.listingMode === 'auction' && !listingForm.auctionEndAt) {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const now = new Date();
                    const days = listingForm.auctionDurationDays || 3;
                    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
                    const newEndAt = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                    setListingForm(p => ({ ...p, auctionEndAt: newEndAt }));
                  }
                  setListingStep(s => (s + 1) as 1 | 2 | 3);
                }}
              >
                下一步
              </Button>
            )}
            {listingStep === 3 && (
              <Button
                className="flex-1 bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold disabled:opacity-50"
                disabled={createListingMutation.isPending || adminCreateListingMutation.isPending || createAuctionMutation.isPending || !listingTermsAgreed}
                onClick={() => {
                  if (listingForm.listingMode === 'auction') {
                    // Check if seller has agreed to terms first
                    if (!sellerTermsData?.agreed) {
                      setPendingAuctionSubmit(true);
                      setShowSellerTerms(true);
                      return;
                    }
                    // Auction mode - call auction.create
                    createAuctionMutation.mutate({
                      title: listingForm.title,
                      description: listingForm.description || undefined,
                      condition: listingForm.condition as any,
                      quantity: parseInt(listingForm.quantity),
                      images: listingImages.length > 0 ? listingImages : undefined,
                      cardId: selectedCard?.id ?? undefined,
                      tcgSeries: listingForm.tcgSeries as any,
                      startingBid: parseFloat(listingForm.startingBid),
                      reservePrice: listingForm.reservePrice ? parseFloat(listingForm.reservePrice) : undefined,
                      buyNowPrice: listingForm.buyNowPrice ? parseFloat(listingForm.buyNowPrice) : undefined,
                      bidIncrement: parseFloat(listingForm.bidIncrement || '10'),
                      auctionStartAt: (() => {
                        if (!listingForm.auctionStartAt) return undefined;
                        const today = new Date();
                        const [hh, mm] = listingForm.auctionStartAt.split(':').map(Number);
                        return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0, 0);
                      })(),
                      auctionEndAt: (() => {
                        // If auctionEndAt is set, use it; otherwise calculate from now + duration
                        if (listingForm.auctionEndAt) return new Date(listingForm.auctionEndAt);
                        const now = new Date();
                        return new Date(now.getTime() + (listingForm.auctionDurationDays || 7) * 24 * 60 * 60 * 1000);
                      })(),
                    });
                  } else {
                    const payload = {
                      title: listingForm.title,
                      description: listingForm.description || undefined,
                      condition: listingForm.condition as any,
                      price: parseFloat(listingForm.price),
                      quantity: parseInt(listingForm.quantity),
                      images: listingImages.length > 0 ? listingImages : undefined,
                      cardId: selectedCard?.id ?? undefined,
                      tcgSeries: listingForm.tcgSeries as any,
                    };
                    if (isAdmin) {
                      adminCreateListingMutation.mutate({
                        ...payload,
                        status: 'active',
                        allowOffers: listingForm.acceptOffers,
                        minOfferHkd: listingForm.acceptOffers && listingForm.minOffer ? parseFloat(listingForm.minOffer) : undefined,
                      });
                    } else {
                      createListingMutation.mutate({ ...payload, allowOffers: listingForm.acceptOffers, minOfferHkd: listingForm.acceptOffers && listingForm.minOffer ? parseFloat(listingForm.minOffer) : undefined });
                    }
                  }
                }}
              >
                {(createListingMutation.isPending || adminCreateListingMutation.isPending || createAuctionMutation.isPending) ? "提交中..." : "確認上架"}
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

      {/* Seller Terms Dialog */}
      <Dialog open={showSellerTerms} onOpenChange={(o) => { setShowSellerTerms(o); if (!o) setPendingAuctionSubmit(false); }}>
        <DialogContent className="max-w-lg bg-[#06038D] text-white">
          <DialogHeader>
            <DialogTitle className="text-[#FEDD00] font-black text-lg flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              拍賣賣家條款
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/90 max-h-72 overflow-y-auto pr-1">
            <p className="font-semibold text-white">上架拍賣前，請仔細閱讀並同意以下賣家責任條款：</p>
            <div className="space-y-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">✅ 商品真實性保證</p>
                <p className="text-xs">賣家須確保所上架商品為本人合法持有，商品描述、品相評級及圖片須如實反映商品狀況，不得虛假陳述或誇大。若商品為仿冒品或描述與實物不符，平台有權立即下架並封禁帳戶。</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">📦 出貨責任</p>
                <p className="text-xs">拍賣結標且買家完成付款後，賣家須於 <strong>3 個工作天內</strong>安排出貨，並在平台填寫有效追蹤號碼。逾期未出貨將被記錄違規，影響帳戶評分及上架資格。</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">🚫 撤拍限制</p>
                <p className="text-xs">拍賣一經上架並有人出價後，賣家<strong>不得</strong>無故撤回拍賣。如需撤拍，須提前聯絡平台客服說明原因。惡意撤拍將視同違規處理，首次警告，再犯將限制上架資格。</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">💰 平台服務費</p>
                <p className="text-xs">每筆成功成交的拍賣，平台將收取成交金額 <strong>5%</strong> 作為服務費，於買家付款後自動扣除。賣家實際到手金額為成交價扣除服務費後的餘額。</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">🏷️ 新賣家限制</p>
                <p className="text-xs">完成成交少於 5 次的新賣家，拍賣起拍價上限為 <strong>HK$5,000</strong>。起拍價超過 HK$10,000 的拍賣屬於高價風控監控範圍，將自動公開並通知管理員監控。</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">⚠️ 違規處理</p>
                <p className="text-xs">賣家違規（虛假描述、惡意撤拍、逾期不出貨等）將依以下程序處理：首次違規：警告 → 第二次：7 天限制上架 → 第三次：30 天封禁 → 第四次：永久封禁。</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">🤝 買賣雙方保障</p>
                <p className="text-xs">平台設有買賣雙方評價系統。拍賣完成後，買家可對賣家評分，評分記錄公開顯示於賣家個人頁面。賣家亦可對買家評分，共同維護平台交易環境。</p>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-2">
              如需查看完整條款，請訪問 <Link href="/auction/terms" className="text-[#FEDD00] underline">拍賣條款頁面</Link>
            </p>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setShowSellerTerms(false); setPendingAuctionSubmit(false); }} className="border-white/30 text-white hover:bg-white/10 bg-transparent">
              取消
            </Button>
            <Button
              className="bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
              onClick={() => agreeSellerTermsMutation.mutate({ role: 'seller' })}
              disabled={agreeSellerTermsMutation.isPending}
            >
              {agreeSellerTermsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              我同意並繼續上架
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={shipDialog.open} onOpenChange={(o) => setShipDialog(d => ({ ...d, open: o }))}>
        <DialogContent bottomSheet className="sm:max-w-md bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-[#06038d] font-bold">填寫出貨資料</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {shipDialog.orderNo && <p className="text-xs text-gray-500">訂單號：<span className="font-mono font-semibold text-[#06038d]">{shipDialog.orderNo}</span></p>}
            {/* 買家收件資訊 */}
            {shipDialog.shippingName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-[#06038d] mb-1">📦 買家收件資訊</p>
                <p className="text-xs text-gray-700">收件人：{shipDialog.shippingName}{shipDialog.shippingPhone ? ` · ${shipDialog.shippingPhone}` : ""}</p>
                {shipDialog.shippingAddress && (
                  <p className="text-xs text-gray-700">地址：{(() => {
                    try {
                      const addr = typeof shipDialog.shippingAddress === "string" ? JSON.parse(shipDialog.shippingAddress) : shipDialog.shippingAddress;
                      if (addr && typeof addr === "object") {
                        return [addr.address, addr.district, addr.region].filter(Boolean).join(", ");
                      }
                      return String(shipDialog.shippingAddress);
                    } catch {
                      return String(shipDialog.shippingAddress);
                    }
                  })()}</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-gray-800 font-medium">物流公司 <span className="text-red-500">*</span></Label>
              <Select value={shipForm.shippingMethod} onValueChange={(v) => setShipForm(f => ({ ...f, shippingMethod: v }))}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900"><SelectValue placeholder="選擇物流公司" /></SelectTrigger>
                <SelectContent>
                  {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-800 font-medium">追蹤號碼 <span className="text-red-500">*</span></Label>
              <Input
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                placeholder="例：SF1234567890"
                value={shipForm.trackingNumber}
                onChange={(e) => setShipForm(f => ({ ...f, trackingNumber: e.target.value }))}
              />
            </div>
            {/* Shipping proof image upload */}
            <div className="space-y-1.5">
              <Label className="text-gray-800 font-medium">出貨憑證圖片 <span className="text-red-500">*</span></Label>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">⚠️ 必須上傳出貨憑證（如快遞單、收據截圖），否則無法提交</p>
              {shipForm.shippingImageUrl ? (
                <div className="relative">
                  <img src={shipForm.shippingImageUrl} alt="出貨憑證" className="w-full max-h-40 object-contain rounded-lg border border-[#06038d]/30 bg-gray-50" />
                  <button
                    type="button"
                    onClick={() => setShipForm(f => ({ ...f, shippingImageUrl: "" }))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                  >✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#06038d]/40 rounded-lg cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition-colors">
                  {shipImageUploading ? (
                    <div className="flex items-center gap-2 text-[#06038d]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">{t("seller.imageUploader.uploading")}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[#06038d]">
                      <ImagePlus className="w-6 h-6" />
                      <span className="text-xs font-medium">點擊上傳出貨照片</span>
                      <span className="text-xs text-gray-400">支援 JPG、PNG（最大 10MB）</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={shipImageUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { toast.error("圖片大小不能超過 10MB"); return; }
                      setShipImageUploading(true);
                      try {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const base64 = (ev.target?.result as string).split(',')[1];
                          const result = await uploadShippingImageMutation.mutateAsync({
                            orderId: shipDialog.orderId,
                            imageBase64: base64,
                            mimeType: file.type,
                          });
                          setShipForm(f => ({ ...f, shippingImageUrl: result.url }));
                          setShipImageUploading(false);
                        };
                        reader.readAsDataURL(file);
                      } catch (err: any) {
                        toast.error(parseApiError(err));
                        setShipImageUploading(false);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-red-400 text-red-600 hover:bg-red-50" onClick={() => setShipDialog(d => ({ ...d, open: false }))}>{t("seller.auctions.editRejected.cancel")}</Button>
            <Button
              className="bg-[#06038d] hover:bg-[#0804b8] text-white"
              disabled={!shipForm.shippingMethod || !shipForm.trackingNumber || !shipForm.shippingImageUrl || markShippedMutation.isPending || shipImageUploading}
              onClick={() => markShippedMutation.mutate({
                orderId: shipDialog.orderId,
                shippingMethod: shipForm.shippingMethod,
                trackingNo: shipForm.trackingNumber,
                shippingImageUrl: shipForm.shippingImageUrl || undefined,
              })}
            >
              {markShippedMutation.isPending ? "處理中..." : "確認出貨"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meetup Confirm Dialog */}
      <Dialog open={meetupConfirmDialog.open} onOpenChange={(open) => !open && setMeetupConfirmDialog({ open: false, orderId: 0, orderNo: '' })}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              確認已面交
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-700">
              確認已與買家完成面交？訂單將直接標記為「已完成」。
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              訂單號：{meetupConfirmDialog.orderNo}
            </div>
            <p className="text-xs text-gray-500">此操作不可復原，請確認已完成面交再進行。</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMeetupConfirmDialog({ open: false, orderId: 0, orderNo: '' })}>
              取消
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={confirmMeetupMutation.isPending}
              onClick={() => confirmMeetupMutation.mutate({ orderId: meetupConfirmDialog.orderId })}
            >
              {confirmMeetupMutation.isPending ? '處理中...' : '確認已面交'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl">
          {/* BOXIUM-style header */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#FEDD00] rounded-lg flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-[#06038D]" />
              </div>
              <span className="text-white font-black text-lg">確認刪除商品</span>
            </div>
          </div>
          {/* Body */}
          <div className="bg-white px-6 py-4 space-y-4">
            {(() => {
              const deletableListings = Array.from(selectedIds)
                .map(id => (myListings ?? []).find((x: any) => x.id === id))
                .filter((l): l is any => !!l && l.status !== 'sold');
              return (
                <>
                  <p className="text-sm text-gray-700">
                    您即將永久刪除以下 <strong className="text-[#06038D]">{deletableListings.length} 件</strong>商品，此操作不可復原：
                  </p>
                  <div className="border border-[#06038D]/20 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {deletableListings.map((l, idx) => (
                      <div key={l.id} className={`flex items-center gap-2 px-3 py-2.5 text-sm border-b border-[#06038D]/10 last:border-0 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#06038D]/3'
                      }`}>
                        <span className="text-[#06038D]/50 font-mono text-xs shrink-0 font-bold">#BOXIUM-{String(l.id).padStart(6, '0')}</span>
                        <span className="text-gray-800 truncate flex-1 font-medium">{l.title || '(未命名商品)'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                          l.status === 'active' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {l.status === 'active' ? '上架中' : '已下架'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            <div className="bg-[#06038D]/5 border border-[#06038D]/15 rounded-xl p-3">
              <p className="text-xs text-[#06038D] font-bold mb-1">注意事項</p>
              <div className="text-xs text-[#06038D]/70 space-y-0.5">
                <p>• 商品將從資料庫永久刪除</p>
                <p>• 如有待付款訂單，將自動更新為已取消</p>
                <p>• 已售出商品不會被刪除</p>
              </div>
            </div>
          </div>
          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={batchDeleteMutation.isPending}
              className="border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/5"
            >
              取消
            </Button>
            <Button
              className="bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
              disabled={batchDeleteMutation.isPending}
              onClick={() => {
                const deletableIds = Array.from(selectedIds).filter(id => {
                  const l = (myListings ?? []).find((x: any) => x.id === id);
                  return l && l.status !== 'sold';
                });
                batchDeleteMutation.mutate({ ids: deletableIds });
              }}
            >
              {batchDeleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />刪除中...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-1" />{t("seller.listings.deleteConfirmTitle")}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
