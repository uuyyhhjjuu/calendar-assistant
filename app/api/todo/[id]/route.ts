import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCalendarAccess } from "@/lib/server-auth";
import { todoUpdateSchema } from "@/lib/validators";

const deleteSchema = z.object({ slug: z.string().min(8) });

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const raw = await request.json();
  const parsed = todoUpdateSchema.safeParse(raw);
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

  if (parsed.data.content !== undefined) {
    fields.push(`content = $${idx++}`);
    values.push(parsed.data.content);
  }
  if (parsed.data.done !== undefined) {
    fields.push(`done = $${idx++}`);
    values.push(parsed.data.done);
  }
  if (parsed.data.sortOrder !== undefined) {
    fields.push(`sort_order = $${idx++}`);
    values.push(parsed.data.sortOrder);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  }

  values.push(id, auth.calendarId);
  const result = await db.query(
    `update todos set ${fields.join(", ")}, updated_at = now()
     where id = $${idx++} and calendar_id = $${idx}
     returning id`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "待办不存在" }, { status: 404 });
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

  const result = await db.query("delete from todos where id = $1 and calendar_id = $2", [
    id,
    auth.calendarId,
  ]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "待办不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}