// Firebase auth helpers (Phase 2). Browser-only.
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore, googleProvider } from "./client";

import { type AppRole } from "./schema";
export type { AppRole };

/** Resolves once Firebase has restored (or rejected) the persisted session. */
export function waitForFirebaseUser(): Promise<User | null> {
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      unsub();
      resolve(u);
    });
  });
}

export async function getIdTokenSafe(): Promise<string | null> {
  try {
    const user = await waitForFirebaseUser();
    return user ? await user.getIdToken() : null;
  } catch {
    return null;
  }
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password);
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password);
  if (fullName) await updateProfile(cred.user, { displayName: fullName });
  return cred;
}

export async function signInWithGoogle() {
  return signInWithPopup(firebaseAuth, googleProvider);
}

export async function firebaseSignOut() {
  await signOut(firebaseAuth);
}

/**
 * Roles live in Firestore at `user_roles/{uid}` as `{ roles: string[] }`.
 * The collection is populated in Phase 3; missing docs simply mean "no roles yet".
 */
export async function getUserRoles(uid: string): Promise<AppRole[]> {
  try {
    const snap = await getDoc(doc(firestore, "user_roles", uid));
    const roles = snap.exists() ? (snap.data().roles as string[] | undefined) : undefined;
    return (roles ?? []) as AppRole[];
  } catch {
    return [];
  }
}

export async function hasRole(uid: string, role: AppRole): Promise<boolean> {
  return (await getUserRoles(uid)).includes(role);
}
