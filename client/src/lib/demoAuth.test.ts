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
  setStoredDemoSession,
  clearStoredDemoSession,
  updateDemoSessionRole,
} from "./demoAuth";

describe("Self-Contained Local Demo Authentication", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("seeds default demo personas on fresh startup", () => {
    const accounts = getStoredDemoAccounts();
    expect(accounts).toHaveLength(DEFAULT_DEMO_PERSONAS.length);
    expect(accounts.map((a) => a.role)).toContain("admin");
    expect(accounts.map((a) => a.role)).toContain("field_officer");
    expect(accounts.map((a) => a.role)).toContain("truck_driver");
    expect(accounts.map((a) => a.role)).toContain("logistics_manager");
    expect(accounts.map((a) => a.role)).toContain("emergency_team");
    expect(accounts.map((a) => a.role)).toContain("viewer");
  });

  it("registers a new demo user with full validation", () => {
    const result = registerDemoAccount({
      name: "Tashi Dorji",
      email: "tashi.driver@ner-cargo.in",
      password: "password123",
      organization: "Himalayan Logistics Fleet",
      requestedRole: "truck_driver",
    });

    expect(result.account.name).toBe("Tashi Dorji");
    expect(result.account.email).toBe("tashi.driver@ner-cargo.in");
    expect(result.account.role).toBe("truck_driver");
    expect(result.account.organization).toBe("Himalayan Logistics Fleet");

    // Session is created and stored
    expect(result.session.user.name).toBe("Tashi Dorji");
    expect(result.session.user.operationalRole).toBe("truck_driver");

    const sessionInStorage = getStoredDemoSession();
    expect(sessionInStorage).not.toBeNull();
    expect(sessionInStorage?.user.email).toBe("tashi.driver@ner-cargo.in");
  });

  it("rejects duplicate email registrations in local storage", () => {
    registerDemoAccount({
      name: "First User",
      email: "duplicate@ner-demo.in",
      password: "password123",
      requestedRole: "field_officer",
    });

    expect(() =>
      registerDemoAccount({
        name: "Second User",
        email: "duplicate@ner-demo.in",
        password: "password456",
        requestedRole: "admin",
      })
    ).toThrow("already exists");
  });

  it("authenticates registered credentials successfully", () => {
    registerDemoAccount({
      name: "Debabrata Nath",
      email: "debabrata@disaster.assam.gov.in",
      password: "securepass123",
      requestedRole: "emergency_team",
    });

    // Clear active session to simulate logout
    clearStoredDemoSession();
    expect(getStoredDemoSession()).toBeNull();

    // Sign in with credentials
    const loginResult = authenticateDemoCredentials("debabrata@disaster.assam.gov.in", "securepass123");
    expect(loginResult.account.email).toBe("debabrata@disaster.assam.gov.in");
    expect(loginResult.session.user.operationalRole).toBe("emergency_team");

    // Persisted in storage
    const active = getStoredDemoSession();
    expect(active?.user.name).toBe("Debabrata Nath");
  });

  it("rejects incorrect passwords", () => {
    expect(() =>
      authenticateDemoCredentials("aditi.admin@ner-logiai.gov.in", "wrongpassword")
    ).toThrow("Invalid email or password");
  });

  it("authenticates instant evaluation personas and creates session", () => {
    const res = authenticateDemoPersona("field_officer");
    expect(res.account.role).toBe("field_officer");
    expect(res.session.user.operationalRole).toBe("field_officer");

    const session = getStoredDemoSession();
    expect(session?.user.operationalRole).toBe("field_officer");
  });

  it("survives refresh and preserves session in storage", () => {
    const res = authenticateDemoPersona("logistics_manager");
    expect(res.session.user.operationalRole).toBe("logistics_manager");

    // Simulate page reload by reading storage again
    const restored = getStoredDemoSession();
    expect(restored).not.toBeNull();
    expect(restored?.user.operationalRole).toBe("logistics_manager");
    expect(restored?.user.name).toBe("Pooja Das");
  });

  it("clears session on logout", () => {
    authenticateDemoPersona("admin");
    expect(getStoredDemoSession()).not.toBeNull();

    clearStoredDemoSession();
    expect(getStoredDemoSession()).toBeNull();
  });

  it("updates role dynamically within active session", () => {
    authenticateDemoPersona("viewer");
    expect(getStoredDemoSession()?.user.operationalRole).toBe("viewer");

    const updated = updateDemoSessionRole("admin");
    expect(updated?.user.operationalRole).toBe("admin");
    expect(getStoredDemoSession()?.user.operationalRole).toBe("admin");
  });
});
