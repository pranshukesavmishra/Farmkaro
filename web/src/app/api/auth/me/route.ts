import { ok, route } from "@/server/api";
import { currentUser } from "@/server/auth";

export const GET = route(async () => ok({ user: await currentUser() }));
