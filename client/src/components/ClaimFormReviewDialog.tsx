/**
 * ClaimFormReviewDialog — Two-Phase Architecture
 *
 * Phase 1 (extractClaimLines): PDF text extraction + LLM structured parse
 *   → ~5-10 sec, user immediately sees the extracted rows table
 *
 * Phase 2 (matchClaimLine × N): Per-row AI product matching, called in parallel batches
 *   → Progress bar shows X/N rows matched in real-time
 *   → User can review already-matched rows while others are still processing
 */
import { useState, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Sparkles, Upload, ChevronDown, ChevronUp, RefreshCw,
  Trash2, CheckCircle2, AlertCircle, Loader2, Package, CreditCard,
  FileText, Zap,
} from "lucide-react";

// ─── Types (mirrors server/services/claimFormParser.ts) ─────────────────────

interface ClaimFormLine {
  date: string;
  boughtNoteNo: string;
  seller: string;
  description: string;
  amount: number;
}

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

type MatchStatus = "pending" | "matching" | "done" | "error";

// ─── Multi-file batch state ──────────────────────────────────────────────────

type FileParseStatus = "pending" | "parsing" | "done" | "error";

interface PdfFileEntry {
  id: string; // unique per file
  file: File;
  status: FileParseStatus;
  lineCount?: number;
  error?: string;
}

interface EditableRow {
  lineIndex: number;
  date: string;
  boughtNoteNo: string;
  seller: string;
  description: string;
  totalAmount: number;
  matchStatus: MatchStatus;
  selectedCombinationIdx: number;
  combinations: ItemCombination[];
  editableItems: EditableItem[];
  expanded: boolean;
  notes?: string;
  sourceFileName?: string; // which PDF this row came from
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.7) return { label: "高", color: "text-green-600" };
  if (c >= 0.4) return { label: "中", color: "text-amber-600" };
  return { label: "低", color: "text-red-500" };
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

type Step = "upload" | "extracting" | "matching" | "review" | "importing";  // "upload" now shows multi-file selector

const MATCH_CONCURRENCY = 3; // parallel matchClaimLine calls

