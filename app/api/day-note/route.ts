import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { noteSchema } from "@/lib/validators";
import { requireCalendarAccess } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  const raw = await request.json();
  const parsed = noteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await db.query(
    `insert into day_notes (calendar_id, date, note)
     values ($1, $2, $3)
     on conflict (calendar_id, date)
     do update set note = excluded.note, updated_at = now()`,
    [auth.calendarId, parsed.data.date, parsed.data.note]
  );

  return NextResponse.json({ ok: true });
}