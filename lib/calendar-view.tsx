"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { addDays, formatDate, getPeriodLabel, getWeekStart, toIsoDay } from "./date";
import type { DayNote, EventItem, EventType, Period, TodoItem, WeekPayload } from "./types";

const PERIODS: Period[] = ["morning", "afternoon", "evening"];

const TYPE_META: Record<EventType, { icon: string; label: string }> = {
  work: { icon: "💼", label: "工作" },
  personal: { icon: "🏠", label: "个人" },
  social: { icon: "🥂", label: "社交" },
};

const HOLIDAY_2026: Record<string, { type: "holiday" | "workday"; label: string }> = {
  "2026-01-01": { type: "holiday", label: "元旦" },
  "2026-01-02": { type: "holiday", label: "元旦" },
  "2026-01-03": { type: "holiday", label: "元旦" },
  "2026-01-04": { type: "workday", label: "调休上班" },
  "2026-02-14": { type: "workday", label: "调休上班" },
  "2026-02-15": { type: "holiday", label: "春节" },
  "2026-02-16": { type: "holiday", label: "春节" },
  "2026-02-17": { type: "holiday", label: "春节" },
  "2026-02-18": { type: "holiday", label: "春节" },
  "2026-02-19": { type: "holiday", label: "春节" },
  "2026-02-20": { type: "holiday", label: "春节" },
  "2026-02-21": { type: "holiday", label: "春节" },
  "2026-02-22": { type: "holiday", label: "春节" },
  "2026-02-23": { type: "holiday", label: "春节" },
  "2026-02-28": { type: "workday", label: "调休上班" },
  "2026-04-04": { type: "holiday", label: "清明" },
  "2026-04-05": { type: "holiday", label: "清明" },
  "2026-04-06": { type: "holiday", label: "清明" },
  "2026-05-01": { type: "holiday", label: "劳动节" },
  "2026-05-02": { type: "holiday", label: "劳动节" },
  "2026-05-03": { type: "holiday", label: "劳动节" },
  "2026-05-04": { type: "holiday", label: "劳动节" },
  "2026-05-05": { type: "holiday", label: "劳动节" },
  "2026-05-09": { type: "workday", label: "调休上班" },
  "2026-06-19": { type: "holiday", label: "端午" },
  "2026-06-20": { type: "holiday", label: "端午" },
  "2026-06-21": { type: "holiday", label: "端午" },
  "2026-09-20": { type: "workday", label: "调休上班" },
  "2026-09-25": { type: "holiday", label: "中秋" },
  "2026-09-26": { type: "holiday", label: "中秋" },
  "2026-09-27": { type: "holiday", label: "中秋" },
  "2026-10-01": { type: "holiday", label: "国庆" },
  "2026-10-02": { type: "holiday", label: "国庆" },
  "2026-10-03": { type: "holiday", label: "国庆" },
  "2026-10-04": { type: "holiday", label: "国庆" },
  "2026-10-05": { type: "holiday", label: "国庆" },
  "2026-10-06": { type: "holiday", label: "国庆" },
  "2026-10-07": { type: "holiday", label: "国庆" },
  "2026-10-10": { type: "workday", label: "调休上班" },
};

type DraftEvent = {
  id?: string;
  date: string;
  period: Period;
  type: EventType;
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  status: "active" | "done" | "cancelled";
};

const EMPTY_DRAFT: DraftEvent = {
  date: "",
  period: "morning",
  type: "work",
  title: "",
  startTime: "",
  endTime: "",
  description: "",
  status: "active",
};

function toMinutes(timeValue?: string | null) {
  if (!timeValue) return 9999;
  const [h, m] = timeValue.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 9999;
  return h * 60 + m;
}

