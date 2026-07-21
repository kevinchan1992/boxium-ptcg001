import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Package,
  CreditCard,
} from "lucide-react";

// ─── Types (mirrored from server) ────────────────────────────────────────────

interface SuggestedItem {
  cardId: number;
  productType: "single_card" | "sealed_product";
  name: string;
  nameJa: string | null;
  imageUrl: string | null;
  series: string | null;
  setName: string | null;
  suggestedBuyPrice: number;
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
  suggestions: SuggestedItem[];
  selected: SuggestedItem | null;
  notes?: string;
}

// ─── Row Card ─────────────────────────────────────────────────────────────────

function RowCard({
  row,
  onUpdate,
}: {
  row: ParsedClaimRow & { overrideBuyPrice?: number; selectedIndex?: number };
  onUpdate: (updates: Partial<ParsedClaimRow & { overrideBuyPrice?: number; selectedIndex?: number }>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = row.selected;
  const confidence = selected?.confidence ?? 0;
  const confidenceColor =
    confidence >= 0.7 ? "text-green-400" : confidence >= 0.4 ? "text-yellow-400" : "text-red-400";
  const confidenceLabel =
    confidence >= 0.7 ? "高" : confidence >= 0.4 ? "中" : "低";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* Product image */}
        <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
          {selected?.imageUrl ? (
            <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-muted-foreground">{row.date}</span>
            <Badge variant="outline" className="text-xs px-1.5 py-0">{row.boughtNoteNo}</Badge>
          </div>

          {selected ? (
            <>
              <p className="text-sm font-medium leading-tight truncate">{selected.name}</p>
              <p className="text-xs text-muted-foreground truncate">{selected.series || selected.setName || "—"}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={selected.productType === "sealed_product" ? "default" : "secondary"} className="text-xs px-1.5 py-0">
                  {selected.productType === "sealed_product" ? "卡盒" : "單卡"}
                </Badge>
                <span className={`text-xs font-medium ${confidenceColor}`}>
                  信心度：{confidenceLabel} ({Math.round(confidence * 100)}%)
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">未找到匹配卡牌</p>
          )}
        </div>

        {/* Price */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-muted-foreground">文件金額</p>
          <p className="text-sm font-bold text-orange-400">HK${row.totalAmount.toLocaleString()}</p>
          {selected && (
            <>
              <p className="text-xs text-muted-foreground mt-1">買取價</p>
              <Input
                type="number"
                className="w-24 h-7 text-xs text-right mt-0.5"
                value={row.overrideBuyPrice ?? selected.suggestedBuyPrice}
                onChange={(e) => onUpdate({ overrideBuyPrice: Number(e.target.value) })}
              />
            </>
          )}
        </div>
      </div>

      {/* Seller info */}
      <div className="px-3 pb-2">
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium">賣家：</span>{row.seller}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium">原始描述：</span>{row.description}
        </p>
      </div>

      {/* Expand to show alternatives */}
      {row.suggestions.length > 1 && (
        <>
          <button
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground border-t border-border transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "收起" : `查看其他 ${row.suggestions.length - 1} 個建議`}
          </button>

          {expanded && (
            <div className="border-t border-border bg-muted/30 p-2 space-y-1.5">
              {row.suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    row.selected?.cardId === s.cardId
                      ? "bg-primary/20 border border-primary/40"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => onUpdate({ selected: s, overrideBuyPrice: s.suggestedBuyPrice, selectedIndex: idx })}
                >
                  <div className="w-8 h-10 flex-shrink-0 rounded overflow-hidden bg-muted">
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-muted-foreground m-auto mt-3" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.reason}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-orange-400">HK${s.suggestedBuyPrice.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{Math.round(s.confidence * 100)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function ClaimFormReviewDialog({ open, onOpenChange, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "analyzing" | "review" | "importing" | "done">("upload");
  const [rows, setRows] = useState<(ParsedClaimRow & { overrideBuyPrice?: number; selectedIndex?: number })[]>([]);
  const [stats, setStats] = useState({ totalLines: 0, matchedLines: 0, unmatchedLines: 0 });

  const analyzeClaimForm = trpc.companyCardInventory.analyzeClaimForm.useMutation({
    onSuccess: (data) => {
      setRows(data.rows.map(r => ({ ...r })));
      setStats({ totalLines: data.totalLines, matchedLines: data.matchedLines, unmatchedLines: data.unmatchedLines });
      setStep("review");
    },
    onError: (err) => {
      toast.error(`分析失敗：${err.message}`);
      setStep("upload");
    },
  });

  const importClaimFormRows = trpc.companyCardInventory.importClaimFormRows.useMutation({
    onSuccess: (data) => {
      toast.success(`成功匯入 ${data.inserted} 筆買取記錄！`);
      setStep("done");
      onImported?.();
    },
    onError: (err) => {
      toast.error(`匯入失敗：${err.message}`);
      setStep("review");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("請上傳 PDF 文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超過 10MB");
      return;
    }

    setStep("analyzing");
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const base64 = btoa(binary);
    analyzeClaimForm.mutate({ pdfBase64: base64 });
  };

  const handleUpdateRow = (idx: number, updates: Partial<typeof rows[0]>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  };

  const handleImport = () => {
    const toImport = rows
      .filter(r => r.selected !== null)
      .map(r => ({
        date: r.date,
        boughtNoteNo: r.boughtNoteNo,
        seller: r.seller,
        cardId: r.selected!.cardId,
        productType: r.selected!.productType,
        buyPrice: r.overrideBuyPrice ?? r.selected!.suggestedBuyPrice,
        notes: r.notes,
      }));

    if (toImport.length === 0) {
      toast.error("沒有可匯入的記錄");
      return;
    }

    setStep("importing");
    importClaimFormRows.mutate(toImport);
  };

  const handleReset = () => {
    setStep("upload");
    setRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const matchedCount = rows.filter(r => r.selected !== null).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" />
            AI 智能拆單 — 分析 Claim Form
          </DialogTitle>
          <DialogDescription>
            上傳 Director Claim Form PDF，AI 將自動解析每行金額，從 BOXIUM 卡牌庫中智能匹配對應的卡牌/卡盒，並建立公司買取記錄。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Step: Upload */}
          {step === "upload" && (
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-orange-400/60 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">點擊上傳 Claim Form PDF</p>
                <p className="text-sm text-muted-foreground mt-1">支援格式：PDF（最大 10MB）</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* Step: Analyzing */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
              <div className="text-center">
                <p className="font-medium">AI 正在分析文件...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  正在解析每行金額，並從 BOXIUM 卡牌庫中智能匹配對應商品
                </p>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {(step === "review" || step === "importing") && (
            <>
              {/* Stats bar */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>共 <strong>{stats.totalLines}</strong> 行</span>
                </div>
                <div className="flex items-center gap-1.5 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>已匹配 <strong>{matchedCount}</strong> 行</span>
                </div>
                {stats.unmatchedLines > 0 && (
                  <div className="flex items-center gap-1.5 text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>未匹配 <strong>{stats.unmatchedLines}</strong> 行</span>
                  </div>
                )}
                <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={handleReset}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重新上傳
                </Button>
              </div>

              {/* Row list */}
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-3">
                  {rows.map((row, idx) => (
                    <RowCard
                      key={idx}
                      row={row}
                      onUpdate={(updates) => handleUpdateRow(idx, updates)}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Import button */}
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  將匯入 <strong className="text-foreground">{matchedCount}</strong> 筆買取記錄至公司買取賣出記錄
                </p>
                <Button
                  onClick={handleImport}
                  disabled={matchedCount === 0 || step === "importing"}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {step === "importing" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      匯入中...
                    </>
                  ) : (
                    `一鍵匯入 ${matchedCount} 筆記錄`
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <div className="text-center">
                <p className="text-lg font-semibold">匯入完成！</p>
                <p className="text-sm text-muted-foreground mt-1">
                  已成功建立公司買取記錄，可在「買取/賣出記錄」頁面查看。
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset}>繼續上傳</Button>
                <Button onClick={() => onOpenChange(false)}>關閉</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
