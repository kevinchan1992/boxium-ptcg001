/**
 * PoolCard v3 — 白底日系潮牌電商風格
 * - 卡片：純白底 + 輕柔邊框 + 微陰影
 * - 封面：高飽和品牌色漸層背景 + CSS 3D 卡牌堆疊
 * - 資訊欄：白底、藍色大字價格、精緻進度條
 * - Hover：彈跳放大 + 藍色外框
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
  showDraftBadge?: boolean;
  href?: string;
}

/* ── 依獎品等級決定封面漸層主題（高飽和、活潑） ── */
function getTheme(rewardImages: RewardImage[] = []) {
  const types = rewardImages.map((r) => r.rewardType);

  if (types.includes("rainbow")) {
    return {
      // 彩虹：紫→粉→藍 活潑漸層
      coverBg: "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)",
      glowColor: "rgba(139,92,246,0.7)",
      progressBar: "linear-gradient(90deg, #7c3aed, #ec4899)",
      badgeBg: "linear-gradient(135deg, #7c3aed, #ec4899)",
      badgeText: "✦ 彩虹大賞",
      hoverBorder: "#7c3aed",
      hoverShadow: "rgba(124,58,237,0.25)",
    };
  }
  if (types.includes("milestone")) {
    return {
      // 里程碑：橙→黃 暖色漸層
      coverBg: "linear-gradient(135deg, #f97316 0%, #fbbf24 50%, #f59e0b 100%)",
      glowColor: "rgba(251,146,60,0.7)",
      progressBar: "linear-gradient(90deg, #f97316, #fbbf24)",
      badgeBg: "linear-gradient(135deg, #f97316, #fbbf24)",
      badgeText: "★ 里程碑",
      hoverBorder: "#f97316",
      hoverShadow: "rgba(249,115,22,0.25)",
    };
  }
  if (types.includes("gold")) {
    return {
      // 金賞：金→琥珀
      coverBg: "linear-gradient(135deg, #eab308 0%, #ca8a04 50%, #a16207 100%)",
      glowColor: "rgba(234,179,8,0.7)",
      progressBar: "linear-gradient(90deg, #eab308, #ca8a04)",
      badgeBg: "linear-gradient(135deg, #eab308, #ca8a04)",
      badgeText: "◆ 金賞",
      hoverBorder: "#eab308",
      hoverShadow: "rgba(234,179,8,0.25)",
    };
  }
  // 預設：BOXIUM 品牌藍
  return {
    coverBg: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 40%, #06b6d4 100%)",
    glowColor: "rgba(37,99,235,0.7)",
    progressBar: "linear-gradient(90deg, #2563eb, #06b6d4)",
    badgeBg: "linear-gradient(135deg, #2563eb, #06b6d4)",
    badgeText: "◈ 標準",
    hoverBorder: "#2563eb",
    hoverShadow: "rgba(37,99,235,0.2)",
  };
}

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
        filter: `drop-shadow(0 8px 24px ${glowColor}) drop-shadow(0 2px 8px rgba(0,0,0,0.5))`,
        zIndex,
        ...style,
      }}
    />
  );
}

