import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCalendarAccess } from "@/lib/server-auth";
import { todoCreateSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const raw = await request.json();
  const parsed = todoCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const order = await db.query(
    "select coalesce(max(sort_order), -1) as max_order from todos where calendar_id = $1",
    [auth.calendarId]
  );

  const sortOrder = Number(order.rows[0].max_order) + 1;

  const result = await db.query(
    `insert into todos (calendar_id, content, done, sort_order)
     values ($1, $2, false, $3)
     returning id`,
    [auth.calendarId, parsed.data.content, sortOrder]
  );

  return NextResponse.json({ id: result.rows[0].id });
}