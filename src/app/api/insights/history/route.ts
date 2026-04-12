import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { dailyInsight } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const db = getDb();

  const insights = await db
    .select()
    .from(dailyInsight)
    .orderBy(desc(dailyInsight.date))
    .limit(30);

  return NextResponse.json({ insights });
}
