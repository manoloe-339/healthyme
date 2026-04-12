import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { weightLog, dailyNutrition, dailyActivity } from "@/db/schema";
import { sql } from "drizzle-orm";

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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const metrics = body.data?.metrics ?? body.metrics ?? [];

  if (!metrics.length) {
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
          },
        });
    }
    results.activity = activityDates.size;
    console.log("Steps by date:", Object.fromEntries(steps));
    console.log("Active energy by date:", Object.fromEntries(active));
    console.log("Exercise mins by date:", Object.fromEntries(exercise));
  }

  return NextResponse.json({ ok: true, results });
}
