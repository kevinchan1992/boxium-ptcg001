import { useState, useMemo, useRef, useEffect } from "react";
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
import { toast } from "sonner";
import {
  Plus, Search, Edit, Trash2, ShoppingBag, TrendingUp,
  Package, RefreshCw, Download, ChevronLeft, ChevronRight, X, ImageOff,
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
    grade: editItem?.grade ?? "",
    gradeCustom: "",
    buyPriceCurrency: editItem?.buyPriceCurrency ?? "HKD",
    buyPriceOriginal: editItem?.buyPriceOriginal ?? "",
    buyDate: editItem?.buyDate ? new Date(editItem.buyDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    buySource: editItem?.buySource ?? "",
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

  const effectiveGrade = form.grade === "其他" ? form.gradeCustom : form.grade;
  const effectiveBuySource = form.buySource === "其他" ? form.buySourceCustom : form.buySource;

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
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯買取記錄" : "新增買取記錄"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
                <label className="text-sm font-medium mb-1 block">卡牌/商品名稱 *</label>
                <Input
                  placeholder="例：Charizard VMAX / 閃焰王者 第一彈 卡盒"
                  value={form.cardName}
                  onChange={(e) => setForm(f => ({ ...f, cardName: e.target.value }))}
                />
              </div>

              {/* Set + Card Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">系列/卡包</label>
                  <Input
                    placeholder="例：S7R / Shiny Treasure ex"
                    value={form.cardSet}
                    onChange={(e) => setForm(f => ({ ...f, cardSet: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">卡號</label>
                  <Input
                    placeholder="例：082/067"
                    value={form.cardNumber}
                    onChange={(e) => setForm(f => ({ ...f, cardNumber: e.target.value }))}
                  />
                </div>
              </div>

              {/* Grade + Buy Source */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">評級</label>
                  <Select value={form.grade} onValueChange={(v) => setForm(f => ({ ...f, grade: v }))}>
                    <SelectTrigger><SelectValue placeholder="選擇評級" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">未選擇</SelectItem>
                      {GRADE_OPTIONS.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.grade === "其他" && (
                    <Input
                      className="mt-1.5"
                      placeholder="請輸入評級..."
                      value={form.gradeCustom}
                      onChange={(e) => setForm(f => ({ ...f, gradeCustom: e.target.value }))}
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">買取來源</label>
                  <Select value={form.buySource} onValueChange={(v) => setForm(f => ({ ...f, buySource: v }))}>
                    <SelectTrigger><SelectValue placeholder="選擇來源" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">未選擇</SelectItem>
                      {BUY_SOURCE_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.buySource === "其他" && (
                    <Input
                      className="mt-1.5"
                      placeholder="請輸入來源..."
                      value={form.buySourceCustom}
                      onChange={(e) => setForm(f => ({ ...f, buySourceCustom: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              {/* Buy Price */}
              <div>
                <label className="text-sm font-medium mb-1 block">買取金額 *</label>
                <div className="flex gap-2">
                  <Select value={form.buyPriceCurrency} onValueChange={(v) => setForm(f => ({ ...f, buyPriceCurrency: v as "HKD" | "JPY" | "USD" }))}>
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
                    value={form.buyPriceOriginal}
                    onChange={(e) => setForm(f => ({ ...f, buyPriceOriginal: e.target.value }))}
                    className="flex-1"
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
                <label className="text-sm font-medium mb-1 block">備注</label>
                <Input
                  placeholder="選填備注"
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          {(manualMode || isEdit) && (
            <Button onClick={handleSubmit} disabled={isPending} className="bg-[#06038D] hover:bg-[#06038D]/90">
              {isPending ? "儲存中..." : isEdit ? "更新" : "新增買取"}
            </Button>
          )}
        </DialogFooter>
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
    sellChannel: "",
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

  const effectiveSellChannel = form.sellChannel === "其他" ? form.sellChannelCustom : form.sellChannel;

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>記錄賣出</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Item preview */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
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
                <SelectItem value="">未選擇</SelectItem>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {updateMutation.isPending ? "儲存中..." : "確認賣出"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Monthly Summary Tab ─────────────────────────────────────────── */
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
        <Button
          onClick={() => { setEditItem(null); setShowBuyForm(true); }}
          className="bg-[#06038D] hover:bg-[#06038D]/90 text-white gap-2"
        >
          <Plus className="w-4 h-4" />新增買取記錄
        </Button>
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
            <Button variant="ghost" size="icon" onClick={() => utils.cardInventory.list.invalidate()}>
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
            <div className="overflow-x-auto rounded-lg border">
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
              <Button variant="outline" size="sm" onClick={() => handleExportExcel(0)} className="gap-1.5">
                <Download className="w-4 h-4" />Excel 年度報表
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportPdf(0)} className="gap-1.5">
                <Download className="w-4 h-4" />PDF 年度報表
              </Button>
            </div>
          </div>
          <MonthlySummaryTab year={selectedYear} onExportMonth={handleExportExcel} />
        </TabsContent>
      </Tabs>

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
