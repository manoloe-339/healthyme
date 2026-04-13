import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchRecovery, fetchCycles, fetchSleep, refreshWhoopToken } from "@/lib/whoop";
import { getDb } from "@/db";
import { whoopRecovery, whoopTokens } from "@/db/schema";
import { sql, desc } from "drizzle-orm";

export async function GET() {
  const db = getDb();

  // Try cookies first, then DB tokens
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("whoop_access_token")?.value;
  const refreshToken = cookieStore.get("whoop_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    const tokens = await refreshWhoopToken(refreshToken);
    accessToken = tokens.access_token;
  }

  if (!accessToken) {
    const stored = await db.select().from(whoopTokens).orderBy(desc(whoopTokens.updatedAt)).limit(1);
    if (stored.length > 0) {
      if (stored[0].expiresAt > new Date()) {
        accessToken = stored[0].accessToken;
      } else {
        const tokens = await refreshWhoopToken(stored[0].refreshToken);
        accessToken = tokens.access_token;
        await db.insert(whoopTokens).values({
          id: 1, accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(tokens.expires_at),
        }).onConflictDoUpdate({
          target: whoopTokens.id,
          set: {
            accessToken: sql`excluded.access_token`,
            refreshToken: sql`excluded.refresh_token`,
            expiresAt: sql`excluded.expires_at`,
            updatedAt: sql`now()`,
          },
        });
      }
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const startDate = "2026-04-01";
  const endDate = new Date().toISOString().split("T")[0];

  const [recoveries, cycles, sleeps] = await Promise.all([
    fetchRecovery(accessToken, startDate, endDate),
    fetchCycles(accessToken, startDate, endDate),
    fetchSleep(accessToken, startDate, endDate),
  ]);

  // Log all cycles with score_state
  const cycleLog = cycles.map((c) => ({
    date: c.start?.split("T")[0] ?? c.created_at.split("T")[0],
    score_state: c.score_state ?? "unknown",
    strain: c.score?.strain ?? null,
    kilojoule: c.score?.kilojoule ?? null,
    calories: c.score?.kilojoule ? Math.round(c.score.kilojoule * 0.239) : null,
  }));

  console.log("Backfill cycles:", JSON.stringify(cycleLog));

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

  // Index cycles by date (use start date)
  const cycleByDate = new Map(
    cycles.map((c) => {
      const date = c.start?.split("T")[0] ?? c.created_at.split("T")[0];
      return [date, c];
    })
  );

  let synced = 0;
  let updated = 0;

  for (const rec of recoveries) {
    const date = rec.created_at.split("T")[0];
    const cycle = cycleByDate.get(date);
    const sleep = sleepByDate.get(date);

    const kj = cycle?.score?.kilojoule ?? null;
    const calBurned = kj ? Math.round(kj * 0.239) : null;

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
        caloriesBurned: calBurned,
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
    synced++;

    if (calBurned) updated++;
  }

  return NextResponse.json({
    synced,
    updatedWithCalories: updated,
    cycleLog,
    sleepRecords: sleeps.length,
  });
}

export const maxDuration = 60;
