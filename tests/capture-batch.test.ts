import assert from "node:assert/strict";
import test from "node:test";

async function batch(input: string) {
  const module = await import("../lib/capture-parser.ts");
  assert.equal(typeof module.parseScheduleBatch, "function", "multi-event parser must exist");
  return module.parseScheduleBatch(input, "2026-10-01");
}

test("语音连续句拆出同日和跨日三条，沿用日期时提示确认", async () => {
  const result = await batch("明天上午九点开会，下午三点见客户，后天晚上七点和朋友聚餐");
  assert.deepEqual(result.schedules.map(({ draft }) => [draft.date, draft.startTime, draft.title]), [
    ["2026-10-02", "09:00", "开会"], ["2026-10-02", "15:00", "见客户"], ["2026-10-03", "19:00", "和朋友聚餐"],
  ]);
  assert.ok(result.schedules[1].warnings.some((value) => value.includes("沿用")));
});

test("时间区间不拆成两条，同一天两场会议保留各自起止时间", async () => {
  const result = await batch("10月8日上午九点到十点产品会议；下午三点半到四点策略交流");
  assert.deepEqual(result.schedules.map(({ draft }) => [draft.startTime, draft.endTime, draft.title]), [
    ["09:00", "10:00", "产品会议"], ["15:30", "16:00", "策略交流"],
  ]);
});

test("截图多组主题时间地点不串行，每组地点归入自己的日程", async () => {
  const result = await batch("主题：产品交流\n时间：2026年10月8日 14:30-15:30\n地点：上海会议室\n\n主题：羽毛球\n时间：2026年10月9日 19:00-20:00\n地点：体育馆");
  assert.equal(result.schedules.length, 2);
  assert.deepEqual(result.schedules.map(({ draft }) => [draft.title, draft.date, draft.description]), [
    ["产品交流", "2026-10-08", "地点：上海会议室"], ["羽毛球", "2026-10-09", "地点：体育馆"],
  ]);
});

test("一条日程的多行字段不拆分，缺失日期不偷偷当作今天", async () => {
  assert.equal((await batch("主题：开会\n日期：10月8日\n时间：14:00-15:00\n地点：办公室")).schedules.length, 1);
  const result = await batch("上午九点开会\n下午三点见客户");
  assert.equal(result.schedules.length, 2);
  assert.ok(result.schedules.every(({ draft }) => draft.date === ""));
});

test("每行明确日期的清单拆分，数字和重复日期不会误并入标题", async () => {
  const result = await batch("1）10月8日 09:00-10:00 开会\n2）10月8日 14:00-15:00 交流\n3）10月9日 19:00 跑步");
  assert.deepEqual(result.schedules.map(({ draft }) => draft.title), ["开会", "交流", "跑步"]);
  assert.equal(result.schedules[1].draft.date, "2026-10-08");
});

test("一个跨日描述不凭空拆成两条，过多日程要求分批而不是静默截断", async () => {
  const ambiguous = await batch("10月8日到10月9日 14:00 项目培训");
  assert.equal(ambiguous.schedules.length, 1);
  assert.ok(ambiguous.schedules[0].warnings.length > 0);
  const many = await batch(Array.from({ length: 21 }, (_, index) => `10月8日 14:00 会议${index}`).join("\n"));
  assert.equal(many.schedules.length, 0);
  assert.ok(many.warnings.some((value) => value.includes("20")));
});

test("未指定时间但有不同日期的两个事项也会拆开", async () => {
  const result = await batch("明天开会，后天和朋友聚餐");
  assert.deepEqual(result.schedules.map(({ draft }) => [draft.date, draft.title]), [
    ["2026-10-02", "开会"], ["2026-10-03", "和朋友聚餐"],
  ]);
});

test("剪贴板图片可以从文件和 item 读取，文字粘贴不会被当作图片", async () => {
  const module = await import("../lib/capture-transfer.ts").catch(() => null);
  assert.ok(module, "image transfer helper should exist");
  const file = new File(["test"], "screenshot.png", { type: "image/png" });
  assert.equal(module.getCaptureImage({ files: [file] }), file);
  assert.equal(module.getCaptureImage({ files: [], items: [{ kind: "file", type: "image/png", getAsFile: () => file }] }), file);
  assert.equal(module.getCaptureImage({ files: [], items: [{ kind: "string", type: "text/plain", getAsFile: () => null }] }), null);
});
test("截图 OCR 的中文空格和空行不会串掉两场安排的标题地点", async () => {
  const { parseScheduleBatch } = await import("../lib/capture-parser.ts");
  const result = parseScheduleBatch("主题 : 消费 行业 交流\n\n时 间 : 2026 年 10 月 8 日 14:00-15:00\n地 点 : 陆家嘴 会 议 室\n\n主题 : 朋友 聚餐\n\n时 间 : 2026 年 10 月 9 日 19:00-20:00\n地 点 : 人 民 广 场 餐厅", "2026-10-01");
  assert.equal(result.schedules.length, 2);
  assert.deepEqual(result.schedules.map(({ draft }) => [draft.title, draft.date, draft.description]), [
    ["消费行业交流", "2026-10-08", "地点：陆家嘴会议室"],
    ["朋友聚餐", "2026-10-09", "地点：人民广场餐厅"],
  ]);
});
