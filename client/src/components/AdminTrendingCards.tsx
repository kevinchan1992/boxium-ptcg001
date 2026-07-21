import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, Clock, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatHKLocale } from "@/lib/formatDate";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getProxiedImageUrl } from "@/lib/utils";
import { LazyImage } from "@/components/LazyImage";

const POKEMON_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif";
const ONEPIECE_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif";
const YUGIOH_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp";

const RANK_CONFIG: Record<number, { bg: string; text: string; border: string; label: string }> = {
  1: { bg: "linear-gradient(135deg,#f5c518,#c8860a)", text: "#5a3a00", border: "rgba(248,197,24,0.7)", label: "1" },
  2: { bg: "linear-gradient(135deg,#e8e8e8,#a0a0a0)", text: "#3a3a3a", border: "rgba(192,192,192,0.7)", label: "2" },
  3: { bg: "linear-gradient(135deg,#e8a87c,#a0520a)", text: "#fff", border: "rgba(205,127,50,0.7)", label: "3" },
  4: { bg: "linear-gradient(135deg,#4a5568,#2d3748)", text: "#e2e8f0", border: "rgba(74,85,104,0.5)", label: "4" },
  5: { bg: "linear-gradient(135deg,#4a5568,#2d3748)", text: "#e2e8f0", border: "rgba(74,85,104,0.5)", label: "5" },
};

