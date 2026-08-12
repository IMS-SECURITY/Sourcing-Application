import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/integrations/firebase/auth-middleware";
import { z } from "zod";
import { COL } from "@/integrations/firebase/schema";
import {
  adminCreateUser,
  adminGetDoc,
  adminSetDoc,
  adminCreateDoc,
  adminDeleteDoc,
  adminRunQuery,
} from "@/integrations/firebase/admin.server";

const candidateSignupSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(128),
});

export const candidateSignUpFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => candidateSignupSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    // Create Firebase Auth user
    const { uid: userId } = await adminCreateUser({
      email,
      password: data.password,
      displayName: data.fullName,
    });

    // Create Profile doc
    await adminSetDoc(COL.profiles, userId, {
      id: userId,
      full_name: data.fullName,
      email,
    });

    // Create User Role doc
    await adminSetDoc(COL.userRoles, userId, {
      user_id: userId,
      roles: ["candidate"],
    });

    // Create/Update candidate record by ID (userId)
    await adminSetDoc(COL.candidates, userId, {
      full_name: data.fullName,
      email,
      user_id: userId,
      created_by: userId,
      source: "Candidate signup",
    });

    return { ok: true as const };
  });

const adminCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(["recruiter", "hr_admin"]),
  password: z.string().min(8).max(128),
});

export const adminCreateStaffUser = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d: unknown) => adminCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Ensure caller is hr_admin
    const callerRolesDoc = await adminGetDoc(COL.userRoles, userId);
    const callerRoles = callerRolesDoc?.roles ?? [];
    if (!callerRoles.includes("hr_admin")) throw new Error("Forbidden");

    const email = data.email.trim().toLowerCase();

    // Create staff user in Firebase Auth
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

    // Create/Set User Role doc
    await adminSetDoc(COL.userRoles, newId, {
      user_id: newId,
      roles: [data.role],
    });

    // Email credentials
    try {
      const { sendGmail } = await import("./gmail-mailer.server");
      await sendGmail({
        to: email,
        subject: "Your TalentFlow account",
        html: `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:40px 20px;">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Welcome to TalentFlow</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;">Hi ${escapeHtml(data.fullName)}, your ${data.role === "hr_admin" ? "HR admin" : "recruiter"} account is ready.</p>
    <div style="background:#f1f5f9;border-radius:8px;padding:16px;font-size:14px;color:#0f172a;">
      <div><b>Email:</b> ${escapeHtml(email)}</div>
      <div style="margin-top:6px;"><b>Temporary password:</b> <code style="font-family:'SF Mono',Menlo,monospace;">${escapeHtml(data.password)}</code></div>
    </div>
    <p style="margin:20px 0 0;color:#64748b;font-size:13px;">Sign in and change your password from your profile.</p>
  </div>
</div></body></html>`,
      });
    } catch (e) {
      // Non-fatal: account created, email failed
      return { ok: true as const, emailWarning: e instanceof Error ? e.message : String(e), userId: newId };
    }
    return { ok: true as const, userId: newId };
  });

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

