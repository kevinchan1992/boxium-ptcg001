/**
 * ClaimFormReviewDialog
 * 上傳 Claim Form PDF → AI 智能拆單（多件商品組合）→ 人工覆核 → 批量匯入
 */
import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Sparkles, Upload, ChevronDown, ChevronUp, RefreshCw,
  Trash2, CheckCircle2, AlertCircle, Loader2, Package, CreditCard,
} from "lucide-react";

// ─── Types (mirrors server/services/claimFormParser.ts) ─────────────────────

interface SuggestedItem {
  cardId: number;
  productType: "single_card" | "sealed_product";
  name: string;
  nameJa: string | null;
  imageUrl: string | null;
  series: string | null;
  setName: string | null;
  suggestedBuyPrice: number;
  quantity: number;
}

interface ItemCombination {
  items: SuggestedItem[];
  totalPrice: number;
  deviation: number;
  deviationPct: number;
  confidence: number;
  reason: string;
}

interface ParsedClaimRow {
  lineIndex: number;
  date: string;
  boughtNoteNo: string;
  seller: string;
  description: string;
  totalAmount: number;
  combinations: ItemCombination[];
  selectedCombination: ItemCombination | null;
  notes?: string;
}

// ─── Local editable state ────────────────────────────────────────────────────

interface EditableItem {
  cardId: number;
  productType: "single_card" | "sealed_product";
  name: string;
  imageUrl: string | null;
  series: string | null;
  buyPrice: number;
  quantity: number;
}

interface EditableRow {
  lineIndex: number;
  date: string;
  boughtNoteNo: string;
  seller: string;
  description: string;
  totalAmount: number;
  selectedCombinationIdx: number;
  combinations: ItemCombination[];
  // Editable items (derived from selected combination, user can modify)
  editableItems: EditableItem[];
  expanded: boolean;
  notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.7) return { label: "高", color: "text-green-400" };
  if (c >= 0.4) return { label: "中", color: "text-yellow-400" };
  return { label: "低", color: "text-red-400" };
}

function deviationLabel(pct: number): string {
  const p = Math.round(pct * 100);
  return p === 0 ? "完全吻合" : `偏差 ${p}%`;
}

function combinationToEditableItems(combo: ItemCombination): EditableItem[] {
  return combo.items.map(item => ({
    cardId: item.cardId,
    productType: item.productType,
    name: item.name,
    imageUrl: item.imageUrl,
    series: item.series || item.setName,
    buyPrice: item.suggestedBuyPrice,
    quantity: item.quantity,
  }));
}

