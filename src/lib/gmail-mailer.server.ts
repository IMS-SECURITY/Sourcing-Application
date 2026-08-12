import nodemailerModule from "nodemailer";

type SendOpts = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
};

let cachedTransport: unknown = null;

function getTransport() {
  if (cachedTransport) return cachedTransport as { sendMail: (opts: Record<string, unknown>) => Promise<{ messageId: string }>; close?: () => void };
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not configured");

  const nodemailer = nodemailerModule as unknown as {
    createTransport: (opts: Record<string, unknown>) => unknown;
  };
  cachedTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
  });
  return cachedTransport as { sendMail: (opts: Record<string, unknown>) => Promise<{ messageId: string }> };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendGmail(opts: SendOpts): Promise<{ messageId: string }> {
  const user = process.env.GMAIL_USER!;
  const transport = getTransport();
  const fromName = opts.fromName ?? "TalentFlow";
  const info = await transport.sendMail({
    from: `"${fromName}" <${user}>`,
    to: opts.to,
    replyTo: opts.replyTo ?? user,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? htmlToText(opts.html),
    headers: {
      "X-Entity-Ref-ID": `talentflow-${Date.now()}`,
    },
  });
  return { messageId: info.messageId };
}
