import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Package, Users, AlertCircle, CheckCircle, Clock, ArrowLeft, Plus, Eye, Edit, DollarSign, ImagePlus, X, Loader2 } from "lucide-react";
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
                  <span>HKD {parseFloat(listing.price as string).toFixed(2)}</span>
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
                  <span>HKD {parseFloat(order.total as string).toFixed(2)}</span>
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
                <span className="font-medium">HKD {parseFloat(selectedOrder.total).toFixed(2)}</span>
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
  const confirmMutation = trpc.marketplace.adminConfirmAlipayPayment.useMutation({
    onSuccess: () => { toast.success("已確認收款"); refetch(); setSelectedOrder(null); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">支付寶 HK 手動核對</p>
            <p className="mt-1">請登入支付寶 HK 商戶後台核對收款後，點擊「確認收款」。</p>
            <p className="mt-1">收款帳號：<strong>Account ID: 2160120158548164</strong></p>
          </div>
        </div>
      </div>
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
            <div key={order.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium">{order.orderNo}</span>
                  <Badge className="bg-yellow-100 text-yellow-800">待核對</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-foreground">HKD {parseFloat(order.total as string).toFixed(2)}</span>
                  <span>{new Date(order.createdAt).toLocaleString("zh-HK")}</span>
                  {order.alipayProofImageUrl && (
                    <a href={order.alipayProofImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      <Eye className="w-3 h-3" />查看截圖
                    </a>
                  )}
                </div>
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { setSelectedOrder(order); setNote(""); }}>
                <CheckCircle className="w-3 h-3 mr-1" />確認收款
              </Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>確認支付寶 HK 收款</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p>訂單：<strong>{selectedOrder.orderNo}</strong></p>
                <p>金額：<strong>HKD {parseFloat(selectedOrder.total).toFixed(2)}</strong></p>
              </div>
              {selectedOrder.alipayProofImageUrl && (
                <img src={selectedOrder.alipayProofImageUrl} alt="付款截圖" className="rounded-lg border max-h-48 object-contain w-full" />
              )}
              <div><Label>備注（可選）</Label><Input value={note} onChange={e => setNote(e.target.value)} placeholder="例：已在支付寶後台核對，交易號 xxxx" /></div>
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
    </div>
  );
}

function SellersTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = trpc.marketplace.adminGetSellers.useQuery({ page, pageSize: 20 });
  const approveMutation = trpc.marketplace.adminApproveSeller.useMutation({
    onSuccess: (_, vars) => { toast.success(vars.approve ? "賣家已批准" : "賣家已停用"); refetch(); },
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
              </div>
              <div className="flex items-center gap-2">
                {!seller.isActive ? (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => approveMutation.mutate({ sellerId: seller.id, approve: true })}>
                    <CheckCircle className="w-3 h-3 mr-1" />批准
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => approveMutation.mutate({ sellerId: seller.id, approve: false })}>
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

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard title="上架商品" value={stats?.activeListings ?? 0} icon={Package} color="bg-blue-100 text-blue-700" />
          <StatCard title="總訂單" value={stats?.totalOrders ?? 0} icon={ShoppingBag} color="bg-purple-100 text-purple-700" />
          <StatCard title="待核對支付寶" value={stats?.pendingAlipayConfirmation ?? 0} icon={AlertCircle} color="bg-amber-100 text-amber-700" />
          <StatCard title="活躍賣家" value={stats?.activeSellerCount ?? 0} icon={Users} color="bg-green-100 text-green-700" />
          <StatCard title="待審核商品" value={stats?.pendingReviewListings ?? 0} icon={Clock} color="bg-orange-100 text-orange-700" />
        </div>

        <Tabs defaultValue="listings">
          <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="listings" className="flex items-center gap-1">
              <Package className="w-4 h-4" />商品管理
              {(stats?.pendingReviewListings ?? 0) > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats?.pendingReviewListings}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1">
              <ShoppingBag className="w-4 h-4" />訂單管理
            </TabsTrigger>
            <TabsTrigger value="alipay" className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />支付寶核對
              {(stats?.pendingAlipayConfirmation ?? 0) > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats?.pendingAlipayConfirmation}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sellers" className="flex items-center gap-1">
              <Users className="w-4 h-4" />賣家管理
            </TabsTrigger>
          </TabsList>
          <TabsContent value="listings"><ListingsTab /></TabsContent>
          <TabsContent value="orders"><OrdersTab /></TabsContent>
          <TabsContent value="alipay"><AlipayPendingTab /></TabsContent>
          <TabsContent value="sellers"><SellersTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
