import { useState, useCallback, useEffect, useRef } from "react";
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
// ─── Types ─────────────────────────────────────────────────────────────────────────────
interface GradingItem {
  id: string;
  card: SelectedCard | null;
  manualCardName: string;
  manualCardSet: string;
  manualCardNumber: string;
  quantity: number;
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
    quantity: 1,
  };
}

// ─── Step Indicator ─────────────────────────────────────────────────────────────────────────────
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
          {!isExpanded && (item.quantity ?? 1) > 1 && (
            <span className="text-xs font-bold text-[#06038d] bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 flex-shrink-0">
              × {item.quantity}
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

          {/* Quantity */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-2 block">數量</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdate(item.id, { quantity: Math.max(1, (item.quantity ?? 1) - 1) })}
                className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors font-bold text-lg select-none"
                disabled={(item.quantity ?? 1) <= 1}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={1000}
                value={item.quantity ?? 1}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) onUpdate(item.id, { quantity: Math.min(1000, Math.max(1, v)) });
                }}
                className="w-16 h-8 text-center border border-gray-300 rounded-lg text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-[#06038d]/30 focus:border-[#06038d]"
              />
              <button
                type="button"
                onClick={() => onUpdate(item.id, { quantity: Math.min(1000, (item.quantity ?? 1) + 1) })}
                className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors font-bold text-lg select-none"
                disabled={(item.quantity ?? 1) >= 1000}
              >
                +
              </button>
              <span className="text-xs text-gray-400 ml-1">張（1–1000）</span>
            </div>
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

// ─── Draft helpers ───────────────────────────────────────────────────────────
const DRAFT_KEY_PREFIX = "boxium_grading_draft_v2";
const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function formatDraftAge(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return "剛才";
  if (diffMins < 60) return `${diffMins} 分鐘前`;
  if (diffHours < 24) return `${diffHours} 小時前`;
  if (diffDays === 1) return "昨天";
  return `${diffDays} 天前`;
}

function getDraftKey(userId?: number | string): string {
  return userId ? `${DRAFT_KEY_PREFIX}_${userId}` : `${DRAFT_KEY_PREFIX}_guest`;
}

