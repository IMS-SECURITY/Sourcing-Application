import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { COL, type VacancyDoc, type ReplacementDoc } from "@/integrations/firebase/schema";
import { listDocs, listRecent } from "@/integrations/firebase/db";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeSla, toneClasses } from "@/lib/sla";
import { Plus, Search } from "lucide-react";

import { TvseLoader } from "@/components/tvse-loader";

export const Route = createFileRoute("/_authenticated/vacancies/")({
  component: VacancyList,
});

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  on_hold: "On Hold",
  closed: "Closed",
  cancelled: "Cancelled",
};

function VacancyList() {
  const { user } = useAuth();
  const { roles } = useRoles(user?.id);
  const isCandidate = roles.includes("candidate") && !roles.some((r) => r !== "candidate");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const { data: vacancies = [], isLoading } = useQuery({
    queryKey: ["vacancies", user?.id, isCandidate],
    queryFn: async () => {
      const [rows, replacements] = await Promise.all([
        listRecent<VacancyDoc>(COL.vacancies),
        listDocs<ReplacementDoc>(COL.replacements).catch(() => []),
      ]);
      const deadlineByVacancy = new Map(replacements.map((r) => [r.vacancy_id, r.deployment_deadline]));
      return rows.map((v) => ({
        ...v,
        deployment_deadline: v.deployment_deadline ?? deadlineByVacancy.get(v.id) ?? null,
      }));
    },
  });

  const filtered = vacancies.filter((v) => {
    if (isCandidate && user && v.created_by !== user.id) return false;
    if (status !== "all" && v.status !== status) return false;
    if (type !== "all" && v.vacancy_type !== type) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      v.role?.toLowerCase().includes(t) ||
      v.location?.toLowerCase().includes(t) ||
      v.client_name?.toLowerCase().includes(t)
    );
  });

  return (
    <div>
      <PageHeader
        title={isCandidate ? "Vacancy requests" : "Vacancies"}
        subtitle={isCandidate ? "Requests you posted for new or replacement hiring" : "All open and historical requirements"}
        actions={
          <Button asChild>
            <Link to="/vacancies/new"><Plus className="size-4" /> {isCandidate ? "Post vacancy" : "New vacancy"}</Link>
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search role, client, location…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="new_requirement">New Requirement</SelectItem>
              <SelectItem value="replacement">Replacement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Level</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center"><TvseLoader className="h-32" /></td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{isCandidate ? "No vacancy requests yet." : "No vacancies found."}</td></tr>
              )}
              {filtered.map((v) => {
                const targetDate = v.target_hiring_date ?? v.deployment_deadline ?? null;
                const sla = computeSla(targetDate);
                return (
                  <tr key={v.id} className="hover:bg-secondary/40 cursor-pointer">
                    <td className="px-4 py-3" colSpan={7}>
                      <Link to="/vacancies/$id" params={{ id: v.id }} className="grid grid-cols-[1fr_1fr_60px_1fr_120px_120px_120px] gap-4 items-center -mx-4 -my-3 px-4 py-3">
                        <span className="font-medium">{v.role}</span>
                        <span className="text-muted-foreground">{v.client_name ?? "—"}</span>
                        <span className="text-xs">{v.level}</span>
                        <span className="text-muted-foreground">{v.location ?? "—"}</span>
                        <span className="text-xs">{v.vacancy_type === "replacement" ? "Replacement" : "New"}</span>
                        <span className="text-xs">{STATUS_LABELS[v.status]}</span>
                        <span>{sla ? <span className={`text-xs px-2 py-1 rounded-md border ${toneClasses[sla.tone]}`}>{sla.label}</span> : <span className="text-xs text-muted-foreground">—</span>}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
