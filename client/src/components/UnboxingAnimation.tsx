/**
 * UnboxingAnimation — Three.js WebGL 開箱動畫
 * Rainbow: 紫粉彩虹粒子爆炸 + 全屏光效
 * Gold: 金色粒子瀑布 + 閃光
 * Blue: 藍色漣漪 + 粒子
 */
import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

interface DrawResult {
  slotNumber: number;
  cardName: string;
  rewardType?: "rainbow" | "gold" | "blue" | "milestone";
  effectTier?: number;
  milestoneCardName?: string;
  isMilestone?: boolean;
  pointsSpent?: number;
}

interface Props {
  result: DrawResult;
  onComplete: () => void;
}

// ─── 粒子系統配置 ────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  rainbow: {
    colors: [0xff00ff, 0x00ffff, 0xffff00, 0xff6600, 0x6600ff, 0x00ff66],
    count: 600,
    speed: 0.08,
    size: 0.12,
    bgColor: "from-purple-900/95 via-pink-900/95 to-indigo-900/95",
    glow: "shadow-[0_0_60px_rgba(168,85,247,0.8)]",
    label: "🌈 Rainbow 大賞！",
    labelColor: "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400",
  },
  gold: {
    colors: [0xffd700, 0xffa500, 0xffec8b, 0xdaa520, 0xf5deb3],
    count: 400,
    speed: 0.06,
    size: 0.1,
    bgColor: "from-yellow-900/95 via-amber-900/95 to-orange-900/95",
    glow: "shadow-[0_0_50px_rgba(234,179,8,0.7)]",
    label: "🥇 Gold 賞！",
    labelColor: "text-yellow-400",
  },
  blue: {
    colors: [0x00bfff, 0x1e90ff, 0x87ceeb, 0x4169e1, 0x00ced1],
    count: 300,
    speed: 0.05,
    size: 0.09,
    bgColor: "from-blue-900/95 via-cyan-900/95 to-indigo-900/95",
    glow: "shadow-[0_0_40px_rgba(59,130,246,0.6)]",
    label: "💙 Blue 賞",
    labelColor: "text-blue-400",
  },
  milestone: {
    colors: [0x00ff88, 0x00cc66, 0x88ff00, 0x66cc00, 0xaaffaa],
    count: 350,
    speed: 0.055,
    size: 0.1,
    bgColor: "from-green-900/95 via-emerald-900/95 to-teal-900/95",
    glow: "shadow-[0_0_45px_rgba(16,185,129,0.6)]",
    label: "🎯 里程碑！",
    labelColor: "text-green-400",
  },
};

function getTierKey(result: DrawResult): keyof typeof TIER_CONFIG {
  if (result.rewardType && result.rewardType in TIER_CONFIG) {
    return result.rewardType as keyof typeof TIER_CONFIG;
  }
  if (result.effectTier === 1) return "rainbow";
  if (result.effectTier === 2) return "gold";
  return "blue";
}

// ─── WebGL 粒子場景 ──────────────────────────────────────────────────────────
function useThreeScene(canvasRef: React.RefObject<HTMLCanvasElement | null>, tierKey: keyof typeof TIER_CONFIG) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const config = TIER_CONFIG[tierKey];
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.z = 5;

    // 粒子幾何體
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const velocities = new Float32Array(config.count * 3);
    const colorArr = new Float32Array(config.count * 3);
    const sizes = new Float32Array(config.count);

    const colorObjects = config.colors.map(c => new THREE.Color(c));

    for (let i = 0; i < config.count; i++) {
      // 初始位置：中心爆炸
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

      // 速度：向外爆炸
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = config.speed * (0.5 + Math.random() * 1.5);
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed + 0.02; // 輕微上浮
      velocities[i * 3 + 2] = Math.cos(phi) * speed;

      // 顏色
      const color = colorObjects[Math.floor(Math.random() * colorObjects.length)];
      colorArr[i * 3] = color.r;
      colorArr[i * 3 + 1] = color.g;
      colorArr[i * 3 + 2] = color.b;

      sizes[i] = config.size * (0.5 + Math.random());
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // 粒子材質
    const material = new THREE.PointsMaterial({
      size: config.size,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Rainbow 特效：旋轉光環
    let ring: THREE.Mesh | null = null;
    if (tierKey === "rainbow") {
      const ringGeo = new THREE.TorusGeometry(2, 0.05, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.6 });
      ring = new THREE.Mesh(ringGeo, ringMat);
      scene.add(ring);
    }

    let frame = 0;
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      frame++;

      const pos = geometry.attributes.position.array as Float32Array;
      const gravity = -0.001;

      for (let i = 0; i < config.count; i++) {
        velocities[i * 3 + 1] += gravity;
        pos[i * 3] += velocities[i * 3];
        pos[i * 3 + 1] += velocities[i * 3 + 1];
        pos[i * 3 + 2] += velocities[i * 3 + 2];
      }
      geometry.attributes.position.needsUpdate = true;

      // 漸出
      if (frame > 80) {
        material.opacity = Math.max(0, material.opacity - 0.015);
      }

      // 旋轉
      particles.rotation.y += 0.005;
      if (ring) {
        ring.rotation.x += 0.02;
        ring.rotation.y += 0.03;
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - frame * 0.005);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!canvas) return;
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [tierKey]);
}

// ─── 主元件 ──────────────────────────────────────────────────────────────────
export default function UnboxingAnimation({ result, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tierKey = getTierKey(result);
  const config = TIER_CONFIG[tierKey];

  useThreeScene(canvasRef, tierKey);

  // 自動關閉（5秒後）
  useEffect(() => {
    const timer = setTimeout(onComplete, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br ${config.bgColor} backdrop-blur-sm`}>
      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 卡片展示 */}
      <div className="relative z-10 text-center px-6 max-w-sm w-full">
        {/* 光暈 */}
        <div className={`relative inline-block rounded-2xl p-1 ${config.glow} mb-6`}>
          <div className="bg-zinc-900/80 rounded-xl p-6 min-w-[200px]">
            <div className="text-6xl mb-3">🃏</div>
            <div className={`text-2xl font-black mb-1 ${config.labelColor}`}>
              {config.label}
            </div>
            <div className="text-white font-bold text-lg mt-2 leading-tight">
              {result.cardName}
            </div>
            {result.isMilestone && result.milestoneCardName && (
              <div className="mt-2 text-green-400 text-sm bg-green-500/10 rounded-lg px-3 py-1.5">
                🎯 里程碑獎品：{result.milestoneCardName}
              </div>
            )}
            <div className="text-zinc-400 text-sm mt-2">
              格子 #{String(result.slotNumber).padStart(2, "0")}
            </div>
          </div>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={onComplete}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
          >
            <Sparkles className="w-4 h-4 mr-2" /> 繼續
          </Button>
          <Button
            variant="ghost"
            onClick={onComplete}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 點數消費 */}
        {result.pointsSpent && (
          <div className="mt-3 text-zinc-500 text-xs">
            消費 {result.pointsSpent.toLocaleString()} 點
          </div>
        )}
      </div>
    </div>
  );
}
