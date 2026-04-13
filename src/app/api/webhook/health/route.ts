import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { weightLog, dailyNutrition, dailyActivity, debugLog } from "@/db/schema";
import { sql, lt } from "drizzle-orm";

function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
}

function getMetric(metrics: Record<string, unknown>[], name: string) {
  return metrics.find(
    (m: Record<string, unknown>) =>
      (m.name as string)?.toLowerCase() === name.toLowerCase()
  ) as { name: string; units: string; data: { date: string; qty: number }[] } | undefined;
}

function parseDate(dateStr: string): string {
  // Handle both "2025-01-20T14:30:00Z" and "2025-01-20 14:30:00 Z"
  return String(dateStr).split(/[T ]/)[0];
}

function sumByDate(data: { date: string; qty: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of data) {
    const date = parseDate(entry.date);
    map.set(date, (map.get(date) ?? 0) + (entry.qty ?? 0));
  }
  return map;
}

function latestByDate(data: { date: string; qty: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of data) {
    const date = parseDate(entry.date);
    map.set(date, entry.qty ?? 0);
  }
  return map;
}

export const maxDuration = 60;

async function logRequest(db: ReturnType<typeof getDb>, method: string, path: string, headers: string, bodyPreview: string, bodySize: number, responseStatus: number, responseBody: string, metricsFound: string) {
  try {
    await db.insert(debugLog).values({ method, path, headers, bodyPreview, bodySize, responseStatus, responseBody, metricsFound });
    // Keep only last 20
    const all = await db.select({ id: debugLog.id }).from(debugLog).orderBy(sql`id DESC`).limit(1).offset(20);
    if (all.length > 0) {
      await db.delete(debugLog).where(lt(debugLog.id, all[0].id));
    }
  } catch (e) {
    console.error("Debug log error:", e);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const reqHeaders = JSON.stringify({
    "content-type": request.headers.get("content-type"),
    "authorization": request.headers.get("authorization") ? "Bearer ***" : null,
    "user-agent": request.headers.get("user-agent"),
    "automation-name": request.headers.get("automation-name"),
    "automation-id": request.headers.get("automation-id"),
  });

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    const db = getDb();
    await logRequest(db, "POST", "/api/webhook/weight", reqHeaders, rawBody.substring(0, 500), rawBody.length, 400, "Invalid JSON", "");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const metrics = body.data?.metrics ?? body.metrics ?? [];
  const metricNames = metrics.map((m: { name: string }) => m.name).join(", ");

  if (!metrics.length) {
    const db = getDb();
    await logRequest(db, "POST", "/api/webhook/weight", reqHeaders, rawBody.substring(0, 500), rawBody.length, 400, "No metrics", metricNames);
    return NextResponse.json({ error: "No metrics" }, { status: 400 });
  }

  const db = getDb();
  const results: Record<string, number> = {};

  // --- Weight, body fat, lean body mass ---
  const weightMetric = getMetric(metrics, "weight_body_mass");
  const bodyFatMetric = getMetric(metrics, "body_fat_percentage");
  const leanMassMetric = getMetric(metrics, "lean_body_mass");

  if (weightMetric?.data?.length) {
    const unitStr = (weightMetric.units ?? "").toLowerCase();
    const isLbs = unitStr.includes("lb") || unitStr.includes("pound") || unitStr === "lbs";
    console.log(`Weight metric units: "${weightMetric.units}", isLbs: ${isLbs}`);

    const bodyFatByDate = bodyFatMetric ? latestByDate(bodyFatMetric.data) : new Map();
    const leanMassByDate = leanMassMetric ? latestByDate(leanMassMetric.data) : new Map();
    const leanMassIsLbs = leanMassMetric?.units?.toLowerCase().includes("lb");

    for (const entry of weightMetric.data) {
      const date = parseDate(entry.date);
      const weightKg = isLbs ? lbsToKg(entry.qty) : entry.qty;
      if (!date || !weightKg) continue;

      const bodyFat = bodyFatByDate.get(date) ?? null;
      const leanRaw = leanMassByDate.get(date) ?? null;
      const leanKg = leanRaw !== null && leanMassIsLbs ? lbsToKg(leanRaw) : leanRaw;

      await db
        .insert(weightLog)
        .values({ date, weightKg, bodyFatPct: bodyFat, leanBodyMassKg: leanKg, source: "health_auto_export" })
        .onConflictDoUpdate({
          target: weightLog.date,
          set: {
            weightKg: sql`excluded.weight_kg`,
            bodyFatPct: sql`excluded.body_fat_pct`,
            leanBodyMassKg: sql`excluded.lean_body_mass_kg`,
            source: sql`excluded.source`,
            createdAt: sql`now()`,
          },
        });
    }
    results.weight = weightMetric.data.length;
  }

  // --- Nutrition ---
  const calorieMetric = getMetric(metrics, "dietary_energy");
  const proteinMetric = getMetric(metrics, "protein");
  const carbMetric = getMetric(metrics, "carbohydrates");
  const fatMetric = getMetric(metrics, "total_fat");
  const fiberMetric = getMetric(metrics, "fiber");
  const sugarMetric = getMetric(metrics, "dietary_sugar");

  const nutritionDates = new Set<string>();
  [calorieMetric, proteinMetric, carbMetric, fatMetric, fiberMetric, sugarMetric].forEach((m) => {
    m?.data?.forEach((d) => nutritionDates.add(parseDate(d.date)));
  });

  if (nutritionDates.size > 0) {
    const cal = calorieMetric ? sumByDate(calorieMetric.data) : new Map();
    const pro = proteinMetric ? sumByDate(proteinMetric.data) : new Map();
    const carb = carbMetric ? sumByDate(carbMetric.data) : new Map();
    const fat = fatMetric ? sumByDate(fatMetric.data) : new Map();
    const fib = fiberMetric ? sumByDate(fiberMetric.data) : new Map();
    const sug = sugarMetric ? sumByDate(sugarMetric.data) : new Map();

    for (const date of nutritionDates) {
      await db
        .insert(dailyNutrition)
        .values({
          date,
          calories: cal.get(date) ?? null,
          protein: pro.get(date) ?? null,
          carbs: carb.get(date) ?? null,
          totalFat: fat.get(date) ?? null,
          fiber: fib.get(date) ?? null,
          sugar: sug.get(date) ?? null,
        })
        .onConflictDoUpdate({
          target: dailyNutrition.date,
          set: {
            calories: sql`excluded.calories`,
            protein: sql`excluded.protein`,
            carbs: sql`excluded.carbs`,
            totalFat: sql`excluded.total_fat`,
            fiber: sql`excluded.fiber`,
            sugar: sql`excluded.sugar`,
            createdAt: sql`now()`,
          },
        });
    }
    results.nutrition = nutritionDates.size;
  }

  // --- Activity ---
  const stepMetric = getMetric(metrics, "step_count");
  const activeEnergyMetric = getMetric(metrics, "active_energy");
  const exerciseMetric = getMetric(metrics, "apple_exercise_time");
  const flightsMetric = getMetric(metrics, "flights_climbed");
  const distanceMetric = getMetric(metrics, "walking_running_distance");

  const activityDates = new Set<string>();
  [stepMetric, activeEnergyMetric, exerciseMetric, flightsMetric, distanceMetric].forEach((m) => {
    m?.data?.forEach((d) => activityDates.add(parseDate(d.date)));
  });

  if (activityDates.size > 0) {
    const steps = stepMetric ? sumByDate(stepMetric.data) : new Map();
    const active = activeEnergyMetric ? sumByDate(activeEnergyMetric.data) : new Map();
    const exercise = exerciseMetric ? sumByDate(exerciseMetric.data) : new Map();
    const flights = flightsMetric ? sumByDate(flightsMetric.data) : new Map();
    const dist = distanceMetric ? sumByDate(distanceMetric.data) : new Map();

    for (const date of activityDates) {
      await db
        .insert(dailyActivity)
        .values({
          date,
          steps: steps.get(date) ? Math.round(steps.get(date)!) : null,
          activeEnergy: active.get(date) ?? null,
          exerciseMinutes: exercise.get(date) ?? null,
          flightsClimbed: flights.get(date) ? Math.round(flights.get(date)!) : null,
          walkingDistance: dist.get(date) ?? null,
        })
        .onConflictDoUpdate({
          target: dailyActivity.date,
          set: {
            steps: sql`excluded.steps`,
            activeEnergy: sql`excluded.active_energy`,
            exerciseMinutes: sql`excluded.exercise_minutes`,
            flightsClimbed: sql`excluded.flights_climbed`,
            walkingDistance: sql`excluded.walking_distance_mi`,
            createdAt: sql`now()`,
          },
        });
    }
    results.activity = activityDates.size;
    console.log("Steps by date:", Object.fromEntries(steps));
    console.log("Active energy by date:", Object.fromEntries(active));
    console.log("Exercise mins by date:", Object.fromEntries(exercise));
  }

  const response = { ok: true, results };
  // Sample first entry dates for each metric type
  const dateSample = metrics.slice(0, 5).map((m: { name: string; data?: { date: string }[] }) =>
    `${m.name}: ${m.data?.[0]?.date ?? "no data"}`
  ).join(" | ");
  await logRequest(db, "POST", "/api/webhook/weight", reqHeaders, dateSample, rawBody.length, 200, JSON.stringify(response), metricNames);
  return NextResponse.json(response);
}
