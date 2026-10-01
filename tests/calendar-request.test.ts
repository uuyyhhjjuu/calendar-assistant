import assert from "node:assert/strict";
import test from "node:test";

test("断网请求返回明确失败，不抛出未处理异常", async () => {
  const { calendarRequest } = await import("../lib/calendar-request.ts");
  const result = await calendarRequest("/api/todo", {}, async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(result.response, null);
  assert.equal(result.error, "网络连接失败，本次操作尚未保存，请重试");
});

test("接口错误保留安全的错误说明，成功请求返回响应", async () => {
  const { calendarRequest } = await import("../lib/calendar-request.ts");
  const result = await calendarRequest("/api/event", {}, async () =>
    Response.json({ error: "未解锁日历" }, { status: 401 })
  );
  assert.equal(result.response?.status, 401);
  assert.equal(result.error, "未解锁日历");
  const success = await calendarRequest("/api/event", {}, async () => Response.json({ ok: true }));
  assert.equal(success.response?.ok, true);
  assert.equal(success.error, null);
});
