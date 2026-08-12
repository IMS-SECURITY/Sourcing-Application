import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { COL, type ApplicationDoc, type CandidateDoc, type VacancyDoc, type TimeLike } from "@/integrations/firebase/schema";
import { createDocIn, getDocById, getDocsByIds, listRecent, updateDocIn, where, toDate } from "@/integrations/firebase/db";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { STAGES, type PipelineStage } from "@/lib/pipeline";
import { ArrowLeft, GripVertical, Clock } from "lucide-react";
import { toast } from "sonner";
import { computeSla, toneClasses } from "@/lib/sla";
import { queueNotification } from "@/lib/notify";

import { TvsePageLoader } from "@/components/tvse-loader";

export const Route = createFileRoute("/_authenticated/vacancies/$id/pipeline")({
  component: VacancyPipeline,
});

type AppRow = {
  id: string;
  stage: PipelineStage;
  candidate_id: string;
  candidate: { full_name: string; current_title: string | null; current_company: string | null } | null;
  created_at?: TimeLike;
};

function VacancyPipeline() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: vacancy, isLoading: vacLoading } = useQuery({
    queryKey: ["vacancy", id],
    queryFn: () => getDocById<VacancyDoc>(COL.vacancies, id),
  });

  const { data: apps = [], isLoading: appsLoading } = useQuery<AppRow[]>({
    queryKey: ["vacancy-pipeline", id],
    queryFn: async () => {
      const rows = await listRecent<ApplicationDoc>(COL.applications, where("vacancy_id", "==", id));
      const candidates = await getDocsByIds<CandidateDoc>(
        COL.candidates,
        rows.map((r) => r.candidate_id),
      ).catch(() => []);
      const byId = new Map(candidates.map((c) => [c.id, c]));
      return rows.map((r) => {
        const c = byId.get(r.candidate_id);
        return {
          id: r.id,
          stage: r.stage,
          candidate_id: r.candidate_id,
          candidate: c
            ? { full_name: c.full_name, current_title: c.current_title, current_company: c.current_company }
            : r.candidate_name
              ? { full_name: r.candidate_name, current_title: null, current_company: null }
              : null,
          created_at: r.created_at,
        };
      });
    },
  });

  if (vacLoading || appsLoading) {
    return <TvsePageLoader />;
  }

  const moveStage = useMutation({
    mutationFn: async ({ appId, toStage, fromStage }: { appId: string; toStage: PipelineStage; fromStage: PipelineStage }) => {
      if (toStage === fromStage) return;
      await updateDocIn(COL.applications, appId, { stage: toStage });
      await createDocIn(COL.stageHistory, {
        application_id: appId,
        from_stage: fromStage,
        to_stage: toStage,
        note: null,
        changed_by: user?.id ?? null,
      });

      try {
        const appDoc = await getDocById<ApplicationDoc>(COL.applications, appId);
        if (appDoc?.candidate_id) {
          const candidate = await getDocById<CandidateDoc>(COL.candidates, appDoc.candidate_id);
          if (candidate?.email) {
            await queueNotification({
              template: "application_stage_changed",
              recipientEmail: candidate.email,
              recipientUserId: candidate.user_id,
              payload: {
                vacancyRole: appDoc.vacancy_role || "Vacancy",
                stage: toStage,
              },
            });
          }
        }
      } catch (err) {
        console.warn("Failed to send stage change notification", err);
      }
    },
    onMutate: async ({ appId, toStage }) => {
      await qc.cancelQueries({ queryKey: ["vacancy-pipeline", id] });
      const prev = qc.getQueryData<AppRow[]>(["vacancy-pipeline", id]);
      qc.setQueryData<AppRow[]>(["vacancy-pipeline", id], (cur) =>
        (cur ?? []).map((a) => (a.id === appId ? { ...a, stage: toStage } : a)),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      qc.setQueryData(["vacancy-pipeline", id], ctx?.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["vacancy-pipeline", id] }),
  });

  function onDrop(toStage: PipelineStage) {
    if (!dragId) return;
    const app = apps.find((a) => a.id === dragId);
    if (!app) return;
    moveStage.mutate({ appId: dragId, toStage, fromStage: app.stage });
    setDragId(null);
  }

  const targetDate = vacancy ? (vacancy.target_hiring_date ?? vacancy.deployment_deadline ?? null) : null;
  const sla = computeSla(targetDate);

  return (
    <div>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>Pipeline</span>
            {sla && (
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 ${toneClasses[sla.tone]}`}>
                <Clock className="size-3" /> SLA: {sla.label}
              </span>
            )}
          </div>
        }
        subtitle={vacancy ? `${vacancy.role} · ${vacancy.client_name ?? "—"}` : ""}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/vacancies/$id", params: { id } })}>
              <ArrowLeft className="size-4" /> Back to vacancy
            </Button>
          </div>
        }
      />
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {STAGES.map((s) => {
            const col = apps.filter((a) => a.stage === s.key);
            return (
              <div
                key={s.key}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => onDrop(s.key)}
                className="w-72 shrink-0 rounded-lg border bg-card flex flex-col max-h-[calc(100vh-12rem)]"
              >
                <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-card rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${s.tone}`}>{s.label}</span>
                    <span className="text-xs text-muted-foreground">{col.length}</span>
                  </div>
                </div>
                <div className="p-2 space-y-2 overflow-y-auto">
                  {col.length === 0 && <div className="text-xs text-muted-foreground px-2 py-4 text-center">Drop candidates here</div>}
                  {col.map((a) => {
                    const created = toDate(a.created_at);
                    const daysActive = created ? Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    return (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={() => setDragId(a.id)}
                        onDragEnd={() => setDragId(null)}
                        className={`group rounded-md border bg-background p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition ${dragId === a.id ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <Link to="/candidates/$id" params={{ id: a.candidate_id }} className="font-medium text-sm hover:underline block truncate">
                              {a.candidate?.full_name ?? "—"}
                            </Link>
                            <div className="text-xs text-muted-foreground truncate">{a.candidate?.current_title ?? "—"}</div>
                            <div className="text-xs text-muted-foreground truncate">{a.candidate?.current_company ?? ""}</div>
                            
                            <div className="mt-2">
                              {daysActive > 5 ? (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded font-bold">
                                  ⚠️ {daysActive} days delayed
                                </span>
                              ) : daysActive > 2 ? (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                                  ⏱️ {daysActive} days active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-green-500/10 text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded font-bold">
                                  ✨ New ({daysActive}d)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {apps.length === 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            No candidates shortlisted yet. Go to <Link to="/candidates" className="underline">Candidates</Link> and click <em>Shortlist for vacancy</em>.
          </div>
        )}
      </div>
    </div>
  );
}
