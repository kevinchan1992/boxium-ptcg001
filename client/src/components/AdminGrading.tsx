import React, { useState } from "react";
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
  Users,
  CreditCard,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCheck,
  Truck,
  BarChart3,
  X,
} from "lucide-react";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "pending_shipment", label: "待寄件" },
  { value: "received", label: "BOXIUM已收件" },
  { value: "submitted_to_psa", label: "已出團" },
  { value: "grading", label: "鑑定中" },
  { value: "graded", label: "鑑定完成" },
  { value: "payment_overdue", label: "付款逾期" },
  { value: "paid", label: "已付款" },
  { value: "returned", label: "已寄回" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const STATUS_COLOR: Record<string, string> = {
  pending_shipment: "bg-yellow-100 text-yellow-800",
  received: "bg-indigo-100 text-indigo-800",
  submitted_to_psa: "bg-purple-100 text-purple-800",
  grading: "bg-violet-100 text-violet-800",
  graded: "bg-green-100 text-green-800",
  payment_overdue: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-emerald-800",
  returned: "bg-teal-100 text-teal-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-50 text-red-400",
};

const BATCH_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "開放收件", color: "bg-green-500 text-white" },
  closed: { label: "已截止", color: "bg-gray-200 text-gray-700" },
  shipped: { label: "已出團", color: "bg-purple-100 text-purple-800" },
  returned: { label: "已回件", color: "bg-teal-100 text-teal-800" },
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
                <Label className="text-xs font-semibold">預計最短時間（工作天）</Label>
                <Input value={form.estimatedDaysMin} onChange={(e) => setForm({ ...form, estimatedDaysMin: e.target.value })} placeholder="4" type="number" />
              </div>
              <div>
                <Label className="text-xs font-semibold">預計最長時間（工作天）</Label>
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

