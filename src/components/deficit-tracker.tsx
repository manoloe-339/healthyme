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
const PROTEIN_WARN = 100;
const DEFICIT_TARGET = 1375; // sweet spot for 2.5-3 lbs/week
const DEFICIT_MIN = 1250; // 2.5 lbs/week
const DEFICIT_MAX = 1500; // 3.0 lbs/week

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
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function deficitColor(deficit: number | null): string {
  if (deficit === null) return "text-zinc-500";
  if (deficit <= 0) return "text-red-400";
  if (deficit >= DEFICIT_MIN && deficit <= DEFICIT_MAX) return "text-green-400";
  return "text-yellow-400";
}

function caloriesInColor(cal: number | null, isSlug: boolean): string {
  if (isSlug) return "text-purple-400/60";
  if (cal === null) return "text-zinc-500";
  if (cal >= PROTOCOL_MIN && cal <= PROTOCOL_MAX) return "text-green-400";
  return "text-red-400";
}

function proteinColor(protein: number | null): string {
  if (protein === null) return "text-zinc-600";
  if (protein >= PROTEIN_TARGET) return "text-green-400";
  if (protein >= PROTEIN_WARN) return "text-yellow-400";
  return "text-red-400";
}

export function DeficitTracker({ recovery, nutrition }: Props) {
  const [expanded, setExpanded] = useState(false);

  const nutritionByDate = new Map(nutrition.map((n) => [n.date, n]));

  const days = recovery.map((r) => {
    const n = nutritionByDate.get(r.date);
    const caloriesIn = n?.calories ?? null;
    const isSlug = caloriesIn === null;
    const effectiveCaloriesIn = isSlug ? SLUG_CALORIES : caloriesIn;
    const caloriesOut = r.caloriesBurned ?? null;
    const deficit = caloriesOut !== null && effectiveCaloriesIn !== null
      ? caloriesOut - effectiveCaloriesIn
      : null;
    const protein = n?.protein ?? null;

    return {
      date: r.date,
      dateShort: shortDate(r.date),
      caloriesIn: effectiveCaloriesIn,
      caloriesOut,
      deficit,
      isSlug,
      protein,
    };
  });

  // Weekly totals
  const totalIn = days.reduce((s, d) => s + (d.caloriesIn ?? 0), 0);
  const totalOut = days.reduce((s, d) => s + (d.caloriesOut ?? 0), 0);
  const totalDeficit = totalOut - totalIn;
  const hasSlugDays = days.some((d) => d.isSlug);
  const hasNoWhoop = days.some((d) => d.caloriesOut === null);
  const proteinDays = days.filter((d) => d.protein !== null);
  const avgProtein = proteinDays.length > 0
    ? proteinDays.reduce((s, d) => s + (d.protein ?? 0), 0) / proteinDays.length
    : null;

  // Dynamic 6-word insight
  const avgDailyDeficit = days.length > 0 ? totalDeficit / days.length : 0;
  let insightLine = "Sync WHOOP for deficit data.";
  if (days.some((d) => d.deficit !== null)) {
    if (avgDailyDeficit >= DEFICIT_MIN && avgDailyDeficit <= DEFICIT_MAX) {
      insightLine = "Deficit on track. Keep going.";
    } else if (avgDailyDeficit < DEFICIT_MIN && avgDailyDeficit > 0) {
      insightLine = "Deficit too low. Eat less.";
    } else if (avgDailyDeficit > DEFICIT_MAX) {
      insightLine = "Deficit too aggressive. Recovery risk.";
    } else if (avgDailyDeficit <= 0) {
      insightLine = "No deficit. Surplus territory. Fix.";
    }
  }

  return (
    <div className="space-y-3">
      {/* Insight line */}
      <p className="text-xs text-zinc-500">{insightLine}</p>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={days} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="dateShort" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} width={40} />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fafafa", fontSize: 11, lineHeight: "1.6" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const day = days.find((d) => d.dateShort === label);
              if (!day) return null;
              const deficit = day.deficit;
              const onTrack = deficit !== null && deficit >= DEFICIT_MIN && deficit <= DEFICIT_MAX;
              const deficitStatus = deficit === null ? "no data"
                : deficit <= 0 ? "SURPLUS — no deficit"
                : deficit < DEFICIT_MIN ? `too low (target ${DEFICIT_MIN}-${DEFICIT_MAX})`
                : deficit > DEFICIT_MAX ? `too aggressive (target ${DEFICIT_MIN}-${DEFICIT_MAX})`
                : "on track";
              return (
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs space-y-1">
                  <p className="font-bold text-zinc-200">{label}{day.isSlug ? " (slug)" : ""}</p>
                  <p className="text-blue-400">Burned: {day.caloriesOut ? `${Math.round(day.caloriesOut)} kcal` : "no WHOOP"}</p>
                  <p className={day.isSlug ? "text-purple-400/60" : "text-green-400"}>Eaten: {Math.round(day.caloriesIn ?? 0)} kcal</p>
                  <div className="border-t border-zinc-700 pt-1 mt-1">
                    <p className={`font-bold ${deficit !== null && onTrack ? "text-green-400" : deficit !== null && deficit > 0 ? "text-yellow-400" : "text-red-400"}`}>
                      Deficit: {deficit !== null ? `${Math.round(deficit)} kcal` : "—"}
                    </p>
                    <p className="text-zinc-500">{deficitStatus}</p>
                    {day.protein !== null && (
                      <p className={day.protein >= PROTEIN_TARGET ? "text-green-400" : "text-yellow-400"}>
                        Protein: {Math.round(day.protein)}g {day.protein >= PROTEIN_TARGET ? "✓" : `(need ${PROTEIN_TARGET}g)`}
                      </p>
                    )}
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine y={PROTOCOL_MIN} stroke="#facc15" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={PROTOCOL_MAX} stroke="#facc15" strokeDasharray="3 3" strokeOpacity={0.3} />
          <Bar dataKey="caloriesOut" name="caloriesOut" fill="rgba(96,165,250,0.5)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="caloriesIn" name="caloriesIn" radius={[3, 3, 0, 0]}>
            {days.map((d, i) => (
              <Cell key={i} fill={d.isSlug ? "rgba(168,139,250,0.3)" : "#4ade80"} />
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

      {/* Target range */}
      <p className="text-center text-[9px] text-zinc-600">
        Target deficit: {DEFICIT_MIN}-{DEFICIT_MAX} kcal/day (2.5-3 lbs/week) · Sweet spot: {DEFICIT_TARGET}
      </p>

      {/* Weekly total */}
      <div className="text-center">
        <p className={`text-lg font-mono font-bold ${deficitColor(totalDeficit)}`}>
          {Math.round(Math.abs(totalDeficit)).toLocaleString()} kcal
        </p>
        <p className="text-[10px] text-zinc-500">
          weekly deficit{hasSlugDays || hasNoWhoop ? " (estimated)" : ""}
        </p>
      </div>

      {/* Expandable daily breakdown */}
      {expanded && (
        <div className="border-t border-border/30 pt-2">
          {/* Column headers */}
          <div className="flex justify-between items-center text-[9px] text-zinc-600 uppercase tracking-wider mb-1 px-0.5">
            <span className="w-14">Date</span>
            <span className="w-14 text-right">Cal In</span>
            <span className="w-16 text-right">Cal Out</span>
            <span className="w-14 text-right">Deficit</span>
            <span className="w-12 text-right">Protein</span>
          </div>
          <div className="space-y-0.5 text-xs font-mono">
            {[...days].reverse().map((d) => (
              <div key={d.date} className="flex justify-between items-center px-0.5">
                <span className="text-zinc-500 w-14">{d.dateShort}</span>
                <span className={`w-14 text-right ${caloriesInColor(d.caloriesIn, d.isSlug)}`}>
                  {d.caloriesIn ? Math.round(d.caloriesIn) : "—"}
                </span>
                <span className="w-16 text-right text-blue-400">
                  {d.caloriesOut ? Math.round(d.caloriesOut) : <span className="text-zinc-600 text-[10px]">no WHOOP</span>}
                </span>
                <span className={`w-14 text-right font-bold ${deficitColor(d.deficit)}`}>
                  {d.deficit !== null ? Math.round(d.deficit) : "—"}
                </span>
                <span className={`w-12 text-right ${proteinColor(d.protein)}`}>
                  {d.protein !== null ? `${Math.round(d.protein)}g` : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Weekly summary row */}
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/30 text-xs font-mono font-bold px-0.5">
            <span className="text-zinc-400 w-14">Total</span>
            <span className="text-zinc-300 w-14 text-right">{Math.round(totalIn).toLocaleString()}</span>
            <span className="text-blue-400 w-16 text-right">{Math.round(totalOut).toLocaleString()}</span>
            <span className={`w-14 text-right ${deficitColor(totalDeficit)}`}>{Math.round(totalDeficit).toLocaleString()}</span>
            <span className={`w-12 text-right ${proteinColor(avgProtein)}`}>
              {avgProtein !== null ? `${Math.round(avgProtein)}g` : "—"}
            </span>
          </div>
          <p className="text-[9px] text-zinc-600 text-center mt-1">
            avg/day · {hasSlugDays ? "includes slug estimates" : "all days logged"}
          </p>
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
