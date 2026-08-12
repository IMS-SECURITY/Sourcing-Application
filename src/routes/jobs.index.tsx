import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { COL, type VacancyDoc } from "@/integrations/firebase/schema";
import { listRecent, listDocs, toDateSafe } from "@/integrations/firebase/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Briefcase, ArrowRight } from "lucide-react";
import { format } from "date-fns";

import { where } from "firebase/firestore";

import { useAuth } from "@/hooks/use-auth";
import { TvseLoader } from "@/components/tvse-loader";

export const Route = createFileRoute("/jobs/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Open jobs — TVS Electronics" },
      { name: "description", content: "Browse live IT openings on TVS Electronics and apply in one click." },
      { property: "og:title", content: "Open jobs — TVS Electronics" },
      { property: "og:description", content: "Browse live IT openings on TVS Electronics and apply in one click." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobList,
});

function JobList() {
  const [q, setQ] = useState("");
  const { user, loading: loadingUser } = useAuth();

  const { data: jobs = [], isLoading } = useQuery<VacancyDoc[]>({
    queryKey: ["public-jobs"],
    queryFn: async () => {
      return await listRecent<VacancyDoc>(
        COL.vacancies,
        where("published", "==", true),
        where("status", "in", ["open", "in_progress"])
      );
    },
  });

  const filtered = jobs.filter((j) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      j.role.toLowerCase().includes(s) ||
      (j.location ?? "").toLowerCase().includes(s) ||
      (j.skills ?? []).some((k) => k.toLowerCase().includes(s)) ||
      (j.client_name ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex flex-col select-none">
            <div className="font-extrabold italic text-2xl tracking-tighter leading-none text-primary font-sans uppercase">
              TVSE
            </div>
            <div className="text-[7px] font-bold italic tracking-widest text-primary uppercase mt-1 leading-none">
              TVS ELECTRONICS
            </div>
          </Link>
          <div className="flex gap-2">
            {!loadingUser && user ? (
              <Button asChild variant="outline">
                <Link to="/portal">Go to portal</Link>
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link to="/auth" search={{ as: "candidate" }}>Candidate sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Open positions</h1>
        <p className="text-muted-foreground mt-1">{jobs.length} live {jobs.length === 1 ? "opening" : "openings"} across all clients.</p>

        <div className="relative mt-6 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role, skill, location…" className="pl-9" />
        </div>

        <div className="mt-8 space-y-3">
          {isLoading && <TvseLoader className="py-12" />}
          {!isLoading && filtered.length === 0 && <div className="text-muted-foreground border rounded-lg p-12 text-center">No openings match your search.</div>}
          {filtered.map((j) => (
            <Link key={j.id} to="/jobs/$id" params={{ id: j.id }} className="block border rounded-lg p-5 hover:border-primary/50 hover:shadow-md transition bg-card group duration-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition duration-200">{j.role}</h3>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><Briefcase className="size-3" /> {j.client_name ?? "—"}</span>
                    {j.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {j.location}</span>}
                    <span>{j.level}</span>
                    {(j.experience_min || j.experience_max) && <span>{j.experience_min ?? "?"}–{j.experience_max ?? "?"} yrs</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(j.skills ?? []).slice(0, 6).map((s) => <span key={s} className="text-xs bg-secondary px-2 py-0.5 rounded-md">{s}</span>)}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <div>{format(toDateSafe(j.created_at), "PP")}</div>
                  <ArrowRight className="size-4 mt-2 ml-auto group-hover:translate-x-1 group-hover:text-primary transition duration-200" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
