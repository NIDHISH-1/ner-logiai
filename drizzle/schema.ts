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
  speed: decimal("speed", { precision: 6, scale: 2 }).default("0.00").notNull(),
  heading: int("heading").default(0).notNull(),
  currentCorridor: varchar("currentCorridor", { length: 120 }),
  gpsSource: varchar("gpsSource", { length: 40 }).default("SIMULATED GPS").notNull(),
  activeRoute: text("activeRoute"),
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
  plannedEtaMinutes: int("plannedEtaMinutes").default(0).notNull(),
  etaMinutes: int("etaMinutes").default(0).notNull(),
  delayMinutes: int("delayMinutes").default(0).notNull(),
  delayReason: text("delayReason"),
  assignedVehicleId: varchar("assignedVehicleId", { length: 32 }),
  activeRoute: text("activeRoute"),
  isDemo: boolean("isDemo").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const vehicleLocationHistory = mysqlTable("vehicleLocationHistory", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: varchar("vehicleId", { length: 32 }).notNull(),
  latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
  speed: decimal("speed", { precision: 6, scale: 2 }).default("0.00").notNull(),
  heading: int("heading").default(0).notNull(),
  currentCorridor: varchar("currentCorridor", { length: 120 }),
  gpsSource: varchar("gpsSource", { length: 40 }).default("SIMULATED GPS").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
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

export const alerts = mysqlTable("alerts", {
  id: varchar("id", { length: 32 }).primaryKey(),
  incidentId: varchar("incidentId", { length: 32 }),
  alertType: varchar("alertType", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", ["INFO", "ADVISORY", "HIGH", "CRITICAL"]).default("HIGH").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  message: text("message").notNull(),
  corridor: varchar("corridor", { length: 120 }).notNull(),
  roadSegment: varchar("roadSegment", { length: 120 }),
  affectedVehicleIds: text("affectedVehicleIds"),
  affectedShipmentIds: text("affectedShipmentIds"),
  targetRoles: text("targetRoles"),
  status: mysqlEnum("status", ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]).default("ACTIVE").notNull(),
  acknowledgedBy: int("acknowledgedBy"),
  acknowledgedByName: varchar("acknowledgedByName", { length: 120 }),
  acknowledgedAt: timestamp("acknowledgedAt"),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  actorId: int("actorId"),
  actorRole: varchar("actorRole", { length: 40 }),
  isDemo: boolean("isDemo").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export type VehicleLocationHistory = typeof vehicleLocationHistory.$inferSelect;
export type InsertVehicleLocationHistory = typeof vehicleLocationHistory.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;
