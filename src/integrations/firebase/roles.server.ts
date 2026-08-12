// Server-side role check (Phase 3).
// Uses the Firestore REST API so it stays Cloudflare-Worker compatible
// (no firebase-admin). Reads are performed with the caller's verified ID token,
// so firestore.rules still apply.
import type { AppRole } from "./auth";

function projectId(): string {
  const id = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!id) throw new Error("Missing FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID");
  return id;
}

/** Reads `user_roles/{uid}` via the Firestore REST API with the caller's ID token. */
export async function getRolesServer(uid: string, idToken: string): Promise<AppRole[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/user_roles/${encodeURIComponent(uid)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Firestore role lookup failed (${res.status})`);
  const body = (await res.json()) as {
    fields?: { roles?: { arrayValue?: { values?: { stringValue?: string }[] } } };
  };
  return (body.fields?.roles?.arrayValue?.values ?? [])
    .map((v) => v.stringValue)
    .filter(Boolean) as AppRole[];
}

export async function requireRoleServer(uid: string, idToken: string, role: AppRole) {
  const roles = await getRolesServer(uid, idToken);
  if (!roles.includes(role)) throw new Error("Forbidden");
  return roles;
}
