import assert from "node:assert/strict";
import test from "node:test";

import type { EventItem, TodoItem } from "../lib/types.ts";

type CalendarDomain = typeof import("../lib/calendar-domain.ts");

async function loadDomain(): Promise<CalendarDomain | null> {
  try {
    return await import("../lib/calendar-domain.ts");
  } catch {
    return null;
  }
}

const event = (overrides: Partial<EventItem>): EventItem => ({
  id: "event-1",
  date: "2026-09-07",
  period: "morning",
  type: "work",
  startTime: "09:00",
  endTime: "10:00",
  title: "晨会",
  description: null,
  status: "active",
  ...overrides,
});

const todo = (overrides: Partial<TodoItem>): TodoItem => ({
  id: "todo-1",
  content: "整理材料",
  done: false,
  sortOrder: 0,
  ...overrides,
});

test("按开始时间自动归入上午、下午和晚上", async () => {
  const domain = await loadDomain();
  assert.ok(domain, "calendar domain module should exist");

  assert.equal(domain.inferPeriodFromTime("08:30", "evening"), "morning");
  assert.equal(domain.inferPeriodFromTime("12:00", "morning"), "afternoon");
  assert.equal(domain.inferPeriodFromTime("17:00", "morning"), "evening");
  assert.equal(domain.inferPeriodFromTime("", "afternoon"), "afternoon");
});

test("同一格内按开始时间排序，无时间的日程排在最后", async () => {
  const domain = await loadDomain();
  assert.ok(domain, "calendar domain module should exist");

  const result = domain.sortEvents([
    event({ id: "late", startTime: "16:00" }),
    event({ id: "none", startTime: null }),
    event({ id: "early", startTime: "09:30" }),
  ]);

  assert.deepEqual(result.map((item) => item.id), ["early", "late", "none"]);
});

test("搜索同时匹配标题和备注，并可叠加类型与未完成筛选", async () => {
  const domain = await loadDomain();
  assert.ok(domain, "calendar domain module should exist");

  const items = [
    event({ id: "work", type: "work", title: "基金周会" }),
    event({ id: "social", type: "social", title: "晚餐", description: "陆家嘴见客户" }),
    event({ id: "done", type: "social", title: "客户回访", status: "done" }),
  ];

  assert.deepEqual(
    domain.filterEvents(items, { type: "social", query: "客户", activeOnly: true }).map((item) => item.id),
    ["social"]
  );
});

test("今日概览给出下一项日程和待办完成进度", async () => {
  const domain = await loadDomain();
  assert.ok(domain, "calendar domain module should exist");

  const summary = domain.getTodaySummary(
    [
      event({ id: "past", startTime: "09:00", endTime: "10:00" }),
      event({ id: "next", startTime: "14:00", endTime: "15:00", title: "策略讨论" }),
      event({ id: "done", startTime: "16:00", status: "done" }),
      event({ id: "other-day", date: "2026-09-08", startTime: "13:00" }),
    ],
    [todo({ id: "a", done: true }), todo({ id: "b", done: false })],
    "2026-09-07",
    "13:30"
  );

  assert.equal(summary.activeEventCount, 2);
  assert.equal(summary.nextEvent?.id, "next");
  assert.equal(summary.todoDoneCount, 1);
  assert.equal(summary.todoTotalCount, 2);
});

test("快速新增优先使用本周内的今天，否则使用周一", async () => {
  const domain = await loadDomain();
  assert.ok(domain, "calendar domain module should exist");

  assert.equal(domain.getQuickCreateDate("2026-09-07", "2026-09-09"), "2026-09-09");
  assert.equal(domain.getQuickCreateDate("2026-09-07", "2026-09-20"), "2026-09-07");
});

test("结束时间不能早于开始时间", async () => {
  const domain = await loadDomain();
  assert.ok(domain, "calendar domain module should exist");

  assert.equal(domain.validateTimeRange("14:00", "13:30"), "结束时间需要晚于开始时间");
  assert.equal(domain.validateTimeRange("14:00", "15:00"), null);
  assert.equal(domain.validateTimeRange("", ""), null);
});

test("手机切周时立即选择当前周内的日期", async () => {
  const domain = await loadDomain();
  assert.ok(domain);
  assert.equal(domain.getMobileDate("2026-09-14", "2026-09-09", "2026-09-09"), "2026-09-14");
  assert.equal(domain.getMobileDate("2026-09-07", "2026-09-10", "2026-09-09"), "2026-09-10");
});
