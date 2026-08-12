import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function projectId(): string {
  const id = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!id) throw new Error("Missing FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID");
  return id;
}

export type FirebaseClaims = JWTPayload & {
  email?: string;
  name?: string;
  user_id?: string;
};

/** Verifies a Firebase ID token (Worker-compatible: no firebase-admin needed). */
export async function verifyFirebaseIdToken(token: string): Promise<FirebaseClaims> {
  const id = projectId();
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${id}`,
    audience: id,
  });
  if (!payload.sub) throw new Error("Unauthorized: token has no subject");
  return payload as FirebaseClaims;
}

export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized: missing bearer token");

  const token = authHeader.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) throw new Error("Unauthorized: invalid token");

  let claims: FirebaseClaims;
  try {
    claims = await verifyFirebaseIdToken(token);
  } catch {
    throw new Error("Unauthorized: invalid token");
  }

  return next({ context: { userId: claims.sub as string, claims } });
});
