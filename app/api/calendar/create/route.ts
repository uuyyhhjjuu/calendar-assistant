import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSlug } from "@/lib/auth";
import { createCalendarSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = createCalendarSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数非法" }, { status: 400 });
    }

    const slug = createSlug();
    const passcodeHash = await bcrypt.hash(parsed.data.passcode, 12);

    await db.query(
      `insert into calendars (slug, passcode_hash, timezone)
       values ($1, $2, $3)`,
      [slug, passcodeHash, parsed.data.timezone]
    );

    return NextResponse.json({ slug });
  } catch (error) {
    console.error("create calendar failed:", error);
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: "创建失败", detail }, { status: 500 });
  }
}