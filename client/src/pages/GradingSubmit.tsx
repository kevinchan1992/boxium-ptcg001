import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Package,
  DollarSign,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface GradingItem {
  id: string;
  card: SelectedCard | null;
  manualCardName: string;
  manualCardSet: string;
  manualCardNumber: string;
  notes: string;
  isManual: boolean;
}

function newItem(): GradingItem {
  return {
    id: Math.random().toString(36).slice(2),
    card: null,
    manualCardName: "",
    manualCardSet: "",
    manualCardNumber: "",
    isManual: false,
    notes: "",
  };
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = ["選擇服務層級", "填寫卡牌資料", "確認提交"];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-[#06038d] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : idx}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${active ? "text-[#06038d] font-semibold" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mb-4 ${done ? "bg-green-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Item Card (Accordion) ────────────────────────────────────────────────────
function ItemCard({
  item,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  item: GradingItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: Partial<GradingItem>) => void;
  onRemove: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleCardSelect = useCallback(
    (card: SelectedCard) => {
      onUpdate(item.id, { card, isManual: false });
    },
    [item.id, onUpdate]
  );

  const cardLabel = item.isManual
    ? item.manualCardName || "（未填寫）"
    : item.card?.name || "（未選擇）";

  const isFilled = item.isManual ? !!item.manualCardName.trim() : !!item.card;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Accordion Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-[#06038d] text-sm flex-shrink-0">卡牌 #{index + 1}</span>
          {!isExpanded && (
            <span className={`text-sm truncate ${isFilled ? "text-gray-700" : "text-gray-400"}`}>
              {cardLabel}
            </span>
          )}
          {!isExpanded && isFilled && (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 px-2"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Card selection */}
          <div className="mt-4 mb-4">
            <Label className="text-xs font-semibold text-gray-600 mb-2 block">卡牌資料 *</Label>
            {!item.isManual ? (
              <>
                {item.card ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    {item.card.imageUrl && (
                      <img src={item.card.imageUrl} alt={item.card.name} className="w-14 h-20 object-contain rounded flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.card.name}</p>
                      {item.card.cardNumber && (
                        <p className="text-xs text-gray-500">{item.card.cardNumber}</p>
                      )}
                      {item.card.series && (
                        <p className="text-xs text-gray-500">{item.card.series}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPickerOpen(true)}
                      className="text-[#06038d] h-7 px-2 text-xs"
                    >
                      更換
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-[#06038d] text-[#06038d] hover:bg-blue-50 h-12"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    搜尋並選擇卡牌
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { isManual: true, card: null })}
                  className="text-xs text-gray-400 hover:text-gray-600 mt-1 underline"
                >
                  找不到您要找的卡牌？手動填寫
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="卡牌名稱 *"
                  value={item.manualCardName}
                  onChange={(e) => onUpdate(item.id, { manualCardName: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="卡牌系列 / 套組"
                  value={item.manualCardSet}
                  onChange={(e) => onUpdate(item.id, { manualCardSet: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="卡牌編號（如 001/100）"
                  value={item.manualCardNumber}
                  onChange={(e) => onUpdate(item.id, { manualCardNumber: e.target.value })}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { isManual: false })}
                  className="text-xs text-[#06038d] hover:underline"
                >
                  返回搜尋
                </button>
              </div>
            )}
            <CardPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onSelect={handleCardSelect}
              selectedCardId={item.card?.id ?? null}
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1 block">備註（可選）</Label>
            <Textarea
              placeholder="如有特別說明請填寫..."
              value={item.notes}
              onChange={(e) => onUpdate(item.id, { notes: e.target.value })}
              className="text-sm resize-none h-16"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Terms content ────────────────────────────────────────────────────────────
const TERMS = [
  "本人確認所提交的卡牌為本人合法擁有，並非贓物或侵權物品。",
  "本人明白 PSA 鑑定結果為最終結果，BOXIUM 無法干預評分，亦不保證任何特定評分。",
  "本人明白卡片一經提交 PSA 後，申請不可取消，費用亦不予退還。如需在 BOXIUM 收件後取消，須於 48 小時內書面通知並支付 HK$50 行政費。",
  "本人明白客人自費寄件至 BOXIUM 的過程由客人自行承擔風險，BOXIUM 不負責寄件途中的遺失或損壞。",
  "本人明白鑑定完成後須於 30 天內完成付款。逾期未付款，BOXIUM 保留對相關卡片自行處理之權利，包括但不限於出售、捐贈或銷毀，客人將不獲任何賠償。",
  "本人明白 BOXIUM 對 PSA 之任何服務中斷、政策變更、價格調整或其他不可抗力因素概不負責。",
  "本人明白價格或會因應官方調整而更改，恕不另行通知。鑑定期以工作天計算，實際時間會根據官方實際情況而定，不包括運輸時間。",
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GradingSubmit() {
  const [, navigate] = useLocation();
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery();
  const [step, setStep] = useState(1);
  // Order-level tier selection
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [items, setItems] = useState<GradingItem[]>([newItem()]);
  const [expandedItemId, setExpandedItemId] = useState<string>(items[0].id);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const { data: tiers, isLoading: tiersLoading } = trpc.grading.getServiceTiers.useQuery();

  const submitMutation = trpc.grading.submitApplication.useMutation({
    onSuccess: (data: any) => {
      toast.success("申請提交成功！請查看確認通知以獲取送件地址。");
      navigate(`/grading/orders/${data.submissionId}`);
    },
    onError: (err: any) => {
      toast.error(`提交失敗：${err.message}`);
    },
  });

  // ── Item management ──
  const addItem = () => {
    const newI = newItem();
    setItems((prev) => [...prev, newI]);
    setExpandedItemId(newI.id); // expand new, collapse others
  };
  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error("至少需要一張卡牌");
      return;
    }
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      // If we removed the expanded one, expand the last remaining
      if (expandedItemId === id) {
        setExpandedItemId(next[next.length - 1].id);
      }
      return next;
    });
  };
  const updateItem = useCallback((id: string, updates: Partial<GradingItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const toggleItem = (id: string) => {
    setExpandedItemId((prev) => (prev === id ? "" : id));
  };

  // ── Validation ──
  const validateStep1 = () => {
    if (!selectedTierId) {
      toast.error("請選擇服務層級");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    for (const item of items) {
      if (!item.isManual && !item.card) {
        toast.error("請為每張卡牌選擇卡牌資料");
        return false;
      }
      if (item.isManual && !item.manualCardName.trim()) {
        toast.error("請填寫卡牌名稱");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = () => {
    if (!agreedTerms) {
      toast.error("請先閱讀並同意服務條款");
      return;
    }
    submitMutation.mutate({
      items: items.map((item: GradingItem) => ({
        cardName: item.isManual ? item.manualCardName : (item.card?.name ?? ""),
        cardSet: item.isManual ? item.manualCardSet : (item.card?.series ?? ""),
        cardNumber: item.isManual ? item.manualCardNumber : (item.card?.cardNumber ?? ""),
        cardImageUrl: item.card?.imageUrl ?? undefined,
        tierId: selectedTierId!,
        condition: "near_mint" as "mint" | "near_mint" | "excellent",
        notes: item.notes,
      })),
      agreedToTerms: true,
    });
  };

  // ── Fee calculation ──
  const selectedTier = tiers?.find((t: any) => t.id === selectedTierId);
  const totalFee = selectedTier ? parseFloat(selectedTier.feeHkd) * items.length : 0;

  // ── Auth guard ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#06038d]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">請先登入</h2>
          <p className="text-gray-500 mb-6">提交 PSA 鑑定申請需要登入帳號</p>
          <a href="/login">
            <Button className="bg-[#06038d] hover:bg-[#06038d]/90 text-white w-full">
              登入 / 註冊
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">PSA 代客鑑定申請</h1>
          <p className="text-gray-500 text-sm mt-1">填寫卡牌資料，提交後請打印申請單連同卡牌寄出</p>
        </div>

        <StepIndicator step={step} />

        {/* ── Step 1: Select Service Tier ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-1">選擇服務層級</h2>
              <p className="text-xs text-gray-500 mb-4">此次申請的所有卡牌將使用相同服務層級</p>
              {tiersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {tiers?.map((tier: any) => (
                    <label
                      key={tier.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedTierId === tier.id
                          ? "border-[#06038d] bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="tier"
                          value={tier.id}
                          checked={selectedTierId === tier.id}
                          onChange={() => setSelectedTierId(tier.id)}
                          className="accent-[#06038d]"
                        />
                        <div>
                          <p className="font-bold text-black">{tier.name}</p>
                          <p className="text-xs text-black/60">
                            最高申報 USD ${parseFloat(tier.maxDeclaredValueUsd).toLocaleString()} ·{" "}
                            約 {tier.estimatedDaysMin}–{tier.estimatedDaysMax} 個月
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-[#06038d] text-lg">HK${parseFloat(tier.feeHkd).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">/ 張</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleNext}
                className="bg-[#06038d] hover:bg-[#06038d]/90 text-white px-8"
                disabled={tiersLoading || !selectedTierId}
              >
                下一步：填寫卡牌資料
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Card Details ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Selected tier summary */}
            {selectedTier && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-600 font-semibold">已選服務層級</span>
                  <p className="font-bold text-[#06038d]">{selectedTier.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#06038d]">HK${parseFloat(selectedTier.feeHkd).toLocaleString()} / 張</p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    更改
                  </button>
                </div>
              </div>
            )}

            {/* Card list */}
            {items.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                index={index}
                isExpanded={expandedItemId === item.id}
                onToggle={() => toggleItem(item.id)}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed border-[#06038d] text-[#06038d] hover:bg-blue-50 h-12"
              onClick={addItem}
            >
              <Plus className="h-4 w-4 mr-2" />
              新增卡牌
            </Button>

            {/* Fee preview */}
            {selectedTier && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {items.length} 張 × HK${parseFloat(selectedTier.feeHkd).toLocaleString()}
                </span>
                <span className="font-bold text-[#06038d]">合計 HK${totalFee.toLocaleString()}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 text-black">
                <ChevronLeft className="mr-2 h-4 w-4" />
                返回
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 bg-[#06038d] hover:bg-[#06038d]/90 text-white"
              >
                下一步：確認提交
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm & Terms ── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Fee breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-[#06038d] text-white px-5 py-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="font-bold">費用明細</span>
              </div>
              <div className="p-4 space-y-3">
                {items.map((item, idx) => {
                  const cardName = item.isManual
                    ? item.manualCardName
                    : (item.card?.name ?? "未知卡牌");
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {!item.isManual && item.card?.imageUrl && (
                          <img
                            src={item.card.imageUrl}
                            alt={cardName}
                            className="w-14 h-20 object-contain rounded flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            #{idx + 1} {cardName}
                          </p>
                          {!item.isManual && item.card?.cardNumber && (
                            <p className="text-xs text-gray-500">{item.card.cardNumber}</p>
                          )}
                          <Badge variant="outline" className="text-xs mt-0.5 text-black border-gray-400">
                            {selectedTier?.name ?? "—"}
                          </Badge>
                        </div>
                      </div>
                      <span className="font-bold text-black flex-shrink-0">
                        HK${selectedTier ? parseFloat(selectedTier.feeHkd).toLocaleString() : "—"}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">代送 PSA 費用合計</p>
                    <p className="text-xs text-gray-500">費用已包含 BOXIUM 代辦服務費</p>
                  </div>
                  <span className="text-2xl font-bold text-[#06038d]">
                    HK${totalFee.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Shipping notice */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <div className="flex gap-3">
                <Package className="h-5 w-5 text-[#06038d] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#06038d] mb-1">送件地址</p>
                  <p className="text-sm text-gray-700">📦 順豐站 852Z351</p>
                  <p className="text-sm text-gray-700">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>
                  <p className="text-xs text-amber-600 mt-2 font-semibold">
                    ⚠️ 請打印申請單連同卡牌一起寄出，否則無法處理您的申請
                  </p>
                </div>
              </div>
            </div>

            {/* Payment notice */}
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800 mb-1">付款方式</p>
                  <p className="text-sm text-amber-700">
                    鑑定完成後，系統將通知您評分結果及付款連結，請於 <strong>30 天內</strong> 完成付款（支援 Visa / Mastercard 信用卡及支付寶 HK）。
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    逾期未付款，平台保留對相關卡片自行處理之權利。
                  </p>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-[#06038d]" />
                <span className="font-bold text-gray-900">服務條款</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto mb-4 text-xs text-gray-600 space-y-2">
                {TERMS.map((term, i) => (
                  <p key={i}>{i + 1}. {term}</p>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={agreedTerms}
                  onClick={() => setAgreedTerms(!agreedTerms)}
                  className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    agreedTerms
                      ? 'border-[#06038d] bg-white'
                      : 'border-gray-400 bg-white'
                  }`}
                  style={{ minWidth: '16px', minHeight: '16px' }}
                >
                  {agreedTerms && (
                    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                      <path d="M2 6l3 3 5-5" stroke="#06038d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-sm text-gray-700">
                  我已閱讀並同意以上所有服務條款，並確認所提交資料屬實。
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 text-black"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                返回修改
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!agreedTerms || submitMutation.isPending}
                className="flex-1 bg-[#06038d] hover:bg-[#06038d]/90 text-white"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    確認提交申請
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
