import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { COL, type ClientDoc } from "@/integrations/firebase/schema";
import { createDocIn, listDocs, orderBy, updateDocIn } from "@/integrations/firebase/db";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ResumeUpload } from "@/components/resume-upload";
import { Plus, Building2, Edit2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles(user?.id);
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-full"],
    queryFn: async () => {
      try {
        return await listDocs<ClientDoc>(COL.clients, orderBy("name"));
      } catch {
        return await listDocs<ClientDoc>(COL.clients);
      }
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact_person: "", contact_email: "", notes: "", logo_url: "" });

  useEffect(() => {
    const tvsCredit = clients.find((c) => c.name.toLowerCase() === "tvs credit" && (!c.logo_url || c.logo_url.includes("seeklogo.com")));
    if (tvsCredit) {
      const svgUrl = `data:image/svg+xml;utf8,${encodeURIComponent('<svg clip-rule="evenodd" fill-rule="evenodd" height="478" image-rendering="optimizeQuality" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" viewBox="0 -0.01 6995.62 1337.0700000000002" width="2500" xmlns="http://www.w3.org/2000/svg"><path d="M5675.63 0c361.55 0 658.29 293.33 658.29 658.29v3.41c361.55 0 658.29 293.33 658.29 658.29h3.41V-.01h-1320z" fill="#174c82"/><path d="M6371.44 620.78c286.51 0 532.09 187.59 620.78 443.41V0H5934.85c252.41 92.1 436.59 334.26 436.59 620.78z" fill="#178944"/><path d="M1964.64 1146.04h-6.82zM941.39 494.57l-40.93 143.26v3.41h68.21l40.93 668.52 320.62.01 521.87-818.61h-385.43l-47.74 143.26h81.85l-242.17 422.95V648.06h68.21l44.34-153.48H941.39zm955.03 569.61v-3.41h-160.31l-64.81 231.94s40.93 40.93 313.8 40.93c272.86 0 405.88-180.77 405.88-300.15s-85.27-156.9-126.2-187.59c-40.93-23.88-143.26-54.57-146.66-112.56v-10.23c0-51.17 75.03-64.81 98.91-64.81l3.41-.01c20.46 0 61.39 17.06 61.39 17.06v61.39h156.9s6.82-163.72 61.39-225.12c-10.23-3.41-105.73-34.1-255.81-34.1-211.47 0-392.24 95.5-419.53 231.94v34.11c0 160.3 105.74 197.83 184.19 235.35 64.8 37.52 85.27 64.81 88.68 88.68v23.87c-10.23 23.88-37.52 44.34-109.15 44.34l-10.24.01h-27.29c-40.93 0-44.34-3.41-44.34-3.41v-68.21h-10.24zM61.39 494.57h815.19l-61.39 255.81H631l17.06-81.85h-75.03l-126.2 494.57H566.2l-34.1 153.49H34.12v-3.41l51.16-150.08h85.28l115.97-501.39h-78.45l-13.65 40.93-6.82 40.93-187.59-.01 61.39-248.99z" fill="#174c82"/><path d="M61.39 494.58h815.2l-61.4 255.8H631l17.06-81.85h-75.03L446.82 1163.1H566.2l-34.11 153.49H34.11v-3.41l47.75-150.08h88.69l115.96-497.98h-78.45l-10.23 40.93-10.24 40.93H0zM1896.43 1064.19v-3.41h-160.31l-64.81 231.94s40.93 40.93 313.8 40.93c272.86 0 405.88-180.77 405.88-300.15s-85.27-156.9-126.2-187.59c-40.93-23.88-143.26-54.57-146.66-112.56v-10.23c0-51.17 75.03-64.81 98.91-64.81l3.41-.01c20.46 0 61.39 17.06 61.39 17.06v61.39h156.9s6.82-163.72 61.39-225.12c-10.23-3.41-105.73-34.1-255.81-34.1-211.47 0-392.24 95.5-419.53 231.94v34.11c0 160.3 105.74 197.83 184.19 235.35 64.8 37.52 85.27 64.81 88.68 88.68v23.87c-10.23 23.88-37.52 44.34-109.15 44.34l-10.24.01h-27.29c-40.93 0-44.34-3.41-44.34-3.41v-68.21h-10.24zM941.39 494.58l-40.93 143.25h3.41l-3.41 3.41h71.63l40.93 671.94h317.2l521.87-818.6h-385.43l-47.75 143.25h81.86l-242.17 419.54V648.06h68.22l44.33-153.48zM1964.64 1146.04h-6.82z" fill="#174c82"/><g fill="#178944"><path d="M3134.56 497.98c-40.93-10.23-88.68-17.05-139.84-17.05-57.99 0-112.56 10.23-163.72 30.7-51.17 20.46-95.5 51.16-136.44 92.09-40.93 40.93-75.04 92.1-98.92 153.49-23.88 57.99-34.1 119.38-34.1 184.19 0 115.97 37.52 214.88 109.15 286.51 71.62 71.62 167.12 109.15 286.5 109.15 30.71 0 64.81-3.41 95.5-10.24 34.11-6.82 68.22-17.06 102.32-30.7l10.24-3.41 37.52-211.47-40.93 30.7c-30.7 23.88-64.8 44.35-98.91 57.99-34.11 13.65-68.21 20.46-105.74 20.46-71.62 0-129.61-23.88-173.95-68.21-44.34-47.75-68.21-105.74-68.21-180.77 0-40.93 6.82-85.28 23.88-122.79 13.64-40.93 37.52-75.03 64.81-105.73 23.88-23.88 51.16-44.35 85.27-57.99s71.63-20.46 109.15-20.46 75.04 6.82 105.74 20.46 61.39 37.52 92.09 64.81l27.29 27.28 27.28-184.19-10.24-6.82c-27.28-27.29-64.8-44.35-105.73-57.99zM3779.21 897.06c37.52-44.34 57.99-102.32 57.99-170.55 0-37.52-6.82-71.62-20.46-98.91-13.65-30.7-34.11-54.57-57.99-75.04-23.88-17.05-51.17-30.7-78.45-40.93-27.29-6.82-75.04-10.23-136.44-10.23h-156.9L3281.23 1320h156.89l44.35-334.26L3687.12 1320h180.77L3649.6 972.09c54.57-13.64 98.91-37.52 129.61-75.03zm-255.81-249c81.85 0 112.56 10.24 126.2 20.47 17.05 13.64 27.28 34.1 27.28 68.21 0 40.93-10.24 68.21-34.11 81.86-17.05 10.23-54.57 23.88-143.25 23.88h-3.41zM3888.36 1316.59h470.69l20.46-150.08h-310.38l23.88-214.88h313.79l20.47-146.67h-313.8l20.47-156.9h313.8l17.05-150.08h-470.7zM5082.15 573.03c-34.1-27.28-75.03-47.75-119.38-57.99-44.34-10.23-105.73-17.06-194.41-17.06h-180.77l-105.73 818.61h276.27c37.52 0 71.63 0 95.5-3.41 27.29-3.41 51.17-6.82 75.04-13.64 34.11-10.24 68.21-23.88 98.91-44.34 30.71-20.47 57.99-44.35 81.86-71.63 34.1-37.52 61.39-85.27 78.45-136.44s27.28-105.74 27.28-163.72c0-64.81-10.23-122.79-34.1-177.37-20.47-54.57-54.57-98.92-98.92-133.02zm-317.2 75.03c64.8 0 109.15 3.41 136.43 10.24 27.29 6.82 51.17 17.06 71.63 34.11 27.29 20.46 47.75 47.74 61.39 78.45 13.65 34.1 20.47 71.63 20.47 112.56 0 47.74-10.24 95.5-27.29 133.02-17.06 40.93-44.34 71.62-75.03 95.5-23.88 17.05-54.57 30.7-85.28 37.52-34.1 6.82-95.5 10.23-180.77 10.23l-23.88.01 68.22-518.44 34.11-.01v6.82zM5259.51 1316.59h160.32l105.73-818.61h-160.31zM5604 497.98l-17.05 153.49h204.66l-85.28 665.12h160.31l85.27-665.12h197.83l20.47-153.49z"/></g></svg>')}`;
      updateDocIn(COL.clients, tvsCredit.id, {
        logo_url: svgUrl,
      }).then(() => {
        qc.invalidateQueries({ queryKey: ["clients-full"] });
      });
    }
  }, [clients, qc]);

  const create = useMutation({
    mutationFn: async () => {
      await createDocIn(COL.clients, {
        name: form.name.trim(),
        contact_person: form.contact_person || null,
        contact_email: form.contact_email || null,
        notes: form.notes || null,
        logo_url: form.logo_url || null,
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Client added");
      setOpen(false);
      setForm({ name: "", contact_person: "", contact_email: "", notes: "", logo_url: "" });
      qc.invalidateQueries({ queryKey: ["clients-full"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Companies you recruit for"
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="size-4" /> New client</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col items-center gap-2">
                    <Label className="text-xs text-muted-foreground self-start">Client Logo</Label>
                    {form.logo_url && (
                      <img src={form.logo_url} alt="Preview" className="size-16 object-contain rounded-lg border bg-white p-1" />
                    )}
                    <ResumeUpload
                      value={form.logo_url}
                      label={form.logo_url ? "Replace logo" : "Upload logo"}
                      onChange={async (url) => setForm({ ...form, logo_url: url })}
                    />
                  </div>
                  <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
                  <div><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <div className="p-8">
        {clients.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <Building2 className="size-8 mx-auto mb-2 opacity-50" />
            <div>No clients yet.</div>
            {!isAdmin && <div className="text-xs mt-2">Only HR Admin or Recruitment Manager can add clients.</div>}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <Card key={c.id} className="relative overflow-hidden group hover:border-primary/45 transition-all duration-300">
                <CardContent className="p-5 flex items-center gap-4">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={`${c.name} logo`} className="w-24 h-12 object-contain rounded border bg-white p-1.5 shrink-0" />
                  ) : (
                    <div className="w-24 h-12 rounded border bg-secondary flex items-center justify-center shrink-0">
                      <Building2 className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{c.name}</div>
                    {c.contact_person && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 truncate">
                        <span className="font-medium text-foreground/75">Contact:</span> {c.contact_person}
                      </div>
                    )}
                    {c.contact_email && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                        <span className="font-medium text-foreground/75">Email:</span> {c.contact_email}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <EditClientDialog client={c} onDone={() => qc.invalidateQueries({ queryKey: ["clients-full"] })} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditClientDialog({ client, onDone }: { client: ClientDoc; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    contact_person: client.contact_person || "",
    contact_email: client.contact_email || "",
    logo_url: client.logo_url || "",
  });

  const update = useMutation({
    mutationFn: async () => {
      await updateDocIn(COL.clients, client.id, {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        contact_email: form.contact_email.trim() || null,
        logo_url: form.logo_url || null,
      });
    },
    onSuccess: () => {
      toast.success("Client updated");
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Edit2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex flex-col items-center gap-2">
            <Label className="text-xs text-muted-foreground self-start">Client Logo</Label>
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo" className="size-16 object-contain rounded-lg border bg-white p-1" />
            )}
            <ResumeUpload
              value={form.logo_url}
              label={form.logo_url ? "Replace logo" : "Upload logo"}
              onChange={async (url) => setForm({ ...form, logo_url: url })}
            />
          </div>
          <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
          <div><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => update.mutate()} disabled={!form.name || update.isPending}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
