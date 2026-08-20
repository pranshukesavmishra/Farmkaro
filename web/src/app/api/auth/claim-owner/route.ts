import { z } from "zod";
import { ok, parseBody, requireSession, route } from "@/server/api";
import { claimSeedOwner } from "@/server/auth";

/** Demo affordance: link this account to a sample owner so their parcels
 *  and incoming enquiries appear on the owner dashboard. */
export const POST = route(async (req) => {
  const user = await requireSession();
  const { seedOwnerId } = await parseBody(req, z.object({ seedOwnerId: z.string().min(1) }));
  const res = claimSeedOwner(user.id, seedOwnerId);
  if (!res.ok) return ok({ error: res.error }, 400);
  return ok({ ok: true });
});
