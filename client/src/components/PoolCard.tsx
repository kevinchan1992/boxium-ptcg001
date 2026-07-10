/**
 * PoolCard — Clove/DOPA! 頂級商用視覺標準
 * - 封面：4:3 比例（手機雙欄也夠高），卡牌頂邊框、強烈立體投影
 * - 下半部：極粗極大品牌藍價格 + 加粗進度條 + 行動按鈕
 * - 無封面圖時用 CSS 3D 動態備用封面
 */
import { Link, useLocation } from "wouter";
import { Coins } from "lucide-react";

interface RewardImage {
  imageUrl: string;
  rewardType: string;
}

interface PoolCardProps {
  pool: {
    id: number;
    title?: string;
    pricePoints: number;
    totalSlots: number;
    drawnCount?: number;
    status?: string;
    rewardImages?: RewardImage[];
    coverImageUrl?: string | null;
    tags?: string[];
  };
  showDraftBadge?: boolean;
  href?: string;
}

/* ══ 主題色系 ══ */
function getTheme(rewardImages: RewardImage[] = []) {
  const types = rewardImages.map((r) => r.rewardType);
  if (types.includes("rainbow")) return {
    bg: "linear-gradient(145deg,#3b0764 0%,#7c3aed 35%,#db2777 65%,#f59e0b 100%)",
    glow: "#a855f7",
    glowRgba: "rgba(168,85,247,0.9)",
    bar: "linear-gradient(90deg,#7c3aed,#ec4899)",
    badge: "彩虹大賞",
    badgeBg: "linear-gradient(90deg,#7c3aed,#ec4899)",
    price: "#7c3aed",
    btn1: "linear-gradient(135deg,#7c3aed,#a855f7)",
    btn2: "linear-gradient(135deg,#ec4899,#f43f5e)",
    hover: "rgba(124,58,237,0.25)",
  };
  if (types.includes("milestone")) return {
    bg: "linear-gradient(145deg,#431407 0%,#ea580c 40%,#fbbf24 100%)",
    glow: "#f97316",
    glowRgba: "rgba(249,115,22,0.9)",
    bar: "linear-gradient(90deg,#ea580c,#fbbf24)",
    badge: "里程碑",
    badgeBg: "linear-gradient(90deg,#ea580c,#f59e0b)",
    price: "#ea580c",
    btn1: "linear-gradient(135deg,#ea580c,#f97316)",
    btn2: "linear-gradient(135deg,#d97706,#b45309)",
    hover: "rgba(234,88,12,0.25)",
  };
  if (types.includes("gold")) return {
    bg: "linear-gradient(145deg,#451a03 0%,#b45309 35%,#fbbf24 70%,#fef9c3 100%)",
    glow: "#f59e0b",
    glowRgba: "rgba(245,158,11,0.9)",
    bar: "linear-gradient(90deg,#d97706,#fbbf24)",
    badge: "金賞",
    badgeBg: "linear-gradient(90deg,#d97706,#fbbf24)",
    price: "#b45309",
    btn1: "linear-gradient(135deg,#d97706,#fbbf24)",
    btn2: "linear-gradient(135deg,#b45309,#92400e)",
    hover: "rgba(217,119,6,0.25)",
  };
  return {
    bg: "linear-gradient(145deg,#0f172a 0%,#1e3a8a 30%,#2563eb 65%,#60a5fa 100%)",
    glow: "#3b82f6",
    glowRgba: "rgba(59,130,246,0.9)",
    bar: "linear-gradient(90deg,#2563eb,#7c3aed)",
    badge: "標準",
    badgeBg: "linear-gradient(90deg,#1d4ed8,#2563eb)",
    price: "#1d4ed8",
    btn1: "linear-gradient(135deg,#1d4ed8,#2563eb)",
    btn2: "linear-gradient(135deg,#7c3aed,#6d28d9)",
    hover: "rgba(37,99,235,0.22)",
  };
}

