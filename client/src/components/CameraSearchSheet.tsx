import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LazyImage } from "@/components/LazyImage";
import { getProxiedImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import { Camera, Upload, X, RotateCcw, CheckCircle2, Search, ChevronRight, Scan } from "lucide-react";

interface MatchedCard {
  id: number;
  name: string;
  nameJa: string | null;
  cardNumber: string | null;
  series: string | null;
  setName: string | null;
  rarity: string | null;
  imageUrl: string | null;
  matchScore: number;
  matchReasons: string[];
  latestPrice: number | null;
}

interface CameraSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Picker mode: when provided, selecting a card calls this instead of navigating */
  onCardSelect?: (card: { id: number; name: string; imageUrl: string | null; series: string | null }) => void;
}

type Stage = "capture" | "analyzing" | "results" | "no_match";

export function CameraSearchSheet({ open, onOpenChange, onCardSelect }: CameraSearchSheetProps) {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchedCard[]>([]);
  const [identificationInfo, setIdentificationInfo] = useState<any>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageSearchMutation = trpc.cards.searchByImage.useMutation();

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStage("capture");
      setImagePreview(null);
      setMatchResults([]);
      setIdentificationInfo(null);
      setAnalyzeProgress(0);
    }, 300);
  }, [onOpenChange]);

  const processImage = useCallback(async (file: File) => {
    // Read file as base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setImagePreview(base64);
    setStage("analyzing");
    setAnalyzeProgress(0);

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setAnalyzeProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + Math.random() * 12;
      });
    }, 300);

    try {
      const result = await imageSearchMutation.mutateAsync({ image: base64 });
      clearInterval(progressInterval);
      setAnalyzeProgress(100);

      await new Promise((r) => setTimeout(r, 400)); // brief pause at 100%

      if (result.success && result.matches && result.matches.length > 0) {
        setMatchResults(result.matches as MatchedCard[]);
        setIdentificationInfo(result.identification);

        // If best match has very high confidence (score >= 70), auto-select
        const best = result.matches[0] as MatchedCard;
        if (best.matchScore >= 70) {
          if (onCardSelect) {
            // Picker mode: return card to caller
            handleClose();
            onCardSelect({ id: best.id, name: best.nameJa || best.name, imageUrl: best.imageUrl, series: best.series });
            toast.success(`已識別：${best.nameJa || best.name}`);
          } else {
            // Navigation mode: go to card page
            handleClose();
            setLocation(`/card/${best.id}`);
            toast.success(`已識別：${best.nameJa || best.name}`);
          }
        } else {
          setStage("results");
        }
      } else if (result.success && result.identification) {
        // Identified but no DB match
        setIdentificationInfo(result.identification);
        setStage("no_match");
      } else {
        setStage("no_match");
        setIdentificationInfo(null);
      }
    } catch {
      clearInterval(progressInterval);
      setStage("capture");
      setImagePreview(null);
      toast.error("識別失敗，請重試");
    }
  }, [imageSearchMutation, handleClose, setLocation, onCardSelect]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    }
  };

  const handleSelectCard = (card: MatchedCard) => {
    if (onCardSelect) {
      // Picker mode: return card to caller
      handleClose();
      onCardSelect({ id: card.id, name: card.nameJa || card.name, imageUrl: card.imageUrl, series: card.series });
    } else {
      // Navigation mode: go to card page
      handleClose();
      setLocation(`/card/${card.id}`);
    }
  };

  const handleTextSearch = () => {
    const name = identificationInfo?.cardNameJa || identificationInfo?.cardName;
    if (name) {
      handleClose();
      setLocation(`/search?q=${encodeURIComponent(name)}`);
    }
  };

  const handleRetry = () => {
    setStage("capture");
    setImagePreview(null);
    setMatchResults([]);
    setIdentificationInfo(null);
    setAnalyzeProgress(0);
  };

  const getStageTitle = () => {
    switch (stage) {
      case "capture": return onCardSelect ? "拍照選卡" : "拍照識別";
      case "analyzing": return "AI 分析中...";
      case "results": return "識別結果";
      case "no_match": return "識別完成";
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => { if (!o) handleClose(); }}
      title={getStageTitle()}
    >
      {/* ── STAGE: CAPTURE ── */}
      {stage === "capture" && (
        <div className="flex flex-col gap-4">
          {/* Viewfinder area */}
          <div className="relative rounded-2xl overflow-hidden bg-[#06038D]/5 border-2 border-dashed border-[#06038D]/30 flex flex-col items-center justify-center min-h-[220px] py-8 px-4">
            {/* Corner brackets */}
            <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-[#06038D] rounded-tl-lg" />
            <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-[#06038D] rounded-tr-lg" />
            <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-[#06038D] rounded-bl-lg" />
            <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-[#06038D] rounded-br-lg" />

            <div className="w-16 h-16 rounded-full bg-[#06038D]/10 flex items-center justify-center mb-4">
              <Scan className="w-8 h-8 text-[#06038D]" />
            </div>
            <p className="text-sm font-semibold text-[#06038D] mb-1">
              {onCardSelect ? "拍攝卡牌以選取" : "對準卡牌拍攝"}
            </p>
            <p className="text-xs text-gray-500 text-center">確保卡牌名稱及卡號清晰可見<br />避免反光及陰影</p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Camera button */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border-2 border-[#06038D] bg-white hover:bg-[#06038D]/5 active:scale-95 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-[#06038D] flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold text-[#06038D]">拍攝照片</span>
            </button>

            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border-2 border-[#FEDD00] bg-[#FEDD00]/10 hover:bg-[#FEDD00]/20 active:scale-95 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-[#FEDD00] flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#06038D]" />
              </div>
              <span className="text-xs font-semibold text-[#06038D]">上傳圖片</span>
            </button>
          </div>

          {/* Tips */}
          <div className="rounded-xl bg-[#06038D]/5 border border-[#06038D]/10 px-4 py-3">
            <p className="text-xs font-semibold text-[#06038D] mb-1.5">💡 拍攝技巧</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• 確保卡牌名稱及卡號清晰可見</li>
              <li>• 避免反光，在自然光下拍攝效果最佳</li>
              <li>• 將卡牌放在對比色背景上</li>
            </ul>
          </div>

          {/* Hidden inputs */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </div>
      )}

      {/* ── STAGE: ANALYZING ── */}
      {stage === "analyzing" && (
        <div className="flex flex-col items-center gap-5 py-4">
          {/* Card preview */}
          {imagePreview && (
            <div className="relative w-36 h-48 rounded-xl overflow-hidden shadow-lg border-2 border-[#06038D]/20">
              <img src={imagePreview} alt="分析中" className="w-full h-full object-cover" />
              {/* Scanning animation overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#06038D]/20 to-transparent animate-scan-line" />
              <div className="absolute inset-0 border-2 border-[#FEDD00] rounded-xl animate-pulse" />
            </div>
          )}

          {/* Progress */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-[#06038D]">AI 識別中</span>
              <span className="text-sm font-bold text-[#06038D]">{Math.round(analyzeProgress)}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#06038D] to-[#FEDD00] transition-all duration-300"
                style={{ width: `${analyzeProgress}%` }}
              />
            </div>
          </div>

          {/* Status messages */}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-gray-700">
              {analyzeProgress < 40 ? "正在讀取卡牌資訊..." :
               analyzeProgress < 70 ? "比對卡牌資料庫..." :
               analyzeProgress < 90 ? "精準匹配中..." :
               "即將完成..."}
            </p>
            <p className="text-xs text-gray-400">由 Gemini AI 驅動</p>
          </div>
        </div>
      )}

      {/* ── STAGE: RESULTS ── */}
      {stage === "results" && matchResults.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Identification summary */}
          {identificationInfo && (
            <div className="rounded-xl bg-[#06038D] px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#FEDD00] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#FEDD00] mb-1">AI 識別結果</p>
                <div className="flex flex-wrap gap-1.5">
                  {identificationInfo.cardNameJa && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
                      {identificationInfo.cardNameJa}
                    </span>
                  )}
                  {identificationInfo.cardName && identificationInfo.cardName !== identificationInfo.cardNameJa && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white">
                      {identificationInfo.cardName}
                    </span>
                  )}
                  {identificationInfo.cardNumber && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEDD00]/30 text-[#FEDD00] font-mono">
                      #{identificationInfo.cardNumber}
                    </span>
                  )}
                  {identificationInfo.rarity && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                      {identificationInfo.rarity}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Match list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              找到 {matchResults.length} 個匹配結果，{onCardSelect ? "請選擇要加入的卡牌" : "請選擇正確的卡牌"}
            </p>
            {matchResults.map((card, index) => (
              <button
                key={card.id}
                onClick={() => handleSelectCard(card)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.98] hover:shadow-md text-left ${
                  index === 0
                    ? "border-[#06038D] bg-[#06038D]/5"
                    : "border-gray-200 bg-white hover:border-[#06038D]/40"
                }`}
              >
                {/* Card image */}
                <div className="w-11 h-[60px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {card.imageUrl ? (
                    <LazyImage
                      src={getProxiedImageUrl(card.imageUrl) ?? ""}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Search className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {index === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEDD00] text-[#06038D] font-bold flex-shrink-0">
                        最佳
                      </span>
                    )}
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                      {card.nameJa || card.name}
                    </p>
                  </div>
                  {card.nameJa && card.name !== card.nameJa && (
                    <p className="text-xs text-gray-400 truncate">{card.name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {card.cardNumber && (
                      <span className="text-xs text-gray-400 font-mono">#{card.cardNumber}</span>
                    )}
                    {card.rarity && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{card.rarity}</span>
                    )}
                    {card.latestPrice && (
                      <span className="text-xs font-bold text-green-600">
                        HK${card.latestPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score + arrow */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-sm font-bold ${
                    card.matchScore >= 60 ? "text-green-500" :
                    card.matchScore >= 40 ? "text-yellow-500" : "text-orange-400"
                  }`}>
                    {card.matchScore}分
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </button>
            ))}
          </div>

          {/* Retry button */}
          <button
            onClick={handleRetry}
            className="w-full h-11 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-600 flex items-center justify-center gap-2 hover:border-[#06038D]/40 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重新拍攝
          </button>
        </div>
      )}

      {/* ── STAGE: NO MATCH ── */}
      {stage === "no_match" && (
        <div className="flex flex-col items-center gap-5 py-4">
          {/* Preview */}
          {imagePreview && (
            <div className="w-28 h-36 rounded-xl overflow-hidden shadow border-2 border-gray-200">
              <img src={imagePreview} alt="識別圖片" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Identification info if available */}
          {identificationInfo && (identificationInfo.cardNameJa || identificationInfo.cardName) ? (
            <div className="w-full rounded-xl bg-[#06038D]/5 border border-[#06038D]/20 px-4 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">AI 識別到的卡牌</p>
              <p className="text-base font-bold text-[#06038D]">
                {identificationInfo.cardNameJa || identificationInfo.cardName}
              </p>
              {identificationInfo.cardNumber && (
                <p className="text-xs text-gray-400 mt-0.5">#{identificationInfo.cardNumber}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">資料庫中未找到完全匹配的卡牌</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <X className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">無法識別卡牌</p>
              <p className="text-xs text-gray-400 mt-1">請確保圖片清晰且包含完整卡牌</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="w-full space-y-3">
            {!onCardSelect && identificationInfo && (identificationInfo.cardNameJa || identificationInfo.cardName) && (
              <button
                onClick={handleTextSearch}
                className="w-full h-12 rounded-xl bg-[#06038D] text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Search className="w-4 h-4" />
                搜尋「{identificationInfo.cardNameJa || identificationInfo.cardName}」
              </button>
            )}
            <button
              onClick={handleRetry}
              className="w-full h-11 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-600 flex items-center justify-center gap-2 hover:border-[#06038D]/40 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重新拍攝
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
