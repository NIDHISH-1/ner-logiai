import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";
import { roleNavigation, roles, roleSummary, roleCapabilities } from "../client/src/components/roleConfig";
import { optimizeRoute, simulatedRoadGraph } from "./routeEngine";
import { evaluateSegmentSafety } from "./safetyEngine";
import { buildNoSafeRouteAlert } from "./emergencyImpactEngine";

describe("Phase 8.1 — Authentication, Signup & Full Role Workspace Activation", () => {
  const createMockReqRes = () => ({
    req: {
      headers: { host: "localhost:3000" },
      protocol: "http",
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  });

  const adminContext = {
    user: {
      id: "USR-ADMIN-01",
      openId: "user_admin_eval",
      name: "Regional Commander Sharma",
      email: "commander@ner-logiai.gov.in",
      role: "admin",
      operationalRole: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "standalone_prototype",
    },
    ...createMockReqRes(),
  };

  const driverContext = {
    user: {
      id: "USR-DRIVER-04",
      openId: "user_driver_eval",
      name: "Biren Gogoi (TRK-104)",
      email: "driver.biren@assamtransport.in",
      role: "user",
      operationalRole: "truck_driver",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "standalone_prototype",
    },
    ...createMockReqRes(),
  };

  const fieldOfficerContext = {
    user: {
      id: "USR-FIELD-02",
      openId: "user_field_eval",
      name: "Rajesh Bora",
      email: "rajesh.field@ner-logiai.gov.in",
      role: "user",
      operationalRole: "field_officer",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "standalone_prototype",
    },
    ...createMockReqRes(),
  };

  const unauthedContext = {
    user: null,
    ...createMockReqRes(),
  };

  describe("Role Navigation & Workspace Integrity", () => {
    it("configures all 5 canonical roles with complete, non-empty navigation", () => {
      expect(roles).toHaveLength(5);
      expect(roles).toContain("Government / District Administrator");
      expect(roles).toContain("Truck Driver");
      expect(roles).toContain("Field Officer");
      expect(roles).toContain("Logistics Manager");
      expect(roles).toContain("Emergency Response Team");

      for (const role of roles) {
        expect(roleNavigation[role].length).toBeGreaterThanOrEqual(6);
        expect(new Set(roleNavigation[role]).size).toBe(roleNavigation[role].length);
      }
    });

    it("verifies Truck Driver navigation includes all audited features", () => {
      const driverNav = roleNavigation["Truck Driver"];
      expect(driverNav).toContain("My Trip");
      expect(driverNav).toContain("Navigation");
      expect(driverNav).toContain("Vehicle / GPS");
      expect(driverNav).toContain("Shipments");
      expect(driverNav).toContain("Alerts");
      expect(driverNav).toContain("Report Incident");
      expect(driverNav).toContain("Offline Sync");
      expect(driverNav).toContain("Settings");
    });

    it("verifies Field Officer navigation includes ground truth & road status", () => {
      const fieldNav = roleNavigation["Field Officer"];
      expect(fieldNav).toContain("Field Dashboard");
      expect(fieldNav).toContain("Report Incident");
      expect(fieldNav).toContain("Road Status");
      expect(fieldNav).toContain("Field Reports");
      expect(fieldNav).toContain("Map");
      expect(fieldNav).toContain("Offline Sync");
      expect(fieldNav).toContain("Alerts");
      expect(fieldNav).toContain("Settings");
    });

    it("verifies Logistics Manager navigation includes fleet, delays, and critical shipments", () => {
      const logNav = roleNavigation["Logistics Manager"];
      expect(logNav).toContain("Dashboard");
      expect(logNav).toContain("Shipments");
      expect(logNav).toContain("Fleet");
      expect(logNav).toContain("Delays");
      expect(logNav).toContain("Critical Shipments");
      expect(logNav).toContain("Corridors");
      expect(logNav).toContain("Alerts");
      expect(logNav).toContain("Analytics");
      expect(logNav).toContain("Settings");
    });

    it("verifies Emergency Response Team navigation includes crisis response workflows", () => {
      const emergNav = roleNavigation["Emergency Response Team"];
      expect(emergNav).toContain("Emergency Dashboard");
      expect(emergNav).toContain("Active Incidents");
      expect(emergNav).toContain("Emergency Routes");
      expect(emergNav).toContain("Affected Shipments");
      expect(emergNav).toContain("Affected Vehicles");
      expect(emergNav).toContain("Map");
      expect(emergNav).toContain("Alerts");
      expect(emergNav).toContain("Analytics");
      expect(emergNav).toContain("Settings");
    });
  });

  describe("Safety Constraints & Human-In-The-Loop Route Acceptance", () => {
    it("guarantees human-in-the-loop explicit acceptance and prevents autonomous redirection", async () => {
      const caller = appRouter.createCaller(driverContext);
      const res = await caller.operations.acceptRoute({
        vehicleId: "TRK-104",
        routeLabel: "Route B (NH-6 / NH-27 Bypass)",
        alternateRoute: "Guwahati → Shillong → Imphal (Route B)",
        distanceKm: 345,
        etaMinutes: 253,
        delayMinutes: 31,
        delayReason: "Detour around verified Jorhat bridge disruption",
      });

      expect(res.success).toBe(true);
      expect(res.vehicleId).toBe("TRK-104");
      expect(res.humanInTheLoopConfirmed).toBe(true);
      expect(res.automaticVehicleRedirect).toBe(false);
    });

    it("verifies A* route optimization calculates safety-aware bypass with explainability", () => {
      const routeResult = optimizeRoute("GUWAHATI", "IMPHAL");
      expect(routeResult.route.length).toBeGreaterThan(1);
      expect(routeResult.route[0]).toBe("GUWAHATI");
      expect(routeResult.route[routeResult.route.length - 1]).toBe("IMPHAL");
      expect(routeResult.distanceKm).toBeGreaterThan(0);
      expect(routeResult.etaMinutes).toBeGreaterThan(0);
      expect(routeResult.status).toBe("RECOMMENDED");
      expect(routeResult.reason).toBeDefined();
    });

    it("generates deterministic NO SAFE ROUTE AVAILABLE alert when corridors are severed", () => {
      const alert = buildNoSafeRouteAlert(
        "GUWAHATI – IMPHAL",
        "Severe flash flood and bridge disruption on all primary and bypass passes",
        "TRK-104",
        "SHP-001"
      );

      expect(alert.severity).toBe("CRITICAL");
      expect(alert.title).toContain("NO SAFE ROUTE AVAILABLE");
      expect(alert.corridor).toBe("GUWAHATI – IMPHAL");
      expect(alert.message).toContain("halt immediately");
    });
  });

  describe("Signup & Authentication Validation", () => {
    it("rejects signup with invalid email format", async () => {
      const caller = appRouter.createCaller(unauthedContext);
      await expect(
        caller.auth.signup({
          name: "Test Driver",
          email: "invalid-email-address",
          password: "password123",
          confirmPassword: "password123",
          requestedRole: "truck_driver",
        })
      ).rejects.toThrow();
    });

    it("rejects signup when password and confirm password do not match", async () => {
      const caller = appRouter.createCaller(unauthedContext);
      await expect(
        caller.auth.signup({
          name: "Test Driver",
          email: "driver.new@ner-logiai.gov.in",
          password: "password123",
          confirmPassword: "differentPassword456",
          requestedRole: "truck_driver",
        })
      ).rejects.toThrow();
    });

    it("successfully creates account and returns assigned operational role", async () => {
      const caller = appRouter.createCaller(unauthedContext);
      const uniqueEmail = `officer_${Date.now()}@ner-logiai.gov.in`;
      const res = await caller.auth.signup({
        name: "Field Officer Sunita",
        email: uniqueEmail,
        password: "securePassword123",
        confirmPassword: "securePassword123",
        organization: "Assam Disaster Management Authority",
        requestedRole: "field_officer",
      });

      expect(res.success).toBe(true);
      expect(res.user).toBeDefined();
      expect(res.user.email).toBe(uniqueEmail);
      expect(res.user.operationalRole).toBe("field_officer");
    });

    it("enforces server-side RBAC for privileged administrative actions", async () => {
      const driverCaller = appRouter.createCaller(driverContext);
      // Truck driver should not be able to execute admin-only audit clear or administrative overrides
      await expect(
        driverCaller.operations.clearAuditEvents()
      ).rejects.toThrow();
    });
  });
});
