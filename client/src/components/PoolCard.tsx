/**
 * PoolCard — Clove/DOPA! 1:1 還原版
 *
 * 結構：
 * ┌─────────────────────────────────┐
 * │  封面（16:9）                    │  ← 有 coverImageUrl 用圖片，否則 CSS 3D 動態封面
 * │  [標籤徽章]         [剩餘格數]   │
 * ├─────────────────────────────────┤
 * │  剩餘進度條                      │
 * │  💰 1,500 點/抽                  │
 * │  [抽 1 次]  [10 連]              │
 * └─────────────────────────────────┘
 */
import { useLocation } from "wouter";
import { Coins } from "lucide-react";

/* ─── 型別 ─── */
interface RewardImage { imageUrl: string; rewardType: string; }
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
}

/* ─── 主題色（依最高獎品等級） ─── */
function getTheme(imgs: RewardImage[]) {
  const types = imgs.map((r) => r.rewardType);
  if (types.includes("rainbow")) return {
    bg:     "linear-gradient(160deg,#0d0020 0%,#4c1d95 25%,#7c3aed 50%,#db2777 75%,#f59e0b 100%)",
    glow:   "rgba(167,139,250,0.9)",
    bar:    "linear-gradient(90deg,#7c3aed,#ec4899)",
    price:  "#7c3aed",
    btn1:   "#7c3aed",
    btn1h:  "#6d28d9",
    btn2:   "#ec4899",
    btn2h:  "#db2777",
    shadow: "rgba(124,58,237,0.25)",
  };
  if (types.includes("milestone")) return {
    bg:     "linear-gradient(160deg,#1c0700 0%,#9a3412 30%,#ea580c 60%,#fbbf24 100%)",
    glow:   "rgba(251,146,60,0.9)",
    bar:    "linear-gradient(90deg,#ea580c,#fbbf24)",
    price:  "#c2410c",
    btn1:   "#ea580c",
    btn1h:  "#c2410c",
    btn2:   "#d97706",
    btn2h:  "#b45309",
    shadow: "rgba(234,88,12,0.25)",
  };
  if (types.includes("gold")) return {
    bg:     "linear-gradient(160deg,#1c0e00 0%,#78350f 30%,#d97706 60%,#fde68a 100%)",
    glow:   "rgba(252,211,77,0.9)",
    bar:    "linear-gradient(90deg,#d97706,#fbbf24)",
    price:  "#92400e",
    btn1:   "#b45309",
    btn1h:  "#92400e",
    btn2:   "#d97706",
    btn2h:  "#b45309",
    shadow: "rgba(180,83,9,0.25)",
  };
  return {
    bg:     "linear-gradient(160deg,#020617 0%,#1e3a8a 25%,#1d4ed8 55%,#60a5fa 100%)",
    glow:   "rgba(96,165,250,0.9)",
    bar:    "linear-gradient(90deg,#1d4ed8,#7c3aed)",
    price:  "#1d4ed8",
    btn1:   "#1d4ed8",
    btn1h:  "#1e40af",
    btn2:   "#7c3aed",
    btn2h:  "#6d28d9",
    shadow: "rgba(29,78,216,0.25)",
  };
}

