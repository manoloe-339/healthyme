import { NextRequest, NextResponse } from "next/server";
import { fetchRecovery, fetchCycles, fetchSleep } from "@/lib/whoop";
import { getWhoopAccessToken } from "@/lib/whoop-tokens";
import { getDb } from "@/db";
import { whoopRecovery } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  let accessToken: string;
  try {
    accessToken = await getWhoopAccessToken();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Auth failed" },
      { status: 401 }
    );
  }

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

  // Index sleep by date
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

  // Index cycles by date
  const cycleByDate = new Map(
    cycles.map((c) => [c.start?.split("T")[0] ?? c.created_at.split("T")[0], c])
  );

  const db = getDb();

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

  return NextResponse.json({
    synced: recoveries.length,
    sleepRecords: sleeps.length,
  });
}
