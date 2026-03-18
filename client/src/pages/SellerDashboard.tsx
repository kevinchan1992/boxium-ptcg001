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
import { Package, ShoppingBag, DollarSign, ExternalLink, Plus, AlertCircle, CheckCircle, Clock, ImagePlus, Loader2, X, Star, Tag, Wallet, MessageSquare, Share2, Link2, Check, ImageDown, Layers, ChevronRight, Pencil, EyeOff, Eye, Trash2, CheckSquare, Square, ChevronDown } from "lucide-react";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import { generateShareImage, downloadShareImage } from "@/hooks/useShareImage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

// ─── PayoutProofThumbnail ────────────────────────────────────────────────────
function PayoutProofThumbnail({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block mt-1 group relative w-20 h-14 rounded overflow-hidden border border-gray-200 hover:border-[#06038d] transition-colors"
        title="點擊查看付款截圖"
      >
        <img src={url} alt="付款截圖" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </button>
      <p className="text-xs text-gray-500 mt-0.5">點擊縮圖可放大查看</p>
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
            <img src={url} alt="付款截圖" className="max-w-full max-h-[85vh] rounded-lg shadow-xl object-contain" />
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
  paid_held: { label: "已付款，請出貨", color: "bg-blue-100 text-blue-800" },
  payment_received: { label: "已收款，請出貨", color: "bg-blue-100 text-blue-800" },
  processing: { label: "處理中，請出貨", color: "bg-purple-100 text-purple-800" },
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

// ─── EarningsTab ─────────────────────────────────────────────────────────────
function EarningsTab() {
  const { data: me } = trpc.auth.me.useQuery();
  const { data: sellerProfile } = trpc.marketplace.getMySellerProfile.useQuery(
    undefined, { enabled: !!me }
  );
  const isAdmin = me?.role === 'admin';
  const { data: earningsData, isLoading } = trpc.marketplace.getSellerEarnings.useQuery(
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

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">已完成訂單</p>
          <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{summary.completedCount}</p>
          <p className="text-xs text-gray-400 mt-1">待出貨/運送中 {summary.pendingCount} 筆</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">累計銷售額</p>
          <p className="text-2xl font-bold" style={{ color: "#06038d" }}>HKD {summary.totalRevenue.toFixed(0)}</p>
          <p className="text-xs text-gray-400 mt-1">平台手續費 HKD {summary.totalFees.toFixed(0)}</p>
        </div>
        <div className="col-span-2 bg-gradient-to-r from-[#06038d] to-[#0a06b5] rounded-2xl shadow-md p-4">
          <p className="text-xs text-white/70 mb-1">累計淨收入</p>
          <p className="text-3xl font-bold text-white">HKD {summary.totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-white/60 mt-1">扣除平台手續費後實際收款金額</p>
        </div>
      </div>

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
                    <span className="text-gray-500">訂單金額</span>
                    <span className="font-medium">HKD {parseFloat(order.subtotalHkd ?? '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">平台手續費 ({parseFloat(order.platformFeeRate ?? '0.05') * 100}%)</span>
                    <span className="text-red-500">- HKD {parseFloat(order.platformFeeHkd ?? '0').toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-1.5 flex justify-between">
                    <span className="font-semibold text-gray-800">淨收入</span>
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

export default function SellerDashboard() {
  const [showApply, setShowApply] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingOfferId, setRejectingOfferId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showNewListing, setShowNewListing] = useState(false);
  const [listingStep, setListingStep] = useState<1 | 2 | 3>(1);
  const [applyForm, setApplyForm] = useState({ displayName: "", bio: "" });
  const [listingForm, setListingForm] = useState({
    title: "", description: "", condition: "raw_a", price: "", quantity: "1",
    minOffer: "", acceptOffers: false, tcgSeries: "pokemon" as string,
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

  // ─── Listing filter state ─────────────────────────────────────────────────
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'sold' | 'removed' | 'pending_review'>('all');

  // ─── Edit / Deactivate / Batch state ─────────────────────────────────────
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingListing, setEditingListing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", quantity: "" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const updateListingMutation = trpc.marketplace.updateMyListing.useMutation({
    onSuccess: () => {
      toast.success("商品已更新");
      setShowEditDialog(false);
      setEditingListing(null);
      refetchListings();
    },
    onError: (e) => toast.error(e.message),
  });

  const deactivateMutation = trpc.marketplace.deleteMyListing.useMutation({
    onSuccess: () => { toast.success("商品已下架"); refetchListings(); },
    onError: (e) => toast.error(e.message),
  });

  const reactivateMutation = trpc.marketplace.updateMyListing.useMutation({
    onSuccess: () => { toast.success("商品已重新上架，等待審核"); refetchListings(); },
    onError: (e) => toast.error(e.message),
  });

  const batchDeactivateMutation = trpc.marketplace.batchDeactivateListings.useMutation({
    onSuccess: (data) => {
      toast.success(`已下架 ${data.count} 件商品`);
      setSelectedIds(new Set());
      setBatchMode(false);
      refetchListings();
    },
    onError: (e) => toast.error(e.message),
  });

  const batchReactivateMutation = trpc.marketplace.batchReactivateListings.useMutation({
    onSuccess: (data) => {
      toast.success(`已重新上架 ${data.count} 件商品，等待審核`);
      setSelectedIds(new Set());
      setBatchMode(false);
      refetchListings();
    },
    onError: (e) => toast.error(e.message),
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
    onSuccess: () => { toast.success("申請已提交，等待審批"); setShowApply(false); refetchProfile(); },
    onError: (e) => toast.error(e.message),
  });

  const createListingMutation = trpc.marketplace.createListing.useMutation({
    onSuccess: () => {
      toast.success("商品已提交審核");
      setShowNewListing(false);
      setListingForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", minOffer: "", acceptOffers: false, tcgSeries: "pokemon" });
      setListingStep(1);
      setListingImages([]);
      setSelectedCard(null);
      refetchListings();
    },
    onError: (e) => toast.error(e.message),
  });

  const [newListingId, setNewListingId] = useState<number | null>(null);
  const adminCreateListingMutation = trpc.marketplace.adminCreatePlatformListing.useMutation({
    onSuccess: (data) => {
      const id = data?.id ?? null;
      setNewListingId(id);
      toast.success(
        <div className="flex items-center gap-3">
          <span>商品已成功上架</span>
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
      setListingForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", minOffer: "", acceptOffers: false, tcgSeries: "pokemon" });
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

  const [shipDialog, setShipDialog] = useState<{ open: boolean; orderId: number; orderNo: string; shippingName?: string; shippingPhone?: string; shippingAddress?: string }>({ open: false, orderId: 0, orderNo: "" });
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
      utils.marketplace.getMySellerOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
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

  return (
    <div className="min-h-screen bg-white text-gray-900">
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
              </div>
              <p className="text-white/70 text-sm mt-1">管理你的商品、訂單和收款</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 pb-16">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-6">

        {!sellerProfile && !isAdmin && (
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

        {(sellerProfile?.isActive || isAdmin) && (
          <>
            {!isAdmin && sellerProfile?.stripeConnectStatus === "pending" && !sellerProfile?.stripeConnectId && (
              <Card className="border-blue-200 bg-blue-50 mb-6">
                <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-blue-900">設定 Stripe 收款帳戶</p>
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
            {!isAdmin && sellerProfile?.stripeConnectStatus === "active" && (
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
                    <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{salesStats?.completedOrders ?? sellerProfile?.totalSales ?? 0}</p>
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
                    <p className="text-2xl font-bold" style={{ color: "#06038d" }}>{parseFloat((sellerProfile?.avgRating as string) ?? '0').toFixed(1)}</p>
                    <p className="text-xs text-gray-500">評分 ({sellerProfile?.ratingCount ?? 0} 則)</p>
                  </div>
                </div>
              </div>
            </div>

            <BrandTabs defaultValue="listings">
              <BrandTabsList>
                <BrandTabsTrigger value="listings" icon={<Package className="w-4 h-4" />} label="我的商品">我的商品</BrandTabsTrigger>
                <BrandTabsTrigger value="orders" icon={<ShoppingBag className="w-4 h-4" />} label="訂單管理">訂單管理</BrandTabsTrigger>
                <BrandTabsTrigger value="offers" icon={<MessageSquare className="w-4 h-4" />} label="買家出價">
                  買家出價
                  {pendingSellerOffersCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {pendingSellerOffersCount > 99 ? '99+' : pendingSellerOffersCount}
                    </span>
                  )}
                </BrandTabsTrigger>
                <BrandTabsTrigger value="payouts" icon={<Wallet className="w-4 h-4" />} label="放款記錄">放款記錄</BrandTabsTrigger>
                <BrandTabsTrigger value="earnings" icon={<DollarSign className="w-4 h-4" />} label="收款記錄">收款記錄</BrandTabsTrigger>
              </BrandTabsList>

              <BrandTabsContent value="listings" className="mt-4">
                {/* Listing Filter Sidebar + Content */}
                {(() => {
                  const filterCategories = [
                    { key: 'all' as const, label: '全部', count: myListings?.length ?? 0 },
                    { key: 'active' as const, label: '上架中', count: myListings?.filter((l: any) => l.status === 'active').length ?? 0 },
                    { key: 'sold' as const, label: '已售出', count: myListings?.filter((l: any) => l.status === 'sold').length ?? 0 },
                    { key: 'pending_review' as const, label: '審核中', count: myListings?.filter((l: any) => l.status === 'pending_review').length ?? 0 },
                    { key: 'removed' as const, label: '已下架', count: myListings?.filter((l: any) => l.status === 'removed').length ?? 0 },
                  ];
                  const filteredListings = listingFilter === 'all'
                    ? (myListings ?? [])
                    : (myListings ?? []).filter((l: any) => l.status === listingFilter);
                  return (
                    <div className="flex gap-4">
                      {/* Left Sidebar */}
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
                      {/* Mobile: horizontal scroll tabs */}
                      <div className="flex sm:hidden gap-2 overflow-x-auto pb-1 mb-2 w-full">
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
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                {!myListings?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3" style={{color:'#06038D', opacity:0.4}} />
                    <p>尚未上架任何商品</p>
                    <Button
                      className="mt-4 font-bold"
                      style={{ background: '#FEDD00', color: '#06038D' }}
                      onClick={() => {
                        if (!isAdmin && sellerProfile?.stripeConnectStatus !== 'active') {
                          toast.error('請先完成 Stripe Connect 收款帳戶設定，才能上架商品');
                          return;
                        }
                        setShowNewListing(true);
                      }}
                    >
                      上架第一件商品
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
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
                        {batchMode && (
                          <>
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
                                  onClick={() => batchDeactivateMutation.mutate({ ids: Array.from(selectedIds) })}
                                >
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  下架 ({selectedIds.size})
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-8 border-green-500 text-green-700 hover:bg-green-50"
                                  disabled={batchReactivateMutation.isPending}
                                  onClick={() => batchReactivateMutation.mutate({ ids: Array.from(selectedIds) })}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  重新上架 ({selectedIds.size})
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <Button
                        className="font-bold flex items-center gap-2 text-sm h-8"
                        style={{ background: '#FEDD00', color: '#06038D' }}
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
                      </Button>
                    </div>

                    {filteredListings.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">此類別無商品</p>
                      </div>
                    ) : filteredListings.map((listing: any) => {
                      let coverImg: string | null = null;
                      try {
                        const imgs = listing.images ? JSON.parse(listing.images as string) : null;
                        coverImg = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                      } catch {}
                      const isSold = listing.status === "sold";
                      const isRemoved = listing.status === "removed";
                      const isActive = listing.status === "active";
                      const isSelected = selectedIds.has(listing.id);
                      const listingUrl = `${window.location.origin}/marketplace/${listing.id}`;
                      const shareText = `「${listing.title}」 HKD ${parseFloat(listing.priceHkd as string).toFixed(2)} - BOXIUM PTCG`;
                      return (
                        <div
                          key={listing.id}
                          className={`bg-white rounded-2xl shadow-md border overflow-hidden transition-all ${
                            isSelected ? "border-[#06038d] ring-2 ring-[#06038d]/20" : "border-gray-100"
                          }${isSold ? " opacity-80" : ""}`}
                          onClick={batchMode ? () => toggleSelectId(listing.id) : undefined}
                          style={batchMode ? { cursor: "pointer" } : undefined}
                        >
                          {/* Brand Header Bar */}
                          <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                            <div className="flex items-center gap-2">
                              {batchMode && (
                                <div className="w-4 h-4 rounded border-2 border-white/60 flex items-center justify-center" style={isSelected ? { background: '#FEDD00', borderColor: '#FEDD00' } : {}}>
                                  {isSelected && <Check className="w-3 h-3" style={{ color: '#06038D' }} />}
                                </div>
                              )}
                              <span className="text-xs text-white/80 font-medium">庫存 {listing.quantity}</span>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isActive ? "bg-green-400/20 text-green-200 border border-green-400/30" :
                              listing.status === "pending_review" ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/30" :
                              isSold ? "bg-blue-400/20 text-blue-200 border border-blue-400/30" :
                              isRemoved ? "bg-red-400/20 text-red-200 border border-red-400/30" :
                              "bg-white/20 text-white/70 border border-white/30"
                            }`}>
                              {isActive ? "上架中" :
                               listing.status === "pending_review" ? "審核中" :
                               isSold ? "已售出" :
                               isRemoved ? "已下架" : listing.status}
                            </span>
                          </div>
                          {/* Card Body */}
                          <div className="flex items-center gap-3 p-4 flex-wrap">
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
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {(() => {
                                  const tcgLogos: Record<string, { logo: string; label: string }> = {
                                    pokemon:  { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif",  label: "Pokémon" },
                                    onepiece: { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif", label: "One Piece" },
                                    yugioh:   { logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp",  label: "Yu-Gi-Oh!" },
                                  };
                                  const series = tcgLogos[listing.tcgSeries as string];
                                  return series ? (
                                    <img src={series.logo} alt={series.label} title={series.label} className="h-4 w-auto object-contain opacity-80" />
                                  ) : null;
                                })()}
                                <p className="text-sm font-bold" style={{ color: '#06038D' }}>
                                  HKD {parseFloat(listing.priceHkd as string).toFixed(2)}
                                </p>
                              </div>
                            </div>
                            {!batchMode && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {/* Edit button */}
                                {!isSold && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 border-[#06038d] text-[#06038d] hover:bg-blue-50"
                                    onClick={(e) => { e.stopPropagation(); openEditDialog(listing); }}
                                  >
                                    <Pencil className="w-3 h-3 mr-1" />
                                    編輯
                                  </Button>
                                )}
                                {/* Deactivate / Reactivate */}
                                {isActive && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 border-red-400 text-red-600 hover:bg-red-50"
                                    disabled={deactivateMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate({ id: listing.id }); }}
                                  >
                                    <EyeOff className="w-3 h-3 mr-1" />
                                    下架
                                  </Button>
                                )}
                                {isRemoved && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 border-green-500 text-green-700 hover:bg-green-50"
                                    disabled={reactivateMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); reactivateMutation.mutate({ id: listing.id, status: "active" }); }}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    重新上架
                                  </Button>
                                )}
                                {/* View detail */}
                                {(isSold || isActive) && (
                                  <Link href={`/marketplace/${listing.id}`}>
                                    <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-gray-300 text-gray-600 hover:bg-gray-50">
                                      <ExternalLink className="w-3 h-3" />
                                    </Button>
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
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                      </div>
                    </div>
                  );
                })()}
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
                            {(["processing", "payment_received", "paid_held"].includes(item.orderStatus)) && (
                              <Button size="sm" className="bg-[#06038d] hover:bg-[#0804b8] text-white flex-shrink-0"
                                onClick={() => {
                                  setShipDialog({
                                    open: true,
                                    orderId: item.orderId ?? item.id,
                                    orderNo: item.orderNo ?? "",
                                    shippingName: item.shippingName ?? undefined,
                                    shippingPhone: item.shippingPhone ?? undefined,
                                    shippingAddress: item.shippingAddress ?? undefined,
                                  });
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
                              {item.shippedAt && <p>📅 出貨日期：{new Date(item.shippedAt).toLocaleDateString('zh-HK')}</p>}
                            </div>
                          )}
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
                            <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" />
                              訂單已完成，收到 HKD {parseFloat(item.sellerReceivableHkd ?? item.priceHkd ?? '0').toFixed(2)}
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
                      <div key={`${payout.source ?? 'stripe'}-${payout.id}`} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                        {/* Brand Header Bar */}
                        <div className="px-4 py-2 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/80 font-medium">
                              {payout.orderNo ? `#${payout.orderNo}` : `#${payout.id}`}
                            </span>
                            {payout.source === 'alipay_hk' && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-300/30 text-blue-100">支付寶 HK</span>
                            )}
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            payout.status === "completed"
                              ? "bg-green-400/20 text-green-200 border border-green-400/30"
                              : "bg-yellow-400/20 text-yellow-200 border border-yellow-400/30"
                          }`}>
                            {payout.status === "completed" ? "已放款" : "處理中"}
                          </span>
                        </div>
                        {/* Card Body */}
                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">HKD {parseFloat(payout.amountHkd ?? payout.amount ?? 0).toFixed(2)}</p>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {payout.createdAt ? new Date(payout.createdAt).toLocaleDateString("zh-HK") : '-'}
                              </p>
                              {payout.listingTitle && (
                                <p className="text-xs text-gray-400 mt-0.5">{payout.listingTitle}</p>
                              )}
                            </div>
                            <DollarSign className="w-5 h-5 text-[#06038d]/30" />
                          </div>
                          {/* Alipay HK manual payout details */}
                          {payout.source === 'alipay_hk' && (
                            <div className="border-t border-gray-100 pt-2 space-y-1.5">
                              {payout.manualPayoutNote && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">備注：</span>{payout.manualPayoutNote}
                                </p>
                              )}
                              {payout.manualPayoutProofUrl && (
                                <PayoutProofThumbnail url={payout.manualPayoutProofUrl} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </BrandTabsContent>

              <BrandTabsContent value="offers" className="mt-4">
                {!sellerOffers?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>尚無買家出價</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(sellerOffers as any[]).map((offer) => (
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
                                <p className="font-semibold truncate text-gray-900">{offer.listingTitle || '商品'}</p>
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
                            {offer.status === 'pending' && (
                              <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                                  disabled={respondToOfferMutation.isPending}
                                  onClick={() => respondToOfferMutation.mutate({ offerId: offer.id, action: 'accept' })}
                                >接受</Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                  disabled={respondToOfferMutation.isPending}
                                  onClick={() => { setRejectingOfferId(offer.id); setRejectionReason(""); setShowRejectDialog(true); }}
                                >拒絕</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </BrandTabsContent>

              <BrandTabsContent value="earnings" className="mt-4">
                <EarningsTab />
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

      {/* ─── Reject Offer Dialog ──────────────────────────────────────────── */}
      <Dialog open={showRejectDialog} onOpenChange={(v) => { setShowRejectDialog(v); if (!v) { setRejectingOfferId(null); setRejectionReason(""); } }}>
        <DialogContent className="max-w-sm bg-white text-gray-900">
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
            <Button variant="outline" className="text-gray-700 bg-white" onClick={() => setShowRejectDialog(false)}>取消</Button>
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

            <div>
              <Label className="text-[#06038D] font-semibold">商品名稱</Label>
              <Input
                className="mt-1"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="商品名稱"
              />
            </div>
            <div>
              <Label className="text-[#06038D] font-semibold">商品描述</Label>
              <Textarea
                className="mt-1 resize-none"
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
                  value={editForm.quantity}
                  onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 bg-white flex gap-3">
            <Button variant="outline" className="flex-1 h-11 border-gray-300" onClick={() => setShowEditDialog(false)}>取消</Button>
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
                          <p className="text-[10px] text-[#06038D]/80 font-medium mt-0.5">PSA 10 市場均價 HKD {parseFloat(String(selectedCard.referencePrice)).toLocaleString()}</p>
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
                <div>
                  <Label className="text-[#06038D] font-semibold">TCG 系列 *</Label>
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
                        <img src={series.logo} alt={series.label} className="h-6 w-auto object-contain" />
                        <span className={`text-[10px] font-semibold ${
                          listingForm.tcgSeries === series.value ? "text-[#06038D]" : "text-gray-500"
                        }`}>{series.label}</span>
                      </button>
                    ))}
                  </div>
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
                  {/* Dynamic condition-based market price */}
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
                  {/* Fallback: show PSA10 reference price if no card selected */}
                  {!selectedCard && selectedCard === null && false && (
                    <p className="text-xs text-[#06038D]/70 mt-0.5 mb-1">PSA 10 市場均價：HKD --</p>
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
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[#06038D]/20 bg-[#06038D]/5">
                    <div>
                      <p className="text-sm font-medium text-[#06038D]">接受買家出價</p>
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
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">買家出價</span>
                      <span className="text-sm text-[#06038D]">{listingForm.acceptOffers ? `接受${listingForm.minOffer ? `（最低 HKD ${listingForm.minOffer}）` : ""}` : "不接受"}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-[#06038D]/20 bg-[#06038D]/5">
                      <div>
                        <p className="text-sm font-medium text-[#06038D]">接受買家出價</p>
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
                  )}
                  <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-xs text-[#06038D]">
                    {isAdmin ? (
                      <p className="font-medium">確認後直接公開上架</p>
                    ) : (
                      <>
                        <p className="font-medium">提交後等待審核</p>
                        <p className="mt-0.5">商品將在管理員審核通過後公開顯示，通常需要 1-2 個工作天。</p>
                      </>
                    )}
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
                disabled={createListingMutation.isPending || adminCreateListingMutation.isPending}
                onClick={() => {
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
                    adminCreateListingMutation.mutate({ ...payload, status: 'active', allowOffers: listingForm.acceptOffers });
                  } else {
                    createListingMutation.mutate({ ...payload, minOfferHkd: listingForm.acceptOffers && listingForm.minOffer ? parseFloat(listingForm.minOffer) : undefined });
                  }
                }}
              >
                {(createListingMutation.isPending || adminCreateListingMutation.isPending) ? "提交中..." : isAdmin ? "確認上架" : "提交審核"}
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
            {/* 買家收件資訊 */}
            {shipDialog.shippingName && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-blue-700 mb-1">📦 買家收件資訊</p>
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