// 計算下次更新時間（每日 06:00 HKT）
function getNextUpdateTime(): string {
  const now = new Date();
  const hktOffset = 8 * 60;
  const nowHKT = new Date(now.getTime() + (hktOffset - now.getTimezoneOffset()) * 60000);
  let nextUpdate = new Date(nowHKT);
  nextUpdate.setHours(6, 0, 0, 0);
  if (nowHKT.getHours() >= 6) nextUpdate.setDate(nextUpdate.getDate() + 1);
  return formatHKLocale(nextUpdate, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// 單個遊戲的 Top 5 卡牌面板
function GameTrendingPanel({
  gameId,
  logoUrl,
  logoAlt,
  accentColor,
  badgeBg,
  onRefreshAll,
  isRefreshing,
}: {
  gameId: number;
  logoUrl: string;
  logoAlt: string;
  accentColor: string;
  badgeBg: string;
  onRefreshAll: () => void;
  isRefreshing: boolean;
}) {
  const { data: cards = [], isLoading, refetch } = trpc.cards.getTrending.useQuery({ limit: 5, gameId });

  // 取最後計算時間（從第一張卡牌的 calculatedAt 欄位）
  const lastCalcTime = (cards as any[])[0]?.calculatedAt
    ? formatHKLocale(new Date((cards as any[])[0].calculatedAt), {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          {/* Logo + 分隔線 */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-5 w-[3px] rounded-full flex-shrink-0" style={{ background: accentColor }} />
            <img src={logoUrl} alt={logoAlt} className="h-8 sm:h-10 w-auto object-contain flex-shrink-0" loading="lazy" />
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accentColor}40, transparent)` }} />
          </div>
          {/* 刷新按鈕 */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { onRefreshAll(); setTimeout(() => refetch(), 1500); }}
            disabled={isRefreshing}
            className="border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-900 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "計算中..." : "重新計算"}
          </Button>
        </div>

        {/* 時間資訊 */}
        <div className="flex flex-wrap gap-3 mt-2">
          {lastCalcTime && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>上次計算：{lastCalcTime}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            <span>下次更新：{getNextUpdateTime()}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: accentColor }} />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            暫無快取數據，請點擊「重新計算」
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {cards.map((card: any, index: number) => {
              const rankNum = card.rank ?? (index + 1);
              const rc = RANK_CONFIG[rankNum] || RANK_CONFIG[5];
              const priceChange = card.priceChange ?? 0;
              return (
                <div key={card.id} className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:border-gray-500 transition-colors">
                  {/* 卡牌圖片 */}
                  <div className="aspect-[2.5/3.5] relative overflow-hidden bg-gray-700">
                    {card.imageUrl ? (
                      <LazyImage src={getProxiedImageUrl(card.imageUrl) ?? ""} alt={card.name ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">無圖片</div>
                    )}
                    {/* 排名徽章 */}
                    <div
                      className="absolute top-1.5 left-1.5 flex items-center justify-center rounded-full font-black shadow-lg select-none"
                      style={{
                        background: rc.bg, color: rc.text, border: `1.5px solid ${rc.border}`,
                        width: 22, height: 22, fontSize: 11, lineHeight: 1,
                      }}
                    >
                      {rc.label}
                    </div>
                    {/* 漲幅徽章 */}
                    <div
                      className="absolute top-1.5 right-1.5 text-slate-900 font-bold rounded text-[10px] px-1 py-0.5 shadow"
                      style={{ background: badgeBg }}
                    >
                      {card.priceChangeFormatted}
                    </div>
                  </div>

                  {/* 卡牌資訊 */}
                  <div className="p-2 space-y-1">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-900 line-clamp-2 leading-tight">
                      {card.name}
                    </p>
                    {card.nameJa && (
                      <p className="text-[9px] text-slate-500 line-clamp-1">{card.nameJa}</p>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <p className="text-xs font-bold" style={{ color: accentColor === "#06038d" ? "#818cf8" : "#f87171" }}>
                          HK${card.currentPrice?.toLocaleString()}
                        </p>
                        <p className="text-[8px] text-gray-500">PSA10 參考價</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 border-0 font-semibold ${priceChange >= 0 ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}
                      >
                        {priceChange >= 0 ? "↑" : "↓"} {Math.abs(priceChange).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminTrendingCards() {
  const { t } = useTranslation();
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateMutation = trpc.admin.calculateTrendingCards.useMutation({
    onSuccess: () => {
      toast.success(t("admin.trendingCards.calculateSuccess"));
      setIsCalculating(false);
    },
    onError: (error) => {
      toast.error(`${t("admin.trendingCards.calculateError")}: ${error.message}`);
      setIsCalculating(false);
    },
  });

  const handleCalculate = () => {
    setIsCalculating(true);
    calculateMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* 頁面標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
            {t("admin.trendingCards.title")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t("admin.trendingCards.description")} — 每日 06:00 HKT 自動更新
          </p>
        </div>
        {/* 全局重新計算按鈕 */}
        <Button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="bg-orange-600 hover:bg-orange-700 text-slate-900"
          size="sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCalculating ? "animate-spin" : ""}`} />
          {isCalculating ? t("admin.trendingCards.calculating") : "全部重新計算"}
        </Button>
      </div>

      {/* Pokémon 面板 */}
      <GameTrendingPanel
        gameId={1}
        logoUrl={POKEMON_LOGO}
        logoAlt="Pokémon TCG"
        accentColor="#06038d"
        badgeBg="linear-gradient(135deg,#e63946,#c1121f)"
        onRefreshAll={handleCalculate}
        isRefreshing={isCalculating}
      />

      {/* One Piece 面板 */}
      <GameTrendingPanel
        gameId={2}
        logoUrl={ONEPIECE_LOGO}
        logoAlt="One Piece Card Game"
        accentColor="#dc2626"
        badgeBg="linear-gradient(135deg,#dc2626,#991b1b)"
        onRefreshAll={handleCalculate}
        isRefreshing={isCalculating}
      />

      {/* Yu-Gi-Oh! 面板 */}
      <GameTrendingPanel
        gameId={3}
        logoUrl={YUGIOH_LOGO}
        logoAlt="Yu-Gi-Oh! TCG"
        accentColor="#7c3aed"
        badgeBg="linear-gradient(135deg,#7c3aed,#5b21b6)"
        onRefreshAll={handleCalculate}
        isRefreshing={isCalculating}
      />
    </div>
  );
}
