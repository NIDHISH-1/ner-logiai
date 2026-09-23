import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateRouteSafety } from "./safetyEngine";
import type { RiskPrediction } from "./riskEngine";

const mocks = vi.hoisted(() => ({ appendAuditEvent: vi.fn() }));
vi.mock("./db", () => ({ appendAuditEvent: mocks.appendAuditEvent }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const prediction = (overrides: Partial<RiskPrediction> = {}): RiskPrediction => ({
  model: "synthetic-random-forest-v1",
  dataLabel: "SIMULATED / PROTOTYPE DATA",
  probability: 18,
  riskLevel: "LOW",
  confidence: 88,
  freshness: "FRESH",
  missingFeatures: [],
  contributingFactors: ["Stable road conditions"],
  features: {} as RiskPrediction["features"],
  advisory: "AI prediction — requires route safety validation.",
  ...overrides,
});

const context = (role: "user" | "admin", operationalRole: "admin" | "truck_driver") => ({
  user: { id: 9, openId: "safety-user", email: "safety@example.com", name: "Safety User", loginMethod: "demo", role, operationalRole, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
}) satisfies TrpcContext;

beforeEach(() => vi.clearAllMocks());

describe("route safety validation", () => {
  it("rejects a verified road blockage", () => {
    expect(validateRouteSafety({ roadAccessibility: "blocked", incidents: [{ type: "Road Blockage", status: "VERIFIED" }], prediction: prediction() }).status).toBe("REJECTED");
  });

  it("rejects verified bridge damage and critical incidents", () => {
    expect(validateRouteSafety({ roadAccessibility: "restricted", incidents: [{ type: "Bridge Damage", status: "VERIFIED" }], prediction: prediction() }).status).toBe("REJECTED");
    expect(validateRouteSafety({ roadAccessibility: "accessible", incidents: [{ type: "Traffic", severity: "CRITICAL", status: "VERIFIED" }], prediction: prediction() }).status).toBe("REJECTED");
  });

  it("returns caution for high ML risk and unresolved incidents", () => {
    const result = validateRouteSafety({ roadAccessibility: "accessible", incidents: [{ type: "Traffic", status: "UNDER_REVIEW" }], prediction: prediction({ probability: 82, riskLevel: "HIGH" }) });
    expect(result.status).toBe("CAUTION");
    expect(result.reasons.join(" ")).toContain("ML risk");
    expect(result.reasons.join(" ")).toContain("Unresolved");
  });

  it("returns safe only for accessible roads with fresh, sufficient data", () => {
    const result = validateRouteSafety({ roadAccessibility: "accessible", incidents: [], prediction: prediction() });
    expect(result.status).toBe("SAFE");
    expect(result.dataFreshness).toBe("FRESH");
  });

  it("never treats stale or missing safety data as safe", () => {
    expect(validateRouteSafety({ roadAccessibility: "accessible", incidents: [], prediction: prediction({ freshness: "STALE" }) }).status).toBe("CAUTION");
    expect(validateRouteSafety({ roadAccessibility: undefined, incidents: [], prediction: undefined }).status).toBe("CAUTION");
  });
});

describe("safety overrides", () => {
  it("denies a driver override", async () => {
    await expect(appRouter.createCaller(context("user", "truck_driver")).operations.overrideSafety({ routeId: "NH-37-JORHAT", status: "SAFE", reason: "Driver request", timestamp: new Date() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.appendAuditEvent).not.toHaveBeenCalled();
  });

  it("allows and audits a Government Admin override with reason, timestamp, user, and role", async () => {
    mocks.appendAuditEvent.mockResolvedValue({ id: 22 });
    const timestamp = new Date("2026-09-08T14:00:00.000Z");
    const result = await appRouter.createCaller(context("admin", "admin")).operations.overrideSafety({ routeId: "NH-37-JORHAT", status: "CAUTION", reason: "District engineer confirmed temporary controlled access", timestamp });
    expect(result).toMatchObject({ routeId: "NH-37-JORHAT", status: "CAUTION", reason: "District engineer confirmed temporary controlled access", userId: 9, role: "admin", timestamp });
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "safety.override", entityType: "route", entityId: "NH-37-JORHAT", actorId: 9, details: expect.stringContaining("District engineer confirmed") }));
  });
});
