import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { appendAuditEvent, createAlert, createIncident, createShipment, getAlert, acknowledgeAlert, resolveAlert, resolveAlertsForIncident, getDb, getIncidentById, getUserByOpenId, getVehicle, listAlerts, listAuditEvents, listIncidents, listShipments, listVehicles, listWeatherSnapshots, saveWeatherSnapshots, seedDemoData, updateIncidentRoadAccessibility, updateIncidentStatus, updateShipment, updateVehicle, upsertUser, recordVehicleLocation, getVehicleLocationHistory, isDatabaseAvailable } from "./db";
import type { User } from "../drizzle/schema";
import { demoRiskScenarios, getDemoRiskPredictions, LIVE_WEATHER_DATA_LABEL, WEATHER_DATA_LABEL, predictRisk } from "./riskEngine";
import { corridorCoordinates, fetchLiveWeather } from "./weatherProvider";
import { getDemoSafetyValidations } from "./safetyEngine";
import { buildRoadGraphWithIncidents, optimizeRoute, type RouteNodeId } from "./routeEngine";
import { calculateGpsFreshness, matchVehicleToCorridor, simulatedGpsProvider } from "./gpsEngine";
import { calculateOperationalEta, formatEtaDuration } from "./etaEngine";
import { evaluateEmergencyImpact, buildAlertDraftsFromImpact, buildNoSafeRouteAlert } from "./emergencyImpactEngine";

const fallbackSnapshot = {
  generatedAt: "2026-09-08T13:30:00.000Z",
  mode: "demo",
  region: "Northeast Region",
  metrics: { activeVehicles: 18, activeDeliveries: 42, highRiskCorridors: 3, openIncidents: 7, delayedShipments: 4, blockedRoads: 2, criticalIncidents: 2, criticalShipments: 6, affectedVehicles: 3, emergencyCorridors: 4 },
  vehicles: [
    { id: "TRK-104", shipment: "Emergency Medicine", position: "Guwahati → Imphal", status: "At risk", eta: "3h 42m", risk: "HIGH" },
    { id: "TRK-219", shipment: "Flood Relief Kits", position: "Dimapur → Kohima", status: "On route", eta: "1h 18m", risk: "MODERATE" },
    { id: "TRK-088", shipment: "Cold Chain Vaccines", position: "Agartala → Aizawl", status: "On route", eta: "5h 06m", risk: "LOW" },
  ],
  incidents: [
    { id: "INC-2408", type: "Bridge damage", location: "NH-37 · Jorhat corridor", severity: "Critical", age: "7 min ago", status: "Under review" },
    { id: "INC-2407", type: "Road blockage", location: "NH-2 · Kohima approach", severity: "High", age: "22 min ago", status: "Verified" },
    { id: "INC-2406", type: "Heavy rainfall", location: "NH-6 · Shillong bypass", severity: "Moderate", age: "41 min ago", status: "Monitoring" },
  ],
  risk: getDemoRiskPredictions(),
};

