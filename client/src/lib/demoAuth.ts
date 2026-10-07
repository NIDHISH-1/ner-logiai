/**
 * =============================================================================
 * NER-LogiAI — DEMO AUTHENTICATION / PROTOTYPE AUTHENTICATION MODULE
 * =============================================================================
 *
 * PROTOTYPE / DEMO AUTHENTICATION:
 * This module implements lightweight, self-contained demo authentication for the
 * Smart India Hackathon (SIH) prototype.
 *
 * KEY ATTRIBUTES:
 * 1. Self-contained & Local: Stored in localStorage. Does NOT require DATABASE_URL,
 *    MySQL, PostgreSQL, Firebase, Supabase, Clerk, Auth0, or external OAuth.
 * 2. Pre-seeded evaluation personas: Standard accounts for all 6 operational roles
 *    are pre-seeded with default credentials (password: demo123) for rapid evaluation.
 * 3. Local account validation: Signup registers new accounts into local demo storage;
 *    Login validates credentials directly against this local store.
 * 4. Persistent session: Stored in localStorage, surviving browser refresh.
 * 5. Clean separation: Operational data & RBAC capabilities remain untouched while
 *    authentication state is reliably self-contained.
 *
 * SECURITY NOTE:
 * This is prototype/demo authentication for demonstration and evaluation purposes,
 * not production-grade password security.
 * =============================================================================
 */

export type OperationalRoleType =
  | "admin"
  | "field_officer"
  | "truck_driver"
  | "logistics_manager"
  | "emergency_team"
  | "viewer";

export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  password: string; // Plaintext or demo hash for prototype validation
  organization?: string;
  role: OperationalRoleType;
  authRole: "admin" | "user";
  createdAt: string;
}

export interface DemoUser {
  id: number | string;
  openId: string;
  name: string;
  email: string;
  role: "admin" | "user";
  operationalRole: OperationalRoleType;
  organization?: string;
  loginMethod: string;
}

export interface DemoSession {
  user: DemoUser;
  token: string;
  signedInAt: string;
}

export const DEMO_AUTH_SECURITY_NOTICE =
  "Prototype / Demo Authentication: Designed for SIH evaluation. Operates independently of DATABASE_URL or external auth providers. Not production-grade password security.";

export const STORAGE_KEYS = {
  USERS: "ner-logiai-demo-users",
  SESSION: "ner-logiai-auth-session",
  // Legacy keys for backwards compatibility with existing cached data
  LEGACY_USERS: "ner_logiai_demo_accounts_v2",
  LEGACY_SESSION: "ner_logiai_demo_session_v2",
} as const;

/**
 * Pre-seeded personas for instant evaluation.
 * Primary SIH evaluation demo account:
 * Email: demo@nerlogiai.local
 * Password: demo123
 * Role: Government Admin
 */
