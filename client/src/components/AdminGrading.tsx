import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Send,
  Eye,
  Calendar,
  Award,
  RefreshCw,
  List,
} from "lucide-react";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "pending_shipment", label: "待寄件" },
  { value: "pending_payment", label: "等待收件" },
  { value: "received", label: "已收件" },
  { value: "submitted_to_psa", label: "已出團" },
  { value: "grading", label: "鑑定中" },
  { value: "graded", label: "鑑定完成" },
  { value: "payment_pending", label: "待付款" },
  { value: "returned", label: "已寄回" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const STATUS_COLOR: Record<string, string> = {
  pending_shipment: "bg-yellow-100 text-yellow-800",
  pending_payment: "bg-amber-100 text-amber-800",
  received: "bg-indigo-100 text-indigo-800",
  submitted_to_psa: "bg-purple-100 text-purple-800",
  grading: "bg-violet-100 text-violet-800",
  graded: "bg-green-100 text-green-800",
  payment_pending: "bg-orange-100 text-orange-800",
  returned: "bg-teal-100 text-teal-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

// ─── Service Tier Management ──────────────────────────────────────────────────
function ServiceTierManagement() {
  const utils = trpc.useUtils();
  const { data: tiers, isLoading } = trpc.grading.admin.getAllTiers.useQuery();
  const [editTier, setEditTier] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    feeHkd: "",
    maxDeclaredValueUsd: "",
    estimatedDaysMin: "",
    estimatedDaysMax: "",
    description: "",
    isActive: true,
    sortOrder: 0,
  });

  const saveMutation = trpc.grading.admin.upsertTier.useMutation({
    onSuccess: () => {
      toast.success(editTier ? "服務層級已更新" : "服務層級已新增");
      utils.grading.admin.getAllTiers.invalidate();
      utils.grading.getServiceTiers.invalidate();
      setShowForm(false);
      setEditTier(null);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.grading.admin.deleteTier.useMutation({
    onSuccess: () => {
      toast.success("服務層級已刪除");
      utils.grading.admin.getAllTiers.invalidate();
      utils.grading.getServiceTiers.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => setForm({
    name: "", feeHkd: "", maxDeclaredValueUsd: "", estimatedDaysMin: "",
    estimatedDaysMax: "", description: "", isActive: true, sortOrder: 0,
  });

  const openEdit = (tier: any) => {
    setEditTier(tier);
    setForm({
      name: tier.name,
      feeHkd: tier.feeHkd,
      maxDeclaredValueUsd: tier.maxDeclaredValueUsd,
      estimatedDaysMin: String(tier.estimatedDaysMin),
      estimatedDaysMax: String(tier.estimatedDaysMax),
      description: tier.description ?? "",
      isActive: tier.isActive,
      sortOrder: tier.sortOrder ?? 0,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name || !form.feeHkd || !form.maxDeclaredValueUsd) {
      toast.error("請填寫必填欄位");
      return;
    }
    saveMutation.mutate({
      id: editTier?.id,
      name: form.name,
      feeHkd: parseFloat(form.feeHkd) || 0,
      maxDeclaredValueUsd: parseFloat(form.maxDeclaredValueUsd) || 0,
      estimatedDaysMin: parseInt(form.estimatedDaysMin) || 30,
      estimatedDaysMax: parseInt(form.estimatedDaysMax) || 150,
      description: form.description || undefined,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">服務層級管理</h3>
        <Button
          size="sm"
          onClick={() => { resetForm(); setEditTier(null); setShowForm(true); }}
          className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          新增層級
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
      ) : (
        <div className="space-y-2">
          {(tiers ?? []).map((tier: any) => (
            <div key={tier.id} className={`flex items-center justify-between p-4 rounded-xl border ${tier.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-60"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{tier.name}</span>
                  {!tier.isActive && <Badge variant="outline" className="text-xs text-gray-400">已停用</Badge>}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  HK${parseFloat(tier.feeHkd).toLocaleString()} / 張 ·
                  最高申報 USD ${parseFloat(tier.maxDeclaredValueUsd).toLocaleString()} ·
                  約 {tier.estimatedDaysMin} - {tier.estimatedDaysMax} 工作天
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(tier)} className="h-8 px-2">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`確定刪除「${tier.name}」服務層級？`)) {
                      deleteMutation.mutate({ id: tier.id });
                    }
                  }}
                  className="h-8 px-2 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tier form dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditTier(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTier ? "編輯服務層級" : "新增服務層級"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">層級名稱 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 Value Bulk" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">代送費用（HKD）*</Label>
                <Input value={form.feeHkd} onChange={(e) => setForm({ ...form, feeHkd: e.target.value })} placeholder="275" type="number" />
              </div>
              <div>
                <Label className="text-xs font-semibold">最高申報價值（USD）*</Label>
                <Input value={form.maxDeclaredValueUsd} onChange={(e) => setForm({ ...form, maxDeclaredValueUsd: e.target.value })} placeholder="499" type="number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">預計最短時間（月）</Label>
                <Input value={form.estimatedDaysMin} onChange={(e) => setForm({ ...form, estimatedDaysMin: e.target.value })} placeholder="4" type="number" />
              </div>
              <div>
                <Label className="text-xs font-semibold">預計最長時間（月）</Label>
                <Input value={form.estimatedDaysMax} onChange={(e) => setForm({ ...form, estimatedDaysMax: e.target.value })} placeholder="5" type="number" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">說明（可選）</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="層級說明..." className="resize-none h-16" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">排序</Label>
                <Input value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} type="number" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="accent-[#06038d]"
                  />
                  <span className="text-sm">開放申請</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-[#06038d] hover:bg-[#06038d]/90 text-white">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Batch Management ─────────────────────────────────────────────────────────
function BatchManagement() {
  const utils = trpc.useUtils();
  const { data: batches, isLoading } = trpc.grading.admin.getAllBatches.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", deadline: "", shippedAt: "" });

  const createMutation = trpc.grading.admin.upsertBatch.useMutation({
    onSuccess: () => {
      toast.success("出團批次已建立");
      utils.grading.admin.getAllBatches.invalidate();
      setShowForm(false);
      setForm({ name: "", deadline: "", shippedAt: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const closeMutation = trpc.grading.admin.deleteBatch.useMutation({
    onSuccess: () => {
      toast.success("批次已關閉");
      utils.grading.admin.getAllBatches.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">出團批次管理</h3>
        <Button size="sm" onClick={() => setShowForm(true)} className="bg-[#06038d] hover:bg-[#06038d]/90 text-white">
          <Plus className="h-4 w-4 mr-1" />
          新增批次
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
      ) : (
        <div className="space-y-2">
          {(batches ?? []).length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">尚無出團批次</p>
          )}
          {(batches ?? []).map((batch: any) => (
            <div key={batch.id} className="rounded-xl border bg-white border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{batch.batchName}</span>
                    <Badge className={
                      batch.status === "open" ? "bg-green-500 text-white text-xs" :
                      batch.status === "shipped" ? "bg-purple-100 text-purple-800 text-xs" :
                      batch.status === "closed" ? "bg-gray-100 text-gray-600 text-xs" :
                      "bg-blue-100 text-blue-800 text-xs"
                    }>
                      {batch.status === "open" ? "開放中" :
                       batch.status === "shipped" ? "已出團" :
                       batch.status === "closed" ? "已關閉" :
                       batch.status === "returned" ? "已回件" : batch.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                    {batch.cutoffDate && (
                      <span className="text-xs text-gray-500">
                        <span className="text-gray-400">收件截止：</span>
                        {new Date(batch.cutoffDate).toLocaleDateString("zh-HK")}
                      </span>
                    )}
                    {batch.shippedDate && (
                      <span className="text-xs text-gray-500">
                        <span className="text-gray-400">出團日期：</span>
                        {new Date(batch.shippedDate).toLocaleDateString("zh-HK")}
                      </span>
                    )}
                    <span className="text-xs text-[#06038d] font-semibold">
                      已分配 {batch.submissionCount ?? 0} 個申請
                    </span>
                  </div>
                </div>
                {batch.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => closeMutation.mutate({ id: batch.id })}
                    className="text-xs shrink-0 ml-3"
                  >
                    關閉批次
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增出團批次</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">批次名稱 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 2026年4月第一批" />
            </div>
            <div>
              <Label className="text-xs font-semibold">收件截止日期</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs font-semibold">出團日期</Label>
              <Input type="date" value={form.shippedAt} onChange={(e) => setForm({ ...form, shippedAt: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button
              onClick={() => createMutation.mutate({
                batchName: form.name,
                cutoffDate: form.deadline || new Date().toISOString().split('T')[0],
                shippedDate: form.shippedAt || undefined,
                status: 'open' as const,
              })}
              disabled={!form.name || createMutation.isPending}
              className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Submission Management ────────────────────────────────────────────────────
function SubmissionManagement() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailSubmission, setDetailSubmission] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [notifNote, setNotifNote] = useState("");
  const [cardListSub, setCardListSub] = useState<any>(null);
  const [showCardList, setShowCardList] = useState(false);
  const [cardListSubId, setCardListSubId] = useState<number | null>(null);
  const { data: cardListDetail, isLoading: cardListLoading } = trpc.grading.admin.getSubmissionDetail.useQuery(
    { id: cardListSubId! },
    { enabled: !!cardListSubId }
  );
  const [detailSubId, setDetailSubId] = useState<number | null>(null);
  const { data: detailFull, isLoading: detailLoading } = trpc.grading.admin.getSubmissionDetail.useQuery(
    { id: detailSubId! },
    { enabled: !!detailSubId }
  );

  const { data: submissionsData, isLoading, refetch } = trpc.grading.admin.listSubmissions.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
   const submissions: any[] = Array.isArray(submissionsData) ? submissionsData : (submissionsData as any)?.submissions ?? [];
  const { data: batchesData } = trpc.grading.admin.getAllBatches.useQuery();
  const batches: any[] = Array.isArray(batchesData) ? batchesData : [];
  const updateStatusMutation = trpc.grading.admin.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("狀態已更新");
      utils.grading.admin.listSubmissions.invalidate();
      setShowDetail(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateGradingResultMutation = trpc.grading.admin.fillGradingResult.useMutation({
    onSuccess: () => {
      toast.success("鑑定結果已儲存並通知客人");
      utils.grading.admin.listSubmissions.invalidate();
      setShowDetail(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const assignBatchMutation = trpc.grading.admin.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("已分配批次");
      utils.grading.admin.listSubmissions.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openDetail = (sub: any) => {
    setDetailSubId(sub.id);
    setDetailSubmission({
      ...sub,
      itemResults: [],
      newStatus: sub.status,
      notifNote: "",
      trackingNo: sub.trackingNo ?? "",
      batchId: sub.batchId ?? null,
    });
    setShowDetail(true);
  };

  // Sync detailFull into detailSubmission when loaded
  const prevDetailFullRef = React.useRef<any>(null);
  React.useEffect(() => {
    if (detailFull && detailFull !== prevDetailFullRef.current) {
      prevDetailFullRef.current = detailFull;
      setDetailSubmission((prev: any) => prev ? {
        ...prev,
        ...detailFull,
        itemResults: (detailFull.items ?? []).map((item: any) => ({
          id: item.id,
          psaGrade: item.psaGrade ?? "",
          psaCertNo: item.psaCertNo ?? "",
        })),
        newStatus: prev.newStatus,
        notifNote: prev.notifNote,
        trackingNo: prev.trackingNo,
      } : prev);
    }
  }, [detailFull]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">鑑定申請管理</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 px-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
      ) : (
        <div className="space-y-2">
          {(submissions ?? []).length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">沒有符合條件的申請</p>
          )}
          {(submissions ?? []).map((sub: any) => (
            <div key={sub.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#06038d] text-sm font-mono">{sub.orderNo}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[sub.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_OPTIONS.find((s) => s.value === sub.status)?.label ?? sub.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {sub.userName ? `${sub.userName} · ` : ""}共 {sub.itemCount ?? 0} 張 ·
                    {new Date(sub.createdAt).toLocaleDateString("zh-HK")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">HK${parseFloat(sub.totalFeeHkd).toLocaleString()}</span>
                  {expandedId === sub.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {expandedId === sub.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  {/* Batch assignment */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500">出團批次：</span>
                    <Select
                      value={sub.batchId ? String(sub.batchId) : "none"}
                      onValueChange={(v) => assignBatchMutation.mutate({
                        id: sub.id,
                        status: sub.status as any,
                        batchId: v === "none" ? undefined : parseInt(v),
                      })}
                    >
                      <SelectTrigger className="h-7 text-xs w-40">
                        <SelectValue placeholder="未分配" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未分配</SelectItem>
                        {(batches ?? []).map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.batchName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setCardListSub(sub); setCardListSubId(sub.id); setShowCardList(true); }}
                      className="h-8 text-xs border-[#06038d] text-[#06038d] hover:bg-[#06038d]/5"
                    >
                      <List className="h-3.5 w-3.5 mr-1.5" />
                      查看 {sub.itemCount ?? 0} 張卡牌
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openDetail(sub)}
                      className="bg-[#06038d] hover:bg-[#06038d]/90 text-white h-8 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      管理申請
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Card list dialog */}
      <Dialog open={showCardList} onOpenChange={setShowCardList}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>卡牌明細 — {cardListSub?.orderNo}</DialogTitle>
          </DialogHeader>
          {cardListSub && (
            <div className="space-y-2">
              {cardListLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#06038d]" /></div>
              ) : (cardListDetail?.items ?? []).length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">沒有卡牌資料</p>
              ) : (
                (cardListDetail?.items ?? []).map((item: any, idx: number) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <span className="text-xs text-gray-400 font-mono mt-0.5 w-5 shrink-0">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{item.cardName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.tier?.name && (
                          <span className="text-xs text-gray-500">{item.tier.name}</span>
                        )}
                        {item.declaredValueUsd && (
                          <span className="text-xs text-gray-400">USD ${item.declaredValueUsd}</span>
                        )}
                        {item.psaGrade && (
                          <span className="bg-[#06038d] text-white px-1.5 py-0.5 rounded text-xs font-bold">PSA {item.psaGrade}</span>
                        )}
                        {item.psaCertNo && (
                          <span className="text-xs text-gray-400">#{item.psaCertNo}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail management dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>管理申請 — {detailSubmission?.orderNo}</DialogTitle>
          </DialogHeader>
          {detailSubmission && (
            <div className="space-y-4">
              {/* Status update */}
              <div className="bg-gray-50 rounded-xl p-4">
                <Label className="text-xs font-semibold text-gray-600 mb-2 block">更新狀態</Label>
                <Select
                  value={detailSubmission.newStatus}
                  onValueChange={(v) => setDetailSubmission({ ...detailSubmission, newStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">通知備注（發送給客人）</Label>
                  <Textarea
                    value={detailSubmission.notifNote}
                    onChange={(e) => setDetailSubmission({ ...detailSubmission, notifNote: e.target.value })}
                    placeholder="可選：附加說明文字..."
                    className="resize-none h-16 text-sm"
                  />
                </div>
                {detailSubmission.newStatus === "returned" && (
                  <div className="mt-2">
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">追蹤號碼</Label>
                    <Input
                      value={detailSubmission.trackingNo}
                      onChange={(e) => setDetailSubmission({ ...detailSubmission, trackingNo: e.target.value })}
                      placeholder="寄回追蹤號碼"
                    />
                  </div>
                )}
                <Button
                  className="mt-3 w-full bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                  onClick={() => updateStatusMutation.mutate({
                    id: detailSubmission.id,
                    status: detailSubmission.newStatus as any,
                    adminNotes: detailSubmission.notifNote || undefined,
                    returnTrackingNo: detailSubmission.trackingNo || undefined,
                  })}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <><Send className="h-4 w-4 mr-2" />更新狀態並通知客人</>
                  )}
                </Button>
              </div>

              {/* Grading results */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-green-600" />
                  <Label className="text-sm font-bold text-green-800">填寫鑑定結果</Label>
                </div>
                <p className="text-xs text-green-700 mb-3">填寫後按「儲存並通知客人付款」，系統將自動通知客人評分結果及付款連結。</p>
                <div className="space-y-2">
                  {(detailSubmission.itemResults ?? []).map((ir: any, idx: number) => {
                    const item = (detailSubmission.items ?? [])[idx];
                    return (
                      <div key={ir.id} className="bg-white rounded-lg p-3 border border-green-100">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          #{idx + 1} {item?.cardName}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-gray-500">PSA 評分</Label>
                            <Select
                              value={ir.psaGrade || "none"}
                              onValueChange={(v) => {
                                const updated = [...detailSubmission.itemResults];
                                updated[idx] = { ...ir, psaGrade: v === "none" ? "" : v };
                                setDetailSubmission({ ...detailSubmission, itemResults: updated });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="選擇評分" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {["10", "9.5", "9", "8.5", "8", "7.5", "7", "6", "5", "4", "3", "2", "1", "A"].map((g) => (
                                  <SelectItem key={g} value={g}>PSA {g}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">PSA 認證號碼</Label>
                            <Input
                              value={ir.psaCertNo}
                              onChange={(e) => {
                                const updated = [...detailSubmission.itemResults];
                                updated[idx] = { ...ir, psaCertNo: e.target.value };
                                setDetailSubmission({ ...detailSubmission, itemResults: updated });
                              }}
                              placeholder="認證號碼"
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button
                  className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateGradingResultMutation.mutate({
                    submissionId: detailSubmission.id,
                    items: (detailSubmission.itemResults ?? []).map((ir: any) => ({
                      itemId: ir.id,
                      psaGrade: ir.psaGrade || undefined,
                      psaCertNumber: ir.psaCertNo || undefined,
                    })),
                  })}
                  disabled={updateGradingResultMutation.isPending}
                >
                  {updateGradingResultMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" />儲存鑑定結果並通知客人付款</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminGrading() {
  const [activeSection, setActiveSection] = useState<"submissions" | "tiers" | "batches">("submissions");

  const sections = [
    { id: "submissions" as const, label: "申請管理", icon: <Package className="h-4 w-4" /> },
    { id: "tiers" as const, label: "服務層級", icon: <Award className="h-4 w-4" /> },
    { id: "batches" as const, label: "出團批次", icon: <Calendar className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">PSA 代客鑑定管理</h2>
        <p className="text-gray-500 text-sm mt-1">管理鑑定申請、服務層級及出團批次</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeSection === s.id
                ? "border-[#06038d] text-[#06038d]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "submissions" && <SubmissionManagement />}
      {activeSection === "tiers" && <ServiceTierManagement />}
      {activeSection === "batches" && <BatchManagement />}
    </div>
  );
}
