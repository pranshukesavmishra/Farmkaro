/**
 * Route-handler toolkit: one place for error shaping, auth guards,
 * rate limiting and zod validation, so every endpoint behaves identically.
 */
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AuthError, clientIp, currentUser, rateLimit, type SessionUser } from "./auth";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

export function route(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse | Response>,
): Handler {
  return async (req, ctx) => {
    try {
      return (await fn(req, ctx)) as NextResponse;
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function requireSession(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new AuthError(401, "Sign in to continue.");
  return u;
}

export async function limited(bucket: string, limit: number, windowMs: number): Promise<void> {
  const ip = await clientIp();
  if (!rateLimit(`${bucket}:${ip}`, limit, windowMs))
    throw new AuthError(429, "Too many requests. Please wait a moment.");
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AuthError(400, "Invalid JSON body.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AuthError(400, `${first.path.join(".") || "body"}: ${first.message}`);
  }
  return parsed.data;
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
