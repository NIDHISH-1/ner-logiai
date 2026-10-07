import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import crypto from "crypto";
import {
  Alert,
  AuditEvent,
  Incident,
  InsertAlert,
  InsertAuditEvent,
  InsertIncident,
  InsertShipment,
  InsertUser,
  InsertVehicle,
  InsertWeatherSnapshot,
  InsertVehicleLocationHistory,
  Shipment,
  User,
  Vehicle,
  VehicleLocationHistory,
  WeatherSnapshot,
  alerts,
  auditEvents,
  incidents,
  shipments,
  users,
  vehicles,
  vehicleLocationHistory,
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
const memoryVehicleLocationHistory: VehicleLocationHistory[] = [];
let nextAuditId = 1;
let nextWeatherSnapshotId = 1;
let nextUserId = 1;
let nextLocationHistoryId = 1;

export function isDatabaseAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL && _db !== null);
}

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

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (result.length > 0) return result[0];
    } catch (error) {
      console.warn("[Database] getUserByEmail failed, checking memory:", error);
    }
  }
  for (const user of Array.from(memoryUsers.values())) {
    if (user.email && user.email.toLowerCase() === normalizedEmail) {
      return user;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Credential Store & PBKDF2 Password Hashing
// ---------------------------------------------------------------------------
interface UserCredential {
  email: string;
  openId: string;
  salt: string;
  hash: string;
  organization?: string;
  createdAt: Date;
}
const memoryCredentials = new Map<string, UserCredential>();

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")): { hash: string; salt: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}

export async function saveUserCredential(email: string, openId: string, password: string, organization?: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const { hash, salt } = hashPassword(password);
  memoryCredentials.set(normalizedEmail, {
    email: normalizedEmail,
    openId,
    salt,
    hash,
    organization,
    createdAt: new Date(),
  });
}

export async function verifyUserCredential(email: string, password: string): Promise<{ valid: boolean; openId?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cred = memoryCredentials.get(normalizedEmail);
  if (!cred) return { valid: false };
  const valid = verifyPassword(password, cred.hash, cred.salt);
  return { valid, openId: valid ? cred.openId : undefined };
}

export const demoShipments: InsertShipment[] = [
  { id: "SHP-001", name: "Emergency Medicine", priority: "CRITICAL", origin: "Guwahati", destination: "Imphal", status: "in_transit", plannedEtaMinutes: 222, etaMinutes: 222, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-104", activeRoute: "GUWAHATI -> KOHIMA -> IMPHAL", isDemo: true },
  { id: "SHP-002", name: "Flood Relief Kits", priority: "HIGH", origin: "Dimapur", destination: "Kohima", status: "in_transit", plannedEtaMinutes: 78, etaMinutes: 78, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-219", activeRoute: "DIMAPUR -> KOHIMA", isDemo: true },
  { id: "SHP-003", name: "Cold Chain Vaccines", priority: "CRITICAL", origin: "Agartala", destination: "Aizawl", status: "in_transit", plannedEtaMinutes: 306, etaMinutes: 306, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-088", activeRoute: "AGARTALA -> AIZAWL", isDemo: true },
  { id: "SHP-004", name: "Rice & Staples", priority: "HIGH", origin: "Siliguri", destination: "Itanagar", status: "delayed", plannedEtaMinutes: 360, etaMinutes: 420, delayMinutes: 60, delayReason: "Delay due to weather risk and mountain sector caution", assignedVehicleId: "TRK-301", activeRoute: "SILIGURI -> ITANAGAR", isDemo: true },
  { id: "SHP-005", name: "Water Purification Units", priority: "HIGH", origin: "Shillong", destination: "Jowai", status: "in_transit", plannedEtaMinutes: 95, etaMinutes: 95, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-117", activeRoute: "SHILLONG -> JOWAI", isDemo: true },
  { id: "SHP-006", name: "Emergency Tents", priority: "NORMAL", origin: "Guwahati", destination: "Aizawl", status: "planned", plannedEtaMinutes: 560, etaMinutes: 560, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-452", activeRoute: "GUWAHATI -> AIZAWL", isDemo: true },
  { id: "SHP-007", name: "Infant Nutrition", priority: "CRITICAL", origin: "Imphal", destination: "Ukhrul", status: "in_transit", plannedEtaMinutes: 138, etaMinutes: 138, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-063", activeRoute: "IMPHAL -> UKHRUL", isDemo: true },
  { id: "SHP-008", name: "Generator Fuel", priority: "HIGH", origin: "Dibrugarh", destination: "Pasighat", status: "delayed", plannedEtaMinutes: 310, etaMinutes: 360, delayMinutes: 50, delayReason: "Delay due to single-lane road restriction", assignedVehicleId: "TRK-288", activeRoute: "DIBRUGARH -> PASIGHAT", isDemo: true },
  { id: "SHP-009", name: "Blankets", priority: "NORMAL", origin: "Kohima", destination: "Mokokchung", status: "delivered", plannedEtaMinutes: 180, etaMinutes: 0, delayMinutes: 0, delayReason: "Delivered successfully", assignedVehicleId: null, activeRoute: "KOHIMA -> MOKOKCHUNG", isDemo: true },
  { id: "SHP-010", name: "Trauma Supplies", priority: "CRITICAL", origin: "Guwahati", destination: "Tura", status: "in_transit", plannedEtaMinutes: 185, etaMinutes: 185, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-190", activeRoute: "GUWAHATI -> TURA", isDemo: true },
  { id: "SHP-011", name: "Community Food Packs", priority: "NORMAL", origin: "Agartala", destination: "Dharmanagar", status: "in_transit", plannedEtaMinutes: 210, etaMinutes: 210, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: null, activeRoute: "AGARTALA -> DHARMANAGAR", isDemo: true },
  { id: "SHP-012", name: "Mobile Water Tanks", priority: "HIGH", origin: "Shillong", destination: "Nongpoh", status: "planned", plannedEtaMinutes: 170, etaMinutes: 170, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: null, activeRoute: "SHILLONG -> NONGPOH", isDemo: true },
  { id: "SHP-013", name: "First Aid Kits", priority: "HIGH", origin: "Aizawl", destination: "Lunglei", status: "in_transit", plannedEtaMinutes: 260, etaMinutes: 260, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: "TRK-521", activeRoute: "AIZAWL -> LUNGLEI", isDemo: true },
  { id: "SHP-014", name: "Solar Lanterns", priority: "LOW", origin: "Itanagar", destination: "Ziro", status: "planned", plannedEtaMinutes: 190, etaMinutes: 190, delayMinutes: 0, delayReason: "On schedule · standard mountain transit", assignedVehicleId: null, activeRoute: "ITANAGAR -> ZIRO", isDemo: true },
  { id: "SHP-015", name: "Shelter Tarps", priority: "NORMAL", origin: "Kohima", destination: "Phek", status: "delayed", plannedEtaMinutes: 240, etaMinutes: 285, delayMinutes: 45, delayReason: "Delay due to weather risk and mountain sector caution", assignedVehicleId: null, activeRoute: "KOHIMA -> PHEK", isDemo: true },
];

export const demoVehicles: InsertVehicle[] = [
  { id: "TRK-104", shipmentId: "SHP-001", status: "at_risk", risk: "HIGH", latitude: "26.144500", longitude: "91.736200", speed: "42.50", heading: 75, currentCorridor: "NH-2 · Dimapur to Kohima / Imphal Corridor", gpsSource: "SIMULATED GPS", activeRoute: "GUWAHATI -> KOHIMA -> IMPHAL", etaMinutes: 222, isDemo: true },
  { id: "TRK-219", shipmentId: "SHP-002", status: "on_route", risk: "MODERATE", latitude: "25.674700", longitude: "94.108600", speed: "38.00", heading: 140, currentCorridor: "NH-2 · Dimapur to Kohima / Imphal Corridor", gpsSource: "SIMULATED GPS", activeRoute: "DIMAPUR -> KOHIMA", etaMinutes: 78, isDemo: true },
  { id: "TRK-088", shipmentId: "SHP-003", status: "on_route", risk: "LOW", latitude: "23.831500", longitude: "91.286800", speed: "45.00", heading: 60, currentCorridor: "NH-44 · Agartala Transit", gpsSource: "SIMULATED GPS", activeRoute: "AGARTALA -> AIZAWL", etaMinutes: 306, isDemo: true },
  { id: "TRK-301", shipmentId: "SHP-004", status: "delayed", risk: "HIGH", latitude: "26.727100", longitude: "88.395300", speed: "28.50", heading: 45, currentCorridor: "NH-27 · Western Corridor", gpsSource: "SIMULATED GPS", activeRoute: "SILIGURI -> ITANAGAR", etaMinutes: 420, isDemo: true },
  { id: "TRK-117", shipmentId: "SHP-005", status: "on_route", risk: "LOW", latitude: "25.467000", longitude: "91.366200", speed: "40.00", heading: 110, currentCorridor: "NH-6 · Guwahati - Shillong - Silchar Expressway", gpsSource: "SIMULATED GPS", activeRoute: "SHILLONG -> JOWAI", etaMinutes: 95, isDemo: true },
  { id: "TRK-452", shipmentId: "SHP-006", status: "idle", risk: "LOW", latitude: "26.144500", longitude: "91.736200", speed: "0.00", heading: 0, currentCorridor: "Guwahati Depot", gpsSource: "SIMULATED GPS", activeRoute: "GUWAHATI -> AIZAWL", etaMinutes: 560, isDemo: true },
  { id: "TRK-063", shipmentId: "SHP-007", status: "on_route", risk: "MODERATE", latitude: "24.807400", longitude: "94.047900", speed: "35.00", heading: 25, currentCorridor: "NH-39 · Southern Link", gpsSource: "SIMULATED GPS", activeRoute: "IMPHAL -> UKHRUL", etaMinutes: 138, isDemo: true },
  { id: "TRK-288", shipmentId: "SHP-008", status: "delayed", risk: "HIGH", latitude: "27.472800", longitude: "94.912000", speed: "22.00", heading: 15, currentCorridor: "NH-37 · Upper Assam", gpsSource: "SIMULATED GPS", activeRoute: "DIBRUGARH -> PASIGHAT", etaMinutes: 360, isDemo: true },
  { id: "TRK-190", shipmentId: "SHP-010", status: "on_route", risk: "LOW", latitude: "25.514500", longitude: "90.203700", speed: "46.00", heading: 260, currentCorridor: "NH-51 · Tura Corridor", gpsSource: "SIMULATED GPS", activeRoute: "GUWAHATI -> TURA", etaMinutes: 185, isDemo: true },
  { id: "TRK-521", shipmentId: "SHP-013", status: "on_route", risk: "MODERATE", latitude: "23.727100", longitude: "92.717600", speed: "32.00", heading: 180, currentCorridor: "NH-54 · Mizoram Corridor", gpsSource: "SIMULATED GPS", activeRoute: "AIZAWL -> LUNGLEI", etaMinutes: 260, isDemo: true },
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
  memoryShipments.clear();
  memoryVehicles.clear();
  memoryIncidents.clear();
  memoryVehicleLocationHistory.length = 0;

  demoShipments.forEach(s => {
    memoryShipments.set(s.id, {
      id: s.id,
      name: s.name,
      priority: s.priority ?? "NORMAL",
      origin: s.origin,
      destination: s.destination,
      status: s.status ?? "planned",
      plannedEtaMinutes: s.plannedEtaMinutes ?? s.etaMinutes ?? 0,
      etaMinutes: s.etaMinutes ?? 0,
      delayMinutes: s.delayMinutes ?? 0,
      delayReason: s.delayReason ?? "On schedule",
      assignedVehicleId: s.assignedVehicleId ?? null,
      activeRoute: s.activeRoute ?? null,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  demoVehicles.forEach(v => {
    const lat = String(v.latitude);
    const lon = String(v.longitude);
    const speed = v.speed ? String(v.speed) : "0.00";
    const heading = v.heading ?? 0;
    const currentCorridor = v.currentCorridor ?? null;
    const gpsSource = v.gpsSource ?? "SIMULATED GPS";

    memoryVehicles.set(v.id, {
      id: v.id,
      shipmentId: v.shipmentId ?? null,
      status: v.status ?? "idle",
      risk: v.risk ?? "LOW",
      latitude: lat,
      longitude: lon,
      speed,
      heading,
      currentCorridor,
      gpsSource,
      activeRoute: v.activeRoute ?? null,
      etaMinutes: v.etaMinutes ?? 0,
      isDemo: true,
      lastUpdated: now,
    });

    memoryVehicleLocationHistory.push({
      id: nextLocationHistoryId++,
      vehicleId: v.id,
      latitude: lat,
      longitude: lon,
      speed,
      heading,
      currentCorridor,
      gpsSource,
      timestamp: now,
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
  let updatedAccessibility = existing?.roadAccessibility;
  if (status === "VERIFIED" && existing) {
    if (existing.roadAccessibility === "blocked" || existing.roadAccessibility === "restricted") {
      // preserve explicit accessibility
    } else if (
      existing.type === "Road Blockage" ||
      existing.type === "Bridge Damage" ||
      (["HIGH", "CRITICAL"].includes(existing.severity) && ["Landslide", "Flood", "Road Damage"].includes(existing.type))
    ) {
      updatedAccessibility = "blocked";
    }
  } else if (status === "REJECTED" && existing) {
    if (existing.roadAccessibility === "blocked") {
      updatedAccessibility = "accessible";
    }
  }

  if (existing) {
    existing.status = status;
    if (updatedAccessibility) existing.roadAccessibility = updatedAccessibility;
    existing.updatedAt = now;
  }

  const db = await getDb();
  if (db) {
    try {
      const updateData: any = { status, updatedAt: now };
      if (updatedAccessibility) updateData.roadAccessibility = updatedAccessibility;
      await db.update(incidents).set(updateData).where(eq(incidents.id, id));
      await appendAuditEvent({
        actorId,
        action: `incident.${status.toLowerCase()}`,
        entityType: "incident",
        entityId: id,
        details: JSON.stringify({ status, roadAccessibility: updatedAccessibility ?? "unknown" }),
      });
      const rows = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] updateIncidentStatus failed in DB, saved to memory:", err);
    }
  }

  await appendAuditEvent({
    actorId,
    action: `incident.${status.toLowerCase()}`,
    entityType: "incident",
    entityId: id,
    details: JSON.stringify({ status, roadAccessibility: updatedAccessibility ?? "unknown" }),
  });
  return existing;
}

export async function updateIncidentRoadAccessibility(
  id: string,
  roadAccessibility: "accessible" | "restricted" | "blocked" | "unknown",
  actorId?: number
): Promise<Incident | undefined> {
  const now = new Date();
  const existing = memoryIncidents.get(id);
  if (existing) {
    existing.roadAccessibility = roadAccessibility;
    existing.updatedAt = now;
  }

  const db = await getDb();
  if (db) {
    try {
      await db.update(incidents).set({ roadAccessibility, updatedAt: now }).where(eq(incidents.id, id));
      await appendAuditEvent({ actorId, action: `road_status.${roadAccessibility}`, entityType: "incident", entityId: id });
      const rows = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] updateIncidentRoadAccessibility failed in DB, saved to memory:", err);
    }
  }

  await appendAuditEvent({ actorId, action: `road_status.${roadAccessibility}`, entityType: "incident", entityId: id });
  return existing;
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] getVehicle failed, checking memory:", err);
    }
  }
  return memoryVehicles.get(id);
}

export async function updateVehicle(
  id: string,
  update: Partial<Omit<Vehicle, "id">>
): Promise<Vehicle | undefined> {
  const now = new Date();
  const existing = memoryVehicles.get(id);
  if (existing) {
    Object.assign(existing, update, { lastUpdated: now });
  }

  const db = await getDb();
  if (db) {
    try {
      await db.update(vehicles).set({ ...update, lastUpdated: now }).where(eq(vehicles.id, id));
      const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] updateVehicle failed in DB, saved to memory:", err);
    }
  }
  return existing;
}

export async function recordVehicleLocation(input: {
  vehicleId: string;
  latitude: number | string;
  longitude: number | string;
  speed?: number | string;
  heading?: number;
  currentCorridor?: string;
  gpsSource?: string;
}): Promise<Vehicle | undefined> {
  const now = new Date();
  const latStr = typeof input.latitude === "number" ? input.latitude.toFixed(6) : input.latitude;
  const lonStr = typeof input.longitude === "number" ? input.longitude.toFixed(6) : input.longitude;
  const speedStr = input.speed !== undefined ? (typeof input.speed === "number" ? input.speed.toFixed(2) : input.speed) : "0.00";
  const headingVal = input.heading ?? 0;
  const corridorVal = input.currentCorridor ?? null;
  const sourceVal = input.gpsSource ?? "SIMULATED GPS";

  const updatedVehicle = await updateVehicle(input.vehicleId, {
    latitude: latStr,
    longitude: lonStr,
    speed: speedStr,
    heading: headingVal,
    currentCorridor: corridorVal,
    gpsSource: sourceVal,
  });

  const historyRecord: VehicleLocationHistory = {
    id: nextLocationHistoryId++,
    vehicleId: input.vehicleId,
    latitude: latStr,
    longitude: lonStr,
    speed: speedStr,
    heading: headingVal,
    currentCorridor: corridorVal,
    gpsSource: sourceVal,
    timestamp: now,
  };
  memoryVehicleLocationHistory.push(historyRecord);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(vehicleLocationHistory).values({
        vehicleId: input.vehicleId,
        latitude: latStr,
        longitude: lonStr,
        speed: speedStr,
        heading: headingVal,
        currentCorridor: corridorVal,
        gpsSource: sourceVal,
        timestamp: now,
      });
    } catch (err) {
      console.warn("[Database] recordVehicleLocation history insert failed in DB:", err);
    }
  }

  return updatedVehicle;
}

export async function getVehicleLocationHistory(
  vehicleId: string,
  limit = 30
): Promise<VehicleLocationHistory[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db
        .select()
        .from(vehicleLocationHistory)
        .where(eq(vehicleLocationHistory.vehicleId, vehicleId))
        .orderBy(desc(vehicleLocationHistory.timestamp))
        .limit(limit);
    } catch (err) {
      console.warn("[Database] getVehicleLocationHistory failed, checking memory:", err);
    }
  }
  return memoryVehicleLocationHistory
    .filter(h => h.vehicleId === vehicleId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
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

export async function createShipment(input: Omit<InsertShipment, "id"> & { id?: string }): Promise<Shipment> {
  const now = new Date();
  const id = input.id || `SHP-${nanoid(6).toUpperCase()}`;
  const shipment: Shipment = {
    id,
    name: input.name,
    priority: input.priority ?? "NORMAL",
    origin: input.origin,
    destination: input.destination,
    status: input.status ?? "planned",
    etaMinutes: input.etaMinutes ?? 120,
    plannedEtaMinutes: input.plannedEtaMinutes ?? input.etaMinutes ?? 120,
    delayMinutes: input.delayMinutes ?? 0,
    delayReason: input.delayReason ?? null,
    assignedVehicleId: input.assignedVehicleId ?? null,
    activeRoute: input.activeRoute ?? null,
    isDemo: input.isDemo ?? false,
    createdAt: now,
    updatedAt: now,
  };
  memoryShipments.set(id, shipment);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(shipments).values(shipment);
    } catch (err) {
      console.warn("[Database] createShipment failed in DB, saved to memory:", err);
    }
  }

  return shipment;
}

export async function updateShipment(
  id: string,
  update: Partial<Omit<Shipment, "id">>
): Promise<Shipment | undefined> {
  const now = new Date();
  const existing = memoryShipments.get(id);
  if (existing) {
    Object.assign(existing, update, { updatedAt: now });
  }

  const db = await getDb();
  if (db) {
    try {
      await db.update(shipments).set({ ...update, updatedAt: now }).where(eq(shipments.id, id));
      const rows = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] updateShipment failed in DB, saved to memory:", err);
    }
  }
  return existing;
}

export async function getShipment(id: string): Promise<Shipment | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] getShipment failed, checking memory:", err);
    }
  }
  return memoryShipments.get(id);
}

export type BroadcastAlert = {
  id: string;
  incidentId?: string | null;
  alertType: "ROAD_BLOCKAGE" | "CRITICAL_INCIDENT" | "LOGISTICS_DELAY" | "EMERGENCY_ROUTING" | "NO_SAFE_ROUTE" | "OPERATIONAL_DISRUPTION" | string;
  title: string;
  message: string;
  severity: "CRITICAL" | "HIGH" | "ADVISORY" | "INFO";
  corridor: string;
  roadSegment?: string | null;
  affectedVehicleIds?: string[];
  affectedShipmentIds?: string[];
  targetRoles?: string[];
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledgedBy?: number | null;
  acknowledgedByName?: string | null;
  acknowledgedAt?: Date | null;
  resolvedBy?: number | null;
  resolvedAt?: Date | null;
  actorId?: number | null;
  actorRole?: string;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

const memoryAlerts: BroadcastAlert[] = [
  {
    id: "ALT-101",
    incidentId: "INC-2401",
    alertType: "ROAD_BLOCKAGE",
    title: "Bridge Compromise Warning",
    message: "NH-37 bridge at Jorhat closed to all heavy vehicles due to structural undermining.",
    severity: "CRITICAL",
    corridor: "NH-37 Jorhat",
    roadSegment: "NH-37-JORHAT",
    affectedVehicleIds: ["TRK-104"],
    affectedShipmentIds: ["SHP-001"],
    targetRoles: ["admin", "emergency_team", "logistics_manager", "truck_driver"],
    status: "ACTIVE",
    actorRole: "emergency_team",
    createdAt: new Date(Date.now() - 1000 * 60 * 24),
  },
  {
    id: "ALT-102",
    incidentId: "INC-2402",
    alertType: "CRITICAL_INCIDENT",
    title: "Flash Flood Watch",
    message: "High rainfall warning in Cachar and Dima Hasao districts. Emergency convoys use caution.",
    severity: "HIGH",
    corridor: "NH-6 Shillong / Silchar",
    roadSegment: "NH-6-SHILLONG",
    affectedVehicleIds: ["TRK-303"],
    affectedShipmentIds: ["SHP-004"],
    targetRoles: ["admin", "emergency_team"],
    status: "ACTIVE",
    actorRole: "emergency_team",
    createdAt: new Date(Date.now() - 1000 * 60 * 55),
  },
  {
    id: "ALT-103",
    incidentId: "INC-2403",
    alertType: "OPERATIONAL_DISRUPTION",
    title: "Landslide Clearance in Progress",
    message: "NH-2 Kohima approach single-lane traffic open with police escort.",
    severity: "HIGH",
    corridor: "NH-2 Kohima",
    roadSegment: "NH-2-KOHIMA",
    affectedVehicleIds: ["TRK-104", "TRK-202"],
    affectedShipmentIds: ["SHP-002"],
    targetRoles: ["admin", "emergency_team", "field_officer"],
    status: "ACKNOWLEDGED",
    acknowledgedByName: "Disaster Control Unit",
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 60),
    actorRole: "emergency_team",
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: "ALT-104",
    incidentId: undefined,
    alertType: "LOGISTICS_DELAY",
    title: "Fuel Convoys Priority Corridor",
    message: "Green corridor operational Guwahati to Imphal via Kohima for essential supplies.",
    severity: "ADVISORY",
    corridor: "NH-2 / NH-39",
    roadSegment: "NH-2-IMPHAL",
    affectedVehicleIds: ["TRK-505"],
    affectedShipmentIds: ["SHP-006"],
    targetRoles: ["admin", "logistics_manager"],
    status: "ACTIVE",
    actorRole: "logistics_manager",
    createdAt: new Date(Date.now() - 1000 * 60 * 240),
  },
];

export async function listAlerts(limit = 50, filterRole?: string): Promise<BroadcastAlert[]> {
  const db = await getDb();
  let all: BroadcastAlert[] = [];
  if (db && isDatabaseAvailable()) {
    try {
      const rows = await db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(limit * 2);
      all = rows.map((r) => ({
        id: r.id,
        incidentId: r.incidentId,
        alertType: r.alertType,
        title: r.title,
        message: r.message,
        severity: r.severity as BroadcastAlert["severity"],
        corridor: r.corridor,
        roadSegment: r.roadSegment,
        affectedVehicleIds: r.affectedVehicleIds ? JSON.parse(r.affectedVehicleIds) : [],
        affectedShipmentIds: r.affectedShipmentIds ? JSON.parse(r.affectedShipmentIds) : [],
        targetRoles: r.targetRoles ? JSON.parse(r.targetRoles) : [],
        status: r.status as BroadcastAlert["status"],
        acknowledgedBy: r.acknowledgedBy,
        acknowledgedByName: r.acknowledgedByName,
        acknowledgedAt: r.acknowledgedAt,
        resolvedBy: r.resolvedBy,
        resolvedAt: r.resolvedAt,
        actorId: r.actorId,
        actorRole: r.actorRole ?? undefined,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch (err) {
      console.warn("[Database] listAlerts failed, falling back to memory:", err);
      all = [...memoryAlerts];
    }
  } else {
    all = [...memoryAlerts];
  }

  // Deduplicate and sort descending
  const sorted = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (!filterRole || filterRole === "admin") {
    return sorted.slice(0, limit);
  }

  // Role targeting filter
  const filtered = sorted.filter((a) => {
    const roles = a.targetRoles ?? [];
    if (filterRole === "truck_driver") {
      const isTargeted = roles.includes("truck_driver") || roles.length === 0;
      const hasVehicle = a.affectedVehicleIds?.includes("TRK-104");
      const isHighOrCritical = a.severity === "CRITICAL" || a.severity === "HIGH";
      return isTargeted || hasVehicle || isHighOrCritical;
    }
    if (filterRole === "emergency_team") {
      const isTargeted = roles.includes("emergency_team");
      const isHighOrCritical = a.severity === "CRITICAL" || a.severity === "HIGH";
      return isTargeted || isHighOrCritical;
    }
    if (filterRole === "logistics_manager") {
      const isTargeted = roles.includes("logistics_manager");
      const isLogistics = a.alertType === "LOGISTICS_DELAY" || a.alertType === "ROAD_BLOCKAGE";
      return isTargeted || isLogistics;
    }
    if (filterRole === "field_officer") {
      return roles.includes("field_officer") || a.alertType === "ROAD_BLOCKAGE";
    }
    return true;
  });

  return filtered.slice(0, limit);
}

export async function getAlert(id: string): Promise<BroadcastAlert | undefined> {
  const db = await getDb();
  if (db && isDatabaseAvailable()) {
    try {
      const rows = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          incidentId: r.incidentId,
          alertType: r.alertType,
          title: r.title,
          message: r.message,
          severity: r.severity as BroadcastAlert["severity"],
          corridor: r.corridor,
          roadSegment: r.roadSegment,
          affectedVehicleIds: r.affectedVehicleIds ? JSON.parse(r.affectedVehicleIds) : [],
          affectedShipmentIds: r.affectedShipmentIds ? JSON.parse(r.affectedShipmentIds) : [],
          targetRoles: r.targetRoles ? JSON.parse(r.targetRoles) : [],
          status: r.status as BroadcastAlert["status"],
          acknowledgedBy: r.acknowledgedBy,
          acknowledgedByName: r.acknowledgedByName,
          acknowledgedAt: r.acknowledgedAt,
          resolvedBy: r.resolvedBy,
          resolvedAt: r.resolvedAt,
          actorId: r.actorId,
          actorRole: r.actorRole ?? undefined,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }
    } catch (err) {
      console.warn("[Database] getAlert failed, checking memory:", err);
    }
  }
  return memoryAlerts.find((a) => a.id === id);
}

export async function createAlert(input: {
  incidentId?: string;
  alertType?: string;
  title: string;
  message: string;
  severity: "CRITICAL" | "HIGH" | "ADVISORY" | "INFO";
  corridor: string;
  roadSegment?: string;
  affectedVehicleIds?: string[];
  affectedShipmentIds?: string[];
  targetRoles?: string[];
  actorId?: number;
  actorRole?: string;
}): Promise<BroadcastAlert> {
  const alertType = input.alertType ?? "OPERATIONAL_DISRUPTION";

  // Deduplication Check:
  // If an alert for the same incident and alertType is already ACTIVE or ACKNOWLEDGED, return it!
  const existing = memoryAlerts.find(
    (a) =>
      a.status !== "RESOLVED" &&
      ((input.incidentId && a.incidentId === input.incidentId && a.alertType === alertType) ||
        (!input.incidentId && a.corridor === input.corridor && a.alertType === alertType && a.status === "ACTIVE"))
  );

  if (existing) {
    return existing;
  }

  const alert: BroadcastAlert = {
    id: `ALT-${Date.now().toString().slice(-6)}`,
    incidentId: input.incidentId ?? null,
    alertType,
    title: input.title,
    message: input.message,
    severity: input.severity,
    corridor: input.corridor,
    roadSegment: input.roadSegment ?? null,
    affectedVehicleIds: input.affectedVehicleIds ?? [],
    affectedShipmentIds: input.affectedShipmentIds ?? [],
    targetRoles: input.targetRoles ?? ["admin", "emergency_team", "logistics_manager", "truck_driver", "field_officer"],
    status: "ACTIVE",
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? "emergency_team",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryAlerts.unshift(alert);

  const db = await getDb();
  if (db && isDatabaseAvailable()) {
    try {
      await db.insert(alerts).values({
        id: alert.id,
        incidentId: alert.incidentId,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        corridor: alert.corridor,
        roadSegment: alert.roadSegment,
        affectedVehicleIds: JSON.stringify(alert.affectedVehicleIds),
        affectedShipmentIds: JSON.stringify(alert.affectedShipmentIds),
        targetRoles: JSON.stringify(alert.targetRoles),
        status: alert.status,
        actorId: alert.actorId,
        actorRole: alert.actorRole,
        isDemo: true,
      });
    } catch (err) {
      console.warn("[Database] createAlert failed, persisted in memory fallback:", err);
    }
  }

  await appendAuditEvent({
    actorId: input.actorId,
    action: "alert.created",
    entityType: "alert",
    entityId: alert.id,
    details: JSON.stringify({
      severity: alert.severity,
      alertType: alert.alertType,
      corridor: alert.corridor,
      title: alert.title,
      incidentId: alert.incidentId,
      affectedVehicles: alert.affectedVehicleIds,
      affectedShipments: alert.affectedShipmentIds,
    }),
  });

  return alert;
}

export async function acknowledgeAlert(
  id: string,
  actorId: number,
  actorName?: string
): Promise<BroadcastAlert | undefined> {
  const alert = memoryAlerts.find((a) => a.id === id);
  const now = new Date();
  if (alert) {
    alert.status = "ACKNOWLEDGED";
    alert.acknowledgedBy = actorId;
    alert.acknowledgedByName = actorName ?? `Operator #${actorId}`;
    alert.acknowledgedAt = now;
    alert.updatedAt = now;
  }

  const db = await getDb();
  if (db && isDatabaseAvailable()) {
    try {
      await db
        .update(alerts)
        .set({
          status: "ACKNOWLEDGED",
          acknowledgedBy: actorId,
          acknowledgedByName: actorName ?? `Operator #${actorId}`,
          acknowledgedAt: now,
        })
        .where(eq(alerts.id, id));
    } catch (err) {
      console.warn("[Database] acknowledgeAlert failed in DB:", err);
    }
  }

  await appendAuditEvent({
    actorId,
    action: "alert.acknowledged",
    entityType: "alert",
    entityId: id,
    details: JSON.stringify({ acknowledgedBy: actorId, acknowledgedByName: actorName, timestamp: now.toISOString() }),
  });

  return alert;
}

export async function resolveAlert(
  id: string,
  actorId: number,
  resolutionNotes?: string
): Promise<BroadcastAlert | undefined> {
  const alert = memoryAlerts.find((a) => a.id === id);
  const now = new Date();
  if (alert) {
    alert.status = "RESOLVED";
    alert.resolvedBy = actorId;
    alert.resolvedAt = now;
    alert.updatedAt = now;
  }

  const db = await getDb();
  if (db && isDatabaseAvailable()) {
    try {
      await db
        .update(alerts)
        .set({
          status: "RESOLVED",
          resolvedBy: actorId,
          resolvedAt: now,
        })
        .where(eq(alerts.id, id));
    } catch (err) {
      console.warn("[Database] resolveAlert failed in DB:", err);
    }
  }

  await appendAuditEvent({
    actorId,
    action: "alert.resolved",
    entityType: "alert",
    entityId: id,
    details: JSON.stringify({ resolvedBy: actorId, resolutionNotes, timestamp: now.toISOString() }),
  });

  return alert;
}

export async function resolveAlertsForIncident(incidentId: string, actorId?: number): Promise<void> {
  const matching = memoryAlerts.filter((a) => a.incidentId === incidentId && a.status !== "RESOLVED");
  for (const a of matching) {
    await resolveAlert(a.id, actorId ?? 1, `Incident ${incidentId} resolved/closed.`);
  }
}


