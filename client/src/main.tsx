import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import L from "leaflet";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

// Defensive patch for Leaflet to prevent "Cannot read properties of undefined (reading '_leaflet_pos')"
if (typeof window !== "undefined" && L && L.DomUtil) {
  const origGetPosition = L.DomUtil.getPosition;
  L.DomUtil.getPosition = function (el: HTMLElement) {
    if (!el) return new L.Point(0, 0);
    try {
      return origGetPosition ? origGetPosition.call(L.DomUtil, el) : ((el as any)._leaflet_pos || new L.Point(0, 0));
    } catch {
      return new L.Point(0, 0);
    }
  };
}

const queryClient = new QueryClient();

const isUnauthorizedError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = ((err as any)?.message || String(err)).toLowerCase();
  const code = (err as any)?.data?.code || (err as any)?.shape?.data?.code;
  return (
    code === "UNAUTHORIZED" ||
    msg.includes("10001") ||
    msg.includes(UNAUTHED_ERR_MSG.toLowerCase()) ||
    msg.includes("please login")
  );
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (typeof window === "undefined") return;
  if (!isUnauthorizedError(error)) return;
  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    if (isUnauthorizedError(error)) {
      redirectToLoginIfUnauthorized(error);
      return;
    }
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    if (isUnauthorizedError(error)) {
      redirectToLoginIfUnauthorized(error);
      return;
    }
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const directToken = sessionStorage.getItem("auth-token");
          if (directToken) {
            return { Authorization: `Bearer ${directToken}` };
          }
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// Register PWA service worker safely
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[SW] Registration skipped or failed:", err);
    });
  });
}