export const DEFAULT_DEMO_PERSONAS: DemoAccount[] = [
  {
    id: "demo_admin_primary",
    name: "Government Admin",
    email: "demo@nerlogiai.local",
    password: "demo123",
    organization: "State Disaster Management Authority / District Administration",
    role: "admin",
    authRole: "admin",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "demo_admin_aditi",
    name: "Aditi Sharma",
    email: "aditi.admin@ner-logiai.gov.in",
    password: "demo123",
    organization: "State Disaster Management Authority / District Administration",
    role: "admin",
    authRole: "admin",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "demo_field_rajesh",
    name: "Rajesh Bora",
    email: "rajesh.field@ner-logiai.gov.in",
    password: "demo123",
    organization: "NER Field Command & Ground Verification Unit",
    role: "field_officer",
    authRole: "user",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "demo_driver_biren",
    name: "Biren Gogoi",
    email: "biren.driver@assamtransport.in",
    password: "demo123",
    organization: "Assam Freight Logistics (TRK-104 Corridor Fleet)",
    role: "truck_driver",
    authRole: "user",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "demo_logistics_pooja",
    name: "Pooja Das",
    email: "pooja.logistics@ner-logiai.gov.in",
    password: "demo123",
    organization: "NER Regional Logistics Operations Hub",
    role: "logistics_manager",
    authRole: "user",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "demo_ert_hmar",
    name: "Dr. L. Hmar",
    email: "ert.lead@disastermgmt.ner.gov.in",
    password: "demo123",
    organization: "Disaster Emergency Quick Response Team",
    role: "emergency_team",
    authRole: "user",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "demo_viewer_auditor",
    name: "Observer / Auditor",
    email: "viewer@ner-logiai.org",
    password: "demo123",
    organization: "Public Safety & Corridor Audit Observer",
    role: "viewer",
    authRole: "user",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
];

/**
 * Normalizes operational role string (supports both uppercase and lowercase enum formats)
 * Examples:
 * GOVERNMENT_ADMIN -> admin
 * TRUCK_DRIVER -> truck_driver
 * LOGISTICS_MANAGER -> logistics_manager
 * FIELD_OFFICER -> field_officer
 * EMERGENCY_RESPONSE_TEAM -> emergency_team
 */
export function normalizeOperationalRole(rawRole?: string): OperationalRoleType {
  if (!rawRole) return "admin";
  const normalized = rawRole.trim().toLowerCase();
  if (normalized === "government_admin" || normalized === "admin") return "admin";
  if (normalized === "truck_driver") return "truck_driver";
  if (normalized === "logistics_manager") return "logistics_manager";
  if (normalized === "field_officer") return "field_officer";
  if (normalized === "emergency_response_team" || normalized === "emergency_team") return "emergency_team";
  if (normalized === "viewer") return "viewer";
  return "admin";
}

/**
 * Maps operational role to its uppercase enum representation.
 */
export function getRoleEnumString(role: OperationalRoleType): string {
  switch (role) {
    case "admin": return "GOVERNMENT_ADMIN";
    case "truck_driver": return "TRUCK_DRIVER";
    case "logistics_manager": return "LOGISTICS_MANAGER";
    case "field_officer": return "FIELD_OFFICER";
    case "emergency_team": return "EMERGENCY_RESPONSE_TEAM";
    case "viewer": return "VIEWER";
    default: return "GOVERNMENT_ADMIN";
  }
}

/**
 * Retrieves all stored demo accounts from localStorage.
 * Seeds default personas if local storage is empty.
 */
export function getStoredDemoAccounts(): DemoAccount[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_DEMO_PERSONAS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS) || localStorage.getItem(STORAGE_KEYS.LEGACY_USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_DEMO_PERSONAS));
      localStorage.setItem(STORAGE_KEYS.LEGACY_USERS, JSON.stringify(DEFAULT_DEMO_PERSONAS));
      return DEFAULT_DEMO_PERSONAS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure the primary demo account demo@nerlogiai.local is always present
      const hasDemoAccount = parsed.some((a) => a.email.toLowerCase() === "demo@nerlogiai.local");
      if (!hasDemoAccount) {
        parsed.unshift(DEFAULT_DEMO_PERSONAS[0]);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
        localStorage.setItem(STORAGE_KEYS.LEGACY_USERS, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (err) {
    console.warn("[DemoAuth] Failed to parse local demo accounts, reseeding defaults:", err);
  }

  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_DEMO_PERSONAS));
    localStorage.setItem(STORAGE_KEYS.LEGACY_USERS, JSON.stringify(DEFAULT_DEMO_PERSONAS));
  } catch {}
  return DEFAULT_DEMO_PERSONAS;
}

/**
 * Saves a new demo account locally and creates an active demo session.
 */
