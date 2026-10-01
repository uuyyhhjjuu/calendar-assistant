import type { EventType, Period } from "./types";

export type CapturedDraft = {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  period: Period;
  type: EventType;
};

function chineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value.includes("十")) {
    const [tens, units] = value.split("十");
    return (tens ? digits[tens] : 1) * 10 + (units ? digits[units] : 0);
  }
  return digits[value] ?? Number.NaN;
}

function isoDate(year: number, month: number, day: number): string {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day
    ? value.toISOString().slice(0, 10) : "";
}

function shiftDay(reference: string, offset: number) {
  const value = new Date(`${reference}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

// Conservative local extraction, not a language model: unknown fields remain empty.
export function parseScheduleText(input: string, referenceDay: string): { draft: CapturedDraft; warnings: string[] } {
  const source = input.slice(0, 8000).normalize("NFKC").replace(/\r/g, "")
    .replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, "");
  let text = source;
  const warnings: string[] = [];
  const dates: string[] = [];
  const year = Number(referenceDay.slice(0, 4));
  const recordDate = (date: string) => {
    dates.push(date);
    if (!date) warnings.push("日期不存在，请手动确认日期。");
    return " ";
  };
  text = text.replace(/(\d{4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})\s*[日号]?/g,
    (_, y: string, m: string, d: string) => recordDate(isoDate(Number(y), Number(m), Number(d))));
  text = text.replace(/(\d{1,2})\s*(?:月|\/)\s*(\d{1,2})\s*[日号]?/g,
    (_, m: string, d: string) => recordDate(isoDate(year, Number(m), Number(d))));
  text = text.replace(/(上周|下周|本周|这周|本星期|下星期|星期|周)([一二三四五六日天])/g,
    (_, prefix: string, weekday: string) => {
      const now = new Date(`${referenceDay}T00:00:00Z`);
      const todayWeekday = (now.getUTCDay() + 6) % 7;
      const target = "一二三四五六日".indexOf(weekday === "天" ? "日" : weekday);
      let offset = target - todayWeekday;
      if (prefix.startsWith("下")) offset += 7;
      else if (prefix === "上周") offset -= 7;
      else if (prefix === "周" || prefix === "星期") {
        if (offset < 0) offset += 7;
        warnings.push("未指明哪一周，暂按最近的该星期生成，请确认日期。");
      }
      return recordDate(shiftDay(referenceDay, offset));
    });
  text = text.replace(/大后天|后天|明天|明早|明晚|今天|今日|今晚|今早|今晨/g, (value) => {
    const offset = value === "大后天" ? 3 : value === "后天" ? 2 : value.startsWith("明") ? 1 : 0;
    recordDate(shiftDay(referenceDay, offset));
    return value.endsWith("晚") ? "晚上" : /早|晨/.test(value) ? "上午" : " ";
  });
  const date = dates[0] ?? "";
  if (!dates.length) warnings.push("没有明确日期，请在下一步补充；不会自动当作今天。");
  if (new Set(dates).size > 1) warnings.push("识别到多个日期，请一次只确认一条日程，或先删去无关内容。");
  if (date && date < referenceDay) warnings.push("识别日期早于今天，请确认年份和日期。");

  const timePattern = /(上午|早上|早晨|中午|下午|傍晚|晚上|晚间|凌晨)?\s*(\d{1,2}|[零〇一二两三四五六七八九十]{1,3})(?:[:：](\d{2})|[点时](半|一刻|三刻|(?:\d{1,2}|[零〇一二两三四五六七八九十]{1,3})分?)?)/g;
  const times = [...text.matchAll(timePattern)];
  const first = times[0];
  const second = times[1];
  const isRange = first && second && /^\s*[-~～—–至到]\s*$/.test(text.slice(first.index! + first[0].length, second.index));
  function readTime(match: RegExpMatchArray | undefined, inherited = ""): string {
    if (!match) return "";
    const prefix = match[1] || inherited;
    let hour = chineseNumber(match[2]);
    const suffix = match[4];
    const minute = match[3] ? Number(match[3]) : suffix === "半" ? 30 : suffix === "一刻" ? 15 : suffix === "三刻" ? 45 : suffix ? chineseNumber(suffix.replace(/分$/, "")) : 0;
    if (hour > 23 || minute > 59 || !Number.isFinite(hour + minute)) {
      warnings.push("时间超出有效范围，请手动确认。");
      return "";
    }
    if (!prefix && !match[3] && hour <= 12) {
      warnings.push("时间没有指明上午或下午，请手动确认。");
      return "";
    }
    if (/下午|傍晚|晚上|晚间/.test(prefix) && hour === 12) {
      warnings.push("晚间十二点可能跨日，请手动填写日期和时间。");
      return "";
    }
    if (/下午|傍晚|晚上|晚间/.test(prefix) && hour < 12) hour += 12;
    if (prefix === "中午" && hour < 11) {
      if (hour <= 3) hour += 12;
      else { warnings.push("中午时间存在歧义，请确认。"); return ""; }
    }
    if (/上午|早上|早晨|凌晨/.test(prefix) && hour === 12) {
      if (prefix === "凌晨") hour = 0;
      else { warnings.push("上午十二点存在歧义，请确认。"); return ""; }
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const startTime = readTime(first);
  const endTime = isRange ? readTime(second, first[1]) : "";
  if (!times.length) warnings.push("没有明确时间，可在下一步补充或保留为待定。");
  if (times.length > (isRange ? 2 : 1)) warnings.push("识别到多个时间安排，请一次确认一条，避免误合并。");
  if (startTime && endTime && endTime <= startTime) warnings.push("结束时间不晚于开始时间，请确认是否跨日。");

  const location = source.match(/(?:^|\n)\s*(地点|地址|会议链接)\s*[:：]\s*([^\n]+)/);
  const topic = source.match(/(?:^|\n)\s*(?:主题|事项|活动|标题|会议名称)\s*[:：]\s*([^\n]+)/);
  const withoutRange = isRange ? text.slice(0, first.index) + " " + text.slice(second.index! + second[0].length) : text;
  const cleanText = withoutRange.replace(timePattern, " ").replace(/(?:^|\n)\s*(?:地点|地址|会议链接|其他聊天)\s*[:：][^\n]*/g, "");
  const title = (topic?.[1] ?? cleanText.split("\n").map((line) => line.replace(/^\s*(?:时间|日期)\s*[:：]/, "").replace(/^[\s,，。:：;；~～—–-]+|[\s,，。:：;；~～—–-]+$/g, "").trim()).find(Boolean) ?? "")
    .replace(/\s+/g, " ").slice(0, 120);
  const type: EventType = /聚餐|朋友|晚餐|聚会|约饭|婚礼/.test(title) ? "social" : /跑步|运动|羽毛球|看病|牙医|健身|家人|取快递/.test(title) ? "personal" : "work";
  const period: Period = startTime ? Number(startTime.slice(0, 2)) < 12 ? "morning" : Number(startTime.slice(0, 2)) < 17 ? "afternoon" : "evening" : /晚上|晚间|傍晚/.test(input) ? "evening" : /下午|中午/.test(input) ? "afternoon" : "morning";
  return { draft: { date, startTime, endTime, title, description: location ? `${location[1]}：${location[2]}`.slice(0, 500) : "", type, period }, warnings: [...new Set(warnings)] };
}

export function validateCaptureImage(file: { type: string; size: number }): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "请选择 PNG、JPG 或 WebP 截图；HEIC 可先在相册中截屏。";
  if (file.size === 0 || file.size > 8 * 1024 * 1024) return "图片需小于 8 MB，建议裁剪到包含日程的区域。";
  return null;
}

export type CapturedSchedule = { draft: CapturedDraft; warnings: string[]; source: string };

export function parseScheduleBatch(input: string, referenceDay: string): { schedules: CapturedSchedule[]; warnings: string[] } {
  const source = input.normalize("NFKC").replace(/\r/g, "")
    .replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, "")
    .replace(/^\s*(?:\d{1,2}[)、]|\d{1,2}\.\s|[-•])\s*/gm, "");
  if (!source.trim()) return { schedules: [], warnings: ["先输入日程信息。"] };
  if (source.length > 8000) return { schedules: [], warnings: ["内容超过 8000 字，请分批录入。"] };
  const datePattern = /\d{4}\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}\s*[日号]?|\d{1,2}\s*(?:月|\/)\s*\d{1,2}\s*[日号]?|(?:上周|下周|本周|这周|本星期|下星期|星期|周)[一二三四五六日天]|大后天|后天|明天|明早|明晚|今天|今日|今晚|今早|今晨/g;
  const timePattern = /(上午|早上|早晨|中午|下午|傍晚|晚上|晚间|凌晨)?\s*(\d{1,2}|[零〇一二两三四五六七八九十]{1,3})(?:[:：]\d{2}|[点时](?:半|一刻|三刻|(?:\d{1,2}|[零〇一二两三四五六七八九十]{1,3})分?)?)/g;
  const topicPattern = /(?:^|\n)\s*(?:主题|事项|活动|标题|会议名称)\s*[:：]/g;
  type Marker = { kind: "date" | "time" | "topic"; start: number; end: number };
  const markers: Marker[] = [];
  for (const [kind, pattern] of [["date", datePattern], ["time", timePattern], ["topic", topicPattern]] as const) {
    for (const match of source.matchAll(pattern)) markers.push({ kind, start: match.index!, end: match.index! + match[0].length });
  }
  markers.sort((a, b) => a.start - b.start);
  const boundaries = [0];
  let hasDate = false, hasTime = false, hasTopic = false, lastTimeEnd = 0, lastDateEnd = 0;
  // Only start a new item at a new appointment anchor, not at every OCR line.
  for (const marker of markers) {
    const between = source.slice(lastTimeEnd, marker.start);
    const rangeEnd = marker.kind === "time" && hasTime && /^\s*[-~～—–至到]\s*$/.test(between);
    const endLabel = marker.kind === "time" && hasTime && (/(?:结束|散会|结束时间)\s*[:：]?\s*$/.test(between) || /^\s*(?:结束|散会)/.test(source.slice(marker.end)));
    const newItem = marker.kind === "topic" ? hasTopic || hasTime
      : marker.kind === "date" ? (hasTime && (hasDate || !/(?:日期|时间)\s*[:：]?\s*$/.test(between)))
        || (hasDate && !/^[\s,，、~～—–\-至到和或与/]*$/.test(source.slice(lastDateEnd, marker.start)))
      : hasTime && !rangeEnd && !endLabel;
    if (newItem && marker.start > boundaries[boundaries.length - 1]) {
      boundaries.push(marker.start);
      hasDate = false; hasTime = false; hasTopic = false;
    }
    if (marker.kind === "date") { hasDate = true; lastDateEnd = marker.end; }
    if (marker.kind === "topic") hasTopic = true;
    if (marker.kind === "time") { hasTime = true; lastTimeEnd = marker.end; }
  }
  if (boundaries.length > 20) return { schedules: [], warnings: ["识别到超过 20 条安排，请分批录入，避免遗漏。"] };
  const schedules: CapturedSchedule[] = [];
  for (let index = 0; index < boundaries.length; index++) {
    const raw = source.slice(boundaries[index], boundaries[index + 1] ?? source.length)
      .replace(/^[\s,，。;；]+|[\s,，。;；]+$/g, "");
    if (!raw) continue;
    const parsed = parseScheduleText(raw, referenceDay);
    const previous = schedules[schedules.length - 1];
    if (!parsed.draft.date && !datePattern.test(raw) && previous?.draft.date) {
      parsed.draft.date = previous.draft.date;
      parsed.warnings = parsed.warnings.filter((warning) => !warning.startsWith("没有明确日期"));
      parsed.warnings.push("沿用上一条的日期，请确认这条也是同一天。");
    }
    datePattern.lastIndex = 0;
    schedules.push({ ...parsed, source: raw });
  }
  return { schedules, warnings: schedules.length > 1 ? ["拆分是本地规则分析，请核对条数；若拆错可返回原文，用换行分开每条安排。"] : [] };
}
