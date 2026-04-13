import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopRecovery, weightLog, dailyNutrition, dailyActivity, dailyInsight } from "@/db/schema";
import { fetchRecovery, fetchCycles, fetchSleep } from "@/lib/whoop";
import { getWhoopAccessToken } from "@/lib/whoop-tokens";
import { generateDailyInsight } from "@/lib/insights";
import { sql, desc } from "drizzle-orm";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await getWhoopAccessToken();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Token refresh failed" },
      { status: 400 }
    );
  }

  const db = getDb();
  const now = new Date();
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(now.getDate() - 5);

  const startDate = fiveDaysAgo.toISOString().split("T")[0];
  const endDate = now.toISOString().split("T")[0];

  const [recoveries, cycles, sleeps] = await Promise.all([
    fetchRecovery(accessToken, startDate, endDate),
    fetchCycles(accessToken, startDate, endDate),
    fetchSleep(accessToken, startDate, endDate),
  ]);

  const sleepByDate = new Map(
    sleeps
      .filter((s) => s.score_state === "SCORED")
      .map((s) => {
        const date = s.end.split("T")[0];
        const ss = (s.score as Record<string, unknown>).stage_summary as Record<string, number> | undefined;
        const totalSleep = ss
          ? (ss.total_light_sleep_time_milli ?? 0) +
            (ss.total_slow_wave_sleep_time_milli ?? 0) +
            (ss.total_rem_sleep_time_milli ?? 0)
          : 0;
        return [date, {
          performance: (s.score as Record<string, unknown>).sleep_performance_percentage as number,
          durationMs: totalSleep,
        }];
      })
  );

  const cycleByDate = new Map(
    cycles.map((c) => [c.start?.split("T")[0] ?? c.created_at.split("T")[0], c])
  );

  for (const rec of recoveries) {
    const date = rec.created_at.split("T")[0];
    const cycle = cycleByDate.get(date);
    const sleep = sleepByDate.get(date);
    const kj = cycle?.score?.kilojoule ?? null;

    await db
      .insert(whoopRecovery)
      .values({
        date,
        recoveryScore: rec.score.recovery_score,
        hrvRmssd: rec.score.hrv_rmssd_milli,
        restingHeartRate: rec.score.resting_heart_rate,
        sleepPerformance: sleep?.performance ?? null,
        sleepDurationMs: sleep?.durationMs ?? null,
        strain: cycle?.score?.strain ?? null,
        kilojoules: kj,
        caloriesBurned: kj ? Math.round(kj * 0.239) : null,
      })
      .onConflictDoUpdate({
        target: whoopRecovery.date,
        set: {
          recoveryScore: sql`excluded.recovery_score`,
          hrvRmssd: sql`excluded.hrv_rmssd`,
          restingHeartRate: sql`excluded.resting_heart_rate`,
          sleepPerformance: sql`excluded.sleep_performance`,
          sleepDurationMs: sql`excluded.sleep_duration_ms`,
          strain: sql`excluded.strain`,
          kilojoules: sql`excluded.kilojoules`,
          caloriesBurned: sql`excluded.calories_burned`,
          createdAt: sql`now()`,
        },
      });
  }

  // --- Generate daily insight after sync ---
  let insightGenerated = false;
  try {
    const [recentRecovery, recentWeight, recentNutrition, recentActivity] = await Promise.all([
      db.select().from(whoopRecovery).orderBy(desc(whoopRecovery.date)).limit(5),
      db.select().from(weightLog).orderBy(desc(weightLog.date)).limit(5),
      db.select().from(dailyNutrition).orderBy(desc(dailyNutrition.date)).limit(5),
      db.select().from(dailyActivity).orderBy(desc(dailyActivity.date)).limit(5),
    ]);

    if (recentRecovery.length > 0) {
      const todayRecovery = recentRecovery[0].recoveryScore;
      const loggedNutrition = recentNutrition.filter((n) => n.calories && n.calories > 0);

      const insight = await generateDailyInsight({
        recoveryData: recentRecovery.map((r) => ({
          date: r.date, recoveryScore: r.recoveryScore, hrvRmssd: r.hrvRmssd,
          sleepPerformance: r.sleepPerformance, sleepDurationMs: r.sleepDurationMs, strain: r.strain,
        })),
        weightData: recentWeight.map((w) => ({
          date: w.date, weightKg: w.weightKg, bodyFatPct: w.bodyFatPct, leanBodyMassKg: w.leanBodyMassKg,
        })),
        nutritionData: loggedNutrition.length > 0
          ? loggedNutrition.map((n) => ({ date: n.date, calories: n.calories, protein: n.protein, carbs: n.carbs, totalFat: n.totalFat }))
          : undefined,
        activityData: recentActivity.length > 0
          ? recentActivity.map((a) => ({ date: a.date, steps: a.steps, activeEnergy: a.activeEnergy }))
          : undefined,
        todayRecovery,
      });

      const today = new Date().toISOString().split("T")[0];
      await db.insert(dailyInsight).values({
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
      }).onConflictDoUpdate({
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
      insightGenerated = true;
    }
  } catch (e) {
    console.error("Cron insight generation failed:", e);
  }

  return NextResponse.json({
    synced: recoveries.length,
    sleepRecords: sleeps.length,
    insightGenerated,
  });
}
