import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, BarChart3, ShieldCheck, Zap, Clock, Video } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TVSE Careers — TVS Electronics" },
      { name: "description", content: "TVSE Recruitment and Vacancy Management OS: vacancies, replacement SLAs, candidate pipelines, and video interviews." },
      { property: "og:title", content: "TVSE Careers — Recruitment OS" },
      { property: "og:description", content: "Hire faster. Apply easier. Interview from anywhere." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [logoClicks, setLogoClicks] = useState(0);
  const navigate = useNavigate();

  const handleLogoClick = () => {
    const next = logoClicks + 1;
    if (next >= 5) {
      toast.info("Opening Super Admin Portal...");
      navigate({ to: "/super-admin" });
    } else {
      setLogoClicks(next);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Decorative Blur Background Blobs (Static for GPU efficiency) */}
      <div className="absolute top-[-5%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[130px] pointer-events-none z-0" />
      <div className="absolute top-[25%] right-[-15%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[65%] left-[5%] w-[450px] h-[450px] rounded-full bg-primary/5 blur-[120px] pointer-events-none z-0" />

      <header className="border-b relative z-10 bg-background/80 backdrop-blur-sm sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            className="flex flex-col cursor-pointer select-none"
            onClick={handleLogoClick}
            title="Click 5 times for Admin Portal"
          >
            <div className="font-extrabold italic text-2xl tracking-tighter leading-none text-primary font-sans uppercase">
              TVSE
            </div>
            <div className="text-[7px] font-bold italic tracking-widest text-primary uppercase mt-1 leading-none">
              TVS ELECTRONICS
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/jobs">Browse jobs</Link></Button>
            <Button asChild variant="ghost"><Link to="/auth" search={{ as: "recruiter" }}>Staff sign in</Link></Button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <section className="max-w-6xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full animate-fade-in">
            <Zap className="size-3 text-primary animate-pulse" /> One platform. Two doors.
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] max-w-3xl mx-auto animate-scale-in">
            Hire faster.<br />
            <span className="text-primary bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">Apply easier.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Pick your door — apply to live openings or run the full hiring desk with SLA tracking, pipelines, and built-in video interviews.
          </p>
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-6">
          <PortalCard
            icon={Users}
            title="For Candidates"
            desc="Browse open IT roles, apply in one click, and track your application status. Receive interview invites and join via built-in video."
            primary={{ to: "/jobs", label: "Browse open jobs" }}
            secondary={{ to: "/auth", label: "Create candidate account", search: { as: "candidate" } }}
          />
          <PortalCard
            icon={Briefcase}
            title="For Recruiters & HR"
            desc="Manage vacancies, replacement hiring SLAs, candidate pipelines, and schedule interviews. Role-based access for HR Admin, RMs, recruiters."
            primary={{ to: "/auth", label: "Staff sign in", search: { as: "recruiter" } }}
          />
        </section>

        <section className="border-t bg-secondary/40">
          <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
            <Feature icon={Briefcase} title="Vacancy management" desc="Track every requirement: client, role, level, skills, full audit timeline." />
            <Feature icon={Clock} title="Replacement SLAs" desc="Auto-compute deployment deadlines from notice period & early-relieving dates." />
            <Feature icon={Users} title="Candidate pipeline" desc="Kanban + list views, drag-and-drop stages, resume storage." />
            <Feature icon={Video} title="In-app interviews" desc="Built-in WebRTC room — no Meet/Zoom needed for 1:1 interviews." />
            <Feature icon={ShieldCheck} title="Role-based access" desc="HR Admin, Recruitment Manager, Recruiter, Hiring Manager, Candidate." />
            <Feature icon={BarChart3} title="Dashboards" desc="Recruiter performance, client-wise hiring, monthly trends, aging reports." />
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground relative z-10 bg-background/50">© TVS Electronics — Recruitment OS</footer>
    </div>
  );
}

function PortalCard({
  icon: Icon, title, desc, primary, secondary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string;
  primary: { to: string; label: string; search?: Record<string, string> };
  secondary?: { to: string; label: string; search?: Record<string, string> };
}) {
  return (
    <div 
      className="rounded-2xl border bg-card/85 backdrop-blur-sm p-8 hover:border-primary/45 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cubic-bezier(0.25, 1, 0.5, 1) group relative overflow-hidden"
    >
      {/* Glow highlight overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="relative z-10 space-y-4">
        <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition duration-300">
          <Icon className="size-6" />
        </div>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
        <div className="pt-4 flex flex-col sm:flex-row gap-2">
          <Button asChild className="active:scale-[0.98] transition">
            <Link to={primary.to as never} search={primary.search as never}>{primary.label}</Link>
          </Button>
          {secondary && (
            <Button asChild variant="outline" className="active:scale-[0.98] transition">
              <Link to={secondary.to as never} search={secondary.search as never}>{secondary.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="space-y-2 p-2 hover:translate-y-[-2px] transition-transform duration-300">
      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="size-4" />
      </div>
      <h4 className="font-bold tracking-tight text-sm">{title}</h4>
      <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
    </div>
  );
}
