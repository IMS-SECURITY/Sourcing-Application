import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { waitForFirebaseUser, signInWithEmail, signUpWithEmail, signInWithGoogle, getUserRoles } from "@/integrations/firebase/auth";
import { ensureUserRecord } from "@/integrations/firebase/provisioning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Briefcase, Users, Mail, ArrowLeft, Lock } from "lucide-react";

const searchSchema = z.object({ as: z.enum(["candidate", "recruiter"]).default("recruiter") });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const user = await waitForFirebaseUser();
    if (user) {
      const roles = await getUserRoles(user.uid);
      const candidateOnly = roles.includes("candidate") && !roles.some((r) => r !== "candidate");
      throw redirect({ to: candidateOnly ? "/portal" : "/dashboard" });
    }
  },
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const { as } = Route.useSearch();
  const isCandidate = as === "candidate";
  const [mode, setMode] = useState<Mode>("signin");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className={`hidden lg:flex flex-col justify-between p-12 ${isCandidate ? "bg-accent text-accent-foreground" : "bg-sidebar text-sidebar-foreground"}`}>
        <div className="flex flex-col select-none">
          <div className="font-extrabold italic text-2xl tracking-tighter leading-none text-primary font-sans uppercase">
            TVSE
          </div>
          <div className="text-[7px] font-bold italic tracking-widest text-primary uppercase mt-1 leading-none">
            TVS ELECTRONICS
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          {isCandidate ? <Users className="size-10" /> : <Briefcase className="size-10" />}
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            {isCandidate ? <>Find your next role.<br />Track every step.</> : <>Hire faster.<br />Replace seamlessly.</>}
          </h2>
          <p className="opacity-80">
            {isCandidate
              ? "Apply to open IT positions, track your application status, and join interviews — all in one place."
              : "End-to-end recruitment, replacement-hiring SLA tracking, candidate pipelines, and in-app interview orchestration."}
          </p>
        </div>
        <div className="text-xs opacity-50">© TVS Electronics</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-2 text-xs">
            <Link to="/" className="text-muted-foreground hover:underline flex items-center gap-1"><ArrowLeft className="size-3" /> Home</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/auth" search={{ as: isCandidate ? "recruiter" : "candidate" }} className="text-muted-foreground hover:underline">
              Switch to {isCandidate ? "staff" : "candidate"} portal
            </Link>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isCandidate ? "Candidate portal" : "Staff portal"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Sign in with your email and password." : "Create your account with email and password."}
            </p>
          </div>

          {isCandidate ? (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-4">
                <SignInPanel isCandidate />
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <SignUpPanel />
              </TabsContent>
            </Tabs>
          ) : (
            <SignInPanel isCandidate={false} />
          )}

          {!isCandidate && (
            <p className="text-xs text-muted-foreground text-center">
              Staff accounts are created by an admin. Contact your HR admin if you need access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SignInPanel({ isCandidate }: { isCandidate: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    try {
      const cred = await signInWithGoogle();
      const roles = await ensureUserRecord(cred.user, isCandidate ? "candidate" : "recruiter");
      window.location.href = roles.some((r) => r !== "candidate") ? "/dashboard" : "/portal";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cred = await signInWithEmail(email, password);
      const roles = await ensureUserRecord(cred.user, isCandidate ? "candidate" : "recruiter");
      toast.success("Signed in");
      window.location.href = roles.some((r) => r !== "candidate") ? "/dashboard" : "/portal";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <div className="relative">
          <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="you@company.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Password</Label>
        <div className="relative">
          <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy || !email || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      {isCandidate && (
        <>
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground">or</span></div>
          </div>
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={google}>
            Continue with Google
          </Button>
        </>
      )}
    </form>
  );
}

function SignUpPanel() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      const cred = await signUpWithEmail(email, password, fullName);
      const roles = await ensureUserRecord(cred.user, "candidate");
      toast.success("Account created");
      window.location.href = roles.some((r) => r !== "candidate") ? "/dashboard" : "/portal";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Full name</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <div className="relative">
          <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Password <span className="text-muted-foreground font-normal">(min 8 chars)</span></Label>
        <div className="relative">
          <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy || !email || !fullName || password.length < 8}>
        {busy ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