export function ClaimFormReviewDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<PdfFileEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const utils = trpc.useUtils();

  // ── tRPC mutations ──
  // Note: extractClaimLines is called per-file in processFiles(); we use utils.client directly
  const extractClaimLines = trpc.companyCardInventory.extractClaimLines.useMutation();

  const matchClaimLineMutation = trpc.companyCardInventory.matchClaimLine.useMutation();

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

  // ── Phase 2: parallel matching ──
  const runMatchingPhase = async (lines: ClaimFormLine[], initialRows: EditableRow[]) => {
    let completed = 0;

    // Mark all as pending
    setRows(initialRows.map(r => ({ ...r, matchStatus: "pending" as MatchStatus })));

    // Process in batches of MATCH_CONCURRENCY
    for (let batch = 0; batch < lines.length; batch += MATCH_CONCURRENCY) {
      if (abortRef.current) break;

      const batchLines = lines.slice(batch, batch + MATCH_CONCURRENCY);
      const batchIndices = batchLines.map((_, i) => batch + i);

      // Mark batch as "matching"
      setRows(prev => prev.map((r, i) =>
        batchIndices.includes(i) ? { ...r, matchStatus: "matching" as MatchStatus } : r
      ));

      // Fire all in parallel
      const results = await Promise.allSettled(
        batchLines.map((line, batchIdx) =>
          utils.client.companyCardInventory.matchClaimLine.mutate({
            lineIndex: batch + batchIdx,
            date: line.date,
            boughtNoteNo: line.boughtNoteNo,
            seller: line.seller,
            description: line.description,
            amount: line.amount,
          })
        )
      );

      if (abortRef.current) break;

      // Update rows with results
      setRows(prev => {
        const next = [...prev];
        results.forEach((result, batchIdx) => {
          const rowIdx = batch + batchIdx;
          if (result.status === "fulfilled") {
            const data = result.value;
            const combinations = data.combinations as ItemCombination[];
            next[rowIdx] = {
              ...next[rowIdx],
              matchStatus: "done",
              combinations,
              selectedCombinationIdx: 0,
              editableItems: combinations[0]
                ? combinationToEditableItems(combinations[0])
                : [],
              notes: data.notes,
            };
          } else {
            next[rowIdx] = {
              ...next[rowIdx],
              matchStatus: "error",
              notes: "匹配失敗，請手動輸入",
            };
          }
        });
        return next;
      });

      completed += batchLines.length;
      setMatchedCount(completed);
    }

    setStep("review");
  };

  const handleClose = useCallback(() => {
    abortRef.current = true;
    setStep("upload");
    setRows([]);
    setTotalCount(0);
    setMatchedCount(0);
    setPdfFiles([]);
    onOpenChange(false);
  }, [onOpenChange]);

  // ── Multi-file helpers ──

  /** Validate and add files to the queue (deduplicates by name+size) */
  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid: PdfFileEntry[] = [];
    for (const file of arr) {
      if (file.type !== "application/pdf") {
        toast.error(`${file.name} 不是 PDF 格式，已跳過`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 超過 10MB 限制，已跳過`);
        continue;
      }
      valid.push({ id: `${file.name}-${file.size}-${Date.now()}`, file, status: "pending" });
    }
    if (valid.length > 0) {
      setPdfFiles(prev => {
        // deduplicate by name+size
        const existing = new Set(prev.map(e => `${e.file.name}-${e.file.size}`));
        const newEntries = valid.filter(e => !existing.has(`${e.file.name}-${e.file.size}`));
        return [...prev, ...newEntries];
      });
    }
    // reset input so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Convert a File to base64 string */
  const fileToBase64 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    return btoa(binary);
  };

  /** Parse all pending files, merge lines, then start matching phase */
  const startProcessing = async () => {
    if (pdfFiles.length === 0) return;
    abortRef.current = false;
    setStep("extracting");

    const allLines: (ClaimFormLine & { sourceFileName: string })[] = [];

    // Parse each PDF sequentially to avoid overwhelming the server
    for (const entry of pdfFiles) {
      if (abortRef.current) break;
      setPdfFiles(prev => prev.map(e => e.id === entry.id ? { ...e, status: "parsing" } : e));
      try {
        const base64 = await fileToBase64(entry.file);
        const data = await utils.client.companyCardInventory.extractClaimLines.mutate({ pdfBase64: base64 });
        setPdfFiles(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: "done", lineCount: data.lines.length } : e
        ));
        for (const line of data.lines) {
          allLines.push({ ...line, sourceFileName: entry.file.name });
        }
      } catch (err: any) {
        setPdfFiles(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: "error", error: err.message } : e
        ));
        toast.error(`${entry.file.name} 解析失敗：${err.message}`);
      }
    }

    if (allLines.length === 0) {
      toast.error("所有 PDF 均未提取到交易行，請確認文件格式");
      setStep("upload");
      return;
    }

    // Build initial rows with sourceFileName
    const initialRows: EditableRow[] = allLines.map((line, idx) => ({
      lineIndex: idx,
      date: line.date,
      boughtNoteNo: line.boughtNoteNo,
      seller: line.seller,
      description: line.description,
      totalAmount: line.amount,
      matchStatus: "pending",
      selectedCombinationIdx: 0,
      combinations: [],
      editableItems: [],
      expanded: false,
      sourceFileName: line.sourceFileName,
    }));

    setRows(initialRows);
    setTotalCount(allLines.length);
    setMatchedCount(0);
    setStep("matching");

    await runMatchingPhase(allLines, initialRows);
  };

  // ── Drag and drop handlers ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
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

  const doneCount = rows.filter(r => r.matchStatus === "done").length;
  const matchedWithItems = rows.filter(r => r.editableItems.length > 0).length;
  const progressPct = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-white border-slate-200">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI 智能拆單
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            上傳 Director Claim Form PDF，AI 自動從 BOXIUM 卡牌庫中智能匹配買取組合
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">

          {/* ── Step 1: Upload (multi-file) ── */}
          {step === "upload" && (
            <div className="flex flex-col gap-4 px-6 py-5">
              {/* Drop zone */}
              <label
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragOver
                    ? "border-purple-500 bg-purple-50 scale-[1.01]"
                    : "border-slate-300 hover:border-purple-400 hover:bg-purple-50/50"
                }`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className={`w-8 h-8 mb-2 transition-colors ${isDragOver ? "text-purple-500" : "text-slate-400"}`} />
                <span className={`text-sm font-medium transition-colors ${isDragOver ? "text-purple-700" : "text-slate-700"}`}>
                  {isDragOver ? "放開以加入檔案" : "點擊或拖放上傳 PDF（支援多檔）"}
                </span>
                <span className="text-xs text-slate-400 mt-1">支援 Director Claim Form 格式，每檔最大 10MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {/* File queue */}
              {pdfFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">已選擇 {pdfFiles.length} 個檔案</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {pdfFiles.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="flex-1 text-xs text-slate-700 truncate">{entry.file.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {(entry.file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          onClick={() => setPdfFiles(prev => prev.filter(e => e.id !== entry.id))}
                          className="p-0.5 hover:text-red-500 text-slate-400 transition-colors shrink-0"
                          title="移除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Start button */}
              <Button
                onClick={startProcessing}
                disabled={pdfFiles.length === 0}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2"
              >
                <Sparkles className="w-4 h-4" />
                開始 AI 解析 {pdfFiles.length > 0 ? `${pdfFiles.length} 個 PDF` : ""}
              </Button>
            </div>
          )}

          {/* ── Step 1b: Extracting PDFs ── */}
          {step === "extracting" && (
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-sm font-semibold text-slate-800">正在解析 PDF 文件...</span>
              </div>
              <div className="space-y-2">
                {pdfFiles.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      entry.status === "done" ? "border-emerald-200 bg-emerald-50/40"
                      : entry.status === "error" ? "border-red-200 bg-red-50/30"
                      : entry.status === "parsing" ? "border-blue-200 bg-blue-50/40"
                      : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {entry.status === "parsing" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
                    {entry.status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {entry.status === "error" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    {entry.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                    <span className="flex-1 text-xs text-slate-700 truncate">{entry.file.name}</span>
                    {entry.status === "done" && (
                      <span className="text-xs text-emerald-600 shrink-0">{entry.lineCount} 行</span>
                    )}
                    {entry.status === "error" && (
                      <span className="text-xs text-red-400 shrink-0 truncate max-w-[120px]">{entry.error}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400">預計每個檔案需 5-10 秒，請耐心等候...</p>
            </div>
          )}

          {/* ── Step 2: Matching (show rows + progress) ── */}
          {step === "matching" && (
            <div className="flex flex-col h-full">
              {/* Progress header */}
              <div className="px-6 py-3 border-b border-slate-200 bg-blue-50/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-slate-700">
                      AI 正在匹配卡牌組合...
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {matchedCount} / {totalCount} 行完成
                  </span>
                </div>
                <Progress value={progressPct} className="h-1.5" />
              </div>

              <ScrollArea className="flex-1 px-4 py-2">
                <div className="space-y-2 pb-4">
                  {rows.map((row) => (
                    <div
                      key={row.lineIndex}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        row.matchStatus === "done"
                          ? row.editableItems.length > 0
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-red-200 bg-red-50/30"
                          : row.matchStatus === "matching"
                          ? "border-blue-200 bg-blue-50/40"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      {row.matchStatus === "matching" && (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                      )}
                      {row.matchStatus === "done" && row.editableItems.length > 0 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      {row.matchStatus === "done" && row.editableItems.length === 0 && (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      {row.matchStatus === "error" && (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      {row.matchStatus === "pending" && (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{row.date}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0 border-slate-300 text-slate-600">
                            {row.boughtNoteNo}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 truncate mt-0.5">{row.description}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-800 shrink-0">
                        HK${row.totalAmount.toLocaleString()}
                      </span>
                      {row.matchStatus === "done" && row.editableItems.length > 0 && (
                        <span className="text-xs text-emerald-600 shrink-0">
                          {row.editableItems.reduce((s, i) => s + i.quantity, 0)} 件
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ── Review Step ── */}
          {(step === "review" || step === "importing") && (
            <div className="flex flex-col h-full">
              {/* Summary bar */}
              <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm">
                <span className="text-slate-700">共 <strong>{totalCount}</strong> 行</span>
                <span className="text-emerald-600">已匹配 <strong>{matchedWithItems}</strong> 行</span>
                {totalCount - matchedWithItems > 0 && (
                  <span className="text-red-500">未匹配 <strong>{totalCount - matchedWithItems}</strong> 行</span>
                )}
                <span className="ml-auto text-slate-400 text-xs">覆核並確認後點擊「批量匯入」</span>
              </div>

              <ScrollArea className="flex-1 px-4 py-2">
                <div className="space-y-3 pb-4">
                  {rows.map((row, rowIdx) => {
                    const editableTotal = calcEditableTotal(row.editableItems);
                    const deviation = Math.abs(editableTotal - row.totalAmount);
                    const deviationPct = row.totalAmount > 0 ? deviation / row.totalAmount : 0;
                    const hasItems = row.editableItems.length > 0;

                    return (
                      <div
                        key={row.lineIndex}
                        className={`border rounded-xl overflow-hidden ${
                          hasItems ? "border-slate-200" : "border-red-200"
                        }`}
                      >
                        {/* Row header */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleExpand(rowIdx)}
                        >
                          {hasItems
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-slate-400">{row.date}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0 border-slate-300 text-slate-600">
                                {row.boughtNoteNo}
                              </Badge>
                              <span className="text-xs text-slate-400 truncate max-w-[200px]">{row.seller}</span>
                              {row.sourceFileName && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0 border-purple-200 text-purple-600 bg-purple-50">
                                  {row.sourceFileName.replace(/\.pdf$/i, "")}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm font-medium text-slate-800">
                                目標：HK${row.totalAmount.toLocaleString()}
                              </span>
                              {hasItems && (
                                <>
                                  <span className="text-xs text-slate-300">→</span>
                                  <span className={`text-sm font-medium ${
                                    deviationPct <= 0.1 ? "text-emerald-600"
                                    : deviationPct <= 0.2 ? "text-amber-600"
                                    : "text-red-500"
                                  }`}>
                                    組合：HK${editableTotal.toLocaleString()}
                                  </span>
                                  <span className="text-xs text-slate-400">{deviationLabel(deviationPct)}</span>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 border-slate-300">
                                    {row.editableItems.reduce((s, i) => s + i.quantity, 0)} 件
                                  </Badge>
                                </>
                              )}
                              {!hasItems && <span className="text-xs text-red-400">未找到匹配</span>}
                            </div>
                          </div>
                          {row.expanded
                            ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          }
                        </div>

                        {/* Expanded detail */}
                        {row.expanded && (
                          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-3">
                            {/* Description */}
                            <p className="text-xs text-slate-500 italic">{row.description}</p>

                            {/* Alternative combinations */}
                            {row.combinations.length > 1 && (
                              <div>
                                <p className="text-xs text-slate-500 mb-2">替代方案（點擊切換）：</p>
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
                                            ? "border-purple-400 bg-purple-50 text-purple-700 font-medium"
                                            : "border-slate-200 hover:border-purple-300 text-slate-600 bg-white"
                                        }`}
                                      >
                                        方案 {comboIdx + 1}：HK${combo.totalPrice.toLocaleString()}
                                        <span className={`ml-1.5 ${color}`}>({label})</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                {row.combinations[row.selectedCombinationIdx] && (
                                  <p className="text-xs text-slate-400 mt-1.5">
                                    {row.combinations[row.selectedCombinationIdx].reason}
                                  </p>
                                )}
                              </div>
                            )}

                            <Separator className="bg-slate-200" />

                            {/* Editable items list */}
                            <div className="space-y-2">
                              <p className="text-xs text-slate-500">商品組合（可修改數量/價格）：</p>
                              {row.editableItems.map((item, itemIdx) => (
                                <div
                                  key={itemIdx}
                                  className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-100"
                                >
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-contain rounded shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center shrink-0">
                                      {item.productType === "sealed_product"
                                        ? <Package className="w-4 h-4 text-slate-400" />
                                        : <CreditCard className="w-4 h-4 text-slate-400" />
                                      }
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800 truncate">{item.name}</p>
                                    <p className="text-xs text-slate-400">{item.series || "—"}</p>
                                  </div>
                                  <Badge variant="outline" className="text-xs shrink-0 border-slate-200 text-slate-600">
                                    {item.productType === "sealed_product" ? "封裝" : "單卡"}
                                  </Badge>
                                  {/* Quantity */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-xs text-slate-400">×</span>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={e => updateItem(rowIdx, itemIdx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                      className="w-14 h-7 text-xs text-center px-1 border-slate-200"
                                    />
                                  </div>
                                  {/* Price */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-xs text-slate-400">HK$</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={item.buyPrice}
                                      onChange={e => updateItem(rowIdx, itemIdx, { buyPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                      className="w-20 h-7 text-xs text-center px-1 border-slate-200"
                                    />
                                  </div>
                                  <button
                                    onClick={() => removeItem(rowIdx, itemIdx)}
                                    className="p-1 hover:text-red-500 text-slate-400 transition-colors shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              {row.editableItems.length === 0 && (
                                <p className="text-xs text-red-400 py-1">此行無匹配商品，將不會被匯入</p>
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
          {step === "importing" && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
              <p className="text-sm text-slate-600">正在批量匯入買取記錄...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={step === "importing"}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            取消
          </Button>
          {(step === "review" || step === "importing") && (
            <Button
              onClick={handleImport}
              disabled={
                step === "importing" ||
                rows.filter(r => r.editableItems.length > 0).length === 0
              }
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {step === "importing" ? (
                <><Loader2 className="w-4 h-4 animate-spin" />匯入中...</>
              ) : (
                <><RefreshCw className="w-4 h-4" />批量匯入 {rows.filter(r => r.editableItems.length > 0).length} 行記錄</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
