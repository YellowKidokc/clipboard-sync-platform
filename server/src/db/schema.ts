import { boolean, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  platform: text("platform").notNull()
});

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  pathTemplate: text("path_template").notNull()
});

export const clips = pgTable("clips", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  deviceId: uuid("device_id").references(() => devices.id),
  contentType: text("content_type").notNull(),
  textContent: text("text_content"),
  blobUrl: text("blob_url"),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  folderId: uuid("folder_id").references(() => folders.id),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isStarred: boolean("is_starred").default(false).notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  hotkeySlot: integer("hotkey_slot"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  matchType: text("match_type").notNull(),
  pattern: text("pattern").notNull(),
  action: text("action").notNull(),
  params: jsonb("params").$type<Record<string, unknown>>().default({}).notNull(),
  priority: integer("priority").default(100).notNull(),
  enabled: boolean("enabled").default(true).notNull()
});

export const predictions = pgTable("predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  predictedContent: text("predicted_content").notNull(),
  actualContent: text("actual_content"),
  confidence: real("confidence").notNull(),
  wasCorrect: boolean("was_correct"),
  context: jsonb("context").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const predictionStats = pgTable("prediction_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  windowSize: integer("window_size").notNull().default(100),
  accuracy: real("accuracy").notNull().default(0),
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctPredictions: integer("correct_predictions").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  clipId: uuid("clip_id").references(() => clips.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  workflow: text("workflow"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
