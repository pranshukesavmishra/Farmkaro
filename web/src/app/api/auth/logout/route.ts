import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { route } from "@/server/api";
import { logout, SESSION_COOKIE } from "@/server/auth";

export const POST = route(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) logout(token);
  const out = NextResponse.json({ ok: true });
  out.cookies.delete(SESSION_COOKIE);
  return out;
});
