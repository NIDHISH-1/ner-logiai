import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIncident: vi.fn(),
  updateIncidentStatus: vi.fn(),
  appendAuditEvent: vi.fn(),
  listIncidents: vi.fn(),
  listVehicles: vi.fn(),
  listShipments: vi.fn(),
  listAuditEvents: vi.fn(),
  getDb: vi.fn(),
  seedDemoData: vi.fn(),
  isDatabaseAvailable: vi.fn(() => false),
  createAlert: vi.fn(),
  resolveAlertsForIncident: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "user" | "admin" = "user", operationalRole: "admin" | "field_officer" | "truck_driver" | "logistics_manager" | "emergency_team" | "viewer" = "field_officer") {
  return {
    user: { id: 8, openId: "phase3-user", email: "phase3@example.com", name: "Phase 3 User", loginMethod: "demo", role, operationalRole, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } satisfies TrpcContext;
}

const input = { id: "INC-TEST-01", type: "Road Blockage" as const, severity: "CRITICAL" as const, description: "A verified test blockage", latitude: 26.1445, longitude: 91.7362, roadAccessibility: "blocked" as const, occurredAt: new Date("2026-09-08T12:00:00.000Z") };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createIncident.mockResolvedValue({ ...input, status: "UNVERIFIED", reporterRole: "field_officer" });
  mocks.updateIncidentStatus.mockResolvedValue({ ...input, status: "VERIFIED" });
  mocks.getDb.mockResolvedValue({});
  mocks.listIncidents.mockResolvedValue([]);
  mocks.listVehicles.mockResolvedValue([]);
  mocks.listShipments.mockResolvedValue([]);
  mocks.listAuditEvents.mockResolvedValue([]);
  mocks.seedDemoData.mockResolvedValue({ seeded: true, vehicles: 10, shipments: 15, incidents: 20 });
  mocks.isDatabaseAvailable.mockReturnValue(false);
});

describe("Phase 3 incident workflow", () => {
  it("creates an unverified incident with coordinates and reporter role", async () => {
    const caller = appRouter.createCaller(context());
    await caller.operations.createIncident(input);
    expect(mocks.createIncident).toHaveBeenCalledWith(expect.objectContaining({ id: input.id, status: "UNVERIFIED", severity: "CRITICAL", latitude: "26.144500", longitude: "91.736200", reporterRole: "field_officer" }), 8);
  });

  it("persists a demo incident through the public demo workflow", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.demo.createIncident(input);
    expect(result?.id).toBe(input.id);
    expect(mocks.createIncident).toHaveBeenCalledTimes(1);
    expect(mocks.createIncident.mock.calls[0]?.[0]).toMatchObject({ isDemo: true, status: "UNVERIFIED" });
  });

  it("lets an admin verify and reject through explicit status transitions", async () => {
    const caller = appRouter.createCaller(context("admin", "admin"));
    await caller.operations.reviewIncident({ id: input.id, status: "VERIFIED" });
    await caller.operations.reviewIncident({ id: input.id, status: "REJECTED" });
    expect(mocks.updateIncidentStatus).toHaveBeenNthCalledWith(1, input.id, "VERIFIED", 8);
    expect(mocks.updateIncidentStatus).toHaveBeenNthCalledWith(2, input.id, "REJECTED", 8);
  });

  it("denies a driver from verifying an incident", async () => {
    const caller = appRouter.createCaller(context("user", "truck_driver"));
    await expect(caller.operations.reviewIncident({ id: input.id, status: "VERIFIED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateIncidentStatus).not.toHaveBeenCalled();
  });

  it("scopes emergency data to verified critical incidents and critical shipments", async () => {
    mocks.listIncidents.mockResolvedValue([{ id: "critical", status: "VERIFIED", severity: "CRITICAL" }, { id: "open", status: "UNDER_REVIEW", severity: "CRITICAL" }, { id: "normal", status: "VERIFIED", severity: "HIGH" }]);
    mocks.listVehicles.mockResolvedValue([{ id: "TRK-HIGH", risk: "HIGH", status: "on_route" }, { id: "TRK-LOW", risk: "LOW", status: "on_route" }]);
    mocks.listShipments.mockResolvedValue([{ id: "SHP-CRIT", priority: "CRITICAL" }, { id: "SHP-NORMAL", priority: "NORMAL" }]);
    const result = await appRouter.createCaller(context("user", "emergency_team")).operations.snapshot();
    expect(result.incidents.map(incident => incident.id)).toEqual(["critical"]);
    expect(result.vehicles.map(vehicle => vehicle.id)).toEqual(["TRK-HIGH"]);
    expect(result.shipments.map(shipment => shipment.id)).toEqual(["SHP-CRIT"]);
  });

  it("keeps shipment priority in the persisted operational read model", async () => {
    mocks.listShipments.mockResolvedValue([{ id: "SHP-CRIT", priority: "CRITICAL", status: "in_transit" }]);
    const result = await appRouter.createCaller(context("admin", "admin")).operations.snapshot();
    expect(result.shipments[0]?.priority).toBe("CRITICAL");
  });

  it("exposes the seeded demo contract and the audit event read path", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.demo.ensureSeeded()).resolves.toMatchObject({ seeded: true, vehicles: 10, shipments: 15, incidents: 20 });
    mocks.listAuditEvents.mockResolvedValue([{ id: 1, action: "incident.created" }]);
    const audit = await appRouter.createCaller(context("admin", "admin")).operations.audit({ limit: 10 });
    expect(audit[0]?.action).toBe("incident.created");
  });
});
