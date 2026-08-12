import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/hr-daily-digest")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runHrDigest } = await import("@/lib/hr-digest-core.server");
          const result = await runHrDigest();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to trigger the digest" }),
    },
  },
});
