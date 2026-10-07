import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("Operations Router", () => {
  const adminContext: TrpcContext = {
    user: {
      id: 1,
      openId: "usr_admin",
      name: "Aditi Sharma",
      role: "admin",
      createdAt: new Date(),
    },
    req: {} as any,
    res: {} as any,
  };

  const caller = appRouter.createCaller(adminContext);

  it("lists arterial corridors with safety checks and weather", async () => {
    const corridors = await caller.operations.corridors();
    expect(corridors.length).toBeGreaterThan(0);
    expect(corridors[0]).toHaveProperty("id");
    expect(corridors[0]).toHaveProperty("safetyStatus");
    expect(corridors[0]).toHaveProperty("riskProbability");
  });

  it("fetches active alerts and allows broadcasting new alerts", async () => {
    const initialAlerts = await caller.operations.alerts();
    expect(Array.isArray(initialAlerts)).toBe(true);

    const newAlert = await caller.operations.broadcastAlert({
      title: "Test Monsoon Flash Flood Warning",
      severity: "CRITICAL",
      corridor: "NH-37",
      targetRoles: ["FIELD_OFFICER", "TRUCK_DRIVER"],
      message: "River overflow detected near Kaliabor bridge. Convoys hold at Jorhat staging ground.",
    });

    expect(newAlert.id).toBeDefined();
    expect(newAlert.title).toBe("Test Monsoon Flash Flood Warning");
    expect(newAlert.severity).toBe("CRITICAL");

    const updatedAlerts = await caller.operations.alerts();
    expect(updatedAlerts.some((a) => a.id === newAlert.id)).toBe(true);

    // Verify broadcasted alert reaches truck driver alert section
    const truckDriverContext: TrpcContext = {
      user: {
        id: 2,
        openId: "usr_driver",
        name: "Driver Rajesh",
        role: "user",
        operationalRole: "truck_driver",
        createdAt: new Date(),
      },
      req: {} as any,
      res: {} as any,
    };
    const truckDriverCaller = appRouter.createCaller(truckDriverContext);
    const driverAlerts = await truckDriverCaller.operations.alerts();
    expect(driverAlerts.some((a) => a.id === newAlert.id)).toBe(true);
  });

  it("creates and dispatches a shipment through operations router", async () => {
    const shipment = await caller.operations.createShipment({
      name: "Oxygen Concentrators (Batch 4)",
      priority: "CRITICAL",
      origin: "Guwahati Staging Depot",
      destination: "Imphal Regional Hospital",
      etaMinutes: 240,
      vehicleId: "TRK-104",
    });

    expect(shipment).toBeDefined();
    expect(shipment.priority).toBe("CRITICAL");
    expect(shipment.name).toBe("Oxygen Concentrators (Batch 4)");

    const snapshot = await caller.operations.snapshot();
    expect(snapshot.shipments.some((s) => s.id === shipment.id)).toBe(true);
  });
});
