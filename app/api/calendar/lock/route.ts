import { NextResponse } from "next/server";
import { getClearedSessionCookie } from "@/lib/session-cookie";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const cookie = getClearedSessionCookie(process.env.NODE_ENV === "production");
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
