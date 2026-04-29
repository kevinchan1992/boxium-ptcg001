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
import {
  Plus, Search, Edit, Trash2, ShoppingBag, TrendingUp,
  Package, RefreshCw, Download, ChevronLeft, ChevronRight, X, ImageOff,
  Copy, Layers, MessageSquare, TrendingDown, CalendarDays,
} from "lucide-react";

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
function formatHkd(val: string | number | null | undefined): string {
  if (val == null) return "—";
  const n = Number(val);
  return `HK$${n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ─── Inline Card Search (for batch rows) ───────────────────────────── */
function InlineCardSearch({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (card: CardSearchResult) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = trpc.cards.search.useQuery(
    { query: value, limit: 6 },
    { enabled: value.length >= 2 }
  );
  const results: CardSearchResult[] = (data?.cards ?? []) as CardSearchResult[];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => value.length >= 2 && setOpen(true)}
        placeholder={placeholder ?? "搜尋卡牌..."}
        className="pl-8 h-8 text-sm"
      />
      {value && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { onChange(""); setOpen(false); }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
      )}
      {open && value.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-[60] top-full mt-1 left-0 right-0 bg-background border rounded-lg shadow-xl max-h-[340px] overflow-y-auto"
        >
          {isFetching && <div className="p-2.5 text-xs text-muted-foreground text-center">搜尋中...</div>}
          {!isFetching && results.length === 0 && <div className="p-2.5 text-xs text-muted-foreground text-center">找不到卡牌，請手動輸入</div>}
          {results.map((card) => (
            <button
              key={card.id}
              className="w-full flex items-center gap-2 p-2 hover:bg-muted/60 text-left transition-colors"
              onClick={() => { onSelect(card); setOpen(false); }}
            >
              <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-muted">
                {card.imageUrl
                  ? <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-3 h-3 text-muted-foreground" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">{card.name}</div>
                <div className="text-xs text-muted-foreground truncate">{[card.setName, card.cardNumber].filter(Boolean).join(" · ")}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
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
  const { data: holdingData, isLoading: holdingLoading } = trpc.cardInventory.list.useQuery({
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

  const batchSellMutation = trpc.cardInventory.batchSell.useMutation({
    onSuccess: (data) => {
      toast.success(`已批量記錄 ${data.count} 筆賣出`);
      utils.cardInventory.list.invalidate();
      utils.cardInventory.monthlySummary.invalidate();
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
          <DialogTitle className="text-white text-lg font-semibold flex items-center gap-2">
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
                      ? <img src={item.imageUrl} alt={item.cardName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-3 h-3 text-muted-foreground" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{item.cardName}</div>
                    <div className="text-xs text-muted-foreground">{[item.cardSet, item.cardNumber, item.grade].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="text-xs text-[#06038D] font-medium flex-shrink-0">{formatHkd(item.buyPriceHkd)}</div>
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
                          ? <img src={row.imageUrl} alt={row.cardName} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-3 h-3 text-muted-foreground" /></div>
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-xs truncate">{row.cardName}</div>
                        <div className="text-xs text-muted-foreground truncate">{[row.cardSet, row.grade].filter(Boolean).join(" · ")}</div>
                        <div className="text-xs text-[#06038D]">成本 {formatHkd(row.buyPriceHkd)}</div>
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
              <span className="font-medium text-[#06038D]">{formatHkd(totalBuyHkd)}</span>
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
            className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white gap-2"
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

  // Rows
  const [rows, setRows] = useState<BatchRow[]>([makeBatchRow()]);

  const batchCreateMutation = trpc.cardInventory.batchCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`已批量新增 ${data.count} 筆買取記錄`);
      utils.cardInventory.list.invalidate();
      utils.cardInventory.monthlySummary.invalidate();
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
        <div className="bg-[#06038D] px-5 py-4 flex items-center gap-3 rounded-t-2xl sm:rounded-t-xl">
          <DialogTitle className="text-white text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5" />
            批量買取記錄
          </DialogTitle>
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
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={row.id} className="space-y-1">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_90px_80px_28px_28px] gap-1.5 items-center">
              {/* Card search */}
              <div className="flex items-center gap-1.5">
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt={row.cardName} className="w-7 h-10 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-7 h-10 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground font-bold">{idx + 1}</span>
                  </div>
                )}
                <InlineCardSearch
                  value={row.cardName}
                  onChange={(v) => updateRow(row.id, { cardName: v, imageUrl: v ? row.imageUrl : "", linkedCardId: v ? row.linkedCardId : null })}
                  onSelect={(card) => updateRow(row.id, {
                    cardName: card.name,
                    cardSet: card.setName ?? "",
                    cardNumber: card.cardNumber ?? "",
                    imageUrl: card.imageUrl ?? "",
                    linkedCardId: card.id,
                  })}
                  placeholder="卡牌名稱..."
                />
              </div>
              {/* Set */}
              <Input
                value={row.cardSet}
                onChange={(e) => updateRow(row.id, { cardSet: e.target.value })}
                placeholder="系列"
                className="h-8 text-xs"
              />
              {/* Card number */}
              <Input
                value={row.cardNumber}
                onChange={(e) => updateRow(row.id, { cardNumber: e.target.value })}
                placeholder="卡號"
                className="h-8 text-xs"
              />
              {/* Price */}
              <div className="flex gap-0.5">
                <Select value={row.buyPriceCurrency} onValueChange={(v) => updateRow(row.id, { buyPriceCurrency: v as "HKD" | "JPY" | "USD" })}>
                  <SelectTrigger className="w-14 h-8 text-xs px-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HKD">HKD</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={row.buyPriceOriginal}
                  onChange={(e) => updateRow(row.id, { buyPriceOriginal: e.target.value })}
                  className="h-8 text-xs min-w-0"
                />
              </div>
              {/* Duplicate */}
              <button
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="複製此行"
                onClick={() => duplicateRow(row.id)}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {/* Remove */}
              <button
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-30"
                title="刪除此行"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
              >
                <X className="w-3.5 h-3.5" />
              </button>
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
          <span className="font-semibold text-[#06038D]">
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
            className="flex-1 h-11 bg-[#06038D] hover:bg-[#06038D]/90 text-white gap-2"
          >
            <Layers className="w-4 h-4" />
            {batchCreateMutation.isPending ? "儲存中..." : `批量新增 ${rows.filter(r => r.cardName.trim() && parseFloat(r.buyPriceOriginal) > 0).length} 筆`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Card Search Picker ─────────────────────────────────────────────── */
function CardSearchPicker({
  onSelect,
  onManualMode,
}: {
  onSelect: (card: CardSearchResult) => void;
  onManualMode: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = trpc.cards.search.useQuery(
    { query, limit: 8 },
    { enabled: query.length >= 2 }
  );

  const results: CardSearchResult[] = (data?.cards ?? []) as CardSearchResult[];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium block">搜尋平台卡牌</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="輸入卡牌名稱、日文名或卡號..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="pl-9 pr-8"
        />
        {query && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(""); setOpen(false); }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {open && query.length >= 2 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 top-full mt-1 left-0 right-0 bg-background border rounded-lg shadow-lg max-h-72 overflow-y-auto"
          >
            {isFetching && (
              <div className="p-3 text-sm text-muted-foreground text-center">搜尋中...</div>
            )}
            {!isFetching && results.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground text-center">找不到卡牌</div>
            )}
            {results.map((card) => (
              <button
                key={card.id}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/60 text-left transition-colors"
                onClick={() => {
                  onSelect(card);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-muted">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{card.name}</div>
                  {card.nameJa && <div className="text-xs text-muted-foreground truncate">{card.nameJa}</div>}
                  <div className="text-xs text-muted-foreground">
                    {[card.setName, card.cardNumber].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {card.latestPrice && (
                  <div className="text-xs text-[#06038D] font-medium flex-shrink-0">
                    {formatHkd(card.latestPrice)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
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

  const [form, setForm] = useState({
    itemType: editItem?.itemType ?? "card",
    cardName: editItem?.cardName ?? "",
    cardSet: editItem?.cardSet ?? "",
    cardNumber: editItem?.cardNumber ?? "",
    grade: editItem?.grade ?? "__none__",
    gradeCustom: "",
    buyPriceCurrency: editItem?.buyPriceCurrency ?? "HKD",
    buyPriceOriginal: editItem?.buyPriceOriginal ?? "",
    buyDate: editItem?.buyDate ? new Date(editItem.buyDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    buySource: editItem?.buySource ?? "__none__",
    buySourceCustom: "",
    notes: editItem?.notes ?? "",
    imageUrl: editItem?.imageUrl ?? "",
    linkedCardId: editItem?.linkedCardId ?? null as number | null,
  });

  const createMutation = trpc.cardInventory.create.useMutation({
    onSuccess: () => {
      toast.success("已新增買取記錄");
      utils.cardInventory.list.invalidate();
      utils.cardInventory.monthlySummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.cardInventory.update.useMutation({
    onSuccess: () => {
      toast.success("已更新記錄");
      utils.cardInventory.list.invalidate();
      utils.cardInventory.monthlySummary.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCardSelect = (card: CardSearchResult) => {
    setSelectedCard(card);
    setManualMode(true);
    setForm(f => ({
      ...f,
      cardName: card.name,
      cardSet: card.setName ?? "",
      cardNumber: card.cardNumber ?? "",
      imageUrl: card.imageUrl ?? "",
      linkedCardId: card.id,
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
        <div className="bg-[#06038D] px-5 py-4 flex items-center gap-3 rounded-t-2xl sm:rounded-t-xl">
          <DialogTitle className="text-white text-lg font-semibold">
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

          {/* Selected card preview */}
          {(manualMode || isEdit) && (
            <>
              {/* Show selected card preview */}
              {selectedCard && (
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                  <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
                    {selectedCard.imageUrl ? (
                      <img src={selectedCard.imageUrl} alt={selectedCard.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{selectedCard.name}</div>
                    <div className="text-xs text-muted-foreground">{[selectedCard.setName, selectedCard.cardNumber].filter(Boolean).join(" · ")}</div>
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
            <Button onClick={handleSubmit} disabled={isPending} className="flex-1 h-11 bg-[#06038D] hover:bg-[#06038D]/90 text-white">
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

  const updateMutation = trpc.cardInventory.update.useMutation({
    onSuccess: () => {
      toast.success("已記錄賣出");
      utils.cardInventory.list.invalidate();
      utils.cardInventory.monthlySummary.invalidate();
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
          <DialogTitle className="text-white text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            記錄賣出
          </DialogTitle>
        </div>
        {/* Scrollable content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(95dvh-130px)] sm:max-h-[calc(92vh-130px)]">
          {/* Item preview */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.cardName} className="w-10 h-14 object-cover rounded flex-shrink-0" />
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
              <div className="text-xs text-[#06038D] font-medium mt-0.5">買取成本：{formatHkd(item.buyPriceHkd)}</div>
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
            className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
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
  const { data, isLoading } = trpc.cardInventory.monthlySummary.useQuery({ year });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">載入中...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#06038D] text-white">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs opacity-80">年度總買取</p>
            <p className="text-lg font-bold">{formatHkd(data.yearTotal.totalBuyHkd)}</p>
            <p className="text-xs opacity-70">{data.yearTotal.buyCount} 筆</p>
          </CardContent>
        </Card>
        <Card className="bg-green-600 text-white">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs opacity-80">年度總賣出</p>
            <p className="text-lg font-bold">{formatHkd(data.yearTotal.totalSellHkd)}</p>
            <p className="text-xs opacity-70">{data.yearTotal.soldCount} 筆</p>
          </CardContent>
        </Card>
        <Card className={data.yearTotal.grossProfitHkd >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950"}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">年度毛利</p>
            <p className={`text-lg font-bold ${data.yearTotal.grossProfitHkd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {data.yearTotal.grossProfitHkd >= 0 ? "+" : ""}{formatHkd(data.yearTotal.grossProfitHkd)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">持有中</p>
            <p className="text-lg font-bold text-amber-600">{data.yearTotal.holdingCount} 件</p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">月份</th>
              <th className="text-right p-3 font-medium">買取總額</th>
              <th className="text-right p-3 font-medium">賣出總額</th>
              <th className="text-right p-3 font-medium">毛利</th>
              <th className="text-right p-3 font-medium">買取筆數</th>
              <th className="text-right p-3 font-medium">已售/持有</th>
              <th className="text-center p-3 font-medium">匯出</th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.month} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{year}年{MONTHS[m.month - 1]}</td>
                <td className="p-3 text-right text-[#06038D] font-medium">{m.buyCount > 0 ? formatHkd(m.totalBuyHkd) : "—"}</td>
                <td className="p-3 text-right text-green-600 font-medium">{m.soldCount > 0 ? formatHkd(m.totalSellHkd) : "—"}</td>
                <td className={`p-3 text-right font-semibold ${m.grossProfitHkd > 0 ? "text-emerald-600" : m.grossProfitHkd < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {m.buyCount > 0 || m.soldCount > 0 ? `${m.grossProfitHkd >= 0 ? "+" : ""}${formatHkd(m.grossProfitHkd)}` : "—"}
                </td>
                <td className="p-3 text-right text-muted-foreground">{m.buyCount > 0 ? m.buyCount : "—"}</td>
                <td className="p-3 text-right text-muted-foreground">
                  {m.buyCount > 0 ? `${m.soldCount}/${m.holdingCount}` : "—"}
                </td>
                <td className="p-3 text-center">
                  {m.buyCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => onExportMonth(m.month)} className="h-7 px-2 text-xs">
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
export default function AdminCardInventory() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("records");
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showBatchSell, setShowBatchSell] = useState(false);
  const [editItem, setEditItem] = useState<CardInventoryItem | null>(null);
  const [sellItem, setSellItem] = useState<CardInventoryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "holding" | "sold">("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<"all" | "card" | "sealed">("all");
  const [page, setPage] = useState(1);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const { data: rates = { HKD: 1, JPY: 0.053, USD: 7.78 } } = trpc.cardInventory.getExchangeRates.useQuery();

  const { data: listData, isLoading } = trpc.cardInventory.list.useQuery({
    status: statusFilter,
    itemType: itemTypeFilter,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  const deleteMutation = trpc.cardInventory.delete.useMutation({
    onSuccess: () => {
      toast.success("已刪除記錄");
      utils.cardInventory.list.invalidate();
      utils.cardInventory.monthlySummary.invalidate();
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleExportExcel = (month: number) => {
    const url = `/api/card-inventory/export/excel?year=${selectedYear}&month=${month}`;
    window.open(url, "_blank");
  };

  const handleExportPdf = (month: number) => {
    const url = `/api/card-inventory/export/pdf?year=${selectedYear}&month=${month}`;
    window.open(url, "_blank");
  };

  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#06038D]">卡牌買取及賣出記錄</h1>
          <p className="text-sm text-muted-foreground mt-0.5">記錄公司買取及賣出卡牌，用於財務報告及報稅</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBatchForm(true)}
            className="gap-2 border-[#06038D] text-[#06038D] hover:bg-[#06038D]/5"
          >
            <Layers className="w-4 h-4" />批量買取
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowBatchSell(true)}
            className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
          >
            <TrendingDown className="w-4 h-4" />批量賣出
          </Button>
          <Button
            onClick={() => { setEditItem(null); setShowBuyForm(true); }}
            className="bg-[#06038D] hover:bg-[#06038D]/90 text-white gap-2"
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
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋卡牌名稱或系列..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="holding">持有中</SelectItem>
                <SelectItem value="sold">已賣出</SelectItem>
              </SelectContent>
            </Select>
            <Select value={itemTypeFilter} onValueChange={(v) => { setItemTypeFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部類型</SelectItem>
                <SelectItem value="card">單卡</SelectItem>
                <SelectItem value="sealed">封裝商品</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setSearch(today);
                setPage(1);
              }}
            >
              <CalendarDays className="w-3.5 h-3.5" />今日
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setSearch(""); setStatusFilter("all"); setItemTypeFilter("all"); setPage(1); utils.cardInventory.list.invalidate(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">共 {total} 筆記錄</div>

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
                          <img src={item.imageUrl} alt={item.cardName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-4 h-4 text-muted-foreground/50" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs">{item.itemType === "card" ? "單卡" : "封裝"}</Badge>
                          <Badge className={item.status === "holding" ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs" : "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs"}>
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
                        <div className="font-semibold text-[#06038D] text-sm">{formatHkd(item.buyPriceHkd)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-0.5">賣出金額</div>
                        <div className="font-semibold text-green-600 text-sm">{sellHkd !== null ? formatHkd(sellHkd) : "—"}</div>
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
                        <Button variant="ghost" size="sm" onClick={() => setSellItem(item as CardInventoryItem)} className="h-8 px-3 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 font-medium">
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
            <div className="hidden sm:block overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">類型</th>
                    <th className="text-left p-3 font-medium">卡牌/商品</th>
                    <th className="text-right p-3 font-medium">買取成本</th>
                    <th className="text-right p-3 font-medium">賣出金額</th>
                    <th className="text-right p-3 font-medium">毛利</th>
                    <th className="text-left p-3 font-medium">狀態</th>
                    <th className="text-left p-3 font-medium">買取日期</th>
                    <th className="text-center p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const buyHkd = Number(item.buyPriceHkd);
                    const sellHkd = item.sellPriceHkd ? Number(item.sellPriceHkd) : null;
                    const profit = sellHkd !== null ? sellHkd - buyHkd : null;
                    return (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {item.itemType === "card" ? "單卡" : "封裝"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            {/* Card image */}
                            <div className="w-9 h-12 flex-shrink-0 rounded overflow-hidden bg-muted">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
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
                              <div className="font-medium max-w-[180px] truncate">{item.cardName}</div>
                              <div className="text-xs text-muted-foreground">
                                {[item.cardSet, item.cardNumber, item.grade].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right font-medium text-[#06038D]">
                          {formatHkd(item.buyPriceHkd)}
                          {item.buyPriceCurrency !== "HKD" && (
                            <div className="text-xs text-muted-foreground">{item.buyPriceCurrency} {Number(item.buyPriceOriginal).toLocaleString()}</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-medium text-green-600">
                          {sellHkd !== null ? formatHkd(sellHkd) : "—"}
                          {item.sellPriceCurrency && item.sellPriceCurrency !== "HKD" && item.sellPriceOriginal && (
                            <div className="text-xs text-muted-foreground">{item.sellPriceCurrency} {Number(item.sellPriceOriginal).toLocaleString()}</div>
                          )}
                        </td>
                        <td className={`p-3 text-right font-semibold ${profit === null ? "text-muted-foreground" : profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {profit === null ? "—" : `${profit >= 0 ? "+" : ""}${formatHkd(profit)}`}
                        </td>
                        <td className="p-3">
                          <Badge className={item.status === "holding"
                            ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                            : "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                          }>
                            {item.status === "holding" ? "持有中" : "已賣出"}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{formatDate(item.buyDate)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            {item.status === "holding" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setSellItem(item as CardInventoryItem)}
                                className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                記錄賣出
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => { setEditItem(item as CardInventoryItem); setShowBuyForm(true); }}
                              className="h-7 w-7"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setDeleteConfirm(item.id)}
                              className="h-7 w-7 text-destructive hover:text-destructive"
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
            <div className="flex gap-2">
              {/* Excel export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
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
                  <Button variant="outline" size="sm" className="gap-1.5">
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
            </div>
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
    </div>
  );
}
