import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { advanceLease } from "@/server/services";

export const POST = route(async (req, ctx) => {
  const user = await requireSession();
  await limited("lease-advance", 30, 60_000);
  const { id } = await ctx.params;
  const { to } = await parseBody(
    req,
    z.object({
      to: z.enum(["terms_agreed", "agreement_generated", "signed", "active", "completed", "terminated"]),
    }),
  );
  return ok(advanceLease(user, id, to));
});
