"use client";

import { useEffect, useState } from "react";
import { getPaceStatus, getWeightTrends, BASELINE, MILESTONES, getNextMilestone } from "@/lib/pace";

interface Props {
  weights: { date: string; weightLbs: number }[];
  nutritionDates?: string[];
  todayProtein?: number | null;
  proteinTarget?: number;
}

const PACE_TEXT_COLOR = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
};

const TILE_COLORS = {
  green: "bg-green-900/40 border-green-700 text-green-300",
  yellow: "bg-yellow-900/40 border-yellow-700 text-yellow-300",
  red: "bg-red-900/40 border-red-700 text-red-300",
};

function Confetti() {
  const colors = ["#4ade80", "#facc15", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i, color: colors[i % colors.length], left: Math.random() * 100,
    delay: Math.random() * 0.5, duration: 1.5 + Math.random() * 1,
    rotation: Math.random() * 360, size: 4 + Math.random() * 6,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {pieces.map((p) => (
        <div key={p.id} className="absolute animate-confetti" style={{
          left: `${p.left}%`, top: "-10px", width: p.size, height: p.size * 0.6,
          backgroundColor: p.color, borderRadius: "2px",
          transform: `rotate(${p.rotation}deg)`,
          animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
        }} />
      ))}
    </div>
  );
}

function ProteinIndicator({ current, target }: { current: number | null; target: number }) {
  if (current === null) return null;
  const hit = current >= target;
  const pct = Math.min((current / target) * 100, 100);
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-zinc-900/50 border-zinc-800">
      <div className="flex-1">
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${hit ? "bg-green-500" : "bg-yellow-500"}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className={`text-lg font-mono font-bold ${hit ? "text-green-400" : "text-yellow-400"}`}>
        {Math.round(current)}g
      </p>
      <p className="text-xs text-zinc-500">/ {target}g protein</p>
    </div>
  );
}

