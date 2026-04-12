"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface ChartData {
  date: string;
  calories: number | null;
  protein: number | null;
  recovery: number | null;
  weightLbs: number | null;
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CorrelationChart({ data }: { data: ChartData[] }) {
  if (data.length < 2) return null;

  const chartData = data.map((d) => ({
    date: shortDate(d.date),
    calories: d.calories ? Math.round(d.calories) : null,
    protein: d.protein ? Math.round(d.protein) : null,
    recovery: d.recovery,
    weight: d.weightLbs ? Number(d.weightLbs.toFixed(1)) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
        />
        <YAxis
          yAxisId="cal"
          orientation="left"
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          width={45}
          label={{ value: "kcal / g", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 10 }}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          width={35}
          label={{ value: "%", angle: 90, position: "insideRight", fill: "#71717a", fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#fafafa",
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
        />
        <Bar
          yAxisId="cal"
          dataKey="calories"
          name="Calories"
          fill="rgba(250,204,21,0.4)"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          yAxisId="cal"
          dataKey="protein"
          name="Protein (g)"
          fill="rgba(96,165,250,0.6)"
          radius={[3, 3, 0, 0]}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="recovery"
          name="Recovery %"
          stroke="#4ade80"
          strokeWidth={2}
          dot={{ fill: "#4ade80", r: 3 }}
        />
        <Line
          yAxisId="cal"
          type="monotone"
          dataKey="weight"
          name="Weight (lbs)"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={{ fill: "#a78bfa", r: 3 }}
          strokeDasharray="5 5"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
