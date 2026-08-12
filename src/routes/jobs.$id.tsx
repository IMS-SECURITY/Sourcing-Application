import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { waitForFirebaseUser } from "@/integrations/firebase/auth";
import { COL, type ApplicationDoc, type CandidateDoc, type VacancyDoc } from "@/integrations/firebase/schema";
import { createDocIn, getDocById, listDocs, listRecent, updateDocIn, where } from "@/integrations/firebase/db";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResumeUpload } from "@/components/resume-upload";

import { toast } from "sonner";
import { ArrowLeft, MapPin, Briefcase, Send, CheckCircle2 } from "lucide-react";
import { TvsePageLoader } from "@/components/tvse-loader";
import { notifyStaffOnNewCandidate } from "@/lib/notify";

export const Route = createFileRoute("/jobs/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Job opening — TVS Electronics" },
      { name: "description", content: "Role details and one-click apply for this IT opening on TVS Electronics." },
      { property: "og:title", content: "Job opening — TVS Electronics" },
      { property: "og:description", content: "Role details and one-click apply for this IT opening on TVS Electronics." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");
  const [experience, setExperience] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [expectedCtc, setExpectedCtc] = useState("");
  const [skills, setSkills] = useState("");
  const [notes, setNotes] = useState("");

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => getDocById<VacancyDoc>(COL.vacancies, id),
  });

  const { data: userInfo, isLoading: authLoading } = useQuery({
    queryKey: ["public-auth-user", id],
    queryFn: async () => {
      const user = await waitForFirebaseUser();
      if (!user) return { user: null, candidate: null as (CandidateDoc & { id: string }) | null, alreadyApplied: false };
      const [c] = await listRecent<CandidateDoc>(COL.candidates, where("user_id", "==", user.uid));
      let alreadyApplied = false;
      if (c) {
        const apps = await listDocs<ApplicationDoc>(
          COL.applications,
          where("candidate_id", "==", c.id),
          where("candidate_user_id", "==", user.uid),
          where("vacancy_id", "==", id),
        );
        alreadyApplied = apps.length > 0;
      }
      return { user, candidate: c, alreadyApplied };
    },
  });

  if (jobLoading || authLoading) return <TvsePageLoader />;
  if (!job) return <div className="p-12 text-center"><Link to="/jobs" className="underline">← Back to jobs</Link><div className="mt-2">Position no longer available.</div></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/jobs" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="size-4" /> All jobs</Link>
          {!userInfo?.user && <Button asChild size="sm"><Link to="/auth" search={{ as: "candidate" }}>Candidate sign in</Link></Button>}
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{job.role}</h1>
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
            <span className="flex items-center gap-1"><Briefcase className="size-3.5" /> {job.client_name ?? "—"}</span>
            {job.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {job.location}</span>}
            <span>{job.level}</span>
            {(job.experience_min || job.experience_max) && <span>{job.experience_min ?? "?"}–{job.experience_max ?? "?"} yrs</span>}
          </div>
        </div>

        {(job.skills ?? []).length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Required skills</div>
            <div className="flex flex-wrap gap-1.5">
              {(job.skills ?? []).map((s) => <span key={s} className="text-xs bg-secondary px-2.5 py-1 rounded-md border">{s}</span>)}
            </div>
          </div>
        )}

        {job.description && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">About the role</div>
            <p className="whitespace-pre-wrap leading-relaxed">{job.description}</p>
          </div>
        )}

        <div className="border-t pt-6">
          {!userInfo?.user ? (
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-secondary/40 rounded-xl p-5">
              <div>
                <div className="font-medium">Sign in to apply</div>
                <div className="text-sm text-muted-foreground">Create a free candidate account in 30 seconds.</div>
              </div>
              <Button onClick={() => navigate({ to: "/auth", search: { as: "candidate" } })}>Sign in / Sign up</Button>
            </div>
          ) : userInfo.alreadyApplied ? (
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-xl p-5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="size-5" />
              <div>
                <div className="font-medium">You've already applied to this role.</div>
                <Link to="/portal" className="text-sm underline">Track status in your portal →</Link>
              </div>
            </div>
          ) : (
            <ApplyDialog
              vacancyId={id}
              vacancyRole={job.role}
              candidate={userInfo.candidate}
              userId={userInfo.user.uid}
            />
          )}
        </div>
      </article>
    </div>
  );
}

function ApplyDialog({
  vacancyId,
  vacancyRole,
  candidate,
  userId,
}: {
  vacancyId: string;
  vacancyRole: string;
  candidate: (CandidateDoc & { id: string }) | null;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [expectedCtc, setExpectedCtc] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");

  const apply = useMutation({
    mutationFn: async () => {
      const cid = candidate?.id;
      if (!cid) throw new Error("Candidate profile missing — please sign out and back in.");

      if (!experience.trim() || !skills.trim() || !expectedCtc.trim() || !noticePeriod.trim()) {
        throw new Error("Please fill experience, skills, expected CTC and notice period.");
      }

      const existing = await listDocs<ApplicationDoc>(
        COL.applications,
        where("candidate_id", "==", cid),
        where("candidate_user_id", "==", userId),
        where("vacancy_id", "==", vacancyId),
      );
      if (existing.length > 0) throw new Error("You've already applied to this position.");

       const skillsArr = skills.split(",").map((s) => s.trim()).filter(Boolean);
      await updateDocIn(COL.candidates, cid, {
        user_id: userId,
        total_experience: Number(experience) || null,
        skills: skillsArr,
        current_ctc: currentCtc ? Number(currentCtc) : null,
        expected_ctc: Number(expectedCtc),
        notice_period_days: Number(noticePeriod),
        ...(resumeUrl.trim() ? { resume_url: resumeUrl.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      await createDocIn(COL.applications, {
        candidate_id: cid,
        candidate_user_id: userId,
        candidate_name: candidate?.full_name ?? null,
        vacancy_id: vacancyId,
        vacancy_role: vacancyRole,
        stage: "sourcing",
        score: null,
        assigned_recruiter: null,
        hiring_manager_feedback: null,
        rejection_reason: null,
        created_by: userId,
      });

      await notifyStaffOnNewCandidate(candidate?.full_name ?? "A candidate", vacancyRole);
    },
    onSuccess: () => { toast.success("Application submitted!"); setOpen(false); window.location.href = "/portal"; },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full"><Send className="size-4" /> Apply for this position</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Submit your application</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total experience (years) *</Label>
              <Input type="number" min="0" step="0.5" value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
            <div>
              <Label>Notice period (days) *</Label>
              <Input type="number" min="0" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} />
            </div>
            <div>
              <Label>Current CTC</Label>
              <Input type="number" min="0" value={currentCtc} onChange={(e) => setCurrentCtc(e.target.value)} placeholder="Annual" />
            </div>
            <div>
              <Label>Expected CTC *</Label>
              <Input type="number" min="0" value={expectedCtc} onChange={(e) => setExpectedCtc(e.target.value)} placeholder="Annual" />
            </div>
          </div>
          <div>
            <Label>Skills * (comma separated)</Label>
            <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Node.js, PostgreSQL" />
          </div>
          <ResumeUpload value={resumeUrl} onChange={setResumeUrl} label="Resume" />

          <div>
            <Label>Cover note (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why are you a great fit?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending}>{apply.isPending ? "Submitting…" : "Submit application"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
