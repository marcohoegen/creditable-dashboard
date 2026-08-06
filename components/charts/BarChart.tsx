"use client";

import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function BarChart({
  data,
  dataKey,
  labelKey = "label",
  color = "#0f766e",
  colors,
  height = 260,
  percent = false,
}: {
  // Recharts-style row data; charts are presentational wrappers.
  data: any[];
  dataKey: string;
  labelKey?: string;
  color?: string;
  colors?: string[];
  height?: number;
  percent?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
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
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors ? colors[i % colors.length] : color} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
