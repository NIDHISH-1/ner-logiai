import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIncident: vi.fn(),
  getIncidentById: vi.fn(),
  appendAuditEvent: vi.fn(),
  updateIncidentStatus: vi.fn(),
  listIncidents: vi.fn(),
  listVehicles: vi.fn(),
  listShipments: vi.fn(),
  listAuditEvents: vi.fn(),
  getDb: vi.fn(),
  seedDemoData: vi.fn(),
  getAlert: vi.fn(),
  acknowledgeAlert: vi.fn(),
  getVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  updateShipment: vi.fn(),
  updateIncidentRoadAccessibility: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const input = { id: "INC-OFF-TEST01", type: "Road Blockage" as const, severity: "HIGH" as const, description: "Offline debris report", latitude: 26.1445, longitude: 91.7362, roadAccessibility: "restricted" as const, occurredAt: new Date("2026-09-13T12:00:00.000Z") };
const context = { user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] } satisfies TrpcContext;
const authContext = {
  user: {
    id: "usr-admin-01",
    openId: "open-id-01",
    name: "Admin Officer",
    role: "admin",
    operationalRole: "admin",
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} satisfies TrpcContext;

beforeEach(() => {
  vi.clearAllMocks();
  const auditStore: any[] = [];
  mocks.getDb.mockResolvedValue({});
  mocks.listIncidents.mockResolvedValue([]);
  mocks.listVehicles.mockResolvedValue([]);
  mocks.listShipments.mockResolvedValue([]);
  mocks.listAuditEvents.mockImplementation(async () => [...auditStore]);
  mocks.appendAuditEvent.mockImplementation(async (event: any) => {
    auditStore.unshift(event);
    return event;
  });
  mocks.createIncident.mockResolvedValue({ ...input, status: "UNVERIFIED" });
  mocks.getVehicle.mockResolvedValue({ id: "TRK-104", status: "Active" });

  let alertState: any = { id: "ALT-TEST-101", status: "ACTIVE", targetRoles: ["admin"], severity: "HIGH" };
  mocks.getAlert.mockImplementation(async () => alertState);
  mocks.acknowledgeAlert.mockImplementation(async (id: string) => {
    alertState = { ...alertState, status: "ACKNOWLEDGED", acknowledgedByName: "Admin" };
    return alertState;
  });
  mocks.updateIncidentRoadAccessibility.mockResolvedValue(true);
});

describe("offline incident sync", () => {
  it("returns SYNCED without creating a duplicate", async () => {
    const existing = { ...input, severity: "HIGH", latitude: "26.144500", longitude: "91.736200", occurredAt: input.occurredAt, photoUrl: null };
    mocks.getIncidentById.mockResolvedValue(existing);
    const result = await appRouter.createCaller(context).demo.syncIncident(input);
    expect(result.status).toBe("SYNCED");
    expect(result.duplicate).toBe(true);
    expect(mocks.createIncident).not.toHaveBeenCalled();
  });

  it("returns CONFLICT and preserves different server data", async () => {
    mocks.getIncidentById.mockResolvedValue({ ...input, description: "Server-edited report", latitude: "26.144500", longitude: "91.736200", occurredAt: input.occurredAt });
    const result = await appRouter.createCaller(context).demo.syncIncident(input);
    expect(result.status).toBe("CONFLICT");
    expect(result.incident.description).toBe("Server-edited report");
    expect(mocks.createIncident).not.toHaveBeenCalled();
  });

  it("creates a new offline report once when no server record exists", async () => {
    mocks.getIncidentById.mockResolvedValue(undefined);
    const result = await appRouter.createCaller(context).demo.syncIncident(input);
    expect(result.status).toBe("SYNCED");
    expect(result.duplicate).toBe(false);
    expect(mocks.createIncident).toHaveBeenCalledWith(expect.objectContaining({ id: input.id, status: "UNVERIFIED", isDemo: true }));
  });
});

describe("offline driver route acceptance sync", () => {
  it("synchronizes route acceptance idempotently with human-in-the-loop preserved", async () => {
    const caller = appRouter.createCaller(authContext);
    const result1 = await caller.operations.syncRouteAcceptance({
      actionId: "ACT-ROUTE-TRK104-01",
      routeId: "ROUTE-B-ALTERNATE",
      vehicleId: "TRK-104",
      routeLabel: "Route B (NH-6 / NH-27)",
      alternateRoute: "NH-6 / NH-27 via Shillong bypass",
      distanceKm: 285,
      etaMinutes: 253,
      acceptedAt: new Date().toISOString(),
      humanInTheLoopConfirmed: true,
      automaticVehicleRedirect: false,
    });

    expect(result1.status).toBe("SYNCED");
    expect(result1.actionId).toBe("ACT-ROUTE-TRK104-01");
    expect(result1.humanInTheLoopConfirmed).toBe(true);
    expect(result1.automaticVehicleRedirect).toBe(false);
    expect(result1.duplicate).toBe(false);

    // Replay same action (idempotent duplicate)
    const result2 = await caller.operations.syncRouteAcceptance({
      actionId: "ACT-ROUTE-TRK104-01",
      routeId: "ROUTE-B-ALTERNATE",
      vehicleId: "TRK-104",
      routeLabel: "Route B (NH-6 / NH-27)",
      alternateRoute: "NH-6 / NH-27 via Shillong bypass",
      distanceKm: 285,
      etaMinutes: 253,
      acceptedAt: new Date().toISOString(),
      humanInTheLoopConfirmed: true,
      automaticVehicleRedirect: false,
    });

    expect(result2.status).toBe("SYNCED");
    expect(result2.duplicate).toBe(true);
  });
});

describe("offline alert acknowledgement sync", () => {
  it("synchronizes alert acknowledgement idempotently", async () => {
    const caller = appRouter.createCaller(authContext);
    const result1 = await caller.operations.syncAlertAcknowledge({
      actionId: "ACT-ACK-ALT101-01",
      alertId: "ALT-TEST-101",
      acknowledgedAt: new Date().toISOString(),
    });

    expect(result1.status).toBe("SYNCED");
    expect(result1.actionId).toBe("ACT-ACK-ALT101-01");
    expect(result1.duplicate).toBe(false);

    // Replay same action
    const result2 = await caller.operations.syncAlertAcknowledge({
      actionId: "ACT-ACK-ALT101-01",
      alertId: "ALT-TEST-101",
      acknowledgedAt: new Date().toISOString(),
    });

    expect(result2.status).toBe("SYNCED");
    expect(result2.duplicate).toBe(true);
  });
});

describe("offline road status update sync", () => {
  it("synchronizes road accessibility update idempotently", async () => {
    const caller = appRouter.createCaller(authContext);
    const result1 = await caller.operations.syncRoadStatus({
      actionId: "ACT-ROAD-NH37-01",
      corridor: "NH-37 · Jorhat Bypass Segment",
      roadAccessibility: "blocked",
      severity: "HIGH",
      description: "Severe landslide blocking corridor",
      latitude: 26.75,
      longitude: 94.2,
      reportedAt: new Date().toISOString(),
    });

    expect(result1.status).toBe("SYNCED");
    expect(result1.actionId).toBe("ACT-ROAD-NH37-01");
    expect(result1.duplicate).toBe(false);

    // Replay same action
    const result2 = await caller.operations.syncRoadStatus({
      actionId: "ACT-ROAD-NH37-01",
      corridor: "NH-37 · Jorhat Bypass Segment",
      roadAccessibility: "blocked",
      severity: "HIGH",
      description: "Severe landslide blocking corridor",
      latitude: 26.75,
      longitude: 94.2,
      reportedAt: new Date().toISOString(),
    });

    expect(result2.status).toBe("SYNCED");
    expect(result2.duplicate).toBe(true);
  });
});
