import { useEffect, useRef, ReactNode } from "react";

interface Point {
  x: number;
  y: number;
}

interface LogoData {
  aspect: number;
  points: Point[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  color: string;
  glowColor: string;
  alpha: number;
  speed: number;
  phaseOffset: number;
  targetX: number;
  targetY: number;
}

interface MouseState {
  x: number;
  y: number;
  isActive: boolean;
  burstX: number | null;
  burstY: number | null;
}

export function BoxiumParticleHero({ children }: { children?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const logoPointsRef = useRef<Point[]>([]);
  const mouseRef = useRef<MouseState>({ x: 0, y: 0, isActive: false, burstX: null, burstY: null });

  const COLORS = [
    { h: 241, s: 96, l: 65 }, // Blue
    { h: 52, s: 100, l: 60 },  // Yellow
    { h: 270, s: 78, l: 68 },  // Purple
    { h: 190, s: 100, l: 62 }, // Cyan
    { h: 0, s: 0, l: 98 }      // White
  ];

  const initParticles = (width: number, height: number) => {
    const isMobile = width < 640;
    const count = isMobile ? Math.floor(Math.random() * 100) + 600 : Math.floor(Math.random() * 300) + 1500;
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const colorBase = COLORS[Math.floor(Math.random() * COLORS.length)];
      const alpha = 0.55 + Math.random() * 0.4;
      const size = 0.6 + Math.random() * 2.2;
      
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size,
        baseSize: size,
        color: colorBase.h === 0 ? `hsla(0, 0%, 98%, ${alpha})` : `hsla(${colorBase.h}, ${colorBase.s}%, ${colorBase.l}%, ${alpha})`,
        glowColor: `hsla(${colorBase.h}, ${colorBase.s}%, ${colorBase.l}%, ${alpha * 0.4})`,
        alpha,
        speed: 0.35 + Math.random() * 0.5,
        phaseOffset: Math.random() * Math.PI * 2,
        targetX: Math.random() * width,
        targetY: Math.random() * height,
      });
    }
    particlesRef.current = particles;
  };

  const updateLogoTargets = (width: number, height: number) => {
    if (logoPointsRef.current.length === 0) return;

    const logoW = Math.min(width * 0.52, 620);
    const logoH = logoW / 2.4595;
    const logoX = (width - logoW) / 2;
    const logoY = height * 0.10;

    const particles = particlesRef.current;
    const logoPoints = logoPointsRef.current;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const lp = logoPoints[i % logoPoints.length];
      p.targetX = logoX + lp.x * logoW;
      p.targetY = logoY + lp.y * logoH;
    }
  };

  useEffect(() => {
    fetch("/logo_pts.json")
      .then((res) => res.json())
      .then((data: LogoData) => {
        logoPointsRef.current = data.points;
        if (canvasRef.current) {
          updateLogoTargets(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
        }
      })
      .catch(() => {
        // Fallback: random targets already set in init
      });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const handleResize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      if (particlesRef.current.length === 0) {
        initParticles(rect.width, rect.height);
      }
      updateLogoTargets(rect.width, rect.height);
    };

    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    handleResize();

    const animate = (time: number) => {
      const t = time * 0.001;
      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);

      // Trail effect
      ctx.fillStyle = "rgba(2, 1, 20, 0.16)";
      ctx.fillRect(0, 0, W, H);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const GATHER_RADIUS = 200;
      const REPEL_RADIUS = 75;
      const BURST_RADIUS = 240;
      const FLOW_STRENGTH = 0.20;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 1. Flow Field (Curl-noise style)
        const angle = Math.sin(p.x / W * 3.5 + t * 0.30 + p.phaseOffset) * Math.cos(p.y / H * 2.8 + t * 0.22) * Math.PI * 2
                    + Math.cos(p.x / W * 1.8 - t * 0.15) * Math.sin(p.y / H * 4.0 + t * 0.26) * Math.PI;
        
        p.vx += Math.cos(angle) * FLOW_STRENGTH * p.speed;
        p.vy += Math.sin(angle) * FLOW_STRENGTH * p.speed;

        // 2. Mouse Interaction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (mouse.isActive && dist < GATHER_RADIUS) {
          const gatherStrength = 0.055 * (1 - dist / GATHER_RADIUS);
          p.vx += (p.targetX - p.x) * gatherStrength;
          p.vy += (p.targetY - p.y) * gatherStrength;

          if (dist < REPEL_RADIUS && dist > 0) {
            const repelForce = 5.0 * (1 - dist / REPEL_RADIUS);
            p.vx -= (dx / dist) * repelForce;
            p.vy -= (dy / dist) * repelForce;
          }
        }

        // 3. Click Burst
        if (mouse.burstX !== null && mouse.burstY !== null) {
          const bdx = p.x - mouse.burstX;
          const bdy = p.y - mouse.burstY;
          const bDist = Math.sqrt(bdx * bdx + bdy * bdy);
          if (bDist < BURST_RADIUS && bDist > 0) {
            const force = (1 - bDist / BURST_RADIUS) * 15;
            p.vx += (bdx / bDist) * force;
            p.vy += (bdy / bDist) * force;
          }
        }

        // Physics Integration
        p.vx *= 0.87;
        p.vy *= 0.87;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 3.2) {
          p.vx = (p.vx / speed) * 3.2;
          p.vy = (p.vy / speed) * 3.2;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
      }

      // Reset burst
      mouse.burstX = null;
      mouse.burstY = null;

      // PASS 1: Glow Halos
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        gradient.addColorStop(0, p.glowColor);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // PASS 2: Core Dots
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.isActive = true;
    };

    const onMouseLeave = () => {
      mouseRef.current.isActive = false;
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.burstX = e.clientX - rect.left;
      mouseRef.current.burstY = e.clientY - rect.top;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("mousedown", onClick);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "clamp(460px, 72vh, 760px)",
        background: "#020114",
        position: "relative",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          cursor: "crosshair",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          paddingBottom: "2.5rem",
          minHeight: "clamp(460px, 72vh, 760px)",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}