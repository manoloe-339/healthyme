"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from "recharts";

const SLUG_CALORIES = 1500;
const PROTOCOL_MIN = 1400;
const PROTOCOL_MAX = 1600;
const PROTEIN_TARGET = 130;

interface RecoveryEntry {
  date: string;
  caloriesBurned: number | null;
  strain: number | null;
}

interface NutritionEntry {
  date: string;
  calories: number | null;
  protein: number | null;
}

interface Props {
  recovery: RecoveryEntry[];
  nutrition: NutritionEntry[];
  headline?: string;
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

export function DeficitTracker({ recovery, nutrition, headline }: Props) {
  const [expanded, setExpanded] = useState(false);

  const nutritionByDate = new Map(nutrition.map((n) => [n.date, n]));

  // Build daily data
  const days = recovery.map((r) => {
    const n = nutritionByDate.get(r.date);
    const caloriesIn = n?.calories ?? null;
    const isSlug = caloriesIn === null;
    const effectiveCaloriesIn = isSlug ? SLUG_CALORIES : caloriesIn;
    const caloriesOut = r.caloriesBurned ?? null;
    const deficit = caloriesOut !== null && effectiveCaloriesIn !== null
      ? caloriesOut - effectiveCaloriesIn
      : null;
    const proteinHit = n?.protein ? n.protein >= PROTEIN_TARGET : false;

    let colorStatus: "green" | "yellow" | "red" | "gray" = "gray";
    if (!isSlug && effectiveCaloriesIn !== null) {
      if (effectiveCaloriesIn >= PROTOCOL_MIN && effectiveCaloriesIn <= PROTOCOL_MAX && proteinHit) {
        colorStatus = "green";
      } else if (effectiveCaloriesIn >= PROTOCOL_MIN && effectiveCaloriesIn <= PROTOCOL_MAX) {
        colorStatus = "yellow"; // in range but protein missed
      } else {
        colorStatus = "red"; // out of range
      }
    }

    return {
      date: r.date,
      dateShort: shortDate(r.date),
      caloriesIn: effectiveCaloriesIn,
      caloriesOut,
      deficit,
      isSlug,
      proteinHit,
      protein: n?.protein ?? null,
      colorStatus,
    };
  });

  const weeklyDeficit = days.reduce((sum, d) => sum + (d.deficit ?? 0), 0);
  const hasSlugDays = days.some((d) => d.isSlug);

  const BAR_COLORS: Record<string, string> = {
    green: "#4ade80",
    yellow: "#facc15",
    red: "#ef4444",
    gray: "#6b7280",
  };

  return (
    <div className="space-y-3">
      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={days} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="dateShort" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} width={40} />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fafafa", fontSize: 11 }}
            formatter={(value, name) => {
              if (name === "caloriesIn") return [`${Math.round(value as number)} kcal`, "Calories In"];
              if (name === "caloriesOut") return [`${Math.round(value as number)} kcal`, "Burned (WHOOP)"];
              return [`${value}`, `${name}`];
            }}
          />
          <ReferenceLine y={PROTOCOL_MIN} stroke="#facc15" strokeDasharray="3 3" strokeOpacity={0.4} />
          <ReferenceLine y={PROTOCOL_MAX} stroke="#facc15" strokeDasharray="3 3" strokeOpacity={0.4} />
          <Bar dataKey="caloriesOut" name="caloriesOut" fill="rgba(96,165,250,0.5)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="caloriesIn" name="caloriesIn" radius={[3, 3, 0, 0]}>
            {days.map((d, i) => (
              <Cell key={i} fill={d.isSlug ? "rgba(168,139,250,0.3)" : BAR_COLORS[d.colorStatus]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-3 text-[9px] text-zinc-500 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400/50 inline-block" /> WHOOP burn</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" /> Logged intake</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-400/30 inline-block" /> Slug (1500 est)</span>
      </div>

      {/* Weekly total */}
      <div className="text-center">
        <p className="text-lg font-mono font-bold text-zinc-200">
          {weeklyDeficit > 0 ? "+" : ""}{Math.round(weeklyDeficit).toLocaleString()} kcal
        </p>
        <p className="text-[10px] text-zinc-500">
          weekly deficit{hasSlugDays ? " (estimated — includes slug days)" : ""}
        </p>
      </div>

      {/* Expand for daily breakdown */}
      {expanded && (
        <div className="space-y-1 text-xs font-mono border-t border-border/30 pt-2">
          {[...days].reverse().map((d) => (
            <div key={d.date} className="flex justify-between items-center">
              <span className="text-zinc-500 w-16">{d.dateShort}</span>
              <span className={d.isSlug ? "text-purple-400/60" : "text-zinc-300"}>
                {d.caloriesIn ? Math.round(d.caloriesIn) : "—"} in
              </span>
              <span className="text-blue-400">
                {d.caloriesOut ? Math.round(d.caloriesOut) : "—"} out
              </span>
              <span className={`font-bold ${(d.deficit ?? 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                {d.deficit !== null ? `${d.deficit > 0 ? "+" : ""}${Math.round(d.deficit)}` : "—"}
              </span>
              <span className="w-12 text-right">
                {d.protein !== null ? (
                  <span className={d.proteinHit ? "text-green-400" : "text-yellow-400"}>
                    {Math.round(d.protein)}g
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {expanded ? "Collapse" : "Full Analysis"}
      </button>
    </div>
  );
}
