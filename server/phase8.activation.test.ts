import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { roles, roleNavigation } from "../client/src/components/roleConfig";
import { localizeAlert } from "../shared/i18n";

describe("Phase 8.1 — Full Role Workspace Activation & Authentication Audit", () => {
  it("guarantees every role workspace has a comprehensive, distinct navigation structure", () => {
    expect(roles).toHaveLength(5);
    for (const r of roles) {
      expect(roleNavigation[r].length).toBeGreaterThanOrEqual(5);
    }

    // Truck Driver
    expect(roleNavigation["Truck Driver"]).toContain("My Trip");
    expect(roleNavigation["Truck Driver"]).toContain("Navigation");
    expect(roleNavigation["Truck Driver"]).toContain("Vehicle / GPS");
    expect(roleNavigation["Truck Driver"]).toContain("Shipments");
    expect(roleNavigation["Truck Driver"]).toContain("Alerts");
    expect(roleNavigation["Truck Driver"]).toContain("Report Incident");
    expect(roleNavigation["Truck Driver"]).toContain("Offline Sync");

    // Logistics Manager
    expect(roleNavigation["Logistics Manager"]).toContain("Dashboard");
    expect(roleNavigation["Logistics Manager"]).toContain("Shipments");
    expect(roleNavigation["Logistics Manager"]).toContain("Fleet");
    expect(roleNavigation["Logistics Manager"]).toContain("Delays");
    expect(roleNavigation["Logistics Manager"]).toContain("Critical Shipments");
    expect(roleNavigation["Logistics Manager"]).toContain("Corridors");
    expect(roleNavigation["Logistics Manager"]).toContain("Alerts");
    expect(roleNavigation["Logistics Manager"]).toContain("Analytics");

    // Field Officer
    expect(roleNavigation["Field Officer"]).toContain("Field Dashboard");
    expect(roleNavigation["Field Officer"]).toContain("Report Incident");
    expect(roleNavigation["Field Officer"]).toContain("Road Status");
    expect(roleNavigation["Field Officer"]).toContain("Field Reports");
    expect(roleNavigation["Field Officer"]).toContain("Map");
    expect(roleNavigation["Field Officer"]).toContain("Offline Sync");
    expect(roleNavigation["Field Officer"]).toContain("Alerts");

    // Emergency Response Team
    expect(roleNavigation["Emergency Response Team"]).toContain("Emergency Dashboard");
    expect(roleNavigation["Emergency Response Team"]).toContain("Active Incidents");
    expect(roleNavigation["Emergency Response Team"]).toContain("Emergency Routes");
    expect(roleNavigation["Emergency Response Team"]).toContain("Affected Shipments");
    expect(roleNavigation["Emergency Response Team"]).toContain("Affected Vehicles");
    expect(roleNavigation["Emergency Response Team"]).toContain("Map");
    expect(roleNavigation["Emergency Response Team"]).toContain("Alerts");
  });

  it("safely localizes alerts when affectedVehicleIds is an array, string, or null", () => {
    // Array format from backend
    const res1 = localizeAlert(
      {
        alertType: "ROUTE_BLOCKED",
        title: "Corridor Disruption",
        message: "NH-37 is blocked due to bridge damage",
        corridor: "NH-37",
        severity: "CRITICAL",
        affectedVehicleIds: ["TRK-104", "TRK-202"],
        affectedShipmentIds: ["SHP-001"],
      },
      "en"
    );
    expect(res1.title).toBeDefined();
    expect(res1.message).toBeDefined();

    // Hindi with array format
    const resHindi = localizeAlert(
      {
        alertType: "ROUTE_BLOCKED",
        title: "Corridor Disruption",
        message: "NH-37 is blocked due to bridge damage",
        corridor: "NH-37",
        severity: "CRITICAL",
        affectedVehicleIds: ["TRK-104"],
        affectedShipmentIds: ["SHP-001"],
      },
      "hi"
    );
    expect(resHindi.language).toBe("hi");

    // String format
    const res2 = localizeAlert(
      {
        alertType: "SPEED_WARNING",
        title: "Speed Advisory",
        message: "Heavy fog in mountain sector",
        corridor: "NH-2",
        severity: "HIGH",
        affectedVehicleIds: "TRK-219, TRK-301",
      },
      "en"
    );
    expect(res2.title).toBeDefined();

    // Undefined / null format
    const res3 = localizeAlert(
      {
        title: "General Warning",
        message: "Severe rainfall across Guwahati",
        corridor: "NH-6",
        severity: "MODERATE",
      },
      "en"
    );
    expect(res3.title).toBe("General Warning");
  });

  it("allows access.current query to succeed for both unauthenticated visitors and authenticated operators", async () => {
    // Unauthenticated context
    const unauthedCaller = appRouter.createCaller({
      user: null as any,
      req: {} as any,
      res: {} as any,
    });

    const unauthedAccess = await unauthedCaller.access.current();
    expect(unauthedAccess.operationalRole).toBe("viewer");
    expect(unauthedAccess.capabilities.viewOperations).toBe(true);
    expect(unauthedAccess.capabilities.createIncident).toBe(false);

    // Authenticated context
    const authedCaller = appRouter.createCaller({
      user: {
        id: "USR-01",
        openId: "user_test",
        email: "driver@example.com",
        name: "Test Driver",
        role: "user",
        operationalRole: "truck_driver",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: "test",
      },
      req: {} as any,
      res: {} as any,
    });

    const authedAccess = await authedCaller.access.current();
    expect(authedAccess.operationalRole).toBe("truck_driver");
    expect(authedAccess.capabilities.createIncident).toBe(true);
    expect(authedAccess.capabilities.reviewIncident).toBe(false);
  });

  it("validates signup flow with password matching and role allocation", async () => {
    const caller = appRouter.createCaller({
      user: null as any,
      req: { protocol: "https", headers: {} } as any,
      res: { cookie: () => {} } as any,
    });

    // Mismatched password should fail
    await expect(
      caller.auth.signup({
        name: "Officer Test",
        email: "test.officer@ner-logiai.gov.in",
        password: "secretpassword1",
        confirmPassword: "differentpassword",
        requestedRole: "field_officer",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    // Valid signup creates user with requested demo role
    const uniqueEmail = `officer_${Date.now()}@ner-logiai.gov.in`;
    const signupRes = await caller.auth.signup({
      name: "Field Officer T. Jamir",
      email: uniqueEmail,
      password: "securepassword123",
      confirmPassword: "securepassword123",
      requestedRole: "field_officer",
      organization: "Assam Police Border Outpost",
    });

    expect(signupRes.success).toBe(true);
    expect(signupRes.token).toBeDefined();
    expect(signupRes.user?.name).toBe("Field Officer T. Jamir");
    expect(signupRes.user?.operationalRole).toBe("field_officer");
  });
});
