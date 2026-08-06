"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

export default function TrendLineChart({
  data,
  series,
  height = 260,
  percent = false,
}: {
  // Recharts-style row data; charts are presentational wrappers.
  data: any[];
  series: TrendSeries[];
  height?: number;
  percent?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={
            percent ? (v) => `${Math.round(Number(v) * 100)}%` : undefined
          }
        />
        <Tooltip
          formatter={
            percent
              ? (v: number | string) => `${(Number(v) * 100).toFixed(1)}%`
              : undefined
          }
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
