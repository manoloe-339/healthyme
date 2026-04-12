"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface Insight {
  id: number;
  date: string;
  weightTrend: string | null;
  sleepCorrelation: string | null;
  workoutPrescription: string | null;
  insightText: string;
  recoveryScore: number | null;
  weightKg: number | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function recoveryBadge(score: number | null) {
  if (score === null) return null;
  if (score >= 67) return <Badge className="bg-green-900 text-green-300">Recovery {score}%</Badge>;
  if (score >= 34) return <Badge className="bg-yellow-900 text-yellow-300">Recovery {score}%</Badge>;
  return <Badge className="bg-red-900 text-red-300">Recovery {score}%</Badge>;
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights/history")
      .then((res) => res.json())
      .then((data) => setInsights(data.insights))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Insight History</h1>
        <Link href="/">
          <Button variant="secondary" size="sm">Dashboard</Button>
        </Link>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No insights yet. Generate one from the dashboard.
          </CardContent>
        </Card>
      ) : (
        insights.map((insight) => (
          <Card key={insight.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">
                  {formatDate(insight.date)}
                </CardTitle>
                <div className="flex gap-2">
                  {recoveryBadge(insight.recoveryScore)}
                  {insight.weightKg && (
                    <Badge variant="secondary">
                      {(insight.weightKg * 2.20462).toFixed(1)} lbs
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{insight.insightText}</p>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {insight.weightTrend && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Weight Trend</p>
                    <p>{insight.weightTrend}</p>
                  </div>
                )}
                {insight.sleepCorrelation && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Sleep Correlation</p>
                    <p>{insight.sleepCorrelation}</p>
                  </div>
                )}
                {insight.workoutPrescription && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Workout Rx</p>
                    <p>{insight.workoutPrescription}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}
