/**
 * PoolCard — Clove/DOPA! 頂級商用大橫幅標準
 * 封面：4:3 比例，卡牌放大頂邊框，三層強投影
 * 資訊欄：極粗大價格 + 進度條 + 抽1次/10連按鈕
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

/* ── 主題色 ── */
function getTheme(rewardImages: RewardImage[] = []) {
  const types = rewardImages.map((r) => r.rewardType);
  if (types.includes("rainbow")) return {
    bg: "linear-gradient(145deg,#1a0533 0%,#6d28d9 30%,#db2777 65%,#f59e0b 100%)",
    glow: "rgba(168,85,247,0.95)",
    bar: "linear-gradient(90deg,#7c3aed,#ec4899)",
    price: "#7c3aed",
    btn1: "linear-gradient(135deg,#7c3aed,#a855f7)",
    btn2: "linear-gradient(135deg,#ec4899,#f43f5e)",
    shadow: "rgba(124,58,237,0.3)",
  };
  if (types.includes("milestone")) return {
    bg: "linear-gradient(145deg,#1c0700 0%,#c2410c 35%,#f97316 65%,#fbbf24 100%)",
    glow: "rgba(249,115,22,0.95)",
    bar: "linear-gradient(90deg,#ea580c,#fbbf24)",
    price: "#ea580c",
    btn1: "linear-gradient(135deg,#ea580c,#f97316)",
    btn2: "linear-gradient(135deg,#d97706,#b45309)",
    shadow: "rgba(234,88,12,0.3)",
  };
  if (types.includes("gold")) return {
    bg: "linear-gradient(145deg,#1c0e00 0%,#92400e 30%,#d97706 60%,#fde68a 100%)",
    glow: "rgba(245,158,11,0.95)",
    bar: "linear-gradient(90deg,#d97706,#fbbf24)",
    price: "#b45309",
    btn1: "linear-gradient(135deg,#d97706,#fbbf24)",
    btn2: "linear-gradient(135deg,#b45309,#92400e)",
    shadow: "rgba(217,119,6,0.3)",
  };
  return {
    bg: "linear-gradient(145deg,#020617 0%,#1e3a8a 30%,#1d4ed8 60%,#3b82f6 100%)",
    glow: "rgba(59,130,246,0.95)",
    bar: "linear-gradient(90deg,#1d4ed8,#7c3aed)",
    price: "#1d4ed8",
    btn1: "linear-gradient(135deg,#1d4ed8,#2563eb)",
    btn2: "linear-gradient(135deg,#7c3aed,#6d28d9)",
    shadow: "rgba(29,78,216,0.3)",
  };
}

