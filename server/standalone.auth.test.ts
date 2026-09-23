import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createMockContext(user?: TrpcContext["user"]): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: user ?? null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, cookies };
}

describe("Standalone Prototype Authentication & RBAC", () => {
  it("provides available RBAC personas for quick login", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const personas = await caller.auth.personas();

    expect(personas).toHaveLength(6);
    const roles = personas.map(p => p.role);
    expect(roles).toContain("admin");
    expect(roles).toContain("field_officer");
    expect(roles).toContain("truck_driver");
    expect(roles).toContain("logistics_manager");
    expect(roles).toContain("emergency_team");
    expect(roles).toContain("viewer");
  });

  it("authenticates as Field Officer, mints standalone session and sets cookie", async () => {
    const { ctx, cookies } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      role: "field_officer",
      name: "Rajesh Bora",
      email: "rajesh.field@ner-logiai.gov.in",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.user.operationalRole).toBe("field_officer");
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe(COOKIE_NAME);
    expect(cookies[0].value).toBe(result.token);
  });

  it("authenticates as Administrator with elevated privileges", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      role: "admin",
      name: "Aditi Sharma",
    });

    expect(result.success).toBe(true);
    expect(result.user.role).toBe("admin");
    expect(result.user.operationalRole).toBe("admin");

    // Test access endpoint with this user
    const { ctx: adminCtx } = createMockContext(result.user as any);
    const adminCaller = appRouter.createCaller(adminCtx);
    const access = await adminCaller.access.current();

    expect(access.operationalRole).toBe("admin");
    expect(access.capabilities.reviewIncident).toBe(true);
    expect(access.capabilities.viewAudit).toBe(true);
    expect(access.capabilities.createIncident).toBe(true);
  });

  it("switches operational role smoothly without re-login", async () => {
    const initialUser = {
      id: 99,
      openId: "test-user-99",
      email: "operator@ner-logiai.gov.in",
      name: "Test Operator",
      loginMethod: "standalone",
      role: "user" as const,
      operationalRole: "field_officer" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const { ctx } = createMockContext(initialUser);
    const caller = appRouter.createCaller(ctx);

    const switchResult = await caller.auth.switchRole({ role: "truck_driver" });
    expect(switchResult.success).toBe(true);
    expect(switchResult.operationalRole).toBe("truck_driver");

    const access = await caller.access.current();
    expect(access.operationalRole).toBe("truck_driver");
    expect(access.capabilities.createIncident).toBe(true);
    expect(access.capabilities.reviewIncident).toBe(false);
  });
});
