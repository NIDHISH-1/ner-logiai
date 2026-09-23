import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  AuditEvent,
  Incident,
  InsertAuditEvent,
  InsertIncident,
  InsertShipment,
  InsertUser,
  InsertVehicle,
  InsertWeatherSnapshot,
  Shipment,
  User,
  Vehicle,
  WeatherSnapshot,
  auditEvents,
  incidents,
  shipments,
  users,
  vehicles,
  weatherSnapshots,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// =============================================================================
// In-Memory Fallback Store
// Ensures NER-LogiAI works out of the box in AI Studio without external MySQL
// =============================================================================

const memoryUsers = new Map<string, User>();
const memoryShipments = new Map<string, Shipment>();
const memoryVehicles = new Map<string, Vehicle>();
const memoryIncidents = new Map<string, Incident>();
const memoryAuditEvents: AuditEvent[] = [];
const memoryWeatherSnapshots: WeatherSnapshot[] = [];
let nextAuditId = 1;
let nextWeatherSnapshotId = 1;
let nextUserId = 1;

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (db) {
    try {
      const values: InsertUser = { openId: user.openId };
      const updateSet: Record<string, unknown> = {};
      const textFields = ["name", "email", "loginMethod"] as const;
      type TextField = (typeof textFields)[number];
      const assignNullable = (field: TextField) => {
        const value = user[field];
        if (value === undefined) return;
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      };
      textFields.forEach(assignNullable);

      if (user.lastSignedIn !== undefined) {
        values.lastSignedIn = user.lastSignedIn;
        updateSet.lastSignedIn = user.lastSignedIn;
      }
      if (user.role !== undefined) {
        values.role = user.role;
        updateSet.role = user.role;
      } else if (user.openId === ENV.ownerOpenId) {
        values.role = "admin";
        updateSet.role = "admin";
      }
      if (user.operationalRole !== undefined) {
        values.operationalRole = user.operationalRole;
        updateSet.operationalRole = user.operationalRole;
      } else if (user.openId === ENV.ownerOpenId) {
        values.operationalRole = "admin";
        updateSet.operationalRole = "admin";
      }
      if (!values.lastSignedIn) values.lastSignedIn = new Date();
      if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

      await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
      return;
    } catch (error) {
      console.warn("[Database] Upsert failed, falling back to memory store:", error);
    }
  }

  // In-memory fallback
  let existing = memoryUsers.get(user.openId);
  const now = new Date();
  if (!existing) {
    existing = {
      id: nextUserId++,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      operationalRole: user.operationalRole ?? (user.openId === ENV.ownerOpenId ? "admin" : "viewer"),
      createdAt: now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
    };
  } else {
    if (user.name !== undefined) existing.name = user.name ?? null;
    if (user.email !== undefined) existing.email = user.email ?? null;
    if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
    if (user.role !== undefined) existing.role = user.role;
    if (user.operationalRole !== undefined) existing.operationalRole = user.operationalRole;
    existing.lastSignedIn = user.lastSignedIn ?? now;
    existing.updatedAt = now;
  }
  memoryUsers.set(user.openId, existing);
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (result.length > 0) return result[0];
    } catch (error) {
      console.warn("[Database] getUserByOpenId failed, checking memory:", error);
    }
  }
  return memoryUsers.get(openId);
}