type OperationalRole = NonNullable<User["operationalRole"]>;
const operationalProcedure = (allowedRoles: readonly OperationalRole[]) => protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin" && !allowedRoles.includes(ctx.user.operationalRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your operational role cannot perform this action." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const governmentAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin" || ctx.user.operationalRole !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only Government Admin can override route safety." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const severityInput = z.enum(["LOW", "MEDIUM", "MODERATE", "HIGH", "CRITICAL"]);
const photoUrlInput = z.string().refine(value => value.startsWith("/storage/") || value.startsWith("/manus-storage/") || /^https?:\/\//.test(value), "Photo URL must come from the configured storage endpoint").optional();
const incidentInput = z.object({
  id: z.string().min(1).max(32).optional(),
  type: z.enum(["Landslide", "Flood", "Road Damage", "Bridge Damage", "Traffic", "Fallen Tree", "Road Blockage", "Other"]),
  severity: severityInput,
  description: z.string().min(3).max(4000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  roadAccessibility: z.enum(["accessible", "restricted", "blocked", "unknown"]),
  occurredAt: z.coerce.date(),
  reporterRole: z.string().max(40).optional(),
  photoUrl: photoUrlInput,
});

function normalizeSeverity(severity: z.infer<typeof severityInput>) {
  return severity === "MEDIUM" ? "MODERATE" as const : severity;
}

function incidentMatches(existing: NonNullable<Awaited<ReturnType<typeof getIncidentById>>>, input: z.infer<typeof incidentInput>) {
  return existing.type === input.type && existing.severity === normalizeSeverity(input.severity) && existing.description === input.description && Number(existing.latitude) === input.latitude && Number(existing.longitude) === input.longitude && existing.roadAccessibility === input.roadAccessibility && existing.occurredAt.getTime() === input.occurredAt.getTime() && (existing.photoUrl ?? undefined) === input.photoUrl;
}

function formatAge(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ").replace(/^\w/, character => character.toUpperCase());
}

async function persistRiskWeatherSnapshots(predictions: ReturnType<typeof getDemoRiskPredictions>) {
  const predictionTimestamp = new Date();
  await saveWeatherSnapshots(predictions.map(item => ({
    roadSegment: item.id,
    rainfallIntensity: item.prediction.weather?.rainfallIntensity?.toFixed(2),
    temperatureC: item.prediction.weather?.temperatureC?.toFixed(2),
    floodWarning: item.prediction.weather?.floodWarning ?? false,
    landslideWarning: item.prediction.weather?.landslideWarning ?? false,
    weatherSource: item.prediction.weatherDataLabel,
    weatherStatus: item.prediction.weatherFreshness,
    weatherTimestamp: item.prediction.weather?.observedAt ? new Date(item.prediction.weather.observedAt) : null,
    predictionTimestamp,
    predictionProbability: item.prediction.probability,
    predictionConfidence: item.prediction.confidence,
    predictionRiskLevel: item.prediction.riskLevel,
  })));
}

async function getWeatherAwareRiskPredictions() {
  return Promise.all(demoRiskScenarios.map(async scenario => {
    const weather = await fetchLiveWeather(corridorCoordinates[scenario.id] ?? { latitude: 26.1445, longitude: 91.7362 }, scenario.weather);
    return { id: scenario.id, label: scenario.label, prediction: predictRisk({ ...scenario.features, weather }) };
  }));
}

function weatherSourceLabel(predictions: Awaited<ReturnType<typeof getWeatherAwareRiskPredictions>>) {
  const sources = new Set(predictions.map(item => item.prediction.weatherDataLabel));
  if (sources.size === 1) return predictions[0]?.prediction.weatherDataLabel ?? WEATHER_DATA_LABEL;
  return `${LIVE_WEATHER_DATA_LABEL} / ${WEATHER_DATA_LABEL}`;
}

function enrichVehicle(v: any) {
  const freshness = calculateGpsFreshness(v.lastUpdated);
  const lat = Number(v.latitude) || 26.1445;
  const lon = Number(v.longitude) || 91.7362;
  const corridorMatch = matchVehicleToCorridor(lat, lon);
  return {
    ...v,
    latitudeNum: lat,
    longitudeNum: lon,
    speedNum: Number(v.speed) || 0,
    headingNum: Number(v.heading) || 0,
    gpsSource: (v.gpsSource || "SIMULATED GPS") as "SIMULATED GPS" | "LIVE GPS",
    isSimulated: (v.gpsSource || "SIMULATED GPS").includes("SIMULATED"),
    freshness: freshness.freshness,
    freshnessLabel: freshness.label,
    currentCorridor: v.currentCorridor || corridorMatch.corridorName,
    nearestRoadSegment: corridorMatch.nearestSegment,
  };
}

function enrichShipment(s: any, vehicleMap: Map<string, any>) {
  const planned = s.plannedEtaMinutes ?? s.etaMinutes ?? 120;
  const current = s.etaMinutes ?? planned;
  const delay = s.delayMinutes ?? Math.max(0, current - planned);
  const assignedVeh = s.assignedVehicleId ? vehicleMap.get(s.assignedVehicleId) : null;
  return {
    ...s,
    plannedEtaMinutes: planned,
    currentEtaMinutes: current,
    delayMinutes: delay,
    delayReason: s.delayReason || (delay > 0 ? "Delay due to transit conditions" : "On schedule"),
    priority: s.priority ?? "NORMAL",
    assignedVehicle: assignedVeh ? {
      id: assignedVeh.id,
      status: assignedVeh.status,
      speed: assignedVeh.speed,
      latitude: assignedVeh.latitude,
      longitude: assignedVeh.longitude,
      currentCorridor: assignedVeh.currentCorridor,
    } : null,
  };
}

async function buildPersistedSnapshot() {
  const [rawVehicles, rawShipments, incidents] = await Promise.all([listVehicles(50), listShipments(50), listIncidents(50)]);
  if (!rawVehicles.length && !rawShipments.length && !incidents.length) return fallbackSnapshot;
  
  const vehicleMap = new Map(rawVehicles.map(v => [v.id, v]));
  const vehicles = rawVehicles.map(enrichVehicle);
  const shipments = rawShipments.map(s => enrichShipment(s, vehicleMap));
  const shipmentById = new Map(shipments.map(shipment => [shipment.id, shipment]));
  
  const activeVehicles = vehicles.filter(vehicle => !["idle", "offline"].includes(vehicle.status)).length;
  const openIncidents = incidents.filter(incident => incident.status !== "REJECTED").length;
  const highRiskCorridors = incidents.filter(incident => ["HIGH", "CRITICAL"].includes(incident.severity) && incident.status !== "REJECTED").length;
  const blockedRoads = incidents.filter(incident => incident.roadAccessibility === "blocked" && incident.status === "VERIFIED").length;
  
  return {
    generatedAt: new Date().toISOString(),
    mode: "demo",
    region: "Northeast Region",
    databaseAvailable: isDatabaseAvailable(),
    metrics: {
      activeVehicles,
      activeDeliveries: shipments.filter(shipment => shipment.status !== "delivered").length,
      highRiskCorridors,
      openIncidents,
      delayedShipments: shipments.filter(shipment => shipment.status === "delayed" || (shipment.delayMinutes ?? 0) > 0).length,
      blockedRoads,
      criticalIncidents: incidents.filter(incident => incident.status === "VERIFIED" && incident.severity === "CRITICAL").length,
      criticalShipments: shipments.filter(shipment => shipment.status !== "delivered" && shipment.priority === "CRITICAL").length,
      affectedVehicles: vehicles.filter(vehicle => ["HIGH", "CRITICAL"].includes(vehicle.risk) && vehicle.status !== "offline").length,
      emergencyCorridors: incidents.filter(incident => incident.status === "VERIFIED" && incident.roadAccessibility !== "accessible").length,
    },
    vehicles: vehicles.slice(0, 10).map(vehicle => ({
      id: vehicle.id,
      shipment: shipmentById.get(vehicle.shipmentId ?? "")?.name ?? "Unassigned",
      position: `${vehicle.latitude}, ${vehicle.longitude}`,
      status: vehicle.status.replace("_", " "),
      eta: formatEtaDuration(vehicle.etaMinutes),
      risk: vehicle.risk,
      speed: `${vehicle.speedNum} km/h`,
      heading: `${vehicle.headingNum}°`,
      corridor: vehicle.currentCorridor,
      gpsSource: vehicle.gpsSource,
      freshness: vehicle.freshness,
      freshnessLabel: vehicle.freshnessLabel,
    })),
    shipments: shipments.slice(0, 15),
    incidents: incidents.slice(0, 10).map(incident => ({
      id: incident.id,
      type: incident.type,
      location: `${incident.latitude}, ${incident.longitude}`,
      severity: incident.severity,
      age: formatAge(incident.occurredAt),
      status: formatStatus(incident.status),
    })),
    risk: getDemoRiskPredictions(),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure
      .input(
        z.object({
          role: z.enum(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team", "viewer"]).default("admin"),
          name: z.string().min(1).max(100).optional(),
          email: z.string().email().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const roleProfiles: Record<OperationalRole, { name: string; email: string; authRole: "admin" | "user" }> = {
          admin: { name: "Aditi Sharma (District Admin)", email: "aditi.admin@ner-logiai.gov.in", authRole: "admin" },
          field_officer: { name: "Rajesh Bora (Field Officer)", email: "rajesh.field@ner-logiai.gov.in", authRole: "user" },
          truck_driver: { name: "Biren Gogoi (Driver)", email: "biren.driver@assamtransport.in", authRole: "user" },
          logistics_manager: { name: "Pooja Das (Logistics Mgr)", email: "pooja.logistics@ner-logiai.gov.in", authRole: "user" },
          emergency_team: { name: "Dr. L. Hmar (ERT Lead)", email: "ert.lead@disastermgmt.ner.gov.in", authRole: "user" },
          viewer: { name: "Observer / Auditor", email: "viewer@ner-logiai.org", authRole: "user" },
        };
        const profile = roleProfiles[input.role] ?? roleProfiles.admin;
        const name = input.name || profile.name;
        const email = input.email || profile.email;
        const openId = `user_${input.role}`;

        await upsertUser({
          openId,
          name,
          email,
          loginMethod: "standalone_prototype",
          role: profile.authRole,
          operationalRole: input.role,
          lastSignedIn: new Date(),
        });

        const token = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const user = await getUserByOpenId(openId);
        return { success: true, token, user };
      }),
    switchRole: protectedProcedure
      .input(
        z.object({
          role: z.enum(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team", "viewer"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isAdmin = input.role === "admin";
        await upsertUser({
          openId: ctx.user.openId,
          role: isAdmin ? "admin" : ctx.user.role,
          operationalRole: input.role,
          lastSignedIn: new Date(),
        });
        ctx.user.operationalRole = input.role;
        if (isAdmin) ctx.user.role = "admin";
        const updatedUser = await getUserByOpenId(ctx.user.openId);
        return { success: true, operationalRole: input.role, user: updatedUser };
      }),
    personas: publicProcedure.query(() => [
      { role: "admin", label: "Government / District Administrator", name: "Aditi Sharma", email: "aditi.admin@ner-logiai.gov.in", description: "Full operational authority: route overrides, incident verification, system audit." },
      { role: "field_officer", label: "Field Officer", name: "Rajesh Bora", email: "rajesh.field@ner-logiai.gov.in", description: "Ground truth reporting: capture incident reports, road accessibility, GPS & photo evidence." },
      { role: "truck_driver", label: "Truck Driver", name: "Biren Gogoi", email: "biren.driver@assamtransport.in", description: "Assigned corridor TRK-104 (Emergency Medicine): view route risks & alternate bypasses." },
      { role: "logistics_manager", label: "Logistics Manager", name: "Pooja Das", email: "pooja.logistics@ner-logiai.gov.in", description: "Supply chain operations: priority shipments, fleet capacity, audit event logs." },
      { role: "emergency_team", label: "Emergency Response Team", name: "Dr. L. Hmar", email: "ert.lead@disastermgmt.ner.gov.in", description: "Rapid accessibility: critical incidents, blocked roads, high-risk vehicles." },
      { role: "viewer", label: "Public Viewer / Auditor", name: "Observer / Auditor", email: "viewer@ner-logiai.org", description: "Read-only access: view regional status and live risk intelligence." },
    ]),
  }),
  demo: router({
    snapshot: publicProcedure.query(() => buildPersistedSnapshot()),
    risk: publicProcedure.query(async () => {
      const predictions = await getWeatherAwareRiskPredictions();
      await persistRiskWeatherSnapshots(predictions);
      return { dataLabel: "SIMULATED / PROTOTYPE DATA", weatherDataLabel: weatherSourceLabel(predictions), predictions, advisory: "AI prediction — requires route safety validation." };
    }),
    weatherSnapshots: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(10), roadSegment: z.string().min(1).max(80).optional() }).optional()).query(({ input }) => listWeatherSnapshots(input?.limit ?? 10, input?.roadSegment)),
    safety: publicProcedure.query(() => ({ dataLabel: "SIMULATED / PROTOTYPE DATA", validations: getDemoSafetyValidations(), advisory: "AI prediction — requires route safety validation." })),
    routes: publicProcedure.input(z.object({ origin: z.enum(["GUWAHATI", "JORHAT", "KOHIMA", "SHILLONG", "IMPHAL", "REMOTE_BLOCKED"]).default("GUWAHATI"), destination: z.enum(["GUWAHATI", "JORHAT", "KOHIMA", "SHILLONG", "IMPHAL", "REMOTE_BLOCKED"]).default("IMPHAL") }).optional()).query(async ({ input }) => {
      const predictions = await getWeatherAwareRiskPredictions();
      await persistRiskWeatherSnapshots(predictions);
      const recommendation = optimizeRoute((input?.origin ?? "GUWAHATI") as RouteNodeId, (input?.destination ?? "IMPHAL") as RouteNodeId, predictions);
      return { dataLabel: "SIMULATED / PROTOTYPE DATA", weatherDataLabel: recommendation.weatherSource, recommendation };
    }),
    incidents: publicProcedure.query(() => listIncidents(100)),
    ensureSeeded: publicProcedure.mutation(() => seedDemoData()),
    createIncident: publicProcedure.input(incidentInput).mutation(async ({ input }) => createIncident({ id: input.id, type: input.type, severity: normalizeSeverity(input.severity), status: "UNVERIFIED", description: input.description, latitude: input.latitude.toFixed(6), longitude: input.longitude.toFixed(6), roadAccessibility: input.roadAccessibility, reporterRole: input.reporterRole ?? "field_officer", photoUrl: input.photoUrl, isDemo: true, occurredAt: input.occurredAt })),
    syncIncident: publicProcedure.input(incidentInput).mutation(async ({ input }) => {
      if (!input.id) throw new TRPCError({ code: "BAD_REQUEST", message: "A stable offline incident ID is required for synchronization." });
      const existing = await getIncidentById(input.id);
      if (existing) {
        if (incidentMatches(existing, input)) return { status: "SYNCED" as const, incident: existing, duplicate: true };
        await appendAuditEvent({ action: "incident.sync_conflict", entityType: "incident", entityId: input.id, details: JSON.stringify({ reason: "offline payload differs from server record", serverUpdatedAt: existing.updatedAt?.toISOString?.() ?? null }) });
        return { status: "CONFLICT" as const, incident: existing, duplicate: false };
      }
      const incident = await createIncident({ id: input.id, type: input.type, severity: normalizeSeverity(input.severity), status: "UNVERIFIED", description: input.description, latitude: input.latitude.toFixed(6), longitude: input.longitude.toFixed(6), roadAccessibility: input.roadAccessibility, reporterRole: input.reporterRole ?? "field_officer", photoUrl: input.photoUrl, isDemo: true, occurredAt: input.occurredAt });
      return { status: "SYNCED" as const, incident, duplicate: false };
    }),
    reviewIncident: publicProcedure.input(z.object({ id: z.string().min(1), status: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED"]) })).mutation(({ input }) => updateIncidentStatus(input.id, input.status)),
  }),
  access: router({
    current: protectedProcedure.query(({ ctx }) => ({
      authRole: ctx.user.role,
      operationalRole: ctx.user.operationalRole,
      capabilities: {
        viewOperations: true,
        createIncident: ctx.user.role === "admin" || ["field_officer", "truck_driver", "emergency_team"].includes(ctx.user.operationalRole),
        reviewIncident: ctx.user.role === "admin",
        viewAudit: ctx.user.role === "admin" || ctx.user.operationalRole === "logistics_manager",
      },
    })),
  }),
  operations: router({
    snapshot: protectedProcedure.query(async ({ ctx }) => {
      const [rawIncidents, rawVehicles, rawShipments] = await Promise.all([listIncidents(100), listVehicles(100), listShipments(100)]);
      const vehicleMap = new Map(rawVehicles.map(v => [v.id, v]));
      const allVehicles = rawVehicles.map(enrichVehicle);
      const allShipments = rawShipments.map(s => enrichShipment(s, vehicleMap));
      const dbAvailable = isDatabaseAvailable();

      if (ctx.user.role === "admin" || ctx.user.operationalRole === "admin" || ctx.user.operationalRole === "logistics_manager") {
        return { databaseAvailable: dbAvailable, incidents: rawIncidents, vehicles: allVehicles, shipments: allShipments };
      }
      if (ctx.user.operationalRole === "truck_driver") {
        return {
          databaseAvailable: dbAvailable,
          incidents: rawIncidents.filter(incident => ["HIGH", "CRITICAL"].includes(incident.severity)),
          vehicles: allVehicles.filter(vehicle => vehicle.id === "TRK-104"),
          shipments: allShipments.filter(shipment => shipment.id === "SHP-001"),
        };
      }
      if (ctx.user.operationalRole === "emergency_team") {
        return {
          databaseAvailable: dbAvailable,
          incidents: rawIncidents.filter(incident => incident.status === "VERIFIED" && incident.severity === "CRITICAL"),
          vehicles: allVehicles.filter(vehicle => ["HIGH", "CRITICAL"].includes(vehicle.risk)),
          shipments: allShipments.filter(shipment => shipment.priority === "CRITICAL"),
        };
      }
      return {
        databaseAvailable: dbAvailable,
        incidents: rawIncidents.filter(incident => incident.reporterId === ctx.user.id || ["HIGH", "CRITICAL"].includes(incident.severity)),
        vehicles: [],
        shipments: [],
      };
    }),
    vehicles: operationalProcedure(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team"]).query(async ({ ctx }) => {
      const rawVehicles = await listVehicles(100);
      const allVehicles = rawVehicles.map(enrichVehicle);
      if (ctx.user.operationalRole === "truck_driver") {
        return allVehicles.filter(v => v.id === "TRK-104");
      }
      if (ctx.user.operationalRole === "emergency_team") {
        return allVehicles.filter(v => ["HIGH", "CRITICAL"].includes(v.risk));
      }
      return allVehicles;
    }),
    vehicleById: operationalProcedure(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team"]).input(z.object({
      vehicleId: z.string(),
    })).query(async ({ input }) => {
      const v = await getVehicle(input.vehicleId);
      if (!v) throw new TRPCError({ code: "NOT_FOUND", message: `Vehicle ${input.vehicleId} not found` });
      const enriched = enrichVehicle(v);
      const history = await getVehicleLocationHistory(input.vehicleId, 25);
      return { vehicle: enriched, locationHistory: history };
    }),
    updateVehicleGps: operationalProcedure(["admin", "truck_driver", "field_officer"]).input(z.object({
      vehicleId: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      speed: z.number().optional(),
      heading: z.number().optional(),
      corridor: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const updated = await recordVehicleLocation({
        vehicleId: input.vehicleId,
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed,
        heading: input.heading,
        currentCorridor: input.corridor,
        gpsSource: "SIMULATED GPS",
      });
      await appendAuditEvent({
        actorId: ctx.user.id,
        action: "vehicle.gps_update",
        entityType: "vehicle",
        entityId: input.vehicleId,
        details: JSON.stringify({
          latitude: input.latitude,
          longitude: input.longitude,
          speed: input.speed,
          source: "SIMULATED GPS",
        }),
      });
      return { success: true, vehicle: updated ? enrichVehicle(updated) : null };
    }),
    stepVehicleSimulation: operationalProcedure(["admin", "truck_driver", "logistics_manager"]).input(z.object({
      vehicleId: z.string().default("TRK-104"),
    })).mutation(async ({ ctx, input }) => {
      const stepped = await simulatedGpsProvider.stepVehicleSimulation(input.vehicleId);
      if (stepped) {
        await recordVehicleLocation({
          vehicleId: stepped.vehicleId,
          latitude: stepped.latitude,
          longitude: stepped.longitude,
          speed: stepped.speed,
          heading: stepped.heading,
          currentCorridor: stepped.currentCorridor,
          gpsSource: "SIMULATED GPS",
        });
      }
      const v = await getVehicle(input.vehicleId);
      return { success: true, vehicle: v ? enrichVehicle(v) : null };
    }),
    shipments: operationalProcedure(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team"]).query(async ({ ctx }) => {
      const [rawShipments, rawVehicles] = await Promise.all([listShipments(100), listVehicles(100)]);
      const vehicleMap = new Map(rawVehicles.map(v => [v.id, v]));
      const allShipments = rawShipments.map(s => enrichShipment(s, vehicleMap));
      if (ctx.user.operationalRole === "truck_driver") {
        return allShipments.filter(s => s.id === "SHP-001");
      }
      if (ctx.user.operationalRole === "emergency_team") {
        return allShipments.filter(s => s.priority === "CRITICAL");
      }
      return allShipments;
    }),
    shipmentById: operationalProcedure(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team"]).input(z.object({
      shipmentId: z.string(),
    })).query(async ({ input }) => {
      const s = await listShipments(100).then(list => list.find(item => item.id === input.shipmentId));
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: `Shipment ${input.shipmentId} not found` });
      const rawVehicles = await listVehicles(100);
      const vehicleMap = new Map(rawVehicles.map(v => [v.id, v]));
      return enrichShipment(s, vehicleMap);
    }),
    calculateEta: operationalProcedure(["admin", "truck_driver", "logistics_manager", "emergency_team"]).input(z.object({
      routeDistanceKm: z.number().positive(),
      expectedSpeedKmH: z.number().optional(),
      currentVehicleSpeedKmH: z.number().optional(),
      roadAccessibility: z.enum(["accessible", "restricted", "blocked"]).optional(),
      riskLevel: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]).optional(),
      hasVerifiedBlockage: z.boolean().optional(),
      isAlternateRoute: z.boolean().optional(),
      alternateAddedDistanceKm: z.number().optional(),
    })).query(({ input }) => {
      return calculateOperationalEta(input);
    }),
    risk: operationalProcedure(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team"]).query(async ({ ctx }) => {
      const predictions = await getWeatherAwareRiskPredictions();
      await persistRiskWeatherSnapshots(predictions);
      if (ctx.user.operationalRole === "truck_driver") return { dataLabel: "SIMULATED / PROTOTYPE DATA", weatherDataLabel: weatherSourceLabel(predictions), predictions: predictions.filter(item => item.id === "NH-37-JORHAT"), advisory: "AI prediction — requires route safety validation." };
      if (ctx.user.operationalRole === "emergency_team") return { dataLabel: "SIMULATED / PROTOTYPE DATA", weatherDataLabel: weatherSourceLabel(predictions), predictions: predictions.filter(item => item.prediction.riskLevel === "CRITICAL" || item.prediction.riskLevel === "HIGH"), advisory: "AI prediction — requires route safety validation." };
      return { dataLabel: "SIMULATED / PROTOTYPE DATA", weatherDataLabel: weatherSourceLabel(predictions), predictions, advisory: "AI prediction — requires route safety validation." };
    }),
    safety: operationalProcedure(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team"]).query(({ ctx }) => {
      const validations = getDemoSafetyValidations();
      if (ctx.user.operationalRole === "truck_driver") return { dataLabel: "SIMULATED / PROTOTYPE DATA", validations: validations.filter(item => item.id === "NH-37-JORHAT"), advisory: "AI prediction — requires route safety validation." };
      if (ctx.user.operationalRole === "emergency_team") return { dataLabel: "SIMULATED / PROTOTYPE DATA", validations: validations.filter(item => item.validation.status !== "SAFE"), advisory: "AI prediction — requires route safety validation." };
      return { dataLabel: "SIMULATED / PROTOTYPE DATA", validations, advisory: "AI prediction — requires route safety validation." };
    }),
    route: operationalProcedure(["admin", "field_officer", "truck_driver", "logistics_manager", "emergency_team"]).input(z.object({ origin: z.enum(["GUWAHATI", "JORHAT", "KOHIMA", "SHILLONG", "IMPHAL", "REMOTE_BLOCKED"]).default("GUWAHATI"), destination: z.enum(["GUWAHATI", "JORHAT", "KOHIMA", "SHILLONG", "IMPHAL", "REMOTE_BLOCKED"]).default("IMPHAL") }).optional()).query(async ({ ctx, input }) => {
      const origin = (input?.origin ?? "GUWAHATI") as RouteNodeId;
      const destination = (input?.destination ?? "IMPHAL") as RouteNodeId;
      const [predictions, activeIncidents] = await Promise.all([
        getWeatherAwareRiskPredictions(),
        listIncidents(100),
      ]);
      await persistRiskWeatherSnapshots(predictions);
      const roadGraph = buildRoadGraphWithIncidents(activeIncidents);
      const recommendation = ctx.user.operationalRole === "truck_driver" ? optimizeRoute("GUWAHATI", "IMPHAL", predictions, roadGraph) : optimizeRoute(origin, destination, predictions, roadGraph);
      if (recommendation.status === "NO SAFE ROUTE AVAILABLE") {
        await appendAuditEvent({
          actorId: ctx.user.id,
          action: "no_safe_route.detected",
          entityType: "route",
          entityId: `${origin}->${destination}`,
          details: JSON.stringify({ origin, destination, reason: recommendation.reason }),
        });
        const noSafeDraft = buildNoSafeRouteAlert(`${origin} → ${destination}`, recommendation.reason);
        await createAlert({
          ...noSafeDraft,
          actorId: ctx.user.id,
          actorRole: ctx.user.operationalRole,
        });
      }
      return { dataLabel: "SIMULATED / PROTOTYPE DATA", weatherDataLabel: recommendation.weatherSource, recommendation };
    }),
    overrideSafety: governmentAdminProcedure.input(z.object({ routeId: z.string().min(1).max(80), status: z.enum(["SAFE", "CAUTION", "REJECTED"]), reason: z.string().min(3).max(500), timestamp: z.coerce.date() })).mutation(async ({ ctx, input }) => {
      await appendAuditEvent({ actorId: ctx.user.id, action: "safety.override", entityType: "route", entityId: input.routeId, details: JSON.stringify({ status: input.status, reason: input.reason, timestamp: input.timestamp.toISOString(), userId: ctx.user.id, role: ctx.user.operationalRole }) });
      return { routeId: input.routeId, status: input.status, reason: input.reason, timestamp: input.timestamp, userId: ctx.user.id, role: ctx.user.operationalRole } as const;
    }),
    acceptRoute: operationalProcedure(["truck_driver", "admin", "logistics_manager"]).input(z.object({
      vehicleId: z.string().default("TRK-104"),
      routeLabel: z.string().min(2),
      alternateRoute: z.string().min(2),
      distanceKm: z.number().positive(),
      etaMinutes: z.number().positive(),
      delayMinutes: z.number().optional(),
      delayReason: z.string().optional(),
      driverNotes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const vehicle = await getVehicle(input.vehicleId);
      if (vehicle) {
        await updateVehicle(input.vehicleId, {
          status: "on_route",
          etaMinutes: input.etaMinutes,
          activeRoute: input.alternateRoute,
        });
      }
      const allShipments = await listShipments(50);
      const associatedShipment = allShipments.find(s => s.id === (vehicle?.shipmentId ?? "SHP-001") || s.id === "SHP-001");
      const computedDelay = input.delayMinutes ?? (input.etaMinutes > 222 ? input.etaMinutes - 222 : 0);
      const computedReason = input.delayReason ?? (computedDelay > 0 ? "Delay due to route change (+23 km safe detour)" : "On schedule · alternate corridor confirmed");
      
      if (associatedShipment) {
        await updateShipment(associatedShipment.id, {
          etaMinutes: input.etaMinutes,
          delayMinutes: computedDelay,
          delayReason: computedReason,
          status: "in_transit",
          activeRoute: input.alternateRoute,
        });
      }
      const audit = await appendAuditEvent({
        actorId: ctx.user.id,
        action: "route.accepted_by_driver",
        entityType: "vehicle",
        entityId: input.vehicleId,
        details: JSON.stringify({
          routeLabel: input.routeLabel,
          alternateRoute: input.alternateRoute,
          distanceKm: input.distanceKm,
          etaMinutes: input.etaMinutes,
          delayMinutes: computedDelay,
          delayReason: computedReason,
          driverName: ctx.user.name,
          acceptedAt: new Date().toISOString(),
          humanInTheLoopConfirmed: true,
          automaticVehicleRedirect: false,
          shipmentId: associatedShipment?.id ?? "SHP-001",
        }),
      });
      await appendAuditEvent({
        actorId: ctx.user.id,
        action: "emergency_route.accepted",
        entityType: "vehicle",
        entityId: input.vehicleId,
        details: JSON.stringify({
          routeLabel: input.routeLabel,
          alternateRoute: input.alternateRoute,
          distanceKm: input.distanceKm,
          etaMinutes: input.etaMinutes,
          driverName: ctx.user.name,
          humanInTheLoopConfirmed: true,
          automaticVehicleRedirect: false,
        }),
      });
      return {
        success: true,
        vehicleId: input.vehicleId,
        routeLabel: input.routeLabel,
        auditId: audit?.id,
        humanInTheLoopConfirmed: true,
        automaticVehicleRedirect: false,
        message: "Alternate route acknowledged and logged. Proceed following manual driver confirmation.",
      };
    }),
    updateRoadStatus: operationalProcedure(["field_officer", "admin", "emergency_team"]).input(z.object({
      incidentId: z.string().optional(),
      corridor: z.string().min(2),
      roadAccessibility: z.enum(["accessible", "restricted", "blocked", "unknown"]),
      severity: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]).default("MODERATE"),
      description: z.string().min(3),
      latitude: z.number(),
      longitude: z.number(),
    })).mutation(async ({ ctx, input }) => {
      let targetIncident: any = null;
      if (input.incidentId) {
        targetIncident = await updateIncidentRoadAccessibility(input.incidentId, input.roadAccessibility, ctx.user.id);
      } else {
        targetIncident = await createIncident({
          type: input.roadAccessibility === "blocked" ? "Road Blockage" : "Road Condition Update",
          severity: input.severity,
          status: "UNVERIFIED",
          description: `[${input.corridor}] ${input.description}`,
          latitude: input.latitude.toFixed(6),
          longitude: input.longitude.toFixed(6),
          roadAccessibility: input.roadAccessibility,
          reporterId: ctx.user.id,
          reporterRole: ctx.user.operationalRole,
          isDemo: false,
          occurredAt: new Date(),
        }, ctx.user.id);
      }

      if (targetIncident && (input.roadAccessibility === "blocked" || targetIncident.status === "VERIFIED")) {
        const [rawVehicles, rawShipments] = await Promise.all([listVehicles(100), listShipments(100)]);
        const vehicleMap = new Map(rawVehicles.map(v => [v.id, v]));
        const shipments = rawShipments.map(s => enrichShipment(s, vehicleMap));
        const vehicles = rawVehicles.map(enrichVehicle);
        const impact = evaluateEmergencyImpact(targetIncident, vehicles, shipments);
        const drafts = buildAlertDraftsFromImpact(impact, targetIncident);
        for (const draft of drafts) {
          await createAlert({
            ...draft,
            actorId: ctx.user.id,
            actorRole: ctx.user.operationalRole,
          });
        }
      } else if (targetIncident && input.roadAccessibility === "accessible" && input.incidentId) {
        await resolveAlertsForIncident(input.incidentId, ctx.user.id);
      }

      return { success: true, incident: targetIncident };
    }),
    createIncident: operationalProcedure(["field_officer", "truck_driver", "emergency_team"]).input(incidentInput).mutation(async ({ ctx, input }) => createIncident({ id: input.id, type: input.type, severity: normalizeSeverity(input.severity), status: "UNVERIFIED", description: input.description, latitude: input.latitude.toFixed(6), longitude: input.longitude.toFixed(6), reporterId: ctx.user.id, reporterRole: ctx.user.operationalRole, photoUrl: input.photoUrl, isDemo: false, roadAccessibility: input.roadAccessibility, occurredAt: input.occurredAt }, ctx.user.id)),
    reviewIncident: operationalProcedure(["admin"]).input(z.object({ id: z.string().min(1), status: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED"]) })).mutation(async ({ ctx, input }) => {
      const updated = await updateIncidentStatus(input.id, input.status, ctx.user.id);
      if (input.status === "VERIFIED" && updated) {
        const [rawVehicles, rawShipments] = await Promise.all([listVehicles(100), listShipments(100)]);
        const vehicleMap = new Map(rawVehicles.map(v => [v.id, v]));
        const shipments = rawShipments.map(s => enrichShipment(s, vehicleMap));
        const vehicles = rawVehicles.map(enrichVehicle);
        const impact = evaluateEmergencyImpact(updated, vehicles, shipments);
        
        if (impact.affectedCriticalShipments.length > 0) {
          await appendAuditEvent({
            actorId: ctx.user.id,
            action: "critical_shipment.impact_detected",
            entityType: "incident",
            entityId: updated.id,
            details: JSON.stringify({
              incidentId: updated.id,
              affectedCriticalShipments: impact.affectedCriticalShipments.map(s => s.id),
              emergencyPriority: impact.emergencyPriority,
            }),
          });
        }

        const drafts = buildAlertDraftsFromImpact(impact, updated);
        for (const draft of drafts) {
          await createAlert({
            ...draft,
            actorId: ctx.user.id,
            actorRole: ctx.user.operationalRole,
          });
        }

        await appendAuditEvent({
          actorId: ctx.user.id,
          action: "emergency_route.generated",
          entityType: "incident",
          entityId: updated.id,
          details: JSON.stringify({
            incidentId: updated.id,
            corridor: impact.corridor,
            roadSegment: impact.roadSegment,
            recommendedAction: impact.recommendedAction,
          }),
        });
      } else if (input.status === "REJECTED") {
        await resolveAlertsForIncident(input.id, ctx.user.id);
      }
      return updated;
    }),
    audit: operationalProcedure(["admin", "logistics_manager"]).input(z.object({ limit: z.number().int().min(1).max(100).default(50) })).query(({ input }) => listAuditEvents(input.limit)),
    recordAudit: operationalProcedure(["admin", "logistics_manager"]).input(z.object({ action: z.string().min(2), entityType: z.string().min(2), entityId: z.string().optional(), details: z.string().optional() })).mutation(async ({ ctx, input }) => appendAuditEvent({ ...input, actorId: ctx.user.id })),
    createShipment: operationalProcedure(["admin", "logistics_manager"]).input(z.object({
      name: z.string().min(2).max(120),
      priority: z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]).default("NORMAL"),
      origin: z.string().min(2).max(100),
      destination: z.string().min(2).max(100),
      etaMinutes: z.number().int().min(10).max(2000).default(180),
      vehicleId: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const shipment = await createShipment({
        name: input.name,
        priority: input.priority,
        origin: input.origin,
        destination: input.destination,
        etaMinutes: input.etaMinutes,
        status: "in_transit",
        isDemo: false,
      });
      await appendAuditEvent({
        actorId: ctx.user.id,
        action: "shipment.created",
        entityType: "shipment",
        entityId: shipment.id,
        details: JSON.stringify({ priority: input.priority, origin: input.origin, destination: input.destination, name: input.name }),
      });
      return shipment;
    }),
    alerts: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ ctx, input }) => {
      return listAlerts(input?.limit ?? 50, ctx.user.operationalRole);
    }),
    acknowledgeAlert: operationalProcedure(["admin", "emergency_team", "logistics_manager", "truck_driver"]).input(z.object({
      alertId: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const alert = await getAlert(input.alertId);
      if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: `Alert ${input.alertId} not found` });
      if (ctx.user.operationalRole === "truck_driver") {
        const isTargeted = alert.targetRoles?.includes("truck_driver") || alert.affectedVehicleIds?.includes("TRK-104");
        if (!isTargeted) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Truck drivers can only acknowledge alerts affecting their vehicle or route." });
        }
      }
      const updated = await acknowledgeAlert(input.alertId, ctx.user.id, ctx.user.name ?? `Operator #${ctx.user.id}`);
      return { success: true, alert: updated };
    }),
    resolveAlert: operationalProcedure(["admin", "emergency_team"]).input(z.object({
      alertId: z.string().min(1),
      resolutionNotes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const alert = await getAlert(input.alertId);
      if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: `Alert ${input.alertId} not found` });
      const updated = await resolveAlert(input.alertId, ctx.user.id, input.resolutionNotes);
      return { success: true, alert: updated };
    }),
    emergencyImpact: operationalProcedure(["admin", "emergency_team", "logistics_manager", "field_officer", "truck_driver"]).input(z.object({
      incidentId: z.string().optional(),
      corridor: z.string().optional(),
    })).query(async ({ input }) => {
      const [incidents, rawVehicles, rawShipments] = await Promise.all([
        listIncidents(100),
        listVehicles(100),
        listShipments(100),
      ]);
      const vehicleMap = new Map(rawVehicles.map(v => [v.id, v]));
      const shipments = rawShipments.map(s => enrichShipment(s, vehicleMap));
      const vehicles = rawVehicles.map(enrichVehicle);

      const targetIncident = input.incidentId
        ? incidents.find(i => i.id === input.incidentId)
        : incidents.find(i => i.status === "VERIFIED" && (i.roadAccessibility === "blocked" || i.severity === "CRITICAL")) ?? incidents[0];

      if (!targetIncident) return null;

      return evaluateEmergencyImpact({
        id: targetIncident.id,
        type: targetIncident.type,
        severity: targetIncident.severity,
        status: targetIncident.status,
        roadAccessibility: targetIncident.roadAccessibility,
        description: targetIncident.description,
        corridor: input.corridor ?? targetIncident.description,
        latitude: targetIncident.latitude,
        longitude: targetIncident.longitude,
      }, vehicles, shipments);
    }),
    broadcastAlert: operationalProcedure(["admin", "emergency_team"]).input(z.object({
      title: z.string().min(3).max(100),
      message: z.string().min(5).max(500),
      severity: z.enum(["CRITICAL", "HIGH", "ADVISORY"]).default("HIGH"),
      corridor: z.string().min(2).max(100),
    })).mutation(async ({ ctx, input }) => {
      return createAlert({
        ...input,
        actorId: ctx.user.id,
        actorRole: ctx.user.operationalRole,
      });
    }),
    corridors: protectedProcedure.query(async () => {
      const [predictions, validations, activeIncidents] = await Promise.all([
        getWeatherAwareRiskPredictions(),
        Promise.resolve(getDemoSafetyValidations()),
        listIncidents(100),
      ]);
      const validationMap = new Map(validations.map(v => [v.id, v.validation]));
      const predictionMap = new Map(predictions.map(p => [p.id, p]));

      const baseCorridors = [
        {
          id: "NH-37-JORHAT",
          name: "NH-37 · Guwahati to Upper Assam (Jorhat / Dibrugarh)",
          lengthKm: 310,
          state: "Assam",
          accessibility: "restricted" as "accessible" | "restricted" | "blocked",
          safetyStatus: validationMap.get("NH-37-JORHAT")?.status ?? "REJECTED",
          safetyReasons: validationMap.get("NH-37-JORHAT")?.reasons ?? ["Bridge integrity inspection active"],
          riskLevel: predictionMap.get("NH-37-JORHAT")?.prediction.riskLevel ?? "CRITICAL",
          riskProbability: predictionMap.get("NH-37-JORHAT")?.prediction.probability ?? 84,
          weather: predictionMap.get("NH-37-JORHAT")?.prediction.weather,
          criticalLoadTransitAllowed: false,
        },
        {
          id: "NH-2-KOHIMA",
          name: "NH-2 · Dimapur to Kohima / Imphal Corridor",
          lengthKm: 215,
          state: "Nagaland & Manipur",
          accessibility: "accessible" as "accessible" | "restricted" | "blocked",
          safetyStatus: validationMap.get("NH-2-KOHIMA")?.status ?? "CAUTION",
          safetyReasons: validationMap.get("NH-2-KOHIMA")?.reasons ?? ["Single-lane traffic open at landslide zone"],
          riskLevel: predictionMap.get("NH-2-KOHIMA")?.prediction.riskLevel ?? "HIGH",
          riskProbability: predictionMap.get("NH-2-KOHIMA")?.prediction.probability ?? 62,
          weather: predictionMap.get("NH-2-KOHIMA")?.prediction.weather,
          criticalLoadTransitAllowed: true,
        },
        {
          id: "NH-6-SHILLONG",
          name: "NH-6 · Guwahati - Shillong - Silchar Expressway",
          lengthKm: 320,
          state: "Meghalaya & Assam",
          accessibility: "accessible" as "accessible" | "restricted" | "blocked",
          safetyStatus: validationMap.get("NH-6-SHILLONG")?.status ?? "SAFE",
          safetyReasons: ["Accessible with standard precautions", "Fresh data available"],
          riskLevel: predictionMap.get("NH-6-SHILLONG")?.prediction.riskLevel ?? "LOW",
          riskProbability: predictionMap.get("NH-6-SHILLONG")?.prediction.probability ?? 18,
          weather: predictionMap.get("NH-6-SHILLONG")?.prediction.weather,
          criticalLoadTransitAllowed: true,
        },
        {
          id: "NH-39-IMPHAL",
          name: "NH-39 · Kohima - Maram - Imphal Lifeline",
          lengthKm: 140,
          state: "Manipur",
          accessibility: "accessible" as "accessible" | "restricted" | "blocked",
          safetyStatus: "SAFE" as const,
          safetyReasons: ["Paved mountain highway in operational condition"],
          riskLevel: "LOW" as const,
          riskProbability: 24,
          weather: null,
          criticalLoadTransitAllowed: true,
        },
        {
          id: "NH-44-AGARTALA",
          name: "NH-44 · Southern Connector to Tripura (Agartala)",
          lengthKm: 280,
          state: "Tripura & Meghalaya",
          accessibility: "accessible" as "accessible" | "restricted" | "blocked",
          safetyStatus: "CAUTION" as const,
          safetyReasons: ["Monsoon fog and intermittent heavy downpours"],
          riskLevel: "MEDIUM" as const,
          riskProbability: 41,
          weather: null,
          criticalLoadTransitAllowed: true,
        },
        {
          id: "NH-53-SILCHAR",
          name: "NH-53 · Silchar to Jiribam - Imphal Mountain Pass",
          lengthKm: 220,
          state: "Assam & Manipur",
          accessibility: "restricted" as "accessible" | "restricted" | "blocked",
          safetyStatus: "CAUTION" as const,
          safetyReasons: ["Slow transit due to widening works and mud slurry"],
          riskLevel: "HIGH" as const,
          riskProbability: 58,
          weather: null,
          criticalLoadTransitAllowed: true,
        },
      ];

      return baseCorridors.map(c => {
        const matching = activeIncidents.filter(inc => {
          const desc = (inc.description || "").toUpperCase();
          const type = (inc.type || "").toUpperCase();
          if (c.id === "NH-37-JORHAT" && (desc.includes("NH-37") || desc.includes("JORHAT"))) return true;
          if (c.id === "NH-2-KOHIMA" && (desc.includes("NH-2") || desc.includes("KOHIMA") || desc.includes("DIMAPUR"))) return true;
          if (c.id === "NH-6-SHILLONG" && (desc.includes("NH-6") || desc.includes("SHILLONG"))) return true;
          if (c.id === "NH-39-IMPHAL" && (desc.includes("NH-39") || desc.includes("IMPHAL"))) return true;
          if (c.id === "NH-44-AGARTALA" && (desc.includes("NH-44") || desc.includes("AGARTALA") || desc.includes("TRIPURA"))) return true;
          if (c.id === "NH-53-SILCHAR" && (desc.includes("NH-53") || desc.includes("SILCHAR") || desc.includes("JIRIBAM"))) return true;
          return false;
        });

        const isVerifiedBlocked = matching.some(m => m.status === "VERIFIED" && (m.roadAccessibility === "blocked" || m.severity === "CRITICAL" || m.type === "Road Blockage" || m.type === "Bridge Damage"));
        const hasExplicitBlocked = matching.some(m => m.roadAccessibility === "blocked");
        const hasRestricted = matching.some(m => m.roadAccessibility === "restricted" || (m.status === "VERIFIED" && m.severity === "HIGH"));

        if (isVerifiedBlocked || hasExplicitBlocked) {
          return {
            ...c,
            accessibility: "blocked" as const,
            safetyStatus: "REJECTED" as const,
            safetyReasons: ["Active verified road blockage / structural disruption reported"],
            criticalLoadTransitAllowed: false,
          };
        }
        if (hasRestricted) {
          return {
            ...c,
            accessibility: "restricted" as const,
            safetyStatus: c.safetyStatus === "REJECTED" ? "REJECTED" : "CAUTION" as const,
            safetyReasons: ["Incident under active response / single-lane restriction"],
          };
        }
        return c;
      });
    }),
  }),
});

export type AppRouter = typeof appRouter;
