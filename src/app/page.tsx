"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CorrelationChart } from "@/components/correlation-chart";
import { StatusGraphic } from "@/components/status-graphic";

// --- Types ---

interface RecoveryEntry {
  date: string;
  recoveryScore: number;
  hrvRmssd: number | null;
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  strain: number | null;
  restingHeartRate: number | null;
}

interface WeightEntry {
  date: string;
  weightKg: number;
  bodyFatPct?: number | null;
  leanBodyMassKg?: number | null;
}

interface NutritionEntry {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  totalFat: number | null;
}

interface ActivityEntry {
  date: string;
  steps: number | null;
  activeEnergy: number | null;
  exerciseMinutes: number | null;
}

interface Correlations {
  weightVsSleep: number | null;
  weightVsRecovery: number | null;
  weightVsStrain: number | null;
  windowDays: number;
  consecutiveLowSleep: number;
  sleepWarning: boolean;
}

interface Insight {
  date: string;
  orderStatus?: string;
  orderEat?: string;
  orderDrink?: string;
  orderExercise?: string;
  orderSleep?: string;
  orderWatch?: string;
  correlationHeadline?: string;
  statusHeadline?: string;
  coachHeadline?: string;
  workoutHeadline?: string;
  detailHeadline?: string;
  correlationAnalysis?: string;
  coachSummary?: string;
  coachAnalysis?: string;
  workoutPrescription?: string;
  workoutRationale?: string;
  weightTrend: string | null;
  sleepCorrelation: string | null;
  nutritionCorrelation?: string | null;
  nutritionImpact?: string | null;
  insightText: string;
  recoveryScore: number | null;
  weightKg: number | null;
}

interface DashboardData {
  recovery: RecoveryEntry[];
  weight: WeightEntry[];
  allWeight: { date: string; weightLbs: number }[];
  nutrition: NutritionEntry[];
  activity: ActivityEntry[];
  correlations: Correlations;
  latestInsight: Insight | null;
  lastSync: { autoExport: string | null; whoop: string | null };
}

// --- Helpers ---

