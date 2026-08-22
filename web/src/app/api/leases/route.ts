import { ok, requireSession, route } from "@/server/api";
import { myLeases } from "@/server/services";

export const GET = route(async () => {
  const user = await requireSession();
  return ok({ leases: myLeases(user) });
});
