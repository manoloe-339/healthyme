import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { weightLog } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.WEBHOOK_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Health Auto Export sends data in this format
  const metrics = body.data?.metrics ?? body.metrics ?? [];
  const weightMetric = metrics.find(
    (m: { name: string }) =>
      m.name === "body_mass" || m.name === "weight"
  );

  if (!weightMetric?.data?.length) {
    return NextResponse.json({ error: "No weight data found" }, { status: 400 });
  }

  const db = getDb();

  for (const entry of weightMetric.data) {
    const date =
      entry.date?.split("T")[0] ??
      new Date(entry.timestamp ?? entry.date).toISOString().split("T")[0];
    const weightKg = entry.qty ?? entry.value;

    if (!date || !weightKg) continue;

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
  }

  return NextResponse.json({ ok: true });
}
