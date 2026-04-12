import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { weightLog } from "@/db/schema";
import { sql } from "drizzle-orm";

const WEIGHT_NAMES = [
  "body_mass",
  "weight",
  "weight_body_mass",
  "body_weight",
  "lean_body_mass",
  "Weight",
  "Body Mass",
];

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  console.log("Webhook raw body:", rawBody.substring(0, 1000));

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", received: rawBody.substring(0, 200) },
      { status: 400 }
    );
  }

  // Health Auto Export can send in multiple formats
  const metrics = body.data?.metrics ?? body.metrics ?? [];

  // Try to find weight metric by name
  let weightMetric = metrics.find((m: { name: string }) =>
    WEIGHT_NAMES.some(
      (n) => m.name?.toLowerCase() === n.toLowerCase()
    )
  );

  // If no match, log all metric names and try the first metric with numeric data
  if (!weightMetric) {
    const metricNames = metrics.map((m: { name: string }) => m.name);
    console.log("Available metrics:", JSON.stringify(metricNames));

    // Try first metric that has data with a qty or value field
    weightMetric = metrics.find(
      (m: { data?: { qty?: number; value?: number }[] }) =>
        m.data?.some(
          (d: { qty?: number; value?: number }) =>
            d.qty !== undefined || d.value !== undefined
        )
    );
  }

  if (!weightMetric?.data?.length) {
    return NextResponse.json(
      {
        error: "No weight data found",
        availableMetrics: metrics.map((m: { name: string }) => m.name),
      },
      { status: 400 }
    );
  }

  const db = getDb();
  let inserted = 0;

  for (const entry of weightMetric.data) {
    const dateStr = entry.date ?? entry.timestamp;
    if (!dateStr) continue;
    const date = String(dateStr).split("T")[0];
    const weightKg = entry.qty ?? entry.value;

    if (!date || !weightKg || typeof weightKg !== "number") continue;

    await db
      .insert(weightLog)
      .values({ date, weightKg, source: "health_auto_export" })
      .onConflictDoUpdate({
        target: weightLog.date,
        set: {
          weightKg: sql`excluded.weight_kg`,
          source: sql`excluded.source`,
        },
      });
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted, metric: weightMetric.name });
}
