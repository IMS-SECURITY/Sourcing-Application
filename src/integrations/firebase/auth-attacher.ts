import { createMiddleware } from "@tanstack/react-start";
import { getIdTokenSafe } from "./auth";

/**
 * Attaches the Firebase ID token to every server-function RPC.
 * Registered as a global `functionMiddleware` in `src/start.ts`.
 */
export const attachFirebaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = await getIdTokenSafe();
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
