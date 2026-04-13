const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface WhoopRecoveryData {
  cycle_id: number;
  sleep_id: string;
  score_state: string;
  score: {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
  created_at: string;
}

export interface WhoopSleepData {
  id: string;
  score_state: string;
  score: {
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
    total_in_bed_time_milli: number;
    total_awake_time_milli: number;
    total_light_sleep_time_milli: number;
    total_slow_wave_sleep_time_milli: number;
    total_rem_sleep_time_milli: number;
    total_sleep_duration_milli?: number;
  };
  start: string;
  end: string;
  created_at: string;
}

export interface WhoopCycleData {
  score_state: string;
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
  start: string;
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
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
  });
  console.log("Token exchange body params:", {
    grant_type: "authorization_code",
    code: code.substring(0, 10) + "...",
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret_length: process.env.WHOOP_CLIENT_SECRET!.length,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
  });

  const res = await fetch(
    "https://api.prod.whoop.com/oauth/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
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
  const res = await fetch(
    "https://api.prod.whoop.com/oauth/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.WHOOP_CLIENT_ID!,
        client_secret: process.env.WHOOP_CLIENT_SECRET!,
        scope: "offline",
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

export async function fetchSleep(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<WhoopSleepData[]> {
  const params = new URLSearchParams({
    start: `${startDate}T00:00:00.000Z`,
    end: `${endDate}T23:59:59.999Z`,
  });
  const res = await fetch(
    `${WHOOP_API_BASE}/activity/sleep?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`WHOOP sleep fetch failed: ${res.status}`);
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
