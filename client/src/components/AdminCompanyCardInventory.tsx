import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Search, Edit, Trash2, ShoppingBag, TrendingUp,
  Package, RefreshCw, Download, ChevronLeft, ChevronRight, X, ImageOff,
  Copy, Layers, MessageSquare, TrendingDown, CalendarDays, Camera, Sparkles,
  Settings, ChevronDown, SlidersHorizontal,
} from "lucide-react";
import { CameraSearchSheet } from "@/components/CameraSearchSheet";
import { ClaimFormReviewDialog } from "@/components/ClaimFormReviewDialog";
import { getProxiedImageUrl } from "@/lib/utils";
import { LazyImage } from "@/components/LazyImage";

/* ─── Constants ────────────────────────────────────────────────────── */
const GRADE_OPTIONS = [
  "PSA 10", "PSA 9", "PSA 8", "PSA 7", "PSA 6", "PSA 5",
  "BGS 10", "BGS 9.5", "BGS 9",
  "CGC 10", "CGC 9.5",
  "RAW（未評級）",
  "其他",
];

const BUY_SOURCE_OPTIONS = [
  "客戶回收",
  "拍賣（雅虎）",
  "拍賣（eBay）",
  "門市收購",
  "網上平台",
  "批發商",
  "個人交易",
  "其他",
];

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const CURRENT_YEAR = new Date().getFullYear();

/* ─── Types ─────────────────────────────────────────────────────────── */
type CardInventoryItem = {
  id: number;
  itemType: "card" | "sealed";
  cardName: string;
  cardSet: string | null;
  cardNumber: string | null;
  grade: string | null;
  buyPriceCurrency: "HKD" | "JPY" | "USD";
  buyPriceOriginal: string;
  buyPriceHkd: string;
  buyExchangeRate: string | null;
  buyDate: Date;
  buySource: string | null;
  status: "holding" | "sold";
  sellPriceCurrency: "HKD" | "JPY" | "USD" | null;
  sellPriceOriginal: string | null;
  sellPriceHkd: string | null;
  sellDate: Date | null;
  sellChannel: string | null;
  notes: string | null;
  imageUrl: string | null;
  linkedCardId: number | null;
  createdAt: Date;
};

type CardSearchResult = {
  id: number;
  name: string;
  nameJa: string | null;
  imageUrl: string | null;
  cardNumber: string | null;
  setName: string | null;
  latestPrice: number | null;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */
/**
 * Extract the set name from a card.
 * Priority:
 * 1. card.setName if not null/empty
 * 2. The set name in parentheses from card.name, e.g. "(High Class Pack \"MEGA Dream ex\")" → "High Class Pack \"MEGA Dream ex\""
 * 3. The set code prefix from card.cardNumber, e.g. "SM7 068/096" → "SM7"
 */
function extractCardSet(card: CardSearchResult): string {
  if (card.setName) return card.setName;
  // Try to extract from card name: last parenthesized group
  if (card.name) {
    const parenMatch = card.name.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) return parenMatch[1];
  }
  // Fall back to set code prefix from cardNumber
  if (card.cardNumber) {
    const spaceIdx = card.cardNumber.indexOf(" ");
    if (spaceIdx > 0) return card.cardNumber.slice(0, spaceIdx);
  }
  return "";
}
/**
 * Extract the pure card number (without set code prefix) from a CardSearchResult.
 * e.g. "SM7 068/096" → "068/096", "M2a 063/193" → "063/193"
 */
