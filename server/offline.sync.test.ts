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
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const input = { id: "INC-OFF-TEST01", type: "Road Blockage" as const, severity: "HIGH" as const, description: "Offline debris report", latitude: 26.1445, longitude: 91.7362, roadAccessibility: "restricted" as const, occurredAt: new Date("2026-09-13T12:00:00.000Z") };
const context = { user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] } satisfies TrpcContext;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue({});
  mocks.listIncidents.mockResolvedValue([]);
  mocks.listVehicles.mockResolvedValue([]);
  mocks.listShipments.mockResolvedValue([]);
  mocks.listAuditEvents.mockResolvedValue([]);
  mocks.createIncident.mockResolvedValue({ ...input, status: "UNVERIFIED" });
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
