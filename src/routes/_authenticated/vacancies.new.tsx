import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addDays, format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { COL, type ClientDoc } from "@/integrations/firebase/schema";
import { createDocIn, listDocs, orderBy } from "@/integrations/firebase/db";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vacancies/new")({
  component: NewVacancy,
});

function NewVacancy() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listDocs<ClientDoc>(COL.clients, orderBy("name")).catch(() => listDocs<ClientDoc>(COL.clients)),
  });

  const [form, setForm] = useState({
    role: "",
    client_id: "",
    new_client_name: "",
    level: "L2" as "L1" | "L2" | "L3" | "L4",
    location: "",
    experience_min: "",
    experience_max: "",
    skills: "",
    openings: 1,
    vacancy_type: "new_requirement" as "new_requirement" | "replacement",
    target_hiring_date: "",
    description: "",
  });

  const [repl, setRepl] = useState({
    employee_name: "",
    employee_code: "",
    resignation_date: "",
    notice_period_days: 30,
    last_working_date: "",
    early_relieving_date: "",
  });

  // Auto-calc last working date when resignation date / notice period changes
  function onResignationChange(date: string) {
    const lwd = date ? format(addDays(new Date(date), repl.notice_period_days), "yyyy-MM-dd") : "";
    setRepl({ ...repl, resignation_date: date, last_working_date: lwd });
  }
  function onNoticeChange(days: number) {
    const lwd = repl.resignation_date ? format(addDays(new Date(repl.resignation_date), days), "yyyy-MM-dd") : repl.last_working_date;
    setRepl({ ...repl, notice_period_days: days, last_working_date: lwd });
  }

  const deploymentDeadline =
    form.vacancy_type === "replacement" && (repl.early_relieving_date || repl.last_working_date)
      ? format(addDays(new Date(repl.early_relieving_date || repl.last_working_date), 1), "yyyy-MM-dd")
      : null;

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");

      let clientId = form.client_id || null;
      let clientName = clients.find((c) => c.id === form.client_id)?.name ?? null;
      if (!clientId && form.new_client_name.trim()) {
        clientName = form.new_client_name.trim();
        clientId = await createDocIn(COL.clients, {
          name: clientName,
          contact_person: null,
          contact_email: null,
          notes: null,
          created_by: user.id,
        });
      }

      const targetDate =
        form.vacancy_type === "replacement" ? deploymentDeadline : form.target_hiring_date || null;

      const vacancyId = await createDocIn(COL.vacancies, {
        role: form.role,
        description: form.description || null,
        client_id: clientId,
        client_name: clientName,
        level: form.level,
        status: "open",
        vacancy_type: form.vacancy_type,
        openings: form.openings,
        location: form.location || null,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        experience_min: form.experience_min ? Number(form.experience_min) : null,
        experience_max: form.experience_max ? Number(form.experience_max) : null,
        target_hiring_date: targetDate,
        deployment_deadline: deploymentDeadline,
        hiring_manager_id: null,
        recruitment_manager_id: null,
        created_by: user.id,
        published: true,
      });

      if (form.vacancy_type === "replacement") {
        await createDocIn(COL.replacements, {
          vacancy_id: vacancyId,
          employee_name: repl.employee_name,
          employee_code: repl.employee_code || null,
          resignation_date: repl.resignation_date,
          notice_period_days: repl.notice_period_days,
          last_working_date: repl.last_working_date,
          early_relieving_date: repl.early_relieving_date || null,
          deployment_deadline: deploymentDeadline,
        });
      }
      return vacancyId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["vacancies"] });
      qc.invalidateQueries({ queryKey: ["vacancies-all"] });
      toast.success("Vacancy created");
      navigate({ to: "/vacancies/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="New vacancy" subtitle="Create a requirement and (optionally) replacement details" />
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="p-8 max-w-4xl space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Requirement</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Field label="Role *">
              <Input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Senior React Engineer" />
            </Field>
            <Field label="Client">
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!form.client_id && (
                <Input className="mt-2" placeholder="…or new client name" value={form.new_client_name} onChange={(e) => setForm({ ...form, new_client_name: e.target.value })} />
              )}
            </Field>
            <Field label="Level">
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as never })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["L1", "L2", "L3", "L4"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Bangalore / Remote" />
            </Field>
            <Field label="Experience (years)">
              <div className="flex gap-2">
                <Input type="number" min={0} step={0.5} placeholder="Min" value={form.experience_min} onChange={(e) => setForm({ ...form, experience_min: e.target.value })} />
                <Input type="number" min={0} step={0.5} placeholder="Max" value={form.experience_max} onChange={(e) => setForm({ ...form, experience_max: e.target.value })} />
              </div>
            </Field>
            <Field label="Openings">
              <Input type="number" min={1} value={form.openings} onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })} />
            </Field>
            <Field label="Skills (comma-separated)" full>
              <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, TypeScript, GraphQL" />
            </Field>
            <Field label="Description" full>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Vacancy type">
              <Select value={form.vacancy_type} onValueChange={(v) => setForm({ ...form, vacancy_type: v as never })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_requirement">New Requirement</SelectItem>
                  <SelectItem value="replacement">Replacement</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.vacancy_type === "new_requirement" && (
              <Field label="Target hiring date">
                <Input type="date" value={form.target_hiring_date} onChange={(e) => setForm({ ...form, target_hiring_date: e.target.value })} />
              </Field>
            )}
          </CardContent>
        </Card>

        {form.vacancy_type === "replacement" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Replacement details</CardTitle>
              <p className="text-xs text-muted-foreground">Deployment Deadline = (Early Relieving Date OR Last Working Date) + 1 day</p>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Current employee *">
                <Input required value={repl.employee_name} onChange={(e) => setRepl({ ...repl, employee_name: e.target.value })} />
              </Field>
              <Field label="Employee ID">
                <Input value={repl.employee_code} onChange={(e) => setRepl({ ...repl, employee_code: e.target.value })} />
              </Field>
              <Field label="Resignation date *">
                <Input type="date" required value={repl.resignation_date} onChange={(e) => onResignationChange(e.target.value)} />
              </Field>
              <Field label="Notice period (days)">
                <Input type="number" min={0} value={repl.notice_period_days} onChange={(e) => onNoticeChange(Number(e.target.value))} />
              </Field>
              <Field label="Last working date *">
                <Input type="date" required value={repl.last_working_date} onChange={(e) => setRepl({ ...repl, last_working_date: e.target.value })} />
              </Field>
              <Field label="Early relieving date (optional)">
                <Input type="date" value={repl.early_relieving_date} onChange={(e) => setRepl({ ...repl, early_relieving_date: e.target.value })} />
              </Field>
              {deploymentDeadline && (
                <div className="md:col-span-2 rounded-md border bg-secondary/50 px-4 py-3 text-sm">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Computed deployment deadline</div>
                  <div className="font-semibold text-lg">{deploymentDeadline}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/vacancies" })}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create vacancy"}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
