export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Start Login for self-contained Demo Authentication:
 * Navigates to the local prototype Login / Signup view.
 */
export const startLogin = () => {
  if (typeof window !== "undefined") {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
};
