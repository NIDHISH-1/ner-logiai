import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { appendAuditEvent, createIncident, getDb, getIncidentById, listAuditEvents, listIncidents, listShipments, listVehicles, listWeatherSnapshots, saveWeatherSnapshots, seedDemoData, updateIncidentStatus } from "./db";
import type { User } from "../drizzle/schema";
import { demoRiskScenarios, getDemoRiskPredictions, LIVE_WEATHER_DATA_LABEL, WEATHER_DATA_LABEL, predictRisk } from "./riskEngine";
import { corridorCoordinates, fetchLiveWeather } from "./weatherProvider";
import { getDemoSafetyValidations } from "./safetyEngine";
import { optimizeRoute, type RouteNodeId } from "./routeEngine";

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
const photoUrlInput = z.string().refine(value => value.startsWith("/manus-storage/") || /^https?:\/\//.test(value), "Photo URL must come from the configured storage endpoint").optional();
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

async function buildPersistedSnapshot() {
  const [vehicles, shipments, incidents] = await Promise.all([listVehicles(50), listShipments(50), listIncidents(50)]);
  if (!vehicles.length && !shipments.length && !incidents.length) return fallbackSnapshot;
  const shipmentById = new Map(shipments.map(shipment => [shipment.id, shipment]));
  const activeVehicles = vehicles.filter(vehicle => !["idle", "offline"].includes(vehicle.status)).length;
  const openIncidents = incidents.filter(incident => incident.status !== "REJECTED").length;
  const highRiskCorridors = incidents.filter(incident => ["HIGH", "CRITICAL"].includes(incident.severity) && incident.status !== "REJECTED").length;
  const blockedRoads = incidents.filter(incident => incident.roadAccessibility === "blocked" && incident.status === "VERIFIED").length;
  return {
    generatedAt: new Date().toISOString(), mode: "demo", region: "Northeast Region",
    metrics: { activeVehicles, activeDeliveries: shipments.filter(shipment => shipment.status !== "delivered").length, highRiskCorridors, openIncidents, delayedShipments: shipments.filter(shipment => shipment.status === "delayed").length, blockedRoads, criticalIncidents: incidents.filter(incident => incident.status === "VERIFIED" && incident.severity === "CRITICAL").length, criticalShipments: shipments.filter(shipment => shipment.status !== "delivered" && shipment.priority === "CRITICAL").length, affectedVehicles: vehicles.filter(vehicle => ["HIGH", "CRITICAL"].includes(vehicle.risk) && vehicle.status !== "offline").length, emergencyCorridors: incidents.filter(incident => incident.status === "VERIFIED" && incident.roadAccessibility !== "accessible").length },
    vehicles: vehicles.slice(0, 10).map(vehicle => ({ id: vehicle.id, shipment: shipmentById.get(vehicle.shipmentId ?? "")?.name ?? "Unassigned", position: `${vehicle.latitude}, ${vehicle.longitude}`, status: vehicle.status.replace("_", " "), eta: `${Math.floor(vehicle.etaMinutes / 60)}h ${vehicle.etaMinutes % 60}m`, risk: vehicle.risk })),
    incidents: incidents.slice(0, 10).map(incident => ({ id: incident.id, type: incident.type, location: `${incident.latitude}, ${incident.longitude}`, severity: incident.severity, age: formatAge(incident.occurredAt), status: formatStatus(incident.status) })),
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
      const [incidents, vehicles, shipments] = await Promise.all([listIncidents(100), listVehicles(100), listShipments(100)]);
      if (ctx.user.role === "admin" || ctx.user.operationalRole === "admin" || ctx.user.operationalRole === "logistics_manager") return { databaseAvailable: Boolean(await getDb()), incidents, vehicles, shipments };
      if (ctx.user.operationalRole === "truck_driver") return { databaseAvailable: Boolean(await getDb()), incidents: incidents.filter(incident => ["HIGH", "CRITICAL"].includes(incident.severity)), vehicles: vehicles.filter(vehicle => vehicle.id === "TRK-104"), shipments: shipments.filter(shipment => shipment.id === "SHP-001") };
      if (ctx.user.operationalRole === "emergency_team") return { databaseAvailable: Boolean(await getDb()), incidents: incidents.filter(incident => incident.status === "VERIFIED" && incident.severity === "CRITICAL"), vehicles: vehicles.filter(vehicle => ["HIGH", "CRITICAL"].includes(vehicle.risk)), shipments: shipments.filter(shipment => shipment.priority === "CRITICAL") };
      return { databaseAvailable: Boolean(await getDb()), incidents: incidents.filter(incident => incident.reporterId === ctx.user.id || ["HIGH", "CRITICAL"].includes(incident.severity)), vehicles: [], shipments: [] };
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
      const predictions = await getWeatherAwareRiskPredictions();
      await persistRiskWeatherSnapshots(predictions);
      const recommendation = ctx.user.operationalRole === "truck_driver" ? optimizeRoute("GUWAHATI", "IMPHAL", predictions) : optimizeRoute(origin, destination, predictions);
      return { dataLabel: "SIMULATED / PROTOTYPE DATA", weatherDataLabel: recommendation.weatherSource, recommendation };
    }),
    overrideSafety: governmentAdminProcedure.input(z.object({ routeId: z.string().min(1).max(80), status: z.enum(["SAFE", "CAUTION", "REJECTED"]), reason: z.string().min(3).max(500), timestamp: z.coerce.date() })).mutation(async ({ ctx, input }) => {
      await appendAuditEvent({ actorId: ctx.user.id, action: "safety.override", entityType: "route", entityId: input.routeId, details: JSON.stringify({ status: input.status, reason: input.reason, timestamp: input.timestamp.toISOString(), userId: ctx.user.id, role: ctx.user.operationalRole }) });
      return { routeId: input.routeId, status: input.status, reason: input.reason, timestamp: input.timestamp, userId: ctx.user.id, role: ctx.user.operationalRole } as const;
    }),
    createIncident: operationalProcedure(["field_officer", "truck_driver", "emergency_team"]).input(incidentInput).mutation(async ({ ctx, input }) => createIncident({ id: input.id, type: input.type, severity: normalizeSeverity(input.severity), status: "UNVERIFIED", description: input.description, latitude: input.latitude.toFixed(6), longitude: input.longitude.toFixed(6), reporterId: ctx.user.id, reporterRole: ctx.user.operationalRole, photoUrl: input.photoUrl, isDemo: false, roadAccessibility: input.roadAccessibility, occurredAt: input.occurredAt }, ctx.user.id)),
    reviewIncident: operationalProcedure(["admin"]).input(z.object({ id: z.string().min(1), status: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED"]) })).mutation(async ({ ctx, input }) => updateIncidentStatus(input.id, input.status, ctx.user.id)),
    audit: operationalProcedure(["admin", "logistics_manager"]).input(z.object({ limit: z.number().int().min(1).max(100).default(50) })).query(({ input }) => listAuditEvents(input.limit)),
    recordAudit: operationalProcedure(["admin", "logistics_manager"]).input(z.object({ action: z.string().min(2), entityType: z.string().min(2), entityId: z.string().optional(), details: z.string().optional() })).mutation(async ({ ctx, input }) => appendAuditEvent({ ...input, actorId: ctx.user.id })),
  }),
});

export type AppRouter = typeof appRouter;
