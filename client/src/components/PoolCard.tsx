/**
 * PoolCard v2 — 純前端 CSS 3D 動態卡池組件
 * 設計參考：Clove / DOPA! 高級盲盒平台
 * - 上半部（60%）：霓虹光暈 + 3D 卡牌堆疊 + 分類標籤
 * - 下半部（40%）：深色半透明資訊欄 + 進度條 + 黃金價格
 * - 支援手機雙列 / 桌面多欄自適應
 */
import { Link } from "wouter";
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
    coverImageUrl?: string;
  };
  /** 顯示草稿 badge（管理員列表用）*/
  showDraftBadge?: boolean;
  /** 點擊後導向的路徑，預設 /pools/:id */
  href?: string;
}

/* ── 依最高等級獎品決定視覺主題 ── */
function getTheme(rewardImages: RewardImage[] = []) {
  const types = rewardImages.map((r) => r.rewardType);

  if (types.includes("rainbow")) {
    return {
      glow: "radial-gradient(ellipse 90% 70% at 50% 80%, rgba(139,92,246,0.6) 0%, rgba(236,72,153,0.3) 45%, transparent 70%)",
      glowColor: "rgba(139,92,246,0.9)",
      gradientBar: "linear-gradient(90deg, #7c3aed, #ec4899)",
      badge: "linear-gradient(135deg, #7c3aed, #ec4899)",
      badgeText: "✦ 彩虹大賞",
      ringColor: "rgba(139,92,246,0.5)",
      borderHover: "rgba(139,92,246,0.6)",
    };
  }
  if (types.includes("milestone")) {
    return {
      glow: "radial-gradient(ellipse 90% 70% at 50% 80%, rgba(251,146,60,0.6) 0%, rgba(234,179,8,0.3) 45%, transparent 70%)",
      glowColor: "rgba(251,146,60,0.9)",
      gradientBar: "linear-gradient(90deg, #f97316, #eab308)",
      badge: "linear-gradient(135deg, #f97316, #eab308)",
      badgeText: "★ 里程碑",
      ringColor: "rgba(251,146,60,0.5)",
      borderHover: "rgba(251,146,60,0.6)",
    };
  }
  if (types.includes("gold")) {
    return {
      glow: "radial-gradient(ellipse 90% 70% at 50% 80%, rgba(234,179,8,0.55) 0%, rgba(161,98,7,0.3) 45%, transparent 70%)",
      glowColor: "rgba(234,179,8,0.9)",
      gradientBar: "linear-gradient(90deg, #eab308, #ca8a04)",
      badge: "linear-gradient(135deg, #eab308, #ca8a04)",
      badgeText: "◆ 金賞",
      ringColor: "rgba(234,179,8,0.5)",
      borderHover: "rgba(234,179,8,0.6)",
    };
  }
  // 預設藍色
  return {
    glow: "radial-gradient(ellipse 90% 70% at 50% 80%, rgba(59,130,246,0.5) 0%, rgba(99,102,241,0.25) 45%, transparent 70%)",
    glowColor: "rgba(99,102,241,0.9)",
    gradientBar: "linear-gradient(90deg, #3b82f6, #6366f1)",
    badge: "linear-gradient(135deg, #3b82f6, #6366f1)",
    badgeText: "◈ 標準",
    ringColor: "rgba(59,130,246,0.4)",
    borderHover: "rgba(99,102,241,0.5)",
  };
}

/** 單張卡牌圖片（帶光暈投影） */
function CardImage({
  src,
  style,
  glowColor,
  zIndex,
}: {
  src: string;
  style: React.CSSProperties;
  glowColor: string;
  zIndex: number;
}) {
  return (
    <img
      src={src}
      alt="card"
      draggable={false}
      style={{
        position: "absolute",
        userSelect: "none",
        pointerEvents: "none",
        filter: `drop-shadow(0 6px 20px ${glowColor}) drop-shadow(0 2px 6px rgba(0,0,0,0.9))`,
        zIndex,
        ...style,
      }}
    />
  );
}

