/**
 * WallOfSighs.tsx — 嘆息之牆 · Nordic Sanctuary Style
 *
 * Features:
 * - Ice crystal particle burst on sigh click (Canvas overlay)
 * - Sacred Nordic audio via Web Audio API (no external files)
 * - Fullscreen card gallery lightbox with aurora shimmer effect
 * - Marble shrine containers, stacked card relics, glacier slide comments
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Crown, MessageCircle, Wind, Share2, Loader2, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useLocation } from "wouter";

// ── Constants ──────────────────────────────────────────────────────────────────
const QUICK_COMMENTS = [
  "大佬還缺腿件嗎？",
  "跪著看完了這張圖",
  "我手裡的卡瞬間不香了",
  "請問大佬收徒嗎？",
  "這輩子是沒機會了",
];

function formatHKD(val: number) {
  return `HKD ${val.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Sacred Audio Engine (Web Audio API — no external files) ───────────────────
function useSacredAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  /** Play a layered Nordic sigh tone:
   *  1. High crystal bell (sine, 880Hz → 1760Hz sweep, short)
   *  2. Mid resonant hum (triangle, 220Hz, slow fade)
   *  3. Sub-bass breath (sine, 55Hz, very soft)
   */
  const playSighSound = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;

      // Master gain
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.18, now);
      master.connect(ctx.destination);

      // ── Layer 1: Crystal bell sweep ──────────────────────────
      const bell = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bell.type = "sine";
      bell.frequency.setValueAtTime(880, now);
      bell.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      bell.frequency.exponentialRampToValueAtTime(1320, now + 0.4);
      bellGain.gain.setValueAtTime(0, now);
      bellGain.gain.linearRampToValueAtTime(0.7, now + 0.02);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      bell.connect(bellGain);
      bellGain.connect(master);
      bell.start(now);
      bell.stop(now + 0.95);

      // ── Layer 2: Harmonic overtone (5th above) ───────────────
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(1320, now);
      overtone.frequency.exponentialRampToValueAtTime(2640, now + 0.06);
      overtoneGain.gain.setValueAtTime(0, now);
      overtoneGain.gain.linearRampToValueAtTime(0.25, now + 0.03);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      overtone.connect(overtoneGain);
      overtoneGain.connect(master);
      overtone.start(now);
      overtone.stop(now + 0.65);

      // ── Layer 3: Resonant Nordic hum ────────────────────────
      const hum = ctx.createOscillator();
      const humGain = ctx.createGain();
      hum.type = "triangle";
      hum.frequency.setValueAtTime(220, now);
      hum.frequency.linearRampToValueAtTime(196, now + 1.2);
      humGain.gain.setValueAtTime(0, now);
      humGain.gain.linearRampToValueAtTime(0.3, now + 0.15);
      humGain.gain.setValueAtTime(0.3, now + 0.6);
      humGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      hum.connect(humGain);
      humGain.connect(master);
      hum.start(now);
      hum.stop(now + 1.85);

      // ── Layer 4: Sub-bass breath ─────────────────────────────
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(55, now);
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.15, now + 0.3);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      sub.connect(subGain);
      subGain.connect(master);
      sub.start(now);
      sub.stop(now + 1.55);

      // ── Layer 5: Ice shimmer noise burst ────────────────────
      const bufferSize = ctx.sampleRate * 0.12;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "highpass";
      noiseFilter.frequency.value = 4000;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(now);

    } catch (e) {
      // Audio not supported — silently ignore
    }
  }, [getCtx]);

  return { playSighSound };
}

// ── Ice Crystal Particle System ───────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  shape: "crystal" | "shard" | "dot";
}

function useIceParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  // Create canvas once
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 9999;
    `;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.remove();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const drawCrystal = (ctx: CanvasRenderingContext2D, p: Particle) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.life / p.maxLife;

    if (p.shape === "crystal") {
      // 6-pointed snowflake
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.15;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -p.size);
        // Branch
        ctx.moveTo(0, -p.size * 0.5);
        ctx.lineTo(p.size * 0.25, -p.size * 0.7);
        ctx.moveTo(0, -p.size * 0.5);
        ctx.lineTo(-p.size * 0.25, -p.size * 0.7);
        ctx.stroke();
        ctx.restore();
      }
    } else if (p.shape === "shard") {
      // Diamond shard
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.4, 0);
      ctx.lineTo(0, p.size * 0.6);
      ctx.lineTo(-p.size * 0.4, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Glowing dot
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const spawnBurst = useCallback((clientX: number, clientY: number) => {
    const colors = [
      "rgba(200,230,255,0.95)",
      "rgba(168,216,234,0.9)",
      "rgba(220,240,255,0.85)",
      "rgba(255,255,255,0.95)",
      "rgba(180,210,240,0.9)",
      "rgba(201,168,76,0.8)",   // gold accent
    ];

    const newParticles: Particle[] = [];
    const count = 32;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 2.5 + Math.random() * 5;
      const shape: Particle["shape"] = i % 3 === 0 ? "crystal" : i % 3 === 1 ? "shard" : "dot";
      newParticles.push({
        x: clientX, y: clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        maxLife: 0.7 + Math.random() * 0.8,
        size: shape === "crystal" ? 6 + Math.random() * 8 : 3 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        shape,
      });
    }
    particlesRef.current.push(...newParticles);

    // Start animation loop if not running
    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter(p => p.life > 0.01);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.97; // air resistance
        p.life -= 0.022;
        p.rotation += p.rotSpeed;
        drawCrystal(ctx, p);
      }

      if (particlesRef.current.length > 0) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
  }, []);

  return { spawnBurst };
}

// ── Animated Counter ───────────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{display.toLocaleString("en-HK")}</>;
}

// ── Fullscreen Card Gallery ────────────────────────────────────────────────────
interface GalleryCard {
  imageUrl: string;
  name?: string | null;
  grade?: string | null;
  grader?: string | null;
}

function CardGallery({
  cards,
  initialIndex,
  ownerName,
  onClose,
}: {
  cards: GalleryCard[];
  initialIndex: number;
  ownerName: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const [shimmer, setShimmer] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [entering, setEntering] = useState(true);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 50);
    return () => clearTimeout(t);
  }, []);

  // Trigger shimmer on card change
  useEffect(() => {
    setShimmer(true);
    const t = setTimeout(() => setShimmer(false), 800);
    return () => clearTimeout(t);
  }, [current]);

  const prev = () => setCurrent(c => (c - 1 + cards.length) % cards.length);
  const next = () => setCurrent(c => (c + 1) % cards.length);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Mouse tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const card = cards[current];
  const tiltX = (mousePos.y - 0.5) * 18;
  const tiltY = (mousePos.x - 0.5) * -18;
  const shimmerX = mousePos.x * 100;
  const shimmerY = mousePos.y * 100;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{
        background: "rgba(10,12,18,0.96)",
        backdropFilter: "blur(20px)",
        opacity: entering ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
      onClick={onClose}
    >
      {/* Ambient aurora background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, rgba(100,180,220,0.6) 0%, transparent 70%)",
            top: "10%", left: "20%",
            animation: "auroraFloat 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-8"
          style={{
            background: "radial-gradient(circle, rgba(180,140,80,0.5) 0%, transparent 70%)",
            bottom: "20%", right: "15%",
            animation: "auroraFloat 10s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Close button */}
      <button
        className="absolute top-5 right-5 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all z-10"
        onClick={onClose}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Card counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-white/40 tracking-[0.35em] uppercase font-light z-10">
        {current + 1} / {cards.length}
      </div>

      {/* Prev / Next */}
      {cards.length > 1 && (
        <>
          <button
            className="absolute left-4 md:left-8 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all z-10"
            onClick={e => { e.stopPropagation(); prev(); }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-4 md:right-8 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all z-10"
            onClick={e => { e.stopPropagation(); next(); }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Card display */}
      <div
        className="relative flex flex-col items-center gap-6 px-16"
        onClick={e => e.stopPropagation()}
      >
        {/* 3D tilt card */}
        <div
          ref={imgRef}
          className="relative cursor-pointer"
          style={{
            perspective: "1000px",
            width: "min(280px, 72vw)",
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setMousePos({ x: 0.5, y: 0.5 })}
        >
          <div
            style={{
              transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
              transition: "transform 0.1s ease-out",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Card image */}
            <img
              src={card.imageUrl}
              alt={card.name ?? ""}
              className="w-full rounded-xl"
              style={{
                boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(100,180,220,0.15)",
              }}
            />

            {/* Aurora foil overlay — moves with mouse */}
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background: `radial-gradient(circle at ${shimmerX}% ${shimmerY}%, rgba(168,216,234,0.35) 0%, rgba(100,160,200,0.15) 30%, transparent 60%)`,
                mixBlendMode: "screen",
                opacity: shimmer ? 1 : 0.6,
                transition: "opacity 0.4s ease",
              }}
            />

            {/* Rainbow holographic shimmer */}
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background: `linear-gradient(${105 + tiltY * 2}deg, 
                  transparent 30%,
                  rgba(168,216,234,0.08) 40%,
                  rgba(200,168,234,0.06) 50%,
                  rgba(234,200,168,0.08) 60%,
                  transparent 70%
                )`,
                mixBlendMode: "overlay",
              }}
            />

            {/* Edge glow */}
            {shimmer && (
              <div
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  boxShadow: "inset 0 0 30px rgba(168,216,234,0.3)",
                  animation: "shimmerPulse 0.8s ease-out forwards",
                }}
              />
            )}
          </div>
        </div>

        {/* Card info */}
        <div className="text-center">
          {card.name && (
            <p className="text-white/90 font-light tracking-[0.15em] text-sm mb-1">
              {card.name}
            </p>
          )}
          {card.grader && card.grade && (
            <span className="inline-block text-[10px] px-3 py-1 border border-[#C9A84C]/40 text-[#C9A84C] rounded-full font-light tracking-widest">
              {card.grader} {card.grade}
            </span>
          )}
          <p className="mt-3 text-[10px] text-white/30 tracking-[0.3em] uppercase font-light">
            {ownerName} 的收藏
          </p>
        </div>

        {/* Dot indicators */}
        {cards.length > 1 && (
          <div className="flex gap-2">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-4 h-1.5 bg-[#C9A84C]"
                    : "w-1.5 h-1.5 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stacked Card Relics (clickable) ───────────────────────────────────────────
function StackedCardRelics({
  cards,
  onCardClick,
}: {
  cards: Array<{ imageUrl?: string | null; name?: string | null; grade?: string | null; grader?: string | null }>;
  onCardClick: (index: number) => void;
}) {
  const displayCards = cards.slice(0, 3).filter(c => c.imageUrl);

  if (displayCards.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center">
        <Crown className="w-14 h-14 text-[#C9A84C]/20" />
      </div>
    );
  }

  const CardImg = ({ card, className, style, idx }: {
    card: typeof displayCards[0]; className: string; style?: React.CSSProperties; idx: number;
  }) => (
    <div
      className={`relative group/card cursor-zoom-in ${className}`}
      style={style}
      onClick={e => { e.stopPropagation(); onCardClick(idx); }}
    >
      {/* Ice-blue foil overlay */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#A8D8EA]/25 via-[#E8F4FF]/10 to-[#B8C8E8]/20 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
      {/* Zoom hint */}
      <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-20 pointer-events-none">
        <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <ZoomIn className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <img
        src={card.imageUrl!}
        alt={card.name ?? ""}
        className="w-full rounded-lg transition-transform duration-500 group-hover/card:scale-105"
      />
    </div>
  );

  if (displayCards.length === 1) {
    return (
      <div className="h-52 flex items-center justify-center px-6">
        <CardImg card={displayCards[0]} className="w-28 shadow-[0_8px_24px_rgba(0,0,0,0.18)]" idx={0} />
      </div>
    );
  }

  if (displayCards.length === 2) {
    return (
      <div className="h-52 flex items-center justify-center">
        <div className="relative w-44 h-40">
          <CardImg
            card={displayCards[1]}
            className="absolute left-0 top-2 w-28"
            style={{ transform: "rotate(-6deg)", transformOrigin: "bottom right", boxShadow: "0 6px 18px rgba(0,0,0,0.15)" }}
            idx={1}
          />
          <CardImg
            card={displayCards[0]}
            className="absolute right-0 top-0 w-28 z-10"
            style={{ transform: "rotate(4deg)", transformOrigin: "bottom left", boxShadow: "0 10px 28px rgba(0,0,0,0.22)" }}
            idx={0}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-52 flex items-center justify-center">
      <div className="relative w-52 h-44">
        <CardImg
          card={displayCards[2]}
          className="absolute left-0 top-4 w-24"
          style={{ transform: "rotate(-10deg)", transformOrigin: "bottom", boxShadow: "0 5px 15px rgba(0,0,0,0.13)" }}
          idx={2}
        />
        <CardImg
          card={displayCards[0]}
          className="absolute left-1/2 -translate-x-1/2 top-0 w-28 z-20"
          style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}
          idx={0}
        />
        <CardImg
          card={displayCards[1]}
          className="absolute right-0 top-4 w-24 z-10"
          style={{ transform: "rotate(10deg)", transformOrigin: "bottom", boxShadow: "0 5px 15px rgba(0,0,0,0.13)" }}
          idx={1}
        />
      </div>
    </div>
  );
}

// ── Comment Section ────────────────────────────────────────────────────────────
function CommentSection({ entryId, entryName }: { entryId: number; entryName: string }) {
  const { data: user } = trpc.auth.me.useQuery();
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();
  const { data: comments = [], isLoading } = trpc.wall.getComments.useQuery({ entryId, limit: 50 });

  const addMutation = trpc.wall.addComment.useMutation({
    onSuccess: () => { setComment(""); utils.wall.getComments.invalidate({ entryId }); toast.success("留言成功！"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.wall.deleteComment.useMutation({
    onSuccess: () => utils.wall.getComments.invalidate({ entryId }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div style={{ animation: "glacierSlide 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
      <div className="mt-4 pt-4 border-t border-[#E8E8E6]">
        <p className="text-[10px] text-[#9A9A8A] mb-3 font-light tracking-[0.25em] uppercase">
          圍觀留言 · {comments.length} 則
        </p>
        {user ? (
          <div className="mb-4">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`留言給 ${entryName}…`}
              className="bg-[#F8F8F6] border-[#E8E8E6] text-xs text-[#1A1A1A] placeholder:text-[#BCBCB0] resize-none min-h-[64px] rounded-lg font-light"
              maxLength={500}
            />
            <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
              {QUICK_COMMENTS.map((q) => (
                <button key={q} onClick={() => setComment(q)}
                  className="text-[10px] px-2.5 py-1 bg-[#F3F3F0] hover:bg-[#EAEAE6] text-[#7A7A6A] rounded-full transition-colors font-light tracking-wide border border-[#E8E8E4]">
                  {q}
                </button>
              ))}
            </div>
            <Button size="sm"
              onClick={() => { if (!comment.trim()) return; addMutation.mutate({ entryId, content: comment.trim() }); }}
              disabled={!comment.trim() || addMutation.isPending}
              className="bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-xs h-8 px-4 rounded-lg font-light tracking-widest">
              {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "SEND"}
            </Button>
          </div>
        ) : (
          <a href="/login" className="block text-[10px] text-[#9A9A8A] hover:text-[#1A1A1A] mb-3 tracking-widest uppercase transition-colors">
            登入後留言
          </a>
        )}
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[#BCBCB0]" /></div>
        ) : comments.length === 0 ? (
          <p className="text-[10px] text-[#BCBCB0] text-center py-3 tracking-widest">— 尚無留言 —</p>
        ) : (
          <div className="space-y-2.5">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-[#4A4A3A] mr-2 tracking-wide">{c.displayName}</span>
                  <span className="text-xs text-[#5A5A4A] font-light">{c.content}</span>
                  <span className="text-[10px] text-[#BCBCB0] ml-2 font-light">{new Date(c.createdAt).toLocaleDateString("zh-HK")}</span>
                </div>
                {user && (user.id === c.userId || user.role === "admin") && (
                  <button onClick={() => deleteMutation.mutate({ commentId: c.id })}
                    className="opacity-0 group-hover:opacity-100 text-[#BCBCB0] hover:text-red-400 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wall Entry Card (Marble Shrine) ───────────────────────────────────────────
function WallCard({ entry, rank }: { entry: any; rank: number }) {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const [showComments, setShowComments] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { playSighSound } = useSacredAudio();
  const { spawnBurst } = useIceParticles();

  const sighMutation = trpc.wall.sigh.useMutation({
    onSuccess: (data) => {
      utils.wall.getWall.invalidate();
      setGlowing(true);
      setTimeout(() => setGlowing(false), 1400);
      toast.success(`已嘆息 · ${data.sighs.toLocaleString()} 次`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSigh = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!user) { setLocation("/login"); return; }
    // Trigger particles + audio
    spawnBurst(e.clientX, e.clientY);
    playSighSound();
    sighMutation.mutate({ entryId: entry.id });
  };

  const handleShare = () => {
    const url = `https://boxium.asia/wall-of-sighs`;
    if (navigator.share) {
      navigator.share({ title: `${entry.displayName} 的嘆息之牆`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("連結已複製！");
    }
  };

  // Build top-3 cards
  const topCards: GalleryCard[] = [];
  if (entry.topCardImageUrl) topCards.push({ imageUrl: entry.topCardImageUrl, name: entry.topCardName, grade: entry.topCardGrade, grader: entry.topCardGrader });
  if (entry.card2ImageUrl) topCards.push({ imageUrl: entry.card2ImageUrl, name: entry.card2Name, grade: entry.card2Grade, grader: entry.card2Grader });
  if (entry.card3ImageUrl) topCards.push({ imageUrl: entry.card3ImageUrl, name: entry.card3Name, grade: entry.card3Grade, grader: entry.card3Grader });

  const rankLabel = rank <= 3 ? ["Ⅰ", "Ⅱ", "Ⅲ"][rank - 1] : `${rank}`;
  const rankGold = rank === 1 ? "text-[#C9A84C] border-[#C9A84C]/40"
    : rank === 2 ? "text-[#9A9A9A] border-[#9A9A9A]/40"
    : rank === 3 ? "text-[#A07040] border-[#A07040]/40"
    : "text-[#BCBCB0] border-[#BCBCB0]/30";

  return (
    <>
      <div
        className={`relative bg-white rounded-2xl overflow-hidden transition-all duration-500 group
          border border-[#E8E8E4]
          shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]
          hover:shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]
          hover:-translate-y-0.5
          ${glowing ? "shadow-[0_0_0_3px_rgba(168,216,234,0.4),0_8px_40px_rgba(168,216,234,0.25)]" : ""}
        `}
        style={{
          transition: glowing
            ? "box-shadow 0.1s ease-out, transform 0.3s ease"
            : "box-shadow 0.8s ease-out, transform 0.3s ease",
        }}
      >
        {/* Rank badge */}
        <div className={`absolute top-3 left-3 z-20 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-light tracking-wider bg-white/90 backdrop-blur-sm ${rankGold}`}>
          {rankLabel}
        </div>

        {/* Stone display base */}
        <div className="relative bg-gradient-to-b from-[#F5F5F3] to-[#EEEEEB] pt-4 pb-2 px-4">
          <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, #6A6A5A 0px, #6A6A5A 1px, transparent 1px, transparent 28px)" }} />
          <StackedCardRelics cards={topCards} onCardClick={(idx) => setGalleryIndex(idx)} />
          {/* Gallery hint */}
          {topCards.length > 0 && (
            <p className="text-center text-[9px] text-[#BCBCB0] tracking-[0.2em] uppercase font-light pb-1">
              點擊卡牌放大欣賞
            </p>
          )}
        </div>

        {/* Marble body */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="font-light text-[#1A1A1A] text-sm tracking-[0.08em] truncate">{entry.displayName}</p>
              {entry.topCardGrader && entry.topCardGrade && (
                <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 bg-[#FFF8E7] text-[#C9A84C] border border-[#C9A84C]/25 rounded-full font-light tracking-wide">
                  {entry.topCardGrader} {entry.topCardGrade}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[#C9A84C] shrink-0 mt-0.5">
              <Wind className="w-3 h-3" />
              <span className="text-xs font-light tracking-wider">{entry.sighs.toLocaleString()}</span>
            </div>
          </div>

          {/* Value — runic inscription */}
          <div className="my-3 py-2.5 border-t border-b border-[#EEEEE8]">
            <p className="text-[9px] text-[#BCBCB0] tracking-[0.3em] uppercase mb-0.5 font-light">Total Value</p>
            <p className="text-lg font-light text-[#1A1A1A] tracking-[0.05em]">{formatHKD(entry.totalValueHKD)}</p>
            <div className="mt-1 h-px w-16 bg-gradient-to-r from-[#C9A84C]/60 to-transparent" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSigh}
              disabled={sighMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#E8E8E4] hover:border-[#C9A84C]/40 hover:bg-[#FFF8E7]/50 text-[#4A4A3A] text-[11px] font-light tracking-[0.12em] rounded-full transition-all duration-300 uppercase active:scale-95"
            >
              {sighMutation.isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Wind className="w-3 h-3 text-[#C9A84C]" />
              }
              Sigh
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#E8E8E4] hover:border-[#8A9AAA]/40 hover:bg-[#F5F8FA]/50 text-[#4A4A3A] text-[11px] font-light tracking-[0.12em] rounded-full transition-all duration-300 uppercase"
            >
              <MessageCircle className="w-3 h-3 text-[#8A9AAA]" />
              {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={handleShare}
              className="p-2 border border-[#E8E8E4] hover:border-[#BCBCB0] text-[#BCBCB0] hover:text-[#4A4A3A] rounded-full transition-all duration-300"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {showComments && <CommentSection entryId={entry.id} entryName={entry.displayName} />}
        </div>
      </div>

      {/* Fullscreen gallery */}
      {galleryIndex !== null && topCards.length > 0 && (
        <CardGallery
          cards={topCards}
          initialIndex={galleryIndex}
          ownerName={entry.displayName}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </>
  );
}

// ── Publish Modal ──────────────────────────────────────────────────────────────
function PublishModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: myEntry } = trpc.wall.getMyEntry.useQuery(undefined, { enabled: open });

  const publishMutation = trpc.wall.publish.useMutation({
    onSuccess: () => {
      utils.wall.getWall.invalidate();
      utils.wall.getStats.invalidate();
      utils.wall.getMyEntry.invalidate();
      toast.success("恭喜！您已登上嘆息之牆！");
      onClose();
    },
  });
  const unpublishMutation = trpc.wall.unpublish.useMutation({
    onSuccess: () => {
      utils.wall.getWall.invalidate();
      utils.wall.getMyEntry.invalidate();
      toast.success("已從嘆息之牆撤除");
      onClose();
    },
  });
  const posterMutation = trpc.wall.generatePoster.useMutation({
    onSuccess: (data) => { window.open(data.posterUrl, "_blank"); toast.success("榮譽證書已生成！"); },
    onError: (e) => toast.error(e.message),
  });

  const publishError = publishMutation.error;
  const isShortfall = publishError?.data?.code === "FORBIDDEN";
  const shortfallMsg = publishError?.message ?? "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white rounded-2xl border border-[#E8E8E4] p-0 overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.12)]">
        <DialogTitle className="sr-only">發佈到嘆息之牆</DialogTitle>
        <div className="relative bg-[#1A1A1A] px-6 py-8 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, #FFFFFF 0px, #FFFFFF 1px, transparent 1px, transparent 32px)" }} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/40 to-transparent" />
          <p className="text-[10px] text-[#C9A84C] tracking-[0.4em] uppercase mb-3 font-light">Nordic Sanctuary</p>
          <h2 className="text-2xl text-white tracking-[0.25em] uppercase font-light mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            嘆息之牆
          </h2>
          <p className="text-[10px] text-white/30 tracking-[0.35em] uppercase font-light">The Wall of Sighs</p>
        </div>
        <div className="p-6">
          {myEntry?.isPublic ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFF8E7] border border-[#C9A84C]/25 rounded-full mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                <span className="text-xs font-light text-[#C9A84C] tracking-widest uppercase">已在牆上</span>
              </div>
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.25em] uppercase mb-1 font-light">Total Value</p>
              <p className="text-2xl font-light text-[#1A1A1A] tracking-wide mb-0.5">{formatHKD(myEntry.totalValueHKD)}</p>
              <div className="mx-auto mb-1 h-px w-12 bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
              <p className="text-xs text-[#C9A84C] mb-6 font-light tracking-widest">{myEntry.sighs.toLocaleString()} sighs</p>
              <div className="flex gap-3 mb-3">
                <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}
                  className="flex-1 bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-xs h-10 rounded-xl font-light tracking-widest uppercase">
                  {publishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "更新資產"}
                </Button>
                <Button onClick={() => posterMutation.mutate()} disabled={posterMutation.isPending}
                  variant="outline"
                  className="flex-1 border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#FFF8E7] text-xs h-10 rounded-xl font-light tracking-widest uppercase">
                  {posterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "榮譽證書"}
                </Button>
              </div>
              <button onClick={() => unpublishMutation.mutate()} disabled={unpublishMutation.isPending}
                className="w-full text-[10px] text-[#BCBCB0] hover:text-red-400 transition-colors tracking-widest uppercase font-light">
                從牆上撤除
              </button>
            </div>
          ) : publishError && isShortfall ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#FFF0F0] border border-red-100 flex items-center justify-center mx-auto mb-4">
                <Wind className="w-5 h-5 text-red-300" />
              </div>
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.25em] uppercase mb-2 font-light">距離神殿</p>
              <p className="text-sm font-light text-[#1A1A1A] mb-4 leading-relaxed">{shortfallMsg}</p>
              <p className="text-[10px] text-[#BCBCB0] mb-5 font-light leading-relaxed">繼續充實您的 Vault，讓資產突破門檻，登上神殿石壁</p>
              <Button onClick={onClose} className="w-full bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-xs h-10 rounded-xl font-light tracking-widest uppercase">
                繼續充實 Vault
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.3em] uppercase mb-2 font-light">入牆門檻</p>
              <p className="text-3xl font-light text-[#1A1A1A] tracking-wide mb-0.5">HKD 5,000</p>
              <div className="mx-auto mb-4 h-px w-10 bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
              <p className="text-xs text-[#9A9A8A] mb-6 font-light leading-relaxed tracking-wide">
                系統將自動計算您的 Vault 總市值。<br />達標後即可登上嘆息之牆，<br />讓全網玩家為您嘆息。
              </p>
              <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}
                className="w-full bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] text-sm h-11 rounded-xl font-light tracking-[0.2em] uppercase">
                {publishMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />計算中…</> : "登上神殿石壁"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Stone Wall Background ──────────────────────────────────────────────────────
function StoneWallBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 opacity-[0.028]"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, #4A4A3A 0px, #4A4A3A 1px, transparent 1px, transparent 80px)" }} />
      <div className="absolute inset-0 opacity-[0.018]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, #4A4A3A 0px, #4A4A3A 1px, transparent 1px, transparent 120px)" }} />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F0F0EE]/60 to-transparent" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WallOfSighs() {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<"totalValue" | "sighs" | "createdAt">("totalValue");
  const [showPublishModal, setShowPublishModal] = useState(false);

  const { data: statsData } = trpc.wall.getStats.useQuery();
  const { data: wallData, isLoading } = trpc.wall.getWall.useQuery({ limit: 50, offset: 0, sortBy });
  const entries = wallData?.entries ?? [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400&display=swap');
        @keyframes glacierSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes runeGlow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes auroraFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.97); }
        }
        @keyframes shimmerPulse {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="min-h-screen bg-[#F5F5F3]" style={{ fontFamily: "'Montserrat', sans-serif" }}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-[#F3F4F6] border-b border-[#E8E8E4]">
          <StoneWallBg />
          <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#C9A84C]/50" />
              <div className="w-1 h-1 rounded-full bg-[#C9A84C]/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
              <div className="w-1 h-1 rounded-full bg-[#C9A84C]/60" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#C9A84C]/50" />
            </div>
            <p className="text-[10px] text-[#C9A84C] tracking-[0.5em] uppercase mb-3 font-light"
              style={{ animation: "runeGlow 3s ease-in-out infinite" }}>
              Nordic Sanctuary · BOXIUM PTCG
            </p>
            <h1 className="text-5xl md:text-7xl text-[#1A1A1A] tracking-[0.25em] uppercase mb-3 font-light leading-none">
              嘆息之牆
            </h1>
            <p className="text-[11px] md:text-xs text-[#9A9A8A] tracking-[0.45em] uppercase mb-2 font-light">
              THE WALL OF SIGHS
            </p>
            <div className="flex items-center justify-center gap-4 my-7">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#C9A84C]/70" />
              <div className="flex gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[#C9A84C]/50" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                <div className="w-1 h-1 rounded-full bg-[#C9A84C]/50" />
              </div>
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#C9A84C]/70" />
            </div>
            <p className="text-[#7A7A6A] text-sm font-light tracking-[0.08em] max-w-md mx-auto mb-12 leading-loose">
              凡人止步。此牆只記載令全網 TCG 玩家<br className="hidden md:block" />
              為之嘆息的絕世巨富與神級收藏。
            </p>

            {/* Stats altar */}
            <div className="inline-flex flex-col sm:flex-row gap-0 bg-white border border-[#E8E8E4] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.05)] mb-10">
              {[
                { label: "Wall Total Value", value: <><span className="text-base">HKD </span><AnimatedCounter value={Math.round(statsData?.totalValueHKD ?? 0)} /></>, color: "text-[#1A1A1A]" },
                { label: "Total Sighs", value: <AnimatedCounter value={statsData?.totalSighs ?? 0} />, color: "text-[#C9A84C]" },
                { label: "On The Wall", value: <AnimatedCounter value={statsData?.entryCount ?? 0} />, color: "text-[#1A1A1A]" },
              ].map((stat, i) => (
                <div key={i} className="flex items-stretch">
                  {i > 0 && <div className="w-px bg-[#E8E8E4] hidden sm:block" />}
                  {i > 0 && <div className="h-px bg-[#E8E8E4] sm:hidden" />}
                  <div className="px-8 py-5 text-center">
                    <p className="text-[9px] text-[#BCBCB0] tracking-[0.35em] uppercase mb-1.5 font-light">{stat.label}</p>
                    <p className={`text-xl md:text-2xl font-light tracking-wide ${stat.color}`}>{stat.value}</p>
                    <div className="mt-1.5 h-px w-10 mx-auto bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => { if (!user) { setLocation("/login"); return; } setShowPublishModal(true); }}
              className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#1A1A1A] text-white text-[11px] font-light tracking-[0.3em] uppercase rounded-full hover:bg-[#2A2A2A] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.2)]"
            >
              <Wind className="w-3.5 h-3.5 text-[#C9A84C]" />
              登上神殿石壁
            </button>
          </div>
        </div>

        {/* ── Leaderboard ──────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[9px] text-[#BCBCB0] tracking-[0.35em] uppercase mb-0.5 font-light">Sanctuary</p>
              <h2 className="text-sm font-light text-[#1A1A1A] tracking-[0.2em] uppercase">殿堂排行 · {entries.length}</h2>
            </div>
            <div className="flex gap-0.5 bg-white border border-[#E8E8E4] rounded-xl p-1 shadow-sm">
              {(["totalValue", "sighs", "createdAt"] as const).map((s) => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 text-[10px] font-light tracking-widest rounded-lg transition-all uppercase ${
                    sortBy === s ? "bg-[#1A1A1A] text-white shadow-sm" : "text-[#9A9A8A] hover:text-[#1A1A1A]"
                  }`}>
                  {s === "totalValue" ? "資產" : s === "sighs" ? "嘆息" : "最新"}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]/50" />
              <p className="text-[10px] text-[#BCBCB0] tracking-[0.3em] uppercase font-light">Loading…</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-28">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#C9A84C]/30" />
                <Crown className="w-8 h-8 text-[#C9A84C]/20" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#C9A84C]/30" />
              </div>
              <p className="text-[#9A9A8A] font-light tracking-[0.2em] uppercase text-sm mb-2">牆上尚無大佬</p>
              <p className="text-[10px] text-[#BCBCB0] font-light tracking-widest">成為第一個登上神殿石壁的人</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {entries.map((entry) => (
                <WallCard key={entry.id} entry={entry} rank={entry.rank} />
              ))}
            </div>
          )}
        </div>

        <PublishModal open={showPublishModal} onClose={() => setShowPublishModal(false)} />
      </div>
    </>
  );
}
