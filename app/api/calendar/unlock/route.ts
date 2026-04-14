import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCookieConfig, signSessionToken } from "@/lib/auth";
import { unlockSchema } from "@/lib/validators";
import { canAttempt, registerFailure, resetAttempts } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = unlockSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数非法" }, { status: 400 });
    }

    const ip = await getClientIp();
    const key = `${ip}:${parsed.data.slug}`;
    const gate = canAttempt(key);
    if (!gate.allowed) {
      return NextResponse.json(
        { error: `尝试过多，请在 ${gate.retryAfterSec} 秒后重试` },
        { status: 429 }
      );
    }

    const query = await db.query(
      "select id, slug, passcode_hash from calendars where slug = $1",
      [parsed.data.slug]
    );

    if (query.rowCount === 0) {
      registerFailure(key);
      return NextResponse.json({ error: "链接不存在" }, { status: 404 });
    }

    const row = query.rows[0] as { id: string; slug: string; passcode_hash: string };
    const ok = await bcrypt.compare(parsed.data.passcode, row.passcode_hash);
    if (!ok) {
      registerFailure(key);
      return NextResponse.json({ error: "口令错误" }, { status: 401 });
    }

    resetAttempts(key);
    const token = await signSessionToken({ calendarId: row.id, slug: row.slug });
    const cookie = getCookieConfig();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookie.name, token, cookie.options);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "解锁失败" }, { status: 500 });
  }
}