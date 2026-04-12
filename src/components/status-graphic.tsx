"use client";

import { useEffect, useState } from "react";
import { getPaceStatus, getWeightTrends, BASELINE, MILESTONES } from "@/lib/pace";

interface Props {
  weights: { date: string; weightLbs: number }[];
  nutritionDates?: string[];
  todayProtein?: number | null;
  proteinTarget?: number;
}

const STATUS_COLORS = {
  green: { bg: "bg-green-500", text: "text-green-400", glow: "shadow-green-500/30" },
  yellow: { bg: "bg-yellow-500", text: "text-yellow-400", glow: "shadow-yellow-500/30" },
  red: { bg: "bg-red-500", text: "text-red-400", glow: "shadow-red-500/30" },
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
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: "2px",
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function MilestoneGauge({ pctComplete, currentWeight, nextMilestone, paceStatus }: {
  pctComplete: number;
  currentWeight: number;
  nextMilestone: { weight: number; label: string };
  paceStatus: "green" | "yellow" | "red";
}) {
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(Math.min(pctComplete, 100)), 100);
    return () => clearTimeout(timer);
  }, [pctComplete]);

  const radius = 80;
  const cx = 90;
  const cy = 85;
  const circumference = Math.PI * radius;
  const strokeOffset = circumference - (animatedPct / 100) * circumference;

  const arcColor = paceStatus === "green" ? "#4ade80" : paceStatus === "yellow" ? "#facc15" : "#ef4444";

  const totalRange = BASELINE.startWeight - BASELINE.goalWeight;
  const milestoneAngles = MILESTONES.map((m) => {
    const pct = (BASELINE.startWeight - m.weight) / totalRange;
    return { ...m, angle: 180 - pct * 180 };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="95" viewBox="0 0 180 95">
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={arcColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          className="transition-all duration-1000 ease-out"
        />
        {milestoneAngles.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180;
          const x = cx + radius * Math.cos(rad);
          const y = cy - radius * Math.sin(rad);
          const hit = currentWeight <= m.weight;
          return (
            <circle key={i} cx={x} cy={y} r="3"
              fill={hit ? "#4ade80" : "rgba(255,255,255,0.2)"}
            />
          );
        })}
      </svg>
      <p className="text-xs text-zinc-500 -mt-1">
        {pctComplete.toFixed(1)}% complete · Next: {nextMilestone.label} ({nextMilestone.weight} lbs)
      </p>
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
    if (sorted.includes(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
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
          <div
            className={`h-full rounded-full transition-all duration-500 ${hit ? "bg-green-500" : "bg-yellow-500"}`}
            style={{ width: `${pct}%` }}
          />
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
  const colors = STATUS_COLORS[pace.status];

  useEffect(() => {
    const stored = localStorage.getItem("healthyme_last_weight");
    if (stored && latest) {
      const prev = parseFloat(stored);
      if (latest.weightLbs < prev) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    }
    if (latest) {
      localStorage.setItem("healthyme_last_weight", latest.weightLbs.toString());
    }
  }, [latest]);

  return (
    <div className="space-y-3 relative">
      {showConfetti && <Confetti />}

      {/* Log streak */}
      <LogStreak nutritionDates={nutritionDates} />

      {/* Current Weight — BIG */}
      <div className="flex flex-col items-center py-2">
        <div className={`w-3 h-3 rounded-full ${colors.bg} shadow-lg ${colors.glow} animate-pulse mb-2`} />
        <p className={`text-6xl sm:text-7xl font-mono font-bold ${colors.text} tracking-tighter leading-none`}>
          {latest.weightLbs.toFixed(1)}
        </p>
        <p className="text-sm text-zinc-500 mt-1">lbs</p>
        <div className="flex gap-3 mt-2 text-xs text-zinc-500">
          <span>{pace.lbsToMilestone.toFixed(1)} to {pace.nextMilestone.label}</span>
          <span>·</span>
          <span>{pace.daysToMilestone}d left</span>
        </div>
        <p className={`text-xs mt-1 ${colors.text}`}>
          {pace.status === "green" ? "Ahead of pace" : pace.status === "yellow" ? "Close to pace" : "Behind pace"}
          {" · "}{pace.requiredPacePerWeek.toFixed(1)} lbs/wk needed
        </p>
      </div>

      {/* Protein indicator */}
      <ProteinIndicator current={todayProtein} target={proteinTarget} />

      {/* Weight Trend Strip — BIGGER numbers */}
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

      {/* Milestone Gauge */}
      <MilestoneGauge
        pctComplete={pace.pctComplete}
        currentWeight={latest.weightLbs}
        nextMilestone={pace.nextMilestone}
        paceStatus={pace.status}
      />
    </div>
  );
}
