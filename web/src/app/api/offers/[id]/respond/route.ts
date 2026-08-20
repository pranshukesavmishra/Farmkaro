import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { respondToOffer } from "@/server/services";

export const POST = route(async (req, ctx) => {
  const user = await requireSession();
  await limited("offer-respond", 30, 60_000);
  const { id } = await ctx.params;
  const body = await parseBody(
    req,
    z.object({
      action: z.enum(["accept", "reject", "counter", "withdraw"]),
      counter: z
        .object({
          rentAnnual: z.number().int().min(1000).max(100_000_000),
          leaseYears: z.number().min(0.5).max(30),
          note: z.string().trim().max(1000).optional(),
        })
        .optional(),
    }),
  );
  return ok(respondToOffer(user, id, body.action, body.counter));
});
