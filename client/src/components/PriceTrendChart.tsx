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
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("90d");

  // Filter data based on time range
  const filteredData = trendData.slice(
    Math.max(0, trendData.length - (timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90))
  );

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
        <h3 className="text-lg font-semibold text-foreground mb-4">價格趨勢</h3>
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          暫無價格數據
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">價格趨勢 - {cardName}</h3>

        {/* Time Range Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
          >
            7 天
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
          >
            30 天
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
          >
            90 天
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
              name="SNKRDUNK 價格"
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="ebayPrice"
              stroke="#F97316"
              dot={false}
              name="eBay 價格"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        {/* SNKRDUNK Stats */}
        {stats.snkrdunk.avgPrice > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-500 mb-2">SNKRDUNK</h4>
            <div className="space-y-1 text-sm">
              <p className="text-foreground">
                最新: <span className="font-semibold">{formatPrice(stats.snkrdunk.latestPrice)}</span>
              </p>
              <p className="text-foreground">
                平均: <span className="font-semibold">{formatPrice(stats.snkrdunk.avgPrice)}</span>
              </p>
              <p className="text-foreground">
                最低: <span className="font-semibold">{formatPrice(stats.snkrdunk.minPrice)}</span>
              </p>
              <p className="text-foreground">
                最高: <span className="font-semibold">{formatPrice(stats.snkrdunk.maxPrice)}</span>
              </p>
            </div>
          </div>
        )}

        {/* eBay Stats */}
        {stats.ebay.avgPrice > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-orange-500 mb-2">eBay</h4>
            <div className="space-y-1 text-sm">
              <p className="text-foreground">
                最新: <span className="font-semibold">{formatPrice(stats.ebay.latestPrice)}</span>
              </p>
              <p className="text-foreground">
                平均: <span className="font-semibold">{formatPrice(stats.ebay.avgPrice)}</span>
              </p>
              <p className="text-foreground">
                最低: <span className="font-semibold">{formatPrice(stats.ebay.minPrice)}</span>
              </p>
              <p className="text-foreground">
                最高: <span className="font-semibold">{formatPrice(stats.ebay.maxPrice)}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
