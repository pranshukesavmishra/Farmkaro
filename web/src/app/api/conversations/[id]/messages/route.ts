import { z } from "zod";
import { limited, ok, parseBody, requireSession, route } from "@/server/api";
import { conversationMessages, sendMessage } from "@/server/services";

export const GET = route(async (_req, ctx) => {
  const user = await requireSession();
  const { id } = await ctx.params;
  return ok({ messages: conversationMessages(user, id) });
});

export const POST = route(async (req, ctx) => {
  const user = await requireSession();
  await limited("message", 60, 60_000);
  const { id } = await ctx.params;
  const { body } = await parseBody(req, z.object({ body: z.string().trim().min(1).max(4000) }));
  sendMessage(user, id, body);
  return ok({ ok: true }, 201);
});
