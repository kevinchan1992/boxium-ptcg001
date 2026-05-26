/**
 * CollectionSection — Personal Card Collection feature
 * Renders inside Profile.tsx as the "collection" section.
 *
 * Features:
 * - Dashboard stats (total market value, cost, P&L, holdings)
 * - Collection list with sorting / filtering
 * - Add via text search or photo AI identification
 * - Edit / delete individual entries
 * - Market price mode toggle (PSA 10 reference vs grade-matched)
 * - Public toggle per entry
 * - PDF export (all or public only)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, TrendingUp, TrendingDown, Package, DollarSign,
  Camera, Search, Edit2, Trash2, Download, Filter,
  ChevronDown, ChevronUp, Eye, EyeOff, Loader2,
  BarChart3, Star, ArrowUpRight, ArrowDownRight, Minus,
  SlidersHorizontal, RefreshCw, X, AlertTriangle,
  CheckSquare2, Square, CalendarDays, Trash, ArrowLeftRight,
} from "lucide-react";
import { TradeSheet } from "@/components/TradeSheet";
import ReactCrop, { type Crop as CropType } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { getProxiedImageUrl } from "@/lib/utils";
import { LazyImage } from "@/components/LazyImage";

// ─── Brand tokens ─────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";
const LOSS_RED = "#dc2626";

// ─── Grade options per grader ─────────────────────────────────
const GRADER_GRADES: Record<string, string[]> = {
  PSA: ["PSA 10", "PSA 9", "PSA 8", "PSA 7", "PSA 6", "PSA 5", "PSA 4", "PSA 3", "PSA 2", "PSA 1"],
  BGS: ["BGS 10", "BGS 9.5", "BGS 9", "BGS 8.5", "BGS 8", "BGS 7.5", "BGS 7", "BGS 6", "BGS 5"],
  TAG: ["TAG 10", "TAG 9", "TAG 8", "TAG 7"],
  RAW: ["A品", "B品", "C品", "D品"],
  UNGRADED: [],
};

const GRADERS = ["PSA", "BGS", "TAG", "RAW", "UNGRADED"] as const;

// ─── Helper: P&L colour ───────────────────────────────────────
function gainColor(pct: number | null | undefined) {
  if (pct == null) return "text-gray-400";
  if (pct > 0) return "text-emerald-600";
  if (pct < 0) return "text-red-500";
  return "text-gray-500";
}
function gainBg(pct: number | null | undefined) {
  if (pct == null) return "bg-gray-50";
  if (pct > 0) return "bg-emerald-50";
  if (pct < 0) return "bg-red-50";
  return "bg-gray-50";
}

// ─── Image compression helper ─────────────────────────────────
function compressImage(dataUrl: string, maxDim = 800, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      let tw = w, th = h;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { tw = maxDim; th = Math.round(h * (maxDim / w)); }
        else { th = maxDim; tw = Math.round(w * (maxDim / h)); }
      }
      if (tw === w && th === h && dataUrl.startsWith("data:image/jpeg")) { resolve(dataUrl); return; }
      const canvas = document.createElement("canvas");
      canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, tw, th);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

async function getCroppedImg(image: HTMLImageElement, crop: CropType): Promise<string> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width!; canvas.height = crop.height!;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, crop.x! * scaleX, crop.y! * scaleY, crop.width! * scaleX, crop.height! * scaleY, 0, 0, crop.width!, crop.height!);
  return canvas.toDataURL("image/jpeg", 0.9);
}

// ─── Stats Card ───────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent, glow, highlight }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent?: string; glow?: boolean; highlight?: 'yellow' | 'blue' | 'default';
}) {
  const isGain = accent === GAIN_GREEN;
  const isLoss = accent === LOSS_RED;
  const isYellow = highlight === 'yellow';
  const isBlue = highlight === 'blue';

  const accentBarColor = isGain ? GAIN_GREEN : isLoss ? LOSS_RED : isYellow ? BRAND_YELLOW : isBlue ? BRAND_BLUE : BRAND_BLUE;
  const iconBg = isGain ? '#dcfce7' : isLoss ? '#fee2e2' : isYellow ? `${BRAND_YELLOW}50` : `${BRAND_BLUE}12`;
  const valueColor = isGain ? GAIN_GREEN : isLoss ? LOSS_RED : isYellow ? '#1a1200' : isBlue ? BRAND_BLUE : '#111827';

  return (
    <div
      className="relative rounded-2xl p-4 flex flex-col gap-1 overflow-hidden"
      style={{
        border: isYellow ? `1.5px solid ${BRAND_YELLOW}` : '1px solid #e5e7eb',
        background: isYellow
          ? `linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)`
          : 'white',
        boxShadow: isYellow
          ? `0 2px 10px ${BRAND_YELLOW}60`
          : '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
        style={{ background: accentBarColor }} />
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between mb-1 pl-1">
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: isYellow ? '#92700a' : '#9ca3af' }}>
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
      </div>
      {/* Main value */}
      <span
        className="text-base sm:text-xl font-black tabular-nums tracking-tight leading-none pl-1"
        style={{ color: valueColor }}
      >
        {value}
      </span>
      {/* ↑ text-xl on desktop, text-base on mobile via parent class override */}
      {/* Sub text */}
      {sub && (
        <span
          className="text-xs font-semibold tabular-nums pl-1"
          style={{ color: isGain ? GAIN_GREEN : isLoss ? LOSS_RED : isYellow ? '#92700a' : '#9ca3af' }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Grade badge ──────────────────────────────────────────────
function GradeBadge({ grader, grade }: { grader: string; grade?: string | null }) {
  const label = grade ? `${grade}` : grader;
  const colors: Record<string, string> = {
    PSA: "bg-yellow-100 text-yellow-800 border-yellow-300",
    BGS: "bg-blue-100 text-blue-800 border-blue-300",
    TAG: "bg-purple-100 text-purple-800 border-purple-300",
    RAW: "bg-emerald-100 text-emerald-800 border-emerald-300",
    UNGRADED: "bg-gray-100 text-gray-600 border-gray-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${colors[grader] ?? "bg-gray-100 text-gray-600 border-gray-300"}`}>
      {label}
    </span>
  );
}

// ─── Add / Edit Form ──────────────────────────────────────────
interface CollectionFormData {
  cardId: number;
  cardName: string;
  cardImageUrl?: string | null;
  cardSeries?: string | null;
  grader: string;
  grade: string;
  quantity: number;
  purchasePrice: string;
  purchasedAt: string;
  notes: string;
  isPublic: boolean;
}

const DEFAULT_FORM: CollectionFormData = {
  cardId: 0, cardName: "", cardImageUrl: null, cardSeries: null,
  grader: "PSA", grade: "PSA 10", quantity: 1,
  purchasePrice: "", purchasedAt: "", notes: "", isPublic: false,
};

interface AddEditSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editItem?: any | null;
  onSuccess: () => void;
  prefillCard?: { id: number; name: string; imageUrl?: string | null; series?: string | null } | null;
}

export function AddEditSheet({ open, onOpenChange, editItem, onSuccess, prefillCard }: AddEditSheetProps) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"select" | "details">(editItem ? "details" : "select");
  const [form, setForm] = useState<CollectionFormData>(DEFAULT_FORM);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [showPhotoSearch, setShowPhotoSearch] = useState(false);

  // Photo search state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCropView, setShowCropView] = useState(false);
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<CropType>();
  const [searchStep, setSearchStep] = useState<null | "compress" | "identify" | "search" | "done">(null);
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageSearchMutation = trpc.cards.searchByImage.useMutation();

  const addMutation = trpc.profile.addToCollection.useMutation({
    onSuccess: () => {
      toast.success(t("profile.collection.addSuccess"));
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
      onSuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error(t("profile.collection.addFailed", { error: e.message })),
  });

  const updateMutation = trpc.profile.updateCollectionItem.useMutation({
    onSuccess: () => {
      toast.success(t("profile.collection.updateSuccess"));
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
      onSuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error(t("profile.collection.updateFailed", { error: e.message })),
  });

  // Track previous open state to only reset form when sheet opens (false→true)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return; // Skip if sheet is closing or staying open
    if (editItem) {
      setForm({
        cardId: editItem.cardId,
        cardName: editItem.card?.name ?? "",
        cardImageUrl: editItem.card?.imageUrl ?? null,
        cardSeries: editItem.card?.series ?? null,
        grader: editItem.grader,
        grade: editItem.grade ?? "",
        quantity: editItem.quantity,
        purchasePrice: editItem.purchasePrice != null ? String(editItem.purchasePrice) : "",
        purchasedAt: editItem.purchasedAt ? new Date(editItem.purchasedAt).toISOString().split("T")[0] : "",
        notes: editItem.notes ?? "",
        isPublic: editItem.isPublic ?? false,
      });
      setStep("details");
    } else if (prefillCard) {
      setForm(f => ({ ...DEFAULT_FORM, cardId: prefillCard.id, cardName: prefillCard.name, cardImageUrl: prefillCard.imageUrl ?? null, cardSeries: prefillCard.series ?? null }));
      setStep("details");
    } else {
      setForm(DEFAULT_FORM);
      setStep("select");
    }
  }, [editItem, prefillCard, open]);

  const handleCardSelect = (card: SelectedCard) => {
    setForm(f => ({ ...f, cardId: card.id, cardName: card.name, cardImageUrl: card.imageUrl, cardSeries: card.series }));
    setStep("details");
  };

  const handleGraderChange = (grader: string) => {
    const grades = GRADER_GRADES[grader] ?? [];
    setForm(f => ({ ...f, grader, grade: grades[0] ?? "" }));
  };

  const handleSubmit = () => {
    // In edit mode, cardId is already set from editItem; skip card selection check
    if (!editItem && !form.cardId) { toast.error("請先選擇卡牌"); return; }
    if (!form.grader) { toast.error("請選擇評級公司"); return; }
    const payload = {
      cardId: form.cardId,
      grader: form.grader,
      grade: form.grade || null,
      quantity: form.quantity,
      purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
      purchasedAt: form.purchasedAt ? new Date(form.purchasedAt) : null,
      notes: form.notes || null,
      isPublic: form.isPublic,
    };
    if (editItem) {
      updateMutation.mutate({ itemId: editItem.id, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  // ── Photo search logic ──
  const processImageFile = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setShowCropView(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setMatchResults([]);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoSearch = async (useCrop = false) => {
    if (!selectedImage) { toast.error("請選擇圖片"); return; }
    setSearchStep("compress");
    try {
      let base64: string;
      if (useCrop && completedCrop && imgRef.current) {
        const cropped = await getCroppedImg(imgRef.current, completedCrop);
        base64 = await compressImage(cropped);
      } else {
        const reader = new FileReader();
        const raw = await new Promise<string>((res) => {
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(selectedImage);
        });
        base64 = await compressImage(raw);
      }
      setSearchStep("identify");
      const timer = setTimeout(() => setSearchStep("search"), 3000);
      const result = await imageSearchMutation.mutateAsync({ image: base64 });
      clearTimeout(timer);
      setSearchStep("done");
      if (result.success && result.matches && result.matches.length > 0) {
        setMatchResults(result.matches);
      } else if (result.success && result.bestMatch) {
        setMatchResults([result.bestMatch]);
      } else {
        toast.error(result.error || t("profile.collection.imageSearch.noMatch"));
        setMatchResults([]);
      }
    } catch (e: any) {
      toast.error(t("profile.collection.imageSearch.noMatch"));
      setMatchResults([]);
    } finally {
      setSearchStep(null);
    }
  };

  const handleSelectPhotoMatch = (match: any) => {
    setForm(f => ({ ...f, cardId: match.id, cardName: match.name, cardImageUrl: match.imageUrl ?? null, cardSeries: match.series ?? null }));
    setShowPhotoSearch(false);
    setStep("details");
    setMatchResults([]);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={
          <span className="font-black tracking-tight" style={{ color: "white", fontSize: "1.05rem" }}>
            {editItem ? t("profile.collection.editItem") : t("profile.collection.addCard")}
          </span>
        }
        showCloseButton
        handleStyle={{ background: BRAND_BLUE }}
        headerStyle={{ background: BRAND_BLUE, borderBottom: `1px solid ${BRAND_YELLOW}40`, color: "white" }}
        className="!bg-white !text-gray-900"
      >
        {/* Step indicator (add mode only) */}
        {!editItem && (
          <div className="flex items-center gap-3 py-3 px-1 mb-2" style={{ background: `${BRAND_BLUE}08`, borderRadius: 12 }}>
            {(["select", "details"] as const).map((s, i) => {
              const isActive = step === s;
              const isDone = i === 0 && step === "details";
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-all"
                    style={isActive
                      ? { background: BRAND_BLUE, color: "white", boxShadow: `0 2px 8px ${BRAND_BLUE}40` }
                      : isDone
                      ? { background: BRAND_YELLOW, color: BRAND_BLUE }
                      : { background: "#e5e7eb", color: "#9ca3af" }}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className="text-xs font-semibold" style={isActive ? { color: BRAND_BLUE } : isDone ? { color: BRAND_YELLOW } : { color: "#9ca3af" }}>
                    {s === "select" ? t("profile.collection.form.step1") : t("profile.collection.form.step2")}
                  </span>
                  {i === 0 && <div className="w-8 h-px" style={{ background: isDone ? BRAND_YELLOW : "#e5e7eb" }} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 1: Select card */}
        {step === "select" && (
          <div className="space-y-4 pb-6">
            <p className="text-sm text-gray-500">{t("profile.collection.emptyHint")}</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Text search button */}
              <button
                onClick={() => setShowCardPicker(true)}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all active:scale-95 hover:shadow-md"
                style={{ borderColor: BRAND_BLUE, background: `${BRAND_BLUE}06` }}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: BRAND_BLUE }}>
                  <Search className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-bold" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.searchCard")}</span>
              </button>
              {/* Photo search button */}
              <button
                onClick={() => setShowPhotoSearch(true)}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all active:scale-95 hover:shadow-md"
                style={{ borderColor: BRAND_YELLOW, background: `${BRAND_YELLOW}10` }}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: BRAND_YELLOW }}>
                  <Camera className="w-6 h-6" style={{ color: BRAND_BLUE }} />
                </div>
                <span className="text-sm font-bold" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.photoSearch")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Fill details */}
        {step === "details" && (
          <div className="space-y-4 pb-6">
            {/* Selected card preview — brand blue card */}
            {form.cardId > 0 && (
              <div
                className="flex items-center gap-3 p-3 rounded-2xl relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a18b0 100%)`, boxShadow: `0 4px 16px ${BRAND_BLUE}40` }}
              >
                {/* Yellow accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: BRAND_YELLOW }} />
                {form.cardImageUrl ? (
                  <LazyImage src={getProxiedImageUrl(form.cardImageUrl) ?? ""} alt={form.cardName} className="w-12 h-16 object-contain rounded-xl bg-white/10 shadow-lg ml-1" />
                ) : (
                  <div className="w-12 h-16 rounded-xl bg-white/10 flex items-center justify-center ml-1">
                    <Package className="w-6 h-6 text-white/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-white truncate leading-tight">{form.cardName}</p>
                  {form.cardSeries && <p className="text-xs mt-0.5 truncate" style={{ color: `${BRAND_YELLOW}cc` }}>{form.cardSeries}</p>}
                </div>
                {!editItem && (
                  <button onClick={() => setStep("select")} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Grader */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.grader")}</Label>
              <div className="flex flex-wrap gap-2">
                {GRADERS.map(g => (
                  <button key={g}
                    onClick={() => handleGraderChange(g)}
                    className="px-4 py-2 rounded-full text-xs font-black border-2 transition-all active:scale-95"
                    style={form.grader === g
                      ? { background: BRAND_BLUE, borderColor: BRAND_BLUE, color: "white", boxShadow: `0 2px 8px ${BRAND_BLUE}40` }
                      : { background: "white", borderColor: "#e5e7eb", color: "#6b7280" }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Grade */}
            {(GRADER_GRADES[form.grader]?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.grade")}</Label>
                <Select value={form.grade} onValueChange={(v) => setForm(f => ({ ...f, grade: v }))}>
                  <SelectTrigger className="h-11 font-bold border-2 !bg-white !text-gray-900" style={{ borderColor: `${BRAND_BLUE}30` }}>
                    <SelectValue placeholder={t("profile.collection.form.selectGrade")} />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADER_GRADES[form.grader].map(g => (
                      <SelectItem key={g} value={g} className="font-semibold">{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.quantity")}</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 border-2"
                  style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE, background: `${BRAND_BLUE}06` }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div
                  className="flex-1 h-10 flex items-center justify-center rounded-xl font-black text-lg tabular-nums border-2 bg-white"
                  style={{ borderColor: `${BRAND_BLUE}30`, color: BRAND_BLUE }}
                >
                  {form.quantity}
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, quantity: Math.min(999, f.quantity + 1) }))}
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90"
                  style={{ background: BRAND_BLUE, color: "white" }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Purchase price */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.purchasePrice")}</Label>
              <div className="relative">
                <div
                  className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center rounded-l-xl font-black text-xs"
                  style={{ background: BRAND_BLUE, color: BRAND_YELLOW }}
                >
                  HKD
                </div>
                <Input
                  type="number" min={0} step="0.01" placeholder="0.00"
                  value={form.purchasePrice}
                  onChange={(e) => setForm(f => ({ ...f, purchasePrice: e.target.value }))}
                  className="pl-16 h-11 font-bold border-2 text-right pr-4 !bg-white !text-gray-900 placeholder:!text-gray-400"
                  style={{ borderColor: `${BRAND_BLUE}30` }}
                />
              </div>
            </div>

            {/* Purchase date */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.purchasedAt")}</Label>
              <Input
                type="date" value={form.purchasedAt}
                onChange={(e) => setForm(f => ({ ...f, purchasedAt: e.target.value }))}
                className="h-11 font-semibold border-2 !bg-white !text-gray-900"
                style={{ borderColor: `${BRAND_BLUE}30` }}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.notes")}</Label>
              <Textarea
                rows={2}
                placeholder={t("profile.collection.form.notesPlaceholder")}
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                className="border-2 resize-none font-medium !bg-white !text-gray-900 placeholder:!text-gray-400"
                style={{ borderColor: `${BRAND_BLUE}30` }}
              />
            </div>

            {/* Public toggle */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl border-2"
              style={{ borderColor: form.isPublic ? `${BRAND_YELLOW}60` : `${BRAND_BLUE}15`, background: form.isPublic ? `${BRAND_YELLOW}08` : `${BRAND_BLUE}04` }}
            >
              <div>
                <p className="text-sm font-black" style={{ color: BRAND_BLUE }}>{t("profile.collection.form.isPublic")}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t("profile.collection.form.isPublicHint")}</p>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm(f => ({ ...f, isPublic: v }))}
                style={form.isPublic ? { background: BRAND_YELLOW } : {}}
              />
            </div>

            {/* Save button */}
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="w-full h-13 text-base font-black rounded-2xl tracking-wide transition-all active:scale-98"
              style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a18b0 100%)`, color: "white", boxShadow: `0 4px 16px ${BRAND_BLUE}40`, height: 52 }}
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Star className="w-4 h-4 mr-2" style={{ color: BRAND_YELLOW }} />}
              {t("profile.collection.form.save")}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* Card picker dialog */}
      <CardPickerDialog open={showCardPicker} onOpenChange={setShowCardPicker} onSelect={handleCardSelect} />

      {/* Photo search bottom sheet */}
      <BottomSheet
        open={showPhotoSearch}
        onOpenChange={(v) => {
          setShowPhotoSearch(v);
          if (!v) { setSelectedImage(null); setImagePreview(null); setMatchResults([]); setSearchStep(null); }
        }}
        title={t("profile.collection.imageSearch.title")}
        description={t("profile.collection.imageSearch.hint")}
        showCloseButton
        className="!bg-white !text-gray-900"
        headerStyle={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a18b0 100%)`, borderBottom: `2px solid ${BRAND_YELLOW}` }}
        handleStyle={{ background: "rgba(255,255,255,0.4)" }}
      >
        <div className="space-y-4 pb-6 bg-white">
          {/* Upload area */}
          {!imagePreview && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-gray-50"
              style={{ borderColor: BRAND_BLUE }}
            >
              <Camera className="w-10 h-10 mx-auto mb-3" style={{ color: BRAND_BLUE }} />
              <p className="text-sm font-semibold text-gray-700">{t("profile.collection.imageSearch.upload")}</p>
              <p className="text-xs text-gray-400 mt-1">JPG / PNG / WEBP</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f); }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f); }} />

          {/* Image preview + crop */}
          {imagePreview && !showCropView && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center" style={{ minHeight: 200 }}>
                <img src={imagePreview} alt="preview" className="max-h-64 w-auto object-contain rounded-xl" />
                <button onClick={() => { setSelectedImage(null); setImagePreview(null); setMatchResults([]); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCropView(true)} className="flex-1">
                  裁剪
                </Button>
                <Button size="sm" onClick={() => handlePhotoSearch(false)} disabled={!!searchStep}
                  className="flex-1 font-bold" style={{ background: BRAND_BLUE, color: "white" }}>
                  {searchStep ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                  {t("profile.collection.imageSearch.identifying")}
                </Button>
              </div>
            </div>
          )}

          {/* Crop view */}
          {imagePreview && showCropView && (
            <div className="space-y-3">
              <ReactCrop crop={crop} onChange={setCrop} onComplete={setCompletedCrop}>
                <img ref={imgRef} src={imagePreview} alt="crop" className="max-h-64 w-full object-contain" />
              </ReactCrop>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCropView(false)} className="flex-1">取消裁剪</Button>
                <Button size="sm" onClick={() => handlePhotoSearch(true)} disabled={!!searchStep}
                  className="flex-1 font-bold" style={{ background: BRAND_BLUE, color: "white" }}>
                  {searchStep ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {t("profile.collection.imageSearch.identifying")}
                </Button>
              </div>
            </div>
          )}

          {/* Search progress */}
          {searchStep && searchStep !== "done" && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: `${BRAND_BLUE}08` }}>
              <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: BRAND_BLUE }} />
              <span className="text-sm font-medium" style={{ color: BRAND_BLUE }}>
                {searchStep === "compress" && t("profile.collection.imageSearch.analyzing")}
                {searchStep === "identify" && t("profile.collection.imageSearch.identifying")}
                {searchStep === "search" && t("profile.collection.imageSearch.matching")}
              </span>
            </div>
          )}

          {/* Match results */}
          {matchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-700">{t("profile.collection.imageSearch.results")}</p>
              {matchResults.map((m: any) => (
                <button key={m.id} onClick={() => handleSelectPhotoMatch(m)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left">
                  {m.imageUrl && <LazyImage src={getProxiedImageUrl(m.imageUrl) ?? ""} alt={m.name} className="w-12 h-16 object-contain rounded-lg bg-gray-50" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{m.name}</p>
                    {m.series && <p className="text-xs text-gray-400">{m.series}</p>}
                    {m.score != null && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-gray-400">{t("profile.collection.imageSearch.confidence")}:</span>
                        <span className={`text-xs font-bold ${m.score >= 0.7 ? "text-emerald-600" : m.score >= 0.4 ? "text-amber-500" : "text-red-500"}`}>
                          {Math.round(m.score * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Camera button */}
          {!imagePreview && (
            <Button variant="outline" onClick={() => cameraInputRef.current?.click()} className="w-full gap-2">
              <Camera className="w-4 h-4" />
              {t("profile.collection.imageSearch.camera")}
            </Button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

// ─── Main CollectionSection ───────────────────────────────────
export function CollectionSection() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Filters & sort state
  // priceMode is always "grade" — show grade-matched market price
  const priceMode = "grade" as const;
  const [sortBy, setSortBy] = useState<"createdAt" | "marketValue" | "gain" | "purchasedAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterGrader, setFilterGrader] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  // Sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  // PDF export state
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Trade sheet state
  const [showTradeSheet, setShowTradeSheet] = useState(false);
  const [tradePreselectedItem, setTradePreselectedItem] = useState<any | null>(null);

  // View mode: "active" = current holdings, "traded" = traded-away cards
  const [viewMode, setViewMode] = useState<"active" | "traded">("active");

  // Data
  const { data: stats, isLoading: statsLoading } = trpc.profile.getCollectionStats.useQuery(undefined, { retry: 1 });
  const { data: collectionData, isLoading: itemsLoading } = trpc.profile.getCollection.useQuery(
    { sortBy, sortOrder, grader: filterGrader === "all" ? undefined : filterGrader, priceMode: "grade" as const, page: currentPage, limit: PAGE_SIZE, showTraded: viewMode === "traded" },
    { retry: 1 }
  );
  const items = collectionData?.items ?? [];
  const totalItems = collectionData?.total ?? 0;
  const totalPages = collectionData?.totalPages ?? 1;
  const tradedOutIds = new Set<number>(collectionData?.tradedOutIds ?? []);

  const removeMutation = trpc.profile.removeFromCollection.useMutation({
    onMutate: async ({ itemId }) => {
      await utils.profile.getCollection.cancel();
      const prevCollection = utils.profile.getCollection.getData(
        { sortBy, sortOrder, grader: filterGrader === "all" ? undefined : filterGrader, priceMode: "grade" as const, page: currentPage, limit: PAGE_SIZE, showTraded: viewMode === "traded" }
      );
      utils.profile.getCollection.setData(
        { sortBy, sortOrder, grader: filterGrader === "all" ? undefined : filterGrader, priceMode: "grade" as const, page: currentPage, limit: PAGE_SIZE, showTraded: viewMode === "traded" },
        (old: any) => old ? { ...old, items: old.items.filter((i: any) => i.id !== itemId), total: Math.max(0, (old.total ?? 1) - 1) } : old
      );
      setDeleteItem(null);
      return { prevCollection };
    },
    onSuccess: () => {
      toast.success(t("profile.collection.deleteSuccess"));
    },
    onError: (e, _vars, context) => {
      if (context?.prevCollection !== undefined) {
        utils.profile.getCollection.setData(
          { sortBy, sortOrder, grader: filterGrader === "all" ? undefined : filterGrader, priceMode: "grade" as const, page: currentPage, limit: PAGE_SIZE, showTraded: viewMode === "traded" },
          context.prevCollection
        );
      }
      toast.error(t("profile.collection.deleteFailed", { error: e.message }));
    },
    onSettled: () => {
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
    },
  });

  const exportPdfMutation = trpc.profile.exportCollectionPdf.useMutation({
    onSuccess: (data) => {
      toast.success(t("profile.collection.pdf.success"));
      window.open(data.url, "_blank");
      setExportingPdf(false);
      setShowPdfMenu(false);
    },
    onError: (e) => {
      toast.error(t("profile.collection.pdf.failed", { error: e.message }));
      setExportingPdf(false);
    },
  });

  const handleExportPdf = (publicOnly: boolean) => {
    setExportingPdf(true);
    exportPdfMutation.mutate({ publicOnly });
  };

  // ── Bulk operations ──
  const toggleBulkMode = () => {
    setBulkMode(v => !v);
    setSelectedIds(new Set());
  };

  const toggleSelectItem = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = items.length > 0 && items.every((it: any) => selectedIds.has(it.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((it: any) => it.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    for (const id of ids) {
      try {
        await removeMutation.mutateAsync({ itemId: id });
        successCount++;
      } catch {}
    }
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setBulkMode(false);
    setSelectedIds(new Set());
    toast.success(`已刪除 ${successCount} 筆收藏`);
    utils.profile.getCollection.invalidate();
    utils.profile.getCollectionStats.invalidate();
  };

  const isLoading = statsLoading || itemsLoading;

  // ── Stats ──
  const gainPct = stats?.totalGainPct ?? 0;
  const gainPositive = gainPct >= 0;

  return (
    <div className="space-y-5 bg-white rounded-2xl p-4 -mx-1">
      {/* ── Header ── */}
      <div className="pb-3" style={{ borderBottom: `2px solid ${BRAND_BLUE}` }}>
        {/* View mode tabs */}
        <div className="flex gap-1 mb-3 p-1 rounded-xl bg-gray-100">
          <button
            onClick={() => { setViewMode("active"); setCurrentPage(1); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "active" ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            style={viewMode === "active" ? { background: BRAND_BLUE } : {}}
          >
            <Package className="w-3.5 h-3.5" />
            現有收藏
          </button>
          <button
            onClick={() => { setViewMode("traded"); setCurrentPage(1); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "traded" ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            style={viewMode === "traded" ? { background: BRAND_BLUE } : {}}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            已換走
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-black tracking-tight truncate" style={{ color: BRAND_BLUE }}>
              {viewMode === "active" ? t("profile.collection.title") : "已換走的卡牌"}
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 font-medium tracking-wide">
              {totalItems > 0
                ? `${totalItems} ${t("profile.collection.stats.entries")} · ${stats?.totalQuantity ?? 0} ${t("profile.collection.stats.cards")}`
                : viewMode === "traded" ? "尚無已換走的卡牌" : t("profile.collection.empty")}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* PDF export */}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowPdfMenu(!showPdfMenu)}
              disabled={exportingPdf || totalItems === 0}
              className="gap-1 text-[10px] sm:text-xs border-gray-200 hover:border-gray-300 h-7 sm:h-8 px-2 sm:px-3">
              {exportingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              PDF
            </Button>
            {showPdfMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-40">
                <button onClick={() => handleExportPdf(false)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Download className="w-4 h-4" />{t("profile.collection.pdf.exportAll")}
                </button>
                <button onClick={() => handleExportPdf(true)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Eye className="w-4 h-4" />{t("profile.collection.pdf.exportPublic")}
                </button>
              </div>
            )}
          </div>
          {/* Bulk mode toggle */}
          {totalItems > 0 && (
            <Button variant="outline" size="sm"
              onClick={toggleBulkMode}
              className="gap-1 text-[10px] sm:text-xs font-bold h-7 sm:h-8 px-2 sm:px-3 rounded-lg border-gray-200"
              style={bulkMode ? { background: BRAND_BLUE, color: 'white', borderColor: BRAND_BLUE } : {}}>
              {bulkMode ? <X className="w-3 h-3" /> : <CheckSquare2 className="w-3 h-3" />}
              {bulkMode ? '取消' : '批量'}
            </Button>
          )}
          {/* Add button */}
          <Button size="sm" onClick={() => { setEditItem(null); setShowAddSheet(true); }}
            className="gap-1 text-[10px] sm:text-xs font-bold h-7 sm:h-8 px-2 sm:px-3 rounded-lg"
            style={{ background: BRAND_BLUE, color: "white" }}>
            <Plus className="w-3 h-3" />
            {t("profile.collection.addCard")}
          </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Dashboard ── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : stats && totalItems > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("profile.collection.stats.totalMarketValue")}
              value={formatCurrency(stats.totalMarketValue)}
              icon={<BarChart3 className="w-4 h-4" style={{ color: '#92700a' }} />}
              highlight="yellow"
            />
            <StatCard
              label={t("profile.collection.stats.totalCost")}
              value={formatCurrency(stats.totalCost)}
              icon={<DollarSign className="w-4 h-4" style={{ color: BRAND_BLUE }} />}
              highlight="blue"
            />
            <StatCard
              label={t("profile.collection.stats.unrealizedGain")}
              value={`${gainPositive ? "+" : ""}${formatCurrency(stats.totalGain)}`}
              sub={`${gainPositive ? "+" : ""}${gainPct.toFixed(1)}%`}
              icon={gainPositive
                ? <TrendingUp className="w-4 h-4" style={{ color: GAIN_GREEN }} />
                : <TrendingDown className="w-4 h-4" style={{ color: LOSS_RED }} />}
              accent={gainPositive ? GAIN_GREEN : LOSS_RED}
            />
            <StatCard
              label={t("profile.collection.stats.holdings")}
              value={`${stats.totalQuantity} ${t("profile.collection.stats.cards")}`}
              icon={<Package className="w-4 h-4" style={{ color: BRAND_BLUE }} />}
              highlight="blue"
            />
          </div>

          {/* Top 3 Gainers */}
          {stats.top3Gainers.length > 0 && (
            <div
              className="bg-white rounded-2xl p-4 space-y-3"
              style={{ border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center gap-2 pb-2" style={{ borderBottom: `2px solid ${BRAND_BLUE}` }}>
                <Star className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>
                  {t("profile.collection.stats.top3Gainers")}
                </span>
              </div>
              {stats.top3Gainers.map((item: any, idx: number) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={idx === 0
                      ? { background: BRAND_BLUE, color: "white" }
                      : { background: "#f3f4f6", color: "#6b7280" }}
                  >
                    {idx + 1}
                  </div>
                  {item.card?.imageUrl && (
                    <div className="flex-shrink-0" style={{ width: 64, height: 90 }}>
                      <LazyImage src={getProxiedImageUrl(item.card.imageUrl) ?? ""} alt={item.card?.name ?? ""}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.card?.name}</p>
                    <GradeBadge grader={item.grader} grade={item.grade} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums" style={{ color: GAIN_GREEN }}>+{(item.unrealizedGainPct ?? 0).toFixed(1)}%</p>
                    <p className="text-xs font-semibold tabular-nums text-gray-400">{formatCurrency(item.unrealizedGain)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Bulk action toolbar ── */}
      {bulkMode && items.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
          style={{ background: `${BRAND_BLUE}08`, border: `1px solid ${BRAND_BLUE}20` }}>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold transition-all"
              style={{ color: BRAND_BLUE }}
            >
              {isAllSelected
                ? <CheckSquare2 className="w-4 h-4" />
                : <Square className="w-4 h-4" />}
              {isAllSelected ? '取消全選' : '全選本頁'}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: BRAND_BLUE, color: 'white' }}>
                已選 {selectedIds.size} 筆
              </span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all"
                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
              >
                <Trash className="w-3.5 h-3.5" />
                刪除 {selectedIds.size} 筆
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Filter bar ── */}
      {items.length > 0 && (
        <div className="space-y-2">
          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter toggle */}
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                showFilters
                  ? "border-transparent text-white"
                  : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
              }`}
              style={showFilters ? { background: BRAND_BLUE } : {}}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t("profile.collection.filter.sortBy")}
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-gray-50" style={{ border: "1px solid #e5e7eb" }}>
              {/* Grader filter */}
              <Select value={filterGrader} onValueChange={setFilterGrader}>
                <SelectTrigger className="h-8 text-xs w-32 bg-white border-gray-200 text-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("profile.collection.filter.allGraders")}</SelectItem>
                  {GRADERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Sort by */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-8 text-xs w-36 bg-white border-gray-200 text-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">{t("profile.collection.filter.sortByCreatedAt")}</SelectItem>
                  <SelectItem value="purchasedAt">{t("profile.collection.filter.sortByPurchasedAt")}</SelectItem>
                  <SelectItem value="marketValue">{t("profile.collection.filter.sortByMarketValue")}</SelectItem>
                  <SelectItem value="gain">{t("profile.collection.filter.sortByGain")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort order */}
              <button onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
                className="flex items-center gap-1 h-8 px-3 rounded-md border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                {sortOrder === "desc" ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                {sortOrder === "desc" ? "降序" : "升序"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Collection list ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : totalItems === 0 ? (
        <div className="py-16 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: `${BRAND_BLUE}08` }}>
            {viewMode === "traded"
              ? <ArrowLeftRight className="w-10 h-10" style={{ color: BRAND_BLUE }} />
              : <Package className="w-10 h-10" style={{ color: BRAND_BLUE }} />}
          </div>
          {viewMode === "traded" ? (
            <>
              <p className="text-gray-600 font-semibold mb-2">尚無已換走的卡牌</p>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">在收藏清單中點擊 ⇄ 按鈕開始記錄以卡換卡</p>
            </>
          ) : (
            <>
              <p className="text-gray-600 font-semibold mb-2">{t("profile.collection.empty")}</p>
              <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">{t("profile.collection.emptyHint")}</p>
              <Button onClick={() => { setEditItem(null); setShowAddSheet(true); }}
                className="font-bold gap-2" style={{ background: BRAND_BLUE, color: "white" }}>
                <Plus className="w-4 h-4" />
                {t("profile.collection.addCard")}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pagination info */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-xs text-gray-400 font-medium">
                第 {currentPage} / {totalPages} 頁 · 共 {totalItems} 筆
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all disabled:opacity-30 hover:bg-gray-100"
                  style={{ color: BRAND_BLUE }}
                >
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                  const p = startPage + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
                      style={p === currentPage
                        ? { background: BRAND_BLUE, color: 'white' }
                        : { color: '#6b7280' }
                      }
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all disabled:opacity-30 hover:bg-gray-100"
                  style={{ color: BRAND_BLUE }}
                >
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                </button>
              </div>
            </div>
          )}
          {(items as any[]).map((item) => {
            const gain = item.unrealizedGain;
            const gainPct = item.unrealizedGainPct;
            const hasPrice = item.marketPrice != null;
            const isFallback = item.priceIsFallback;

            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={bulkMode ? () => toggleSelectItem(item.id) : undefined}
                className="relative bg-white rounded-2xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{
                  border: isSelected ? `2px solid ${BRAND_BLUE}` : "1px solid #e5e7eb",
                  boxShadow: isSelected ? `0 0 0 3px ${BRAND_BLUE}20` : "0 1px 4px rgba(0,0,0,0.05)",
                  cursor: bulkMode ? 'pointer' : 'default',
                }}
              >
                {/* Left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: gainPct != null && gainPct > 0 ? GAIN_GREEN : gainPct != null && gainPct < 0 ? LOSS_RED : BRAND_BLUE }} />
                <div className="flex items-stretch">
                  {/* Bulk checkbox */}
                  {bulkMode && (
                    <div className="flex items-center justify-center w-10 flex-shrink-0"
                      style={{ background: isSelected ? `${BRAND_BLUE}10` : 'transparent' }}>
                      {isSelected
                        ? <CheckSquare2 className="w-5 h-5" style={{ color: BRAND_BLUE }} />
                        : <Square className="w-5 h-5 text-gray-300" />}
                    </div>
                  )}
                  {/* Card image column */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center ml-[3px] py-2 px-1.5"
                    style={{ width: 'clamp(90px, 25vw, 180px)' }}
                  >
                    {item.card?.imageUrl ? (
                      <LazyImage
                        src={getProxiedImageUrl(item.card.imageUrl) ?? ""}
                        alt={item.card?.name ?? ""}
                        className="w-full h-auto object-contain rounded-lg"
                        style={{ maxHeight: 'clamp(130px, 35vw, 260px)' }}
                      />
                    ) : (
                      <div className="w-full flex items-center justify-center rounded-lg" style={{ height: 'clamp(110px, 30vw, 220px)' }}>
                        <Package className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>
                  {/* Main content */}
                  <div className="flex-1 min-w-0 p-3">
                    {/* Top row: name + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-sm text-gray-900 truncate leading-tight">{item.card?.name}</p>
                        {item.card?.series && (
                          <p className="text-xs truncate mt-0.5 text-gray-400">{item.card.series}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <GradeBadge grader={item.grader} grade={item.grade} />
                          {item.quantity > 1 && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">×{item.quantity}</span>
                          )}
                          {item.isPublic && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400">
                              <Eye className="w-3 h-3" />公開
                            </span>
                          )}
                          {viewMode === "traded" && item.tradedAt && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                              ↔ 已換走 {new Date(item.tradedAt).toLocaleDateString('zh-HK', { month: '2-digit', day: '2-digit' })}
                            </span>
                          )}
                          {viewMode === "active" && tradedOutIds.has(item.id) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                              ↔ 已換出
                            </span>
                          )}
                        </div>
                        {/* Purchase date */}
                        {item.purchasedAt && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <CalendarDays className="w-3 h-3 text-gray-300" />
                            <span className="text-[10px] font-medium text-gray-400">
                              {new Date(item.purchasedAt).toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' })} 購入
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Actions — hidden in bulk mode and traded view */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!bulkMode && viewMode === "active" && <>
                        <button
                          onClick={() => { setTradePreselectedItem({
                            id: item.id,
                            cardId: item.card?.id ?? item.cardId,
                            cardName: item.card?.name ?? "",
                            cardImageUrl: item.card?.imageUrl ?? null,
                            cardSeries: item.card?.series ?? null,
                            grader: item.grader,
                            grade: item.grade,
                            quantity: item.quantity,
                            marketPrice: item.marketPrice ?? null,
                          }); setShowTradeSheet(true); }}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-blue-50"
                          style={{ color: BRAND_BLUE }}
                          title="以卡換卡"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditItem(item); setShowAddSheet(true); }}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-gray-100"
                          style={{ color: "#9ca3af" }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteItem(item)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-red-50"
                          style={{ color: "#d1d5db" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        </>}
                      </div>
                    </div>
                    {/* Price row — 購入價 vs 市場價（只在有數據時顯示）*/}
                    {(item.purchasePrice != null || hasPrice) && (
                    <div className="flex items-stretch gap-1.5 mt-2">
                      {item.purchasePrice != null && (
                      <div className="flex-1 rounded-lg px-2 py-1 bg-secondary border border-border">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                          {t("profile.collection.table.purchasePrice")}
                        </p>
                        <p className="text-xs font-bold tabular-nums text-foreground leading-tight">
                          {formatCurrency(item.purchasePrice)}
                        </p>
                      </div>
                      )}
                      {hasPrice && (
                      <div
                        className="flex-1 rounded-lg px-2 py-1"
                        style={{ background: `${BRAND_YELLOW}18`, border: `1px solid ${BRAND_YELLOW}60` }}
                      >
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                          style={{ color: '#92700a' }}>
                          {t("profile.collection.table.marketPrice") ?? "市場參考價"}
                        </p>
                        <p className="text-xs font-black tabular-nums leading-tight" style={{ color: BRAND_BLUE }}>
                          {formatCurrency(item.marketPrice)}
                        </p>
                      </div>
                      )}
                    </div>
                    )}
                    {/* P&L bar — 緊湊版，只在有完整數據時顯示 */}
                    {gain != null && item.purchasePrice != null && (
                      <div
                        className="flex items-center justify-between gap-1 mt-1.5 px-2.5 py-1 rounded-lg"
                        style={{
                          background: gainPct != null && gainPct > 0
                            ? "oklch(0.18 0.05 150)"
                            : gainPct != null && gainPct < 0
                            ? "oklch(0.18 0.05 25)"
                            : "var(--secondary)",
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {gainPct != null && gainPct > 0
                            ? <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GAIN_GREEN }} />
                            : gainPct != null && gainPct < 0
                              ? <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: LOSS_RED }} />
                              : <Minus className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />}
                          <span
                            className="text-sm font-black tabular-nums"
                            style={{ color: gainPct != null && gainPct > 0 ? GAIN_GREEN : gainPct != null && gainPct < 0 ? LOSS_RED : "var(--muted-foreground)" }}
                          >
                            {gainPct != null ? `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-semibold tabular-nums"
                          style={{ color: gainPct != null && gainPct > 0 ? GAIN_GREEN : gainPct != null && gainPct < 0 ? LOSS_RED : "var(--muted-foreground)" }}
                        >
                          {gain >= 0 ? "+" : ""}{formatCurrency(gain)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2 pb-1">
              <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === 1}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                style={{ background: currentPage === 1 ? '#f3f4f6' : `${BRAND_BLUE}10`, color: BRAND_BLUE, border: `1px solid ${BRAND_BLUE}20` }}
              >
                <ChevronDown className="w-3.5 h-3.5 rotate-90" />上一頁
              </button>
              <span className="text-xs font-bold" style={{ color: BRAND_BLUE }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                style={{ background: currentPage === totalPages ? '#f3f4f6' : BRAND_BLUE, color: currentPage === totalPages ? '#9ca3af' : 'white', border: `1px solid ${currentPage === totalPages ? '#e5e7eb' : BRAND_BLUE}` }}
              >
                下一頁<ChevronDown className="w-3.5 h-3.5 -rotate-90" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Trade Sheet ── */}
      <TradeSheet
        open={showTradeSheet}
        onOpenChange={(v) => { setShowTradeSheet(v); if (!v) setTradePreselectedItem(null); }}
        onSuccess={() => setTradePreselectedItem(null)}
        preselectedOutItem={tradePreselectedItem}
      />

      {/* ── Add / Edit Sheet ── */}
      <AddEditSheet
        open={showAddSheet}
        onOpenChange={(v) => { setShowAddSheet(v); if (!v) setEditItem(null); }}
        editItem={editItem}
        onSuccess={() => { setEditItem(null); }}
      />

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteItem} onOpenChange={(v) => { if (!v) setDeleteItem(null); }}>
        <AlertDialogContent className="!bg-white border-0 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${BRAND_YELLOW}22` }}>
                <AlertTriangle className="w-5 h-5" style={{ color: BRAND_YELLOW }} />
              </div>
              <AlertDialogTitle className="text-gray-900 font-black">{t("profile.collection.deleteItem")}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-gray-500 pl-13">
              {t("profile.collection.confirmDelete")}
              {deleteItem && (
                <span className="block mt-2 font-semibold text-gray-900">
                  {deleteItem.card?.name} — {deleteItem.grader} {deleteItem.grade}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 text-gray-600 hover:bg-gray-50">{t("profile.collection.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && removeMutation.mutate({ itemId: deleteItem.id })}
              className="border-0 text-white font-bold"
              style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a18b0 100%)` }}>
              {t("profile.collection.deleteItem")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk delete confirm ── */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={(v) => { if (!v) setShowBulkDeleteConfirm(false); }}>
        <AlertDialogContent className="!bg-white border-0 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${BRAND_YELLOW}22` }}>
                <AlertTriangle className="w-5 h-5" style={{ color: BRAND_YELLOW }} />
              </div>
              <AlertDialogTitle className="text-gray-900 font-black">批量刪除確認</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-gray-500 pl-13">
              確定要刪除已選的 <span className="font-black text-gray-900">{selectedIds.size} 筆</span> 收藏記錄？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={bulkDeleting}
              className="border-gray-200 text-gray-600 hover:bg-gray-50">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="border-0 text-white font-bold"
              style={{ background: `linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)` }}>
              {bulkDeleting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />刪除中...</>
                : `確定刪除 ${selectedIds.size} 筆`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