export const demoShipments: InsertShipment[] = [
  { id: "SHP-001", name: "Emergency Medicine", priority: "CRITICAL", origin: "Guwahati", destination: "Imphal", status: "in_transit", etaMinutes: 222, isDemo: true },
  { id: "SHP-002", name: "Flood Relief Kits", priority: "HIGH", origin: "Dimapur", destination: "Kohima", status: "in_transit", etaMinutes: 78, isDemo: true },
  { id: "SHP-003", name: "Cold Chain Vaccines", priority: "CRITICAL", origin: "Agartala", destination: "Aizawl", status: "in_transit", etaMinutes: 306, isDemo: true },
  { id: "SHP-004", name: "Rice & Staples", priority: "HIGH", origin: "Siliguri", destination: "Itanagar", status: "delayed", etaMinutes: 420, isDemo: true },
  { id: "SHP-005", name: "Water Purification Units", priority: "HIGH", origin: "Shillong", destination: "Jowai", status: "in_transit", etaMinutes: 95, isDemo: true },
  { id: "SHP-006", name: "Emergency Tents", priority: "NORMAL", origin: "Guwahati", destination: "Aizawl", status: "planned", etaMinutes: 560, isDemo: true },
  { id: "SHP-007", name: "Infant Nutrition", priority: "CRITICAL", origin: "Imphal", destination: "Ukhrul", status: "in_transit", etaMinutes: 138, isDemo: true },
  { id: "SHP-008", name: "Generator Fuel", priority: "HIGH", origin: "Dibrugarh", destination: "Pasighat", status: "delayed", etaMinutes: 360, isDemo: true },
  { id: "SHP-009", name: "Blankets", priority: "NORMAL", origin: "Kohima", destination: "Mokokchung", status: "delivered", etaMinutes: 0, isDemo: true },
  { id: "SHP-010", name: "Trauma Supplies", priority: "CRITICAL", origin: "Guwahati", destination: "Tura", status: "in_transit", etaMinutes: 185, isDemo: true },
  { id: "SHP-011", name: "Community Food Packs", priority: "NORMAL", origin: "Agartala", destination: "Dharmanagar", status: "in_transit", etaMinutes: 210, isDemo: true },
  { id: "SHP-012", name: "Mobile Water Tanks", priority: "HIGH", origin: "Shillong", destination: "Nongpoh", status: "planned", etaMinutes: 170, isDemo: true },
  { id: "SHP-013", name: "First Aid Kits", priority: "HIGH", origin: "Aizawl", destination: "Lunglei", status: "in_transit", etaMinutes: 260, isDemo: true },
  { id: "SHP-014", name: "Solar Lanterns", priority: "LOW", origin: "Itanagar", destination: "Ziro", status: "planned", etaMinutes: 190, isDemo: true },
  { id: "SHP-015", name: "Shelter Tarps", priority: "NORMAL", origin: "Kohima", destination: "Phek", status: "delayed", etaMinutes: 285, isDemo: true },
];

export const demoVehicles: InsertVehicle[] = [
  { id: "TRK-104", shipmentId: "SHP-001", status: "at_risk", risk: "HIGH", latitude: "26.144500", longitude: "91.736200", etaMinutes: 222, isDemo: true },
  { id: "TRK-219", shipmentId: "SHP-002", status: "on_route", risk: "MODERATE", latitude: "25.674700", longitude: "94.108600", etaMinutes: 78, isDemo: true },
  { id: "TRK-088", shipmentId: "SHP-003", status: "on_route", risk: "LOW", latitude: "23.831500", longitude: "91.286800", etaMinutes: 306, isDemo: true },
  { id: "TRK-301", shipmentId: "SHP-004", status: "delayed", risk: "HIGH", latitude: "26.727100", longitude: "88.395300", etaMinutes: 420, isDemo: true },
  { id: "TRK-117", shipmentId: "SHP-005", status: "on_route", risk: "LOW", latitude: "25.467000", longitude: "91.366200", etaMinutes: 95, isDemo: true },
  { id: "TRK-452", shipmentId: "SHP-006", status: "idle", risk: "LOW", latitude: "26.144500", longitude: "91.736200", etaMinutes: 560, isDemo: true },
  { id: "TRK-063", shipmentId: "SHP-007", status: "on_route", risk: "MODERATE", latitude: "24.807400", longitude: "94.047900", etaMinutes: 138, isDemo: true },
  { id: "TRK-288", shipmentId: "SHP-008", status: "delayed", risk: "HIGH", latitude: "27.472800", longitude: "94.912000", etaMinutes: 360, isDemo: true },
  { id: "TRK-190", shipmentId: "SHP-010", status: "on_route", risk: "LOW", latitude: "25.514500", longitude: "90.203700", etaMinutes: 185, isDemo: true },
  { id: "TRK-521", shipmentId: "SHP-013", status: "on_route", risk: "MODERATE", latitude: "23.727100", longitude: "92.717600", etaMinutes: 260, isDemo: true },
];

