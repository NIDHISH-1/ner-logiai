import { describe, expect, it } from "vitest";
import {
  evaluateEmergencyImpact,
  buildAlertDraftsFromImpact,
  buildNoSafeRouteAlert,
  type IncidentInput,
  type VehicleRef,
  type ShipmentRef,
} from "./emergencyImpactEngine";
import {
  createAlert,
  getAlert,
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
  resolveAlertsForIncident,
} from "./db";
import {
  optimizeRoute,
  buildRoadGraphWithIncidents,
  simulatedRoadGraph,
} from "./routeEngine";

describe("Phase 4: Emergency Impact & Alert Propagation Engine", () => {
  const sampleVehicles: VehicleRef[] = [
    {
      id: "TRK-104",
      currentCorridor: "NH-37",
      latitude: 26.75,
      longitude: 94.2,
      status: "on_route",
      shipmentId: "SHP-001",
      activeRoute: "Guwahati → Jorhat → Kohima → Imphal",
    },
    {
      id: "TRK-202",
      currentCorridor: "NH-2",
      latitude: 25.67,
      longitude: 94.1,
      status: "on_route",
      shipmentId: "SHP-002",
      activeRoute: "Dimapur → Kohima",
    },
    {
      id: "TRK-303",
      currentCorridor: "NH-6",
      latitude: 25.57,
      longitude: 91.89,
      status: "on_route",
      shipmentId: "SHP-003",
      activeRoute: "Guwahati → Shillong",
    },
  ];

  const sampleShipments: ShipmentRef[] = [
    {
      id: "SHP-001",
      name: "Emergency ICU Medicines & Blood Bags",
      priority: "CRITICAL",
      origin: "Guwahati",
      destination: "Imphal",
      assignedVehicleId: "TRK-104",
      status: "in_transit",
      activeRoute: "Guwahati → Jorhat → Kohima → Imphal",
      currentEtaMinutes: 222,
      plannedEtaMinutes: 222,
    },
    {
      id: "SHP-002",
      name: "Flood Relief Survival Kits",
      priority: "HIGH",
      origin: "Dimapur",
      destination: "Kohima",
      assignedVehicleId: "TRK-202",
      status: "in_transit",
      activeRoute: "Dimapur → Kohima",
      currentEtaMinutes: 78,
      plannedEtaMinutes: 78,
    },
    {
      id: "SHP-003",
      name: "Standard Commercial Cargo",
      priority: "NORMAL",
      origin: "Guwahati",
      destination: "Shillong",
      assignedVehicleId: "TRK-303",
      status: "in_transit",
      activeRoute: "Guwahati → Shillong",
      currentEtaMinutes: 90,
      plannedEtaMinutes: 90,
    },
  ];

  it("1. Incident -> Emergency Impact: Evaluates verified critical blockage correctly", () => {
    const incident: IncidentInput = {
      id: "INC-TEST-LANDSLIDE",
      type: "Landslide",
      severity: "CRITICAL",
      status: "VERIFIED",
      roadAccessibility: "blocked",
      description: "Severe mountain landslide on NH-37 Jorhat. Road physically impassable.",
      corridor: "NH-37 Jorhat",
      latitude: 26.75,
      longitude: 94.2,
    };

    const impact = evaluateEmergencyImpact(incident, sampleVehicles, sampleShipments);

    expect(impact.incidentId).toBe("INC-TEST-LANDSLIDE");
    expect(impact.emergencyPriority).toBe("CRITICAL");
    expect(impact.roadAccessibility).toBe("blocked");
    expect(impact.affectedVehicles.map((v) => v.id)).toContain("TRK-104");
    expect(impact.affectedShipments.map((s) => s.id)).toContain("SHP-001");
    expect(impact.affectedCriticalShipments.map((s) => s.id)).toContain("SHP-001");
    expect(impact.shipmentImpactMap["SHP-001"]).toBe("CRITICALLY AFFECTED");
    expect(impact.shipmentImpactMap["SHP-003"]).toBe("NOT AFFECTED");
    expect(impact.requiresDriverConfirmation).toBe(true);
    expect(impact.recommendedAction).toContain("bypassing blocked corridor");
  });

  it("2. Alert Draft Generation: Produces deterministic role-targeted alert drafts", () => {
    const incident: IncidentInput = {
      id: "INC-TEST-LANDSLIDE",
      type: "Landslide",
      severity: "CRITICAL",
      status: "VERIFIED",
      roadAccessibility: "blocked",
      description: "Severe mountain landslide on NH-37 Jorhat.",
      corridor: "NH-37 Jorhat",
      latitude: 26.75,
      longitude: 94.2,
    };

    const impact = evaluateEmergencyImpact(incident, sampleVehicles, sampleShipments);
    const drafts = buildAlertDraftsFromImpact(impact, incident);

    expect(drafts.length).toBeGreaterThanOrEqual(3);

    // 1. Blocked road operational alert
    const blockageAlert = drafts.find((d) => d.alertType === "ROAD_BLOCKAGE");
    expect(blockageAlert).toBeDefined();
    expect(blockageAlert?.severity).toBe("CRITICAL");
    expect(blockageAlert?.targetRoles).toContain("emergency_team");

    // 2. Critical incident emergency alert
    const critAlert = drafts.find((d) => d.alertType === "CRITICAL_INCIDENT");
    expect(critAlert).toBeDefined();
    expect(critAlert?.severity).toBe("CRITICAL");

    // 3. Logistics delay alert for critical shipment
    const logAlert = drafts.find((d) => d.alertType === "LOGISTICS_DELAY");
    expect(logAlert).toBeDefined();
    expect(logAlert?.affectedShipmentIds).toContain("SHP-001");
    expect(logAlert?.targetRoles).toContain("logistics_manager");

    // 4. Driver route warning targeted at TRK-104
    const driverAlert = drafts.find((d) => d.alertType === "EMERGENCY_ROUTING");
    expect(driverAlert).toBeDefined();
    expect(driverAlert?.affectedVehicleIds).toContain("TRK-104");
    expect(driverAlert?.targetRoles).toContain("truck_driver");
  });

  it("3. Alert Persistence & Retrieval: Saves and loads operational alert records", async () => {
    const alert = await createAlert({
      incidentId: "INC-TEST-PERSIST",
      alertType: "ROAD_BLOCKAGE",
      title: "Test NH-37 Bridge Closure",
      message: "Bridge closed due to structural inspection.",
      severity: "HIGH",
      corridor: "NH-37 Jorhat",
      roadSegment: "NH-37-JORHAT",
      affectedVehicleIds: ["TRK-104"],
      affectedShipmentIds: ["SHP-001"],
      targetRoles: ["admin", "emergency_team", "truck_driver"],
    });

    expect(alert.id).toBeDefined();
    expect(alert.status).toBe("ACTIVE");

    const retrieved = await getAlert(alert.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(alert.id);
    expect(retrieved?.corridor).toBe("NH-37 Jorhat");
    expect(retrieved?.affectedVehicleIds).toContain("TRK-104");
  });

  it("4. Alert Deduplication: Re-evaluating same incident and type does not produce duplicate alerts", async () => {
    const alert1 = await createAlert({
      incidentId: "INC-TEST-DEDUP",
      alertType: "ROAD_BLOCKAGE",
      title: "NH-2 Landslide Warning",
      message: "Landslide blocking single lane.",
      severity: "HIGH",
      corridor: "NH-2 Kohima",
    });

    const alert2 = await createAlert({
      incidentId: "INC-TEST-DEDUP",
      alertType: "ROAD_BLOCKAGE",
      title: "NH-2 Landslide Warning",
      message: "Landslide blocking single lane.",
      severity: "HIGH",
      corridor: "NH-2 Kohima",
    });

    expect(alert2.id).toBe(alert1.id);
  });

  it("5. Role Targeting: Filters alert list based on role-specific views", async () => {
    await createAlert({
      incidentId: "INC-ROLE-DRIVER",
      alertType: "EMERGENCY_ROUTING",
      title: "Driver Advisory TRK-104",
      message: "Detour ahead for TRK-104.",
      severity: "HIGH",
      corridor: "NH-37 Jorhat",
      affectedVehicleIds: ["TRK-104"],
      targetRoles: ["truck_driver"],
    });

    await createAlert({
      incidentId: "INC-ROLE-LOGISTICS",
      alertType: "LOGISTICS_DELAY",
      title: "Logistics Fleet Delay",
      message: "Delivery schedule updated.",
      severity: "ADVISORY",
      corridor: "NH-2 Dimapur",
      affectedShipmentIds: ["SHP-006"],
      targetRoles: ["logistics_manager"],
    });

    const driverAlerts = await listAlerts(50, "truck_driver");
    const managerAlerts = await listAlerts(50, "logistics_manager");
    const adminAlerts = await listAlerts(50, "admin");

    expect(driverAlerts.some((a) => a.affectedVehicleIds?.includes("TRK-104"))).toBe(true);
    expect(managerAlerts.some((a) => a.targetRoles?.includes("logistics_manager"))).toBe(true);
    expect(adminAlerts.length).toBeGreaterThanOrEqual(driverAlerts.length);
  });

  it("6. Alert Lifecycle: Transition from ACTIVE -> ACKNOWLEDGED -> RESOLVED", async () => {
    const alert = await createAlert({
      incidentId: "INC-LIFECYCLE",
      alertType: "ROAD_BLOCKAGE",
      title: "Active Flash Flood",
      message: "Water logging on NH-6.",
      severity: "HIGH",
      corridor: "NH-6 Shillong",
    });

    expect(alert.status).toBe("ACTIVE");

    // Acknowledge alert
    const acked = await acknowledgeAlert(alert.id, 10, "Emergency Commander Rao");
    expect(acked?.status).toBe("ACKNOWLEDGED");
    expect(acked?.acknowledgedBy).toBe(10);
    expect(acked?.acknowledgedByName).toBe("Emergency Commander Rao");
    expect(acked?.acknowledgedAt).toBeDefined();

    // Resolve alert
    const resolved = await resolveAlert(alert.id, 10, "Water subsided, lane reopened.");
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.resolvedBy).toBe(10);
    expect(resolved?.resolvedAt).toBeDefined();
  });

  it("7. Incident Resolution Cascades: Resolving an incident resolves associated alerts", async () => {
    const alert = await createAlert({
      incidentId: "INC-CASCADE-TEST",
      alertType: "CRITICAL_INCIDENT",
      title: "Tree blocking roadway",
      message: "Fallen tree across NH-37.",
      severity: "HIGH",
      corridor: "NH-37 Jorhat",
    });

    expect(alert.status).toBe("ACTIVE");

    await resolveAlertsForIncident("INC-CASCADE-TEST", 1);

    const checked = await getAlert(alert.id);
    expect(checked?.status).toBe("RESOLVED");
  });

  it("8. Emergency Routing Integration: Avoids verified blocked road segments", () => {
    const activeIncidents = [
      {
        id: "INC-BLOCK-JORHAT",
        type: "Landslide",
        severity: "CRITICAL" as const,
        status: "VERIFIED" as const,
        roadAccessibility: "blocked" as const,
        description: "NH-37 Jorhat completely blocked",
      },
    ];

    const roadGraphWithIncidents = buildRoadGraphWithIncidents(activeIncidents);
    const jorhatEdge = roadGraphWithIncidents.find((e) => e.riskId === "NH-37-JORHAT");
    expect(jorhatEdge?.roadAccessibility).toBe("blocked");

    // Route from GUWAHATI to IMPHAL
    const recommendation = optimizeRoute("GUWAHATI", "IMPHAL", undefined, roadGraphWithIncidents);

    expect(recommendation.status).toBe("RECOMMENDED");
    // Should NOT route through JORHAT when NH-37 is blocked
    expect(recommendation.route).not.toContain("JORHAT");
    expect(recommendation.shortestRouteRejected).toBe(true);
    expect(recommendation.routeLabel).toContain("Kohima");
  });

  it("9. No Safe Route Condition: When all corridors are blocked, returns NO SAFE ROUTE AVAILABLE without unsafe fallback", () => {
    // Block the remote spur
    const recommendation = optimizeRoute("GUWAHATI", "REMOTE_BLOCKED");

    expect(recommendation.status).toBe("NO SAFE ROUTE AVAILABLE");
    expect(recommendation.route.length).toBe(0);
    expect(recommendation.safetyStatus).toBe("UNAVAILABLE");
    expect(recommendation.reason).toContain("Every known route is rejected");

    const noSafeDraft = buildNoSafeRouteAlert("GUWAHATI → REMOTE_BLOCKED", recommendation.reason);
    expect(noSafeDraft.alertType).toBe("NO_SAFE_ROUTE");
    expect(noSafeDraft.severity).toBe("CRITICAL");
    expect(noSafeDraft.targetRoles).toContain("emergency_team");
  });
});
