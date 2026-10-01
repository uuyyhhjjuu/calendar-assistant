import { NextRequest, NextResponse } from "next/server";
import { importSchema } from "@/lib/backup-validation";
import { db } from "@/lib/db";
import { requireCalendarAccess } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  const raw = await request.json();
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "导入格式错误" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("delete from events where calendar_id = $1", [auth.calendarId]);
    await client.query("delete from day_notes where calendar_id = $1", [auth.calendarId]);
    await client.query("delete from todos where calendar_id = $1", [auth.calendarId]);

    for (const item of parsed.data.payload.events) {
      await client.query(
        `insert into events (
          calendar_id, date, period, event_type, start_time, end_time, title, description, status
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          auth.calendarId,
          item.date,
          item.period,
          item.type ?? "work",
          item.startTime ?? null,
          item.endTime ?? null,
          item.title,
          item.description ?? null,
          item.status ?? "active",
        ]
      );
    }

    for (const note of parsed.data.payload.dayNotes) {
      await client.query(
        `insert into day_notes (calendar_id, date, note)
         values ($1, $2, $3)
         on conflict (calendar_id, date)
         do update set note = excluded.note, updated_at = now()`,
        [auth.calendarId, note.date, note.note]
      );
    }

    let order = 0;
    for (const todo of parsed.data.payload.todos) {
      await client.query(
        `insert into todos (calendar_id, content, done, sort_order)
         values ($1, $2, $3, $4)`,
        [auth.calendarId, todo.content, todo.done, todo.sortOrder ?? order]
      );
      order += 1;
    }

    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "导入失败" }, { status: 500 });
  } finally {
    client.release();
  }
}
