import { z } from "zod";
import { limited, ok, parseBody, route } from "@/server/api";
import { requestOtp } from "@/server/auth";

export const POST = route(async (req) => {
  await limited("otp", 5, 60_000);
  const { phone } = await parseBody(req, z.object({ phone: z.string().min(10).max(15) }));
  const res = await requestOtp(phone);
  if (!res.ok) return ok({ error: res.error }, 400);
  return ok(res);
});
