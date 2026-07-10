/**
 * PoolCard — Editorial Premium Style
 *
 * 設計語言：高級日系 / 歐美時尚雜誌感
 * - 純白底色，無邊框，大範圍微擴散陰影
 * - 封面圖滿版頂格，圓角 rounded-xl 契合
 * - 深色系按鈕（slate-900 → brand-blue hover）
 * - 進度條 h-1.5，品牌藍填充
 * - 無高飽和度色彩（消滅紫色/粉紅）
 */
import { useLocation } from "wouter";
import { CardImage } from "@/components/CardImage";

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

/* ─── CSS 動態封面（無封面圖時使用） ─── */
function DynamicCover({ imgs }: { imgs: RewardImage[] }) {
  const [c1, c2, c3] = imgs;
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: "linear-gradient(155deg, #06038D 0%, #1a1a6e 35%, #0d0d4a 65%, #030220 100%)",
      }}
    >
      {/* 中心光暈 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(99,102,241,0.35) 0%, transparent 70%)",
        }}
      />
      {/* 細膩光粒子 */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-pulse pointer-events-none"
          style={{
            width: `${1.5 + (i % 3)}px`,
            height: `${1.5 + (i % 3)}px`,
            background: "rgba(255,255,255,0.4)",
            top: `${10 + (i * 11) % 75}%`,
            left: `${5 + (i * 13) % 85}%`,
            animationDelay: `${i * 0.35}s`,
            animationDuration: `${2 + (i % 3) * 0.6}s`,
          }}
        />
      ))}

      {/* 卡牌堆疊 */}
      {imgs.length > 0 ? (
        <div className="absolute inset-0 overflow-hidden">
          {c3 && (
            <CardImage
              src={c3.imageUrl}
              alt=""
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "88%", width: "auto",
                top: "6%", left: "-6%",
                transform: "rotate(-20deg)",
                filter: "drop-shadow(0 16px 24px rgba(0,0,0,0.6))",
                opacity: 0.35, zIndex: 1,
              }}
            />
          )}
          {c2 && (
            <CardImage
              src={c2.imageUrl}
              alt=""
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "88%", width: "auto",
                top: "6%", right: "-6%",
                transform: "rotate(18deg)",
                filter: "drop-shadow(0 16px 24px rgba(0,0,0,0.6))",
                opacity: 0.45, zIndex: 2,
              }}
            />
          )}
          {c1 && (
            <CardImage
              src={c1.imageUrl}
              alt=""
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "115%", width: "auto",
                top: "-8%", left: "50%",
                transform: "translateX(-50%) rotate(-4deg)",
                filter: [
                  "drop-shadow(0 24px 20px rgba(0,0,0,0.65))",
                  "drop-shadow(0 0 24px rgba(99,102,241,0.5))",
                ].join(" "),
                zIndex: 3,
              }}
            />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/30">
          <span className="text-4xl font-black tracking-widest text-white/20">BOXIUM</span>
          <span className="text-[10px] font-semibold tracking-[0.3em] uppercase text-white/25">Mystery Pool</span>
        </div>
      )}

      {/* 底部漸層遮罩 → 過渡到白色資訊欄 */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "30%",
          background:
            "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
        }}
      />
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
      className="group relative bg-white rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-300 hover:-translate-y-1"
      style={{
        boxShadow: "0 20px 50px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 28px 60px rgba(6,3,141,0.08), 0 8px 20px rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 20px 50px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)";
      }}
      onClick={(e) => handleDraw(e)}
    >
      {/* ══ 封面（16:9 比例，滿版頂格） ══ */}
      <div className="relative w-full overflow-hidden" style={{ paddingBottom: "56.25%" }}>
        {hasCover ? (
          <img
            src={pool.coverImageUrl!}
            alt={pool.title ?? "卡池封面"}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <DynamicCover imgs={imgs} />
        )}

        {/* 左上角狀態標籤 */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
          {showDraftBadge && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-white bg-slate-600 rounded-sm uppercase">
              草稿
            </span>
          )}
          {!showDraftBadge && isSoldOut && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-white bg-slate-800 rounded-sm uppercase">
              Sold Out
            </span>
          )}
          {!showDraftBadge && almostGone && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-white rounded-sm uppercase"
              style={{ background: "#06038D" }}>
              即將售罄
            </span>
          )}
          {pool.tags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-white rounded-sm"
              style={{ background: "#06038D" }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 右上角剩餘格數 */}
        <div className="absolute top-3 right-3 z-10">
          <span
            className="px-2 py-0.5 text-[9px] font-medium text-slate-600 rounded-sm"
            style={{
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(8px)",
              letterSpacing: "0.04em",
            }}
          >
            剩 {remaining.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ══ 資訊欄 ══ */}
      <div className="bg-white px-4 pt-3.5 pb-4 space-y-3">

        {/* 卡池名稱 */}
        {pool.title && (
          <h3 className="text-base font-bold tracking-wide text-slate-800 leading-snug line-clamp-1">
            {pool.title}
          </h3>
        )}

        {/* 進度條 */}
        <div className="space-y-1.5">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: isSoldOut ? "#94a3b8" : "#06038D",
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-light tracking-wide">
              {remaining.toLocaleString()} / {total.toLocaleString()} Left
            </span>
            <span className="text-[10px] text-slate-400 font-light">
              {Math.round(progress)}% 已抽
            </span>
          </div>
        </div>

        {/* 價格列 */}
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-slate-900 leading-none tracking-tight">
            {pool.pricePoints.toLocaleString()}
          </span>
          <span className="text-[10px] font-light text-slate-400 tracking-wide">pts</span>
          <span className="text-xs font-light text-slate-400 ml-0.5">/ 抽</span>
        </div>

        {/* 行動按鈕 — 彩虹流動漸層動畫 */}
        <div className="flex gap-2 pt-0.5">
          <button
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-sm text-xs font-medium tracking-wider transition-all duration-200 active:scale-95 hover:bg-[#06038D]"
            onClick={(e) => handleDraw(e)}
          >
            抽 1 次
          </button>
          <button
            className="flex-1 py-2.5 text-white rounded-sm text-xs font-bold tracking-wider active:scale-95 animate-rainbow-shift"
            style={{
              background:
                "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #06038D, #7c3aed, #ec4899)",
              backgroundSize: "300% 100%",
              animationDelay: "0.5s",
            }}
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
