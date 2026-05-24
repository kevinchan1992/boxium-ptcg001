/**
 * TradeSheet — Card-for-Card Trade Recording UI
 *
 * Flow:
 * 1. User clicks "以卡換卡" button in collection
 * 2. Sheet opens with two sections: "換出" (cards given) and "換入" (cards received)
 * 3. For "換出" cards: user can pick from existing collection OR search manually
 * 4. For "換入" cards: user searches for the new card received
 * 5. On submit: creates trade record + auto-adds "換入" cards to collection
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight, Plus, Trash2, ChevronDown, ChevronUp,
  Loader2, Search, Package, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle, X,
} from "lucide-react";
import { getProxiedImageUrl } from "@/lib/utils";

const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";

// ─── Types ────────────────────────────────────────────────────
interface TradeCardItem {
  id: string; // local temp ID
  direction: "in" | "out";
  // Card info
  cardId: number;
  cardName: string;
  cardImageUrl?: string | null;
  cardSeries?: string | null;
  grader: string;
  grade: string;
  quantity: number;
  estimatedValue: string; // HKD string
  // For 'out' items from existing collection
  collectionId?: number | null;
  collectionMarketPrice?: number | null; // auto-filled from collection
}

interface TradeSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  // Pre-select a collection item as "换出" (when triggered from a card's action menu)
  preselectedOutItem?: {
    id: number;
    cardId: number;
    cardName: string;
    cardImageUrl?: string | null;
    cardSeries?: string | null;
    grader: string;
    grade: string | null;
    quantity: number;
    marketPrice?: number | null;
  } | null;
}

// ─── Grade Badge ──────────────────────────────────────────────
function GradeBadge({ grader, grade }: { grader: string; grade?: string | null }) {
  const label = grader === "RAW" || grader === "UNGRADED" ? grader : `${grader} ${grade ?? ""}`.trim();
  const color = grader === "PSA" ? "#e63946" : grader === "BGS" ? "#2563eb" : grader === "TAG" ? "#7c3aed" : "#6b7280";
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide"
      style={{ background: `${color}18`, color }}>
      {label}
    </span>
  );
}

// ─── Single trade card row ────────────────────────────────────
function TradeCardRow({
  item,
  onRemove,
  onUpdate,
}: {
  item: TradeCardItem;
  onRemove: () => void;
  onUpdate: (updates: Partial<TradeCardItem>) => void;
}) {
  const isOut = item.direction === "out";
  const accentColor = isOut ? "#dc2626" : GAIN_GREEN;

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-xl"
      style={{ background: isOut ? "#fee2e222" : "#dcfce722", border: `1px solid ${accentColor}30` }}>
      {/* Card image */}
      <div className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
        {item.cardImageUrl ? (
          <img src={getProxiedImageUrl(item.cardImageUrl) ?? ""} alt={item.cardName}
            className="w-full h-full object-contain" />
        ) : (
          <Package className="w-5 h-5 text-gray-300" />
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-gray-900 leading-tight truncate">{item.cardName}</p>
        {item.cardSeries && <p className="text-[10px] text-gray-400 truncate">{item.cardSeries}</p>}
        <div className="flex items-center gap-1 mt-1">
          <GradeBadge grader={item.grader} grade={item.grade} />
          {item.quantity > 1 && (
            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-500">×{item.quantity}</span>
          )}
        </div>
        {/* Estimated value input */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 whitespace-nowrap">估值 HKD</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.estimatedValue}
            onChange={(e) => onUpdate({ estimatedValue: e.target.value })}
            className="w-20 h-6 text-xs px-1.5 rounded border border-gray-200 font-bold tabular-nums"
            style={{ color: accentColor }}
            placeholder="0.00"
          />
        </div>
      </div>
      {/* Remove */}
      <button onClick={onRemove}
        className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-50 flex-shrink-0 mt-0.5"
        style={{ color: "#d1d5db" }}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function TradeSheet({ open, onOpenChange, onSuccess, preselectedOutItem }: TradeSheetProps) {
  const utils = trpc.useUtils();

  // Form state
  const [tradedAt, setTradedAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [tradePartner, setTradePartner] = useState("");
  const [cashAdjustment, setCashAdjustment] = useState(""); // positive = received, negative = paid
  const [notes, setNotes] = useState("");
  const [tradeCards, setTradeCards] = useState<TradeCardItem[]>([]);

  // Card picker state
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [pickerDirection, setPickerDirection] = useState<"in" | "out">("out");

  // Collection picker state (for 'out' cards from existing collection)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  // Grade form for newly picked card
  const [pendingCard, setPendingCard] = useState<SelectedCard | null>(null);
  const [pendingDirection, setPendingDirection] = useState<"in" | "out">("out");
  const [pendingGrader, setPendingGrader] = useState("PSA");
  const [pendingGrade, setPendingGrade] = useState("10");
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingValue, setPendingValue] = useState("");

  // Fetch user's collection for 'out' picker
  const { data: collectionData } = trpc.profile.getCollection.useQuery(
    { limit: 100, page: 1 },
    { enabled: open }
  );
  const collectionItems = collectionData?.items ?? [];

  const createTradeMutation = trpc.profile.createTrade.useMutation({
    onSuccess: () => {
      toast.success("交換記錄已儲存，換入卡牌已加入收藏！");
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
      utils.profile.getTrades.invalidate();
      resetForm();
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error(`儲存失敗：${e.message}`),
  });

  const resetForm = useCallback(() => {
    setTradedAt(new Date().toISOString().split("T")[0]);
    setTradePartner("");
    setCashAdjustment("");
    setNotes("");
    setTradeCards([]);
    setPendingCard(null);
  }, []);

  // Initialize with preselected item
  const initFromPreselected = useCallback(() => {
    if (preselectedOutItem) {
      setTradeCards([{
        id: `pre-${preselectedOutItem.id}`,
        direction: "out",
        cardId: preselectedOutItem.cardId,
        cardName: preselectedOutItem.cardName,
        cardImageUrl: preselectedOutItem.cardImageUrl,
        cardSeries: preselectedOutItem.cardSeries,
        grader: preselectedOutItem.grader,
        grade: preselectedOutItem.grade ?? "",
        quantity: preselectedOutItem.quantity,
        estimatedValue: preselectedOutItem.marketPrice != null ? String(preselectedOutItem.marketPrice) : "",
        collectionId: preselectedOutItem.id,
        collectionMarketPrice: preselectedOutItem.marketPrice,
      }]);
    }
  }, [preselectedOutItem]);

  // Handle sheet open
  const handleOpenChange = (v: boolean) => {
    if (v) {
      resetForm();
      initFromPreselected();
    }
    onOpenChange(v);
  };

  // Add card from card picker
  const handleCardPicked = (card: SelectedCard) => {
    setPendingCard(card);
    setPendingDirection(pickerDirection);
    setPendingGrader("PSA");
    setPendingGrade("10");
    setPendingQty("1");
    setPendingValue("");
    setShowCardPicker(false);
  };

  // Confirm pending card with grade details
  const confirmPendingCard = () => {
    if (!pendingCard) return;
    const newItem: TradeCardItem = {
      id: `${Date.now()}-${Math.random()}`,
      direction: pendingDirection,
      cardId: pendingCard.id,
      cardName: pendingCard.name,
      cardImageUrl: pendingCard.imageUrl,
      cardSeries: pendingCard.series,
      grader: pendingGrader,
      grade: pendingGrade,
      quantity: parseInt(pendingQty) || 1,
      estimatedValue: pendingValue,
      collectionId: null,
    };
    setTradeCards((prev) => [...prev, newItem]);
    setPendingCard(null);
  };

  // Add from existing collection
  const handleAddFromCollection = (colItem: any) => {
    // Check not already added
    if (tradeCards.some((c) => c.collectionId === colItem.id)) {
      toast.error("此卡牌已加入換出清單");
      return;
    }
    const newItem: TradeCardItem = {
      id: `col-${colItem.id}`,
      direction: "out",
      cardId: colItem.cardId,
      cardName: colItem.card?.name ?? "Unknown",
      cardImageUrl: colItem.card?.imageUrl,
      cardSeries: colItem.card?.series,
      grader: colItem.grader,
      grade: colItem.grade ?? "",
      quantity: colItem.quantity,
      estimatedValue: colItem.marketPrice != null ? String(colItem.marketPrice) : "",
      collectionId: colItem.id,
      collectionMarketPrice: colItem.marketPrice,
    };
    setTradeCards((prev) => [...prev, newItem]);
    setShowCollectionPicker(false);
  };

  const removeCard = (id: string) => setTradeCards((prev) => prev.filter((c) => c.id !== id));
  const updateCard = (id: string, updates: Partial<TradeCardItem>) =>
    setTradeCards((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));

  const outCards = tradeCards.filter((c) => c.direction === "out");
  const inCards = tradeCards.filter((c) => c.direction === "in");

  const totalOutValue = outCards.reduce((s, c) => s + (parseFloat(c.estimatedValue) || 0) * c.quantity, 0);
  const totalInValue = inCards.reduce((s, c) => s + (parseFloat(c.estimatedValue) || 0) * c.quantity, 0);
  const cashAdj = parseFloat(cashAdjustment) || 0;
  const netDiff = totalInValue - totalOutValue + cashAdj;

  const canSubmit = outCards.length > 0 && inCards.length > 0 && !createTradeMutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createTradeMutation.mutate({
      tradedAt: new Date(tradedAt),
      tradePartner: tradePartner || null,
      cashAdjustment: cashAdj || null,
      notes: notes || null,
      items: tradeCards.map((c) => ({
        direction: c.direction,
        cardId: c.cardId,
        cardName: c.cardName,
        grader: c.grader,
        grade: c.grade || null,
        quantity: c.quantity,
        estimatedValue: parseFloat(c.estimatedValue) || null,
        collectionId: c.collectionId ?? null,
      })),
    });
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: `${BRAND_BLUE}15` }}>
              <ArrowLeftRight className="w-4 h-4" style={{ color: BRAND_BLUE }} />
            </div>
            <span className="font-black text-gray-900">以卡換卡記錄</span>
          </div>
        }
        showCloseButton
      >
        <div className="px-4 pb-8 space-y-5">
          {/* ── Trade date & partner ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                交換日期
              </Label>
              <Input
                type="date"
                value={tradedAt}
                onChange={(e) => setTradedAt(e.target.value)}
                className="h-9 text-sm border-gray-200"
              />
            </div>
            <div>
              <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                交換對象（選填）
              </Label>
              <Input
                value={tradePartner}
                onChange={(e) => setTradePartner(e.target.value)}
                placeholder="對方名稱"
                className="h-9 text-sm border-gray-200"
              />
            </div>
          </div>

          {/* ── OUT cards section ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-red-100">
                  <ArrowRight className="w-3 h-3 text-red-500" />
                </div>
                <span className="text-sm font-black text-gray-900">換出卡牌</span>
                {outCards.length > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                    {outCards.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Pick from collection */}
                <button
                  onClick={() => setShowCollectionPicker(true)}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{ background: `${BRAND_BLUE}12`, color: BRAND_BLUE, border: `1px solid ${BRAND_BLUE}25` }}
                >
                  <Package className="w-3 h-3" />從收藏選
                </button>
                {/* Search card manually */}
                <button
                  onClick={() => { setPickerDirection("out"); setShowCardPicker(true); }}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}
                >
                  <Search className="w-3 h-3" />搜尋
                </button>
              </div>
            </div>
            {outCards.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200">
                <Package className="w-4 h-4 text-gray-300" />
                <span className="text-xs text-gray-400">點擊「從收藏選」或「搜尋」加入換出卡牌</span>
              </div>
            ) : (
              <div className="space-y-2">
                {outCards.map((c) => (
                  <TradeCardRow key={c.id} item={c}
                    onRemove={() => removeCard(c.id)}
                    onUpdate={(u) => updateCard(c.id, u)} />
                ))}
                <div className="flex justify-end">
                  <span className="text-xs font-bold text-red-500">
                    換出總估值：{formatCurrency(totalOutValue)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Value summary ── */}
          {(outCards.length > 0 || inCards.length > 0) && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl"
              style={{ background: `${BRAND_BLUE}08`, border: `1px solid ${BRAND_BLUE}15` }}>
              <ArrowLeftRight className="w-4 h-4 flex-shrink-0" style={{ color: BRAND_BLUE }} />
              <div className="flex-1 text-xs font-bold" style={{ color: BRAND_BLUE }}>
                <span className="text-red-500">{formatCurrency(totalOutValue)}</span>
                <span className="mx-1.5 text-gray-400">→</span>
                <span className="text-green-600">{formatCurrency(totalInValue)}</span>
                {cashAdj !== 0 && (
                  <span className="ml-1.5 text-gray-500">
                    {cashAdj > 0 ? `(+${formatCurrency(cashAdj)} 補差)` : `(${formatCurrency(cashAdj)} 補差)`}
                  </span>
                )}
              </div>
              <span className={`text-xs font-black ${netDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                {netDiff >= 0 ? "+" : ""}{formatCurrency(netDiff)}
              </span>
            </div>
          )}

          {/* ── IN cards section ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-green-100">
                  <ArrowLeft className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-sm font-black text-gray-900">換入卡牌</span>
                {inCards.length > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                    {inCards.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setPickerDirection("in"); setShowCardPicker(true); }}
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac" }}
              >
                <Search className="w-3 h-3" />搜尋換入卡
              </button>
            </div>
            {inCards.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200">
                <Package className="w-4 h-4 text-gray-300" />
                <span className="text-xs text-gray-400">搜尋並加入換入的新卡牌（將自動加入收藏）</span>
              </div>
            ) : (
              <div className="space-y-2">
                {inCards.map((c) => (
                  <TradeCardRow key={c.id} item={c}
                    onRemove={() => removeCard(c.id)}
                    onUpdate={(u) => updateCard(c.id, u)} />
                ))}
                <div className="flex justify-end">
                  <span className="text-xs font-bold text-green-600">
                    換入總估值：{formatCurrency(totalInValue)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Cash adjustment ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                補差金額（選填）
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">HKD</span>
                <Input
                  type="number"
                  step="0.01"
                  value={cashAdjustment}
                  onChange={(e) => setCashAdjustment(e.target.value)}
                  placeholder="正數=收到 負數=付出"
                  className="h-9 text-sm border-gray-200 pl-10"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">正數 = 對方補差給你，負數 = 你補差給對方</p>
            </div>
            <div>
              <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                備註（選填）
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="交換地點、備忘..."
                className="h-9 text-sm border-gray-200 resize-none"
                rows={1}
              />
            </div>
          </div>

          {/* ── Submit ── */}
          <div className="pt-1">
            {!canSubmit && (outCards.length === 0 || inCards.length === 0) && (
              <p className="text-xs text-center text-gray-400 mb-3">
                請加入至少一張換出卡牌和一張換入卡牌
              </p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-12 text-sm font-black rounded-xl border-0"
              style={{
                background: canSubmit ? `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a18b0 100%)` : "#e5e7eb",
                color: canSubmit ? "white" : "#9ca3af",
              }}
            >
              {createTradeMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />儲存中...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" />確認記錄交換</>
              )}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* ── Card Picker (search) ── */}
      <CardPickerDialog
        open={showCardPicker}
        onOpenChange={setShowCardPicker}
        onSelect={handleCardPicked}
      />

      {/* ── Grade form for pending card ── */}
      {pendingCard && (
        <BottomSheet
          open={!!pendingCard}
          onOpenChange={(v) => { if (!v) setPendingCard(null); }}
          title={
            <span className="font-black text-gray-900">
              {pendingDirection === "out" ? "設定換出卡牌資料" : "設定換入卡牌資料"}
            </span>
          }
          showCloseButton
        >
          <div className="px-4 pb-8 space-y-4">
            {/* Card preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              {pendingCard.imageUrl && (
                <img src={getProxiedImageUrl(pendingCard.imageUrl) ?? ""} alt={pendingCard.name}
                  className="w-12 h-16 object-contain rounded-lg" />
              )}
              <div className="min-w-0">
                <p className="font-black text-sm text-gray-900 truncate">{pendingCard.name}</p>
                {pendingCard.series && <p className="text-xs text-gray-400 truncate">{pendingCard.series}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>評級機構</Label>
                <Select value={pendingGrader} onValueChange={setPendingGrader}>
                  <SelectTrigger className="h-9 text-sm border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PSA">PSA</SelectItem>
                    <SelectItem value="BGS">BGS</SelectItem>
                    <SelectItem value="TAG">TAG</SelectItem>
                    <SelectItem value="RAW">RAW（未評級）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pendingGrader !== "RAW" && (
                <div>
                  <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>評級</Label>
                  <Input value={pendingGrade} onChange={(e) => setPendingGrade(e.target.value)}
                    placeholder="10" className="h-9 text-sm border-gray-200" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>數量</Label>
                <Input type="number" min="1" max="999" value={pendingQty}
                  onChange={(e) => setPendingQty(e.target.value)}
                  className="h-9 text-sm border-gray-200" />
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>估值 HKD</Label>
                <Input type="number" min="0" step="0.01" value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  placeholder="0.00" className="h-9 text-sm border-gray-200" />
              </div>
            </div>

            <Button
              onClick={confirmPendingCard}
              className="w-full h-11 text-sm font-black rounded-xl border-0"
              style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a18b0 100%)`, color: "white" }}
            >
              <Plus className="w-4 h-4 mr-2" />加入{pendingDirection === "out" ? "換出" : "換入"}清單
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* ── Collection picker (for 'out' cards) ── */}
      {showCollectionPicker && (
        <BottomSheet
          open={showCollectionPicker}
          onOpenChange={setShowCollectionPicker}
          title={<span className="font-black text-gray-900">從收藏選擇換出卡牌</span>}
          showCloseButton
        >
          <div className="px-4 pb-8">
            {collectionItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">收藏清單為空</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {collectionItems.map((colItem: any) => {
                  const alreadyAdded = tradeCards.some((c) => c.collectionId === colItem.id);
                  return (
                    <button
                      key={colItem.id}
                      onClick={() => !alreadyAdded && handleAddFromCollection(colItem)}
                      disabled={alreadyAdded}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: alreadyAdded ? "#f3f4f6" : "white",
                        border: alreadyAdded ? "1px solid #e5e7eb" : `1px solid ${BRAND_BLUE}20`,
                        opacity: alreadyAdded ? 0.5 : 1,
                      }}
                    >
                      {colItem.card?.imageUrl ? (
                        <img src={getProxiedImageUrl(colItem.card.imageUrl) ?? ""} alt={colItem.card?.name}
                          className="w-10 h-14 object-contain rounded flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-900 truncate">{colItem.card?.name}</p>
                        {colItem.card?.series && <p className="text-[10px] text-gray-400 truncate">{colItem.card.series}</p>}
                        <div className="flex items-center gap-1.5 mt-1">
                          <GradeBadge grader={colItem.grader} grade={colItem.grade} />
                          {colItem.marketPrice && (
                            <span className="text-[10px] font-bold text-gray-500">{formatCurrency(colItem.marketPrice)}</span>
                          )}
                        </div>
                      </div>
                      {alreadyAdded && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
