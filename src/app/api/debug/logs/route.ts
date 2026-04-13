import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { debugLog } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const logs = await db.select().from(debugLog).orderBy(desc(debugLog.timestamp)).limit(20);
  return NextResponse.json({ logs });
}
