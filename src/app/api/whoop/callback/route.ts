import { NextRequest, NextResponse } from "next/server";
import { exchangeWhoopCode } from "@/lib/whoop";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { whoopTokens } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await exchangeWhoopCode(code);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Token exchange failed" },
      { status: 500 }
    );
  }

  // Store tokens in DB for cron access
  const db = getDb();
  await db
    .insert(whoopTokens)
    .values({
      id: 1,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expires_at),
    })
    .onConflictDoUpdate({
      target: whoopTokens.id,
      set: {
        accessToken: sql`excluded.access_token`,
        refreshToken: sql`excluded.refresh_token`,
        expiresAt: sql`excluded.expires_at`,
        updatedAt: sql`now()`,
      },
    });

  // Also set cookies for browser session
  const cookieStore = await cookies();
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

  return NextResponse.redirect(new URL("/", request.url));
}