export const demoIncidents: InsertIncident[] = [
  { id: "INC-2408", type: "Bridge Damage", severity: "CRITICAL", status: "UNDER_REVIEW", description: "Bridge deck damaged after heavy rainfall on NH-37.", latitude: "26.750000", longitude: "94.200000", roadAccessibility: "blocked", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 7 * 60_000) },
  { id: "INC-2407", type: "Road Blockage", severity: "HIGH", status: "VERIFIED", description: "Fallen debris blocking one lane near Kohima approach.", latitude: "25.674700", longitude: "94.108600", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 22 * 60_000) },
  { id: "INC-2406", type: "Flood", severity: "MODERATE", status: "UNDER_REVIEW", description: "Water pooling across the Shillong bypass after rainfall.", latitude: "25.578800", longitude: "91.893300", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 41 * 60_000) },
  { id: "INC-2405", type: "Landslide", severity: "HIGH", status: "VERIFIED", description: "Slope movement reported near Jowai corridor.", latitude: "25.450000", longitude: "92.200000", roadAccessibility: "blocked", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 70 * 60_000) },
  { id: "INC-2404", type: "Road Damage", severity: "MODERATE", status: "VERIFIED", description: "Potholes and shoulder erosion reported near Tura.", latitude: "25.514500", longitude: "90.203700", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 120 * 60_000) },
  { id: "INC-2403", type: "Traffic", severity: "LOW", status: "VERIFIED", description: "Congestion at Dimapur freight entry.", latitude: "25.900000", longitude: "93.730000", roadAccessibility: "accessible", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 180 * 60_000) },
  { id: "INC-2402", type: "Fallen Tree", severity: "HIGH", status: "REJECTED", description: "Old report superseded by a later clearance update.", latitude: "26.300000", longitude: "91.600000", roadAccessibility: "accessible", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 240 * 60_000) },
  { id: "INC-2401", type: "Bridge Damage", severity: "CRITICAL", status: "VERIFIED", description: "Load restriction active on a district bridge.", latitude: "24.800000", longitude: "93.950000", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 300 * 60_000) },
  { id: "INC-2400", type: "Flood", severity: "HIGH", status: "VERIFIED", description: "River overflow affecting low-lying road segment.", latitude: "24.830000", longitude: "92.800000", roadAccessibility: "blocked", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 360 * 60_000) },
  { id: "INC-2399", type: "Road Damage", severity: "LOW", status: "VERIFIED", description: "Minor shoulder damage, traffic moving slowly.", latitude: "27.000000", longitude: "93.600000", roadAccessibility: "accessible", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 420 * 60_000) },
  { id: "INC-2398", type: "Road Blockage", severity: "CRITICAL", status: "VERIFIED", description: "Blocked culvert affecting emergency access.", latitude: "27.470000", longitude: "94.900000", roadAccessibility: "blocked", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 480 * 60_000) },
  { id: "INC-2397", type: "Traffic", severity: "MODERATE", status: "UNDER_REVIEW", description: "Queue forming near relief distribution point.", latitude: "25.700000", longitude: "91.900000", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 540 * 60_000) },
  { id: "INC-2396", type: "Landslide", severity: "HIGH", status: "VERIFIED", description: "Fresh debris on hillside corridor.", latitude: "25.300000", longitude: "93.000000", roadAccessibility: "blocked", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 600 * 60_000) },
  { id: "INC-2395", type: "Fallen Tree", severity: "LOW", status: "VERIFIED", description: "Tree cleared; road operating normally.", latitude: "24.900000", longitude: "92.400000", roadAccessibility: "accessible", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 660 * 60_000) },
  { id: "INC-2394", type: "Bridge Damage", severity: "HIGH", status: "UNDER_REVIEW", description: "Cracking observed on approach slab.", latitude: "26.200000", longitude: "94.500000", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 720 * 60_000) },
  { id: "INC-2393", type: "Flood", severity: "MODERATE", status: "VERIFIED", description: "Drainage overflow at district boundary.", latitude: "25.100000", longitude: "91.700000", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 780 * 60_000) },
  { id: "INC-2392", type: "Road Blockage", severity: "HIGH", status: "VERIFIED", description: "Construction debris narrowed carriageway.", latitude: "26.600000", longitude: "93.700000", roadAccessibility: "restricted", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 840 * 60_000) },
  { id: "INC-2391", type: "Road Damage", severity: "MODERATE", status: "REJECTED", description: "Duplicate of a verified report.", latitude: "23.900000", longitude: "92.500000", roadAccessibility: "accessible", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 900 * 60_000) },
  { id: "INC-2390", type: "Traffic", severity: "LOW", status: "VERIFIED", description: "Market-day traffic near district center.", latitude: "25.850000", longitude: "93.700000", roadAccessibility: "accessible", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 960 * 60_000) },
  { id: "INC-2389", type: "Landslide", severity: "CRITICAL", status: "VERIFIED", description: "Major slide affecting highland access.", latitude: "25.600000", longitude: "93.800000", roadAccessibility: "blocked", reporterRole: "field_officer", isDemo: true, occurredAt: new Date(Date.now() - 1020 * 60_000) },
];

