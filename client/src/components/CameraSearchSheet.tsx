/**
 * CameraSearchSheet — AI Card Recognition with Live Camera Stream
 *
 * Key design decisions:
 * 1. Camera viewfinder fills the full panel width (no padding on video container)
 * 2. Auto-scan: every 2.5s, capture a frame and send to AI; if score ≥ 70 → auto-navigate
 * 3. Responsive: on mobile the sheet is near-fullscreen; on tablet it's wider
 * 4. All colours are explicit (no dark-mode CSS vars) so text is always readable
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LazyImage } from "@/components/LazyImage";
import { getProxiedImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import {
  Camera, Upload, X, RotateCcw, CheckCircle2,
  Search, ChevronRight, AlertCircle, Zap,
} from "lucide-react";

const BLUE = "#06038D";
const YELLOW = "#FEDD00";

// How often (ms) to attempt auto-scan while camera is live
const AUTO_SCAN_INTERVAL = 800;
// Minimum confidence to auto-navigate
const AUTO_NAV_THRESHOLD = 70;
// Cooldown after a failed auto-scan (ms) before trying again
const AUTO_SCAN_COOLDOWN = 1500;

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
  const [autoScanActive, setAutoScanActive] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);
  const [lowLightMode, setLowLightMode] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnalyzingRef = useRef(false);
  const stageRef = useRef<Stage>("camera");
  const lastScanEndRef = useRef<number>(0);

  // Keep stageRef in sync
  useEffect(() => { stageRef.current = stage; }, [stage]);

  const imageSearchMutation = trpc.cards.searchByImage.useMutation();

  // ── Stop camera stream ──────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setAutoScanActive(false);
  }, []);

  // ── Capture frame from video ────────────────────────────────
  const captureFrame = useCallback((quality = 0.75): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;
    // Downscale to max 960px wide for faster upload while keeping enough detail
    const maxW = 960;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  }, []);

  // ── Detect if viewfinder corners are covered by a bright object ──
  // Samples pixel brightness at the four corner-bracket positions.
  // Returns true when all four corners appear to have content (non-black).
  const cornersAreCovered = useCallback((): boolean => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return false;
    const w = video.videoWidth;
    const h = video.videoHeight;
    // Use a tiny offscreen canvas for speed
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(video, 0, 0, w, h);
    // Sample 5×5 patches at each corner-bracket position (inset ~8% from edges)
    const insetX = Math.round(w * 0.08);
    const insetY = Math.round(h * 0.08);
    const patchSize = 5;
    const samplePoints = [
      [insetX, insetY],
      [w - insetX, insetY],
      [insetX, h - insetY],
      [w - insetX, h - insetY],
    ];
    const BRIGHTNESS_THRESHOLD = 30; // 0–255; below this = too dark / no card
    for (const [sx, sy] of samplePoints) {
      const data = ctx.getImageData(Math.max(0, sx - 2), Math.max(0, sy - 2), patchSize, patchSize).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avg = sum / (data.length / 4);
      if (avg < BRIGHTNESS_THRESHOLD) return false;
    }
    return true;
  }, [lowLightMode]);

  // ── Process base64 image through AI ────────────────────────
  const processBase64 = useCallback(async (base64: string, isAutoScan = false) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;

    if (!isAutoScan) {
      stopCamera();
      setCapturedImage(base64);
      setStage("analyzing");
      setAnalyzeProgress(0);
    } else {
      setScanPulse(true);
      setTimeout(() => setScanPulse(false), 600);
    }

    const progressInterval = isAutoScan ? null : setInterval(() => {
      setAnalyzeProgress((prev) => {
        if (prev >= 85) { clearInterval(progressInterval!); return 85; }
        return prev + Math.random() * 12;
      });
    }, 300);

    try {
      const result = await imageSearchMutation.mutateAsync({ image: base64 });

      if (progressInterval) { clearInterval(progressInterval); setAnalyzeProgress(100); }
      await new Promise((r) => setTimeout(r, isAutoScan ? 0 : 400));

      if (result.success && result.matches && result.matches.length > 0) {
        const best = result.matches[0] as MatchedCard;

        if (best.matchScore >= AUTO_NAV_THRESHOLD) {
          // High confidence → green flash animation then navigate
          stopCamera();
          setSuccessFlash(true);
          await new Promise((r) => setTimeout(r, 350));
          setSuccessFlash(false);
          if (onCardSelect) {
            onOpenChange(false);
            onCardSelect({ id: best.id, name: best.nameJa || best.name, imageUrl: best.imageUrl, series: best.series });
          } else {
            onOpenChange(false);
            setLocation(`/card/${best.id}`);
          }
          toast.success(`已識別：${best.nameJa || best.name}`);
        } else if (!isAutoScan) {
          // Manual capture, lower confidence → show results
          setMatchResults(result.matches as MatchedCard[]);
          setIdentificationInfo(result.identification);
          setStage("results");
        }
        // Auto-scan with low confidence → keep scanning silently
      } else if (!isAutoScan) {
        if (result.identification) {
          setIdentificationInfo(result.identification);
          setStage("no_match");
        } else {
          setStage("no_match");
          setIdentificationInfo(null);
        }
      }
    } catch {
      if (progressInterval) clearInterval(progressInterval);
      if (!isAutoScan) {
        setStage("camera");
        setCapturedImage(null);
        toast.error("識別失敗，請重試");
      }
    } finally {
      isAnalyzingRef.current = false;
      lastScanEndRef.current = Date.now();
    }
  }, [imageSearchMutation, onCardSelect, onOpenChange, setLocation, stopCamera]);

  // ── Start camera stream ─────────────────────────────────────
  const startCamera = useCallback(async (front = false) => {
    stopCamera();
    isAnalyzingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: front ? "user" : { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setAutoScanActive(true);

        // Start auto-scan loop
        autoScanTimerRef.current = setInterval(() => {
          if (stageRef.current !== "camera") return;
          if (isAnalyzingRef.current) return;
          // Respect cooldown after a previous scan
          if (Date.now() - lastScanEndRef.current < AUTO_SCAN_COOLDOWN) return;
          // Only fire if all four corners have content (card is in frame)
          if (!cornersAreCovered()) return;
          const frame = captureFrame(0.75);
          if (frame) processBase64(frame, true);
        }, AUTO_SCAN_INTERVAL);
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setStage("permission_denied");
      } else {
        toast.error("無法啟動相機，請使用上傳功能");
      }
    }
  }, [stopCamera, captureFrame, processBase64, cornersAreCovered]);

  // ── Open/close lifecycle ────────────────────────────────────
  useEffect(() => {
    if (open && stage === "camera") {
      startCamera(isFrontCamera);
    }
    if (!open) {
      stopCamera();
    }
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
      isAnalyzingRef.current = false;
    }, 300);
  }, [onOpenChange, stopCamera]);

  // ── Manual shutter (high quality 0.92 for better accuracy) ──
  const handleCapture = useCallback(() => {
    const base64 = captureFrame(0.92);
    if (!base64) { toast.error("無法擷取畫面"); return; }
    processBase64(base64, false);
  }, [captureFrame, processBase64]);

  // ── File upload fallback ────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onloadend = () => processBase64(reader.result as string, false);
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
    isAnalyzingRef.current = false;
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

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => { if (!o) handleClose(); }}
      title={getStageTitle()}
      bodyClassName=""
    >
      {/* Force light background for entire sheet content */}
      <div style={{ background: "white", color: "#111827" }}>

        {/* ── STAGE: CAMERA (live viewfinder) ── */}
        {stage === "camera" && (
          <div className="flex flex-col">
            {/* ── Full-width viewfinder ── */}
            <div
              className="relative w-full overflow-hidden"
              style={{
                // Responsive height: use dvh-based calculation to avoid overflow on tablets
                // On phones (~390px wide): ~55dvh
                // On tablets (~768px wide): cap at 50dvh to prevent corner clipping
                height: "clamp(240px, 50dvh, 520px)",
                background: "#000",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
              />

              {/* Corner brackets — use inset % so they always stay inside the viewfinder */}
              {cameraReady && (
                <>
                  {/* TL */}
                  <div className="absolute pointer-events-none"
                    style={{ top: 16, left: 16, width: 40, height: 40, borderTop: `3px solid ${scanPulse ? "white" : YELLOW}`, borderLeft: `3px solid ${scanPulse ? "white" : YELLOW}`, borderRadius: "4px 0 0 0", transition: "border-color 0.3s" }} />
                  {/* TR */}
                  <div className="absolute pointer-events-none"
                    style={{ top: 16, right: 16, width: 40, height: 40, borderTop: `3px solid ${scanPulse ? "white" : YELLOW}`, borderRight: `3px solid ${scanPulse ? "white" : YELLOW}`, borderRadius: "0 4px 0 0", transition: "border-color 0.3s" }} />
                  {/* BL */}
                  <div className="absolute pointer-events-none"
                    style={{ bottom: 32, left: 16, width: 40, height: 40, borderBottom: `3px solid ${scanPulse ? "white" : YELLOW}`, borderLeft: `3px solid ${scanPulse ? "white" : YELLOW}`, borderRadius: "0 0 0 4px", transition: "border-color 0.3s" }} />
                  {/* BR */}
                  <div className="absolute pointer-events-none"
                    style={{ bottom: 32, right: 16, width: 40, height: 40, borderBottom: `3px solid ${scanPulse ? "white" : YELLOW}`, borderRight: `3px solid ${scanPulse ? "white" : YELLOW}`, borderRadius: "0 0 4px 0", transition: "border-color 0.3s" }} />

                  {/* Auto-scan indicator */}
                  {autoScanActive && (
                    <div className="absolute top-3 right-14 flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(0,0,0,0.55)" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: YELLOW }} />
                      <span className="text-[10px] font-semibold text-white">自動識別</span>
                    </div>
                  )}

                  {/* Guide text */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                    <p className="text-white/80 text-xs font-medium px-3 py-1 rounded-full"
                      style={{ background: "rgba(0,0,0,0.45)" }}>
                      將卡牌對準框內，系統將自動識別
                    </p>
                  </div>
                </>
              )}

              {/* Success flash overlay */}
              {successFlash && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
                  style={{ background: "rgba(22,163,74,0.45)", animation: "successFlashAnim 0.35s ease-out" }}
                >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.9)", boxShadow: "0 0 24px rgba(22,163,74,0.6)" }}>
                    <CheckCircle2 className="w-9 h-9" style={{ color: "#16a34a" }} />
                  </div>
                  <p className="text-white font-bold text-sm"
                    style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>識別成功！</p>
                  {/* Green corner brackets */}
                  <div className="absolute"
                    style={{ top: 16, left: 16, width: 40, height: 40, borderTop: "3px solid #22c55e", borderLeft: "3px solid #22c55e", borderRadius: "4px 0 0 0" }} />
                  <div className="absolute"
                    style={{ top: 16, right: 16, width: 40, height: 40, borderTop: "3px solid #22c55e", borderRight: "3px solid #22c55e", borderRadius: "0 4px 0 0" }} />
                  <div className="absolute"
                    style={{ bottom: 32, left: 16, width: 40, height: 40, borderBottom: "3px solid #22c55e", borderLeft: "3px solid #22c55e", borderRadius: "0 0 0 4px" }} />
                  <div className="absolute"
                    style={{ bottom: 32, right: 16, width: 40, height: 40, borderBottom: "3px solid #22c55e", borderRight: "3px solid #22c55e", borderRadius: "0 0 4px 0" }} />
                </div>
              )}

              {/* Loading state */}
              {!cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="text-white/70 text-xs">啟動相機中...</p>
                </div>
              )}
            </div>

            {/* Hidden canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controls row */}
            <div className="flex items-center justify-between px-6 py-4" style={{ background: "white" }}>
              {/* Upload */}
              <button onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 w-16">
                <div className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: "#f3f4f6", border: "1.5px solid #e5e7eb" }}>
                  <Upload className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: "#374151" }}>相簿</span>
              </button>

              {/* Shutter */}
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40"
                style={{
                  width: 76, height: 76,
                  background: cameraReady ? BLUE : "#9ca3af",
                  border: `4px solid ${YELLOW}`,
                  boxShadow: cameraReady ? `0 0 0 3px rgba(6,3,141,0.2)` : "none",
                }}
              >
                <Camera className="w-8 h-8 text-white" />
              </button>

              {/* Flip */}
              <button
                onClick={() => { const next = !isFrontCamera; setIsFrontCamera(next); startCamera(next); }}
                className="flex flex-col items-center gap-1.5 w-16">
                <div className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: "#f3f4f6", border: "1.5px solid #e5e7eb" }}>
                  <RotateCcw className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: "#374151" }}>翻轉</span>
              </button>
            </div>

            {/* Tip + Low-light toggle */}
            <div className="mx-4 mb-4 space-y-2">
              <div className="rounded-xl px-3 py-2.5"
                style={{ background: `${BLUE}08`, border: `1px solid ${BLUE}15` }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: BLUE }}>💡 拍攝技巧</p>
                <p className="text-xs" style={{ color: "#4b5563" }}>確保卡牌名稱及卡號清晰可見，避免反光及陰影。卡牌充滿取景框時系統將自動識別。</p>
              </div>
              {/* Low-light mode toggle */}
              <button
                onClick={() => setLowLightMode((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: lowLightMode ? `${BLUE}12` : "#f9fafb",
                  border: `1.5px solid ${lowLightMode ? BLUE : "#e5e7eb"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🌙</span>
                  <div className="text-left">
                    <p className="text-xs font-semibold" style={{ color: lowLightMode ? BLUE : "#374151" }}>低光模式</p>
                    <p className="text-[10px]" style={{ color: "#9ca3af" }}>降低亮度偵測門值至 15，適用於光線不足環境</p>
                  </div>
                </div>
                <div
                  className="w-10 h-5.5 rounded-full flex items-center transition-all"
                  style={{
                    background: lowLightMode ? BLUE : "#d1d5db",
                    padding: "2px",
                    justifyContent: lowLightMode ? "flex-end" : "flex-start",
                  }}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>
        )}

        {/* ── STAGE: PERMISSION DENIED ── */}
        {stage === "permission_denied" && (
          <div className="flex flex-col items-center gap-4 py-8 px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#fee2e2" }}>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold" style={{ color: "#111827" }}>相機權限被拒絕</p>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>請在瀏覽器設定中允許相機存取，或使用上傳圖片功能</p>
            </div>
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
              style={{ background: BLUE, color: "white" }}>
              <Upload className="w-4 h-4" />改用上傳圖片
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>
        )}

        {/* ── STAGE: ANALYZING ── */}
        {stage === "analyzing" && (
          <div className="flex flex-col items-center gap-5 py-6 px-6">
            {capturedImage && (
              <div className="relative rounded-xl overflow-hidden shadow-lg"
                style={{ width: 140, height: 186, border: `2px solid ${BLUE}20` }}>
                <img src={capturedImage} alt="分析中" className="w-full h-full object-cover" />
                <div className="absolute inset-0 rounded-xl animate-pulse"
                  style={{ border: `2px solid ${YELLOW}` }} />
              </div>
            )}
            <div className="w-full max-w-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold" style={{ color: BLUE }}>AI 識別中</span>
                <span className="text-sm font-bold" style={{ color: BLUE }}>{Math.round(analyzeProgress)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${analyzeProgress}%`, background: `linear-gradient(to right, ${BLUE}, ${YELLOW})` }} />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium" style={{ color: "#374151" }}>
                {analyzeProgress < 40 ? "正在讀取卡牌資訊..." :
                 analyzeProgress < 70 ? "比對卡牌資料庫..." :
                 analyzeProgress < 90 ? "精準匹配中..." : "即將完成..."}
              </p>
              <p className="text-xs flex items-center justify-center gap-1" style={{ color: "#9ca3af" }}>
                <Zap className="w-3 h-3" />由 Gemini AI 驅動
              </p>
            </div>
          </div>
        )}

        {/* ── STAGE: RESULTS ── */}
        {stage === "results" && matchResults.length > 0 && (
          <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
            {identificationInfo && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: BLUE }}>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: YELLOW }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-1" style={{ color: YELLOW }}>AI 識別結果</p>
                  <div className="flex flex-wrap gap-1.5">
                    {identificationInfo.cardNameJa && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                        {identificationInfo.cardNameJa}
                      </span>
                    )}
                    {identificationInfo.cardNumber && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                        style={{ background: `${YELLOW}30`, color: YELLOW }}>
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
                <button key={card.id} onClick={() => handleSelectCard(card)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
                  style={{ border: `2px solid ${index === 0 ? BLUE : "#e5e7eb"}`, background: index === 0 ? `${BLUE}08` : "white" }}>
                  <div className="w-11 flex-shrink-0 rounded-lg overflow-hidden"
                    style={{ height: 60, background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                          style={{ background: YELLOW, color: BLUE }}>最佳</span>
                      )}
                      <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
                        {card.nameJa || card.name}
                      </p>
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

            <button onClick={handleRetry}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
              style={{ border: "2px solid #e5e7eb", background: "white", color: "#374151" }}>
              <RotateCcw className="w-4 h-4" />重新拍攝
            </button>
          </div>
        )}

        {/* ── STAGE: NO MATCH ── */}
        {stage === "no_match" && (
          <div className="flex flex-col items-center gap-5 py-6 px-6">
            {capturedImage && (
              <div className="w-28 h-36 rounded-xl overflow-hidden shadow" style={{ border: "2px solid #e5e7eb" }}>
                <img src={capturedImage} alt="識別圖片" className="w-full h-full object-cover" />
              </div>
            )}
            {identificationInfo && (identificationInfo.cardNameJa || identificationInfo.cardName) ? (
              <div className="w-full rounded-xl px-4 py-3 text-center"
                style={{ background: `${BLUE}08`, border: `1px solid ${BLUE}20` }}>
                <p className="text-xs mb-1" style={{ color: "#6b7280" }}>AI 識別到的卡牌</p>
                <p className="text-base font-bold" style={{ color: BLUE }}>
                  {identificationInfo.cardNameJa || identificationInfo.cardName}
                </p>
                {identificationInfo.cardNumber && (
                  <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>#{identificationInfo.cardNumber}</p>
                )}
                <p className="text-xs mt-2" style={{ color: "#6b7280" }}>資料庫中未找到完全匹配的卡牌</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "#f3f4f6" }}>
                  <X className="w-7 h-7" style={{ color: "#9ca3af" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "#374151" }}>無法識別卡牌</p>
                <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>請確保圖片清晰且包含完整卡牌</p>
              </div>
            )}
            <div className="w-full space-y-3">
              {!onCardSelect && identificationInfo && (identificationInfo.cardNameJa || identificationInfo.cardName) && (
                <button onClick={handleTextSearch}
                  className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
                  style={{ background: BLUE, color: "white" }}>
                  <Search className="w-4 h-4" />
                  搜尋「{identificationInfo.cardNameJa || identificationInfo.cardName}」
                </button>
              )}
              <button onClick={handleRetry}
                className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
                style={{ border: "2px solid #e5e7eb", background: "white", color: "#374151" }}>
                <RotateCcw className="w-4 h-4" />重新拍攝
              </button>
            </div>
          </div>
        )}

      </div>
    </BottomSheet>
  );
}