function calcEditableTotal(items: EditableItem[]): number {
  return items.reduce((sum, i) => sum + i.buyPrice * i.quantity, 0);
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = "upload" | "analyzing" | "review" | "importing";

export function ClaimFormReviewDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [totalLines, setTotalLines] = useState(0);
  const [matchedLines, setMatchedLines] = useState(0);

  const analyzeClaimForm = trpc.companyCardInventory.analyzeClaimForm.useMutation({
    onSuccess: (data) => {
      const parsed = data.rows as ParsedClaimRow[];
      const editableRows: EditableRow[] = parsed.map(r => ({
        lineIndex: r.lineIndex,
        date: r.date,
        boughtNoteNo: r.boughtNoteNo,
        seller: r.seller,
        description: r.description,
        totalAmount: r.totalAmount,
        selectedCombinationIdx: 0,
        combinations: r.combinations,
        editableItems: r.selectedCombination
          ? combinationToEditableItems(r.selectedCombination)
          : [],
        expanded: false,
        notes: r.notes,
      }));
      setRows(editableRows);
      setTotalLines(data.totalLines);
      setMatchedLines(data.matchedLines);
      setStep("review");
    },
    onError: (e) => {
      toast.error(`分析失敗：${e.message}`);
      setStep("upload");
    },
  });

  const importClaimFormRows = trpc.companyCardInventory.importClaimFormRows.useMutation({
    onSuccess: (data) => {
      toast.success(`成功匯入 ${data.inserted} 筆買取記錄！`);
      onImported();
      handleClose();
    },
    onError: (e) => {
      toast.error(`匯入失敗：${e.message}`);
      setStep("review");
    },
  });

  const handleClose = useCallback(() => {
    setStep("upload");
    setRows([]);
    setTotalLines(0);
    setMatchedLines(0);
    onOpenChange(false);
  }, [onOpenChange]);

  // ── File upload ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("請上傳 PDF 格式的文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超過 10MB");
      return;
    }

    setStep("analyzing");
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const base64 = btoa(binary);
    analyzeClaimForm.mutate({ pdfBase64: base64 });
  };

  // ── Row editing helpers ──
  const selectCombination = (rowIdx: number, comboIdx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const combo = r.combinations[comboIdx];
      return {
        ...r,
        selectedCombinationIdx: comboIdx,
        editableItems: combo ? combinationToEditableItems(combo) : [],
      };
    }));
  };

  const updateItem = (rowIdx: number, itemIdx: number, updates: Partial<EditableItem>) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const newItems = r.editableItems.map((item, j) =>
        j === itemIdx ? { ...item, ...updates } : item
      );
      return { ...r, editableItems: newItems };
    }));
  };

  const removeItem = (rowIdx: number, itemIdx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      return { ...r, editableItems: r.editableItems.filter((_, j) => j !== itemIdx) };
    }));
  };

  const toggleExpand = (rowIdx: number) => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, expanded: !r.expanded } : r
    ));
  };

  // ── Import ──
  const handleImport = () => {
    const validRows = rows.filter(r => r.editableItems.length > 0);
    if (validRows.length === 0) {
      toast.error("沒有可匯入的記錄");
      return;
    }
    setStep("importing");
    importClaimFormRows.mutate(
      validRows.map(r => ({
        date: r.date,
        boughtNoteNo: r.boughtNoteNo,
        seller: r.seller,
        notes: r.notes,
        items: r.editableItems.map(item => ({
          cardId: item.cardId,
          productType: item.productType,
          buyPrice: item.buyPrice,
          quantity: item.quantity,
        })),
      }))
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI 智能拆單
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            上傳 Director Claim Form PDF，AI 自動從 BOXIUM 卡牌庫中智能匹配買取組合
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* ── Upload Step ── */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 px-6">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-purple-500/40 rounded-xl cursor-pointer hover:border-purple-500/70 hover:bg-purple-500/5 transition-colors">
                <Upload className="w-10 h-10 text-purple-400 mb-3" />
                <span className="text-sm font-medium text-purple-300">點擊或拖放上傳 Claim Form PDF</span>
                <span className="text-xs text-muted-foreground mt-1">支援 Director Claim Form 格式，最大 10MB</span>
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          )}

          {/* ── Analyzing Step ── */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <p className="text-sm text-muted-foreground">AI 正在解析文件並從卡牌庫中匹配最佳組合...</p>
              <p className="text-xs text-muted-foreground/60">這可能需要 15-30 秒，請稍候</p>
            </div>
          )}

          {/* ── Review Step ── */}
          {step === "review" && (
            <div className="flex flex-col h-full">
              {/* Summary bar */}
              <div className="flex items-center gap-4 px-6 py-3 bg-muted/30 border-b border-border text-sm">
                <span>共 <strong>{totalLines}</strong> 行</span>
                <span className="text-green-400">已匹配 <strong>{matchedLines}</strong> 行</span>
                {totalLines - matchedLines > 0 && (
                  <span className="text-red-400">未匹配 <strong>{totalLines - matchedLines}</strong> 行</span>
                )}
                <span className="ml-auto text-muted-foreground text-xs">覆核並確認後點擊「批量匯入」</span>
              </div>

              <ScrollArea className="flex-1 px-4 py-2">
                <div className="space-y-3 pb-4">
                  {rows.map((row, rowIdx) => {
                    const editableTotal = calcEditableTotal(row.editableItems);
                    const deviation = Math.abs(editableTotal - row.totalAmount);
                    const deviationPct = row.totalAmount > 0 ? deviation / row.totalAmount : 0;
                    const hasItems = row.editableItems.length > 0;

                    return (
                      <div key={row.lineIndex} className={`border rounded-lg overflow-hidden ${hasItems ? "border-border" : "border-red-500/40"}`}>
                        {/* Row header */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => toggleExpand(rowIdx)}
                        >
                          {hasItems
                            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">{row.date}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">{row.boughtNoteNo}</Badge>
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{row.seller}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm font-medium">目標：HK${row.totalAmount.toLocaleString()}</span>
                              {hasItems && (
                                <>
                                  <span className="text-xs text-muted-foreground">→</span>
                                  <span className={`text-sm font-medium ${deviationPct <= 0.1 ? "text-green-400" : deviationPct <= 0.2 ? "text-yellow-400" : "text-red-400"}`}>
                                    組合：HK${editableTotal.toLocaleString()}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{deviationLabel(deviationPct)}</span>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    {row.editableItems.reduce((s, i) => s + i.quantity, 0)} 件
                                  </Badge>
                                </>
                              )}
                              {!hasItems && <span className="text-xs text-red-400">未找到匹配</span>}
                            </div>
                          </div>
                          {row.expanded
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          }
                        </div>

                        {/* Expanded detail */}
                        {row.expanded && (
                          <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-3">
                            {/* Alternative combinations */}
                            {row.combinations.length > 1 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">替代方案（點擊切換）：</p>
                                <div className="flex flex-wrap gap-2">
                                  {row.combinations.map((combo, comboIdx) => {
                                    const { label, color } = confidenceLabel(combo.confidence);
                                    const isSelected = row.selectedCombinationIdx === comboIdx;
                                    return (
                                      <button
                                        key={comboIdx}
                                        onClick={() => selectCombination(rowIdx, comboIdx)}
                                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                          isSelected
                                            ? "border-purple-500 bg-purple-500/20 text-purple-300"
                                            : "border-border hover:border-purple-500/50 text-muted-foreground"
                                        }`}
                                      >
                                        方案 {comboIdx + 1}：HK${combo.totalPrice.toLocaleString()}
                                        <span className={`ml-1.5 ${color}`}>({label})</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                {row.combinations[row.selectedCombinationIdx] && (
                                  <p className="text-xs text-muted-foreground/70 mt-1.5">
                                    {row.combinations[row.selectedCombinationIdx].reason}
                                  </p>
                                )}
                              </div>
                            )}

                            <Separator />

                            {/* Editable items list */}
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">商品組合（可修改數量/價格）：</p>
                              {row.editableItems.map((item, itemIdx) => (
                                <div key={itemIdx} className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-2">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-contain rounded shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center shrink-0">
                                      {item.productType === "sealed_product"
                                        ? <Package className="w-4 h-4 text-muted-foreground" />
                                        : <CreditCard className="w-4 h-4 text-muted-foreground" />
                                      }
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.series || "—"}</p>
                                  </div>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {item.productType === "sealed_product" ? "封裝" : "單卡"}
                                  </Badge>
                                  {/* Quantity */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-xs text-muted-foreground">×</span>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={e => updateItem(rowIdx, itemIdx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                      className="w-14 h-7 text-xs text-center px-1"
                                    />
                                  </div>
                                  {/* Price */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-xs text-muted-foreground">HK$</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={item.buyPrice}
                                      onChange={e => updateItem(rowIdx, itemIdx, { buyPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                      className="w-20 h-7 text-xs text-center px-1"
                                    />
                                  </div>
                                  <button
                                    onClick={() => removeItem(rowIdx, itemIdx)}
                                    className="p-1 hover:text-red-400 text-muted-foreground transition-colors shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              {row.editableItems.length === 0 && (
                                <p className="text-xs text-red-400/70 py-1">此行無匹配商品，將不會被匯入</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ── Importing Step ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <p className="text-sm text-muted-foreground">正在批量匯入買取記錄...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={step === "importing"}>
            取消
          </Button>
          {step === "review" && (
            <Button
              onClick={handleImport}
              disabled={rows.filter(r => r.editableItems.length > 0).length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-slate-900 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              批量匯入 {rows.filter(r => r.editableItems.length > 0).length} 行記錄
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