/* ══ CSS 3D 動態備用封面 ══ */
function CSS3DCover({ imgs, theme }: { imgs: RewardImage[]; theme: ReturnType<typeof getTheme> }) {
  const [c1, c2, c3] = imgs;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: theme.bg }}>
      {/* 中心光暈 */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 80% 70% at 55% 45%, ${theme.glowRgba} 0%, transparent 65%)`,
      }} />
      {/* 光粒子 */}
      {[...Array(9)].map((_, i) => (
        <div key={i} className="absolute rounded-full animate-pulse" style={{
          width: `${3 + (i % 3) * 2}px`,
          height: `${3 + (i % 3) * 2}px`,
          background: "rgba(255,255,255,0.55)",
          top: `${8 + (i * 11) % 72}%`,
          left: `${5 + (i * 13) % 85}%`,
          animationDelay: `${i * 0.35}s`,
          animationDuration: `${1.8 + (i % 3) * 0.6}s`,
        }} />
      ))}

      {/* 3D 卡牌堆疊 */}
      <div className="absolute inset-0 flex items-end justify-center pb-2">
        {imgs.length > 0 ? (
          <div className="relative" style={{ width: "78%", height: "90%" }}>
            {/* 後方第三張 */}
            {c3 && (
              <img src={c3.imageUrl} alt="" draggable={false}
                className="absolute object-contain rounded-lg"
                style={{
                  width: "62%", height: "auto",
                  bottom: "0", left: "-8%",
                  transform: "rotate(-18deg) translateY(8%)",
                  filter: `drop-shadow(0 20px 25px rgba(0,0,0,0.55))`,
                  opacity: 0.5, zIndex: 1,
                }} />
            )}
            {/* 中間第二張 */}
            {c2 && (
              <img src={c2.imageUrl} alt="" draggable={false}
                className="absolute object-contain rounded-lg"
                style={{
                  width: "65%", height: "auto",
                  bottom: "0", right: "-6%",
                  transform: "rotate(14deg) translateY(4%)",
                  filter: `drop-shadow(0 20px 25px rgba(0,0,0,0.55))`,
                  opacity: 0.7, zIndex: 2,
                }} />
            )}
            {/* 主卡（幾乎頂邊框） */}
            {c1 && (
              <img src={c1.imageUrl} alt="" draggable={false}
                className="absolute object-contain rounded-lg"
                style={{
                  width: "78%", height: "auto",
                  bottom: "0",
                  left: "50%",
                  transform: "translateX(-50%) rotate(-4deg)",
                  filter: [
                    `drop-shadow(0 28px 20px rgba(0,0,0,0.65))`,
                    `drop-shadow(0 0 28px ${theme.glowRgba})`,
                    `drop-shadow(0 4px 8px rgba(0,0,0,0.8))`,
                  ].join(" "),
                  zIndex: 3,
                }} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/40 pb-8">
            <div className="text-5xl">🎴</div>
            <span className="text-xs font-medium tracking-wider">神秘卡池</span>
          </div>
        )}
      </div>

      {/* 底部漸層遮罩（過渡到白色資訊欄） */}
      <div className="absolute bottom-0 left-0 right-0" style={{
        height: "28%",
        background: "linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
      }} />
    </div>
  );
}

/* ══ 主組件 ══ */
export function PoolCard({ pool, showDraftBadge = false, href }: PoolCardProps) {
  const [, navigate] = useLocation();
  const drawn      = pool.drawnCount ?? 0;
  const total      = pool.totalSlots ?? 100;
  const progress   = Math.min(100, (drawn / total) * 100);
  const remaining  = total - drawn;
  const imgs       = pool.rewardImages ?? [];
  const theme      = getTheme(imgs);
  const linkHref   = href ?? `/pools/${pool.id}`;
  const hasCover   = !!(pool.coverImageUrl?.trim());
  const isSoldOut  = remaining <= 0;
  const almostGone = !isSoldOut && remaining <= Math.max(10, total * 0.05);

  const stopAndGo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/pools/${pool.id}`);
  };

  return (
    <Link href={linkHref}>
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer select-none bg-white"
        style={{
          boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
          transition: "transform 0.32s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.28s ease",
          willChange: "transform",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(-5px) scale(1.025)";
          el.style.boxShadow = `0 20px 48px ${theme.hover}, 0 4px 12px rgba(0,0,0,0.08)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "";
          el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)";
        }}
      >
        {/* ══ 封面區（4:3 比例） ══ */}
        <div className="relative w-full overflow-hidden" style={{ paddingBottom: "75%" }}>
          {hasCover ? (
            <img
              src={pool.coverImageUrl!}
              alt={pool.title ?? "卡池封面"}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <CSS3DCover imgs={imgs} theme={theme} />
          )}

          {/* 狀態徽章 */}
          <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
            {showDraftBadge && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white bg-slate-500 shadow">草稿</span>
            )}
            {!showDraftBadge && isSoldOut && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white bg-red-500 shadow">已售罄</span>
            )}
            {!showDraftBadge && almostGone && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow" style={{ background: theme.badgeBg }}>即將售罄</span>
            )}
            {pool.tags?.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow"
                style={{ background: tag === "新著" ? "#ef4444" : tag === "熱門" ? "#f97316" : "#7c3aed" }}>
                {tag}
              </span>
            ))}
          </div>

          {/* 右上角剩餘格數 */}
          <div className="absolute top-2 right-2 z-10">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: "rgba(255,255,255,0.92)", color: "#475569", backdropFilter: "blur(8px)", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
              剩 {remaining.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ══ 資訊欄 ══ */}
        <div className="bg-white px-2.5 pt-2 pb-2.5 space-y-1.5">
          {/* 卡池名稱 */}
          {pool.title && (
            <p className="text-[11px] font-bold text-slate-600 leading-tight line-clamp-1">{pool.title}</p>
          )}

          {/* 進度條 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] text-slate-400">
                剩 <span className="font-semibold text-slate-500">{remaining.toLocaleString()}</span> / {total.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: theme.bar }} />
            </div>
          </div>

          {/* 價格（極粗極大） */}
          <div className="flex items-baseline gap-1">
            <Coins className="w-3.5 h-3.5 shrink-0" style={{ color: theme.price, marginBottom: 1 }} />
            <span className="font-black leading-none" style={{
              color: theme.price,
              fontSize: "clamp(17px, 5vw, 22px)",
              letterSpacing: "-0.02em",
            }}>
              {pool.pricePoints.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">/ 抽</span>
          </div>

          {/* 行動按鈕 */}
          <div className="flex gap-1.5 pt-0.5">
            <button
              className="flex-1 py-1.5 rounded-xl text-white text-[11px] font-black tracking-wide transition-all active:scale-95 hover:opacity-90"
              style={{ background: theme.btn1, boxShadow: `0 4px 12px ${theme.hover}` }}
              onClick={stopAndGo}
            >
              抽 1 次
            </button>
            <button
              className="flex-1 py-1.5 rounded-xl text-white text-[11px] font-black tracking-wide transition-all active:scale-95 hover:opacity-90"
              style={{ background: theme.btn2, boxShadow: `0 4px 12px ${theme.hover}` }}
              onClick={stopAndGo}
            >
              10 連
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PoolCard;
