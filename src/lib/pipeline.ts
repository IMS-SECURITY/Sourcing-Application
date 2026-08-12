import type { PipelineStage } from "@/integrations/firebase/schema";

export type { PipelineStage };

export const STAGES: { key: PipelineStage; label: string; tone: string }[] = [
  { key: "sourcing", label: "Sourcing", tone: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800" },
  { key: "screening", label: "Screening", tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900" },
  { key: "submitted", label: "Submitted", tone: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900" },
  { key: "interviewing", label: "Interviewing", tone: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900" },
  { key: "offered", label: "Offered", tone: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900" },
  { key: "joined", label: "Joined", tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900" },
  { key: "rejected", label: "Rejected", tone: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900" },
  { key: "on_hold", label: "On Hold", tone: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" },
];

export function stageLabel(s: PipelineStage) {
  return STAGES.find((x) => x.key === s)?.label ?? s;
}
export function stageTone(s: PipelineStage) {
  return STAGES.find((x) => x.key === s)?.tone ?? "";
}