export function StatusGraphic({ weights, nutritionDates = [], todayProtein = null, proteinTarget = 130 }: Props) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [animatedPct, setAnimatedPct] = useState(0);

  const today = new Date().toISOString().split("T")[0];
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  if (!latest) return null;

  const pace = getPaceStatus(latest.weightLbs, today);
  const trends = getWeightTrends(weights, today);
  const paceColor = PACE_TEXT_COLOR[pace.status];

  // Milestone info
  const nextMs = getNextMilestone(latest.weightLbs);
  const nextMsData = MILESTONES.find((m) => m.weight === nextMs.weight) ?? MILESTONES[0];
  const completed = MILESTONES.filter((m) => latest.weightLbs <= m.weight).length;
  const total = MILESTONES.length;

  // Log streak
  const sortedNutrition = [...nutritionDates].sort().reverse();
  let streak = 0;
  const checkDate = new Date(today + "T12:00:00");
  for (let i = 0; i < 90; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (sortedNutrition.includes(dateStr)) { streak++; }
    else if (i > 0) { break; }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Gauge math
  const radius = 100;
  const cx = 130;
  const cy = 110;
  const circumference = Math.PI * radius;
  const strokeOffset = circumference - (animatedPct / 100) * circumference;
  const arcColor = pace.status === "green" ? "#4ade80" : pace.status === "yellow" ? "#facc15" : "#ef4444";

  const totalRange = BASELINE.startWeight - BASELINE.goalWeight;
  const milestoneAngles = MILESTONES.map((m) => {
    const pct = (BASELINE.startWeight - m.weight) / totalRange;
    return { ...m, angle: 180 - pct * 180 };
  });

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(Math.min(pace.pctComplete, 100)), 100);
    return () => clearTimeout(timer);
  }, [pace.pctComplete]);

  useEffect(() => {
    const stored = localStorage.getItem("healthyme_last_weight");
    if (stored && latest) {
      const prev = parseFloat(stored);
      if (latest.weightLbs < prev) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    }
    if (latest) localStorage.setItem("healthyme_last_weight", latest.weightLbs.toString());
  }, [latest]);

  return (
    <div className="relative">
      {showConfetti && <Confetti />}

      {/* Log streak */}
      <p className="text-center text-xs text-zinc-500 mb-3">
        {streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""} logged` : "Not logged today"}
      </p>

      {/* Current Weight */}
      <div className="flex flex-col items-center">
        <p className="text-7xl sm:text-8xl font-mono font-bold text-green-400 tracking-tighter leading-none">
          {latest.weightLbs.toFixed(1)}
        </p>
        <p className="text-sm text-zinc-500 mt-1">lbs</p>
        <p className="text-xs text-zinc-500 mt-2">
          {pace.lbsToMilestone.toFixed(1)} to {pace.nextMilestone.label} · {pace.daysToMilestone}d left
        </p>
        <p className={`text-xs mt-0.5 font-medium ${paceColor}`}>
          {pace.status === "green" ? "Ahead of pace" : pace.status === "yellow" ? "Close to pace" : "Behind pace"}
          {" · "}{pace.requiredPacePerWeek.toFixed(1)} lbs/wk needed
        </p>
      </div>

      {/* Protein */}
      <div className="mt-3">
        <ProteinIndicator current={todayProtein} target={proteinTarget} />
      </div>

      {/* Trend Tiles */}
      {trends && (
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <div className={`rounded-lg border px-1 py-2 text-center ${TILE_COLORS[trends.lost7.status]}`}>
            <p className="text-xl sm:text-2xl font-mono font-bold">{trends.lost7.value?.toFixed(1) ?? "—"}</p>
            <p className="text-[8px] uppercase tracking-wider mt-0.5">7d</p>
          </div>
          <div className={`rounded-lg border px-1 py-2 text-center ${TILE_COLORS[trends.lost30.status]}`}>
            <p className="text-xl sm:text-2xl font-mono font-bold">{trends.lost30.value?.toFixed(1) ?? "—"}</p>
            <p className="text-[8px] uppercase tracking-wider mt-0.5">30d</p>
          </div>
          <div className={`rounded-lg border px-1 py-2 text-center ${TILE_COLORS[trends.lost90.status]}`}>
            <p className="text-xl sm:text-2xl font-mono font-bold">{trends.lost90.value?.toFixed(1) ?? "—"}</p>
            <p className="text-[8px] uppercase tracking-wider mt-0.5">90d</p>
          </div>
          <div className={`rounded-lg border px-1 py-2 text-center ${TILE_COLORS[trends.sinceBaseline.status]}`}>
            <p className="text-xl sm:text-2xl font-mono font-bold">{trends.sinceBaseline.value.toFixed(1)}</p>
            <p className="text-[8px] uppercase tracking-wider mt-0.5">Feb 11</p>
          </div>
        </div>
      )}

      {/* Milestone Gauge — large, unified */}
      <div className="flex flex-col items-center mt-4">
        <svg width="260" height="130" viewBox="0 0 260 130" className="w-full max-w-[280px]">
          {/* Background arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none" stroke={arcColor} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeOffset}
            className="transition-all duration-1000 ease-out"
          />
          {/* Milestone dots on arc */}
          {milestoneAngles.map((m, i) => {
            const rad = (m.angle * Math.PI) / 180;
            const x = cx + (radius) * Math.cos(rad);
            const y = cy - (radius) * Math.sin(rad);
            const hit = latest.weightLbs <= m.weight;
            return <circle key={i} cx={x} cy={y} r="4.5" fill={hit ? "#4ade80" : "rgba(255,255,255,0.12)"} />;
          })}
          {/* Milestone label */}
          <text x={cx} y={35} textAnchor="middle" fill="#71717a" fontSize="10" letterSpacing="2" fontWeight="500">
            MILESTONE {completed + 1 <= total ? completed + 1 : total}
          </text>
          {/* Target weight */}
          <text x={cx} y={70} textAnchor="middle" fill="#fafafa" fontSize="36" fontWeight="bold" fontFamily="monospace">
            {nextMsData.weight}
          </text>
          {/* Date */}
          <text x={cx} y={90} textAnchor="middle" fill="#71717a" fontSize="12">
            {nextMsData.label}
          </text>
          {/* Percent */}
          <text x={cx} y={108} textAnchor="middle" fill={arcColor} fontSize="11" fontWeight="bold">
            {pace.pctComplete.toFixed(0)}% COMPLETE
          </text>
        </svg>

        {/* Below arc */}
        <p className="text-sm text-zinc-400 font-mono -mt-1">
          <span className="font-bold text-zinc-200">{pace.lbsToMilestone.toFixed(1)}</span> lbs to go
        </p>
        <p className="text-[10px] text-zinc-600 mt-1 mb-1">
          {completed} of {total} milestones completed · {pace.pctComplete.toFixed(1)}% overall
        </p>
      </div>
    </div>
  );
}
