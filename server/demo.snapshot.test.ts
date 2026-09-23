import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context: TrpcContext = {
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("demo.snapshot", () => {
  it("returns a clearly simulated regional operations snapshot", async () => {
    const result = await appRouter.createCaller(context).demo.snapshot();

    expect(result.mode).toBe("demo");
    expect(result.region).toBe("Northeast Region");
    expect(result.metrics.activeVehicles).toBeGreaterThan(0);
    expect(result.metrics.blockedRoads).toBeGreaterThan(0);
    expect(result.vehicles.some((vehicle) => vehicle.id === "TRK-104")).toBe(true);
    expect(result.incidents.some((incident) => incident.status === "Under review")).toBe(true);
  });
});
