import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  getStoredDemoSession,
  setStoredDemoSession,
  clearStoredDemoSession,
  authenticateDemoCredentials,
  authenticateDemoPersona,
  registerDemoAccount,
  updateDemoSessionRole,
  type DemoSession,
  type OperationalRoleType,
} from "@/lib/demoAuth";

export type { OperationalRoleType };

export interface AuthContextType {
  user: DemoSession["user"] | null;
  session: DemoSession | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: Error | null;
  loginWithCredentials: (params: { email: string; password: string }) => Promise<{
    success: boolean;
    user: DemoSession["user"];
    token: string;
  }>;
  login: (params?: {
    role?: OperationalRoleType;
    name?: string;
    email?: string;
  }) => Promise<{
    success: boolean;
    user: DemoSession["user"];
    token: string;
  }>;
  signup: (params: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    organization?: string;
    requestedRole?: OperationalRoleType;
  }) => Promise<{
    success: boolean;
    user: DemoSession["user"];
    token: string;
  }>;
  logout: () => Promise<void>;
  switchRole: (newRole: OperationalRoleType) => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronous session initialization directly from localStorage
  const [session, setSession] = useState<DemoSession | null>(() => getStoredDemoSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Cross-component and cross-tab listener for auth state updates
  useEffect(() => {
    const handleAuthChange = () => {
      const current = getStoredDemoSession();
      setSession(current);
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("ner-logiai-auth-changed", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("ner-logiai-auth-changed", handleAuthChange);
    };
  }, []);

  const loginWithCredentials = useCallback(async (params: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      const { session: newSession } = authenticateDemoCredentials(params.email, params.password);
      // Synchronous React state update guarantees immediate root re-render
      setSession(newSession);
      return { success: true, user: newSession.user, token: newSession.token };
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (params?: { role?: OperationalRoleType; name?: string; email?: string }) => {
    setError(null);
    setLoading(true);
    try {
      const targetRole = params?.role || "admin";
      const { session: newSession } = authenticateDemoPersona(targetRole, params?.name, params?.email);
      setSession(newSession);
      return { success: true, user: newSession.user, token: newSession.token };
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (params: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    organization?: string;
    requestedRole?: OperationalRoleType;
  }) => {
    setError(null);
    setLoading(true);
    try {
      if (params.password !== params.confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const role = params.requestedRole || "admin";
      const { session: newSession } = registerDemoAccount({
        name: params.name,
        email: params.email,
        password: params.password,
        organization: params.organization,
        requestedRole: role,
      });
      setSession(newSession);
      return { success: true, user: newSession.user, token: newSession.token };
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    clearStoredDemoSession();
    setSession(null);
  }, []);

  const switchRole = useCallback(async (newRole: OperationalRoleType) => {
    const updated = updateDemoSessionRole(newRole);
    if (updated) {
      setSession(updated);
    }
  }, []);

  const refresh = useCallback(() => {
    const current = getStoredDemoSession();
    setSession(current);
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const activeUser = session?.user ?? null;
    return {
      user: activeUser,
      session,
      isAuthenticated: Boolean(activeUser),
      loading,
      error,
      loginWithCredentials,
      login,
      signup,
      logout,
      switchRole,
      refresh,
    };
  }, [session, loading, error, loginWithCredentials, login, signup, logout, switchRole, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  return context;
}
