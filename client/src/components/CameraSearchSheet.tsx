/**
 * CameraSearchSheet — AI Card Recognition with Live Camera Stream
 * - Requests camera permission on open
 * - Shows live camera feed in viewfinder
 * - Capture button takes photo → AI recognition → auto-navigate or show candidates
 * - Upload fallback for gallery images
 * - Picker mode: onCardSelect callback instead of navigation
 * - All colors forced to light mode (no dark mode overrides)
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LazyImage } from "@/components/LazyImage";
import { getProxiedImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import { Camera, Upload, X, RotateCcw, CheckCircle2, Search, ChevronRight, Zap, AlertCircle } from "lucide-react";

const BLUE = "#06038D";
const YELLOW = "#FEDD00";

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

type Stage = "camera" | "analyzing" | "results" | "no_match" | "permission_denied";

export function CameraSearchSheet({ open, onOpenChange, onCardSelect }: CameraSearchSheetProps) {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchedCard[]>([]);
  const [identificationInfo, setIdentificationInfo] = useState<any>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const imageSearchMutation = trpc.cards.searchByImage.useMutation();

  // ── Stop camera stream ──────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // ── Start camera stream ─────────────────────────────────────
  const startCamera = useCallback(async (front = false) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: front ? "user" : { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setStage("permission_denied");
      } else {
        toast.error("無法啟動相機，請使用上傳功能");
      }
    }
  }, [stopCamera]);

  // ── Open/close lifecycle ────────────────────────────────────
  useEffect(() => {
    if (open && stage === "camera") {
      startCamera(isFrontCamera);
    }
    if (!open) {
      stopCamera();
    }
    return () => {
      if (!open) stopCamera();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    stopCamera();
    onOpenChange(false);
    setTimeout(() => {
      setStage("camera");
      setCapturedImage(null);
      setMatchResults([]);
      setIdentificationInfo(null);
      setAnalyzeProgress(0);
      setCameraReady(false);
    }, 300);
  }, [onOpenChange, stopCamera]);

  // ── Capture frame from video ────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  // ── Process base64 image through AI ────────────────────────
  const processBase64 = useCallback(async (base64: string) => {
    stopCamera();
    setCapturedImage(base64);
    setStage("analyzing");
    setAnalyzeProgress(0);

    const progressInterval = setInterval(() => {
      setAnalyzeProgress((prev) => {
        if (prev >= 85) { clearInterval(progressInterval); return 85; }
        return prev + Math.random() * 12;
      });
    }, 300);

    try {
      const result = await imageSearchMutation.mutateAsync({ image: base64 });
      clearInterval(progressInterval);
      setAnalyzeProgress(100);
      await new Promise((r) => setTimeout(r, 400));

      if (result.success && result.matches && result.matches.length > 0) {
        setMatchResults(result.matches as MatchedCard[]);
        setIdentificationInfo(result.identification);

        const best = result.matches[0] as MatchedCard;
        if (best.matchScore >= 70) {
          if (onCardSelect) {
            handleClose();
            onCardSelect({ id: best.id, name: best.nameJa || best.name, imageUrl: best.imageUrl, series: best.series });
            toast.success(`已識別：${best.nameJa || best.name}`);
          } else {
            handleClose();
            setLocation(`/card/${best.id}`);
            toast.success(`已識別：${best.nameJa || best.name}`);
          }
        } else {
          setStage("results");
        }
      } else if (result.success && result.identification) {
        setIdentificationInfo(result.identification);
        setStage("no_match");
      } else {
        setStage("no_match");
        setIdentificationInfo(null);
      }
    } catch {
      clearInterval(progressInterval);
      // Go back to camera
      setStage("camera");
      setCapturedImage(null);
      toast.error("識別失敗，請重試");
      startCamera(isFrontCamera);
    }
  }, [imageSearchMutation, handleClose, setLocation, onCardSelect, stopCamera, startCamera, isFrontCamera]);

  // ── Shutter button ──────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const base64 = captureFrame();
    if (!base64) { toast.error("無法擷取畫面"); return; }
    processBase64(base64);
  }, [captureFrame, processBase64]);

  // ── File upload fallback ────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onloadend = () => processBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Select a card from results ──────────────────────────────
  const handleSelectCard = (card: MatchedCard) => {
    if (onCardSelect) {
      handleClose();
      onCardSelect({ id: card.id, name: card.nameJa || card.name, imageUrl: card.imageUrl, series: card.series });
    } else {
      handleClose();
      setLocation(`/card/${card.id}`);
    }
  };

  const handleTextSearch = () => {
    const name = identificationInfo?.cardNameJa || identificationInfo?.cardName;
    if (name) { handleClose(); setLocation(`/search?q=${encodeURIComponent(name)}`); }
  };

  const handleRetry = () => {
    setStage("camera");
    setCapturedImage(null);
    setMatchResults([]);
    setIdentificationInfo(null);
    setAnalyzeProgress(0);
    startCamera(isFrontCamera);
  };

  const getStageTitle = () => {
    switch (stage) {
      case "camera": return onCardSelect ? "拍照選卡" : "拍照識別";
      case "analyzing": return "AI 分析中...";
      case "results": return "識別結果";
      case "no_match": return "識別完成";
      case "permission_denied": return "相機權限";
    }
  };

  // ── Shared wrapper style (always light mode) ────────────────
  const lightBg: React.CSSProperties = { background: "white", color: "#111827" };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => { if (!o) handleClose(); }}
      title={getStageTitle()}
    >
      <div style={lightBg}>

        {/* ── STAGE: CAMERA (live viewfinder) ── */}
        {stage === "camera" && (
          <div className="flex flex-col gap-3 pb-2">
            {/* Live viewfinder */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{ background: "#000", aspectRatio: "3/4", maxHeight: "55vh" }}
            >
              {/* Video element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
              />

              {/* Corner brackets overlay */}
              {cameraReady && (
                <>
                  <div className="absolute top-4 left-4 w-10 h-10 border-t-[3px] border-l-[3px] border-[#FEDD00] rounded-tl-lg pointer-events-none" />
                  <div className="absolute top-4 right-4 w-10 h-10 border-t-[3px] border-r-[3px] border-[#FEDD00] rounded-tr-lg pointer-events-none" />
                  <div className="absolute bottom-4 left-4 w-10 h-10 border-b-[3px] border-l-[3px] border-[#FEDD00] rounded-bl-lg pointer-events-none" />
                  <div className="absolute bottom-4 right-4 w-10 h-10 border-b-[3px] border-r-[3px] border-[#FEDD00] rounded-br-lg pointer-events-none" />
                  {/* Center guide */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-white/70 text-xs font-medium bg-black/30 px-3 py-1 rounded-full">
                      將卡牌對準框內
                    </p>
                  </div>
                </>
              )}

              {/* Loading state */}
              {!cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="text-white/70 text-xs">啟動相機中...</p>
                </div>
              )}
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controls row */}
            <div className="flex items-center justify-between px-2 py-1">
              {/* Upload fallback */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-1 w-14"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "#f3f4f6", border: "1.5px solid #e5e7eb" }}
                >
                  <Upload className="w-4.5 h-4.5" style={{ color: BLUE }} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: "#374151" }}>相簿</span>
              </button>

              {/* Shutter button */}
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40"
                style={{
                  width: 72, height: 72,
                  background: cameraReady ? BLUE : "#9ca3af",
                  border: `4px solid ${YELLOW}`,
                  boxShadow: cameraReady ? `0 0 0 3px ${BLUE}30` : "none",
                }}
              >
                <Camera className="w-7 h-7 text-white" />
              </button>

              {/* Flip camera */}
              <button
                onClick={() => { setIsFrontCamera((f) => !f); startCamera(!isFrontCamera); }}
                className="flex flex-col items-center gap-1 w-14"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "#f3f4f6", border: "1.5px solid #e5e7eb" }}
                >
                  <RotateCcw className="w-4.5 h-4.5" style={{ color: BLUE }} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: "#374151" }}>翻轉</span>
              </button>
            </div>

            {/* Tip */}
            <div
              className="mx-1 rounded-xl px-3 py-2.5"
              style={{ background: `${BLUE}08`, border: `1px solid ${BLUE}15` }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: BLUE }}>💡 拍攝技巧</p>
              <p className="text-xs" style={{ color: "#4b5563" }}>確保卡牌名稱及卡號清晰可見，避免反光及陰影</p>
            </div>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>
        )}

        {/* ── STAGE: PERMISSION DENIED ── */}
        {stage === "permission_denied" && (
          <div className="flex flex-col items-center gap-4 py-6 px-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#fee2e2" }}
            >
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold" style={{ color: "#111827" }}>相機權限被拒絕</p>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                請在瀏覽器設定中允許相機存取，或使用上傳圖片功能
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
              style={{ background: BLUE, color: "white" }}
            >
              <Upload className="w-4 h-4" />
              改用上傳圖片
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>
        )}

        {/* ── STAGE: ANALYZING ── */}
        {stage === "analyzing" && (
          <div className="flex flex-col items-center gap-5 py-4 px-4">
            {capturedImage && (
              <div
                className="relative rounded-xl overflow-hidden shadow-lg"
                style={{ width: 144, height: 192, border: `2px solid ${BLUE}20` }}
              >
                <img src={capturedImage} alt="分析中" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#06038D]/20 to-transparent animate-scan-line" />
                <div className="absolute inset-0 rounded-xl animate-pulse" style={{ border: `2px solid ${YELLOW}` }} />
              </div>
            )}
            <div className="w-full max-w-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold" style={{ color: BLUE }}>AI 識別中</span>
                <span className="text-sm font-bold" style={{ color: BLUE }}>{Math.round(analyzeProgress)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${analyzeProgress}%`, background: `linear-gradient(to right, ${BLUE}, ${YELLOW})` }}
                />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium" style={{ color: "#374151" }}>
                {analyzeProgress < 40 ? "正在讀取卡牌資訊..." :
                 analyzeProgress < 70 ? "比對卡牌資料庫..." :
                 analyzeProgress < 90 ? "精準匹配中..." : "即將完成..."}
              </p>
              <p className="text-xs" style={{ color: "#9ca3af" }}>由 Gemini AI 驅動</p>
            </div>
          </div>
        )}

        {/* ── STAGE: RESULTS ── */}
        {stage === "results" && matchResults.length > 0 && (
          <div className="flex flex-col gap-4 px-1 pb-2">
            {identificationInfo && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: BLUE }}>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: YELLOW }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-1" style={{ color: YELLOW }}>AI 識別結果</p>
                  <div className="flex flex-wrap gap-1.5">
                    {identificationInfo.cardNameJa && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                        {identificationInfo.cardNameJa}
                      </span>
                    )}
                    {identificationInfo.cardNumber && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: `${YELLOW}30`, color: YELLOW }}>
                        #{identificationInfo.cardNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>
                找到 {matchResults.length} 個匹配結果，{onCardSelect ? "請選擇要加入的卡牌" : "請選擇正確的卡牌"}
              </p>
              {matchResults.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => handleSelectCard(card)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
                  style={{
                    border: `2px solid ${index === 0 ? BLUE : "#e5e7eb"}`,
                    background: index === 0 ? `${BLUE}08` : "white",
                  }}
                >
                  <div className="w-11 flex-shrink-0 rounded-lg overflow-hidden" style={{ height: 60, background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                    {card.imageUrl ? (
                      <LazyImage src={getProxiedImageUrl(card.imageUrl) ?? ""} alt={card.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Search className="w-4 h-4" style={{ color: "#d1d5db" }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {index === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: YELLOW, color: BLUE }}>最佳</span>
                      )}
                      <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{card.nameJa || card.name}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {card.cardNumber && <span className="text-xs font-mono" style={{ color: "#9ca3af" }}>#{card.cardNumber}</span>}
                      {card.rarity && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f3f4f6", color: "#6b7280" }}>{card.rarity}</span>}
                      {card.latestPrice && <span className="text-xs font-bold" style={{ color: "#16a34a" }}>HK${card.latestPrice.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold ${card.matchScore >= 60 ? "text-green-500" : card.matchScore >= 40 ? "text-yellow-500" : "text-orange-400"}`}>
                      {card.matchScore}分
                    </span>
                    <ChevronRight className="w-4 h-4" style={{ color: "#d1d5db" }} />
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleRetry}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
              style={{ border: "2px solid #e5e7eb", background: "white", color: "#374151" }}
            >
              <RotateCcw className="w-4 h-4" />重新拍攝
            </button>
          </div>
        )}

        {/* ── STAGE: NO MATCH ── */}
        {stage === "no_match" && (
          <div className="flex flex-col items-center gap-5 py-4 px-4">
            {capturedImage && (
              <div className="w-28 h-36 rounded-xl overflow-hidden shadow" style={{ border: "2px solid #e5e7eb" }}>
                <img src={capturedImage} alt="識別圖片" className="w-full h-full object-cover" />
              </div>
            )}
            {identificationInfo && (identificationInfo.cardNameJa || identificationInfo.cardName) ? (
              <div className="w-full rounded-xl px-4 py-3 text-center" style={{ background: `${BLUE}08`, border: `1px solid ${BLUE}20` }}>
                <p className="text-xs mb-1" style={{ color: "#6b7280" }}>AI 識別到的卡牌</p>
                <p className="text-base font-bold" style={{ color: BLUE }}>{identificationInfo.cardNameJa || identificationInfo.cardName}</p>
                {identificationInfo.cardNumber && <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>#{identificationInfo.cardNumber}</p>}
                <p className="text-xs mt-2" style={{ color: "#6b7280" }}>資料庫中未找到完全匹配的卡牌</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f3f4f6" }}>
                  <X className="w-7 h-7" style={{ color: "#9ca3af" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "#374151" }}>無法識別卡牌</p>
                <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>請確保圖片清晰且包含完整卡牌</p>
              </div>
            )}
            <div className="w-full space-y-3">
              {!onCardSelect && identificationInfo && (identificationInfo.cardNameJa || identificationInfo.cardName) && (
                <button
                  onClick={handleTextSearch}
                  className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
                  style={{ background: BLUE, color: "white" }}
                >
                  <Search className="w-4 h-4" />
                  搜尋「{identificationInfo.cardNameJa || identificationInfo.cardName}」
                </button>
              )}
              <button
                onClick={handleRetry}
                className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
                style={{ border: "2px solid #e5e7eb", background: "white", color: "#374151" }}
              >
                <RotateCcw className="w-4 h-4" />重新拍攝
              </button>
            </div>
          </div>
        )}

      </div>
    </BottomSheet>
  );
}