// ─── Submission Detail Dialog (shared) ───────────────────────────────────────
function SubmissionDetailDialog({
  submissionId,
  open,
  onClose,
  onUpdated,
}: {
  submissionId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: detail, isLoading } = trpc.grading.admin.getSubmissionDetail.useQuery(
    { id: submissionId! },
    { enabled: !!submissionId && open }
  );

  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [itemResults, setItemResults] = useState<any[]>([]);

  React.useEffect(() => {
    if (detail) {
      setNewStatus(detail.status);
      setAdminNote(detail.adminNotes ?? "");
      setTrackingNo(detail.returnTrackingNo ?? "");
      setItemResults((detail.items ?? []).map((item: any) => ({
        id: item.id,
        psaGrade: item.psaGrade ?? "",
        psaCertNo: item.psaCertNumber ?? "",
      })));
    }
  }, [detail]);

  const updateStatusMutation = trpc.grading.admin.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("狀態已更新");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      onUpdated();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const fillGradingResultMutation = trpc.grading.admin.fillGradingResult.useMutation({
    onSuccess: () => {
      toast.success("鑑定結果已儲存並通知客人");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      onUpdated();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const confirmAlipayMutation = trpc.grading.adminConfirmGradingAlipayPayment.useMutation({
    onSuccess: () => {
      toast.success("支付寶收款已確認，訂單已完成");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      onUpdated();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#06038d]" />
            管理申請 — {detail?.orderNo ?? "載入中..."}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
        ) : detail ? (
          <div className="space-y-4">
            {/* Applicant info */}
            <div className="bg-[#06038d]/5 rounded-xl p-4 border border-[#06038d]/10">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">申請人</span>
                  <p className="font-semibold text-gray-900">{detail.user?.name ?? "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Email</span>
                  <p className="font-semibold text-gray-900 text-xs break-all">{detail.user?.email ?? "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">申請日期</span>
                  <p className="font-semibold text-gray-900">{new Date(detail.createdAt).toLocaleDateString("zh-HK")}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">卡牌數量</span>
                  <p className="font-semibold text-gray-900">{detail.items?.length ?? 0} 張</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">應付金額</span>
                  <p className="font-bold text-[#06038d]">HK${parseFloat(detail.totalFeeHkd).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">目前狀態</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[detail.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {STATUS_OPTIONS.find((s) => s.value === detail.status)?.label ?? detail.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Card list */}
            {(detail.items ?? []).length > 0 && (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-700">卡牌明細（{detail.items.length} 張）</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {detail.items.map((item: any, idx: number) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      {item.cardImageUrl ? (
                        <img src={item.cardImageUrl} alt={item.cardName} className="w-8 h-11 object-cover rounded shrink-0" />
                      ) : (
                        <div className="w-8 h-11 bg-gray-100 rounded shrink-0 flex items-center justify-center text-gray-300 text-xs">無</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.cardName}</p>
                        <p className="text-xs text-gray-400">{[item.cardSet, item.cardNumber].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {item.tier?.name && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">{item.tier.name}</span>}
                        {item.psaGrade && <span className="text-xs bg-[#06038d] text-white px-1.5 py-0.5 rounded font-bold">PSA {item.psaGrade}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alipay proof review */}
            {detail.alipayProofImageUrl && detail.alipayProofStatus === "pending_review" && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <Label className="text-sm font-bold text-amber-800">支付寶 HK 截圖待審核</Label>
                </div>
                <p className="text-xs text-amber-700 mb-3">客人已提交支付寶 HK 付款截圖，請確認收款後點擊「確認收款」。</p>
                <img
                  src={detail.alipayProofImageUrl}
                  alt="支付寶截圖"
                  className="w-full max-h-48 object-contain rounded-lg border border-amber-200 mb-3 cursor-pointer"
                  onClick={() => window.open(detail.alipayProofImageUrl, "_blank")}
                />
                <p className="text-xs text-gray-500 mb-2">提交時間：{detail.alipayProofSubmittedAt ? new Date(detail.alipayProofSubmittedAt).toLocaleString("zh-HK") : "—"}</p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => confirmAlipayMutation.mutate({ submissionId: detail.id })}
                  disabled={confirmAlipayMutation.isPending}
                >
                  {confirmAlipayMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCheck className="h-4 w-4 mr-2" />確認收款完成，訂單標記完成</>}
                </Button>
              </div>
            )}

            {/* Status update */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <Label className="text-xs font-semibold text-gray-600 mb-2 block">更新狀態</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
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
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="可選：附加說明文字..."
                  className="resize-none h-16 text-sm"
                />
              </div>
              {newStatus === "returned" && (
                <div className="mt-2">
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">追蹤號碼</Label>
                  <Input
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    placeholder="寄回追蹤號碼"
                  />
                </div>
              )}
              <Button
                className="mt-3 w-full bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                onClick={() => updateStatusMutation.mutate({
                  id: detail.id,
                  status: newStatus as any,
                  adminNotes: adminNote || undefined,
                  returnTrackingNo: trackingNo || undefined,
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
                {itemResults.map((ir: any, idx: number) => {
                  const item = (detail.items ?? [])[idx];
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
                              const updated = [...itemResults];
                              updated[idx] = { ...ir, psaGrade: v === "none" ? "" : v };
                              setItemResults(updated);
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
                              const updated = [...itemResults];
                              updated[idx] = { ...ir, psaCertNo: e.target.value };
                              setItemResults(updated);
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
                onClick={() => fillGradingResultMutation.mutate({
                  submissionId: detail.id,
                  items: itemResults.map((ir: any) => ({
                    itemId: ir.id,
                    psaGrade: ir.psaGrade || undefined,
                    psaCertNumber: ir.psaCertNo || undefined,
                  })),
                })}
                disabled={fillGradingResultMutation.isPending}
              >
                {fillGradingResultMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />儲存鑑定結果並通知客人付款</>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Batch Detail View ────────────────────────────────────────────────────────
function BatchDetailView({ batch, onManageSubmission }: { batch: any; onManageSubmission: (id: number) => void }) {
  const [expanded, setExpanded] = useState(true);
  const submissions = batch.submissions ?? [];

  const getPaymentStatusBadge = (sub: any) => {
    if (sub.status === "paid" || sub.status === "completed") {
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800"><CheckCheck className="h-3 w-3" />已付款</span>;
    }
    if (sub.status === "graded") {
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800"><Clock className="h-3 w-3" />待付款</span>;
    }
    if (sub.status === "payment_overdue") {
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800"><AlertCircle className="h-3 w-3" />付款逾期</span>;
    }
    return null;
  };

  const batchCfg = BATCH_STATUS_CONFIG[batch.status] ?? { label: batch.status, color: "bg-gray-100 text-gray-600" };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Batch header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-base">{batch.batchName}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${batchCfg.color}`}>{batchCfg.label}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {batch.cutoffDate && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                截止：{new Date(batch.cutoffDate).toLocaleDateString("zh-HK")}
              </span>
            )}
            {batch.shippedDate && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Truck className="h-3 w-3" />
                出團：{new Date(batch.shippedDate).toLocaleDateString("zh-HK")}
              </span>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 mr-3">
          <div className="text-center px-3 py-1.5 rounded-lg bg-[#06038d]/5 border border-[#06038d]/10">
            <p className="text-xs text-gray-500">申請</p>
            <p className="text-lg font-bold text-[#06038d]">{batch.totalSubmissions}</p>
          </div>
          <div className="text-center px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100">
            <p className="text-xs text-gray-500">卡牌</p>
            <p className="text-lg font-bold text-purple-700">{batch.totalCards}</p>
          </div>
          {batch.paidCount > 0 && (
            <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-gray-500">已付</p>
              <p className="text-lg font-bold text-emerald-700">{batch.paidCount}</p>
            </div>
          )}
          {batch.unpaidCount > 0 && (
            <div className="text-center px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-100">
              <p className="text-xs text-gray-500">待付</p>
              <p className="text-lg font-bold text-orange-600">{batch.unpaidCount}</p>
            </div>
          )}
        </div>

        {expanded ? <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />}
      </div>

      {/* Submissions table */}
      {expanded && (
        <div className="border-t border-gray-100">
          {submissions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">此批次尚無申請</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">申請單號</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">申請人</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">卡牌數</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">費用</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">進度</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">付款</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {submissions.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#06038d]">{sub.orderNo}</span>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(sub.createdAt).toLocaleDateString("zh-HK")}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{sub.userName}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[120px]">{sub.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-50 text-purple-700 font-bold text-sm">{sub.itemCount}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-gray-900">HK${parseFloat(sub.totalFeeHkd).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[sub.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {STATUS_OPTIONS.find((s) => s.value === sub.status)?.label ?? sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getPaymentStatusBadge(sub) ?? (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                        {sub.alipayProofStatus === "pending_review" && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <AlertCircle className="h-2.5 w-2.5" />截圖待審
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          onClick={() => onManageSubmission(sub.id)}
                          className="bg-[#06038d] hover:bg-[#06038d]/90 text-white h-7 px-3 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          管理
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Batch Overview (new main view) ──────────────────────────────────────────
function BatchOverview() {
  const utils = trpc.useUtils();
  const { data: batchStats, isLoading, refetch } = trpc.grading.admin.listBatchesWithStats.useQuery();
  const { data: allBatches } = trpc.grading.admin.getAllBatches.useQuery();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [batchForm, setBatchForm] = useState({ name: "", deadline: "", shippedAt: "", expectedReturn: "" });

  const createBatchMutation = trpc.grading.admin.upsertBatch.useMutation({
    onSuccess: () => {
      toast.success("出團批次已建立");
      utils.grading.admin.getAllBatches.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      setShowCreateBatch(false);
      setBatchForm({ name: "", deadline: "", shippedAt: "", expectedReturn: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateBatchMutation = trpc.grading.admin.upsertBatch.useMutation({
    onSuccess: () => {
      toast.success("批次狀態已更新");
      utils.grading.admin.getAllBatches.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleManageSubmission = (id: number) => {
    setSelectedSubmissionId(id);
    setShowDetailDialog(true);
  };

  // Summary stats
  const totalBatches = batchStats?.length ?? 0;
  const openBatches = (batchStats ?? []).filter((b: any) => b.status === "open").length;
  const totalSubmissions = (batchStats ?? []).reduce((sum: number, b: any) => sum + b.totalSubmissions, 0);
  const totalCards = (batchStats ?? []).reduce((sum: number, b: any) => sum + b.totalCards, 0);
  const totalUnpaid = (batchStats ?? []).reduce((sum: number, b: any) => sum + b.unpaidCount, 0);

  return (
    <div className="space-y-6">
      {/* Top summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#06038d] text-white rounded-xl p-4">
          <p className="text-xs text-white/70">出團批次</p>
          <p className="text-2xl font-bold">{totalBatches}</p>
          <p className="text-xs text-white/60 mt-0.5">{openBatches} 個開放中</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500">總申請數</p>
          <p className="text-2xl font-bold text-gray-900">{totalSubmissions}</p>
          <p className="text-xs text-gray-400 mt-0.5">所有批次</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500">總卡牌數</p>
          <p className="text-2xl font-bold text-purple-700">{totalCards}</p>
          <p className="text-xs text-gray-400 mt-0.5">已分配批次</p>
        </div>
        <div className={`rounded-xl p-4 border ${totalUnpaid > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs text-gray-500">待收款</p>
          <p className={`text-2xl font-bold ${totalUnpaid > 0 ? "text-orange-600" : "text-gray-900"}`}>{totalUnpaid}</p>
          <p className="text-xs text-gray-400 mt-0.5">鑑定完成未付款</p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-base">出團批次列表</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 px-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowCreateBatch(true)} className="bg-[#06038d] hover:bg-[#06038d]/90 text-white">
            <Plus className="h-4 w-4 mr-1" />
            新增批次
          </Button>
        </div>
      </div>

      {/* Batch list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
      ) : (batchStats ?? []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無出團批次</p>
          <p className="text-xs mt-1">點擊「新增批次」建立第一個出團批次</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(batchStats ?? []).map((batch: any) => (
            <BatchDetailView
              key={batch.id}
              batch={batch}
              onManageSubmission={handleManageSubmission}
            />
          ))}
        </div>
      )}

      {/* Create batch dialog */}
      <Dialog open={showCreateBatch} onOpenChange={setShowCreateBatch}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增出團批次</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">批次名稱 *</Label>
              <Input value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} placeholder="如 2026年4月下半月團" />
            </div>
            <div>
              <Label className="text-xs font-semibold">收件截止日期 *</Label>
              <Input type="date" value={batchForm.deadline} onChange={(e) => setBatchForm({ ...batchForm, deadline: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">截止日期前提交的申請將自動分配到此批次</p>
            </div>
            <div>
              <Label className="text-xs font-semibold">預計出團日期</Label>
              <Input type="date" value={batchForm.shippedAt} onChange={(e) => setBatchForm({ ...batchForm, shippedAt: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs font-semibold">預計回件日期</Label>
              <Input type="date" value={batchForm.expectedReturn} onChange={(e) => setBatchForm({ ...batchForm, expectedReturn: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateBatch(false)}>取消</Button>
            <Button
              onClick={() => createBatchMutation.mutate({
                batchName: batchForm.name,
                cutoffDate: batchForm.deadline || new Date().toISOString().split('T')[0],
                shippedDate: batchForm.shippedAt || undefined,
                expectedReturnDate: batchForm.expectedReturn || undefined,
                status: 'open' as const,
              })}
              disabled={!batchForm.name || !batchForm.deadline || createBatchMutation.isPending}
              className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
            >
              {createBatchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "建立批次"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission detail dialog */}
      <SubmissionDetailDialog
        submissionId={selectedSubmissionId}
        open={showDetailDialog}
        onClose={() => { setShowDetailDialog(false); setSelectedSubmissionId(null); }}
        onUpdated={() => {
          utils.grading.admin.listBatchesWithStats.invalidate();
        }}
      />
    </div>
  );
}

// ─── Submission Management (all submissions, filterable) ──────────────────────
function SubmissionManagement() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: submissionsData, isLoading, refetch } = trpc.grading.admin.listSubmissions.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    batchId: batchFilter === "all" ? undefined : parseInt(batchFilter),
  });
  const submissions: any[] = Array.isArray(submissionsData) ? submissionsData : (submissionsData as any)?.submissions ?? [];

  const { data: batchesData } = trpc.grading.admin.getAllBatches.useQuery();
  const batches: any[] = Array.isArray(batchesData) ? batchesData : [];

  const assignBatchMutation = trpc.grading.admin.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("已分配批次");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
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
        <Select value={batchFilter} onValueChange={setBatchFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部批次</SelectItem>
            <SelectItem value="0">未分配批次</SelectItem>
            {batches.map((b: any) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.batchName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-auto">共 {submissions.length} 筆</span>
      </div>

      {/* Submissions list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
      ) : submissions.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">沒有符合條件的申請</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">申請單號</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">申請人</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">卡牌</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">費用</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">狀態</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">出團批次</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {submissions.map((sub: any) => (
                <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-[#06038d]">{sub.orderNo}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(sub.createdAt).toLocaleDateString("zh-HK")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{sub.user?.name ?? "—"}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[120px]">{sub.user?.email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-50 text-purple-700 font-bold text-sm">{sub.itemCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-gray-900">HK${parseFloat(sub.totalFeeHkd).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[sub.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_OPTIONS.find((s) => s.value === sub.status)?.label ?? sub.status}
                    </span>
                    {sub.alipayProofStatus === "pending_review" && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        <AlertCircle className="h-2.5 w-2.5" />截圖
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={sub.batchId ? String(sub.batchId) : "none"}
                      onValueChange={(v) => assignBatchMutation.mutate({
                        id: sub.id,
                        status: sub.status as any,
                        batchId: v === "none" ? undefined : parseInt(v),
                      })}
                    >
                      <SelectTrigger className="h-7 text-xs w-36">
                        <SelectValue placeholder="未分配" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未分配</SelectItem>
                        {batches.map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.batchName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      onClick={() => { setSelectedSubmissionId(sub.id); setShowDetailDialog(true); }}
                      className="bg-[#06038d] hover:bg-[#06038d]/90 text-white h-7 px-3 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      管理
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submission detail dialog */}
      <SubmissionDetailDialog
        submissionId={selectedSubmissionId}
        open={showDetailDialog}
        onClose={() => { setShowDetailDialog(false); setSelectedSubmissionId(null); }}
        onUpdated={() => {
          utils.grading.admin.listSubmissions.invalidate();
          utils.grading.admin.listBatchesWithStats.invalidate();
        }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminGrading() {
  const [activeSection, setActiveSection] = useState<"batches" | "submissions" | "tiers">("batches");

  const sections = [
    { id: "batches" as const, label: "出團批次管理", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "submissions" as const, label: "申請管理", icon: <Package className="h-4 w-4" /> },
    { id: "tiers" as const, label: "服務層級", icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">PSA 代客鑑定管理</h2>
        <p className="text-gray-500 text-sm mt-1">管理鑑定申請、出團批次及服務層級</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
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

      {activeSection === "batches" && <BatchOverview />}
      {activeSection === "submissions" && <SubmissionManagement />}
      {activeSection === "tiers" && <ServiceTierManagement />}
    </div>
  );
}