export function PoolCard({ pool, showDraftBadge = false, href }: PoolCardProps) {
  const drawnCount = pool.drawnCount ?? 0;
  const totalSlots = pool.totalSlots ?? 100;
  const progress = Math.min(100, (drawnCount / totalSlots) * 100);
  const remaining = totalSlots - drawnCount;
  const rewardImages = pool.rewardImages ?? [];
  const theme = getTheme(rewardImages);
  const linkHref = href ?? `/pools/${pool.id}`;

  const [card1, card2, card3] = rewardImages;
  const isSoldOut = remaining <= 0;
  const isAlmostGone = !isSoldOut && remaining <= Math.max(10, totalSlots * 0.05);

  return (
    <Link href={linkHref}>
      <div
        className="group relative rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-300"
        style={{
          background: "#0a0812",
          border: `1px solid rgba(255,255,255,0.07)`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 40px ${theme.ringColor}, 0 4px 16px rgba(0,0,0,0.6)`;
          (e.currentTarget as HTMLDivElement).style.borderColor = theme.borderHover;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.5)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
        }}
      >
        {/* ══════════════════════════════════
            上半部：CSS 3D 封面（60% 高度）
        ══════════════════════════════════ */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "1/1.05" }}
        >
          {/* 深色基底 */}
          <div className="absolute inset-0" style={{ background: "#080614" }} />

          {/* 霓虹光暈背景 */}
          <div className="absolute inset-0" style={{ background: theme.glow }} />

          {/* 星點粒子感 */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "radial-gradient(circle 1.5px at 15% 20%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 75% 15%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 55% 65%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1.5px at 30% 75%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 85% 55%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 45% 35%, white 0%, transparent 100%)",
            }}
          />

          {/* ── 卡牌 3D 堆疊 ── */}
          <div className="absolute inset-0">
            {/* 第三張（最後方，左傾） */}
            {card3 && (
              <CardImage
                src={card3.imageUrl}
                glowColor={theme.glowColor}
                zIndex={1}
                style={{
                  width: "44%",
                  top: "10%",
                  left: "2%",
                  transform: "rotate(-16deg) scale(0.78)",
                  opacity: 0.45,
                }}
              />
            )}

            {/* 第二張（中間，輕微左傾） */}
            {card2 && (
              <CardImage
                src={card2.imageUrl}
                glowColor={theme.glowColor}
                zIndex={2}
                style={{
                  width: "50%",
                  top: "6%",
                  left: "10%",
                  transform: "rotate(-8deg) scale(0.88)",
                  opacity: 0.75,
                }}
              />
            )}

            {/* 主卡（最前方，輕微右傾，居中偏右） */}
            {card1 && (
              <CardImage
                src={card1.imageUrl}
                glowColor={theme.glowColor}
                zIndex={3}
                style={{
                  width: "60%",
                  top: "3%",
                  left: "28%",
                  transform: "rotate(5deg) scale(1.0)",
                  opacity: 1,
                  transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
            )}

            {/* 無卡牌時的佔位視覺 */}
            {rewardImages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-2 opacity-20">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-lg"
                      style={{
                        width: 44,
                        height: 62,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        transform: `rotate(${(i - 1) * -9}deg) translateY(${i === 1 ? -8 : 4}px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hover 時主卡微動效果（CSS group-hover） */}
            {card1 && (
              <style>{`
                .group:hover img[data-main-card] {
                  transform: rotate(5deg) scale(1.06) !important;
                }
              `}</style>
            )}
          </div>

          {/* 底部漸層遮罩（讓下半部資訊欄更清晰） */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(8,6,20,1) 0%, rgba(8,6,20,0.7) 25%, rgba(8,6,20,0.1) 55%, transparent 75%)",
            }}
          />

          {/* ── 左上角分類 Badge ── */}
          <div className="absolute top-2 left-2 z-10">
            {showDraftBadge ? (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ background: "rgba(113,113,122,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                草稿
              </span>
            ) : isSoldOut ? (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ background: "rgba(239,68,68,0.8)" }}
              >
                已售罄
              </span>
            ) : isAlmostGone ? (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ background: theme.badge }}
              >
                即將售罄
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ background: theme.badge }}
              >
                {theme.badgeText}
              </span>
            )}
          </div>

          {/* ── 右上角剩餘格數 ── */}
          <div className="absolute top-2 right-2 z-10">
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-medium"
              style={{
                background: "rgba(0,0,0,0.65)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(4px)",
              }}
            >
              剩 {remaining.toLocaleString()}
            </span>
          </div>

          {/* ── 底部資訊疊加（在封面內） ── */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-2.5 pb-2.5">
            {/* 卡池名稱 */}
            {pool.title && (
              <div
                className="text-xs font-bold text-white mb-1.5 leading-tight line-clamp-1"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
              >
                {pool.title}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════
            下半部：資訊與互動區（40% 高度）
        ══════════════════════════════════ */}
        <div
          className="px-2.5 pt-2 pb-2.5"
          style={{ background: "rgba(8,6,20,0.95)" }}
        >
          {/* 進度條 */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] text-zinc-500">
                剩餘 {remaining.toLocaleString()} / {totalSlots.toLocaleString()} 格
              </span>
              <span className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                {progress.toFixed(0)}%
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: "3px", background: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: theme.gradientBar,
                  boxShadow: `0 0 6px ${theme.ringColor}`,
                }}
              />
            </div>
          </div>

          {/* 價格 */}
          <div className="flex items-baseline gap-1">
            <Coins className="w-3 h-3 text-amber-400 shrink-0 mb-0.5" />
            <span
              className="font-black leading-none"
              style={{
                color: "#fbbf24",
                fontSize: "clamp(14px, 3.5vw, 20px)",
                textShadow: "0 0 12px rgba(251,191,36,0.4)",
              }}
            >
              {pool.pricePoints.toLocaleString()}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">/ 抽</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PoolCard;
