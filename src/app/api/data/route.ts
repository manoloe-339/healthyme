import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopRecovery, weightLog, dailyInsight, dailyNutrition, dailyActivity } from "@/db/schema";
import { desc } from "drizzle-orm";
import { computeCorrelations } from "@/lib/correlation";

export async function GET(request: NextRequest) {
  const window = parseInt(request.nextUrl.searchParams.get("window") ?? "7", 10);
  const limit = window === 30 ? 30 : 7;

  const db = getDb();

  const [recovery, weight, allWeight, insights, nutrition, activity, lastWeightSync, lastWhoopSync] = await Promise.all([
    db.select().from(whoopRecovery).orderBy(desc(whoopRecovery.date)).limit(limit),
    db.select().from(weightLog).orderBy(desc(weightLog.date)).limit(limit),
    db.select({ date: weightLog.date, weightKg: weightLog.weightKg }).from(weightLog).orderBy(desc(weightLog.date)).limit(120),
    db.select().from(dailyInsight).orderBy(desc(dailyInsight.date)).limit(1),
    db.select().from(dailyNutrition).orderBy(desc(dailyNutrition.date)).limit(limit),
    db.select().from(dailyActivity).orderBy(desc(dailyActivity.date)).limit(limit),
    db.select({ createdAt: weightLog.createdAt }).from(weightLog).orderBy(desc(weightLog.createdAt)).limit(1),
    db.select({ createdAt: whoopRecovery.createdAt }).from(whoopRecovery).orderBy(desc(whoopRecovery.createdAt)).limit(1),
  ]);

  // Only include nutrition days that have real logged data (calories > 0)
  const loggedNutrition = nutrition.filter((n) => n.calories && n.calories > 0);

  const weightByDate = new Map(weight.map((w) => [w.date, w.weightKg]));
  const mergedData = recovery.map((r) => ({
    date: r.date,
    weightKg: weightByDate.get(r.date) ?? null,
    recoveryScore: r.recoveryScore,
    sleepPerformance: r.sleepPerformance,
    strain: r.strain,
  }));

  const correlations = computeCorrelations(mergedData);

  return NextResponse.json({
    window: limit,
    recovery: recovery.reverse(),
    weight: weight.reverse(),
    allWeight: allWeight.reverse().map((w) => ({ date: w.date, weightLbs: w.weightKg * 2.20462 })),
    nutrition: loggedNutrition.reverse(),
    activity: activity.reverse(),
    correlations,
    latestInsight: insights[0] ?? null,
    lastSync: {
      autoExport: lastWeightSync[0]?.createdAt ?? null,
      whoop: lastWhoopSync[0]?.createdAt ?? null,
    },
  });
}
