import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { profiles } from "./profiles";

// State only — step definitions live in the derived project's code.
export const onboardingState = pgTable("onboarding_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  flow: text("flow").notNull(),
  completedSteps: jsonb("completed_steps").notNull().default([]),
  dismissed: boolean("dismissed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OnboardingState = typeof onboardingState.$inferSelect;
