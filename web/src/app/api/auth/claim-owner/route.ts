import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { claimSeedOwner } from "@/server/auth";

/** Sandbox affordance: link this account to a sample owner so their parcels
 *  and incoming enquiries appear on the owner dashboard. Gated to demo mode
 *  and one-per-account inside claimSeedOwner; rate-limited here. */
export const POST = route(async (req) => {
  const user = await requireSession();
  await limited("claim-owner", 5, 60_000);
  const { seedOwnerId } = await parseBody(
    req,
    z.object({ seedOwnerId: z.string().regex(/^own-\d{1,4}$/) }),
  );
  const res = claimSeedOwner(user.id, seedOwnerId);
  if (!res.ok) return ok({ error: res.error }, 400);
  return ok({ ok: true });
});
