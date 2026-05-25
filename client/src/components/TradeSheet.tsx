/**
 * TradeSheet — Card-for-Card Trade Recording UI
 * Design: Boxium brand style — deep blue header (#06038D), white body, yellow (#FEDD00) accents
 * Reference: "新增收藏" dialog style
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import { CameraSearchSheet } from "@/components/CameraSearchSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight, Plus, Search, Package,
  ArrowRight, ArrowLeft, CheckCircle2, X, Loader2, Camera,
} from "lucide-react";
import { getProxiedImageUrl } from "@/lib/utils";

const BLUE = "#06038D";
const YELLOW = "#FEDD00";

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
  const color = grader === "PSA" ? "#dc2626" : grader === "BGS" ? "#2563eb" : grader === "TAG" ? "#7c3aed" : "#6b7280";
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {label}
    </span>
  );
}

// ─── Card Row in trade list ───────────────────────────────────
function TradeCardRow({
  item,
  onRemove,
  onUpdate,
}: {
  item: TradeCardItem;
  onRemove: () => void;
  onUpdate: (u: Partial<TradeCardItem>) => void;
}) {
  const isOut = item.direction === "out";
  return (
    <div className="flex items-start gap-3 sm:gap-4 px-3 sm:px-4 py-3 bg-white" style={{ borderTop: "1px solid #f0f0f0" }}>
      {/* Card image */}
      <div className="w-12 h-[68px] sm:w-14 sm:h-20 md:w-16 md:h-[90px] rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
        {item.cardImageUrl ? (
          <img
            src={getProxiedImageUrl(item.cardImageUrl) ?? ""}
            alt={item.cardName}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-5 h-5 text-gray-300" />
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight line-clamp-2">{item.cardName}</p>
        {item.cardSeries && <p className="text-[10px] sm:text-xs text-gray-400 truncate mt-0.5">{item.cardSeries}</p>}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <GradeBadge grader={item.grader} grade={item.grade} />
          {item.quantity > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">×{item.quantity}</span>
          )}
        </div>
        {/* Estimated value inline */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">估値 HKD</span>
          <input
            type="number" min="0" step="0.01"
            value={item.estimatedValue}
            onChange={(e) => onUpdate({ estimatedValue: e.target.value })}
            className="w-24 sm:w-28 h-6 sm:h-7 text-xs sm:text-sm px-2 rounded-md font-bold tabular-nums outline-none"
            style={{
              border: `1.5px solid ${BLUE}35`,
              color: BLUE,
              background: `${BLUE}05`,
            }}
            placeholder="0.00"
          />
        </div>
      </div>
      {/* Remove */}
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-red-50 transition-colors"
      >
        <X className="w-4 h-4 text-gray-300 hover:text-red-400" />
      </button>
    </div>
  );
}

