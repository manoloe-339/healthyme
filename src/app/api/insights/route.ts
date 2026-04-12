import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopRecovery, weightLog, dailyInsight } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { generateDailyInsight } from "@/lib/insights";

export async function POST() {
  const db = getDb();

  const [recentRecovery, recentWeight] = await Promise.all([
    db
      .select()
      .from(whoopRecovery)
      .orderBy(desc(whoopRecovery.date))
      .limit(5),
    db
      .select()
      .from(weightLog)
      .orderBy(desc(weightLog.date))
      .limit(5),
  ]);

  if (recentRecovery.length === 0) {
    return NextResponse.json(
      { error: "No recovery data. Sync WHOOP first." },
      { status: 400 }
    );
  }

  const todayRecovery = recentRecovery[0].recoveryScore;

  const insight = await generateDailyInsight({
    recoveryData: recentRecovery.map((r) => ({
      date: r.date,
      recoveryScore: r.recoveryScore,
      hrvRmssd: r.hrvRmssd,
      sleepPerformance: r.sleepPerformance,
      strain: r.strain,
    })),
    weightData: recentWeight.map((w) => ({
      date: w.date,
      weightKg: w.weightKg,
    })),
    todayRecovery,
  });

  const today = new Date().toISOString().split("T")[0];

  await db
    .insert(dailyInsight)
    .values({
      date: today,
      weightTrend: insight.weightTrend,
      sleepCorrelation: insight.sleepCorrelation,
      workoutPrescription: insight.workoutPrescription,
      insightText: insight.insightText,
      recoveryScore: todayRecovery,
      weightKg: recentWeight[0]?.weightKg ?? null,
    })
    .onConflictDoUpdate({
      target: dailyInsight.date,
      set: {
        weightTrend: sql`excluded.weight_trend`,
        sleepCorrelation: sql`excluded.sleep_correlation`,
        workoutPrescription: sql`excluded.workout_prescription`,
        insightText: sql`excluded.insight_text`,
        recoveryScore: sql`excluded.recovery_score`,
        weightKg: sql`excluded.weight_kg`,
      },
    });

  return NextResponse.json(insight);
}
