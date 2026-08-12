import { useEffect, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";
import { getUserRoles, type AppRole } from "@/integrations/firebase/auth";

export type { AppRole };

/** Minimal user shape kept compatible with the rest of the app (`user.id`, `user.email`). */
export type AppUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  firebaseUser: FirebaseUser;
};

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(
        u ? { id: u.uid, email: u.email, displayName: u.displayName, firebaseUser: u } : null,
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading, session: user ? { user } : null };
}

export function useRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getUserRoles(userId).then((r) => {
      if (cancelled) return;
      setRoles(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    roles,
    loading,
    hasRole: (r: AppRole) => roles.includes(r),
    isAdmin: roles.includes("hr_admin"),
  };
}
