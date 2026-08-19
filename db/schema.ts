import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const families = sqliteTable("families", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  ownerName: text("owner_name").notNull(),
  parentName: text("parent_name").notNull(),
  parentLocation: text("parent_location").notNull().default(""),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  alertWindowMinutes: integer("alert_window_minutes").notNull().default(120),
  notificationEmail: text("notification_email").notNull().default(""),
  emailAlertsEnabled: integer("email_alerts_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("families_owner_email_unique").on(table.ownerEmail)]);

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  accessToken: text("access_token").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("members_access_token_unique").on(table.accessToken), index("members_family_idx").on(table.familyId)]);

export const careItems = sqliteTable("care_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["medication", "appointment"] }).notNull(),
  title: text("title").notNull(),
  details: text("details").notNull().default(""),
  scheduledFor: text("scheduled_for").notNull(),
  status: text("status", { enum: ["pending", "completed", "missed"] }).notNull().default("pending"),
  completedAt: text("completed_at"),
  completedBy: text("completed_by"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [index("care_items_family_schedule_idx").on(table.familyId, table.scheduledFor), index("care_items_status_idx").on(table.status)]);

export const timelineEntries = sqliteTable("timeline_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  careItemId: integer("care_item_id").references(() => careItems.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["setup", "scheduled", "checkin", "note", "alert", "member"] }).notNull(),
  actor: text("actor").notNull(),
  message: text("message").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [index("timeline_family_created_idx").on(table.familyId, table.createdAt)]);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  careItemId: integer("care_item_id").references(() => careItems.id, { onDelete: "set null" }),
  channel: text("channel", { enum: ["email", "sms"] }).notNull().default("email"),
  recipient: text("recipient").notNull(),
  status: text("status", { enum: ["queued", "sent", "failed"] }).notNull().default("queued"),
  providerId: text("provider_id"),
  errorMessage: text("error_message"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
});