function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function recoveryColor(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function statusColor(score: number, greenThreshold: number, yellowThreshold: number): string {
  if (score >= greenThreshold) return "bg-green-900/50 border-green-700 text-green-300";
  if (score >= yellowThreshold) return "bg-yellow-900/50 border-yellow-700 text-yellow-300";
  return "bg-red-900/50 border-red-700 text-red-300";
}

// --- Expandable Section ---

function WindowToggle({ windowDays, onToggle }: { windowDays: number; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
    >
      {windowDays}d
    </button>
  );
}

function ExpandableSection({
  title,
  headline,
  children,
  expandLabel = "Full Analysis",
  defaultContent,
  headerRight,
}: {
  title: string;
  headline?: string;
  children: React.ReactNode;
  expandLabel?: string;
  defaultContent?: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-white">{title}</CardTitle>
          {headerRight}
        </div>
        {headline && (
          <CardDescription className="text-xs text-zinc-500 mt-0.5">
            {headline}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {defaultContent}
        {expanded && (
          <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line pt-2 border-t border-border/50">
            {children}
          </div>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? "Collapse" : expandLabel}
        </button>
      </CardContent>
    </Card>
  );
}

// --- Main Dashboard ---

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 30>(7);

  const fetchData = useCallback(async (days?: number) => {
    try {
      const w = days ?? windowDays;
      const res = await fetch(`/api/data?window=${w}`);
      if (!res.ok) throw new Error("Failed to load data");
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleWindow() {
    const next = windowDays === 7 ? 30 : 7;
    setWindowDays(next);
    fetchData(next);
  }

  async function syncWhoop() {
    setSyncing(true);
    try {
      const res = await fetch("/api/whoop/sync", { method: "POST" });
      if (res.status === 401) { window.location.href = "/api/whoop/auth"; return; }
      if (!res.ok) throw new Error("Sync failed");
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncing(false); }
  }

  async function generateInsight() {
    setGenerating(true);
    try {
      const res = await fetch("/api/insights", { method: "POST" });
      if (!res.ok) throw new Error("Insight generation failed");
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insight generation failed");
    } finally { setGenerating(false); }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
      </main>
    );
  }

  const insight = data?.latestInsight;
  const latestRecovery = data?.recovery?.[data.recovery.length - 1];
  const latestWeight = data?.weight?.[data.weight.length - 1];
  const correlations = data?.correlations;

  // Build correlation chart data
  const allDates = new Set<string>();
  data?.recovery?.forEach((r) => allDates.add(r.date));
  data?.weight?.forEach((w) => allDates.add(w.date));
  data?.nutrition?.forEach((n) => allDates.add(n.date));

  const recoveryByDate = new Map(data?.recovery?.map((r) => [r.date, r]) ?? []);
  const weightByDate = new Map(data?.weight?.map((w) => [w.date, w]) ?? []);
  const nutritionByDate = new Map(data?.nutrition?.map((n) => [n.date, n]) ?? []);

  const chartData = Array.from(allDates)
    .sort()
    .map((date) => ({
      date,
      calories: nutritionByDate.get(date)?.calories ?? null,
      protein: nutritionByDate.get(date)?.protein ?? null,
      recovery: recoveryByDate.get(date)?.recoveryScore ?? null,
      weightLbs: weightByDate.get(date) ? kgToLbs(weightByDate.get(date)!.weightKg) : null,
    }));

  // Milestone pace
  const currentLbs = latestWeight ? kgToLbs(latestWeight.weightKg) : null;

  return (
    <main className="mx-auto max-w-3xl px-3 py-3 sm:p-6 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">healthyme</h1>
          {data?.lastSync && (
            <p className="text-[10px] sm:text-xs text-zinc-600 mt-0.5 truncate">
              Export: {timeAgo(data.lastSync.autoExport)} · WHOOP: {timeAgo(data.lastSync.whoop)}
              {data.nutrition && data.nutrition.length > 0 && (
                <> · Last log: {formatDate([...data.nutrition].sort((a, b) => b.date.localeCompare(a.date))[0].date)}</>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 sm:gap-2 items-center shrink-0">
          <Link href="/insights"><Button variant="ghost" size="sm" className="text-[10px] sm:text-xs px-2 h-7">History</Button></Link>
          <Button variant="secondary" size="sm" className="text-[10px] sm:text-xs px-2 h-7" onClick={syncWhoop} disabled={syncing}>
            {syncing ? "..." : "Sync"}
          </Button>
          <Button size="sm" className="text-[10px] sm:text-xs px-2 h-7" onClick={generateInsight} disabled={generating}>
            {generating ? "..." : "Insight"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {correlations?.sleepWarning && (
        <Alert>
          <AlertTitle>Sleep Warning</AlertTitle>
          <AlertDescription>
            {correlations.consecutiveLowSleep} consecutive days below 65% sleep.
            Metabolic risk — prioritize sleep tonight.
          </AlertDescription>
        </Alert>
      )}

      {/* STATUS GRAPHIC */}
      {data?.allWeight && data.allWeight.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <StatusGraphic
              weights={data.allWeight}
              nutritionDates={data.nutrition?.filter(n => n.calories && !('estimated' in n && (n as {estimated?: boolean}).estimated)).map(n => n.date) ?? []}
              todayProtein={(() => {
                const today = new Date().toISOString().split("T")[0];
                const todayNutrition = data.nutrition?.find(n => n.date === today || n.date?.startsWith(today));
                return todayNutrition?.protein ?? null;
              })()}
              proteinTarget={130}
            />
          </CardContent>
        </Card>
      )}

      {/* 0. TODAY'S ORDERS */}
      {insight?.orderStatus && (
        <Card className="border-zinc-700">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-medium text-white">Today&apos;s Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <p className="text-xs sm:text-sm text-zinc-200 font-medium">{insight.orderStatus}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-sm pt-1">
              <div className="flex gap-2">
                <span className="text-zinc-500 w-12 sm:w-14 shrink-0">Eat</span>
                <span className="text-zinc-300">{insight.orderEat}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-500 w-14 shrink-0">Drink</span>
                <span className="text-zinc-300">{insight.orderDrink}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-500 w-14 shrink-0">Exercise</span>
                <span className="text-zinc-300">{insight.orderExercise}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-500 w-14 shrink-0">Sleep</span>
                <span className="text-zinc-300">{insight.orderSleep}</span>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <span className="text-zinc-500 w-14 shrink-0">Watch</span>
                <span className="text-yellow-400">{insight.orderWatch}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 1. CORRELATION CHART */}
      <ExpandableSection
        title="Correlation Chart"
        headline={insight?.correlationHeadline ?? "Sync data and generate insights first."}
        expandLabel="Full Analysis"
        headerRight={<WindowToggle windowDays={windowDays} onToggle={toggleWindow} />}
        defaultContent={
          chartData.length >= 2 ? <CorrelationChart data={chartData} /> : (
            <p className="text-sm text-zinc-500">Need more data to show correlations.</p>
          )
        }
      >
        {insight?.correlationAnalysis ?? insight?.nutritionCorrelation ?? insight?.sleepCorrelation ?? "Generate an insight to see the full analysis."}
      </ExpandableSection>

      {/* 2. STATUS STRIP */}
      <ExpandableSection
        title="Status Strip"
        headline={insight?.statusHeadline ?? "Sync WHOOP to see current status."}
        expandLabel="Full Detail"
        defaultContent={
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className={`rounded-lg border px-2 sm:px-3 py-2 text-center ${latestRecovery ? statusColor(latestRecovery.recoveryScore, 70, 50) : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}>
              <p className="text-xl sm:text-2xl font-mono font-bold">{latestRecovery?.recoveryScore ?? "—"}%</p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider mt-0.5">Recovery</p>
            </div>
            <div className={`rounded-lg border px-2 sm:px-3 py-2 text-center ${latestRecovery?.sleepPerformance ? statusColor(latestRecovery.sleepPerformance, 75, 65) : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}>
              <p className="text-xl sm:text-2xl font-mono font-bold">{latestRecovery?.sleepPerformance?.toFixed(0) ?? "—"}%</p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider mt-0.5">Sleep</p>
            </div>
            <div className={`rounded-lg border px-2 sm:px-3 py-2 text-center ${currentLbs ? statusColor(currentLbs <= 209 ? 100 : currentLbs <= 215 ? 60 : 30, 70, 50) : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}>
              <p className="text-xl sm:text-2xl font-mono font-bold">{currentLbs?.toFixed(1) ?? "—"}</p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider mt-0.5">Weight</p>
            </div>
          </div>
        }
      >
        <div className="space-y-2 text-sm">
          {latestRecovery && (
            <p>HRV: {latestRecovery.hrvRmssd?.toFixed(0) ?? "—"} ms · RHR: {latestRecovery.restingHeartRate?.toFixed(0) ?? "—"} bpm · Strain: {latestRecovery.strain?.toFixed(1) ?? "—"} · Sleep: {latestRecovery.sleepDurationMs ? (latestRecovery.sleepDurationMs / 3600000).toFixed(1) + "h" : "—"}</p>
          )}
          {latestWeight && (
            <p>Weight: {kgToLbs(latestWeight.weightKg).toFixed(1)} lbs{latestWeight.bodyFatPct ? ` · BF: ${latestWeight.bodyFatPct.toFixed(1)}%` : ""}{latestWeight.leanBodyMassKg ? ` · Lean: ${kgToLbs(latestWeight.leanBodyMassKg).toFixed(1)} lbs` : ""}</p>
          )}
          {correlations && (
            <p className="font-mono text-xs text-zinc-500">
              Correlations ({correlations.windowDays}d): Wt×Sleep {correlations.weightVsSleep?.toFixed(2) ?? "—"} · Wt×Recovery {correlations.weightVsRecovery?.toFixed(2) ?? "—"} · Wt×Strain {correlations.weightVsStrain?.toFixed(2) ?? "—"}
            </p>
          )}
        </div>
      </ExpandableSection>

      {/* 3. COACH CARD */}
      <ExpandableSection
        title="Coach Card"
        headline={insight?.coachHeadline ?? "Generate insight for coaching."}
        expandLabel="Full Analysis"
        defaultContent={
          insight?.coachSummary ? (
            <p className="text-sm text-zinc-300">{insight.coachSummary}</p>
          ) : (
            <p className="text-sm text-zinc-500">Click &quot;Generate Insight&quot; to get your daily coaching.</p>
          )
        }
      >
        {insight?.coachAnalysis ?? insight?.insightText ?? "No analysis yet."}
      </ExpandableSection>

      {/* 4. WORKOUT PRESCRIPTION */}
      <ExpandableSection
        title="Workout Prescription"
        headline={insight?.workoutHeadline ?? "Generate insight for workout Rx."}
        expandLabel="Full Detail"
        defaultContent={
          insight?.workoutPrescription ? (
            <p className="text-sm font-medium text-white">{insight.workoutPrescription}</p>
          ) : (
            <p className="text-sm text-zinc-500">Sync WHOOP and generate insight for a prescription.</p>
          )
        }
      >
        {insight?.workoutRationale ?? "No workout reasoning available yet."}
      </ExpandableSection>

      {/* 5. DETAIL TABLES */}
      <ExpandableSection
        title="Detail Tables"
        headline={insight?.detailHeadline ?? "Expand to see all data."}
        expandLabel="Show Tables"
        headerRight={<WindowToggle windowDays={windowDays} onToggle={toggleWindow} />}
        defaultContent={null}
      >
        <div className="space-y-6">
          {/* Recent Data */}
          {data?.recovery && data.recovery.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Recovery & Sleep</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                      <th className="text-right py-1.5 px-2 font-medium">Rec</th>
                      <th className="text-right py-1.5 px-2 font-medium">Sleep</th>
                      <th className="text-right py-1.5 px-2 font-medium">Hrs</th>
                      <th className="text-right py-1.5 px-2 font-medium">HRV</th>
                      <th className="text-right py-1.5 px-2 font-medium">Strain</th>
                      <th className="text-right py-1.5 pl-2 font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {[...data.recovery].reverse().map((r) => {
                      const w = data.weight.find((w) => w.date === r.date);
                      return (
                        <tr key={r.date} className="border-b border-border/30">
                          <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(r.date)}</td>
                          <td className={`text-right py-1.5 px-2 ${recoveryColor(r.recoveryScore)}`}>{r.recoveryScore}%</td>
                          <td className="text-right py-1.5 px-2">{r.sleepPerformance ? `${r.sleepPerformance.toFixed(0)}%` : "—"}</td>
                          <td className="text-right py-1.5 px-2">{r.sleepDurationMs ? `${(r.sleepDurationMs / 3600000).toFixed(1)}h` : "—"}</td>
                          <td className="text-right py-1.5 px-2">{r.hrvRmssd ? r.hrvRmssd.toFixed(0) : "—"}</td>
                          <td className="text-right py-1.5 px-2">{r.strain ? r.strain.toFixed(1) : "—"}</td>
                          <td className="text-right py-1.5 pl-2">{w ? `${kgToLbs(w.weightKg).toFixed(1)}` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Body Composition */}
          {data?.weight && data.weight.some((w) => w.bodyFatPct) && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Body Composition</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[350px]">
                  <thead>
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                      <th className="text-right py-1.5 px-2 font-medium">Weight</th>
                      <th className="text-right py-1.5 px-2 font-medium">Body Fat</th>
                      <th className="text-right py-1.5 pl-2 font-medium">Lean Mass</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {[...data.weight].reverse().map((w) => (
                      <tr key={w.date} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(w.date)}</td>
                        <td className="text-right py-1.5 px-2">{kgToLbs(w.weightKg).toFixed(1)} lbs</td>
                        <td className="text-right py-1.5 px-2">{w.bodyFatPct ? `${w.bodyFatPct.toFixed(1)}%` : "—"}</td>
                        <td className="text-right py-1.5 pl-2">{w.leanBodyMassKg ? `${kgToLbs(w.leanBodyMassKg).toFixed(1)} lbs` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Nutrition */}
          {(data?.nutrition?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Nutrition</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[350px]">
                  <thead>
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                      <th className="text-right py-1.5 px-2 font-medium">Cal</th>
                      <th className="text-right py-1.5 px-2 font-medium">Protein</th>
                      <th className="text-right py-1.5 px-2 font-medium">Carbs</th>
                      <th className="text-right py-1.5 pl-2 font-medium">Fat</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {[...data!.nutrition].reverse().map((n) => (
                      <tr key={n.date} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(n.date)}</td>
                        <td className="text-right py-1.5 px-2">{n.calories ? Math.round(n.calories) : "—"}</td>
                        <td className="text-right py-1.5 px-2">{n.protein ? `${Math.round(n.protein)}g` : "—"}</td>
                        <td className="text-right py-1.5 px-2">{n.carbs ? `${Math.round(n.carbs)}g` : "—"}</td>
                        <td className="text-right py-1.5 pl-2">{n.totalFat ? `${Math.round(n.totalFat)}g` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity */}
          {(data?.activity?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Activity</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[300px]">
                  <thead>
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                      <th className="text-right py-1.5 px-2 font-medium">Steps</th>
                      <th className="text-right py-1.5 px-2 font-medium">Active Cal</th>
                      <th className="text-right py-1.5 pl-2 font-medium">Exercise</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {[...data!.activity].reverse().map((a) => (
                      <tr key={a.date} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(a.date)}</td>
                        <td className="text-right py-1.5 px-2">{a.steps ? a.steps.toLocaleString() : "—"}</td>
                        <td className="text-right py-1.5 px-2">{a.activeEnergy ? Math.round(a.activeEnergy) : "—"}</td>
                        <td className="text-right py-1.5 pl-2">{a.exerciseMinutes ? `${Math.round(a.exerciseMinutes)}m` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </ExpandableSection>

      {/* Copy Page & Version Footer */}
      <CopyFooter data={data} insight={insight} />
    </main>
  );
}

function CopyFooter({ data, insight }: { data: DashboardData | null; insight: Insight | null | undefined }) {
  const [copied, setCopied] = useState(false);

  function buildSnapshot(): string {
    const lines: string[] = [];
    lines.push(`healthyme snapshot — ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`);
    lines.push("");

    if (data?.recovery?.length) {
      lines.push("## Recovery & Sleep");
      data.recovery.forEach((r) => {
        const hrs = r.sleepDurationMs ? `${(r.sleepDurationMs / 3600000).toFixed(1)}h` : "—";
        lines.push(`${r.date.substring(0, 10)}: Rec ${r.recoveryScore}%, Sleep ${r.sleepPerformance?.toFixed(0) ?? "—"}%, ${hrs}, HRV ${r.hrvRmssd?.toFixed(0) ?? "—"}, Strain ${r.strain?.toFixed(1) ?? "—"}`);
      });
      lines.push("");
    }

    if (data?.weight?.length) {
      lines.push("## Weight & Body Comp");
      data.weight.forEach((w: WeightEntry) => {
        const lbs = kgToLbs(w.weightKg).toFixed(1);
        const bf = w.bodyFatPct ? `, BF ${w.bodyFatPct.toFixed(1)}%` : "";
        const lean = w.leanBodyMassKg ? `, Lean ${kgToLbs(w.leanBodyMassKg).toFixed(1)} lbs` : "";
        lines.push(`${w.date.substring(0, 10)}: ${lbs} lbs${bf}${lean}`);
      });
      lines.push("");
    }

    if (data?.nutrition?.length) {
      lines.push("## Nutrition");
      data.nutrition.forEach((n) => {
        lines.push(`${n.date.substring(0, 10)}: ${n.calories ? Math.round(n.calories) + " kcal" : "—"}, Pro ${n.protein ? Math.round(n.protein) + "g" : "—"}, Carb ${n.carbs ? Math.round(n.carbs) + "g" : "—"}, Fat ${n.totalFat ? Math.round(n.totalFat) + "g" : "—"}`);
      });
      lines.push("");
    }

    if (data?.activity?.length) {
      lines.push("## Activity");
      data.activity.forEach((a) => {
        lines.push(`${a.date.substring(0, 10)}: ${a.steps?.toLocaleString() ?? "—"} steps, ${a.activeEnergy ? Math.round(a.activeEnergy) + " active kcal" : "—"}, ${a.exerciseMinutes ? Math.round(a.exerciseMinutes) + "m exercise" : "—"}`);
      });
      lines.push("");
    }

    if (data?.correlations) {
      const c = data.correlations;
      lines.push(`## Correlations (${c.windowDays}d window)`);
      lines.push(`Wt×Sleep: ${c.weightVsSleep?.toFixed(2) ?? "—"} | Wt×Recovery: ${c.weightVsRecovery?.toFixed(2) ?? "—"} | Wt×Strain: ${c.weightVsStrain?.toFixed(2) ?? "—"}`);
      if (c.sleepWarning) lines.push(`⚠ ${c.consecutiveLowSleep} consecutive days below 65% sleep`);
      lines.push("");
    }

    if (insight) {
      lines.push("## Latest Insight");
      if (insight.coachSummary) lines.push(`Coach: ${insight.coachSummary}`);
      if (insight.workoutPrescription) lines.push(`Workout Rx: ${insight.workoutPrescription}`);
      if (insight.correlationAnalysis) lines.push(`Correlations: ${insight.correlationAnalysis}`);
      lines.push("");
    }

    if (data?.lastSync) {
      lines.push(`Last sync — Auto Export: ${data.lastSync.autoExport ?? "never"} | WHOOP: ${data.lastSync.whoop ?? "never"}`);
    }

    lines.push(`Version: ${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7) ?? "dev"} | Deploy: ${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE?.substring(0, 50) ?? "local"}`);

    return lines.join("\n");
  }

  async function copyToClipboard() {
    const text = buildSnapshot();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-border/30 pt-4 mt-4 flex items-center justify-between">
      <p className="text-[10px] text-zinc-700 font-mono">
        v0.1.0 · {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7) ?? "dev"} · {process.env.NEXT_PUBLIC_VERCEL_ENV ?? "local"}
      </p>
      <button
        onClick={copyToClipboard}
        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-mono"
      >
        {copied ? "Copied!" : "Copy page snapshot"}
      </button>
    </div>
  );
}
