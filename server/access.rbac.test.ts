import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = NonNullable<NonNullable<TrpcContext["user"]>["operationalRole"]>;

function context(role: Role, authRole: "user" | "admin" = "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 42,
      openId: "rbac-test-user",
      email: "rbac@example.com",
      name: "RBAC Test",
      loginMethod: "test",
      role: authRole,
      operationalRole: role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Phase 2 RBAC", () => {
  it("exposes capabilities for a field officer", async () => {
    const result = await appRouter.createCaller(context("field_officer")).access.current();
    expect(result.operationalRole).toBe("field_officer");
    expect(result.capabilities.createIncident).toBe(true);
    expect(result.capabilities.reviewIncident).toBe(false);
    expect(result.capabilities.viewAudit).toBe(false);
  });

  it("denies incident review to a truck driver before touching persistence", async () => {
    const caller = appRouter.createCaller(context("truck_driver"));
    await expect(caller.operations.reviewIncident({ id: "INC-TEST", status: "VERIFIED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows the admin auth role to access audit capabilities", async () => {
    const result = await appRouter.createCaller(context("viewer", "admin")).access.current();
    expect(result.capabilities.reviewIncident).toBe(true);
    expect(result.capabilities.viewAudit).toBe(true);
  });
});