/* ─── CSS 3D 動態封面（備用，無封面圖時使用） ─── */
function DynamicCover({ imgs, theme }: { imgs: RewardImage[]; theme: ReturnType<typeof getTheme> }) {
  const [c1, c2, c3] = imgs;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: theme.bg }}>
      {/* 中心光暈 */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 80% 70% at 50% 55%, ${theme.glow} 0%, transparent 65%)`,
      }} />
      {/* 暗角 */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 130% 130% at 50% 50%, transparent 45%, rgba(0,0,0,0.45) 100%)",
      }} />
      {/* 光粒子 */}
      {[...Array(12)].map((_, i) => (
        <div key={i} className="absolute rounded-full animate-pulse pointer-events-none" style={{
          width:  `${2 + (i % 3) * 1.5}px`,
          height: `${2 + (i % 3) * 1.5}px`,
          background: "rgba(255,255,255,0.55)",
          top:  `${8 + (i * 7) % 78}%`,
          left: `${4 + (i * 11) % 88}%`,
          animationDelay:    `${i * 0.28}s`,
          animationDuration: `${1.6 + (i % 4) * 0.55}s`,
        }} />
      ))}

      {/* 卡牌堆疊 */}
      {imgs.length > 0 ? (
        <div className="absolute inset-0 overflow-hidden">
          {/* 左後方 */}
          {c3 && (
            <img src={c3.imageUrl} alt="" draggable={false}
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "95%", width: "auto",
                top: "2%", left: "-8%",
                transform: "rotate(-22deg)",
                filter: "drop-shadow(0 20px 28px rgba(0,0,0,0.65))",
                opacity: 0.4, zIndex: 1,
              }} />
          )}
          {/* 右後方 */}
          {c2 && (
            <img src={c2.imageUrl} alt="" draggable={false}
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "95%", width: "auto",
                top: "2%", right: "-8%",
                transform: "rotate(20deg)",
                filter: "drop-shadow(0 20px 28px rgba(0,0,0,0.65))",
                opacity: 0.55, zIndex: 2,
              }} />
          )}
          {/* 主卡（超出邊框，頂格） */}
          {c1 && (
            <img src={c1.imageUrl} alt="" draggable={false}
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "120%", width: "auto",
                top: "-10%", left: "50%",
                transform: "translateX(-50%) rotate(-5deg)",
                filter: [
                  "drop-shadow(0 30px 22px rgba(0,0,0,0.7))",
                  `drop-shadow(0 0 30px ${theme.glow})`,
                  "drop-shadow(0 5px 8px rgba(0,0,0,0.85))",
                ].join(" "),
                zIndex: 3,
              }} />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/35">
          <span className="text-5xl">🎴</span>
          <span className="text-xs font-semibold tracking-widest uppercase">Mystery Pool</span>
        </div>
      )}

      {/* 底部漸層遮罩（過渡到白色資訊欄） */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: "35%",
        background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.5) 45%, transparent 100%)",
      }} />
    </div>
  );
}

/* ─── 主組件 ─── */
export function PoolCard({ pool, showDraftBadge = false }: PoolCardProps) {
  const [, navigate] = useLocation();

  const drawn     = pool.drawnCount ?? 0;
  const total     = pool.totalSlots ?? 100;
  const remaining = Math.max(0, total - drawn);
  const progress  = Math.min(100, (drawn / Math.max(total, 1)) * 100);
  const imgs      = pool.rewardImages ?? [];
  const theme     = getTheme(imgs);
  const hasCover  = !!(pool.coverImageUrl?.trim());
  const isSoldOut = remaining <= 0;
  const almostGone = !isSoldOut && remaining <= Math.max(10, total * 0.05);

  const handleDraw = (e: React.MouseEvent, multi?: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/pools/${pool.id}${multi ? "?multi=10" : ""}`);
  };

  return (
    <div
      className="group relative bg-white rounded-2xl overflow-hidden cursor-pointer select-none"
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
        transition: "transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.28s ease",
        willChange: "transform",
      }}
      onClick={(e) => handleDraw(e)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-5px) scale(1.015)";
        el.style.boxShadow = `0 20px 48px ${theme.shadow}, 0 4px 12px rgba(0,0,0,0.06)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "";
        el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)";
      }}
    >
      {/* ══ 封面（16:9 比例） ══ */}
      <div className="relative w-full overflow-hidden" style={{ paddingBottom: "56.25%" }}>
        {hasCover ? (
          <img
            src={pool.coverImageUrl!}
            alt={pool.title ?? "卡池封面"}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <DynamicCover imgs={imgs} theme={theme} />
        )}

        {/* 左上角標籤 */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1">
          {showDraftBadge && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white bg-slate-500 shadow">草稿</span>
          )}
          {!showDraftBadge && isSoldOut && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white bg-red-500 shadow">已售罄</span>
          )}
          {!showDraftBadge && almostGone && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow"
              style={{ background: theme.btn1 }}>即將售罄</span>
          )}
          {pool.tags?.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow"
              style={{ background: tag === "新著" ? "#ef4444" : tag === "熱門" ? "#f97316" : "#7c3aed" }}>
              {tag}
            </span>
          ))}
        </div>

        {/* 右上角剩餘格數 */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold shadow"
            style={{ background: "rgba(255,255,255,0.92)", color: "#475569", backdropFilter: "blur(6px)" }}>
            剩 {remaining.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ══ 資訊欄 ══ */}
      <div className="bg-white px-3 pt-2.5 pb-3 space-y-2">
        {/* 卡池名稱 */}
        {pool.title && (
          <p className="text-xs font-bold text-slate-600 leading-tight line-clamp-1">{pool.title}</p>
        )}

        {/* 進度條 */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-slate-400">
              剩 <span className="font-semibold text-slate-500">{remaining.toLocaleString()}</span>
              <span className="text-slate-300"> / {total.toLocaleString()}</span>
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: theme.bar }} />
          </div>
        </div>

        {/* 價格 */}
        <div className="flex items-baseline gap-1">
          <Coins className="w-4 h-4 shrink-0" style={{ color: theme.price, marginBottom: 1 }} />
          <span className="font-black leading-none" style={{
            color: theme.price,
            fontSize: "clamp(18px, 5.5vw, 24px)",
            letterSpacing: "-0.02em",
          }}>
            {pool.pricePoints.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 font-semibold">/ 抽</span>
        </div>

        {/* 行動按鈕 */}
        <div className="flex gap-2 pt-0.5">
          <button
            className="flex-1 py-2.5 rounded-xl text-white text-xs font-black tracking-wide transition-all active:scale-95"
            style={{ background: theme.btn1, boxShadow: `0 4px 14px ${theme.shadow}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = theme.btn1h; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = theme.btn1; }}
            onClick={(e) => handleDraw(e)}
          >
            抽 1 次
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl text-white text-xs font-black tracking-wide transition-all active:scale-95"
            style={{ background: theme.btn2, boxShadow: `0 4px 14px ${theme.shadow}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = theme.btn2h; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = theme.btn2; }}
            onClick={(e) => handleDraw(e, true)}
          >
            10 連
          </button>
        </div>
      </div>
    </div>
  );
}

export default PoolCard;
