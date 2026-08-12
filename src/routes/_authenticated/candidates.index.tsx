import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { COL, type CandidateDoc, type ApplicationDoc } from "@/integrations/firebase/schema";
import { listRecent, listDocs, toDate } from "@/integrations/firebase/db";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText } from "lucide-react";
import { format } from "date-fns";

import { TvseLoader } from "@/components/tvse-loader";

export const Route = createFileRoute("/_authenticated/candidates/")({
  component: CandidateList,
});

function CandidateList() {
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const { roles } = useRoles(user?.id);
  const isOnlySourcer = roles.includes("sourcer") && !roles.includes("hr_admin") && !roles.includes("recruitment_manager") && !roles.includes("recruiter");

  const { data, isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const [candidatesRaw, applications] = await Promise.all([
        listRecent<CandidateDoc>(COL.candidates),
        listDocs<ApplicationDoc>(COL.applications),
      ]);
      
      const candidates = isOnlySourcer
        ? candidatesRaw.filter((c) => c.created_by === user?.id)
        : candidatesRaw;

      const counts = new Map<string, number>();
      for (const a of applications) {
        counts.set(a.candidate_id, (counts.get(a.candidate_id) ?? 0) + 1);
      }
      return candidates.map((c) => ({ ...c, application_count: counts.get(c.id) ?? 0 }));
    },
  });

  const candidates = data ?? [];

  const filtered = candidates.filter((c) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(t) ||
      c.email?.toLowerCase().includes(t) ||
      c.current_company?.toLowerCase().includes(t) ||
      (c.skills ?? []).some((s) => s.toLowerCase().includes(t))
    );
  });

  return (
    <div>
      <PageHeader
        title="Candidates"
        subtitle="Talent pool across all vacancies"
        actions={
          <Button asChild>
            <Link to="/candidates/new"><Plus className="size-4" /> Add candidate</Link>
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="relative max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email, company, skill…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Current</th>
                <th className="text-left px-4 py-3">Experience</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Applications</th>
                <th className="text-left px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center"><TvseLoader className="h-32" /></td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No candidates yet.</td></tr>}
              {filtered.map((c) => {
                const created = toDate(c.created_at);
                return (
                  <tr key={c.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3" colSpan={6}>
                      <Link to="/candidates/$id" params={{ id: c.id }} className="grid grid-cols-[2fr_2fr_100px_140px_100px_120px] gap-4 items-center -mx-4 -my-3 px-4 py-3">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {c.full_name}
                            {c.resume_url && <FileText className="size-3.5 text-muted-foreground" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.email ?? "—"}</div>
                        </div>
                        <div>
                          <div>{c.current_title ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{c.current_company ?? "—"}</div>
                        </div>
                        <span className="text-xs">{c.total_experience ? `${c.total_experience} yrs` : "—"}</span>
                        <span className="text-xs text-muted-foreground">{c.location ?? "—"}</span>
                        <span className="text-xs">{c.application_count}</span>
                        <span className="text-xs text-muted-foreground">{created ? format(created, "PP") : "—"}</span>
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
