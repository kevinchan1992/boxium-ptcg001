/**
 * PoolCard — Clove/DOPA! 風格大橫幅卡池卡片
 * - 上半部：16:9 大橫幅封面（有 coverImageUrl 用圖，無則用 CSS 3D 備用）
 * - 下半部：點數價格 + 進度條 + 抽1次/10連 按鈕
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
  if (types.includes("rainbow")) {
    return {
      coverBg: "linear-gradient(140deg, #6d28d9 0%, #ec4899 45%, #2563eb 100%)",
      glowColor: "rgba(139,92,246,0.85)",
      progressBar: "linear-gradient(90deg, #7c3aed, #ec4899)",
      badgeBg: "linear-gradient(135deg, #7c3aed, #ec4899)",
      badgeText: "✦ 彩虹大賞",
      hoverBorder: "#7c3aed",
      hoverShadow: "rgba(124,58,237,0.22)",
      priceColor: "#7c3aed",
      btnDraw: "linear-gradient(135deg,#7c3aed,#ec4899)",
      btnMulti: "linear-gradient(135deg,#ec4899,#f59e0b)",
    };
  }
  if (types.includes("milestone")) {
    return {
      coverBg: "linear-gradient(140deg, #ea580c 0%, #fbbf24 50%, #f97316 100%)",
      glowColor: "rgba(251,146,60,0.85)",
      progressBar: "linear-gradient(90deg, #ea580c, #fbbf24)",
      badgeBg: "linear-gradient(135deg, #ea580c, #fbbf24)",
      badgeText: "★ 里程碑",
      hoverBorder: "#f97316",
      hoverShadow: "rgba(249,115,22,0.22)",
      priceColor: "#ea580c",
      btnDraw: "linear-gradient(135deg,#ea580c,#f97316)",
      btnMulti: "linear-gradient(135deg,#d97706,#b45309)",
    };
  }
  if (types.includes("gold")) {
    return {
      coverBg: "linear-gradient(140deg, #b45309 0%, #fbbf24 50%, #d97706 100%)",
      glowColor: "rgba(234,179,8,0.85)",
      progressBar: "linear-gradient(90deg, #d97706, #fbbf24)",
      badgeBg: "linear-gradient(135deg, #d97706, #fbbf24)",
      badgeText: "◆ 金賞",
      hoverBorder: "#d97706",
      hoverShadow: "rgba(217,119,6,0.22)",
      priceColor: "#b45309",
      btnDraw: "linear-gradient(135deg,#d97706,#fbbf24)",
      btnMulti: "linear-gradient(135deg,#b45309,#92400e)",
    };
  }
  return {
    coverBg: "linear-gradient(140deg, #1d4ed8 0%, #2563eb 35%, #7c3aed 100%)",
    glowColor: "rgba(37,99,235,0.85)",
    progressBar: "linear-gradient(90deg, #2563eb, #7c3aed)",
    badgeBg: "linear-gradient(135deg, #2563eb, #7c3aed)",
    badgeText: "◈ 標準",
    hoverBorder: "#2563eb",
    hoverShadow: "rgba(37,99,235,0.2)",
    priceColor: "#2563eb",
    btnDraw: "linear-gradient(135deg,#1d4ed8,#2563eb)",
    btnMulti: "linear-gradient(135deg,#7c3aed,#6d28d9)",
  };
}

/* ── CSS 3D 備用封面（無 coverImageUrl 時使用） ── */
function CSS3DCover({ rewardImages, theme }: { rewardImages: RewardImage[]; theme: ReturnType<typeof getTheme> }) {
  const [card1, card2, card3] = rewardImages;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: theme.coverBg }}>
      {/* 光暈 */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${theme.glowColor} 0%, transparent 70%)` }} />
      {/* 粒子 */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="absolute rounded-full animate-pulse" style={{
          width: `${3 + (i % 3) * 2}px`, height: `${3 + (i % 3) * 2}px`,
          background: "rgba(255,255,255,0.5)",
          top: `${15 + (i * 13) % 65}%`, left: `${8 + (i * 17) % 80}%`,
          animationDelay: `${i * 0.5}s`, animationDuration: `${2 + (i % 2)}s`,
        }} />
      ))}
      {/* 3D 卡牌 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {rewardImages.length > 0 ? (
          <div className="relative" style={{ width: "60%", aspectRatio: "2/3" }}>
            {card3 && (
              <img src={card3.imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain rounded-lg"
                style={{ transform: "rotate(-14deg) translate(-20%, 6%) scale(0.8)", filter: `drop-shadow(0 16px 20px rgba(0,0,0,0.5))`, opacity: 0.55, zIndex: 1 }} />
            )}
            {card2 && (
              <img src={card2.imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain rounded-lg"
                style={{ transform: "rotate(10deg) translate(20%, 6%) scale(0.82)", filter: `drop-shadow(0 16px 20px rgba(0,0,0,0.5))`, opacity: 0.75, zIndex: 2 }} />
            )}
            {card1 && (
              <img src={card1.imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain rounded-lg"
                style={{ transform: "rotate(-3deg) scale(1.06)", filter: `drop-shadow(0 22px 28px rgba(0,0,0,0.6)) drop-shadow(0 0 20px ${theme.glowColor})`, zIndex: 3 }} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/50">
            <div className="text-5xl">🎴</div>
            <span className="text-xs font-medium">神秘卡池</span>
          </div>
        )}
      </div>
      {/* 底部遮罩 */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.35), transparent)" }} />
    </div>
  );
}

export function PoolCard({ pool, showDraftBadge = false, href }: PoolCardProps) {
  const [, navigate] = useLocation();
  const drawnCount   = pool.drawnCount ?? 0;
  const totalSlots   = pool.totalSlots ?? 100;
  const progress     = Math.min(100, (drawnCount / totalSlots) * 100);
  const remaining    = totalSlots - drawnCount;
  const rewardImages = pool.rewardImages ?? [];
  const theme        = getTheme(rewardImages);
  const linkHref     = href ?? `/pools/${pool.id}`;
  const hasCover     = !!(pool.coverImageUrl && pool.coverImageUrl.trim());
  const isSoldOut    = remaining <= 0;
  const isAlmostGone = !isSoldOut && remaining <= Math.max(10, totalSlots * 0.05);

  const handleDrawBtn = (e: React.MouseEvent, count: 1 | 10) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/pools/${pool.id}`);
  };

  return (
    <Link href={linkHref}>
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer select-none bg-white"
        style={{
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          transition: "transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.3s ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(-4px) scale(1.02)";
          el.style.boxShadow = `0 16px 40px rgba(0,0,0,0.14), 0 0 0 2px ${theme.hoverBorder}50`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "";
          el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
        }}
      >
        {/* ══ 封面區（16:9） ══ */}
        <div className="relative w-full overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          {hasCover ? (
            <img
              src={pool.coverImageUrl!}
              alt={pool.title ?? "卡池封面"}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <CSS3DCover rewardImages={rewardImages} theme={theme} />
          )}

          {/* 狀態 Badge */}
          <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
            {showDraftBadge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-slate-400">草稿</span>
            )}
            {!showDraftBadge && isSoldOut && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-red-500">已售罄</span>
            )}
            {!showDraftBadge && isAlmostGone && !isSoldOut && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: theme.badgeBg }}>即將售罄</span>
            )}
            {pool.tags?.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                style={{ background: tag === "新著" ? "#ef4444" : tag === "熱門" ? "#f97316" : "#6d28d9" }}>
                {tag}
              </span>
            ))}
          </div>

          {/* 右上角剩餘 */}
          <div className="absolute top-2 right-2 z-10">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "rgba(255,255,255,0.88)", color: "#475569", backdropFilter: "blur(6px)" }}>
              剩 {remaining.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ══ 資訊欄 ══ */}
        <div className="bg-white px-2.5 pt-2 pb-2.5 md:px-3 md:pt-2.5 md:pb-3 space-y-2">
          {/* 進度條 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400">
                剩 <span className="text-slate-600 font-semibold">{remaining.toLocaleString()}</span> / {totalSlots.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">{(100 - progress).toFixed(0)}% 剩餘</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: theme.progressBar }} />
            </div>
          </div>

          {/* 價格 */}
          <div className="flex items-baseline gap-1">
            <Coins className="w-3.5 h-3.5 shrink-0" style={{ color: theme.priceColor, marginBottom: 1 }} />
            <span className="font-black leading-none" style={{ color: theme.priceColor, fontSize: "clamp(16px, 4.5vw, 22px)", letterSpacing: "-0.02em" }}>
              {pool.pricePoints.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">/ 抽</span>
          </div>

          {/* 行動按鈕 */}
          <div className="flex gap-1.5">
            <button
              className="flex-1 py-1.5 md:py-2 rounded-xl text-white text-xs md:text-sm font-bold transition-all active:scale-95 hover:opacity-90"
              style={{ background: theme.btnDraw, boxShadow: `0 3px 10px ${theme.hoverShadow}` }}
              onClick={(e) => handleDrawBtn(e, 1)}
            >
              抽 1 次
            </button>
            <button
              className="flex-1 py-1.5 md:py-2 rounded-xl text-white text-xs md:text-sm font-bold transition-all active:scale-95 hover:opacity-90"
              style={{ background: theme.btnMulti, boxShadow: `0 3px 10px ${theme.hoverShadow}` }}
              onClick={(e) => handleDrawBtn(e, 10)}
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
