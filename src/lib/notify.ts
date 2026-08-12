import { createDocIn, getDocById } from "@/integrations/firebase/db";
import { createServerFn } from "@tanstack/react-start";
import { COL } from "@/integrations/firebase/schema";

export type NotifyTemplate = "interview_scheduled" | "interview_cancelled" | "application_rejected" | "application_stage_changed" | "candidate_created";

// Server function running only on the backend (free SMTP sending)
export const sendNotificationEmailFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { template: NotifyTemplate; recipientEmail: string; payload: Record<string, unknown> })
  .handler(async ({ data }) => {
    try {
      const { sendGmail } = await import("./gmail-mailer.server");
      
      let subject = "TalentFlow Notification";
      let html = "";

      const p = data.payload || {};

      if (data.template === "interview_scheduled") {
        subject = `Interview Scheduled: ${p.vacancyRole || "Vacancy"}`;
        html = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0284c7;">Interview Scheduled</h2>
            <p>Your interview for the position of <strong>${p.vacancyRole || "Vacancy"}</strong> has been scheduled.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>Round:</strong> ${p.round || "Technical Round"}</p>
            <p><strong>Date & Time:</strong> ${p.scheduledAt ? new Date(String(p.scheduledAt)).toLocaleString() : "TBD"}</p>
            <p><strong>Duration:</strong> ${p.duration || "45"} minutes</p>
            <p style="margin-top: 25px;">
              <a href="${p.roomUrl || "#"}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Video Room</a>
            </p>
          </div>
        `;
      } else if (data.template === "interview_cancelled") {
        subject = `Interview Cancelled: ${p.vacancyRole || "Vacancy"}`;
        html = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #dc2626;">Interview Cancelled</h2>
            <p>Your scheduled interview for the position of <strong>${p.vacancyRole || "Vacancy"}</strong> has been cancelled.</p>
          </div>
        `;
      } else if (data.template === "application_rejected") {
        subject = `Application Update: ${p.vacancyRole || "Vacancy"}`;
        html = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Application Update</h2>
            <p>Thank you for your interest in the <strong>${p.vacancyRole || "Vacancy"}</strong> role. Unfortunately, we will not be moving forward with your application at this time.</p>
          </div>
        `;
      } else if (data.template === "application_stage_changed") {
        subject = `Application Update: ${p.vacancyRole || "Vacancy"}`;
        html = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Application Status Update</h2>
            <p>Your application status for <strong>${p.vacancyRole || "Vacancy"}</strong> has been updated to: <strong>${p.stage || "Reviewed"}</strong>.</p>
          </div>
        `;
      } else if (data.template === "candidate_created") {
        subject = `New Candidate Sourced/Applied: ${p.candidateName}`;
        html = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #00a0e3;">New Candidate Profile</h2>
            <p>A new candidate has been added to the recruitment pipeline.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>Candidate Name:</strong> ${p.candidateName}</p>
            <p><strong>Applied For Position:</strong> ${p.vacancyRole || "General Pool"}</p>
            <p style="margin-top: 25px;">
              Please log in to the TVSE Recruitment OS dashboard to review the profile.
            </p>
          </div>
        `;
      }

      await sendGmail({
        to: data.recipientEmail,
        subject,
        html,
      });

      return { success: true };
    } catch (err: any) {
      console.error("Failed to send notification email", err);
      return { success: false, error: err.message };
    }
  });

export async function queueNotification(opts: {
  template: NotifyTemplate;
  recipientEmail: string;
  recipientUserId?: string | null;
  payload: Record<string, unknown>;
}) {
  try {
    // 1. Add log to database for audit
    await createDocIn(COL.notifications, {
      template: opts.template,
      recipient_email: opts.recipientEmail,
      recipient_user_id: opts.recipientUserId ?? null,
      payload: opts.payload,
      status: "pending",
      error: null,
      sent_at: null,
    });

    // 2. Call the server function to send immediately (100% free)
    await sendNotificationEmailFn({
      data: {
        template: opts.template,
        recipientEmail: opts.recipientEmail,
        payload: opts.payload,
      }
    });
  } catch (e) {
    console.warn("notify queue failed", e);
  }
}

export async function notifyStaffOnNewCandidate(candidateName: string, vacancyRole: string | null = null) {
  try {
    const settings = await getDocById<{ emails: string }>(COL.appMeta, "settings");
    if (!settings?.emails) return;
    const emailList = settings.emails.split(",").map((e) => e.trim()).filter(Boolean);
    for (const email of emailList) {
      await queueNotification({
        template: "candidate_created",
        recipientEmail: email,
        payload: {
          candidateName,
          vacancyRole: vacancyRole || "General Pool",
        },
      });
    }
  } catch (err) {
    console.warn("Failed to notify staff", err);
  }
}
