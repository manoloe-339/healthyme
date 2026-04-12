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
    nutritionData: (() => {
      const logged = recentNutrition.filter((n) => n.calories && n.calories > 0);
      return logged.length > 0
        ? logged.map((n) => ({
            date: n.date,
            calories: n.calories,
            protein: n.protein,
            carbs: n.carbs,
            totalFat: n.totalFat,
          }))
        : undefined;
    })(),
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
      orderStatus: insight.orderStatus ?? null,
      orderEat: insight.orderEat ?? null,
      orderDrink: insight.orderDrink ?? null,
      orderExercise: insight.orderExercise ?? null,
      orderSleep: insight.orderSleep ?? null,
      orderWatch: insight.orderWatch ?? null,
      correlationHeadline: insight.correlationHeadline ?? null,
      statusHeadline: insight.statusHeadline ?? null,
      coachHeadline: insight.coachHeadline ?? null,
      workoutHeadline: insight.workoutHeadline ?? null,
      detailHeadline: insight.detailHeadline ?? null,
      correlationAnalysis: insight.correlationAnalysis ?? null,
      coachSummary: insight.coachSummary ?? null,
      coachAnalysis: insight.coachAnalysis ?? null,
      workoutRationale: insight.workoutRationale ?? null,
      weightTrend: insight.weightTrend,
      sleepCorrelation: insight.sleepCorrelation,
      nutritionCorrelation: insight.correlationAnalysis ?? null,
      workoutPrescription: insight.workoutPrescription,
      insightText: insight.insightText,
      recoveryScore: todayRecovery,
      weightKg: recentWeight[0]?.weightKg ?? null,
    })
    .onConflictDoUpdate({
      target: dailyInsight.date,
      set: {
        orderStatus: sql`excluded.order_status`,
        orderEat: sql`excluded.order_eat`,
        orderDrink: sql`excluded.order_drink`,
        orderExercise: sql`excluded.order_exercise`,
        orderSleep: sql`excluded.order_sleep`,
        orderWatch: sql`excluded.order_watch`,
        correlationHeadline: sql`excluded.correlation_headline`,
        statusHeadline: sql`excluded.status_headline`,
        coachHeadline: sql`excluded.coach_headline`,
        workoutHeadline: sql`excluded.workout_headline`,
        detailHeadline: sql`excluded.detail_headline`,
        correlationAnalysis: sql`excluded.correlation_analysis`,
        coachSummary: sql`excluded.coach_summary`,
        coachAnalysis: sql`excluded.coach_analysis`,
        workoutRationale: sql`excluded.workout_rationale`,
        weightTrend: sql`excluded.weight_trend`,
        sleepCorrelation: sql`excluded.sleep_correlation`,
        nutritionCorrelation: sql`excluded.nutrition_correlation`,
        workoutPrescription: sql`excluded.workout_prescription`,
        insightText: sql`excluded.insight_text`,
        recoveryScore: sql`excluded.recovery_score`,
        weightKg: sql`excluded.weight_kg`,
      },
    });

  return NextResponse.json(insight);
}