export function PoolCard({ pool, showDraftBadge = false, href }: PoolCardProps) {
  const drawnCount  = pool.drawnCount ?? 0;
  const totalSlots  = pool.totalSlots ?? 100;
  const progress    = Math.min(100, (drawnCount / totalSlots) * 100);
  const remaining   = totalSlots - drawnCount;
  const rewardImages = pool.rewardImages ?? [];
  const theme       = getTheme(rewardImages);
  const linkHref    = href ?? `/pools/${pool.id}`;

  const [card1, card2, card3] = rewardImages;
  const isSoldOut    = remaining <= 0;
  const isAlmostGone = !isSoldOut && remaining <= Math.max(10, totalSlots * 0.05);

  return (
    <Link href={linkHref}>
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer select-none bg-white"
        style={{
          border: "1.5px solid #f1f5f9",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          transition: "transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.35s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(-4px) scale(1.025)";
          el.style.boxShadow = `0 16px 40px ${theme.hoverShadow}, 0 4px 12px rgba(0,0,0,0.08)`;
          el.style.borderColor = theme.hoverBorder;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(0) scale(1)";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";
          el.style.borderColor = "#f1f5f9";
        }}
      >
        {/* ══════════════════════════════════
            封面：高飽和品牌色漸層 + CSS 3D 卡牌
        ══════════════════════════════════ */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "1/1", background: theme.coverBg }}
        >
          {/* 白色粒子光點（增加質感） */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle 2px at 15% 20%, rgba(255,255,255,0.9) 0%, transparent 100%)," +
                "radial-gradient(circle 1.5px at 78% 15%, rgba(255,255,255,0.8) 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 55% 68%, rgba(255,255,255,0.7) 0%, transparent 100%)," +
                "radial-gradient(circle 2px at 30% 78%, rgba(255,255,255,0.9) 0%, transparent 100%)," +
                "radial-gradient(circle 1.5px at 88% 55%, rgba(255,255,255,0.8) 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 45% 38%, rgba(255,255,255,0.6) 0%, transparent 100%)",
            }}
          />

          {/* 底部白色漸層遮罩（過渡到白色卡片底部） */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.15) 30%, transparent 60%)",
            }}
          />

          {/* ── CSS 3D 卡牌堆疊 ── */}
          <div className="absolute inset-0">
            {card3 && (
              <CardImage src={card3.imageUrl} glowColor={theme.glowColor} zIndex={1}
                style={{ width: "44%", top: "8%", left: "2%", transform: "rotate(-16deg) scale(0.78)", opacity: 0.5 }}
              />
            )}
            {card2 && (
              <CardImage src={card2.imageUrl} glowColor={theme.glowColor} zIndex={2}
                style={{ width: "50%", top: "5%", left: "10%", transform: "rotate(-8deg) scale(0.88)", opacity: 0.8 }}
              />
            )}
            {card1 && (
              <CardImage src={card1.imageUrl} glowColor={theme.glowColor} zIndex={3}
                style={{
                  width: "60%", top: "2%", left: "28%",
                  transform: "rotate(5deg) scale(1.0)", opacity: 1,
                  transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
            )}

            {/* 無卡牌佔位 */}
            {rewardImages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-2 opacity-30">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-lg"
                      style={{
                        width: 44, height: 62,
                        background: "rgba(255,255,255,0.4)",
                        border: "1px solid rgba(255,255,255,0.5)",
                        transform: `rotate(${(i - 1) * -9}deg) translateY(${i === 1 ? -8 : 4}px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 左上角 Badge ── */}
          <div className="absolute top-2 left-2 z-10">
            {showDraftBadge ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-slate-400">
                草稿
              </span>
            ) : isSoldOut ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-red-500">
                已售罄
              </span>
            ) : isAlmostGone ? (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ background: theme.badgeBg }}
              >
                即將售罄
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ background: theme.badgeBg }}
              >
                {theme.badgeText}
              </span>
            )}
          </div>

          {/* ── 右上角剩餘格數 ── */}
          <div className="absolute top-2 right-2 z-10">
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.85)",
                color: "#475569",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(255,255,255,0.6)",
              }}
            >
              剩 {remaining.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════
            資訊欄：白底、藍色價格、精緻進度條
        ══════════════════════════════════ */}
        <div className="bg-white px-3 pt-2.5 pb-3">
          {/* 卡池名稱 */}
          {pool.title && (
            <div className="text-xs font-bold text-slate-700 mb-2 leading-tight line-clamp-1">
              {pool.title}
            </div>
          )}

          {/* 進度條 */}
          <div className="mb-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] text-slate-400 font-medium">
                剩餘 {remaining.toLocaleString()} / {totalSlots.toLocaleString()}
              </span>
              <span className="text-[9px] font-bold text-slate-400">
                {progress.toFixed(0)}%
              </span>
            </div>
            {/* 進度條本體：淺灰底 + 品牌色進度 */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: theme.progressBar,
                  boxShadow: `0 0 4px ${theme.hoverShadow}`,
                }}
              />
            </div>
          </div>

          {/* 價格：品牌藍大字 */}
          <div className="flex items-baseline gap-1">
            <Coins className="w-3.5 h-3.5 text-blue-500 shrink-0 mb-0.5" />
            <span
              className="font-black leading-none"
              style={{
                color: "#2563EB",
                fontSize: "clamp(16px, 4vw, 22px)",
              }}
            >
              {pool.pricePoints.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">/ 抽</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PoolCard;
