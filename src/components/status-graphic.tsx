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
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1,
    rotation: Math.random() * 360,
    size: 4 + Math.random() * 6,
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

function MilestoneGauge({ pctComplete, currentWeight, nextMilestone, paceStatus, lbsToGo }: {
  pctComplete: number;
  currentWeight: number;
  nextMilestone: { weight: number; label: string; date: string };
  paceStatus: "green" | "yellow" | "red";
  lbsToGo: number;
}) {
  const [animatedPct, setAnimatedPct] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(Math.min(pctComplete, 100)), 100);
    return () => clearTimeout(timer);
  }, [pctComplete]);

  const radius = 90;
  const cx = 110;
  const cy = 100;
  const circumference = Math.PI * radius;
  const strokeOffset = circumference - (animatedPct / 100) * circumference;
  const arcColor = paceStatus === "green" ? "#4ade80" : paceStatus === "yellow" ? "#facc15" : "#ef4444";

  // Count completed milestones
  const completed = MILESTONES.filter((m) => currentWeight <= m.weight).length;
  const total = MILESTONES.length;

  // Milestone dots along bottom
  const totalRange = BASELINE.startWeight - BASELINE.goalWeight;
  const milestoneAngles = MILESTONES.map((m) => {
    const pct = (BASELINE.startWeight - m.weight) / totalRange;
    return { ...m, angle: 180 - pct * 180 };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="120" viewBox="0 0 220 120">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke={arcColor} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeOffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Milestone dots on arc */}
        {milestoneAngles.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180;
          const x = cx + radius * Math.cos(rad);
          const y = cy - radius * Math.sin(rad);
          const hit = currentWeight <= m.weight;
          return <circle key={i} cx={x} cy={y} r="4" fill={hit ? "#4ade80" : "rgba(255,255,255,0.15)"} />;
        })}
        {/* Milestone label at top */}
        <text x={cx} y={30} textAnchor="middle" fill="#71717a" fontSize="11" letterSpacing="2">
          MILESTONE {completed + 1 <= total ? completed + 1 : total}
        </text>
        {/* Target weight large in center */}
        <text x={cx} y={65} textAnchor="middle" fill="#fafafa" fontSize="32" fontWeight="bold" fontFamily="monospace">
          {nextMilestone.weight}
        </text>
        {/* Milestone date */}
        <text x={cx} y={82} textAnchor="middle" fill="#71717a" fontSize="11">
          {nextMilestone.label}
        </text>
        {/* Percent complete */}
        <text x={cx} y={97} textAnchor="middle" fill={arcColor} fontSize="11" fontWeight="bold">
          {pctComplete.toFixed(0)}% COMPLETE
        </text>
      </svg>
      {/* Below arc details */}
      <div className="text-center -mt-1 space-y-1">
        <p className="text-sm text-zinc-400 font-mono">
          <span className="font-bold text-zinc-200">{lbsToGo.toFixed(1)}</span> lbs to go
        </p>
        <p className="text-[10px] text-zinc-600">
          {completed} of {total} milestones completed · {pctComplete.toFixed(1)}% overall
        </p>
      </div>
    </div>
  );
}

function LogStreak({ nutritionDates }: { nutritionDates: string[] }) {
  if (nutritionDates.length === 0) return null;
  const sorted = [...nutritionDates].sort().reverse();
  const today = new Date().toISOString().split("T")[0];
  let streak = 0;
  const checkDate = new Date(today + "T12:00:00");
  for (let i = 0; i < 90; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (sorted.includes(dateStr)) { streak++; }
    else if (i > 0) { break; }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return (
    <div className="text-center">
      <span className="text-xs text-zinc-500">
        {streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""} logged` : "Not logged today"}
      </span>
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
      <p className="text-xs text-zinc-500">/ {target}g</p>
    </div>
  );
}

export function StatusGraphic({ weights, nutritionDates = [], todayProtein = null, proteinTarget = 130 }: Props) {
  const [showConfetti, setShowConfetti] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  if (!latest) return null;

  const pace = getPaceStatus(latest.weightLbs, today);
  const trends = getWeightTrends(weights, today);
  const paceColor = PACE_TEXT_COLOR[pace.status];

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

  // Get the milestone with its date for the gauge
  const nextMs = getNextMilestone(latest.weightLbs);
  const nextMsWithDate = MILESTONES.find((m) => m.weight === nextMs.weight) ?? MILESTONES[0];

  return (
    <div className="space-y-3 relative">
      {showConfetti && <Confetti />}

      {/* Log streak */}
      <LogStreak nutritionDates={nutritionDates} />

      {/* TOP: Current Weight — VERY LARGE GREEN */}
      <div className="flex flex-col items-center py-1">
        <p className={`text-7xl sm:text-8xl font-mono font-bold text-green-400 tracking-tighter leading-none`}>
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

      {/* Protein indicator */}
      <ProteinIndicator current={todayProtein} target={proteinTarget} />

      {/* TREND TILES */}
      {trends && (
        <div className="grid grid-cols-4 gap-1.5">
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

      {/* MILESTONE GAUGE */}
      <MilestoneGauge
        pctComplete={pace.pctComplete}
        currentWeight={latest.weightLbs}
        nextMilestone={{ ...nextMsWithDate }}
        paceStatus={pace.status}
        lbsToGo={pace.lbsToMilestone}
      />
    </div>
  );
}
