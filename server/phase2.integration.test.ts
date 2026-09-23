import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { optimizeRoute, buildRoadGraphWithIncidents } from "./routeEngine";
import { validateRouteSafety } from "./safetyEngine";
import { predictRisk } from "./riskEngine";
import { getIncidentById, listAuditEvents, listIncidents, listShipments, listVehicles, seedDemoData, updateIncidentStatus } from "./db";

function mockCtx(role: "user" | "admin", operationalRole: "admin" | "field_officer" | "truck_driver" | "logistics_manager" | "emergency_team", id = 101): TrpcContext {
  return {
    user: {
      id,
      openId: `user-${operationalRole}-${id}`,
      email: `${operationalRole}@nerlogiai.in`,
      name: `Test ${operationalRole}`,
      loginMethod: "demo",
      role,
      operationalRole,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } satisfies TrpcContext;
}

describe("Phase 2 — End-to-End Integration Workflows", () => {
  beforeEach(async () => {
    await seedDemoData();
  });
  it("Workflow 1: Field Report → Road Blockage → Verification → Corridor Accessibility", async () => {
    const fieldCaller = appRouter.createCaller(mockCtx("user", "field_officer", 201));
    const adminCaller = appRouter.createCaller(mockCtx("admin", "admin", 1));

    // 1. Field Officer creates an incident with GPS coordinates, severity, road accessibility
    const created = await fieldCaller.demo.createIncident({
      type: "Road Blockage",
      severity: "CRITICAL",
      description: "Massive mudslide blocking both lanes on NH-2 Kohima approach",
      latitude: 25.6747,
      longitude: 94.1086,
      roadAccessibility: "blocked",
      occurredAt: new Date(),
    });

    expect(created.id).toBeDefined();
    expect(created.status).toBe("UNVERIFIED");
    expect(created.roadAccessibility).toBe("blocked");

    // 2. Verification lifecycle: UNVERIFIED -> UNDER_REVIEW -> VERIFIED
    const underReview = await adminCaller.operations.reviewIncident({
      id: created.id,
      status: "UNDER_REVIEW",
    });
    expect(underReview?.status).toBe("UNDER_REVIEW");

    const verified = await adminCaller.operations.reviewIncident({
      id: created.id,
      status: "VERIFIED",
    });
    expect(verified?.status).toBe("VERIFIED");
    expect(verified?.roadAccessibility).toBe("blocked");

    // 3. Corridor accessibility is updated in operations.corridors
    const corridors = await fieldCaller.operations.corridors();
    const kohimaCorridor = corridors.find((c) => c.id === "NH-2-KOHIMA");
    expect(kohimaCorridor).toBeDefined();
    expect(kohimaCorridor?.accessibility).toBe("blocked");
    expect(kohimaCorridor?.safetyStatus).toBe("REJECTED");
    expect(kohimaCorridor?.criticalLoadTransitAllowed).toBe(false);
  });

  it("Workflow 2: Incident → Weather → Risk Evaluation", async () => {
    // Evaluate risk engine with weather snapshot
    const riskResult = predictRisk({
      rainfallIntensity: 85,
      slope: 35,
      elevation: 1400,
      roadCondition: 25,
      bridgeCondition: 30,
      recentVerifiedIncidents: 2,
      historicalFloodCount: 4,
      historicalLandslideCount: 6,
      trafficLevel: 45,
      roadAccessibility: 10,
      incidentSeverity: 90,
      dataAgeMinutes: 10,
      weather: {
        rainfallIntensity: 95,
        temperatureC: 18,
        floodWarning: true,
        landslideWarning: true,
        observedAt: new Date().toISOString(),
      },
    });

    expect(["HIGH", "CRITICAL"]).toContain(riskResult.riskLevel);
    expect(riskResult.probability).toBeGreaterThanOrEqual(70);
    expect(riskResult.confidence).toBeGreaterThan(0);
    expect(riskResult.weatherFreshness).toBe("FRESH");
    expect(riskResult.dataLabel).toBe("SIMULATED / PROTOTYPE DATA");
  });

  it("Workflow 3: Risk → Safety Validator → A* Routing Chain", async () => {
    // With NH-37 Jorhat blocked (critical bridge damage) and NH-2 Kohima blocked (verified blockage),
    // A* should automatically evaluate and recommend Route C: Guwahati -> Shillong -> Imphal (NH-6 / NH-44)!
    const activeIncidents = [
      {
        id: "INC-2408",
        type: "Bridge Damage",
        severity: "CRITICAL",
        status: "VERIFIED",
        description: "Bridge deck damaged on NH-37 Jorhat",
        roadAccessibility: "blocked",
      },
      {
        id: "INC-9999",
        type: "Road Blockage",
        severity: "CRITICAL",
        status: "VERIFIED",
        description: "NH-2 Kohima mountain pass totally blocked",
        roadAccessibility: "blocked",
      },
    ];

    const dynamicGraph = buildRoadGraphWithIncidents(activeIncidents);
    const rec = optimizeRoute("GUWAHATI", "IMPHAL", undefined, dynamicGraph);

    expect(rec.status).toBe("RECOMMENDED");
    expect(rec.shortestRouteRejected).toBe(true);
    // Shortest route (Guwahati -> Jorhat -> Imphal) was rejected
    expect(rec.rejectedAlternatives.length).toBeGreaterThanOrEqual(1);
    // Safe alternate route found: Guwahati -> Shillong -> Imphal
    expect(rec.route).toEqual(["GUWAHATI", "SHILLONG", "IMPHAL"]);
    expect(rec.distanceKm).toBe(440);
    expect(["SAFE", "CAUTION"]).toContain(rec.safetyStatus);
  });

  it("Workflow 4 & 5: Route → Driver Human Acceptance → Shipment Monitoring", async () => {
    const driverCaller = appRouter.createCaller(mockCtx("user", "truck_driver", 301));
    const managerCaller = appRouter.createCaller(mockCtx("user", "logistics_manager", 401));

    // 1. Driver accepts alternate route
    const acceptRes = await driverCaller.operations.acceptRoute({
      vehicleId: "TRK-104",
      routeLabel: "Route C (NH-6 Shillong / NH-44 Southern Expressway)",
      alternateRoute: "Guwahati-Shillong-Imphal",
      distanceKm: 440,
      etaMinutes: 520,
      driverNotes: "Proceeding via Shillong bypass with convoy clearance.",
    });

    expect(acceptRes.success).toBe(true);
    expect(acceptRes.vehicleId).toBe("TRK-104");

    // 2. Verify audit event was logged with Human-in-the-Loop disclosures
    const audits = await listAuditEvents(20);
    const acceptAudit = audits.find((a) => a.action === "route.accepted_by_driver" && a.entityId === "TRK-104");
    expect(acceptAudit).toBeDefined();
    const details = JSON.parse(acceptAudit?.details ?? "{}");
    expect(details.humanInTheLoopConfirmed).toBe(true);
    expect(details.automaticVehicleRedirect).toBe(false);

    // 3. Verify vehicle and shipment telemetry were updated for Logistics Manager
    const vehicles = await listVehicles();
    const trk104 = vehicles.find((v) => v.id === "TRK-104");
    expect(trk104?.status).toBe("on_route");
    expect(trk104?.etaMinutes).toBe(520);

    const shipments = await listShipments();
    const medShipment = shipments.find((s) => s.id === "SHP-001");
    expect(medShipment?.status).toBe("in_transit");
    expect(medShipment?.etaMinutes).toBe(520);
  });

  it("Workflow 6: Emergency Response → Alert Broadcast & RBAC Enforcement", async () => {
    const emergencyCaller = appRouter.createCaller(mockCtx("user", "emergency_team", 501));
    const driverCaller = appRouter.createCaller(mockCtx("user", "truck_driver", 301));

    // 1. Emergency Response broadcasts an alert
    const alert = await emergencyCaller.operations.broadcastAlert({
      title: "FLASH FLOOD EVACUATION CORRIDOR RESTRICTION",
      message: "NH-2 Kohima pass is impassable. Divert all priority shipments via Shillong NH-6.",
      severity: "CRITICAL",
      corridor: "NH-2 Kohima / Imphal Highway",
    });

    expect(alert.id).toBeDefined();
    expect(alert.severity).toBe("CRITICAL");

    // 2. Alert is visible to all roles
    const alerts = await driverCaller.operations.alerts();
    expect(alerts.some((a) => a.title === "FLASH FLOOD EVACUATION CORRIDOR RESTRICTION")).toBe(true);

    // 3. RBAC Enforcement: Truck Driver cannot broadcast alerts
    await expect(
      driverCaller.operations.broadcastAlert({
        title: "Unauthorized Alert",
        message: "Driver attempting broadcast",
        severity: "HIGH",
        corridor: "NH-37",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // 4. RBAC Enforcement: Truck Driver cannot review incidents
    await expect(
      driverCaller.operations.reviewIncident({
        id: "INC-2408",
        status: "VERIFIED",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("SIH Demonstration Scenario: Complete Guwahati to Imphal Lifecycle", async () => {
    // 1. Guwahati to Imphal corridor has 3 physical options:
    // Option 1: Direct via NH-37 Jorhat (140 + 120 = 260 km) - BLOCKED by verified bridge damage.
    // Option 2: Via NH-2 Kohima (220 + 160 = 380 km) - under review/caution in baseline.
    // Option 3: Via NH-6 Shillong (190 + 250 = 440 km) - fully safe expressway alternate.

    const driverCaller = appRouter.createCaller(mockCtx("user", "truck_driver", 301));
    const baselineRoute = await driverCaller.operations.route({ origin: "GUWAHATI", destination: "IMPHAL" });

    expect(baselineRoute.recommendation.shortestRouteRejected).toBe(true);
    expect(baselineRoute.recommendation.routeLabel).toBe("Guwahati → Kohima → Imphal");
    expect(["SAFE", "CAUTION"]).toContain(baselineRoute.recommendation.safetyStatus);
    expect(baselineRoute.recommendation.distanceKm).toBe(380);

    // Now a verified critical disruption hits NH-2 Kohima as well
    const adminCaller = appRouter.createCaller(mockCtx("admin", "admin", 1));
    const incident = await adminCaller.demo.createIncident({
      type: "Landslide",
      severity: "CRITICAL",
      description: "Rockfall completely blocking NH-2 Kohima approach corridor",
      latitude: 25.6747,
      longitude: 94.1086,
      roadAccessibility: "blocked",
      occurredAt: new Date(),
    });
    await adminCaller.operations.reviewIncident({ id: incident.id, status: "VERIFIED" });

    // Query route again
    const rerouted = await driverCaller.operations.route({ origin: "GUWAHATI", destination: "IMPHAL" });
    expect(rerouted.recommendation.route).toEqual(["GUWAHATI", "SHILLONG", "IMPHAL"]);
    expect(rerouted.recommendation.distanceKm).toBe(440);
    expect(["SAFE", "CAUTION"]).toContain(rerouted.recommendation.safetyStatus);

    // Driver explicitly accepts the route
    const accept = await driverCaller.operations.acceptRoute({
      vehicleId: "TRK-104",
      routeLabel: rerouted.recommendation.routeLabel,
      alternateRoute: rerouted.recommendation.route.join("-"),
      distanceKm: rerouted.recommendation.distanceKm!,
      etaMinutes: rerouted.recommendation.etaMinutes!,
      driverNotes: "Acknowledged rockfall. Rerouting via Shillong.",
    });
    expect(accept.success).toBe(true);

    // When all corridors are blocked, returns NO SAFE ROUTE AVAILABLE
    const fullyBlockedGraph = buildRoadGraphWithIncidents([
      { type: "Bridge Damage", severity: "CRITICAL", status: "VERIFIED", description: "NH-37 JORHAT", roadAccessibility: "blocked" },
      { type: "Landslide", severity: "CRITICAL", status: "VERIFIED", description: "NH-2 KOHIMA", roadAccessibility: "blocked" },
      { type: "Flood", severity: "CRITICAL", status: "VERIFIED", description: "NH-6 SHILLONG", roadAccessibility: "blocked" },
    ]);
    const noSafeRoute = optimizeRoute("GUWAHATI", "IMPHAL", undefined, fullyBlockedGraph);
    expect(noSafeRoute.status).toBe("NO SAFE ROUTE AVAILABLE");
    expect(noSafeRoute.routeLabel).toBe("NO SAFE ROUTE AVAILABLE");
    expect(noSafeRoute.reason).toContain("rejected by the safety validator");
  });
});
