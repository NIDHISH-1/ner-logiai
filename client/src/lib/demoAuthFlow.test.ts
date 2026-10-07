import { describe, expect, it, beforeEach } from "vitest";

class LocalStorageMock {
  store: Record<string, string> = {};
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
  removeItem(key: string) { delete this.store[key]; }
  get length() { return Object.keys(this.store).length; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
}

if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage.clear) {
  (globalThis as any).localStorage = new LocalStorageMock();
}
if (typeof globalThis.sessionStorage === "undefined" || !globalThis.sessionStorage.clear) {
  (globalThis as any).sessionStorage = new LocalStorageMock();
}
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}

import {
  DEFAULT_DEMO_PERSONAS,
  getStoredDemoAccounts,
  registerDemoAccount,
  authenticateDemoCredentials,
  authenticateDemoPersona,
  getStoredDemoSession,
  clearStoredDemoSession,
  type OperationalRoleType,
} from "./demoAuth";

describe("NER-LogiAI Prototype Authentication Checklist Verification", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 1. Fresh Startup
  it("verifies fresh startup begins unauthenticated with seeded demo accounts", () => {
    const session = getStoredDemoSession();
    expect(session).toBeNull();

    const accounts = getStoredDemoAccounts();
    expect(accounts.length).toBeGreaterThanOrEqual(6);
    expect(accounts.map((a) => a.role)).toContain("admin");
    expect(accounts.map((a) => a.role)).toContain("field_officer");
    expect(accounts.map((a) => a.role)).toContain("truck_driver");
    expect(accounts.map((a) => a.role)).toContain("logistics_manager");
    expect(accounts.map((a) => a.role)).toContain("emergency_team");
    expect(accounts.map((a) => a.role)).toContain("viewer");
  });

  // 2. Signup
  it("verifies signup with Full Name, Email, Password, Confirm Password, Optional Organization, and Demo Role", () => {
    const signupData = {
      name: "Pranab Kumar",
      email: "pranab.ops@ner-logiai.gov.in",
      password: "secureDemoPassword123",
      organization: "Assam Highway Authority",
      requestedRole: "logistics_manager" as OperationalRoleType,
    };

    const { account, session } = registerDemoAccount(signupData);

    expect(account.name).toBe("Pranab Kumar");
    expect(account.email).toBe("pranab.ops@ner-logiai.gov.in");
    expect(account.organization).toBe("Assam Highway Authority");
    expect(account.role).toBe("logistics_manager");

    // Session is immediately created and active
    expect(session.user.name).toBe("Pranab Kumar");
    expect(session.user.operationalRole).toBe("logistics_manager");
    expect(session.user.organization).toBe("Assam Highway Authority");

    // Account is stored in local demo accounts
    const allAccounts = getStoredDemoAccounts();
    expect(allAccounts.some((a) => a.email === "pranab.ops@ner-logiai.gov.in")).toBe(true);
  });

  // 3. Login
  it("verifies login validates against locally stored demo accounts", () => {
    registerDemoAccount({
      name: "Captain Hazarika",
      email: "hazarika.convoy@ner-defense.gov.in",
      password: "convoyPass999",
      organization: "Border Roads Security",
      requestedRole: "truck_driver",
    });

    clearStoredDemoSession();
    expect(getStoredDemoSession()).toBeNull();

    // Valid credentials login
    const loginSuccess = authenticateDemoCredentials(
      "hazarika.convoy@ner-defense.gov.in",
      "convoyPass999"
    );
    expect(loginSuccess.session.user.name).toBe("Captain Hazarika");
    expect(loginSuccess.session.user.operationalRole).toBe("truck_driver");

    // Invalid credentials reject
    expect(() =>
      authenticateDemoCredentials("hazarika.convoy@ner-defense.gov.in", "wrongPass")
    ).toThrow("Invalid email or password");
  });

  // 4. Refresh
  it("verifies refresh preserves active login session in localStorage", () => {
    const { session } = registerDemoAccount({
      name: "Dr. Himanta",
      email: "himanta.relief@ner-health.org",
      password: "healthPass123",
      requestedRole: "emergency_team",
    });

    expect(session.user.name).toBe("Dr. Himanta");

    // Simulate page reload: reading from localStorage
    const restoredSession = getStoredDemoSession();
    expect(restoredSession).not.toBeNull();
    expect(restoredSession?.user.email).toBe("himanta.relief@ner-health.org");
    expect(restoredSession?.user.operationalRole).toBe("emergency_team");
  });

  // 5. Logout
  it("verifies logout clears demo authentication state locally", () => {
    authenticateDemoPersona("admin");
    expect(getStoredDemoSession()).not.toBeNull();

    clearStoredDemoSession();
    expect(getStoredDemoSession()).toBeNull();
  });

  // 6. Each role
  it("verifies demo authentication supports each of the 6 operational roles", () => {
    const roles: OperationalRoleType[] = [
      "admin",
      "field_officer",
      "truck_driver",
      "logistics_manager",
      "emergency_team",
      "viewer",
    ];

    roles.forEach((r) => {
      const res = authenticateDemoPersona(r);
      expect(res.account.role).toBe(r);
      expect(res.session.user.operationalRole).toBe(r);

      const active = getStoredDemoSession();
      expect(active?.user.operationalRole).toBe(r);

      clearStoredDemoSession();
    });
  });

  // 7. Unauthenticated dashboard access
  it("verifies unauthenticated users have no active session", () => {
    clearStoredDemoSession();
    const active = getStoredDemoSession();
    expect(active).toBeNull();
    // In App.tsx and Home.tsx, active === null triggers the Login / Signup screen
  });

  // TEST B: Sign in with valid primary demo credentials
  it("TEST B: Signs in with primary demo credentials (demo@nerlogiai.local / demo123)", () => {
    const res = authenticateDemoCredentials("demo@nerlogiai.local", "demo123");
    expect(res.session.user.email).toBe("demo@nerlogiai.local");
    expect(res.session.user.operationalRole).toBe("admin");
    expect(res.session.token).toBeDefined();

    const stored = getStoredDemoSession();
    expect(stored?.user.email).toBe("demo@nerlogiai.local");
    expect(stored?.user.operationalRole).toBe("admin");
  });

  // TEST C: Sign in with incorrect password
  it("TEST C: Rejects incorrect password and prevents session creation", () => {
    expect(() =>
      authenticateDemoCredentials("demo@nerlogiai.local", "wrongPassword!")
    ).toThrow("Invalid email or password");

    expect(getStoredDemoSession()).toBeNull();
  });

  // TEST D: Case-insensitive email and whitespace trimming
  it("TEST D: Trims email and matches case-insensitively", () => {
    const res = authenticateDemoCredentials("  DEMO@nerlogiai.local  ", "demo123");
    expect(res.session.user.email).toBe("demo@nerlogiai.local");
    expect(getStoredDemoSession()).not.toBeNull();
  });

  // TEST E: Rejects empty email or empty password
  it("TEST E: Rejects empty email or password with clear prompt message", () => {
    expect(() => authenticateDemoCredentials("", "demo123")).toThrow(
      "Please enter your email and password."
    );
    expect(() => authenticateDemoCredentials("demo@nerlogiai.local", "")).toThrow(
      "Please enter your email and password."
    );
  });

  // TEST H: Login separately as all 5 core operational roles
  it("TEST H: Authenticates all 5 core roles and verifies role assignment", () => {
    const roleChecks = [
      { role: "admin" as OperationalRoleType, expectedRole: "admin", name: "Government Admin" },
      { role: "truck_driver" as OperationalRoleType, expectedRole: "truck_driver", name: "Biren Gogoi" },
      { role: "logistics_manager" as OperationalRoleType, expectedRole: "logistics_manager", name: "Pooja Das" },
      { role: "field_officer" as OperationalRoleType, expectedRole: "field_officer", name: "Rajesh Bora" },
      { role: "emergency_team" as OperationalRoleType, expectedRole: "emergency_team", name: "Dr. L. Hmar" },
    ];

    roleChecks.forEach(({ role, expectedRole }) => {
      clearStoredDemoSession();
      const res = authenticateDemoPersona(role);
      expect(res.session.user.operationalRole).toBe(expectedRole);
      const session = getStoredDemoSession();
      expect(session?.user.operationalRole).toBe(expectedRole);
    });
  });
});
