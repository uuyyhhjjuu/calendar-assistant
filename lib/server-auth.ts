import { cookies, headers } from "next/headers";
import { db } from "./db";
import { getCookieConfig, verifySessionToken } from "./auth";

export async function requireCalendarAccess(slug: string) {
  const cookieStore = await cookies();
  const { name } = getCookieConfig();
  const token = cookieStore.get(name)?.value;
  if (!token) {
    return { ok: false as const, status: 401, message: "未解锁日历" };
  }

  try {
    const payload = await verifySessionToken(token);
    if (payload.slug !== slug) {
      return { ok: false as const, status: 403, message: "会话不匹配" };
    }

    const query = await db.query("select id, slug from calendars where id = $1 and slug = $2", [
      payload.calendarId,
      slug,
    ]);

    if (query.rowCount === 0) {
      return { ok: false as const, status: 403, message: "日历不存在" };
    }

    return { ok: true as const, calendarId: payload.calendarId };
  } catch {
    return { ok: false as const, status: 401, message: "会话已过期" };
  }
}

export async function getClientIp() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}