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
import { LazyImage } from "@/components/LazyImage";
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
              {t("seller.openOriginalImage")}
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
      if (remaining <= 0) { toast.error(t("seller.maxImagesError", { max: maxImages })); return; }
      const toUpload = Array.from(files).slice(0, remaining);
      setUploading(true);
      try {
        const uploaded: string[] = [];
        for (const file of toUpload) {
          if (!file.type.startsWith("image/")) { toast.error(t("seller.notImageError", { name: file.name })); continue; }
          if (file.size > 10 * 1024 * 1024) { toast.error(t("seller.fileTooLargeError", { name: file.name })); continue; }
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload-marketplace-image", { method: "POST", body: fd });
          if (!res.ok) throw new Error(t("seller.uploadFailed"));
          const { url } = await res.json();
          uploaded.push(url);
        }
        if (uploaded.length > 0) { onChange([...images, ...uploaded]); toast.success(t("seller.uploadSuccess", { count: uploaded.length })); }
      } catch (e: any) {
        toast.error(e.message || t("seller.imageUploadFailed"));
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
              <LazyImage src={url} alt={t("seller.productImageAlt", { num: idx + 1 })} className="w-full h-full object-cover" />
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

function getConditionOptions(t: (key: string) => string) {
  return [
    { group: "PSA", items: [
      { value: "psa10", label: "PSA 10" },
      { value: "psa9", label: "PSA 9" },
      { value: "psa8_below", label: t("seller.grade.psa8Below") },
    ]},
    { group: "BGS", items: [
      { value: "bgs10", label: "BGS 10" },
      { value: "bgs9", label: "BGS 9" },
      { value: "bgs8_below", label: t("seller.grade.bgs8Below") },
    ]},
    { group: "TAG", items: [
      { value: "tag10", label: "TAG 10" },
      { value: "tag9_below", label: t("seller.grade.tag9Below") },
    ]},
    { group: t("seller.grade.rawGroup"), items: [
      { value: "raw_a", label: t("seller.grade.rawA") },
      { value: "raw_b", label: t("seller.grade.rawB") },
      { value: "raw_c", label: t("seller.grade.rawC") },
      { value: "raw_d", label: t("seller.grade.rawD") },
    ]},
  ];
}

function getOrderStatusLabel(t: (key: string) => string): Record<string, { label: string; color: string }> {
  return {
    pending_payment: { label: t("seller.status.pendingPayment"), color: "bg-yellow-100 text-yellow-800" },
    paid_held: { label: t("seller.status.paidHeld"), color: "bg-blue-100 text-blue-800" },
    payment_received: { label: t("seller.status.paymentReceived"), color: "bg-blue-100 text-blue-800" },
    processing: { label: t("seller.status.processing"), color: "bg-purple-100 text-purple-800" },
    shipped: { label: t("seller.status.shipped"), color: "bg-indigo-100 text-indigo-800" },
    delivered: { label: t("seller.status.delivered"), color: "bg-teal-100 text-teal-800" },
    completed: { label: t("seller.status.completed"), color: "bg-green-100 text-green-800" },
    cancelled: { label: t("seller.status.cancelled"), color: "bg-red-100 text-red-800" },
    disputed: { label: t("seller.status.disputed"), color: "bg-orange-100 text-orange-800" },
  };
}

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
          <LazyImage src={url} alt={t("seller.shippingProofAlt")} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </button>
      </div>
      <ImageLightbox src={url} alt={t("seller.shippingProofAlt")} isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
}

