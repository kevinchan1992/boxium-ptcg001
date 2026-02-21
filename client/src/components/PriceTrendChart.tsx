import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PriceTrendData {
  date: string;
  snkrdunkPrice?: number;
  snkrdunkCount?: number;
  ebayPrice?: number;
  ebayCount?: number;
}

interface PriceTrendStats {
  snkrdunk: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    latestPrice: number;
  };
  ebay: {
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

  // Filter data based on time range using actual dates
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

  // Format price for display
  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{data.date}</p>
          {data.snkrdunkPrice && (
            <p className="text-sm text-blue-500">
              SNKRDUNK: {formatPrice(data.snkrdunkPrice)} ({data.snkrdunkCount} records)
            </p>
          )}
          {data.ebayPrice && (
            <p className="text-sm text-orange-500">
              eBay: {formatPrice(data.ebayPrice)} ({data.ebayCount} records)
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (filteredData.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t("cardDetail.chartTitle")}</h3>
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          {t("cardDetail.noData")}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t("cardDetail.chartTitle")} - {cardName}</h3>

        {/* Time Range Buttons */}
        <div className="flex gap-2 mb-6">
          <span className="text-sm text-muted-foreground self-center mr-2">{t("cardDetail.timeRangeLabel")}：</span>
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
          >
            {t("cardDetail.timeRange.7days")}
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
          >
            {t("cardDetail.timeRange.30days")}
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
          >
            {t("cardDetail.timeRange.90days")}
          </Button>
          <Button
            variant={timeRange === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("all")}
          >
            {t("cardDetail.timeRange.all")}
          </Button>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9CA3AF" }}
            />
            <YAxis
              yAxisId="left"
              stroke="#3B82F6"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#3B82F6" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#F97316"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#F97316" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="snkrdunkPrice"
              stroke="#3B82F6"
              dot={false}
              name="SNKRDUNK PSA 10 價格"
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="ebayPrice"
              stroke="#F97316"
              dot={false}
              name="eBay PSA 10 價格"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>


    </Card>
  );
}
