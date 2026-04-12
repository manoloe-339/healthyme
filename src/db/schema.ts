import {
  pgTable,
  serial,
  text,
  timestamp,
  real,
  integer,
  date,
} from "drizzle-orm/pg-core";

export const whoopRecovery = pgTable("whoop_recovery", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  recoveryScore: real("recovery_score").notNull(),
  hrvRmssd: real("hrv_rmssd"),
  restingHeartRate: real("resting_heart_rate"),
  sleepPerformance: real("sleep_performance"),
  sleepDurationMs: integer("sleep_duration_ms"),
  strain: real("strain"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weightLog = pgTable("weight_log", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  weightKg: real("weight_kg").notNull(),
  bodyFatPct: real("body_fat_pct"),
  leanBodyMassKg: real("lean_body_mass_kg"),
  source: text("source").default("health_auto_export"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyNutrition = pgTable("daily_nutrition", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  calories: real("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  totalFat: real("total_fat"),
  fiber: real("fiber"),
  sugar: real("sugar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyActivity = pgTable("daily_activity", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  steps: integer("steps"),
  activeEnergy: real("active_energy"),
  exerciseMinutes: real("exercise_minutes"),
  flightsClimbed: integer("flights_climbed"),
  walkingDistance: real("walking_distance_mi"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const whoopTokens = pgTable("whoop_tokens", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dailyInsight = pgTable("daily_insight", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  weightTrend: text("weight_trend"),
  sleepCorrelation: text("sleep_correlation"),
  nutritionCorrelation: text("nutrition_correlation"),
  nutritionImpact: text("nutrition_impact"),
  workoutPrescription: text("workout_prescription"),
  insightText: text("insight_text").notNull(),
  recoveryScore: real("recovery_score"),
  weightKg: real("weight_kg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
