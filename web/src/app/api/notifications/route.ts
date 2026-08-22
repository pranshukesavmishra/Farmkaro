import { z } from "zod";
import { ok, parseBody, requireSession, route } from "@/server/api";
import { markNotificationsRead, myNotifications } from "@/server/services";

export const GET = route(async () => {
  const user = await requireSession();
  return ok({ notifications: myNotifications(user) });
});

export const POST = route(async (req) => {
  const user = await requireSession();
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string()).max(100) }));
  markNotificationsRead(user, ids);
  return ok({ ok: true });
});
