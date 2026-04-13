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
  // Filter out isolated old data points (gaps > 14 days)
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const filtered: ChartData[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === sorted.length - 1) {
      filtered.push(sorted[i]);
    } else {
      const current = new Date(sorted[i].date + "T12:00:00").getTime();
      const next = new Date(sorted[i + 1].date + "T12:00:00").getTime();
      const gapDays = (next - current) / 86400000;
      if (gapDays <= 14) {
        filtered.push(sorted[i]);
      }
      // Skip isolated points with big gaps after them
    }
  }

  if (filtered.length < 2) return null;

  const chartData = filtered.map((d) => ({
    date: shortDate(d.date),
    calories: d.calories ? Math.round(d.calories) : null,
    protein: d.protein ? Math.round(d.protein) : null,
    recovery: d.recovery,
    weight: d.weightLbs ? Number(d.weightLbs.toFixed(1)) : null,
  }));

  // Calculate weight domain with padding for visibility
  const weights = chartData.map((d) => d.weight).filter((w): w is number => w !== null);
  const weightMin = weights.length > 0 ? Math.floor(Math.min(...weights) - 1) : 210;
  const weightMax = weights.length > 0 ? Math.ceil(Math.max(...weights) + 1) : 225;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
        />
        {/* Left axis: calories */}
        <YAxis
          yAxisId="cal"
          orientation="left"
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          width={40}
        />
        {/* Right axis: weight (tight range for visibility) */}
        <YAxis
          yAxisId="weight"
          orientation="right"
          domain={[weightMin, weightMax]}
          tick={{ fill: "#a78bfa", fontSize: 10 }}
          axisLine={{ stroke: "rgba(168,139,250,0.2)" }}
          width={35}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const day = chartData.find((d) => d.date === label);
            if (!day) return null;
            return (
              <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-lg px-3 py-2 text-xs space-y-0.5">
                <p className="font-bold text-zinc-300">{label}</p>
                {day.calories !== null && <p className="text-yellow-400">Calories: {day.calories} kcal</p>}
                {day.protein !== null && <p className="text-cyan-400">Protein: {day.protein}g</p>}
                {day.recovery !== null && <p className="text-green-400">Recovery: {day.recovery}%</p>}
                {day.weight !== null && <p className="text-purple-400">Weight: {day.weight} lbs</p>}
              </div>
            );
          }}
        />
        {/* Calorie bars */}
        <Bar
          yAxisId="cal"
          dataKey="calories"
          name="Calories"
          fill="rgba(250,204,21,0.35)"
          radius={[3, 3, 0, 0]}
        />
        {/* Protein as line overlay instead of bars */}
        <Line
          yAxisId="cal"
          type="monotone"
          dataKey="protein"
          name="Protein (g)"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={{ fill: "#22d3ee", r: 3 }}
          connectNulls
        />
        {/* Recovery line */}
        <Line
          yAxisId="cal"
          type="monotone"
          dataKey="recovery"
          name="Recovery %"
          stroke="#4ade80"
          strokeWidth={1.5}
          dot={{ fill: "#4ade80", r: 2.5 }}
          strokeDasharray="4 4"
          connectNulls
        />
        {/* Weight line — own axis for visibility */}
        <Line
          yAxisId="weight"
          type="monotone"
          dataKey="weight"
          name="Weight (lbs)"
          stroke="#a78bfa"
          strokeWidth={2.5}
          dot={{ fill: "#a78bfa", r: 4 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
