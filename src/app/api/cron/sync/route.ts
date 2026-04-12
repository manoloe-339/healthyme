import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopRecovery } from "@/db/schema";
import { fetchRecovery, fetchCycles, refreshWhoopToken } from "@/lib/whoop";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refreshToken = process.env.WHOOP_REFRESH_TOKEN;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token configured" },
      { status: 400 }
    );
  }

  const tokens = await refreshWhoopToken(refreshToken);

  const now = new Date();
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(now.getDate() - 5);

  const startDate = fiveDaysAgo.toISOString().split("T")[0];
  const endDate = now.toISOString().split("T")[0];

  const [recoveries, cycles] = await Promise.all([
    fetchRecovery(tokens.access_token, startDate, endDate),
    fetchCycles(tokens.access_token, startDate, endDate),
  ]);

  const db = getDb();

  for (const rec of recoveries) {
    const date = rec.created_at.split("T")[0];
    const cycleForDate = cycles.find(
      (c) => c.created_at.split("T")[0] === date
    );

    await db
      .insert(whoopRecovery)
      .values({
        date,
        recoveryScore: rec.score.recovery_score,
        hrvRmssd: rec.score.hrv_rmssd_milli,
        restingHeartRate: rec.score.resting_heart_rate,
        sleepPerformance: rec.sleep?.score?.sleep_performance_percentage ?? null,
        sleepDurationMs: rec.sleep?.score?.total_sleep_duration_milli ?? null,
        strain: cycleForDate?.score?.strain ?? null,
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
        },
      });
  }

  return NextResponse.json({
    synced: recoveries.length,
    newRefreshToken: tokens.refresh_token,
  });
}