export function registerDemoAccount(input: {
  name: string;
  email: string;
  password: string;
  organization?: string;
  requestedRole: OperationalRoleType;
}): { account: DemoAccount; session: DemoSession } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const organization = input.organization?.trim() || undefined;
  const role = input.requestedRole;

  if (!name || name.length < 2) {
    throw new Error("Full name must be at least 2 characters.");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const existingAccounts = getStoredDemoAccounts();
  const alreadyExists = existingAccounts.some((acc) => acc.email.trim().toLowerCase() === email);
  if (alreadyExists) {
    throw new Error("An account with this email already exists.");
  }

  const newAccount: DemoAccount = {
    id: `demo_usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    email,
    password,
    organization,
    role,
    authRole: role === "admin" ? "admin" : "user",
    createdAt: new Date().toISOString(),
  };

  const updatedAccounts = [...existingAccounts, newAccount];
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedAccounts));
    localStorage.setItem(STORAGE_KEYS.LEGACY_USERS, JSON.stringify(updatedAccounts));
  } catch (err) {
    console.warn("[DemoAuth] Could not write accounts to localStorage:", err);
  }

  const session = createSessionFromAccount(newAccount);
  setStoredDemoSession(session);

  return { account: newAccount, session };
}

/**
 * Validates credentials against locally stored demo accounts.
 */
export function authenticateDemoCredentials(
  emailInput: string,
  passwordInput: string
): { account: DemoAccount; session: DemoSession } {
  if (!emailInput || !emailInput.trim() || !passwordInput) {
    throw new Error("Please enter your email and password.");
  }

  const normalizedEmail = emailInput.trim().toLowerCase();
  const accounts = getStoredDemoAccounts();

  const account = accounts.find((acc) => acc.email.trim().toLowerCase() === normalizedEmail);
  if (!account || account.password !== passwordInput) {
    throw new Error("Invalid email or password.");
  }

  const session = createSessionFromAccount(account);
  setStoredDemoSession(session);
  return { account, session };
}

/**
 * Authenticates using a 1-click evaluation persona.
 */
export function authenticateDemoPersona(
  role: OperationalRoleType,
  name?: string,
  email?: string
): { account: DemoAccount; session: DemoSession } {
  const accounts = getStoredDemoAccounts();
  let account = accounts.find((acc) => acc.role === role);

  if (!account) {
    account = DEFAULT_DEMO_PERSONAS.find((p) => p.role === role) || DEFAULT_DEMO_PERSONAS[0];
  }

  if (name || email) {
    account = {
      ...account,
      name: name || account.name,
      email: email || account.email,
    };
  }

  const session = createSessionFromAccount(account);
  setStoredDemoSession(session);
  return { account, session };
}

/**
 * Helper to build a session object from an account.
 */
function createSessionFromAccount(account: DemoAccount): DemoSession {
  const token = `demo_token_${account.role}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    user: {
      id: account.id,
      openId: account.id,
      name: account.name,
      email: account.email,
      role: account.authRole,
      operationalRole: account.role,
      organization: account.organization,
      loginMethod: "demo_local_auth",
    },
    token,
    signedInAt: new Date().toISOString(),
  };
}

/**
 * Retrieves the currently active demo session from localStorage.
 */
export function getStoredDemoSession(): DemoSession | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem(STORAGE_KEYS.LEGACY_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSession;
    if (parsed && parsed.user && parsed.user.email && parsed.user.operationalRole) {
      return parsed;
    }
  } catch (err) {
    console.warn("[DemoAuth] Failed to parse active session from localStorage:", err);
  }
  return null;
}

/**
 * Sets the active demo session into localStorage.
 */
export function setStoredDemoSession(session: DemoSession): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEYS.LEGACY_SESSION, JSON.stringify(session));
    localStorage.setItem("auth-user-info", JSON.stringify(session.user));
    localStorage.setItem("manus-runtime-user-info", JSON.stringify(session.user));
    sessionStorage.setItem("auth-token", session.token);

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("ner-logiai-auth-changed", { detail: session }));
    }
  } catch (err) {
    console.warn("[DemoAuth] Could not write session to localStorage:", err);
  }
}

/**
 * Clears the active demo session from localStorage and sessionStorage.
 */
export function clearStoredDemoSession(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION);
    localStorage.removeItem("auth-user-info");
    localStorage.removeItem("manus-runtime-user-info");
    sessionStorage.removeItem("auth-token");
    sessionStorage.removeItem("manus-cookie");

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("ner-logiai-auth-changed", { detail: null }));
    }
  } catch (err) {
    console.warn("[DemoAuth] Error clearing session storage:", err);
  }
}

/**
 * Updates the operational role for the active demo session in localStorage.
 */
export function updateDemoSessionRole(newRole: OperationalRoleType): DemoSession | null {
  const current = getStoredDemoSession();
  if (!current) return null;

  const updated: DemoSession = {
    ...current,
    user: {
      ...current.user,
      operationalRole: newRole,
      role: newRole === "admin" ? "admin" : "user",
    },
    signedInAt: new Date().toISOString(),
  };

  setStoredDemoSession(updated);
  return updated;
}
