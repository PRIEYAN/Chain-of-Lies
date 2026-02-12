/**
 * Database schema definitions using Drizzle ORM
 * Add your table definitions here
 */
import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: text("id").primaryKey(),
  phase: text("phase").notNull().default("LOBBY"),
  round: integer("round").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  gameId: text("game_id").references(() => games.id),
  username: text("username").notNull(),
  isHost: boolean("is_host").notNull().default(false),
  isConnected: boolean("is_connected").notNull().default(true),
  role: text("role"),
  isTamperer: boolean("is_tamperer").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(),
  gameId: text("game_id").references(() => games.id),
  playerId: text("player_id").references(() => players.id),
  round: integer("round").notNull(),
  role: text("role").notNull(),
  payload: jsonb("payload"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: text("id").primaryKey(),
  gameId: text("game_id").references(() => games.id),
  voterId: text("voter_id").references(() => players.id),
  targetPlayerId: text("target_player_id"),
  round: integer("round").notNull(),
  castAt: timestamp("cast_at").defaultNow(),
});
