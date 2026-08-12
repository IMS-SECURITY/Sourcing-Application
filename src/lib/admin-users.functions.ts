import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/integrations/firebase/auth-middleware";
import { z } from "zod";
import { COL } from "@/integrations/firebase/schema";
import {
  adminCreateUser,
  adminGetDoc,
  adminSetDoc,
  adminDeleteDoc,
  adminListDocs,
  adminDeleteUser,
  adminCreateDoc,
  adminRunQuery,
} from "@/integrations/firebase/admin.server";

// Helper to check super_admin role on the server
async function ensureSuperAdmin(userId: string) {
  const userRolesDoc = await adminGetDoc(COL.userRoles, userId);
  const roles = userRolesDoc?.roles ?? [];
  if (!roles.includes("super_admin")) {
    throw new Error("Forbidden: Requires super_admin role");
  }
}

// 1. List all users (profiles + roles)
export const listAllUsersFn = createServerFn({ method: "GET" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context.userId);

    const [profiles, roles] = await Promise.all([
      adminListDocs(COL.profiles),
      adminListDocs(COL.userRoles),
    ]);

    // Merge profiles and roles by userId
    const rolesMap = new Map<string, string[]>();
    for (const r of roles) {
      if (r.user_id) {
        rolesMap.set(r.user_id, r.roles || []);
      }
    }

    return profiles.map((p) => ({
      ...p,
      roles: rolesMap.get(p.id) || [],
    }));
  });

// 2. Create any user (Staff or Candidate)
const createAnyUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
});

export const adminCreateAnyUserFn = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d: unknown) => createAnyUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.userId);

    const email = data.email.trim().toLowerCase();

    // Create Firebase Auth user
    const { uid: newId } = await adminCreateUser({
      email,
      password: data.password,
      displayName: data.fullName,
    });

    // Create Profile doc
    await adminSetDoc(COL.profiles, newId, {
      id: newId,
      full_name: data.fullName,
      email,
    });

    // Create User Roles doc
    await adminSetDoc(COL.userRoles, newId, {
      user_id: newId,
      roles: data.roles,
    });

    // If candidate role, create candidate doc in candidates collection
    if (data.roles.includes("candidate")) {
      await adminSetDoc(COL.candidates, newId, {
        full_name: data.fullName,
        email,
        user_id: newId,
        created_by: context.userId,
        source: "Superadmin created",
      });
    }

    return { ok: true as const, userId: newId };
  });

// 3. Edit roles of a user
const updateRolesSchema = z.object({
  targetUserId: z.string(),
  roles: z.array(z.string()).min(1),
});

export const adminUpdateUserRolesFn = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d: unknown) => updateRolesSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.userId);

    // Update User Roles doc
    await adminSetDoc(COL.userRoles, data.targetUserId, {
      user_id: data.targetUserId,
      roles: data.roles,
    });

    return { ok: true as const };
  });

// 4. Delete user
const deleteUserSchema = z.object({
  targetUserId: z.string(),
});

export const adminDeleteUserFn = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d: unknown) => deleteUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.userId);

    // Delete Auth User
    await adminDeleteUser(data.targetUserId);

    // Delete Firestore profile + roles
    await adminDeleteDoc(COL.profiles, data.targetUserId);
    await adminDeleteDoc(COL.userRoles, data.targetUserId);

    return { ok: true as const };
  });
