import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const insightSchema = z.object({
  weightTrend: z.string().describe("Description of weight trend over the window"),
  sleepCorrelation: z.string().describe("How sleep performance and duration correlate with weight changes"),
  nutritionAssessment: z.string().describe("Assessment of calorie and protein intake relative to recomp goals").optional(),
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
    sleepDurationMs: number | null;
    strain: number | null;
  }[];
  weightData: {
    date: string;
    weightKg: number;
    bodyFatPct: number | null;
    leanBodyMassKg: number | null;
  }[];
  nutritionData?: {
    date: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    totalFat: number | null;
  }[];
  activityData?: {
    date: string;
    steps: number | null;
    activeEnergy: number | null;
  }[];
  todayRecovery: number;
}

export async function generateDailyInsight(input: InsightInput): Promise<Insight> {
  const { recoveryData, weightData, nutritionData, activityData, todayRecovery } = input;

  const kgToLbs = (kg: number) => (kg * 2.20462).toFixed(1);

  let prompt = `You are a body recomposition coach analyzing biometric data for a client who wants to lose fat while preserving muscle. Weight is shown in lbs.

## Data (last 3-5 days)

### Recovery & Sleep (from WHOOP)
${recoveryData.map((r) => `- ${r.date}: Recovery ${r.recoveryScore}%, Sleep Perf ${r.sleepPerformance ?? "N/A"}%, Sleep ${r.sleepDurationMs ? (r.sleepDurationMs / 3600000).toFixed(1) + "h" : "N/A"}, HRV ${r.hrvRmssd ?? "N/A"}ms, Strain ${r.strain ?? "N/A"}`).join("\n")}

### Weight & Body Composition
${weightData.map((w) => `- ${w.date}: ${kgToLbs(w.weightKg)} lbs${w.bodyFatPct ? `, BF ${w.bodyFatPct.toFixed(1)}%` : ""}${w.leanBodyMassKg ? `, Lean ${kgToLbs(w.leanBodyMassKg)} lbs` : ""}`).join("\n")}`;

  if (nutritionData && nutritionData.length > 0) {
    prompt += `

### Nutrition (from Apple Health)
${nutritionData.map((n) => `- ${n.date}: ${n.calories ? Math.round(n.calories) + " kcal" : "not logged"}, Protein ${n.protein ? Math.round(n.protein) + "g" : "N/A"}, Carbs ${n.carbs ? Math.round(n.carbs) + "g" : "N/A"}, Fat ${n.totalFat ? Math.round(n.totalFat) + "g" : "N/A"}`).join("\n")}`;
  } else {
    prompt += `

### Nutrition
Not tracked — recommend the client start logging meals for better insights.`;
  }

  if (activityData && activityData.length > 0) {
    prompt += `

### Daily Activity
${activityData.map((a) => `- ${a.date}: ${a.steps ? a.steps.toLocaleString() + " steps" : "N/A"}, Active burn ${a.activeEnergy ? Math.round(a.activeEnergy) + " kcal" : "N/A"}`).join("\n")}`;
  }

  prompt += `

### Today's Recovery Score: ${todayRecovery}%

## Rules
- If 2+ consecutive days have sleep performance < 70%, flag metabolic risk to weight loss
- If sleep duration < 7h, note this impairs recovery and fat loss
- Recovery >= 67%: recommend high intensity (rowing intervals or heavy gym session)
- Recovery 34-66%: recommend moderate (steady-state rowing or light gym)
- Recovery < 34%: recommend active recovery only (walk or stretch)
- For recomp: protein should be ~1g per lb of target body weight (~180-200g/day)
- If calories are logged and below 1500, warn about metabolic adaptation risk
- If calories are logged and protein is below 150g, flag it
- Explain WHY weight moved based on sleep/recovery/strain/nutrition correlation
- If body fat % is trending, comment on whether fat loss vs muscle loss
- Be direct, specific, and actionable`;

  const result = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    output: Output.object({ schema: insightSchema }),
    prompt,
  });

  return result.output!;
}
