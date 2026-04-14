import { NextRequest, NextResponse } from "next/server";
import { addDays } from "@/lib/date";
import { db } from "@/lib/db";
import { requireCalendarAccess } from "@/lib/server-auth";
import { weekSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = weekSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const weekEnd = addDays(parsed.data.weekStart, 6);

  const [events, notes, todos] = await Promise.all([
    db.query(
      `select id, date, period, event_type as "type", start_time as "startTime", end_time as "endTime", title, description, status
       from events
       where calendar_id = $1 and date between $2 and $3
       order by date asc, start_time asc nulls last, created_at asc`,
      [auth.calendarId, parsed.data.weekStart, weekEnd]
    ),
    db.query(
      `select date, note
       from day_notes
       where calendar_id = $1 and date between $2 and $3`,
      [auth.calendarId, parsed.data.weekStart, weekEnd]
    ),
    db.query(
      `select id, content, done, sort_order as "sortOrder"
       from todos
       where calendar_id = $1
       order by sort_order asc, created_at asc`,
      [auth.calendarId]
    ),
  ]);

  return NextResponse.json({
    weekStart: parsed.data.weekStart,
    events: events.rows,
    dayNotes: notes.rows,
    todos: todos.rows,
  });
}