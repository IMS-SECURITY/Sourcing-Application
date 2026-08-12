import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/integrations/firebase/auth-middleware";

export const sendMyHrDigest = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { runHrDigest } = await import("./hr-digest-core.server");
    return runHrDigest({ onlyUserId: context.userId });
  });

