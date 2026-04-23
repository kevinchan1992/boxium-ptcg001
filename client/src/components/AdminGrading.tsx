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
  { value: "awaiting_payment", label: "未付款" },
  { value: "pending_review", label: "截圖待審核" },
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
  pending_review: "bg-amber-100 text-amber-800",
  pending_shipment: "bg-yellow-100 text-yellow-800",
  received: "bg-indigo-100 text-indigo-800",
  submitted_to_psa: "bg-purple-100 text-purple-800",
  grading: "bg-violet-100 text-violet-800",
  graded: "bg-green-100 text-green-800",
  payment_overdue: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-gray-900",
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
                  {!tier.isActive && <Badge variant="outline" className="text-xs text-gray-700">已停用</Badge>}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">
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
        <DialogContent className="max-w-md bg-white text-gray-900 border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editTier ? "編輯服務層級" : "新增服務層級"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">層級名稱 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 Value Bulk" className="bg-white border-gray-200 text-gray-900" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">代送費用（HKD）*</Label>
                <Input value={form.feeHkd} onChange={(e) => setForm({ ...form, feeHkd: e.target.value })} placeholder="275" type="number" className="bg-white border-gray-200 text-gray-900" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">最高申報價値（USD）*</Label>
                <Input value={form.maxDeclaredValueUsd} onChange={(e) => setForm({ ...form, maxDeclaredValueUsd: e.target.value })} placeholder="499" type="number" className="bg-white border-gray-200 text-gray-900" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">預計最短時間（工作天）</Label>
                <Input value={form.estimatedDaysMin} onChange={(e) => setForm({ ...form, estimatedDaysMin: e.target.value })} placeholder="4" type="number" className="bg-white border-gray-200 text-gray-900" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">預計最長時間（工作天）</Label>
                <Input value={form.estimatedDaysMax} onChange={(e) => setForm({ ...form, estimatedDaysMax: e.target.value })} placeholder="5" type="number" className="bg-white border-gray-200 text-gray-900" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">說明（可選）</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="層級說明..." className="resize-none h-16 bg-white border-gray-200 text-gray-900" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
              <Label className="text-xs font-semibold text-gray-700">排序</Label>
              <Input value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} type="number" className="bg-white border-gray-200 text-gray-900" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="accent-[#06038d]"
                  />
                  <span className="text-sm text-gray-700">開放申請</span>
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
    { enabled: !!submissionId && open, refetchOnMount: 'always', staleTime: 0 }
  );

  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [itemResults, setItemResults] = useState<any[]>([]);

  // Tier upgrade flow state
  // gradingStep: 'ask_upgrade' | 'select_tier' | 'fill_result'
  const [gradingStep, setGradingStep] = useState<'ask_upgrade' | 'select_tier' | 'fill_result'>('ask_upgrade');
  const [selectedUpgradeTierId, setSelectedUpgradeTierId] = useState<number | null>(null);
  const [upgradeResult, setUpgradeResult] = useState<{ checkoutUrl: string | null; diffFeeHkd: string; newTierName: string } | null>(null);
  // Per-card upgrade selection: set of item IDs selected for upgrade
  const [selectedItemIdsForUpgrade, setSelectedItemIdsForUpgrade] = useState<Set<number>>(new Set());

  // Fetch all active tiers for upgrade selection
  const { data: allTiers } = trpc.grading.getServiceTiers.useQuery(undefined, { enabled: open && gradingStep === 'select_tier' });

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

  // Initialize grading step based on existing data when dialog opens
  React.useEffect(() => {
    if (open && detail) {
      // If any item already has a PSA grade saved, go directly to fill_result (step 3)
      const hasGradedItems = (detail.items ?? []).some((item: any) => item.psaGrade);
      // If upgrade was already done (upgradeCheckoutSessionId exists), show upgrade banner in step 3
      const hasUpgrade = !!(detail as any).upgradeCheckoutSessionId;

      if (hasGradedItems || hasUpgrade) {
        setGradingStep('fill_result');
        if (hasUpgrade) {
          // Restore upgrade result banner from saved data
          setUpgradeResult({
            checkoutUrl: null,
            diffFeeHkd: String((detail as any).upgradeDiffFeeHkd ?? '0'),
            newTierName: String((detail as any).upgradeNewTierName ?? '升級層級'),
          });
        } else {
          setUpgradeResult(null);
        }
      } else {
        setGradingStep('ask_upgrade');
        setUpgradeResult(null);
      }
      setSelectedUpgradeTierId(null);
    } else if (!open) {
      // Reset when dialog closes
      setGradingStep('ask_upgrade');
      setSelectedUpgradeTierId(null);
      setUpgradeResult(null);
      setSelectedItemIdsForUpgrade(new Set());
    }
  }, [open, submissionId, detail]);

  const updateStatusMutation = trpc.grading.admin.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("狀態已更新");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      if (submissionId) utils.grading.admin.getSubmissionDetail.invalidate({ id: submissionId });
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
      if (submissionId) utils.grading.admin.getSubmissionDetail.invalidate({ id: submissionId });
      onUpdated();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const upgradeTierMutation = trpc.grading.admin.upgradeTier.useMutation({
    onSuccess: (data) => {
      setUpgradeResult(data);
      setGradingStep('fill_result');
      toast.success(`已發送升級差價付款連結至客人，差價 HK$${data.diffFeeHkd}`);
      // Invalidate all related queries so totalFeeHkd is refreshed everywhere
      utils.grading.admin.getSubmissionDetail.invalidate({ id: submissionId! });
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      onUpdated();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const confirmAlipayUpgradeMutation = trpc.grading.adminConfirmGradingAlipayUpgradePayment.useMutation({
    onSuccess: () => {
      toast.success("升級差價支付寶收款已確認");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.getSubmissionDetail.invalidate({ id: detail.id });
      onUpdated();
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
  const [showRejectInput, setShowRejectInput] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const approveAlipayMutation = trpc.grading.adminApproveGradingAlipayProof.useMutation({
    onSuccess: () => {
      toast.success("截圖已批准，已通知用戶準備寄件");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      utils.grading.admin.getSubmissionDetail.invalidate({ id: submissionId! });
      onUpdated();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const rejectAlipayMutation = trpc.grading.adminRejectGradingAlipayProof.useMutation({
    onSuccess: () => {
      toast.success("截圖已拒絕，已通知用戶重新上傳");
      setShowRejectInput(false);
      setRejectionReason("");
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
      utils.grading.admin.getSubmissionDetail.invalidate({ id: submissionId! });
      onUpdated();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white text-gray-900 border border-gray-200 w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
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
                  <span className="text-gray-700 text-xs">申請人</span>
                  <p className="font-semibold text-gray-900">{detail.user?.name ?? "—"}</p>
                </div>
                <div>
                  <span className="text-gray-700 text-xs">Email</span>
                  <p className="font-semibold text-gray-900 text-xs break-all">{detail.user?.email ?? "—"}</p>
                </div>
                <div>
                  <span className="text-gray-700 text-xs">申請日期</span>
                  <p className="font-semibold text-gray-900">{new Date(detail.createdAt).toLocaleDateString("zh-HK")}</p>
                </div>
                <div>
                  <span className="text-gray-700 text-xs">卡牌數量</span>
                  <p className="font-semibold text-gray-900">{detail.items?.length ?? 0} 張</p>
                </div>
                <div>
                  <span className="text-gray-700 text-xs">應付金額</span>
                  <p className="font-bold text-[#06038d]">HK${parseFloat(detail.totalFeeHkd).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-700 text-xs">目前狀態</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[detail.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {STATUS_OPTIONS.find((s) => s.value === detail.status)?.label ?? detail.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-700 text-xs">付款方式</span>
                  <p className="font-semibold text-gray-900">
                    {(detail as any).paymentMethod === 'stripe' ? '💳 Stripe 信用卡' : (detail as any).paymentMethod === 'alipay_hk' ? '📱 支付寳 HK' : (detail as any).paymentMethod ?? '—'}
                  </p>
                </div>
                {(detail as any).trackingNumber && (
                  <div className="col-span-2">
                    <span className="text-gray-700 text-xs">📦 客人寄件追蹤號</span>
                    <p className="font-mono font-bold text-[#06038d]">{(detail as any).trackingNumber}</p>
                    {(detail as any).trackingSubmittedAt && (
                      <p className="text-xs text-gray-400">提交時間：{new Date((detail as any).trackingSubmittedAt).toLocaleString('zh-HK')}</p>
                    )}
                  </div>
                )}
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
                        <div className="w-8 h-11 bg-gray-100 rounded shrink-0 flex items-center justify-center text-gray-600 text-xs">無</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.cardName}</p>
                        <p className="text-xs text-gray-700">{[item.cardSet, item.cardNumber].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="shrink-0 flex flex-wrap items-center gap-1 max-w-[110px] justify-end">
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
                  <Label className="text-sm font-bold text-gray-900">支付寶 HK 截圖待審核</Label>
                </div>
                <p className="text-xs text-gray-700 mb-3">客人已提交支付寶 HK 付款截圖，請確認收款後點擊「確認收款」。</p>
                <img
                  src={detail.alipayProofImageUrl}
                  alt="支付寶截圖"
                  className="w-full max-h-48 object-contain rounded-lg border border-amber-200 mb-3 cursor-pointer"
                  onClick={() => window.open(detail.alipayProofImageUrl, "_blank")}
                />
                <p className="text-xs text-gray-700 mb-2">提交時間：{detail.alipayProofSubmittedAt ? new Date(detail.alipayProofSubmittedAt).toLocaleString("zh-HK") : "—"}</p>
                {/* AI verification result badge */}
                {(detail as any).alipayProofAiResult && (
                  <div className={`mb-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                    (detail as any).alipayProofAiResult === 'pass'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : (detail as any).alipayProofAiResult === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <span className="font-semibold">
                      {(detail as any).alipayProofAiResult === 'pass' ? '✅ AI 核對通過' : (detail as any).alipayProofAiResult === 'warning' ? '⚠️ AI 核對警告' : '❌ AI 核對未通過'}
                    </span>
                    {(detail as any).alipayProofAiConfidence && (
                      <span className="opacity-70">({(detail as any).alipayProofAiConfidence === 'high' ? '高可信度' : (detail as any).alipayProofAiConfidence === 'medium' ? '中可信度' : '低可信度'})</span>
                    )}
                    {(detail as any).alipayProofAiSummary && (
                      <span className="w-full mt-0.5 opacity-80">{(detail as any).alipayProofAiSummary}</span>
                    )}
                    {(detail as any).alipayProofAiCheckedAt && (
                      <span className="w-full opacity-50">AI 核對時間：{new Date((detail as any).alipayProofAiCheckedAt).toLocaleString('zh-HK')}</span>
                    )}
                  </div>
                )}
                {/* Approve button */}
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => approveAlipayMutation.mutate({ submissionId: detail.id })}
                  disabled={approveAlipayMutation.isPending}
                >
                  {approveAlipayMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCheck className="h-4 w-4 mr-2" />批准截圖，通知用戶準備寄件</>}
                </Button>
                {/* Reject button */}
                {!showRejectInput ? (
                  <Button
                    variant="outline"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => setShowRejectInput(true)}
                  >
                    <X className="h-4 w-4 mr-2" />拒絕截圖，通知用戶重新上傳
                  </Button>
                ) : (
                  <div className="mt-2 space-y-2 bg-red-50 border border-red-200 rounded-lg p-3">
                    <Label className="text-xs font-semibold text-red-700">拒絕原因 *</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="請說明拒絕原因，如：截圖不清晰、金額不符、不是支付寶 HK 付款截圖等"
                      className="resize-none h-16 bg-white border-red-200 text-gray-900 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => { setShowRejectInput(false); setRejectionReason(""); }}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          if (!rejectionReason.trim()) { toast.error("請填寫拒絕原因"); return; }
                          rejectAlipayMutation.mutate({ submissionId: detail.id, rejectionReason: rejectionReason.trim() });
                        }}
                        disabled={rejectAlipayMutation.isPending}
                      >
                        {rejectAlipayMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認拒絕"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alipay upgrade diff payment confirmation */}
            {(detail as any).upgradeCheckoutSessionId && !(detail as any).upgradePaidAt && (
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <Label className="text-sm font-bold text-gray-900">升級差價待確認</Label>
                </div>
                <p className="text-xs text-gray-700 mb-1">層級升級差價：<span className="font-bold text-orange-700">HK${(detail as any).upgradeDiffFeeHkd ?? '—'}</span></p>
                <p className="text-xs text-gray-700 mb-1">升級至：<span className="font-bold text-orange-700">{(detail as any).upgradeNewTierName ?? '—'}</span></p>
                {/* Show Alipay proof screenshot if submitted for upgrade */}
                {detail.alipayProofImageUrl && detail.alipayProofStatus === "pending_review" && (
                  <div className="mt-2 mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">支付寶補付截圖：</p>
                    <img
                      src={detail.alipayProofImageUrl}
                      alt="補付截圖"
                      className="w-full max-h-48 object-contain rounded-lg border border-orange-200 cursor-pointer"
                      onClick={() => window.open(detail.alipayProofImageUrl, "_blank")}
                    />
                    <p className="text-xs text-gray-500 mt-1">提交時間：{detail.alipayProofSubmittedAt ? new Date(detail.alipayProofSubmittedAt).toLocaleString("zh-HK") : "—"}</p>
                    {/* AI verification result badge */}
                    {(detail as any).alipayProofAiResult && (
                      <div className={`mt-2 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                        (detail as any).alipayProofAiResult === 'pass'
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : (detail as any).alipayProofAiResult === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                        <span className="font-semibold">
                          {(detail as any).alipayProofAiResult === 'pass' ? '✅ AI 核對通過' : (detail as any).alipayProofAiResult === 'warning' ? '⚠️ AI 核對警告' : '❌ AI 核對未通過'}
                        </span>
                        {(detail as any).alipayProofAiConfidence && (
                          <span className="opacity-70">({(detail as any).alipayProofAiConfidence === 'high' ? '高可信度' : (detail as any).alipayProofAiConfidence === 'medium' ? '中可信度' : '低可信度'})</span>
                        )}
                        {(detail as any).alipayProofAiSummary && (
                          <span className="w-full mt-0.5 opacity-80">{(detail as any).alipayProofAiSummary}</span>
                        )}
                      </div>
                    )}
                    {!(detail as any).alipayProofAiResult && (
                      <p className="text-xs text-gray-400 mt-1 italic">AI 核對進行中，請稍候刷新查看結果…</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-700 mb-3">如客人已通過支付寶 HK 補付差價，請確認收款後點擊「確認升級差價」。</p>
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => confirmAlipayUpgradeMutation.mutate({ submissionId: detail.id })}
                  disabled={confirmAlipayUpgradeMutation.isPending}
                >
                  {confirmAlipayUpgradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCheck className="h-4 w-4 mr-2" />確認升級差價已收到</>}
                </Button>
              </div>
            )}

            {/* Status update */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <Label className="text-xs font-semibold text-gray-700 mb-2 block">更新狀態</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem className="text-gray-900" key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2">
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">通知備注（發送給客人）</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="可選：附加說明文字..."
                  className="resize-none h-16 text-sm bg-white border-gray-200 text-gray-900 placeholder:text-gray-700"
                />
              </div>
              {newStatus === "returned" && (
                <div className="mt-2">
                  <Label className="text-xs font-semibold text-gray-700 mb-1 block">追蹤號碼</Label>
                  <Input
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    placeholder="寄回追蹤號碼"
                    className="bg-white border-gray-200 text-gray-900"
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

            {/* Grading results - 3-step flow: only show when status is 'graded' */}
            {detail.status === 'graded' && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-4 w-4 text-gray-900" />
                <Label className="text-sm font-bold text-gray-900">填寫鑑定結果</Label>
                {/* Step indicator */}
                <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${gradingStep === 'ask_upgrade' ? 'bg-[#06038d] text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
                  <span className="text-gray-300">→</span>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${gradingStep === 'select_tier' ? 'bg-[#06038d] text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
                  <span className="text-gray-300">→</span>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${gradingStep === 'fill_result' ? 'bg-[#06038d] text-white' : 'bg-gray-200 text-gray-500'}`}>3</span>
                </div>
              </div>

              {/* Step 1: Ask if tier upgrade needed */}
              {gradingStep === 'ask_upgrade' && (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4 border border-emerald-100">
                    <p className="text-sm font-semibold text-gray-900 mb-1">是否需要更改服務層級？</p>
                    <p className="text-xs text-gray-500 mb-4">如果客人的卡牌鑑定結果需要升級服務（例如從 Value 升級至 Regular），選擇「需要升級」。系統將計算差價並發送付款連結至客人。</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                        onClick={() => setGradingStep('fill_result')}
                      >
                        不需要，直接填寫結果
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setGradingStep('select_tier')}
                      >
                        需要升級服務層級
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Select new tier and confirm diff */}
              {gradingStep === 'select_tier' && (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    {/* Step A: Select which cards need upgrade */}
                    <p className="text-sm font-semibold text-gray-900 mb-1">選擇需要升級的卡牌</p>
                    <p className="text-xs text-gray-500 mb-3">勾選需要升級服務層級的卡牌（可只選部分），再選擇新層級，系統將按選中張數計算差價。</p>
                    <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
                      {(detail.items ?? []).map((item: any) => {
                        const checked = selectedItemIdsForUpgrade.has(item.id);
                        return (
                          <label key={item.id} className={`flex items-center gap-2 rounded-lg p-2 border cursor-pointer transition-all ${checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = new Set(selectedItemIdsForUpgrade);
                                if (checked) next.delete(item.id); else next.add(item.id);
                                setSelectedItemIdsForUpgrade(next);
                              }}
                              className="accent-blue-600"
                            />
                            <span className="text-xs text-gray-800 flex-1 truncate">{item.cardName}</span>
                            <span className="text-xs text-gray-400 shrink-0">HK${parseFloat(item.feeHkd ?? 0).toLocaleString()} / 張</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">已選 <strong>{selectedItemIdsForUpgrade.size}</strong> 張。選擇升級後的層級：</p>
                    <div className="space-y-2 mb-3">
                      {(allTiers ?? []).map((tier: any) => {
                        const selectedCount = selectedItemIdsForUpgrade.size;
                        // Calculate diff: selected cards upgrade to new tier, unselected stay at original per-card fee
                        const selectedItems = (detail.items ?? []).filter((it: any) => selectedItemIdsForUpgrade.has(it.id));
                        const currentSelectedFee = selectedItems.reduce((sum: number, it: any) => sum + parseFloat(it.feeHkd ?? 0), 0);
                        const newSelectedFee = selectedCount * parseFloat(tier.feeHkd);
                        const diff = newSelectedFee - currentSelectedFee;
                        const isSelected = selectedUpgradeTierId === tier.id;
                        const isCurrentOrLower = diff <= 0 || selectedCount === 0;
                        return (
                          <button
                            key={tier.id}
                            onClick={() => !isCurrentOrLower && setSelectedUpgradeTierId(tier.id)}
                            disabled={isCurrentOrLower}
                            className={`w-full text-left rounded-lg p-3 border-2 transition-all ${
                              isCurrentOrLower
                                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{tier.name}</p>
                                <p className="text-xs text-gray-500">HK${parseFloat(tier.feeHkd).toLocaleString()} / 張</p>
                              </div>
                              <div className="text-right">
                                {selectedCount > 0 && !isCurrentOrLower && (
                                  <p className="text-xs font-bold text-red-600">差價 +HK${diff.toLocaleString()}</p>
                                )}
                                {isCurrentOrLower && (
                                  <p className="text-xs text-gray-400">{selectedCount === 0 ? '請先選卡牌' : '目前層級或更低'}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 border-gray-300 text-gray-700 bg-white"
                        onClick={() => setGradingStep('ask_upgrade')}
                      >
                        返回
                      </Button>
                      <Button
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={!selectedUpgradeTierId || selectedItemIdsForUpgrade.size === 0 || upgradeTierMutation.isPending}
                        onClick={() => {
                          if (!selectedUpgradeTierId || selectedItemIdsForUpgrade.size === 0) return;
                          upgradeTierMutation.mutate({
                            submissionId: detail.id,
                            newTierId: selectedUpgradeTierId,
                            itemIds: Array.from(selectedItemIdsForUpgrade),
                            origin: window.location.origin,
                          });
                        }}
                      >
                        {upgradeTierMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>確認升級並發送差價連結（{selectedItemIdsForUpgrade.size} 張）</>}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Upgrade success banner (shown in step 3 if upgrade was done) */}
              {gradingStep === 'fill_result' && upgradeResult && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800">升級差價連結已發送</p>
                      <p className="text-xs text-blue-600">已升級至 {upgradeResult.newTierName}，客人需補付 HK${upgradeResult.diffFeeHkd}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Fill grading results */}
              {gradingStep === 'fill_result' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 mb-2">填寫後按「儲存並通知客人付款」，系統將自動通知客人評分結果及付款連結。</p>
                  <div className="space-y-2">
                    {itemResults.map((ir: any, idx: number) => {
                      const item = (detail.items ?? [])[idx];
                      // Determine final tier: if item was upgraded, use the upgraded tier name from upgradeNewTierName;
                      // otherwise use item's own tier name
                      const upgradeItemIdList: number[] = (detail as any).upgradeItemIds
                        ? String((detail as any).upgradeItemIds).split(',').map(Number).filter(Boolean)
                        : [];
                      const isUpgradedItem = item?.id != null && upgradeItemIdList.includes(item.id);
                      const finalTierName = isUpgradedItem
                        ? ((detail as any).upgradeNewTierName ?? item?.tier?.name)
                        : item?.tier?.name;
                      return (
                        <div key={ir.id} className="bg-white rounded-lg p-3 border border-emerald-100">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-gray-800">
                              #{idx + 1} {item?.cardName}
                            </p>
                            {finalTierName && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ml-2 ${
                                isUpgradedItem
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-100'
                              }`}>
                                {isUpgradedItem && <span className="mr-0.5">↑</span>}{finalTierName}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-600">PSA 評分</Label>
                              <Select
                                value={ir.psaGrade || "none"}
                                onValueChange={(v) => {
                                  const updated = [...itemResults];
                                  updated[idx] = { ...ir, psaGrade: v === "none" ? "" : v };
                                  setItemResults(updated);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white border-gray-200 text-gray-900">
                                  <SelectValue placeholder="選擇評分" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200 text-gray-900">
                                  <SelectItem className="text-gray-900" value="none">—</SelectItem>
                                  {["10", "9.5", "9", "8.5", "8", "7.5", "7", "6", "5", "4", "3", "2", "1", "A"].map((g) => (
                                    <SelectItem className="text-gray-900" key={g} value={g}>PSA {g}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">PSA 認證號碼</Label>
                              <Input
                                value={ir.psaCertNo}
                                onChange={(e) => {
                                  const updated = [...itemResults];
                                  updated[idx] = { ...ir, psaCertNo: e.target.value };
                                  setItemResults(updated);
                                }}
                                placeholder="認證號碼"
                                className="h-8 text-xs bg-white border-gray-200 text-gray-900"
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
              )}
            </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Batch Detail View ────────────────────────────────────────────────────────
function BatchDetailView({ batch, onManageSubmission, onDeleteBatch }: { batch: any; onManageSubmission: (id: number) => void; onDeleteBatch: (id: number, name: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const submissions = batch.submissions ?? [];
  const utils = trpc.useUtils();
  const [batchSyncTarget, setBatchSyncTarget] = useState<{ status: 'received' | 'submitted_to_psa' | 'grading'; label: string } | null>(null);
  const [syncNotifyUsers, setSyncNotifyUsers] = useState(false);

  const batchUpdateStatusMutation = trpc.grading.admin.batchUpdateStatus.useMutation({
    onSuccess: (data) => {
      if (data.updated === 0) {
        toast.info('所有申請單狀態已符合或更高，無需更新');
      } else {
        const notifiedMsg = data.notified > 0 ? `，已通知 ${data.notified} 位客人` : '';
        toast.success(`已成功同步 ${data.updated} 筆申請單${notifiedMsg}`);
      }
      setBatchSyncTarget(null);
      setSyncNotifyUsers(false);
      utils.grading.admin.listBatchesWithStats.invalidate();
      utils.grading.admin.listSubmissions.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const SYNC_OPTIONS = [
    { status: 'received' as const, label: 'BOXIUM已收件', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
    { status: 'submitted_to_psa' as const, label: '已出團', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
    { status: 'grading' as const, label: '鑑定中', color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
  ];

  const quickUpdateMutation = trpc.grading.admin.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("狀態已更新");
      utils.grading.admin.listBatchesWithStats.invalidate();
      utils.grading.admin.listSubmissions.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getPaymentStatusBadge = (sub: any) => {
    if (sub.status === "paid" || sub.status === "completed") {
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-gray-900"><CheckCheck className="h-3 w-3" />已付款</span>;
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
              <span className="text-xs text-gray-700 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                截止：{new Date(batch.cutoffDate).toLocaleDateString("zh-HK")}
              </span>
            )}
            {batch.shippedDate && (
              <span className="text-xs text-gray-700 flex items-center gap-1">
                <Truck className="h-3 w-3" />
                出團：{new Date(batch.shippedDate).toLocaleDateString("zh-HK")}
              </span>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 mr-3">
          <div className="text-center px-3 py-1.5 rounded-lg bg-[#06038d]/5 border border-[#06038d]/10">
            <p className="text-xs text-gray-700">申請</p>
            <p className="text-lg font-bold text-[#06038d]">{batch.totalSubmissions}</p>
          </div>
          <div className="text-center px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100">
            <p className="text-xs text-gray-700">卡牌</p>
            <p className="text-lg font-bold text-gray-900">{batch.totalCards}</p>
          </div>
          {batch.paidCount > 0 && (
            <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-gray-700">已付</p>
              <p className="text-lg font-bold text-gray-900">{batch.paidCount}</p>
            </div>
          )}
          {batch.unpaidCount > 0 && (
            <div className="text-center px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-100">
              <p className="text-xs text-gray-700">待付</p>
              <p className="text-lg font-bold text-gray-900">{batch.unpaidCount}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
          {/* Batch sync status button */}
          <div className="relative group">
            <button
              className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
              title="批量同步狀態"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <List className="h-4 w-4" />
            </button>
            {/* Dropdown menu */}
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px] overflow-hidden hidden group-hover:block">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700">批量同步狀態</p>
                <p className="text-xs text-gray-500 mt-0.5">只更新較低狀態</p>
              </div>
              {SYNC_OPTIONS.map((opt) => (
                <button
                  key={opt.status}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors text-gray-700 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); setBatchSyncTarget({ status: opt.status, label: opt.label }); }}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${opt.status === 'received' ? 'bg-indigo-500' : opt.status === 'submitted_to_psa' ? 'bg-purple-500' : 'bg-violet-500'}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="刪除批次"
            onClick={() => onDeleteBatch(batch.id, batch.batchName)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {expanded ? <ChevronUp className="h-5 w-5 text-gray-700 shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-700 shrink-0" />}
        </div>
      </div>

      {/* Submissions table */}
      {expanded && (
        <div className="border-t border-gray-100">
          {submissions.length === 0 ? (
            <div className="py-8 text-center text-gray-700 text-sm">此批次尚無申請</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-700">申請單號</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-700">申請人</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-700">卡牌數</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-700">費用</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-700">進度</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-700">付款</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {submissions.map((sub: any) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => onManageSubmission(sub.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#06038d]">{sub.orderNo}</span>
                        <p className="text-xs text-gray-700 mt-0.5">{new Date(sub.createdAt).toLocaleDateString("zh-HK")}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{sub.userName}</p>
                        <p className="text-xs text-gray-700 truncate max-w-[120px]">{sub.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-gray-900 font-bold text-sm">{sub.itemCount}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-gray-900">HK${parseFloat(sub.totalFeeHkd).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={sub.status}
                          onValueChange={(v) => quickUpdateMutation.mutate({ id: sub.id, status: v as any })}
                        >
                          <SelectTrigger className={`h-7 text-xs w-28 border-0 font-semibold ${STATUS_COLOR[sub.status] ?? "bg-gray-100 text-gray-700"}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-200 text-gray-900">
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem className="text-gray-900" key={s.value} value={s.value}>
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[s.value] ?? ""}`}>{s.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getPaymentStatusBadge(sub) ?? (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                        {sub.alipayProofStatus === "pending_review" && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-gray-900">
                            <AlertCircle className="h-2.5 w-2.5" />截圖待審
                          </span>
                        )}
                        {(sub as any).alipayProofAiResult && (
                          <span className={`ml-1 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                            (sub as any).alipayProofAiResult === 'pass' ? 'bg-green-100 text-green-800' :
                            (sub as any).alipayProofAiResult === 'warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {(sub as any).alipayProofAiResult === 'pass' ? '✅ AI通過' : (sub as any).alipayProofAiResult === 'warning' ? '⚠️ AI警告' : '❌ AI未通過'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
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

      {/* Batch sync confirm dialog */}
      <Dialog open={!!batchSyncTarget} onOpenChange={(v) => { if (!v) setBatchSyncTarget(null); }}>
        <DialogContent className="max-w-sm bg-white text-gray-900 border border-gray-200" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <List className="h-5 w-5 text-blue-600" />
              批量同步狀態
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              確定將批次「{batch.batchName}」內所有狀態較低的申請單更新為：
            </p>
            {batchSyncTarget && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
                <span className="text-base font-bold text-blue-700">{batchSyncTarget.label}</span>
              </div>
            )}
            <p className="text-xs text-gray-500">已處於相同或更高狀態的申請單不會被變更。</p>
            {/* Notify users option */}
            <label className="flex items-center gap-2 cursor-pointer select-none p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={syncNotifyUsers}
                onChange={(e) => setSyncNotifyUsers(e.target.checked)}
                className="w-4 h-4 accent-[#06038d] cursor-pointer"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">同時發送通知給客人</span>
                <p className="text-xs text-gray-500 mt-0.5">系統將以 Email 及站內通知告知受影響的客人進度更新</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchSyncTarget(null)} className="text-gray-700">取消</Button>
            <Button
              className="bg-[#06038d] hover:bg-[#06038d]/90 text-white"
              disabled={batchUpdateStatusMutation.isPending}
              onClick={() => {
                if (batchSyncTarget) {
                  batchUpdateStatusMutation.mutate({ batchId: batch.id, status: batchSyncTarget.status, notifyUsers: syncNotifyUsers });
                }
              }}
            >
              {batchUpdateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '確定同步'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Batch Overview (new main view) ────────────────────────────────────────────
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

  const deleteBatchMutation = trpc.grading.admin.deleteBatch.useMutation({
    onSuccess: () => {
      toast.success("批次已刪除");
      utils.grading.admin.getAllBatches.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleDeleteBatch = (id: number, name: string) => {
    if (confirm(`確定刪除批次「${name}」？此操作無法復原，批次內的申請不會被刪除。`)) {
      deleteBatchMutation.mutate({ id });
    }
  };

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
          <p className="text-xs text-gray-700">總申請數</p>
          <p className="text-2xl font-bold text-gray-900">{totalSubmissions}</p>
          <p className="text-xs text-gray-700 mt-0.5">所有批次</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-700">總卡牌數</p>
          <p className="text-2xl font-bold text-gray-900">{totalCards}</p>
          <p className="text-xs text-gray-700 mt-0.5">已分配批次</p>
        </div>
        <div className={`rounded-xl p-4 border ${totalUnpaid > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs text-gray-700">待收款</p>
          <p className={`text-2xl font-bold ${totalUnpaid > 0 ? "text-gray-900" : "text-gray-900"}`}>{totalUnpaid}</p>
          <p className="text-xs text-gray-700 mt-0.5">鑑定完成未付款</p>
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
        <div className="text-center py-16 text-gray-700">
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
              onDeleteBatch={handleDeleteBatch}
            />
          ))}
        </div>
      )}

      {/* Create batch dialog */}
      <Dialog open={showCreateBatch} onOpenChange={setShowCreateBatch}>
        <DialogContent className="max-w-sm bg-white text-gray-900 border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">新增出團批次</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">批次名稱 *</Label>
              <Input value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} placeholder="如 2026年4月下半月團" className="bg-white border-gray-200 text-gray-900" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">收件截止日期 *</Label>
              <Input type="date" value={batchForm.deadline} onChange={(e) => setBatchForm({ ...batchForm, deadline: e.target.value })} className="bg-white border-gray-200 text-gray-900" />
              <p className="text-xs text-gray-700 mt-1">截止日期前提交的申請將自動分配到此批次</p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">預計出團日期</Label>
              <Input type="date" value={batchForm.shippedAt} onChange={(e) => setBatchForm({ ...batchForm, shippedAt: e.target.value })} className="bg-white border-gray-200 text-gray-900" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">預計回件日期</Label>
              <Input type="date" value={batchForm.expectedReturn} onChange={(e) => setBatchForm({ ...batchForm, expectedReturn: e.target.value })} className="bg-white border-gray-200 text-gray-900" />
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
  const [pendingUpgradeFilter, setPendingUpgradeFilter] = useState(false);
  const [alipayPendingFilter, setAlipayPendingFilter] = useState(false);
  const [batchFilter, setBatchFilter] = useState("all");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const { data: submissionsData, isLoading, refetch } = trpc.grading.admin.listSubmissions.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    batchId: batchFilter === "all" ? undefined : parseInt(batchFilter),
    pendingUpgrade: pendingUpgradeFilter || undefined,
    alipayProofPending: alipayPendingFilter || undefined,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });
  const submissions: any[] = (submissionsData as any)?.submissions ?? [];
  const totalCount: number = (submissionsData as any)?.total ?? 0;
  const totalPages: number = (submissionsData as any)?.totalPages ?? 1;
  const totalFee = submissions.reduce((sum: number, s: any) => sum + parseFloat(s.totalFeeHkd || "0"), 0);

  // Reset to page 1 when filters change
  React.useEffect(() => { setCurrentPage(1); }, [statusFilter, batchFilter, pendingUpgradeFilter, alipayPendingFilter]);

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; orderNo: string } | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const bulkDeleteMutation = trpc.grading.adminBulkDeleteAwaitingPayment.useMutation({
    onSuccess: (data) => {
      toast.success(`已批量刪除 ${data.deleted} 筆未付款申請`);
      setShowBulkDeleteDialog(false);
      utils.grading.admin.listSubmissions.invalidate();
      utils.grading.admin.listBatchesWithStats.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMutation = trpc.grading.adminDeleteSubmission.useMutation({
    onSuccess: (data) => {
      toast.success(`申請單 ${data.orderNo} 已刪除`);
      setDeleteTarget(null);
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
          <SelectTrigger className="w-36 h-8 text-xs bg-white border-gray-200 text-gray-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200 text-gray-900">
            <SelectItem className="text-gray-900" value="all">全部狀態</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem className="text-gray-900" key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={batchFilter} onValueChange={setBatchFilter}>
          <SelectTrigger className="w-40 h-8 text-xs bg-white border-gray-200 text-gray-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200 text-gray-900">
            <SelectItem className="text-gray-900" value="all">全部批次</SelectItem>
            <SelectItem className="text-gray-900" value="0">未分配批次</SelectItem>
            {batches.map((b: any) => (
              <SelectItem className="text-gray-900" key={b.id} value={String(b.id)}>{b.batchName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Pending upgrade quick filter */}
        <button
          onClick={() => setPendingUpgradeFilter(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            pendingUpgradeFilter
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50'
          }`}
        >
          <span>⇑</span>
          待補付
        </button>
        {/* Alipay proof pending review quick filter */}
        <button
          onClick={() => setAlipayPendingFilter(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            alipayPendingFilter
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'
          }`}
        >
          <span>📸</span>
          待審核截圖
        </button>
        <span className="text-xs text-gray-700 ml-auto">共 {totalCount} 筆{totalCount > 0 && <span className="ml-2 font-semibold text-[#06038d]">HK${totalFee.toLocaleString('zh-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>}</span>
        {/* Bulk delete awaiting_payment button */}
        <button
          onClick={() => setShowBulkDeleteDialog(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all bg-white text-red-600 border-red-300 hover:bg-red-50"
          title="批量刪除所有未付款申請"
        >
          <Trash2 className="h-3 w-3" />
          清除未付款
        </button>
      </div>

      {/* Submissions list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
      ) : submissions.length === 0 ? (
        <p className="text-center text-gray-700 py-8 text-sm">沒有符合條件的申請</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700">申請單號</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700">申請人</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">卡牌</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-700">費用</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">狀態</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700">出團批次</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {submissions.map((sub: any) => (
                <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-[#06038d]">{sub.orderNo}</span>
                    <p className="text-xs text-gray-700 mt-0.5">{new Date(sub.createdAt).toLocaleDateString("zh-HK")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{sub.user?.name ?? "—"}</p>
                    <p className="text-xs text-gray-700 truncate max-w-[120px]">{sub.user?.email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-50 text-gray-900 font-bold text-sm">{sub.itemCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-gray-900">HK${parseFloat(sub.totalFeeHkd).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[sub.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_OPTIONS.find((s) => s.value === sub.status)?.label ?? sub.status}
                    </span>
                    {sub.alipayProofStatus === "pending_review" && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-gray-900">
                        <AlertCircle className="h-2.5 w-2.5" />截圖
                      </span>
                    )}
                    {(sub as any).alipayProofAiResult && (
                      <span className={`mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        (sub as any).alipayProofAiResult === 'pass' ? 'bg-green-100 text-green-800' :
                        (sub as any).alipayProofAiResult === 'warning' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(sub as any).alipayProofAiResult === 'pass' ? '✅ AI通過' : (sub as any).alipayProofAiResult === 'warning' ? '⚠️ AI警告' : '❌ AI未通過'}
                      </span>
                    )}
                    {sub.upgradeCheckoutSessionId && !sub.upgradePaidAt && (
                      <span className="mt-1 flex items-center justify-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        ⇑ 待補付
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
                      <SelectTrigger className="h-7 text-xs w-36 bg-white border-gray-200 text-gray-900">
                        <SelectValue placeholder="未分配" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 text-gray-900">
                        <SelectItem className="text-gray-900" value="none">未分配</SelectItem>
                        {batches.map((b: any) => (
                          <SelectItem className="text-gray-900" key={b.id} value={String(b.id)}>{b.batchName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => { setSelectedSubmissionId(sub.id); setShowDetailDialog(true); }}
                        className="bg-[#06038d] hover:bg-[#06038d]/90 text-white h-7 px-3 text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        管理
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget({ id: sub.id, orderNo: sub.orderNo })}
                        className="h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="刪除申請單"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="h-8 px-3 text-xs text-gray-700 border-gray-300"
          >
            上一頁
          </Button>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {(() => {
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
              } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((p, i) =>
                typeof p === 'string' ? (
                  <span key={`e${i}`} className="text-gray-400 text-xs px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    disabled={isLoading}
                    className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
                      currentPage === p ? 'bg-[#06038d] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              );
            })()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || isLoading}
            className="h-8 px-3 text-xs text-gray-700 border-gray-300"
          >
            下一頁
          </Button>
          <span className="text-xs text-gray-500">{currentPage} / {totalPages} 頁</span>
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
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm bg-white text-gray-900 border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              刪除申請單
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            確定要刪除申請單 <span className="font-mono font-bold text-gray-900">{deleteTarget?.orderNo}</span> 嗎？
          </p>
          <p className="text-xs text-red-500">此操作無法復原，申請單及所有卡牌資料將被永久刪除。</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="text-gray-700">
              取消
            </Button>
            <Button
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              確定刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete awaiting_payment confirmation dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={(v) => { if (!v) setShowBulkDeleteDialog(false); }}>
        <DialogContent className="max-w-sm bg-white text-gray-900 border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              清除所有未付款申請
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            確定要刪除所有「未付款（awaiting_payment）」狀態的申請嗎？用戶頁面將同步移除這些申請。
          </p>
          <p className="text-xs text-red-500">此操作無法復原，所有未付款申請及其卡牌資料將被永久刪除。</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} className="text-gray-700">
              取消
            </Button>
            <Button
              onClick={() => bulkDeleteMutation.mutate()}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              確定清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// // ─── Grading Orders Tab ────────────────────────────────────────────────────────
function GradingOrdersTab() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const PAGE_SIZE = 20;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const utils = trpc.useUtils();

  // Fetch ALL paid submissions (pending_shipment and beyond, excluding awaiting_payment/cancelled)
  const paidStatuses = ["pending_shipment", "received", "graded", "payment_overdue", "paid", "completed", "returned"];

  const { data: pendingShipmentData, isLoading: loadingPendingShipment } = trpc.grading.admin.listSubmissions.useQuery({
    status: "pending_shipment",
    page: 1,
    pageSize: 500,
  }, { refetchInterval: 30000 });
  const { data: receivedData, isLoading: loadingReceived } = trpc.grading.admin.listSubmissions.useQuery({
    status: "received",
    page: 1,
    pageSize: 500,
  }, { refetchInterval: 30000 });
  const { data: gradedData, isLoading: loadingGraded } = trpc.grading.admin.listSubmissions.useQuery({
    status: "graded",
    page: 1,
    pageSize: 500,
  }, { refetchInterval: 30000 });
  const { data: overdueData, isLoading: loadingOverdue } = trpc.grading.admin.listSubmissions.useQuery({
    status: "payment_overdue",
    page: 1,
    pageSize: 500,
  }, { refetchInterval: 30000 });
  const { data: paidData, isLoading: loadingPaid } = trpc.grading.admin.listSubmissions.useQuery({
    status: "paid",
    page: 1,
    pageSize: 500,
  }, { refetchInterval: 30000 });
  const { data: completedData, isLoading: loadingCompleted } = trpc.grading.admin.listSubmissions.useQuery({
    status: "completed",
    page: 1,
    pageSize: 500,
  }, { refetchInterval: 30000 });
  const { data: returnedData, isLoading: loadingReturned } = trpc.grading.admin.listSubmissions.useQuery({
    status: "returned",
    page: 1,
    pageSize: 500,
  }, { refetchInterval: 30000 });

  const isLoading = loadingPendingShipment || loadingReceived || loadingGraded || loadingOverdue || loadingPaid || loadingCompleted || loadingReturned;

  // Merge all sets, deduplicate by id, sort by createdAt desc
  const allPaidSubmissions = [
    ...(pendingShipmentData?.submissions ?? []),
    ...(receivedData?.submissions ?? []),
    ...(gradedData?.submissions ?? []),
    ...(overdueData?.submissions ?? []),
    ...(paidData?.submissions ?? []),
    ...(completedData?.submissions ?? []),
    ...(returnedData?.submissions ?? []),
  ].reduce((acc: any[], sub: any) => {
    if (!acc.find((s: any) => s.id === sub.id)) acc.push(sub);
    return acc;
  }, []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Revenue stats
  // "Confirmed received" = any status AFTER payment confirmation
  // awaiting_payment = not paid yet; pending_review = screenshot submitted, pending admin approval
  // All other statuses (pending_shipment and beyond) = payment confirmed
  const UNPAID_STATUSES = ["awaiting_payment", "pending_review", "cancelled"];
  const isConfirmedPaid = (s: any) => !UNPAID_STATUSES.includes(s.status);
  const totalRevenue = allPaidSubmissions.reduce((sum: number, s: any) => sum + parseFloat(s.totalFeeHkd || "0"), 0);
  const confirmedRevenue = allPaidSubmissions
    .filter(isConfirmedPaid)
    .reduce((sum: number, s: any) => sum + parseFloat(s.totalFeeHkd || "0"), 0);
  const pendingRevenue = allPaidSubmissions
    .filter((s: any) => !isConfirmedPaid(s))
    .reduce((sum: number, s: any) => sum + parseFloat(s.totalFeeHkd || "0"), 0);

  // Filter by status
  const filteredByStatus = statusFilter === "all"
    ? allPaidSubmissions
    : allPaidSubmissions.filter((s: any) => s.status === statusFilter);

  const filteredBySearch = search
    ? filteredByStatus.filter((s: any) =>
        s.orderNo?.toLowerCase().includes(search.toLowerCase()) ||
        s.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.user?.email?.toLowerCase().includes(search.toLowerCase())
      )
    : filteredByStatus;

  const total = filteredBySearch.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pagedSubmissions = filteredBySearch.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusFilterOptions = [
    { value: "all", label: "全部狀態" },
    { value: "pending_shipment", label: "待客件" },
    { value: "received", label: "已收件" },
    { value: "graded", label: "鑑定完成（待付款）" },
    { value: "payment_overdue", label: "付款逾期" },
    { value: "paid", label: "已付款" },
    { value: "completed", label: "已完成" },
    { value: "returned", label: "已退回" },
  ];

  return (
    <div className="space-y-4">
      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#06038d] text-white rounded-xl p-4">
          <p className="text-xs text-white/70">總收益（已收款）</p>
          <p className="text-2xl font-bold">HK${confirmedRevenue.toLocaleString()}</p>
          <p className="text-xs text-white/60 mt-0.5">{allPaidSubmissions.filter(isConfirmedPaid).length} 筆已確認</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-700">待確認收益</p>
          <p className="text-2xl font-bold text-orange-600">HK${pendingRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-700 mt-0.5">{allPaidSubmissions.filter((s: any) => !isConfirmedPaid(s)).length} 筆待確認</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-700">總訂單金額</p>
          <p className="text-2xl font-bold text-gray-900">HK${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-700 mt-0.5">{allPaidSubmissions.length} 筆訂單</p>
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-[#06038d]">PSA 鑑定訂單管理</h3>
          <p className="text-sm text-gray-700 mt-0.5">顯示所有已收款申請，方便追蹤進度及計算收益</p>
        </div>
        <div className="flex gap-2">
          <input
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-[#06038d] text-gray-900 bg-white"
            placeholder="搜尋訂單號/申請人..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
          />
          <button
            onClick={() => { setSearch(searchInput); setPage(1); }}
            className="px-3 py-1.5 bg-[#06038d] text-white rounded-lg text-xs font-semibold hover:bg-[#06038d]/90"
          >搜尋</button>
          {search && (
            <button
              onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-red-50"
            >清除</button>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === opt.value
                ? "bg-[#06038d] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >{opt.label}</button>
        ))}
      </div>

      <div className="text-sm text-gray-700">共 {total} 筆鑑定訂單</div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#06038d]" />
        </div>
      ) : filteredBySearch.length === 0 ? (
        <div className="text-center py-12 text-gray-700">目前沒有符合條件的訂單</div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700">訂單號</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700">申請人</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">卡牌數</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-700">金額</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">進度狀態</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">付款狀態</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">付款方式</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700">申請日期</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedSubmissions.map((sub: any) => {
                  // Payment confirmed = any status after pending_review (pending_shipment and beyond)
                  const UNPAID = ["awaiting_payment", "pending_review", "cancelled"];
                  const isPaid = !UNPAID.includes(sub.status);
                  const isGraded = sub.status === "graded";
                  const isOverdue = sub.status === "payment_overdue";
                  const hasAlipayPending = sub.alipayProofStatus === "pending_review";
                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => { setSelectedId(sub.id); setShowDetail(true); }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#06038d]">{sub.orderNo}</span>
                        {sub.batchId && (
                          <p className="text-[10px] text-gray-700 mt-0.5">批次 #{sub.batchId}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 text-sm">{sub.user?.name ?? "—"}</p>
                        <p className="text-xs text-gray-700 truncate max-w-[140px]">{sub.user?.email ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-gray-900 font-bold text-sm">{sub.itemCount ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-[#06038d] whitespace-nowrap">HK${parseFloat(sub.totalFeeHkd).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[sub.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {STATUS_OPTIONS.find((s) => s.value === sub.status)?.label ?? sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {/* Priority: overdue > graded (upgrade pending) > paid > alipay pending > default */}
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            <AlertCircle className="h-3 w-3" />差價逾期
                          </span>
                        ) : isGraded && sub.upgradeCheckoutSessionId && !sub.upgradePaidAt ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                            <Clock className="h-3 w-3" />已付款（差價待付）
                          </span>
                        ) : isPaid ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-gray-900">
                            <CheckCheck className="h-3 w-3" />已付款
                          </span>
                        ) : hasAlipayPending ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-gray-900">
                            <AlertCircle className="h-3 w-3" />截圖待審
                          </span>
                        ) : (
                          <span className="text-xs text-gray-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sub.paymentMethod === "stripe" ? (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-semibold">Stripe</span>
                        ) : sub.paymentMethod === "alipay_hk" ? (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-semibold">支付宝HK</span>
                        ) : (
                          <span className="text-xs text-gray-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700 whitespace-nowrap">
                          {new Date(sub.createdAt).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          onClick={() => { setSelectedId(sub.id); setShowDetail(true); }}
                          className="bg-[#06038d] hover:bg-[#06038d]/90 text-white h-7 px-3 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />管理
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-700">第 {page} / {totalPages} 頁</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-gray-900"
                >上一頁</button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-gray-900"
                >下一頁</button>
              </div>
            </div>
          )}
        </div>
      )}

      <SubmissionDetailDialog
        submissionId={selectedId}
        open={showDetail}
        onClose={() => { setShowDetail(false); setSelectedId(null); }}
        onUpdated={() => {
          utils.grading.admin.listSubmissions.invalidate();
          utils.grading.admin.listBatchesWithStats.invalidate();
        }}
      />
    </div>
  );
}

// ─── Dashboard 儀表板 ─────────────────────────────────────────────────────────
function DashboardTab({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { data: pendingReviewData } = trpc.grading.admin.listSubmissions.useQuery({ status: "pending_review", page: 1, pageSize: 500 });
  const { data: pendingShipmentData } = trpc.grading.admin.listSubmissions.useQuery({ status: "pending_shipment", page: 1, pageSize: 500 });
  const { data: receivedData } = trpc.grading.admin.listSubmissions.useQuery({ status: "received", page: 1, pageSize: 500 });
  const { data: gradedData } = trpc.grading.admin.listSubmissions.useQuery({ status: "graded", page: 1, pageSize: 500 });
  const { data: overdueData } = trpc.grading.admin.listSubmissions.useQuery({ status: "payment_overdue", page: 1, pageSize: 500 });
  const { data: paidData } = trpc.grading.admin.listSubmissions.useQuery({ status: "paid", page: 1, pageSize: 500 });
  const { data: completedData } = trpc.grading.admin.listSubmissions.useQuery({ status: "completed", page: 1, pageSize: 500 });

  const pendingReview = pendingReviewData?.submissions ?? [];
  const pendingShipment = pendingShipmentData?.submissions ?? [];
  const received = receivedData?.submissions ?? [];
  const graded = gradedData?.submissions ?? [];
  const overdue = overdueData?.submissions ?? [];
  const paid = paidData?.submissions ?? [];
  const completed = completedData?.submissions ?? [];

  const allActive = [...pendingReview, ...pendingShipment, ...received, ...graded, ...overdue, ...paid, ...completed];
  const UNPAID_STATUSES_DASH = ["awaiting_payment", "pending_review", "cancelled"];
  const confirmedRevenue = allActive
    .filter((s: any) => !UNPAID_STATUSES_DASH.includes(s.status))
    .reduce((sum: number, s: any) => sum + parseFloat(s.totalFeeHkd || "0"), 0);
  const totalRevenue = allActive.reduce((sum: number, s: any) => sum + parseFloat(s.totalFeeHkd || "0"), 0);

  const taskCards = [
    {
      title: "待付款審核",
      desc: "截圖已提交，等待人工核對",
      count: pendingReview.length,
      color: "bg-amber-50 border-amber-200",
      badge: "bg-amber-500",
      icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
      section: "tasks",
    },
    {
      title: "待收件",
      desc: "付款已確認，等待用戶寄件",
      count: pendingShipment.length,
      color: "bg-yellow-50 border-yellow-200",
      badge: "bg-yellow-500",
      icon: <Package className="h-5 w-5 text-yellow-600" />,
      section: "tasks",
    },
    {
      title: "待送 PSA",
      desc: "已收件，等待出團送 PSA",
      count: received.length,
      color: "bg-indigo-50 border-indigo-200",
      badge: "bg-indigo-500",
      icon: <Send className="h-5 w-5 text-indigo-600" />,
      section: "tasks",
    },
    {
      title: "待填結果",
      desc: "PSA 已鑑定完成，等待回填分數",
      count: graded.length,
      color: "bg-green-50 border-green-200",
      badge: "bg-green-500",
      icon: <CheckCheck className="h-5 w-5 text-green-600" />,
      section: "tasks",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#06038d] text-white rounded-xl p-5">
          <p className="text-xs text-white/70 mb-1">已確認收款</p>
          <p className="text-3xl font-bold">HK${confirmedRevenue.toLocaleString()}</p>
          <p className="text-xs text-white/60 mt-1">{allActive.filter((s: any) => !UNPAID_STATUSES_DASH.includes(s.status)).length} 筆已確認</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">待確認收益</p>
          <p className="text-3xl font-bold text-orange-500">HK${(totalRevenue - confirmedRevenue).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{allActive.filter((s: any) => UNPAID_STATUSES_DASH.includes(s.status)).length} 筆進行中</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">逾期未付款</p>
          <p className="text-3xl font-bold text-red-500">{overdue.length}</p>
          <p className="text-xs text-gray-400 mt-1">需要跟進</p>
        </div>
      </div>

      {/* Task cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">待處理任務</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {taskCards.map((card) => (
            <button
              key={card.title}
              onClick={() => onNavigate(card.section)}
              className={`${card.color} border rounded-xl p-4 text-left hover:shadow-md transition-all group`}
            >
              <div className="flex items-start justify-between mb-3">
                {card.icon}
                <span className={`${card.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center`}>
                  {card.count}
                </span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{card.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Status overview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">全部訂單狀態概覽</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "截圖待審核", count: pendingReview.length, color: "text-amber-700 bg-amber-50" },
            { label: "待寄件", count: pendingShipment.length, color: "text-yellow-700 bg-yellow-50" },
            { label: "已收件", count: received.length, color: "text-indigo-700 bg-indigo-50" },
            { label: "鑑定完成", count: graded.length, color: "text-green-700 bg-green-50" },
            { label: "付款逾期", count: overdue.length, color: "text-red-700 bg-red-50" },
            { label: "已付款", count: paid.length, color: "text-emerald-700 bg-emerald-50" },
            { label: "已完成", count: completed.length, color: "text-gray-700 bg-gray-50" },
          ].map((item) => (
            <div key={item.label} className={`${item.color} rounded-lg p-3 flex items-center justify-between`}>
              <span className="text-xs font-medium">{item.label}</span>
              <span className="text-lg font-bold">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 任務中心 ─────────────────────────────────────────────────────────────────
function TaskCenterTab() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [activeTask, setActiveTask] = useState<"pending_review" | "pending_shipment" | "received" | "graded">("pending_review");

  const { data: pendingReviewData, isLoading: loadingReview } = trpc.grading.admin.listSubmissions.useQuery(
    { status: "pending_review", page: 1, pageSize: 200 },
    { refetchInterval: 15000 }
  );
  const { data: pendingShipmentData, isLoading: loadingShipment } = trpc.grading.admin.listSubmissions.useQuery(
    { status: "pending_shipment", page: 1, pageSize: 200 },
    { refetchInterval: 30000 }
  );
  const { data: receivedData, isLoading: loadingReceived } = trpc.grading.admin.listSubmissions.useQuery(
    { status: "received", page: 1, pageSize: 200 },
    { refetchInterval: 30000 }
  );
  const { data: gradedData, isLoading: loadingGraded } = trpc.grading.admin.listSubmissions.useQuery(
    { status: "graded", page: 1, pageSize: 200 },
    { refetchInterval: 30000 }
  );

  const pendingReview = pendingReviewData?.submissions ?? [];
  const pendingShipment = pendingShipmentData?.submissions ?? [];
  const received = receivedData?.submissions ?? [];
  const graded = gradedData?.submissions ?? [];

  const taskTabs = [
    { id: "pending_review" as const, label: "待付款審核", count: pendingReview.length, color: "bg-amber-500", desc: "截圖已提交，等待人工核對確認收款" },
    { id: "pending_shipment" as const, label: "待收件", count: pendingShipment.length, color: "bg-yellow-500", desc: "付款已確認，等待用戶寄件到 BOXIUM" },
    { id: "received" as const, label: "待送 PSA", count: received.length, color: "bg-indigo-500", desc: "已收件，等待出團送 PSA 鑑定" },
    { id: "graded" as const, label: "待填結果", count: graded.length, color: "bg-green-500", desc: "PSA 已鑑定完成，等待回填分數" },
  ];

  const currentList = activeTask === "pending_review" ? pendingReview
    : activeTask === "pending_shipment" ? pendingShipment
    : activeTask === "received" ? received
    : graded;

  const isLoading = activeTask === "pending_review" ? loadingReview
    : activeTask === "pending_shipment" ? loadingShipment
    : activeTask === "received" ? loadingReceived
    : loadingGraded;

  return (
    <div className="space-y-4">
      {/* Task type tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {taskTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTask(tab.id)}
            className={`rounded-xl p-4 text-left border-2 transition-all ${
              activeTask === tab.id
                ? "border-[#06038d] bg-[#06038d]/5"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">{tab.label}</span>
              <span className={`${tab.color} text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center`}>
                {tab.count}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-snug">{tab.desc}</p>
          </button>
        ))}
      </div>

      {/* Current task list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-sm font-semibold text-gray-800">
            {taskTabs.find(t => t.id === activeTask)?.label} — {currentList.length} 筆
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{taskTabs.find(t => t.id === activeTask)?.desc}</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#06038d]" /></div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-gray-400">
            <CheckCircle2 className="h-10 w-10 mb-2 text-green-400" />
            <p className="text-sm font-medium">目前沒有待處理任務</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">申請單號</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">申請人</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">卡牌</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">費用</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">批次</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentList.map((sub: any) => (
                <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-[#06038d]">{sub.orderNo}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(sub.createdAt).toLocaleDateString("zh-HK")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{sub.user?.name ?? "—"}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[120px]">{sub.user?.email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-50 text-gray-900 font-bold text-sm">{sub.itemCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-gray-900">HK${parseFloat(sub.totalFeeHkd || "0").toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">{sub.batch?.batchName ?? <span className="text-gray-300">未分配</span>}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      onClick={() => { setSelectedId(sub.id); setShowDetail(true); }}
                      className="bg-[#06038d] hover:bg-[#06038d]/90 text-white h-7 px-3 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      處理
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail dialog */}
      {showDetail && selectedId && (
        <SubmissionDetailDialog
          submissionId={selectedId}
          open={showDetail}
          onClose={() => { setShowDetail(false); setSelectedId(null); }}
          onUpdated={() => {
            utils.grading.admin.listSubmissions.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function AdminGrading() {
  const [activeSection, setActiveSection] = useState<"dashboard" | "tasks" | "batches" | "submissions" | "orders" | "tiers">("dashboard");

  const sections = [
    { id: "dashboard" as const, label: "儀表板", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "tasks" as const, label: "任務中心", icon: <CheckCheck className="h-4 w-4" /> },
    { id: "batches" as const, label: "批次管理", icon: <Calendar className="h-4 w-4" /> },
    { id: "submissions" as const, label: "訂單管理", icon: <List className="h-4 w-4" /> },
    { id: "orders" as const, label: "收益統計", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "tiers" as const, label: "服務層級", icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">PSA 代客鑑定管理</h2>
        <p className="text-gray-700 text-sm mt-1">管理鑑定申請、出團批次、訂單及服務層級</p>
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
                : "border-transparent text-gray-700 hover:text-[#06038d]"
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "dashboard" && <DashboardTab onNavigate={(s) => setActiveSection(s as any)} />}
      {activeSection === "tasks" && <TaskCenterTab />}
      {activeSection === "batches" && <BatchOverview />}
      {activeSection === "submissions" && <SubmissionManagement />}
      {activeSection === "orders" && <GradingOrdersTab />}
      {activeSection === "tiers" && <ServiceTierManagement />}
    </div>
  );
}
