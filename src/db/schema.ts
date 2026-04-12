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
  source: text("source").default("health_auto_export"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyInsight = pgTable("daily_insight", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  weightTrend: text("weight_trend"),
  sleepCorrelation: text("sleep_correlation"),
  workoutPrescription: text("workout_prescription"),
  insightText: text("insight_text").notNull(),
  recoveryScore: real("recovery_score"),
  weightKg: real("weight_kg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
