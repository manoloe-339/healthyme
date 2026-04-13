import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopRecovery, whoopTokens } from "@/db/schema";
import { fetchRecovery, fetchCycles, fetchSleep, refreshWhoopToken } from "@/lib/whoop";
import { sql, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Get tokens from DB
  const stored = await db.select().from(whoopTokens).orderBy(desc(whoopTokens.updatedAt)).limit(1);
  if (stored.length === 0) {
    return NextResponse.json({ error: "No WHOOP tokens. Auth via dashboard first." }, { status: 400 });
  }

  let accessToken: string;
  const t = stored[0];

  if (t.expiresAt > new Date()) {
    accessToken = t.accessToken;
  } else {
    const tokens = await refreshWhoopToken(t.refreshToken);
    accessToken = tokens.access_token;
    await db
      .insert(whoopTokens)
      .values({
        id: 1,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at),
      })
      .onConflictDoUpdate({
        target: whoopTokens.id,
        set: {
          accessToken: sql`excluded.access_token`,
          refreshToken: sql`excluded.refresh_token`,
          expiresAt: sql`excluded.expires_at`,
          updatedAt: sql`now()`,
        },
      });
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

  for (const rec of recoveries) {
    const date = rec.created_at.split("T")[0];
    const cycleForDate = cycles.find(
      (c) => c.created_at.split("T")[0] === date
    );
    const sleep = sleepByDate.get(date);

    await db
      .insert(whoopRecovery)
      .values({
        date,
        recoveryScore: rec.score.recovery_score,
        hrvRmssd: rec.score.hrv_rmssd_milli,
        restingHeartRate: rec.score.resting_heart_rate,
        sleepPerformance: sleep?.performance ?? null,
        sleepDurationMs: sleep?.durationMs ?? null,
        strain: cycleForDate?.score?.strain ?? null,
        kilojoules: cycleForDate?.score?.kilojoule ?? null,
        caloriesBurned: cycleForDate?.score?.kilojoule ? Math.round(cycleForDate.score.kilojoule * 0.239) : null,
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
