import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCalendarAccess } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "缺少 slug" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const [calendar, events, notes, todos] = await Promise.all([
    db.query("select slug, timezone, created_at from calendars where id = $1", [auth.calendarId]),
    db.query(
      `select date, period, event_type as "type", start_time as "startTime", end_time as "endTime", title, description, status
       from events where calendar_id = $1 order by date asc, start_time asc nulls last`,
      [auth.calendarId]
    ),
    db.query("select date, note from day_notes where calendar_id = $1", [auth.calendarId]),
    db.query(
      `select content, done, sort_order as "sortOrder"
       from todos where calendar_id = $1 order by sort_order asc`,
      [auth.calendarId]
    ),
  ]);

  return NextResponse.json({
    calendar: calendar.rows[0],
    events: events.rows,
    dayNotes: notes.rows,
    todos: todos.rows,
    exportedAt: new Date().toISOString(),
  });
}