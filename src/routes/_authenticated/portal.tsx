import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { COL, type ApplicationDoc, type CandidateDoc, type InterviewDoc } from "@/integrations/firebase/schema";
import { toDateSafe } from "@/integrations/firebase/db";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { stageLabel, stageTone } from "@/lib/pipeline";
import { Briefcase, Video, Search } from "lucide-react";
import { format, isFuture } from "date-fns";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

export const Route = createFileRoute("/_authenticated/portal")({
  component: CandidatePortal,
});

function CandidatePortal() {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<CandidateDoc | null>(null);
  const [applications, setApplications] = useState<ApplicationDoc[]>([]);
  const [interviews, setInterviews] = useState<InterviewDoc[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = onSnapshot(doc(firestore, COL.candidates, user.id), (docSnap) => {
      if (docSnap.exists()) {
        setCandidate({ id: docSnap.id, ...docSnap.data() } as CandidateDoc);
      }
    });
    return unsub;
  }, [user?.id]);

  useEffect(() => {
    if (!candidate?.id || !user?.id) return;
    const q = query(
      collection(firestore, COL.applications),
      where("candidate_id", "==", candidate.id),
      where("candidate_user_id", "==", user.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const docs: ApplicationDoc[] = [];
      snapshot.forEach((d) => {
        docs.push({ id: d.id, ...d.data() } as ApplicationDoc);
      });
      docs.sort((a, b) => {
        const tA = a.created_at ? toDateSafe(a.created_at).getTime() : 0;
        const tB = b.created_at ? toDateSafe(b.created_at).getTime() : 0;
        return tB - tA;
      });
      setApplications(docs);
    });
    return unsub;
  }, [candidate?.id, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(firestore, COL.interviews),
      where("candidate_user_id", "==", user.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const docs: InterviewDoc[] = [];
      snapshot.forEach((d) => {
        docs.push({ id: d.id, ...d.data() } as InterviewDoc);
      });
      docs.sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
      setInterviews(docs);
    });
    return unsub;
  }, [user?.id]);

  const roleByApp = new Map(applications.map((a) => [a.id, a.vacancy_role]));
  const upcoming = interviews.filter((i) => i.status === "scheduled" && isFuture(new Date(i.scheduled_at)));

  return (
    <div>
      <PageHeader
        title={`Welcome${candidate?.full_name ? `, ${candidate.full_name.split(" ")[0]}` : ""}`}
        subtitle="Track your job applications and upcoming interviews."
        actions={<Button asChild><Link to="/jobs"><Search className="size-4" /> Browse jobs</Link></Button>}
      />

      <div className="p-8 max-w-5xl space-y-8">
        {upcoming.length > 0 && (
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">Upcoming interviews</h2>
            <div className="space-y-2">
              {upcoming.map((iv) => (
                <Card key={iv.id} className="border-accent/50">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{roleByApp.get(iv.application_id) ?? "Interview"}</div>
                      <div className="text-sm text-muted-foreground">
                        {iv.round_name && `${iv.round_name} · `}
                        {format(new Date(iv.scheduled_at), "PPp")} · {iv.duration_minutes} min
                      </div>
                    </div>
                    <Button asChild>
                      <Link to="/meet/$roomId" params={{ roomId: iv.room_id }}>
                        <Video className="size-4" /> Join interview
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">My applications ({applications.length})</h2>
          {applications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Briefcase className="size-10 mx-auto text-muted-foreground mb-3" />
                <div className="font-medium">No applications yet</div>
                <div className="text-sm text-muted-foreground mb-4">Browse open positions and apply in one click.</div>
                <Button asChild><Link to="/jobs">Browse jobs</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {applications.map((a) => (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{a.vacancy_role ?? "—"}</div>
                        <div className="text-sm text-muted-foreground">
                          applied {format(toDateSafe(a.created_at), "PP")}
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-md border ${stageTone(a.stage)}`}>{stageLabel(a.stage)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
