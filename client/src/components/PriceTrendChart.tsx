import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatCurrency";
import { useVip } from "@/hooks/useVip";
import { VipUpgradeModal } from "@/components/VipUpgradeModal";

interface PriceTrendData {
  date: string;
  snkrdunkPrice?: number;
  snkrdunkCount?: number;
}

interface PriceTrendStats {
  snkrdunk: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    latestPrice: number;
  };
}

interface PriceTrendChartProps {
  cardName: string;
  trendData: PriceTrendData[];
  stats: PriceTrendStats;
  isLoading?: boolean;
  isSealedProduct?: boolean;
}

export function PriceTrendChart({
  cardName,
  trendData,
  stats,
  isLoading = false,
  isSealedProduct = false,
}: PriceTrendChartProps) {
  const { t } = useTranslation();
  const { isVip } = useVip();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [showVipModal, setShowVipModal] = useState(false);

  // VIP-gated time range options
  const timeRangeOptions = [
    { key: "7d" as const, label: t("cardDetail.timeRange.7days", "7D"), vipRequired: false },
    { key: "30d" as const, label: t("cardDetail.timeRange.30days", "30D"), vipRequired: false },
    { key: "90d" as const, label: t("cardDetail.timeRange.90days", "90D"), vipRequired: true },
    { key: "all" as const, label: t("cardDetail.timeRange.all", "ALL"), vipRequired: true },
  ];

  const filteredData = timeRange === "all"
    ? trendData
    : (() => {
        const now = new Date();
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return trendData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= cutoffDate;
        });
      })();

  const formatPrice = (price: number) => {
    if (price >= 1000) return `${(price / 1000).toFixed(1)}k`;
    return `${price.toFixed(0)}`;
  };

  // Format date: "2026-02-17" → "02/17"
  const formatXDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return dateStr;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0A1628] border border-[#1565C0]/60 rounded-lg p-3 shadow-xl shadow-black/50">
          <p className="text-xs text-zinc-400 mb-1.5">{data.date}</p>
          {data.snkrdunkPrice && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFD600] inline-block" />
              <p className="text-sm font-bold text-white">
                {formatCurrency(data.snkrdunkPrice)}
              </p>
            </div>
          )}
          {data.snkrdunkCount && (
            <p className="text-[10px] text-zinc-500 mt-1">
              {data.snkrdunkCount} {t("cardDetail.records", "筆成交")}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#999999' }}>
            {isSealedProduct ? t("cardDetail.sealedChartTitle", "卡盒價格趨勢") : t("cardDetail.chartTitle")}
          </p>
        </div>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#555555' }} />
        </div>
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#999999' }}>{t("cardDetail.chartTitle")}</p>
        </div>
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <p className="text-sm" style={{ color: '#555555' }}>
            {isSealedProduct
              ? t("cardDetail.noSealedTrendData", "此卡盒暫無成交記錄")
              : t("cardDetail.noPsa10Data", "此卡牌暫無 PSA 10 成交記錄")}
          </p>
          <p className="text-xs" style={{ color: '#444444' }}>
            {isSealedProduct
              ? t("cardDetail.noSealedTrendDataSub", "成交數據將在有新記錄時自動更新")
              : t("cardDetail.noPsa10DataSub", "PSA 10 成交數據將在有新記錄時自動更新")}
          </p>
        </div>
      </div>
    );
  }

  const prices = filteredData.map(d => d.snkrdunkPrice).filter(Boolean) as number[];
  const minVal = prices.length > 0 ? Math.min(...prices) : 0;
  const maxVal = prices.length > 0 ? Math.max(...prices) : 0;
  const padding = (maxVal - minVal) * 0.1 || maxVal * 0.1;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;

  return (
    <>
      <div>
        {/* Header — editorial */}
        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#999999' }}>
              {isSealedProduct ? t("cardDetail.sealedChartTitle", "卡盒價格趨勢") : t("cardDetail.chartTitle")}
            </p>
          </div>
          {/* Time Range Selector — editorial pill buttons */}
          <div className="flex items-center gap-1.5">
            {timeRangeOptions.map(({ key, label, vipRequired }) => {
              const isActive = timeRange === key;
              const isLocked = vipRequired && !isVip;
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (isLocked) {
                      setShowVipModal(true);
                      return;
                    }
                    setTimeRange(key);
                  }}
                  className="text-[9px] font-mono transition-all duration-200 flex items-center gap-0.5"
                  style={{
                    padding: '2px 7px',
                    border: `1px solid ${isActive ? 'rgba(255,255,255,0.35)' : isLocked ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '2px',
                    color: isActive ? '#FFFFFF' : isLocked ? '#FFD700' : '#555555',
                    background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                  title={isLocked ? "VIP 專屬功能" : undefined}
                >
                  {isLocked && <Lock style={{ width: '7px', height: '7px' }} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Body — minimal glow line */}
        <div className="px-4 pt-4 pb-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={filteredData}
              margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
              onMouseMove={(state: any) => {
                if (state?.activePayload?.[0]?.payload?.date) {
                  setActiveDate(state.activePayload[0].payload.date);
                }
              }}
              onMouseLeave={() => setActiveDate(null)}
            >
              <defs>
                {/* Gradient fill — soft downward fade */}
                <linearGradient id="priceGradientEditorial" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.12)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
                </linearGradient>
                {/* Glow filter for the line */}
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* No CartesianGrid — keep it clean */}
              <XAxis
                dataKey="date"
                stroke="transparent"
                tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tickFormatter={formatXDate}
              />
              <YAxis
                stroke="transparent"
                tick={false}
                tickLine={false}
                axisLine={false}
                domain={[yMin, yMax]}
                width={0}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
                isAnimationActive={false}
              />
              {activeDate && (
                <ReferenceLine
                  x={activeDate}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1}
                />
              )}
              <Area
                type="monotone"
                dataKey="snkrdunkPrice"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth={1.5}
                fill="url(#priceGradientEditorial)"
                dot={false}
                activeDot={{
                  r: 3,
                  fill: '#FFFFFF',
                  stroke: 'rgba(255,255,255,0.3)',
                  strokeWidth: 4,
                }}
                name={isSealedProduct ? t("priceTrendChart.snkrdunkBox") : t("priceTrendChart.snkrdunkPsa10")}
                isAnimationActive={true}
                animationDuration={800}
                style={{ filter: 'url(#lineGlow)' }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Stats Footer — magazine headline numbers */}
          {stats.snkrdunk.avgPrice > 0 && (
            <div className="mt-3 pt-3 grid grid-cols-4 gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { label: t("cardDetail.avgPrice", "均價"), amount: stats.snkrdunk.avgPrice },
                { label: t("cardDetail.latestPrice", "最新"), amount: stats.snkrdunk.latestPrice },
                { label: t("cardDetail.minPriceLabel", "最低"), amount: stats.snkrdunk.minPrice },
                { label: t("cardDetail.maxPriceLabel", "最高"), amount: stats.snkrdunk.maxPrice },
              ].map(({ label, amount }) => {
                const numAmount = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
                const formatted = numAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                return (
                  <div key={label} className="text-center py-1">
                    <p className="text-[8px] uppercase tracking-[0.12em] mb-1" style={{ color: '#555555' }}>{label}</p>
                    <p className="text-xs font-semibold" style={{ color: '#E5E5E5' }}>{formatted}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* VIP Upgrade Modal */}
      <VipUpgradeModal open={showVipModal} onOpenChange={setShowVipModal} />
    </>
  );
}
