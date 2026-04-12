import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopRecovery, weightLog, dailyInsight } from "@/db/schema";
import { desc } from "drizzle-orm";
import { computeCorrelations } from "@/lib/correlation";

export async function GET() {
  const db = getDb();

  const [recovery, weight, insights] = await Promise.all([
    db
      .select()
      .from(whoopRecovery)
      .orderBy(desc(whoopRecovery.date))
      .limit(7),
    db
      .select()
      .from(weightLog)
      .orderBy(desc(weightLog.date))
      .limit(7),
    db
      .select()
      .from(dailyInsight)
      .orderBy(desc(dailyInsight.date))
      .limit(1),
  ]);

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
    recovery: recovery.reverse(),
    weight: weight.reverse(),
    correlations,
    latestInsight: insights[0] ?? null,
  });
}