// ─── Section block ────────────────────────────────────────────
function SectionBlock({
  isOut,
  count,
  totalValue,
  children,
  onFromCollection,
  onSearch,
  onCamera,
}: {
  isOut: boolean;
  count: number;
  totalValue: number;
  children: React.ReactNode;
  onFromCollection?: () => void;
  onSearch: () => void;
  onCamera?: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${isOut ? "#e5e7eb" : BLUE}` }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: isOut ? "white" : BLUE }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: isOut ? "#fee2e2" : `${YELLOW}25` }}
          >
            {isOut
              ? <ArrowRight className="w-3.5 h-3.5 text-red-500" />
              : <ArrowLeft className="w-3.5 h-3.5" style={{ color: YELLOW }} />
            }
          </div>
          <span className="text-sm font-black" style={{ color: isOut ? "#111827" : "white" }}>
            {isOut ? "換出卡牌" : "換入卡牌"}
          </span>
          {count > 0 && (
            <span
              className="text-xs font-black w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                background: isOut ? "#fee2e2" : YELLOW,
                color: isOut ? "#dc2626" : BLUE,
              }}
            >
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOut && onFromCollection && (
            <button
              onClick={onFromCollection}
              className="flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-black transition-all active:scale-95"
              style={{ background: `${BLUE}10`, color: BLUE, border: `1.5px solid ${BLUE}25` }}
            >
              <Package className="w-3 h-3" />從收藏選
            </button>
          )}
          {onCamera && (
            <button
              onClick={onCamera}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-black transition-all active:scale-95"
              style={isOut
                ? { background: `${BLUE}10`, color: BLUE, border: `1.5px solid ${BLUE}25` }
                : { background: `${YELLOW}`, color: BLUE, border: `none` }
              }
              title="拍照識別"
            >
              <Camera className="w-4 h-4" />
              {!isOut && <span>拍照</span>}
            </button>
          )}
          <button
            onClick={onSearch}
            className="flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-black transition-all active:scale-95"
            style={isOut
              ? { background: "#fee2e2", color: "#dc2626", border: "1.5px solid #fca5a5" }
              : { background: YELLOW, color: BLUE, border: "none" }
            }
          >
            <Search className="w-3 h-3" />
            {isOut ? "搜尋" : "搜尋換入卡"}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ background: isOut ? "#fafafa" : `${BLUE}04` }}>
        {count === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 px-4">
            <Package className="w-4 h-4 text-gray-300" />
            <span className="text-xs text-gray-400">
              {isOut ? "點擊「從收藏選」或「搜尋」加入換出卡牌" : "搜尋並加入換入的新卡牌（將自動加入收藏）"}
            </span>
          </div>
        ) : (
          <>
            {children}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ borderTop: "1px solid #f0f0f0" }}
            >
              <span
                className="text-xs font-black"
                style={{ color: isOut ? "#dc2626" : BLUE }}
              >
                {isOut ? "換出" : "換入"}總估值：{formatCurrency(totalValue)}
              </span>
              {!isOut && (
                <button
                  onClick={onSearch}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-black transition-all active:scale-95"
                  style={{ background: `${YELLOW}30`, color: BLUE, border: `1px solid ${YELLOW}80` }}
                >
                  <Plus className="w-2.5 h-2.5" />
                  再加一張
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function TradeSheet({ open, onOpenChange, onSuccess, preselectedOutItem }: TradeSheetProps) {
  const utils = trpc.useUtils();

  const [tradedAt, setTradedAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [cashAdjustment, setCashAdjustment] = useState("");
  const [notes, setNotes] = useState("");
  const [tradeCards, setTradeCards] = useState<TradeCardItem[]>([]);

  const [showCardPicker, setShowCardPicker] = useState(false);
  const [pickerDirection, setPickerDirection] = useState<"in" | "out">("out");
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showCameraSheet, setShowCameraSheet] = useState(false);
  const [cameraDirection, setCameraDirection] = useState<"in" | "out">("out");

  const [pendingCard, setPendingCard] = useState<SelectedCard | null>(null);
  const [pendingDirection, setPendingDirection] = useState<"in" | "out">("out");
  const [pendingGrader, setPendingGrader] = useState("PSA");
  const [pendingGrade, setPendingGrade] = useState("10");
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingValue, setPendingValue] = useState("");
  const [pendingCardIdForPrice, setPendingCardIdForPrice] = useState<number | null>(null);

  // Auto-fetch market price when a card is selected for pending form
  const { data: pendingCardPrice } = trpc.cards.getPriceByCondition.useQuery(
    { cardId: pendingCardIdForPrice!, condition: "psa10" },
    { enabled: pendingCardIdForPrice != null }
  );

  // When market price is fetched, auto-fill pendingValue if still empty
  useEffect(() => {
    if (pendingCardPrice?.avgPrice != null && pendingCardIdForPrice != null) {
      setPendingValue((prev) => prev === "" ? String(pendingCardPrice.avgPrice) : prev);
    }
  }, [pendingCardPrice, pendingCardIdForPrice]);

  const { data: collectionData, isLoading: collectionLoading } = trpc.profile.getCollection.useQuery(
    { limit: 200, page: 1 },
    { enabled: open, staleTime: 30_000 }
  );
  const collectionItems = collectionData?.items ?? [];
  const tradedOutIdsInSheet = new Set<number>(collectionData?.tradedOutIds ?? []);

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
    setCashAdjustment("");
    setNotes("");
    setTradeCards([]);
    setPendingCard(null);
    setPendingCardIdForPrice(null);
    setPendingValue("");
  }, []);

  // Use ref to avoid unstable reference causing useEffect re-runs
  const preselectedRef = useRef(preselectedOutItem);
  useEffect(() => { preselectedRef.current = preselectedOutItem; }, [preselectedOutItem]);

  const initFromPreselected = useCallback(() => {
    const item = preselectedRef.current;
    if (item) {
      setTradeCards([{
        id: `pre-${item.id}`,
        direction: "out",
        cardId: item.cardId,
        cardName: item.cardName,
        cardImageUrl: item.cardImageUrl,
        cardSeries: item.cardSeries,
        grader: item.grader,
        grade: item.grade ?? "",
        quantity: item.quantity,
        estimatedValue: item.marketPrice != null ? String(item.marketPrice) : "",
        collectionId: item.id,
      }]);
    }
  }, []); // stable — reads from ref

  // Reset form when sheet opens (use effect to avoid re-triggering on re-renders)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      resetForm();
      initFromPreselected();
    }
    prevOpenRef.current = open;
  }, [open, resetForm, initFromPreselected]);

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
  };

  const handleCardPicked = (card: SelectedCard) => {
    setPendingCard(card);
    setPendingDirection(pickerDirection);
    setPendingGrader("PSA");
    setPendingGrade("10");
    setPendingQty("1");
    setPendingValue(""); // will be auto-filled by useEffect when market price arrives
    setPendingCardIdForPrice(card.id);
    setShowCardPicker(false);
  };

  const handleCameraCardSelected = (card: { id: number; name: string; imageUrl: string | null; series: string | null }) => {
    setPendingCard({ id: card.id, name: card.name, imageUrl: card.imageUrl, series: card.series, productType: "single_card" });
    setPendingDirection(cameraDirection);
    setPendingGrader("PSA");
    setPendingGrade("10");
    setPendingQty("1");
    setPendingValue(""); // will be auto-filled by useEffect when market price arrives
    setPendingCardIdForPrice(card.id);
    setShowCameraSheet(false);
  };

  const confirmPendingCard = () => {
    if (!pendingCard) return;
    const qty = parseInt(pendingQty) || 1;
    setTradeCards((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      direction: pendingDirection,
      cardId: pendingCard.id,
      cardName: pendingCard.name,
      cardImageUrl: pendingCard.imageUrl,
      cardSeries: pendingCard.series,
      grader: pendingGrader,
      grade: pendingGrade,
      quantity: qty,
      estimatedValue: pendingValue,
      collectionId: null,
    }]);
    toast.success(`已加入${pendingDirection === 'out' ? '換出' : '換入'}清單：${pendingCard.name}`);
    setPendingCard(null);
    setPendingCardIdForPrice(null);
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
      estimatedValue: colItem.marketPrice != null
        ? String(colItem.marketPrice)
        : colItem.purchasePrice != null
          ? String(parseFloat(colItem.purchasePrice))
          : "",
      collectionId: colItem.id,
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
      tradePartner: null,
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

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        className="!bg-[#f5f6fa]"
        bodyClassName=""
        title={
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: YELLOW }}
            >
              <ArrowLeftRight className="w-4.5 h-4.5" style={{ color: BLUE }} />
            </div>
            <span className="font-black text-white text-base tracking-wide">以卡換卡記錄</span>
          </div>
        }
        headerStyle={{ background: BLUE }}
        handleStyle={{ background: BLUE }}
        showCloseButton
      >
        <div className="pb-8" style={{ background: "#f5f6fa" }}>

          {/* ── Date ── */}
          <div className="px-4 pt-4 pb-3">
            <div className="bg-white rounded-2xl px-4 py-3" style={{ border: "1.5px solid #e8eaf0" }}>
              <Label className="text-[11px] font-black uppercase tracking-widest mb-2 block" style={{ color: BLUE }}>
                交換日期
              </Label>
              <Input
                type="date"
                value={tradedAt}
                onChange={(e) => setTradedAt(e.target.value)}
                className="h-11 w-full max-w-full text-sm font-bold border-gray-200 rounded-xl bg-gray-50 focus:ring-2"
                style={{ "--tw-ring-color": `${BLUE}40`, boxSizing: "border-box" } as any}
              />
            </div>
          </div>

          {/* ── OUT section ── */}
          <div className="px-4 pb-3">
            <SectionBlock
              isOut
              count={outCards.length}
              totalValue={totalOutValue}
              onFromCollection={() => setShowCollectionPicker(true)}
              onSearch={() => { setPickerDirection("out"); setShowCardPicker(true); }}
              onCamera={() => { setCameraDirection("out"); setShowCameraSheet(true); }}
            >
              {outCards.map((c) => (
                <TradeCardRow key={c.id} item={c}
                  onRemove={() => removeCard(c.id)}
                  onUpdate={(u) => updateCard(c.id, u)} />
              ))}
            </SectionBlock>
          </div>

          {/* ── Value summary (shown when both sides have cards) ── */}
          {(outCards.length > 0 || inCards.length > 0) && (
            <div className="px-4 pb-3">
              <div
                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{ background: BLUE }}
              >
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="text-red-300">{formatCurrency(totalOutValue)}</span>
                  <ArrowLeftRight className="w-3.5 h-3.5 text-white opacity-50" />
                  <span className="text-green-300">{formatCurrency(totalInValue)}</span>
                  {cashAdj !== 0 && (
                    <span className="text-[10px] font-bold" style={{ color: YELLOW }}>
                      {cashAdj > 0 ? "+" : ""}{formatCurrency(cashAdj)} 補差
                    </span>
                  )}
                </div>
                <div
                  className="px-3 py-1.5 rounded-xl text-sm font-black"
                  style={{ background: YELLOW, color: BLUE }}
                >
                  {netDiff >= 0 ? "+" : ""}{formatCurrency(netDiff)}
                </div>
              </div>
            </div>
          )}

          {/* ── IN section ── */}
          <div className="px-4 pb-3">
            <SectionBlock
              isOut={false}
              count={inCards.length}
              totalValue={totalInValue}
              onSearch={() => { setPickerDirection("in"); setShowCardPicker(true); }}
              onCamera={() => { setCameraDirection("in"); setShowCameraSheet(true); }}
            >
              {inCards.map((c) => (
                <TradeCardRow key={c.id} item={c}
                  onRemove={() => removeCard(c.id)}
                  onUpdate={(u) => updateCard(c.id, u)} />
              ))}
            </SectionBlock>
          </div>

          {/* ── Cash & Notes ── */}
          <div className="px-4 pb-3">
            <div className="bg-white rounded-2xl px-4 py-3 space-y-3" style={{ border: "1.5px solid #e8eaf0" }}>
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest mb-2 block" style={{ color: BLUE }}>
                  補差金額（選填）
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold pointer-events-none">HKD</span>
                  <Input
                    type="number" step="0.01"
                    value={cashAdjustment}
                    onChange={(e) => setCashAdjustment(e.target.value)}
                    placeholder="正數=收到 負數=付出"
                    className="h-11 text-sm border-gray-200 rounded-xl bg-gray-50 pl-12"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">正數 = 對方補差給你，負數 = 你補差給對方</p>
              </div>
              <div>
                <Label className="text-[11px] font-black uppercase tracking-widest mb-2 block" style={{ color: BLUE }}>
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
          </div>

          {/* ── Submit ── */}
          <div className="px-4 pt-1">
            {!canSubmit && (outCards.length === 0 || inCards.length === 0) && (
              <p className="text-xs text-center text-gray-400 mb-3">
                請加入至少一張換出卡牌和一張換入卡牌
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full rounded-2xl flex items-center justify-center gap-2.5 text-sm font-black transition-all active:scale-[0.98]"
              style={{
                height: "52px",
                background: canSubmit ? BLUE : "#e5e7eb",
                color: canSubmit ? "white" : "#9ca3af",
                border: "none",
              }}
            >
              {createTradeMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />儲存中...</>
              ) : (
                <>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: canSubmit ? YELLOW : "#d1d5db" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: canSubmit ? BLUE : "#9ca3af" }} />
                  </div>
                  確認記錄交換
                </>
              )}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ── Card Picker Dialog ── */}
      <CardPickerDialog
        open={showCardPicker}
        onOpenChange={setShowCardPicker}
        onSelect={handleCardPicked}
      />

      {/* ── Camera Search Sheet (picker mode) ── */}
      <CameraSearchSheet
        open={showCameraSheet}
        onOpenChange={setShowCameraSheet}
        onCardSelect={handleCameraCardSelected}
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
                style={{ background: pendingDirection === "out" ? "#fee2e2" : `${YELLOW}30` }}
              >
                {pendingDirection === "out"
                  ? <ArrowRight className="w-3.5 h-3.5 text-red-500" />
                  : <ArrowLeft className="w-3.5 h-3.5" style={{ color: pendingDirection === "in" ? YELLOW : BLUE }} />
                }
              </div>
              <span className="font-black text-white text-sm">
                {pendingDirection === "out" ? "設定換出卡牌資料" : "設定換入卡牌資料"}
              </span>
            </div>
          }
          headerStyle={{ background: BLUE }}
          handleStyle={{ background: BLUE }}
          showCloseButton
        >
          <div className="px-4 pb-8 pt-4 space-y-4" style={{ background: "#f5f6fa" }}>
            {/* Card preview */}
            <div
              className="flex items-center gap-3 p-3 rounded-2xl bg-white"
              style={{ border: `1.5px solid ${BLUE}20` }}
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

            <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: "1.5px solid #e8eaf0" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BLUE }}>
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
                    <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BLUE }}>
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
                  <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BLUE }}>
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
                  <Label className="text-[11px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: BLUE }}>
                    估值 HKD
                    {pendingCardIdForPrice != null && pendingValue === "" && (
                      <span className="ml-1 text-[9px] font-normal text-gray-400 normal-case tracking-normal">查詢市場價中...</span>
                    )}
                    {pendingCardPrice?.avgPrice != null && (
                      <span className="ml-1 text-[9px] font-normal normal-case tracking-normal" style={{ color: BLUE }}>市場參考價</span>
                    )}
                  </Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={pendingValue}
                    onChange={(e) => setPendingValue(e.target.value)}
                    placeholder="輸入估值"
                    className="h-10 text-sm rounded-xl"
                    style={{ border: `1.5px solid ${BLUE}40`, background: `${BLUE}05`, color: BLUE }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={confirmPendingCard}
              className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-black transition-all active:scale-[0.98]"
              style={{ background: BLUE, color: "white", border: "none" }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: YELLOW }}
              >
                <Plus className="w-3 h-3" style={{ color: BLUE }} />
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
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${YELLOW}30` }}>
                <Package className="w-3.5 h-3.5" style={{ color: YELLOW }} />
              </div>
              <span className="font-black text-white text-sm">從收藏選擇換出卡牌</span>
            </div>
          }
          headerStyle={{ background: BLUE }}
          showCloseButton
        >
          <div className="px-4 pb-8 pt-4" style={{ background: "#f5f6fa" }}>
            {collectionLoading ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: BLUE }} />
                <span className="text-sm text-gray-400">載入收藏中...</span>
              </div>
            ) : collectionItems.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">收藏清單為空</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {collectionItems.map((colItem: any) => {
                  const alreadyAdded = tradeCards.some((c) => c.collectionId === colItem.id);
                  const isTradedOut = tradedOutIdsInSheet.has(colItem.id);
                  return (
                    <button
                      key={colItem.id}
                      onClick={() => !alreadyAdded && handleAddFromCollection(colItem)}
                      disabled={alreadyAdded}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-[0.99] bg-white"
                      style={{
                        border: alreadyAdded ? "1.5px solid #e5e7eb" : isTradedOut ? "1.5px solid #fde68a" : `1.5px solid ${BLUE}20`,
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
                        <p className="text-xs font-bold text-gray-900 line-clamp-2">{colItem.card?.name}</p>
                        {colItem.card?.series && (
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{colItem.card.series}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <GradeBadge grader={colItem.grader} grade={colItem.grade} />
                          {colItem.marketPrice && (
                            <span className="text-[10px] font-bold" style={{ color: BLUE }}>
                              {formatCurrency(colItem.marketPrice)}
                            </span>
                          )}
                          {isTradedOut && (
                            <span className="text-[9px] font-black px-1 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                              ↔ 已換出
                            </span>
                          )}
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: YELLOW }}
                        >
                          <Plus className="w-3.5 h-3.5" style={{ color: BLUE }} />
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
