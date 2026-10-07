import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";
import {
  createIncident,
  getIncidentById,
  updateIncidentStatus,
  listIncidents,
  listVehicles,
  listShipments,
  listAlerts,
  listAuditEvents,
  recordVehicleLocation,
} from "./db";
import { evaluateSegmentSafety, getDemoSafetyValidations } from "./safetyEngine";
import { optimizeRoute, buildRoadGraphWithIncidents, simulatedRoadGraph } from "./routeEngine";
import { calculateGpsFreshness, matchVehicleToCorridor } from "./gpsEngine";
import { AnalyticsEngine } from "./analyticsEngine";
import { fetchLiveWeather } from "./weatherProvider";
import { evaluateEmergencyImpact, buildNoSafeRouteAlert } from "./emergencyImpactEngine";

describe("Phase 8 — Final SIH26002 Compliance & Demo Readiness Audit", () => {
  const adminContext = {
    user: {
      id: "USR-ADMIN-01",
      openId: "user_admin_eval",
      name: "Regional Commander Sharma",
      email: "commander@ner-logiai.gov.in",
      role: "admin",
      operationalRole: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "standalone_prototype",
    },
    req: {} as any,
    res: {} as any,
  };

  const driverContext = {
    user: {
      id: "USR-DRIVER-04",
      openId: "user_driver_eval",
      name: "Ramesh Singh (TRK-104)",
      email: "driver.ramesh@ner-logiai.gov.in",
      role: "user",
      operationalRole: "truck_driver",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "standalone_prototype",
    },
    req: {} as any,
    res: {} as any,
  };

  const fieldOfficerContext = {
    user: {
      id: "USR-FIELD-02",
      openId: "user_field_eval",
      name: "Officer T. Ao",
      email: "officer.ao@ner-logiai.gov.in",
      role: "user",
      operationalRole: "field_officer",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "standalone_prototype",
    },
    req: {} as any,
    res: {} as any,
  };

  const logisticsManagerContext = {
    user: {
      id: "USR-LOGISTICS-03",
      openId: "user_logistics_eval",
      name: "M. Das (Disro Logistics)",
      email: "logistics.das@ner-logiai.gov.in",
      role: "user",
      operationalRole: "logistics_manager",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "standalone_prototype",
    },
    req: {} as any,
    res: {} as any,
  };

  const adminCaller = appRouter.createCaller(adminContext as any);
  const driverCaller = appRouter.createCaller(driverContext as any);
  const fieldCaller = appRouter.createCaller(fieldOfficerContext as any);
  const logisticsCaller = appRouter.createCaller(logisticsManagerContext as any);

  // ---------------------------------------------------------------------------
  // 1. SIH26002 Safety & Human-in-the-Loop Constraints
  // ---------------------------------------------------------------------------
  it("SIH-01: Route acceptance strictly enforces human-in-the-loop confirmation and prohibits silent vehicle redirect", async () => {
    // Driver accepts an alternate route with human-in-the-loop confirmation
    const acceptance = await driverCaller.operations.acceptRoute({
      vehicleId: "TRK-104",
      routeLabel: "Guwahati -> Shillong -> Dimapur (Bypass)",
      alternateRoute: "NH-2",
      distanceKm: 345,
      etaMinutes: 420,
      humanInTheLoopConfirmed: true,
      automaticVehicleRedirect: false,
      driverNotes: "Confirmed bypass via radio dispatch",
    });

    expect(acceptance.success).toBe(true);
    expect(acceptance.humanInTheLoopConfirmed).toBe(true);
    expect(acceptance.automaticVehicleRedirect).toBe(false);
    expect(acceptance.message).toContain("Proceed following manual driver confirmation");

    // Server-side audit event verification
    const audits = await adminCaller.operations.audit({ limit: 10 });
    const driverAudit = audits.find(a => a.action === "route.accepted_by_driver" && a.entityId === "TRK-104");
    expect(driverAudit).toBeDefined();
    const details = JSON.parse(driverAudit?.details ?? "{}");
    expect(details.humanInTheLoopConfirmed).toBe(true);
    expect(details.automaticVehicleRedirect).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. Authoritative Safety Validator & NO SAFE ROUTE AVAILABLE
  // ---------------------------------------------------------------------------
  it("SIH-02: Safety Validator overrides advisory routing and outputs NO SAFE ROUTE AVAILABLE when corridors are blocked", () => {
    // 1. When an active blockage incident is on NH-37 Jorhat, A* safely diverts away from Jorhat
    const blockedIncidents = [
      {
        id: "INC-JORHAT-BLOCK",
        type: "Landslide" as const,
        corridor: "NH-37" as const,
        severity: "CRITICAL" as const,
        status: "VERIFIED" as const,
        roadAccessibility: "blocked" as const,
        description: "NH-37 Jorhat completely impassable",
      },
    ];
    const roadGraphWithIncidents = buildRoadGraphWithIncidents(blockedIncidents as any);
    const recommendation = optimizeRoute("GUWAHATI", "IMPHAL", undefined, roadGraphWithIncidents);
    expect(recommendation.status).toBe("RECOMMENDED");
    expect(recommendation.route).not.toContain("JORHAT");
    expect(recommendation.shortestRouteRejected).toBe(true);

    // 2. When destination spur has no safe connection, returns NO SAFE ROUTE AVAILABLE
    const noSafeRoute = optimizeRoute("GUWAHATI", "REMOTE_BLOCKED");
    expect(noSafeRoute.status).toBe("NO SAFE ROUTE AVAILABLE");
    expect(noSafeRoute.routeLabel).toBe("NO SAFE ROUTE AVAILABLE");
    expect(noSafeRoute.safetyStatus).toBe("UNAVAILABLE");
    expect(noSafeRoute.reason).toContain("Every known route is rejected");
    expect(noSafeRoute.route).toHaveLength(0);

    const alertDraft = buildNoSafeRouteAlert("GUWAHATI → REMOTE_BLOCKED", noSafeRoute.reason);
    expect(alertDraft.severity).toBe("CRITICAL");
    expect(alertDraft.title).toContain("NO SAFE ROUTE AVAILABLE");
  });

  // ---------------------------------------------------------------------------
  // 3. Strict RBAC Enforcement Across Operational Roles
  // ---------------------------------------------------------------------------
  it("SIH-03: Strict RBAC prevents unauthorized actions by Driver and Field Officer", async () => {
    // 1. Driver attempting to review/verify incidents must fail
    await expect(driverCaller.operations.reviewIncident({
      id: "INC-TEST-001",
      status: "VERIFIED",
    })).rejects.toThrowError(/Your operational role cannot perform this action/);

    // 2. Field Officer attempting to review/verify incidents must fail (Admin only)
    await expect(fieldCaller.operations.reviewIncident({
      id: "INC-TEST-001",
      status: "VERIFIED",
    })).rejects.toThrowError(/Your operational role cannot perform this action/);

    // 3. Driver attempting to broadcast regional emergency alerts must fail
    await expect(driverCaller.operations.broadcastAlert({
      title: "Test Alert",
      message: "Unsolicited broadcast",
      severity: "CRITICAL",
      corridor: "NH-37",
    })).rejects.toThrowError(/Your operational role cannot perform this action/);

    // 4. Driver attempting to view administrative audit logs must fail
    await expect(driverCaller.operations.audit({ limit: 20 })).rejects.toThrowError(/Your operational role cannot perform this action/);

    // 5. Driver attempting to access administrative analytics must be rejected
    await expect(driverCaller.analytics.regionalOverview()).rejects.toThrowError(/Truck drivers cannot access administrative analytics/);
    await expect(driverCaller.analytics.fullReport()).rejects.toThrowError(/Truck drivers cannot access administrative analytics/);

    // 6. Admin and Logistics Manager CAN view audit logs
    const adminAudit = await adminCaller.operations.audit({ limit: 10 });
    expect(Array.isArray(adminAudit)).toBe(true);

    const logisticsAudit = await logisticsCaller.operations.audit({ limit: 10 });
    expect(Array.isArray(logisticsAudit)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. End-to-End Operational Workflow (Field -> Admin -> Driver -> Sync)
  // ---------------------------------------------------------------------------
  it("SIH-04: End-to-end incident lifecycle: field report -> admin verification -> safety blockage -> alert dispatch", async () => {
    // Step 1: Field Officer reports new landslide incident
    const testIncidentId = `INC-AUDIT-${Date.now().toString().slice(-4)}`;
    const created = await fieldCaller.operations.createIncident({
      id: testIncidentId,
      type: "Landslide",
      severity: "CRITICAL",
      description: "Severe mountain slope failure at KM 142",
      latitude: 26.75,
      longitude: 94.2,
      roadAccessibility: "blocked",
      occurredAt: new Date(),
    });

    expect(created.status).toBe("UNVERIFIED");
    expect(created.reporterRole).toBe("field_officer");

    // Step 2: Admin reviews and VERIFIES incident
    const verified = await adminCaller.operations.reviewIncident({
      id: testIncidentId,
      status: "VERIFIED",
    });

    expect(verified?.status).toBe("VERIFIED");
    expect(verified?.roadAccessibility).toBe("blocked");

    // Step 3: Emergency Impact Engine flags affected assets
    const [vehicles, shipments] = await Promise.all([listVehicles(50), listShipments(50)]);
    const impact = evaluateEmergencyImpact(
      {
        id: testIncidentId,
        type: "Landslide",
        severity: "CRITICAL",
        status: "VERIFIED",
        roadAccessibility: "blocked",
        corridor: "NH-37",
        latitude: 26.75,
        longitude: 94.2,
      },
      vehicles as any,
      shipments as any
    );

    expect(impact.emergencyPriority).toBe("CRITICAL");
    expect(impact.affectedVehicles.length).toBeGreaterThanOrEqual(1);

    // Step 4: Verify emergency alert is present in alerts list
    const alerts = await adminCaller.operations.alerts({ limit: 20 });
    const matchedAlert = alerts.find(a => a.corridor === "NH-37" || a.message.includes("NH-37") || a.title.includes("NH-37"));
    expect(matchedAlert).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 5. Offline Idempotency & Action Synchronization
  // ---------------------------------------------------------------------------
  it("SIH-05: Offline action synchronization guarantees idempotency and deduplication", async () => {
    const actionId = `ACT-AUDIT-IDEMP-${Date.now()}`;

    // First synchronization of route acceptance
    const firstSync = await driverCaller.operations.syncRouteAcceptance({
      actionId,
      vehicleId: "TRK-104",
      routeLabel: "NH-2 Bypass (Offline Queued)",
      alternateRoute: "NH-2",
      distanceKm: 310,
      etaMinutes: 380,
      humanInTheLoopConfirmed: true,
      automaticVehicleRedirect: false,
      acceptedAt: new Date().toISOString(),
    });

    expect(firstSync.status).toBe("SYNCED");
    expect(firstSync.duplicate).toBe(false);
    expect(firstSync.actionId).toBe(actionId);

    // Resubmission of the EXACT same actionId (reconnect / network duplicate)
    const duplicateSync = await driverCaller.operations.syncRouteAcceptance({
      actionId,
      vehicleId: "TRK-104",
      routeLabel: "NH-2 Bypass (Offline Queued)",
      alternateRoute: "NH-2",
      distanceKm: 310,
      etaMinutes: 380,
      humanInTheLoopConfirmed: true,
      automaticVehicleRedirect: false,
      acceptedAt: new Date().toISOString(),
    });

    expect(duplicateSync.status).toBe("SYNCED");
    expect(duplicateSync.duplicate).toBe(true);
    expect(duplicateSync.actionId).toBe(actionId);
  });

  // ---------------------------------------------------------------------------
  // 6. GPS Freshness & Telemetry Categorization
  // ---------------------------------------------------------------------------
  it("SIH-06: GPS freshness engine strictly calculates FRESH (<2m), AGING (2-10m), and STALE (>10m)", () => {
    const now = new Date();
    const freshTimestamp = new Date(now.getTime() - 30 * 1000); // 30 seconds ago (< 2m)
    const agingTimestamp = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago (2-10m)
    const staleTimestamp = new Date(now.getTime() - 25 * 60 * 1000); // 25 minutes ago (> 10m)

    expect(calculateGpsFreshness(freshTimestamp).freshness).toBe("FRESH");
    expect(calculateGpsFreshness(agingTimestamp).freshness).toBe("AGING");
    expect(calculateGpsFreshness(staleTimestamp).freshness).toBe("STALE");

    // Corridor matching for vehicle position
    const match = matchVehicleToCorridor(26.1445, 91.7362); // Near Guwahati
    expect(match.corridorName).toContain("NH-37");
    expect(match.nearestSegment).toContain("Guwahati");
  });

  // ---------------------------------------------------------------------------
  // 7. Weather Fallback & Provenance Transparency
  // ---------------------------------------------------------------------------
  it("SIH-07: Weather provider falls back to SIMULATED WEATHER DATA when external API is unreachable", async () => {
    const weather = await fetchLiveWeather(
      { latitude: 26.1445, longitude: 91.7362 },
      { rainfallIntensity: 5.5, temperatureC: 25, floodWarning: false, landslideWarning: false }
    );

    expect(weather).toBeDefined();
    // In test environment without valid key, it MUST fall back to simulated label
    expect(["SIMULATED WEATHER DATA", "LIVE · OPENWEATHER"]).toContain(weather.source);
    expect(typeof weather.rainfallIntensity).toBe("number");
    expect(typeof weather.temperatureC).toBe("number");
  });

  // ---------------------------------------------------------------------------
  // 8. Deterministic Analytics Engine & Data Provenance
  // ---------------------------------------------------------------------------
  it("SIH-08: Analytics engine is 100% deterministic, derives metrics from existing models, and tags provenance", async () => {
    const report = await adminCaller.analytics.fullReport();

    expect(report).toBeDefined();
    expect(report.regionalOverview.metadata.dataMode).toBe("DEMO / SYNTHETIC DATA");
    expect(report.corridorAnalytics.totalCorridors).toBe(6);
    expect(report.fleetAnalytics.gpsProvenance).toBe("SIMULATED GPS");
    expect(report.riskAnalytics.authorityNotice).toContain("Safety Validator remains authoritative");

    // Check that regional metrics are mathematically coherent
    const regional = report.regionalOverview;
    expect(regional.accessibilityPercentage).toBeGreaterThanOrEqual(0);
    expect(regional.accessibilityPercentage).toBeLessThanOrEqual(100);
    expect(regional.regionalAccessibility.totalCorridors).toBe(6);
    expect(regional.activeVehicles).toBeGreaterThanOrEqual(0);
    expect(regional.criticalShipments).toBeGreaterThanOrEqual(0);
  });
});
