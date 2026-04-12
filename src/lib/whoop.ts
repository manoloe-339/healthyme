const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface WhoopRecoveryData {
  score: {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
  };
  sleep: {
    id: number;
    score: {
      sleep_performance_percentage: number;
      total_sleep_duration_milli: number;
    };
  };
  created_at: string;
}

export interface WhoopCycleData {
  score: {
    strain: number;
  };
  created_at: string;
}

export function getWhoopAuthUrl() {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    response_type: "code",
    scope: "read:recovery read:sleep read:workout read:cycles read:profile offline",
    state,
  });
  return { url: `https://api.prod.whoop.com/oauth/oauth2/auth?${params}`, state };
}

export async function exchangeWhoopCode(code: string): Promise<WhoopTokens> {
  const basicAuth = Buffer.from(
    `${process.env.WHOOP_CLIENT_ID!}:${process.env.WHOOP_CLIENT_SECRET!}`
  ).toString("base64");

  const res = await fetch(
    "https://api.prod.whoop.com/oauth/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.WHOOP_REDIRECT_URI!,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    console.error("WHOOP token exchange failed:", res.status, JSON.stringify(data));
    throw new Error(`WHOOP token exchange failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshWhoopToken(
  refreshToken: string
): Promise<WhoopTokens> {
  const basicAuth = Buffer.from(
    `${process.env.WHOOP_CLIENT_ID!}:${process.env.WHOOP_CLIENT_SECRET!}`
  ).toString("base64");

  const res = await fetch(
    "https://api.prod.whoop.com/oauth/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );
  if (!res.ok) throw new Error(`WHOOP token refresh failed: ${res.status}`);
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function fetchRecovery(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<WhoopRecoveryData[]> {
  const params = new URLSearchParams({
    start: `${startDate}T00:00:00.000Z`,
    end: `${endDate}T23:59:59.999Z`,
  });
  const res = await fetch(
    `${WHOOP_API_BASE}/recovery?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`WHOOP recovery fetch failed: ${res.status}`);
  const data = await res.json();
  return data.records ?? [];
}

export async function fetchCycles(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<WhoopCycleData[]> {
  const params = new URLSearchParams({
    start: `${startDate}T00:00:00.000Z`,
    end: `${endDate}T23:59:59.999Z`,
  });
  const res = await fetch(
    `${WHOOP_API_BASE}/cycle?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`WHOOP cycles fetch failed: ${res.status}`);
  const data = await res.json();
  return data.records ?? [];
}
