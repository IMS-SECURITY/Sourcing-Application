import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { waitForFirebaseUser } from "@/integrations/firebase/auth";
import { adminCreateStaffUser } from "@/lib/auth.functions";
import { COL } from "@/integrations/firebase/schema";
import { getDocById, setDocIn } from "@/integrations/firebase/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { TvsePageLoader } from "@/components/tvse-loader";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: async () => {
    const user = await waitForFirebaseUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: AdminUsersPage,
});

function randomPassword(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function AdminUsersPage() {
  const { user } = useAuth();
  const { roles, loading: loadingRoles } = useRoles(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loadingRoles && !roles.includes("hr_admin")) {
      navigate({ to: "/dashboard" });
    }
  }, [roles, loadingRoles, navigate]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"recruiter" | "hr_admin">("recruiter");
  const [password, setPassword] = useState(() => randomPassword());
  const [busy, setBusy] = useState(false);

  const [alertEmails, setAlertEmails] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    getDocById<{ emails: string }>(COL.appMeta, "settings").then((doc) => {
      if (doc?.emails) {
        setAlertEmails(doc.emails);
      }
    });
  }, []);

  if (loadingRoles) {
    return <TvsePageLoader />;
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDocIn(COL.appMeta, "settings", { emails: alertEmails });
      toast.success("Notification settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminCreateStaffUser({ data: { email, fullName, role, password } });
      if ("emailWarning" in res && res.emailWarning) {
        toast.warning(`User created, but email failed: ${res.emailWarning}`);
      } else {
        toast.success(`${role === "hr_admin" ? "HR admin" : "Recruiter"} account created and credentials emailed.`);
      }
      setEmail(""); setFullName(""); setPassword(randomPassword());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Staff accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">Create recruiter or HR admin accounts. Credentials are emailed to the user.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="size-5" /> New staff user</CardTitle>
          <CardDescription>They'll sign in with the email and password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "recruiter" | "hr_admin")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                    <SelectItem value="hr_admin">HR admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>Regenerate</Button>
                </div>
              </div>
            </div>
            <Button type="submit" disabled={busy || !email || !fullName || password.length < 8}>
              {busy ? "Creating…" : "Create account & email credentials"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">✉️ Notification Settings</CardTitle>
          <CardDescription>Configure which staff emails receive alerts when new candidates are added or apply.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Staff Alert Emails (comma-separated)</Label>
              <Input
                placeholder="recruiter1@tvse.com, hr@tvse.com"
                value={alertEmails}
                onChange={(e) => setAlertEmails(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Alerts will be sent to all listed emails when new candidates register or are sourced.</p>
            </div>
            <Button type="submit" disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
