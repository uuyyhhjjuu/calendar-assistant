import assert from "node:assert/strict";
import test from "node:test";

test("服务端与手机端都按上海时区确定今天", async () => {
  const dateHelpers = await import("../lib/date.ts");
  assert.equal(typeof dateHelpers.toIsoDayInTimeZone, "function");
  const utcLateAfternoon = new Date("2026-09-06T16:30:00.000Z");
  assert.equal(dateHelpers.toIsoDayInTimeZone(utcLateAfternoon, "Asia/Shanghai"), "2026-09-07");
});
