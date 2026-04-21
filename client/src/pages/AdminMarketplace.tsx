import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { parseApiError } from "@/lib/parseApiError";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Package, Users, AlertCircle, CheckCircle, Clock, History, ArrowLeft, Plus, Eye, Edit, DollarSign, ImagePlus, X, Loader2, Trash2, Flag, TrendingUp, TrendingDown, BarChart3, ChevronLeft, ChevronRight, User2, Calendar, Tag, Check, Layers, Download, FileText, Search, Filter, RefreshCw, ExternalLink, PhoneCall, Mail, MapPin, CreditCard, Banknote, Copy, CheckSquare, Square, MessageSquare, Printer, XCircle, Settings, Timer, Shield, ShieldOff, ScrollText, Bot, Gavel, Award } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CONDITION_GROUPS } from "@/lib/conditions";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import { ImageLightbox } from "@/components/ImageLightbox";
import AdminGrading from "@/components/AdminGrading";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line, ComposedChart } from "recharts";
// PDF export is now server-side via /api/admin/financial-report-pdf

const conditionLabel: Record<string, string> = {
  psa10: "PSA 10", psa9: "PSA 9", psa8_below: "PSA 8↓",
  bgs10: "BGS 10", bgs9: "BGS 9", bgs8_below: "BGS 8↓",
  tag10: "TAG 10", tag9_below: "TAG 9↓",
  raw_a: "A品", raw_b: "B品", raw_c: "C品", raw_d: "D品",
};
const conditionColor: Record<string, string> = {
  psa10: "bg-yellow-100 text-yellow-800", psa9: "bg-yellow-50 text-yellow-700", psa8_below: "bg-amber-50 text-amber-700",
  bgs10: "bg-blue-100 text-blue-800", bgs9: "bg-blue-50 text-blue-700", bgs8_below: "bg-sky-50 text-sky-700",
  tag10: "bg-purple-100 text-purple-800", tag9_below: "bg-purple-50 text-purple-700",
  raw_a: "bg-emerald-100 text-emerald-800", raw_b: "bg-green-50 text-green-700", raw_c: "bg-orange-50 text-orange-700", raw_d: "bg-red-50 text-red-700",
};
const orderStatusColor: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  payment_received: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-cyan-100 text-cyan-800",
  delivered: "bg-teal-100 text-teal-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  disputed: "bg-red-100 text-red-800",
};
const orderStatusLabel: Record<string, string> = {
  pending_payment: "待付款", paid_held: "已付款，待出貨", payment_received: "已收款", processing: "處理中",
  shipped: "已發貨", delivered: "已送達", completed: "已完成",
  cancelled: "已取消", disputed: "爭議中",
};

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`p-3 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ImageUploader({ images, onChange, maxImages = 5 }: { images: string[]; onChange: (imgs: string[]) => void; maxImages?: number }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
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
      if (uploaded.length > 0) {
        onChange([...images, ...uploaded]);
        toast.success(`已上傳 ${uploaded.length} 張圖片`);
      }
    } catch (e: any) {
      toast.error(e.message || "圖片上傳失敗");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [images, onChange, maxImages]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-2">
      <Label>商品圖片（最多 {maxImages} 張）</Label>
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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

function CreateListingDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", status: "active", allowOffers: false, tcgSeries: "pokemon" as string });
  const [images, setImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);

  const { data: conditionPriceData, isLoading: conditionPriceLoading } = trpc.cards.getPriceByCondition.useQuery(
    { cardId: selectedCard?.id ?? 0, condition: form.condition },
    { enabled: !!selectedCard?.id && !!form.condition }
  );

  const reset = () => {
    setForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", status: "active", allowOffers: false, tcgSeries: "pokemon" });
    setImages([]);
    setSelectedCard(null);
    setStep(1);
  };

  const createMutation = trpc.marketplace.adminCreatePlatformListing.useMutation({
    onSuccess: () => { toast.success("平台商品已上架"); onSuccess(); onClose(); reset(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
        <DialogContent bottomSheet showCloseButton={false} className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-lg">
          {/* Step Header */}
          <div className="px-5 pt-5 pb-4" style={{backgroundColor: '#06038D', borderBottom: '3px solid #FEDD00'}}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">新增平台商品</h2>
              <button onClick={() => { onClose(); reset(); }} className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Step Indicator */}
            <div className="flex items-center gap-0">
              {[{ n: 1, label: "基本資料" }, { n: 2, label: "定價設定" }, { n: 3, label: "確認上架" }].map(({ n, label }, idx) => (
                <React.Fragment key={n}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step > n ? "bg-[#FEDD00] text-[#06038D]" :
                      step === n ? "bg-[#FEDD00] text-[#06038D] ring-4 ring-[#FEDD00]/30" :
                      "bg-white/20 text-white/50"
                    }`}>
                      {step > n ? <Check className="w-3.5 h-3.5" /> : n}
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${
                      step >= n ? "text-[#FEDD00]" : "text-white/40"
                    }`}>{label}</span>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${
                      step > n ? "bg-[#FEDD00]" : "bg-white/20"
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-white">

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <>
                <ImageUploader images={images} onChange={setImages} />
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
                  <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" placeholder="例如：PSA 10 皮卡丘 SM-P 288"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[#06038D] font-semibold">商品描述</Label>
                  <Textarea className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" placeholder="描述卡牌狀況、版本等..."
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
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
                        onClick={() => setForm(f => ({ ...f, tcgSeries: series.value }))}
                        className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                          form.tcgSeries === series.value
                            ? "border-[#06038D] bg-[#06038D]/5 shadow-sm"
                            : "border-gray-200 bg-white hover:border-[#06038D]/40"
                        }`}
                      >
                        <img src={series.logo} alt={series.label} className="h-9 w-auto object-contain" />
                        <span className={`text-[10px] font-semibold ${
                          form.tcgSeries === series.value ? "text-[#06038D]" : "text-gray-500"
                        }`}>{series.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[#06038D] font-semibold">品相 *</Label>
                    <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
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
                    <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] focus:border-[#06038D]" type="number" min="1" value={form.quantity}
                      onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-[#06038D] font-semibold">上架狀態</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1 bg-white border-[#06038D]/30 text-[#06038D]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">立即上架</SelectItem>
                      <SelectItem value="draft">草稿（暫不公開）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 2: Pricing */}
            {step === 2 && (
              <>
                <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3.5">
                  <p className="text-xs font-semibold text-[#06038D] mb-1">商品摘要</p>
                  <p className="text-sm font-bold text-[#06038D] truncate">{form.title}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-[#06038D]/60">{conditionOptions.flatMap(g => g.items).find(i => i.value === form.condition)?.label ?? form.condition}</span>
                    <span className="text-xs text-[#06038D]/40">·</span>
                    <span className="text-xs text-[#06038D]/60">數量 {form.quantity}</span>
                  </div>
                </div>
                <div className="bg-white border border-[#06038D]/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#06038D]">接受買家出價</p>
                      <p className="text-xs text-[#06038D]/50 mt-0.5">買家可提交低於定價的出價</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, allowOffers: !f.allowOffers }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        form.allowOffers ? 'bg-[#06038D]' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        form.allowOffers ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
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
                              : `${conditionOptions.flatMap(g => g.items).find(i => i.value === form.condition)?.label ?? form.condition} 市場均價：HKD ${conditionPriceData.avgPrice.toLocaleString()}`
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
                  <Input className="mt-1 bg-white border-[#06038D]/30 text-[#06038D] placeholder:text-gray-400 focus:border-[#06038D]" type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  {form.price && parseFloat(form.price) >= 0 && conditionPriceData?.avgPrice && (() => {
                    const refPrice = conditionPriceData.avgPrice;
                    const diff = ((parseFloat(form.price) - refPrice) / refPrice) * 100;
                    const condLabel = conditionPriceData.isFallback ? 'PSA 10 市場均價' : '市場均價';
                    return (
                      <p className={`text-xs mt-1 ${diff < -15 ? "text-amber-600" : diff > 15 ? "text-green-600" : "text-gray-500"}`}>
                        {diff > 0 ? `高於${condLabel} ${diff.toFixed(0)}%` : `低於${condLabel} ${Math.abs(diff).toFixed(0)}%`}
                      </p>
                    );
                  })()}
                </div>
              </>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <>
                <div className="space-y-3">
                  {images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {images.map((url, i) => (
                        <img key={i} src={url} alt={`圖片 ${i+1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl border border-[#06038D]/20 divide-y divide-[#06038D]/10 overflow-hidden bg-white">
                    <div className="flex items-start justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">商品名稱</span>
                      <span className="text-sm font-medium text-[#06038D] text-right">{form.title}</span>
                    </div>
                    {selectedCard && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">關聯卡牌</span>
                        <span className="text-sm text-[#06038D] text-right">{selectedCard.name}</span>
                      </div>
                    )}
                    {form.description && (
                      <div className="flex items-start justify-between px-4 py-3">
                        <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">描述</span>
                        <span className="text-sm text-[#06038D]/80 text-right line-clamp-3">{form.description}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">品相</span>
                      <span className="text-sm text-[#06038D]">{conditionOptions.flatMap(g => g.items).find(i => i.value === form.condition)?.label ?? form.condition}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">數量</span>
                      <span className="text-sm text-[#06038D]">{form.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">售價</span>
                      <span className="text-base font-bold text-[#06038D]">HKD {parseFloat(form.price || "0").toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">狀態</span>
                      <span className="text-sm text-[#06038D]">{form.status === 'active' ? '立即上架' : '草稿'}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#06038D]/50 w-20 flex-shrink-0">接受出價</span>
                      <span className={`text-sm font-medium ${form.allowOffers ? 'text-green-600' : 'text-gray-400'}`}>{form.allowOffers ? '是，接受買家出價' : '否，不接受出價'}</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                    <p className="font-medium">平台商品直接上架</p>
                    <p className="mt-0.5">作為管理員上架的商品無需審核，選擇「立即上架」後即可在市場顯示。</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="px-5 py-4 flex gap-2 bg-white" style={{borderTop: '1px solid rgba(6,3,141,0.15)'}}>
            {step === 1 && (
              <Button variant="outline" className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white" onClick={() => { onClose(); reset(); }}>取消</Button>
            )}
            {step > 1 && (
              <Button variant="outline" className="flex-1 border-[#06038D]/30 text-[#06038D] hover:bg-[#06038D]/10 hover:text-[#06038D] bg-white" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}>上一步</Button>
            )}
            {step < 3 && (
              <Button
                className="flex-1 bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
                disabled={step === 1 ? !form.title : (step === 2 ? !form.price : false)}
                onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
              >
                下一步
              </Button>
            )}
            {step === 3 && (
              <Button
                className="flex-1 bg-[#FEDD00] hover:bg-[#FEDD00]/90 text-[#06038D] font-bold"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate({
                  title: form.title,
                  description: form.description || undefined,
                  condition: form.condition as any,
                  price: parseFloat(form.price),
                  quantity: parseInt(form.quantity),
                  status: form.status as any,
                  images: images.length > 0 ? images : undefined,
                  cardId: selectedCard?.id ?? undefined,
                  allowOffers: form.allowOffers,
                  tcgSeries: form.tcgSeries as any,
                })}
              >
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />上架中...</> : "確認上架"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <CardPickerDialog
        open={showCardPicker}
        onOpenChange={setShowCardPicker}
        selectedCardId={selectedCard?.id ?? null}
        onSelect={(card) => {
          setSelectedCard(card);
          if (!form.title.trim()) {
            setForm(f => ({ ...f, title: card.name }));
          }
        }}
      />
    </>
  );
}

function ListingDetailDialog({ listingId, onClose, onUpdated, onViewOrders, onOpenOrder }: { listingId: number | null; onClose: () => void; onUpdated: () => void; onViewOrders?: (listingId: number) => void; onOpenOrder?: (orderId: number) => void }) {
  const [editMode, setEditMode] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", quantity: "", status: "" });
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.marketplace.adminGetListingDetail.useQuery(
    { id: listingId! },
    { enabled: !!listingId }
  );

  const updateMutation = trpc.marketplace.adminUpdateListing.useMutation({
    onSuccess: () => {
      toast.success("已更新商品資料");
      setEditMode(false);
      refetch();
      onUpdated();
      utils.marketplace.adminGetStats.invalidate();
      utils.marketplace.adminGetPendingPayoutCount.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const deleteMutation = trpc.marketplace.batchDeleteListings.useMutation({
    onSuccess: (data) => {
      toast.success(`已永久刪除商品${data.cancelledOrdersCount > 0 ? `，並取消 ${data.cancelledOrdersCount} 個待付款訂單` : ''}`);
      setShowDeleteConfirm(false);
      onClose();
      onUpdated();
      utils.marketplace.adminGetStats.invalidate();
    },
    onError: (e) => { toast.error(parseApiError(e)); setShowDeleteConfirm(false); },
  });

  const listing = data?.listing;
  const sellerProfile = data?.sellerProfile;
  const sellerUser = data?.sellerUser;
  const orderCount = data?.orderCount ?? 0;

  // Order history timeline
  const { data: listingOrdersData, isLoading: ordersLoading } = trpc.marketplace.adminGetListingOrders.useQuery(
    { listingId: listingId!, limit: 8 },
    { enabled: !!listingId && !editMode }
  );
  const listingOrders = listingOrdersData ?? [];

  const images: string[] = (() => {
    try { return listing?.images ? JSON.parse(listing.images) : []; } catch { return []; }
  })();

  const handleEditOpen = () => {
    if (!listing) return;
    setEditForm({
      title: listing.title,
      description: listing.description ?? "",
      price: parseFloat(listing.priceHkd as string || "0").toFixed(2),
      quantity: String(listing.quantity),
      status: listing.status,
    });
    setEditMode(true);
  };

  const isPlatformListing = listing?.sellerType === 'platform';

  return (
    <>
    <Dialog open={!!listingId} onOpenChange={() => { onClose(); setEditMode(false); setImgIdx(0); }}>
      <DialogContent className="max-w-2xl h-[92vh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden">
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="bg-[#06038d] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg tracking-wide">
              {editMode ? '編輯商品' : '商品詳情'}
            </h2>
            {listing && (
              <p className="text-[#FEDD00] text-xs font-mono mt-0.5">#BOXIUM-{listing.id}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {listing && (
              <Badge className={listing.sellerType === 'platform'
                ? 'bg-[#FEDD00] text-[#06038d] font-bold border-0'
                : 'bg-white/20 text-white border-white/30'}>
                {listing.sellerType === 'platform' ? '平台商品' : 'C2C 賣家'}
              </Badge>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 bg-white">
            <Loader2 className="w-8 h-8 animate-spin text-[#06038d]" />
          </div>
        ) : listing ? (
          <div className="bg-white flex-1 overflow-y-auto flex flex-col min-h-0">

            {/* ── 強制下架警告橫幅 ─────────────────────── */}
            {(listing as any).adminDelisted && (
              <div className="mx-5 mt-4 rounded-lg bg-red-50 border-2 border-red-400 px-4 py-3 flex items-start gap-2 flex-shrink-0">
                <span className="text-red-600 text-lg flex-shrink-0 leading-tight">🚫</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-red-700 leading-snug">此商品已被管理員強制下架</p>
                  <p className="text-xs text-red-600 mt-1 leading-relaxed whitespace-normal break-words">賣家無法自行重新上架此商品。如需恢復上架，請由管理員手動將狀態改為「上架中」，系統將自動清除強制下架標記。</p>
                </div>
              </div>
            )}

            {/* ── 賣家商品唯讀提示 ─────────────────────── */}
            {!isPlatformListing && (
              <div className="mx-5 mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-start gap-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 leading-relaxed whitespace-normal break-words min-w-0 flex-1">
                  此商品由 <strong>{sellerProfile?.displayName ?? '賣家'}</strong> 上架，Admin 不建議直接編輯賣家商品內容。如需調整，請聯絡賣家或使用狀態管理功能。
                </p>
              </div>
            )}

            <div className="p-5 space-y-4">

              {/* ── 商品圖片 ─────────────────────────── */}
              {images.length > 0 && (
                <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                  <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                    <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />商品圖片
                    </p>
                  </div>
                  <div className="p-3">
                    <div className="relative">
                      <div className="aspect-video max-h-56 w-full rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                        <img src={images[imgIdx]} alt={listing.title} className="w-full h-full object-contain" />
                      </div>
                      {images.length > 1 && (
                        <>
                          <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-[#06038d]/70 hover:bg-[#06038d] text-white rounded-full p-1.5">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#06038d]/70 hover:bg-[#06038d] text-white rounded-full p-1.5">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <div className="flex justify-center gap-1.5 mt-2">
                            {images.map((_, i) => (
                              <button key={i} onClick={() => setImgIdx(i)}
                                className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? 'bg-[#06038d]' : 'bg-gray-300'}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {editMode && isPlatformListing ? (
                /* ── 編輯表單（僅平台商品） ─────────── */
                <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                  <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                    <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Edit className="w-3.5 h-3.5" />編輯商品資料
                    </p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <Label className="text-xs text-gray-600 font-medium">商品名稱</Label>
                      <Input className="mt-1 border-[#06038d]/30 focus:border-[#06038d]" value={editForm.title}
                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 font-medium">商品描述</Label>
                      <Textarea className="mt-1 border-[#06038d]/30 focus:border-[#06038d]" value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-600 font-medium">售價 (HKD)</Label>
                        <Input className="mt-1 border-[#06038d]/30 focus:border-[#06038d]" type="number"
                          value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} min="4" step="0.01" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 font-medium">庫存數量</Label>
                        <Input className="mt-1 border-[#06038d]/30 focus:border-[#06038d]" type="number"
                          value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} min="0" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 font-medium">上架狀態</Label>
                      <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger className="mt-1 border-[#06038d]/30"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">上架中</SelectItem>
                          <SelectItem value="draft">草稿</SelectItem>
                          <SelectItem value="removed">已下架</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── 商品資料（查看模式） ─────────────── */
                <>
                  {/* 基本資訊 */}
                  <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                    <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                      <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />商品資訊
                      </p>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base leading-snug">{listing.title}</h3>
                        {listing.description && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{listing.description}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#06038d]/[0.04] rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">售價</p>
                          <p className="font-bold text-[#06038d] text-lg">HKD {parseFloat(listing.priceHkd as string || '0').toFixed(2)}</p>
                        </div>
                        <div className="bg-[#06038d]/[0.04] rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">庫存</p>
                          <p className="font-bold text-gray-900 text-lg">{listing.quantity}</p>
                        </div>
                        <div className="bg-[#06038d]/[0.04] rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">品相</p>
                          <Badge className={conditionColor[listing.condition] ?? ''}>{conditionLabel[listing.condition] ?? listing.condition}</Badge>
                        </div>
                        <div
                          className={`bg-[#06038d]/[0.04] rounded-lg p-3 transition-all ${
                            orderCount > 0 && onViewOrders
                              ? 'cursor-pointer hover:bg-[#06038d]/[0.12] hover:ring-1 hover:ring-[#06038d]/30'
                              : ''
                          }`}
                          onClick={() => {
                            if (orderCount > 0 && onViewOrders && listingId) {
                              onViewOrders(listingId);
                              onClose();
                            }
                          }}
                          title={orderCount > 0 ? '點擊查看相關訂單' : undefined}
                        >
                          <p className="text-xs text-gray-500 mb-1">訂單數</p>
                          <div className="flex items-center gap-1.5">
                            <p className={`font-bold text-lg ${
                              orderCount > 0 ? 'text-[#06038d]' : 'text-gray-900'
                            }`}>{orderCount}</p>
                            {orderCount > 0 && onViewOrders && (
                              <ExternalLink className="w-3 h-3 text-[#06038d]/60" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <Badge className={listing.status === 'active' ? 'bg-green-100 text-green-800' : listing.status === 'sold' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                          {listing.status === 'active' ? '上架中' : listing.status === 'draft' ? '草稿' : listing.status === 'sold' ? '已售出' : '已下架'}
                        </Badge>
                        {(listing as any).adminDelisted && (
                          <Badge className="bg-red-600 text-white font-bold border-0">
                            🚫 強制下架
                          </Badge>
                        )}
                        {(listing as any).cardNumber && <Badge variant="outline" className="font-mono text-xs border-[#06038d]/30 text-[#06038d]">#{(listing as any).cardNumber}</Badge>}
                        {listing.allowOffers && <Badge variant="outline" className="text-xs border-green-300 text-green-700">接受出價</Badge>}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>建立時間：{new Date(listing.createdAt).toLocaleString('zh-HK')}</span>
                        </div>
                        {listing.listedAt && (
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3" />
                            <span>正式上架：{new Date(listing.listedAt).toLocaleString('zh-HK')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 賣家資訊（C2C 商品） */}
                  {!isPlatformListing && (
                    <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                      <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                        <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <User2 className="w-3.5 h-3.5" />賣家資訊
                        </p>
                      </div>
                      <div className="p-4">
                        {sellerProfile ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              {sellerProfile.avatarUrl
                                ? <img src={sellerProfile.avatarUrl} className="w-10 h-10 rounded-full object-cover border-2 border-[#06038d]/20" alt="" />
                                : <div className="w-10 h-10 rounded-full bg-[#06038d]/10 flex items-center justify-center"><User2 className="w-5 h-5 text-[#06038d]" /></div>
                              }
                              <div>
                                <p className="font-semibold text-gray-900">{sellerProfile.displayName}</p>
                                {sellerUser && <p className="text-xs text-gray-500">{sellerUser.email}</p>}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-[#06038d]/[0.04] rounded-lg p-2">
                                <p className="text-xs text-gray-500">總銷售</p>
                                <p className="font-bold text-[#06038d]">{sellerProfile.totalSales}</p>
                              </div>
                              <div className="bg-[#06038d]/[0.04] rounded-lg p-2">
                                <p className="text-xs text-gray-500">評分</p>
                                <p className="font-bold text-[#06038d]">{sellerProfile.avgRating ?? 'N/A'}</p>
                              </div>
                              <div className="bg-[#06038d]/[0.04] rounded-lg p-2">
                                <p className="text-xs text-gray-500">評價數</p>
                                <p className="font-bold text-[#06038d]">{sellerProfile.ratingCount}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">賣家資料不可用</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 狀態管理（賣家商品也可以調整狀態） */}
                  <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                    <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                      <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider">狀態管理</p>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {['active', 'draft', 'removed'].map(s => (
                          <Button key={s} size="sm"
                            variant={listing.status === s ? 'default' : 'outline'}
                            className={listing.status === s
                              ? ('bg-[#06038d] text-white')
                              : ('border-[#06038d]/30 text-[#06038d] hover:bg-[#06038d]/10')}
                            disabled={listing.status === s || updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: listingId!, status: s as any })}>
                            {s === 'active' ? '上架中' : s === 'draft' ? '草稿' : '已下架'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 拒絕原因 */}
                  {listing.rejectedReason && (
                    <div className="rounded-lg border border-red-200 overflow-hidden">
                      <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                        <p className="text-red-700 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />拒絕原因
                        </p>
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-red-700">{listing.rejectedReason}</p>
                      </div>
                    </div>
                  )}

                  {/* 訂單歷史時間軸 */}
                  {!editMode && (
                    <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                      <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15 flex items-center justify-between">
                        <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />訂單歷史
                        </p>
                        {orderCount > 0 && onViewOrders && (
                          <button
                            className="text-xs text-[#06038d] hover:underline flex items-center gap-1"
                            onClick={() => { onViewOrders(listingId!); onClose(); }}
                          >
                            查看全部 ({orderCount}) <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="p-4">
                        {ordersLoading ? (
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />載入中...
                          </div>
                        ) : listingOrders.length === 0 ? (
                          <p className="text-sm text-gray-400">此商品尚無訂單記錄。</p>
                        ) : (
                          <div className="space-y-0">
                            {listingOrders.map((order: any, idx: number) => {
                              const statusColors: Record<string, string> = {
                                processing: 'bg-yellow-400',
                                shipped: 'bg-blue-400',
                                delivered: 'bg-indigo-400',
                                completed: 'bg-emerald-500',
                                cancelled: 'bg-gray-400',
                                disputed: 'bg-red-400',
                                pending_payment: 'bg-orange-400',
                                payment_received: 'bg-teal-400',
                              };
                              const statusLabels: Record<string, string> = {
                                processing: '處理中', shipped: '已出貨', delivered: '已送達',
                                completed: '已完成', cancelled: '已取消', disputed: '爭議中',
                                pending_payment: '待付款', payment_received: '已付款',
                              };
                              const dot = statusColors[order.orderStatus] ?? 'bg-gray-400';
                              const isLast = idx === listingOrders.length - 1;
                              return (
                                <div key={order.id} className="flex gap-3">
                                  {/* Timeline line */}
                                  <div className="flex flex-col items-center">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${dot}`} />
                                    {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
                                  </div>
                                  {/* Content */}
                                  <div className={`pb-3 flex-1 ${isLast ? '' : ''}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-mono text-gray-500">{order.orderNo}</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full text-white font-medium ${dot}`}>
                                          {statusLabels[order.orderStatus] ?? order.orderStatus}
                                        </span>
                                        {onOpenOrder && (
                                          <button
                                            className="p-0.5 rounded hover:bg-[#06038d]/10 text-[#06038d]/60 hover:text-[#06038d] transition-colors"
                                            title="開啟訂單詳情"
                                            onClick={() => onOpenOrder(order.id)}
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-gray-600">
                                        {order.buyerName ?? order.buyerEmail ?? '買家不明'}
                                      </span>
                                      <span className="text-xs text-gray-400">·</span>
                                      <span className="text-xs font-semibold text-[#06038d]">
                                        HKD {parseFloat(order.subtotalHkd || '0').toFixed(0)}
                                      </span>
                                      <span className="text-xs text-gray-400 ml-auto">
                                        {new Date(order.createdAt).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* ── Footer ──────────────────────────────────────────── */}
            <div className="px-5 pb-5 pt-3 flex justify-end gap-3 flex-shrink-0 border-t border-gray-100 bg-white mt-auto">
              {editMode ? (
                <>
                  <Button variant="outline" className="border-[#06038d]/30 text-[#06038d]" onClick={() => setEditMode(false)}>取消</Button>
                  <Button
                    className="bg-[#06038d] hover:bg-[#0804b8] text-white"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({
                      id: listingId!,
                      title: editForm.title || undefined,
                      description: editForm.description || undefined,
                      price: parseFloat(editForm.price) || undefined,
                      quantity: parseInt(editForm.quantity) ?? undefined,
                      status: editForm.status as any || undefined,
                    })}>
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    儲存變更
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="border-[#06038d]/30 text-[#06038d]" onClick={onClose}>關閉</Button>
                  {orderCount > 0 && onViewOrders && (
                    <Button variant="outline" className="border-[#06038d]/30 text-[#06038d] hover:bg-[#06038d]/10"
                      onClick={() => { onViewOrders(listingId!); onClose(); }}>
                      <ShoppingBag className="w-4 h-4 mr-2" />查看訂單 ({orderCount})
                    </Button>
                  )}
                  {listing.status !== 'sold' && (
                    <>
                      <Button variant="outline" className="border-red-400 text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
                        <Trash2 className="w-4 h-4 mr-2" />刪除
                      </Button>
                      <Button className="bg-[#06038d] hover:bg-[#0804b8] text-white" onClick={handleEditOpen}>
                        <Edit className="w-4 h-4 mr-2" />編輯商品
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    {/* Delete Confirmation Dialog */}

    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />確認刪除商品
          </DialogTitle>
          <DialogDescription>
            您即將永久刪除以下 <strong>1 件</strong> 商品，此操作不可復原：
          </DialogDescription>
        </DialogHeader>
        {listing && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p className="font-semibold text-gray-800">{listing.title}</p>
            <p className="text-gray-500 text-xs mt-1">#BOXIUM-{listing.id} · HKD {parseFloat(listing.priceHkd as string).toFixed(2)} · {listing.status === 'active' ? '上架中' : listing.status === 'removed' ? '已下架' : listing.status}</p>
          </div>
        )}
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">注意事項</p>
          <p>• 商品將從資料庫永久刪除</p>
          <p>• 如有待付款訂單，將自動更新為已取消</p>
          <p>• 已售出商品不會被刪除</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => listingId && deleteMutation.mutate({ ids: [listingId] })}
          >
            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
            確認刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ListingsTab({ onViewOrders }: { onViewOrders?: (listingId: number) => void }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchRejectDialog, setShowBatchRejectDialog] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState("");
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const utils = trpc.useUtils();
  const invalidateStats = () => {
    utils.marketplace.adminGetStats.invalidate();
    utils.marketplace.adminGetPendingPayoutCount.invalidate();
  };
  const { data, isLoading, refetch } = trpc.marketplace.adminGetListings.useQuery({
    page, pageSize: 20,
    status: statusFilter === "all" || statusFilter === "anomalous" ? undefined : statusFilter === "admin_delisted" ? "removed" : statusFilter,
    tcgSeries: seriesFilter === "all" ? undefined : seriesFilter as any,
  }, { enabled: statusFilter !== 'anomalous' });
  const { data: anomalousData, isLoading: anomalousLoading } = trpc.marketplace.adminGetAnomalousListings.useQuery(
    { page, pageSize: 20 },
    { enabled: statusFilter === 'anomalous' }
  );
  const filteredListings = statusFilter === "admin_delisted"
    ? (data?.listings ?? []).filter((l: any) => l.adminDelisted)
    : statusFilter === 'anomalous'
    ? (anomalousData?.listings ?? [])
    : (data?.listings ?? []);
  const updateMutation = trpc.marketplace.adminUpdateListing.useMutation({
    onSuccess: () => { toast.success("已更新"); refetch(); invalidateStats(); },
    onError: (e) => toast.error(parseApiError(e))
  });
  const batchUpdateMutation = trpc.marketplace.adminBatchUpdateListingStatus.useMutation({
    onSuccess: (res) => {
      toast.success(`已批量更新 ${res.updated} 個商品${res.notified > 0 ? `，已通知 ${res.notified} 位賣家` : ''}`);
      setSelectedIds(new Set());
      refetch();
      invalidateStats();
    },
    onError: (e) => toast.error(parseApiError(e))
  });
  const batchDeleteMutation = trpc.marketplace.batchDeleteListings.useMutation({
    onSuccess: (data) => {
      toast.success(`已永久刪除 ${selectedIds.size} 個商品${data.cancelledOrdersCount > 0 ? `，並取消 ${data.cancelledOrdersCount} 個待付款訂單` : ''}`);
      setSelectedIds(new Set());
      setShowBatchDeleteDialog(false);
      refetch();
      invalidateStats();
    },
    onError: (e) => { toast.error(parseApiError(e)); setShowBatchDeleteDialog(false); }
  });
  const listings = filteredListings;
  const total = statusFilter === 'anomalous' ? (anomalousData?.total ?? 0) : (data?.total ?? 0);
  const isLoadingCombined = statusFilter === 'anomalous' ? anomalousLoading : isLoading;
  const allIds = listings.map((l: any) => l.id);
  const allSelected = allIds.length > 0 && allIds.every((id: number) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };
  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleExportListingsCSV = () => {
    const selected = listings.filter((l: any) => selectedIds.has(l.id));
    if (selected.length === 0) return;
    const headers = ['ID', '標題', '狀態', '品相', '售價(HKD)', '庫存', '賣家類型', '上架日期'];
    const rows = selected.map((l: any) => [
      l.id,
      `"${(l.title ?? '').replace(/"/g, '""')}"`,
      l.status,
      l.condition ?? '',
      parseFloat(l.priceHkd || '0').toFixed(2),
      l.quantity ?? 0,
      l.sellerType === 'platform' ? '平台' : 'C2C',
      l.createdAt ? new Date(l.createdAt).toLocaleDateString('zh-HK') : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `listings-export-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`已匯出 ${selected.length} 個商品`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {/* Filter tabs - horizontally scrollable on tablet to prevent overflow */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0" style={{scrollbarWidth:'none', msOverflowStyle:'none'}}>
          {["all", "active", "draft", "sold", "removed", "admin_delisted", "anomalous"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              onClick={() => { setStatusFilter(s); setPage(1); setSelectedIds(new Set()); }}
              className={`flex-shrink-0 text-xs h-8 px-2.5 ${statusFilter === s
                ? (s === 'admin_delisted' ? 'bg-red-600 text-white' : s === 'anomalous' ? 'bg-orange-600 text-white' : 'bg-[#06038d] text-white')
                : (s === 'admin_delisted' ? 'text-red-700 bg-red-50 border-red-300' : s === 'anomalous' ? 'text-orange-700 bg-orange-50 border-orange-300' : 'text-gray-700 bg-white')}`}>
              {s === "all" ? "全部" : s === "active" ? "上架中" : s === "draft" ? "草稿" : s === "sold" ? "已售出" : s === "admin_delisted" ? "🚫強制下架" : s === "anomalous" ? "⚠️異常" : "已下架"}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#06038d] hover:bg-[#0804b8] text-white flex-shrink-0 text-xs h-8 px-3">
          <Plus className="w-3.5 h-3.5 mr-1" /><span className="hidden md:inline">新增平台商品</span><span className="md:hidden">新增</span>
        </Button>
      </div>
      {/* TCG Series Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">TCG 系列：</span>
        {[
          { value: 'all', label: '全部', logo: null },
          { value: 'pokemon', label: 'Pokémon', logo: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif' },
          { value: 'onepiece', label: 'One Piece', logo: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif' },
          { value: 'yugioh', label: 'Yu-Gi-Oh!', logo: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp' },
        ].map(({ value, label, logo }) => (
          <button
            key={value}
            onClick={() => { setSeriesFilter(value); setPage(1); setSelectedIds(new Set()); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              seriesFilter === value
                ? 'bg-[#06038d] text-white border-[#06038d]'
                : 'bg-white text-gray-700 border-gray-200 hover:border-[#06038d]/40'
            }`}
          >
            {logo && <img src={logo} alt={label} className="h-6 object-contain" />}
            {label}
          </button>
        ))}
        {seriesFilter !== 'all' && (
          <span className="text-xs text-gray-400 ml-1">共 {total} 件</span>
        )}
      </div>
      {/* Batch toolbar — only shown when items are selected */}
      {someSelected ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#06038d] rounded-xl text-white flex-wrap">
          {/* Left: select-all checkbox + count */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-3.5 h-3.5 rounded border-white/50 flex-shrink-0 cursor-pointer" />
            <span className="text-sm font-semibold">已選 {selectedIds.size} 個商品</span>
          </div>
          {/* Right: action buttons */}
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <select
              className="text-xs rounded px-2 py-1.5 bg-white/15 border border-white/30 text-white cursor-pointer"
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                batchUpdateMutation.mutate({ ids: Array.from(selectedIds), status: val as any });
                e.target.value = '';
              }}
              disabled={batchUpdateMutation.isPending}
            >
              <option value="" disabled className="text-gray-800">更改狀態為...</option>
              <option value="active" className="text-gray-800">✅ 上架中</option>
              <option value="draft" className="text-gray-800">📝 草稿</option>
              <option value="removed" className="text-gray-800">❌ 下架</option>
            </select>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              disabled={batchUpdateMutation.isPending}
              onClick={() => batchUpdateMutation.mutate({ ids: Array.from(selectedIds), status: 'active' })}>
              <CheckCircle className="w-3 h-3" />重新上架
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              disabled={batchUpdateMutation.isPending}
              onClick={() => { setShowBatchRejectDialog(true); setBatchRejectReason(''); }}>
              <X className="w-3 h-3" />下架
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              disabled={batchDeleteMutation.isPending}
              onClick={() => setShowBatchDeleteDialog(true)}>
              <Trash2 className="w-3 h-3" />刪除商品
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 transition-colors"
              onClick={handleExportListingsCSV}>
              <Download className="w-3 h-3" />匯出 CSV
            </button>
            <button className="text-xs text-white/70 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => setSelectedIds(new Set())}>
              取消
            </button>
          </div>
        </div>
      ) : (
        /* Select-all row when nothing selected */
        listings.length > 0 && !isLoadingCombined ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-3.5 h-3.5 rounded border-gray-300 flex-shrink-0 cursor-pointer" />
            <span className="text-xs text-gray-600 font-medium">
              全選本頁 ({listings.length} 個)
            </span>
            <span className="text-xs text-gray-400 ml-auto">共 {total} 件</span>
          </div>
        ) : null
      )}
      {isLoadingCombined ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#06038d] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="text-base font-medium">暫無商品</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
          {/* Table Header */}
          <div className="hidden md:grid bg-gray-50 border-b border-gray-200 px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
            style={{gridTemplateColumns: '32px 52px 1fr 100px 60px 80px 80px 80px 140px'}}>
            <div className="flex items-center">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded border-gray-300" />
            </div>
            <div></div>
            <div>商品名稱</div>
            <div className="text-right">售價</div>
            <div className="text-center">庫存</div>
            <div className="text-center">品相</div>
            <div className="text-center">類型</div>
            <div className="text-center">狀態</div>
            <div className="text-right">操作</div>
          </div>
          {/* Table Rows */}
          <div className="divide-y divide-gray-100">
          {listings.map((listing: any) => {
            let thumbUrl: string | null = null;
            try {
              const imgs = typeof listing.images === 'string' ? JSON.parse(listing.images) : listing.images;
              if (Array.isArray(imgs) && imgs.length > 0) thumbUrl = imgs[0];
            } catch {}
            const isSelected = selectedIds.has(listing.id);
            const statusInfo = (listing as any).adminDelisted
              ? { label: '強制下架', cls: 'bg-red-100 text-red-700' }
              : listing.status === 'active' ? { label: '上架中', cls: 'bg-green-100 text-green-700' }
              : listing.status === 'sold' ? { label: '已售出', cls: 'bg-blue-100 text-blue-700' }
              : listing.status === 'draft' ? { label: '草稿', cls: 'bg-yellow-100 text-yellow-700' }
              : { label: '已下架', cls: 'bg-gray-100 text-gray-500' };
            return (
            <div key={listing.id}
              className={`group flex md:grid items-center px-3 py-2.5 hover:bg-blue-50/30 transition-colors gap-2 md:gap-0 ${
                isSelected ? 'bg-[#06038d]/5 border-l-2 border-l-[#06038d]' : ''
              }`}
              style={{gridTemplateColumns: '32px 52px 1fr 100px 60px 80px 80px 80px 140px'}}>
              {/* Checkbox */}
              <div className="flex items-center flex-shrink-0">
                <input type="checkbox" checked={isSelected} onChange={() => toggleOne(listing.id)}
                  onClick={e => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded border-gray-300" />
              </div>
              {/* Thumbnail */}
              <div className="flex items-center flex-shrink-0">
                {thumbUrl ? (
                  <img src={thumbUrl} alt="" className="w-9 h-11 object-cover rounded border border-gray-200" />
                ) : (
                  <div className="w-9 h-11 rounded border border-gray-200 bg-gray-100 flex items-center justify-center">
                    <Package className="w-4 h-4 text-gray-300" />
                  </div>
                )}
              </div>
              {/* Title + meta */}
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{listing.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] font-mono text-[#06038d]/60">#BOXIUM-{listing.id}</span>
                  {listing.sellerDisplayName && (
                    <span className="text-[11px] text-gray-400 truncate">· {listing.sellerDisplayName}</span>
                  )}
                  <span className="text-[10px] text-gray-400">{new Date(listing.createdAt).toLocaleDateString('zh-HK')}</span>
                </div>
                {/* Mobile-only inline info */}
                <div className="flex items-center gap-1.5 mt-1 md:hidden flex-wrap">
                  <span className="text-xs font-bold text-[#06038d]">HKD {parseFloat(listing.priceHkd as string || '0').toFixed(0)}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusInfo.cls}`}>{statusInfo.label}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${conditionColor[listing.condition] ?? 'bg-gray-100 text-gray-600'}`}>{conditionLabel[listing.condition] ?? listing.condition ?? '-'}</span>
                </div>
              </div>
              {/* Price - desktop only */}
              <div className="hidden md:flex justify-end">
                <span className="text-sm font-bold text-[#06038d]">HKD {parseFloat(listing.priceHkd as string || '0').toFixed(0)}</span>
              </div>
              {/* Qty - desktop only */}
              <div className="hidden md:flex justify-center">
                <span className={`text-sm font-semibold ${
                  (listing.quantity ?? 0) === 0 ? 'text-red-500' :
                  (listing.quantity ?? 0) <= 2 ? 'text-orange-500' : 'text-gray-700'
                }`}>{listing.quantity ?? 0}</span>
              </div>
              {/* Condition - desktop only */}
              <div className="hidden md:flex justify-center">
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                  conditionColor[listing.condition] ?? 'bg-gray-100 text-gray-600'
                }`}>{conditionLabel[listing.condition] ?? listing.condition ?? '-'}</span>
              </div>
              {/* Seller Type - desktop only */}
              <div className="hidden md:flex justify-center">
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                  listing.sellerType === 'platform' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}>{listing.sellerType === 'platform' ? '官方' : 'C2C'}</span>
              </div>
              {/* Status - desktop only */}
              <div className="hidden md:flex justify-center">
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${statusInfo.cls}`}>
                  {statusInfo.label}
                </span>
              </div>
              {/* Actions */}
              <div className="flex items-center justify-end gap-1 flex-shrink-0">
                <button
                  onClick={() => setSelectedListingId(listing.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#06038d] bg-[#06038d]/8 hover:bg-[#06038d]/15 rounded-md transition-colors whitespace-nowrap"
                  title="查看/編輯">
                  <Eye className="w-3 h-3" />{listing.status === 'sold' ? '查看' : '編輯'}
                </button>
                {listing.status === 'active' && !((listing as any).adminDelisted) && (
                  <button
                    onClick={() => updateMutation.mutate({ id: listing.id, status: 'removed' })}
                    className="hidden md:flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap"
                    title="下架">
                    <XCircle className="w-3 h-3" />下架
                  </button>
                )}
                {(listing.status === 'removed' || (listing as any).adminDelisted) && (
                  <button
                    onClick={() => updateMutation.mutate({ id: listing.id, status: 'active' })}
                    className="hidden md:flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors whitespace-nowrap"
                    title="重新上架">
                    <CheckCircle className="w-3 h-3" />上架
                  </button>
                )}
              </div>
            </div>
            );
          })}
          </div>
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" className="text-gray-700 bg-white" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="flex items-center text-sm text-gray-600">第 {page} 頁 / 共 {Math.ceil(total / 20)} 頁</span>
          <Button variant="outline" className="text-gray-700 bg-white" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}
      <Dialog open={rejectDialogId !== null} onOpenChange={() => setRejectDialogId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>強制下架商品</DialogTitle></DialogHeader>
          <Label className="text-sm">下架原因（將通知賣家）</Label>
          <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="請輸入具體原因，如：圖片不清晰、描述不符實際等..." rows={3} />
          <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogId(null)}>取消</Button>
            <Button variant="destructive" disabled={updateMutation.isPending}
              onClick={() => { if (rejectDialogId) { updateMutation.mutate({ id: rejectDialogId, status: "removed", delistReason: rejectReason || undefined }); setRejectDialogId(null); } }}>
              確認強制下架
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Batch delist confirm dialog */}
      <Dialog open={showBatchRejectDialog} onOpenChange={setShowBatchRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#06038d]">批量下架確認</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">確定要下架已選的 <strong>{selectedIds.size}</strong> 個商品嗎？</p>
          <div className="space-y-2">
            <Label className="text-sm">下架原因（選填，將通知賣家）</Label>
            <Textarea value={batchRejectReason} onChange={e => setBatchRejectReason(e.target.value)}
              placeholder="請輸入下架原因..." rows={3} className="text-gray-900" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-gray-700" onClick={() => setShowBatchRejectDialog(false)}>取消</Button>
            <Button variant="destructive" disabled={batchUpdateMutation.isPending}
              onClick={() => {
                batchUpdateMutation.mutate({
                  ids: Array.from(selectedIds),
                  status: 'removed',
                  delistReason: batchRejectReason || undefined
                });
                setShowBatchRejectDialog(false);
              }}>
              {batchUpdateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              確認批量下架
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Batch delete confirm dialog */}
      <Dialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />批量刪除商品
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-700">您即將永久刪除已選的 <strong className="text-red-600">{selectedIds.size}</strong> 個商品，此操作不可復原。</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-xs text-red-700 font-semibold">刪除後將發生：</p>
              <p className="text-xs text-red-600">• 商品將從資料庫永久刪除</p>
              <p className="text-xs text-red-600">• 相關待付款訂單將被自動取消</p>
              <p className="text-xs text-red-600">• 已售出的商品不會被刪除</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-gray-700" onClick={() => setShowBatchDeleteDialog(false)}>取消</Button>
            <Button variant="destructive" disabled={batchDeleteMutation.isPending}
              onClick={() => batchDeleteMutation.mutate({ ids: Array.from(selectedIds) })}>
              {batchDeleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              確認刪除 {selectedIds.size} 個商品
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateListingDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={refetch} />
      <ListingDetailDialog
        listingId={selectedListingId}
        onClose={() => setSelectedListingId(null)}
        onUpdated={refetch}
        onViewOrders={onViewOrders}
        onOpenOrder={(orderId) => {
          // Switch to orders tab with the specific order
          toast.info(`請切換到訂單管理查看訂單 #${orderId}`);
        }}
      />
    </div>
  );
}

function exportToCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    }).join(','))
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function OrdersTab({ listingFilter, onClearListingFilter, onViewOrders }: { listingFilter?: number | null; onClearListingFilter?: () => void; onViewOrders?: (listingId: number) => void }) {
  const utils = trpc.useUtils();
  const invalidateStats = () => {
    utils.marketplace.adminGetStats.invalidate();
    utils.marketplace.adminGetPendingPayoutCount.invalidate();
  };
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sellerTypeFilter, setSellerTypeFilter] = useState<'all' | 'platform' | 'seller'>('all');
  const [proofStatusFilter, setProofStatusFilter] = useState<'all' | 'pending_review' | 'rejected'>('all');
  const [shippingMethodFilter, setShippingMethodFilter] = useState<'all' | 'sf_express' | 'hk_post'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [viewListingId, setViewListingId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingMethod, setShippingMethod] = useState("sf_express");
  const [adminShippingProofLightbox, setAdminShippingProofLightbox] = useState(false);
  // Date range filter
  const [datePreset, setDatePreset] = useState<"all" | "this_month" | "last_month" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Compute date range from preset
  const getDateRange = () => {
    const now = new Date();
    if (datePreset === "this_month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
    } else if (datePreset === "last_month") {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
    } else if (datePreset === "custom") {
      return { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
    }
    return { dateFrom: undefined, dateTo: undefined };
  };
  const { dateFrom: qDateFrom, dateTo: qDateTo } = getDateRange();

  const { data, isLoading, refetch } = trpc.marketplace.adminGetOrders.useQuery({
    page, pageSize: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    sellerType: sellerTypeFilter,
    dateFrom: qDateFrom,
    dateTo: qDateTo,
    listingId: listingFilter ?? undefined,
    proofStatus: proofStatusFilter === 'all' ? undefined : proofStatusFilter,
    shippingMethod: shippingMethodFilter === 'all' ? undefined : shippingMethodFilter,
  });
  const updateStatusMutation = trpc.marketplace.adminUpdateOrderStatus.useMutation({
    onSuccess: () => { toast.success("訂單狀態已更新"); refetch(); setSelectedOrder(null); setTrackingNumber(""); invalidateStats(); },
    onError: (e) => toast.error(parseApiError(e))
  });
  const saveNoteMutation = trpc.marketplace.adminSaveOrderNote.useMutation({
    onSuccess: () => { toast.success("備注已儲存"); refetch(); },
    onError: (e) => toast.error(parseApiError(e))
  });

  // Send message to buyer
  const [showSendMessageDialog, setShowSendMessageDialog] = useState(false);
  const [sendMessageSubject, setSendMessageSubject] = useState('');
  const [sendMessageBody, setSendMessageBody] = useState('');
  const sendMessageMutation = trpc.marketplace.adminSendBuyerMessage.useMutation({
    onSuccess: () => { toast.success('訊息已發送給買家'); setShowSendMessageDialog(false); setSendMessageSubject(''); setSendMessageBody(''); },
    onError: (e) => toast.error(parseApiError(e))
  });

  // Order status history
  const orderHistoryQuery = trpc.marketplace.adminGetOrderHistory.useQuery(
    { orderId: selectedOrder?.id ?? 0 },
    { enabled: !!selectedOrder?.id }
  );
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const addOrderNoteMutation = trpc.marketplace.adminAddOrderNote.useMutation({
    onSuccess: () => { toast.success('備注已新增'); setAdminNoteInput(''); orderHistoryQuery.refetch(); },
    onError: (e) => toast.error(parseApiError(e))
  });

  // Order messages (sent to buyer)
  const orderMessagesQuery = trpc.marketplace.adminGetOrderMessages.useQuery(
    { orderId: selectedOrder?.id ?? 0 },
    { enabled: !!selectedOrder?.id }
  );

  const { data: statsData } = trpc.marketplace.adminGetStats.useQuery(undefined, { refetchInterval: 30000 });
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const filteredOrders = searchQuery.trim()
    ? orders.filter((o: any) =>
        o.orderNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.listingTitle?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : orders;

  // Batch selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const toggleOrderSelect = (id: number) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every((o: any) => selectedOrderIds.has(o.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds(prev => {
        const next = new Set(prev);
        filteredOrders.forEach((o: any) => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedOrderIds(prev => {
        const next = new Set(prev);
        filteredOrders.forEach((o: any) => next.add(o.id));
        return next;
      });
    }
  };

  const handleExportSelectedCSV = () => {
    const selected = filteredOrders.filter((o: any) => selectedOrderIds.has(o.id));
    if (!selected.length) { toast.error('請先勾選訂單'); return; }
    const rows = selected.map((o: any) => ({
      '訂單號': o.orderNo,
      '商品': o.listingTitle,
      '狀態': orderStatusLabel[o.orderStatus] ?? o.orderStatus,
      '付款方式': o.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK',
      '金額 (HKD)': parseFloat(o.subtotalHkd || '0').toFixed(2),
      '手續費 (HKD)': parseFloat(o.platformFeeHkd || '0').toFixed(2),
      '賣家應收 (HKD)': parseFloat(o.sellerReceivableHkd || '0').toFixed(2),
      '訂單日期': new Date(o.createdAt).toLocaleDateString('zh-HK'),
      '送貨方式': o.shippingMethod === 'sf_express' ? '順豐速運' : o.shippingMethod === 'hk_post' ? '香港郵政' : (o.shippingMethod ?? ''),
      '追蹤號': o.trackingNumber ?? '',
      '收件人': o.shippingName ?? '',
      '收件電話': o.shippingPhone ?? '',
    }));
    exportToCSV(rows, `選定訂單_${new Date().toISOString().slice(0,10)}.csv`);
  };

  // Batch shipping dialog state
  const [showBatchShippingDialog, setShowBatchShippingDialog] = useState(false);
  const [batchTrackingNumber, setBatchTrackingNumber] = useState('');
  const [batchShippingMethod, setBatchShippingMethod] = useState('sf_express');
  const [batchShippingMode, setBatchShippingMode] = useState<'unified' | 'individual'>('unified');
  const [individualTrackingMap, setIndividualTrackingMap] = useState<Record<number, string>>({});
  const batchUpdateShippingMutation = trpc.marketplace.adminBatchUpdateShipping.useMutation({
    onSuccess: (data) => {
      toast.success(`批量出貨完成：${data.successCount} 筆成功${data.failCount > 0 ? `，${data.failCount} 筆失敗` : ''}`);
      refetch();
      setSelectedOrderIds(new Set());
      setShowBatchShippingDialog(false);
      setBatchTrackingNumber('');
      setBatchShippingMode('unified');
      setIndividualTrackingMap({});
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  // Batch payout dialog state
  const [showBatchPayoutDialog, setShowBatchPayoutDialog] = useState(false);
  const [batchPayoutNote, setBatchPayoutNote] = useState('');
  const batchMarkPayoutMutation = trpc.marketplace.adminBatchMarkPayout.useMutation({
    onSuccess: (data) => {
      toast.success(`批量放款完成：${data.successCount} 筆成功${data.failCount > 0 ? `，${data.failCount} 筆失敗（可能訂單非已完成狀態）` : ''}`);
      refetch();
      setSelectedOrderIds(new Set());
      setShowBatchPayoutDialog(false);
      setBatchPayoutNote('');
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  // Batch note dialog state
  const [showBatchNoteDialog, setShowBatchNoteDialog] = useState(false);
  const [batchNoteInput, setBatchNoteInput] = useState('');
  const batchAddNoteMutation = trpc.marketplace.adminBatchAddNote.useMutation({
    onSuccess: (data) => {
      toast.success(`已為 ${data.count} 筆訂單新增備注`);
      setShowBatchNoteDialog(false);
      setBatchNoteInput('');
    },
    onError: (e) => toast.error(parseApiError(e)),
  });
  // Batch approve alipay proof dialog state
  const [showBatchApproveProofDialog, setShowBatchApproveProofDialog] = useState(false);
  const batchApproveProofMutation = trpc.marketplace.adminBatchConfirmAlipayPayment.useMutation({
    onSuccess: (data) => {
      toast.success(`批量截圖核准完成：${data.successCount} 筆成功${data.failCount > 0 ? `，${data.failCount} 筆失敗` : ''}`);
      refetch();
      setSelectedOrderIds(new Set());
      setShowBatchApproveProofDialog(false);
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const handleExportCSV = () => {
    const rows = orders.map((o: any) => ({
      '訂單號': o.orderNo,
      '商品': o.listingTitle,
      '狀態': orderStatusLabel[o.orderStatus] ?? o.orderStatus,
      '付款方式': o.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK',
      '金額 (HKD)': parseFloat(o.subtotalHkd || '0').toFixed(2),
      '手續費 (HKD)': parseFloat(o.platformFeeHkd || '0').toFixed(2),
      '賣家應收 (HKD)': parseFloat(o.sellerReceivableHkd || '0').toFixed(2),
      '訂單日期': new Date(o.createdAt).toLocaleDateString('zh-HK'),
      '送貨方式': o.shippingMethod === 'sf_express' ? '順豐速運' : o.shippingMethod === 'hk_post' ? '香港郵政' : (o.shippingMethod ?? ''),
      '追蹤號': o.trackingNumber ?? '',
      '收件人': o.shippingName ?? '',
      '收件電話': o.shippingPhone ?? '',
    }));
    exportToCSV(rows, `訂單列表_${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Listing filter banner */}
      {listingFilter && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#06038d]/10 border border-[#06038d]/20 rounded-xl">
          <ShoppingBag className="w-4 h-4 text-[#06038d] flex-shrink-0" />
          <span className="text-sm text-[#06038d] font-medium">目前顯示商品 #{listingFilter} 的相關訂單</span>
          <button
            className="ml-auto text-xs text-[#06038d]/70 hover:text-[#06038d] underline"
            onClick={() => { onClearListingFilter?.(); }}
          >
            清除篩選
          </button>
        </div>
      )}
      {/* Row 1: Status filters + seller type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "pending_payment", "payment_received", "processing", "shipped", "completed", "cancelled", "disputed"].map(s => {
          const pendingCount = s === "pending_payment" ? (statsData?.pendingPaymentCount ?? 0) : 0;
          return (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`${statusFilter === s ? "bg-[#06038d] text-white" : "text-gray-700 bg-white"} relative`}>
              {s === "all" ? "全部" : orderStatusLabel[s] ?? s}
              {pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">{pendingCount}</span>
              )}
            </Button>
          );
        })}
      </div>
      {/* Row 1b: Seller type filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 font-medium">訂單類型：</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {([{ value: 'all', label: '全部' }, { value: 'seller', label: '僅 C2C' }, { value: 'platform', label: '僅平台' }] as const).map(opt => (
            <button key={opt.value}
              onClick={() => { setSellerTypeFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                sellerTypeFilter === opt.value ? 'bg-[#06038d] text-white' : 'bg-white text-gray-900 hover:bg-gray-50'
              }`}>{opt.label}</button>
          ))}
        </div>
      </div>
      {/* Row 1d: Shipping Method filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 font-medium">送貨方式：</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {([
            { value: 'all', label: '全部', activeClass: 'bg-[#06038d] text-white' },
            { value: 'sf_express', label: '🚚 順豐', activeClass: 'bg-orange-500 text-white' },
            { value: 'hk_post', label: '📮 香港郵政', activeClass: 'bg-green-600 text-white' },
          ] as const).map(opt => (
            <button key={opt.value}
              onClick={() => { setShippingMethodFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                shippingMethodFilter === opt.value ? opt.activeClass : 'bg-white text-gray-900 hover:bg-gray-50'
              }`}>{opt.label}</button>
          ))}
        </div>
      </div>
      {/* Row 1c: Alipay Proof Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 font-medium">截圖審核：</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {([
            { value: 'all', label: '全部', activeClass: 'bg-[#06038d] text-white' },
            { value: 'pending_review', label: '✅ 待審核', activeClass: 'bg-amber-500 text-white' },
            { value: 'rejected', label: '❌ 已拒絕', activeClass: 'bg-red-500 text-white' },
          ] as const).map(opt => (
            <button key={opt.value}
              onClick={() => { setProofStatusFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                proofStatusFilter === opt.value ? opt.activeClass : 'bg-white text-gray-900 hover:bg-gray-50'
              }`}>{opt.label}</button>
          ))}
        </div>
      </div>
      {/* Row 2: Date range + search + export */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600 font-medium">日期：</span>
          {(["all", "this_month", "last_month", "custom"] as const).map(p => (
            <Button key={p} size="sm" variant={datePreset === p ? "default" : "outline"}
              onClick={() => { setDatePreset(p); setPage(1); }}
              className={datePreset === p ? "bg-[#06038d] text-white" : "text-gray-700 bg-white"}>
              {p === "all" ? "全部" : p === "this_month" ? "本月" : p === "last_month" ? "上月" : "自訂"}
            </Button>
          ))}
          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input type="date" className="h-8 w-36 text-xs" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
              <span className="text-xs text-gray-600">至</span>
              <Input type="date" className="h-8 w-36 text-xs" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <Input
              className="pl-8 h-8 w-48 text-sm bg-white text-gray-900"
              placeholder="搜尋訂單號 / 商品"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button size="sm" variant="outline" className="text-gray-700 bg-white" onClick={handleExportCSV} disabled={orders.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" />匯出全部 CSV
          </Button>
        </div>
      </div>
      {/* Batch selection toolbar */}
      {selectedOrderIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-[#06038d]/10 border border-[#06038d]/20 rounded-xl">
          <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
          <span className="text-sm text-[#06038d] font-medium">已選 {selectedOrderIds.size} 筆訂單</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button size="sm" variant="outline" className="text-gray-700 bg-white border-gray-300"
              onClick={handleExportSelectedCSV}>
              <Download className="w-3.5 h-3.5 mr-1" />匯出 CSV
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowBatchShippingDialog(true)}>
              <Package className="w-3.5 h-3.5 mr-1" />批量更新物流
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowBatchPayoutDialog(true)}>
              <Banknote className="w-3.5 h-3.5 mr-1" />批量標記已放款
            </Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => setShowBatchNoteDialog(true)}>
              <FileText className="w-3.5 h-3.5 mr-1" />批量新增備注
            </Button>
            {proofStatusFilter === 'pending_review' && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowBatchApproveProofDialog(true)}>
                <CheckCircle className="w-3.5 h-3.5 mr-1" />批量核准截圖
              </Button>
            )}
            <button className="text-xs text-[#06038d]/70 hover:text-[#06038d] underline"
              onClick={() => setSelectedOrderIds(new Set())}>
              取消全選
            </button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500"><ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{searchQuery ? '未找到符合的訂單' : '暫無訂單'}</p></div>
      ) : (
        <div className="space-y-3">
          {/* Select all header row */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
            <span className="text-xs text-gray-600 font-medium">
              {isAllSelected ? '取消全選' : '全選本頁'} ({filteredOrders.length} 筆)
            </span>
            {selectedOrderIds.size > 0 && !isAllSelected && (
              <span className="text-xs text-[#06038d] font-semibold ml-auto">已選 {selectedOrderIds.size} 筆</span>
            )}
          </div>
          {filteredOrders.map((order: any) => (
            <div key={order.id} className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
              selectedOrderIds.has(order.id) ? 'border-[#06038d]/50 ring-1 ring-[#06038d]/30' : 'border-gray-200'
            }`}>
              {/* Header bar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#06038d] to-[#1a17a0]">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="checkbox"
                    checked={selectedOrderIds.has(order.id)}
                    onChange={() => toggleOrderSelect(order.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded border-white/50 bg-white/20 flex-shrink-0"
                  />
                  <span className="text-white text-sm font-semibold font-mono">{order.orderNo}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    order.orderStatus === 'completed' ? 'bg-green-200 text-green-900' :
                    order.orderStatus === 'shipped' ? 'bg-blue-200 text-blue-900' :
                    order.orderStatus === 'processing' || order.orderStatus === 'payment_received' ? 'bg-yellow-200 text-yellow-900' :
                    order.orderStatus === 'disputed' ? 'bg-red-200 text-red-900' :
                    order.orderStatus === 'cancelled' ? 'bg-gray-300 text-gray-800' :
                    'bg-white/20 text-white'
                  }`}>{orderStatusLabel[order.orderStatus] ?? order.orderStatus}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    order.paymentMethod === 'stripe' ? 'bg-purple-200 text-purple-900' : 'bg-blue-200 text-blue-900'
                  }`}>{order.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK'}</span>
                  {order.sellerType === 'platform' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">平台商品</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-xs">{new Date(order.createdAt).toLocaleDateString('zh-HK')}</span>
                  <span className="text-yellow-300 text-xs font-semibold">賣家應收：HKD {parseFloat(order.sellerReceivableHkd || order.subtotalHkd || '0').toFixed(2)}</span>
                </div>
              </div>
              {/* Three-column content */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 bg-white">
                {/* Col 1: Product */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">商品資料</p>
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    {(() => {
                      try {
                        const imgs = typeof order.listingImages === 'string'
                          ? JSON.parse(order.listingImages)
                          : order.listingImages;
                        const firstImg = Array.isArray(imgs) ? imgs[0] : null;
                        if (firstImg) return (
                          <img src={firstImg} alt="" className="w-14 h-16 object-cover rounded-md border border-gray-200 flex-shrink-0" />
                        );
                      } catch {}
                      return (
                        <div className="w-14 h-16 rounded-md border border-gray-200 bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-gray-300" />
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{order.listingTitle ?? '商品'}</p>
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                        <p>數量：{order.quantity ?? 1} · 單價： HKD {parseFloat(order.priceHkd || order.subtotalHkd || '0').toFixed(2)}</p>
                        <p>小計： HKD {parseFloat(order.subtotalHkd || '0').toFixed(2)}</p>
                        {order.sellerType === 'platform' ? (
                          <p className="text-blue-600">平台商品免手續費</p>
                        ) : (
                          <p>手續費： HKD {parseFloat(order.platformFeeHkd || '0').toFixed(2)}</p>
                        )}
                        <p className="font-semibold text-[#06038d]">賣家淨收： HKD {parseFloat(order.sellerReceivableHkd || order.subtotalHkd || '0').toFixed(2)}</p>
                        <p className="text-gray-400">付款：{order.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK'}</p>
                        {order.stripePaymentIntentId && <p className="text-gray-400 font-mono text-[10px] truncate">PI: {order.stripePaymentIntentId}</p>}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Col 2: Buyer */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">買家資料</p>
                  <p className="text-sm font-medium text-gray-900">{order.buyerName ?? order.shippingName ?? '不明'}</p>
                  <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                    {order.buyerEmail && <p>{order.buyerEmail}</p>}
                    {order.buyerPhone && <p>{order.buyerPhone}</p>}
                    {order.shippingAddress && (
                      <p className="text-gray-500">收件資料：{(() => {
                        try {
                          const addr = JSON.parse(order.shippingAddress);
                          if (addr && typeof addr === 'object') {
                            const name = addr.name || order.shippingName || '';
                            const phone = addr.phone || order.shippingPhone || '';
                            const address = [addr.address, addr.district, addr.region].filter(Boolean).join(', ');
                            return [name, phone, address].filter(Boolean).join(' · ');
                          }
                          return order.shippingAddress;
                        } catch { return order.shippingAddress; }
                      })()}</p>
                    )}
                    {order.buyerConfirmedAt && (
                      <p className="text-green-700 font-medium">✅ 確認收貨：{new Date(order.buyerConfirmedAt).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </div>
                </div>
                {/* Col 3: Seller + Actions */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">賣家資料</p>
                  <p className="text-sm font-medium text-gray-900">{order.sellerType === 'platform' ? '平台自有商品' : (order.sellerName ?? '不明')}</p>
                  <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                    {order.shippingMethod && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        order.shippingMethod === 'sf_express'
                          ? 'bg-orange-100 text-orange-700 border border-orange-200'
                          : order.shippingMethod === 'hk_post'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {order.shippingMethod === 'sf_express' ? '🚚 順豐' : order.shippingMethod === 'hk_post' ? '📮 香港郵政' : order.shippingMethod === 'pickup' ? '🏠 自取' : order.shippingMethod}
                      </span>
                    )}
                    {order.trackingNumber && <p>追蹤號：{order.trackingNumber}</p>}
                    {order.shippedAt && <p>出貨日：{new Date(order.shippedAt).toLocaleDateString('zh-HK')}</p>}
                  </div>
                  <div className="mt-3">
                    <Button size="sm" variant="outline" className="text-xs w-full sm:w-auto text-gray-700 bg-white"
                      onClick={() => { setSelectedOrder(order); setNote(''); setAdminNote(order.adminNote ?? ''); setTrackingNumber(order.trackingNumber ?? ''); setShippingMethod(order.shippingMethod ?? 'sf_express'); }}>
                      <Edit className="w-3 h-3 mr-1" />管理訂單
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" className="text-gray-700 bg-white" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="flex items-center text-sm text-gray-600">第 {page} 頁 / 共 {Math.ceil(total / 20)} 頁</span>
          <Button variant="outline" className="text-gray-700 bg-white" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl h-[92vh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden">
          {/* Header - LOGO Deep Blue */}
          <div className="bg-[#06038d] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-white font-bold text-lg tracking-wide">訂單管理</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[#FEDD00] text-sm font-mono">{selectedOrder?.orderNo}</p>
                <button
                  className="text-white/60 hover:text-white transition-colors"
                  title="複製訂單號"
                  onClick={() => {
                    if (selectedOrder?.orderNo) {
                      navigator.clipboard.writeText(selectedOrder.orderNo);
                      toast.success('訂單號已複製');
                    }
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {selectedOrder && (
              <Badge className={`${orderStatusColor[selectedOrder.orderStatus] ?? ''} text-xs px-3 py-1`}>
                {orderStatusLabel[selectedOrder.orderStatus]}
              </Badge>
            )}
          </div>

          {selectedOrder && (
            <div className="p-5 space-y-4 bg-white flex-1 overflow-y-auto min-h-0">

                {/* ── 商品資訊 ──────────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15 flex items-center justify-between">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />商品資訊
                  </p>
                  {selectedOrder.listingId && (
                    <button
                      className="flex items-center gap-1 text-xs text-[#06038d]/70 hover:text-[#06038d] transition-colors"
                      onClick={() => {
                        setSelectedOrder(null);
                        setViewListingId(selectedOrder.listingId);
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />查看商品詳情
                    </button>
                  )}
                </div>
                <div className="p-3 flex items-center gap-3">
                  {selectedOrder.listingImages && (() => {
                    try {
                      const imgs = typeof selectedOrder.listingImages === 'string' ? JSON.parse(selectedOrder.listingImages) : selectedOrder.listingImages;
                      const firstImg = Array.isArray(imgs) ? imgs[0] : null;
                      if (firstImg) return <img src={firstImg} alt="商品" className="w-14 h-18 object-cover rounded-md border border-gray-200 flex-shrink-0" style={{height:'4.5rem'}} />;
                    } catch {}
                    return <div className="w-14 h-18 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0" style={{height:'4.5rem'}}><Package className="w-5 h-5 text-gray-400" /></div>;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 line-clamp-2">{selectedOrder.listingTitle || '未知商品'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedOrder.listingId && <span className="text-xs font-mono text-[#06038d]/70">#BOXIUM-{selectedOrder.listingId}</span>}
                      {selectedOrder.listingCondition && <Badge variant="outline" className="text-xs text-gray-800 border-gray-300">{conditionLabel[selectedOrder.listingCondition] ?? selectedOrder.listingCondition}</Badge>}
                      <span className="text-xs text-gray-500">數量：{selectedOrder.quantity ?? 1}</span>
                    </div>
                    <p className="text-[#06038d] font-bold mt-1">HKD {parseFloat(selectedOrder.subtotalHkd || '0').toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* ── 訂單詳情 ─────────────────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />訂單詳情
                  </p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-500">訂單編號</span>
                  <span className="font-mono text-xs text-gray-800">{selectedOrder.orderNo}</span>
                  <span className="text-gray-500">付款方式</span>
                  <span className="flex items-center gap-1 text-gray-800">
                    {selectedOrder.paymentMethod === 'stripe' ? <><CreditCard className="w-3.5 h-3.5 text-blue-600" />Stripe</> : <><Banknote className="w-3.5 h-3.5 text-green-600" />支付寶 HK</>}
                  </span>
                  <span className="text-gray-500">訂單金額</span>
                  <span className="font-semibold text-[#06038d]">HKD {parseFloat(selectedOrder.subtotalHkd || '0').toFixed(2)}</span>
                  <span className="text-gray-500">平台手續費</span>
                  <span className="text-gray-700">HKD {parseFloat(selectedOrder.platformFeeHkd || '0').toFixed(2)} ({(parseFloat(selectedOrder.platformFeeRate || '0.05') * 100).toFixed(0)}%)</span>
                  <span className="text-gray-500">賣家應收</span>
                  <span className="font-semibold text-emerald-700">HKD {parseFloat(selectedOrder.sellerReceivableHkd || '0').toFixed(2)}</span>
                  <span className="text-gray-500">賣家類型</span>
                  <span className="text-gray-800">{selectedOrder.sellerType === 'platform' ? '平台官方' : '一般賣家'}</span>
                  <span className="text-gray-500">下單日期</span>
                  <span className="text-gray-800">{new Date(selectedOrder.createdAt).toLocaleString('zh-HK')}</span>
                  {selectedOrder.buyerConfirmedAt && <><span className="text-gray-500">買家確認</span><span className="text-gray-800">{new Date(selectedOrder.buyerConfirmedAt).toLocaleDateString('zh-HK')}</span></>}
                  <span className="text-gray-500">放款狀態</span>
                  <span className={`font-medium ${selectedOrder.payoutStatus === 'paid' ? 'text-green-600' : selectedOrder.payoutStatus === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                    {selectedOrder.payoutStatus === 'paid' ? '已放款' : selectedOrder.payoutStatus === 'failed' ? '放款失敗' : selectedOrder.payoutStatus === 'completed' ? '已完成' : '待放款'}
                  </span>
                  {selectedOrder.stripeTransferId && <><span className="text-gray-500">Stripe Transfer</span><span className="font-mono text-xs text-gray-800">{selectedOrder.stripeTransferId}</span></>}
                  {selectedOrder.stripeTransferError && <><span className="text-gray-500">轉帳錯誤</span><span className="text-red-600 text-xs">{selectedOrder.stripeTransferError}</span></>}
                  {selectedOrder.manualPayoutAt && <><span className="text-gray-500">手動放款日</span><span className="text-gray-800">{new Date(selectedOrder.manualPayoutAt).toLocaleDateString('zh-HK')}</span></>}
                  {selectedOrder.manualPayoutNote && <><span className="text-gray-500">放款備注</span><span className="text-xs text-gray-800">{selectedOrder.manualPayoutNote}</span></>}
                </div>
              </div>

              {/* ── 買家資料 ─────────────────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <User2 className="w-3.5 h-3.5" />買家資料
                  </p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-500">姓名</span><span className="text-gray-800">{selectedOrder.buyerName || '—'}</span>
                  <span className="text-gray-500">電郵</span><span className="text-xs break-all text-gray-800">{selectedOrder.buyerEmail || '—'}</span>
                  <span className="text-gray-500">電話</span><span className="text-gray-800">{selectedOrder.buyerPhone || '—'}</span>
                </div>
              </div>

              {/* ── 賣家資料 ─────────────────────────── */}
              {selectedOrder.sellerType === 'seller' && (
                <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                  <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                    <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />賣家資料
                    </p>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-gray-500">店舖名稱</span><span className="text-gray-800">{selectedOrder.sellerDisplayName || '—'}</span>
                    <span className="text-gray-500">姓名</span><span className="text-gray-800">{selectedOrder.sellerUserName || '—'}</span>
                    <span className="text-gray-500">電郵</span><span className="text-xs break-all text-gray-800">{selectedOrder.sellerUserEmail || '—'}</span>
                    <span className="text-gray-500">電話</span><span className="text-gray-800">{selectedOrder.sellerUserPhone || '—'}</span>
                    {selectedOrder.sellerStripeConnectId && <><span className="text-gray-500">Stripe Connect</span><span className="font-mono text-xs text-gray-900">{selectedOrder.sellerStripeConnectId}</span></>}
                  </div>
                </div>
              )}

              {/* ── 物流資訊 ─────────────────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />物流 / 收件資訊
                  </p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-500">收件人</span><span className="text-gray-800">{selectedOrder.shippingName || '—'}</span>
                  <span className="text-gray-500">電話</span><span className="text-gray-800">{selectedOrder.shippingPhone || '—'}</span>
                  <span className="text-gray-500">地址</span>
                  <span className="text-gray-800">{selectedOrder.shippingAddress ? (() => {
                    try {
                      const addr = JSON.parse(selectedOrder.shippingAddress);
                      if (addr && typeof addr === 'object') {
                        if (addr.sfStationCode) {
                          return (
                            <span className="inline-flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1">
                                <span>📦</span>
                                <span className="font-semibold text-[#06038D]">順豐自提站</span>
                              </span>
                              {addr.sfStationName && <span className="text-xs text-gray-600">{addr.sfStationName}</span>}
                              <span className="font-mono text-xs font-bold text-[#06038D]">{addr.sfStationCode}</span>
                            </span>
                          );
                        }
                        return [addr.address, addr.district, addr.region].filter(Boolean).join(', ');
                      }
                      return selectedOrder.shippingAddress;
                    } catch { return selectedOrder.shippingAddress; }
                  })() : '—'}</span>
                  <span className="text-gray-500">物流方式</span><span className="text-gray-800">{selectedOrder.shippingMethod || '—'}</span>
                  <span className="text-gray-500">追蹤號碼</span>
                  <span className="font-mono text-xs text-gray-800">{selectedOrder.trackingNumber || '—'}</span>
                  <span className="text-gray-500">出貨日期</span>
                  <span className="text-gray-800">{selectedOrder.shippedAt ? new Date(selectedOrder.shippedAt).toLocaleDateString('zh-HK') : '—'}</span>
                   {selectedOrder.autoCompleteAt && <><span className="text-gray-500">自動完成</span><span className="text-gray-800">{new Date(selectedOrder.autoCompleteAt).toLocaleDateString('zh-HK')}</span></>}
                </div>
              </div>

              {/* ── 出貨憑證（如有） ──────────────────────── */}
              {selectedOrder.shippingImageUrl && (
                <div className="rounded-lg border border-indigo-200 overflow-hidden">
                  <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200">
                    <p className="text-indigo-700 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />出貨憑證
                    </p>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-gray-500">賣家已上傳出貨憑證，可放大查看以核對物流資訊。</p>
                    <button
                      onClick={() => setAdminShippingProofLightbox(true)}
                      className="relative group w-full rounded-lg overflow-hidden border border-indigo-200 hover:border-indigo-400 transition-colors block"
                      title="點擊放大查看出貨憑證"
                    >
                      <img
                        src={selectedOrder.shippingImageUrl}
                        alt="出貨憑證"
                        className="w-full max-h-52 object-contain bg-white"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-800 text-xs font-medium px-3 py-1.5 rounded-full shadow">
                          🔍 點擊放大查看
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
              <ImageLightbox
                src={selectedOrder?.shippingImageUrl ?? ""}
                alt="出貨憑證"
                isOpen={adminShippingProofLightbox}
                onClose={() => setAdminShippingProofLightbox(false)}
              />

              {/* ── 爭議資訊（如有） ───────────────── */}
              {selectedOrder.disputeOpenedAt && (
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                    <p className="text-red-700 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />爭議資訊
                    </p>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-gray-500">開啟時間</span><span className="text-gray-800">{new Date(selectedOrder.disputeOpenedAt).toLocaleDateString('zh-HK')}</span>
                    <span className="text-gray-500">爭議原因</span><span className="col-span-1 text-gray-800">{selectedOrder.disputeReason || '—'}</span>
                    {selectedOrder.disputeResolvedAt && <><span className="text-gray-500">解決時間</span><span className="text-gray-800">{new Date(selectedOrder.disputeResolvedAt).toLocaleDateString('zh-HK')}</span></>}
                    {selectedOrder.disputeResolution && <><span className="text-gray-500">解決方式</span><span className="text-gray-800">{selectedOrder.disputeResolution}</span></>}
                  </div>
                </div>
              )}

              {/* ── 出貨操作（待出貨時顯示） ─────────── */}
              {['processing', 'payment_received', 'paid_held'].includes(selectedOrder.orderStatus) && (
                <div className="rounded-lg border-2 border-[#FEDD00] bg-yellow-50 overflow-hidden">
                  <div className="bg-[#FEDD00] px-4 py-2">
                    <p className="text-[#06038d] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />填寫出貨資料
                    </p>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-600">物流方式</Label>
                        <Select value={shippingMethod} onValueChange={setShippingMethod}>
                          <SelectTrigger className="mt-1 h-8 text-sm border-[#06038d]/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sf_express">順豐</SelectItem>
                            <SelectItem value="hk_post">香港郵政</SelectItem>
                            <SelectItem value="pickup">自取</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">追蹤號碼</Label>
                        <Input className="mt-1 h-8 text-sm border-[#06038d]/30" placeholder="輸入追蹤號碼" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
                      </div>
                    </div>
                    <Button size="sm" className="w-full bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, orderStatus: 'shipped', note, trackingNumber: trackingNumber || undefined, shippingMethod: shippingMethod || undefined })}>
                      {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}確認出貨
                    </Button>
                  </div>
                </div>
              )}

              {/* ── 狀態更新 ─────────────────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider">更新訂單狀態</p>
                </div>
                <div className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {['processing', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'].map(s => (
                      <Button key={s} size="sm"
                        variant={selectedOrder.orderStatus === s ? 'default' : 'outline'}
                        className={selectedOrder.orderStatus === s ? 'bg-[#06038d] text-white' : 'border-[#06038d]/40 text-[#06038d] hover:bg-[#06038d]/10'}
                        disabled={selectedOrder.orderStatus === s || updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, orderStatus: s as any, note, trackingNumber: s === 'shipped' ? (trackingNumber || undefined) : undefined, shippingMethod: s === 'shipped' ? (shippingMethod || undefined) : undefined })}>
                        {orderStatusLabel[s] ?? s}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs text-gray-600">通知備注（發送給買家）</Label>
                    <Input className="mt-1 h-8 text-sm border-[#06038d]/30" placeholder="可選：附加說明文字" value={note} onChange={e => setNote(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── Admin 內部備注 ────────────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />Admin 內部備注
                  </p>
                </div>
                <div className="p-3 space-y-2">
                  <Textarea
                    className="text-sm border-[#06038d]/30 resize-none"
                    placeholder="僅限 Admin 可見的內部備注..."
                    rows={3}
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                  />
                  <Button size="sm"
                    className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                    disabled={saveNoteMutation.isPending}
                    onClick={() => saveNoteMutation.mutate({ orderId: selectedOrder.id, adminNote })}>
                    {saveNoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}儲存備注
                  </Button>
                </div>
              </div>

              {/* ── 狀態變更歷史 ──────────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />狀態變更歷史 &amp; 備注
                  </p>
                </div>
                <div className="p-3 space-y-3">
                  {orderHistoryQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" />載入中...</div>
                  ) : (orderHistoryQuery.data ?? []).length === 0 ? (
                    <p className="text-sm text-gray-400">尚無記錄</p>
                  ) : (
                    <div className="space-y-2">
                      {(orderHistoryQuery.data ?? []).map((h: any) => (
                        <div key={h.id} className="flex items-start gap-2.5">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${h.entryType === 'note' ? 'bg-amber-400' : 'bg-[#06038d]'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {h.entryType === 'note' ? (
                                <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">備注</span>
                              ) : (
                                <span className="text-xs font-medium text-gray-700">{h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus ? `${orderStatusLabel[h.fromStatus] ?? h.fromStatus} → ${orderStatusLabel[h.toStatus] ?? h.toStatus}` : (orderStatusLabel[h.toStatus] ?? h.toStatus)}</span>
                              )}
                              {h.operatorName && <span className="text-xs text-gray-400">by {h.operatorName}</span>}
                            </div>
                            {h.note && <p className="text-xs text-gray-600 mt-0.5">{h.entryType === 'note' ? h.note.replace(/^\[備注\] /, '') : h.note}</p>}
                            <p className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString('zh-HK')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 新增備注輸入區 */}
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-gray-600 mb-1.5">新增 Admin 備注</p>
                    <div className="flex gap-2">
                      <Input
                        className="flex-1 text-sm border-[#06038d]/30 h-8"
                        placeholder="輸入內部備注（不更改訂單狀態）..."
                        value={adminNoteInput}
                        onChange={e => setAdminNoteInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && adminNoteInput.trim() && selectedOrder) { addOrderNoteMutation.mutate({ orderId: selectedOrder.id, note: adminNoteInput.trim() }); } }}
                        maxLength={500}
                      />
                      <Button size="sm" className="h-8 bg-amber-500 hover:bg-amber-600 text-white px-3 flex-shrink-0"
                        disabled={!adminNoteInput.trim() || addOrderNoteMutation.isPending || !selectedOrder}
                        onClick={() => selectedOrder && adminNoteInput.trim() && addOrderNoteMutation.mutate({ orderId: selectedOrder.id, note: adminNoteInput.trim() })}>
                        {addOrderNoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '新增'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

               {/* ── 發送訊息給買家 ──────────────── */}
              <div className="rounded-lg border border-[#06038d]/20 overflow-hidden">
                <div className="bg-[#06038d]/[0.06] px-4 py-2 border-b border-[#06038d]/15">
                  <p className="text-[#06038d] font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />發送訊息給買家
                  </p>
                </div>
                <div className="p-3 space-y-3">
                  <Button size="sm" variant="outline" className="border-[#06038d]/40 text-[#06038d] hover:bg-[#06038d]/10"
                    onClick={() => { setShowSendMessageDialog(true); orderMessagesQuery.refetch(); }}>
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />發送新訊息給買家
                  </Button>
                  {/* 訊息歷史 */}
                  {orderMessagesQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" />載入中...</div>
                  ) : (orderMessagesQuery.data ?? []).length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500">已發送訊息記錄</p>
                      {(orderMessagesQuery.data ?? []).map((msg: any) => (
                        <div key={msg.id} className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-blue-800">{msg.subject}</span>
                            <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString('zh-HK')}</span>
                          </div>
                          {msg.operatorName && <p className="text-xs text-gray-400">by {msg.operatorName}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">尚未發送過訊息</p>
                  )}
                </div>
               </div>

               {/* ── 列印訂單按鈕（三種範本） ───────── */}
              <div className="flex justify-end gap-2 pb-2">
                <Button size="sm" variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-50 print:hidden"
                  onClick={() => {
                    const order = selectedOrder;
                    const printWindow = window.open('', '_blank');
                    if (!printWindow || !order) return;
                    const addr = (() => { try { const a = JSON.parse(order.shippingAddress || '{}'); if (a.sfStationCode) { return `📦 順豐自提站 ${a.sfStationName ? a.sfStationName + ' ' : ''}(${a.sfStationCode})`; } return [a.address, a.district, a.region].filter(Boolean).join(', '); } catch { return order.shippingAddress || '—'; } })();
                    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>訂單 ${order.orderNo}</title><style>body{font-family:sans-serif;padding:24px;font-size:13px;color:#111}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #06038d;padding-bottom:12px;margin-bottom:16px}.logo-box{background:#f5c518;border:2px solid #06038d;border-radius:6px;padding:6px 14px;font-size:20px;font-weight:900;color:#06038d;letter-spacing:2px}.company-info{text-align:right;font-size:11px;color:#555;line-height:1.6}h1{font-size:16px;margin-bottom:4px;color:#06038d}h2{font-size:13px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:16px;color:#06038d}table{width:100%;border-collapse:collapse}td{padding:4px 8px;vertical-align:top}td:first-child{color:#555;width:120px}.footer{margin-top:24px;border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999;text-align:center}@media print{button{display:none}}</style></head><body><div class="header"><div class="logo-box">BOXIUM</div><div class="company-info"><strong>BOXIUM PTCG</strong><br/>www.boxium.asia<br/>香港卡片交易平台</div></div><h1>隨貨單據 / 訂單確認</h1><p style="color:#555;font-size:12px">訂單編號: ${order.orderNo}</p><h2>商品資訊</h2><table><tr><td>商品</td><td>${order.listingTitle || '未知'}</td></tr><tr><td>品相</td><td>${order.listingCondition || '—'}</td></tr><tr><td>數量</td><td>${order.quantity ?? 1}</td></tr><tr><td>金額</td><td>HKD ${parseFloat(order.subtotalHkd || '0').toFixed(2)}</td></tr></table><h2>買家資料</h2><table><tr><td>姓名</td><td>${order.buyerName || '—'}</td></tr><tr><td>電郵</td><td>${order.buyerEmail || '—'}</td></tr><tr><td>電話</td><td>${order.buyerPhone || '—'}</td></tr></table><h2>物流 / 收件資訊</h2><table><tr><td>收件人</td><td>${order.shippingName || '—'}</td></tr><tr><td>電話</td><td>${order.shippingPhone || '—'}</td></tr><tr><td>地址</td><td>${addr}</td></tr><tr><td>物流方式</td><td>${order.shippingMethod || '—'}</td></tr><tr><td>追蹤號碼</td><td>${order.trackingNumber || '—'}</td></tr></table><h2>訂單詳情</h2><table><tr><td>訂單金額</td><td>HKD ${parseFloat(order.subtotalHkd || '0').toFixed(2)}</td></tr><tr><td>平台手續費</td><td>HKD ${parseFloat(order.platformFeeHkd || '0').toFixed(2)}</td></tr><tr><td>賣家應收</td><td>HKD ${parseFloat(order.sellerReceivableHkd || '0').toFixed(2)}</td></tr><tr><td>付款方式</td><td>${order.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK'}</td></tr><tr><td>下單日期</td><td>${new Date(order.createdAt).toLocaleString('zh-HK')}</td></tr></table><script>window.print();window.close();<\/script></body></html>`);
                    printWindow.document.close();
                  }}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />隨貨單
                </Button>
                <Button size="sm" variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-50 print:hidden"
                  onClick={() => {
                    const order = selectedOrder;
                    const printWindow = window.open('', '_blank');
                    if (!printWindow || !order) return;
                    const addr = (() => { try { const a = JSON.parse(order.shippingAddress || '{}'); if (a.sfStationCode) { return `📦 順豐自提站 ${a.sfStationName ? a.sfStationName + ' ' : ''}(${a.sfStationCode})`; } return [a.address, a.district, a.region].filter(Boolean).join(', '); } catch { return order.shippingAddress || '—'; } })();
                    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>出貨標籤 ${order.orderNo}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#fff}@page{size:100mm 150mm;margin:0}.label{width:100mm;height:150mm;padding:8mm;border:1px solid #000;display:flex;flex-direction:column;gap:4mm}.logo-row{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #06038d;padding-bottom:3mm}.logo-box{background:#f5c518;border:2px solid #06038d;border-radius:4px;padding:3px 8px;font-size:14px;font-weight:900;color:#06038d;letter-spacing:1px}.order-no{font-size:9px;color:#555}.section-title{font-size:8px;font-weight:bold;color:#06038d;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:1mm}.info-row{font-size:10px;color:#111;margin-bottom:1mm}.info-label{color:#555;font-size:9px}.barcode-area{border:1px dashed #ccc;padding:3mm;text-align:center;font-family:monospace;font-size:11px;letter-spacing:2px;font-weight:bold}.footer{font-size:8px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:2mm}@media print{button{display:none}}</style></head><body><div class="label"><div class="logo-row"><div class="logo-box">BOXIUM</div><div class="order-no">${order.orderNo}</div></div><div><div class="section-title">收件人</div><div class="info-row">${order.shippingName || '—'} &nbsp; ${order.shippingPhone || ''}</div><div class="info-row">${addr}</div></div><div><div class="section-title">商品</div><div class="info-row">${order.listingTitle || '未知'} (${order.listingCondition || '—'})</div></div><div><div class="section-title">物流</div><div class="info-row">${order.shippingMethod || '—'}</div></div><div class="barcode-area">${order.trackingNumber || '尚未發貨'}</div><div class="footer">BOXIUM PTCG &bull; www.boxium.asia</div></div><script>window.print();window.close();<\/script></body></html>`);
                    printWindow.document.close();
                  }}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />出貨標籤
                </Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 print:hidden"
                  onClick={() => {
                    const order = selectedOrder;
                    const printWindow = window.open('', '_blank');
                    if (!printWindow || !order) return;
                    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>退款確認單 ${order.orderNo}</title><style>body{font-family:sans-serif;padding:24px;font-size:13px;color:#111}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #dc2626;padding-bottom:12px;margin-bottom:16px}.logo-box{background:#f5c518;border:2px solid #06038d;border-radius:6px;padding:6px 14px;font-size:20px;font-weight:900;color:#06038d;letter-spacing:2px}.company-info{text-align:right;font-size:11px;color:#555;line-height:1.6}h1{font-size:16px;margin-bottom:4px;color:#dc2626}h2{font-size:13px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:16px;color:#dc2626}table{width:100%;border-collapse:collapse}td{padding:4px 8px;vertical-align:top}td:first-child{color:#555;width:140px}.refund-box{background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:16px;margin:16px 0;text-align:center}.refund-amount{font-size:28px;font-weight:900;color:#dc2626}.refund-label{font-size:12px;color:#666;margin-top:4px}.footer{margin-top:24px;border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999;text-align:center}@media print{button{display:none}}</style></head><body><div class="header"><div class="logo-box">BOXIUM</div><div class="company-info"><strong>BOXIUM PTCG</strong><br/>www.boxium.asia<br/>香港卡片交易平台</div></div><h1>退款確認單</h1><div class="refund-box"><div class="refund-amount">HKD ${parseFloat(order.subtotalHkd || '0').toFixed(2)}</div><div class="refund-label">退款金額</div></div><h2>訂單資訊</h2><table><tr><td>訂單編號</td><td>${order.orderNo}</td></tr><tr><td>商品</td><td>${order.listingTitle || '未知'}</td></tr><tr><td>數量</td><td>${order.quantity ?? 1}</td></tr><tr><td>付款方式</td><td>${order.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK'}</td></tr></table><h2>買家資料</h2><table><tr><td>姓名</td><td>${order.buyerName || '—'}</td></tr><tr><td>電郵</td><td>${order.buyerEmail || '—'}</td></tr><tr><td>電話</td><td>${order.buyerPhone || '—'}</td></tr></table><p style="margin-top:16px;font-size:12px;color:#555">退款將於 3-7 工作日內退回至原付款帳戶。如有疑問，請聯繫 BOXIUM PTCG 客服。</p><div class="footer">列印日期: ${new Date().toLocaleDateString('zh-HK')} &bull; BOXIUM PTCG &bull; www.boxium.asia</div><script>window.print();window.close();<\/script></body></html>`);
                    printWindow.document.close();
                  }}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />退款確認單
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send message to buyer dialog */}
      <Dialog open={showSendMessageDialog} onOpenChange={setShowSendMessageDialog}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#06038d]" />
              發送訊息給買家
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p>訊息將以站內通知形式發送給買家。</p>
            </div>
            {/* 常用訊息範本 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">常用範本</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '訂單已出貨', subject: '您的訂單已出貨', body: `您好，您的訂單 ${selectedOrder?.orderNo ?? ''} 已於今日出貨，請注意查收。如有問題請隨時聯繫我們。` },
                  { label: '請確認收貨', subject: '請確認收貨', body: `您好，您的訂單 ${selectedOrder?.orderNo ?? ''} 已到達，請登入平台確認收貨，感謝您的支持！` },
                  { label: '付款提醒', subject: '訂單付款提醒', body: `您好，您的訂單 ${selectedOrder?.orderNo ?? ''} 尚未完成付款，請儘早完成付款以便我們尽快處理您的訂單。` },
                  { label: '等候貨源', subject: '訂單處理中', body: `您好，您的訂單 ${selectedOrder?.orderNo ?? ''} 目前正在處理中，預計將於近日出貨，請耐心等候。` },
                  { label: '等候貨源', subject: '訂單延遲通知', body: `您好，您的訂單 ${selectedOrder?.orderNo ?? ''} 因貨源問題將稍延出貨，我們深感歉意，如需取消請聯繫客服。` },
                ].map(tpl => (
                  <button key={tpl.label} type="button"
                    className="text-xs px-2 py-1 rounded border border-[#06038d]/30 text-[#06038d] hover:bg-[#06038d]/10 transition-colors"
                    onClick={() => { setSendMessageSubject(tpl.subject); setSendMessageBody(tpl.body); }}>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">主旨</label>
              <Input className="mt-1 border-[#06038d]/30" placeholder="輸入主旨..." value={sendMessageSubject} onChange={e => setSendMessageSubject(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">訊息內容</label>
              <Textarea className="mt-1 border-[#06038d]/30 resize-none" placeholder="輸入訊息內容..." rows={4} value={sendMessageBody} onChange={e => setSendMessageBody(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSendMessageDialog(false)}>取消</Button>
            <Button className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
              disabled={sendMessageMutation.isPending || !sendMessageSubject.trim() || !sendMessageBody.trim()}
              onClick={() => selectedOrder && sendMessageMutation.mutate({ orderId: selectedOrder.id, subject: sendMessageSubject, message: sendMessageBody })}>
              {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}發送
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Batch shipping dialog */}
      <Dialog open={showBatchShippingDialog} onOpenChange={setShowBatchShippingDialog}>
        <DialogContent bottomSheet className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              批量更新物流狀態
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p>將對 <strong>{selectedOrderIds.size} 筆訂單</strong>標記為「已出貨」並發送通知給買家。</p>
            </div>
            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setBatchShippingMode('unified')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  batchShippingMode === 'unified' ? 'bg-[#06038d] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}>
                📦 統一追蹤號
              </button>
              <button
                onClick={() => {
                  setBatchShippingMode('individual');
                  // Pre-populate with empty strings for each selected order
                  const map: Record<number, string> = {};
                  Array.from(selectedOrderIds).forEach(id => { map[id] = individualTrackingMap[id] ?? ''; });
                  setIndividualTrackingMap(map);
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  batchShippingMode === 'individual' ? 'bg-[#06038d] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}>
                📝 逐筆填入追蹤號
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">物流方式</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                {([{ value: 'sf_express', label: '順豐' }, { value: 'hk_post', label: '香港郵政' }, { value: 'pickup', label: '自取' }] as const).map(opt => (
                  <button key={opt.value}
                    onClick={() => setBatchShippingMethod(opt.value)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      batchShippingMethod === opt.value ? 'bg-[#06038d] text-white' : 'bg-white text-gray-900 hover:bg-gray-50'
                    }`}>{opt.label}</button>
                ))}
              </div>
            </div>
            {batchShippingMode === 'unified' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">統一追蹤號 <span className="text-gray-400 font-normal">(可留空)</span></label>
                <Input
                  placeholder="輸入物流追蹤號（所有訂單使用相同追蹤號）"
                  value={batchTrackingNumber}
                  onChange={e => setBatchTrackingNumber(e.target.value)}
                  className="bg-white text-gray-900"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">逐筆輸入追蹤號</label>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {Array.from(selectedOrderIds).map(orderId => {
                    const order = orders.find((o: any) => o.id === orderId);
                    return (
                      <div key={orderId} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-600 w-36 flex-shrink-0 truncate">
                          {order?.orderNo ?? `#${orderId}`}
                        </span>
                        <Input
                          placeholder="追蹤號（可留空）"
                          value={individualTrackingMap[orderId] ?? ''}
                          onChange={e => setIndividualTrackingMap(prev => ({ ...prev, [orderId]: e.target.value }))}
                          className="bg-white text-gray-900 text-xs h-8 flex-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-gray-700 bg-white" onClick={() => { setShowBatchShippingDialog(false); setBatchShippingMode('unified'); setIndividualTrackingMap({}); }}>
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={batchUpdateShippingMutation.isPending}
              onClick={() => {
                if (batchShippingMode === 'unified') {
                  batchUpdateShippingMutation.mutate({
                    orderIds: Array.from(selectedOrderIds),
                    trackingNumber: batchTrackingNumber || undefined,
                    shippingMethod: batchShippingMethod,
                  });
                } else {
                  // Individual mode: send per-order tracking numbers
                  batchUpdateShippingMutation.mutate({
                    orderIds: Array.from(selectedOrderIds),
                    perOrderTracking: Object.entries(individualTrackingMap)
                      .filter(([, v]) => v.trim())
                      .map(([k, v]) => ({ orderId: Number(k), trackingNumber: v.trim() })),
                    shippingMethod: batchShippingMethod,
                  });
                }
              }}
            >
              {batchUpdateShippingMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Package className="w-3.5 h-3.5 mr-1.5" />}
              確認出貨
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch payout dialog */}
      <Dialog open={showBatchPayoutDialog} onOpenChange={setShowBatchPayoutDialog}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              批量標記已放款
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              <p>將對 <strong>{selectedOrderIds.size} 筆訂單</strong>標記為「已放款」。</p>
              <p className="mt-1 text-xs text-emerald-700">注意：僅適用於狀態為「已完成」的訂單，其他狀態的訂單將會被計入失敗數。</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">放款備注 <span className="text-gray-400 font-normal">(可留空)</span></label>
              <Textarea
                placeholder="輸入放款備注..."
                rows={2}
                value={batchPayoutNote}
                onChange={e => setBatchPayoutNote(e.target.value)}
                className="bg-white text-gray-900"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-gray-700 bg-white" onClick={() => setShowBatchPayoutDialog(false)}>
              取消
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={batchMarkPayoutMutation.isPending}
              onClick={() => batchMarkPayoutMutation.mutate({
                orderIds: Array.from(selectedOrderIds),
                note: batchPayoutNote || undefined,
              })}
            >
              {batchMarkPayoutMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              確認放款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Note Dialog */}
      <Dialog open={showBatchNoteDialog} onOpenChange={setShowBatchNoteDialog}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              批量新增備注
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p>將為已選 <strong>{selectedOrderIds.size}</strong> 筆訂單新增相同的內部備注，不會更改訂單狀態。</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">備注內容</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['等待補貨', '已訂貨', '已出貨，等待物流', '買家已確認', '特殊處理', '等待驗證'].map(preset => (
                  <button key={preset} type="button"
                    className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                    onClick={() => setBatchNoteInput(preset)}>
                    {preset}
                  </button>
                ))}
              </div>
              <Textarea
                className="border-amber-300 focus:border-amber-500 resize-none"
                placeholder="輸入備注內容..."
                rows={3}
                value={batchNoteInput}
                onChange={e => setBatchNoteInput(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1">{batchNoteInput.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchNoteDialog(false)}>取消</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!batchNoteInput.trim() || batchAddNoteMutation.isPending}
              onClick={() => batchAddNoteMutation.mutate({
                orderIds: Array.from(selectedOrderIds),
                note: batchNoteInput.trim(),
              })}
            >
              {batchAddNoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              確認新增備注
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch approve alipay proof dialog */}
      <Dialog open={showBatchApproveProofDialog} onOpenChange={setShowBatchApproveProofDialog}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              批量核准支付寶截圖
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              <p>將對已選 <strong>{selectedOrderIds.size}</strong> 筆訂單的支付寶 HK 截圖進行核准，訂單狀態將變更為「已收款」並通知買家。</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-medium">ℹ️ 請先登入支付寶 HK 商戶後台核對收款，確認收到以下訂單的付款後再進行批量核准。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchApproveProofDialog(false)}>取消</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={batchApproveProofMutation.isPending}
              onClick={() => batchApproveProofMutation.mutate({
                orderIds: Array.from(selectedOrderIds),
              })}
            >
              {batchApproveProofMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
              確認核准 {selectedOrderIds.size} 筆截圖
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Listing detail dialog triggered from order detail */}
      {viewListingId && (
        <ListingDetailDialog
          listingId={viewListingId}
          onClose={() => setViewListingId(null)}
          onUpdated={() => {}}
          onViewOrders={(id) => {
            setViewListingId(null);
            if (onViewOrders) onViewOrders(id);
          }}
          onOpenOrder={(orderId) => {
            // Find the order from current orders list and open its detail dialog
            const found = orders.find((o: any) => o.id === orderId);
            if (found) {
              setViewListingId(null);
              setSelectedOrder(found);
            } else {
              toast.info('請在訂單管理中搜尋訂單詳情');
            }
          }}
        />
      )}
    </div>
  );
}

function GradingAlipaySection({ submissions, isLoading, refetch }: { submissions: any[]; isLoading: boolean; refetch: () => void }) {
  const utils = trpc.useUtils();
  const confirmAlipayMutation = trpc.grading.adminConfirmGradingAlipayPayment.useMutation({
    onSuccess: () => {
      toast.success('支付寶 HK 收款已確認，訂單已完成');
      refetch();
      utils.grading.admin.listSubmissions.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>;
  if (submissions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <CheckCircle className="h-10 w-10 text-green-400 mb-3" />
      <p className="text-gray-700 font-medium">暫無待核對的支付寶 HK 鑑定訂單</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">共 {submissions.length} 筆待核對的鑑定申請支付寶 HK 截圖</p>
      {submissions.map((sub: any) => (
        <div key={sub.id} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#06038d]">{sub.orderNo}</span>
              <span className="text-xs text-gray-500">{new Date(sub.createdAt).toLocaleDateString('zh-HK')}</span>
              {sub.alipayProofAiResult && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  sub.alipayProofAiResult === 'pass' ? 'bg-green-100 text-green-800' :
                  sub.alipayProofAiResult === 'warning' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {sub.alipayProofAiResult === 'pass' ? '✅ AI通過' : sub.alipayProofAiResult === 'warning' ? '⚠️ AI警告' : '❌ AI未通過'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">HK${parseFloat(sub.totalFeeHkd ?? '0').toLocaleString()}</span>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">申請人</p>
              <p className="text-sm font-medium text-gray-900">{sub.user?.name ?? '—'}</p>
              <p className="text-xs text-gray-500">{sub.user?.email ?? ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">提交時間</p>
              <p className="text-sm text-gray-900">{sub.alipayProofSubmittedAt ? new Date(sub.alipayProofSubmittedAt).toLocaleString('zh-HK') : '—'}</p>
            </div>
            {sub.alipayProofImageUrl && (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 mb-1">支付寶 HK 截圖</p>
                <img
                  src={sub.alipayProofImageUrl}
                  alt="支付寶截圖"
                  className="max-h-40 rounded-lg border border-amber-200 cursor-pointer object-contain"
                  onClick={() => window.open(sub.alipayProofImageUrl, '_blank')}
                />
                {sub.alipayProofAiSummary && (
                  <p className="text-xs text-gray-600 mt-1">{sub.alipayProofAiSummary}</p>
                )}
              </div>
            )}
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={confirmAlipayMutation.isPending}
              onClick={() => confirmAlipayMutation.mutate({ submissionId: sub.id })}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />確認收款完成
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-gray-300 text-gray-700"
              onClick={() => window.open(`/admin/grading?id=${sub.id}`, '_blank')}
            >
              查看詳情
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AlipayPendingTab() {
  const [subTab, setSubTab] = useState<'marketplace' | 'grading'>('marketplace');
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: orders, isLoading, refetch } = trpc.marketplace.adminGetAlipayPending.useQuery({ dateFilter });
  // Grading alipay pending
  const { data: gradingAlipayData, isLoading: loadingGradingAlipay, refetch: refetchGrading } = trpc.grading.admin.listSubmissions.useQuery({
    alipayProofPending: true,
    limit: 100,
    offset: 0,
  });
  const gradingAlipaySubmissions = gradingAlipayData?.submissions ?? [];
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchNote, setBatchNote] = useState("");
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  // Filter orders by search query (#BOXIUM-ID, orderNo, buyer name, listing title)
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o: any) => {
      const boxiumId = `#boxium-${o.listingId}`.toLowerCase();
      const boxiumIdNoHash = `boxium-${o.listingId}`.toLowerCase();
      const orderNo = (o.orderNo ?? '').toLowerCase();
      const buyerName = (o.shippingName ?? '').toLowerCase();
      const listingTitle = (o.listingTitle ?? '').toLowerCase();
      return boxiumId.includes(q) || boxiumIdNoHash.includes(q) || orderNo.includes(q) || buyerName.includes(q) || listingTitle.includes(q) || String(o.listingId).includes(q);
    });
  }, [orders, searchQuery]);
  const utils = trpc.useUtils();
  const invalidateStats = () => {
    utils.marketplace.adminGetStats.invalidate();
    utils.marketplace.adminGetPendingPayoutCount.invalidate();
  };

  const confirmMutation = trpc.marketplace.adminConfirmAlipayPayment.useMutation({
    onSuccess: () => { toast.success("已確認收款，已通知買家"); refetch(); setSelectedOrder(null); invalidateStats(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const [rejectOrder, setRejectOrder] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const rejectMutation = trpc.marketplace.adminRejectAlipayPayment.useMutation({
    onSuccess: () => { toast.success("已拒絕付款，已通知買家重新上傳"); refetch(); setRejectOrder(null); setRejectReason(""); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  // AI Verify mutation
  const [aiVerifyingIds, setAiVerifyingIds] = useState<Set<number>>(new Set());
  const aiVerifyMutation = trpc.marketplace.adminAiVerifyAlipay.useMutation({
    onSuccess: (result, variables) => {
      setAiVerifyingIds(prev => { const n = new Set(prev); n.delete(variables.orderId); return n; });
      refetch();
      if (result.verified) {
        toast.success(`AI 核對通過（${result.confidence === 'high' ? '高' : result.confidence === 'medium' ? '中' : '低'}可信度）`);
      } else {
        toast.error(`AI 核對不通過：${result.reason}`);
      }
    },
    onError: (e, variables) => {
      setAiVerifyingIds(prev => { const n = new Set(prev); n.delete(variables.orderId); return n; });
      toast.error(`AI 核對失敗：${e.message}`);
    },
  });
  const handleAiVerify = (orderId: number) => {
    setAiVerifyingIds(prev => new Set(prev).add(orderId));
    aiVerifyMutation.mutate({ orderId });
  };
  const handleBatchAiVerify = () => {
    const ids = Array.from(selectedIds);
    const ordersWithProof = filteredOrders.filter((o: any) => ids.includes(o.id) && o.alipayProofImageUrl && !o.aiVerificationResult);
    if (ordersWithProof.length === 0) { toast.error('所選訂單均無截圖或已核對'); return; }
    ordersWithProof.forEach((o: any) => handleAiVerify(o.id));
    toast.info(`正在批量 AI 核對 ${ordersWithProof.length} 筆訂單...`);
  };

  const [showBatchRejectDialog, setShowBatchRejectDialog] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState("");
  const batchRejectMutation = trpc.marketplace.adminRejectAlipayPayment.useMutation({
    onSuccess: () => {
      toast.success("批量拒絕完成");
      refetch();
      setSelectedIds(new Set());
      setShowBatchRejectDialog(false);
      setBatchRejectReason("");
      invalidateStats();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const batchConfirmMutation = trpc.marketplace.adminBatchConfirmAlipayPayment.useMutation({
    onSuccess: (data) => {
      toast.success(`批量審核完成：${data.successCount} 筆成功${data.failCount > 0 ? `，${data.failCount} 筆失敗` : ""}`);
      refetch();
      setSelectedIds(new Set());
      setShowBatchDialog(false);
      invalidateStats();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const allIds = orders?.map((o: any) => o.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id: number) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">支付寶 HK 手動核對</p>
            <p className="mt-1">請登入支付寶 HK 商戶後台核對收款後，點擊「確認收款」。確認後系統會自動通知買家。</p>
            <p className="mt-1">收款帳號：<strong>Account ID: 2160120158548164</strong></p>
          </div>
        </div>
      </div>
      {/* Sub-tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setSubTab('marketplace')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === 'marketplace' ? 'bg-white text-[#06038d] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          商品訂單 {orders ? `(${orders.length})` : ''}
        </button>
        <button
          onClick={() => setSubTab('grading')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === 'grading' ? 'bg-white text-[#06038d] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          PSA 鑑定申請 {gradingAlipaySubmissions.length > 0 ? `(${gradingAlipaySubmissions.length})` : ''}
        </button>
      </div>
      {subTab === 'grading' && (
        <GradingAlipaySection submissions={gradingAlipaySubmissions} isLoading={loadingGradingAlipay} refetch={refetchGrading} />
      )}
      {subTab === 'marketplace' && (<>
      {/* Date filter + Search */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600 font-medium">日期篩選：</span>
        {(["all", "today", "week", "month"] as const).map(f => (
          <button key={f}
            onClick={() => { setDateFilter(f); setSelectedIds(new Set()); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              dateFilter === f
                ? "bg-[#06038d] text-white border-[#06038d]"
                : "bg-white text-gray-900 border-gray-200 hover:border-[#06038d]/40"
            }`}>
            {f === "all" ? "全部" : f === "today" ? "今日" : f === "week" ? "本週" : "本月"}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">共 {filteredOrders.length} / {orders?.length ?? 0} 筆</span>
      </div>
      {/* Search box */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜尋 #BOXIUM-編號、訂單號、買家姓名、商品名稱..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06038d]/30 focus:border-[#06038d]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Batch actions toolbar */}
      {orders && orders.length > 0 && (
        <div className="flex items-center justify-between bg-gray-50 border rounded-lg px-4 py-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-gray-600">全選 ({selectedIds.size}/{allIds.length})</span>
          </label>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { setBatchNote(""); setShowBatchDialog(true); }}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                批量確認 ({selectedIds.size} 筆)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                onClick={handleBatchAiVerify}
              >
                <Bot className="w-3 h-3 mr-1" />
                批量 AI 核對
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => { setBatchRejectReason(""); setShowBatchRejectDialog(true); }}
              >
                <XCircle className="w-3 h-3 mr-1" />
                批量拒絕 ({selectedIds.size} 筆)
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      ) : !orders || orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-500" />
          <p>暫無待核對的支付寶 HK 訂單</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <p>找不到符合「{searchQuery}」的訂單</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order: any) => (
            <div key={order.id} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header bar */}
              <div className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#06038d] to-[#1a17a0] ${selectedIds.has(order.id) ? 'ring-2 ring-green-400 ring-inset' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                  />
                  <span className="text-white text-sm font-semibold font-mono">{order.orderNo}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900">待核對</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">支付寶 HK</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-xs">{new Date(order.createdAt).toLocaleDateString('zh-HK')}</span>
                  <span className="text-yellow-300 text-xs font-semibold">HKD {parseFloat(order.subtotalHkd as string || '0').toFixed(2)}</span>
                </div>
              </div>
              {/* Content */}
              <div className="px-4 py-3 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1 space-y-0.5 text-xs text-gray-600">
                  {order.shippingName && <p>買家：<span className="font-medium text-gray-900">{order.shippingName}</span></p>}
                  {order.listingId && <p>商品編號：<span className="font-mono font-semibold text-[#06038d]">#BOXIUM-{order.listingId}</span></p>}
                  {order.listingTitle && <p>商品：{order.listingTitle}</p>}
                  {order.alipayProofImageUrl && (
                    <a href={order.alipayProofImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      <Eye className="w-3 h-3" />查看付款截圖
                    </a>
                  )}
                  {order.alipayProofStatus === "pending_review" && (() => {
                    const submittedMs = order.alipayProofSubmittedAt ? new Date(order.alipayProofSubmittedAt).getTime() : null;
                    const isOverdue = submittedMs !== null && (Date.now() - submittedMs) > 48 * 60 * 60 * 1000;
                    const isResubmitted = (order.alipayProofImageUrl ?? '').includes('resubmit-');
                    return isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        ⚠️ 超時未審核
                      </span>
                    ) : isResubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        🔄 已重新提交
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        ⏳ 截圖待審核
                      </span>
                    );
                  })()}
                  {order.alipayProofStatus === "approved" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      ✅ 截圖已核准
                    </span>
                  )}
                  {order.alipayProofStatus === "rejected" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                      ❌ 截圖已拒絕
                    </span>
                  )}
                  {order.alipayProofImageUrl && !order.aiVerificationResult && (
                    aiVerifyingIds.has(order.id) ? (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        AI 核對中...
                      </div>
                    ) : (
                      <button onClick={() => handleAiVerify(order.id)}
                        className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors cursor-pointer">
                        <Bot className="w-3 h-3" />AI 核對
                      </button>
                    )
                  )}
                  {order.aiVerificationResult && (() => {
                    try {
                      const ai = JSON.parse(order.aiVerificationResult);
                      const confidenceLabel = ai.confidence === 'high' ? '高可信度' : ai.confidence === 'medium' ? '中可信度' : ai.confidence === 'low' ? '低可信度' : '';
                      return (
                        <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          ai.verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {ai.verified ? '✅ AI 驗證通過' : '⚠️ AI 驗證失敗'}
                          {confidenceLabel && <span className="opacity-70">({confidenceLabel})</span>}
                          {ai.detectedAmount && <span className="opacity-70">· HKD {ai.detectedAmount}</span>}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => { setRejectOrder(order); setRejectReason(""); }}>
                    <XCircle className="w-3 h-3 mr-1" />拒絕
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => { setSelectedOrder(order); setNote(""); }}>
                    <CheckCircle className="w-3 h-3 mr-1" />確認收款
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Single confirm dialog - Platform Style */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent bottomSheet className="sm:max-w-md p-0 bg-white">
          {/* Header - sticky */}
          <div className="bg-[#06038d] px-5 py-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">確認支付寶 HK 收款</h2>
                {selectedOrder && <p className="text-xs text-white/70 mt-0.5">訂單 {selectedOrder.orderNo}</p>}
              </div>
            </div>
          </div>
          {selectedOrder && (
            <div className="px-5 py-4 space-y-4">
              {/* Order summary card */}
              <div className="bg-[#06038d]/5 border border-[#06038d]/20 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-gray-500">訂單編號</span>
                  <span className="font-mono font-semibold text-[#06038d] text-right">{selectedOrder.orderNo}</span>
                  <span className="text-gray-500">收款金額</span>
                  <span className="font-bold text-lg text-[#06038d] text-right">HKD {parseFloat(selectedOrder.subtotalHkd || "0").toFixed(2)}</span>
                  {selectedOrder.shippingName && (
                    <>
                      <span className="text-gray-500">買家</span>
                      <span className="font-medium text-gray-800 text-right">{selectedOrder.shippingName}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Proof status badge */}
              {selectedOrder.alipayProofStatus && (
                <div className={`rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
                  selectedOrder.alipayProofStatus === "pending_review" ? "bg-amber-50 border border-amber-300 text-amber-800" :
                  selectedOrder.alipayProofStatus === "approved" ? "bg-green-50 border border-green-300 text-green-800" :
                  "bg-red-50 border border-red-300 text-red-800"
                }`}>
                  {selectedOrder.alipayProofStatus === "pending_review" ? "⏳ 截圖待審核" :
                   selectedOrder.alipayProofStatus === "approved" ? "✅ 截圖已核准" : "❌ 截圖已拒絕"}
                </div>
              )}

              {/* Proof image */}
              {selectedOrder.alipayProofImageUrl && (
                <div className="rounded-xl overflow-hidden border-2 border-[#06038d]/20 bg-gray-50">
                  <div className="px-3 py-1.5 bg-[#06038d]/5 border-b border-[#06038d]/10">
                    <p className="text-xs font-semibold text-[#06038d]">📸 買家付款截圖</p>
                  </div>
                  <img src={selectedOrder.alipayProofImageUrl} alt="付款截圖" className="max-h-52 object-contain w-full p-2" />
                </div>
              )}

              {/* AI verify button */}
              {selectedOrder.alipayProofImageUrl && !selectedOrder.aiVerificationResult && (
                aiVerifyingIds.has(selectedOrder.id) ? (
                  <div className="rounded-xl p-3 text-sm border border-indigo-200 bg-indigo-50 flex items-center gap-2 text-indigo-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 核對中，請稍候...
                  </div>
                ) : (
                  <button onClick={() => handleAiVerify(selectedOrder.id)}
                    className="w-full rounded-xl p-3 text-sm border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium">
                    <Bot className="w-4 h-4" />點擊 AI 核對付款截圖
                  </button>
                )
              )}

              {/* AI result */}
              {selectedOrder.aiVerificationResult && (() => {
                try {
                  const ai = JSON.parse(selectedOrder.aiVerificationResult);
                  const confidenceLabel = ai.confidence === 'high' ? '高可信度' : ai.confidence === 'medium' ? '中可信度' : ai.confidence === 'low' ? '低可信度（建議人工核對）' : '';
                  return (
                    <div className={`rounded-xl p-3 text-sm border-2 ${
                      ai.verified ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
                    }`}>
                      <div className="flex items-center gap-2 font-bold mb-2">
                        {ai.verified
                          ? <span className="text-green-700">✅ AI 驗證：付款截圖有效</span>
                          : <span className="text-red-700">⚠️ AI 驗證：對比失敗</span>
                        }
                        {confidenceLabel && (
                          <span className="text-xs text-gray-500 ml-auto font-normal">{confidenceLabel}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {ai.detectedAmount && <p className="text-xs text-gray-600">💰 偵測金額: <strong>HKD {ai.detectedAmount}</strong></p>}
                        {ai.detectedPayee && <p className="text-xs text-gray-600">🏦 偵測收款方: <strong>{ai.detectedPayee}</strong></p>}
                        {ai.detectedStatus && <p className="text-xs text-gray-600">📊 偵測狀態: <strong>{ai.detectedStatus}</strong></p>}
                        {ai.reason && <p className="text-xs text-gray-600 mt-1.5 border-t border-gray-200 pt-1.5">{ai.reason}</p>}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Note input */}
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium text-sm">備注（可選）</Label>
                <Input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="例：已在支付寶後台核對，交易號 xxxx"
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>

              {/* Notices */}
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">請確認已在支付寶 HK 商戶後台核對到此筆收款後，再點擊確認。</p>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-[#06038d]/5 border border-[#06038d]/20 px-3 py-2.5">
                  <CheckCircle className="w-4 h-4 text-[#06038d] mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-[#06038d]">確認後系統會自動發送通知給買家和賣家。</p>
                </div>
              </div>
            </div>
          )}
          {/* Footer */}
          <div className="px-5 pb-5 pt-2 flex gap-3 border-t border-gray-100">
            <Button variant="outline" className="flex-1 border-gray-300 text-gray-700" onClick={() => setSelectedOrder(null)}>取消</Button>
            <Button
              className="flex-1 bg-[#06038d] hover:bg-[#0804b8] text-white font-semibold"
              disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate({ orderId: selectedOrder!.id, note })}>
              {confirmMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />確認中...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" />確認已收款</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject payment dialog */}
      <Dialog open={!!rejectOrder} onOpenChange={(v) => { if (!v) { setRejectOrder(null); setRejectReason(""); } }}>
        <DialogContent bottomSheet className="sm:max-w-md p-0 bg-white">
          {/* Header */}
          <div className="bg-red-700 px-5 py-4 rounded-t-2xl sm:rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">拒絕支付寶 HK 付款</h2>
                {rejectOrder && <p className="text-xs text-white/70 mt-0.5 font-mono">{rejectOrder.orderNo}</p>}
              </div>
            </div>
          </div>
          {/* Body */}
          {rejectOrder && (
            <div className="px-5 py-4 space-y-4">
              {/* Order info card */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">收款金額</span>
                  <span className="font-bold text-red-700 text-base">HKD {parseFloat(rejectOrder.subtotalHkd || "0").toFixed(2)}</span>
                </div>
                {rejectOrder.shippingName && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">買家</span>
                    <span className="text-sm font-medium text-gray-800">{rejectOrder.shippingName}</span>
                  </div>
                )}
              </div>
              {/* Payment screenshot */}
              {rejectOrder.alipayProofImageUrl && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700">📷 買家付款截圖</p>
                  <img src={rejectOrder.alipayProofImageUrl} alt="付款截圖" className="rounded-xl border border-red-100 max-h-48 object-contain w-full bg-white" />
                </div>
              )}
              {/* Reject reason */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">拒絕原因 <span className="text-red-500">*</span></Label>
                <Input
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="例：截圖金額不符、截圖不清晰、收款方不符等"
                  className="border-gray-300 focus:border-red-500 focus:ring-red-200"
                />
              </div>
              {/* Warning */}
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2">
                <span className="text-red-500 text-sm mt-0.5">⚠️</span>
                <p className="text-xs text-red-800">拒絕後訂單將回到「待付款」狀態，買家將收到通知並被要求重新上傳截圖。</p>
              </div>
            </div>
          )}
          {/* Footer */}
          <div className="px-5 pb-5 pt-2 flex gap-3 border-t border-gray-100">
            <Button variant="outline" className="flex-1 border-gray-300 text-gray-700" onClick={() => { setRejectOrder(null); setRejectReason(""); }}>取消</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              onClick={() => rejectMutation.mutate({ orderId: rejectOrder.id, reason: rejectReason.trim() })}
            >
              {rejectMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />拒絕中...</>
                : <><XCircle className="w-4 h-4 mr-2" />確認拒絕</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch reject dialog - Platform Red Style */}
      <Dialog open={showBatchRejectDialog} onOpenChange={setShowBatchRejectDialog}>
        <DialogContent bottomSheet className="sm:max-w-md p-0 bg-white">
          {/* Header */}
          <div className="bg-red-700 px-5 py-4 rounded-t-2xl sm:rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">批量拒絕支付寶 HK 付款</h2>
                <p className="text-xs text-white/70 mt-0.5">共 {selectedIds.size} 筆訂單待拒絕</p>
              </div>
            </div>
          </div>
          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Order list */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-red-700">拒絕訂單清單</span>
                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-medium">{selectedIds.size} 筆</span>
              </div>
              <ul className="space-y-2 max-h-44 overflow-y-auto">
                {orders?.filter((o: any) => selectedIds.has(o.id)).map((o: any) => (
                  <li key={o.id} className="flex justify-between items-center py-1.5 border-b border-red-100 last:border-0">
                    <span className="font-mono text-xs text-gray-700">{o.orderNo}</span>
                    <span className="font-bold text-sm text-red-700">HKD {parseFloat(o.subtotalHkd || "0").toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Reject reason */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">拒絕原因 <span className="text-red-500">*</span></Label>
              <Input
                value={batchRejectReason}
                onChange={e => setBatchRejectReason(e.target.value)}
                placeholder="例：付款金額不符、截圖不清晰、收款方不符合"
                className="border-gray-300 focus:border-red-500 focus:ring-red-200"
              />
            </div>
            {/* Warning */}
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2">
              <span className="text-red-500 text-sm mt-0.5">⚠️</span>
              <p className="text-xs text-red-800">拒絕後系統會自動通知所有買家重新上傳截圖。</p>
            </div>
          </div>
          {/* Footer */}
          <div className="px-5 pb-5 pt-2 flex gap-3 border-t border-gray-100">
            <Button variant="outline" className="flex-1 border-gray-300 text-gray-700" onClick={() => setShowBatchRejectDialog(false)}>取消</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={!batchRejectReason.trim() || batchRejectMutation.isPending}
              onClick={async () => {
                const ids = Array.from(selectedIds);
                for (const id of ids) {
                  await batchRejectMutation.mutateAsync({ orderId: id, reason: batchRejectReason });
                }
              }}
            >
              {batchRejectMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />拒絕中...</>
                : <><XCircle className="w-4 h-4 mr-2" />拒絕 {selectedIds.size} 筆訂單</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch confirm dialog - Platform Style */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent bottomSheet className="sm:max-w-md p-0 bg-white">
          {/* Header */}
          <div className="bg-[#06038d] px-5 py-4 rounded-t-2xl sm:rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">批量確認支付寶 HK 收款</h2>
                <p className="text-xs text-white/70 mt-0.5">共 {selectedIds.size} 筆訂單待確認</p>
              </div>
            </div>
          </div>
          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Summary card */}
            <div className="bg-[#06038d]/5 border border-[#06038d]/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[#06038d]">確認訂單清單</span>
                <span className="text-xs bg-[#06038d] text-white px-2 py-0.5 rounded-full font-medium">{selectedIds.size} 筆</span>
              </div>
              <ul className="space-y-2 max-h-44 overflow-y-auto">
                {orders?.filter((o: any) => selectedIds.has(o.id)).map((o: any) => (
                  <li key={o.id} className="flex justify-between items-center py-1.5 border-b border-[#06038d]/10 last:border-0">
                    <span className="font-mono text-xs text-gray-700">{o.orderNo}</span>
                    <span className="font-bold text-sm text-[#06038d]">HKD {parseFloat(o.subtotalHkd || "0").toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {/* Total */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#06038d]/20">
                <span className="text-sm font-semibold text-gray-700">合計收款</span>
                <span className="text-lg font-bold text-[#06038d]">
                  HKD {orders?.filter((o: any) => selectedIds.has(o.id)).reduce((sum: number, o: any) => sum + parseFloat(o.subtotalHkd || "0"), 0).toFixed(2)}
                </span>
              </div>
            </div>
            {/* Note input */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">備注（可選，會發送給所有買家）</Label>
              <Input
                value={batchNote}
                onChange={e => setBatchNote(e.target.value)}
                placeholder="例：已批量核對支付寶 HK 後台收款記錄"
                className="border-gray-300 focus:border-[#06038d] focus:ring-[#06038d]/20"
              />
            </div>
            {/* Warning */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
              <p className="text-xs text-amber-800">請確認已在支付寶 HK 商戶後台核對到所有收款後，再點擊確認。</p>
            </div>
            {/* Notification notice */}
            <div className="flex items-start gap-2 rounded-xl bg-[#06038d]/5 border border-[#06038d]/20 px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-[#06038d] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#06038d]">確認後系統會自動發送通知給所有買家和賣家。</p>
            </div>
          </div>
          {/* Footer */}
          <div className="px-5 pb-5 pt-2 flex gap-3 border-t border-gray-100">
            <Button variant="outline" className="flex-1 border-gray-300 text-gray-700" onClick={() => setShowBatchDialog(false)}>取消</Button>
            <Button
              className="flex-1 bg-[#06038d] hover:bg-[#0804b8] text-white font-semibold"
              disabled={batchConfirmMutation.isPending}
              onClick={() => batchConfirmMutation.mutate({ orderIds: Array.from(selectedIds), note: batchNote || undefined })}
            >
              {batchConfirmMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />確認中...</>
                : <><CheckCircle className="w-4 h-4 mr-2" />確認 {selectedIds.size} 筆收款</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>)}
    </div>
  );
}
function SellerDetailDialog({ sellerId, onClose }: { sellerId: number | null; onClose: () => void }) {
  const { data, isLoading } = trpc.marketplace.adminGetSellerDetail.useQuery(
    { sellerId: sellerId! },
    { enabled: !!sellerId }
  );
  const sp = data?.sellerProfile;
  const user = data?.user;

  const loginMethodLabel: Record<string, string> = { password: "密碼登入", google: "Google OAuth" };
  const stripeStatusColor: Record<string, string> = { active: "bg-green-100 text-green-800", pending: "bg-yellow-100 text-yellow-800", restricted: "bg-orange-100 text-orange-800", disabled: "bg-red-100 text-red-800" };

  return (
    <Dialog open={!!sellerId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User2 className="w-5 h-5" />賣家詳情
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : sp && user ? (
          <div className="space-y-5">
            {/* Seller Profile Header */}
            <div className="flex items-center gap-4">
              {sp.avatarUrl ? (
                <img src={sp.avatarUrl} alt={sp.displayName} className="w-16 h-16 rounded-full object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <User2 className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-lg">{sp.displayName}</h3>
                {sp.bio && <p className="text-sm text-muted-foreground">{sp.bio}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={sp.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {sp.isActive ? "已批准" : "已停用"}
                  </Badge>
                  <Badge className={stripeStatusColor[sp.stripeConnectStatus] ?? ""}>
                    Stripe: {sp.stripeConnectStatus}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Account Info Section */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b text-gray-700">
                <p className="text-sm font-semibold">👤 帳號資訊</p>
              </div>
              <div className="divide-y">
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">姓名</span>
                  <span className="font-medium">{user.name ?? "未設定"}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium break-all">{user.email}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">電話</span>
                  <span className="font-medium">{user.phone ?? "未設定"}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">登入方式</span>
                  <span className="font-medium">{loginMethodLabel[user.loginMethod] ?? user.loginMethod}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Email 驗證</span>
                  <span className={`font-medium ${user.emailVerified ? "text-green-600" : "text-orange-500"}`}>{user.emailVerified ? "已驗證" : "未驗證"}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">註冊時間</span>
                  <span className="font-medium">{new Date(user.createdAt).toLocaleString("zh-HK")}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">最後登入</span>
                  <span className="font-medium">{new Date(user.lastSignedIn).toLocaleString("zh-HK")}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">用戶 ID</span>
                  <span className="font-medium text-muted-foreground">#{user.id}</span>
                </div>
              </div>
            </div>

            {/* Seller Stats Section */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b text-gray-700">
                <p className="text-sm font-semibold">📊 銷售統計</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y">
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{data?.activeListingCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">上架中商品</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{data?.listingCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">總商品數</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{data?.completedOrderCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">已完成訂單</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold">HK${(data?.totalRevenue ?? 0).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">總收益</p>
                </div>
                <div className="px-4 py-3 text-center col-span-2">
                  <p className="text-2xl font-bold">{sp.avgRating ?? "0.00"} <span className="text-sm text-yellow-500">★</span></p>
                  <p className="text-xs text-muted-foreground">評分 ({sp.ratingCount} 則評價)</p>
                </div>
              </div>
            </div>

            {/* Stripe Connect Info */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b text-gray-700 flex items-center justify-between">
                <p className="text-sm font-semibold">💳 Stripe Connect 收款帳戶</p>
                {sp.stripeConnectId && (
                  <a
                    href={`https://dashboard.stripe.com/connect/accounts/${sp.stripeConnectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    在 Stripe 查看 ↗
                  </a>
                )}
              </div>
              <div className="divide-y">
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm items-center">
                  <span className="text-muted-foreground">Account ID</span>
                  {sp.stripeConnectId ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs break-all">{sp.stripeConnectId}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(sp.stripeConnectId!); toast.success("已複製 Account ID"); }}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="複製 Account ID"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic text-xs">尚未設定</span>
                  )}
                </div>
                <div className="grid grid-cols-2 px-4 py-2.5 text-sm items-center">
                  <span className="text-muted-foreground">狀態</span>
                  <Badge className={stripeStatusColor[sp.stripeConnectStatus] ?? ""}>
                    {sp.stripeConnectStatus === 'active' ? '✅ 已啟用' :
                     sp.stripeConnectStatus === 'pending' ? '⏳ 審核中' :
                     sp.stripeConnectStatus === 'restricted' ? '⚠️ 受限制' :
                     sp.stripeConnectStatus === 'disabled' ? '❌ 已停用' :
                     sp.stripeConnectStatus}
                  </Badge>
                </div>
                {!sp.stripeConnectId && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-orange-600">⚠️ 賣家尚未完成 Stripe Connect 設定，訂單完成後無法透過 Stripe 自動轉帳。</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Reason */}
            {sp.rejectReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800">停用/拒絕原因</p>
                <p className="text-sm text-red-700 mt-1">{sp.rejectReason}</p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SellersTab() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; sellerId: number; sellerName: string }>({ open: false, sellerId: 0, sellerName: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; sellerId: number; sellerName: string }>({ open: false, sellerId: 0, sellerName: "" });
  const [suspendReason, setSuspendReason] = useState("");
  const [unsuspendDialog, setUnsuspendDialog] = useState<{ open: boolean; sellerId: number; sellerName: string }>({ open: false, sellerId: 0, sellerName: "" });
  const { data, isLoading, refetch } = trpc.marketplace.adminGetSellers.useQuery({ page, pageSize: 20, search: searchQuery || undefined });
  const utils = trpc.useUtils();
  const approveMutation = trpc.marketplace.adminApproveSeller.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "賣家已批准，已通知申請人" : "賣家已拒絕/停用，已通知申請人");
      setRejectDialog({ open: false, sellerId: 0, sellerName: "" });
      setRejectReason("");
      refetch();
      utils.marketplace.adminGetStats.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const suspendMutation = trpc.marketplace.adminSuspendSeller.useMutation({
    onSuccess: () => {
      toast.success("賣家已凍結，所有商品已下架");
      setSuspendDialog({ open: false, sellerId: 0, sellerName: "" });
      setSuspendReason("");
      refetch();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const unsuspendMutation = trpc.marketplace.adminUnsuspendSeller.useMutation({
    onSuccess: () => {
      toast.success("賣家已解凍，可重新上架商品");
      setUnsuspendDialog({ open: false, sellerId: 0, sellerName: "" });
      refetch();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const sellers = data?.sellers ?? [];
  const total = data?.total ?? 0;
  const updateRiskMutation = trpc.marketplace.adminUpdateSellerRiskProfile.useMutation({
    onSuccess: () => { toast.success("風控等級已更新"); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const riskLevelLabel: Record<string, string> = { low: '低風險', medium: '中風險', high: '高風險', critical: '極高風險' };
  const riskLevelColor: Record<string, string> = { low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' };

  const handleExportSellersCSV = () => {
    const rows = sellers.map((s: any) => ({
      '賣家 ID': s.id,
      '顯示名稱': s.displayName,
      '真實姓名': s.realName ?? '',
      '電郵': s.email ?? '',
      '電話': s.phone ?? '',
      '狀態': s.isActive ? '已批准' : '待審核',
      'Stripe Connect': s.stripeConnectStatus ?? '',
      '總銷售筆數': s.totalSales ?? 0,
      '評分': s.rating ?? '',
      '申請日期': new Date(s.createdAt).toLocaleDateString('zh-HK'),
    }));
    exportToCSV(rows, `賣家列表_${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search bar */}
        <form
          className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm"
          onSubmit={(e) => { e.preventDefault(); setSearchQuery(searchInput.trim()); setPage(1); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜尋賣家名稱或電郵..."
              className="pl-8 h-8 text-sm bg-white text-gray-900"
            />
          </div>
          <Button type="submit" size="sm" className="bg-[#06038d] text-white h-8 px-3">搜尋</Button>
          {searchQuery && (
            <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-gray-500"
              onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(1); }}>
              清除
            </Button>
          )}
        </form>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-600">共 {total} 位賣家</span>
          <Button size="sm" variant="outline" className="text-gray-700 bg-white" onClick={handleExportSellersCSV} disabled={sellers.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" />匯出 CSV
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">載入中...</div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-12 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暫無賣家申請</p></div>
      ) : (
        <div className="space-y-3">
          {sellers.map((seller: any) => (
            <div key={seller.id} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#06038d] to-[#1a17a0]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-semibold">#{seller.id} · {seller.displayName}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    seller.isSuspended ? 'bg-red-200 text-red-900' : seller.isActive ? 'bg-green-200 text-green-900' : 'bg-yellow-200 text-yellow-900'
                  }`}>{seller.isSuspended ? '❄️ 已凍結' : seller.isActive ? '已批准' : '待審核'}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    seller.stripeConnectStatus === 'active' ? 'bg-green-200 text-green-900' :
                    seller.stripeConnectStatus === 'pending' ? 'bg-yellow-200 text-yellow-900' :
                    'bg-red-200 text-red-900'
                  }`}>Stripe: {seller.stripeConnectStatus}</span>
                  {seller.riskLevel && seller.riskLevel !== 'low' && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskLevelColor[seller.riskLevel] ?? 'bg-gray-100 text-gray-700'}`}>
                      ⚠️ {riskLevelLabel[seller.riskLevel] ?? seller.riskLevel}
                    </span>
                  )}
                </div>
                <span className="text-white/80 text-xs">申請：{new Date(seller.createdAt).toLocaleDateString('zh-HK')}</span>
              </div>
              {/* Content */}
              <div className="px-4 py-3 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>總銷售: <span className="font-medium text-gray-900">{seller.totalSales}</span></span>
                    <span>評分: <span className="font-medium text-gray-900">{seller.rating ?? 'N/A'}</span></span>
                  </div>
                  {seller.rejectReason && (
                    <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                      拒絕原因：{seller.rejectReason}
                    </div>
                  )}
                  {seller.isSuspended && seller.suspensionReason && (
                    <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" />凍結原因：{seller.suspensionReason}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs text-gray-700 bg-white" onClick={() => setSelectedSellerId(seller.id)}>
                    <Eye className="w-3 h-3 mr-1" />查看詳情
                  </Button>
                  {!seller.isActive ? (
                    <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700 text-white"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({ sellerId: seller.id, approve: true })}>
                      <CheckCircle className="w-3 h-3 mr-1" />批准
                    </Button>
                  ) : seller.isSuspended ? (
                    <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setUnsuspendDialog({ open: true, sellerId: seller.id, sellerName: seller.displayName })}>
                      <ShieldOff className="w-3 h-3 mr-1" />解凍
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={() => { setSuspendDialog({ open: true, sellerId: seller.id, sellerName: seller.displayName }); setSuspendReason(""); }}>
                        <Shield className="w-3 h-3 mr-1" />凍結
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => { setRejectDialog({ open: true, sellerId: seller.id, sellerName: seller.displayName }); setRejectReason(""); }}>
                        停用
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" className="text-gray-700 bg-white" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="flex items-center text-sm text-gray-600">第 {page} 頁 / 共 {Math.ceil(total / 20)} 頁</span>
          <Button variant="outline" className="text-gray-700 bg-white" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}

      {/* Seller Detail Dialog */}
      <SellerDetailDialog sellerId={selectedSellerId} onClose={() => setSelectedSellerId(null)} />

      {/* Reject/Deactivate Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog(d => ({ ...d, open: o }))}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>停用賣家帳號</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-600">停用 <strong>{rejectDialog.sellerName}</strong> 的賣家資格，其所有商品將自動下架，並通知申請人。</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">拒絕/停用原因（選填，將發送給用戶）</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] resize-none bg-white text-gray-900"
                rows={3}
                placeholder="例：資料不完整、違反平台規則..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialog(d => ({ ...d, open: false }))}>取消</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate({ sellerId: rejectDialog.sellerId, approve: false, rejectReason: rejectReason.trim() || undefined })}
            >
              {approveMutation.isPending ? "處理中..." : "確認停用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Suspend Dialog */}
      <Dialog open={suspendDialog.open} onOpenChange={(o) => setSuspendDialog(d => ({ ...d, open: o }))}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-orange-500" />凍結賣家帳號</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <p>凍結 <strong>{suspendDialog.sellerName}</strong> 後：</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                <li>所有上架中的商品將自動下架</li>
                <li>賣家無法新增或重新上架商品</li>
                <li>系統將發送凍結通知給賣家</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">凍結原因 <span className="text-red-500">*</span></label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white text-gray-900"
                rows={3}
                placeholder="例：涉嫌售賣假貨、多次投訴、違反平台規則..."
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSuspendDialog(d => ({ ...d, open: false }))}>取消</Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={suspendMutation.isPending || !suspendReason.trim()}
              onClick={() => suspendMutation.mutate({ sellerProfileId: suspendDialog.sellerId, reason: suspendReason.trim() })}
            >
              {suspendMutation.isPending ? "處理中..." : "確認凍結"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Unsuspend Dialog */}
      <Dialog open={unsuspendDialog.open} onOpenChange={(o) => setUnsuspendDialog(d => ({ ...d, open: o }))}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldOff className="w-5 h-5 text-blue-500" />解凍賣家帳號</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p>確認解凍 <strong>{unsuspendDialog.sellerName}</strong>？</p>
              <p className="mt-1 text-xs">解凍後賣家可重新上架商品，系統將發送解凍通知。</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUnsuspendDialog(d => ({ ...d, open: false }))}>取消</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={unsuspendMutation.isPending}
              onClick={() => unsuspendMutation.mutate({ sellerProfileId: unsuspendDialog.sellerId })}
            >
              {unsuspendMutation.isPending ? "處理中..." : "確認解凍"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// BANNERS TAB
// ============================================================
function DisputesTab() {
  const [page, setPage] = useState(1);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [resolution, setResolution] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [outcome, setOutcome] = useState<"refund_buyer" | "release_seller" | "partial">("refund_buyer");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const utils = trpc.useUtils();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = trpc.marketplace.adminGetDisputes.useQuery({ page, pageSize: 20, search: debouncedSearch || undefined, status: statusFilter });
  const setPriorityMutation = trpc.marketplace.adminSetDisputePriority.useMutation({
    onSuccess: () => utils.marketplace.adminGetDisputes.invalidate(),
    onError: (e) => toast.error('設定優先級失敗：' + e.message),
  });
  const resolveMutation = trpc.marketplace.adminResolveDispute.useMutation({
    onSuccess: () => {
      toast.success("✅ 爭議已處理");
      setSelectedDispute(null);
      setResolution("");
      setAdminNote("");
      utils.marketplace.adminGetDisputes.invalidate();
      utils.marketplace.adminGetOrders.invalidate();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });;

  if (isLoading) return <div className="py-8 text-center text-gray-500">載入中...</div>;

  const disputes = data?.orders ?? [];
  const filteredDisputes = (priorityFilter === "all" ? disputes
    : disputes.filter((o: any) => (o.disputePriority ?? "medium") === priorityFilter))
    // Sort by urgency: expired cooling period first, then by hours remaining (ascending), then by dispute opened date
    .slice().sort((a: any, b: any) => {
      const getUrgencyScore = (order: any) => {
        if (!order.payoutHoldUntil || order.disputeResolvedAt) return 9999; // resolved or no hold = lowest urgency
        const msLeft = new Date(order.payoutHoldUntil).getTime() - Date.now();
        if (msLeft <= 0) return -1; // expired = highest urgency
        return msLeft; // sort by time remaining ascending
      };
      return getUrgencyScore(a) - getUrgencyScore(b);
    });

  const priorityConfig = {
    high: { label: "高", color: "bg-red-100 text-red-700 border-red-300" },
    medium: { label: "中", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
    low: { label: "低", color: "bg-green-100 text-green-700 border-green-300" },
  };

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-0">
        {([['pending', '待處理', 'text-red-600 border-red-500'], ['resolved', '已解決', 'text-green-600 border-green-500'], ['all', '全部', 'text-[#06038d] border-[#06038d]']] as const).map(([val, label, activeClass]) => (
          <button
            key={val}
            onClick={() => { setStatusFilter(val); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === val
                ? activeClass
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {label}
            {val === 'pending' && (data?.total ?? 0) > 0 && statusFilter === 'pending' && (
              <span className="ml-1.5 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{data?.total ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600 font-medium">優先級：</span>
          {(["all", "high", "medium", "low"] as const).map(p => (
            <Button key={p} size="sm" variant={priorityFilter === p ? "default" : "outline"}
              onClick={() => setPriorityFilter(p)}
              className={priorityFilter === p ? "bg-[#06038d] text-white" : "text-gray-700 bg-white"}>
              {p === "all" ? "全部" : priorityConfig[p].label}
            </Button>
          ))}
          <div className="relative ml-2">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <Input
              className="pl-8 h-8 w-52 text-sm bg-white text-gray-900"
              placeholder="搜尋訂單號 / 買家姓名"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <span className="text-sm text-gray-600">共 {data?.total ?? 0} 筆{statusFilter === 'pending' ? '待處理' : statusFilter === 'resolved' ? '已解決' : ''}爭議</span>
      </div>

      {filteredDisputes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p>{statusFilter === 'resolved' ? '目前沒有已解決的爭議記錄' : statusFilter === 'all' ? '目前沒有任何爭議記錄' : '目前沒有待處理的爭議 🎉'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDisputes.map((order: any) => {
            const priority = (order.disputePriority ?? "medium") as "high" | "medium" | "low";
            const pCfg = priorityConfig[priority];
            return (
            <div key={order.id} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#06038d] to-[#1a17a0]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white text-sm font-semibold font-mono">{order.orderNo}</span>
                  {order.disputeResolvedAt ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-200 text-green-900">已解決</span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-200 text-red-900">爭議中</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    priority === 'high' ? 'bg-red-300 text-red-900' :
                    priority === 'medium' ? 'bg-yellow-200 text-yellow-900' :
                    'bg-green-200 text-green-900'
                  }`}>優先級：{pCfg.label}</span>
                  {/* Priority toggle buttons */}
                  <div className="flex gap-0.5">
                    {(["high", "medium", "low"] as const).map(p => (
                      <button key={p} title={priorityConfig[p].label}
                        disabled={setPriorityMutation.isPending}
                        onClick={() => setPriorityMutation.mutate({ orderId: order.id, priority: p })}
                        className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                          priority === p ? 'bg-white text-[#06038d] font-bold border-white' : 'border-white/40 text-white/70 hover:border-white'
                        }`}>
                        {priorityConfig[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {order.disputeResolvedAt ? (
                    <span className="text-green-300 text-xs">解決：{new Date(order.disputeResolvedAt).toLocaleDateString('zh-HK')}</span>
                  ) : order.disputeOpenedAt ? (
                    <span className="text-red-300 text-xs">申請：{new Date(order.disputeOpenedAt).toLocaleDateString('zh-HK')}</span>
                  ) : null}
                  <span className="text-yellow-300 text-xs font-semibold">HKD {parseFloat(order.subtotalHkd ?? '0').toFixed(2)}</span>
                </div>
              </div>
              {/* Payout Hold Urgency Banner */}
              {!order.disputeResolvedAt && order.payoutHoldUntil && (() => {
                const holdUntil = new Date(order.payoutHoldUntil);
                const now = new Date();
                const msLeft = holdUntil.getTime() - now.getTime();
                const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
                const isExpired = msLeft <= 0;
                const isUrgent = !isExpired && hoursLeft <= 6;
                const isWarning = !isExpired && hoursLeft <= 24;
                return (
                  <div className={`px-4 py-2 flex items-center gap-2 text-xs font-medium ${
                    isExpired ? 'bg-red-600 text-white' :
                    isUrgent ? 'bg-orange-100 text-orange-800 border-b border-orange-200' :
                    isWarning ? 'bg-yellow-50 text-yellow-800 border-b border-yellow-200' :
                    'bg-blue-50 text-blue-700 border-b border-blue-100'
                  }`}>
                    <span>{isExpired ? '🔴' : isUrgent ? '⚠️' : isWarning ? '⏰' : '🕐'}</span>
                    <span>
                      {isExpired
                        ? `冷靜期已到期！應於 ${holdUntil.toLocaleString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 放款，請立即處理爭議`
                        : isUrgent
                        ? `緊急：冷靜期將於 ${holdUntil.toLocaleString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 到期（還有 ${hoursLeft} 小時），請優先處理`
                        : `冷靜期截止：${holdUntil.toLocaleString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}（還有 ${hoursLeft} 小時）`
                      }
                    </span>
                  </div>
                );
              })()}
              {/* Three-column content */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 bg-white">
                {/* Col 1: Product */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">商品資料</p>
                  <div className="flex items-start gap-3">
                    {(() => {
                      try {
                        const imgs = typeof order.listingImages === 'string' ? JSON.parse(order.listingImages) : order.listingImages;
                        const firstImg = Array.isArray(imgs) ? imgs[0] : null;
                        if (firstImg) return <img src={firstImg} alt="" className="w-14 h-16 object-cover rounded-md border border-gray-200 flex-shrink-0" />;
                      } catch {}
                      return <div className="w-14 h-16 bg-gray-100 rounded-md border border-gray-200 flex-shrink-0 flex items-center justify-center"><span className="text-gray-300 text-xs">無圖</span></div>;
                    })()}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{order.listingTitle ?? '商品'}</p>
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                        <p>金額：HKD {parseFloat(order.subtotalHkd ?? '0').toFixed(2)}</p>
                        <p>付款：{order.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK'}</p>
                        {order.shippedAt && <p>出貨：{new Date(order.shippedAt).toLocaleDateString('zh-HK')}</p>}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Col 2: Dispute reason */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">爭議詳情</p>
                  {order.disputeReason ? (
                    <p className="text-xs text-gray-700 line-clamp-4">{order.disputeReason}</p>
                  ) : (
                    <p className="text-xs text-gray-400">未提供原因</p>
                  )}
                  {order.buyerName && (
                    <p className="text-xs text-gray-600 mt-2">
                      買家：<span className="font-medium text-gray-900">{order.buyerName}</span>
                      {order.buyerEmail && <span className="ml-1 text-gray-400">({order.buyerEmail})</span>}
                    </p>
                  )}
                </div>
                {/* Col 3: Actions */}
                <div className="px-4 py-3 flex flex-col justify-between">
                  <div className="space-y-0.5 text-xs text-gray-600">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">賣家資料</p>
                    <p>{order.sellerType === 'platform' ? '平台自有商品' : (order.sellerName ?? '不明')}</p>
                    {order.trackingNumber && <p>追蹤號：{order.trackingNumber}</p>}
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      className="text-xs w-full sm:w-auto bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                      onClick={() => { setSelectedDispute(order); setResolution(""); setOutcome("refund_buyer"); }}
                    >
                      <Edit className="w-3 h-3 mr-1" />處理爭議
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
          {/* end disputes map */}
        </div>
      )}

      {/* Resolve Dispute Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={(o) => !o && setSelectedDispute(null)}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              處理爭議 #{selectedDispute?.orderNo}
            </DialogTitle>
          </DialogHeader>
          {selectedDispute && (
            <div className="space-y-4 py-2">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-red-700 mb-1">爭議原因：</p>
                <p className="text-gray-700">{selectedDispute.disputeReason}</p>
              </div>
              {/* Evidence Images / Videos */}
              {selectedDispute.disputeEvidenceUrls && (() => {
                try {
                  const urls: string[] = JSON.parse(selectedDispute.disputeEvidenceUrls);
                  if (urls.length > 0) return (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">買家提供的證據：</p>
                      <div className="flex flex-wrap gap-2">
                        {urls.map((url, i) => {
                          // Detect video by URL extension
                          const isVideo = /\.(mp4|webm|mov|avi)$/i.test(url);
                          return isVideo ? (
                            <div key={i} className="relative w-32 h-24 rounded-md overflow-hidden border border-border bg-black">
                              <video
                                src={url}
                                className="w-full h-full object-cover"
                                controls
                                playsInline
                              />
                              <a href={url} target="_blank" rel="noopener noreferrer" className="absolute top-0.5 right-0.5 bg-black/60 text-white text-xs px-1 rounded hover:bg-black/80">開新標籤</a>
                            </div>
                          ) : (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity">
                              <img src={url} alt={`證據 ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
              <div className="space-y-2">
                <Label>處理結果</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund_buyer">退款給買家（取消訂單）</SelectItem>
                    <SelectItem value="release_seller">放款給賣家（完成訂單）</SelectItem>
                    <SelectItem value="partial">部分處理（需手動操作）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>處理說明</Label>
                <Textarea
                  placeholder="請說明處理決定的原因（至少 5 字）"
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>管理員備註（內部，不通知用戶）</Label>
                <Textarea
                  placeholder="可記錄內部處理筆記、跟進事項等（選填）"
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={2}
                />
              </div>
              {/* 爭議歷史記錄 */}
              {selectedDispute?.disputeResolutionHistory && (() => {
                try {
                  const history: Array<{timestamp: string; outcome: string; resolution: string; adminNote?: string}> = JSON.parse(selectedDispute.disputeResolutionHistory);
                  if (history.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">欷史處理記錄</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {history.map((entry, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-medium px-1.5 py-0.5 rounded text-white text-[10px] ${
                                entry.outcome === 'refund_buyer' ? 'bg-red-500' :
                                entry.outcome === 'release_seller' ? 'bg-green-600' : 'bg-amber-500'
                              }`}>
                                {entry.outcome === 'refund_buyer' ? '退款買家' : entry.outcome === 'release_seller' ? '放款賣家' : '部分處理'}
                              </span>
                              <span className="text-gray-400">{new Date(entry.timestamp).toLocaleString('zh-HK')}</span>
                            </div>
                            <p className="text-gray-700">{entry.resolution}</p>
                            {entry.adminNote && <p className="text-gray-500 mt-1 italic">備註：{entry.adminNote}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                {outcome === "refund_buyer" && "選擇退款後，訂單將標記為已取消，賣家不會收到款項。"}
                {outcome === "release_seller" && "選擇放款後，系統將自動轉帳給賣家，訂單標記為已完成。"}
                {outcome === "partial" && "部分處理需要管理員手動操作，訂單將標記為已完成。"}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedDispute(null)}>取消</Button>
            <Button
              className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
              disabled={resolveMutation.isPending || resolution.trim().length < 5}
              onClick={() => resolveMutation.mutate({
                orderId: selectedDispute.id,
                resolution: resolution.trim(),
                outcome,
              })}
            >
              {resolveMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</>
                : <><CheckCircle className="w-4 h-4 mr-2" />確認處理</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BannersTab() {
  const { data: banners, refetch } = trpc.marketplace.adminGetBanners.useQuery();
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', subtitle: '', cta: '立即選購', badge: '', emoji: '🏆', gradient: 'from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]', accentColor: '#FFD700', imageUrl: '', sortOrder: 0, isActive: true });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = trpc.marketplace.adminCreateBanner.useMutation({ onSuccess: () => { toast.success('廣告橫幅已建立'); refetch(); setShowForm(false); resetForm(); }, onError: (e) => toast.error(parseApiError(e)) });
  const updateMutation = trpc.marketplace.adminUpdateBanner.useMutation({ onSuccess: () => { toast.success('廣告橫幅已更新'); refetch(); setEditingBanner(null); setShowForm(false); resetForm(); }, onError: (e) => toast.error(parseApiError(e)) });
  const deleteMutation = trpc.marketplace.adminDeleteBanner.useMutation({ onSuccess: () => { toast.success('廣告橫幅已刪除'); refetch(); }, onError: (e) => toast.error(parseApiError(e)) });

  const resetForm = () => setForm({ title: '', subtitle: '', cta: '立即選購', badge: '', emoji: '🏆', gradient: 'from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]', accentColor: '#FFD700', imageUrl: '', sortOrder: 0, isActive: true });

  const handleEdit = (banner: any) => {
    setEditingBanner(banner);
    setForm({ title: banner.title, subtitle: banner.subtitle, cta: banner.cta, badge: banner.badge, emoji: banner.emoji, gradient: banner.gradient, accentColor: banner.accentColor, imageUrl: banner.imageUrl || '', sortOrder: banner.sortOrder, isActive: banner.isActive });
    setShowForm(true);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) { toast.error('請選擇圖片檔案'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('圖片不能超過 10MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-marketplace-image', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('上傳失敗');
      const { url } = await res.json();
      setForm(p => ({ ...p, imageUrl: url }));
      toast.success('背景圖片已上傳');
    } catch (e: any) {
      toast.error(e.message || '圖片上傳失敗');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error('請填寫標題'); return; }
    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">廣告橫幅管理</h3>
        <Button size="sm" className="bg-[#06038d] text-white" onClick={() => { resetForm(); setEditingBanner(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />新增橫幅
        </Button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-sm text-[#06038d]">{editingBanner ? '編輯橫幅' : '新增橫幅'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">標題 *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="橫幅標題" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">副標題</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.subtitle} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))} placeholder="副標題文字" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">按鈕文字</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.cta} onChange={e => setForm(p => ({ ...p, cta: e.target.value }))} placeholder="立即選購" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">標籤文字（可留空）</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.badge} onChange={e => setForm(p => ({ ...p, badge: e.target.value }))} placeholder="PSA 10" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Emoji 圖示</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} placeholder="🏆" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">排序（數字越小越前）</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          {/* Background image upload */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">背景圖片（可選，覆蓋漸層背景）</label>
            {form.imageUrl ? (
              <div className="relative inline-block">
                <img src={form.imageUrl} alt="背景預覽" className="w-full max-w-xs h-20 object-cover rounded-lg border border-gray-200" />
                <button type="button" onClick={() => setForm(p => ({ ...p, imageUrl: '' }))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-[#06038d]/30 rounded-lg p-3 text-center cursor-pointer hover:border-[#06038d]/60 hover:bg-blue-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">上傳中...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs">點擊上傳背景圖片（建議 1200×300px）</span>
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">啟用</label>
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className={`w-10 h-5 rounded-full transition-colors relative ${form.isActive ? 'bg-[#FEDD00]' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5 left-0.5 bg-[#06038d]' : 'left-0.5 bg-white'}`} />
            </button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="bg-[#06038d] text-white" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingBanner ? '儲存' : '建立')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditingBanner(null); resetForm(); }}>取消</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {!banners?.length ? (
          <div className="text-center py-8 text-gray-400 text-sm">尚無廣告橫幅，點擊「新增橫幅」開始</div>
        ) : banners.map((banner: any) => (
          <div key={banner.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Preview */}
            <div className={`relative h-16 bg-gradient-to-r ${banner.gradient} flex items-center px-4 gap-3`} style={banner.imageUrl ? { backgroundImage: `url(${banner.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
              {banner.imageUrl && <div className="absolute inset-0 bg-black/40" />}
              <span className="relative text-lg">{banner.emoji}</span>
              <div className="relative">
                <p className="text-white font-bold text-sm">{banner.title}</p>
                {banner.subtitle && <p className="text-white/70 text-xs">{banner.subtitle}</p>}
              </div>
              {!banner.isActive && <span className="relative ml-auto text-xs bg-gray-500/80 text-white px-2 py-0.5 rounded">已停用</span>}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
              <span className="text-xs text-gray-400 flex-1">排序: {banner.sortOrder} · ID: {banner.id}</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleEdit(banner)}>
                <Edit className="w-3 h-3 mr-1" />編輯
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => { if (confirm('確定刪除此橫幅？')) deleteMutation.mutate({ id: banner.id }); }}>
                <Trash2 className="w-3 h-3 mr-1" />刪除
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesReportTab() {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = trpc.marketplace.adminGetSalesReport.useQuery({ months });

  // Fee detail drill-down state
  const [feeDetailMonth, setFeeDetailMonth] = useState<string | null>(null);
  const [feeDetailPage, setFeeDetailPage] = useState(1);
  const { data: feeDetailData, isLoading: feeDetailLoading } = trpc.marketplace.adminGetFeeDetails.useQuery(
    { yearMonth: feeDetailMonth!, page: feeDetailPage, pageSize: 50 },
    { enabled: !!feeDetailMonth }
  );

  // Transaction detail drill-down state
  const [txDetailMonth, setTxDetailMonth] = useState<string | null>(null);
  const [txDetailPage, setTxDetailPage] = useState(1);
  const { data: txDetailData, isLoading: txDetailLoading } = trpc.marketplace.adminGetMonthlyTransactions.useQuery(
    { yearMonth: txDetailMonth!, page: txDetailPage, pageSize: 100 },
    { enabled: !!txDetailMonth }
  );
  // Active view tab: 'overview' | 'cashflow' | 'payment' | 'monthly'
  const [viewTab, setViewTab] = useState<'overview' | 'cashflow' | 'payment' | 'monthly'>('overview');

  const fmtHkd = (v: number) => v.toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtYearMonth = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}年${parseInt(m)}月`;
  };
  const fmtYearMonthShort = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y.slice(2)}/${m}`;
  };

  const overall = data?.overall;
  const monthly = data?.monthly ?? [];

  // Derived financial metrics
  const totalOrders = overall?.totalOrders ?? 0;
  const totalSales = overall?.totalSalesHkd ?? 0;
  const totalFees = overall?.totalFeesHkd ?? 0;
  const platformSales = overall?.platformSalesHkd ?? 0;
  const platformIncome = overall?.platformIncomeHkd ?? (platformSales + totalFees);
  const paidOut = overall?.paidOutHkd ?? 0;
  const pendingPayout = overall?.pendingPayoutHkd ?? 0;
  const refundedAmount = overall?.refundedAmountHkd ?? 0;
  const platformNetProfit = overall?.platformNetProfitHkd ?? (platformIncome - refundedAmount);
  const netRevenue = overall?.netRevenueHkd ?? (totalSales - refundedAmount);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const feeRate = overall?.sellerSalesHkd && overall.sellerSalesHkd > 0
    ? (totalFees / overall.sellerSalesHkd) * 100
    : 0;

  // PSA Grading Revenue
  const gradingRevenue = (overall as any)?.gradingRevenueHkd ?? 0;
  const gradingOrderCount = (overall as any)?.gradingCount ?? 0;

  // Auction vs Direct breakdown
  const auctionSales = (overall as any)?.auctionSalesHkd ?? 0;
  const auctionCount = (overall as any)?.auctionCount ?? 0;
  const auctionPlatformSales = (overall as any)?.auctionPlatformSalesHkd ?? 0;
  const auctionSellerFees = (overall as any)?.auctionSellerFeesHkd ?? 0;
  const auctionIncome = auctionPlatformSales + auctionSellerFees;
  const directSales = (overall as any)?.directSalesHkd ?? 0;
  const directCount = (overall as any)?.directCount ?? 0;
  const directPlatformSales = (overall as any)?.directPlatformSalesHkd ?? 0;
  const directSellerFees = (overall as any)?.directSellerFeesHkd ?? 0;
  const directIncome = directPlatformSales + directSellerFees;

  // Order source breakdown pie data
  const orderSourcePieData = [
    { name: '直購/出價', value: directSales, count: directCount, color: '#3b82f6' },
    { name: '拍賣', value: auctionSales, count: auctionCount, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Chart data (reversed for chronological order)
  const chartData = [...monthly].reverse().map(r => ({
    month: fmtYearMonthShort(r.yearMonth),
    銷售總額: parseFloat(r.totalSalesHkd.toFixed(2)),
    平台直售: parseFloat(r.platformSalesHkd.toFixed(2)),
    C2C銷售: parseFloat(r.sellerSalesHkd.toFixed(2)),
    手續費: parseFloat(r.sellerFeesHkd.toFixed(2)),
    平台收入: parseFloat(((r as any).platformIncomeHkd ?? (r.platformSalesHkd + r.sellerFeesHkd)).toFixed(2)),
    退款: parseFloat(((r as any).refundedAmountHkd ?? 0).toFixed(2)),
    拍賣銷售: parseFloat(((r as any).auctionSalesHkd ?? 0).toFixed(2)),
    直購銷售: parseFloat(((r as any).directSalesHkd ?? 0).toFixed(2)),
  }));

  // Payment method pie data
  const paymentPieData = [
    { name: 'Stripe', value: overall?.stripeSalesHkd ?? 0, color: '#6366f1' },
    { name: '支付寶 HK', value: overall?.alipaySalesHkd ?? 0, color: '#06b6d4' },
  ].filter(d => d.value > 0);

  // Income breakdown pie data
  const incomePieData = [
    { name: '平台直售', value: platformSales, color: '#3b82f6' },
    { name: 'C2C 手續費', value: totalFees, color: '#10b981' },
    { name: 'PSA 代客鑑定', value: gradingRevenue, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  const reportDate = new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });

  const viewTabs = [
    { key: 'overview' as const, label: '財務總覽' },
    { key: 'cashflow' as const, label: '收支分析' },
    { key: 'payment' as const, label: '付款方式' },
    { key: 'monthly' as const, label: '月度明細' },
  ];

  return (
    <div className="space-y-5">
      {/* ── Report Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900">財務報告</h2>
          <p className="text-sm text-gray-500 mt-0.5">報告日期：{reportDate} · 顯示最近
            <Select value={String(months)} onValueChange={v => setMonths(Number(v))}>
              <SelectTrigger className="inline-flex h-6 w-20 text-xs px-1.5 mx-1 bg-white text-gray-700 border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 個月</SelectItem>
                <SelectItem value="6">6 個月</SelectItem>
                <SelectItem value="12">12 個月</SelectItem>
                <SelectItem value="24">24 個月</SelectItem>
                <SelectItem value="36">36 個月</SelectItem>
              </SelectContent>
            </Select>
            數據
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
        <Button
          size="sm"
          variant="outline"
          className="border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white self-start sm:self-auto transition-colors"
          disabled={monthly.length === 0 || !overall}
          onClick={async () => {
            const dateStr = new Date().toISOString().split('T')[0];
            const url = `/api/admin/financial-report-pdf?months=${months}`;
            try {
              toast.loading('正在生成 PDF，請稍候...', { id: 'pdf-export' });
              const res = await fetch(url, { credentials: 'include' });
              if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error', detail: '' }));
                const detail = err.detail ? ` (${err.detail})` : '';
                throw new Error((err.error || `HTTP ${res.status}`) + detail);
              }
              const blob = await res.blob();
              const objectUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = objectUrl;
              a.download = `BOXIUM_財務報告_${dateStr}.pdf`;
              a.click();
              URL.revokeObjectURL(objectUrl);
              toast.success('PDF 已成功下載', { id: 'pdf-export' });
            } catch (e: any) {
              toast.error(`PDF 生成失敗：${e.message}`, { id: 'pdf-export' });
            }
          }}
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />匯出 PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50 self-start sm:self-auto"
          disabled={monthly.length === 0}
          onClick={() => {
            const rows = monthly.map(r => ({
              '月份': fmtYearMonth(r.yearMonth),
              '销售總額 (HKD)': r.totalSalesHkd.toFixed(2),
              '退款金額 (HKD)': ((r as any).refundedAmountHkd ?? 0).toFixed(2),
              '淨收入 (HKD)': ((r as any).netRevenueHkd ?? r.totalSalesHkd).toFixed(2),
              '平台直售 (HKD)': r.platformSalesHkd.toFixed(2),
              'C2C 销售 (HKD)': r.sellerSalesHkd.toFixed(2),
              '手續費收入 (HKD)': r.sellerFeesHkd.toFixed(2),
              'PSA 鑑定收入 (HKD)': ((r as any).gradingRevenueHkd ?? 0).toFixed(2),
              '平台收入合計 (HKD)': ((r as any).platformIncomeHkd ?? (r.platformSalesHkd + r.sellerFeesHkd)).toFixed(2),
              '訂單數': r.orderCount,
              'Stripe 訂單': r.stripeCount,
              '支付寶 訂單': r.alipayCount,
              '退款筆數': (r as any).refundedCount ?? 0,
              '取消筆數': (r as any).cancelledCount ?? 0,
            }));
            exportToCSV(rows, `BOXIUM財務報告_${new Date().toISOString().slice(0,10)}.csv`);
          }}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />匯出 CSV
        </Button>
        </div>
      </div>

      {/* ── Top KPI Strip ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Platform Net Income - Hero Card */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-[#06038d] to-[#1a17b3] rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-white/15"><TrendingUp className="w-4 h-4 text-white" /></div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">平台淨利潤</span>
          </div>
          <p className="text-xs text-white/70 mb-1">平台收入 − 退款</p>
          <p className="text-2xl font-bold">HKD {fmtHkd(platformNetProfit)}</p>
          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/70">
            <span>收入 HKD {fmtHkd(platformIncome)}</span>
            <span>退款 -HKD {fmtHkd(refundedAmount)}</span>
          </div>
        </div>

        {/* GMV */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-gray-100"><DollarSign className="w-4 h-4 text-gray-600" /></div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">GMV</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">平台交易總額</p>
          <p className="text-xl font-bold text-gray-900">HKD {fmtHkd(totalSales)}</p>
          <p className="text-xs text-gray-400 mt-1">{totalOrders} 筆已付款訂單</p>
        </div>

        {/* Pending Payout */}
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-amber-50"><Clock className="w-4 h-4 text-amber-600" /></div>
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">待放款</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">待放款給賣家</p>
          <p className="text-xl font-bold text-amber-700">HKD {fmtHkd(pendingPayout)}</p>
          <p className="text-xs text-gray-400 mt-1">{overall?.pendingPayoutCount ?? 0} 筆待處理</p>
        </div>

        {/* Paid Out */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-emerald-50"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">已放款</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">已放款給賣家</p>
          <p className="text-xl font-bold text-emerald-700">HKD {fmtHkd(paidOut)}</p>
          <p className="text-xs text-gray-400 mt-1">{overall?.paidOutCount ?? 0} 筆已完成</p>
        </div>
      </div>

      {/* ── Sub-navigation tabs ───────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {viewTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setViewTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewTab === t.key
                ? 'bg-white text-[#06038d] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────── */}
      {viewTab === 'overview' && (
        <div className="space-y-5">
          {/* Income Breakdown Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Income breakdown card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-800 mb-1">平台收入來源</p>
              <p className="text-xs text-gray-400 mb-4">平台直售 + C2C 手續費 + PSA 鑑定</p>
              {incomePieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" strokeWidth={2}>
                        {incomePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {incomePieData.map(d => (
                      <div key={d.name}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-xs text-gray-500">{d.name}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 pl-4">HKD {fmtHkd(d.value)}</p>
                        <p className="text-xs text-gray-400 pl-4">{platformIncome > 0 ? ((d.value / platformIncome) * 100).toFixed(1) : 0}%</p>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">合計</p>
                      <p className="text-sm font-bold text-[#06038d]">HKD {fmtHkd(platformIncome)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs">暫無數據</div>
              )}
            </div>

            {/* Revenue trend chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">月度銷售趨勢</p>
                  <p className="text-xs text-gray-400 mt-0.5">各收入來源月度走勢</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#06038d] inline-block rounded" />GMV</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />平台直售</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />平台收入</span>
                </div>
              </div>
              {!isLoading && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradGMV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06038d" stopOpacity={0.12}/>
                        <stop offset="95%" stopColor="#06038d" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `${v}`} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any) => [`HKD ${Number(v).toLocaleString('zh-HK', { minimumFractionDigits: 2 })}`, undefined]} />
                    <Area type="monotone" dataKey="銷售總額" stroke="#06038d" strokeWidth={2} fill="url(#gradGMV)" dot={false} />
                    <Line type="monotone" dataKey="平台直售" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="平台收入" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-[200px] text-gray-400 text-sm">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '暫無數據'}
                </div>
              )}
            </div>
          </div>

          {/* Auction vs Direct Breakdown Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Order source breakdown card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <Gavel className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-gray-800">訂單來源分佈</p>
              </div>
              <p className="text-xs text-gray-400 mb-4">拍賣 vs 直購/出價訂單比例</p>
              {orderSourcePieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie data={orderSourcePieData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" strokeWidth={2}>
                        {orderSourcePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {orderSourcePieData.map(d => (
                      <div key={d.name}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-xs text-gray-500">{d.name}</span>
                          <span className="text-xs text-gray-400 ml-auto">{d.count} 筆</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 pl-4">HKD {fmtHkd(d.value)}</p>
                        <p className="text-xs text-gray-400 pl-4">{totalSales > 0 ? ((d.value / totalSales) * 100).toFixed(1) : 0}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs">暫無數據</div>
              )}
            </div>

            {/* Auction vs Direct income detail card */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-[#06038d]" />
                <p className="text-sm font-semibold text-gray-800">拍賣 vs 直購平台收入明細</p>
              </div>
              <p className="text-xs text-gray-400 mb-4">各訂單來源對平台的收入貢獻</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Direct purchase column */}
                <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-bold text-blue-800">直購 / 出價</p>
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{directCount} 筆</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">銷售總額</span>
                      <span className="text-sm font-semibold text-gray-800">HKD {fmtHkd(directSales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">平台直售</span>
                      <span className="text-sm font-semibold text-gray-800">HKD {fmtHkd(directPlatformSales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">C2C 手續費</span>
                      <span className="text-sm font-semibold text-gray-800">HKD {fmtHkd(directSellerFees)}</span>
                    </div>
                    <div className="pt-2 border-t border-blue-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-700">平台收入</span>
                      <span className="text-sm font-bold text-blue-700">HKD {fmtHkd(directIncome)}</span>
                    </div>
                  </div>
                </div>
                {/* Auction column */}
                <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Gavel className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-bold text-amber-800">拍賣</p>
                    <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{auctionCount} 筆</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">銷售總額</span>
                      <span className="text-sm font-semibold text-gray-800">HKD {fmtHkd(auctionSales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">平台直售</span>
                      <span className="text-sm font-semibold text-gray-800">HKD {fmtHkd(auctionPlatformSales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">C2C 手續費</span>
                      <span className="text-sm font-semibold text-gray-800">HKD {fmtHkd(auctionSellerFees)}</span>
                    </div>
                    <div className="pt-2 border-t border-amber-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-700">平台收入</span>
                      <span className="text-sm font-bold text-amber-700">HKD {fmtHkd(auctionIncome)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary metrics row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">平均訂單金額 (AOV)</p>
              <p className="text-lg font-bold text-gray-800">HKD {fmtHkd(avgOrderValue)}</p>
              <p className="text-xs text-gray-400 mt-0.5">已付款訂單均值</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">C2C 手續費率</p>
              <p className="text-lg font-bold text-gray-800">{feeRate.toFixed(2)}%</p>
              <p className="text-xs text-gray-400 mt-0.5">手續費 / C2C 銷售</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">退款率</p>
              <p className={`text-lg font-bold ${refundedAmount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {totalSales > 0 ? ((refundedAmount / totalSales) * 100).toFixed(2) : '0.00'}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{overall?.refundedCount ?? 0} 筆 · HKD {fmtHkd(refundedAmount)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">取消訂單</p>
              <p className="text-lg font-bold text-orange-600">{overall?.cancelledCount ?? 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">已取消訂單數</p>
            </div>
          </div>
        </div>
      )}

      {/* ── CASHFLOW TAB ──────────────────────────────────── */}
      {viewTab === 'cashflow' && (
        <div className="space-y-5">
          {/* Income vs Outcome Statement */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <p className="text-sm font-bold text-gray-800">平台損益表</p>
              <p className="text-xs text-gray-400 mt-0.5">收入與支出核對（累計期間）</p>
            </div>
            <div className="divide-y divide-gray-100">
              {/* INCOME section */}
              <div className="px-5 py-3 bg-emerald-50/40">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3">▲ 收入 (INCOME)</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">平台直售收入</p>
                      <p className="text-xs text-gray-400">平台自有商品銷售</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">HKD {fmtHkd(platformSales)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">C2C 手續費收入</p>
                      <p className="text-xs text-gray-400">C2C 交易手續費（費率 {feeRate.toFixed(2)}%）</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">HKD {fmtHkd(totalFees)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">PSA 代客鑑定收入</p>
                      <p className="text-xs text-gray-400">PSA 鑑定服務費用（{gradingOrderCount} 筆）</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">HKD {fmtHkd(gradingRevenue)}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                    <p className="text-sm font-bold text-emerald-800">平台收入合計</p>
                    <p className="text-base font-bold text-emerald-700">HKD {fmtHkd(platformIncome)}</p>
                  </div>
                </div>
              </div>

              {/* OUTCOME section */}
              <div className="px-5 py-3 bg-red-50/30">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">▼ 支出 (OUTCOME)</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">已放款給賣家</p>
                      <p className="text-xs text-gray-400">{overall?.paidOutCount ?? 0} 筆 C2C 訂單已完成放款</p>
                    </div>
                    <p className="text-sm font-semibold text-red-600">-HKD {fmtHkd(paidOut)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">退款支出</p>
                      <p className="text-xs text-gray-400">{overall?.refundedCount ?? 0} 筆退款</p>
                    </div>
                    <p className="text-sm font-semibold text-red-600">-HKD {fmtHkd(refundedAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-red-200">
                    <p className="text-sm font-bold text-red-700">支出合計</p>
                    <p className="text-base font-bold text-red-600">-HKD {fmtHkd(paidOut + refundedAmount)}</p>
                  </div>
                </div>
              </div>

              {/* PENDING section */}
              <div className="px-5 py-3 bg-amber-50/40">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">⏳ 待結算 (PENDING)</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">待放款給賣家</p>
                      <p className="text-xs text-gray-400">{overall?.pendingPayoutCount ?? 0} 筆 C2C 訂單待放款</p>
                    </div>
                    <p className="text-sm font-semibold text-amber-700">HKD {fmtHkd(pendingPayout)}</p>
                  </div>
                </div>
              </div>

              {/* NET PROFIT */}
              <div className="px-5 py-4 bg-[#06038d]/[0.04]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-[#06038d]">平台淨利潤</p>
                    <p className="text-xs text-gray-500 mt-0.5">平台收入 − 退款（不含待放款）</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#06038d]">HKD {fmtHkd(platformNetProfit)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">利潤率 {platformIncome > 0 ? ((platformNetProfit / platformIncome) * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly income vs payout bar chart */}
          {!isLoading && chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-800 mb-1">月度平台收入 vs 退款</p>
              <p className="text-xs text-gray-400 mb-4">按月對比平台收入與退款支出</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any) => [`HKD ${Number(v).toLocaleString('zh-HK', { minimumFractionDigits: 2 })}`, undefined]} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="平台收入" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="退款" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="手續費" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENT METHOD TAB ────────────────────────────── */}
      {viewTab === 'payment' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Stripe breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100 flex items-center gap-2">
                <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
                  <CreditCard className="w-3 h-3 text-white" />
                </div>
                <p className="text-sm font-bold text-indigo-800">Stripe 付款</p>
                <span className="ml-auto text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{overall?.stripeCount ?? 0} 筆</span>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">Stripe 交易總額</p>
                    <p className="text-xs text-gray-400">所有 Stripe 付款訂單</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">HKD {fmtHkd(overall?.stripeSalesHkd ?? 0)}</p>
                </div>
                <div className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">其中：平台直售</p>
                    <p className="text-xs text-gray-400">Stripe 付款的平台商品</p>
                  </div>
                  <p className="text-sm font-semibold text-blue-700">HKD {fmtHkd(overall?.stripePlatformSalesHkd ?? 0)}</p>
                </div>
                <div className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">其中：C2C 手續費</p>
                    <p className="text-xs text-gray-400">Stripe C2C 訂單手續費</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">HKD {fmtHkd(overall?.stripeSellerFeesHkd ?? 0)}</p>
                </div>
                <div className="px-5 py-3 bg-indigo-50/40 flex items-center justify-between">
                  <p className="text-sm font-bold text-indigo-800">Stripe 平台收入</p>
                  <p className="text-base font-bold text-indigo-700">HKD {fmtHkd((overall?.stripePlatformSalesHkd ?? 0) + (overall?.stripeSellerFeesHkd ?? 0))}</p>
                </div>
              </div>
            </div>

            {/* Alipay HK breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-cyan-50 px-5 py-3 border-b border-cyan-100 flex items-center gap-2">
                <div className="w-5 h-5 bg-cyan-600 rounded flex items-center justify-center">
                  <Banknote className="w-3 h-3 text-white" />
                </div>
                <p className="text-sm font-bold text-cyan-800">支付寶 HK 付款</p>
                <span className="ml-auto text-xs text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full">{overall?.alipayCount ?? 0} 筆</span>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">支付寶 HK 交易總額</p>
                    <p className="text-xs text-gray-400">所有支付寶 HK 付款訂單</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">HKD {fmtHkd(overall?.alipaySalesHkd ?? 0)}</p>
                </div>
                <div className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">其中：平台直售</p>
                    <p className="text-xs text-gray-400">支付寶 HK 付款的平台商品</p>
                  </div>
                  <p className="text-sm font-semibold text-blue-700">HKD {fmtHkd(overall?.alipayPlatformSalesHkd ?? 0)}</p>
                </div>
                <div className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">其中：C2C 手續費</p>
                    <p className="text-xs text-gray-400">支付寶 HK C2C 訂單手續費</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">HKD {fmtHkd(overall?.alipaySellerFeesHkd ?? 0)}</p>
                </div>
                <div className="px-5 py-3 bg-cyan-50/40 flex items-center justify-between">
                  <p className="text-sm font-bold text-cyan-800">支付寶 HK 平台收入</p>
                  <p className="text-base font-bold text-cyan-700">HKD {fmtHkd((overall?.alipayPlatformSalesHkd ?? 0) + (overall?.alipaySellerFeesHkd ?? 0))}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment method distribution pie */}
          {paymentPieData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">付款方式分佈（按交易金額）</p>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={3} stroke="#fff">
                      {paymentPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`HKD ${Number(v).toLocaleString('zh-HK', { minimumFractionDigits: 2 })}`, undefined]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-4">
                  {paymentPieData.map(d => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{d.name}</span>
                          <span className="text-sm font-bold text-gray-900">HKD {fmtHkd(d.value)}</span>
                        </div>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${totalSales > 0 ? (d.value / totalSales * 100) : 0}%`, background: d.color }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{totalSales > 0 ? ((d.value / totalSales) * 100).toFixed(1) : 0}% 佔比</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MONTHLY DETAIL TAB ────────────────────────────── */}
      {viewTab === 'monthly' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />載入中...</div>
          ) : monthly.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暫無銷售數據</p></div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide w-8"></th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">月份</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">GMV</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">退款</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">淨收入</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">平台直售</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">C2C 銷售</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">手續費</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide bg-emerald-50">平台收入</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">訂單數</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">環比</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthly.map((row, idx) => {
                    const prev = monthly[idx + 1];
                    const growth = prev && prev.totalSalesHkd > 0
                      ? ((row.totalSalesHkd - prev.totalSalesHkd) / prev.totalSalesHkd * 100)
                      : null;
                    const rowIncome = (row as any).platformIncomeHkd ?? (row.platformSalesHkd + row.sellerFeesHkd);
                    return (
                      <tr key={row.yearMonth} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-3 py-3.5">
                          <button
                            onClick={() => { setTxDetailMonth(row.yearMonth); setTxDetailPage(1); }}
                            className="p-1 rounded hover:bg-[#06038d]/10 text-[#06038d] transition-colors"
                            title="查看逐筆交易記錄"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-gray-800">{fmtYearMonth(row.yearMonth)}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-[#06038d]">HKD {fmtHkd(row.totalSalesHkd)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {(row as any).refundedAmountHkd > 0
                            ? <span className="text-red-600 font-medium">-HKD {fmtHkd((row as any).refundedAmountHkd)}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-700">HKD {fmtHkd((row as any).netRevenueHkd ?? row.totalSalesHkd)}</td>
                        <td className="px-4 py-3.5 text-right text-blue-700 font-medium">HKD {fmtHkd(row.platformSalesHkd)}</td>
                        <td className="px-4 py-3.5 text-right text-purple-700 font-medium">HKD {fmtHkd(row.sellerSalesHkd)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => { setFeeDetailMonth(row.yearMonth); setFeeDetailPage(1); }}
                            className="font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            HKD {fmtHkd(row.sellerFeesHkd)}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right bg-emerald-50/30">
                          <span className="font-bold text-emerald-700">HKD {fmtHkd(rowIncome)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-gray-700 font-medium">{row.orderCount}</td>
                        <td className="px-4 py-3.5 text-right">
                          {growth !== null ? (
                            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              growth >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
                            }`}>
                              {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(growth).toFixed(1)}%
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#06038d]/[0.04] border-t-2 border-[#06038d]/20">
                    <td className="px-3 py-3.5"></td>
                    <td className="px-4 py-3.5 font-bold text-gray-900 text-xs uppercase tracking-wide">合計</td>
                    <td className="px-4 py-3.5 text-right font-bold text-[#06038d]">HKD {fmtHkd(monthly.reduce((s, r) => s + r.totalSalesHkd, 0))}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-red-600">
                      {monthly.reduce((s, r) => s + ((r as any).refundedAmountHkd ?? 0), 0) > 0
                        ? `-HKD ${fmtHkd(monthly.reduce((s, r) => s + ((r as any).refundedAmountHkd ?? 0), 0))}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-700">HKD {fmtHkd(monthly.reduce((s, r) => s + ((r as any).netRevenueHkd ?? r.totalSalesHkd), 0))}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-blue-700">HKD {fmtHkd(monthly.reduce((s, r) => s + r.platformSalesHkd, 0))}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-purple-700">HKD {fmtHkd(monthly.reduce((s, r) => s + r.sellerSalesHkd, 0))}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">HKD {fmtHkd(monthly.reduce((s, r) => s + r.sellerFeesHkd, 0))}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right bg-emerald-50/30">
                      <span className="font-bold text-emerald-700">HKD {fmtHkd(monthly.reduce((s, r) => s + ((r as any).platformIncomeHkd ?? (r.platformSalesHkd + r.sellerFeesHkd)), 0))}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900">{monthly.reduce((s, r) => s + r.orderCount, 0)}</td>
                    <td className="px-4 py-3.5 text-right text-gray-300">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Transaction Detail Dialog ─────────────────────── */}
      <Dialog open={!!txDetailMonth} onOpenChange={open => { if (!open) setTxDetailMonth(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-[#1e2235] shadow-2xl" style={{background: '#0d0f1a'}}>
          {/* ── BOXIUM Header ── */}
          <div className="relative flex-shrink-0 px-6 py-4" style={{background: 'linear-gradient(135deg, #06038d 0%, #0a0570 50%, #06038d 100%)'}}>
            <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(45deg, #FEDD00 0, #FEDD00 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px'}} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-5 rounded-full" style={{background: '#FEDD00'}} />
                  <DialogTitle className="text-white font-bold text-lg tracking-wide">
                    {txDetailMonth ? fmtYearMonth(txDetailMonth) : ''} · 逐筆交易明細
                  </DialogTitle>
                </div>
                <DialogDescription className="text-white/50 text-xs pl-3">
                  顯示該月所有已付款、已出貨、已完成、已取消及退款訂單
                </DialogDescription>
              </div>
              <div className="text-right">
                <p className="font-black text-sm tracking-widest" style={{color: '#FEDD00'}}>BOXIUM</p>
                <p className="text-white/40 text-[10px] tracking-wider">PTCG FINANCIAL</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {txDetailLoading ? (
              <div className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{color: '#FEDD00'}} />
                <p className="text-white/50 text-sm">載入交易記錄...</p>
              </div>
            ) : !txDetailData || txDetailData.rows.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-10 h-10 mx-auto mb-3 text-white/20" />
                <p className="text-white/40">本月暫無交易記錄</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ── KPI Summary Cards ── */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-xl p-3.5 text-center relative overflow-hidden" style={{background: 'rgba(6,3,141,0.3)', border: '1px solid rgba(6,3,141,0.5)'}}>
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{background: '#FEDD00'}} />
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">總交易筆數</p>
                    <p className="text-2xl font-black" style={{color: '#FEDD00'}}>{txDetailData.total}</p>
                    <p className="text-white/30 text-[10px] mt-1">筆訂單</p>
                  </div>
                  <div className="rounded-xl p-3.5 text-center relative overflow-hidden" style={{background: 'rgba(10,31,21,0.6)', border: '1px solid rgba(52,211,153,0.3)'}}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400" />
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">GMV 合計</p>
                    <p className="text-sm font-black text-emerald-400">HKD {fmtHkd(txDetailData.rows.reduce((s, r) => s + r.subtotalHkd, 0))}</p>
                    <p className="text-white/30 text-[10px] mt-1">總交易額</p>
                  </div>
                  <div className="rounded-xl p-3.5 text-center relative overflow-hidden" style={{background: 'rgba(6,3,141,0.2)', border: '1px solid rgba(96,165,250,0.3)'}}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400" />
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">平台收入</p>
                    <p className="text-sm font-black text-blue-300">HKD {fmtHkd(txDetailData.rows.reduce((s, r) => s + r.platformIncomeHkd, 0))}</p>
                    <p className="text-white/30 text-[10px] mt-1">直售 + 手續費</p>
                  </div>
                  <div className="rounded-xl p-3.5 text-center relative overflow-hidden" style={{background: 'rgba(26,18,0,0.6)', border: '1px solid rgba(251,191,36,0.3)'}}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400" />
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">賣家應收</p>
                    <p className="text-sm font-black text-amber-400">HKD {fmtHkd(txDetailData.rows.reduce((s, r) => s + r.sellerReceivableHkd, 0))}</p>
                    <p className="text-white/30 text-[10px] mt-1">C2C 賣家應得</p>
                  </div>
                </div>

                {/* ── Transaction Table ── */}
                <div className="overflow-x-auto rounded-xl" style={{border: '1px solid #1e2235'}}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{background: '#111327', borderBottom: '1px solid #1e2235'}}>
                        <th className="text-left px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">訂單號</th>
                        <th className="text-left px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">商品</th>
                        <th className="text-left px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">買家</th>
                        <th className="text-left px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">賣家</th>
                        <th className="text-center px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">類型</th>
                        <th className="text-center px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">付款</th>
                        <th className="text-center px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">狀態</th>
                        <th className="text-right px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">金額</th>
                        <th className="text-right px-3 py-3 font-semibold text-emerald-400/60 uppercase tracking-wider text-[10px]" style={{background: 'rgba(16,185,129,0.08)'}}>平台收入</th>
                        <th className="text-right px-3 py-3 font-semibold text-amber-400/60 uppercase tracking-wider text-[10px]">賣家應收</th>
                        <th className="text-left px-3 py-3 font-semibold text-white/40 uppercase tracking-wider text-[10px]">日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txDetailData.rows.map((tx, idx) => {
                        const statusMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
                          payment_received: { label: '已付款', bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
                          processing: { label: '處理中', bg: 'rgba(99,102,241,0.15)', text: '#a5b4fc', border: 'rgba(99,102,241,0.3)' },
                          shipped: { label: '已出貨', bg: 'rgba(168,85,247,0.15)', text: '#d8b4fe', border: 'rgba(168,85,247,0.3)' },
                          delivered: { label: '已送達', bg: 'rgba(20,184,166,0.15)', text: '#5eead4', border: 'rgba(20,184,166,0.3)' },
                          completed: { label: '已完成', bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', border: 'rgba(16,185,129,0.3)' },
                          cancelled: { label: '已取消', bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.1)' },
                          refunded: { label: '已退款', bg: 'rgba(239,68,68,0.15)', text: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
                        };
                        const s = statusMap[tx.orderStatus] ?? { label: tx.orderStatus, bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.1)' };
                        const isDimmed = tx.orderStatus === 'cancelled' || tx.orderStatus === 'refunded';
                        const isEven = idx % 2 === 0;
                        return (
                          <tr key={tx.orderId}
                            style={{
                              borderBottom: '1px solid #1e2235',
                              background: isEven ? 'rgba(255,255,255,0.01)' : 'transparent',
                              opacity: isDimmed ? 0.5 : 1,
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(6,3,141,0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = isEven ? 'rgba(255,255,255,0.01)' : 'transparent')}
                          >
                            <td className="px-3 py-3">
                              <a href={`/orders/${tx.orderNo}`} target="_blank" rel="noopener noreferrer"
                                className="font-mono text-[10px] font-semibold hover:underline transition-colors"
                                style={{color: '#FEDD00'}}>
                                {tx.orderNo}
                              </a>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-white/80 truncate max-w-[120px]">{tx.listingTitle}</p>
                              <p className="text-white/30 text-[10px]">×{tx.quantity}</p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-white/70">{tx.buyerName}</p>
                              <p className="text-white/30 text-[10px] truncate max-w-[120px]">{tx.buyerEmail}</p>
                            </td>
                            <td className="px-3 py-3 text-white/60 text-xs">{tx.sellerName}</td>
                            <td className="px-3 py-3 text-center">
                              {tx.sellerType === 'platform' ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{background: 'rgba(254,221,0,0.15)', color: '#FEDD00', border: '1px solid rgba(254,221,0,0.35)'}}>
                                  平台
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{background: 'rgba(168,85,247,0.15)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.3)'}}>
                                  C2C
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {tx.paymentMethod === 'stripe' ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{background: 'rgba(99,91,255,0.15)', color: '#a89eff', border: '1px solid rgba(99,91,255,0.35)'}}>
                                  Stripe
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{background: 'rgba(22,119,255,0.15)', color: '#69b1ff', border: '1px solid rgba(22,119,255,0.35)'}}>
                                  支付寶
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{background: s.bg, color: s.text, border: `1px solid ${s.border}`}}>
                                {s.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-white/80 text-xs">HKD {fmtHkd(tx.subtotalHkd)}</td>
                            <td className="px-3 py-3 text-right text-xs" style={{background: 'rgba(16,185,129,0.06)'}}>
                              <span className="font-bold text-emerald-400">HKD {fmtHkd(tx.platformIncomeHkd)}</span>
                            </td>
                            <td className="px-3 py-3 text-right text-xs">
                              {tx.sellerType === 'platform'
                                ? <span className="text-white/20">—</span>
                                : <span className="font-medium text-amber-400">HKD {fmtHkd(tx.sellerReceivableHkd)}</span>}
                            </td>
                            <td className="px-3 py-3 text-white/40 text-xs">
                              {tx.paidAt ? new Date(tx.paidAt).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' }) : new Date(tx.createdAt).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {txDetailData.total > 100 && (
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-white/30">共 {txDetailData.total} 筆 · 每頁 100 筆</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-white/60 hover:text-white" style={{borderColor: '#1e2235', background: 'transparent'}} disabled={txDetailPage <= 1} onClick={() => setTxDetailPage(p => p - 1)}>上一頁</Button>
                      <Button size="sm" variant="outline" className="text-white/60 hover:text-white" style={{borderColor: '#1e2235', background: 'transparent'}} disabled={txDetailPage * 100 >= txDetailData.total} onClick={() => setTxDetailPage(p => p + 1)}>下一頁</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* ── Footer Actions ── */}
          <div className="flex justify-between items-center px-5 py-3 flex-shrink-0" style={{borderTop: '1px solid #1e2235', background: '#0d0f1a'}}>
            <Button
              size="sm"
              className="gap-1.5 text-white border-0"
              style={{background: '#06038d'}}
              disabled={!txDetailData || txDetailData.rows.length === 0}
              onClick={() => {
                if (!txDetailData) return;
                const rows = txDetailData.rows.map(tx => ({
                  '訂單號': tx.orderNo,
                  '商品名稱': tx.listingTitle,
                  '數量': tx.quantity,
                  '買家姓名': tx.buyerName,
                  '買家 Email': tx.buyerEmail,
                  '賣家': tx.sellerName,
                  '類型': tx.sellerType === 'platform' ? '平台直售' : 'C2C',
                  '付款方式': tx.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK',
                  '訂單狀態': tx.orderStatus,
                  '交易金額 (HKD)': tx.subtotalHkd.toFixed(2),
                  '平台收入 (HKD)': tx.platformIncomeHkd.toFixed(2),
                  '手續費 (HKD)': tx.platformFeeHkd.toFixed(2),
                  '賣家應收 (HKD)': tx.sellerType === 'platform' ? '' : tx.sellerReceivableHkd.toFixed(2),
                  '付款時間': tx.paidAt ? new Date(tx.paidAt).toLocaleString('zh-HK') : '',
                  '下單時間': new Date(tx.createdAt).toLocaleString('zh-HK'),
                }));
                exportToCSV(rows, `BOXIUM交易明細_${txDetailMonth}_${new Date().toISOString().slice(0,10)}.csv`);
              }}
            >
              <Download className="w-3.5 h-3.5" />匯出本月 CSV
            </Button>
            <Button size="sm" variant="outline" className="text-white/60 hover:text-white" style={{borderColor: '#1e2235', background: 'transparent'}} onClick={() => setTxDetailMonth(null)}>關閉</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Audit Footer ──────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">本報告由系統自動生成 · 數據截至 {reportDate} · 已付款訂單（payment_received / processing / shipped / delivered / completed）· 退款/取消統計獨立計算</p>
        <p className="text-xs text-gray-400 font-mono">BOXIUM PTCG · 財務審核用途</p>
      </div>

      {/* ── Fee Detail Drill-down Dialog ──────────────────── */}
      <Dialog open={!!feeDetailMonth} onOpenChange={open => { if (!open) setFeeDetailMonth(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              {feeDetailMonth ? fmtYearMonth(feeDetailMonth) : ''} · C2C 手續費明細
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {feeDetailLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#06038d]" /></div>
            ) : !feeDetailData?.rows?.length ? (
              <div className="text-center py-12 text-gray-400">本月無 C2C 手續費記錄</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">訂單號</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">賣家</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">訂單金額</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">手續費</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">賣家實收</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">付款方式</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">日期</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {feeDetailData.rows.map((r: any) => (
                      <tr key={r.orderId} className="hover:bg-gray-50/70">
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{r.orderNo}</td>
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{r.sellerDisplayName}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">HKD {fmtHkd(r.subtotalHkd)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-xs">HKD {fmtHkd(r.platformFeeHkd)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-700 font-medium">HKD {fmtHkd(r.sellerReceivableHkd)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            r.paymentMethod === 'stripe' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                          }`}>{r.paymentMethod === 'stripe' ? 'Stripe' : '支付寶'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500 text-xs">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString('zh-HK') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/50 border-t-2 border-emerald-200">
                      <td colSpan={3} className="px-3 py-2.5 font-bold text-gray-700 text-xs">合計（{feeDetailData.total} 筆）</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-bold text-emerald-700">HKD {fmtHkd(feeDetailData.rows.reduce((s: number, r: any) => s + r.platformFeeHkd, 0))}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-blue-700">HKD {fmtHkd(feeDetailData.rows.reduce((s: number, r: any) => s + r.sellerReceivableHkd, 0))}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          {feeDetailData && feeDetailData.total > 50 && (
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">共 {feeDetailData.total} 筆，每頁 50 筆</p>
              <div className="flex items-center gap-2">
                <button
                  disabled={feeDetailPage <= 1}
                  onClick={() => setFeeDetailPage(p => p - 1)}
                  className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                ><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs text-gray-600">第 {feeDetailPage} 頁</span>
                <button
                  disabled={feeDetailPage * 50 >= feeDetailData.total}
                  onClick={() => setFeeDetailPage(p => p + 1)}
                  className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                ><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// REPORTS TAB
// ============================================================
function ReportsTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const { data, isLoading, refetch } = trpc.marketplace.adminGetReports.useQuery({ page, pageSize: 20, status: statusFilter });
  const { data: statsData } = trpc.marketplace.adminGetReportStats.useQuery();
  const reviewMutation = trpc.marketplace.adminReviewReport.useMutation({
    onSuccess: () => { toast.success("舉報已處理"); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });
  const [noteDialogId, setNoteDialogId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [pendingAction, setPendingAction] = useState<"reviewed" | "dismissed" | "actioned">("reviewed");
  const reasonLabel: Record<string, string> = { fake_item: "假貨", wrong_description: "描述不符", prohibited_item: "禁止商品", scam: "詐騙", other: "其他" };
  const statusBadge: Record<string, string> = { pending: "bg-yellow-100 text-yellow-800", reviewed: "bg-blue-100 text-blue-800", dismissed: "bg-gray-100 text-gray-700", actioned: "bg-red-100 text-red-800" };
  const statusLabel: Record<string, string> = { pending: "待處理", reviewed: "已審核", dismissed: "已忽略", actioned: "已處置", all: "全部" };
  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {statsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs text-yellow-700 font-medium">待處理</p>
            <p className="text-2xl font-bold text-yellow-800">{statsData.byStatus?.pending ?? 0}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700 font-medium">已審核</p>
            <p className="text-2xl font-bold text-blue-800">{statsData.byStatus?.reviewed ?? 0}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700 font-medium">已處置</p>
            <p className="text-2xl font-bold text-red-800">{statsData.byStatus?.actioned ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-600 font-medium">共計</p>
            <p className="text-2xl font-bold text-gray-800">{statsData.total ?? 0}</p>
          </div>
        </div>
      )}
      {/* Top reported reasons */}
      {statsData?.byReason && statsData.byReason.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">舉報類型：</span>
          {statsData.byReason.map((r: any) => (
            <span key={r.reason} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
              {reasonLabel[r.reason] ?? r.reason} ({r.count})
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {["all", "pending", "reviewed", "dismissed", "actioned"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s ? "bg-[#06038d] text-white border-[#06038d]" : "bg-white text-gray-900 border-gray-200 hover:border-[#06038d]"
            }`}>{statusLabel[s]}</button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#06038d]" /></div>
      ) : !data?.reports?.length ? (
        <div className="text-center py-12 text-gray-400">暫無舉報記錄</div>
      ) : (
        <div className="space-y-3">
          {data.reports.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#06038d] to-[#1a17a0]">
                <span className="text-white text-xs font-semibold">舉報 #{r.id} · 商品 #BOXIUM-{r.listingId}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[r.status] ?? ""}`}>{statusLabel[r.status] ?? r.status}</span>
              </div>
              <div className="p-4 bg-white">
                <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-2">
                  <span className="font-medium">原因：{reasonLabel[r.reason] ?? r.reason}</span>
                  {r.details && <span className="text-gray-500">· {r.details}</span>}
                  <span className="text-gray-400 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                {r.adminNote && <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2">管理員備注：{r.adminNote}</p>}
                {r.status === "pending" && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="text-xs border-blue-300 text-blue-700"
                      onClick={() => { setNoteDialogId(r.id); setPendingAction("reviewed"); setAdminNote(""); }}>標記已審核</Button>
                    <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-700"
                      onClick={() => { setNoteDialogId(r.id); setPendingAction("actioned"); setAdminNote(""); }}>已處置</Button>
                    <Button size="sm" variant="outline" className="text-xs border-gray-300 text-gray-500"
                      onClick={() => reviewMutation.mutate({ reportId: r.id, status: "dismissed" })}>忽略</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" className="text-gray-700 bg-white" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-gray-500">第 {page} 頁 · 共 {data.total} 筆</span>
            <Button variant="outline" size="sm" className="text-gray-700 bg-white" disabled={page * 20 >= (data.total ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
      <Dialog open={noteDialogId !== null} onOpenChange={() => setNoteDialogId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>處理舉報</DialogTitle></DialogHeader>
          <Label className="text-sm">管理員備注（選填）</Label>
          <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="輸入處理備注..." rows={3} />
          <DialogFooter>
            <Button variant="outline" className="text-gray-700 bg-white" onClick={() => setNoteDialogId(null)}>取消</Button>
            <Button style={{ background: "#06038d" }} className="text-white" disabled={reviewMutation.isPending}
              onClick={() => { if (noteDialogId) { reviewMutation.mutate({ reportId: noteDialogId, status: pendingAction, adminNote: adminNote || undefined }); setNoteDialogId(null); } }}>確認</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// OFFERS TAB
// ============================================================
function OffersTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data, isLoading } = trpc.marketplace.adminGetOffers.useQuery({
    page,
    pageSize: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const offerStatusLabel: Record<string, string> = {
    pending: "待回覆",
    accepted: "已接受",
    rejected: "已拒絕",
    expired: "已過期",
    cancelled: "已取消",
  };
  const offerStatusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    expired: "bg-gray-100 text-gray-600",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600">篩選狀態：</span>
        {["all", "pending", "accepted", "rejected", "expired", "cancelled"].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s
                ? "bg-[#06038d] text-white border-[#06038d]"
                : "bg-white text-gray-900 border-gray-200 hover:border-[#06038d]/40"
            }`}
          >
            {s === "all" ? "全部" : offerStatusLabel[s]}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">共 {data?.total ?? 0} 筆</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#06038d]" /></div>
      ) : !data?.offers?.length ? (
        <div className="text-center py-12 text-gray-400">暫無出價記錄</div>
      ) : (
        <div className="space-y-3">
          {data.offers.map((o: any) => (
            <div key={o.id} className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#06038d] to-[#1a17a0]">
                <span className="text-white text-xs font-semibold">出價 #{o.id}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${offerStatusColor[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {offerStatusLabel[o.status] ?? o.status}
                </span>
              </div>
              <div className="p-4 bg-white space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium text-[#06038d]">
                    HKD {Number(o.offerPriceHkd ?? 0).toFixed(2)}
                  </span>
                  {o.listingPriceHkd && (
                    <span className="text-gray-400 text-xs self-center">
                      定價 HKD {Number(o.listingPriceHkd).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    try {
                      const imgs = typeof o.listingImages === 'string' ? JSON.parse(o.listingImages) : o.listingImages;
                      const firstImg = Array.isArray(imgs) ? imgs[0] : null;
                      if (firstImg) return <img src={firstImg} alt="" className="w-10 h-12 object-cover rounded border border-gray-200 flex-shrink-0" />;
                    } catch {}
                    return null;
                  })()}
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">商品：</span>{o.listingTitle ?? `#BOXIUM-${o.listingId}`}
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">買家：</span>{o.buyerName ?? "-"}
                  {o.buyerEmail && <span className="text-gray-400 ml-1">({o.buyerEmail})</span>}
                </div>
                {o.message && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 border-l-2 border-[#06038d]/30">
                    &ldquo;{o.message}&rdquo;
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                  <span>出價時間：{new Date(o.createdAt).toLocaleString()}</span>
                  {o.expiresAt && (
                    <span className={new Date(o.expiresAt) < new Date() ? "text-red-400" : ""}>
                      到期：{new Date(o.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" className="text-gray-700 bg-white" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-gray-500">第 {page} 頁 · 共 {data.total} 筆</span>
            <Button variant="outline" size="sm" className="text-gray-700 bg-white" disabled={page * 20 >= (data.total ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAYOUTS TAB
// ============================================================

// ─── Order Status Stepper (Payout Card) ───────────────────────────────────────────────
const PAYOUT_ORDER_STEPS: { key: string; label: string; icon: string }[] = [
  { key: 'payment_received', label: '已付款', icon: '💳' },
  { key: 'processing',       label: '處理中', icon: '⚙️' },
  { key: 'shipped',          label: '已發貨', icon: '📦' },
  { key: 'delivered',        label: '已收貨', icon: '✅' },
  { key: 'payout_pending',   label: '待放款', icon: '⏳' },
  { key: 'payout_done',      label: '已放款', icon: '💰' },
];

function resolvePayoutStepKey(orderStatus: string, payoutStatus: string, stripeTransferId?: string | null): string {
  if (payoutStatus === 'paid' || payoutStatus === 'completed') return 'payout_done';
  // If a Stripe transfer ID exists, the payout actually succeeded regardless of status field
  if (stripeTransferId) return 'payout_done';
  if (orderStatus === 'completed' || orderStatus === 'delivered') return 'payout_pending';
  if (orderStatus === 'shipped') return 'shipped';
  if (orderStatus === 'processing') return 'processing';
  return 'payment_received';
}

function OrderStatusStepper({ orderStatus, payoutStatus, stripeTransferId }: { orderStatus: string; payoutStatus: string; stripeTransferId?: string | null }) {
  const isCancelled = ['cancelled', 'refunded', 'disputed'].includes(orderStatus);
  const cancelMeta: Record<string, { label: string; cls: string; icon: string }> = {
    cancelled: { label: '訂單已取消', cls: 'bg-red-50 border-red-200 text-red-700', icon: '🚫' },
    refunded:  { label: '訂單已退款', cls: 'bg-orange-50 border-orange-200 text-orange-700', icon: '💸' },
    disputed:  { label: '爭議處理中', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '⚠️' },
  };
  if (isCancelled) {
    const m = cancelMeta[orderStatus] ?? { label: orderStatus, cls: 'bg-gray-50 border-gray-200 text-gray-600', icon: '❓' };
    return (
      <div className={`mx-4 mb-3 mt-1 px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 ${m.cls}`}>
        <span>{m.icon}</span><span>訂單狀態：{m.label}</span>
      </div>
    );
  }
  const currentKey = resolvePayoutStepKey(orderStatus, payoutStatus, stripeTransferId);
  const currentIdx = PAYOUT_ORDER_STEPS.findIndex(s => s.key === currentKey);
  return (
    <div className="mx-4 mb-3 mt-1">
      <div className="flex items-center">
        {PAYOUT_ORDER_STEPS.map((step, idx) => {
          const isDone    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast    = idx === PAYOUT_ORDER_STEPS.length - 1;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isDone    ? 'bg-green-500 border-green-500 text-white' :
                  isCurrent ? 'bg-[#06038d] border-[#06038d] text-white ring-2 ring-[#06038d]/30' :
                              'bg-white border-gray-300 text-gray-400'
                }`}>
                  {isDone ? '✓' : <span className="text-[11px]">{step.icon}</span>}
                </div>
                <span className={`text-[10px] mt-0.5 font-medium whitespace-nowrap ${
                  isDone    ? 'text-green-600' :
                  isCurrent ? 'text-[#06038d] font-bold' :
                              'text-gray-400'
                }`}>{step.label}</span>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-1 mb-3.5 rounded-full ${
                  idx < currentIdx ? 'bg-green-400' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────────

const payoutStatusBadge: Record<string, { label: string; color: string }> = {
  pending: { label: "待放款", color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "處理中", color: "bg-blue-100 text-blue-800" },
  paid: { label: "已放款", color: "bg-green-100 text-green-800" },
  completed: { label: "已放款", color: "bg-green-100 text-green-800" },
  failed: { label: "放款失敗", color: "bg-red-100 text-red-800" },
  not_applicable: { label: "不適用", color: "bg-gray-100 text-gray-500" },
};

// Individual payout order card with Stripe transfer status and manual payout
function PayoutOrderCard({ order: o, onRefresh }: { order: any; onRefresh: () => void }) {
  const [showStripeStatus, setShowStripeStatus] = useState(false);
  const [showManualPayoutDialog, setShowManualPayoutDialog] = useState(false);
  const [manualNote, setManualNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const utils = trpc.useUtils();

  const stripeStatusQuery = trpc.marketplace.adminGetStripeTransferStatus.useQuery(
    { orderId: o.id },
    { enabled: showStripeStatus && o.paymentMethod === 'stripe' && o.sellerType === 'seller' }
  );

  const manualPayoutMutation = trpc.marketplace.adminManualPayout.useMutation({
    onSuccess: () => {
      setShowManualPayoutDialog(false);
      setManualNote('');
      setProofFile(null);
      setProofPreview(null);
      onRefresh();
    },
  });

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirmPayout = async () => {
    let proofUrl: string | undefined;
    if (proofFile) {
      setUploadingProof(true);
      try {
        const formData = new FormData();
        formData.append('file', proofFile);
        const res = await fetch('/api/upload-payment-proof', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('上傳失敗');
        const data = await res.json();
        proofUrl = data.url;
      } catch (err) {
        toast.error('截圖上傳失敗，請重試');
        setUploadingProof(false);
        return;
      }
      setUploadingProof(false);
    }
    manualPayoutMutation.mutate({ orderId: o.id, note: manualNote || undefined, proofUrl });
  };

  const payout = payoutStatusBadge[o.payoutStatus ?? 'pending'] ?? payoutStatusBadge.pending;
  const sellerReceivable = Number(o.sellerReceivableHkd ?? 0);
  const subtotal = Number(o.subtotalHkd ?? 0);
  const platformFee = Number(o.platformFeeHkd ?? 0);
  const isPlatform = o.sellerType === 'platform';
  const isAlipay = o.paymentMethod === 'alipay_hk';
  const isStripe = o.paymentMethod === 'stripe';
  const isAlreadyPaid = o.payoutStatus === 'paid' || o.payoutStatus === 'completed';

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Order Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#06038d] to-[#1a17a0]">
        <div className="flex items-center gap-3">
          <span className="text-white text-sm font-semibold">#{o.orderNo}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payout.color}`}>{payout.label}</span>
          {isAlipay && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-200 text-blue-900 font-medium">支付寶 HK</span>}
          {isStripe && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-medium">Stripe</span>}
          {isPlatform && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-medium">平台商品</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/70">{new Date(o.createdAt).toLocaleDateString('zh-HK')}</span>
          <span className="text-sm text-yellow-300 font-bold">賣家應收：HKD {sellerReceivable.toFixed(2)}</span>
        </div>
      </div>
      {/* Order Status Stepper */}
      <div className="bg-gray-50 border-b border-gray-100 py-2">
        <OrderStatusStepper orderStatus={o.orderStatus ?? 'payment_received'} payoutStatus={o.payoutStatus ?? 'pending'} stripeTransferId={o.stripeTransferId} />
        {/* Status Timeline */}
        <div className="mx-4 mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {([
            { label: '下單', ts: o.createdAt, icon: '🛒' },
            { label: '付款', ts: o.paidAt, icon: '💳' },
            { label: '出貨', ts: o.shippedAt, icon: '📦' },
            { label: '收貨', ts: o.buyerConfirmedAt, icon: '✅' },
            { label: '放款', ts: o.manualPayoutAt ?? (o.payoutStatus === 'paid' || o.stripeTransferId ? o.updatedAt : null), icon: '💰' },
          ] as { label: string; ts: Date | string | null | undefined; icon: string }[]).map(({ label, ts, icon }) => ts ? (
            <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span>{icon}</span>
              <span className="font-medium text-gray-700">{label}</span>
              <span>{new Date(ts).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            </span>
          ) : null)}
        </div>
      </div>
      {/* Order Body */}
      <div className="p-4 bg-white grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Product Info */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">商品資料</p>
          <div className="flex items-start gap-3">
            {(() => {
              try {
                const imgs = typeof o.listingImages === 'string' ? JSON.parse(o.listingImages) : o.listingImages;
                const firstImg = Array.isArray(imgs) ? imgs[0] : null;
                if (firstImg) return <img src={firstImg} alt="" className="w-14 h-16 object-cover rounded-md border border-gray-200 flex-shrink-0" />;
              } catch {}
              return <div className="w-14 h-16 bg-gray-100 rounded-md border border-gray-200 flex-shrink-0 flex items-center justify-center"><span className="text-gray-300 text-xs">無圖</span></div>;
            })()}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800">{o.listingTitle ?? '（平台商品）'}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                <span>數量：{o.quantity ?? 1}</span>
                <span>單價：HKD {Number(o.unitPriceHkd ?? 0).toFixed(2)}</span>
                <span>小計：HKD {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                {isPlatform ? (
                  <span className="text-gray-400">平台商品免手續費</span>
                ) : (
                  <span>手續費：HKD {platformFee.toFixed(2)}</span>
                )}
                <span className="text-[#06038d] font-medium">賣家淨收：HKD {sellerReceivable.toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                <span>付款方式：{isStripe ? 'Stripe 信用卡' : isAlipay ? '支付寶 HK' : o.paymentMethod ?? '-'}</span>
                {o.stripePaymentIntentId && <span className="text-gray-400">PI: {o.stripePaymentIntentId.slice(0, 20)}...</span>}
                {o.stripeTransferId && <span className="text-green-600">Transfer: {o.stripeTransferId.slice(0, 20)}...</span>}
              </div>
            </div>
          </div>
        </div>
        {/* Buyer Info */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">買家資料</p>
          <p className="text-sm font-medium text-gray-800">{o.buyerName ?? `用戶 #${o.buyerId}`}</p>
          {o.buyerEmail && <p className="text-xs text-gray-500">{o.buyerEmail}</p>}
          {o.buyerPhone && <p className="text-xs text-gray-500">{o.buyerPhone}</p>}
          {o.shippingName && (
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              <p className="font-medium text-gray-600">收件資料：</p>
              <p>{o.shippingName}{o.shippingPhone ? ` · ${o.shippingPhone}` : ''}</p>
              {o.shippingAddress && (() => {
                try {
                  const addr = typeof o.shippingAddress === 'string' ? JSON.parse(o.shippingAddress) : o.shippingAddress;
                  if (addr && typeof addr === 'object') {
                    if (addr.sfStationCode) {
                      return (
                        <>
                          <p className="text-gray-600">
                            📦 {addr.sfStationName ? `${addr.sfStationName}` : '順豐自提站'}
                            {addr.district ? ` · ${addr.district}` : ''}
                          </p>
                          <p className="font-bold text-[#06038d] text-sm tracking-wide">{addr.sfStationCode}</p>
                        </>
                      );
                    }
                    return <p>{[addr.address, addr.district, addr.region].filter(Boolean).join(', ')}</p>;
                  }
                  return <p>{o.shippingAddress}</p>;
                } catch { return <p>{o.shippingAddress}</p>; }
              })()}
            </div>
          )}
        </div>
        {/* Seller Info + Payout Actions */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">賣家資料</p>
          {isPlatform ? (
            <p className="text-sm font-medium text-gray-800">平台自有商品</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-800">{o.sellerDisplayName ?? `賣家 #${o.sellerId}`}</p>
              {o.sellerUserName && o.sellerUserName !== o.sellerDisplayName && (
                <p className="text-xs text-gray-500">真實姓名：{o.sellerUserName}</p>
              )}
              {o.sellerUserEmail && <p className="text-xs text-gray-500">{o.sellerUserEmail}</p>}
              {o.sellerUserPhone && <p className="text-xs text-gray-500">{o.sellerUserPhone}</p>}
              {o.sellerStripeConnectId && (
                <p className="text-xs text-gray-400 mt-1">Stripe Connect: {o.sellerStripeConnectId.slice(0, 20)}...</p>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded ${o.sellerStripeConnectStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {o.sellerStripeConnectStatus ?? '未設定'}
              </span>
            </>
          )}
          {/* Shipping info */}
          {o.trackingNumber && (
            <div className="mt-2 text-xs text-gray-500">
              <p>物流：{o.shippingMethod ?? '-'}</p>
              <p>追蹤號：{o.trackingNumber}</p>
              {o.shippedAt && <p>出貨日：{new Date(o.shippedAt).toLocaleDateString('zh-HK')}</p>}
            </div>
          )}
          {/* Payout action buttons */}
          {(isAlipay || (!isPlatform && isStripe)) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Manual payout for alipay_hk (both platform and seller orders) */}
              {isAlipay && !isAlreadyPaid && (
                <Button size="sm" variant="outline" className="text-xs border-green-500 text-green-700 hover:bg-green-50"
                  onClick={() => setShowManualPayoutDialog(true)}>
                  💰 手動標記已放款
                </Button>
              )}
              {/* Manual payout record for alipay already paid */}
              {isAlipay && isAlreadyPaid && o.manualPayoutAt && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5 space-y-1">
                  <div>✅ 已手動放款：{new Date(o.manualPayoutAt).toLocaleDateString('zh-HK')}
                    {o.manualPayoutNote && <span className="ml-1 text-gray-500">({o.manualPayoutNote})</span>}
                  </div>
                  {o.manualPayoutProofUrl && (
                    <div className="flex items-center gap-1.5">
                      <a href={o.manualPayoutProofUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 underline">
                        <ImagePlus className="w-3 h-3" />查看付款截圖
                      </a>
                    </div>
                  )}
                </div>
              )}
              {/* Stripe transfer status button */}
              {isStripe && (
                <Button size="sm" variant="outline" className="text-xs border-purple-400 text-purple-700 hover:bg-purple-50"
                  onClick={() => setShowStripeStatus(s => !s)}>
                  {showStripeStatus ? '隱藏' : '查看'} Stripe 放款狀態
                </Button>
              )}
            </div>
          )}
          {/* Stripe transfer status panel */}
          {showStripeStatus && isStripe && (
            <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs">
              {stripeStatusQuery.isLoading ? (
                <div className="flex items-center gap-2 text-purple-600"><Loader2 className="w-3 h-3 animate-spin" /> 查詢 Stripe 放款狀態中...</div>
              ) : stripeStatusQuery.data ? (() => {
                const s = stripeStatusQuery.data;
                if (s.status === 'completed') return (
                  <div className="space-y-1">
                    <p className="font-semibold text-green-700">✅ Stripe 放款已完成</p>
                    <p className="text-gray-600">Transfer ID: {(s as any).transferId}</p>
                    <p className="text-gray-600">金額：{(s as any).currency} {Number((s as any).amount).toFixed(2)}</p>
                    <p className="text-gray-600">放款日期：{new Date((s as any).created).toLocaleString('zh-HK')}</p>
                    <p className="text-gray-600">目標帳戶：{(s as any).destination}</p>
                    {(s as any).reversed && <p className="text-red-600">⚠️ 此 Transfer 已被撤銷</p>}
                  </div>
                );
                if (s.status === 'pending') return (
                  <div className="space-y-1">
                    <p className="font-semibold text-yellow-700">⏳ 尚未放款</p>
                    {(s as any).reasons?.map((r: string, i: number) => (
                      <p key={i} className="text-gray-600">• {r}</p>
                    ))}
                    {(s as any).stripeTransferError && (
                      <p className="text-red-600 mt-1">錯誤詳情：{(s as any).stripeTransferError}</p>
                    )}
                  </div>
                );
                if (s.status === 'not_applicable') return (
                  <p className="text-gray-500">{(s as any).reason}</p>
                );
                if (s.status === 'fetch_error') return (
                  <div className="space-y-1">
                    <p className="font-semibold text-red-700">❌ 查詢失敗</p>
                    <p className="text-gray-600">Transfer ID: {(s as any).transferId}</p>
                    <p className="text-red-600">{(s as any).error}</p>
                  </div>
                );
                if (s.status === 'paid_no_transfer') return (
                  <div className="space-y-1">
                    <p className="font-semibold text-orange-700">⚠️ 放款已記錄，但無 Transfer 記錄</p>
                    <p className="text-gray-600">{(s as any).note}</p>
                    {(s as any).paymentIntentId && (
                      <p className="text-gray-500">Payment Intent: {(s as any).paymentIntentId}</p>
                    )}
                    {(s as any).invalidStoredId && (
                      <p className="text-gray-400 text-[10px]">旧記錄的無效 ID：{(s as any).invalidStoredId}</p>
                    )}
                    <a
                      href={`https://dashboard.stripe.com/transfers`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 underline text-[11px] mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />在 Stripe Dashboard 查看轉帳記錄
                    </a>
                  </div>
                );
                return null;
              })() : null}
            </div>
          )}
          {/* Manual payout dialog */}
          {showManualPayoutDialog && (
            <div className="mt-2 rounded-lg border border-green-300 bg-green-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-green-800">手動標記已放款</p>
              <p className="text-xs text-gray-600">賣家應收：<strong>HKD {sellerReceivable.toFixed(2)}</strong></p>
              <input
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white text-gray-900"
                placeholder="備注（例如：已轉帳至 FPS 12345678）"
                value={manualNote}
                onChange={e => setManualNote(e.target.value)}
              />
              {/* Proof screenshot upload */}
              <div className="space-y-1.5">
                <p className="text-xs text-gray-600 font-medium">付款截圖（選填）</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-gray-300 bg-white hover:border-green-400 transition-colors text-xs text-gray-600">
                    <ImagePlus className="w-3.5 h-3.5" />
                    {proofFile ? proofFile.name : '選擇截圖檔案'}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleProofFileChange} />
                </label>
                {proofPreview && (
                  <div className="relative inline-block">
                    <img src={proofPreview} alt="截圖預覽" className="w-32 h-24 object-cover rounded border border-gray-200" />
                    <button
                      onClick={() => { setProofFile(null); setProofPreview(null); }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700 text-white"
                  disabled={manualPayoutMutation.isPending || uploadingProof}
                  onClick={handleConfirmPayout}>
                  {(manualPayoutMutation.isPending || uploadingProof) ? <Loader2 className="w-3 h-3 animate-spin" /> : '確認放款'}
                </Button>
                <Button size="sm" variant="outline" className="text-xs text-gray-700 bg-white" onClick={() => { setShowManualPayoutDialog(false); setProofFile(null); setProofPreview(null); }}>取消</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PayoutsTab() {
  const [page, setPage] = useState(1);
  const [sellerTypeFilter, setSellerTypeFilter] = useState<'all' | 'platform' | 'seller'>('all');
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending_alipay'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchNote, setBatchNote] = useState('');
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchProofFile, setBatchProofFile] = useState<File | null>(null);
  const [batchProofPreview, setBatchProofPreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const batchProofInputRef = useRef<HTMLInputElement>(null);
  // CSV export state
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showExportPanel, setShowExportPanel] = useState(false);
  const exportQuery = trpc.marketplace.adminExportPayoutsCsv.useQuery(
    { month: exportMonth, paymentMethod: 'all' },
    { enabled: false }
  );
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.marketplace.adminGetOrders.useQuery({
    page, pageSize: 20,
    status: payoutFilter === 'pending_alipay' ? 'paid' : 'paid',
    sellerType: sellerTypeFilter,
    payoutFilter: payoutFilter === 'all' ? undefined : payoutFilter,
  });
  const batchPayoutMutation = trpc.marketplace.adminBatchManualPayout.useMutation({
    onSuccess: (result) => {
      toast.success(`批量放款完成：${result.successCount}/${result.totalCount} 筆成功`);
      setSelectedIds(new Set());
      setShowBatchDialog(false);
      setBatchNote('');
      setBatchProofFile(null);
      setBatchProofPreview(null);
      utils.marketplace.adminGetOrders.invalidate();
      utils.marketplace.adminGetStats.invalidate();
      utils.marketplace.adminGetPendingPayoutCount.invalidate();
    },
    onError: (err) => toast.error('批量放款失敗：' + err.message),
  });

  const handleBatchProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchProofFile(file);
    const reader = new FileReader();
    reader.onload = ev => setBatchProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleBatchPayout = async () => {
    let proofUrl: string | undefined;
    if (batchProofFile) {
      setIsUploadingProof(true);
      try {
        const formData = new FormData();
        formData.append('file', batchProofFile);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('上傳失敗');
        const data = await res.json();
        proofUrl = data.url;
      } catch (err: any) {
        toast.error('截圖上傳失敗：' + err.message);
        setIsUploadingProof(false);
        return;
      }
      setIsUploadingProof(false);
    }
    batchPayoutMutation.mutate({ orderIds: Array.from(selectedIds), note: batchNote || undefined, proofUrl });
  };

  const handleExportMonthCsv = async () => {
    try {
      const result = await utils.marketplace.adminExportPayoutsCsv.fetch({ month: exportMonth, paymentMethod: 'all' });
      if (!result.length) { toast.info('本月無放款記錄'); return; }
      const rows = result.map(r => ({
        '訂單號': r.orderNo,
        '賣家': r.sellerName,
        '付款方式': r.paymentMethod,
        '放款金額 (HKD)': r.amountHkd,
        '放款日期': r.payoutDate,
        '備注': r.note,
        '截圖連結': r.proofUrl,
      }));
      exportToCSV(rows, `放款記錄_${exportMonth}.csv`);
      toast.success(`已匯出 ${result.length} 筆放款記錄`);
      setShowExportPanel(false);
    } catch (err: any) {
      toast.error('匯出失敗：' + err.message);
    }
  };

  // Alipay pending orders on current page (for select all)
  const pendingAlipayOrders = (data?.orders ?? []).filter(
    (o: any) => o.paymentMethod === 'alipay_hk' && o.payoutStatus !== 'paid'
  );
  const allPendingSelected = pendingAlipayOrders.length > 0 && pendingAlipayOrders.every((o: any) => selectedIds.has(o.id));

  // Calculate total amount for selected orders
  const selectedOrdersTotal = (data?.orders ?? []).filter((o: any) => selectedIds.has(o.id)).reduce(
    (sum: number, o: any) => sum + (Number(o.sellerReceivableHkd) || 0), 0
  );
  const selectedOrdersBreakdown = (data?.orders ?? []).filter((o: any) => selectedIds.has(o.id)).map(
    (o: any) => ({ orderNo: o.orderNo, sellerName: o.sellerName ?? '賣家', amount: Number(o.sellerReceivableHkd) || 0 })
  );

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingAlipayOrders.map((o: any) => o.id)));
    }
  };

  // Fix: use sellerReceivableHkd (correct field name from backend)
  // Platform orders (sellerType='platform') have platformFeeHkd=0, sellerReceivableHkd=subtotalHkd
  const totalPayout = data?.orders?.reduce((sum: number, o: any) => {
    // For platform orders, no payout needed (platform keeps all revenue)
    if (o.sellerType === 'platform') return sum;
    return sum + (Number(o.sellerReceivableHkd) || 0);
  }, 0) ?? 0;
  const totalSubtotal = data?.orders?.reduce((sum: number, o: any) => sum + (Number(o.subtotalHkd) || 0), 0) ?? 0;
  const totalFee = data?.orders?.reduce((sum: number, o: any) => sum + (Number(o.platformFeeHkd) || 0), 0) ?? 0;
  const c2cOrderCount = data?.orders?.filter((o: any) => o.sellerType === 'seller').length ?? 0;
  const platformOrderCount = data?.orders?.filter((o: any) => o.sellerType === 'platform').length ?? 0;

  const filterOptions: { value: 'all' | 'platform' | 'seller'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'seller', label: '僅 C2C' },
    { value: 'platform', label: '僅平台' },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar: filter + fix button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">訂單類型：</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSellerTypeFilter(opt.value); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    sellerTypeFilter === opt.value
                      ? 'bg-[#06038d] text-white'
                      : 'bg-white text-gray-900 hover:bg-gray-50'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">放款狀態：</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => { setPayoutFilter('all'); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  payoutFilter === 'all' ? 'bg-[#06038d] text-white' : 'bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >全部</button>
              <button
                onClick={() => { setPayoutFilter('pending_alipay'); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  payoutFilter === 'pending_alipay' ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'
                }`}
              >待放款（支付寶）</button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export monthly payout CSV */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-green-700 border-green-300 bg-white hover:bg-green-50"
            onClick={() => setShowExportPanel(v => !v)}
          >
            <Download className="w-3.5 h-3.5 mr-1" />匯出放款記錄
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-gray-700 bg-white"
            disabled={!data?.orders?.length}
            onClick={() => {
              const rows = (data?.orders ?? []).map((o: any) => ({
                '訂單號': o.orderNo,
                '商品': o.listingTitle,
                '賣家類型': o.sellerType === 'platform' ? '平台官方' : 'C2C',
                '賣家': o.sellerName ?? '',
                '買家': o.buyerName ?? '',
                '付款方式': o.paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK',
                '交易金額 (HKD)': parseFloat(o.subtotalHkd || '0').toFixed(2),
                '手續費 (HKD)': parseFloat(o.platformFeeHkd || '0').toFixed(2),
                '賣家應收 (HKD)': parseFloat(o.sellerReceivableHkd || '0').toFixed(2),
                '放款狀態': o.payoutStatus ?? 'pending',
                '放款日期': o.manualPayoutAt ? new Date(o.manualPayoutAt).toLocaleDateString('zh-HK') : '',
                '放款備注': o.manualPayoutNote ?? '',
                'Stripe Transfer ID': o.stripeTransferId ?? '',
                '訂單日期': new Date(o.createdAt).toLocaleDateString('zh-HK'),
              }));
              exportToCSV(rows, `放款管理_${new Date().toISOString().slice(0,10)}.csv`);
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1" />匯出 CSV
          </Button>

        </div>
      </div>

      {/* Export panel */}
      {showExportPanel && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-semibold text-green-800 mb-1">匯出放款記錄 CSV</p>
            <p className="text-xs text-gray-500 mb-2">欄位：訂單號、賣家、付款方式、放款金額、放款日期、備注、截圖連結</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">月份：</label>
              <input
                type="month"
                value={exportMonth}
                onChange={e => setExportMonth(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 focus:outline-none focus:border-green-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleExportMonthCsv}>
              <Download className="w-3 h-3 mr-1" />下載 CSV
            </Button>
            <Button size="sm" variant="outline" className="text-xs text-gray-700 bg-white" onClick={() => setShowExportPanel(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-gray-100 shadow-sm p-4 bg-gradient-to-br from-[#06038d]/5 to-white">
          <p className="text-xs text-gray-500 mb-1">本頁應付 C2C 賣家總額</p>
          <p className="text-xl font-bold" style={{ color: "#06038d" }}>HKD {totalPayout.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">C2C 訂單 {c2cOrderCount} 筆</p>
        </div>
        <div className="rounded-xl border border-gray-100 shadow-sm p-4 bg-gradient-to-br from-green-50 to-white">
          <p className="text-xs text-gray-500 mb-1">已完成訂單數</p>
          <p className="text-xl font-bold text-green-700">{data?.total ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">平台 {platformOrderCount} 筆 · C2C {c2cOrderCount} 筆</p>
        </div>
        <div className="rounded-xl border border-gray-100 shadow-sm p-4 bg-gradient-to-br from-blue-50 to-white">
          <p className="text-xs text-gray-500 mb-1">本頁交易總額（買家付）</p>
          <p className="text-xl font-bold text-blue-700">HKD {totalSubtotal.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 shadow-sm p-4 bg-gradient-to-br from-amber-50 to-white">
          <p className="text-xs text-gray-500 mb-1">本頁平台手續費</p>
          <p className="text-xl font-bold text-amber-700">HKD {totalFee.toFixed(2)}</p>
        </div>
      </div>
      {/* Batch action bar */}
      {pendingAlipayOrders.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allPendingSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-xs font-medium text-amber-800">
              {allPendingSelected ? `已全選 ${pendingAlipayOrders.length} 筆待放款訂單` : `全選本頁 ${pendingAlipayOrders.length} 筆待放款（支付寶）訂單`}
            </span>
          </label>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white ml-auto"
              onClick={() => setShowBatchDialog(true)}
            >
              💰 批量標記已放款（{selectedIds.size} 筆）
            </Button>
          )}
        </div>
      )}

      {/* Batch payout dialog */}
      {showBatchDialog && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-lg space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800">批量標記已放款 — 共 {selectedIds.size} 筆訂單</p>
              <p className="text-xs text-gray-600 mt-0.5">此操作將把所選訂單標記為已放款，並通知相關賣家（C2C 訂單）。</p>
            </div>
            {/* Total amount highlight */}
            <div className="text-right bg-white rounded-lg border border-green-300 px-3 py-2 ml-4 shrink-0">
              <p className="text-[10px] text-gray-500">合計放款金額</p>
              <p className="text-lg font-bold text-green-700">HKD {selectedOrdersTotal.toFixed(2)}</p>
              <p className="text-[10px] text-gray-400">共 {selectedIds.size} 筆訂單</p>
            </div>
          </div>
          {/* Per-order breakdown */}
          {selectedOrdersBreakdown.length > 0 && (
            <div className="bg-white rounded border border-green-200 divide-y divide-green-100 max-h-32 overflow-y-auto">
              {selectedOrdersBreakdown.map(item => (
                <div key={item.orderNo} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs text-gray-600">{item.orderNo} · {item.sellerName}</span>
                  <span className="text-xs font-medium text-gray-800">HKD {item.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <input
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white text-gray-900"
            placeholder="批量備注（例如：2026年3月份支付寶 HK 放款）"
            value={batchNote}
            onChange={e => setBatchNote(e.target.value)}
          />
          {/* Proof screenshot upload */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">付款截圖（可選，所有訂單共用同一張）</p>
            <input
              ref={batchProofInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBatchProofChange}
            />
            {batchProofPreview ? (
              <div className="relative inline-block">
                <img src={batchProofPreview} alt="截圖預覽" className="h-24 w-auto rounded border border-green-300 object-cover" />
                <button
                  onClick={() => { setBatchProofFile(null); setBatchProofPreview(null); }}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                >×</button>
              </div>
            ) : (
              <button
                onClick={() => batchProofInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-green-400 rounded text-xs text-green-700 hover:bg-green-100 transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />上傳付款截圖
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="text-xs bg-green-600 hover:bg-green-700 text-white"
              disabled={batchPayoutMutation.isPending || isUploadingProof}
              onClick={handleBatchPayout}
            >
              {(batchPayoutMutation.isPending || isUploadingProof) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {isUploadingProof ? '上傳截圖中...' : batchPayoutMutation.isPending ? '放款中...' : '確認批量放款'}
            </Button>
            <Button size="sm" variant="outline" className="text-xs text-gray-700 bg-white" onClick={() => { setShowBatchDialog(false); setBatchProofFile(null); setBatchProofPreview(null); }}>取消</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#06038d]" /></div>
      ) : !data?.orders?.length ? (
        <div className="text-center py-12 text-gray-400">暫無已完成訂單</div>
      ) : (
        <div className="space-y-3">
          {data.orders.map((o: any) => (
            <PayoutOrderCard key={o.id} order={o} onRefresh={() => utils.marketplace.adminGetOrders.invalidate()} />
          ))}
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" className="text-gray-700 bg-white" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-gray-500">第 {page} 頁 · 共 {data.total} 筆</span>
            <Button variant="outline" size="sm" className="text-gray-700 bg-white" disabled={page * 20 >= (data.total ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeout Settings Tab ───────────────────────────────────────────────────
function TimeoutSettingsTab() {
  const { data, isLoading } = trpc.system.getTimeoutSettings.useQuery();
  const updateMutation = trpc.system.updateTimeoutSettings.useMutation({
    onSuccess: () => toast.success('超時設定已更新'),
    onError: (e) => toast.error(parseApiError(e)),
  });

  const [paymentTimeout, setPaymentTimeout] = useState<string>('');
  const [offerTimeout, setOfferTimeout] = useState<string>('');
  const [reminderMinutes, setReminderMinutes] = useState<string>('');

  // Sync from server
  useEffect(() => {
    if (data) {
      setPaymentTimeout(String(data.paymentTimeoutMinutes));
      setOfferTimeout(String(data.offerPaymentTimeoutHours));
      setReminderMinutes(String(data.paymentReminderMinutes));
    }
  }, [data]);

  const handleSave = () => {
    const pt = parseInt(paymentTimeout);
    const ot = parseInt(offerTimeout);
    const rm = parseInt(reminderMinutes);
    if (isNaN(pt) || pt < 5 || pt > 1440) { toast.error('待付款超時需為 5–1440 分鐘'); return; }
    if (isNaN(ot) || ot < 1 || ot > 168) { toast.error('出價付款超時需為 1–168 小時'); return; }
    if (isNaN(rm) || rm < 5 || rm > 1440) { toast.error('提醒時間需為 5–1440 分鐘'); return; }
    updateMutation.mutate({
      paymentTimeoutMinutes: pt,
      offerPaymentTimeoutHours: ot,
      paymentReminderMinutes: rm,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">超時時限設定</h2>
        <p className="text-sm text-gray-500">調整市集訂單的自動取消和提醒時間，設定後即時生效（下一次排程執行時套用）。</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#06038d]" /></div>
      ) : (
        <div className="space-y-4">
          {/* Card 1: Pending Payment Timeout */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-amber-100 rounded-lg p-2"><Timer className="w-5 h-5 text-amber-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">待付款訂單自動取消時限</h3>
                <p className="text-xs text-gray-500 mt-0.5">買家下單後若超過此時間未完成付款，訂單將自動取消，商品重新上架。</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number" min={5} max={1440}
                value={paymentTimeout}
                onChange={e => setPaymentTimeout(e.target.value)}
                className="w-32 text-sm"
              />
              <span className="text-sm text-gray-600">分鐘</span>
              <span className="text-xs text-gray-400">(5 – 1440 分鐘，預設 30)</span>
            </div>
          </div>

          {/* Card 2: Offer Payment Timeout */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-blue-100 rounded-lg p-2"><Clock className="w-5 h-5 text-blue-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">出價接受後付款時限</h3>
                <p className="text-xs text-gray-500 mt-0.5">賣家接受出價後，買家需在此時間內完成付款，否則出價自動失效。</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number" min={1} max={168}
                value={offerTimeout}
                onChange={e => setOfferTimeout(e.target.value)}
                className="w-32 text-sm"
              />
              <span className="text-sm text-gray-600">小時</span>
              <span className="text-xs text-gray-400">(1 – 168 小時，預設 24)</span>
            </div>
          </div>

          {/* Card 3: Payment Reminder */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-green-100 rounded-lg p-2"><Mail className="w-5 h-5 text-green-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">付款提醒電郵發送時間</h3>
                <p className="text-xs text-gray-500 mt-0.5">訂單建立後若買家仍未付款，系統將在此時間後自動發送提醒電郵。</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number" min={5} max={1440}
                value={reminderMinutes}
                onChange={e => setReminderMinutes(e.target.value)}
                className="w-32 text-sm"
              />
              <span className="text-sm text-gray-600">分鐘後發送</span>
              <span className="text-xs text-gray-400">(5 – 1440 分鐘，預設 60)</span>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#06038d]/5 border border-[#06038d]/20 rounded-xl p-4 text-xs text-[#06038d]/80 space-y-1">
            <p className="font-semibold text-[#06038d] mb-1">⏱ 目前設定摘要</p>
            <p>• 待付款訂單：下單後 <strong>{paymentTimeout || data?.paymentTimeoutMinutes}</strong> 分鐘未付款自動取消</p>
            <p>• 出價接受後：<strong>{offerTimeout || data?.offerPaymentTimeoutHours}</strong> 小時內未付款出價失效</p>
            <p>• 付款提醒：下單後 <strong>{reminderMinutes || data?.paymentReminderMinutes}</strong> 分鐘發送提醒電郵</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-[#06038d] text-white hover:bg-[#06038d]/90 w-full sm:w-auto">
            {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />儲存中...</> : '儲存設定'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// AUDIT LOGS TAB
// ============================================================
const actionLabels: Record<string, string> = {
  confirm_alipay: '確認支付寶付款',
  update_order_status: '更新訂單狀態',
  resolve_dispute: '解決爭議',
  suspend_seller: '凍結賣家',
  unsuspend_seller: '解凍賣家',
  ai_verify_alipay: 'AI 核對支付寶',
  delist_listing: '強制下架商品',
  restore_listing: '重新上架商品',
  flag_risk: '標記高風險商品',
  update_seller_risk: '更新賣家風控等級',
};
const actionColors: Record<string, string> = {
  confirm_alipay: 'bg-green-100 text-green-800',
  update_order_status: 'bg-blue-100 text-blue-800',
  resolve_dispute: 'bg-purple-100 text-purple-800',
  suspend_seller: 'bg-orange-100 text-orange-800',
  unsuspend_seller: 'bg-cyan-100 text-cyan-800',
  ai_verify_alipay: 'bg-indigo-100 text-indigo-800',
  delist_listing: 'bg-red-100 text-red-800',
  restore_listing: 'bg-green-100 text-green-800',
  flag_risk: 'bg-amber-100 text-amber-800',
  update_seller_risk: 'bg-purple-100 text-purple-800',
};

function AuditLogsTab() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const exportQuery = trpc.marketplace.adminExportAuditLogs.useQuery(
    { action: actionFilter || undefined, targetType: targetTypeFilter || undefined },
    { enabled: false }
  );
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data?.csv) {
        const blob = new Blob(['\uFEFF' + result.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `審計日誌_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`已匯出 ${result.data.total} 筆審計日誌`);
      }
    } catch (e: any) {
      toast.error(e.message || '匯出失敗');
    } finally {
      setIsExporting(false);
    }
  };
  const { data, isLoading, refetch } = trpc.marketplace.adminGetAuditLogs.useQuery({
    page,
    pageSize: 30,
    action: actionFilter || undefined,
    targetType: targetTypeFilter || undefined,
  });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ScrollText className="w-5 h-5" />審計日誌
          <span className="text-sm font-normal text-gray-500">(共 {total} 筆)</span>
        </h2>
         <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={isExporting} className="text-gray-700 bg-white">
            {isExporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            匯出 CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="text-gray-700 bg-white">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />刷新
          </Button>
        </div>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-white text-gray-900">
            <SelectValue placeholder="篩選操作類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {Object.entries(actionLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetTypeFilter} onValueChange={v => { setTargetTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-white text-gray-900">
            <SelectValue placeholder="篩選目標類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部目標</SelectItem>
            <SelectItem value="listing">商品</SelectItem>
            <SelectItem value="order">訂單</SelectItem>
            <SelectItem value="seller">賣家</SelectItem>
            <SelectItem value="dispute">爭議</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暫無審計日誌</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="pb-2 pr-3 font-medium">時間</th>
                <th className="pb-2 pr-3 font-medium">操作</th>
                <th className="pb-2 pr-3 font-medium">目標</th>
                <th className="pb-2 pr-3 font-medium">管理員 ID</th>
                <th className="pb-2 font-medium">詳情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => {
                let details: any = null;
                try { details = log.details ? JSON.parse(log.details) : null; } catch { details = null; }
                return (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 pr-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      <span className="text-gray-600">{log.targetType}</span>
                      <span className="text-gray-400 ml-1">#{log.targetId}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-gray-600">#{log.adminId}</td>
                    <td className="py-2.5 text-xs text-gray-600 max-w-[300px] truncate">
                      {details ? (
                        <span title={JSON.stringify(details, null, 2)}>
                          {details.reason && <span>原因：{details.reason}</span>}
                          {details.newStatus && <span>新狀態：{details.newStatus}</span>}
                          {details.outcome && <span>結果：{details.outcome}</span>}
                          {details.verified !== undefined && <span>AI核對：{details.verified ? '通過' : '不通過'}</span>}
                          {!details.reason && !details.newStatus && !details.outcome && details.verified === undefined && JSON.stringify(details).slice(0, 80)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" className="text-gray-700 bg-white" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="flex items-center text-sm text-gray-600">第 {page} 頁 / 共 {totalPages} 頁</span>
          <Button variant="outline" className="text-gray-700 bg-white" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Auction Admin Tab ----
function AuctionsAdminTab() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterHighValue, setFilterHighValue] = useState(false);
  const [page, setPage] = useState(1);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; listingId: number | null; reason: string }>({ open: false, listingId: null, reason: '' });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; listingId: number | null; reason: string }>({ open: false, listingId: null, reason: '' });
  const utils = trpc.useUtils();

  const QUICK_REJECT_REASONS = [
    '無圖片或圖片不清晰',
    '商品描述不符實際',
    '起標價格異常（過高或過低）',
    '非 TCG 相關商品',
    '重複上架',
    '高價商品需提供更多證明',
  ];

  const { data: auctionStats } = trpc.auction.adminGetStats.useQuery(undefined, { refetchInterval: 30000 });

  const { data, isLoading, refetch } = trpc.auction.adminList.useQuery({
    status: filterStatus === 'all' ? undefined : filterStatus,
    page,
    pageSize: 20,
    isHighValueReview: filterHighValue ? true : undefined,
  }, { refetchInterval: 20000 }); // Poll every 20s for real-time bid updates

  const approveMutation = trpc.auction.adminApprove.useMutation({
    onSuccess: () => { toast.success('拍賣已審核通過'); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const approveHighValueMutation = trpc.auction.adminApproveHighValue.useMutation({
    onSuccess: () => { toast.success('高價拍賣已通過額外審核'); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const rejectMutation = trpc.auction.adminReject.useMutation({
    onSuccess: () => { toast.success('拍賣已拒絕'); setRejectDialog({ open: false, listingId: null, reason: '' }); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const cancelMutation = trpc.auction.adminCancel.useMutation({
    onSuccess: () => { toast.success('拍賣已強制取消'); setCancelDialog({ open: false, listingId: null, reason: '' }); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const forceEndMutation = trpc.auction.adminForceEnd.useMutation({
    onSuccess: () => { toast.success('拍賣已強制結標'); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const statusOptions = [
    { value: 'all', label: '全部' },
    { value: 'scheduled', label: '已排程' },
    { value: 'active', label: '競標中' },
    { value: 'ending_soon', label: '即將結標' },
    { value: 'ended_sold', label: '已成交' },
    { value: 'ended_no_bid', label: '流標' },
    { value: 'cancelled', label: '已取消' },
    { value: 'admin_delisted', label: '🚫 強制下架' },
  ];

  const auctionStatusBadge = (status: string, auctionPaymentStatus?: string | null) => {
    let endedSoldLabel: string;
    let endedSoldClass: string;
    if (auctionPaymentStatus === 'paid') {
      endedSoldLabel = '已成交'; endedSoldClass = 'bg-green-100 text-green-700';
    } else if (auctionPaymentStatus === 'expired' || auctionPaymentStatus === 'failed') {
      endedSoldLabel = '已取消'; endedSoldClass = 'bg-red-100 text-red-600';
    } else {
      endedSoldLabel = '已得標（待付款）'; endedSoldClass = 'bg-[#06038D]/10 text-[#06038D]';
    }
    const map: Record<string, { label: string; className: string }> = {
      pending_review: { label: '待審核', className: 'bg-amber-100 text-amber-700' },
      scheduled: { label: '已排程', className: 'bg-blue-100 text-blue-700' },
      active: { label: '競標中', className: 'bg-green-100 text-green-700' },
      ending_soon: { label: '即將結標', className: 'bg-orange-100 text-orange-700' },
      ended_sold: { label: endedSoldLabel, className: endedSoldClass },
      ended_no_bid: { label: '流標', className: 'bg-gray-100 text-gray-500' },
      cancelled: { label: '已取消', className: 'bg-red-100 text-red-600' },
      rejected: { label: '已拒絕', className: 'bg-red-200 text-red-700' },
    };
    const s = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.className}`}>{s.label}</span>;
  };

  const listings = data?.listings ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#06038D]">🔨 拍賣管理</h2>
          <p className="text-sm text-[#06038D]/60 mt-0.5">審核拍賣上架申請、監控進行中競標</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="border-[#06038D]/30 text-[#06038D]">
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      {auctionStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-[#06038D] to-[#0a06c4] rounded-xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/70 font-medium">今日新拍賣</span>
              <div className="p-1.5 rounded-lg bg-white/15"><TrendingUp className="w-3.5 h-3.5 text-white" /></div>
            </div>
            <p className="text-2xl font-bold">{auctionStats.todayNewAuctions}</p>
            <p className="text-xs text-white/60 mt-1">已排程 {auctionStats.scheduledAuctions ?? 0} 筆</p>
          </div>
          <div className="bg-gradient-to-br from-[#16a34a] to-[#15803d] rounded-xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/70 font-medium">進行中競標</span>
              <div className="p-1.5 rounded-lg bg-white/15"><Timer className="w-3.5 h-3.5 text-white" /></div>
            </div>
            <p className="text-2xl font-bold">{auctionStats.activeAuctions}</p>
            <p className="text-xs text-white/60 mt-1">即將結標 {auctionStats.endingSoonAuctions} 筆</p>
          </div>
          <div className="bg-gradient-to-br from-[#FEDD00] to-[#f0c800] rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#06038D]/70 font-medium">本月成交額</span>
              <div className="p-1.5 rounded-lg bg-[#06038D]/10"><DollarSign className="w-3.5 h-3.5 text-[#06038D]" /></div>
            </div>
            <p className="text-2xl font-bold text-[#06038D]">HK${auctionStats.monthlyRevenue.toLocaleString()}</p>
            <p className="text-xs text-[#06038D]/60 mt-1">共 {auctionStats.monthlyCompletedAuctions} 筆成交</p>
          </div>
          <div className="bg-gradient-to-br from-[#ef4444] to-[#dc2626] rounded-xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/70 font-medium">棄標率</span>
              <div className="p-1.5 rounded-lg bg-white/15"><AlertCircle className="w-3.5 h-3.5 text-white" /></div>
            </div>
            <p className="text-2xl font-bold">{auctionStats.abandonRate.toFixed(1)}%</p>
            <p className="text-xs text-white/60 mt-1">共 {auctionStats.totalViolations} 筆違規</p>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {statusOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setFilterStatus(opt.value); setFilterHighValue(false); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
              filterStatus === opt.value && !filterHighValue
                ? 'bg-[#06038D] text-white'
                : 'bg-[#06038D]/10 text-[#06038D] hover:bg-[#06038D]/20'
            }`}
          >
            {opt.label}

          </button>
        ))}
        {/* High Value filter */}
        <button
          onClick={() => { setFilterHighValue(v => !v); setFilterStatus('all'); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
            filterHighValue
              ? 'bg-amber-500 text-white'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          }`}
        >
          💎 高價監控
          {(auctionStats?.highValuePending ?? 0) > 0 && (
            <span className={`text-[10px] rounded-full px-1 py-0 ${
              filterHighValue ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
            }`}>{auctionStats!.highValuePending}</span>
          )}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#06038D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-[#06038D]/40">
          <p className="text-base font-medium">目前沒有{statusOptions.find(o => o.value === filterStatus)?.label ?? ''}的拍賣</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
          {/* Table Header */}
          <div className="hidden lg:grid bg-gray-50 border-b border-gray-200 px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
            style={{gridTemplateColumns: '52px 1fr 100px 70px 70px 130px 130px 160px'}}>
            <div></div>
            <div>拍賣商品</div>
            <div className="text-right">起標價</div>
            <div className="text-center">出價數</div>
            <div className="text-center">系列</div>
            <div className="text-center">開始時間</div>
            <div className="text-center">結標時間</div>
            <div className="text-right">操作</div>
          </div>
          {/* Table Rows */}
          <div className="divide-y divide-gray-100">
          {listings.map((listing: any) => {
            // Parse images field (stored as JSON string or array)
            let thumbUrl: string | null = null;
            try {
              const imgs = typeof listing.images === 'string' ? JSON.parse(listing.images) : listing.images;
              if (Array.isArray(imgs) && imgs.length > 0) thumbUrl = imgs[0];
            } catch {}
            const hasCurrentBid = listing.currentBid && parseFloat(listing.currentBid) > 0;
            return (
            <div key={listing.id}
              className="group flex lg:grid items-center px-3 py-3 hover:bg-blue-50/30 transition-colors gap-3 lg:gap-0"
              style={{gridTemplateColumns: '52px 1fr 100px 70px 70px 130px 130px 160px'}}>
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-11 h-14 rounded-lg overflow-hidden bg-[#06038D]/5 border border-[#06038D]/10 flex items-center justify-center">
                {thumbUrl ? (
                  <img src={thumbUrl} alt="拍賣品" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-4 h-4 text-[#06038D]/20" />
                )}
              </div>
              {/* Title + status + seller */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {auctionStatusBadge(listing.auctionStatus ?? 'pending_review', listing.auctionPaymentStatus)}
                  <span className="text-[11px] font-mono text-[#06038D]/50">#{listing.id}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{listing.title ?? `卡牌 #${listing.cardId}`}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-gray-500">賣家: {listing.sellerName ?? listing.sellerId}</span>
                  {hasCurrentBid && (
                    <span className="text-[11px] font-semibold text-green-700">目前出價: HKD {parseFloat(listing.currentBid).toLocaleString()}</span>
                  )}
                </div>
                {/* Mobile-only extra info */}
                <div className="flex items-center gap-2 mt-1 lg:hidden flex-wrap">
                  <span className="text-[11px] text-[#06038D]/70">起標: HKD {parseFloat(listing.startingBid ?? '0').toLocaleString()}</span>
                  <span className="text-[11px] text-gray-500">出價: {listing.bidCount ?? 0} 筆</span>
                  {listing.auctionEndAt && <span className="text-[11px] text-gray-400">結標: {new Date(listing.auctionEndAt).toLocaleString('zh-HK', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>}
                </div>
                {listing.auctionStatus === 'rejected' && listing.rejectedReason && (
                  <div className="mt-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    拒絕原因：{listing.rejectedReason}
                  </div>
                )}
              </div>
              {/* Starting Bid - desktop */}
              <div className="hidden lg:flex flex-col items-end">
                <span className="text-sm font-bold text-[#06038D]">HKD {parseFloat(listing.startingBid ?? '0').toLocaleString()}</span>
                {listing.buyNowPrice && (
                  <span className="text-[11px] text-gray-400">即買: {parseFloat(listing.buyNowPrice).toLocaleString()}</span>
                )}
              </div>
              {/* Bid Count - desktop */}
              <div className="hidden lg:flex flex-col items-center">
                <span className={`text-sm font-bold ${(listing.bidCount ?? 0) > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                  {listing.bidCount ?? 0}
                </span>
                <span className="text-[10px] text-gray-400">出價</span>
              </div>
              {/* Series - desktop */}
              <div className="hidden lg:flex justify-center">
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                  listing.tcgSeries === 'pokemon' ? 'bg-yellow-100 text-yellow-800' :
                  listing.tcgSeries === 'onepiece' ? 'bg-red-100 text-red-700' :
                  'bg-purple-100 text-purple-700'
                }`}>{listing.tcgSeries?.toUpperCase() ?? '-'}</span>
              </div>
              {/* Start time - desktop */}
              <div className="hidden lg:flex justify-center">
                {listing.auctionStartAt ? (
                  <span className="text-[11px] text-gray-500 text-center">
                    {new Date(listing.auctionStartAt).toLocaleString('zh-HK', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
                  </span>
                ) : <span className="text-[11px] text-gray-300">-</span>}
              </div>
              {/* End time - desktop */}
              <div className="hidden lg:flex justify-center">
                {listing.auctionEndAt ? (
                  <span className={`text-[11px] text-center ${
                    listing.auctionStatus === 'ending_soon' ? 'text-orange-600 font-semibold' : 'text-gray-500'
                  }`}>
                    {new Date(listing.auctionEndAt).toLocaleString('zh-HK', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
                  </span>
                ) : <span className="text-[11px] text-gray-300">-</span>}
              </div>
              {/* Actions */}
              <div className="flex items-center justify-end gap-1 flex-shrink-0">
                <button
                  onClick={() => window.open(`/auction/${listing.id}`, '_blank')}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#06038D] bg-[#06038D]/8 hover:bg-[#06038D]/15 rounded-md transition-colors whitespace-nowrap"
                  title="查看拍賣">
                  <Eye className="w-3 h-3" />查看
                </button>
                {listing.auctionStatus === 'admin_delisted' && (
                  <button
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#06038D] bg-[#FEDD00] hover:bg-[#FEDD00]/80 rounded-md transition-colors whitespace-nowrap"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ listingId: listing.id })}>
                    <CheckCircle className="w-3 h-3" />恢復
                  </button>
                )}
                {['active', 'ending_soon'].includes(listing.auctionStatus ?? '') && (
                  <button
                    className="hidden md:flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-md transition-colors whitespace-nowrap"
                    disabled={forceEndMutation.isPending}
                    onClick={() => {
                      if (confirm(`確認將拍賣 #${listing.id}「${listing.title}」強制結標？`)) {
                        forceEndMutation.mutate({ listingId: listing.id });
                      }
                    }}>
                    <Timer className="w-3 h-3" />結標
                  </button>
                )}
                {['active', 'ending_soon', 'scheduled'].includes(listing.auctionStatus ?? '') && (
                  <button
                    className="hidden md:flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap"
                    disabled={cancelMutation.isPending}
                    onClick={() => setCancelDialog({ open: true, listingId: listing.id, reason: '' })}>
                    <XCircle className="w-3 h-3" />取消
                  </button>
                )}
              </div>
            </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Delist Dialog */}
      {rejectDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-[#06038D] mb-4">強制下架拍賣</h3>
            <p className="text-sm text-[#06038D]/60 mb-3">選擇常見原因或自行輸入：</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_REJECT_REASONS.map(r => (
                <button key={r} onClick={() => setRejectDialog(d => ({ ...d, reason: r }))}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    rejectDialog.reason === r ? 'bg-red-500 text-white border-red-500' : 'border-red-200 text-red-600 hover:bg-red-50'
                  }`}>{r}</button>
              ))}
            </div>
            <Textarea
              value={rejectDialog.reason}
              onChange={e => setRejectDialog(d => ({ ...d, reason: e.target.value }))}
              placeholder="請輸入下架原因..."
              rows={3}
              className="w-full resize-none"
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setRejectDialog({ open: false, listingId: null, reason: '' })}>取消</Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                disabled={!rejectDialog.reason.trim() || rejectMutation.isPending}
                onClick={() => { if (rejectDialog.listingId) rejectMutation.mutate({ listingId: rejectDialog.listingId, reason: rejectDialog.reason.trim() }); }}
              >確認強制下架</Button>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Dialog */}
      {cancelDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-[#06038D] mb-4">強制取消拍賣</h3>
            <p className="text-sm text-red-600 mb-3">⚠️ 此操作將取消進行中的拍賣並退還所有出價保證金。</p>
            <Textarea
              value={cancelDialog.reason}
              onChange={e => setCancelDialog(d => ({ ...d, reason: e.target.value }))}
              placeholder="請輸入取消原因..."
              rows={3}
              className="w-full resize-none"
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setCancelDialog({ open: false, listingId: null, reason: '' })}>取消</Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                disabled={!cancelDialog.reason.trim() || cancelMutation.isPending}
                onClick={() => { if (cancelDialog.listingId) cancelMutation.mutate({ listingId: cancelDialog.listingId, reason: cancelDialog.reason.trim() }); }}
              >確認取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" className="text-[#06038D] border-[#06038D]/30" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            上一頁
          </Button>
          <span className="text-sm text-[#06038D]/60">第 {page} 頁 / 共 {totalPages} 頁</span>
          <Button variant="outline" size="sm" className="text-[#06038D] border-[#06038D]/30" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            下一頁
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Auction Violations Admin Tab──────────────────────────────────────────
function AuctionViolationsAdminTab() {
  const [page, setPage] = useState(1);
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [recordDialog, setRecordDialog] = useState(false);
  const [recordForm, setRecordForm] = useState({ userId: '', type: 'no_payment' as const, penalty: 'warning' as const, listingId: '', adminNote: '' });

  const { data, refetch, isLoading } = trpc.auction.adminGetViolations.useQuery({
    page,
    pageSize: 20,
    userId: filterUserId ? parseInt(filterUserId) : undefined,
  });

  const liftBanMutation = trpc.auction.adminLiftBan.useMutation({
    onSuccess: () => { toast.success('已解除封禁'); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const recordViolationMutation = trpc.auction.adminRecordViolation.useMutation({
    onSuccess: () => { toast.success('違規記錄已新增'); setRecordDialog(false); refetch(); },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const penaltyLabel: Record<string, string> = {
    warning: '⚠️ 警告', ban_7d: '🚫 封禁 7 天', ban_30d: '🚫 封禁 30 天', permanent: '🔴 永久封禁',
  };
  const penaltyColor: Record<string, string> = {
    warning: 'bg-yellow-100 text-yellow-800', ban_7d: 'bg-orange-100 text-orange-800',
    ban_30d: 'bg-red-100 text-red-800', permanent: 'bg-red-200 text-red-900',
  };
  const typeLabel: Record<string, string> = {
    no_payment: '未付款', fake_bid: '假出價', seller_cancel: '賣家取消',
  };

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">⚠️ 拍賣違規管理</h2>
          <p className="text-sm text-muted-foreground">共 {data?.total ?? 0} 筆違規記錄</p>
        </div>
        <Button onClick={() => setRecordDialog(true)} className="bg-[#06038D] hover:bg-[#06038D]/90 text-white">
          <Plus className="w-4 h-4 mr-1" /> 新增違規記錄
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Input
          placeholder="按用戶 ID 篩選..."
          value={filterUserId}
          onChange={e => { setFilterUserId(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        {filterUserId && (
          <Button variant="outline" onClick={() => { setFilterUserId(''); setPage(1); }}>清除</Button>
        )}
      </div>

      {/* Violations Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">用戶</th>
                <th className="text-left px-4 py-3 font-medium">違規類型</th>
                <th className="text-left px-4 py-3 font-medium">處罰</th>
                <th className="text-left px-4 py-3 font-medium">相關拍賣</th>
                <th className="text-left px-4 py-3 font-medium">備註</th>
                <th className="text-left px-4 py-3 font-medium">記錄時間</th>
                <th className="text-left px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.violations ?? []).map((v: any) => (
                <tr key={v.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{v.userName ?? '未知用戶'}</div>
                    <div className="text-xs text-muted-foreground">{v.userEmail ?? `ID: ${v.userId}`}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{typeLabel[v.type] ?? v.type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${penaltyColor[v.penalty] ?? 'bg-gray-100 text-gray-800'}`}>
                      {penaltyLabel[v.penalty] ?? v.penalty}
                    </span>
                    {v.banExpiresAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        至 {new Date(v.banExpiresAt).toLocaleDateString('zh-HK')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {v.listingId ? `#${v.listingId}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {v.adminNote ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(v.createdAt).toLocaleDateString('zh-HK')}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`確定解除此違規記錄 #${v.id}？`)) {
                          liftBanMutation.mutate({ violationId: v.id });
                        }
                      }}
                    >
                      <ShieldOff className="w-3 h-3 mr-1" /> 解除
                    </Button>
                  </td>
                </tr>
              ))}
              {(data?.violations ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">暫無違規記錄</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Record Violation Dialog */}
      <Dialog open={recordDialog} onOpenChange={setRecordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增違規記錄</DialogTitle>
            <DialogDescription>手動記錄用戶拍賣違規行為</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>用戶 ID</Label>
              <Input
                placeholder="輸入用戶 ID"
                value={recordForm.userId}
                onChange={e => setRecordForm(f => ({ ...f, userId: e.target.value }))}
              />
            </div>
            <div>
              <Label>違規類型</Label>
              <Select value={recordForm.type} onValueChange={v => setRecordForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_payment">未付款</SelectItem>
                  <SelectItem value="fake_bid">假出價</SelectItem>
                  <SelectItem value="seller_cancel">賣家取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>處罰</Label>
              <Select value={recordForm.penalty} onValueChange={v => setRecordForm(f => ({ ...f, penalty: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">⚠️ 警告</SelectItem>
                  <SelectItem value="ban_7d">🚫 封禁 7 天</SelectItem>
                  <SelectItem value="ban_30d">🚫 封禁 30 天</SelectItem>
                  <SelectItem value="permanent">🔴 永久封禁</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>相關拍賣 ID（選填）</Label>
              <Input
                placeholder="拍賣 listing ID"
                value={recordForm.listingId}
                onChange={e => setRecordForm(f => ({ ...f, listingId: e.target.value }))}
              />
            </div>
            <div>
              <Label>管理員備註（選填）</Label>
              <Textarea
                placeholder="記錄違規原因..."
                value={recordForm.adminNote}
                onChange={e => setRecordForm(f => ({ ...f, adminNote: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialog(false)}>取消</Button>
            <Button
              className="bg-[#06038D] hover:bg-[#06038D]/90 text-white"
              disabled={!recordForm.userId || recordViolationMutation.isPending}
              onClick={() => {
                recordViolationMutation.mutate({
                  userId: parseInt(recordForm.userId),
                  type: recordForm.type,
                  penalty: recordForm.penalty,
                  listingId: recordForm.listingId ? parseInt(recordForm.listingId) : undefined,
                  adminNote: recordForm.adminNote || undefined,
                });
              }}
            >
              {recordViolationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認記錄'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Auction Orders Admin Tab ────────────────────────────────────────────────
function AuctionOrdersAdminTab() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.auction.adminGetAuctionOrders.useQuery({
    page,
    pageSize: 20,
    status: filterStatus === 'all' ? undefined : filterStatus,
    search: search || undefined,
  }, { refetchInterval: 30000 });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const statusOptions = [
    { value: 'all', label: '全部' },
    { value: 'pending_payment', label: '待付款' },
    { value: 'payment_received', label: '已付款' },
    { value: 'processing', label: '處理中' },
    { value: 'shipped', label: '已出貨' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已取消' },
  ];

  const orderStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending_payment: { label: '待付款', className: 'bg-amber-100 text-amber-700' },
      payment_received: { label: '已付款', className: 'bg-blue-100 text-blue-700' },
      processing: { label: '處理中', className: 'bg-purple-100 text-purple-700' },
      shipped: { label: '已出貨', className: 'bg-indigo-100 text-indigo-700' },
      delivered: { label: '已送達', className: 'bg-teal-100 text-teal-700' },
      completed: { label: '已完成', className: 'bg-green-100 text-green-700' },
      cancelled: { label: '已取消', className: 'bg-red-100 text-red-600' },
    };
    const s = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.className}`}>{s.label}</span>;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#06038D]">📦 拍賣訂單管理</h2>
        <p className="text-sm text-[#06038D]/60 mt-0.5">追蹤得標付款狀態、催款提醒及訂單處理</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setFilterStatus(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === opt.value
                  ? 'bg-[#06038D] text-white shadow-sm'
                  : 'bg-white text-[#06038D]/70 border border-[#06038D]/20 hover:bg-[#06038D]/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <input
            className="border border-[#06038D]/20 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-[#06038D]"
            placeholder="搜尋訂單號/買家/商品..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          />
          <button
            onClick={() => { setSearch(searchInput); setPage(1); }}
            className="px-3 py-1.5 bg-[#06038D] text-white rounded-lg text-xs font-semibold hover:bg-[#06038D]/90"
          >搜尋</button>
          {search && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              className="px-3 py-1.5 border border-[#06038D]/20 text-[#06038D]/70 rounded-lg text-xs hover:bg-red-50"
            >清除</button>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-500">共 {total} 筆拍賣訂單</div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#06038D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-semibold">暫無拍賣訂單</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#06038D]/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#06038D]/5 border-b border-[#06038D]/10">
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">訂單號</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">商品</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">買家</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">賣家</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">金額</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">狀態</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">催款</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#06038D]/70 whitespace-nowrap">下單時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#06038D]/5">
                {orders.map((order: any) => {
                  const images = (() => { try { return JSON.parse(order.listingImages ?? '[]'); } catch { return []; } })();
                  const thumb = images[0];
                  const reminderSent = order.paymentReminderSentAt;
                  return (
                    <tr key={order.id} className="hover:bg-[#06038D]/[0.02] transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs text-[#06038D] font-semibold whitespace-nowrap">{order.orderNo}</span>
                        {order.listingId && (
                          <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">拍賣 #{order.listingId}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {thumb && <img src={thumb} alt="" className="w-8 h-8 object-cover rounded-md border border-gray-200 flex-shrink-0" />}
                          <span className="text-xs text-gray-700 line-clamp-2" style={{maxWidth:'120px'}}>{order.listingTitle ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs font-semibold text-gray-800 whitespace-nowrap">{order.buyerName ?? '—'}</div>
                        <div className="text-[10px] text-gray-400 whitespace-nowrap">{order.buyerEmail ?? ''}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs text-gray-700 whitespace-nowrap">{order.sellerDisplayName ?? order.sellerUserName ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-bold text-[#06038D] whitespace-nowrap text-xs">HK${parseFloat(order.subtotalHkd ?? '0').toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-2.5">{orderStatusBadge(order.orderStatus)}</td>
                      <td className="px-3 py-2.5">
                        {order.orderStatus === 'pending_payment' ? (
                          reminderSent ? (
                            <div className="text-[10px] text-green-600 font-semibold">
                              <div className="whitespace-nowrap">✓ 已發送</div>
                              <div className="text-gray-400 whitespace-nowrap">{new Date(reminderSent).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-600 whitespace-nowrap">待發送</span>
                          )
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#06038D]/10">
              <span className="text-xs text-gray-500">第 {page} / {totalPages} 頁</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 text-xs border border-[#06038D]/20 rounded-lg disabled:opacity-40 hover:bg-[#06038D]/5">上一頁</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 text-xs border border-[#06038D]/20 rounded-lg disabled:opacity-40 hover:bg-[#06038D]/5">下一頁</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sidebar menu items configuration
type SidebarItem = { key: string; label: string; icon: any; badgeKey?: string };
const sidebarMenuItems: SidebarItem[] = [
  { key: 'listings', label: '商品管理', icon: Package },
  { key: 'auctions', label: '拍賣管理', icon: Package, badgeKey: 'pendingAuctionReview' },
  { key: 'grading', label: 'PSA 代客鑑定', icon: Award },
  { key: 'auction_orders', label: '拍賣訂單', icon: ShoppingBag },
  { key: 'auction_violations', label: '拍賣違規', icon: Shield },
  { key: 'orders', label: '訂單管理', icon: ShoppingBag },
  { key: 'alipay', label: '支付寶核對', icon: DollarSign, badgeKey: 'pendingAlipayConfirmation' },
  { key: 'sellers', label: '賣家管理', icon: Users },
  { key: 'disputes', label: '爭議處理', icon: Flag, badgeKey: 'unresolvedDisputeCount' },
  { key: 'sales', label: '銷售總覽', icon: BarChart3 },
  { key: 'reports', label: '舉報管理', icon: Flag },
  { key: 'payouts', label: '放款管理', icon: DollarSign },
  { key: 'offers', label: '出價管理', icon: Tag },
  { key: 'timeout_settings', label: '超時時限設定', icon: Timer },
  { key: 'audit_logs', label: '審計日誌', icon: ScrollText },
  { key: 'maintenance', label: '維護模式', icon: Shield },
  { key: 'banners', label: '廣告橫幅', icon: ImagePlus },
];

export default function AdminMarketplace() {
  const { data: stats } = trpc.marketplace.adminGetStats.useQuery(undefined, { refetchInterval: 30000, refetchOnWindowFocus: true });
  const { data: pendingPayoutData } = trpc.marketplace.adminGetPendingPayoutCount.useQuery();
  const pendingPayoutCount = pendingPayoutData?.count ?? 0;
  const { data: me } = trpc.auth.me.useQuery();
  const isDev = import.meta.env.DEV;
  const [activeSection, setActiveSection] = useState('listings');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isDev && (!me || me.role !== "admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
          <p className="text-lg font-medium">無權限訪問</p>
          <Link href="/admin"><Button className="mt-4">返回 Admin</Button></Link>
        </div>
      </div>
    );
  }

  const [ordersListingFilter, setOrdersListingFilter] = useState<number | null>(null);

  const handleViewOrders = (listingId: number) => {
    setOrdersListingFilter(listingId);
    setActiveSection('orders');
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'listings': return <ListingsTab onViewOrders={handleViewOrders} />;
      case 'auctions': return <AuctionsAdminTab />;
      case 'grading': return <AdminGrading />;
      case 'auction_orders': return <AuctionOrdersAdminTab />;
      case 'auction_violations': return <AuctionViolationsAdminTab />;
      case 'orders': return <OrdersTab listingFilter={ordersListingFilter} onClearListingFilter={() => setOrdersListingFilter(null)} onViewOrders={handleViewOrders} />;
      case 'alipay': return <AlipayPendingTab />;
      case 'sellers': return <SellersTab />;
      case 'disputes': return <DisputesTab />;
      case 'sales': return <SalesReportTab />;
      case 'reports': return <ReportsTab />;
      case 'payouts': return <PayoutsTab />;
      case 'offers': return <OffersTab />;
      case 'timeout_settings': return <TimeoutSettingsTab />;
      case 'audit_logs': return <AuditLogsTab />;
      case 'maintenance': return <MaintenanceModeTab />;
      case 'banners': return <BannersTab />;
      default: return <ListingsTab onViewOrders={handleViewOrders} />;
    }
  };

  const currentLabel = sidebarMenuItems.find(i => i.key === activeSection)?.label ?? '商品管理';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden shrink-0 z-40 bg-[#06038d] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-white/10">
            <Layers className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">商場管理後台</span>
        </div>
        <span className="text-xs bg-white/20 px-2 py-1 rounded">{currentLabel}</span>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-[#06038d] text-white shadow-xl overflow-y-auto">
            <div className="p-4 border-b border-white/10">
              <Link href="/admin" className="flex items-center gap-2 text-white/70 hover:text-white text-xs mb-3">
                <ArrowLeft className="w-3 h-3" />返回 Admin
              </Link>
              <h2 className="text-lg font-bold">商場管理</h2>
            </div>
            {/* Mobile Stats */}
            <div className="p-3 border-b border-white/10 grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.activeListings ?? 0}</p>
                <p className="text-[10px] text-white/60">上架商品</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.totalOrders ?? 0}</p>
                <p className="text-[10px] text-white/60">總訂單</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.pendingAlipayConfirmation ?? 0}</p>
                <p className="text-[10px] text-white/60">待核對支付寶</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.activeSellerCount ?? 0}</p>
                <p className="text-[10px] text-white/60">活躍賣家</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center col-span-2">
                <p className="text-lg font-bold text-red-300">{stats?.thisMonthCancelledOrders ?? 0}</p>
                <p className="text-[10px] text-white/60">本月取消訂單</p>
              </div>
            </div>
            {pendingPayoutCount > 0 && (
              <button
                className="mt-2 w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 rounded-lg p-2 text-xs text-center transition-colors"
                onClick={() => { setActiveSection('orders'); setSidebarOpen(false); }}
              >
                💰 {pendingPayoutCount} 筆待放款訂單
              </button>
            )}
            {/* Mobile Nav */}
            <nav className="p-2">
              {sidebarMenuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.key;
                const badgeVal = item.badgeKey ? (stats as any)?.[item.badgeKey] ?? 0 : 0;
                return (
                  <button key={item.key}
                    onClick={() => { setActiveSection(item.key); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                      isActive ? 'bg-white/20 text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {badgeVal > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{badgeVal}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[#06038d] text-white overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <Link href="/admin" className="flex items-center gap-2 text-white/70 hover:text-white text-xs mb-3">
              <ArrowLeft className="w-3 h-3" />返回 Admin
            </Link>
            <h2 className="text-lg font-bold">商場管理後台</h2>
            <p className="text-xs text-white/50 mt-0.5">管理商品、訂單、賣家及財務</p>
          </div>
          {/* Desktop Stats */}
          <div className="p-3 border-b border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.activeListings ?? 0}</p>
                <p className="text-[10px] text-white/60">上架商品</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.totalOrders ?? 0}</p>
                <p className="text-[10px] text-white/60">總訂單</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.pendingAlipayConfirmation ?? 0}</p>
                <p className="text-[10px] text-white/60">待核對支付寶</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{stats?.activeSellerCount ?? 0}</p>
                <p className="text-[10px] text-white/60">活躍賣家</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center col-span-2">
                <p className="text-lg font-bold text-red-300">{stats?.thisMonthCancelledOrders ?? 0}</p>
                <p className="text-[10px] text-white/60">本月取消訂單</p>
              </div>
            </div>

            {pendingPayoutCount > 0 && (
              <button
                className="mt-2 w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 rounded-lg p-2 text-xs text-center transition-colors"
                onClick={() => setActiveSection('orders')}
              >
                💰 {pendingPayoutCount} 筆待放款訂單
              </button>
            )}
          </div>
          {/* Desktop Nav */}
          <nav className="flex-1 p-2 overflow-y-auto">
            {sidebarMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              const badgeVal = item.badgeKey ? (stats as any)?.[item.badgeKey] ?? 0 : 0;
              return (
                <button key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                    isActive ? 'bg-white/20 text-white font-semibold shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badgeVal > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{badgeVal}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 bg-white text-gray-900">
          {/* Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500 mb-4">
            <Link href="/admin" className="hover:text-gray-900">Admin</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{currentLabel}</span>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// MAINTENANCE MODE TAB
// ============================================================
function MaintenanceModeTab() {
  const utils = trpc.useUtils();
  // Marketplace maintenance
  const { data: modeData, isLoading: modeLoading } = trpc.marketplace.getMarketplaceMaintenanceMode.useQuery();
  // Grading maintenance
  const { data: gradingModeData, isLoading: gradingModeLoading } = trpc.grading.getGradingMaintenanceMode.useQuery();
  const { data: whitelistData, isLoading: whitelistLoading } = trpc.marketplace.getMarketplaceWhitelist.useQuery();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<{ id: number; name: string; email: string } | null | 'not_found'>(null);
  const searchQuery = trpc.marketplace.searchUserForWhitelist.useQuery(
    { email: searchEmail.trim() || 'placeholder@example.com' },
    { enabled: false }
  );
  const toggleMaintenanceMutation = trpc.marketplace.setMarketplaceMaintenanceMode.useMutation({
    onSuccess: (data) => {
      toast.success(data.enabled ? '市集維護模式已開啟' : '市集維護模式已關閉');
      utils.marketplace.getMarketplaceMaintenanceMode.invalidate();
    },
    onError: (e: any) => toast.error(parseApiError(e)),
  });
  const toggleGradingMaintenanceMutation = trpc.grading.setGradingMaintenanceMode.useMutation({
    onSuccess: (data) => {
      toast.success(data.enabled ? '鑑定服務維護模式已開啟' : '鑑定服務維護模式已關閉');
      utils.grading.getGradingMaintenanceMode.invalidate();
    },
    onError: (e: any) => toast.error(parseApiError(e)),
  });
  const addWhitelistMutation = trpc.marketplace.addMarketplaceWhitelist.useMutation({
    onSuccess: () => {
      toast.success('已加入白名單');
      utils.marketplace.getMarketplaceWhitelist.invalidate();
      setSearchEmail(''); setSearchResult(null);
    },
    onError: (e: any) => toast.error(parseApiError(e)),
  });
  const removeWhitelistMutation = trpc.marketplace.removeMarketplaceWhitelist.useMutation({
    onSuccess: () => {
      toast.success('已從白名單移除');
      utils.marketplace.getMarketplaceWhitelist.invalidate();
    },
    onError: (e: any) => toast.error(parseApiError(e)),
  });
  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearchResult(null);
    const result = await searchQuery.refetch();
    if (result.data) setSearchResult({ id: result.data.id, name: result.data.name ?? '', email: result.data.email });
    else setSearchResult('not_found');
  };
  const isSearching = searchQuery.isFetching;
  const isMaintenanceOn = modeData?.enabled ?? false;
  const isGradingMaintenanceOn = gradingModeData?.enabled ?? false;
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-[#06038d] mb-1">維護模式管理</h2>
        <p className="text-sm text-gray-500">開啟後，只有管理員和白名單用戶可以訪問對應功能。非白名單用戶將看到「維護中」提示頁面。</p>
      </div>

      {/* ── 市集維護模式 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">🛍️ 市集維護模式</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {modeLoading ? '載入中...' : isMaintenanceOn ? '🔴 目前已開啟維護模式' : '🟢 目前市集正常開放'}
            </p>
          </div>
          <Button
            onClick={() => toggleMaintenanceMutation.mutate({ enabled: !isMaintenanceOn })}
            disabled={modeLoading || toggleMaintenanceMutation.isPending}
            className={isMaintenanceOn ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
          >
            {toggleMaintenanceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : isMaintenanceOn ? <ShieldOff className="w-4 h-4 mr-1" /> : <Shield className="w-4 h-4 mr-1" />}
            {isMaintenanceOn ? '關閉維護模式' : '開啟維護模式'}
          </Button>
        </div>
        {isMaintenanceOn && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
            ⚠️ 市集維護模式已開啟。只有管理員和白名單用戶可以訪問市集。
          </div>
        )}
      </div>

      {/* ── 鑑定服務維護模式 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">🏆 PSA 代客鑑定維護模式</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {gradingModeLoading ? '載入中...' : isGradingMaintenanceOn ? '🔴 目前已開啟維護模式' : '🟢 目前鑑定服務正常開放'}
            </p>
          </div>
          <Button
            onClick={() => toggleGradingMaintenanceMutation.mutate({ enabled: !isGradingMaintenanceOn })}
            disabled={gradingModeLoading || toggleGradingMaintenanceMutation.isPending}
            className={isGradingMaintenanceOn ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
          >
            {toggleGradingMaintenanceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : isGradingMaintenanceOn ? <ShieldOff className="w-4 h-4 mr-1" /> : <Shield className="w-4 h-4 mr-1" />}
            {isGradingMaintenanceOn ? '關閉維護模式' : '開啟維護模式'}
          </Button>
        </div>
        {isGradingMaintenanceOn && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
            ⚠️ 鑑定服務維護模式已開啟。只有管理員和白名單用戶可以訪問 /grading 相關頁面。
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-3">白名單管理</h3>
        <p className="text-sm text-gray-500 mb-4">白名單用戶在維護模式下仍可正常訪問市集。管理員自動擁有訪問權限，無需加入白名單。</p>
        <div className="flex gap-2 mb-4">
          <Input placeholder="輸入用戶 Email 搜尋..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchUser()} className="flex-1 text-sm" />
          <Button onClick={handleSearchUser} disabled={isSearching || !searchEmail.trim()} className="bg-[#06038d] text-white hover:bg-[#06038d]/90">
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {searchResult === 'not_found' && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">找不到此 Email 的用戶</div>}
        {searchResult && typeof searchResult !== 'string' && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{searchResult.name || '（無名稱）'}</p>
              <p className="text-xs text-gray-500">{searchResult.email} · ID: {searchResult.id}</p>
            </div>
            <Button size="sm" onClick={() => { if (searchResult && typeof searchResult !== 'string') addWhitelistMutation.mutate({ userId: searchResult.id }); }} disabled={addWhitelistMutation.isPending} className="bg-[#06038d] text-white hover:bg-[#06038d]/90 text-xs">
              {addWhitelistMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
              加入白名單
            </Button>
          </div>
        )}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">白名單用戶（{whitelistData?.length ?? 0} 人）</span>
          </div>
          {whitelistLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : !whitelistData || whitelistData.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400"><Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />白名單目前為空</div>
          ) : (
            <div className="divide-y">
              {whitelistData.map(entry => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.userName || '（無名稱）'}</p>
                    <p className="text-xs text-gray-500 truncate">{entry.userEmail} · ID: {entry.userId}</p>
                    {entry.note && <p className="text-xs text-blue-600 mt-0.5">備注：{entry.note}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeWhitelistMutation.mutate({ userId: entry.userId })} disabled={removeWhitelistMutation.isPending} className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2 shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
