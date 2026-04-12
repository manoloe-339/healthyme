import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopRecovery, weightLog, dailyInsight, dailyNutrition, dailyActivity } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { generateDailyInsight } from "@/lib/insights";

export async function POST() {
  const db = getDb();

  const [recentRecovery, recentWeight, recentNutrition, recentActivity] = await Promise.all([
    db.select().from(whoopRecovery).orderBy(desc(whoopRecovery.date)).limit(5),
    db.select().from(weightLog).orderBy(desc(weightLog.date)).limit(5),
    db.select().from(dailyNutrition).orderBy(desc(dailyNutrition.date)).limit(5),
    db.select().from(dailyActivity).orderBy(desc(dailyActivity.date)).limit(5),
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
      sleepDurationMs: r.sleepDurationMs,
      strain: r.strain,
    })),
    weightData: recentWeight.map((w) => ({
      date: w.date,
      weightKg: w.weightKg,
      bodyFatPct: w.bodyFatPct,
      leanBodyMassKg: w.leanBodyMassKg,
    })),
    nutritionData: recentNutrition.length > 0
      ? recentNutrition.map((n) => ({
          date: n.date,
          calories: n.calories,
          protein: n.protein,
          carbs: n.carbs,
          totalFat: n.totalFat,
        }))
      : undefined,
    activityData: recentActivity.length > 0
      ? recentActivity.map((a) => ({
          date: a.date,
          steps: a.steps,
          activeEnergy: a.activeEnergy,
        }))
      : undefined,
    todayRecovery,
  });

  const today = new Date().toISOString().split("T")[0];

  await db
    .insert(dailyInsight)
    .values({
      date: today,
      weightTrend: insight.weightTrend,
      sleepCorrelation: insight.sleepCorrelation,
      nutritionCorrelation: insight.nutritionCorrelation ?? null,
      nutritionImpact: insight.nutritionImpact ?? null,
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
        nutritionCorrelation: sql`excluded.nutrition_correlation`,
        nutritionImpact: sql`excluded.nutrition_impact`,
        workoutPrescription: sql`excluded.workout_prescription`,
        insightText: sql`excluded.insight_text`,
        recoveryScore: sql`excluded.recovery_score`,
        weightKg: sql`excluded.weight_kg`,
      },
    });

  return NextResponse.json(insight);
}
