import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Package, Users, AlertCircle, CheckCircle, Clock, ArrowLeft, Plus, Eye, Edit, DollarSign, ImagePlus, X, Loader2, Image, Trash2, ToggleLeft, ToggleRight, Flag, TrendingUp, TrendingDown, BarChart3, ChevronLeft, ChevronRight, User2, Calendar, Tag, Check, Layers } from "lucide-react";
import { CONDITION_GROUPS } from "@/lib/conditions";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";

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
  const [form, setForm] = useState({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", status: "active", allowOffers: false });
  const [images, setImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);

  const { data: conditionPriceData, isLoading: conditionPriceLoading } = trpc.cards.getPriceByCondition.useQuery(
    { cardId: selectedCard?.id ?? 0, condition: form.condition },
    { enabled: !!selectedCard?.id && !!form.condition }
  );

  const reset = () => {
    setForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", status: "active", allowOffers: false });
    setImages([]);
    setSelectedCard(null);
    setStep(1);
  };

  const createMutation = trpc.marketplace.adminCreatePlatformListing.useMutation({
    onSuccess: () => { toast.success("平台商品已上架"); onSuccess(); onClose(); reset(); },
    onError: (e) => toast.error(e.message),
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
                    <div className="flex gap-2 overflow-x-auto pb-1">
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

function ListingDetailDialog({ listingId, onClose, onUpdated }: { listingId: number | null; onClose: () => void; onUpdated: () => void }) {
  const [editMode, setEditMode] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", quantity: "", status: "" });

  const { data, isLoading, refetch } = trpc.marketplace.adminGetListingDetail.useQuery(
    { id: listingId! },
    { enabled: !!listingId }
  );

  const updateMutation = trpc.marketplace.adminUpdateListing.useMutation({
    onSuccess: () => { toast.success("已更新商品資料"); setEditMode(false); refetch(); onUpdated(); },
    onError: (e) => toast.error(e.message),
  });

  const listing = data?.listing;
  const sellerProfile = data?.sellerProfile;
  const sellerUser = data?.sellerUser;
  const orderCount = data?.orderCount ?? 0;

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

  return (
    <Dialog open={!!listingId} onOpenChange={() => { onClose(); setEditMode(false); setImgIdx(0); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {editMode ? "編輯商品" : "商品詳情"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : listing ? (
          <div className="space-y-5">
            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="relative">
                <div className="aspect-square max-h-64 w-full rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                  <img src={images[imgIdx]} alt={listing.title} className="w-full h-full object-contain" />
                </div>
                {images.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="flex justify-center gap-1 mt-2">
                      {images.map((_, i) => (
                        <button key={i} onClick={() => setImgIdx(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {editMode ? (
              /* Edit Form */
              <div className="space-y-4">
                <div><Label>商品名稱</Label><Input className="mt-1" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>描述</Label><Textarea className="mt-1" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>售價 (HKD)</Label><Input className="mt-1" type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} min="4" step="0.01" /></div>
                  <div><Label>庫存數量</Label><Input className="mt-1" type="number" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} min="0" /></div>
                </div>
                <div>
                  <Label>狀態</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">上架中</SelectItem>
                      <SelectItem value="pending_review">待審核</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="removed">已下架</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{listing.title}</h3>
                  {listing.description && <p className="text-sm text-muted-foreground mt-1">{listing.description}</p>}
                </div>

                {/* Key Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">售價</p>
                    <p className="font-bold text-lg">HKD {parseFloat(listing.priceHkd as string || "0").toFixed(2)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">庫存</p>
                    <p className="font-bold text-lg">{listing.quantity}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">品相</p>
                    <Badge className={conditionColor[listing.condition] ?? ""}>{conditionLabel[listing.condition] ?? listing.condition}</Badge>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">訂單數</p>
                    <p className="font-bold text-lg">{orderCount}</p>
                  </div>
                </div>

                {/* Status & Type */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={listing.status === "active" ? "bg-green-100 text-green-800" : listing.status === "pending_review" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}>
                    {listing.status === "active" ? "上架中" : listing.status === "pending_review" ? "待審核" : listing.status === "draft" ? "草稿" : listing.status === "sold" ? "已售出" : "已下架"}
                  </Badge>
                  <Badge variant="outline" className={listing.sellerType === "platform" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>
                    {listing.sellerType === "platform" ? "官方商品" : "C2C 賣家"}
                  </Badge>
                </div>

                {/* Dates */}
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>上架時間：{new Date(listing.createdAt).toLocaleString("zh-HK")}</span>
                  </div>
                  {listing.listedAt && (
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      <span>正式上架：{new Date(listing.listedAt).toLocaleString("zh-HK")}</span>
                    </div>
                  )}
                </div>

                {/* Seller Info (C2C only) */}
                {listing.sellerType === "seller" && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2"><User2 className="w-4 h-4" />賣家資訊</p>
                    {sellerProfile ? (
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          {sellerProfile.avatarUrl && <img src={sellerProfile.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt="" />}
                          <div>
                            <p className="font-medium">{sellerProfile.displayName}</p>
                            {sellerUser && <p className="text-xs text-muted-foreground">{sellerUser.email}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>總銷售：{sellerProfile.totalSales}</span>
                          <span>評分：{sellerProfile.avgRating ?? "N/A"} ({sellerProfile.ratingCount} 評)</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">賣家資料不可用</p>
                    )}
                  </div>
                )}

                {/* Rejection Reason */}
                {listing.rejectedReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-800">拒絕原因</p>
                    <p className="text-sm text-red-700 mt-1">{listing.rejectedReason}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>取消</Button>
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
              <Button variant="outline" onClick={onClose}>關閉</Button>
              {listing?.status !== "sold" && (
                <Button className="bg-[#06038d] hover:bg-[#0804b8] text-white" onClick={handleEditOpen}>
                  <Edit className="w-4 h-4 mr-2" />編輯商品
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListingsTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { data, isLoading, refetch } = trpc.marketplace.adminGetListings.useQuery({
    page, pageSize: 20, status: statusFilter === "all" ? undefined : statusFilter
  });
  const updateMutation = trpc.marketplace.adminUpdateListing.useMutation({
    onSuccess: () => { toast.success("已更新"); refetch(); },
    onError: (e) => toast.error(e.message)
  });
  const listings = data?.listings ?? [];
  const total = data?.total ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "active", "pending_review", "draft", "sold", "removed"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={statusFilter === s ? "bg-[#06038d] text-white" : ""}>
              {s === "all" ? "全部" : s === "active" ? "上架中" : s === "pending_review" ? "待審核" : s === "draft" ? "草稿" : s === "sold" ? "已售出" : "已下架"}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#06038d] hover:bg-[#0804b8] text-white">
          <Plus className="w-4 h-4 mr-2" />新增平台商品
        </Button>
      </div>
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暫無商品</p></div>
      ) : (
        <div className="space-y-2">
          {listings.map((listing: any) => (
            <div key={listing.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{listing.title}</span>
                  <Badge variant="outline" className={conditionColor[listing.condition] ?? ""}>{conditionLabel[listing.condition] ?? listing.condition}</Badge>
                  <Badge variant="outline" className={listing.sellerType === "platform" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>
                    {listing.sellerType === "platform" ? "官方" : "賣家"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span>HKD {parseFloat(listing.priceHkd as string || "0").toFixed(2)}</span>
                  <span>庫存: {listing.quantity}</span>
                  <span>{new Date(listing.createdAt).toLocaleDateString("zh-HK")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={listing.status === "active" ? "bg-green-100 text-green-800" : listing.status === "pending_review" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}>
                  {listing.status === "active" ? "上架中" : listing.status === "pending_review" ? "待審核" : listing.status === "draft" ? "草稿" : listing.status === "sold" ? "已售出" : "已下架"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setSelectedListingId(listing.id)}>
                  <Eye className="w-3 h-3 mr-1" />{listing.status === "sold" ? "查看詳情" : "查看/編輯"}
                </Button>
                {listing.status === "pending_review" && (
                  <>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => updateMutation.mutate({ id: listing.id, status: "active" })}>
                      <CheckCircle className="w-3 h-3 mr-1" />批准
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => { setRejectDialogId(listing.id); setRejectReason(""); }}>
                      拒絕
                    </Button>
                  </>
                )}
                {listing.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: listing.id, status: "removed" })}>下架</Button>
                )}
                {listing.status === "removed" && (
                  <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: listing.id, status: "active" })}>重新上架</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="flex items-center text-sm text-muted-foreground">第 {page} 頁 / 共 {Math.ceil(total / 20)} 頁</span>
          <Button variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}
      <Dialog open={rejectDialogId !== null} onOpenChange={() => setRejectDialogId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>拒絕商品上架</DialogTitle></DialogHeader>
          <Label className="text-sm">拒絕原因（將通知賣家）</Label>
          <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="請輸入具體原因，如：圖片不清晰、描述不符實際等..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogId(null)}>取消</Button>
            <Button variant="destructive" disabled={updateMutation.isPending}
              onClick={() => { if (rejectDialogId) { updateMutation.mutate({ id: rejectDialogId, status: "removed", rejectedReason: rejectReason || undefined }); setRejectDialogId(null); } }}>
              確認拒絕
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateListingDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={refetch} />
      <ListingDetailDialog
        listingId={selectedListingId}
        onClose={() => setSelectedListingId(null)}
        onUpdated={refetch}
      />
    </div>
  );
}

function OrdersTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [note, setNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingMethod, setShippingMethod] = useState("sf_express");
  const { data, isLoading, refetch } = trpc.marketplace.adminGetOrders.useQuery({
    page, pageSize: 20, status: statusFilter === "all" ? undefined : statusFilter
  });
  const updateStatusMutation = trpc.marketplace.adminUpdateOrderStatus.useMutation({
    onSuccess: () => { toast.success("訂單狀態已更新"); refetch(); setSelectedOrder(null); setTrackingNumber(""); },
    onError: (e) => toast.error(e.message)
  });
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "pending_payment", "payment_received", "processing", "shipped", "completed", "disputed"].map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={statusFilter === s ? "bg-[#06038d] text-white" : ""}>
            {s === "all" ? "全部" : orderStatusLabel[s] ?? s}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暫無訂單</p></div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => (
            <div key={order.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium">{order.orderNo}</span>
                  <Badge className={orderStatusColor[order.orderStatus] ?? ""}>{orderStatusLabel[order.orderStatus] ?? order.orderStatus}</Badge>
                  <Badge variant="outline" className={order.paymentMethod === "stripe" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}>
                    {order.paymentMethod === "stripe" ? "Stripe" : "支付寶 HK"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span>HKD {parseFloat(order.subtotalHkd as string || "0").toFixed(2)}</span>
                  <span>{new Date(order.createdAt).toLocaleDateString("zh-HK")}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setNote(order.adminNote ?? ""); setTrackingNumber(order.trackingNumber ?? ""); setShippingMethod(order.shippingMethod ?? "sf_express"); }}>
                <Edit className="w-3 h-3 mr-1" />管理
              </Button>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="flex items-center text-sm text-muted-foreground">第 {page} 頁 / 共 {Math.ceil(total / 20)} 頁</span>
          <Button variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>訂單管理 — {selectedOrder?.orderNo}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3">
                <span className="text-muted-foreground">付款方式</span>
                <span>{selectedOrder.paymentMethod === "stripe" ? "Stripe" : "支付寶 HK"}</span>
                <span className="text-muted-foreground">訂單金額</span>
                <span className="font-medium">HKD {parseFloat(selectedOrder.subtotalHkd || "0").toFixed(2)}</span>
                <span className="text-muted-foreground">當前狀態</span>
                <Badge className={orderStatusColor[selectedOrder.orderStatus] ?? ""}>{orderStatusLabel[selectedOrder.orderStatus]}</Badge>
                <span className="text-muted-foreground">訂單日期</span>
                <span>{new Date(selectedOrder.createdAt).toLocaleDateString("zh-HK")}</span>
                {selectedOrder.sellerType && (
                  <><span className="text-muted-foreground">賣家類型</span>
                  <span>{selectedOrder.sellerType === 'platform' ? '平台官方' : '一般賣家'}</span></>
                )}
              </div>
              {/* Buyer Shipping Info */}
              {selectedOrder.shippingName && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1 text-sm">
                  <p className="font-medium text-blue-800 mb-1.5">📦 收件資訊</p>
                  <p><span className="text-muted-foreground">收件人：</span>{selectedOrder.shippingName}</p>
                  {selectedOrder.shippingPhone && <p><span className="text-muted-foreground">電話：</span>{selectedOrder.shippingPhone}</p>}
                  {selectedOrder.shippingAddress && (
                    <p><span className="text-muted-foreground">地址：</span>{(() => {
                      try {
                        const addr = JSON.parse(selectedOrder.shippingAddress);
                        if (addr && typeof addr === 'object') {
                          return [addr.address, addr.district, addr.region].filter(Boolean).join(', ');
                        }
                        return selectedOrder.shippingAddress;
                      } catch { return selectedOrder.shippingAddress; }
                    })()}</p>
                  )}
                  {selectedOrder.trackingNumber && (
                    <p><span className="text-muted-foreground">追蹤號：</span><strong>{selectedOrder.trackingNumber}</strong></p>
                  )}
                  {selectedOrder.shippedAt && (
                    <p><span className="text-muted-foreground">出貨日期：</span>{new Date(selectedOrder.shippedAt).toLocaleDateString("zh-HK")}</p>
                  )}
                </div>
              )}
              {/* Ship Action: show when status needs shipping */}
              {["processing", "payment_received", "paid_held"].includes(selectedOrder.orderStatus) && (
                <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50 space-y-3">
                  <p className="font-medium text-indigo-800 text-sm">🚚 填寫出貨資料</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">物流方式</Label>
                      <Select value={shippingMethod} onValueChange={setShippingMethod}>
                        <SelectTrigger className="mt-1 h-8 text-sm">
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
                      <Label className="text-xs">追蹤號碼</Label>
                      <Input
                        className="mt-1 h-8 text-sm"
                        placeholder="輸入追蹤號碼"
                        value={trackingNumber}
                        onChange={e => setTrackingNumber(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate({
                      orderId: selectedOrder.id,
                      orderStatus: "shipped",
                      note,
                      trackingNumber: trackingNumber || undefined,
                      shippingMethod: shippingMethod || undefined,
                    })}>
                    確認出貨
                  </Button>
                </div>
              )}
              {/* Status Update */}
              <div>
                <Label>更新狀態</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["processing", "shipped", "delivered", "completed", "cancelled", "disputed"].map(s => (
                    <Button key={s} size="sm" variant="outline"
                      disabled={selectedOrder.orderStatus === s || updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({
                        orderId: selectedOrder.id,
                        orderStatus: s as any,
                        note,
                        trackingNumber: s === 'shipped' ? (trackingNumber || undefined) : undefined,
                        shippingMethod: s === 'shipped' ? (shippingMethod || undefined) : undefined,
                      })}>
                      {orderStatusLabel[s] ?? s}
                    </Button>
                  ))}
                </div>
              </div>
              <div><Label>Admin 備注</Label><Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} /></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlipayPendingTab() {
  const { data: orders, isLoading, refetch } = trpc.marketplace.adminGetAlipayPending.useQuery();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchNote, setBatchNote] = useState("");
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  const confirmMutation = trpc.marketplace.adminConfirmAlipayPayment.useMutation({
    onSuccess: () => { toast.success("已確認收款，已通知買家"); refetch(); setSelectedOrder(null); },
    onError: (e) => toast.error(e.message),
  });

  const batchConfirmMutation = trpc.marketplace.adminBatchConfirmAlipayPayment.useMutation({
    onSuccess: (data) => {
      toast.success(`批量審核完成：${data.successCount} 筆成功${data.failCount > 0 ? `，${data.failCount} 筆失敗` : ""}`);
      refetch();
      setSelectedIds(new Set());
      setShowBatchDialog(false);
    },
    onError: (e) => toast.error(e.message),
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
            <span className="text-muted-foreground">全選 ({selectedIds.size}/{allIds.length})</span>
          </label>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => { setBatchNote(""); setShowBatchDialog(true); }}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              批量確認 ({selectedIds.size} 筆)
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : !orders || orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-500" />
          <p>暫無待核對的支付寶 HK 訂單</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => (
            <div key={order.id} className={`border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card transition-colors ${selectedIds.has(order.id) ? "border-green-400 bg-green-50" : ""}`}>
              <div className="flex items-start gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(order.id)}
                  onChange={() => toggleSelect(order.id)}
                  className="w-4 h-4 mt-1 rounded border-gray-300 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium">{order.orderNo}</span>
                    <Badge className="bg-yellow-100 text-yellow-800">待核對</Badge>
                    {order.shippingName && <span className="text-xs text-muted-foreground">買家：{order.shippingName}</span>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-foreground">HKD {parseFloat(order.subtotalHkd as string || "0").toFixed(2)}</span>
                    <span>{new Date(order.createdAt).toLocaleString("zh-HK")}</span>
                    {order.alipayProofImageUrl && (
                      <a href={order.alipayProofImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <Eye className="w-3 h-3" />查看截圖
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                onClick={() => { setSelectedOrder(order); setNote(""); }}>
                <CheckCircle className="w-3 h-3 mr-1" />確認收款
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Single confirm dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>確認支付寶 HK 收款</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p>訂單：<strong>{selectedOrder.orderNo}</strong></p>
                <p>金額：<strong>HKD {parseFloat(selectedOrder.subtotalHkd || "0").toFixed(2)}</strong></p>
                {selectedOrder.shippingName && <p>買家：<strong>{selectedOrder.shippingName}</strong></p>}
              </div>
              {selectedOrder.alipayProofImageUrl && (
                <img src={selectedOrder.alipayProofImageUrl} alt="付款截圖" className="rounded-lg border max-h-48 object-contain w-full" />
              )}
              {selectedOrder.aiVerificationResult && (() => {
                try {
                  const ai = JSON.parse(selectedOrder.aiVerificationResult);
                  return (
                    <div className={`rounded-lg p-3 text-sm border ${
                      ai.verified ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
                    }`}>
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        {ai.verified
                          ? <span className="text-green-700">✅ AI 驗證：付款截圖有效</span>
                          : <span className="text-red-700">⚠️ AI 驗證：對比失敗</span>
                        }
                        {ai.confidence !== undefined && (
                          <span className="text-xs text-gray-500 ml-auto">可信度: {Math.round(ai.confidence * 100)}%</span>
                        )}
                      </div>
                      {ai.detectedAmount && <p className="text-xs text-gray-600">偵測金額: HKD {ai.detectedAmount}</p>}
                      {ai.reason && <p className="text-xs text-gray-600 mt-1">{ai.reason}</p>}
                    </div>
                  );
                } catch { return null; }
              })()}
              <div><Label>備注（可選）</Label><Input value={note} onChange={e => setNote(e.target.value)} placeholder="例：已在支付寶後台核對，交易號 xxxx" /></div>
              <p className="text-sm text-green-700 bg-green-50 rounded p-2">ℹ️ 確認後系統會自動發送通知給買家和賣家。</p>
              <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">請確認已在支付寶 HK 商戶後台核對到此筆收款後，再點擊確認。</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>取消</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate({ orderId: selectedOrder.id, note })}>
              {confirmMutation.isPending ? "確認中..." : "確認已收款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch confirm dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>批量確認支付寶 HK 收款</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p>將確認以下 <strong>{selectedIds.size}</strong> 筆訂單的支付寶 HK 收款：</p>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {orders?.filter((o: any) => selectedIds.has(o.id)).map((o: any) => (
                  <li key={o.id} className="flex justify-between">
                    <span className="font-mono">{o.orderNo}</span>
                    <span className="font-medium">HKD {parseFloat(o.subtotalHkd || "0").toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div><Label>備注（可選，會發送給所有買家）</Label><Input value={batchNote} onChange={e => setBatchNote(e.target.value)} placeholder="例：已批量核對支付寶 HK 後台收款記錄" /></div>
            <p className="text-sm text-green-700 bg-green-50 rounded p-2">ℹ️ 確認後系統會自動通知所有買家和賣家。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>取消</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={batchConfirmMutation.isPending}
              onClick={() => batchConfirmMutation.mutate({ orderIds: Array.from(selectedIds), note: batchNote || undefined })}
            >
              {batchConfirmMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />審核中...</> : `確認 ${selectedIds.size} 筆收款`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
              <div className="bg-muted/50 px-4 py-2 border-b">
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
              <div className="bg-muted/50 px-4 py-2 border-b">
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
              <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
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
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; sellerId: number; sellerName: string }>({ open: false, sellerId: 0, sellerName: "" });
  const [rejectReason, setRejectReason] = useState("");
  const { data, isLoading, refetch } = trpc.marketplace.adminGetSellers.useQuery({ page, pageSize: 20 });
  const approveMutation = trpc.marketplace.adminApproveSeller.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "賣家已批准，已通知申請人" : "賣家已拒絕/停用，已通知申請人");
      setRejectDialog({ open: false, sellerId: 0, sellerName: "" });
      setRejectReason("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const sellers = data?.sellers ?? [];
  const total = data?.total ?? 0;
  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暫無賣家申請</p></div>
      ) : (
        <div className="space-y-2">
          {sellers.map((seller: any) => (
            <div key={seller.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{seller.displayName}</span>
                  <Badge className={seller.isActive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                    {seller.isActive ? "已批准" : "待審核"}
                  </Badge>
                  <Badge variant="outline" className={seller.stripeConnectStatus === "active" ? "bg-green-100 text-green-800" : seller.stripeConnectStatus === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                    Stripe: {seller.stripeConnectStatus}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span>總銷售: {seller.totalSales}</span>
                  <span>評分: {seller.rating ?? "N/A"}</span>
                  <span>申請: {new Date(seller.createdAt).toLocaleDateString("zh-HK")}</span>
                </div>
                {seller.rejectReason && (
                  <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                    拒絕原因：{seller.rejectReason}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedSellerId(seller.id)}>
                  <Eye className="w-3 h-3 mr-1" />查看詳情
                </Button>
                {!seller.isActive ? (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ sellerId: seller.id, approve: true })}>
                    <CheckCircle className="w-3 h-3 mr-1" />批准
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => { setRejectDialog({ open: true, sellerId: seller.id, sellerName: seller.displayName }); setRejectReason(""); }}>
                    停用
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="flex items-center text-sm text-muted-foreground">第 {page} 頁 / 共 {Math.ceil(total / 20)} 頁</span>
          <Button variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}

      {/* Seller Detail Dialog */}
      <SellerDetailDialog sellerId={selectedSellerId} onClose={() => setSelectedSellerId(null)} />

      {/* Reject/Deactivate Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>停用賣家帳號</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">停用 <strong>{rejectDialog.sellerName}</strong> 的賣家資格，其所有商品將自動下架，並通知申請人。</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">拒絕/停用原因（選填，將發送給用戶）</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038d] resize-none bg-background text-foreground"
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
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.marketplace.adminGetDisputes.useQuery({ page, pageSize: 20 });
  const resolveMutation = trpc.marketplace.adminResolveDispute.useMutation({
    onSuccess: () => {
      toast.success("✅ 爭議已處理");
      setSelectedDispute(null);
      setResolution("");
      setAdminNote("");
      utils.marketplace.adminGetDisputes.invalidate();
      utils.marketplace.adminGetOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });;

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">載入中...</div>;

  const disputes = data?.orders ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Flag className="w-5 h-5 text-red-500" />
          爭議訂單管理
        </h3>
        <span className="text-sm text-muted-foreground">共 {data?.total ?? 0} 筆爭議</span>
      </div>

      {disputes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p>目前沒有待處理的爭議</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((order: any) => (
            <div key={order.id} className="border rounded-xl p-4 bg-red-50 border-red-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">#{order.orderNo}</span>
                    <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5">爭議中</span>
                  </div>
                  <p className="font-medium text-sm">{order.listingTitle ?? "商品"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)} · {order.paymentMethod}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {order.buyerName && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">買家：</span>{order.buyerName}
                        {order.buyerEmail && <span className="ml-1 text-muted-foreground/70">({order.buyerEmail})</span>}
                      </p>
                    )}
                  </div>
                  {order.shippedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">出貨時間：</span>{new Date(order.shippedAt).toLocaleString("zh-HK")}
                    </p>
                  )}
                  {order.disputeOpenedAt && (
                    <p className="text-xs text-red-600 mt-1">
                      <span className="font-medium">申請時間：</span>{new Date(order.disputeOpenedAt).toLocaleString("zh-HK")}
                    </p>
                  )}
                  {order.disputeReason && (
                    <div className="mt-2 bg-white border border-red-200 rounded-lg p-2.5 text-xs text-gray-700">
                      <span className="font-medium text-red-600">爭議原因：</span>{order.disputeReason}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="bg-[#06038d] hover:bg-[#06038d]/90 text-white flex-shrink-0"
                  onClick={() => { setSelectedDispute(order); setResolution(""); setOutcome("refund_buyer"); }}
                >
                  <Edit className="w-4 h-4 mr-1" />處理
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Dispute Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={(o) => !o && setSelectedDispute(null)}>
        <DialogContent className="max-w-md">
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
              {/* Evidence Images */}
              {selectedDispute.disputeEvidenceUrls && (() => {
                try {
                  const urls: string[] = JSON.parse(selectedDispute.disputeEvidenceUrls);
                  if (urls.length > 0) return (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">買家提供的截圖證據：</p>
                      <div className="flex flex-wrap gap-2">
                        {urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity">
                            <img src={url} alt={`證據 ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
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
                adminNote: adminNote.trim() || undefined,
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
  const utils = trpc.useUtils();
  const { data: banners = [], isLoading } = trpc.marketplace.adminGetBanners.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editBanner, setEditBanner] = useState<any | null>(null);
  const [form, setForm] = useState({
    title: "", subtitle: "", cta: "立即選購",
    gradient: "from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]",
    accentColor: "#FEDD00", badge: "", emoji: "🏆", sortOrder: 0, isActive: true,
  });

  const createMutation = trpc.marketplace.adminCreateBanner.useMutation({
    onSuccess: () => { toast.success("廣告已新增"); utils.marketplace.adminGetBanners.invalidate(); setShowForm(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.marketplace.adminUpdateBanner.useMutation({
    onSuccess: () => { toast.success("廣告已更新"); utils.marketplace.adminGetBanners.invalidate(); setEditBanner(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.marketplace.adminDeleteBanner.useMutation({
    onSuccess: () => { toast.success("廣告已刪除"); utils.marketplace.adminGetBanners.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => setForm({ title: "", subtitle: "", cta: "立即選購", gradient: "from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]", accentColor: "#FEDD00", badge: "", emoji: "🏆", sortOrder: 0, isActive: true });

  const openEdit = (b: any) => {
    setEditBanner(b);
    setForm({ title: b.title, subtitle: b.subtitle, cta: b.cta, gradient: b.gradient, accentColor: b.accentColor, badge: b.badge, emoji: b.emoji, sortOrder: b.sortOrder, isActive: b.isActive });
  };

  const handleSubmitCreate = () => {
    if (!form.title.trim()) { toast.error("請輸入標題"); return; }
    createMutation.mutate({ ...form });
  };

  const handleSubmitUpdate = () => {
    if (!editBanner) return;
    updateMutation.mutate({ id: editBanner.id, ...form });
  };

  const BannerForm = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <Label>標題 *</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例：PSA 10 精品展示" />
      </div>
      <div className="sm:col-span-2">
        <Label>副標題</Label>
        <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="例：精選頂級評級卡牌，每張都是投資价値" />
      </div>
      <div>
        <Label>CTA 按鈕文字</Label>
        <Input value={form.cta} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))} placeholder="立即選購" />
      </div>
      <div>
        <Label>Emoji 圖標</Label>
        <Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🏆" />
      </div>
      <div>
        <Label>徽章文字</Label>
        <Input value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} placeholder="例：PSA 認證" />
      </div>
      <div>
        <Label>強調色</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border" />
          <Input value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="flex-1" />
        </div>
      </div>
      <div>
        <Label>排列順序</Label>
        <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
      </div>
      <div className="flex items-center gap-2">
        <Label>狀態</Label>
        <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))} className="flex items-center gap-1 text-sm">
          {form.isActive ? <ToggleRight className="w-6 h-6 text-green-600" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
          {form.isActive ? "啟用" : "停用"}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Label>Gradient CSS 類名</Label>
        <Input value={form.gradient} onChange={e => setForm(f => ({ ...f, gradient: e.target.value }))} placeholder="from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]" />
        <p className="text-xs text-muted-foreground mt-1">Tailwind gradient class，例：from-blue-900 via-blue-800 to-blue-700</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">廣告 Banner 管理</h3>
          <p className="text-sm text-muted-foreground">管理商城首頁輪播廣告，支援新增、編輯、刪除及排序</p>
        </div>
        <Button onClick={() => { setShowForm(true); resetForm(); }} className="bg-[#06038d] hover:bg-[#0a06b5] text-white">
          <Plus className="w-4 h-4 mr-1" />新增 Banner
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暫無 Banner，點擊「新增 Banner」開始創建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b: any) => (
            <div key={b.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-2xl">{b.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{b.title}</span>
                    <Badge className={b.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {b.isActive ? "啟用" : "停用"}
                    </Badge>
                    {b.badge && <Badge variant="outline">{b.badge}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{b.subtitle}</p>
                  <p className="text-xs text-muted-foreground">排序: {b.sortOrder} · CTA: {b.cta}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                  <Edit className="w-3 h-3 mr-1" />編輯
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => { if (confirm("確定刪除此 Banner？")) deleteMutation.mutate({ id: b.id }); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增廣告 Banner</DialogTitle></DialogHeader>
          <BannerForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending} className="bg-[#06038d] text-white">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "建立 Banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editBanner} onOpenChange={(o) => { if (!o) setEditBanner(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>編輯 Banner</DialogTitle></DialogHeader>
          <BannerForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBanner(null)}>取消</Button>
            <Button onClick={handleSubmitUpdate} disabled={updateMutation.isPending} className="bg-[#06038d] text-white">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存變更"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SalesReportTab() {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = trpc.marketplace.adminGetSalesReport.useQuery({ months });

  const fmtHkd = (v: number) => v.toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtYearMonth = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${y}年${parseInt(m)}月`;
  };

  const overall = data?.overall;
  const monthly = data?.monthly ?? [];

  return (
    <div className="space-y-6">
      {/* Overall Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#06038d] to-[#1a0a9e] rounded-xl p-4 text-white">
          <p className="text-xs opacity-80 mb-1">平台銷售總額</p>
          <p className="text-2xl font-bold">HKD {fmtHkd(overall?.totalSalesHkd ?? 0)}</p>
          <p className="text-xs opacity-70 mt-1">{overall?.totalOrders ?? 0} 筆已付款訂單</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-4 text-white">
          <p className="text-xs opacity-80 mb-1">C2C 手續費收入</p>
          <p className="text-2xl font-bold">HKD {fmtHkd(overall?.totalFeesHkd ?? 0)}</p>
          <p className="text-xs opacity-70 mt-1">僅計算賣家訂單</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
          <p className="text-xs opacity-80 mb-1">平台直售額</p>
          <p className="text-2xl font-bold">HKD {fmtHkd(overall?.platformSalesHkd ?? 0)}</p>
          <p className="text-xs opacity-70 mt-1">官方上架商品</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white">
          <p className="text-xs opacity-80 mb-1">C2C 賣家銷售額</p>
          <p className="text-2xl font-bold">HKD {fmtHkd(overall?.sellerSalesHkd ?? 0)}</p>
          <p className="text-xs opacity-70 mt-1">Stripe {overall?.stripeCount ?? 0} · 支付寶 {overall?.alipayCount ?? 0}</p>
        </div>
      </div>

      {/* Month Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">每月銷售明細</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">顯示最近</span>
          <Select value={String(months)} onValueChange={v => setMonths(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 個月</SelectItem>
              <SelectItem value="12">12 個月</SelectItem>
              <SelectItem value="24">24 個月</SelectItem>
              <SelectItem value="36">36 個月</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monthly Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />載入中...</div>
      ) : monthly.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暫無銷售數據</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">月份</th>
                <th className="text-right px-4 py-3 font-medium">銷售總額</th>
                <th className="text-right px-4 py-3 font-medium">平台直售</th>
                <th className="text-right px-4 py-3 font-medium">C2C 銷售</th>
                <th className="text-right px-4 py-3 font-medium">手續費收入</th>
                <th className="text-right px-4 py-3 font-medium">訂單數</th>
                <th className="text-right px-4 py-3 font-medium">Stripe</th>
                <th className="text-right px-4 py-3 font-medium">支付寶 HK</th>
                <th className="text-right px-4 py-3 font-medium">環比</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row, idx) => {
                const prev = monthly[idx + 1];
                const growth = prev && prev.totalSalesHkd > 0
                  ? ((row.totalSalesHkd - prev.totalSalesHkd) / prev.totalSalesHkd * 100)
                  : null;
                return (
                  <tr key={row.yearMonth} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{fmtYearMonth(row.yearMonth)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#06038d]">HKD {fmtHkd(row.totalSalesHkd)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">HKD {fmtHkd(row.platformSalesHkd)}</td>
                    <td className="px-4 py-3 text-right text-purple-700">HKD {fmtHkd(row.sellerSalesHkd)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">HKD {fmtHkd(row.sellerFeesHkd)}</td>
                    <td className="px-4 py-3 text-right">{row.orderCount}</td>
                    <td className="px-4 py-3 text-right text-purple-600">{row.stripeCount}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{row.alipayCount}</td>
                    <td className="px-4 py-3 text-right">
                      {growth !== null ? (
                        <span className={`flex items-center justify-end gap-0.5 font-medium ${
                          growth >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(growth).toFixed(1)}%
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="px-4 py-3">合計</td>
                <td className="px-4 py-3 text-right text-[#06038d]">HKD {fmtHkd(monthly.reduce((s, r) => s + r.totalSalesHkd, 0))}</td>
                <td className="px-4 py-3 text-right text-blue-700">HKD {fmtHkd(monthly.reduce((s, r) => s + r.platformSalesHkd, 0))}</td>
                <td className="px-4 py-3 text-right text-purple-700">HKD {fmtHkd(monthly.reduce((s, r) => s + r.sellerSalesHkd, 0))}</td>
                <td className="px-4 py-3 text-right text-emerald-700">HKD {fmtHkd(monthly.reduce((s, r) => s + r.sellerFeesHkd, 0))}</td>
                <td className="px-4 py-3 text-right">{monthly.reduce((s, r) => s + r.orderCount, 0)}</td>
                <td className="px-4 py-3 text-right text-purple-600">{monthly.reduce((s, r) => s + r.stripeCount, 0)}</td>
                <td className="px-4 py-3 text-right text-blue-600">{monthly.reduce((s, r) => s + r.alipayCount, 0)}</td>
                <td className="px-4 py-3 text-right">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
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
  const reviewMutation = trpc.marketplace.adminReviewReport.useMutation({
    onSuccess: () => { toast.success("舉報已處理"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [noteDialogId, setNoteDialogId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [pendingAction, setPendingAction] = useState<"reviewed" | "dismissed" | "actioned">("reviewed");
  const reasonLabel: Record<string, string> = { fake_item: "假貨", wrong_description: "描述不符", prohibited_item: "禁止商品", scam: "詐騙", other: "其他" };
  const statusBadge: Record<string, string> = { pending: "bg-yellow-100 text-yellow-800", reviewed: "bg-blue-100 text-blue-800", dismissed: "bg-gray-100 text-gray-700", actioned: "bg-red-100 text-red-800" };
  const statusLabel: Record<string, string> = { pending: "待處理", reviewed: "已審核", dismissed: "已忽略", actioned: "已處置", all: "全部" };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {["all", "pending", "reviewed", "dismissed", "actioned"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s ? "bg-[#06038d] text-white border-[#06038d]" : "bg-white text-gray-600 border-gray-200 hover:border-[#06038d]"
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
                <span className="text-white text-xs font-semibold">舉報 #{r.id} · 商品 #{r.listingId}</span>
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
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-gray-500">第 {page} 頁 · 共 {data.total} 筆</span>
            <Button variant="outline" size="sm" disabled={page * 20 >= (data.total ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
      <Dialog open={noteDialogId !== null} onOpenChange={() => setNoteDialogId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>處理舉報</DialogTitle></DialogHeader>
          <Label className="text-sm">管理員備注（選填）</Label>
          <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="輸入處理備注..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogId(null)}>取消</Button>
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
                : "bg-white text-gray-600 border-gray-200 hover:border-[#06038d]/40"
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
                <div className="text-xs text-gray-600">
                  <span className="font-medium">商品：</span>{o.listingTitle ?? `ID ${o.listingId}`}
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
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-gray-500">第 {page} 頁 · 共 {data.total} 筆</span>
            <Button variant="outline" size="sm" disabled={page * 20 >= (data.total ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAYOUTS TAB
// ============================================================
function PayoutsTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.marketplace.adminGetOrders.useQuery({ page, pageSize: 20, status: "completed" });
  const totalPayout = data?.orders?.reduce((sum: number, o: any) => sum + (Number(o.sellerAmountHkd) || 0), 0) ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-gray-100 shadow-sm p-4 bg-gradient-to-br from-[#06038d]/5 to-white">
          <p className="text-xs text-gray-500 mb-1">本頁應付賣家總額</p>
          <p className="text-2xl font-bold" style={{ color: "#06038d" }}>HKD {totalPayout.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 shadow-sm p-4 bg-gradient-to-br from-green-50 to-white">
          <p className="text-xs text-gray-500 mb-1">已完成訂單數</p>
          <p className="text-2xl font-bold text-green-700">{data?.total ?? 0}</p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#06038d]" /></div>
      ) : !data?.orders?.length ? (
        <div className="text-center py-12 text-gray-400">暫無已完成訂單</div>
      ) : (
        <div className="space-y-3">
          {data.orders.map((o: any) => (
            <div key={o.id} className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#06038d] to-[#1a17a0]">
                <span className="text-white text-xs font-semibold">訂單 #{o.orderNo}</span>
                <span className="text-xs text-yellow-300 font-medium">賣家應收：HKD {Number(o.sellerAmountHkd ?? 0).toFixed(2)}</span>
              </div>
              <div className="p-4 bg-white">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span>買家：{o.buyerName ?? o.buyerId}</span>
                  <span>賣家：{o.sellerDisplayName ?? o.sellerId}</span>
                  <span>商品：{o.listingTitle ?? "-"}</span>
                  <span>付款：{o.paymentMethod === "stripe" ? "Stripe" : "支付寶"}</span>
                  <span className="text-gray-400 ml-auto">{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs text-gray-500">第 {page} 頁 · 共 {data.total} 筆</span>
            <Button variant="outline" size="sm" disabled={page * 20 >= (data.total ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMarketplace() {
  const { data: stats } = trpc.marketplace.adminGetStats.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  // 🔧 開發環境繞過 admin 權限檢查（不影響生產環境）
  const isDev = import.meta.env.DEV;

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />返回 Admin</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">商場管理後台</h1>
            <p className="text-sm text-muted-foreground">管理商品、訂單、賣家及支付寶 HK 收款核對</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <StatCard title="上架商品" value={stats?.activeListings ?? 0} icon={Package} color="bg-blue-100 text-blue-700" />
          <StatCard title="總訂單" value={stats?.totalOrders ?? 0} icon={ShoppingBag} color="bg-purple-100 text-purple-700" />
          <StatCard title="待核對支付寶" value={stats?.pendingAlipayConfirmation ?? 0} icon={AlertCircle} color="bg-amber-100 text-amber-700" />
          <StatCard title="活躍賣家" value={stats?.activeSellerCount ?? 0} icon={Users} color="bg-green-100 text-green-700" />
          <StatCard title="待審核商品" value={stats?.pendingReviewListings ?? 0} icon={Clock} color="bg-orange-100 text-orange-700" />
        </div>

        <BrandTabs defaultValue="listings" variant="light">
          <BrandTabsList wrap className="mb-2">
            <BrandTabsTrigger value="listings" icon={<Package className="w-4 h-4" />} label="商品管理">
              商品管理
              {(stats?.pendingReviewListings ?? 0) > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats?.pendingReviewListings}</span>
              )}
            </BrandTabsTrigger>
            <BrandTabsTrigger value="orders" icon={<ShoppingBag className="w-4 h-4" />} label="訂單管理">訂單管理</BrandTabsTrigger>
            <BrandTabsTrigger value="alipay" icon={<DollarSign className="w-4 h-4" />} label="支付寶核對">
              支付寶核對
              {(stats?.pendingAlipayConfirmation ?? 0) > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats?.pendingAlipayConfirmation}</span>
              )}
            </BrandTabsTrigger>
            <BrandTabsTrigger value="sellers" icon={<Users className="w-4 h-4" />} label="賣家管理">賣家管理</BrandTabsTrigger>
            <BrandTabsTrigger value="banners" icon={<Image className="w-4 h-4" />} label="廣告 Banner">廣告 Banner</BrandTabsTrigger>
            <BrandTabsTrigger value="disputes" icon={<Flag className="w-4 h-4" />} label="爭議處理">
              爭議處理
            </BrandTabsTrigger>
            <BrandTabsTrigger value="sales" icon={<BarChart3 className="w-4 h-4" />} label="銷售總覽">銷售總覽</BrandTabsTrigger>
            <BrandTabsTrigger value="reports" icon={<Flag className="w-4 h-4" />} label="舉報管理">舉報管理</BrandTabsTrigger>
            <BrandTabsTrigger value="payouts" icon={<DollarSign className="w-4 h-4" />} label="放款管理">放款管理</BrandTabsTrigger>
            <BrandTabsTrigger value="offers" icon={<Tag className="w-4 h-4" />} label="出價管理">出價管理</BrandTabsTrigger>
          </BrandTabsList>
          <BrandTabsContent value="listings"><ListingsTab /></BrandTabsContent>
          <BrandTabsContent value="orders"><OrdersTab /></BrandTabsContent>
          <BrandTabsContent value="alipay"><AlipayPendingTab /></BrandTabsContent>
          <BrandTabsContent value="sellers"><SellersTab /></BrandTabsContent>
          <BrandTabsContent value="banners"><BannersTab /></BrandTabsContent>
          <BrandTabsContent value="disputes"><DisputesTab /></BrandTabsContent>
          <BrandTabsContent value="sales"><SalesReportTab /></BrandTabsContent>
          <BrandTabsContent value="reports"><ReportsTab /></BrandTabsContent>
          <BrandTabsContent value="payouts"><PayoutsTab /></BrandTabsContent>
          <BrandTabsContent value="offers"><OffersTab /></BrandTabsContent>
        </BrandTabs>
      </div>
    </div>
  );
}
