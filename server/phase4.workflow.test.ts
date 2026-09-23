import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIncident: vi.fn(),
  updateIncidentStatus: vi.fn(),
  updateIncidentRoadAccessibility: vi.fn(),
  appendAuditEvent: vi.fn(),
  listIncidents: vi.fn(),
  listVehicles: vi.fn(),
  listShipments: vi.fn(),
  listAuditEvents: vi.fn(),
  getVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  updateShipment: vi.fn(),
  getAlert: vi.fn(),
  listAlerts: vi.fn(),
  createAlert: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
  resolveAlertsForIncident: vi.fn(),
  getDb: vi.fn(),
  seedDemoData: vi.fn(),
  isDatabaseAvailable: vi.fn(() => false),
  recordVehicleLocation: vi.fn(),
  getVehicleLocationHistory: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(
  role: "user" | "admin" = "user",
  operationalRole: "admin" | "field_officer" | "truck_driver" | "logistics_manager" | "emergency_team" | "viewer" = "field_officer"
) {
  return {
    user: {
      id: 8,
      openId: "phase4-user",
      email: "phase4@example.com",
      name: "Phase 4 Operator",
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

const verifiedBlockedIncident = {
  id: "INC-SIH-001",
  type: "Landslide",
  severity: "CRITICAL",
  status: "VERIFIED",
  roadAccessibility: "blocked",
  description: "Landslide blocking NH-37 Jorhat corridor completely",
  corridor: "NH-37 Jorhat",
  latitude: 26.75,
  longitude: 94.2,
};

const sampleVehicle = {
  id: "TRK-104",
  registrationNumber: "AS-01-EC-1044",
  currentCorridor: "NH-37 Jorhat",
  latitude: 26.75,
  longitude: 94.2,
  status: "on_route",
  shipmentId: "SHP-001",
  activeRoute: "Guwahati → Jorhat → Kohima → Imphal",
  heading: 85,
  speedKmh: 42,
  locationFreshness: "LIVE",
  locationSource: "SIMULATED GPS",
  lastGpsUpdate: new Date(),
};

const sampleShipment = {
  id: "SHP-001",
  name: "Emergency Medical Supplies & Vaccines",
  priority: "CRITICAL",
  origin: "Guwahati",
  destination: "Imphal",
  assignedVehicleId: "TRK-104",
  status: "in_transit",
  activeRoute: "Guwahati → Jorhat → Kohima → Imphal",
  currentEtaMinutes: 222,
  plannedEtaMinutes: 222,
  delayMinutes: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isDatabaseAvailable.mockReturnValue(false);
  mocks.listIncidents.mockResolvedValue([verifiedBlockedIncident]);
  mocks.listVehicles.mockResolvedValue([sampleVehicle]);
  mocks.listShipments.mockResolvedValue([sampleShipment]);
  mocks.getVehicle.mockResolvedValue(sampleVehicle);
  mocks.updateIncidentStatus.mockResolvedValue(verifiedBlockedIncident);
  mocks.updateIncidentRoadAccessibility.mockResolvedValue(verifiedBlockedIncident);
  mocks.createAlert.mockImplementation(async (alert: any) => ({
    id: `ALT-${Date.now()}`,
    ...alert,
    status: "ACTIVE",
    createdAt: new Date(),
  }));
  mocks.getAlert.mockImplementation(async (id: string) => ({
    id,
    alertType: "ROAD_BLOCKAGE",
    title: "NH-37 Jorhat Blockage",
    message: "Corridor blocked by landslide",
    severity: "CRITICAL",
    corridor: "NH-37 Jorhat",
    status: "ACTIVE",
    targetRoles: ["admin", "emergency_team", "truck_driver"],
    affectedVehicleIds: ["TRK-104"],
    affectedShipmentIds: ["SHP-001"],
    createdAt: new Date(),
  }));
  mocks.acknowledgeAlert.mockImplementation(async (id: string, userId: number, userName: string) => ({
    id,
    status: "ACKNOWLEDGED",
    acknowledgedBy: userId,
    acknowledgedByName: userName,
    acknowledgedAt: new Date(),
  }));
  mocks.resolveAlert.mockImplementation(async (id: string, userId: number) => ({
    id,
    status: "RESOLVED",
    resolvedBy: userId,
    resolvedAt: new Date(),
  }));
  mocks.appendAuditEvent.mockImplementation(async (evt: any) => ({
    id: 101,
    ...evt,
    createdAt: new Date(),
  }));
});

describe("Phase 4: End-to-End Emergency Response Workflow & SIH 21-Step Scenario", () => {
  it("Step 1-6: Incident verification triggers automated emergency impact and role-targeted alerts", async () => {
    const adminCaller = appRouter.createCaller(context("admin", "admin"));

    const result = await adminCaller.operations.reviewIncident({
      id: "INC-SIH-001",
      status: "VERIFIED",
    });

    expect(result).toBeDefined();
    expect(mocks.updateIncidentStatus).toHaveBeenCalledWith("INC-SIH-001", "VERIFIED", 8);

    // Verifies emergency impact detection for critical shipments
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "critical_shipment.impact_detected",
        entityType: "incident",
        entityId: "INC-SIH-001",
      })
    );

    // Verifies emergency route generated event logged
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "emergency_route.generated",
        entityType: "incident",
        entityId: "INC-SIH-001",
      })
    );

    // Verifies role-targeted alerts created
    expect(mocks.createAlert).toHaveBeenCalled();
  });

  it("Step 7-10: Emergency impact evaluation accurately correlates vehicles and critical shipments", async () => {
    const caller = appRouter.createCaller(context("admin", "emergency_team"));

    const impact = await caller.operations.emergencyImpact({
      incidentId: "INC-SIH-001",
    });

    expect(impact).toBeDefined();
    expect(impact?.emergencyPriority).toBe("CRITICAL");
    expect(impact?.affectedVehicles.map((v) => v.id)).toContain("TRK-104");
    expect(impact?.affectedCriticalShipments.map((s) => s.id)).toContain("SHP-001");
    expect(impact?.shipmentImpactMap["SHP-001"]).toBe("CRITICALLY AFFECTED");
    expect(impact?.requiresDriverConfirmation).toBe(true);
  });

  it("Step 11-15: Alert acknowledgement enforces role-based authorization", async () => {
    const emergencyCaller = appRouter.createCaller(context("user", "emergency_team"));

    const ackResult = await emergencyCaller.operations.acknowledgeAlert({
      alertId: "ALT-TEST-1",
    });

    expect(ackResult.success).toBe(true);
    expect(ackResult.alert.status).toBe("ACKNOWLEDGED");
    expect(mocks.acknowledgeAlert).toHaveBeenCalledWith("ALT-TEST-1", 8, "Phase 4 Operator");
  });

  it("Step 16-21: Driver route acceptance preserves human-in-the-loop requirement", async () => {
    const driverCaller = appRouter.createCaller(context("user", "truck_driver"));

    const acceptResult = await driverCaller.operations.acceptRoute({
      vehicleId: "TRK-104",
      routeLabel: "Guwahati → Shillong → Silchar → Imphal",
      alternateRoute: "NH-6 / NH-27 Bypass",
      distanceKm: 418,
      etaMinutes: 264,
      delayMinutes: 42,
      delayReason: "Detour via NH-6 due to verified NH-37 landslide",
    });

    expect(acceptResult.success).toBe(true);
    expect(acceptResult.humanInTheLoopConfirmed).toBe(true);
    expect(acceptResult.automaticVehicleRedirect).toBe(false);

    // Verifies audit logging for both route.accepted_by_driver and emergency_route.accepted
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "route.accepted_by_driver",
        entityType: "vehicle",
        entityId: "TRK-104",
      })
    );
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "emergency_route.accepted",
        entityType: "vehicle",
        entityId: "TRK-104",
      })
    );
  });
});
