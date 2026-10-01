// Local browser QA fixture. Proxies the real UI, never connects to Supabase.
import http from "node:http";
import { randomUUID } from "node:crypto";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const state = {
  events: [
    { id: randomUUID(), date: today, period: "morning", type: "work", startTime: "09:00", endTime: "10:00", title: "团队周会", description: "准备本周研究进展", status: "done" },
    { id: randomUUID(), date: today, period: "afternoon", type: "work", startTime: "14:00", endTime: "15:00", title: "消费行业策略讨论", description: "陆家嘴办公室", status: "active" },
    { id: randomUUID(), date: today, period: "afternoon", type: "social", startTime: "16:00", endTime: "17:00", title: "和老朋友喝咖啡", description: "楼下咖啡店", status: "active" },
    { id: randomUUID(), date: today, period: "evening", type: "personal", startTime: "19:00", endTime: "20:30", title: "羽毛球", description: "带好球拍", status: "active" },
  ],
  dayNotes: [{ date: today, note: "留一点时间给自己" }],
  todos: [
    { id: randomUUID(), content: "整理 AI 产品体验笔记", done: false, sortOrder: 0 },
    { id: randomUUID(), content: "预订周末餐厅", done: false, sortOrder: 3 },
    { id: randomUUID(), content: "回复团队邮件", done: true, sortOrder: 8 },
  ],
};
let unlocked = true;
let failNextEvent = false;

http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4330");
  if (!url.pathname.startsWith("/api/")) {
    const proxy = http.request({ hostname: "127.0.0.1", port: 4329, path: request.url, method: request.method, headers: request.headers }, (upstream) => {
      response.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(response);
    });
    proxy.on("error", () => { response.writeHead(502); response.end("Preview UI is not running"); });
    request.pipe(proxy);
    return;
  }
  const send = (payload, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(payload));
  };
  try {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/api/calendar/unlock") { unlocked = true; send({ ok: true }); return; }
    if (url.pathname === "/api/calendar/lock") { unlocked = false; send({ ok: true }); return; }
    if (!unlocked) { send({ error: "未解锁日历" }, 401); return; }
    if (url.pathname === "/api/qa/fail-next-event") { failNextEvent = true; send({ ok: true }); return; }
    if (url.pathname === "/api/week") {
      const weekStart = url.searchParams.get("weekStart");
      const end = new Date(`${weekStart}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      const weekEnd = end.toISOString().slice(0, 10);
      send({ ...state, weekStart, events: state.events.filter((item) => item.date >= weekStart && item.date <= weekEnd), dayNotes: state.dayNotes.filter((item) => item.date >= weekStart && item.date <= weekEnd) });
      return;
    }
    if (url.pathname === "/api/export") { send({ ...state, calendar: { timezone: "Asia/Shanghai" } }); return; }
    if (url.pathname === "/api/day-note") {
      state.dayNotes = [...state.dayNotes.filter((item) => item.date !== body.date), { date: body.date, note: body.note }];
      send({ ok: true }); return;
    }
    if (url.pathname === "/api/import") { Object.assign(state, body.payload); send({ ok: true }); return; }
    const match = url.pathname.match(/^\/api\/(event|todo)(?:\/([^/]+))?$/);
    if (match) {
      const key = match[1] === "event" ? "events" : "todos";
      const items = state[key];
      if (request.method === "POST") {
        if (key === "events" && failNextEvent) {
          failNextEvent = false; send({ error: "模拟保存失败，请重试" }, 503); return;
        }
        const id = randomUUID();
        const { slug, ...values } = body;
        items.push({ ...values, id, ...(key === "todos" ? { done: false, sortOrder: Math.max(0, ...items.map((item) => item.sortOrder)) + 1 } : {}) });
        send({ id }); return;
      }
      const index = items.findIndex((item) => item.id === match[2]);
      if (index < 0) { send({ error: "条目不存在" }, 404); return; }
      if (request.method === "DELETE") items.splice(index, 1);
      else Object.assign(items[index], body);
      if (key === "todos") items.sort((a, b) => a.sortOrder - b.sortOrder);
      send({ ok: true }); return;
    }
    send({ error: "测试接口不存在" }, 404);
  } catch {
    send({ error: "测试请求失败" }, 400);
  }
}).listen(4330, "127.0.0.1", () => console.log("Isolated QA preview: http://127.0.0.1:4330/c/test-calendar"));
