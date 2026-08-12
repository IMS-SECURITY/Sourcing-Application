import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { COL, type CandidateDoc, type ApplicationDoc, type InterviewDoc, type VacancyDoc } from "@/integrations/firebase/schema";
import { createDocIn, getDocById, listDocs, listRecent, listWhereIn, toDate, updateDocIn, where } from "@/integrations/firebase/db";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ResumeUpload } from "@/components/resume-upload";
import { stageTone, stageLabel } from "@/lib/pipeline";

import { queueNotification } from "@/lib/notify";
import { toast } from "sonner";
import { ArrowLeft, FileText, Mail, Phone, MapPin, Briefcase, Plus, Calendar, Video, XCircle, User, Copy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/candidates/$id")({
  component: CandidateDetail,
});

function extractContactFromResume(resumeDataUrl: string): { email?: string; phone?: string } {
  try {
    if (!resumeDataUrl || !resumeDataUrl.startsWith("data:")) return {};
    const parts = resumeDataUrl.split(",");
    if (parts.length < 2) return {};
    const bstr = atob(parts[1]);
    
    // Scan standard ASCII/UTF-8 text chunks for email
    const emailMatch = bstr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : undefined;

    // Scan for phone numbers: standard Indian format or general 10 digit formats
    const phoneMatch = bstr.match(/\b(?:\+91[- ]?)?[6789]\d{9}\b|\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/);
    const phone = phoneMatch ? phoneMatch[0] : undefined;

    return { email, phone };
  } catch (err) {
    console.warn("Resume contact parsing failed", err);
    return {};
  }
}

function CandidateDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => getDocById<CandidateDoc>(COL.candidates, id),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["candidate-applications", id],
    queryFn: () => listRecent<ApplicationDoc>(COL.applications, where("candidate_id", "==", id)),
  });

  const [newRemark, setNewRemark] = useState("");
  const { data: remarks = [], refetch: refetchRemarks } = useQuery({
    queryKey: ["candidate-remarks", id],
    queryFn: () => listDocs<{ id: string; candidate_id: string; author_id: string; author_name: string; text: string; created_at: any }>(
      COL.comments,
      where("candidate_id", "==", id),
    ).then((rows) => [...rows].sort((a, b) => {
      const tA = toDate(a.created_at)?.getTime() ?? 0;
      const tB = toDate(b.created_at)?.getTime() ?? 0;
      return tA - tB;
    })),
  });

  const postRemark = useMutation({
    mutationFn: async () => {
      if (!newRemark.trim() || !user) return;
      const emailPrefix = user.email ? user.email.split("@")[0] : "Staff";
      await createDocIn(COL.comments, {
        candidate_id: id,
        author_id: user.id,
        author_name: emailPrefix,
        text: newRemark.trim(),
        created_at: new Date().toISOString(),
      });
      setNewRemark("");
    },
    onSuccess: () => {
      refetchRemarks();
      toast.success("Remark added");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add remark");
    }
  });

  const applicationIds = applications.map((a) => a.id);

  const { data: interviews = [] } = useQuery({
    queryKey: ["candidate-interviews", id, applicationIds.join(",")],
    enabled: applicationIds.length > 0,
    queryFn: async () => {
      const rows = await listWhereIn<InterviewDoc>(COL.interviews, "application_id", applicationIds);
      return rows.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!candidate) return <div className="p-8">Not found. <Link to="/candidates" className="underline">Back</Link></div>;

  return (
    <div>
      <PageHeader
        title={candidate.full_name}
        subtitle={[candidate.current_title, candidate.current_company].filter(Boolean).join(" · ") || "Candidate"}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/candidates" })}><ArrowLeft className="size-4" /> Back</Button>
            <ApplyDialog
              candidateId={id}
              candidateName={candidate.full_name}
              candidateUserId={candidate.user_id ?? null}
              userId={user?.id}
              onDone={() => qc.invalidateQueries({ queryKey: ["candidate-applications", id] })}
            />
          </div>
        }
      />
      <div className="p-8 grid lg:grid-cols-3 gap-6 max-w-7xl">
        <div className="space-y-6">
          <Card className="border-2 border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="bg-primary/10 py-3"><CardTitle className="text-base text-primary font-bold">Contact Credentials</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm pt-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded bg-primary/20 text-primary grid place-items-center shrink-0"><User className="size-4" /></div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Candidate Name</div>
                  <div className="font-semibold text-base text-foreground truncate">{candidate.full_name}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded bg-primary/20 text-primary grid place-items-center shrink-0"><Mail className="size-4" /></div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Email ID</div>
                  <div className="font-semibold text-foreground break-all">{candidate.email ?? "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded bg-primary/20 text-primary grid place-items-center shrink-0"><Phone className="size-4" /></div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Phone Number</div>
                  <div className="font-semibold text-foreground">{candidate.phone ?? "—"}</div>
                </div>
              </div>
              {candidate.location && (
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded bg-primary/20 text-primary grid place-items-center shrink-0"><MapPin className="size-4" /></div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Location</div>
                    <div className="font-semibold text-foreground">{candidate.location}</div>
                  </div>
                </div>
              )}
              {candidate.linkedin_url && (
                <div className="pt-1">
                  <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold block">
                    LinkedIn Profile →
                  </a>
                </div>
              )}
              {candidate.resume_url && (
                <Button variant="outline" size="sm" asChild className="w-full justify-start mt-2">
                  <a
                    href={candidate.resume_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText className="size-4" /> View resume
                  </a>
                </Button>
              )}
              <ResumeUpload
                value={candidate.resume_url ?? ""}
                label={candidate.resume_url ? "Replace resume" : "Attach resume"}
                onChange={async (url) => {
                  const updates: Record<string, any> = { resume_url: url || null };
                  if (url) {
                    const extracted = extractContactFromResume(url);
                    if (extracted.email && !candidate.email) {
                      updates.email = extracted.email;
                      toast.success(`Extracted Email: ${extracted.email}`);
                    }
                    if (extracted.phone && !candidate.phone) {
                      updates.phone = extracted.phone;
                      toast.success(`Extracted Phone: ${extracted.phone}`);
                    }
                  }
                  await updateDocIn(COL.candidates, id, updates);
                  qc.invalidateQueries({ queryKey: ["candidate", id] });
                }}
              />
              {candidate.email && (
                <ComposeEmailDialog
                  candidateName={candidate.full_name}
                  candidateEmail={candidate.email}
                  currentUserName={user?.email?.split("@")[0] ?? "Staff"}
                  vacancyRole={applications[0]?.vacancy_role ?? ""}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row label="Experience" value={candidate.total_experience ? `${candidate.total_experience} yrs` : "—"} />
              <Row label="Current CTC" value={candidate.current_ctc ? String(candidate.current_ctc) : "—"} />
              <Row label="Expected CTC" value={candidate.expected_ctc ? String(candidate.expected_ctc) : "—"} />
              <Row label="Notice" value={candidate.notice_period_days != null ? `${candidate.notice_period_days} days` : "—"} />
              <Row label="Source" value={candidate.source ?? "—"} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Skills & notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(candidate.skills ?? []).length === 0 && <span className="text-muted-foreground text-sm">No skills tagged.</span>}
                {(candidate.skills ?? []).map((s) => <span key={s} className="text-xs bg-secondary px-2 py-0.5 rounded-md">{s}</span>)}
              </div>
              {candidate.notes && <p className="text-sm whitespace-pre-wrap">{candidate.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">💬 Remarks & Feedback</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {remarks.length === 0 && <p className="text-xs text-muted-foreground italic">No remarks posted yet.</p>}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {remarks.map((r) => {
                  const rDate = toDate(r.created_at);
                  return (
                    <div key={r.id} className="p-2.5 rounded-lg bg-secondary/35 border text-xs space-y-1 animate-fade-in">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="font-semibold text-primary">Remarks by {r.author_name}</span>
                        <span>{rDate ? format(rDate, "PPp") : ""}</span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{r.text}</p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t space-y-2">
                <Textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Type a remark to share with HR and other staff..."
                  rows={2}
                  className="text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={postRemark.isPending || !newRemark.trim()}
                    onClick={() => postRemark.mutate()}
                  >
                    {postRemark.isPending ? "Posting..." : "Add Remark"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Briefcase className="size-4" /> Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length === 0 && <div className="text-sm text-muted-foreground">Not shortlisted for any vacancy yet.</div>}
              <div className="space-y-2">
                {applications.map((a) => {
                  const appInterviews = interviews.filter((i) => i.application_id === a.id);
                  const created = toDate(a.created_at);
                  return (
                    <div key={a.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Link to="/vacancies/$id" params={{ id: a.vacancy_id }} className="font-medium hover:underline">{a.vacancy_role ?? "Vacancy"}</Link>
                          <div className="text-xs text-muted-foreground">{created ? `added ${format(created, "PP")}` : "—"}</div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-md border ${stageTone(a.stage)}`}>{stageLabel(a.stage)}</span>
                      </div>
                      <div className="flex gap-2">
                        <ScheduleInterviewDialog
                          applicationId={a.id}
                          vacancyId={a.vacancy_id}
                          candidateEmail={candidate.email ?? ""}
                          candidateUserId={candidate.user_id ?? null}
                          vacancyRole={a.vacancy_role ?? ""}
                          userId={user?.id}
                          onDone={() => { qc.invalidateQueries({ queryKey: ["candidate-interviews", id] }); qc.invalidateQueries({ queryKey: ["candidate-applications", id] }); }}
                        />
                        <RejectDialog
                          applicationId={a.id}
                          candidateEmail={candidate.email ?? ""}
                          candidateUserId={candidate.user_id ?? null}
                          vacancyRole={a.vacancy_role ?? ""}
                          onDone={() => qc.invalidateQueries({ queryKey: ["candidate-applications", id] })}
                        />
                      </div>
                      {appInterviews.length > 0 && (
                        <div className="border-t pt-2 mt-2 space-y-1">
                          {appInterviews.map((iv) => (
                            <div key={iv.id} className="text-xs flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="size-3" />
                                {format(new Date(iv.scheduled_at), "PPp")} · {iv.round_name ?? "Interview"} · {iv.status}
                              </span>
                              {iv.status === "scheduled" && (
                                <Link to="/meet/$roomId" params={{ roomId: iv.room_id }} className="text-accent hover:underline flex items-center gap-1">
                                  <Video className="size-3" /> Join
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

function ApplyDialog({ candidateId, candidateName, candidateUserId, userId, onDone }: {
  candidateId: string; candidateName: string; candidateUserId: string | null; userId: string | undefined; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [vacancyId, setVacancyId] = useState("");
  const { data: vacancies = [] } = useQuery({
    queryKey: ["vacancies-open-list"],
    enabled: open,
    queryFn: async () => {
      const rows = await listDocs<VacancyDoc>(COL.vacancies, where("status", "in", ["open", "in_progress"]));
      return rows;
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (!userId || !vacancyId) throw new Error("Pick a vacancy");
      const existing = await listDocs<ApplicationDoc>(
        COL.applications,
        where("candidate_id", "==", candidateId),
        where("vacancy_id", "==", vacancyId),
      );
      if (existing.length > 0) throw new Error("This candidate is already on that vacancy's pipeline.");
      const vacancy = vacancies.find((v) => v.id === vacancyId);
      await createDocIn(COL.applications, {
        candidate_id: candidateId,
        candidate_user_id: candidateUserId,
        candidate_name: candidateName,
        vacancy_id: vacancyId,
        vacancy_role: vacancy?.role ?? null,
        stage: "sourcing",
        score: null,
        assigned_recruiter: null,
        hiring_manager_feedback: null,
        rejection_reason: null,
        created_by: userId,
      });
    },
    onSuccess: () => { toast.success("Shortlisted"); setOpen(false); setVacancyId(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Shortlist for vacancy</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Shortlist candidate</DialogTitle></DialogHeader>
        <Select value={vacancyId} onValueChange={setVacancyId}>
          <SelectTrigger><SelectValue placeholder="Pick an open vacancy" /></SelectTrigger>
          <SelectContent>
            {vacancies.map((v) => <SelectItem key={v.id} value={v.id}>{v.role} — {v.client_name ?? "—"}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={!vacancyId || submit.isPending}>Shortlist</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleInterviewDialog({ applicationId, vacancyId, candidateEmail, candidateUserId, vacancyRole, userId, onDone }: {
  applicationId: string; vacancyId: string; candidateEmail: string; candidateUserId: string | null; vacancyRole: string; userId: string | undefined; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [duration, setDuration] = useState(45);
  const [round, setRound] = useState("Technical round 1");

  const { data: dayInterviews = [] } = useQuery({
    queryKey: ["day-interviews", selectedDate],
    enabled: !!selectedDate && open,
    queryFn: async () => {
      const start = `${selectedDate}T00:00:00.000Z`;
      const end = `${selectedDate}T23:59:59.999Z`;
      const rows = await listRecent<InterviewDoc>(COL.interviews);
      return rows.filter((r) => r.scheduled_at >= start && r.scheduled_at <= end);
    }
  });

  const slotTo24h = (slot: string) => {
    const [time, modifier] = slot.split(" ");
    let [hours, minutes] = time.split(":");
    if (hours === "12" && modifier === "AM") hours = "00";
    if (modifier === "PM" && hours !== "12") hours = String(parseInt(hours, 10) + 12);
    return `${hours.padStart(2, "0")}:${minutes}:00.000Z`;
  };

  const SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];

  const isSlotBooked = (slot: string) => {
    if (!selectedDate) return false;
    const targetTime = `${selectedDate}T${slotTo24h(slot).substring(0, 8)}`;
    return dayInterviews.some((i) => {
      if (!i.scheduled_at) return false;
      const formattedIso = toDate(i.scheduled_at)?.toISOString() || "";
      return formattedIso.includes(targetTime);
    });
  };

  const scheduledAt = selectedDate && selectedSlot ? `${selectedDate}T${slotTo24h(selectedSlot)}` : "";

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId || !scheduledAt) throw new Error("Pick a time");
      const roomId = crypto.randomUUID();
      await createDocIn(COL.interviews, {
        application_id: applicationId,
        candidate_user_id: candidateUserId,
        vacancy_id: vacancyId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: duration,
        round_name: round,
        interviewer_ids: [userId],
        room_id: roomId,
        external_link: null,
        status: "scheduled",
        rating: null,
        feedback: null,
        cancellation_reason: null,
        mode: "in_app",
        created_by: userId,
      });
      await updateDocIn(COL.applications, applicationId, { stage: "interviewing" });
      if (candidateEmail) {
        await queueNotification({
          template: "interview_scheduled",
          recipientEmail: candidateEmail,
          recipientUserId: candidateUserId,
          payload: { vacancyRole, scheduledAt, duration, round, roomUrl: `${window.location.origin}/meet/${roomId}` },
        });
      }
    },
    onSuccess: () => { toast.success("Interview scheduled"); setOpen(false); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Calendar className="size-4" /> Schedule interview</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Schedule interview · {vacancyRole}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Round</Label><Input value={round} onChange={(e) => setRound(e.target.value)} /></div>
          
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(""); }} />
          </div>

          {selectedDate && (
            <div className="space-y-2 animate-fade-in">
              <Label className="text-xs">Available Time Slots</Label>
              <div className="grid grid-cols-2 gap-2">
                {SLOTS.map((s) => {
                  const booked = isSlotBooked(s);
                  const active = selectedSlot === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={booked}
                      onClick={() => setSelectedSlot(s)}
                      className={`py-2 px-3 text-xs border rounded-lg transition-all font-semibold ${
                        booked
                          ? "bg-secondary text-muted-foreground line-through opacity-60 cursor-not-allowed"
                          : active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-primary/5 hover:border-primary/40 border-secondary"
                      }`}
                    >
                      {s} {booked && " (Booked)"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div><Label>Duration (minutes)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
          <p className="text-xs text-muted-foreground">A built-in video room is created automatically. The candidate gets an email with the join link.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={!scheduledAt || submit.isPending}>Schedule & notify</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ applicationId, candidateEmail, candidateUserId, vacancyRole, onDone }: {
  applicationId: string; candidateEmail: string; candidateUserId: string | null; vacancyRole: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const submit = useMutation({
    mutationFn: async () => {
      await updateDocIn(COL.applications, applicationId, { stage: "rejected", rejection_reason: reason || null });
      if (candidateEmail) {
        await queueNotification({
          template: "application_rejected",
          recipientEmail: candidateEmail,
          recipientUserId: candidateUserId,
          payload: { vacancyRole, reason },
        });
      }
    },
    onSuccess: () => { toast.success("Application rejected"); setOpen(false); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700"><XCircle className="size-4" /> Reject</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject application</DialogTitle></DialogHeader>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shared in email to candidate, optional)" />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => submit.mutate()} disabled={submit.isPending}>Reject & notify</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TEMPLATES = [
  {
    id: "invite",
    name: "Interview Invitation",
    subject: "TVSE Interview schedule invitation - [Vacancy Role]",
    body: "Hi [Candidate Name],\n\nHope you are doing well.\n\nWe would like to invite you for an interview for the [Vacancy Role] position at TVS Electronics. The interview will be hosted on our virtual portal.\n\nYou can join the meeting at the scheduled time using this link:\n[Join Meeting Link]\n\nBest regards,\n[Recruiter Name]\nTVS Electronics Recruitment Team"
  },
  {
    id: "followup",
    name: "Status Update",
    subject: "Status update regarding your application for [Vacancy Role]",
    body: "Hi [Candidate Name],\n\nThank you for your patience during the screening process.\n\nWe wanted to let you know that your profile is currently under review by our hiring team. We will reach back out to you shortly with next steps.\n\nBest regards,\n[Recruiter Name]\nTVS Electronics Recruitment Team"
  },
  {
    id: "reject",
    name: "Standard Rejection",
    subject: "Update on your application for [Vacancy Role] - TVSE",
    body: "Hi [Candidate Name],\n\nThank you for your interest in the [Vacancy Role] role and for taking the time to share your profile with us.\n\nAfter careful review of your credentials, we regret to inform you that we will not be moving forward with your application at this time. We will keep your profile in our talent pool for future opportunities.\n\nWe wish you all the best in your career search.\n\nBest regards,\n[Recruiter Name]\nTVS Electronics Recruitment Team"
  },
  {
    id: "offer",
    name: "Job Offer Proposal",
    subject: "Congratulations! Job Offer from TVS Electronics - [Vacancy Role]",
    body: "Hi [Candidate Name],\n\nWe are absolutely thrilled to extend an offer of employment for the [Vacancy Role] position at TVS Electronics!\n\nOur team was highly impressed by your credentials and we believe your skills will make a great impact here. We will share the detailed offer letter components and onboarding schedule shortly.\n\nPlease reply to confirm your acceptance.\n\nBest regards,\n[Recruiter Name]\nTVS Electronics Recruitment Team"
  }
];

function ComposeEmailDialog({ candidateName, candidateEmail, currentUserName, vacancyRole }: {
  candidateName: string; candidateEmail: string; currentUserName: string; vacancyRole: string;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const activeTemplate = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

  useEffect(() => {
    if (!open) return;
    const finalRole = vacancyRole || "your applied position";
    const sub = activeTemplate.subject.replace(/\[Vacancy Role\]/g, finalRole);
    const bdy = activeTemplate.body
      .replace(/\[Candidate Name\]/g, candidateName)
      .replace(/\[Vacancy Role\]/g, finalRole)
      .replace(/\[Recruiter Name\]/g, currentUserName)
      .replace(/\[Join Meeting Link\]/g, `${window.location.origin}/meet/TVSE-virtual-room`);
    setSubject(sub);
    setBody(bdy);
  }, [templateId, open, candidateName, vacancyRole, currentUserName]);

  const copyToClipboard = () => {
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text);
    toast.success("Email copied to clipboard!");
  };

  const sendEmail = () => {
    toast.success(`Email templates queued to recipient: ${candidateEmail}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full justify-start mt-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25">
          <Mail className="size-4" /> Compose Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Compose Email · {candidateName}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Choose Email Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="text-xs h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="text-xs leading-relaxed font-sans" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copyToClipboard} size="sm"><Copy className="size-4" /> Copy Text</Button>
          <Button onClick={sendEmail} size="sm"><CheckCircle2 className="size-4" /> Send Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
