import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { whoopTokens } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const stored = await db.select().from(whoopTokens).orderBy(desc(whoopTokens.updatedAt)).limit(1);

  if (stored.length === 0) {
    return NextResponse.json({ error: "No tokens in DB. Re-auth with WHOOP first." });
  }

  const t = stored[0];
  return NextResponse.json({
    expiresAt: t.expiresAt,
    updatedAt: t.updatedAt,
    isExpired: t.expiresAt < new Date(),
    refreshTokenPrefix: t.refreshToken.substring(0, 10) + "...",
  });
}