function seedInMemory() {
  const now = new Date();
  demoShipments.forEach(s => {
    memoryShipments.set(s.id, {
      id: s.id,
      name: s.name,
      priority: s.priority ?? "NORMAL",
      origin: s.origin,
      destination: s.destination,
      status: s.status ?? "planned",
      etaMinutes: s.etaMinutes ?? 0,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });
  });
  demoVehicles.forEach(v => {
    memoryVehicles.set(v.id, {
      id: v.id,
      shipmentId: v.shipmentId ?? null,
      status: v.status ?? "idle",
      risk: v.risk ?? "LOW",
      latitude: String(v.latitude),
      longitude: String(v.longitude),
      etaMinutes: v.etaMinutes ?? 0,
      isDemo: true,
      lastUpdated: now,
    });
  });
  demoIncidents.forEach(i => {
    memoryIncidents.set(i.id, {
      id: i.id,
      type: i.type,
      severity: i.severity ?? "MODERATE",
      status: i.status ?? "UNVERIFIED",
      description: i.description,
      latitude: String(i.latitude),
      longitude: String(i.longitude),
      roadAccessibility: i.roadAccessibility ?? "unknown",
      reporterId: null,
      reporterRole: i.reporterRole ?? "field_officer",
      photoUrl: null,
      isDemo: true,
      occurredAt: i.occurredAt instanceof Date ? i.occurredAt : new Date(i.occurredAt),
      createdAt: now,
      updatedAt: now,
    });
  });
}

// Prepopulate in-memory data on startup
seedInMemory();

export async function seedDemoData() {
  seedInMemory();
  const db = await getDb();
  if (!db) {
    return { seeded: true, vehicles: demoVehicles.length, shipments: demoShipments.length, incidents: demoIncidents.length };
  }
  try {
    await db.insert(shipments).values(demoShipments).onDuplicateKeyUpdate({ set: { isDemo: true } });
    await db.insert(vehicles).values(demoVehicles).onDuplicateKeyUpdate({ set: { isDemo: true } });
    await db.insert(incidents).values(demoIncidents).onDuplicateKeyUpdate({ set: { isDemo: true } });
  } catch (err) {
    console.warn("[Database] seedDemoData failed in DB; memory store is ready:", err);
  }
  return { seeded: true, vehicles: demoVehicles.length, shipments: demoShipments.length, incidents: demoIncidents.length };
}

export async function listIncidents(limit = 20): Promise<Incident[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(limit);
    } catch (err) {
      console.warn("[Database] listIncidents failed, falling back to memory:", err);
    }
  }
  return Array.from(memoryIncidents.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function getIncidentById(id: string): Promise<Incident | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] getIncidentById failed, falling back to memory:", err);
    }
  }
  return memoryIncidents.get(id);
}

export async function listVehicles(limit = 50): Promise<Vehicle[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(vehicles).orderBy(desc(vehicles.lastUpdated)).limit(limit);
    } catch (err) {
      console.warn("[Database] listVehicles failed, falling back to memory:", err);
    }
  }
  return Array.from(memoryVehicles.values())
    .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
    .slice(0, limit);
}

export async function listShipments(limit = 50): Promise<Shipment[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(shipments).orderBy(desc(shipments.updatedAt)).limit(limit);
    } catch (err) {
      console.warn("[Database] listShipments failed, falling back to memory:", err);
    }
  }
  return Array.from(memoryShipments.values())
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export async function listAuditEvents(limit = 50): Promise<AuditEvent[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(auditEvents).orderBy(desc(auditEvents.id)).limit(limit);
    } catch (err) {
      console.warn("[Database] listAuditEvents failed, falling back to memory:", err);
    }
  }
  return memoryAuditEvents.slice(-limit).reverse();
}

