import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCalendarAccess } from "@/lib/server-auth";
import { eventSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const raw = await request.json();
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const startTime = parsed.data.startTime || null;
  const endTime = parsed.data.endTime || null;
  const description = parsed.data.description || null;

  const result = await db.query(
    `insert into events (
      calendar_id, date, period, event_type, start_time, end_time, title, description, status
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning id`,
    [
      auth.calendarId,
      parsed.data.date,
      parsed.data.period,
      parsed.data.type,
      startTime,
      endTime,
      parsed.data.title,
      description,
      parsed.data.status ?? "active",
    ]
  );

  return NextResponse.json({ id: result.rows[0].id });
}