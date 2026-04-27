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
import { SF_STATIONS } from "@/lib/sfStations";
import { SF_LOCKERS } from "@/lib/sfLockers";
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
  MapPin,
  Home,
  PlusCircle,
  Truck,
  Save,
  ExternalLink,
} from "lucide-react";
// ─── Types ─────────────────────────────────────────────────────────────────────────────
interface GradingItem {
  id: string;
  card: SelectedCard | null;
  manualCardName: string;
  manualCardSet: string;
  manualCardNumber: string;
  quantity: number;
  quantityInput?: string; // Temporary string for input editing (allows empty/backspace)
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
  if (step === 4) return null; // Hide step indicator on confirmation page
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
                type="text"
                inputMode="numeric"
                 max={999}
                value={item.quantityInput !== undefined ? item.quantityInput : String(item.quantity ?? 1)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  // Allow empty string (user backspaced all digits)
                  if (raw === '') {
                    onUpdate(item.id, { quantityInput: '', quantity: item.quantity ?? 1 });
                    return;
                  }
                  const v = parseInt(raw, 10);
                  if (!isNaN(v)) {
                    onUpdate(item.id, { quantityInput: raw, quantity: Math.min(999, Math.max(1, v)) });
                  }
                }}
                onBlur={(e) => {
                  // On blur: if empty or 0, reset to 1
                  const v = parseInt(e.target.value, 10);
                  const final = isNaN(v) || v < 1 ? 1 : Math.min(999, v);
                  onUpdate(item.id, { quantityInput: undefined, quantity: final });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-16 h-8 text-center border border-gray-300 rounded-lg text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-[#06038d]/30 focus:border-[#06038d]"
              />
              <button
                type="button"
                onClick={() => onUpdate(item.id, { quantity: Math.min(999, (item.quantity ?? 1) + 1) })}
                className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors font-bold text-lg select-none"
                disabled={(item.quantity ?? 1) >= 999}
              >
                +
              </button>
              <span className="text-xs text-gray-400 ml-1">張（1-999）</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Terms content ────────────────────────────────────────────────────────────
const TERMS = [
  "本人確認所提交的卡牌為本人合法擁有，並非贓物或侵權物品。如日後發現卡牌來源有問題，本人須承擔一切法律責任。",
  "本人明白 PSA 鑑定結果為最終結果，BOXIUM 無法干預評分，亦不保證任何特定評分。對評分結果有任何異議，須直接向 PSA 提出，BOXIUM 不負責跟進。",
  "本人明白卡片一經提交 PSA 後，申請不可取消，費用亦不予退還。如需在 BOXIUM 收件後取消，須於 48 小時內書面通知並支付 HK$50 行政費。",
  "本人明白客人自費寄件至 BOXIUM 的過程由客人自行承擔風險，BOXIUM 不負責寄件途中的遺失或損壞。強烈建議客人購買運輸保險。",
  "本人明白鑑定完成後須於 30 天內完成付款。逾期未付款，BOXIUM 保留對相關卡片自行處理之權利，包括但不限於出售、捐贈或銷毀，客人將不獲任何賠償。",
  "本人明白 BOXIUM 對 PSA 之任何服務中斷、政策變更、價格調整或其他不可抗力因素概不負責。",
  "本人明白價格或會因應官方調整而更改，恕不另行通知。鑑定期以工作天計算，實際時間會根據官方實際情況而定，不包括運輸時間。",
  "本人明白 BOXIUM 只作代理服務，卡牌鑑定期間由 PSA 負責保管，BOXIUM 不對 PSA 保管期間的任何損失負責。",
  "本人明白提交申請即代表同意 BOXIUM 收集及使用本人的個人資料（包括姓名、聯絡方式及卡牌資料）用於處理本次申請。",
  "本人確認所填寫的資料屬實，如有虛假陳述，BOXIUM 保留拒絕服務及追究責任的權利。",
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

// ─── Tier Comparison Table ────────────────────────────────────────────────────
function TierComparisonTable({ tiers }: { tiers: any[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!tiers || tiers.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="font-semibold text-gray-900 text-sm">各層級服務對比</span>
          <span className="text-xs text-gray-400">（點擊展開）</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700 whitespace-nowrap">層級</th>
                <th className="text-right p-3 font-semibold text-gray-700 whitespace-nowrap">費用 / 張</th>
                <th className="text-right p-3 font-semibold text-gray-700 whitespace-nowrap">最高申報</th>
                <th className="text-right p-3 font-semibold text-gray-700 whitespace-nowrap">預計時效</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier: any, idx: number) => (
                <tr key={tier.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="p-3 font-semibold text-gray-900 whitespace-nowrap">{tier.name}</td>
                  <td className="p-3 text-right font-bold text-[#06038d] whitespace-nowrap">
                    HK${parseFloat(tier.feeHkd).toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-gray-600 whitespace-nowrap">
                    USD ${parseFloat(tier.maxDeclaredValueUsd).toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-gray-600 whitespace-nowrap">
                    {tier.estimatedDaysMin}–{tier.estimatedDaysMax} 工作天
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
            <p className="text-xs text-blue-700">
              <strong>選層級建議：</strong>選擇「最高申報」<strong>高於卡牌實際市值</strong>的層級，避免鑑定後需補付差價。
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
  // Submitted order data (used in step 4 confirmation page)
  const [submittedData, setSubmittedData] = useState<{ submissionId: number; orderNo: string; totalFee: number; cardCount: number } | null>(null);
  // Ref to store fee/count at submit time (avoids stale closure in onSuccess)
  const pendingSubmitRef = useRef<{ totalFee: number; cardCount: number } | null>(null);
  // Order-level tier selection
  const [selectedTierId, setSelectedTierId] = useState<number | null>(existingDraft && hasDraftWithCards ? existingDraft.selectedTierId : null);
  const initialItems = existingDraft && hasDraftWithCards ? existingDraft.items : [newItem()];
  const [items, setItems] = useState<GradingItem[]>(initialItems);
  const [expandedItemId, setExpandedItemId] = useState<string>(initialItems[0].id);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const { data: tiers, isLoading: tiersLoading } = trpc.grading.getServiceTiers.useQuery();

  // ── Return address (customer's delivery address) ──
  const { data: savedAddresses } = trpc.grading.getMyShippingAddresses.useQuery();
  const [returnAddressMode, setReturnAddressMode] = useState<'saved' | 'manual'>('saved');
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<number | null>(null);
  const [manualReturnAddress, setManualReturnAddress] = useState({
    recipientName: '',
    phone: '',
    address: '',
    district: '',
    region: '香港',
  });
  // SF station mode for manual input
  const [manualInputType, setManualInputType] = useState<'normal' | 'sf_station'>('normal');
  const [sfStationSearch, setSfStationSearch] = useState('');
  const [selectedSfStation, setSelectedSfStation] = useState<{ code: string; name: string; district: string; address: string; region: string } | null>(null);
  const [saveToProfile, setSaveToProfile] = useState(false);

  // Auto-select first saved address when loaded
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && selectedSavedAddressId === null) {
      setSelectedSavedAddressId(savedAddresses[0].id);
    }
    if (savedAddresses && savedAddresses.length === 0) {
      setReturnAddressMode('manual');
    }
  }, [savedAddresses]);

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

  const utils = trpc.useUtils();
  const checkoutMutation = trpc.grading.submitApplication.useMutation({
    onSuccess: (data: any) => {
      clearDraft(userId);
      // Invalidate grading list so GradingOrders page shows the new submission immediately
      utils.grading.getMySubmissions.invalidate();
      setSubmittedData({
        submissionId: data.submissionId,
        orderNo: data.orderNo,
        totalFee: pendingSubmitRef.current?.totalFee ?? 0,
        cardCount: pendingSubmitRef.current?.cardCount ?? 0,
      });
      pendingSubmitRef.current = null;
      setStep(4);
    },
    onError: (err: any) => {
      toast.error(`提交失敗：${err.message}`);
    },
  });

   const submitMutation = checkoutMutation;

  // ── Save address to profile ──
  const addShippingAddressMutation = trpc.marketplace.addShippingAddress.useMutation({
    onSuccess: () => {
      toast.success("地址已儲存到個人中心");
    },
    onError: () => { /* silent fail */ },
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
    // Build returnAddress
    let returnAddress: { recipientName: string; phone: string; address: string; district?: string; region: string } | undefined;
    if (returnAddressMode === 'saved' && selectedSavedAddressId && savedAddresses) {
      const saved = savedAddresses.find((a: any) => a.id === selectedSavedAddressId);
      if (saved) {
        returnAddress = {
          recipientName: saved.recipientName || '',
          phone: saved.phone || '',
          address: saved.address || '',
          district: saved.district || '',
          region: saved.region || '香港',
          ...(saved.addressType === 'sf_station' && saved.sfStationCode ? {
            sfStationCode: saved.sfStationCode,
            sfStationName: saved.sfStationName || '',
          } : {}),
        } as any;
      }
    } else if (returnAddressMode === 'manual') {
      if (!manualReturnAddress.recipientName.trim() || !manualReturnAddress.phone.trim()) {
        toast.error("請填寫收件人姓名和電話");
        return;
      }
      if (manualInputType === 'sf_station') {
        if (!selectedSfStation) {
          toast.error("請選擇順豐自提站");
          return;
        }
        returnAddress = {
          recipientName: manualReturnAddress.recipientName.trim(),
          phone: manualReturnAddress.phone.trim(),
          address: selectedSfStation.address,
          district: selectedSfStation.district,
          region: selectedSfStation.region,
          sfStationCode: selectedSfStation.code,
          sfStationName: selectedSfStation.name,
        } as any;
        // Save to profile if requested
        if (saveToProfile) {
          addShippingAddressMutation.mutate({
            addressType: 'sf_station',
            recipientName: manualReturnAddress.recipientName.trim(),
            phone: manualReturnAddress.phone.trim(),
            address: selectedSfStation.address,
            district: selectedSfStation.district,
            region: selectedSfStation.region,
            sfStationCode: selectedSfStation.code,
            sfStationName: selectedSfStation.name,
          });
        }
      } else {
        if (!manualReturnAddress.address.trim()) {
          toast.error("請填寫詳細地址");
          return;
        }
        returnAddress = {
          recipientName: manualReturnAddress.recipientName.trim(),
          phone: manualReturnAddress.phone.trim(),
          address: manualReturnAddress.address.trim(),
          district: manualReturnAddress.district.trim() || undefined,
          region: manualReturnAddress.region || '香港',
        };
        // Save to profile if requested
        if (saveToProfile) {
          addShippingAddressMutation.mutate({
            addressType: 'normal',
            recipientName: manualReturnAddress.recipientName.trim(),
            phone: manualReturnAddress.phone.trim(),
            address: manualReturnAddress.address.trim(),
            district: manualReturnAddress.district.trim() || undefined,
            region: manualReturnAddress.region || '香港',
          });
        }
      }
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
    // Store fee/count before mutation (for step 4 confirmation page)
    const qty = items.reduce((sum, i) => sum + ((i as any).quantity ?? 1), 0);
    const tier = tiers?.find((t: any) => t.id === selectedTierId);
    pendingSubmitRef.current = {
      totalFee: tier ? parseFloat(tier.feeHkd) * qty : 0,
      cardCount: qty,
    };
    checkoutMutation.mutate({
      items: expandedItems,
      agreedToTerms: true,
      returnAddress,
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
              // First 3 card thumbnails for preview
              const draftCardsWithImages = (draft?.items ?? []).filter((i: any) => i.card?.imageUrl);
              const previewThumbs = draftCardsWithImages.slice(0, 3).map((i: any) => ({
                url: i.card.imageUrl as string,
                name: i.card.name as string,
              }));
              const extraCardCount = Math.max(0, draftCardsWithImages.length - 3);
              const firstCardName = draftCardsWithImages[0]?.card?.name ?? (draft?.items?.[0]?.manualCardName || null);
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
                    {/* Card thumbnails preview - up to 3 stacked */}
                    {previewThumbs.length > 0 ? (
                      <div className="flex-shrink-0 relative" style={{ width: previewThumbs.length === 1 ? 40 : previewThumbs.length === 2 ? 52 : 60, height: 56 }}>
                        {previewThumbs.map((thumb, idx) => (
                          <div
                            key={idx}
                            className="absolute rounded overflow-hidden border border-blue-200 bg-white shadow-sm"
                            style={{
                              width: 40,
                              height: 56,
                              left: idx * 10,
                              zIndex: previewThumbs.length - idx,
                              top: 0,
                            }}
                          >
                            <img src={thumb.url} alt={thumb.name} className="w-full h-full object-contain" />
                            {/* +N badge on last visible thumb */}
                            {idx === 2 && extraCardCount > 0 && (
                              <div className="absolute bottom-0 right-0 bg-[#06038d] text-white text-[9px] font-bold px-1 py-0.5 rounded-tl leading-none">
                                +{extraCardCount}
                              </div>
                            )}
                          </div>
                        ))}
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

            {/* Tier Comparison Table */}
            {tiers && tiers.length > 0 && (
              <TierComparisonTable tiers={tiers} />
            )}
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

            {/* Return Address (customer's delivery address) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-[#06038d] text-white px-5 py-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-bold">客戶收貨地址</span>
                <span className="text-blue-200 text-xs ml-1 hidden sm:inline">（鑑定完成後回寄）</span>
                <span className="ml-auto flex items-center gap-1 text-xs bg-orange-400 text-white font-bold px-2 py-0.5 rounded-full">
                  <Truck className="h-3 w-3" />順豐到付
                </span>
              </div>

              {/* SF Express freight-collect notice */}
              <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">
                  <span className="font-bold">順豐到付：</span>所有回寄貨物均以順豐到付方式寄出，達付時預計進行收貨。如選擇順豐自提站，請確保站點已開放接件。
                </p>
              </div>

              <div className="p-4">
                {/* No saved address — prominent prompt */}
                {savedAddresses && savedAddresses.length === 0 && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-bold mb-0.5">您尚未儲存任何收貨地址</p>
                      <p>請在下方填寫收貨地址，或先前往
                        <a href="/profile" target="_blank" className="underline font-semibold mx-1 inline-flex items-center gap-0.5">個人中心<ExternalLink className="h-3 w-3" /></a>
                        儲存常用地址。
                      </p>
                    </div>
                  </div>
                )}

                {/* Mode toggle — only show if have saved addresses */}
                {savedAddresses && savedAddresses.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setReturnAddressMode('saved')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                        returnAddressMode === 'saved'
                          ? 'border-[#06038d] bg-[#06038d]/5 text-[#06038d]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Home className="h-4 w-4" />
                      已儲存地址
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnAddressMode('manual')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                        returnAddressMode === 'manual'
                          ? 'border-[#06038d] bg-[#06038d]/5 text-[#06038d]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <PlusCircle className="h-4 w-4" />
                      輸入新地址
                    </button>
                  </div>
                )}

                {/* Saved addresses list */}
                {returnAddressMode === 'saved' && savedAddresses && savedAddresses.length > 0 && (
                  <div className="space-y-2">
                    {savedAddresses.map((addr: any) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedSavedAddressId === addr.id
                            ? 'border-[#06038d] bg-[#06038d]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="savedAddress"
                          checked={selectedSavedAddressId === addr.id}
                          onChange={() => setSelectedSavedAddressId(addr.id)}
                          className="mt-1 accent-[#06038d]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">{addr.recipientName}</span>
                            <span className="text-sm text-gray-500">{addr.phone}</span>
                            {addr.isDefault && (
                              <span className="text-xs bg-[#06038d] text-white px-1.5 py-0.5 rounded">預設</span>
                            )}
                            {addr.addressType === 'sf_station' && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">順豐站</span>
                            )}
                          </div>
                          {addr.addressType === 'sf_station' && addr.sfStationName ? (
                            <p className="text-xs text-gray-600 mt-0.5 truncate">順豐站 {addr.sfStationCode} · {addr.sfStationName}</p>
                          ) : (
                            <p className="text-xs text-gray-600 mt-0.5 truncate">
                              {[addr.district, addr.region, addr.address].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => setReturnAddressMode('manual')}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-[#06038d] hover:underline"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      使用其他地址
                    </button>
                  </div>
                )}

                {/* Manual input */}
                {(returnAddressMode === 'manual' || !savedAddresses || savedAddresses.length === 0) && (
                  <div className="space-y-3">
                    {/* Recipient name + phone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">收件人姓名 <span className="text-red-500">*</span></label>
                        <Input
                          value={manualReturnAddress.recipientName}
                          onChange={(e) => setManualReturnAddress(prev => ({ ...prev, recipientName: e.target.value }))}
                          placeholder="例：陳大文"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">聯絡電話 <span className="text-red-500">*</span></label>
                        <Input
                          value={manualReturnAddress.phone}
                          onChange={(e) => setManualReturnAddress(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="例：9123 4567"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Address type toggle */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setManualInputType('normal'); setSelectedSfStation(null); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all ${
                          manualInputType === 'normal'
                            ? 'border-[#06038d] bg-[#06038d]/5 text-[#06038d]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5" />一般地址
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualInputType('sf_station')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all ${
                          manualInputType === 'sf_station'
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Truck className="h-3.5 w-3.5" />順豐自提站
                      </button>
                    </div>

                    {/* Normal address fields */}
                    {manualInputType === 'normal' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">詳細地址 <span className="text-red-500">*</span></label>
                          <Input
                            value={manualReturnAddress.address}
                            onChange={(e) => setManualReturnAddress(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="例：九龍旺角彌敦道 123 號 XX 大廈 5 樓 A 室"
                            className="text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">地區</label>
                            <Input
                              value={manualReturnAddress.district}
                              onChange={(e) => setManualReturnAddress(prev => ({ ...prev, district: e.target.value }))}
                              placeholder="例：旺角"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">城市</label>
                            <Input
                              value={manualReturnAddress.region}
                              onChange={(e) => setManualReturnAddress(prev => ({ ...prev, region: e.target.value }))}
                              placeholder="香港"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* SF Station picker */}
                    {manualInputType === 'sf_station' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-700">搜尋順豐自提站 <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={sfStationSearch}
                            onChange={(e) => { setSfStationSearch(e.target.value); setSelectedSfStation(null); }}
                            placeholder="輸入站點名稱或地區，如：旺角、屬山、852FTL"
                            className="pl-9 text-sm"
                          />
                        </div>
                        {selectedSfStation ? (
                          <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <Truck className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{selectedSfStation.name}</p>
                              <p className="text-xs text-gray-500 truncate">{selectedSfStation.address}</p>
                              <p className="text-xs text-orange-600 font-mono">{selectedSfStation.code}</p>
                            </div>
                            <button type="button" onClick={() => { setSelectedSfStation(null); setSfStationSearch(''); }} className="text-gray-400 hover:text-gray-600">
                              <span className="text-lg leading-none">×</span>
                            </button>
                          </div>
                        ) : sfStationSearch.length >= 1 ? (
                          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                            {(() => {
                              const q = sfStationSearch.toLowerCase();
                              const allStations = [...SF_STATIONS, ...SF_LOCKERS];
                              const filtered = allStations.filter(s =>
                                s.name.toLowerCase().includes(q) ||
                                s.district.toLowerCase().includes(q) ||
                                s.code.toLowerCase().includes(q) ||
                                s.address.toLowerCase().includes(q)
                              ).slice(0, 20);
                              if (filtered.length === 0) return (
                                <p className="text-xs text-gray-500 text-center py-4">找不到符合的站點</p>
                              );
                              return filtered.map(s => (
                                <button
                                  key={s.code}
                                  type="button"
                                  onClick={() => { setSelectedSfStation(s); setSfStationSearch(s.name); }}
                                  className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-orange-50 text-left border-b border-gray-100 last:border-0"
                                >
                                  <Truck className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{s.address}</p>
                                    <span className="text-xs text-orange-600 font-mono">{s.code}</span>
                                  </div>
                                </button>
                              ));
                            })()}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Save to profile checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                      <input
                        type="checkbox"
                        checked={saveToProfile}
                        onChange={(e) => setSaveToProfile(e.target.checked)}
                        className="accent-[#06038d] w-4 h-4"
                      />
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Save className="h-3.5 w-3.5" />
                        儲存此地址到個人中心，方便下次使用
                      </span>
                    </label>

                    {savedAddresses && savedAddresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setReturnAddressMode('saved')}
                        className="text-xs text-[#06038d] hover:underline"
                      >
                        ← 返回選擇已儲存地址
                      </button>
                    )}
                  </div>
                )}
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
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    minWidth: '16px',
                    minHeight: '16px',
                    flexShrink: 0,
                    accentColor: '#06038d',
                    cursor: 'pointer',
                  }}
                />
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
        {/* ── Step 4: Submission Confirmed ── */}
        {step === 4 && submittedData && (
          <div className="space-y-5">
            {/* Success header */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-green-800 mb-1">申請已成功提交！</h2>
              <p className="text-sm text-green-700 font-mono font-semibold">{submittedData.orderNo}</p>
            </div>
            {/* Payment CTA — high priority */}
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800 text-sm">請立即完成付款，否則申請將無法進入處理流程</p>
                  <p className="text-xs text-amber-700 mt-1">
                    共 {submittedData.cardCount} 張卡牌 · 費用合計 <span className="font-bold text-[#06038d]">HK${submittedData.totalFee.toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/grading/orders/${submittedData.submissionId}`)}
                className="w-full bg-[#06038d] hover:bg-[#06038d]/90 text-white font-bold text-base py-3 h-auto"
              >
                <DollarSign className="mr-2 h-5 w-5" />
                前往申請詳情頁完成付款
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            {/* Next steps */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="font-semibold text-gray-800 text-sm">付款後的下一步</p>
              {[
                { icon: Package, text: "付款確認後，系統將自動發送確認通知（站內訊息 + Email），包含 BOXIUM 送件地址" },
                { icon: FileText, text: "請打印申請單，連同卡牌自費寄至 BOXIUM 指定地址（順豐站 852Z351）" },
                { icon: CheckCircle2, text: "BOXIUM 確認收件後，代辦 PSA 申報及專業包裝，每月 2 次出團直送美國 PSA" },
              ].map(({ icon: Icon, text }, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#06038d]/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-[#06038d]" />
                  </div>
                  <p className="text-xs text-gray-600">{text}</p>
                </div>
              ))}
            </div>
            {/* View orders link */}
            <div className="text-center">
              <button
                onClick={() => navigate("/grading/orders")}
                className="text-sm text-[#06038d] underline underline-offset-2"
              >
                查看所有申請記錄
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
