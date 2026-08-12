import { differenceInCalendarDays, parseISO } from "date-fns";

export type SlaTone = "ok" | "warn" | "risk" | "critical";

export interface SlaInfo {
  daysLeft: number;
  tone: SlaTone;
  label: string;
  status: "On Track" | "At Risk" | "Breached";
}

export function computeSla(targetDate: string | null | undefined): SlaInfo | null {
  if (!targetDate) return null;
  const d = typeof targetDate === "string" ? parseISO(targetDate) : targetDate;
  const days = differenceInCalendarDays(d, new Date());
  let tone: SlaTone;
  let status: SlaInfo["status"];
  if (days <= 0) { tone = "critical"; status = "Breached"; }
  else if (days <= 6) { tone = "risk"; status = "At Risk"; }
  else if (days <= 14) { tone = "warn"; status = "At Risk"; }
  else { tone = "ok"; status = "On Track"; }
  const label =
    days < 0 ? `Overdue by ${Math.abs(days)}d` :
    days === 0 ? "Due today" :
    `${days}d left`;
  return { daysLeft: days, tone, label, status };
}

export const toneClasses: Record<SlaTone, string> = {
  ok: "bg-[var(--color-sla-ok)]/15 text-[var(--color-sla-ok-foreground)] border-[var(--color-sla-ok)]/40",
  warn: "bg-[var(--color-sla-warn)]/20 text-[var(--color-sla-warn-foreground)] border-[var(--color-sla-warn)]/50",
  risk: "bg-[var(--color-sla-risk)]/20 text-[var(--color-sla-risk-foreground)] border-[var(--color-sla-risk)]/50",
  critical: "bg-[var(--color-sla-critical)] text-[var(--color-sla-critical-foreground)] border-[var(--color-sla-critical)]",
};