// ─── SellerOrderStepper ─────────────────────────────────────────────────────
function SellerOrderStepper({ item }: { item: any }) {
  const { t } = useTranslation();
  const [showStep, setShowStep] = useState(false);
  const statusText = (() => {
    const s = item.orderStatus;
    if (s === 'pending_payment') return t('seller.statusHelper.pendingPayment');
    if (s === 'payment_review' || s === 'payment_submitted' || s === 'alipay_pending') return t('seller.statusHelper.paymentReview');
    if (s === 'paid' || s === 'paid_held' || s === 'payment_received' || s === 'processing') return t('seller.statusHelper.paidShipNow');
    if (s === 'shipped') return t('seller.statusHelper.shipped');
    if (s === 'delivered') return t('seller.statusHelper.delivered');
    if (s === 'completed') return t('seller.statusHelper.completed');
    if (s === 'cancelled') return t('seller.statusHelper.cancelled');
    if (s === 'dispute' || s === 'disputed') return t('seller.statusHelper.disputed');
    if (s === 'refunded') return t('seller.statusHelper.refunded');
    return s;
  })();
  const isTerminal = ['completed', 'cancelled', 'refunded'].includes(item.orderStatus);
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
          <span>{showStep ? t('common.collapse') : t('seller.viewProgress')}</span>
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
  const { t } = useTranslation();
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
      toast.success(t("seller.shareImageDownloaded"));
    } catch (err) {
      console.error(err);
      toast.error(t("seller.shareImageFailed"));
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(listingUrl);
      setCopied(true);
      toast.success(t("seller.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("seller.copyFailed"));
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
        toast.info(t("seller.instagramCopyHint"));
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
          title={t("seller.shareProduct")}
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-700">{t("seller.shareProduct")}</p>
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
            {generatingImage ? t("common.generating") : t("seller.generateShareImage")}
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
            {copied ? t("seller.copied") : t("seller.copyLink")}
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
          {t("seller.revenueDesc")}
        </p>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">{t("seller.stats.completedOrders")}</p>
          <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{summary.completedCount}</p>
          <p className="text-xs text-gray-400 mt-1">{t("seller.pendingOrders", { count: summary.pendingCount })}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">{t("seller.totalSales")}</p>
          <p className="text-2xl font-bold" style={{ color: "#06038d" }}>HKD {summary.totalRevenue.toFixed(0)}</p>
          <p className="text-xs text-gray-400 mt-1">{t("seller.platformFeeAmount", { amount: summary.totalFees.toFixed(0) })}</p>
        </div>
         <div className="col-span-2 bg-gradient-to-r from-[#06038d] to-[#0a06b5] rounded-2xl shadow-md p-4">
          <p className="text-xs text-white/70 mb-1">{t("seller.totalNetIncome")}</p>
          <p className="text-3xl font-bold text-white">HKD {summary.totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-white/60 mt-1">{t("seller.netIncomeDesc")}</p>
        </div>
        {pendingPayoutAmount > 0 && (
          <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-amber-600" />
              <p className="text-xs text-amber-700 font-medium">{t("seller.pendingIncome")}</p>
            </div>
            <p className="text-2xl font-bold text-amber-700">HKD {pendingPayoutAmount.toFixed(2)}</p>
            <p className="text-xs text-amber-600 mt-1">{t("seller.pendingIncomeDesc")}</p>
          </div>
        )}
      </div>
      {/* Monthly Revenue Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">{t("seller.revenueChart")}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `$${v}`} width={48} />
              <Tooltip
                formatter={(value) => [`HKD ${Number(value ?? 0).toFixed(0)}`, t('seller.netIncome')] as [string, string]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Bar dataKey="revenue" fill="#06038d" radius={[4, 4, 0, 0]} name={t("seller.completedOrders.netIncome")} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>{t("seller.completedOrders", { count: monthlyData.reduce((s: number, m: any) => s + m.orders, 0) })}</span>
            <span>{t("seller.thisMonth", { count: monthlyData[monthlyData.length - 1]?.orders ?? 0 })}</span>
          </div>
        </div>
      )}
      {/* Orders List */}
      {!orders.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t("seller.noCompletedOrders")}</p>
          <p className="text-sm mt-1">{t("seller.noCompletedOrdersDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">{t("seller.paymentDetails", { count: orders.length })}</p>
          {(orders as any[]).map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              {/* Brand Header Bar */}
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                <span className="text-xs text-white/80 font-medium">{t("common.order")} #{order.orderNo ?? order.id}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/20 text-green-200 border border-green-400/30">
                  {t("seller.status.completed")}
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
                      <LazyImage src={imgUrl} alt={order.title || t('seller.product')} className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{order.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('seller.completedDate')}：{order.completedAt ? new Date(order.completedAt).toLocaleDateString('zh-HK') : new Date(order.updatedAt).toLocaleDateString('zh-HK')}
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
                    <span className="text-gray-500">{t("seller.platformFee", { rate: parseFloat(order.platformFeeRate ?? '0.05') * 100 })}</span>
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
      <DialogContent bottomSheet className="lg:max-w-lg max-h-[90vh] overflow-y-auto p-0 border-0 lg:rounded-2xl bg-white text-gray-900">
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
            <Label className="text-[#06038D] font-bold text-xs uppercase tracking-wide">{t("seller.instantBuyPrice")} (HK$) <span className="text-gray-400 normal-case font-normal">{t("seller.auctions.editRejected.optionalLabel")}</span></Label>
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
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-[2] bg-[#06038D] hover:bg-[#0804b8] text-white rounded-xl font-black h-11 shadow-lg shadow-[#06038D]/20"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            {t("common.saveChanges")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SellerAuctionsTab() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<"active" | "ended" | "rejected">("active");
  const { data: auctions, isLoading, refetch } = trpc.auction.sellerAuctions.useQuery(
    { page: 1, pageSize: 50 },
    { refetchInterval: 20000 } // Poll every 20s for real-time bid updates
  );
  const utils = trpc.useUtils();
  const [editingAuction, setEditingAuction] = useState<any>(null);

  const resubmitMutation = trpc.auction.resubmitAuction.useMutation({
    onSuccess: () => {
      toast.success(t('seller.auctionRelisted'));
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
      endedSoldLabel = t('seller.auctionSold'); endedSoldCls = 'bg-green-100 text-green-700';
    } else if (auctionPaymentStatus === 'expired' || auctionPaymentStatus === 'failed') {
      endedSoldLabel = t('seller.status.cancelled'); endedSoldCls = 'bg-red-100 text-red-600';
    } else {
      endedSoldLabel = t('seller.auctionWonPending'); endedSoldCls = 'bg-[#06038D]/10 text-[#06038D]';
    }
    const map: Record<string, { label: string; cls: string }> = {
      active:         { label: t("seller.auctionStatus.active"),      cls: "bg-blue-100 text-blue-700" },
      ending_soon:    { label: t("seller.auctionStatus.endingSoon"),  cls: "bg-orange-100 text-orange-700" },
      scheduled:      { label: t("seller.auctionStatus.scheduled"),   cls: "bg-indigo-100 text-indigo-700" },
      pending_review: { label: t("seller.auctions.tab.filter.review"),   cls: "bg-yellow-100 text-yellow-700" },
      ended_sold:     { label: endedSoldLabel, cls: endedSoldCls },
      ended_no_bid:   { label: t("seller.auctionStatus.endedNoBid"),  cls: "bg-gray-100 text-gray-500" },
      ended:          { label: t("seller.auctionStatus.ended"),       cls: "bg-green-100 text-green-700" },
      sold:           { label: t("seller.auctionStatus.sold"),        cls: "bg-green-100 text-green-700" },
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
        if (diff <= 0) { setTimeLeft(t("seller.auctionEnded")); return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
      };
      update();
      const intervalId = setInterval(update, 1000);
      return () => clearInterval(intervalId);
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
                <p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">{t("seller.auctionCenter")}</p>
                <h3 className="text-white font-bold text-lg leading-tight">{t("seller.startFirstAuction")}</h3>
                <p className="text-white/60 text-xs mt-1">{t("seller.auctionPromoDesc")}</p>
              </div>
              <button
                className="shrink-0 bg-[#FEDD00] hover:bg-[#f0cc00] text-[#06038D] font-bold text-sm px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                onClick={handleStartAuction}
              >
                <Gavel className="w-4 h-4" />
                {t("seller.startAuction")}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { step: '1', title: t('seller.auctionStep1Title'), desc: t('seller.auctionStep1Desc') },
                { step: '2', title: t('seller.auctionStep2Title'), desc: t('seller.auctionStep2Desc') },
                { step: '3', title: t('seller.auctionStep3Title'), desc: t('seller.auctionStep3Desc') },
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
          { key: "active", label: t("seller.auctionTab.active"), count: activeAuctions.length },
          { key: "ended", label: t("seller.auctionTab.ended"), count: endedAuctions.length },
          { key: "rejected", label: t("seller.auctionTab.rejected"), count: rejectedAuctions.length },
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
            {subTab === "active" ? t("seller.noActiveAuctions") : subTab === "rejected" ? t("seller.noRejectedAuctions") : t("seller.noEndedAuctions")}
          </p>
          {subTab === "active" && (
            <p className="text-gray-400 text-xs mt-1">{t("seller.noAuctionsHint")}</p>
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
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm break-words line-clamp-2 leading-snug">{auction.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {auction.cardName && `${auction.cardName} · `}
                        {auction.grade && `PSA ${auction.grade}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <AuctionStatusBadge status={auction.auctionStatus} auctionPaymentStatus={auction.auctionPaymentStatus} />
                    </div>
                  </div>

                  {/* Scheduled auction info banner */}
                  {auction.auctionStatus === 'scheduled' && auction.auctionStartAt && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <span className="text-indigo-500 text-sm">🗓️</span>
                      <div>
                        <p className="text-xs font-semibold text-indigo-700">{t("seller.scheduledStart")}</p>
                        <p className="text-xs text-indigo-600">{new Date(auction.auctionStartAt).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-gray-400">{t("seller.startingBid")}</p>
                        <p className="text-sm font-bold" style={{ color: "#06038d" }}>HK${parseFloat(auction.startingBid ?? '0').toLocaleString()}</p>
                      </div>
                      {auction.auctionStatus !== 'scheduled' && (
                        <div>
                          <p className="text-xs text-gray-400">{t("seller.currentHighBid")}</p>
                          {auction.currentHighestBid ? (
                            <p className="text-sm font-black text-[#FEDD00] bg-[#06038D] px-2 py-0.5 rounded-lg inline-block">
                              HK${parseFloat(auction.currentHighestBid).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-gray-400">{t("seller.noBids")}</p>
                          )}
                        </div>
                      )}
                      {auction.auctionStatus !== 'scheduled' && auction.bidCount !== undefined && (
                        <div>
                          <p className="text-xs text-gray-400">{t("seller.bidCount")}</p>
                          <p className="text-sm font-bold text-gray-700">{t("seller.bidCountValue", { count: auction.bidCount })}</p>
                        </div>
                      )}
                      {auction.auctionStatus === 'scheduled' && auction.buyNowPrice && (
                        <div>
                          <p className="text-xs text-gray-400">{t("seller.buyNowPrice")}</p>
                          <p className="text-sm font-bold text-emerald-600">HK${parseFloat(auction.buyNowPrice).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {auction.auctionStatus === "active" && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{t("seller.timeLeft")}</p>
                          <AuctionCountdown endAt={auction.auctionEndAt} />
                        </div>
                      )}
                      {auction.auctionStatus === "ending_soon" && (
                        <div className="text-right">
                          <p className="text-xs text-orange-500 font-semibold">{t("seller.endingSoon")}</p>
                          <AuctionCountdown endAt={auction.auctionEndAt} />
                        </div>
                      )}
                      {auction.auctionStatus !== 'rejected' && (
                        <a href={`/auction/${auction.id}`} target="_blank" rel="noopener noreferrer">
                          <button className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors">
                            {t("seller.viewAuction")}
                          </button>
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Delist reason + edit + resubmit (governance mode: adminDelisted or rejected) */}
                  {(auction.auctionStatus === 'rejected' || auction.adminDelisted) && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-xs font-semibold text-red-600 mb-1">{t("seller.rejectReason")}：</p>
                      <p className="text-xs text-red-700 mb-3 break-words min-h-[1.5rem]">{auction.rejectedReason || t('seller.noRejectReason')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="text-xs px-3 py-2.5 rounded-lg font-semibold border-2 border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors flex items-center justify-center gap-1.5 w-full"
                          onClick={() => setEditingAuction(auction)}
                        >
                          <Pencil className="w-3 h-3 flex-shrink-0" />
                          {t("seller.editAuction")}
                        </button>
                        <button
                          className="text-xs px-3 py-2.5 rounded-lg font-semibold bg-[#06038d] text-white hover:bg-[#06038d]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 w-full"
                          disabled={resubmitMutation.isPending}
                          onClick={() => resubmitMutation.mutate({ listingId: auction.id })}
                        >
                          {resubmitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" /> : <Check className="w-3 h-3 flex-shrink-0" />}
                          {resubmitMutation.isPending ? t('common.submitting') : t('seller.relistAuction')}
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
  const conditionLabels: Record<string, string> = { raw_a: t('seller.grade.rawA'), raw_b: t('seller.grade.rawB'), raw_c: t('seller.grade.rawC'), psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', bgs10: 'BGS 10' };
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
        <span>{t("seller.productName")}</span>
        <span className="text-right pr-3">{t("seller.price")}</span>
        <span className="text-center px-3 hidden md:block">{t("seller.stock")}</span>
        <span className="text-center px-3 hidden lg:block">{t("seller.condition")}</span>
        <span className="text-left">{t("seller.statusLabel")}</span>
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
            {isActive ? t('seller.listingActive') : isSold ? t('seller.listingSold') : isRemoved ? (isAdminDelisted ? t('seller.listingAdminDelisted') : t('seller.listingRemoved')) : listing.status}
          </span>
        );
        const actionButtons = (
          <div className="flex items-center gap-2 flex-wrap">
            {!isSold && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-[#06038d]/40 text-[#06038d] hover:bg-[#06038d]/5"
                onClick={(e) => { e.stopPropagation(); openEditDialog(listing); }}>
                <Pencil className="w-3 h-3 mr-1" />{t("common.edit")}
              </Button>
            )}
            {isActive && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-red-300 text-red-600 hover:bg-red-50"
                disabled={deactivateMutation.isPending}
                onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate({ id: listing.id }); }}>
                <EyeOff className="w-3 h-3 mr-1" />{t("seller.delist")}
              </Button>
            )}
            {isRemoved && !isAdminDelisted && (
              <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-green-500 text-green-700 hover:bg-green-50"
                disabled={reactivateMutation.isPending}
                onClick={(e) => { e.stopPropagation(); reactivateMutation.mutate({ id: listing.id, status: "active" }); }}>
                <Eye className="w-3 h-3 mr-1" />{t("seller.relist")}
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
                {coverImg ? <LazyImage src={coverImg} alt={listing.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-white font-black text-[8px]">BOX</span></div>}
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
                  <span className="text-xs text-gray-500">{t("seller.stockLabel")}：<strong className={`${listing.quantity === 0 ? 'text-red-500' : listing.quantity <= 2 ? 'text-amber-500' : 'text-gray-700'}`}>{listing.quantity}</strong></span>
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
        {t("seller.totalListings", { count: listings.length })}
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  const { t } = useTranslation();
  const conditionOptions = getConditionOptions(t);
  const orderStatusLabel = getOrderStatusLabel(t);
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
      toast.success(vars.action === 'accept' ? t('seller.offerAccepted') : t('seller.offerRejected'));
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
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'active' | 'done'>('all');
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
    if (lines.length < 2) { toast.error(t('seller.csvMinRows')); return; }
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
      toast.success(t('seller.bulkDelistSuccess', { count: data.count }));
      setSelectedIds(new Set());
      setBatchMode(false);
      refetchListings();
      utils.marketplace.getMySellerProfile.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const batchReactivateMutation = trpc.marketplace.batchReactivateListings.useMutation({
    onSuccess: (data) => {
      toast.success(t('seller.bulkRelistSuccess', { count: data.count }));
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
      toast.success(t('seller.bulkDeleteSuccess', { count: data.deletedCount, cancelCount: data.cancelledOrdersCount })) || toast.success(`已刪除 ${data.deletedCount} 件商品${data.cancelledOrdersCount > 0 ? `，已取消 ${data.cancelledOrdersCount} 個待付款訂單` : ''}`);
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
              {t("seller.viewProduct")} →
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
        toast.info(t("seller.stripeConnectHint"), { duration: 8000 });
      } else {
        toast.info(t("seller.redirectingToStripe"));
        window.open(data.onboardingUrl, "_blank");
      }
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const stripeLoginMutation = trpc.marketplace.getStripeExpressDashboardLink.useMutation({
    onSuccess: (data) => {
      toast.info(t("seller.redirectingToStripeDashboard"));
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
        toast.error(t('seller.stripeConnectRequired'));
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
    { value: "sf_express", label: `🚚 ${t("seller.carrier.sfExpress")}`, trackingUrl: "https://www.sf-express.com/hk/tc/dynamic_function/waybill/#search/bill-number/" },
    { value: "hk_post", label: `📮 ${t("seller.carrier.hkPost")}`, trackingUrl: "https://www.hongkongpost.hk/en/mail_tracking/index.html?tracking_no=" },
  ];

  const uploadShippingImageMutation = trpc.marketplace.uploadShippingImage.useMutation();
  const markShippedMutation = trpc.marketplace.markOrderShipped.useMutation({
    onSuccess: () => {
      toast.success(t("seller.markedShipped"));
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
        <p className="text-lg font-medium">{t("common.pleaseLogin")}</p>
        <Link href="/login"><Button className="mt-4 text-white font-bold" style={{ backgroundColor: "#06038d" }}>{t("common.login")}</Button></Link>
      </div>
    </div>
  );
  // ── Maintenance mode guard (after all hooks) ──
  if (accessLoading) return <div className="min-h-screen flex items-center justify-center bg-[#06038D]"><div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>;
  if (accessData && !accessData.allowed) return (
    <div className="min-h-screen bg-[#06038D] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-3">{t("marketplace.maintenance")}</h1>
        <p className="text-white/70 mb-6">{t("marketplace.maintenanceDesc")}</p>
        <a href="/" className="inline-flex items-center gap-2 bg-yellow-400 text-[#06038D] font-semibold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors">{t("common.backToHome")}</a>
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
              <h1 className="text-base font-bold text-white leading-tight">{t("seller.title")}</h1>
              <p className="text-white/60 text-xs">{t("seller.subtitle")}</p>
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
                <h1 className="text-3xl font-bold text-white">{t("seller.title")}</h1>
                <p className="text-white/70 text-sm mt-1">{t("seller.subtitle")}</p>
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
            <h2 className="text-xl font-bold mb-2" style={{ color: "#06038d" }}>{t("seller.becomeSellerTitle")}</h2>
            <p className="text-gray-500 mb-6 max-w-md">
              {t("seller.becomeSellerDesc")}
            </p>
            <Button onClick={() => setShowApply(true)} className="bg-[#06038d] hover:bg-[#0804b8] text-white font-bold">
              {t("seller.applyToSell")}
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
                    <p className="font-medium text-red-900">{t("seller.applicationRejected")}</p>
                    <p className="text-sm text-red-700 mt-1">{t("seller.rejectReason")}：{(sellerProfile as any).rejectReason}</p>
                    <p className="text-xs text-red-600 mt-2">{t("seller.contactSupport")}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-amber-900">{t("seller.applicationPending")}</p>
                    <p className="text-sm text-amber-700">{t("seller.applicationPendingDesc")}</p>
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
                      <p className="text-sm text-blue-700">{t("seller.stripeSetupDesc")}</p>
                    </div>
                  </div>
                  <Button onClick={() => stripeMutation.mutate()} disabled={stripeMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeMutation.isPending ? t("common.processing") : t("seller.setupStripe")}
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
                      <p className="font-medium text-amber-900">{t("seller.stripeVerifying")}</p>
                      <p className="text-sm text-amber-700">{t("seller.stripeVerifyingDesc")}</p>
                    </div>
                  </div>
                  <Button onClick={() => stripeMutation.mutate()} disabled={stripeMutation.isPending}
                    variant="outline" className="border-amber-600 text-amber-700 hover:bg-amber-100">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeMutation.isPending ? t("common.processing") : t("seller.continueVerification")}
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
                      <p className="font-medium text-yellow-900">{t("seller.stripeNeedsInfo")}</p>
                      <p className="text-sm text-yellow-700">{t("seller.stripeNeedsInfoDesc")}</p>
                    </div>
                  </div>
                  <Button onClick={() => stripeMutation.mutate()} disabled={stripeMutation.isPending}
                    variant="outline" className="border-yellow-600 text-yellow-700 hover:bg-yellow-100">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {stripeMutation.isPending ? t("common.processing") : t("seller.continueSetup")}
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
                    {stripeMutation.isPending ? t("common.processing") : t("seller.resetStripe")}
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
                    {stripeLoginMutation.isPending ? t("common.processing") : t("seller.manageStripe")}
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
                    <p className="text-[11px] text-gray-500 leading-tight">{t("seller.rating", { count: sellerProfile?.ratingCount ?? 0 })}</p>
                  </div>
                </div>
              </div>
            </div>

            <BrandTabs defaultValue="listings" value={activeTab} onValueChange={setActiveTab}>
              <BrandTabsList grid tabCount={5}>
                <BrandTabsTrigger value="listings" icon={<Package className="w-4 h-4" />} label={t("seller.tabs.myListings")} mobileLabel={t("seller.completedOrders.product")}>
                  {t("seller.myProducts")}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="auctions" icon={<Gavel className="w-4 h-4" />} label={t("seller.auctions.tab.title")} mobileLabel={t("seller.tabs.myAuctionsMobile")}>
                  {t("seller.myAuctions")}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="orders" icon={<ShoppingBag className="w-4 h-4" />} label={t("seller.tabs.orderManagement")} mobileLabel={t("seller.stats.orders")}>
                  {t("seller.orderManagement")}
                  {pendingOrdersCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                    </span>
                  )}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="offers" icon={<MessageSquare className="w-4 h-4" />} label={t("seller.tabs.buyerOffers")} mobileLabel={t("seller.auctions.card.bids")}>
                  {t("seller.buyerOffers")}
                  {pendingSellerOffersCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {pendingSellerOffersCount > 99 ? '99+' : pendingSellerOffersCount}
                    </span>
                  )}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="earnings" icon={<DollarSign className="w-4 h-4" />} label={t("seller.tabs.earnings")} mobileLabel={t("seller.tabs.earningsMobile")}>
                  {t("seller.revenueRecord")}
                </BrandTabsTrigger>
              </BrandTabsList>

              <BrandTabsContent value="listings" className="mt-4">
                {/* Listing Guide Card: always visible */}
                <div className="mb-4 rounded-2xl overflow-hidden border-2 border-[#FEDD00] bg-gradient-to-br from-[#06038D] to-[#1a0a9e] shadow-lg">
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[#FEDD00] text-xs font-bold uppercase tracking-widest mb-1">{t("seller.title")}</p>
                        <h3 className="text-white font-bold text-lg leading-tight">{t("seller.listYourProduct")}</h3>
                        <p className="text-white/60 text-xs mt-1">{t("seller.listPromoDesc")}</p>
                      </div>
                      <button
                        className="shrink-0 bg-[#FEDD00] hover:bg-[#f0cc00] text-[#06038D] font-bold text-sm px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                        onClick={() => {
                          if (!isAdmin && sellerProfile?.stripeConnectStatus !== 'active') {
                            toast.error(t('seller.stripeConnectRequired'));
                            return;
                          }
                          setShowNewListing(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        {t("seller.listNewProduct")}
                      </button>
                    </div>
                    {/* Step guide */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { step: '1', title: t('seller.listStep1Title'), desc: t('seller.listStep1Desc') },
                        { step: '2', title: t('seller.listStep2Title'), desc: t('seller.listStep2Desc') },
                        { step: '3', title: t('seller.listStep3Title'), desc: t('seller.listStep3Desc') },
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
                    { key: 'all' as const, label: t('seller.listingTab.all'), count: myListings?.length ?? 0 },
                    { key: 'active' as const, label: t('seller.listingTab.active'), count: myListings?.filter((l: any) => l.status === 'active').length ?? 0 },
                    { key: 'sold' as const, label: t('seller.listingTab.sold'), count: myListings?.filter((l: any) => l.status === 'sold').length ?? 0 },
                    // Governance mode: no pending_review tab
                    { key: 'removed' as const, label: t('seller.listingTab.removed'), count: myListings?.filter((l: any) => l.status === 'removed').length ?? 0 },
                  ];
                  const filteredListings = listingFilter === 'all'
                    ? (myListings ?? [])
                    : (myListings ?? []).filter((l: any) => l.status === listingFilter);
                  return (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      {/* Mobile: horizontal scroll tabs (shown on mobile only) */}
                      <div className="flex sm:hidden gap-2 overflow-x-auto scrollbar-hide pb-1 w-full flex-shrink-0">
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
                    <p className="text-sm text-gray-400">{t("seller.emptyListingHint")}</p>
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
                          {batchMode ? t("seller.cancelBatch") : t("seller.batchManage")}
                        </Button>

                        {/* View mode toggle */}
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden ml-auto">
                          <button
                            className={`h-8 w-8 flex items-center justify-center transition-colors ${
                              listingViewMode === 'list' ? 'bg-[#06038d] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
                            }`}
                            onClick={() => { setListingViewMode('list'); localStorage.setItem('seller-listing-view', 'list'); }}
                            title={t("seller.listView")}
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
                            title={t("seller.gridView")}
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
                            {selectedIds.size === filteredListings.length ? t("common.deselectAll") : t("common.selectAll")}
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
                                  return `${t('seller.delist')} (${deactivatableCount})`;
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
                                    {t("seller.relist")} ({relistableIds.length})
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
                                    {t("common.delete")} ({deletableIds.length})
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
                        <p className="text-sm">{t("seller.noCategoryItems")}</p>
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
                                  {coverImg ? <LazyImage src={coverImg} alt={listing.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-white font-black text-sm tracking-tight text-center leading-tight">BOX<br/>IUM</span></div>}
                                </div>
                                <span className={`absolute top-1.5 right-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isActive ? "bg-green-500 text-white" : isSold ? "bg-blue-500 text-white" : isRemoved ? "bg-red-500 text-white" : "bg-gray-500 text-white"}`}>
                                  {isActive ? t("seller.listingActive") : isSold ? t("seller.listingSold") : isRemoved ? t("seller.listingRemoved") : listing.status}
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
                                  {!isSold && <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-[#06038d] text-[#06038d] hover:bg-blue-50 flex-1" onClick={(e) => { e.stopPropagation(); openEditDialog(listing); }}><Pencil className="w-3 h-3 mr-1" />{t("common.edit")}</Button>}
                                  {isActive && <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-red-400 text-red-600 hover:bg-red-50 flex-1" disabled={deactivateMutation.isPending} onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate({ id: listing.id }); }}><EyeOff className="w-3 h-3 mr-1" />{t("seller.listings.card.deactivate")}</Button>}
                                  {isRemoved && !isAdminDelisted && <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-green-500 text-green-700 hover:bg-green-50 flex-1" disabled={reactivateMutation.isPending} onClick={(e) => { e.stopPropagation(); reactivateMutation.mutate({ id: listing.id, status: "active" }); }}><Eye className="w-3 h-3 mr-1" />{t("seller.listings.card.activate")}</Button>}
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
                        { key: 'all', label: t('common.all') },
                        { key: 'pending', label: t('seller.orderTab.pending') },
                        { key: 'active', label: t('seller.orderTab.active') },
                        { key: 'done', label: t('seller.orderTab.done') },
                      ] as const).map(f => (
                        <button
                          key={f.key}
                          onClick={() => setOrderStatusFilter(f.key)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                            orderStatusFilter === f.key
                              ? 'bg-[#06038d] text-white border-[#06038d]'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-[#06038d] hover:text-[#06038d]'
                          }`}
                        >
                          {f.label}
                          {f.key === 'all' && (
                            <span className="ml-1 opacity-60">({myOrders?.length ?? 0})</span>
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
                  };
                  let filtered = (myOrders as any[]) ?? [];
                  if (orderStatusFilter !== 'all') {
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
                      <p>{(myOrders?.length ?? 0) > 0 ? t('seller.noMatchingOrders') : t('seller.noOrders')}</p>
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
                                  <LazyImage src={thumb} alt={item.title ?? t('seller.product')} className="w-full h-full object-cover" />
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
                                  return (
                                    <>
                                      <p>📦 {t("seller.recipient")}：{item.shippingName} {item.shippingPhone}</p>
                                      <p>📍 {t("seller.address")}：{(() => {
                                        if (addr && typeof addr === 'object') {
                                          const parts = [addr?.address, addr?.district, addr?.region].filter(Boolean);
                                          return parts.length > 0 ? parts.join(', ') : String(item.shippingAddress);
                                        }
                                        return String(item.shippingAddress ?? '');
                                      })()}</p>
                                    </>
                                  );
                                } catch {
                                  return <p>📦 {t('seller.recipient')}：{item.shippingName} {item.shippingPhone}</p>;
                                }
                              })()}
                              {item.trackingNumber && <p>🚚 {t("seller.trackingNo")}：{item.trackingNumber}</p>}
                              {item.shippedAt && <p>📅 {t("seller.shippedDate")}：{new Date(item.shippedAt).toLocaleDateString('zh-HK')}</p>}
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
                              {t("seller.shippedStatus")}{item.trackingNumber ? `，${t("seller.trackingNo")}：${item.trackingNumber}` : ''}
                            </div>
                          )}
                          {/* Disputed order info */}
                          {item.orderStatus === 'disputed' && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                              <p className="font-semibold flex items-center gap-1"><span>⚠️</span> {t("seller.disputeOpened")}</p>
                              {item.disputeReason && <p>{t("seller.disputeReason")}：{item.disputeReason}</p>}
                              {item.disputeOpenedAt && <p>{t("seller.disputeOpenedAt")}：{new Date(item.disputeOpenedAt).toLocaleDateString('zh-HK')}</p>}
                            </div>
                          )}
                          {/* Dispute resolved info */}
                          {item.disputeResolution && item.orderStatus !== 'disputed' && (
                            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-1">
                              <p className="font-semibold">{t("seller.disputeResult")}：</p>
                              <p>{item.disputeResolution.replace(/^\[.*?\]\s*/, '')}</p>
                              {item.disputeResolvedAt && <p>{t("seller.disputeResolvedAt")}：{new Date(item.disputeResolvedAt).toLocaleDateString('zh-HK')}</p>}
                            </div>
                          )}
                          {/* Completed order summary */}
                          {item.orderStatus === 'completed' && (
                            <div className="space-y-1.5">
                              <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {t("seller.orderCompletedPayout", { amount: parseFloat(item.sellerReceivableHkd ?? item.priceHkd ?? '0').toFixed(2) })}
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
                                      {hasExpired ? t("seller.processingPayout") : t("seller.estimatedPayout")}
                                    </p>
                                    <p className="text-blue-700">
                                      {hasExpired
                                        ? t('seller.cooldownEnded')
                                        : `${payoutHoldUntil.toLocaleString(undefined, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${t('seller.hoursLeft', { hours: hoursLeft })})`
                                      }
                                    </p>
                                    {!hasExpired && (
                                      <p className="text-blue-600 text-[10px]">
                                        {t('seller.cooldownWarning')}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}

                            </div>
                          )}
                          {/* Bottom Action Bar */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            {/* Primary action: ship */}
                            {["processing", "payment_received", "paid_held"].includes(item.orderStatus) && (
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
                                <Package className="w-3 h-3 mr-1" />{t("seller.fillShipping")}
                              </Button>
                            )}
                            {/* View detail link */}
                            {item.orderNo && (
                              <a
                                href={`/orders/${item.orderNo}`}
                                className={`inline-flex items-center justify-center gap-1 text-xs text-[#06038d] hover:text-[#0804b8] font-medium border border-[#06038d]/30 hover:border-[#06038d] rounded-lg px-3 h-8 transition-colors bg-white hover:bg-blue-50 ${
                                  ["processing", "payment_received", "paid_held"].includes(item.orderStatus) ? 'flex-shrink-0' : 'flex-1'
                                }`}
                              >
                                <ExternalLink className="w-3 h-3" />{t("seller.viewDetails")}
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
                      const labels = { all: t('common.all'), pending: t('seller.offerStatus.pending'), accepted: t('seller.offerStatus.accepted'), rejected: t('seller.offerStatus.rejected') };
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
                      <p className="text-sm">{t("seller.noMatchingOffers")}</p>
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
                            {offer.status === 'pending' ? t('seller.offerStatus.pending') : offer.status === 'accepted' ? t('seller.offerStatus.accepted') : t('seller.offerStatus.rejected')}
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
                                    alt={offer.listingTitle || t('seller.product')}
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
                                  <p className="font-semibold truncate text-gray-900 flex-1">{offer.listingTitle || t('seller.product')}</p>
                                  {offer.listingId && (
                                    <Link href={`/listing/${offer.listingId}`} className="text-xs text-[#06038d] hover:underline flex-shrink-0">
                                      {t("seller.goToProduct")}
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
                                        <Clock className="w-3 h-3" />{t("seller.offerExpired")}
                                      </span>
                                    );
                                  }
                                  const diffHours = diffMs / (1000 * 60 * 60);
                                  const diffDays = Math.floor(diffHours / 24);
                                  const remHours = Math.floor(diffHours % 24);
                                  const isUrgent = diffHours < 24; // less than 1 day
                                  const isWarning = diffHours < 48; // less than 2 days
                                  const label = diffDays > 0
                                    ? `${t('seller.offerExpiresIn', { days: diffDays, hours: remHours })}`
                                    : `${t('seller.offerExpiresInHours', { hours: Math.floor(diffHours) })}`;
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
                                    <Check className="w-3 h-3 mr-1" />{t("seller.acceptOffer")}
                                  </Button>
                                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                    disabled={respondToOfferMutation.isPending}
                                    onClick={() => { setRejectingOfferId(offer.id); setRejectionReason(""); setShowRejectDialog(true); }}
                                  >
                                    <X className="w-3 h-3 mr-1" />{t("seller.rejectOffer")}
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
                                  <ExternalLink className="w-3 h-3" />{t("seller.goToProduct")}
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
                <p>• min_offer: {t("seller.csvHint.minOffer")}</p>
                <p>• image_url: {t("seller.csvHint.imageUrl")}</p>
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
                {t("seller.downloadCsvTemplate")}
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
                  <p className="text-sm font-semibold text-[#06038D]">{t("seller.csvPreview", { count: csvRows.length })}</p>
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
                                <LazyImage src={row.imageUrls[0]} alt="" className="w-8 h-8 object-cover rounded border border-gray-200" />
                                {row.imageUrls.length > 1 && <span className="text-[10px] text-gray-400">+{row.imageUrls.length - 1}</span>}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-[10px]">{t("common.none")}</span>
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
                  {t("seller.csvProgress", { done: csvRows.filter(r => r._status === 'done').length, total: csvRows.length })}
                </span>
                {csvRows.some(r => r._status === 'error') && (
                  <span className="text-xs text-red-500">{t("seller.csvFailed", { count: csvRows.filter(r => r._status === 'error').length })}</span>
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
                      if (isNaN(priceNum) || priceNum <= 0) throw new Error(t('seller.csvPriceError'));
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
                            if (data?.error) throw new Error(data.error.message ?? t('seller.csvListingFailed'));
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
                  toast.success(t('seller.csvBatchSuccess', { count: doneCount }));
                }}
              >
                {bulkUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("seller.bulkUpload.uploadingButton")}</>
                ) : csvRows.every(r => r._status === 'done') ? (
                  t('seller.csvAllDone')
                ) : (
                  t('seller.csvConfirmList', { count: csvRows.filter(r => r._status === 'pending' || r._status === 'error').length })
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
              <Label>{t("seller.displayName")} *</Label>
              <Input className="mt-1" placeholder={t("seller.displayNamePlaceholder")}
                value={applyForm.displayName}
                onChange={(e) => setApplyForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label>{t("seller.bio")}</Label>
              <Textarea className="mt-1" placeholder={t("seller.bioPlaceholder")}
                value={applyForm.bio}
                onChange={(e) => setApplyForm(p => ({ ...p, bio: e.target.value }))} />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium">{t("seller.platformFeeRate")}</p>
              <p className="mt-1">{t("seller.stripePayoutDesc")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApply(false)}>{t("seller.auctions.editRejected.cancel")}</Button>
            <Button className="bg-[#06038d] hover:bg-[#0804b8] text-white"
              disabled={!applyForm.displayName || applyMutation.isPending}
              onClick={() => applyMutation.mutate({ displayName: applyForm.displayName, bio: applyForm.bio || undefined })}>
              {applyMutation.isPending ? t("common.submitting") : t("seller.submitApplication")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Offer Dialog ──────────────────────────────────────────── */}
      <Dialog open={showRejectDialog} onOpenChange={(v) => { setShowRejectDialog(v); if (!v) { setRejectingOfferId(null); setRejectionReason(""); } }}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: "#06038d" }}>{t("seller.rejectOfferTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">{t("seller.rejectOfferDesc")}</p>
            <div>
              <Label className="text-sm font-medium text-gray-700">{t("seller.rejectReasonLabel")}</Label>
              <Textarea
                className="mt-1.5 resize-none"
                placeholder={t("seller.rejectReasonPlaceholder")}
                maxLength={300}
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{rejectionReason.length}/300</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">⚠️ {t("seller.rejectOfferWarning")}</p>
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
              {respondToOfferMutation.isPending ? t("common.processing") : t("seller.confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Listing Dialog ─────────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setEditingListing(null); }}>
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
          <VisuallyHidden><DialogTitle>{t("seller.editListingTitle")}</DialogTitle></VisuallyHidden>
          {/* Header - same style as new listing */}
          <div className="px-5 pt-5 pb-4" style={{backgroundColor: '#06038D', borderBottom: '3px solid #FEDD00'}}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">{t("seller.editListingTitle")}</h2>
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
                    <LazyImage src={coverImg} alt={editingListing.title} className="w-12 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #06038d 0%, #0a06b5 100%)' }}>
                      <span className="text-white font-black text-[8px] tracking-tight text-center leading-tight">BOX<br/>IUM</span>
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#06038D] truncate">{editingListing.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t("seller.currentPrice")} HKD {parseFloat(editingListing.priceHkd as string).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{t("seller.stockCount", { count: editingListing.quantity })}</p>
                </div>
              </div>
            )}

            {/* Warning: listing has active orders (remainingQuantity < quantity means stock was sold) */}
            {editingListing && editingListing.remainingQuantity !== undefined && editingListing.remainingQuantity < editingListing.quantity && (
              <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-xs font-semibold text-amber-800">{t("seller.activeOrderWarning")}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{t("seller.soldCount", { count: editingListing.quantity - editingListing.remainingQuantity })}，{t("seller.priceChangeNote")}</p>
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
                placeholder={t("seller.editListing.descPlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[#06038D] font-semibold">{t("seller.editListing.priceLabel")}</Label>
                <p className="text-xs text-gray-400 mb-1">{t("seller.editListing.minPrice")}</p>
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
                <Label className="text-[#06038D] font-semibold">{t("seller.editListing.stockLabel")}</Label>
                <p className="text-xs text-gray-400 mb-1">{t("seller.editListing.minStock")}</p>
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
                if (isNaN(price) || price < 4) { toast.error(t("seller.editListing.priceError")); return; }
                if (isNaN(quantity) || quantity < 1) { toast.error(t("seller.editListing.stockError")); return; }
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
              {t("seller.editListing.saveChanges")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewListing} onOpenChange={(open) => { setShowNewListing(open); if (!open) setListingStep(1); }}>
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
          <VisuallyHidden><DialogTitle>{t("seller.newListing.title")}</DialogTitle></VisuallyHidden>
          {/* Step Header */}
          <div className="px-5 pt-5 pb-4" style={{backgroundColor: '#06038D', borderBottom: '3px solid #FEDD00'}}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">{t("seller.newListing.title")}</h2>
              <button onClick={() => setShowNewListing(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Step Indicator */}
            <div className="flex items-center gap-0">
              {[{ n: 1, label: t("seller.newListing.step1") }, { n: 2, label: t("seller.newListing.step2") }, { n: 3, label: t("seller.newListing.preview.submitListing") }].map(({ n, label }, idx) => (
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
                  <p className="text-xs text-red-500 -mt-2">* {t("seller.newListing.imageRequired")}</p>
                )}
                {/* Card Picker */}
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.associateCard")}<span className="text-[10px] font-normal text-[#06038D]/50 ml-1">{t("common.optional")}</span></Label>
                  {selectedCard ? (
                    <div className="mt-1 flex items-center gap-3 p-2.5 rounded-lg border border-[#06038D]/30 bg-[#06038D]/5">
                      {selectedCard.imageUrl ? (
                        <LazyImage src={selectedCard.imageUrl} alt={selectedCard.name} className="w-10 h-14 object-cover rounded-md border border-gray-200 flex-shrink-0" />
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
                          <p className="text-[10px] text-[#06038D]/80 font-medium mt-0.5">{t("seller.psa10MarketPrice")} HKD {parseFloat(String(selectedCard.referencePrice)).toLocaleString()}</p>
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
                        {t("seller.newListing.clickToSearchCard")}
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
                    <p className="text-xs text-red-500 mt-1">{t("seller.newListing.titleMinLength")}</p>
                  )}
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
                {/* Step 2 summary bar */}
                <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 flex items-center gap-3">
                  {listingImages[0] && <LazyImage src={listingImages[0]} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#06038D] truncate">{listingForm.title}</p>
                    <p className="text-xs text-[#06038D]/60">{conditionOptions.flatMap(g => g.items).find(i => i.value === listingForm.condition)?.label ?? listingForm.condition} · {t("seller.newListing.quantity")} {listingForm.quantity}</p>
                  </div>
                </div>

                {/* TCG Series */}
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

                {/* Listing Mode */}
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.listingMode")}</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {[
                      { value: "buy_now", label: t("seller.newListing.mode.buyNow"), icon: "🛒", desc: t("seller.newListing.mode.buyNowDesc") },
                      { value: "auction", label: t("seller.tabs.myAuctionsMobile"), icon: "🔨", desc: t("seller.newListing.mode.auctionDesc") },
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

                {/* Description */}
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.productDescription")}<span className="text-[10px] font-normal text-[#06038D]/50 ml-1">（{t("common.optional")}）</span></Label>
                  <Textarea className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" placeholder={t("seller.newListing.productDescriptionPlaceholder")} rows={3}
                    value={listingForm.description}
                    onChange={(e) => setListingForm(p => ({ ...p, description: e.target.value }))} />
                </div>

                {/* Buy Now pricing */}
                {listingForm.listingMode === 'buy_now' && (
                <div>
                  <Label className="text-[#06038D] font-semibold">{t("seller.newListing.priceLabel")}</Label>
                  {selectedCard && (
                    <div className="mt-1 mb-2">
                      {conditionPriceLoading ? (
                        <p className="text-xs text-[#06038D]/50">{t("seller.newListing.loadingMarketPrice")}</p>
                      ) : conditionPriceData?.avgPrice ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[#06038D]">
                            {conditionPriceData.isFallback
                              ? `${t("seller.psa10MarketPriceRef")}：HKD ${conditionPriceData.avgPrice.toLocaleString()}`
                              : `${conditionOptions.flatMap(g => g.items).find(i => i.value === listingForm.condition)?.label ?? listingForm.condition} ${t("seller.marketPrice")}：HKD ${conditionPriceData.avgPrice.toLocaleString()}`
                            }
                          </span>
                          <span className="text-[10px] text-[#06038D]/40">({t("seller.basedOnRecords", { count: conditionPriceData.recordCount })})</span>
                          {conditionPriceData.isFallback && (
                            <span className="text-[10px] text-amber-600">{t("seller.noConditionRecords")}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[#06038D]/40">{t("seller.noMarketPriceData")}</p>
                      )}
                    </div>
                  )}
                  <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="4" step="0.01" placeholder={t("seller.editListing.minPrice")}
                    value={listingForm.price}
                    onChange={(e) => setListingForm(p => ({ ...p, price: e.target.value }))} />
                  {listingForm.price && parseFloat(listingForm.price) < 4.00 && (
                    <p className="text-xs text-red-400 mt-1">{t("seller.priceTooLow")}</p>
                  )}
                  {listingForm.price && parseFloat(listingForm.price) >= 4 && conditionPriceData?.avgPrice && (() => {
                    const refPrice = conditionPriceData.avgPrice;
                    const diff = ((parseFloat(listingForm.price) - refPrice) / refPrice) * 100;
                    const condLabel = conditionPriceData.isFallback ? t('seller.psa10MarketPrice') : t('seller.marketPrice');
                    return (
                      <p className={`text-xs mt-1 ${diff < -15 ? "text-amber-600" : diff > 15 ? "text-green-600" : "text-gray-500"}`}>
                        {diff > 0 ? `${t("seller.aboveMarket", { label: condLabel, pct: diff.toFixed(0) })}` : `${t("seller.belowMarket", { label: condLabel, pct: Math.abs(diff).toFixed(0) })}`}
                      </p>
                    );
                  })()}
                  {/* Real-time fee calculation - dynamic from API */}
                  {listingForm.price && parseFloat(listingForm.price) >= 4 && (() => {
                    const price = parseFloat(listingForm.price);
                    // Admin accounts are exempt from platform fees
                    if (isAdmin) {
                      return (
                        <div className="mt-2 rounded-lg border p-2.5 bg-green-50 border-green-200">
                          <div className="flex items-center justify-between text-xs font-semibold text-green-800">
                            <span>{t("seller.adminFeeExempt")}</span>
                            <span>{t("seller.estimatedFee")} HKD 0.00</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-1 opacity-75 text-green-800">
                            <span>{t("seller.estimatedReceive")}</span>
                            <span className="font-bold">HKD {price.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    }
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
                          <span>{t("seller.feeTier", { tier, rate: ratePercent })}</span>
                          <span>{t("seller.estimatedFeeAmount", { amount: fee.toFixed(2) })}</span>
                        </div>
                        <div className={`flex items-center justify-between text-xs mt-1 opacity-75 ${tierText}`}>
                          <span>{t("seller.estimatedReceive")}</span>
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
                      <p className="text-xs font-semibold text-[#06038D] mb-1">📊 {t("seller.marketRefPrice")}</p>
                      <p className="text-sm font-bold text-[#06038D]">
                        HKD {conditionPriceData.avgPrice.toLocaleString()}
                        <span className="text-xs font-normal text-[#06038D]/50 ml-1">{t("seller.basedOnRecords", { count: conditionPriceData.recordCount })}</span>
                      </p>
                    </div>
                  )}
                  {/* Starting bid */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">{t("seller.newListing.startingBid")}</Label>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="1" step="1" placeholder={t("seller.newListing.startingBidPlaceholder")}
                      value={listingForm.startingBid}
                      onChange={(e) => setListingForm(p => ({ ...p, startingBid: e.target.value }))} />
                  </div>
                  {/* Reserve price */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">{t("seller.newListing.reservePrice")}</Label>
                    <p className="text-[10px] text-[#06038D]/50 mb-1">{t("seller.newListing.reservePriceHint")}</p>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="1" step="1" placeholder={t("seller.newListing.reservePricePlaceholder")}
                      value={listingForm.reservePrice}
                      onChange={(e) => setListingForm(p => ({ ...p, reservePrice: e.target.value }))} />
                  </div>
                  {/* Buy now price */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">{t("seller.newListing.buyNowPrice")}</Label>
                    <p className="text-[10px] text-[#06038D]/50 mb-1">{t("seller.newListing.buyNowPriceHint")}</p>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="1" step="1" placeholder={t("seller.newListing.buyNowPricePlaceholder")}
                      value={listingForm.buyNowPrice}
                      onChange={(e) => setListingForm(p => ({ ...p, buyNowPrice: e.target.value }))} />
                  </div>
                  {/* Bid increment */}
                  <div>
                    <Label className="text-[#06038D] font-semibold">{t("seller.newListing.bidIncrement")}</Label>
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] focus:border-[#06038D]" type="number" min="1" step="1"
                      value={listingForm.bidIncrement}
                      onChange={(e) => setListingForm(p => ({ ...p, bidIncrement: e.target.value }))} />
                  </div>
                  {/* Auction timing */}
                  <div className="space-y-3">
                    {/* Duration selector */}
                    <div>
                      <Label className="text-[#06038D] font-semibold">{t("seller.newListing.auctionDays")}</Label>
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
                            {days} {t("common.days")}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Start time - 24h time only, date = today */}
                    <div>
                      <Label className="text-[#06038D] font-semibold">{t("seller.newListing.startTime")}</Label>
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
                            <span className="text-xs font-semibold text-green-700">{t("seller.newListing.startNow")}</span>
                            <span className="text-xs text-green-600">— {t("seller.newListing.startNowDesc")}</span>
                          </div>
                        )}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${new Date(listingForm.auctionEndAt) <= new Date() ? 'bg-red-50 border-red-200' : 'bg-[#06038D]/5 border-[#06038D]/20'}`}>
                          <span className="text-xs text-[#06038D]/60">{t("seller.newListing.estimatedEndTime")}：</span>
                          <span className={`text-xs font-semibold ${new Date(listingForm.auctionEndAt) <= new Date() ? 'text-red-600' : 'text-[#06038D]'}`}>
                            {new Date(listingForm.auctionEndAt).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {new Date(listingForm.auctionEndAt) <= new Date() && (
                            <span className="text-xs text-red-500 ml-1">⚠️ {t("seller.newListing.endTimePast")}</span>
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
                          <p className="text-xs text-[#06038D]/50">{t("seller.newListing.acceptOffersHint")}</p>
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
                          <Label className="text-[#06038D] font-semibold">{t("seller.newListing.minOffer")}</Label>
                          <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="4" step="0.01" placeholder={t("seller.newListing.minOfferPlaceholder")}
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
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {listingImages.map((url, i) => (
                        <LazyImage key={i} src={url} alt={`${t("seller.newListing.imageAlt")} ${i+1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
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
                        <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.associateCard")}</span>
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
                          <span className="text-sm text-[#06038D]">{listingForm.acceptOffers ? `${t("seller.newListing.acceptsOffers")}${listingForm.minOffer ? `（${t("seller.newListing.minOffer")} HKD ${listingForm.minOffer}）` : ""}` : t("seller.newListing.notAccepting")}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.listingMode")}</span>
                          <span className="text-sm font-bold text-[#06038D]">🔨 {t("seller.newListing.mode.auction")}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.auctions.card.startingBid")}</span>
                          <span className="text-base font-bold text-[#06038D]">HKD {parseFloat(listingForm.startingBid || "0").toLocaleString()}</span>
                        </div>
                        {listingForm.reservePrice && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.reservePrice")}</span>
                            <span className="text-sm text-[#06038D]">HKD {parseFloat(listingForm.reservePrice).toLocaleString()} ({t("seller.newListing.reservePriceHidden")})</span>
                          </div>
                        )}
                        {listingForm.buyNowPrice && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.buyNowPrice")}</span>
                            <span className="text-sm font-semibold text-[#06038D]">HKD {parseFloat(listingForm.buyNowPrice).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.newListing.bidIncrement")}</span>
                          <span className="text-sm text-[#06038D]">HKD {parseFloat(listingForm.bidIncrement || "10").toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">{t("seller.auctions.editRejected.auctionEndLabel")}</span>
                          <span className="text-sm text-[#06038D]">{listingForm.auctionEndAt
                            ? new Date(listingForm.auctionEndAt).toLocaleString('zh-HK')
                            : new Date(Date.now() + (listingForm.auctionDurationDays || 7) * 24 * 60 * 60 * 1000).toLocaleString('zh-HK') + `（${t('seller.newListing.afterListing')}）`
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
                          <p className="text-xs text-[#06038D]/50">{t("seller.newListing.acceptOffersHint")}</p>
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
                          <Label className="text-[#06038D] font-semibold text-xs">{t("seller.newListing.minOffer")}</Label>
                          <Input
                            className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D] h-9 text-sm"
                            type="number"
                            min="4"
                            step="0.01"
                            placeholder={t("seller.newListing.minOfferPlaceholder")}
                            value={listingForm.minOffer}
                            onChange={(e) => setListingForm(p => ({ ...p, minOffer: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-xs text-[#06038D]">
                    {isAdmin ? (
                      <p className="font-medium">{t("seller.newListing.confirmPublish")}</p>
                    ) : (
                      <>
                        <p className="font-medium">{t("seller.newListing.confirmPublishAuction")}</p>
                        <p className="mt-0.5">{t("seller.newListing.publishDesc")}</p>
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
                      {t("seller.newListing.agreeTerms")}
                      <a href="/auction/terms" target="_blank" rel="noopener noreferrer"
                        className="font-semibold text-[#06038D] underline underline-offset-2 hover:text-[#06038D]/70 mx-1"
                        onClick={(e) => e.stopPropagation()}
                      >{t("seller.newListing.termsLink")}</a>
                      {t("seller.newListing.termsDesc")}
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
                      ? (!listingForm.startingBid)
                      : (!listingForm.price || parseFloat(listingForm.price) < 4.00)
                  ) : false
                }
                onClick={() => {
                  // When entering Step 3 in auction mode, auto-compute auctionEndAt with default days
                  if (listingStep === 2 && listingForm.listingMode === 'auction' && !listingForm.auctionEndAt) {
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
                {t("common.nextStep")}
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
                {(createListingMutation.isPending || adminCreateListingMutation.isPending || createAuctionMutation.isPending) ? t("common.submitting") : t("seller.newListing.confirmList")}
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
        <DialogContent bottomSheet className="lg:max-w-lg bg-[#06038D] text-white">
          <DialogHeader>
            <DialogTitle className="text-[#FEDD00] font-black text-lg flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              {t("seller.auctionTerms.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/90 max-h-72 overflow-y-auto pr-1">
            <p className="font-semibold text-white">{t("seller.auctionTerms.intro")}</p>
            <div className="space-y-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">✅ {t("seller.auctionTerms.authenticityTitle")}</p>
                <p className="text-xs">{t("seller.auctionTerms.authenticityContent")}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">📦 {t("seller.auctionTerms.shippingTitle")}</p>
                <p className="text-xs">{t("seller.auctionTerms.shippingContent")}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">🚫 {t("seller.auctionTerms.withdrawTitle")}</p>
                <p className="text-xs">{t("seller.auctionTerms.withdrawContent")}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">💰 {t("seller.auctionTerms.feeTitle")}</p>
                <p className="text-xs">{t("seller.auctionTerms.feeContent")}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">🏷️ {t("seller.auctionTerms.newSellerTitle")}</p>
                <p className="text-xs">{t("seller.auctionTerms.newSellerContent")}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">⚠️ {t("seller.auctionTerms.violationTitle")}</p>
                <p className="text-xs">{t("seller.auctionTerms.violationContent")}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="font-bold text-[#FEDD00] text-xs mb-1">🤝 {t("seller.auctionTerms.protectionTitle")}</p>
                <p className="text-xs">{t("seller.auctionTerms.protectionContent")}</p>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-2">
              {t("seller.auctionTerms.fullTermsLink")} <Link href="/auction/terms" className="text-[#FEDD00] underline">{t("seller.auctionTerms.pageLink")}</Link>
            </p>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setShowSellerTerms(false); setPendingAuctionSubmit(false); }} className="border-white/30 text-white hover:bg-white/10 bg-transparent">
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
              onClick={() => agreeSellerTermsMutation.mutate({ role: 'seller' })}
              disabled={agreeSellerTermsMutation.isPending}
            >
              {agreeSellerTermsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {t("seller.auctionTerms.agreeAndList")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={shipDialog.open} onOpenChange={(o) => setShipDialog(d => ({ ...d, open: o }))}>
        <DialogContent bottomSheet className="sm:max-w-md bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-[#06038d] font-bold">{t("seller.shipping.title")}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {shipDialog.orderNo && <p className="text-xs text-gray-500">{t("seller.shipping.orderNo")}：<span className="font-mono font-semibold text-[#06038d]">{shipDialog.orderNo}</span></p>}
            {/* 買家收件資訊 */}
            {shipDialog.shippingName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-[#06038d] mb-1">📦 {t("seller.shipping.buyerInfo")}</p>
                <p className="text-xs text-gray-700">{t("seller.recipient")}：{shipDialog.shippingName}{shipDialog.shippingPhone ? ` · ${shipDialog.shippingPhone}` : ""}</p>
                {shipDialog.shippingAddress && (
                  <p className="text-xs text-gray-700">{t("seller.address")}：{(() => {
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
            {/* 送貨方式提示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-[#06038d] mb-1">📦 {t("seller.shipping.methodTitle")}</p>
              <p className="text-xs text-gray-700">{t("seller.shipping.methodDesc")}</p>
              <ul className="text-xs text-gray-600 mt-1 space-y-0.5 pl-2">
                <li>🚚 <strong>{t("seller.shipping.sfExpress")}</strong>：{t("seller.shipping.sfExpressDesc")}</li>
                <li>📮 <strong>{t("seller.shipping.hkPost")}</strong>：{t("seller.shipping.hkPostDesc")}</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-800 font-medium">{t("seller.shipping.methodLabel")} <span className="text-red-500">*</span></Label>
              <Select value={shipForm.shippingMethod} onValueChange={(v) => setShipForm(f => ({ ...f, shippingMethod: v }))}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900"><SelectValue placeholder={t("seller.shipping.selectMethod")} /></SelectTrigger>
                <SelectContent>
                  {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-800 font-medium">{t("seller.shipping.trackingLabel")} {shipForm.shippingMethod !== 'hk_post' && <span className="text-red-500">*</span>}</Label>
              <Input
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                placeholder={shipForm.shippingMethod === 'hk_post' ? t('seller.shipping.hkPostTrackingPlaceholder') : t('seller.shipping.sfExpressPlaceholder')}
                value={shipForm.trackingNumber}
                onChange={(e) => setShipForm(f => ({ ...f, trackingNumber: e.target.value }))}
              />
              {/* Tracking link preview */}
              {shipForm.trackingNumber.trim() && (() => {
                const carrier = CARRIERS.find(c => c.value === shipForm.shippingMethod);
                if (!carrier) return null;
                const url = carrier.trackingUrl + encodeURIComponent(shipForm.trackingNumber.trim());
                return (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#06038d] hover:underline mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    {t("seller.shipping.previewTracking")}
                  </a>
                );
              })()}
            </div>
            {/* Shipping proof image upload */}
            <div className="space-y-1.5">
              <Label className="text-gray-800 font-medium">{t("seller.shipping.proofLabel")} <span className="text-red-500">*</span></Label>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">⚠️ {t("seller.shipping.proofRequired")}</p>
              {shipForm.shippingImageUrl ? (
                <div className="relative">
                  <img src={shipForm.shippingImageUrl} alt={t("seller.shipping.proofAlt")} className="w-full max-h-40 object-contain rounded-lg border border-[#06038d]/30 bg-gray-50" />
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
                      <span className="text-xs font-medium">{t("seller.shipping.uploadPhoto")}</span>
                      <span className="text-xs text-gray-400">{t("seller.shipping.uploadHint")}</span>
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
                      if (file.size > 10 * 1024 * 1024) { toast.error(t("seller.shipping.fileSizeError")); return; }
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
              disabled={!shipForm.shippingMethod || (shipForm.shippingMethod !== 'hk_post' && !shipForm.trackingNumber) || !shipForm.shippingImageUrl || markShippedMutation.isPending || shipImageUploading}
              onClick={() => markShippedMutation.mutate({
                orderId: shipDialog.orderId,
                shippingMethod: shipForm.shippingMethod,
                trackingNo: shipForm.trackingNumber,
                shippingImageUrl: shipForm.shippingImageUrl || undefined,
              })}
            >
              {markShippedMutation.isPending ? t("common.processing") : t("seller.shipping.confirmShip")}
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
              <span className="text-white font-black text-lg">{t("seller.deleteListing.title")}</span>
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
                    {t("seller.deleteListing.desc", { count: deletableListings.length })}
                  </p>
                  <div className="border border-[#06038D]/20 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {deletableListings.map((l, idx) => (
                      <div key={l.id} className={`flex items-center gap-2 px-3 py-2.5 text-sm border-b border-[#06038D]/10 last:border-0 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#06038D]/3'
                      }`}>
                        <span className="text-[#06038D]/50 font-mono text-xs shrink-0 font-bold">#BOXIUM-{String(l.id).padStart(6, '0')}</span>
                        <span className="text-gray-800 truncate flex-1 font-medium">{l.title || t('seller.deleteListing.unnamed')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                          l.status === 'active' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {l.status === 'active' ? t('seller.listingActive') : t('seller.listingRemoved')}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            <div className="bg-[#06038D]/5 border border-[#06038D]/15 rounded-xl p-3">
              <p className="text-xs text-[#06038D] font-bold mb-1">{t("seller.deleteListing.notes")}</p>
              <div className="text-xs text-[#06038D]/70 space-y-0.5">
                <p>• {t("seller.deleteListing.note1")}</p>
                <p>• {t("seller.deleteListing.note2")}</p>
                <p>• {t("seller.deleteListing.note3")}</p>
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
              {t("common.cancel")}
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
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("common.deleting")}</>
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
