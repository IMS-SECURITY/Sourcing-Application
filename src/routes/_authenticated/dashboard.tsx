import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { COL, type ReplacementDoc, type VacancyDoc } from "@/integrations/firebase/schema";
import { listDocs, listRecent } from "@/integrations/firebase/db";
import { waitForFirebaseUser } from "@/integrations/firebase/auth";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeSla, toneClasses } from "@/lib/sla";
import { sendMyHrDigest } from "@/lib/hr-digest.functions";
import { Plus, AlertTriangle, Briefcase, Clock, CheckCircle2, Repeat, Mail } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuth, useRoles } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    const user = await waitForFirebaseUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: Dashboard,
});

import { TvsePageLoader } from "@/components/tvse-loader";

function Dashboard() {
  const { user } = useAuth();
  const { roles, loading: loadingRoles } = useRoles(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loadingRoles && roles.includes("candidate") && !roles.some((r) => r !== "candidate")) {
      navigate({ to: "/portal" });
    }
  }, [roles, loadingRoles, navigate]);

  if (loadingRoles) {
    return <TvsePageLoader />;
  }

  const { data: vacancies = [], isLoading } = useQuery({
    queryKey: ["vacancies-all"],
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

  const open = vacancies.filter((v) => v.status === "open" || v.status === "in_progress").length;
  const closed = vacancies.filter((v) => v.status === "closed").length;
  const replacements = vacancies.filter((v) => v.vacancy_type === "replacement").length;
  const newReqs = vacancies.filter((v) => v.vacancy_type === "new_requirement").length;

  const slaItems = vacancies
    .map((v) => {
      const targetDate = v.target_hiring_date ?? v.deployment_deadline ?? null;
      return { ...v, sla: computeSla(targetDate), targetDate };
    })
    .filter((v) => v.sla && v.status !== "closed" && v.status !== "cancelled")
    .sort((a, b) => (a.sla!.daysLeft - b.sla!.daysLeft));

  const breaches = slaItems.filter((v) => v.sla!.tone === "critical").length;

  if (isLoading) {
    return <TvsePageLoader />;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="At-a-glance view of vacancies, replacements, and SLA status"
        actions={<DashboardActions />}
      />
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Kpi icon={Briefcase} label="Open" value={open} />
          <Kpi icon={CheckCircle2} label="Closed" value={closed} />
          <Kpi icon={Repeat} label="Replacements" value={replacements} tone="accent" />
          <Kpi icon={Clock} label="New Reqs" value={newReqs} />
          <Kpi icon={AlertTriangle} label="SLA Breaches" value={breaches} tone={breaches ? "danger" : undefined} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SLA countdown — active vacancies</CardTitle>
          </CardHeader>
          <CardContent>
            {slaItems.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No active vacancies with target dates yet. <Link to="/vacancies/new" className="underline">Create one</Link>.
              </div>
            ) : (
              <div className="divide-y">
                {slaItems.slice(0, 10).map((v) => (
                  <Link key={v.id} to="/vacancies/$id" params={{ id: v.id }} className="flex items-center gap-4 py-3 px-1 hover:bg-secondary/50 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{v.role} <span className="text-muted-foreground font-normal">· {v.client_name ?? "—"}</span></div>
                      <div className="text-xs text-muted-foreground">
                        {v.vacancy_type === "replacement" ? "Replacement" : "New"} · {v.level} · target {v.targetDate}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md border ${toneClasses[v.sla!.tone]}`}>{v.sla!.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "accent" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <Icon className={`size-4 ${tone === "accent" ? "text-accent" : tone === "danger" ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <div className={`text-3xl font-semibold mt-2 ${tone === "accent" ? "text-accent" : tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function DashboardActions() {
  const send = useServerFn(sendMyHrDigest);
  const m = useMutation({
    mutationFn: () => send({ data: undefined as never }),
    onSuccess: (r) => toast.success(r.sent > 0 ? `Digest sent to ${r.recipients.join(", ")}` : "No digest sent (no email on file)"),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
        <Mail className="size-4" /> {m.isPending ? "Sending…" : "Email me today's digest"}
      </Button>
      <Button asChild>
        <Link to="/vacancies/new"><Plus className="size-4" /> New vacancy</Link>
      </Button>
    </div>
  );
}
