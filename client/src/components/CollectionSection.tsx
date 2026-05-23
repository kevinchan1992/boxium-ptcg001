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
  SlidersHorizontal, RefreshCw, X,
} from "lucide-react";
import ReactCrop, { type Crop as CropType } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

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
function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: "white", border: `1px solid ${BRAND_BLUE}18`, boxShadow: `0 2px 12px ${BRAND_BLUE}08` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: `${BRAND_BLUE}10` }}>
          {icon}
        </div>
      </div>
      <span className="text-xl font-black tabular-nums tracking-tight" style={{ color: accent ?? BRAND_BLUE }}>
        {value}
      </span>
      {sub && <span className="text-xs text-gray-400 font-medium">{sub}</span>}
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
}

function AddEditSheet({ open, onOpenChange, editItem, onSuccess }: AddEditSheetProps) {
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

  // Populate form when editing
  useEffect(() => {
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
    } else {
      setForm(DEFAULT_FORM);
      setStep("select");
    }
  }, [editItem, open]);

  const handleCardSelect = (card: SelectedCard) => {
    setForm(f => ({ ...f, cardId: card.id, cardName: card.name, cardImageUrl: card.imageUrl, cardSeries: card.series }));
    setStep("details");
  };

  const handleGraderChange = (grader: string) => {
    const grades = GRADER_GRADES[grader] ?? [];
    setForm(f => ({ ...f, grader, grade: grades[0] ?? "" }));
  };

  const handleSubmit = () => {
    if (!form.cardId) { toast.error("請先選擇卡牌"); return; }
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
        handleStyle={{ background: `rgba(255,255,255,0.3)` }}
        headerStyle={{ background: BRAND_BLUE, borderBottom: `1px solid ${BRAND_YELLOW}40`, color: "white" }}
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
                  <img src={form.cardImageUrl} alt={form.cardName} className="w-12 h-16 object-contain rounded-xl bg-white/10 shadow-lg ml-1" />
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
                  <SelectTrigger className="h-11 font-bold border-2" style={{ borderColor: `${BRAND_BLUE}30` }}>
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
                  className="flex-1 h-10 flex items-center justify-center rounded-xl font-black text-lg tabular-nums border-2"
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
                  className="pl-16 h-11 font-bold border-2 text-right pr-4"
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
                className="h-11 font-semibold border-2"
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
                className="border-2 resize-none font-medium"
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
      >
        <div className="space-y-4 pb-6">
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
                  {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-12 h-16 object-contain rounded-lg bg-gray-50" />}
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
  const [priceMode, setPriceMode] = useState<"psa10" | "grade">("psa10");
  const [sortBy, setSortBy] = useState<"createdAt" | "marketValue" | "gain" | "purchasedAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterGrader, setFilterGrader] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  // PDF export state
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);

  // Data
  const { data: stats, isLoading: statsLoading } = trpc.profile.getCollectionStats.useQuery(undefined, { retry: 1 });
  const { data: items = [], isLoading: itemsLoading } = trpc.profile.getCollection.useQuery(
    { sortBy, sortOrder, grader: filterGrader === "all" ? undefined : filterGrader, priceMode },
    { retry: 1 }
  );

  const removeMutation = trpc.profile.removeFromCollection.useMutation({
    onSuccess: () => {
      toast.success(t("profile.collection.deleteSuccess"));
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
      setDeleteItem(null);
    },
    onError: (e) => toast.error(t("profile.collection.deleteFailed", { error: e.message })),
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

  const isLoading = statsLoading || itemsLoading;

  // ── Stats ──
  const gainPct = stats?.totalGainPct ?? 0;
  const gainPositive = gainPct >= 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900">{t("profile.collection.title")}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length > 0
              ? `${items.length} ${t("profile.collection.stats.entries")} · ${stats?.totalQuantity ?? 0} ${t("profile.collection.stats.cards")}`
              : t("profile.collection.empty")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* PDF export */}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowPdfMenu(!showPdfMenu)}
              disabled={exportingPdf || items.length === 0}
              className="gap-1.5 text-xs border-gray-200 hover:border-gray-300">
              {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
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
          {/* Add button */}
          <Button size="sm" onClick={() => { setEditItem(null); setShowAddSheet(true); }}
            className="gap-1.5 text-xs font-bold h-8 px-3 rounded-lg"
            style={{ background: BRAND_BLUE, color: "white" }}>
            <Plus className="w-3.5 h-3.5" />
            {t("profile.collection.addCard")}
          </Button>
        </div>
      </div>

      {/* ── Stats Dashboard ── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : stats && items.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("profile.collection.stats.totalMarketValue")}
              value={formatCurrency(stats.totalMarketValue)}
              icon={<BarChart3 className="w-4 h-4" style={{ color: BRAND_BLUE }} />}
            />
            <StatCard
              label={t("profile.collection.stats.totalCost")}
              value={formatCurrency(stats.totalCost)}
              icon={<DollarSign className="w-4 h-4" style={{ color: BRAND_BLUE }} />}
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
              value={`${stats.totalQuantity}`}
              sub={`${stats.totalItems} ${t("profile.collection.stats.entries")}`}
              icon={<Package className="w-4 h-4" style={{ color: BRAND_BLUE }} />}
            />
          </div>

          {/* Top 3 Gainers */}
          {stats.top3Gainers.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: "white", border: `1px solid ${BRAND_BLUE}18`, boxShadow: `0 2px 12px ${BRAND_BLUE}08` }}>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4" style={{ color: BRAND_YELLOW }} />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t("profile.collection.stats.top3Gainers")}</span>
              </div>
              {stats.top3Gainers.map((item: any, idx: number) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-xs font-black w-5 text-center" style={{ color: BRAND_BLUE }}>#{idx + 1}</span>
                  {item.card?.imageUrl && (
                    <img src={item.card.imageUrl} alt={item.card?.name} className="w-8 h-10 object-contain rounded bg-gray-50" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.card?.name}</p>
                    <GradeBadge grader={item.grader} grade={item.grade} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-600">+{(item.unrealizedGainPct ?? 0).toFixed(1)}%</p>
                    <p className="text-xs text-gray-400">{formatCurrency(item.unrealizedGain)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Filter bar ── */}
      {items.length > 0 && (
        <div className="space-y-2">
          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Price mode toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg border border-gray-200 bg-white">
              {(["psa10", "grade"] as const).map(mode => (
                <button key={mode}
                  onClick={() => setPriceMode(mode)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${priceMode === mode ? "text-white" : "text-gray-500 hover:text-gray-700"}`}
                  style={priceMode === mode ? { background: BRAND_BLUE } : {}}>
                  {t(`profile.collection.priceMode.${mode}`)}
                </button>
              ))}
            </div>

            {/* Filter toggle */}
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${showFilters ? "text-white border-transparent" : "border-gray-200 text-gray-600 bg-white"}`}
              style={showFilters ? { background: BRAND_BLUE } : {}}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t("profile.collection.filter.sortBy")}
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50">
              {/* Grader filter */}
              <Select value={filterGrader} onValueChange={setFilterGrader}>
                <SelectTrigger className="h-8 text-xs w-32 bg-white border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("profile.collection.filter.allGraders")}</SelectItem>
                  {GRADERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Sort by */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-8 text-xs w-36 bg-white border-gray-200">
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
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: `${BRAND_BLUE}08` }}>
            <Package className="w-10 h-10" style={{ color: BRAND_BLUE }} />
          </div>
          <p className="text-gray-600 font-semibold mb-2">{t("profile.collection.empty")}</p>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">{t("profile.collection.emptyHint")}</p>
          <Button onClick={() => { setEditItem(null); setShowAddSheet(true); }}
            className="font-bold gap-2" style={{ background: BRAND_BLUE, color: "white" }}>
            <Plus className="w-4 h-4" />
            {t("profile.collection.addCard")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(items as any[]).map((item) => {
            const gain = item.unrealizedGain;
            const gainPct = item.unrealizedGainPct;
            const hasPrice = item.marketPrice != null;
            const isFallback = item.priceIsFallback;

            return (
              <div key={item.id}
                className="rounded-2xl overflow-hidden border transition-all hover:shadow-md"
                style={{ borderColor: `${BRAND_BLUE}12`, background: "white" }}>
                <div className="flex items-stretch">
                  {/* Card image */}
                  <div className="w-16 flex-shrink-0 bg-gray-50 flex items-center justify-center p-2">
                    {item.card?.imageUrl ? (
                      <img src={item.card.imageUrl} alt={item.card?.name}
                        className="w-12 h-16 object-contain rounded-lg" />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate leading-tight">{item.card?.name}</p>
                        {item.card?.series && <p className="text-xs text-gray-400 truncate">{item.card.series}</p>}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <GradeBadge grader={item.grader} grade={item.grade} />
                          {item.quantity > 1 && (
                            <span className="text-xs text-gray-500 font-medium">×{item.quantity}</span>
                          )}
                          {item.isPublic && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                              <Eye className="w-3 h-3" />公開
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => { setEditItem(item); setShowAddSheet(true); }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteItem(item)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Price row */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                      <div className="text-xs text-gray-400">
                        <span>{t("profile.collection.table.purchasePrice")}: </span>
                        <span className="font-semibold text-gray-700">
                          {item.purchasePrice != null ? formatCurrency(item.purchasePrice) : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        {hasPrice ? (
                          <div>
                            <div className="text-xs font-bold text-gray-800">{formatCurrency(item.marketPrice)}</div>
                            {isFallback && (
                              <div className="text-xs text-gray-400">{t("profile.collection.table.fallbackNote")}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">{t("profile.collection.table.noPrice")}</span>
                        )}
                      </div>
                    </div>

                    {/* P&L bar */}
                    {gain != null && item.purchasePrice != null && (
                      <div className={`flex items-center justify-end gap-1 mt-1.5 px-2 py-1 rounded-lg ${gainBg(gainPct)}`}>
                        {gainPct != null && gainPct > 0
                          ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                          : gainPct != null && gainPct < 0
                            ? <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                            : <Minus className="w-3.5 h-3.5 text-gray-400" />}
                        <span className={`text-xs font-black ${gainColor(gainPct)}`}>
                          {gainPct != null ? `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%` : "—"}
                        </span>
                        <span className={`text-xs font-semibold ${gainColor(gainPct)}`}>
                          ({gain >= 0 ? "+" : ""}{formatCurrency(gain)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Sheet ── */}
      <AddEditSheet
        open={showAddSheet}
        onOpenChange={(v) => { setShowAddSheet(v); if (!v) setEditItem(null); }}
        editItem={editItem}
        onSuccess={() => { setEditItem(null); }}
      />

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteItem} onOpenChange={(v) => { if (!v) setDeleteItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.collection.deleteItem")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.collection.confirmDelete")}
              {deleteItem && (
                <span className="block mt-2 font-semibold text-gray-900">
                  {deleteItem.card?.name} — {deleteItem.grader} {deleteItem.grade}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("profile.collection.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && removeMutation.mutate({ itemId: deleteItem.id })}
              className="bg-red-600 hover:bg-red-700 text-white">
              {t("profile.collection.deleteItem")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
