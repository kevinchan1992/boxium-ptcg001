/**
 * VaultTrendChart — lazy-loaded recharts wrapper for Vault portfolio trend.
 * Separated from Vault.tsx so recharts is only bundled when the chart is needed.
 */
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/formatCurrency";

interface TrendPoint {
  month: string;
  cost: number;
  marketValue: number;
  gain: number;
}

interface VaultTrendChartProps {
  data: TrendPoint[];
  brandBlue: string;
  bgCard: string;
  textPri: string;
  textSec: string;
  border: string;
}

export default function VaultTrendChart({
  data,
  brandBlue,
  bgCard,
  textPri,
  textSec,
  border,
}: VaultTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="vaultTrendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FEDD00" stopOpacity={0.18} />
            <stop offset="50%" stopColor="#06038d" stopOpacity={0.10} />
            <stop offset="100%" stopColor="#06038d" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="vaultCostGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: textSec }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: textSec }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
          width={42}
        />
        <RechartsTooltip
          formatter={(value, name) => [
            formatCurrency(Number(value ?? 0)),
            name === "marketValue" ? "市値" : "成本",
          ]}
          contentStyle={{
            borderRadius: 10,
            border: `1px solid ${border}`,
            fontSize: 12,
            background: bgCard,
            color: textPri,
          }}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="#94a3b8"
          strokeWidth={1.5}
          fill="url(#vaultCostGrad)"
          dot={false}
          strokeDasharray="4 2"
        />
        <Area
          type="monotone"
          dataKey="marketValue"
          stroke={brandBlue}
          strokeWidth={2.5}
          fill="url(#vaultTrendGrad)"
          dot={{ fill: brandBlue, r: 2.5 }}
          activeDot={{ r: 5, fill: brandBlue }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
