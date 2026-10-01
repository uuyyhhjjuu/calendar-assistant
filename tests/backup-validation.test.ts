import assert from "node:assert/strict";
import test from "node:test";

test("拒绝非日历 JSON，避免将无关文件当作空备份覆盖内容", async () => {
  const { importSchema } = await import("../lib/backup-validation.ts");
  assert.equal(importSchema.safeParse({ slug: "test-calendar", payload: {} }).success, false);
  assert.equal(importSchema.safeParse({ slug: "test-calendar", payload: { events: [] } }).success, false);
});

test("完整旧版备份可恢复，缺少类型时使用工作类型", async () => {
  const { importSchema } = await import("../lib/backup-validation.ts");
  const result = importSchema.safeParse({
    slug: "test-calendar",
    payload: {
      events: [{ date: "2026-10-01", period: "afternoon", title: "策略讨论", status: "active", startTime: "14:00:00", endTime: "15:00:00" }],
      dayNotes: [{ date: "2026-10-01", note: "准备材料" }],
      todos: [{ content: "整理笔记", done: false, sortOrder: 3 }],
    },
  });
  assert.ok(result.success);
  assert.equal(result.data.payload.events[0].type, "work");
});