function extractCardNumber(card: CardSearchResult): string {
  if (!card.cardNumber) return "";
  const spaceIdx = card.cardNumber.indexOf(" ");
  return spaceIdx > 0 ? card.cardNumber.slice(spaceIdx + 1) : card.cardNumber;
}
function formatHkd(val: string | number | null | undefined): string {
  if (val == null) return "—";
  const n = Number(val);
  return `HK$${n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ─── Card Search Modal (full-screen, like 選擇卡牌 dialog) ─────────── */
function CardSearchModal({
  open,
  onClose,
  onSelect,
  title = "搜尋卡牌",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (card: CardSearchResult) => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { data, isFetching } = trpc.cards.search.useQuery(
    { query, limit: 20 },
    { enabled: query.length >= 2 }
  );
  const results: CardSearchResult[] = (data?.cards ?? []) as CardSearchResult[];

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset highlight when results change
  useEffect(() => { setHighlightIdx(-1); }, [results.length]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => {
        const next = Math.min(i + 1, results.length - 1);
        const el = listRef.current?.querySelector(`[data-idx="${next}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => {
        const prev = Math.max(i - 1, 0);
        const el = listRef.current?.querySelector(`[data-idx="${prev}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest" });
        return prev;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = highlightIdx >= 0 ? highlightIdx : 0;
      if (results[idx]) { onSelect(results[idx]); onClose(); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden"
        style={{ maxWidth: "min(680px, 95vw)", height: "min(85vh, 700px)" }}
      >
        {/* Blue header with search box */}
        <div className="bg-primary px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-slate-900 text-xl font-bold">{title}</h2>
              <p className="text-blue-200 text-xs mt-0.5">搜索並選擇對應的卡牌，系統將自動關聯市場數據</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-900/70 hover:text-slate-900 transition-colors p-1 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-blue-300 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="輸入卡牌名稱、日文名或卡號..."
              className="w-full h-11 pl-10 pr-10 rounded-lg bg-white/10 border border-white/20 text-slate-900 placeholder:text-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-slate-900"
                onClick={() => setQuery("")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results list */}
        <div ref={listRef} className="flex-1 overflow-y-auto bg-card">
          {query.length < 2 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-16">
              <Search className="w-10 h-10 opacity-30" />
              <p className="text-sm">輸入至少 2 個字元開始搜尋</p>
            </div>
          )}
          {query.length >= 2 && isFetching && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">搜尋中...</div>
          )}
          {query.length >= 2 && !isFetching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-1">
              <p className="text-sm">找不到符合的卡牌</p>
              <p className="text-xs">請嘗試其他關鍵字，或關閉後手動輸入</p>
            </div>
          )}
          {results.map((card, idx) => (
            <button
              key={card.id}
              data-idx={idx}
              className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors border-b last:border-b-0 ${
                highlightIdx === idx ? "bg-primary/10" : "hover:bg-primary/5"
              }`}
              onMouseEnter={() => setHighlightIdx(idx)}
              onClick={() => { onSelect(card); onClose(); }}
            >
              <div className="w-16 h-[88px] flex-shrink-0 rounded-lg overflow-hidden bg-muted shadow">
                {card.imageUrl
                  ? <LazyImage src={getProxiedImageUrl(card.imageUrl) ?? ""} alt={card.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-6 h-6 text-slate-500" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-primary text-base leading-snug line-clamp-2">{card.name}</div>
                {card.nameJa && <div className="text-xs text-slate-400 truncate mt-0.5">{card.nameJa}</div>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {card.cardNumber && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground font-mono">
                      {card.cardNumber}
                    </span>
                  )}
                </div>
                {card.latestPrice && (
                  <div className="text-xs font-semibold text-primary mt-1">PSA 10 市場均價 HKD {card.latestPrice.toLocaleString()}</div>
                )}
              </div>
            </button>
          ))}
          {query.length >= 2 && !isFetching && results.length > 0 && (
            <div className="px-5 py-3 text-xs text-slate-500 text-center border-t">
              顯示 {results.length} 個結果
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Inline Card Search (for batch rows) ───────────────────────────── */
function InlineCardSearch({
  value,
  onChange,
  onSelect,
  onAfterSelect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (card: CardSearchResult) => void;
  onAfterSelect?: () => void;
  placeholder?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          readOnly
          value={value}
          onClick={() => setModalOpen(true)}
          placeholder={placeholder ?? "點擊搜尋卡牌..."}
          className="pl-8 h-8 text-sm cursor-pointer"
        />
        {value && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <CardSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={(card) => {
          onSelect(card);
          onChange(card.name);
          setModalOpen(false);
          // After modal closes, focus next field
          if (onAfterSelect) setTimeout(onAfterSelect, 80);
        }}
        title="搜尋卡牌"
      />
    </>
  );
}

/* ─── Batch Sell Dialog ──────────────────────────────────────────────── */
const SELL_CHANNEL_OPTIONS_CONST = [
  "平台自售",
  "拍賣（雅虎）",
  "拍賣（eBay）",
  "門市直接賣出",
  "個人交易",
  "其他",
];

type SellRow = {
  id: string;
  recordId: number;
  cardName: string;
  cardSet: string | null;
  cardNumber: string | null;
  grade: string | null;
  imageUrl: string | null;
  buyPriceHkd: string | null;
  sellPriceCurrency: "HKD" | "JPY" | "USD";
  sellPriceOriginal: string;
  notes: string;
  notesOpen: boolean;
};

function BatchSellDialog({
  open, onClose, rates,
}: {
  open: boolean;
  onClose: () => void;
  rates: { HKD: number; JPY: number; USD: number };
}) {
  const utils = trpc.useUtils();
  const today = new Date().toISOString().slice(0, 10);

  const [sharedDate, setSharedDate] = useState(today);
  const [sharedChannel, setSharedChannel] = useState("__none__");
  const [sharedChannelCustom, setSharedChannelCustom] = useState("");
  const [rows, setRows] = useState<SellRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Load holding items
  const { data: holdingData, isLoading: holdingLoading } = trpc.companyCardInventory.list.useQuery({
    status: "holding",
    pageSize: 200,
    page: 1,
  });

  const holdingItems = holdingData?.items ?? [];
  const filteredHolding = holdingItems.filter(item =>
    !rows.some(r => r.recordId === item.id) &&
    (searchQuery === "" ||
      item.cardName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.cardSet ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const batchSellMutation = trpc.companyCardInventory.batchSell.useMutation({
    onSuccess: (data) => {
      toast.success(`已批量記錄 ${data.count} 筆賣出`);
      utils.companyCardInventory.list.invalidate();
      utils.companyCardInventory.monthlySummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const addToSell = (item: typeof holdingItems[0]) => {
    setRows(rs => [...rs, {
      id: Math.random().toString(36).slice(2),
      recordId: item.id,
      cardName: item.cardName,
      cardSet: item.cardSet,
      cardNumber: item.cardNumber,
      grade: item.grade,
      imageUrl: item.imageUrl,
      buyPriceHkd: item.buyPriceHkd,
      sellPriceCurrency: "HKD",
      sellPriceOriginal: "",
      notes: "",
      notesOpen: false,
    }]);
    setSearchQuery("");
  };

  const updateSellRow = (id: string, patch: Partial<SellRow>) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeSellRow = (id: string) => setRows(rs => rs.filter(r => r.id !== id));

  const effectiveChannel = sharedChannel === "其他" ? sharedChannelCustom : (sharedChannel === "__none__" ? "" : sharedChannel);

  const totalSellHkd = useMemo(() => {
    return rows.reduce((sum, r) => {
      const amt = parseFloat(r.sellPriceOriginal);
      if (!amt || isNaN(amt)) return sum;
      const rate = rates[r.sellPriceCurrency as keyof typeof rates] ?? 1;
      return sum + amt * rate;
    }, 0);
  }, [rows, rates]);

  const totalBuyHkd = useMemo(() => {
    return rows.reduce((sum, r) => {
      const v = parseFloat(r.buyPriceHkd ?? "0");
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }, [rows]);

  const handleSubmit = () => {
    const validRows = rows.filter(r => parseFloat(r.sellPriceOriginal) > 0);
    if (validRows.length === 0) return toast.error("請至少填寫一筆賣出金額");
    const missingPrice = rows.filter(r => !(parseFloat(r.sellPriceOriginal) > 0));
    if (missingPrice.length > 0) return toast.error(`有 ${missingPrice.length} 筆記錄未填寫賣出金額`);

    batchSellMutation.mutate({
      items: validRows.map(r => ({
        id: r.recordId,
        sellPriceCurrency: r.sellPriceCurrency,
        sellPriceOriginal: parseFloat(r.sellPriceOriginal),
        notes: r.notes || undefined,
      })),
      sellDate: sharedDate,
      sellChannel: effectiveChannel || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent bottomSheet className="sm:max-w-3xl overflow-hidden">
        {/* Green header */}
        <div className="bg-green-700 px-5 py-4 flex items-center gap-3 rounded-t-2xl sm:rounded-t-xl">
          <DialogTitle className="text-slate-900 text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            批量賣出記錄
          </DialogTitle>
        </div>
        {/* Scrollable content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(95dvh-130px)] sm:max-h-[calc(92vh-130px)]">
        {/* Shared Settings */}
        <div className="bg-muted/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">共用設定</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">賣出日期 *</label>
              <Input type="date" value={sharedDate} onChange={(e) => setSharedDate(e.target.value)} className="h-10 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">賣出渠道</label>
              <Select value={sharedChannel} onValueChange={setSharedChannel}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="選擇渠道" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未選擇</SelectItem>
                  {SELL_CHANNEL_OPTIONS_CONST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {sharedChannel === "其他" && (
                <Input className="mt-1.5 h-10 text-sm" placeholder="自定義渠道" value={sharedChannelCustom} onChange={(e) => setSharedChannelCustom(e.target.value)} />
              )}
            </div>
          </div>
        </div>

        {/* Search holding items */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">搜尋持有中卡牌加入清單</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="輸入卡牌名稱或系列..."
              className="pl-10 h-11 text-sm"
            />
          </div>
          {(searchQuery || filteredHolding.length > 0) && (
            <div className="mt-1.5 border rounded-lg max-h-40 overflow-y-auto">
              {holdingLoading && <div className="p-2.5 text-xs text-muted-foreground text-center">載入中...</div>}
              {!holdingLoading && filteredHolding.length === 0 && (
                <div className="p-2.5 text-xs text-muted-foreground text-center">
                  {searchQuery ? "找不到符合的持有中卡牌" : "所有持有中卡牌已全部加入"}
                </div>
              )}
              {filteredHolding.slice(0, 20).map(item => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-2 p-2 hover:bg-muted/60 text-left transition-colors border-b last:border-0"
                  onClick={() => addToSell(item)}
                >
                  <div className="w-7 h-10 flex-shrink-0 rounded overflow-hidden bg-muted">
                    {item.imageUrl
                      ? <LazyImage src={getProxiedImageUrl(item.imageUrl) ?? ""} alt={item.cardName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-3 h-3 text-muted-foreground" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{item.cardName}</div>
                    <div className="text-xs text-muted-foreground">{[item.cardSet, item.cardNumber, item.grade].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="text-xs text-primary font-medium flex-shrink-0">{formatHkd(item.buyPriceHkd)}</div>
                  <Plus className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sell rows */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_120px_28px] gap-1.5 px-1 text-xs font-medium text-muted-foreground">
              <span>卡牌</span>
              <span>賣出金額 *</span>
              <span></span>
            </div>
            <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
              {rows.map((row) => (
                <div key={row.id} className="space-y-1">
                  <div className="grid grid-cols-[1fr_120px_28px] gap-1.5 items-center">
                    {/* Card info */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-7 h-10 flex-shrink-0 rounded overflow-hidden bg-muted">
                        {row.imageUrl
                          ? <LazyImage src={getProxiedImageUrl(row.imageUrl) ?? ""} alt={row.cardName} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-3 h-3 text-muted-foreground" /></div>
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-xs truncate">{row.cardName}</div>
                        <div className="text-xs text-muted-foreground truncate">{[row.cardSet, row.grade].filter(Boolean).join(" · ")}</div>
                        <div className="text-xs text-primary">成本 {formatHkd(row.buyPriceHkd)}</div>
                      </div>
                    </div>
                    {/* Sell price */}
                    <div className="flex gap-0.5">
                      <Select value={row.sellPriceCurrency} onValueChange={(v) => updateSellRow(row.id, { sellPriceCurrency: v as "HKD" | "JPY" | "USD" })}>
                        <SelectTrigger className="w-14 h-8 text-xs px-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HKD">HKD</SelectItem>
                          <SelectItem value="JPY">JPY</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number" step="0.01" placeholder="0"
                        value={row.sellPriceOriginal}
                        onChange={(e) => updateSellRow(row.id, { sellPriceOriginal: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
                        className="h-8 text-xs min-w-0"
                      />
                    </div>
                    {/* Remove */}
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                      onClick={() => removeSellRow(row.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Notes toggle */}
                  <div className="pl-9">
                    {!row.notesOpen ? (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        onClick={() => updateSellRow(row.id, { notesOpen: true })}
                      >
                        <MessageSquare className="w-3 h-3" />加入備注
                      </button>
                    ) : (
                      <Input
                        placeholder="備注（選填）"
                        value={row.notes}
                        onChange={(e) => updateSellRow(row.id, { notes: e.target.value })}
                        className="h-7 text-xs"
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {rows.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            從上方搜尋並選擇要賣出的卡牌
          </div>
        )}

        {/* Summary */}
        {rows.length > 0 && (
          <div className="bg-muted/40 rounded-lg px-3 py-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">買取成本合計</span>
              <span className="font-medium text-primary">{formatHkd(totalBuyHkd)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">預計賣出合計</span>
              <span className="font-semibold text-green-600">{formatHkd(totalSellHkd)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-1">
              <span className="text-muted-foreground">預計毛利</span>
              <span className={`font-bold ${totalSellHkd - totalBuyHkd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {totalSellHkd - totalBuyHkd >= 0 ? "+" : ""}{formatHkd(totalSellHkd - totalBuyHkd)}
              </span>
            </div>
          </div>
        )}
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">取消</Button>
          <Button
            onClick={handleSubmit}
            disabled={batchSellMutation.isPending || rows.length === 0}
            className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-slate-900 gap-2"
          >
            <TrendingDown className="w-4 h-4" />
            {batchSellMutation.isPending ? "儲存中..." : `確認賣出 ${rows.length} 筆`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Batch Buy Dialog ───────────────────────────────────────────────── */
type BatchRow = {
  id: string;
  cardName: string;
  cardSet: string;
  cardNumber: string;
  imageUrl: string;
  linkedCardId: number | null;
  buyPriceCurrency: "HKD" | "JPY" | "USD";
  buyPriceOriginal: string;
  notes: string;
  notesOpen: boolean;
};

function makeBatchRow(prev?: Partial<BatchRow>): BatchRow {
  return {
    id: Math.random().toString(36).slice(2),
    cardName: "",
    cardSet: prev?.cardSet ?? "",
    cardNumber: "",
    imageUrl: "",
    linkedCardId: null,
    buyPriceCurrency: prev?.buyPriceCurrency ?? "HKD",
    buyPriceOriginal: "",
    notes: "",
    notesOpen: false,
  };
}

function BatchBuyDialog({
  open, onClose, rates,
}: {
  open: boolean;
  onClose: () => void;
  rates: { HKD: number; JPY: number; USD: number };
}) {
  const utils = trpc.useUtils();
  const today = new Date().toISOString().slice(0, 10);

  // Shared settings
  const [sharedDate, setSharedDate] = useState(today);
  const [sharedGrade, setSharedGrade] = useState("");
  const [sharedGradeCustom, setSharedGradeCustom] = useState("");
  const [sharedSource, setSharedSource] = useState("");
  const [sharedSourceCustom, setSharedSourceCustom] = useState("");
  const [sharedType, setSharedType] = useState<"card" | "sealed">("card");

  // Camera batch scan state
  const [batchCameraOpen, setBatchCameraOpen] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  // Rows
  const [rows, setRows] = useState<BatchRow[]>([makeBatchRow()]);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  // Refs for Tab-key navigation: rowFieldRefs[rowId] = { set, num, amount }
  const rowFieldRefs = useRef<Record<string, { set: HTMLInputElement | null; num: HTMLInputElement | null; amount: HTMLInputElement | null }>>({});
  const getRowRefs = (rowId: string) => {
    if (!rowFieldRefs.current[rowId]) rowFieldRefs.current[rowId] = { set: null, num: null, amount: null };
    return rowFieldRefs.current[rowId];
  };
  const batchCreateMutation = trpc.companyCardInventory.batchCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`已批量新增 ${data.count} 筆買取記錄`);
      utils.companyCardInventory.list.invalidate();
      utils.companyCardInventory.monthlySummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRow = useCallback((id: string, patch: Partial<BatchRow>) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows(rs => [...rs, makeBatchRow({ cardSet: last?.cardSet, buyPriceCurrency: last?.buyPriceCurrency })]);
    // Auto-scroll to bottom after new row is added
    setTimeout(() => {
      if (rowsContainerRef.current) {
        rowsContainerRef.current.scrollTop = rowsContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows(rs => rs.filter(r => r.id !== id));
  };

  const duplicateRow = (id: string) => {
    const src = rows.find(r => r.id === id);
    if (!src) return;
    const newRow: BatchRow = { ...src, id: Math.random().toString(36).slice(2), buyPriceOriginal: "" };
    setRows(rs => {
      const idx = rs.findIndex(r => r.id === id);
      const next = [...rs];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  const effectiveGrade = sharedGrade === "其他" ? sharedGradeCustom : (sharedGrade === "__none__" ? "" : sharedGrade);
  const effectiveSource = sharedSource === "其他" ? sharedSourceCustom : (sharedSource === "__none__" ? "" : sharedSource);

  const totalHkd = useMemo(() => {
    return rows.reduce((sum, r) => {
      const amt = parseFloat(r.buyPriceOriginal);
      if (!amt || isNaN(amt)) return sum;
      const rate = rates[r.buyPriceCurrency as keyof typeof rates] ?? 1;
      return sum + amt * rate;
    }, 0);
  }, [rows, rates]);

  const handleSubmit = () => {
    const validRows = rows.filter(r => r.cardName.trim() && parseFloat(r.buyPriceOriginal) > 0);
    if (validRows.length === 0) return toast.error("請至少填寫一筆有效記錄（卡牌名稱 + 金額）");
    const invalidRows = rows.filter(r => r.cardName.trim() && !(parseFloat(r.buyPriceOriginal) > 0));
    if (invalidRows.length > 0) return toast.error("部分記錄缺少買取金額，請補充後再提交");

    batchCreateMutation.mutate({
      items: validRows.map(r => ({
        itemType: sharedType,
        cardName: r.cardName.trim(),
        cardSet: r.cardSet || undefined,
        cardNumber: r.cardNumber || undefined,
        grade: effectiveGrade || undefined,
        buyPriceCurrency: r.buyPriceCurrency,
        buyPriceOriginal: parseFloat(r.buyPriceOriginal),
        buyDate: sharedDate,
        buySource: effectiveSource || undefined,
        notes: r.notes || undefined,
        imageUrl: r.imageUrl || undefined,
        linkedCardId: r.linkedCardId ?? undefined,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent bottomSheet className="sm:max-w-3xl overflow-hidden">
        {/* Blue header */}
        <div className="bg-primary px-5 py-4 flex items-center gap-3 rounded-t-2xl sm:rounded-t-xl">
          <DialogTitle className="text-slate-900 text-lg font-semibold flex items-center gap-2 flex-1">
            <Layers className="w-5 h-5" />
            批量買取記錄
            {scanCount > 0 && (
              <span className="text-xs font-normal bg-white/20 rounded-full px-2 py-0.5">
                已掃 {scanCount} 張
              </span>
            )}
          </DialogTitle>
          <button
            type="button"
            onClick={() => setBatchCameraOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-slate-900 text-xs font-semibold transition-colors flex-shrink-0"
          >
            <Camera className="w-4 h-4" />
            相機掃描
          </button>
        </div>
        {/* Scrollable content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(95dvh-130px)] sm:max-h-[calc(92vh-130px)]">
        {/* Shared Settings */}
        <div className="bg-muted/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">共用設定（套用至所有記錄）</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">買取日期 *</label>
              <Input type="date" value={sharedDate} onChange={(e) => setSharedDate(e.target.value)} className="h-10 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">類型</label>
              <Select value={sharedType} onValueChange={(v) => setSharedType(v as "card" | "sealed")}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">單卡</SelectItem>
                  <SelectItem value="sealed">封裝商品</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">評級</label>
              <Select value={sharedGrade} onValueChange={setSharedGrade}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="選擇評級" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未選擇</SelectItem>
                  {GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
              {sharedGrade === "其他" && (
                <Input className="mt-1.5 h-10 text-sm" placeholder="自定義評級" value={sharedGradeCustom} onChange={(e) => setSharedGradeCustom(e.target.value)} />
              )}
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">買取來源</label>
              <Select value={sharedSource} onValueChange={setSharedSource}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="選擇來源" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未選擇</SelectItem>
                  {BUY_SOURCE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {sharedSource === "其他" && (
                <Input className="mt-1.5 h-10 text-sm" placeholder="自定義來源" value={sharedSourceCustom} onChange={(e) => setSharedSourceCustom(e.target.value)} />
              )}
            </div>
          </div>
        </div>

        {/* Row Header - hidden on mobile */}
        <div className="hidden sm:grid grid-cols-[1fr_80px_90px_80px_28px_28px] gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <span>卡牌名稱 / 搜尋</span>
          <span>系列</span>
          <span>卡號</span>
          <span>金額 *</span>
          <span></span>
          <span></span>
        </div>

        {/* Rows */}
        <div ref={rowsContainerRef} className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={row.id} className="space-y-1">
            {/* Row: two-line layout */}
            <div className="space-y-1.5">
              {/* Line 1: index + card search + action buttons */}
              <div className="flex items-center gap-1.5">
                {row.imageUrl ? (
                  <LazyImage src={getProxiedImageUrl(row.imageUrl) ?? ""} alt={row.cardName} className="w-7 h-10 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-7 h-10 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground font-bold">{idx + 1}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <InlineCardSearch
                    value={row.cardName}
                    onChange={(v) => updateRow(row.id, { cardName: v, imageUrl: v ? row.imageUrl : "", linkedCardId: v ? row.linkedCardId : null })}
                    onSelect={(card) => {
                      updateRow(row.id, {
                        cardName: card.name,
                        cardSet: extractCardSet(card),
                        cardNumber: extractCardNumber(card),
                        imageUrl: card.imageUrl ?? "",
                        linkedCardId: card.id,
                      });
                    }}
                    placeholder="卡牌名稱..."
                    onAfterSelect={() => getRowRefs(row.id).set?.focus()}
                  />
                </div>
                {/* Duplicate */}
                <button
                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="複製此行"
                  onClick={() => duplicateRow(row.id)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {/* Remove */}
                <button
                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-30"
                  title="刪除此行"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Line 2: set + card number + currency + amount */}
              <div className="pl-9 grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                {/* Set */}
                <Input
                  ref={(el) => { getRowRefs(row.id).set = el; }}
                  value={row.cardSet}
                  onChange={(e) => updateRow(row.id, { cardSet: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); getRowRefs(row.id).num?.focus(); } }}
                  placeholder="系列"
                  className="h-9 text-sm"
                />
                {/* Card number */}
                <Input
                  ref={(el) => { getRowRefs(row.id).num = el; }}
                  value={row.cardNumber}
                  onChange={(e) => updateRow(row.id, { cardNumber: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); getRowRefs(row.id).amount?.focus(); } }}
                  placeholder="卡號"
                  className="h-9 text-sm"
                />
                {/* Currency + Amount */}
                <div className="flex gap-1 items-center">
                  <Select value={row.buyPriceCurrency} onValueChange={(v) => updateRow(row.id, { buyPriceCurrency: v as "HKD" | "JPY" | "USD" })}>
                    <SelectTrigger className="w-[72px] h-9 text-sm px-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HKD">HKD</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    ref={(el) => { getRowRefs(row.id).amount = el; }}
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={row.buyPriceOriginal}
                    onChange={(e) => updateRow(row.id, { buyPriceOriginal: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
                      if (e.key === "Tab" && !e.shiftKey) {
                        // Jump to next row's set field, or add a new row
                        const nextIdx = rows.findIndex(r => r.id === row.id) + 1;
                        if (nextIdx < rows.length) {
                          e.preventDefault();
                          getRowRefs(rows[nextIdx].id).set?.focus();
                        }
                        // else: let default Tab behavior proceed
                      }
                    }}
                    className="h-9 text-sm w-[90px]"
                  />
                </div>
              </div>
            </div>
            {/* Notes toggle for batch buy row */}
            <div className="pl-9">
              {!row.notesOpen ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => setRows(rs => rs.map(r => r.id === row.id ? { ...r, notesOpen: true } : r))}
                >
                  <MessageSquare className="w-3 h-3" />加入備注
                </button>
              ) : (
                <Input
                  placeholder="備注（選填）"
                  value={row.notes}
                  onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                  className="h-7 text-xs"
                  autoFocus
                />
              )}
            </div>
            </div>
          ))}
        </div>

        {/* Add row button */}
        <Button
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={rows.length >= 50}
          className="w-full gap-1.5 border-dashed"
        >
          <Plus className="w-3.5 h-3.5" />
          新增一行
          {rows.length >= 50 && <span className="text-xs text-muted-foreground ml-1">（最多 50 筆）</span>}
        </Button>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm bg-muted/40 rounded-xl px-4 py-3">
          <span className="text-muted-foreground">
            共 <span className="font-semibold text-foreground">{rows.filter(r => r.cardName.trim()).length}</span> 筆有效記錄
          </span>
          <span className="font-semibold text-primary">
            預計總買取：{formatHkd(totalHkd)}
          </span>
        </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">取消</Button>
          <Button
            onClick={handleSubmit}
            disabled={batchCreateMutation.isPending}
            className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Layers className="w-4 h-4" />
            {batchCreateMutation.isPending ? "儲存中..." : `批量新增 ${rows.filter(r => r.cardName.trim() && parseFloat(r.buyPriceOriginal) > 0).length} 筆`}
          </Button>
        </div>
        {/* Batch camera scanner — re-opens after each successful scan */}
        <CameraSearchSheet
          open={batchCameraOpen}
          onOpenChange={(open) => {
            setBatchCameraOpen(open);
          }}
          onCardSelect={(card) => {
            const last = rows[rows.length - 1];
            const newRow: BatchRow = {
              ...makeBatchRow({ cardSet: card.series ?? last?.cardSet, buyPriceCurrency: last?.buyPriceCurrency }),
              cardName: card.name,
              cardSet: card.series ?? last?.cardSet ?? "",
              imageUrl: card.imageUrl ?? "",
              linkedCardId: card.id,
            };
            setRows(rs => [...rs, newRow]);
            setScanCount(c => c + 1);
            toast.success(`已新增：${card.name}`, { duration: 1500 });
            // Close then re-open for next card
            setBatchCameraOpen(false);
            setTimeout(() => setBatchCameraOpen(true), 350);
            setTimeout(() => {
              if (rowsContainerRef.current) {
                rowsContainerRef.current.scrollTop = rowsContainerRef.current.scrollHeight;
              }
            }, 100);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ─── Card Search Picker ─────────────────────────────────────────────── */
function CardSearchPicker({
  onSelect,
  onManualMode,
}: {
  onSelect: (card: CardSearchResult, rarity?: string | null) => void;
  onManualMode: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium block">搜尋平台卡牌</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">文字搜尋</span>
        </button>
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Camera className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">相機掃描</span>
        </button>
      </div>
      <CardSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={(card) => {
          onSelect(card);
          setModalOpen(false);
        }}
        title="選擇卡牌"
      />
      <CameraSearchSheet
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCardSelect={(card) => {
          onSelect({
            id: card.id,
            name: card.name,
            nameJa: null,
            imageUrl: card.imageUrl,
            cardNumber: card.cardNumber ?? null,
            setName: card.series ?? null,
            latestPrice: null,
          }, card.rarity ?? null);
          setCameraOpen(false);
        }}
      />
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        onClick={onManualMode}
      >
        找不到？手動輸入資料
      </button>
    </div>
  );
}

/* ─── Buy/Edit Form Dialog ─────────────────────────────────────────── */
function BuyFormDialog({
  open, onClose, editItem, rates,
}: {
  open: boolean;
  onClose: () => void;
  editItem?: CardInventoryItem | null;
  rates: { HKD: number; JPY: number; USD: number };
}) {
  const utils = trpc.useUtils();
  const isEdit = !!editItem;
  const [manualMode, setManualMode] = useState(isEdit);
  const [selectedCard, setSelectedCard] = useState<CardSearchResult | null>(null);
  const [cardSearchOpen, setCardSearchOpen] = useState(false);

  const [form, setForm] = useState({
    itemType: editItem?.itemType ?? "card",
    cardName: editItem?.cardName ?? "",
    cardSet: editItem?.cardSet ?? "",
    cardNumber: editItem?.cardNumber ?? "",
    grade: editItem?.grade || "__none__",
    gradeCustom: "",
    buyPriceCurrency: editItem?.buyPriceCurrency ?? "HKD",
    buyPriceOriginal: editItem?.buyPriceOriginal ?? "",
    buyDate: editItem?.buyDate ? new Date(editItem.buyDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    buySource: (() => {
      const src = editItem?.buySource;
      if (!src) return "__none__";
      if (BUY_SOURCE_OPTIONS.includes(src)) return src;
      return "其他";
    })(),
    buySourceCustom: (() => {
      const src = editItem?.buySource;
      if (!src) return "";
      if (BUY_SOURCE_OPTIONS.includes(src)) return "";
      return src;
    })(),
    notes: editItem?.notes ?? "",
    imageUrl: editItem?.imageUrl ?? "",
    linkedCardId: editItem?.linkedCardId ?? null as number | null,
  });

  const createMutation = trpc.companyCardInventory.create.useMutation({
    onSuccess: () => {
      toast.success("已新增買取記錄");
      utils.companyCardInventory.list.invalidate();
      utils.companyCardInventory.monthlySummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.companyCardInventory.update.useMutation({
    onSuccess: () => {
      toast.success("已更新記錄");
      utils.companyCardInventory.list.invalidate();
      utils.companyCardInventory.monthlySummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCardSelect = (card: CardSearchResult, rarity?: string | null) => {
    setSelectedCard(card);
    setManualMode(true);
    setForm(f => ({
      ...f,
      cardName: card.name,
      cardSet: extractCardSet(card),
      cardNumber: extractCardNumber(card),
      imageUrl: card.imageUrl ?? "",
      linkedCardId: card.id,
      // Auto-fill rarity from camera scan into notes if rarity field doesn't exist
      notes: rarity && !f.notes ? `稀有度: ${rarity}` : f.notes,
    }));
  };

  const estimatedHkd = useMemo(() => {
    const amt = parseFloat(form.buyPriceOriginal);
    if (!amt || isNaN(amt)) return null;
    const rate = rates[form.buyPriceCurrency as keyof typeof rates] ?? 1;
    return amt * rate;
  }, [form.buyPriceOriginal, form.buyPriceCurrency, rates]);

  const effectiveGrade = form.grade === "其他" ? form.gradeCustom : (form.grade === "__none__" ? "" : form.grade);
  const effectiveBuySource = form.buySource === "其他" ? form.buySourceCustom : (form.buySource === "__none__" ? "" : form.buySource);

  const handleSubmit = () => {
    if (!form.cardName.trim()) return toast.error("請輸入卡牌/商品名稱");
    const amt = parseFloat(form.buyPriceOriginal);
    if (!amt || isNaN(amt) || amt <= 0) return toast.error("請輸入有效的買取金額");

    const payload = {
      itemType: form.itemType as "card" | "sealed",
      cardName: form.cardName.trim(),
      cardSet: form.cardSet || undefined,
      cardNumber: form.cardNumber || undefined,
      grade: effectiveGrade || undefined,
      buyPriceCurrency: form.buyPriceCurrency as "HKD" | "JPY" | "USD",
      buyPriceOriginal: amt,
      buyDate: form.buyDate,
      buySource: effectiveBuySource || undefined,
      notes: form.notes || undefined,
      imageUrl: form.imageUrl || undefined,
      linkedCardId: form.linkedCardId ?? undefined,
    };

    if (isEdit && editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent bottomSheet className="sm:max-w-lg overflow-hidden">
        {/* Blue header */}
        <div className="bg-primary px-5 py-4 flex items-center gap-3 rounded-t-2xl sm:rounded-t-xl">
          <DialogTitle className="text-slate-900 text-lg font-semibold">
            {isEdit ? "編輯買取記錄" : "新增買取記錄"}
          </DialogTitle>
        </div>
        {/* Scrollable content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(95dvh-130px)] sm:max-h-[calc(92vh-130px)]">
          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">類型</label>
              <Select value={form.itemType} onValueChange={(v) => setForm(f => ({ ...f, itemType: v as "card" | "sealed" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">單卡</SelectItem>
                  <SelectItem value="sealed">封裝商品（卡盒等）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">買取日期 *</label>
              <Input type="date" value={form.buyDate} onChange={(e) => setForm(f => ({ ...f, buyDate: e.target.value }))} />
            </div>
          </div>

          {/* Card Search (only for new records or when not in manual mode) */}
          {!isEdit && !manualMode && (
            <CardSearchPicker
              onSelect={handleCardSelect}
              onManualMode={() => setManualMode(true)}
            />
          )}

          {/* Edit mode: card search button + modal */}
          {isEdit && (
            <>
              <CardSearchModal
                open={cardSearchOpen}
                onClose={() => setCardSearchOpen(false)}
                onSelect={(card) => { handleCardSelect(card); setCardSearchOpen(false); }}
                title="重新搜尋並關聯卡牌"
              />
              {/* Current linked card preview (or newly selected card) */}
              {(selectedCard || form.imageUrl) && (
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                  <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-muted shadow">
                    {(selectedCard?.imageUrl ?? form.imageUrl) ? (
                      <img
                        src={selectedCard?.imageUrl ?? form.imageUrl ?? ""}
                        alt={selectedCard?.name ?? form.cardName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm line-clamp-2">{selectedCard?.name ?? form.cardName}</div>
                    {selectedCard ? (
                      <div className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                        已更新關聯卡牌
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">目前關聯的卡牌圖片</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCardSearchOpen(true)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    重新選擇
                  </button>
                </div>
              )}
              {/* If no image at all, show a search button */}
              {!selectedCard && !form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setCardSearchOpen(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                >
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">點擊搜尋並關聯正確卡牌...</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
              )}
            </>
          )}

          {/* Selected card preview (new record mode) */}
          {(manualMode || isEdit) && (
            <>
              {/* Show selected card preview for new record mode only */}
              {!isEdit && selectedCard && (
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                  <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
                    {selectedCard.imageUrl ? (
                      <LazyImage src={getProxiedImageUrl(selectedCard.imageUrl) ?? ""} alt={selectedCard.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{selectedCard.name}</div>
                    <div className="text-xs text-muted-foreground">{[selectedCard.setName, selectedCard.cardNumber].filter(Boolean).join(" \u00b7 ")}</div>
                    <div className="text-xs text-green-600 mt-0.5">已從平台資料庫選取</div>
                  </div>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => { setSelectedCard(null); setManualMode(false); setForm(f => ({ ...f, cardName: "", cardSet: "", cardNumber: "", imageUrl: "", linkedCardId: null })); }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Card Name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block text-foreground">卡牌/商品名稱 *</label>
                <Input
                  placeholder="例：Charizard VMAX / 閃焰王者 第一彈 卡盒"
                  value={form.cardName}
                  onChange={(e) => setForm(f => ({ ...f, cardName: e.target.value }))}
                  className="h-11"
                />
              </div>

              {/* Set + Card Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-foreground">系列/卡包</label>
                  <Input
                    placeholder="例：S7R / Shiny Treasure ex"
                    value={form.cardSet}
                    onChange={(e) => setForm(f => ({ ...f, cardSet: e.target.value }))}
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-foreground">卡號</label>
                  <Input
                    placeholder="例：082/067"
                    value={form.cardNumber}
                    onChange={(e) => setForm(f => ({ ...f, cardNumber: e.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              {/* Grade + Buy Source */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-foreground">評級</label>
                  <Select value={form.grade} onValueChange={(v) => setForm(f => ({ ...f, grade: v }))}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="選擇評級" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未選擇</SelectItem>
                      {GRADE_OPTIONS.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.grade === "其他" && (
                    <Input
                      className="mt-1.5 h-11"
                      placeholder="請輸入評級..."
                      value={form.gradeCustom}
                      onChange={(e) => setForm(f => ({ ...f, gradeCustom: e.target.value }))}
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-foreground">買取來源</label>
                  <Select value={form.buySource} onValueChange={(v) => setForm(f => ({ ...f, buySource: v }))}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="選擇來源" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未選擇</SelectItem>
                      {BUY_SOURCE_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.buySource === "其他" && (
                    <Input
                      className="mt-1.5 h-11"
                      placeholder="請輸入來源..."
                      value={form.buySourceCustom}
                      onChange={(e) => setForm(f => ({ ...f, buySourceCustom: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              {/* Buy Price */}
              <div>
                <label className="text-sm font-medium mb-1.5 block text-foreground">買取金額 *</label>
                <div className="flex gap-2">
                  <Select value={form.buyPriceCurrency} onValueChange={(v) => setForm(f => ({ ...f, buyPriceCurrency: v as "HKD" | "JPY" | "USD" }))}>
                    <SelectTrigger className="w-28 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HKD">HKD</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.buyPriceOriginal}
                    onChange={(e) => setForm(f => ({ ...f, buyPriceOriginal: e.target.value }))}
                    className="flex-1 h-11"
                  />
                </div>
                {estimatedHkd !== null && form.buyPriceCurrency !== "HKD" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {formatHkd(estimatedHkd)} HKD（匯率：{rates[form.buyPriceCurrency as keyof typeof rates]}）
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-1.5 block text-foreground">備注</label>
                <Input
                  placeholder="選填備注"
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="h-11"
                />
              </div>
            </>
          )}
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">取消</Button>
          {(manualMode || isEdit) && (
            <Button onClick={handleSubmit} disabled={isPending} className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground">
              {isPending ? "儲存中..." : isEdit ? "更新記錄" : "新增買取"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sell Dialog ──────────────────────────────────────────────────── */
const SELL_CHANNEL_OPTIONS = [
  "平台自售",
  "拍賣（雅虎）",
  "拍賣（eBay）",
  "門市直接賣出",
  "個人交易",
  "其他",
];

function SellDialog({
  open, onClose, item, rates,
}: {
  open: boolean;
  onClose: () => void;
  item: CardInventoryItem;
  rates: { HKD: number; JPY: number; USD: number };
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    sellPriceCurrency: "HKD" as "HKD" | "JPY" | "USD",
    sellPriceOriginal: "",
    sellDate: new Date().toISOString().slice(0, 10),
    sellChannel: "__none__",
    sellChannelCustom: "",
  });

  const updateMutation = trpc.companyCardInventory.update.useMutation({
    onSuccess: () => {
      toast.success("已記錄賣出");
      utils.companyCardInventory.list.invalidate();
      utils.companyCardInventory.monthlySummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const estimatedHkd = useMemo(() => {
    const amt = parseFloat(form.sellPriceOriginal);
    if (!amt || isNaN(amt)) return null;
    const rate = rates[form.sellPriceCurrency as keyof typeof rates] ?? 1;
    return amt * rate;
  }, [form.sellPriceOriginal, form.sellPriceCurrency, rates]);

  const effectiveSellChannel = form.sellChannel === "其他" ? form.sellChannelCustom : (form.sellChannel === "__none__" ? "" : form.sellChannel);

  const handleSubmit = () => {
    const amt = parseFloat(form.sellPriceOriginal);
    if (!amt || isNaN(amt) || amt <= 0) return toast.error("請輸入有效的賣出金額");
    updateMutation.mutate({
      id: item.id,
      status: "sold",
      sellPriceCurrency: form.sellPriceCurrency,
      sellPriceOriginal: amt,
      sellDate: form.sellDate,
      sellChannel: effectiveSellChannel || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent bottomSheet className="sm:max-w-md overflow-hidden">
        {/* Green header */}
        <div className="bg-green-700 px-5 py-4 flex items-center gap-3 rounded-t-2xl sm:rounded-t-xl">
          <DialogTitle className="text-slate-900 text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            記錄賣出
          </DialogTitle>
        </div>
        {/* Scrollable content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(95dvh-130px)] sm:max-h-[calc(92vh-130px)]">
          {/* Item preview */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            {item.imageUrl ? (
              <LazyImage src={getProxiedImageUrl(item.imageUrl) ?? ""} alt={item.cardName} className="w-10 h-14 object-cover rounded flex-shrink-0" />
            ) : (
              <div className="w-10 h-14 bg-muted rounded flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{item.cardName}</div>
              <div className="text-xs text-muted-foreground">
                {[item.cardSet, item.cardNumber, item.grade].filter(Boolean).join(" · ")}
              </div>
              <div className="text-xs text-primary font-medium mt-0.5">買取成本：{formatHkd(item.buyPriceHkd)}</div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">賣出金額 *</label>
            <div className="flex gap-2">
              <Select value={form.sellPriceCurrency} onValueChange={(v) => setForm(f => ({ ...f, sellPriceCurrency: v as "HKD" | "JPY" | "USD" }))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HKD">HKD</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.sellPriceOriginal}
                onChange={(e) => setForm(f => ({ ...f, sellPriceOriginal: e.target.value }))}
                className="flex-1"
              />
            </div>
            {estimatedHkd !== null && form.sellPriceCurrency !== "HKD" && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈ {formatHkd(estimatedHkd)} HKD
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">賣出日期</label>
            <Input type="date" value={form.sellDate} onChange={(e) => setForm(f => ({ ...f, sellDate: e.target.value }))} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">賣出渠道</label>
            <Select value={form.sellChannel} onValueChange={(v) => setForm(f => ({ ...f, sellChannel: v }))}>
              <SelectTrigger><SelectValue placeholder="選擇渠道" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未選擇</SelectItem>
                {SELL_CHANNEL_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.sellChannel === "其他" && (
              <Input
                className="mt-1.5"
                placeholder="請輸入渠道..."
                value={form.sellChannelCustom}
                onChange={(e) => setForm(f => ({ ...f, sellChannelCustom: e.target.value }))}
              />
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">取消</Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-slate-900"
          >
            {updateMutation.isPending ? "儲存中..." : "確認賣出"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Monthly Summary Tabab ─────────────────────────────────────────── */
function MonthlySummaryTab({ year, onExportMonth }: { year: number; onExportMonth: (month: number) => void }) {
  const { data, isLoading } = trpc.companyCardInventory.monthlySummary.useQuery({ year });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">載入中...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 年度總買取 */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500">年度總買取</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">買入</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{formatHkd(data.yearTotal.totalBuyHkd)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{data.yearTotal.buyCount} 筆</p>
          </CardContent>
        </Card>
        {/* 年度總賣出 */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500">年度總賣出</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">賣出</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{formatHkd(data.yearTotal.totalSellHkd)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{data.yearTotal.soldCount} 筆</p>
          </CardContent>
        </Card>
        {/* 年度毛利 */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500">年度毛利</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                data.yearTotal.grossProfitHkd >= 0
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-red-50 text-red-600 border-red-100"
              }`}>{data.yearTotal.grossProfitHkd >= 0 ? "盈利" : "虧損"}</span>
            </div>
            <p className={`text-lg font-bold ${
              data.yearTotal.grossProfitHkd >= 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              {data.yearTotal.grossProfitHkd >= 0 ? "+" : ""}{formatHkd(data.yearTotal.grossProfitHkd)}
            </p>
          </CardContent>
        </Card>
        {/* 持有中 */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500">持有中</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">庫存</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{data.yearTotal.holdingCount} <span className="text-sm font-normal text-slate-400">件</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">月份</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">買取總額</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">賣出總額</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">毛利</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">買取筆數</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">已售/持有</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">匯出</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.months.map((m) => (
              <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{year}年{MONTHS[m.month - 1]}</td>
                <td className="px-4 py-3 text-right text-blue-600 font-medium">{m.buyCount > 0 ? formatHkd(m.totalBuyHkd) : <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{m.soldCount > 0 ? formatHkd(m.totalSellHkd) : <span className="text-slate-300">—</span>}</td>
                <td className={`px-4 py-3 text-right font-semibold ${m.grossProfitHkd > 0 ? "text-emerald-600" : m.grossProfitHkd < 0 ? "text-red-600" : "text-slate-300"}`}>
                  {m.buyCount > 0 || m.soldCount > 0 ? `${m.grossProfitHkd >= 0 ? "+" : ""}${formatHkd(m.grossProfitHkd)}` : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{m.buyCount > 0 ? m.buyCount : <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {m.buyCount > 0 ? `${m.soldCount}/${m.holdingCount}` : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {m.buyCount > 0 && (
                    <Button variant="outline" size="sm" onClick={() => onExportMonth(m.month)}
                      className="h-7 px-2 text-xs bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
                      <Download className="w-3 h-3 mr-1" />匯出
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */
export default function AdminCompanyCardInventory() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("records");
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showBatchSell, setShowBatchSell] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [editItem, setEditItem] = useState<CardInventoryItem | null>(null);
  const [sellItem, setSellItem] = useState<CardInventoryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "holding" | "sold">("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<"all" | "card" | "sealed">("all");
  const [page, setPage] = useState(1);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const { data: rates = { HKD: 1, JPY: 0.053, USD: 7.78 } } = trpc.companyCardInventory.getExchangeRates.useQuery();

  const { data: listData, isLoading } = trpc.companyCardInventory.list.useQuery({
    status: statusFilter,
    itemType: itemTypeFilter,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  const deleteMutation = trpc.companyCardInventory.delete.useMutation({
    onSuccess: () => {
      toast.success("已刪除記錄");
      utils.companyCardInventory.list.invalidate();
      utils.companyCardInventory.monthlySummary.invalidate();
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const cacheImagesToS3Mutation = trpc.companyCardInventory.cacheImagesToS3.useMutation({
    onSuccess: (data) => {
      toast.success(data.message ?? `圖片快取完成：${data.cached}/${data.total} 張`);
      utils.companyCardInventory.list.invalidate();
    },
    onError: (e) => toast.error(`快取失敗：${e.message}`),
  });
  const backfillImageUrlsMutation = trpc.companyCardInventory.backfillImageUrls.useMutation({
    onSuccess: (data) => {
      toast.success(`圖片補全完成：${data.updated}/${data.total} 筆記錄已更新`);
      utils.companyCardInventory.list.invalidate();
    },
    onError: (e) => toast.error(`補全失敗：${e.message}`),
  });

  const exportExcelMutation = trpc.companyCardInventory.exportExcel.useMutation();
  const exportPdfMutation = trpc.companyCardInventory.exportPdf.useMutation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportCurrent, setExportCurrent] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const [exportLabel, setExportLabel] = useState("");
  const [exportExt, setExportExt] = useState("");

  const handleExportExcel = async (month: number) => {
    try {
      const label = month > 0 ? `${selectedYear}_${String(month).padStart(2, "0")}` : `${selectedYear}`;
      setExportLabel(label);
      setExportExt("xlsx");
      setIsExporting(true);
      setExportProgress(10);
      setExportCurrent(0);
      setExportTotal(0);
      toast.info("正在生成 Excel，請稍候（約 30-60 秒）...");
      // Simulate progress while waiting for server
      let pct = 10;
      const timer = setInterval(() => {
        pct = Math.min(pct + 3, 85);
        setExportProgress(pct);
      }, 2000);
      try {
        const result = await exportExcelMutation.mutateAsync({ year: selectedYear, month });
        clearInterval(timer);
        setExportProgress(95);
        // Decode base64 and trigger download
        const byteChars = atob(result.base64);
        const byteNums = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteNums], { type: result.mimeType });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `BOXIUM_卡牌買賣記錄_${label}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        setExportProgress(100);
        toast.success("Excel 檔案已下載！");
        setTimeout(() => setIsExporting(false), 1000);
      } catch (innerErr: any) {
        clearInterval(timer);
        throw innerErr;
      }
    } catch (e: any) {
      setIsExporting(false);
      toast.error(`匯出失敗：${e?.message ?? "請重試"}`);
    }
  };

  const handleExportPdf = async (month: number) => {
    try {
      const label = month > 0 ? `${selectedYear}_${String(month).padStart(2, "0")}` : `${selectedYear}`;
      setExportLabel(label);
      setExportExt("pdf");
      setIsExporting(true);
      setExportProgress(10);
      setExportCurrent(0);
      setExportTotal(0);
      toast.info("正在生成 PDF，請稍候（約 30-60 秒）...");
      // Simulate progress while waiting for server
      let pct = 10;
      const timer = setInterval(() => {
        pct = Math.min(pct + 2, 85);
        setExportProgress(pct);
      }, 2000);
      try {
        const result = await exportPdfMutation.mutateAsync({ year: selectedYear, month });
        clearInterval(timer);
        setExportProgress(95);
        // Decode base64 and trigger download
        const byteChars = atob(result.base64);
        const byteNums = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteNums], { type: result.mimeType });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `BOXIUM_卡牌買賣記錄_${label}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        setExportProgress(100);
        toast.success("PDF 檔案已下載！");
        setTimeout(() => setIsExporting(false), 1000);
      } catch (innerErr: any) {
        clearInterval(timer);
        throw innerErr;
      }
    } catch (e: any) {
      setIsExporting(false);
      toast.error(`匯出失敗：${e?.message ?? "請重試"}`);
    }
  };

  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="admin-shell p-4 sm:p-6 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">公司買取及賣出記錄</h1>
          <p className="text-sm text-slate-500 mt-0.5">公司獨立買取賣出記錄，與個人記錄完全分離</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Secondary: 批量工具 dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 h-9">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                批量工具
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white border border-slate-200 shadow-md rounded-lg">
              <DropdownMenuLabel className="text-xs text-slate-400 font-normal">買取 / 賣出</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShowBatchForm(true)} className="gap-2 cursor-pointer text-slate-700 hover:bg-slate-50">
                <Layers className="w-4 h-4 text-blue-500" />批量買取
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBatchSell(true)} className="gap-2 cursor-pointer text-slate-700 hover:bg-slate-50">
                <TrendingDown className="w-4 h-4 text-emerald-500" />批量賣出
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuLabel className="text-xs text-slate-400 font-normal">圖片管理</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => backfillImageUrlsMutation.mutate()}
                disabled={backfillImageUrlsMutation.isPending}
                className="gap-2 cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <ImageOff className="w-4 h-4 text-orange-500" />
                {backfillImageUrlsMutation.isPending ? "補全中..." : "補全圖片"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => cacheImagesToS3Mutation.mutate()}
                disabled={cacheImagesToS3Mutation.isPending}
                className="gap-2 cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {cacheImagesToS3Mutation.isPending ? "上傳中..." : "快取圖片"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuLabel className="text-xs text-slate-400 font-normal">AI 功能</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShowClaimForm(true)} className="gap-2 cursor-pointer text-slate-700 hover:bg-slate-50">
                <Sparkles className="w-4 h-4 text-purple-500" />AI 智能拆單
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Primary CTA */}
          <Button
            onClick={() => { setEditItem(null); setShowBuyForm(true); }}
            size="sm"
            className="gap-1.5 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />新增買取
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="records" className="gap-1.5">
            <ShoppingBag className="w-4 h-4" />買取/賣出記錄
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <TrendingUp className="w-4 h-4" />月度總表
          </TabsTrigger>
        </TabsList>

                {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          {/* Search + Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜尋卡牌名稱、BN 編號或系列..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-8 border-0 bg-transparent focus-visible:ring-0 text-slate-800 placeholder:text-slate-400 text-sm"
              />
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-28 h-8 border-0 bg-transparent text-slate-600 text-sm focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-md">
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="holding">持有中</SelectItem>
                <SelectItem value="sold">已賣出</SelectItem>
              </SelectContent>
            </Select>
            <Select value={itemTypeFilter} onValueChange={(v) => { setItemTypeFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-28 h-8 border-0 bg-transparent text-slate-600 text-sm focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-md">
                <SelectItem value="all">全部類型</SelectItem>
                <SelectItem value="card">單卡</SelectItem>
                <SelectItem value="sealed">封裝商品</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-px h-5 bg-slate-200" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-xs"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setSearch(today);
                setPage(1);
              }}
            >
              <CalendarDays className="w-3.5 h-3.5" />今日
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => { setSearch(""); setStatusFilter("all"); setItemTypeFilter("all"); setPage(1); utils.companyCardInventory.list.invalidate(); }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="text-xs text-slate-500">共 {total} 筆記錄</div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">載入中...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>尚無記錄</p>
              <p className="text-xs mt-1">點擊「新增買取記錄」開始記錄</p>
            </div>
          ) : (
            <>
            {/* Mobile card list - visible only on small screens */}
            <div className="sm:hidden space-y-3">
              {items.map((item) => {
                const buyHkd = Number(item.buyPriceHkd);
                const sellHkd = item.sellPriceHkd ? Number(item.sellPriceHkd) : null;
                const profit = sellHkd !== null ? sellHkd - buyHkd : null;
                return (
                  <div key={item.id} className="border rounded-xl p-3 space-y-2.5 bg-card shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                        {item.imageUrl ? (
                          <LazyImage src={getProxiedImageUrl(item.imageUrl) ?? ""} alt={item.cardName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-4 h-4 text-muted-foreground/50" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs">{item.itemType === "card" ? "單卡" : "封裝"}</Badge>
                          <Badge className={item.status === "holding" ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 text-xs" : "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20 text-xs"}>
                            {item.status === "holding" ? "持有中" : "已賣出"}
                          </Badge>
                        </div>
                        <div className="font-semibold text-sm leading-tight">{item.cardName}</div>
                        {(item.cardSet || item.cardNumber || item.grade) && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{[item.cardSet, item.cardNumber, item.grade].filter(Boolean).join(" · ")}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">{formatDate(item.buyDate)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-muted/30 rounded-lg py-2">
                      <div>
                        <div className="text-muted-foreground mb-0.5">買取成本</div>
                        <div className="font-semibold text-primary text-sm">{formatHkd(item.buyPriceHkd)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-0.5">賣出金額</div>
                        <div className="font-semibold text-green-500 text-sm">{sellHkd !== null ? formatHkd(sellHkd) : "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-0.5">毛利</div>
                        <div className={`font-semibold text-sm ${profit === null ? "text-muted-foreground" : profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {profit === null ? "—" : (profit >= 0 ? "+" : "") + formatHkd(profit)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-0.5">
                      {item.status === "holding" && (
                        <Button variant="ghost" size="sm" onClick={() => setSellItem(item as CardInventoryItem)} className="h-8 px-3 text-xs text-green-500 hover:text-green-400 hover:bg-green-500/10 font-medium">
                          記錄賣出
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditItem(item as CardInventoryItem); setShowBuyForm(true); }} className="h-8 w-8">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(item.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table - hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">類型</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">卡牌/商品</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">買取成本</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">賣出金額</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">毛利</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">狀態</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">買取日期</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide max-w-[120px]">備注</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const buyHkd = Number(item.buyPriceHkd);
                    const sellHkd = item.sellPriceHkd ? Number(item.sellPriceHkd) : null;
                    const profit = sellHkd !== null ? sellHkd - buyHkd : null;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                            {item.itemType === "card" ? "單卡" : "封裝"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {/* Card image */}
                            <div className="w-9 h-12 flex-shrink-0 rounded overflow-hidden bg-muted">
                              {item.imageUrl ? (
                                <img
                                  src={getProxiedImageUrl(item.imageUrl) ?? ""}
                                  alt={item.cardName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageOff className="w-3 h-3 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 max-w-[180px] truncate">{item.cardName}</div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {[item.cardSet, item.cardNumber, item.grade].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-blue-600">
                          {formatHkd(item.buyPriceHkd)}
                          {item.buyPriceCurrency !== "HKD" && (
                            <div className="text-xs text-slate-400">{item.buyPriceCurrency} {Number(item.buyPriceOriginal).toLocaleString()}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {sellHkd !== null ? formatHkd(sellHkd) : <span className="text-slate-300">—</span>}
                          {item.sellPriceCurrency && item.sellPriceCurrency !== "HKD" && item.sellPriceOriginal && (
                            <div className="text-xs text-slate-400">{item.sellPriceCurrency} {Number(item.sellPriceOriginal).toLocaleString()}</div>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${profit === null ? "text-slate-300" : profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {profit === null ? "—" : `${profit >= 0 ? "+" : ""}${formatHkd(profit)}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "holding"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                              : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          }`}>
                            {item.status === "holding" ? "持有中" : "已賣出"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(item.buyDate)}</td>
                        <td className="px-4 py-3 max-w-[120px]">
                          {item.notes ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-slate-400 truncate block max-w-[110px] cursor-default">
                                  {item.notes}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[250px] whitespace-pre-wrap text-xs">
                                {item.notes}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-slate-200">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {item.status === "holding" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setSellItem(item as CardInventoryItem)}
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                記錄賣出
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => { setEditItem(item as CardInventoryItem); setShowBuyForm(true); }}
                              className="h-7 w-7 text-slate-400 hover:text-slate-600"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setDeleteConfirm(item.id)}
                              className="h-7 w-7 text-slate-300 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Monthly Summary Tab */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setSelectedYear(y => y - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold text-lg w-16 text-center">{selectedYear}</span>
              <Button variant="ghost" size="icon" onClick={() => setSelectedYear(y => y + 1)} disabled={selectedYear >= CURRENT_YEAR}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Export progress bar */}
              {isExporting && (
                <div className="w-full max-w-xs bg-muted rounded-lg px-3 py-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      正在生成 {exportExt.toUpperCase()}...
                    </span>
                    <span className="font-semibold text-foreground">{exportProgress}%</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  {exportTotal > 0 && (
                    <div className="text-xs text-muted-foreground text-right">
                      已處理圖片 {exportCurrent} / {exportTotal} 張
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
              {/* Excel export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
                    <Download className="w-4 h-4" />Excel 匯出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>選擇匯出範圍</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExportExcel(0)}>
                    {selectedYear} 年度（全年）
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <DropdownMenuItem key={m} onClick={() => handleExportExcel(m)}>
                      {selectedYear} 年 {m} 月
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* PDF export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
                    <Download className="w-4 h-4" />PDF 匯出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>選擇匯出範圍</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExportPdf(0)}>
                    {selectedYear} 年度（全年）
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <DropdownMenuItem key={m} onClick={() => handleExportPdf(m)}>
                      {selectedYear} 年 {m} 月
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              </div>{/* end flex gap-2 */}
            </div>{/* end flex flex-col */}
          </div>
          <MonthlySummaryTab year={selectedYear} onExportMonth={handleExportExcel} />
        </TabsContent>
      </Tabs>

      {/* Batch Sell Dialog */}
      {showBatchSell && (
        <BatchSellDialog
          open={showBatchSell}
          onClose={() => setShowBatchSell(false)}
          rates={rates}
        />
      )}
      {/* Batch Buy Dialog */}
      {showBatchForm && (
        <BatchBuyDialog
          open={showBatchForm}
          onClose={() => setShowBatchForm(false)}
          rates={rates}
        />
      )}

      {/* Buy Form Dialog */}
      {showBuyForm && (
        <BuyFormDialog
          key={editItem?.id ?? 'new'}
          open={showBuyForm}
          onClose={() => { setShowBuyForm(false); setEditItem(null); }}
          editItem={editItem}
          rates={rates}
        />
      )}

      {/* Sell Dialog */}
      {sellItem && (
        <SellDialog
          open={!!sellItem}
          onClose={() => setSellItem(null)}
          item={sellItem}
          rates={rates}
        />
      )}

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">此操作無法復原，確定要刪除這筆記錄嗎？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm !== null && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "刪除中..." : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* AI 智能拆單 Dialog */}
      <ClaimFormReviewDialog
        open={showClaimForm}
        onOpenChange={setShowClaimForm}
        onImported={() => {
          utils.companyCardInventory.list.invalidate();
          utils.companyCardInventory.monthlySummary.invalidate();
        }}
      />
    </div>
  );
}
