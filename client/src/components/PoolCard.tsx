/**
 * PoolCard — 純前端 CSS 3D 動態卡池組件
 * 參考 Clove / DOPA! 風格：霓虹光暈背景 + 卡牌 3D 堆疊 + 資訊疊加
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

/** 依最高等級獎品決定背景光暈顏色 */
function getGlowConfig(rewardImages: RewardImage[] = []) {
  const types = rewardImages.map((r) => r.rewardType);
  if (types.includes("rainbow")) {
    return {
      glow: "radial-gradient(ellipse 80% 60% at 50% 70%, rgba(139,92,246,0.55) 0%, rgba(236,72,153,0.25) 40%, transparent 70%)",
      accent: "rgba(139,92,246,0.8)",
      ring: "hover:shadow-[0_0_32px_rgba(139,92,246,0.45)]",
      badge: "bg-gradient-to-r from-purple-500 to-pink-500",
    };
  }
  if (types.includes("milestone")) {
    return {
      glow: "radial-gradient(ellipse 80% 60% at 50% 70%, rgba(251,146,60,0.55) 0%, rgba(234,179,8,0.25) 40%, transparent 70%)",
      accent: "rgba(251,146,60,0.8)",
      ring: "hover:shadow-[0_0_32px_rgba(251,146,60,0.45)]",
      badge: "bg-gradient-to-r from-orange-500 to-yellow-500",
    };
  }
  if (types.includes("gold")) {
    return {
      glow: "radial-gradient(ellipse 80% 60% at 50% 70%, rgba(234,179,8,0.50) 0%, rgba(161,98,7,0.25) 40%, transparent 70%)",
      accent: "rgba(234,179,8,0.8)",
      ring: "hover:shadow-[0_0_32px_rgba(234,179,8,0.45)]",
      badge: "bg-gradient-to-r from-yellow-500 to-amber-600",
    };
  }
  // 預設藍色
  return {
    glow: "radial-gradient(ellipse 80% 60% at 50% 70%, rgba(59,130,246,0.45) 0%, rgba(37,99,235,0.20) 40%, transparent 70%)",
    accent: "rgba(59,130,246,0.8)",
    ring: "hover:shadow-[0_0_32px_rgba(59,130,246,0.35)]",
    badge: "bg-gradient-to-r from-blue-500 to-cyan-500",
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
        filter: `drop-shadow(0 8px 24px ${glowColor}) drop-shadow(0 2px 8px rgba(0,0,0,0.8))`,
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
  const config = getGlowConfig(rewardImages);
  const linkHref = href ?? `/pools/${pool.id}`;

  // 取最多 3 張卡牌圖片
  const [card1, card2, card3] = rewardImages;

  return (
    <Link href={linkHref}>
      <div
        className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 select-none
          border border-zinc-800 hover:border-zinc-600
          ${config.ring}
          hover:-translate-y-1`}
        style={{ background: "#0a0a0f" }}
      >
        {/* ── 封面區（16:10 比例） ── */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "16/10" }}
        >
          {/* 深色基底 */}
          <div className="absolute inset-0 bg-zinc-950" />

          {/* 霓虹光暈背景 */}
          <div
            className="absolute inset-0"
            style={{ background: config.glow }}
          />

          {/* 星點粒子感（純 CSS 偽元素替代方案：用多層 radial-gradient） */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle 1px at 20% 30%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 80% 20%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 60% 70%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 35% 80%, white 0%, transparent 100%)," +
                "radial-gradient(circle 1px at 90% 60%, white 0%, transparent 100%)",
            }}
          />

          {/* ── 卡牌 3D 堆疊 ── */}
          <div className="absolute inset-0">
            {/* 第三張（最後方，左傾） */}
            {card3 && (
              <CardImage
                src={card3.imageUrl}
                glowColor={config.accent}
                zIndex={1}
                style={{
                  width: "42%",
                  maxWidth: 140,
                  top: "8%",
                  left: "4%",
                  transform: "rotate(-14deg) scale(0.82)",
                  opacity: 0.55,
                }}
              />
            )}

            {/* 第二張（中間，輕微左傾） */}
            {card2 && (
              <CardImage
                src={card2.imageUrl}
                glowColor={config.accent}
                zIndex={2}
                style={{
                  width: "48%",
                  maxWidth: 160,
                  top: "5%",
                  left: "12%",
                  transform: "rotate(-7deg) scale(0.90)",
                  opacity: 0.80,
                }}
              />
            )}

            {/* 主卡（最前方，輕微右傾，居中偏右） */}
            {card1 && (
              <CardImage
                src={card1.imageUrl}
                glowColor={config.accent}
                zIndex={3}
                style={{
                  width: "56%",
                  maxWidth: 190,
                  top: "2%",
                  left: "30%",
                  transform: "rotate(4deg) scale(1.0)",
                  opacity: 1,
                  transition: "transform 0.35s ease",
                }}
              />
            )}

            {/* 無卡牌時的佔位視覺 */}
            {rewardImages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-2 opacity-30">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="bg-zinc-700 rounded-lg"
                      style={{
                        width: 52,
                        height: 72,
                        transform: `rotate(${(i - 1) * -8}deg) translateY(${i === 1 ? -6 : 4}px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 底部漸層遮罩（讓資訊欄更清晰） */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.4) 40%, transparent 70%)",
            }}
          />

          {/* ── 左上角狀態 Badge ── */}
          <div className="absolute top-2.5 left-2.5 z-10 flex gap-1.5">
            {showDraftBadge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-700 text-zinc-300 border border-zinc-600">
                草稿
              </span>
            )}
            {!showDraftBadge && pool.status === "active" && remaining <= 10 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${config.badge}`}
              >
                即將售罄
              </span>
            )}
          </div>

          {/* ── 右上角剩餘格數 ── */}
          <div className="absolute top-2.5 right-2.5 z-10">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-zinc-300 backdrop-blur-sm border border-zinc-700/50">
              剩 {remaining} 格
            </span>
          </div>

          {/* ── 底部資訊欄 ── */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-5">
            {/* 點數大字 */}
            <div className="flex items-baseline gap-1 mb-2">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" style={{ marginBottom: 1 }} />
              <span className="text-2xl font-extrabold text-amber-400 leading-none">
                {pool.pricePoints.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400 font-medium">點/格</span>
            </div>

            {/* 進度條 */}
            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span>已抽 {drawnCount}/{totalSlots}</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="h-1 bg-zinc-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(to right, ${config.accent}, ${config.accent.replace("0.8", "0.5")})`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── BOXIUM 品牌浮水印 ── */}
          <div className="absolute bottom-2.5 right-3 z-10">
            <span className="text-[9px] font-bold tracking-widest text-white/10 uppercase">
              BOXIUM PTCG
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PoolCard;
