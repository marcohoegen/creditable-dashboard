"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export default function Sparkline({
  data,
  color = "#0f766e",
}: {
  data: number[];
  color?: string;
}) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={points}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
