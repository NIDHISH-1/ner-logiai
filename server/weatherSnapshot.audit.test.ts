import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveWeatherSnapshots: vi.fn(),
  listWeatherSnapshots: vi.fn(),
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

const context: TrpcContext = { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveWeatherSnapshots.mockResolvedValue([]);
  mocks.listWeatherSnapshots.mockResolvedValue([{ id: 1, roadSegment: "NH-37-JORHAT", weatherSource: "SIMULATED WEATHER DATA", weatherStatus: "STALE", predictionTimestamp: new Date(), weatherTimestamp: new Date(Date.now() - 240 * 60_000) }]);
  mocks.getDb.mockResolvedValue(null);
  mocks.listIncidents.mockResolvedValue([]);
  mocks.listVehicles.mockResolvedValue([]);
  mocks.listShipments.mockResolvedValue([]);
  mocks.listAuditEvents.mockResolvedValue([]);
});

describe("weather snapshot auditability", () => {
  it("persists one snapshot for each generated risk prediction", async () => {
    const result = await appRouter.createCaller(context).demo.risk();
    expect(result.predictions).toHaveLength(3);
    expect(mocks.saveWeatherSnapshots).toHaveBeenCalledTimes(1);
    const rows = mocks.saveWeatherSnapshots.mock.calls[0]?.[0] ?? [];
    expect(rows).toHaveLength(3);
    expect(["SIMULATED WEATHER DATA", "LIVE · OPENWEATHER"]).toContain(rows[0]?.weatherSource);
    expect(rows[0]).toMatchObject({ predictionRiskLevel: expect.any(String), predictionTimestamp: expect.any(Date) });
    expect(rows[0].weatherTimestamp).toBeInstanceOf(Date);
  });

  it("retrieves historical snapshots without changing their stale status", async () => {
    const result = await appRouter.createCaller(context).demo.weatherSnapshots({ limit: 5, roadSegment: "NH-37-JORHAT" });
    expect(mocks.listWeatherSnapshots).toHaveBeenCalledWith(5, "NH-37-JORHAT");
    expect(result[0]?.weatherSource).toBe("SIMULATED WEATHER DATA");
    expect(result[0]?.weatherStatus).toBe("STALE");
  });
});
