"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface WeightEntry {
  date: string;
  weightKg: number;
}

interface RecoveryEntry {
  date: string;
  recoveryScore: number;
  sleepPerformance: number | null;
  strain: number | null;
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function recoveryBarColor(score: number): string {
  if (score >= 67) return "#4ade80";
  if (score >= 34) return "#facc15";
  return "#f87171";
}

export function WeightChart({ data }: { data: WeightEntry[] }) {
  if (data.length < 2) return null;

  const chartData = data.map((d) => ({
    date: shortDate(d.date),
    weight: Number(d.weightKg.toFixed(1)),
  }));

  const weights = chartData.map((d) => d.weight);
  const min = Math.floor(Math.min(...weights) - 0.5);
  const max = Math.ceil(Math.max(...weights) + 0.5);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#fafafa",
            fontSize: 13,
          }}
          formatter={(value) => [`${value} kg`, "Weight"]}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={{ fill: "#a78bfa", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RecoveryChart({ data }: { data: RecoveryEntry[] }) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    date: shortDate(d.date),
    recovery: d.recoveryScore,
    sleep: d.sleepPerformance ?? 0,
    strain: d.strain ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#fafafa",
            fontSize: 13,
          }}
          formatter={(value, name) => [
            name === "strain" ? `${value}` : `${value}%`,
            String(name).charAt(0).toUpperCase() + String(name).slice(1),
          ]}
        />
        <Bar dataKey="recovery" name="Recovery" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={recoveryBarColor(entry.recovery)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SleepChart({ data }: { data: RecoveryEntry[] }) {
  if (data.length === 0) return null;

  const chartData = data
    .filter((d) => d.sleepPerformance !== null)
    .map((d) => ({
      date: shortDate(d.date),
      sleep: d.sleepPerformance,
    }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#fafafa",
            fontSize: 13,
          }}
          formatter={(value) => [`${value}%`, "Sleep"]}
        />
        <Bar dataKey="sleep" name="Sleep" fill="#60a5fa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
