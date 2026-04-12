import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { weightLog } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  // Auth check temporarily disabled for debugging
  // const authHeader = request.headers.get("authorization");
  // const expectedToken = process.env.WEBHOOK_SECRET;
  // if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  const rawBody = await request.text();
  console.log("Webhook received:", rawBody.substring(0, 500));

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON", received: rawBody.substring(0, 200) }, { status: 400 });
  }

  // Health Auto Export sends data in various formats
  const metrics = body.data?.metrics ?? body.metrics ?? [];
  const weightMetric = metrics.find(
    (m: { name: string }) =>
      m.name === "body_mass" || m.name === "weight"
  );

  if (!weightMetric?.data?.length) {
    return NextResponse.json({ error: "No weight data found", body }, { status: 400 });
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
