import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchRecovery, fetchCycles, fetchSleep, refreshWhoopToken } from "@/lib/whoop";
import { getDb } from "@/db";
import { whoopRecovery } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("whoop_access_token")?.value;
  const refreshToken = cookieStore.get("whoop_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    const tokens = await refreshWhoopToken(refreshToken);
    accessToken = tokens.access_token;
    cookieStore.set("whoop_access_token", tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });
    cookieStore.set("whoop_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated with WHOOP" }, { status: 401 });
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

  // Log raw sleep data for debugging
  console.log(`Sleep records: ${sleeps.length}`);
  sleeps.forEach((s) => {
    console.log(`Sleep: end=${s.end}, score_state=${s.score_state}, score=${JSON.stringify(s.score).substring(0, 200)}`);
  });

  // Index sleep by date (use the end time as the "night of" date)
  const sleepByDate = new Map(
    sleeps
      .filter((s) => s.score_state === "SCORED")
      .map((s) => {
        const date = s.end.split("T")[0];
        const totalSleep =
          s.score.total_sleep_duration_milli ??
          (s.score.total_light_sleep_time_milli ?? 0) +
          (s.score.total_slow_wave_sleep_time_milli ?? 0) +
          (s.score.total_rem_sleep_time_milli ?? 0);
        return [date, {
          performance: s.score.sleep_performance_percentage,
          durationMs: totalSleep,
        }];
      })
  );

  const db = getDb();

  console.log("Sleep dates indexed:", Array.from(sleepByDate.keys()));
  console.log("Recovery dates:", recoveries.map((r) => r.created_at.split("T")[0]));

  for (const rec of recoveries) {
    const date = rec.created_at.split("T")[0];
    const cycleForDate = cycles.find(
      (c) => c.created_at.split("T")[0] === date
    );
    const sleep = sleepByDate.get(date);
    console.log(`Date ${date}: sleep match=${!!sleep}, durationMs=${sleep?.durationMs}`);

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
    sleepRecords: sleeps.length,
  });
}
