import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { setRegistrationStatus } from "@/server/services";

export const POST = route(async (req, ctx) => {
  const user = await requireSession();
  await limited("lease-reg", 30, 60_000);
  const { id } = await ctx.params;
  const { to } = await parseBody(
    req,
    z.object({ to: z.enum(["stamped", "submitted_for_registration", "registered"]) }),
  );
  return ok(setRegistrationStatus(user, id, to));
});
