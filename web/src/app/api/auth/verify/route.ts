import { z } from "zod";
import { NextResponse } from "next/server";
import { limited, parseBody, route } from "@/server/api";
import { SESSION_COOKIE, verifyOtp } from "@/server/auth";

export const POST = route(async (req) => {
  await limited("otp-verify", 10, 60_000);
  const { phone, code } = await parseBody(
    req,
    z.object({ phone: z.string().min(10).max(15), code: z.string().min(4).max(8) }),
  );
  const res = await verifyOtp(phone, code, req.headers.get("user-agent") ?? undefined);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  const out = NextResponse.json({ user: res.user });
  out.cookies.set(SESSION_COOKIE, res.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return out;
});
