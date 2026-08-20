import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { createEnquiry, myEnquiries } from "@/server/services";

export const POST = route(async (req) => {
  const user = await requireSession();
  await limited("enquiry", 20, 60_000);
  const body = await parseBody(
    req,
    z.object({ parcelId: z.string().min(1), message: z.string().trim().min(3).max(2000) }),
  );
  return ok(createEnquiry(user, body.parcelId, body.message), 201);
});

export const GET = route(async () => {
  const user = await requireSession();
  return ok(myEnquiries(user));
});
