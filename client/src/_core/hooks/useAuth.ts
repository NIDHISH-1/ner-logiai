import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authenticateDemoCredentials,
  authenticateDemoPersona,
  clearStoredDemoSession,
  getStoredDemoSession,
  registerDemoAccount,
  updateDemoSessionRole,
  type DemoSession,
  type OperationalRoleType,
} from "@/lib/demoAuth";
import { useAuthContext } from "@/contexts/AuthContext";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export type { OperationalRoleType };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/login" } = options ?? {};
  
  // Prefer centralized AuthContext when available
  const context = useAuthContext();

  // Standalone fallback if invoked outside of AuthProvider (e.g. in standalone tests)
  const [localSession, setLocalSession] = useState<DemoSession | null>(() => getStoredDemoSession());
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);

  useEffect(() => {
    if (context) return;
    const handleAuthChange = () => {
      setLocalSession(getStoredDemoSession());
    };
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("ner-logiai-auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("ner-logiai-auth-changed", handleAuthChange);
    };
  }, [context]);

  const fallbackSignup = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      organization?: string;
      requestedRole?: OperationalRoleType;
    }) => {
      if (params.password !== params.confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const role = params.requestedRole || "admin";
      const { session } = registerDemoAccount({
        name: params.name,
        email: params.email,
        password: params.password,
        organization: params.organization,
        requestedRole: role,
      });
      setLocalSession(session);
      return { success: true, user: session.user, token: session.token };
    },
    []
  );

  const fallbackLoginWithCredentials = useCallback(
    async (params: { email: string; password: string }) => {
      const { session } = authenticateDemoCredentials(params.email, params.password);
      setLocalSession(session);
      return { success: true, user: session.user, token: session.token };
    },
    []
  );

  const fallbackLogin = useCallback(
    async (params?: { role?: OperationalRoleType; name?: string; email?: string }) => {
      const targetRole = params?.role || "admin";
      const { session } = authenticateDemoPersona(targetRole, params?.name, params?.email);
      setLocalSession(session);
      return { success: true, user: session.user, token: session.token };
    },
    []
  );

  const fallbackLogout = useCallback(async () => {
    clearStoredDemoSession();
    setLocalSession(null);
  }, []);

  const fallbackSwitchRole = useCallback(async (newRole: OperationalRoleType) => {
    const updated = updateDemoSessionRole(newRole);
    if (updated) {
      setLocalSession(updated);
    }
  }, []);

  const fallbackRefresh = useCallback(() => {
    setLocalSession(getStoredDemoSession());
  }, []);

  const authData = useMemo(() => {
    if (context) {
      return context;
    }
    const activeUser = localSession?.user ?? null;
    return {
      user: activeUser,
      session: localSession,
      isAuthenticated: Boolean(activeUser),
      loading: localLoading,
      error: localError,
      loginWithCredentials: fallbackLoginWithCredentials,
      login: fallbackLogin,
      signup: fallbackSignup,
      logout: fallbackLogout,
      switchRole: fallbackSwitchRole,
      refresh: fallbackRefresh,
    };
  }, [
    context,
    localSession,
    localLoading,
    localError,
    fallbackLoginWithCredentials,
    fallbackLogin,
    fallbackSignup,
    fallbackLogout,
    fallbackSwitchRole,
    fallbackRefresh,
  ]);

  // Redirect handling if requested
  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (authData.loading) return;
    if (authData.isAuthenticated) return;
    if (typeof window === "undefined") return;

    if (redirectPath && window.location.pathname !== redirectPath) {
      window.location.href = redirectPath;
    }
  }, [redirectOnUnauthenticated, redirectPath, authData.loading, authData.isAuthenticated]);

  return authData;
}
