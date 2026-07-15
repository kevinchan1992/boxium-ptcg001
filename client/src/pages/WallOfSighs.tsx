/**
 * WallOfSighs.tsx — 嘆息之牆 · Nordic Sanctuary Style (v4)
 *
 * Fixes:
 * - Broken images: proper onError fallback placeholder (no browser broken icon)
 * - Text overflow: line-clamp, truncate, overflow-hidden on all containers
 * - Button layout: flex row on desktop, stacked on mobile — no absolute positioning
 * - 3D shrine: inset shadow on stone base, cards with drop shadow float above
 * - Stacked cards: up to 3 cards with rotation + z-index + proper sizing
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

// SVG placeholder for broken/missing card images
const CARD_PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='280' viewBox='0 0 200 280'%3E%3Crect width='200' height='280' fill='%23F0EFE8' rx='8'/%3E%3Crect x='1' y='1' width='198' height='278' fill='none' stroke='%23D8D4C8' stroke-width='1' rx='7'/%3E%3Ccircle cx='100' cy='120' r='28' fill='%23E8E4D8'/%3E%3Cpath d='M88 120 L100 108 L112 120 L108 132 L92 132 Z' fill='%23C9A84C' opacity='0.5'/%3E%3Ctext x='100' y='175' text-anchor='middle' font-family='sans-serif' font-size='11' fill='%23A09880'%3ENo Image%3C/text%3E%3C/svg%3E`;

// Proxy CDN URLs that have hotlink protection (e.g. cdn.snkrdunk.com)
function proxyImageUrl(url?: string | null): string {
  if (!url) return CARD_PLACEHOLDER_SVG;
  // Route snkrdunk CDN images through the backend proxy to bypass hotlink protection
  const needsProxy = url.includes('snkrdunk.com') || url.includes('cdn.snkrdunk');
  if (needsProxy) {
    return `/api/img-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function formatHKD(val: number) {
  return `HKD ${val.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Safe Image component (never shows broken icon) ────────────────────────────
function SafeCardImg({
  src,
  alt,
  className,
  style,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [imgSrc, setImgSrc] = useState(() => proxyImageUrl(src));

  useEffect(() => {
    setImgSrc(proxyImageUrl(src));
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt ?? ""}
      className={className}
      style={style}
      onError={() => setImgSrc(CARD_PLACEHOLDER_SVG)}
      loading="lazy"
    />
  );
}

// ── Sacred Audio Engine (Web Audio API — no external files) ───────────────────
function useSacredAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playSighSound = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.18, now);
      master.connect(ctx.destination);

      // Crystal bell sweep
      const bell = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bell.type = "sine";
      bell.frequency.setValueAtTime(880, now);
      bell.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      bell.frequency.exponentialRampToValueAtTime(1320, now + 0.4);
      bellGain.gain.setValueAtTime(0, now);
      bellGain.gain.linearRampToValueAtTime(0.7, now + 0.02);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      bell.connect(bellGain); bellGain.connect(master);
      bell.start(now); bell.stop(now + 0.95);

      // Nordic hum
      const hum = ctx.createOscillator();
      const humGain = ctx.createGain();
      hum.type = "triangle";
      hum.frequency.setValueAtTime(220, now);
      hum.frequency.linearRampToValueAtTime(196, now + 1.2);
      humGain.gain.setValueAtTime(0, now);
      humGain.gain.linearRampToValueAtTime(0.3, now + 0.15);
      humGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      hum.connect(humGain); humGain.connect(master);
      hum.start(now); hum.stop(now + 1.85);

      // Sub-bass breath
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(55, now);
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.15, now + 0.3);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      sub.connect(subGain); subGain.connect(master);
      sub.start(now); sub.stop(now + 1.55);
    } catch (_) {}
  }, [getCtx]);

  return { playSighSound };
}

// ── Ice Crystal Particle System ───────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color: string; rotation: number; rotSpeed: number;
  shape: "crystal" | "shard" | "dot";
}

function useIceParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    canvasRef.current = canvas;
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); canvas.remove(); cancelAnimationFrame(animRef.current); };
  }, []);

  const spawnBurst = useCallback((cx: number, cy: number) => {
    const colors = ["rgba(200,230,255,0.95)","rgba(168,216,234,0.9)","rgba(220,240,255,0.85)","rgba(255,255,255,0.95)","rgba(201,168,76,0.8)"];
    const newP: Particle[] = [];
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 2.5 + Math.random() * 5;
      const shape: Particle["shape"] = i % 3 === 0 ? "crystal" : i % 3 === 1 ? "shard" : "dot";
      newP.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
        life: 1, maxLife: 0.7 + Math.random() * 0.8, size: shape === "crystal" ? 6 + Math.random() * 8 : 3 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)], rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15, shape });
    }
    particlesRef.current.push(...newP);

    const draw = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.globalAlpha = p.life / p.maxLife;
      if (p.shape === "crystal") {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.15;
        for (let i = 0; i < 6; i++) {
          ctx.save(); ctx.rotate((i * Math.PI) / 3);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -p.size);
          ctx.moveTo(0, -p.size * 0.5); ctx.lineTo(p.size * 0.25, -p.size * 0.7);
          ctx.moveTo(0, -p.size * 0.5); ctx.lineTo(-p.size * 0.25, -p.size * 0.7);
          ctx.stroke(); ctx.restore();
        }
      } else if (p.shape === "shard") {
        ctx.fillStyle = p.color; ctx.beginPath();
        ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.4, 0); ctx.lineTo(0, p.size * 0.6); ctx.lineTo(-p.size * 0.4, 0);
        ctx.closePath(); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        g.addColorStop(0, p.color); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };

    const animate = () => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => p.life > 0.01);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.97;
        p.life -= 0.022; p.rotation += p.rotSpeed;
        draw(ctx, p);
      }
      if (particlesRef.current.length > 0) animRef.current = requestAnimationFrame(animate);
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
  imageUrl?: string | null;
  name?: string | null;
  grade?: string | null;
  grader?: string | null;
}

function CardGallery({ cards, initialIndex, ownerName, onClose }: {
  cards: GalleryCard[]; initialIndex: number; ownerName: string; onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const [shimmer, setShimmer] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [visible, setVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to top and lock body scroll when gallery opens
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    setTimeout(() => setVisible(true), 30);
    return () => {
      // Restore scroll on close
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);
  useEffect(() => { setShimmer(true); const t = setTimeout(() => setShimmer(false), 800); return () => clearTimeout(t); }, [current]);

  const prev = () => setCurrent(c => (c - 1 + cards.length) % cards.length);
  const next = () => setCurrent(c => (c + 1) % cards.length);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return;
    setMousePos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const tiltX = (mousePos.y - 0.5) * 16;
  const tiltY = (mousePos.x - 0.5) * -16;
  const card = cards[current];

  // Card visual block — desktop uses maxH prop
  const CardVisual = ({ maxH = "75vh" }: { maxH?: string }) => (
    <div
      ref={imgRef}
      className="relative cursor-pointer flex items-center justify-center"
      style={{ perspective: "1000px", maxHeight: maxH, height: "100%", width: "100%" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePos({ x: 0.5, y: 0.5 })}
    >
      <div
        className="relative"
        style={{ transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`, transition: "transform 0.12s ease-out", transformStyle: "preserve-3d", maxHeight: maxH }}
      >
        <SafeCardImg
          src={card.imageUrl}
          alt={card.name ?? ""}
          className="rounded-2xl object-contain block"
          style={{
            maxHeight: maxH,
            maxWidth: "100%",
            height: "auto",
            width: "auto",
            boxShadow: "0 32px 80px rgba(0,0,0,0.85), 0 0 80px rgba(14,165,233,0.18), 0 0 30px rgba(201,168,76,0.1)"
          }}
        />
        {/* Aurora foil */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(168,216,234,0.4) 0%, rgba(100,160,200,0.18) 35%, transparent 65%)`, mixBlendMode: "screen", opacity: shimmer ? 1 : 0.65, transition: "opacity 0.4s ease" }} />
        {/* Holographic shimmer */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: `linear-gradient(${105 + tiltY * 2}deg, transparent 25%, rgba(168,216,234,0.1) 38%, rgba(200,168,234,0.07) 50%, rgba(234,200,168,0.1) 62%, transparent 75%)`, mixBlendMode: "overlay" }} />
        {/* Gold rune border */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ border: "1px solid rgba(201,168,76,0.35)", boxShadow: "inset 0 0 20px rgba(201,168,76,0.06)" }} />
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[1000] overflow-hidden"
      style={{ background: "rgba(6,8,14,0.98)", backdropFilter: "blur(28px)", opacity: visible ? 1 : 0, transition: "opacity 0.35s ease" }}
      onClick={onClose}
    >
      {/* Aurora ambient bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full"
          style={{ width: "60vw", height: "60vw", background: "radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)", top: "5%", left: "-10%", animation: "auroraFloat 9s ease-in-out infinite", filter: "blur(40px)" }} />
        <div className="absolute rounded-full"
          style={{ width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(15,118,110,0.1) 0%, transparent 70%)", bottom: "0%", right: "-5%", animation: "auroraFloat 11s ease-in-out infinite reverse", filter: "blur(50px)" }} />
        <div className="absolute rounded-full"
          style={{ width: "30vw", height: "30vw", background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)", top: "40%", right: "20%", animation: "auroraFloat 7s ease-in-out infinite", filter: "blur(35px)" }} />
      </div>

      {/* ── DESKTOP LAYOUT: outer wrapper from navbar bottom, centers content ── */}
      <div
        className="hidden md:flex fixed inset-x-0 bottom-0 items-center justify-center overflow-hidden"
        style={{ top: "56px", height: "calc(100vh - 56px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Inner row: card + info, centered in the available area */}
        <div className="flex flex-row items-center justify-center w-full max-w-6xl px-16 gap-12">
          {/* Left: card */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: "42%" }}>
            <CardVisual maxH="75vh" />
          </div>

          {/* Right: info panel */}
          <div className="flex flex-col justify-center gap-5" style={{ width: "38%", maxHeight: "75vh" }}>
            {/* Owner */}
            <p className="text-[10px] text-white/30 tracking-[0.35em] uppercase font-light">{ownerName} 的收藏</p>
            {/* Card name */}
            {card.name && (
              <h2 className="text-white/95 font-light tracking-[0.08em] text-xl leading-snug line-clamp-3">{card.name}</h2>
            )}
            {/* Grade badge */}
            {card.grader && card.grade && (
              <span className="self-start text-[10px] px-3 py-1.5 border border-[#C9A84C]/50 text-[#C9A84C] rounded-full font-light tracking-widest">
                {card.grader} {card.grade}
              </span>
            )}
            {/* Dot indicators */}
            {cards.length > 1 && (
              <div className="flex gap-2 mt-2">
                {cards.map((_, i) => (
                  <button key={i} onClick={() => setCurrent(i)}
                    className={`rounded-full transition-all duration-300 ${i === current ? "w-5 h-1.5 bg-[#C9A84C]" : "w-1.5 h-1.5 bg-white/25 hover:bg-white/50"}`} />
                ))}
              </div>
            )}
            {/* Divider */}
            <div className="h-px bg-white/8" />
            {/* Keyboard hint */}
            <p className="text-[9px] text-white/20 tracking-[0.2em] uppercase">← → 切換卡牌 · ESC 關閉</p>
          </div>
        </div>
      </div>

      {/* ── MOBILE LAYOUT: top card | bottom info — fully one-page ── */}
      <div
        className="flex md:hidden absolute inset-0 flex-col"
        style={{ paddingTop: "52px", paddingBottom: "8px" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Card area — fills ~58% of remaining height */}
        <div
          className="flex-1 flex items-center justify-center px-8"
          style={{ minHeight: 0, maxHeight: "58vh" }}
        >
          <div style={{ height: "100%", maxHeight: "52vh", aspectRatio: "3/4", width: "auto" }}>
            <CardVisual maxH="52vh" />
          </div>
        </div>

        {/* Info strip — compact, fixed height */}
        <div
          className="flex-shrink-0 flex flex-col items-center gap-2 px-6 pb-2"
          style={{ maxHeight: "36vh" }}
        >
          {card.name && (
            <p className="text-white/90 font-light tracking-[0.08em] text-sm text-center line-clamp-2 leading-snug">{card.name}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-[9px] px-2.5 py-0.5 border border-white/20 text-white/50 rounded-full font-light tracking-widest">
              {ownerName}
            </span>
          </div>
          {cards.length > 1 && (
            <div className="flex gap-2">
              {cards.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all duration-300 ${i === current ? "w-4 h-1.5 bg-[#C9A84C]" : "w-1.5 h-1.5 bg-white/25 hover:bg-white/50"}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Shared: Close button (top-right) ── */}
      <button
        className="absolute top-3 right-4 z-30 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 hover:bg-white/5 transition-all"
        onClick={e => { e.stopPropagation(); onClose(); }}
      >
        <X className="w-4 h-4" />
      </button>

      {/* ── Shared: Counter (top-left) ── */}
      <div className="absolute top-4 left-5 z-30 text-[10px] text-white/35 tracking-[0.35em] uppercase font-light">
        {current + 1} / {cards.length}
      </div>

      {/* ── Shared: Prev / Next nav ── */}
      {cards.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/40 transition-all"
            onClick={e => { e.stopPropagation(); prev(); }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/40 transition-all"
            onClick={e => { e.stopPropagation(); next(); }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}

// ── Stacked Card Relics — Nordic Aurora Stone Wall (v3) ──────────────────────
// Elder Futhark rune paths for SVG overlay
const RUNE_PATHS = [
  // Rune: Tiwaz (arrow up — victory)
  "M 20 80 L 50 20 L 80 80 M 35 55 L 65 55",
  // Rune: Algiz (protection — Y shape)
  "M 50 80 L 50 30 M 50 30 L 25 10 M 50 30 L 75 10",
  // Rune: Sowilo (sun — lightning S)
  "M 65 10 L 35 10 L 65 50 L 35 50 L 65 90",
  // Rune: Othala (heritage — diamond with legs)
  "M 50 15 L 75 45 L 50 75 L 25 45 Z M 25 45 L 15 70 M 75 45 L 85 70",
];

function StackedCardRelics({
  cards,
  onCardClick,
}: {
  cards: GalleryCard[];
  onCardClick: (index: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  // Show up to 5 cards in the altar layout
  const altarCards = cards.filter(c => c != null).slice(0, 5);
  const extraCards = cards.filter(c => c != null).slice(5);

  if (altarCards.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          height: "300px",
          background: "radial-gradient(circle at 50% 30%, rgba(15,118,110,0.12) 0%, rgba(14,165,233,0.08) 40%, #09090B 100%)",
          boxShadow: "inset 0 4px 20px rgba(0,0,0,0.8)",
        }}
      >
        <div className="flex flex-col items-center gap-3 opacity-25">
          <Crown className="w-10 h-10 text-[#C9A84C]" />
          <p className="text-[10px] text-[#9A9A8A] tracking-[0.25em] uppercase font-light">No Cards</p>
        </div>
      </div>
    );
  }

  // 5-card 3D fan layout config
  // Index 0 = main (center), 1 = left-inner, 2 = right-inner, 3 = left-outer, 4 = right-outer
  // Cards are ordered by value: [0]=most valuable (center), [1]=2nd (left), [2]=3rd (right), [3]=4th (far-left), [4]=5th (far-right)
  type AltarCfg = { leftPct: string; rotate: number; translateY: number; scale: number; brightness: number; blur: number; z: number; isMain: boolean; rotateY: number };
  const allCfg: AltarCfg[] = [
    { leftPct: "50%",  rotate: 0,   translateY: -14, scale: 1.22, brightness: 1,    blur: 0,   z: 30, isMain: true,  rotateY: 0   }, // #1 center sovereign
    { leftPct: "32%",  rotate: -10, translateY: 8,   scale: 0.95, brightness: 0.80, blur: 0,   z: 20, isMain: false, rotateY: 12  }, // #2 left-inner
    { leftPct: "68%",  rotate: 10,  translateY: 8,   scale: 0.95, brightness: 0.80, blur: 0,   z: 20, isMain: false, rotateY: -12 }, // #3 right-inner
    { leftPct: "14%",  rotate: -20, translateY: 22,  scale: 0.76, brightness: 0.50, blur: 0.5, z: 10, isMain: false, rotateY: 22  }, // #4 far-left
    { leftPct: "86%",  rotate: 20,  translateY: 22,  scale: 0.76, brightness: 0.50, blur: 0.5, z: 10, isMain: false, rotateY: -22 }, // #5 far-right
  ];
  const cfg = allCfg.slice(0, altarCards.length);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "radial-gradient(circle at 50% 28%, rgba(15,118,110,0.18) 0%, rgba(14,165,233,0.12) 35%, rgba(9,9,11,1) 80%)",
        boxShadow: "inset 0 4px 22px rgba(0,0,0,0.9), inset 0 -2px 8px rgba(0,0,0,0.6)",
      }}
    >
      {/* Main shrine container */}
      <div className="relative w-full" style={{ height: "330px" }}>

        {/* Layer 0: Basalt noise texture */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0, opacity: 0.035 }}>
          <defs>
            <filter id="basalt-noise-altar">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#basalt-noise-altar)" fill="white" />
        </svg>

        {/* Layer 1: Stone joint lines */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 60px)", zIndex: 1 }} />

        {/* Layer 2: Rune overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700" style={{ zIndex: 2, opacity: hovered ? 0.18 : 0.06 }} viewBox="0 0 300 330" preserveAspectRatio="xMidYMid meet">
          <g transform="translate(18, 20) scale(0.45)" stroke="#C9A84C" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M 20 80 L 50 20 L 80 80 M 35 55 L 65 55" /></g>
          <g transform="translate(238, 18) scale(0.45)" stroke="#C9A84C" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M 50 80 L 50 30 M 50 30 L 25 10 M 50 30 L 75 10" /></g>
          <g transform="translate(14, 155) scale(0.38)" stroke="rgba(14,165,233,0.9)" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M 65 10 L 35 10 L 65 50 L 35 50 L 65 90" /></g>
          <g transform="translate(236, 152) scale(0.38)" stroke="rgba(14,165,233,0.9)" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M 50 15 L 75 45 L 50 75 L 25 45 Z M 25 45 L 15 70 M 75 45 L 85 70" /></g>
          <g stroke="rgba(201,168,76,0.5)" strokeWidth="0.8" fill="none">
            <line x1="150" y1="20" x2="150" y2="240" strokeDasharray="3 8" />
            <line x1="30" y1="130" x2="270" y2="130" strokeDasharray="3 8" />
            <circle cx="150" cy="130" r="28" strokeDasharray="4 6" />
            <circle cx="150" cy="130" r="52" strokeDasharray="2 10" opacity="0.5" />
          </g>
        </svg>

        {/* Layer 3: Aurora glow */}
        <div className="absolute rounded-full pointer-events-none transition-all duration-1000" style={{ width:"220px", height:"220px", left:"50%", top:"42%", transform:"translate(-50%,-50%)", background:"radial-gradient(circle, rgba(14,165,233,0.85) 0%, rgba(15,118,110,0.4) 40%, transparent 70%)", opacity: hovered ? 0.25 : 0.12, filter:"blur(55px)", zIndex:3 }} />
        {/* Gold sovereign halo */}
        <div className="absolute rounded-full pointer-events-none transition-all duration-1200" style={{ width:"180px", height:"180px", left:"50%", top:"42%", transform:"translate(-50%,-50%)", background:"radial-gradient(circle, rgba(212,175,55,0.7) 0%, rgba(201,168,76,0.3) 45%, transparent 70%)", opacity: hovered ? 0.55 : 0.30, filter:"blur(35px)", zIndex:3 }} />

        {/* Layer 4: Cards — rendered back-to-front by z-index (outer first, sovereign last) */}
        {[...cfg].reverse().map((c, ri) => {
          const i = cfg.length - 1 - ri; // original index
          const card = altarCards[i];
          const cardW = c.isMain ? "clamp(96px, 40%, 128px)" : c.z === 20 ? "clamp(76px, 32%, 104px)" : "clamp(60px, 26%, 86px)";
          return (
            <div
              key={i}
              className="absolute cursor-zoom-in group/relic"
              style={{
                width: cardW,
                left: c.leftPct,
                top: "50%",
                transform: `translate(-50%, -50%) translateY(${c.translateY}px) perspective(800px) rotateY(${c.rotateY}deg) rotate(${c.rotate}deg) scale(${c.scale})`,
                zIndex: c.z,
                transformOrigin: "center bottom",
                transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), filter 0.3s ease",
                filter: `brightness(${c.brightness}) blur(${c.blur}px)`,
              }}
              onClick={e => { e.stopPropagation(); onCardClick(i); }}
            >
              {/* Stone niche shadow */}
              {!c.isMain && <div style={{ position:"absolute", bottom:"-6px", left:"8%", right:"8%", height:"10px", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(0,0,0,0.7) 0%, transparent 70%)", filter:"blur(4px)", zIndex:-1 }} />}

              {/* Golden border — sovereign only */}
              {c.isMain && (
                <div className="absolute pointer-events-none" style={{ inset:"-3px", borderRadius:"12px", border:"1.5px solid rgba(212,175,55,0.75)", boxShadow: hovered ? "0 0 32px rgba(212,175,55,0.65), 0 0 14px rgba(212,175,55,0.45), inset 0 0 18px rgba(212,175,55,0.12)" : "0 0 16px rgba(212,175,55,0.38), 0 0 6px rgba(212,175,55,0.22)", transition:"box-shadow 0.6s ease", zIndex:30 }} />
              )}

              {/* Aurora foil — sovereign only */}
              {c.isMain && (
                <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ background:"linear-gradient(135deg, rgba(14,165,233,0.30) 0%, rgba(15,118,110,0.16) 40%, rgba(212,175,55,0.20) 70%, transparent 100%)", opacity: hovered ? 1 : 0.55, mixBlendMode:"screen", transition:"opacity 0.5s ease", zIndex:20 }} />
              )}

              {/* Zoom hint */}
              <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover/relic:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ zIndex:35 }}>
                <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/25 flex items-center justify-center">
                  <ZoomIn className="w-3 h-3 text-white" />
                </div>
              </div>

              <SafeCardImg
                src={card.imageUrl}
                alt={card.name ?? ""}
                className="w-full rounded-lg block"
                style={{ aspectRatio:"3/4", objectFit:"cover", boxShadow: c.isMain ? "0 28px 55px -10px rgba(212,175,55,0.35), 0 22px 48px rgba(0,0,0,0.88), 0 8px 22px rgba(0,0,0,0.7)" : "0 10px 28px rgba(0,0,0,0.75)" }}
              />
            </div>
          );
        })}

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none" style={{ background:"linear-gradient(to top, rgba(9,9,11,0.85) 0%, transparent 100%)", zIndex:28 }} />
      </div>

      {/* Extra cards thumbnail strip (cards beyond index 4) */}
      {extraCards.length > 0 && (
        <div className="flex justify-center gap-2 px-4 py-2" style={{ background:"#09090B", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          {extraCards.map((card, i) => (
            <div key={i} className="cursor-zoom-in rounded-md overflow-hidden border border-white/10 hover:border-[#C9A84C]/50 transition-colors" style={{ width:"34px", opacity:0.65 }} onClick={e => { e.stopPropagation(); onCardClick(altarCards.length + i); }}>
              <SafeCardImg src={card.imageUrl} alt={card.name ?? ""} className="w-full block" style={{ aspectRatio:"3/4", objectFit:"cover" }} />
            </div>
          ))}
        </div>
      )}
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
              onChange={e => setComment(e.target.value)}
              placeholder={`留言給 ${entryName}…`}
              className="bg-[#F8F8F6] border-[#E8E8E6] text-xs text-[#1A1A1A] placeholder:text-[#BCBCB0] resize-none min-h-[64px] rounded-lg font-light"
              maxLength={500}
            />
            <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
              {QUICK_COMMENTS.map(q => (
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
            {comments.map(c => (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-[#4A4A3A] mr-2 tracking-wide">{c.displayName}</span>
                  <span className="text-xs text-[#5A5A4A] font-light break-words">{c.content}</span>
                  <span className="text-[10px] text-[#BCBCB0] ml-2 font-light">{new Date(c.createdAt).toLocaleDateString("zh-HK")}</span>
                </div>
                {user && (user.id === c.userId || user.role === "admin") && (
                  <button onClick={() => deleteMutation.mutate({ commentId: c.id })}
                    className="opacity-0 group-hover:opacity-100 text-[#BCBCB0] hover:text-red-400 transition-all shrink-0">
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

  // Build top-3 cards array
  const topCards: GalleryCard[] = [];
  if (entry.topCardImageUrl) topCards.push({ imageUrl: entry.topCardImageUrl, name: entry.topCardName, grade: entry.topCardGrade, grader: entry.topCardGrader });
  if (entry.card2ImageUrl) topCards.push({ imageUrl: entry.card2ImageUrl, name: entry.card2Name, grade: entry.card2Grade, grader: entry.card2Grader });
  if (entry.card3ImageUrl) topCards.push({ imageUrl: entry.card3ImageUrl, name: entry.card3Name, grade: entry.card3Grade, grader: entry.card3Grader });

  const rankLabel = rank <= 3 ? ["Ⅰ", "Ⅱ", "Ⅲ"][rank - 1] : `${rank}`;
  const rankColor = rank === 1 ? "text-[#C9A84C] border-[#C9A84C]/50"
    : rank === 2 ? "text-[#9A9A9A] border-[#9A9A9A]/50"
    : rank === 3 ? "text-[#A07040] border-[#A07040]/50"
    : "text-[#BCBCB0] border-[#BCBCB0]/30";

  return (
    <>
      <div
        className={`relative bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] transition-all duration-500
          shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]
          hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]
          hover:-translate-y-1
          ${glowing ? "shadow-[0_0_0_3px_rgba(168,216,234,0.5),0_8px_40px_rgba(168,216,234,0.3)]" : ""}
        `}
      >
        {/* Rank badge */}
        <div className={`absolute top-3 left-3 z-30 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-light tracking-wider bg-white/90 backdrop-blur-sm ${rankColor}`}>
          {rankLabel}
        </div>

        {/* Dark monolith shrine niche */}
        <div className="relative overflow-hidden rounded-t-2xl">
          <StackedCardRelics cards={topCards} onCardClick={idx => setGalleryIndex(idx)} />
          {/* Gallery hint */}
          {topCards.length > 0 && (
            <p className="text-center text-[9px] text-[#6A6A6A] tracking-[0.2em] uppercase font-light py-1.5"
              style={{ background: "#09090B" }}>
              點擊卡牌放大欣賞
            </p>
          )}
        </div>

        {/* Marble body */}
        <div className="p-4">
          {/* Name + sigh count row */}
          <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="font-light text-[#1A1A1A] text-sm tracking-[0.06em] truncate">{entry.displayName}</p>
    
            </div>
            <div className="flex items-center gap-1 text-[#C9A84C] shrink-0">
              <Wind className="w-3 h-3" />
              <span className="text-xs font-light tracking-wider">{entry.sighs.toLocaleString()}</span>
            </div>
          </div>

          {/* Value — runic inscription */}
          <div className="my-3 py-2.5 border-t border-b border-[#EEEEE8]">
            <p className="text-[9px] text-[#BCBCB0] tracking-[0.3em] uppercase mb-0.5 font-light">Total Value</p>
            <p className="text-lg font-light text-[#1A1A1A] tracking-[0.04em] truncate">{formatHKD(entry.totalValueHKD)}</p>
            <div className="mt-1 h-px w-14 bg-gradient-to-r from-[#C9A84C]/60 to-transparent" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSigh}
              disabled={sighMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#E8E8E4] hover:border-[#C9A84C]/50 hover:bg-[#FFF8E7]/60 text-[#4A4A3A] text-[11px] font-light tracking-[0.12em] rounded-full transition-all duration-300 uppercase active:scale-95 min-w-0"
            >
              {sighMutation.isPending
                ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                : <Wind className="w-3 h-3 text-[#C9A84C] shrink-0" />}
              <span className="truncate">Sigh</span>
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#E8E8E4] hover:border-[#8A9AAA]/40 hover:bg-[#F5F8FA]/50 text-[#4A4A3A] text-[11px] font-light tracking-[0.1em] rounded-full transition-all duration-300 uppercase min-w-0"
            >
              <MessageCircle className="w-3 h-3 text-[#8A9AAA] shrink-0" />
              {showComments ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
            </button>
            <button
              onClick={handleShare}
              className="p-2 border border-[#E8E8E4] hover:border-[#BCBCB0] text-[#BCBCB0] hover:text-[#4A4A3A] rounded-full transition-all duration-300 shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {showComments && <CommentSection entryId={entry.id} entryName={entry.displayName} />}
        </div>
      </div>

      {galleryIndex !== null && topCards.length > 0 && (
        <CardGallery cards={topCards} initialIndex={galleryIndex} ownerName={entry.displayName} onClose={() => setGalleryIndex(null)} />
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
    onSuccess: () => { utils.wall.getWall.invalidate(); utils.wall.getMyEntry.invalidate(); toast.success("已從嘆息之牆撤除"); onClose(); },
  });
  const posterMutation = trpc.wall.generatePoster.useMutation({
    onSuccess: (data) => { window.open(data.posterUrl, "_blank"); toast.success("榮譽證書已生成！"); },
    onError: (e) => toast.error(e.message),
  });

  const publishError = publishMutation.error;
  const isShortfall = publishError?.data?.code === "FORBIDDEN";

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
          <h2 className="text-2xl text-white tracking-[0.25em] uppercase mb-1 font-light" style={{ fontFamily: "'Montserrat', sans-serif" }}>嘆息之牆</h2>
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
              <p className="text-sm font-light text-[#1A1A1A] mb-4 leading-relaxed">{publishError.message}</p>
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WallOfSighs() {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<"totalValue" | "sighs" | "createdAt">("totalValue");
  const [showPublishModal, setShowPublishModal] = useState(false);

  const { data: statsData } = trpc.wall.getStats.useQuery();
  const { data: wallData, isLoading } = trpc.wall.getWall.useQuery({ limit: 50, offset: 0, sortBy });
  const entries = wallData?.entries ?? [];

  const [pageVisible, setPageVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPageVisible(true), 80); return () => clearTimeout(t); }, []);

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
        @keyframes sanctuaryReveal {
          0%   { opacity: 0; transform: translateY(24px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes runeReveal {
          0%   { opacity: 0; stroke-dashoffset: 200; }
          100% { opacity: 1; stroke-dashoffset: 0; }
        }
        @keyframes stoneReveal {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      <div
        className="min-h-screen bg-[#F5F5F3]"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          opacity: pageVisible ? 1 : 0,
          transform: pageVisible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.9s cubic-bezier(0.4,0,0.2,1), transform 0.9s cubic-bezier(0.4,0,0.2,1)',
        }}
      >

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-[#F3F4F6] border-b border-[#E8E8E4]">
          {/* Stone wall bg texture */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.028]"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, #4A4A3A 0px, #4A4A3A 1px, transparent 1px, transparent 80px)" }} />
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F0F0EE]/60 to-transparent" />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
            {/* Rune ornament */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#C9A84C]/50" />
              <div className="w-1 h-1 rounded-full bg-[#C9A84C]/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
              <div className="w-1 h-1 rounded-full bg-[#C9A84C]/60" />
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#C9A84C]/50" />
            </div>

            <p className="text-[10px] text-[#C9A84C] tracking-[0.5em] uppercase mb-3 font-light"
              style={{ animation: "runeGlow 3s ease-in-out infinite" }}>
              Nordic Sanctuary · BOXIUM PTCG
            </p>
            <h1 className="text-5xl md:text-7xl text-[#1A1A1A] tracking-[0.22em] uppercase mb-2 font-light leading-none">
              嘆息之牆
            </h1>
            <p className="text-[11px] md:text-xs text-[#9A9A8A] tracking-[0.45em] uppercase mb-2 font-light">
              THE WALL OF SIGHS
            </p>

            <div className="flex items-center justify-center gap-4 my-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#C9A84C]/70" />
              <div className="flex gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[#C9A84C]/50" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                <div className="w-1 h-1 rounded-full bg-[#C9A84C]/50" />
              </div>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#C9A84C]/70" />
            </div>

            <p className="text-[#7A7A6A] text-sm font-light tracking-[0.06em] max-w-md mx-auto mb-10 leading-loose">
              凡人止步。此牆只記載令全網 TCG 玩家<br className="hidden md:block" />
              為之嘆息的絕世巨富與神級收藏。
            </p>

            {/* ── Stats + CTA — vertical golden ratio layout ── */}
            <div className="flex flex-col items-center w-full max-w-2xl mx-auto">

              {/* Stats altar — 3 cards horizontal, fixed width per card */}
              <div className="flex flex-row bg-white border border-[#E8E8E4] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.05)] w-full max-w-lg">
                {[
                  { label: "Wall Total Value", value: <><span className="text-sm">HKD </span><AnimatedCounter value={Math.round(statsData?.totalValueHKD ?? 0)} /></>, color: "text-[#1A1A1A]" },
                  { label: "Total Sighs", value: <AnimatedCounter value={statsData?.totalSighs ?? 0} />, color: "text-[#C9A84C]" },
                  { label: "On The Wall", value: <AnimatedCounter value={statsData?.entryCount ?? 0} />, color: "text-[#1A1A1A]" },
                ].map((stat, i) => (
                  <div key={i} className="flex items-stretch flex-1 min-w-0">
                    {i > 0 && <div className="w-px bg-[#E8E8E4] shrink-0" />}
                    <div className="px-3 py-4 text-center flex-1 min-w-0">
                      <p className="text-[8px] text-[#BCBCB0] tracking-[0.2em] uppercase mb-1 font-light leading-tight">{stat.label}</p>
                      <p className={`text-lg font-light tracking-wide truncate ${stat.color}`}>{stat.value}</p>
                      <div className="mt-1 h-px w-6 mx-auto bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA button — Nordic Altar Stone, centered below stats */}
              <button
                onClick={() => { if (!user) { setLocation("/login"); return; } setShowPublishModal(true); }}
                className="mt-8 flex items-center justify-center gap-3 px-12 py-4 rounded-xl transition-all duration-300 active:translate-y-0"
                style={{
                  background: "#111113",
                  color: "white",
                  border: "1px solid rgba(212,175,55,0.3)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#1A1A1D";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.8)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 30px -5px rgba(212,175,55,0.2), 0 6px 20px rgba(0,0,0,0.25)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#111113";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.3)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.22)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                {/* Runic upward sword SVG */}
                <svg width="11" height="15" viewBox="0 0 11 15" fill="none" className="shrink-0">
                  <path d="M5.5 13V2M5.5 2L2 5.5M5.5 2L9 5.5" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 13.5H9" stroke="#D4AF37" strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/>
                  <path d="M3.5 11.5H7.5" stroke="#D4AF37" strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
                </svg>
                <span>登上神殿石壁· CLAIM MY SPOT</span>
              </button>
            </div>
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
              {(["totalValue", "sighs", "createdAt"] as const).map(s => (
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
              {entries.map(entry => (
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
