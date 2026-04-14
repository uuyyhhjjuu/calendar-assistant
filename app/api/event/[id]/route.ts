import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCalendarAccess } from "@/lib/server-auth";
import { eventSchema } from "@/lib/validators";
import { z } from "zod";

const deleteSchema = z.object({ slug: z.string().min(8) });

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const raw = await request.json();
  const parsed = eventSchema.partial().extend({ slug: z.string().min(8) }).safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.date) {
    fields.push(`date = $${idx++}`);
    values.push(parsed.data.date);
  }
  if (parsed.data.period) {
    fields.push(`period = $${idx++}`);
    values.push(parsed.data.period);
  }
  if (parsed.data.type) {
    fields.push(`event_type = $${idx++}`);
    values.push(parsed.data.type);
  }
  if (parsed.data.title) {
    fields.push(`title = $${idx++}`);
    values.push(parsed.data.title);
  }
  if (parsed.data.startTime !== undefined) {
    fields.push(`start_time = $${idx++}`);
    values.push(parsed.data.startTime || null);
  }
  if (parsed.data.endTime !== undefined) {
    fields.push(`end_time = $${idx++}`);
    values.push(parsed.data.endTime || null);
  }
  if (parsed.data.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(parsed.data.description || null);
  }
  if (parsed.data.status) {
    fields.push(`status = $${idx++}`);
    values.push(parsed.data.status);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  }

  values.push(id, auth.calendarId);
  const result = await db.query(
    `update events set ${fields.join(", ")}, updated_at = now() where id = $${idx++} and calendar_id = $${idx}
     returning id`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "日程不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const raw = await request.json();
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }

  const auth = await requireCalendarAccess(parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const result = await db.query("delete from events where id = $1 and calendar_id = $2", [
    id,
    auth.calendarId,
  ]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "日程不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}