/* ── CSS 3D 動態備用封面 ── */
function CSS3DCover({ imgs, theme }: { imgs: RewardImage[]; theme: ReturnType<typeof getTheme> }) {
  const [c1, c2, c3] = imgs;
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: theme.bg }}
    >
      {/* 中心強光暈 */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 75% 65% at 50% 50%, ${theme.glow} 0%, transparent 60%)`,
      }} />
      {/* 邊角暗角 */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 120% 120% at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)",
      }} />
      {/* 光粒子 */}
      {[...Array(10)].map((_, i) => (
        <div key={i} className="absolute rounded-full animate-pulse" style={{
          width: `${2 + (i % 4) * 1.5}px`,
          height: `${2 + (i % 4) * 1.5}px`,
          background: "rgba(255,255,255,0.6)",
          top: `${5 + (i * 9) % 80}%`,
          left: `${3 + (i * 11) % 90}%`,
          animationDelay: `${i * 0.3}s`,
          animationDuration: `${1.5 + (i % 3) * 0.7}s`,
        }} />
      ))}

      {/* ── 3D 卡牌堆疊（卡牌放大頂邊框） ── */}
      <div className="absolute inset-0 overflow-hidden">
        {imgs.length > 0 ? (
          <>
            {/* 左後方第三張 */}
            {c3 && (
              <img
                src={c3.imageUrl} alt="" draggable={false}
                className="absolute object-contain rounded-md"
                style={{
                  height: "90%", width: "auto",
                  top: "5%", left: "-5%",
                  transform: "rotate(-20deg)",
                  filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.6))",
                  opacity: 0.45, zIndex: 1,
                }}
              />
            )}
            {/* 右後方第二張 */}
            {c2 && (
              <img
                src={c2.imageUrl} alt="" draggable={false}
                className="absolute object-contain rounded-md"
                style={{
                  height: "90%", width: "auto",
                  top: "5%", right: "-5%",
                  transform: "rotate(18deg)",
                  filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.6))",
                  opacity: 0.6, zIndex: 2,
                }}
              />
            )}
            {/* 主卡居中（超出邊框頂格） */}
            {c1 && (
              <img
                src={c1.imageUrl} alt="" draggable={false}
                className="absolute object-contain rounded-md"
                style={{
                  height: "115%", width: "auto",
                  top: "-8%", left: "50%",
                  transform: "translateX(-50%) rotate(-5deg)",
                  filter: [
                    `drop-shadow(0 32px 24px rgba(0,0,0,0.7))`,
                    `drop-shadow(0 0 32px ${theme.glow})`,
                    `drop-shadow(0 6px 10px rgba(0,0,0,0.9))`,
                  ].join(" "),
                  zIndex: 3,
                }}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
            <div className="text-5xl">🎴</div>
            <span className="text-xs font-medium tracking-wider">神秘卡池</span>
          </div>
        )}
      </div>

      {/* 底部白色漸層遮罩（過渡到資訊欄） */}
      <div className="absolute bottom-0 left-0 right-0" style={{
        height: "30%",
        background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.6) 40%, transparent 100%)",
      }} />
    </div>
  );
}

/* ── 主組件 ── */
export function PoolCard({ pool, showDraftBadge = false, href }: PoolCardProps) {
  const [, navigate] = useLocation();
  const drawn     = pool.drawnCount ?? 0;
  const total     = pool.totalSlots ?? 100;
  const progress  = Math.min(100, (drawn / total) * 100);
  const remaining = total - drawn;
  const imgs      = pool.rewardImages ?? [];
  const theme     = getTheme(imgs);
  const linkHref  = href ?? `/pools/${pool.id}`;
  const hasCover  = !!(pool.coverImageUrl?.trim());
  const isSoldOut = remaining <= 0;
  const almostGone = !isSoldOut && remaining <= Math.max(10, total * 0.05);

  const goToPool = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/pools/${pool.id}`);
  };

  return (
    <Link href={linkHref}>
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer select-none bg-white"
        style={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
          transition: "transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.28s ease",
          willChange: "transform",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(-4px) scale(1.02)";
          el.style.boxShadow = `0 18px 44px ${theme.shadow}, 0 4px 12px rgba(0,0,0,0.08)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "";
          el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.07)";
        }}
      >
        {/* ══ 封面區（4:3 比例，卡牌頂格） ══ */}
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
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white bg-slate-500 shadow-md">草稿</span>
            )}
            {!showDraftBadge && isSoldOut && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white bg-red-500 shadow-md">已售罄</span>
            )}
            {!showDraftBadge && almostGone && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md"
                style={{ background: theme.btn1 }}>即將售罄</span>
            )}
            {pool.tags?.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md"
                style={{ background: tag === "新著" ? "#ef4444" : tag === "熱門" ? "#f97316" : "#7c3aed" }}>
                {tag}
              </span>
            ))}
          </div>

          {/* 右上角剩餘格數 */}
          <div className="absolute top-2 right-2 z-10">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold shadow-md"
              style={{
                background: "rgba(255,255,255,0.9)",
                color: "#475569",
                backdropFilter: "blur(8px)",
              }}>
              剩 {remaining.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ══ 資訊欄（極簡） ══ */}
        <div className="bg-white px-3 pt-2.5 pb-3 space-y-2">
          {/* 卡池名稱 */}
          {pool.title && (
            <p className="text-xs font-bold text-slate-600 leading-tight line-clamp-1">{pool.title}</p>
          )}

          {/* 進度條 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400">
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
            <Coins className="w-4 h-4 shrink-0" style={{ color: theme.price, marginBottom: 1 }} />
            <span className="font-black leading-none" style={{
              color: theme.price,
              fontSize: "clamp(18px, 5.5vw, 26px)",
              letterSpacing: "-0.02em",
            }}>
              {pool.pricePoints.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-semibold">/ 抽</span>
          </div>

          {/* 行動按鈕 */}
          <div className="flex gap-2 pt-0.5">
            <button
              className="flex-1 py-2 rounded-xl text-white text-xs font-black tracking-wide transition-all active:scale-95 hover:opacity-90"
              style={{ background: theme.btn1, boxShadow: `0 4px 14px ${theme.shadow}` }}
              onClick={goToPool}
            >
              抽 1 次
            </button>
            <button
              className="flex-1 py-2 rounded-xl text-white text-xs font-black tracking-wide transition-all active:scale-95 hover:opacity-90"
              style={{ background: theme.btn2, boxShadow: `0 4px 14px ${theme.shadow}` }}
              onClick={goToPool}
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
