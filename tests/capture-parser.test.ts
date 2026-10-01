import assert from "node:assert/strict";
import test from "node:test";

async function parser() {
  const module = await import("../lib/capture-parser.ts").catch(() => null);
  assert.ok(module, "capture parser should be implemented");
  return module;
}

test("一句话识别明天、中文下午时间及标题，不猜结束时间", async () => {
  const { parseScheduleText } = await parser();
  const result = parseScheduleText("明天下午三点和产品团队开会", "2026-10-01");
  assert.equal(result.draft.date, "2026-10-02");
  assert.equal(result.draft.startTime, "15:00");
  assert.equal(result.draft.endTime, "");
  assert.equal(result.draft.title, "和产品团队开会");
  assert.equal(result.draft.period, "afternoon");
});

test("识别下周、半点和时间区间，结束时间继承下午", async () => {
  const { parseScheduleText } = await parser();
  const result = parseScheduleText("下周一下午三点半到四点 讨论消费行业", "2026-10-01");
  assert.equal(result.draft.date, "2026-10-05");
  assert.equal(result.draft.startTime, "15:30");
  assert.equal(result.draft.endTime, "16:00");
  assert.equal(result.draft.title, "讨论消费行业");
});

test("截图常见分行格式只保留事项和地点，不默认保存整段聊天", async () => {
  const { parseScheduleText } = await parser();
  const result = parseScheduleText("主题：AI产品交流\n时间：2026年10月8日 14:30-15:30\n地点：上海会议室\n其他聊天：私人信息", "2026-10-01");
  assert.equal(result.draft.date, "2026-10-08");
  assert.equal(result.draft.startTime, "14:30");
  assert.equal(result.draft.endTime, "15:30");
  assert.equal(result.draft.title, "AI产品交流");
  assert.equal(result.draft.description, "地点：上海会议室");
  assert.ok(!result.draft.description.includes("私人信息"));
});

test("没有日期或上午下午时保留空字段并提醒，不静默当作今天凌晨", async () => {
  const { parseScheduleText } = await parser();
  const result = parseScheduleText("三点见客户", "2026-10-01");
  assert.equal(result.draft.date, "");
  assert.equal(result.draft.startTime, "");
  assert.ok(result.warnings.length >= 2);
});

test("容忍 OCR 插入的中文词内空格，正确提取主题和地点", async () => {
  const { parseScheduleText } = await parser();
  const result = parseScheduleText("主 题 : AI 产品 交流\n时 间 : 2026 年 10 月 8 日 14:30-15:30\n地 点 : 上 海 会 议 室", "2026-10-01");
  assert.equal(result.draft.title, "AI 产品交流");
  assert.equal(result.draft.description, "地点：上海会议室");
  assert.equal(result.draft.date, "2026-10-08");
  assert.equal(result.draft.startTime, "14:30");
});

test("拒绝不存在的日期、越界时间，超过一条安排提示逐条处理", async () => {
  const { parseScheduleText } = await parser();
  const invalid = parseScheduleText("2026-02-30 25:90 开会", "2026-10-01");
  assert.equal(invalid.draft.date, "");
  assert.equal(invalid.draft.startTime, "");
  const multiple = parseScheduleText("10月8日 14:00 开会\n10月9日 15:00 跑步", "2026-10-01");
  assert.ok(multiple.warnings.some((warning) => warning.includes("多")));
  assert.equal(multiple.draft.endTime, "");
});

test("晚上十二点、中午十二点及跨年相对日期不会错误加十二小时", async () => {
  const { parseScheduleText } = await parser();
  assert.equal(parseScheduleText("明天中午十二点聚餐", "2026-12-31").draft.date, "2027-01-01");
  assert.equal(parseScheduleText("今天中午十二点聚餐", "2026-10-01").draft.startTime, "12:00");
  const midnight = parseScheduleText("今晚十二点出发", "2026-10-01");
  assert.equal(midnight.draft.startTime, "");
  assert.ok(midnight.warnings.length > 0);
});

test("归类只是草稿建议，识别内容为空时不编造标题", async () => {
  const { parseScheduleText } = await parser();
  assert.equal(parseScheduleText("后天晚上七点半和朋友聚餐", "2026-10-01").draft.type, "social");
  assert.equal(parseScheduleText("10月8号上午九点半看牙医", "2026-10-01").draft.type, "personal");
  assert.equal(parseScheduleText("", "2026-10-01").draft.title, "");
});

test("图片只接受可解码的常见图片类型且限制大小，拒绝 SVG", async () => {
  const { validateCaptureImage } = await parser();
  assert.equal(validateCaptureImage({ type: "image/png", size: 1024 }), null);
  assert.ok(validateCaptureImage({ type: "image/svg+xml", size: 1024 }));
  assert.ok(validateCaptureImage({ type: "image/jpeg", size: 9 * 1024 * 1024 }));
  assert.ok(validateCaptureImage({ type: "image/png", size: 0 }));
});
