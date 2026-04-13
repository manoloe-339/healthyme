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
  ReferenceArea,
  Cell,
} from "recharts";

interface ChartData {
  date: string;
  calories: number | null;
  protein: number | null;
  recovery: number | null;
  weightLbs: number | null;
}

const CAL_TARGET_MIN = 1400;
const CAL_TARGET_MAX = 1600;

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function calBarColor(cal: number | null): string {
  if (cal === null) return "rgba(250,204,21,0.3)";
  if (cal >= CAL_TARGET_MIN && cal <= CAL_TARGET_MAX) return "rgba(74,222,128,0.5)";
  if (cal < CAL_TARGET_MIN) return "rgba(250,204,21,0.5)";
  return "rgba(251,146,60,0.5)"; // over target
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
      if ((next - current) / 86400000 <= 14) {
        filtered.push(sorted[i]);
      }
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

  // Weight domain
  const weights = chartData.map((d) => d.weight).filter((w): w is number => w !== null);
  const weightMin = weights.length > 0 ? Math.floor(Math.min(...weights) - 1) : 210;
  const weightMax = weights.length > 0 ? Math.ceil(Math.max(...weights) + 1) : 225;

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 45, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          />
          {/* Left axis: Calories 0-2500 */}
          <YAxis
            yAxisId="cal"
            orientation="left"
            domain={[0, 2800]}
            tick={{ fill: "#71717a", fontSize: 9 }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            width={35}
          />
          {/* Right axis 1: Recovery 0-100 */}
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: "#4ade80", fontSize: 9 }}
            axisLine={{ stroke: "rgba(74,222,128,0.2)" }}
            width={25}
          />
          {/* Right axis 2: Weight (tight range) */}
          <YAxis
            yAxisId="weight"
            orientation="right"
            domain={[weightMin, weightMax]}
            tick={{ fill: "#a78bfa", fontSize: 9 }}
            axisLine={{ stroke: "rgba(168,139,250,0.2)" }}
            width={30}
          />

          {/* Target calorie band */}
          <ReferenceArea
            yAxisId="cal"
            y1={CAL_TARGET_MIN}
            y2={CAL_TARGET_MAX}
            fill="#4ade80"
            fillOpacity={0.06}
            stroke="#4ade80"
            strokeOpacity={0.15}
            strokeDasharray="3 3"
          />

          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const day = chartData.find((d) => d.date === label);
              if (!day) return null;
              const calStatus = day.calories === null ? ""
                : day.calories >= CAL_TARGET_MIN && day.calories <= CAL_TARGET_MAX ? " ✓"
                : day.calories < CAL_TARGET_MIN ? " ↓ low" : " ↑ over";
              return (
                <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-lg px-3 py-2 text-xs space-y-0.5">
                  <p className="font-bold text-zinc-300">{label}</p>
                  {day.calories !== null && <p className="text-yellow-400">Cal: {day.calories}{calStatus}</p>}
                  {day.protein !== null && <p className="text-cyan-400">Pro: {day.protein}g</p>}
                  {day.recovery !== null && <p className="text-green-400">Rec: {day.recovery}%</p>}
                  {day.weight !== null && <p className="text-purple-400">Wt: {day.weight} lbs</p>}
                </div>
              );
            }}
          />

          {/* Calorie bars — color-coded by target range */}
          <Bar yAxisId="cal" dataKey="calories" name="Calories" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={calBarColor(d.calories)} />
            ))}
          </Bar>

          {/* Protein — dashed cyan line */}
          <Line
            yAxisId="cal"
            type="monotone"
            dataKey="protein"
            name="Protein (g)"
            stroke="#22d3ee"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ fill: "#22d3ee", r: 3 }}
            connectNulls
          />

          {/* Recovery — solid green line, right pct axis */}
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="recovery"
            name="Recovery %"
            stroke="#4ade80"
            strokeWidth={2.5}
            dot={{ fill: "#4ade80", r: 3.5 }}
            connectNulls
          />

          {/* Weight — solid purple line, own axis */}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1 text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-green-400/50 inline-block" /> Calories (in target)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-yellow-400/50 inline-block" /> Calories (low)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-orange-400/50 inline-block" /> Calories (over)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-cyan-400 inline-block border-t border-dashed border-cyan-400" /> Protein
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-green-400 inline-block" /> Recovery
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-purple-400 inline-block" /> Weight
        </span>
      </div>
    </div>
  );
}
