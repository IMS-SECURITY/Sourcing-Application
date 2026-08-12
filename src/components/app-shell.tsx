import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Users, Building2, BarChart3, LogOut, UserCircle, Search, ClipboardList, Video, Shield } from "lucide-react";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { firebaseSignOut } from "@/integrations/firebase/auth";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const staffNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vacancies", label: "Vacancies", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/interviews", label: "Interviews", icon: Video },
  { to: "/clients", label: "Clients", icon: Building2 },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

const soonNav = [] as const;

const adminNav = [
  { to: "/admin/users", label: "Staff accounts", icon: Shield },
] as const;

const candidateNav = [
  { to: "/portal", label: "My applications", icon: ClipboardList },
  { to: "/jobs", label: "Browse jobs", icon: Search },
] as const;

const sourcerNav = [
  { to: "/vacancies", label: "Vacancies", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { roles } = useRoles(user?.id);
  const isCandidate = roles.includes("candidate") && !roles.some((r) => r !== "candidate");
  const isSourcer = roles.includes("sourcer") && !roles.includes("hr_admin") && !roles.includes("recruitment_manager") && !roles.includes("recruiter");
  const isAdmin = roles.includes("hr_admin");
  const nav = isCandidate ? candidateNav : isSourcer ? sourcerNav : staffNav;

  async function signOut() {
    await firebaseSignOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link to="/" className="flex flex-col select-none group px-1">
            <div className="font-extrabold italic text-2xl tracking-tighter leading-none text-primary font-sans uppercase">
              TVSE
            </div>
            <div className="text-[7px] font-bold italic tracking-widest text-primary uppercase mt-1 leading-none">
              TVS ELECTRONICS
            </div>
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold mt-3.5 border-t border-sidebar-border pt-1.5">
              {isCandidate ? "Candidate Portal" : isSourcer ? "Sourcer OS" : "Recruitment OS"}
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {[...nav, ...(isAdmin && !isCandidate ? adminNav : [])].map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80"
                }`}
              >
                <Icon className="size-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-2 px-2 text-xs">
            <UserCircle className="size-4 opacity-70" />
            <div className="flex-1 min-w-0">
              <div className="truncate">{user?.email}</div>
              <div className="text-[10px] opacity-60 uppercase">{roles[0]?.replace(/_/g, " ") ?? "no role"}</div>
            </div>
          </div>
          <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="px-8 py-6 border-b bg-card flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
