import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { waitForFirebaseUser } from "@/integrations/firebase/auth";
import { ensureUserRecord } from "@/integrations/firebase/provisioning";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await waitForFirebaseUser();
    if (!user) throw redirect({ to: "/auth" });
    ensureUserRecord(user).catch(() => {});
    return { user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
