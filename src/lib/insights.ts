import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import userContext from "./user-context.json";

const insightSchema = z.object({
  weightTrend: z.string().describe("Description of weight trend over the window"),
  sleepCorrelation: z.string().describe("How sleep performance and duration correlate with weight changes"),
  nutritionCorrelation: z.string().describe("How macros (protein, carbs, fat, calories) correlate with WHOOP recovery, strain, and weight changes. Note patterns like high protein days vs recovery, calorie deficit vs strain tolerance, carb timing vs sleep quality.").optional(),
  nutritionImpact: z.string().describe("Two-part analysis of diet: (1) BACKWARD-LOOKING: how what was eaten in the last few days likely impacted sleep quality, recovery scores, energy levels, and how the body feels today. (2) FORWARD-LOOKING: based on current nutrition patterns, what to expect for tonight's sleep, tomorrow's recovery, and exercise performance — and specific dietary actions to take today (what to eat, how much protein, whether to increase carbs before a workout, etc).").optional(),
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

  const uc = userContext;
  const nextMilestone = Object.entries(uc.monthlyMilestones).find(
    ([, target]) => (weightData[0]?.weightKg * 2.20462) > target
  );

  let prompt = `You are ${uc.name}'s personal body recomposition coach. You know his protocol intimately and judge everything against it — not generic fitness norms.

## Client Profile
${uc.personal.sex}, ${uc.personal.height}, ${uc.personal.age} years old

## Goal
${uc.goal.startWeight} lbs (${uc.goal.startDate}) → ${uc.goal.targetWeight} lbs by ${uc.goal.targetDate}, sustained ${uc.goal.sustainedWeeks} weeks minimum.
Current: ~${uc.goal.currentWeight} lbs as of ${uc.goal.currentAsOf}.
${nextMilestone ? `Next milestone: ${nextMilestone[1]} lbs by ${nextMilestone[0]}` : "All milestones hit."}

## Critical Historical Context
${uc.historicalPattern.summary}
Key data: 2022 dropped to 183, fully regained by late 2023 (~227). 2024 flat at ~229. This cut MUST be different.

## Protocol
- **Eating:** ${uc.eatingProtocol.type} (${uc.eatingProtocol.window}). ${uc.eatingProtocol.orientation}. ${uc.eatingProtocol.decisionFilter}.
- **Protein:** ${uc.proteinStrategy.dailyMinimum} daily from: ${uc.proteinStrategy.primarySources}
- **Supplements:** ${uc.supplements}
- **Training:** ${uc.workoutSplit.pattern}. ${uc.workoutSplit.dailySteps} steps. ${uc.workoutSplit.details}
- **Refeeds:** ${uc.refeedCadence.frequency}. ${uc.refeedCadence.protocol}. ${uc.refeedCadence.purpose}. ${uc.refeedCadence.trigger}

## Expected Pace
Apr-Jun: ${uc.expectedPace.aprJun}
Jul-Aug: ${uc.expectedPace.julAug}
Sep-Oct: ${uc.expectedPace.sepOct}

## Coaching Profile
${uc.coachingProfile.experience}. ${uc.coachingProfile.style}
PRIMARY RISK: ${uc.coachingProfile.primaryRisk}

## Insight Rules
- ${uc.insightRules.sleepWarning}
- ${uc.insightRules.rollingWindow}
- ${uc.insightRules.workoutPrescription}
- ${uc.insightRules.stallInterpretation}
- ${uc.insightRules.refeedTiming}
- Recovery < 50%: ${uc.insightRules.recoveryThresholds.below50}
- Recovery 50-70%: ${uc.insightRules.recoveryThresholds["50to70"]}
- Recovery > 70%: ${uc.insightRules.recoveryThresholds.above70}
- ${uc.insightRules.metabolicRisk}

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
- Judge ALL data against the protocol above — not generic advice
- This is an experienced dieter who has done this before. No basic education. Specific data-driven coaching only.
- Reference the monthly milestones — is he on track for the next one?
- Protein must hit ${uc.proteinStrategy.dailyMinimum} within the OMAD window. Flag if under.
- If body fat % is trending, comment on fat loss vs muscle loss — muscle preservation is priority
- Distinguish water retention stalls from true metabolic adaptation
- Factor where we are in the expected pace (Apr-Jun fast, Jul-Aug grind, Sep-Oct hard yards)
- If recovery has declined 3+ days, suggest a refeed per protocol
- Be direct, reference specific numbers from the data, no generic platitudes
- NEVER say "consider" or "you might want to" — say "do this"

## Nutrition-Recovery Correlation Analysis
For the nutritionCorrelation field, specifically analyze:
- Do higher protein days precede better WHOOP recovery scores the next day?
- Does calorie deficit size correlate with lower recovery or higher perceived strain?
- Is there a pattern between carb intake and sleep quality/duration?
- Does fat intake level affect next-day HRV?
- Are there any visible macro ratios that coincide with weight drops vs stalls?
- If nutrition is not logged, say "No nutrition data logged — start tracking meals to unlock macro-recovery correlations."

## Diet Impact Analysis (nutritionImpact field)
This MUST have two clearly labeled parts:

**PART 1 — How what you ate affected you:**
- How did the last 2-3 days of eating likely impact today's recovery score, sleep quality, energy, and how the body feels?
- Was protein sufficient to support muscle repair after strain?
- Did low carb intake hurt sleep quality or recovery?
- Did a calorie deficit cause higher perceived exertion or lower HRV?
- Be specific about which meals/days caused which effects

**PART 2 — What to expect and what to do today:**
- Based on current nutrition patterns, predict tonight's sleep quality and tomorrow's recovery
- Give specific dietary actions for today: exact protein target, whether to add carbs pre-workout, hydration needs
- If there's a workout today, what to eat before and after
- If nutrition has been too low, prescribe a recovery eating plan for today
- If nutrition is not logged, say "No nutrition data — log meals today to get personalized diet guidance tomorrow."`;

  const result = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    output: Output.object({ schema: insightSchema }),
    prompt,
  });

  return result.output!;
}