export async function saveWeatherSnapshots(records: InsertWeatherSnapshot[]) {
  if (!records.length) return [];
  const db = await getDb();
  if (db) {
    try {
      await db.insert(weatherSnapshots).values(records);
      return records;
    } catch (err) {
      console.warn("[Database] saveWeatherSnapshots failed, falling back to memory:", err);
    }
  }
  const now = new Date();
  for (const r of records) {
    memoryWeatherSnapshots.push({
      id: nextWeatherSnapshotId++,
      roadSegment: r.roadSegment,
      rainfallIntensity: r.rainfallIntensity ?? null,
      temperatureC: r.temperatureC ?? null,
      floodWarning: r.floodWarning ?? false,
      landslideWarning: r.landslideWarning ?? false,
      weatherSource: r.weatherSource ?? "SIMULATED WEATHER DATA",
      weatherStatus: r.weatherStatus,
      weatherTimestamp: r.weatherTimestamp ?? null,
      predictionTimestamp: r.predictionTimestamp,
      predictionProbability: r.predictionProbability ?? null,
      predictionConfidence: r.predictionConfidence ?? null,
      predictionRiskLevel: r.predictionRiskLevel ?? null,
      createdAt: now,
    });
  }
  return records;
}

export async function listWeatherSnapshots(limit = 30, roadSegment?: string): Promise<WeatherSnapshot[]> {
  const db = await getDb();
  if (db) {
    try {
      if (roadSegment) {
        return await db.select().from(weatherSnapshots).where(eq(weatherSnapshots.roadSegment, roadSegment)).orderBy(desc(weatherSnapshots.predictionTimestamp)).limit(limit);
      }
      return await db.select().from(weatherSnapshots).orderBy(desc(weatherSnapshots.predictionTimestamp)).limit(limit);
    } catch (err) {
      console.warn("[Database] listWeatherSnapshots failed, falling back to memory:", err);
    }
  }
  let results = memoryWeatherSnapshots;
  if (roadSegment) {
    results = results.filter(w => w.roadSegment === roadSegment);
  }
  return results.slice().sort((a, b) => b.predictionTimestamp.getTime() - a.predictionTimestamp.getTime()).slice(0, limit);
}

export async function createIncident(
  input: Omit<InsertIncident, "id" | "createdAt" | "updatedAt"> & { id?: string },
  actorId?: number
): Promise<Incident> {
  const id = input.id ?? `INC-${nanoid(8).toUpperCase()}`;
  const now = new Date();
  const memoryRecord: Incident = {
    id,
    type: input.type,
    severity: input.severity ?? "MODERATE",
    status: input.status ?? "UNVERIFIED",
    description: input.description,
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    roadAccessibility: input.roadAccessibility ?? "unknown",
    reporterId: input.reporterId ?? actorId ?? null,
    reporterRole: input.reporterRole ?? "field_officer",
    photoUrl: input.photoUrl ?? null,
    isDemo: input.isDemo ?? false,
    occurredAt: input.occurredAt instanceof Date ? input.occurredAt : new Date(input.occurredAt),
    createdAt: now,
    updatedAt: now,
  };
  memoryIncidents.set(id, memoryRecord);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(incidents).values({ ...input, id });
      await appendAuditEvent({
        actorId,
        action: "incident.created",
        entityType: "incident",
        entityId: id,
        details: JSON.stringify({ severity: input.severity, type: input.type }),
      });
      const rows = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] createIncident failed in DB, saved to memory:", err);
    }
  }

  await appendAuditEvent({
    actorId,
    action: "incident.created",
    entityType: "incident",
    entityId: id,
    details: JSON.stringify({ severity: input.severity, type: input.type }),
  });
  return memoryRecord;
}

export async function updateIncidentStatus(
  id: string,
  status: "UNVERIFIED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED",
  actorId?: number
): Promise<Incident | undefined> {
  const now = new Date();
  const existing = memoryIncidents.get(id);
  if (existing) {
    existing.status = status;
    existing.updatedAt = now;
  }

  const db = await getDb();
  if (db) {
    try {
      await db.update(incidents).set({ status, updatedAt: now }).where(eq(incidents.id, id));
      await appendAuditEvent({ actorId, action: `incident.${status.toLowerCase()}`, entityType: "incident", entityId: id });
      const rows = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] updateIncidentStatus failed in DB, saved to memory:", err);
    }
  }

  await appendAuditEvent({ actorId, action: `incident.${status.toLowerCase()}`, entityType: "incident", entityId: id });
  return existing;
}

export async function appendAuditEvent(input: InsertAuditEvent): Promise<AuditEvent | undefined> {
  const now = new Date();
  const event: AuditEvent = {
    id: nextAuditId++,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ?? null,
    createdAt: now,
  };
  memoryAuditEvents.push(event);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(auditEvents).values(input);
      const rows = await db.select().from(auditEvents).orderBy(desc(auditEvents.id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] appendAuditEvent failed in DB, saved to memory:", err);
    }
  }

  return event;
}
