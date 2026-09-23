import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  operationalRole: mysqlEnum("operationalRole", ["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team", "viewer"]).default("viewer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const vehicles = mysqlTable("vehicles", {
  id: varchar("id", { length: 32 }).primaryKey(),
  shipmentId: varchar("shipmentId", { length: 32 }),
  status: mysqlEnum("status", ["on_route", "at_risk", "delayed", "offline", "idle"]).default("idle").notNull(),
  risk: mysqlEnum("risk", ["LOW", "MODERATE", "HIGH", "CRITICAL"]).default("LOW").notNull(),
  latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
  etaMinutes: int("etaMinutes").default(0).notNull(),
  isDemo: boolean("isDemo").default(false).notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
});

export const shipments = mysqlTable("shipments", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  priority: mysqlEnum("priority", ["CRITICAL", "HIGH", "NORMAL", "LOW"]).default("NORMAL").notNull(),
  origin: varchar("origin", { length: 120 }).notNull(),
  destination: varchar("destination", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["planned", "in_transit", "delayed", "delivered"]).default("planned").notNull(),
  etaMinutes: int("etaMinutes").default(0).notNull(),
  isDemo: boolean("isDemo").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const incidents = mysqlTable("incidents", {
  id: varchar("id", { length: 32 }).primaryKey(),
  type: varchar("type", { length: 80 }).notNull(),
  severity: mysqlEnum("severity", ["LOW", "MODERATE", "HIGH", "CRITICAL"]).default("MODERATE").notNull(),
  status: mysqlEnum("status", ["UNVERIFIED", "UNDER_REVIEW", "VERIFIED", "REJECTED"]).default("UNVERIFIED").notNull(),
  description: text("description").notNull(),
  latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
  roadAccessibility: mysqlEnum("roadAccessibility", ["accessible", "restricted", "blocked", "unknown"]).default("unknown").notNull(),
  reporterId: int("reporterId"),
  reporterRole: varchar("reporterRole", { length: 40 }).default("field_officer").notNull(),
  photoUrl: text("photoUrl"),
  isDemo: boolean("isDemo").default(false).notNull(),
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId"),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 60 }).notNull(),
  entityId: varchar("entityId", { length: 64 }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const weatherSnapshots = mysqlTable("weatherSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  roadSegment: varchar("roadSegment", { length: 80 }).notNull(),
  rainfallIntensity: decimal("rainfallIntensity", { precision: 6, scale: 2 }),
  temperatureC: decimal("temperatureC", { precision: 6, scale: 2 }),
  floodWarning: boolean("floodWarning").notNull().default(false),
  landslideWarning: boolean("landslideWarning").notNull().default(false),
  weatherSource: varchar("weatherSource", { length: 80 }).notNull().default("SIMULATED WEATHER DATA"),
  weatherStatus: varchar("weatherStatus", { length: 24 }).notNull(),
  weatherTimestamp: timestamp("weatherTimestamp"),
  predictionTimestamp: timestamp("predictionTimestamp").notNull(),
  predictionProbability: int("predictionProbability"),
  predictionConfidence: int("predictionConfidence"),
  predictionRiskLevel: varchar("predictionRiskLevel", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;
export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;
export type WeatherSnapshot = typeof weatherSnapshots.$inferSelect;
export type InsertWeatherSnapshot = typeof weatherSnapshots.$inferInsert;