export function CalendarView({ slug }: { slug: string }) {
  const todayIso = toIsoDay(new Date());
  const [passcode, setPasscode] = useState("");
  const [locked, setLocked] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [notice, setNotice] = useState("请先解锁日历");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftEvent>(EMPTY_DRAFT);
  const [todoText, setTodoText] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EventType>("all");

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch(`/api/week?slug=${slug}&weekStart=${weekStart}`);
      if (!mounted || !res.ok) return;
      const payload: WeekPayload = await res.json();
      if (!mounted) return;
      setEvents(payload.events);
      setNotes(payload.dayNotes);
      setTodos(payload.todos);
      setLocked(false);
      setNotice("已同步");
    })();
    return () => {
      mounted = false;
    };
  }, [slug, weekStart]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("正在解锁...");
    const res = await fetch("/api/calendar/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, passcode }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setNotice(payload.error ?? "解锁失败");
      return;
    }
    setLocked(false);
    setNotice("已同步");
    await pullWeek(weekStart);
  }

  async function pullWeek(targetWeekStart: string) {
    const res = await fetch(`/api/week?slug=${slug}&weekStart=${targetWeekStart}`);
    if (!res.ok) {
      setNotice("同步失败，请检查口令后重试");
      if (res.status === 401 || res.status === 403) {
        setLocked(true);
      }
      return;
    }
    const payload: WeekPayload = await res.json();
    setEvents(payload.events);
    setNotes(payload.dayNotes);
    setTodos(payload.todos);
    setNotice("已同步");
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const body = {
      slug,
      id: draft.id,
      date: draft.date,
      period: draft.period,
      type: draft.type,
      title: draft.title,
      startTime: draft.startTime,
      endTime: draft.endTime,
      description: draft.description,
      status: draft.status,
    };
    const method = draft.id ? "PUT" : "POST";
    const endpoint = draft.id ? `/api/event/${draft.id}` : "/api/event";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("保存失败，请重试");
      return;
    }
    setModalOpen(false);
    setDraft(EMPTY_DRAFT);
    await pullWeek(weekStart);
  }

  async function toggleEventDone(item: EventItem) {
    const response = await fetch(`/api/event/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, status: item.status === "done" ? "active" : "done" }),
    });
    if (!response.ok) {
      setNotice("状态更新失败");
      return;
    }
    await pullWeek(weekStart);
  }

  async function deleteEvent(id: string) {
    const response = await fetch(`/api/event/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!response.ok) {
      setNotice("删除失败");
      return;
    }
    await pullWeek(weekStart);
  }

  async function saveNote(date: string, note: string) {
    const response = await fetch("/api/day-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, date, note }),
    });
    if (!response.ok) {
      setNotice("备注保存失败");
      return;
    }
    setNotes((current) => {
      const rest = current.filter((n) => n.date !== date);
      return [...rest, { date, note }];
    });
  }

  async function createTodo() {
    if (!todoText.trim()) return;
    const response = await fetch("/api/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, content: todoText.trim() }),
    });
    if (!response.ok) {
      setNotice("待办创建失败");
      return;
    }
    setTodoText("");
    await pullWeek(weekStart);
  }

  async function updateTodo(todo: TodoItem, patch: Partial<TodoItem>) {
    const response = await fetch(`/api/todo/${todo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...patch }),
    });
    if (!response.ok) {
      setNotice("待办更新失败");
      return;
    }
    await pullWeek(weekStart);
  }

  async function removeTodo(id: string) {
    const response = await fetch(`/api/todo/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!response.ok) {
      setNotice("待办删除失败");
      return;
    }
    await pullWeek(weekStart);
  }

  async function exportData() {
    const res = await fetch(`/api/export?slug=${slug}`);
    if (!res.ok) {
      setNotice("导出失败");
      return;
    }
    const payload = await res.json();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `calendar-${slug}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function importData(file: File) {
    const text = await file.text();
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, payload: JSON.parse(text) }),
    });
    if (!response.ok) {
      setNotice("导入失败");
      return;
    }
    await pullWeek(weekStart);
  }

  function openCreate(date: string, period: Period) {
    setDraft({ ...EMPTY_DRAFT, date, period, type: "work" });
    setModalOpen(true);
  }

  function openEdit(item: EventItem) {
    setDraft({
      id: item.id,
      date: item.date,
      period: item.period,
      type: item.type ?? "work",
      title: item.title,
      startTime: item.startTime ?? "",
      endTime: item.endTime ?? "",
      description: item.description ?? "",
      status: item.status,
    });
    setModalOpen(true);
  }

  if (locked) {
    return (
      <main className="shell centered">
        <section className="card create-card">
          <h1>个人日程助手</h1>
          <p>链接：/c/{slug}</p>
          <form onSubmit={unlock} className="stack-form">
            <label>
              输入口令解锁
              <input
                type="password"
                value={passcode}
                minLength={6}
                onChange={(e) => setPasscode(e.target.value)}
                required
              />
            </label>
            <button className="primary-btn" type="submit">解锁并同步</button>
          </form>
          <p className="notice">{notice}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="calendar-header">
        <div className="header-left">
          <h1>个人日程助手</h1>
          <div className="week-nav">
            <button onClick={() => { const next = addDays(weekStart, -7); setWeekStart(next); void pullWeek(next); }}>&lt; 上一周</button>
            <span>{formatDate(weekDates[0])} - {formatDate(weekDates[6])}</span>
            <button onClick={() => { const next = addDays(weekStart, 7); setWeekStart(next); void pullWeek(next); }}>下一周 &gt;</button>
            <button onClick={() => { const now = getWeekStart(new Date()); setWeekStart(now); void pullWeek(now); }}>今天</button>
          </div>
        </div>
        <div className="header-right">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | EventType)}>
            <option value="all">全部类型</option>
            <option value="work">工作</option>
            <option value="personal">个人</option>
            <option value="social">社交</option>
          </select>
          <span className="sync-state">{notice}</span>
          <button onClick={() => void pullWeek(weekStart)}>同步</button>
          <button onClick={() => void exportData()}>导出</button>
          <label className="file-btn">
            导入
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  void importData(e.target.files[0]);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <button className="accent" onClick={() => openCreate(weekDates[0], "morning")}>记一笔</button>
        </div>
      </header>

      <section className="calendar-grid-wrapper">
        <div className="calendar-grid">
          <div className="corner-cell" />
          {weekDates.map((date, index) => {
            const note = notes.find((n) => n.date === date);
            const special = HOLIDAY_2026[date];
            return (
              <div key={date} className={`day-header ${date === todayIso ? "today-ring" : ""}`}>
                <div>周{["一", "二", "三", "四", "五", "六", "日"][index]}</div>
                <strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
                {special ? <span className={`holiday-badge ${special.type}`}>{special.label}</span> : null}
                <button
                  className="note-link"
                  onClick={() => {
                    const text = window.prompt("输入当天备注", note?.note ?? "");
                    if (text !== null) {
                      void saveNote(date, text.trim());
                    }
                  }}
                >
                  + 备注
                </button>
                {note?.note ? <p className="note-preview">{note.note}</p> : null}
              </div>
            );
          })}

          {PERIODS.map((period) => (
            <Fragment key={`${period}-row`}>
              <div className={`period-label ${period}`}>
                <div>{getPeriodLabel(period).title}</div>
                <small>{getPeriodLabel(period).timeRange}</small>
              </div>
              {weekDates.map((date) => (
                <div
                  key={`${period}-${date}`}
                  className={`period-cell ${period}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest(".event-card")) return;
                    openCreate(date, period);
                  }}
                >
                  {events
                    .filter((item) => item.date === date && item.period === period)
                    .filter((item) => (typeFilter === "all" ? true : item.type === typeFilter))
                    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
                    .map((item) => {
                      const meta = TYPE_META[item.type] ?? TYPE_META.work;
                      return (
                        <article
                          key={item.id}
                          className={`event-card ${period} ${item.status !== "active" ? "muted" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          <div className="event-time-row">
                            <div className="event-time">{item.startTime || "--:--"}-{item.endTime || "--:--"}</div>
                            <span className="event-type-chip">{meta.icon} {meta.label}</span>
                          </div>
                          <div className="event-title">{item.title}</div>
                          <div className="event-actions">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleEventDone(item);
                              }}
                            >
                              {item.status === "done" ? "恢复" : "完成"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteEvent(item.id);
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </section>

      <section className="todo-panel">
        <h2>待办事项</h2>
        <div className="todo-input-row">
          <input
            type="text"
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            placeholder="添加待办..."
          />
          <button onClick={() => void createTodo()}>新增</button>
        </div>
        <ul className="todo-list">
          {todos.map((todo, index) => (
            <li key={todo.id} className={todo.done ? "done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => void updateTodo(todo, { done: !todo.done })}
                />
                <span>{todo.content}</span>
              </label>
              <div className="todo-actions">
                <button
                  disabled={index === 0}
                  onClick={() => void updateTodo(todo, { sortOrder: Math.max(0, todo.sortOrder - 1) })}
                >
                  上移
                </button>
                <button onClick={() => void removeTodo(todo.id)}>删除</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <form className="modal" onSubmit={saveEvent} onClick={(e) => e.stopPropagation()}>
            <h3>{draft.id ? "编辑日程" : "新增日程"}</h3>
            <label>
              日期
              <input
                type="date"
                required
                value={draft.date}
                onChange={(e) => setDraft((s) => ({ ...s, date: e.target.value }))}
              />
            </label>
            <label>
              时段
              <select
                value={draft.period}
                onChange={(e) => setDraft((s) => ({ ...s, period: e.target.value as Period }))}
              >
                <option value="morning">上午</option>
                <option value="afternoon">下午</option>
                <option value="evening">晚上</option>
              </select>
            </label>
            <label>
              类型
              <select
                value={draft.type}
                onChange={(e) => setDraft((s) => ({ ...s, type: e.target.value as EventType }))}
              >
                <option value="work">💼 工作</option>
                <option value="personal">🏠 个人</option>
                <option value="social">🥂 社交</option>
              </select>
            </label>
            <label>
              标题
              <input
                type="text"
                required
                value={draft.title}
                onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))}
              />
            </label>
            <div className="time-row">
              <label>
                开始
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft((s) => ({ ...s, startTime: e.target.value }))}
                />
              </label>
              <label>
                结束
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => setDraft((s) => ({ ...s, endTime: e.target.value }))}
                />
              </label>
            </div>
            <label>
              备注
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))}
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setModalOpen(false)}>取消</button>
              <button className="primary-btn" type="submit" disabled={saving}>{saving ? "保存中" : "保存"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
