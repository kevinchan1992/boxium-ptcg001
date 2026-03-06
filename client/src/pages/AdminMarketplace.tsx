import { useState, useRef, useCallback } from "react";
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
import { ShoppingBag, Package, Users, AlertCircle, CheckCircle, Clock, ArrowLeft, Plus, Eye, Edit, DollarSign, ImagePlus, X, Loader2, Image, Trash2, ToggleLeft, ToggleRight, Flag, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { CONDITION_GROUPS } from "@/lib/conditions";

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
  pending_payment: "待付款", payment_received: "已收款", processing: "處理中",
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

function CreateListingDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", status: "active" });
  const [images, setImages] = useState<string[]>([]);
  const reset = () => { setForm({ title: "", description: "", condition: "raw_a", price: "", quantity: "1", status: "active" }); setImages([]); };
  const createMutation = trpc.marketplace.adminCreatePlatformListing.useMutation({
    onSuccess: () => { toast.success("商品已上架"); onSuccess(); onClose(); reset(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={() => { onClose(); reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>新增平台商品</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>商品名稱 *</Label><Input className="mt-1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例：PSA 10 皮卡丘 SM-P 288" /></div>
          <div><Label>描述</Label><Textarea className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          <ImageUploader images={images} onChange={setImages} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>品相 *</Label>
              <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_GROUPS.map(group => (
                    <div key={group.group}>
                      <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wide">{group.group}</div>
                      {group.items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>狀態</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">立即上架</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>售價 (HKD) *</Label><Input className="mt-1" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" min="0" step="0.01" /></div>
            <div><Label>數量 *</Label><Input className="mt-1" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} min="1" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); reset(); }}>取消</Button>
          <Button
            onClick={() => createMutation.mutate({
              title: form.title, description: form.description,
              condition: form.condition as any, price: parseFloat(form.price),
              quantity: parseInt(form.quantity), status: form.status as any,
              images: images.length > 0 ? images : undefined
            })}
            disabled={!form.title || !form.price || createMutation.isPending}
            className="bg-[#06038d] hover:bg-[#0804b8] text-white">
            {createMutation.isPending ? "上架中..." : "確認上架"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListingsTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
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
                {listing.status === "pending_review" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => updateMutation.mutate({ id: listing.id, status: "active" })}>
                    <CheckCircle className="w-3 h-3 mr-1" />批准
                  </Button>
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
      <CreateListingDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={refetch} />
    </div>
  );
}

function OrdersTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [note, setNote] = useState("");
  const { data, isLoading, refetch } = trpc.marketplace.adminGetOrders.useQuery({
    page, pageSize: 20, status: statusFilter === "all" ? undefined : statusFilter
  });
  const updateStatusMutation = trpc.marketplace.adminUpdateOrderStatus.useMutation({
    onSuccess: () => { toast.success("訂單狀態已更新"); refetch(); setSelectedOrder(null); },
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
              <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setNote(order.adminNote ?? ""); }}>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>訂單管理 — {selectedOrder?.orderNo}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">付款方式</span>
                <span>{selectedOrder.paymentMethod === "stripe" ? "Stripe" : "支付寶 HK"}</span>
                <span className="text-muted-foreground">訂單金額</span>
                <span className="font-medium">HKD {parseFloat(selectedOrder.subtotalHkd || "0").toFixed(2)}</span>
                <span className="text-muted-foreground">當前狀態</span>
                <Badge className={orderStatusColor[selectedOrder.orderStatus] ?? ""}>{orderStatusLabel[selectedOrder.orderStatus]}</Badge>
              </div>
              <div>
                <Label>更新狀態</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["processing", "shipped", "delivered", "completed", "cancelled", "disputed"].map(s => (
                    <Button key={s} size="sm" variant="outline"
                      disabled={selectedOrder.orderStatus === s || updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, orderStatus: s as any, note })}>
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

function SellersTab() {
  const [page, setPage] = useState(1);
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
  const [outcome, setOutcome] = useState<"refund_buyer" | "release_seller" | "partial">("refund_buyer");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.marketplace.adminGetDisputes.useQuery({ page, pageSize: 20 });
  const resolveMutation = trpc.marketplace.adminResolveDispute.useMutation({
    onSuccess: () => {
      toast.success("✅ 爭議已處理");
      setSelectedDispute(null);
      setResolution("");
      utils.marketplace.adminGetDisputes.invalidate();
      utils.marketplace.adminGetOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

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
                  {order.disputeOpenedAt && (
                    <p className="text-xs text-red-600 mt-1">
                      申請時間：{new Date(order.disputeOpenedAt).toLocaleString("zh-HK")}
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
  const utils = trpc.useUtils();
  const { data: banners = [], isLoading } = trpc.marketplace.adminGetBanners.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editBanner, setEditBanner] = useState<any | null>(null);
  const [form, setForm] = useState({
    title: "", subtitle: "", cta: "立即選購",
    gradient: "from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]",
    accentColor: "#FFD700", badge: "", emoji: "🏆", sortOrder: 0, isActive: true,
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

  const resetForm = () => setForm({ title: "", subtitle: "", cta: "立即選購", gradient: "from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]", accentColor: "#FFD700", badge: "", emoji: "🏆", sortOrder: 0, isActive: true });

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
          </BrandTabsList>
          <BrandTabsContent value="listings"><ListingsTab /></BrandTabsContent>
          <BrandTabsContent value="orders"><OrdersTab /></BrandTabsContent>
          <BrandTabsContent value="alipay"><AlipayPendingTab /></BrandTabsContent>
          <BrandTabsContent value="sellers"><SellersTab /></BrandTabsContent>
          <BrandTabsContent value="banners"><BannersTab /></BrandTabsContent>
          <BrandTabsContent value="disputes"><DisputesTab /></BrandTabsContent>
          <BrandTabsContent value="sales"><SalesReportTab /></BrandTabsContent>
        </BrandTabs>
      </div>
    </div>
  );
}
