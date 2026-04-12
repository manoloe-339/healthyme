"use client";

import { useEffect, useState, useRef } from "react";
import { getPaceStatus, getWeightTrends, BASELINE, MILESTONES } from "@/lib/pace";

interface Props {
  weights: { date: string; weightLbs: number }[];
}

const STATUS_COLORS = {
  green: { bg: "bg-green-500", border: "border-green-500", text: "text-green-400", glow: "shadow-green-500/30" },
  yellow: { bg: "bg-yellow-500", border: "border-yellow-500", text: "text-yellow-400", glow: "shadow-yellow-500/30" },
  red: { bg: "bg-red-500", border: "border-red-500", text: "text-red-400", glow: "shadow-red-500/30" },
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

function MilestoneGauge({ pctComplete, currentWeight, nextMilestone }: {
  pctComplete: number;
  currentWeight: number;
  nextMilestone: { weight: number; label: string };
}) {
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(Math.min(pctComplete, 100)), 100);
    return () => clearTimeout(timer);
  }, [pctComplete]);

  // Arc SVG: semicircle from 180° to 0°
  const radius = 70;
  const cx = 80;
  const cy = 80;
  const circumference = Math.PI * radius;
  const strokeOffset = circumference - (animatedPct / 100) * circumference;

  // Milestone markers on arc
  const totalRange = BASELINE.startWeight - BASELINE.goalWeight;
  const milestoneAngles = MILESTONES.map((m) => {
    const pct = (BASELINE.startWeight - m.weight) / totalRange;
    return { ...m, angle: 180 - pct * 180 };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="90" viewBox="0 0 160 90">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={pctComplete >= 50 ? "#4ade80" : pctComplete >= 25 ? "#facc15" : "#ef4444"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Milestone dots */}
        {milestoneAngles.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180;
          const x = cx + radius * Math.cos(rad);
          const y = cy - radius * Math.sin(rad);
          const hit = currentWeight <= m.weight;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={hit ? "#4ade80" : "rgba(255,255,255,0.2)"}
            />
          );
        })}
      </svg>
      <div className="text-center -mt-2">
        <p className="text-xs text-zinc-500">
          {pctComplete.toFixed(1)}% complete · Next: {nextMilestone.label} ({nextMilestone.weight} lbs)
        </p>
      </div>
    </div>
  );
}

export function StatusGraphic({ weights }: Props) {
  const [showConfetti, setShowConfetti] = useState(false);
  const lastWeightRef = useRef<number | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  if (!latest) return null;

  const pace = getPaceStatus(latest.weightLbs, today);
  const trends = getWeightTrends(weights, today);
  const colors = STATUS_COLORS[pace.status];

  // Confetti on weight drop
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
    <div className="space-y-4 relative">
      {showConfetti && <Confetti />}

      {/* Status Indicator + Current Weight */}
      <div className="flex flex-col items-center py-3 sm:py-4">
        <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${colors.bg} shadow-lg ${colors.glow} animate-pulse mb-2 sm:mb-3`} />
        <p className={`text-4xl sm:text-5xl font-mono font-bold ${colors.text} tracking-tight`}>
          {latest.weightLbs.toFixed(1)}
        </p>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">lbs</p>
        <div className="flex gap-2 sm:gap-4 mt-2 text-[10px] sm:text-xs text-zinc-500">
          <span>{pace.lbsToMilestone.toFixed(1)} to {pace.nextMilestone.label}</span>
          <span>·</span>
          <span>{pace.daysToMilestone}d left</span>
        </div>
        <p className={`text-[10px] sm:text-xs mt-1 ${colors.text}`}>
          {pace.status === "green" ? "Ahead of pace" : pace.status === "yellow" ? "Close to pace" : "Behind pace"}
          {" · "}{pace.requiredPacePerWeek.toFixed(1)} lbs/wk needed
        </p>
      </div>

      {/* Weight Trend Strip */}
      {trends && (
        <div className="grid grid-cols-4 gap-1 sm:gap-2">
          <div className={`rounded-lg border px-1 sm:px-2 py-1.5 sm:py-2 text-center ${TILE_COLORS[trends.lost7.status]}`}>
            <p className="text-base sm:text-lg font-mono font-bold">{trends.lost7.value?.toFixed(1) ?? "—"}</p>
            <p className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5">7d</p>
          </div>
          <div className={`rounded-lg border px-1 sm:px-2 py-1.5 sm:py-2 text-center ${TILE_COLORS[trends.lost30.status]}`}>
            <p className="text-base sm:text-lg font-mono font-bold">{trends.lost30.value?.toFixed(1) ?? "—"}</p>
            <p className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5">30d</p>
          </div>
          <div className={`rounded-lg border px-1 sm:px-2 py-1.5 sm:py-2 text-center ${TILE_COLORS[trends.lost90.status]}`}>
            <p className="text-base sm:text-lg font-mono font-bold">{trends.lost90.value?.toFixed(1) ?? "—"}</p>
            <p className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5">90d</p>
          </div>
          <div className={`rounded-lg border px-1 sm:px-2 py-1.5 sm:py-2 text-center ${TILE_COLORS[trends.sinceBaseline.status]}`}>
            <p className="text-base sm:text-lg font-mono font-bold">{trends.sinceBaseline.value.toFixed(1)}</p>
            <p className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5">Feb 11</p>
          </div>
        </div>
      )}

      {/* Milestone Gauge */}
      <MilestoneGauge
        pctComplete={pace.pctComplete}
        currentWeight={latest.weightLbs}
        nextMilestone={pace.nextMilestone}
      />
    </div>
  );
}
