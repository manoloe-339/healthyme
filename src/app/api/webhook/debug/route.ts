import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const metrics = body.data?.metrics ?? body.metrics ?? [];

  // Show full data for key metrics, summary for the rest
  const keyMetrics = ["step_count", "active_energy", "apple_exercise_time", "weight_body_mass"];

  const summary = metrics.map((m: Record<string, unknown>) => {
    const isKey = keyMetrics.includes(m.name as string);
    const data = m.data as { date: string; qty: number; source?: string }[];
    return {
      name: m.name,
      units: m.units,
      dataPoints: data?.length ?? 0,
      ...(isKey && data?.length <= 20
        ? { data: data.slice(0, 10) }
        : { sampleValue: data?.[0]?.qty }),
    };
  });

  return NextResponse.json({ metricCount: metrics.length, metrics: summary });
}
