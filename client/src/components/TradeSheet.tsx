/**
 * TradeSheet — Card-for-Card Trade Recording UI
 * Light mode, Boxium blue (#06038D) + yellow (#FEDD00) brand style
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ArrowLeftRight, Plus, Search, Package,
  ArrowRight, ArrowLeft, CheckCircle2, X, Loader2,
} from "lucide-react";
import { getProxiedImageUrl } from "@/lib/utils";

const BRAND_BLUE = "#06038D";
const BRAND_YELLOW = "#FEDD00";

// ─── Types ────────────────────────────────────────────────────
interface TradeCardItem {
  id: string;
  direction: "in" | "out";
  cardId: number;
  cardName: string;
  cardImageUrl?: string | null;
  cardSeries?: string | null;
  grader: string;
  grade: string;
  quantity: number;
  estimatedValue: string;
  collectionId?: number | null;
  collectionMarketPrice?: number | null;
}

interface TradeSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
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
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide"
      style={{ background: `${color}18`, color }}
    >
      {label}
    </span>
  );
}

// ─── Section Header ───────────────────────────────────────────
function SectionHeader({
  icon,
  label,
  count,
  isOut,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  isOut: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `2px solid ${isOut ? "#e5e7eb" : BRAND_BLUE}` }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ background: isOut ? "#f9fafb" : BRAND_BLUE }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: isOut ? "#e5e7eb" : `${BRAND_YELLOW}30` }}
          >
            {icon}
          </div>
          <span
            className="text-sm font-black"
            style={{ color: isOut ? "#111827" : "white" }}
          >
            {label}
          </span>
          {count > 0 && (
            <span
              className="text-xs font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
              style={{
                background: isOut ? "#e5e7eb" : BRAND_YELLOW,
                color: isOut ? "#374151" : BRAND_BLUE,
              }}
            >
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">{children}</div>
      </div>
    </div>
  );
}

// ─── Trade Card Row ───────────────────────────────────────────
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

  return (
    <div
      className="flex items-start gap-3 p-3 bg-white"
      style={{ borderTop: "1px solid #f3f4f6" }}
    >
      {/* Card image */}
      <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
        {item.cardImageUrl ? (
          <img
            src={getProxiedImageUrl(item.cardImageUrl) ?? ""}
            alt={item.cardName}
            className="w-full h-full object-contain"
          />
        ) : (
          <Package className="w-4 h-4 text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-gray-900 leading-tight line-clamp-2">{item.cardName}</p>
        {item.cardSeries && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.cardSeries}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <GradeBadge grader={item.grader} grade={item.grade} />
          {item.quantity > 1 && (
            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-500">
              ×{item.quantity}
            </span>
          )}
        </div>
        {/* Estimated value */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] text-gray-400 whitespace-nowrap">估值 HKD</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.estimatedValue}
            onChange={(e) => onUpdate({ estimatedValue: e.target.value })}
            className="w-20 h-6 text-xs px-1.5 rounded-lg font-bold tabular-nums outline-none"
            style={{
              border: `1.5px solid ${isOut ? "#e5e7eb" : `${BRAND_BLUE}40`}`,
              color: isOut ? "#dc2626" : BRAND_BLUE,
              background: "white",
            }}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors hover:bg-red-50"
        style={{ color: "#d1d5db" }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Action Button (in section header) ───────────────────────
function ActionBtn({
  onClick,
  icon,
  label,
  variant = "outline",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "outline" | "yellow" | "white";
}) {
  const styles: Record<string, React.CSSProperties> = {
    outline: { background: "white", color: BRAND_BLUE, border: `1.5px solid ${BRAND_BLUE}40` },
    yellow: { background: BRAND_YELLOW, color: BRAND_BLUE, border: "none" },
    white: { background: "rgba(255,255,255,0.15)", color: "white", border: "1.5px solid rgba(255,255,255,0.3)" },
  };
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-black transition-all active:scale-95"
      style={styles[variant]}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function TradeSheet({ open, onOpenChange, onSuccess, preselectedOutItem }: TradeSheetProps) {
  const utils = trpc.useUtils();

  const [tradedAt, setTradedAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [tradePartner, setTradePartner] = useState("");
  const [cashAdjustment, setCashAdjustment] = useState("");
  const [notes, setNotes] = useState("");
  const [tradeCards, setTradeCards] = useState<TradeCardItem[]>([]);

  const [showCardPicker, setShowCardPicker] = useState(false);
  const [pickerDirection, setPickerDirection] = useState<"in" | "out">("out");
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  const [pendingCard, setPendingCard] = useState<SelectedCard | null>(null);
  const [pendingDirection, setPendingDirection] = useState<"in" | "out">("out");
  const [pendingGrader, setPendingGrader] = useState("PSA");
  const [pendingGrade, setPendingGrade] = useState("10");
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingValue, setPendingValue] = useState("");

  const { data: collectionData } = trpc.profile.getCollection.useQuery(
    { limit: 200, page: 1 },
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

  const handleOpenChange = (v: boolean) => {
    if (v) { resetForm(); initFromPreselected(); }
    onOpenChange(v);
  };

  const handleCardPicked = (card: SelectedCard) => {
    setPendingCard(card);
    setPendingDirection(pickerDirection);
    setPendingGrader("PSA");
    setPendingGrade("10");
    setPendingQty("1");
    setPendingValue("");
    setShowCardPicker(false);
  };

  const confirmPendingCard = () => {
    if (!pendingCard) return;
    setTradeCards((prev) => [...prev, {
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
    }]);
    setPendingCard(null);
  };

  const handleAddFromCollection = (colItem: any) => {
    if (tradeCards.some((c) => c.collectionId === colItem.id)) {
      toast.error("此卡牌已加入換出清單");
      return;
    }
    setTradeCards((prev) => [...prev, {
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
    }]);
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
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: BRAND_YELLOW }}
            >
              <ArrowLeftRight className="w-4 h-4" style={{ color: BRAND_BLUE }} />
            </div>
            <span className="font-black text-gray-900 text-base">以卡換卡記錄</span>
          </div>
        }
        showCloseButton
      >
        <div className="px-4 pb-8 space-y-4" style={{ background: "#f8f9ff" }}>

          {/* ── Date & Partner ── */}
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "white", border: `1.5px solid ${BRAND_BLUE}15` }}
          >
            <div>
              <Label
                className="text-[11px] font-black uppercase tracking-widest mb-1.5 block"
                style={{ color: BRAND_BLUE }}
              >
                交換日期
              </Label>
              <Input
                type="date"
                value={tradedAt}
                onChange={(e) => setTradedAt(e.target.value)}
                className="h-10 text-sm font-bold border-gray-200 rounded-xl bg-gray-50"
              />
            </div>
            <div>
              <Label
                className="text-[11px] font-black uppercase tracking-widest mb-1.5 block"
                style={{ color: BRAND_BLUE }}
              >
                交換對象（選填）
              </Label>
              <Input
                value={tradePartner}
                onChange={(e) => setTradePartner(e.target.value)}
                placeholder="對方名稱或 ID"
                className="h-10 text-sm border-gray-200 rounded-xl bg-gray-50"
              />
            </div>
          </div>

          {/* ── OUT cards section ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1.5px solid #e5e7eb", background: "white" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: "#f9fafb", borderBottom: "1.5px solid #e5e7eb" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5 text-red-500" />
                </div>
                <span className="text-sm font-black text-gray-900">換出卡牌</span>
                {outCards.length > 0 && (
                  <span className="text-xs font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 min-w-[20px] text-center">
                    {outCards.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowCollectionPicker(true)}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-black transition-all active:scale-95"
                  style={{ background: `${BRAND_BLUE}10`, color: BRAND_BLUE, border: `1.5px solid ${BRAND_BLUE}25` }}
                >
                  <Package className="w-3 h-3" />從收藏選
                </button>
                <button
                  onClick={() => { setPickerDirection("out"); setShowCardPicker(true); }}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-black transition-all active:scale-95"
                  style={{ background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5" }}
                >
                  <Search className="w-3 h-3" />搜尋
                </button>
              </div>
            </div>
            {/* Content */}
            {outCards.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 px-4">
                <Package className="w-4 h-4 text-gray-300" />
                <span className="text-xs text-gray-400">點擊「從收藏選」或「搜尋」加入換出卡牌</span>
              </div>
            ) : (
              <>
                {outCards.map((c) => (
                  <TradeCardRow key={c.id} item={c}
                    onRemove={() => removeCard(c.id)}
                    onUpdate={(u) => updateCard(c.id, u)} />
                ))}
                <div
                  className="flex justify-end px-3 py-2"
                  style={{ borderTop: "1px solid #f3f4f6" }}
                >
                  <span className="text-xs font-black text-red-500">
                    換出總估值：{formatCurrency(totalOutValue)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ── Value Summary ── */}
          {(outCards.length > 0 || inCards.length > 0) && (
            <div
              className="flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{ background: BRAND_BLUE }}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-red-300">{formatCurrency(totalOutValue)}</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-white opacity-60" />
                <span className="text-green-300">{formatCurrency(totalInValue)}</span>
                {cashAdj !== 0 && (
                  <span className="text-yellow-200 text-[10px]">
                    {cashAdj > 0 ? `+${formatCurrency(cashAdj)}` : formatCurrency(cashAdj)} 補差
                  </span>
                )}
              </div>
              <span
                className="text-sm font-black px-2.5 py-1 rounded-lg"
                style={{
                  background: BRAND_YELLOW,
                  color: BRAND_BLUE,
                }}
              >
                {netDiff >= 0 ? "+" : ""}{formatCurrency(netDiff)}
              </span>
            </div>
          )}

          {/* ── IN cards section ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `2px solid ${BRAND_BLUE}`, background: "white" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: BRAND_BLUE }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: `${BRAND_YELLOW}30` }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" style={{ color: BRAND_YELLOW }} />
                </div>
                <span className="text-sm font-black text-white">換入卡牌</span>
                {inCards.length > 0 && (
                  <span
                    className="text-xs font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                    style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
                  >
                    {inCards.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setPickerDirection("in"); setShowCardPicker(true); }}
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-black transition-all active:scale-95"
                style={{ background: BRAND_YELLOW, color: BRAND_BLUE, border: "none" }}
              >
                <Search className="w-3 h-3" />搜尋換入卡
              </button>
            </div>
            {/* Content */}
            {inCards.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 px-4">
                <Package className="w-4 h-4 text-gray-300" />
                <span className="text-xs text-gray-400">搜尋並加入換入的新卡牌（將自動加入收藏）</span>
              </div>
            ) : (
              <>
                {inCards.map((c) => (
                  <TradeCardRow key={c.id} item={c}
                    onRemove={() => removeCard(c.id)}
                    onUpdate={(u) => updateCard(c.id, u)} />
                ))}
                <div
                  className="flex justify-end px-3 py-2"
                  style={{ borderTop: "1px solid #f3f4f6" }}
                >
                  <span className="text-xs font-black" style={{ color: BRAND_BLUE }}>
                    換入總估值：{formatCurrency(totalInValue)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ── Cash & Notes ── */}
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "white", border: `1.5px solid ${BRAND_BLUE}15` }}
          >
            <div>
              <Label
                className="text-[11px] font-black uppercase tracking-widest mb-1.5 block"
                style={{ color: BRAND_BLUE }}
              >
                補差金額（選填）
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">HKD</span>
                <Input
                  type="number"
                  step="0.01"
                  value={cashAdjustment}
                  onChange={(e) => setCashAdjustment(e.target.value)}
                  placeholder="正數=收到 負數=付出"
                  className="h-10 text-sm border-gray-200 rounded-xl bg-gray-50 pl-12"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">正數 = 對方補差給你，負數 = 你補差給對方</p>
            </div>
            <div>
              <Label
                className="text-[11px] font-black uppercase tracking-widest mb-1.5 block"
                style={{ color: BRAND_BLUE }}
              >
                備註（選填）
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="交換地點、備忘..."
                className="text-sm border-gray-200 rounded-xl bg-gray-50 resize-none"
                rows={2}
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
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-13 rounded-2xl flex items-center justify-center gap-2 text-sm font-black transition-all active:scale-[0.98]"
              style={{
                background: canSubmit ? BRAND_BLUE : "#e5e7eb",
                color: canSubmit ? "white" : "#9ca3af",
                height: "52px",
                border: "none",
              }}
            >
              {createTradeMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />儲存中...</>
              ) : (
                <>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: canSubmit ? BRAND_YELLOW : "#d1d5db" }}
                  >
                    <CheckCircle2 className="w-3 h-3" style={{ color: canSubmit ? BRAND_BLUE : "#9ca3af" }} />
                  </div>
                  確認記錄交換
                </>
              )}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ── Card Picker ── */}
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
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: pendingDirection === "out" ? "#fee2e2" : `${BRAND_BLUE}15` }}
              >
                {pendingDirection === "out"
                  ? <ArrowRight className="w-3.5 h-3.5 text-red-500" />
                  : <ArrowLeft className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
                }
              </div>
              <span className="font-black text-gray-900">
                {pendingDirection === "out" ? "設定換出卡牌資料" : "設定換入卡牌資料"}
              </span>
            </div>
          }
          showCloseButton
        >
          <div className="px-4 pb-8 space-y-4">
            {/* Card preview */}
            <div
              className="flex items-center gap-3 p-3 rounded-2xl"
              style={{ background: `${BRAND_BLUE}06`, border: `1.5px solid ${BRAND_BLUE}15` }}
            >
              {pendingCard.imageUrl && (
                <img
                  src={getProxiedImageUrl(pendingCard.imageUrl) ?? ""}
                  alt={pendingCard.name}
                  className="w-12 h-16 object-contain rounded-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-black text-sm text-gray-900 line-clamp-2">{pendingCard.name}</p>
                {pendingCard.series && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{pendingCard.series}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                  評級機構
                </Label>
                <Select value={pendingGrader} onValueChange={setPendingGrader}>
                  <SelectTrigger className="h-10 text-sm border-gray-200 rounded-xl bg-gray-50">
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
                  <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                    評級
                  </Label>
                  <Input
                    value={pendingGrade}
                    onChange={(e) => setPendingGrade(e.target.value)}
                    placeholder="10"
                    className="h-10 text-sm border-gray-200 rounded-xl bg-gray-50"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                  數量
                </Label>
                <Input
                  type="number" min="1" max="999"
                  value={pendingQty}
                  onChange={(e) => setPendingQty(e.target.value)}
                  className="h-10 text-sm border-gray-200 rounded-xl bg-gray-50"
                />
              </div>
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BRAND_BLUE }}>
                  估值 HKD
                </Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  placeholder="0.00"
                  className="h-10 text-sm border-gray-200 rounded-xl bg-gray-50"
                />
              </div>
            </div>

            <button
              onClick={confirmPendingCard}
              className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-black transition-all active:scale-[0.98]"
              style={{ background: BRAND_BLUE, color: "white", border: "none" }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: BRAND_YELLOW }}
              >
                <Plus className="w-3 h-3" style={{ color: BRAND_BLUE }} />
              </div>
              加入{pendingDirection === "out" ? "換出" : "換入"}清單
            </button>
          </div>
        </BottomSheet>
      )}

      {/* ── Collection picker ── */}
      {showCollectionPicker && (
        <BottomSheet
          open={showCollectionPicker}
          onOpenChange={setShowCollectionPicker}
          title={
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-red-500" />
              </div>
              <span className="font-black text-gray-900">從收藏選擇換出卡牌</span>
            </div>
          }
          showCloseButton
        >
          <div className="px-4 pb-8">
            {collectionItems.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">收藏清單為空</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {collectionItems.map((colItem: any) => {
                  const alreadyAdded = tradeCards.some((c) => c.collectionId === colItem.id);
                  return (
                    <button
                      key={colItem.id}
                      onClick={() => !alreadyAdded && handleAddFromCollection(colItem)}
                      disabled={alreadyAdded}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-[0.99]"
                      style={{
                        background: alreadyAdded ? "#f9fafb" : "white",
                        border: alreadyAdded ? "1.5px solid #e5e7eb" : `1.5px solid ${BRAND_BLUE}20`,
                        opacity: alreadyAdded ? 0.5 : 1,
                      }}
                    >
                      {colItem.card?.imageUrl ? (
                        <img
                          src={getProxiedImageUrl(colItem.card.imageUrl) ?? ""}
                          alt={colItem.card?.name}
                          className="w-10 h-14 object-contain rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-900 line-clamp-2">{colItem.card?.name}</p>
                        {colItem.card?.series && (
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{colItem.card.series}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <GradeBadge grader={colItem.grader} grade={colItem.grade} />
                          {colItem.marketPrice && (
                            <span className="text-[10px] font-bold text-gray-500">
                              {formatCurrency(colItem.marketPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${BRAND_BLUE}10` }}
                        >
                          <Plus className="w-3 h-3" style={{ color: BRAND_BLUE }} />
                        </div>
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
