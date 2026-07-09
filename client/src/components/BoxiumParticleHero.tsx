import { useEffect, useRef, ReactNode } from "react";

interface BoxiumParticleHeroProps {
  children?: ReactNode;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;       // 0..1 (1=new, 0=dead)
  maxLife: number;
  size: number;
  hue: number;        // gold ~42, blue ~220
  brightness: number;
}

export function BoxiumParticleHero({ children }: BoxiumParticleHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoLoadedRef = useRef(false);

  // Extract edge pixels from logo for particle spawn positions
  const edgePixelsRef = useRef<{ x: number; y: number }[]>([]);
  const logoRectRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- Resize handler ---
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.scale(dpr, dpr);
      computeLogoRect(w, h);
    };

    const computeLogoRect = (cw: number, ch: number) => {
      // Logo aspect ratio ~2.5:1 (wide rectangle)
      const logoAspect = 2.5;
      const isMobile = cw < 640;
      // Logo width: 55% on desktop, 80% on mobile, capped
      const maxW = isMobile ? Math.min(cw * 0.82, 380) : Math.min(cw * 0.52, 600);
      const lw = maxW;
      const lh = lw / logoAspect;
      const lx = (cw - lw) / 2;
      const ly = (ch - lh) / 2 - (isMobile ? ch * 0.08 : ch * 0.1);
      logoRectRef.current = { x: lx, y: ly, w: lw, h: lh };
      extractEdgePixels(lx, ly, lw, lh);
    };

    const extractEdgePixels = (lx: number, ly: number, lw: number, lh: number) => {
      if (!logoLoadedRef.current || !logoImgRef.current) {
        edgePixelsRef.current = buildFallbackEdge(lx, ly, lw, lh);
        return;
      }
      // Draw logo to offscreen canvas and sample edge pixels
      const off = document.createElement("canvas");
      const res = 3; // sample every 3px
      off.width = Math.ceil(lw / res);
      off.height = Math.ceil(lh / res);
      const oc = off.getContext("2d");
      if (!oc) return;
      oc.drawImage(logoImgRef.current, 0, 0, off.width, off.height);
      const imgData = oc.getImageData(0, 0, off.width, off.height);
      const pixels: { x: number; y: number }[] = [];
      for (let py = 0; py < off.height; py++) {
        for (let px = 0; px < off.width; px++) {
          const idx = (py * off.width + px) * 4;
          const a = imgData.data[idx + 3];
          if (a > 60) {
            // Only keep edge pixels (check neighbors)
            let isEdge = false;
            for (let dy = -1; dy <= 1 && !isEdge; dy++) {
              for (let dx = -1; dx <= 1 && !isEdge; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = px + dx, ny = py + dy;
                if (nx < 0 || ny < 0 || nx >= off.width || ny >= off.height) {
                  isEdge = true;
                } else {
                  const ni = (ny * off.width + nx) * 4;
                  if (imgData.data[ni + 3] < 60) isEdge = true;
                }
              }
            }
            if (isEdge) {
              pixels.push({
                x: lx + px * res,
                y: ly + py * res,
              });
            }
          }
        }
      }
      // Also sample some interior pixels for denser emission
      for (let py = 0; py < off.height; py += 2) {
        for (let px = 0; px < off.width; px += 2) {
          const idx = (py * off.width + px) * 4;
          if (imgData.data[idx + 3] > 120) {
            pixels.push({ x: lx + px * res, y: ly + py * res });
          }
        }
      }
      edgePixelsRef.current = pixels.length > 50 ? pixels : buildFallbackEdge(lx, ly, lw, lh);
    };

    const buildFallbackEdge = (lx: number, ly: number, lw: number, lh: number) => {
      // Fallback: rectangle outline + inner points
      const pts: { x: number; y: number }[] = [];
      const steps = 200;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        // Top/bottom edges
        pts.push({ x: lx + t * lw, y: ly });
        pts.push({ x: lx + t * lw, y: ly + lh });
        // Left/right edges
        pts.push({ x: lx, y: ly + t * lh });
        pts.push({ x: lx + lw, y: ly + t * lh });
      }
      return pts;
    };

    // --- Load logo image ---
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/boxium_logo_white.webp";
    img.onload = () => {
      logoImgRef.current = img;
      logoLoadedRef.current = true;
      const { x, y, w, h } = logoRectRef.current;
      extractEdgePixels(x, y, w, h);
    };
    img.onerror = () => {
      logoLoadedRef.current = false;
    };
    logoImgRef.current = img;

    // --- Particle spawn ---
    const spawnParticle = (cw: number, ch: number): Particle => {
      const edge = edgePixelsRef.current;
      let sx: number, sy: number;
      if (edge.length > 0) {
        const pt = edge[Math.floor(Math.random() * edge.length)];
        sx = pt.x + (Math.random() - 0.5) * 4;
        sy = pt.y + (Math.random() - 0.5) * 4;
      } else {
        const { x, y, w, h } = logoRectRef.current;
        sx = x + Math.random() * w;
        sy = y + Math.random() * h;
      }

      // Direction: outward from logo center
      const { x: lx, y: ly, w: lw, h: lh } = logoRectRef.current;
      const cx = lx + lw / 2;
      const cy = ly + lh / 2;
      const angle = Math.atan2(sy - cy, sx - cx) + (Math.random() - 0.5) * 1.2;
      const speed = 0.3 + Math.random() * 2.2;

      // Color: mostly gold (#FFD700 hue ~51), some blue (~220), some white
      const r = Math.random();
      const hue = r < 0.6 ? 42 + Math.random() * 18 : r < 0.85 ? 200 + Math.random() * 40 : 60;
      const maxLife = 60 + Math.random() * 120;

      return {
        x: sx,
        y: sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife,
        size: 0.5 + Math.random() * 2.0,
        hue,
        brightness: 70 + Math.random() * 30,
      };
    };

    // --- Animation loop ---
    let frame = 0;
    const isMobile = () => (canvasRef.current?.clientWidth ?? 800) < 640;
    const maxParticles = () => (isMobile() ? 400 : 900);
    const spawnRate = () => (isMobile() ? 6 : 14);

    const draw = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;

      // Fade background (trail effect)
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, cw, ch);

      // Draw BOXIUM logo (glow effect)
      if (logoLoadedRef.current && logoImgRef.current) {
        const { x, y, w, h } = logoRectRef.current;
        const pulse = 0.7 + 0.3 * Math.sin(frame * 0.03);

        // Multi-layer glow
        for (let g = 4; g >= 1; g--) {
          ctx.save();
          ctx.globalAlpha = (0.08 + g * 0.04) * pulse;
          ctx.filter = `blur(${g * 8}px) brightness(2)`;
          ctx.drawImage(logoImgRef.current, x - g * 6, y - g * 6, w + g * 12, h + g * 12);
          ctx.restore();
        }

        // Main logo
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.filter = "brightness(1.2)";
        ctx.drawImage(logoImgRef.current, x, y, w, h);
        ctx.restore();

        // Inner bright glow
        ctx.save();
        ctx.globalAlpha = 0.35 * pulse;
        ctx.filter = "blur(3px) brightness(3)";
        ctx.drawImage(logoImgRef.current, x, y, w, h);
        ctx.restore();
      }

      // Spawn particles
      const sr = spawnRate();
      const mp = maxParticles();
      for (let i = 0; i < sr && particlesRef.current.length < mp; i++) {
        particlesRef.current.push(spawnParticle(cw, ch));
      }

      // Update & draw particles
      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= 1 / p.maxLife;

        if (p.life <= 0) continue;

        const alpha = Math.min(p.life * 2, 1) * 0.85;
        const r = p.size * (0.5 + p.life * 0.5);

        // Glow halo
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        grad.addColorStop(0, `hsla(${p.hue},100%,${p.brightness}%,${alpha})`);
        grad.addColorStop(0.4, `hsla(${p.hue},90%,${p.brightness - 10}%,${alpha * 0.5})`);
        grad.addColorStop(1, `hsla(${p.hue},80%,50%,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,95%,${alpha})`;
        ctx.fill();

        alive.push(p);
      }
      particlesRef.current = alive;

      frame++;
      animRef.current = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ minHeight: "clamp(420px, 70vh, 700px)", background: "#000" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      />
      {/* Children (text, stats) below the logo area */}
      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-10 pt-4"
        style={{ minHeight: "clamp(420px, 70vh, 700px)" }}>
        <div className="mt-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
