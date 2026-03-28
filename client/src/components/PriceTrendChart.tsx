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
import { Loader2, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatCurrency";

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
}

export function PriceTrendChart({
  cardName,
  trendData,
  stats,
  isLoading = false,
}: PriceTrendChartProps) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [activeDate, setActiveDate] = useState<string | null>(null);

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

  const timeRangeOptions = [
    { key: "7d" as const, label: t("cardDetail.timeRange.7days") },
    { key: "30d" as const, label: t("cardDetail.timeRange.30days") },
    { key: "90d" as const, label: t("cardDetail.timeRange.90days") },
    { key: "all" as const, label: t("cardDetail.timeRange.all") },
  ];

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden border border-zinc-800">
        <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-[#FFD600] inline-block" />
            <span className="text-sm font-semibold text-white">{t("cardDetail.chartTitle")}</span>
          </div>
        </div>
        <div className="flex items-center justify-center h-64 bg-zinc-900/30">
          <Loader2 className="w-6 h-6 animate-spin text-[#FFD600]" />
        </div>
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden border border-zinc-800">
        <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-[#FFD600] inline-block" />
            <span className="text-sm font-semibold text-white">{t("cardDetail.chartTitle")}</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-48 bg-zinc-900/30 gap-3">
          <TrendingUp className="w-10 h-10 text-zinc-700" />
          <p className="text-zinc-400 text-sm font-medium">{t("cardDetail.noPsa10Data", "此卡牌暫無 PSA 10 成交記錄")}</p>
          <p className="text-zinc-600 text-xs">{t("cardDetail.noPsa10DataSub", "PSA 10 成交數據將在有新記錄時自動更新")}</p>
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
    <div className="rounded-xl overflow-hidden border border-zinc-800">
      {/* Header */}
      <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="w-1 h-4 rounded-full bg-[#FFD600] inline-block mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-white">{t("cardDetail.chartTitle")}</h3>
              <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{cardName}</p>
            </div>
          </div>
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-zinc-800/80 rounded-lg p-1">
            {timeRangeOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  timeRange === key
                    ? "bg-[#1565C0] text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Body */}
      <div className="bg-[#0A1628]/60 p-4">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
            data={filteredData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            onMouseMove={(state: any) => {
              if (state?.activePayload?.[0]?.payload?.date) {
                setActiveDate(state.activePayload[0].payload.date);
              }
            }}
            onMouseLeave={() => setActiveDate(null)}
          >
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFD600" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#FFD600" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2a3a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#374151"
              tick={{ fill: "#6B7280", fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: "#1e2a3a" }}
              interval="preserveStartEnd"
              tickFormatter={formatXDate}
            />
            <YAxis
              stroke="#374151"
              tick={{ fill: "#6B7280", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatPrice}
              domain={[yMin, yMax]}
              width={48}
              tickCount={5}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "#FFD600", strokeWidth: 1, strokeDasharray: "4 4" }}
              isAnimationActive={false}
            />
            {activeDate && (
              <ReferenceLine
                x={activeDate}
                stroke="#FFD600"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
            )}
            <Area
              type="monotone"
              dataKey="snkrdunkPrice"
              stroke="#FFD600"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#FFD600",
                stroke: "#0A1628",
                strokeWidth: 2,
              }}
              name="SNKRDUNK PSA 10"
              isAnimationActive={true}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Stats Footer */}
        {stats.snkrdunk.avgPrice > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800/60 grid grid-cols-4 gap-1">
            {[
              { label: t("cardDetail.avgPrice", "均價"), amount: stats.snkrdunk.avgPrice, color: "text-[#FFD600]" },
              { label: t("cardDetail.latestPrice", "最新"), amount: stats.snkrdunk.latestPrice, color: "text-white" },
              { label: t("cardDetail.minPriceLabel", "最低"), amount: stats.snkrdunk.minPrice, color: "text-green-400" },
              { label: t("cardDetail.maxPriceLabel", "最高"), amount: stats.snkrdunk.maxPrice, color: "text-red-400" },
            ].map(({ label, amount, color }) => {
              const numAmount = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
              const formatted = numAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return (
                <div key={label} className="text-center">
                  <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
                  <p className="text-[10px] text-zinc-400 font-medium">HKD</p>
                  <p className={`text-xs font-bold ${color} leading-tight`}>{formatted}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