interface DraftData {
  step: number;
  selectedTierId: number | null;
  items: GradingItem[];
  savedAt: number; // Unix timestamp ms
}
function loadDraft(userId?: number | string): DraftData | null {
  try {
    const raw = localStorage.getItem(getDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftData;
    // Expire drafts older than 7 days
    if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_EXPIRY_MS) {
      localStorage.removeItem(getDraftKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function saveDraft(data: DraftData, userId?: number | string) {
  try {
    localStorage.setItem(getDraftKey(userId), JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {}
}
function clearDraft(userId?: number | string) {
  try {
    localStorage.removeItem(getDraftKey(userId));
    // Also clear old v1 key if exists
    localStorage.removeItem("boxium_grading_draft_v1");
  } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GradingSubmit() {
  const [, navigate] = useLocation();
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery();

  // ── Draft restore ──
  // userId is used to isolate drafts per account on the same device
  const userId = user?.id;
  const draftInitialized = useRef(false);
  const isFirstRender = useRef(true);

  // Load draft with userId (or guest key before auth loads)
  const existingDraft = loadDraft(userId);
  const hasDraftWithCards = existingDraft && existingDraft.items && existingDraft.items.length > 0 && (existingDraft.items.length > 1 || existingDraft.items[0].card !== null || existingDraft.items[0].manualCardName !== "");
  const [showDraftBanner, setShowDraftBanner] = useState<boolean>(!!hasDraftWithCards);
  // Track whether user has already chosen to resume draft (hide card if they go back to Step 1)
  const [draftResumed, setDraftResumed] = useState(false);

  // Always start at step 1 so user can choose to resume or start fresh
  const [step, setStep] = useState(1);
  // Order-level tier selection
  const [selectedTierId, setSelectedTierId] = useState<number | null>(existingDraft && hasDraftWithCards ? existingDraft.selectedTierId : null);
  const initialItems = existingDraft && hasDraftWithCards ? existingDraft.items : [newItem()];
  const [items, setItems] = useState<GradingItem[]>(initialItems);
  const [expandedItemId, setExpandedItemId] = useState<string>(initialItems[0].id);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const { data: tiers, isLoading: tiersLoading } = trpc.grading.getServiceTiers.useQuery();

  // Once userId is available, re-check draft with user-specific key
  useEffect(() => {
    if (!userId || draftInitialized.current) return;
    draftInitialized.current = true;
    const userDraft = loadDraft(userId);
    const userHasDraft = userDraft && userDraft.items && userDraft.items.length > 0 && (userDraft.items.length > 1 || userDraft.items[0].card !== null || userDraft.items[0].manualCardName !== "");
    if (userHasDraft && userDraft) {
      // Don't auto-restore step; user must choose to resume from Step 1
      setShowDraftBanner(true);
    }
  }, [userId]);

  // ── Auto-save draft ──
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Only save if user has started filling (step > 1 or has cards)
    const hasContent = step > 1 || selectedTierId !== null || items.some(i => i.card !== null || i.manualCardName !== "");
    if (hasContent) {
      saveDraft({ step, selectedTierId, items, savedAt: Date.now() }, userId);
    }
  }, [step, selectedTierId, items, userId]);

  const handleDiscardDraft = () => {
    clearDraft(userId);
    setShowDraftBanner(false);
    setStep(1);
    setSelectedTierId(null);
    const fresh = newItem();
    setItems([fresh]);
    setExpandedItemId(fresh.id);
    setAgreedTerms(false);
  };

  const handleResumeDraft = () => {
    // Load the latest draft (prefer user-specific key)
    const draft = loadDraft(userId);
    if (!draft) return;
    setSelectedTierId(draft.selectedTierId);
    setItems(draft.items);
    setExpandedItemId(draft.items[0]?.id ?? '');
    setAgreedTerms(false);
    setShowDraftBanner(false);
    setDraftResumed(true); // Mark as resumed so banner won't reappear on back
    // Always resume at step 2 (card details), not step 3
    setStep(2);
  };

  const checkoutMutation = trpc.grading.submitApplication.useMutation({
    onSuccess: (data: any) => {
      clearDraft(userId);
      toast.success("申請已提交！請前往申請詳情頁完成付款。");
      navigate(`/grading/orders/${data.submissionId}`);
    },
    onError: (err: any) => {
      toast.error(`提交失敗：${err.message}`);
    },
  });

  const submitMutation = checkoutMutation;

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
    // Expand items by quantity: each item with qty=3 becomes 3 separate submission items
    const expandedItems = items.flatMap((item: GradingItem) => {
      const qty = item.quantity ?? 1;
      return Array.from({ length: qty }, () => ({
        cardName: item.isManual ? item.manualCardName : (item.card?.name ?? ""),
        cardSet: item.isManual ? item.manualCardSet : (item.card?.series ?? ""),
        cardNumber: item.isManual ? item.manualCardNumber : (item.card?.cardNumber ?? ""),
        cardImageUrl: item.card?.imageUrl ?? undefined,
        tierId: selectedTierId!,
        condition: "near_mint" as "mint" | "near_mint" | "excellent",
        notes: "",
      }));
    });
    checkoutMutation.mutate({
      items: expandedItems,
      agreedToTerms: true,
    });
  };

  // ── Fee calculation ──
  const selectedTier = tiers?.find((t: any) => t.id === selectedTierId);
  const totalQuantity = items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);
  const totalFee = selectedTier ? parseFloat(selectedTier.feeHkd) * totalQuantity : 0;

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

        {/* ── Draft Banner: only shown in Step 1 as a choice card ── */}

        {/* ── Step 1: Select Service Tier ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* ── Draft resume card (Step 1 only, hidden after user resumes) ── */}
            {showDraftBanner && !draftResumed && (() => {
              const draft = loadDraft(userId);
              const draftItemCount = draft?.items?.filter((i: any) => i.card !== null || i.manualCardName !== '').length ?? 0;
              const draftTotalQty = draft?.items?.reduce((sum: number, i: any) => sum + (i.quantity ?? 1), 0) ?? 0;
              // Find tier name from loaded tiers
              const draftTierName = draft?.selectedTierId && tiers
                ? (tiers as any[]).find((t: any) => t.id === draft.selectedTierId)?.name
                : null;
              // Check if draft is expiring soon (within 24h of 7-day expiry)
              const draftAgeDays = draft?.savedAt ? (Date.now() - draft.savedAt) / (1000 * 60 * 60 * 24) : 0;
              const isExpiringSoon = draftAgeDays >= 6;
              // First card thumbnail for preview
              const firstCard = draft?.items?.find((i: any) => i.card !== null)?.card ?? null;
              const firstCardThumb = firstCard?.imageUrl ?? null;
              const firstCardName = firstCard?.name ?? (draft?.items?.[0]?.manualCardName || null);
              return (
                <div className={`border-2 rounded-xl p-4 ${isExpiringSoon ? 'bg-orange-50 border-orange-300' : 'bg-blue-50 border-blue-300'}`}>
                  {/* Expiry warning */}
                  {isExpiringSoon && (
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-orange-700 bg-orange-100 border border-orange-200 rounded-lg px-2.5 py-1.5">
                      <span>⚠️</span>
                      <span>草稿將於{draftAgeDays >= 6.5 ? '明天' : '1 天內'}自動刪除，請盡快繼續申請</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3 mb-3">
                    {/* Card thumbnail preview */}
                    {firstCardThumb ? (
                      <div className="flex-shrink-0 w-10 h-14 rounded overflow-hidden border border-blue-200 bg-white shadow-sm">
                        <img src={firstCardThumb} alt={firstCardName ?? '卡牌'} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className={`text-xl flex-shrink-0 mt-1 ${isExpiringSoon ? 'text-orange-500' : 'text-blue-500'}`}>💾</div>
                    )}
                    <div className="flex-1">
                      <p className={`font-bold mb-0.5 ${isExpiringSoon ? 'text-orange-900' : 'text-blue-900'}`}>發現上次未完成的申請草稿</p>
                      <p className={`text-xs ${isExpiringSoon ? 'text-orange-700' : 'text-blue-700'}`}>
                        {draftItemCount > 0 ? `共 ${draftItemCount} 種卡牌（${draftTotalQty} 張）` : '已選層級'}
                        {draftTierName && (
                          <span className="ml-1">· 已選層級：<strong>{draftTierName}</strong></span>
                        )}
                        {draft?.savedAt && (
                          <span className={`ml-1 ${isExpiringSoon ? 'text-orange-500' : 'text-blue-500'}`}>· {formatDraftAge(draft.savedAt)}儲存</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                      onClick={handleResumeDraft}
                    >
                      繼續上次的申請
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 bg-white"
                      onClick={handleDiscardDraft}
                    >
                      刪除草稿，開新申請
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* How to choose tier tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <span className="text-amber-500 text-lg flex-shrink-0 mt-0.5">💡</span>
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">如何選擇正確層級，避免補付差價？</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  請選擇「最高申報價值」<strong>高於您卡牌實際市值</strong>的層級。例如卡牌市值約 USD $200，建議選擇最高申報 USD $500 或以上的層級。如鑑定後市值超出申報上限，管理員才會通知補付差價。
                </p>
              </div>
            </div>
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
                            約 {tier.estimatedDaysMin} - {tier.estimatedDaysMax} 工作天
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
                  {totalQuantity} 張 × HK${parseFloat(selectedTier.feeHkd).toLocaleString()}
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
                  const qty = (item as any).quantity ?? 1;
                  const itemFee = selectedTier ? parseFloat(selectedTier.feeHkd) * qty : 0;
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
                            #{idx + 1} {cardName}{qty > 1 ? <span className="text-[#06038d] font-bold"> × {qty}</span> : null}
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
                        HK${selectedTier ? itemFee.toLocaleString() : "—"}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">代送 PSA 費用合計</p>
                    <p className="text-xs text-gray-500">
                      共 {items.reduce((sum, i) => sum + ((i as any).quantity ?? 1), 0)} 張卡牌 · 費用已包含 BOXIUM 代辦服務費
                    </p>
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
                disabled={!agreedTerms || checkoutMutation.isPending}
                className="flex-1 bg-[#06038d] hover:bg-[#06038d]/90 text-white"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  <>
                    提交申請
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
