"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RecoveryEntry {
  date: string;
  recoveryScore: number;
  hrvRmssd: number | null;
  sleepPerformance: number | null;
  strain: number | null;
  restingHeartRate: number | null;
}

interface WeightEntry {
  date: string;
  weightKg: number;
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
  weightTrend: string | null;
  sleepCorrelation: string | null;
  workoutPrescription: string | null;
  insightText: string;
  recoveryScore: number | null;
  weightKg: number | null;
}

interface DashboardData {
  recovery: RecoveryEntry[];
  weight: WeightEntry[];
  correlations: Correlations;
  latestInsight: Insight | null;
}

function recoveryColor(score: number): string {
  if (score >= 67) return "text-green-400";
  if (score >= 34) return "text-yellow-400";
  return "text-red-400";
}

function recoveryBadge(score: number) {
  if (score >= 67) return <Badge className="bg-green-900 text-green-300">Green</Badge>;
  if (score >= 34) return <Badge className="bg-yellow-900 text-yellow-300">Yellow</Badge>;
  return <Badge className="bg-red-900 text-red-300">Red</Badge>;
}

function formatCorrelation(r: number | null): string {
  if (r === null) return "—";
  const sign = r >= 0 ? "+" : "";
  return `${sign}${r.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("Failed to load data");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function syncWhoop() {
    setSyncing(true);
    try {
      const res = await fetch("/api/whoop/sync", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/api/whoop/auth";
        return;
      }
      if (!res.ok) throw new Error("Sync failed");
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function generateInsight() {
    setGenerating(true);
    try {
      const res = await fetch("/api/insights", { method: "POST" });
      if (!res.ok) throw new Error("Insight generation failed");
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insight generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </main>
    );
  }

  const latestRecovery = data?.recovery?.[data.recovery.length - 1];
  const latestWeight = data?.weight?.[data.weight.length - 1];
  const correlations = data?.correlations;

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-sans">
            healthyme
          </h1>
          <p className="text-sm text-muted-foreground">
            Body recomposition dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={syncWhoop} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync WHOOP"}
          </Button>
          <Button onClick={generateInsight} disabled={generating}>
            {generating ? "Generating..." : "Generate Insight"}
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
            {correlations.consecutiveLowSleep} consecutive days of low sleep
            performance (&lt;70%). This is a metabolic risk factor for weight
            loss stalling. Prioritize sleep tonight.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today&apos;s Recovery</CardDescription>
          </CardHeader>
          <CardContent>
            {latestRecovery ? (
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-mono font-bold ${recoveryColor(latestRecovery.recoveryScore)}`}
                >
                  {latestRecovery.recoveryScore}%
                </span>
                {recoveryBadge(latestRecovery.recoveryScore)}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No data — sync WHOOP</p>
            )}
            {latestRecovery?.hrvRmssd && (
              <p className="text-xs text-muted-foreground mt-1">
                HRV {latestRecovery.hrvRmssd.toFixed(0)} ms · RHR{" "}
                {latestRecovery.restingHeartRate?.toFixed(0) ?? "—"} bpm
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Latest Weight</CardDescription>
          </CardHeader>
          <CardContent>
            {latestWeight ? (
              <div>
                <span className="text-3xl font-mono font-bold">
                  {latestWeight.weightKg.toFixed(1)}
                </span>
                <span className="text-lg text-muted-foreground ml-1">kg</span>
                {data!.weight.length >= 2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(() => {
                      const prev = data!.weight[data!.weight.length - 2];
                      const diff = latestWeight.weightKg - prev.weightKg;
                      const sign = diff >= 0 ? "+" : "";
                      return `${sign}${diff.toFixed(1)} kg from ${formatDate(prev.date)}`;
                    })()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Correlations (rolling)</CardDescription>
          </CardHeader>
          <CardContent>
            {correlations ? (
              <div className="space-y-1 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight × Sleep</span>
                  <span>{formatCorrelation(correlations.weightVsSleep)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight × Recovery</span>
                  <span>{formatCorrelation(correlations.weightVsRecovery)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight × Strain</span>
                  <span>{formatCorrelation(correlations.weightVsStrain)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {correlations.windowDays}-day window
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Need more data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Insight */}
      {data?.latestInsight && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Daily Insight — {formatDate(data.latestInsight.date)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              {data.latestInsight.insightText}
            </p>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {data.latestInsight.weightTrend && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Weight Trend
                  </p>
                  <p>{data.latestInsight.weightTrend}</p>
                </div>
              )}
              {data.latestInsight.sleepCorrelation && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Sleep Correlation
                  </p>
                  <p>{data.latestInsight.sleepCorrelation}</p>
                </div>
              )}
              {data.latestInsight.workoutPrescription && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Workout Rx
                  </p>
                  <p>{data.latestInsight.workoutPrescription}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Data</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recovery && data.recovery.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Date</th>
                    <th className="text-right py-2 px-4 font-medium">Recovery</th>
                    <th className="text-right py-2 px-4 font-medium">Sleep</th>
                    <th className="text-right py-2 px-4 font-medium">HRV</th>
                    <th className="text-right py-2 px-4 font-medium">Strain</th>
                    <th className="text-right py-2 pl-4 font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {data.recovery.map((r) => {
                    const w = data.weight.find((w) => w.date === r.date);
                    return (
                      <tr key={r.date} className="border-b border-border/50">
                        <td className="py-2 pr-4">{formatDate(r.date)}</td>
                        <td
                          className={`text-right py-2 px-4 ${recoveryColor(r.recoveryScore)}`}
                        >
                          {r.recoveryScore}%
                        </td>
                        <td className="text-right py-2 px-4">
                          {r.sleepPerformance
                            ? `${r.sleepPerformance.toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="text-right py-2 px-4">
                          {r.hrvRmssd ? `${r.hrvRmssd.toFixed(0)}` : "—"}
                        </td>
                        <td className="text-right py-2 px-4">
                          {r.strain ? r.strain.toFixed(1) : "—"}
                        </td>
                        <td className="text-right py-2 pl-4">
                          {w ? `${w.weightKg.toFixed(1)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No data yet. Connect WHOOP and sync to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
