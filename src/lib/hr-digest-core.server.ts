import { COL } from "@/integrations/firebase/schema";
import {
  adminGetDoc,
  adminCreateDoc,
  adminSetDoc,
  adminRunQuery,
} from "@/integrations/firebase/admin.server";

type VacancyRow = {
  id: string;
  role: string;
  status: string;
  vacancy_type: string;
  target_hiring_date: string | null;
  client: string | null;
};

function daysBetween(target: string): number {
  const t = new Date(target + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.ceil((t - now) / 86_400_000);
}

function renderHtml(name: string, items: (VacancyRow & { days: number })[], appUrl: string): string {
  const rows = items
    .map((v) => {
      const tone =
        v.days < 0 ? "#dc2626" : v.days <= 3 ? "#ea580c" : v.days <= 7 ? "#ca8a04" : "#16a34a";
      const label =
        v.days < 0 ? `${Math.abs(v.days)}d overdue` : v.days === 0 ? "Due today" : `${v.days}d left`;
      const date = v.target_hiring_date ?? "—";
      return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escape(v.role)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#475569;">${escape(v.client ?? "—")}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#475569;">${date}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${tone};font-weight:600;">${label}</td>
 </tr>`;
    })
    .join("");

  const overdue = items.filter((i) => i.days < 0).length;
  const dueSoon = items.filter((i) => i.days >= 0 && i.days <= 3).length;

  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <h1 style="margin:0 0 4px;font-size:20px;color:#0f172a;">TalentFlow daily digest</h1>
    <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Hi ${escape(name)} — here's where your open vacancies stand today.</p>
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
      <span style="background:#f1f5f9;padding:8px 12px;border-radius:8px;font-size:13px;color:#0f172a;"><b>${items.length}</b> open</span>
      <span style="background:#fff7ed;padding:8px 12px;border-radius:8px;font-size:13px;color:#9a3412;"><b>${dueSoon}</b> due in ≤3 days</span>
      <span style="background:#fef2f2;padding:8px 12px;border-radius:8px;font-size:13px;color:#991b1b;"><b>${overdue}</b> overdue</span>
    </div>
    ${
      items.length === 0
        ? `<p style="color:#64748b;font-size:14px;">No open vacancies with target dates. Enjoy the calm.</p>`
        : `<table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
        <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Role</th>
        <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Client</th>
        <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Target</th>
        <th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Status</th>
      </tr></thead><tbody>${rows}</tbody></table>`
    }
    <div style="margin-top:24px;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Open dashboard</a>
    </div>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">TalentFlow · automated daily reminder</p>
</div></body></html>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type DigestResult = { sent: number; skipped: number; failed: number; recipients: string[] };

export async function runHrDigest(opts?: { onlyUserId?: string }): Promise<DigestResult> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not configured");
  }
  const { sendGmail } = await import("./gmail-mailer.server");
  const appUrl = process.env.APP_URL ?? "https://project--7eb5077e-3247-4531-af55-f2c81a8a857e.lovable.app";

  // Recipients: hr_admin + recruiter
  let roles: any[] = [];
  if (opts?.onlyUserId) {
    const doc = await adminGetDoc(COL.userRoles, opts.onlyUserId);
    if (doc) {
      const rolesList = doc.roles ?? [];
      if (rolesList.includes("hr_admin") || rolesList.includes("recruiter")) {
        roles = [doc];
      }
    }
  } else {
    roles = await adminRunQuery(COL.userRoles, {
      where: {
        fieldFilter: {
          field: { fieldPath: "roles" },
          op: "ARRAY_CONTAINS_ANY",
          value: {
            arrayValue: {
              values: [
                { stringValue: "hr_admin" },
                { stringValue: "recruiter" },
              ],
            },
          },
        },
      },
    });
  }

  const userIds = Array.from(new Set(roles.map((r) => r.user_id)));
  if (userIds.length === 0) return { sent: 0, skipped: 0, failed: 0, recipients: [] };

  const profiles = (
    await Promise.all(userIds.map((uid) => adminGetDoc(COL.profiles, uid)))
  ).filter(Boolean);

  // Vacancies with target dates, open / in_progress
  const rawVacancies = await adminRunQuery(COL.vacancies, {
    where: {
      fieldFilter: {
        field: { fieldPath: "status" },
        op: "IN",
        value: {
          arrayValue: {
            values: [
              { stringValue: "open" },
              { stringValue: "in_progress" },
            ],
          },
        },
      },
    },
  });

  const vacancies = rawVacancies
    .filter((v) => v.target_hiring_date)
    .sort((a, b) => {
      const ad = a.target_hiring_date || "";
      const bd = b.target_hiring_date || "";
      return ad.localeCompare(bd);
    });

  const items = vacancies.map((v) => {
    return {
      id: v.id,
      role: v.role,
      status: v.status,
      vacancy_type: v.vacancy_type,
      target_hiring_date: v.target_hiring_date,
      client: v.client_name ?? null,
      days: daysBetween(v.target_hiring_date!),
    };
  });

  let sent = 0,
    skipped = 0,
    failed = 0;
  const recipients: string[] = [];

  for (const p of profiles) {
    if (!p.email) {
      skipped++;
      continue;
    }
    const html = renderHtml(p.full_name ?? "there", items, appUrl);
    const subject = `TalentFlow digest · ${items.length} open · ${items.filter((i) => i.days < 0).length} overdue`;

    const logId = await adminCreateDoc(COL.emailSendLog, {
      template: "hr_daily_digest",
      recipient_email: p.email,
      recipient_user_id: p.id,
      status: "pending",
      metadata: { vacancy_count: items.length },
    });

    try {
      const { messageId } = await sendGmail({
        to: p.email,
        subject,
        html,
      });
      sent++;
      recipients.push(p.email);
      await adminSetDoc(COL.emailSendLog, logId, {
        status: "sent",
        provider_message_id: messageId ?? null,
      });
    } catch (e) {
      failed++;
      await adminSetDoc(COL.emailSendLog, logId, {
        status: "failed",
        error_message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { sent, skipped, failed, recipients };
}

