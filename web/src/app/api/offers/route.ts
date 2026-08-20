import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { createOffer, myOffers } from "@/server/services";

export const POST = route(async (req) => {
  const user = await requireSession();
  await limited("offer", 20, 60_000);
  const body = await parseBody(
    req,
    z.object({
      parcelId: z.string().min(1),
      rentAnnual: z.number().int().min(1000).max(100_000_000),
      deposit: z.number().int().min(0).max(100_000_000).optional(),
      leaseYears: z.number().min(0.5).max(30),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().trim().max(1000).optional(),
    }),
  );
  return ok(createOffer(user, body), 201);
});

export const GET = route(async () => {
  const user = await requireSession();
  return ok({ offers: myOffers(user) });
});
