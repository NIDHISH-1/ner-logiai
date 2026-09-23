import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/trpc";
import { listAuditEvents, listShipments, listIncidents } from "./db";

function createMockContext(role: "admin" | "user", operationalRole: "truck_driver" | "field_officer" | "logistics_manager" | "emergency_team" | "admin"): TrpcContext {
  return {
    user: {
      id: 101,
      openId: "test-user-openid",
      email: "test@logiai.gov.in",
      name: "Test Operator",
      loginMethod: "manus",
      role,
      operationalRole,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    },
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

describe("Phase 1 Operations Verification & RBAC Tests", () => {
  it("Truck Driver: Accept Alternate Route records audit log with Human-in-the-loop semantics", async () => {
    const driverCaller = appRouter.createCaller(createMockContext("user", "truck_driver"));

    const result = await driverCaller.operations.acceptRoute({
      vehicleId: "TRK-104",
      routeLabel: "Route B (NH-6 / NH-27 Corridor)",
      alternateRoute: "Guwahati-Shillong-Imphal",
      distanceKm: 485,
      etaMinutes: 442,
      driverNotes: "Proceeding via Shillong bypass as recommended by safety validator",
    });

    expect(result.success).toBe(true);
    expect(result.vehicleId).toBe("TRK-104");

    const audits = await listAuditEvents(10);
    const routeAudit = audits.find((a) => a.action === "route.accepted_by_driver");
    expect(routeAudit).toBeDefined();

    const details = JSON.parse(routeAudit!.details || "{}");
    expect(details.humanInTheLoopConfirmed).toBe(true);
    expect(details.automaticVehicleRedirect).toBe(false);
    expect(details.routeLabel).toBe("Route B (NH-6 / NH-27 Corridor)");
  });

  it("Field Officer: Update Road Status persists road accessibility and logs ground truth", async () => {
    const fieldCaller = appRouter.createCaller(createMockContext("user", "field_officer"));

    const result = await fieldCaller.operations.updateRoadStatus({
      corridor: "NH-37 · Jorhat Bypass Segment",
      roadAccessibility: "blocked",
      severity: "CRITICAL",
      description: "Severe bridge support erosion at km 284. Passage prohibited.",
      latitude: 26.75,
      longitude: 94.20,
    });

    expect(result.success).toBe(true);
    expect(result.incident).toBeDefined();
    expect(result.incident?.roadAccessibility).toBe("blocked");

    const incidents = await listIncidents(20);
    const found = incidents.find((inc) => inc.id === result.incident?.id);
    expect(found).toBeDefined();
    expect(found?.roadAccessibility).toBe("blocked");
  });

  it("Logistics Manager: Create Shipment creates a persistent shipment record and validates inputs", async () => {
    const managerCaller = appRouter.createCaller(createMockContext("user", "logistics_manager"));

    const shipment = await managerCaller.operations.createShipment({
      name: "Oxygen Concentrators Batch #12",
      priority: "CRITICAL",
      origin: "Guwahati Central Depot",
      destination: "Kohima District Hospital",
      etaMinutes: 240,
    });

    expect(shipment).toBeDefined();
    expect(shipment.id).toBeDefined();
    expect(shipment.priority).toBe("CRITICAL");

    const allShipments = await listShipments(20);
    const created = allShipments.find((s) => s.id === shipment.id);
    expect(created).toBeDefined();
    expect(created?.name).toBe("Oxygen Concentrators Batch #12");
  });

  it("Emergency Response: Broadcast Alert creates persistent alert with corridor and severity", async () => {
    const emergencyCaller = appRouter.createCaller(createMockContext("user", "emergency_team"));

    const alert = await emergencyCaller.operations.broadcastAlert({
      title: "Flash Flood Warning: NH-6 Pass",
      message: "Mudslide risk active between km 45 and 62. Heavy transport restricted.",
      severity: "CRITICAL",
      corridor: "NH-6 Shillong Corridor",
    });

    expect(alert).toBeDefined();
    expect(alert.title).toBe("Flash Flood Warning: NH-6 Pass");
    expect(alert.severity).toBe("CRITICAL");

    const alerts = await emergencyCaller.operations.alerts({ limit: 10 });
    const found = alerts.find((a) => a.id === alert.id);
    expect(found).toBeDefined();
  });

  it("RBAC Enforcement: Truck Driver cannot broadcast emergency alerts", async () => {
    const driverCaller = appRouter.createCaller(createMockContext("user", "truck_driver"));

    await expect(
      driverCaller.operations.broadcastAlert({
        title: "Unauthorized Alert",
        message: "This should fail due to RBAC policy",
        severity: "HIGH",
        corridor: "NH-37",
      })
    ).rejects.toThrow();
  });

  it("RBAC Enforcement: Field Officer cannot create shipments", async () => {
    const fieldCaller = appRouter.createCaller(createMockContext("user", "field_officer"));

    await expect(
      fieldCaller.operations.createShipment({
        name: "Unauthorized Shipment",
        priority: "NORMAL",
        origin: "Guwahati",
        destination: "Silchar",
        etaMinutes: 120,
      })
    ).rejects.toThrow();
  });

  it("Safety Validator Integration: Shortest route is rejected and alternate recommended", async () => {
    const driverCaller = appRouter.createCaller(createMockContext("user", "truck_driver"));
    const response = await driverCaller.operations.route({ origin: "GUWAHATI", destination: "IMPHAL" });

    expect(response.recommendation).toBeDefined();
    expect(response.recommendation.routeLabel).toBe("Guwahati → Kohima → Imphal");
    expect(response.recommendation.shortestRouteRejected).toBe(true);
    expect(["SAFE", "CAUTION"]).toContain(response.recommendation.safetyStatus);
  });
});
