// Phase 3 — profile + role provisioning in Firestore.
// Collections:
//   profiles/{uid}    -> { id, full_name, email, avatar_url, created_at, updated_at, last_login_at }
//   user_roles/{uid}  -> { user_id, roles: string[], created_at }
//   app_meta/bootstrap-> { claimed_by, claimed_at }  (marks the very first user as hr_admin)
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { firestore } from "./client";
import type { AppRole } from "./auth";

export type SignupAs = "candidate" | "recruiter" | "hr_admin";

/**
 * Idempotently creates the user's profile + role documents.
 * The very first account to sign in becomes `hr_admin`; everyone else gets
 * the role implied by the door they came through (`signupAs`).
 * Returns the user's roles.
 */
export async function ensureUserRecord(user: User, signupAs: SignupAs = "candidate"): Promise<AppRole[]> {
  const uid = user.uid;
  const email = (user.email ?? "").toLowerCase();
  const fullName = user.displayName ?? email.split("@")[0] ?? "";

  const profileRef = doc(firestore, "profiles", uid);
  const roleRef = doc(firestore, "user_roles", uid);
  const bootstrapRef = doc(firestore, "app_meta", "bootstrap");
  const candidateRef = doc(firestore, "candidates", uid);

  const roles = await runTransaction(firestore, async (tx) => {
    const [roleSnap, bootstrapSnap, profileSnap, candidateSnap] = await Promise.all([
      tx.get(roleRef),
      tx.get(bootstrapRef),
      tx.get(profileRef),
      tx.get(candidateRef),
    ]);

    let resolved: AppRole[];
    let roleNeedsWrite = false;
    if (roleSnap.exists() && Array.isArray(roleSnap.data().roles) && roleSnap.data().roles.length) {
      resolved = roleSnap.data().roles as AppRole[];
    } else {
      roleNeedsWrite = true;
      if (!bootstrapSnap.exists()) {
        resolved = ["hr_admin"];
        tx.set(bootstrapRef, { claimed_by: uid, claimed_at: serverTimestamp() });
      } else {
        resolved = [signupAs === "hr_admin" ? "hr_admin" : signupAs === "recruiter" ? "recruiter" : "candidate"];
      }
    }

    if (roleNeedsWrite) {
      tx.set(roleRef, { user_id: uid, roles: resolved, created_at: serverTimestamp() }, { merge: true });
    }

    if (resolved.includes("candidate") && !candidateSnap.exists()) {
      tx.set(candidateRef, {
        user_id: uid,
        full_name: profileSnap.exists() ? profileSnap.data().full_name || fullName : fullName,
        email,
        created_by: uid,
        source: "Auth provisioning",
        skills: [],
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }

    tx.set(
      profileRef,
      {
        id: uid,
        full_name: profileSnap.exists() ? profileSnap.data().full_name || fullName : fullName,
        email,
        avatar_url: user.photoURL ?? null,
        created_at: profileSnap.exists() ? profileSnap.data().created_at ?? serverTimestamp() : serverTimestamp(),
        updated_at: serverTimestamp(),
        last_login_at: serverTimestamp(),
      },
      { merge: true },
    );

    return resolved;
  });

  return roles;
}

/** Records a login timestamp without touching roles. */
export async function touchLastLogin(uid: string) {
  await setDoc(doc(firestore, "profiles", uid), { last_login_at: serverTimestamp() }, { merge: true });
}

export async function getProfile(uid: string) {
  const snap = await getDoc(doc(firestore, "profiles", uid));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

/** Admin-only: set a user's roles outright. Enforced by firestore.rules. */
export async function setUserRoles(uid: string, roles: AppRole[]) {
  await setDoc(doc(firestore, "user_roles", uid), { user_id: uid, roles }, { merge: true });
}
