import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const insightSchema = z.object({
  weightTrend: z.string().describe("Description of weight trend over the window"),
  sleepCorrelation: z.string().describe("How sleep performance correlates with weight changes"),
  workoutPrescription: z.string().describe("Recommended workout type and intensity for tomorrow"),
  insightText: z.string().describe("Full natural-language daily insight paragraph"),
});

export type Insight = z.infer<typeof insightSchema>;

interface InsightInput {
  recoveryData: {
    date: string;
    recoveryScore: number;
    hrvRmssd: number | null;
    sleepPerformance: number | null;
    strain: number | null;
  }[];
  weightData: {
    date: string;
    weightKg: number;
  }[];
  todayRecovery: number;
}

export async function generateDailyInsight(input: InsightInput): Promise<Insight> {
  const { recoveryData, weightData, todayRecovery } = input;

  const prompt = `You are a body recomposition coach analyzing biometric data.

## Data (last 3-5 days)

### Recovery & Sleep
${recoveryData.map((r) => `- ${r.date}: Recovery ${r.recoveryScore}%, Sleep ${r.sleepPerformance ?? "N/A"}%, HRV ${r.hrvRmssd ?? "N/A"}ms, Strain ${r.strain ?? "N/A"}`).join("\n")}

### Weight
${weightData.map((w) => `- ${w.date}: ${w.weightKg} kg`).join("\n")}

### Today's Recovery Score: ${todayRecovery}%

## Rules
- If 2+ consecutive days have sleep performance < 70%, flag metabolic risk to weight loss
- Recovery >= 67%: recommend high intensity (rowing intervals or heavy gym session)
- Recovery 34-66%: recommend moderate (steady-state rowing or light gym)
- Recovery < 34%: recommend active recovery only (walk or stretch)
- Explain WHY weight moved based on sleep/recovery/strain correlation
- Be direct, specific, and actionable`;

  const result = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    output: Output.object({ schema: insightSchema }),
    prompt,
  });

  return result.output!;
}
