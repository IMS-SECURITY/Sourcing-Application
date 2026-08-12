import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { COL, type ApplicationDoc, type CandidateDoc, type InterviewDoc } from "@/integrations/firebase/schema";
import { getDocsByIds, listDocs, orderBy } from "@/integrations/firebase/db";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Calendar } from "lucide-react";
import { format, isFuture, isPast } from "date-fns";

export const Route = createFileRoute("/_authenticated/interviews/")({
  component: InterviewsList,
});

type Row = InterviewDoc & {
  candidate_id: string | null;
  candidate_name: string | null;
  vacancy_role: string | null;
};

function InterviewsList() {
  const { data: interviews = [], isLoading } = useQuery<Row[]>({
    queryKey: ["all-interviews"],
    queryFn: async () => {
      let rows: (InterviewDoc & { id: string })[];
      try {
        rows = await listDocs<InterviewDoc>(COL.interviews, orderBy("scheduled_at", "asc"));
      } catch {
        rows = (await listDocs<InterviewDoc>(COL.interviews)).sort((a, b) =>
          String(a.scheduled_at).localeCompare(String(b.scheduled_at)),
        );
      }
      const apps = await getDocsByIds<ApplicationDoc>(COL.applications, rows.map((r) => r.application_id)).catch(() => []);
      const appById = new Map(apps.map((a) => [a.id, a]));
      const candidates = await getDocsByIds<CandidateDoc>(COL.candidates, apps.map((a) => a.candidate_id)).catch(() => []);
      const candById = new Map(candidates.map((c) => [c.id, c]));
      return rows.map((iv) => {
        const app = appById.get(iv.application_id);
        const cand = app ? candById.get(app.candidate_id) : undefined;
        return {
          ...iv,
          candidate_id: app?.candidate_id ?? null,
          candidate_name: cand?.full_name ?? app?.candidate_name ?? null,
          vacancy_role: app?.vacancy_role ?? null,
        };
      });
    },
  });

  const upcoming = interviews.filter((i) => i.status === "scheduled" && isFuture(new Date(i.scheduled_at)));
  const past = interviews.filter((i) => i.status !== "scheduled" || isPast(new Date(i.scheduled_at)));

  return (
    <div>
      <PageHeader title="Interviews" subtitle="All scheduled candidate interviews across vacancies." />
      <div className="p-8 max-w-5xl space-y-8">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}

        <Section title="Upcoming" items={upcoming} empty="No upcoming interviews." />
        <Section title="Past" items={past} empty="No past interviews." muted />
      </div>
    </div>
  );
}

function Section({ title, items, empty, muted }: { title: string; items: Row[]; empty: string; muted?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
        <Calendar className="size-4" /> {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-lg p-6">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.map((iv) => (
            <Card key={iv.id} className={muted ? "opacity-75" : ""}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {iv.candidate_name ?? "—"} · <span className="text-muted-foreground">{iv.vacancy_role ?? "—"}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {iv.round_name && `${iv.round_name} · `}
                    {format(new Date(iv.scheduled_at), "PPp")} · {iv.duration_minutes} min · {iv.status}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {iv.candidate_id && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/candidates/$id" params={{ id: iv.candidate_id }}>Candidate</Link>
                    </Button>
                  )}
                  {iv.status === "scheduled" && (
                    <Button asChild size="sm">
                      <Link to="/meet/$roomId" params={{ roomId: iv.room_id }}><Video className="size-4" /> Join</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
