/**
 * PoolCard v4 — 潮牌盲盒大廳（視覺衝擊版）
 * - 卡牌區佔 70%，主卡幾乎頂邊框
 * - 強烈 drop-shadow 讓卡牌從白底猛烈跳出
 * - 高飽和電光漸層封面背景
 * - 去除生硬邊框，改用柔和大陰影
 * - 價格 text-2xl font-black 品牌藍
 * - 進度條 h-2.5 加粗
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

/* ── 高飽和電光漸層主題 ── */
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
    };
  }
  // 預設：BOXIUM 電光藍→紫
  return {
    coverBg: "linear-gradient(140deg, #1d4ed8 0%, #2563eb 35%, #7c3aed 100%)",
    glowColor: "rgba(37,99,235,0.85)",
    progressBar: "linear-gradient(90deg, #2563eb, #7c3aed)",
    badgeBg: "linear-gradient(135deg, #2563eb, #7c3aed)",
    badgeText: "◈ 標準",
    hoverBorder: "#2563eb",
    hoverShadow: "rgba(37,99,235,0.2)",
    priceColor: "#2563eb",
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
        /* 強烈立體投影：讓卡牌從白底猛烈跳出 */
        filter: [
          `drop-shadow(0 25px 15px rgba(0,0,0,0.35))`,
          `drop-shadow(0 8px 30px ${glowColor})`,
          `drop-shadow(0 2px 6px rgba(0,0,0,0.6))`,
        ].join(" "),
        zIndex,
        ...style,
      }}
    />
  );
}

export function PoolCard({ pool, showDraftBadge = false, href }: PoolCardProps) {
  const drawnCount   = pool.drawnCount ?? 0;
  const totalSlots   = pool.totalSlots ?? 100;
  const progress     = Math.min(100, (drawnCount / totalSlots) * 100);
  const remaining    = totalSlots - drawnCount;
  const rewardImages = pool.rewardImages ?? [];
  const theme        = getTheme(rewardImages);
  const linkHref     = href ?? `/pools/${pool.id}`;

  const [card1, card2, card3] = rewardImages;
  const isSoldOut    = remaining <= 0;
  const isAlmostGone = !isSoldOut && remaining <= Math.max(10, totalSlots * 0.05);

  return (
    <Link href={linkHref}>
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer select-none bg-white"
        style={{
          /* 去除生硬邊框，改用柔和大陰影 */
          boxShadow: "0 8px 30px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)",
          transition: "transform 0.38s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.3s ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(-5px) scale(1.03)";
          el.style.boxShadow = `0 20px 50px ${theme.hoverShadow}, 0 8px 20px rgba(0,0,0,0.08)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(0) scale(1)";
          el.style.boxShadow = "0 8px 30px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)";
        }}
      >
        {/* ══════════════════════════════════
            封面：高飽和電光漸層 + CSS 3D 卡牌（佔 70%）
        ══════════════════════════════════ */}
        <div
          className="relative overflow-visible"
          style={{
            /* 4:3 比例讓封面更高，給卡牌更多空間 */
            aspectRatio: "3/4",
            background: theme.coverBg,
            /* 封面底部圓角去掉，讓資訊欄緊接 */
            borderRadius: "16px 16px 0 0",
          }}
        >
          {/* 電光感噪點紋理（增加質感） */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle 2px at 12% 18%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1.5px at 82% 12%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 58% 72%, white 0%, transparent 100%)," +
                "radial-gradient(circle 2px at 25% 82%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1.5px at 90% 58%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 42% 42%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 68% 28%, white 0%, transparent 100%)",
            }}
          />

          {/* 底部白色漸層遮罩（過渡到白色資訊欄） */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: "35%",
              background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
            }}
          />

          {/* ── CSS 3D 卡牌堆疊（主卡幾乎頂邊框） ── */}
          <div className="absolute inset-0">
            {/* 第三張（最後方，左傾，半透明） */}
            {card3 && (
              <CardImage
                src={card3.imageUrl}
                glowColor={theme.glowColor}
                zIndex={1}
                style={{
                  width: "52%",
                  top: "5%",
                  left: "-4%",
                  transform: "rotate(-18deg) scale(0.75)",
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
                  width: "58%",
                  top: "3%",
                  left: "5%",
                  transform: "rotate(-9deg) scale(0.86)",
                  opacity: 0.78,
                }}
              />
            )}

            {/* 主卡（最前方，幾乎頂到邊框） */}
            {card1 && (
              <CardImage
                src={card1.imageUrl}
                glowColor={theme.glowColor}
                zIndex={3}
                style={{
                  /* 主卡放大到 72%，幾乎頂邊框 */
                  width: "72%",
                  top: "-2%",
                  left: "22%",
                  transform: "rotate(6deg) scale(1.0)",
                  opacity: 1,
                  transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
            )}

            {/* 無卡牌佔位 */}
            {rewardImages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-3 opacity-25">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl"
                      style={{
                        width: 52, height: 72,
                        background: "rgba(255,255,255,0.35)",
                        border: "1.5px solid rgba(255,255,255,0.5)",
                        transform: `rotate(${(i - 1) * -10}deg) translateY(${i === 1 ? -10 : 5}px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 左上角 Badge ── */}
          <div className="absolute top-2.5 left-2.5 z-10">
            {showDraftBadge ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-slate-400 shadow-sm">
                草稿
              </span>
            ) : isSoldOut ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-red-500 shadow-sm">
                已售罄
              </span>
            ) : isAlmostGone ? (
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
                style={{ background: theme.badgeBg }}
              >
                即將售罄
              </span>
            ) : (
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
                style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                {theme.badgeText}
              </span>
            )}
          </div>

          {/* ── 右上角剩餘格數 ── */}
          <div className="absolute top-2.5 right-2.5 z-10">
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.88)",
                color: "#475569",
                backdropFilter: "blur(6px)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              剩 {remaining.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════
            資訊欄：白底、極粗極大藍字價格、加粗進度條
        ══════════════════════════════════ */}
        <div className="bg-white px-3 pt-2 pb-3">
          {/* 卡池名稱 */}
          {pool.title && (
            <div className="text-xs font-bold text-slate-600 mb-2 leading-tight line-clamp-1">
              {pool.title}
            </div>
          )}

          {/* 進度條（加粗 h-2.5） */}
          <div className="mb-2.5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-slate-400 font-medium">
                剩 {remaining.toLocaleString()} / {totalSlots.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {progress.toFixed(0)}%
              </span>
            </div>
            {/* 加粗進度條 */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: theme.progressBar,
                  boxShadow: `0 0 6px ${theme.hoverShadow}`,
                }}
              />
            </div>
          </div>

          {/* 價格：極粗極大 */}
          <div className="flex items-baseline gap-1">
            <Coins
              className="w-4 h-4 shrink-0"
              style={{ color: theme.priceColor, marginBottom: 1 }}
            />
            <span
              className="font-black leading-none"
              style={{
                color: theme.priceColor,
                /* 手機 20px，桌面 24px */
                fontSize: "clamp(18px, 5vw, 24px)",
                letterSpacing: "-0.02em",
              }}
            >
              {pool.pricePoints.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">/ 抽</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PoolCard;
