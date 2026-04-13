import { getDb } from "@/db";
import { whoopTokens } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { refreshWhoopToken } from "./whoop";

/**
 * Single source of truth for WHOOP access tokens.
 * All endpoints MUST use this function — never refresh tokens directly.
 *
 * Flow:
 * 1. Read latest tokens from DB
 * 2. If access token is still valid (with 5 min buffer), return it
 * 3. If expired, refresh using the DB refresh token
 * 4. Save new tokens to DB immediately
 * 5. Return the fresh access token
 */
export async function getWhoopAccessToken(): Promise<string> {
  const db = getDb();

  const stored = await db
    .select()
    .from(whoopTokens)
    .orderBy(desc(whoopTokens.updatedAt))
    .limit(1);

  if (stored.length === 0) {
    throw new Error("No WHOOP tokens in database. Re-authenticate via dashboard.");
  }

  const t = stored[0];

  // Check if access token is still valid (5 min buffer)
  const bufferMs = 5 * 60 * 1000;
  if (t.expiresAt.getTime() > Date.now() + bufferMs) {
    return t.accessToken;
  }

  // Access token expired — refresh it
  console.log("WHOOP access token expired, refreshing...");
  const tokens = await refreshWhoopToken(t.refreshToken);

  // Save new tokens to DB immediately
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

  console.log("WHOOP tokens refreshed and saved to DB");
  return tokens.access_token;
}
