"use client";

import {
  FormEvent,
  Fragment,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  filterEvents,
  getQuickCreateDate,
  getMobileDate,
  getTodaySummary,
  inferPeriodFromTime,
  sortEvents,
  validateTimeRange,
} from "./calendar-domain";
import { calendarRequest } from "./calendar-request";
import { CaptureInput } from "./capture-input";
import type { CapturedDraft } from "./capture-parser";
import { importSchema } from "./backup-validation";
import { addDays, formatDate, getPeriodLabel, getWeekStart, toIsoDayInTimeZone } from "./date";
import type { DayNote, EventItem, EventType, Period, TodoItem, WeekPayload } from "./types";

const PERIODS: Period[] = ["morning", "afternoon", "evening"];
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const TYPE_META: Record<EventType, { label: string; className: string }> = {
  work: { label: "工作", className: "work" },
  personal: { label: "个人", className: "personal" },
  social: { label: "社交", className: "social" },
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

type SyncTone = "locked" | "syncing" | "synced" | "error";

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

function normalizeIsoDate(value: string) {
  return value.slice(0, 10);
}

function normalizeTime(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function currentClockTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date());
}

function formatShortDate(isoDay: string) {
  const date = new Date(`${isoDay}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getWeekNumber(isoDay: string) {
  const date = new Date(`${isoDay}T00:00:00`);
  const yearStart = new Date(`${date.getFullYear()}-01-01T00:00:00`);
  const elapsedDays = Math.floor((date.getTime() - yearStart.getTime()) / 86_400_000) + 1;
  return Math.ceil(elapsedDays / 7);
}

function periodForNow(): Period {
  return inferPeriodFromTime(currentClockTime(), "morning");
}

function TypeIcon({ type }: { type: EventType }) {
  if (type === "personal") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (type === "social") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3.5 19c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5M14 14.5c2.8-.8 5.5.8 6 3.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M9 7V5h6v2M3 12h18M10 12v2h4v-2" />
    </svg>
  );
}

function EventCard({
  item,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: EventItem;
  onEdit: (item: EventItem) => void;
  onToggle: (item: EventItem) => void;
  onDelete: (item: EventItem) => void;
}) {
  const meta = TYPE_META[item.type] ?? TYPE_META.work;
  const timeLabel = item.startTime
    ? `${normalizeTime(item.startTime)}${item.endTime ? `–${normalizeTime(item.endTime)}` : ""}`
    : "时间待定";

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit(item);
    }
  }

  return (
    <article
      className={`event-card ${item.period} event-${meta.className} ${item.status !== "active" ? "muted" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onEdit(item);
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`${timeLabel} ${item.title}，${meta.label}`}
      title={item.description || item.title}
    >
      <div className="event-main-line">
        <span className={`event-type-icon ${meta.className}`}><TypeIcon type={item.type} /></span>
        <span className="event-title">{item.title}</span>
      </div>
      <div className="event-meta-line">
        <time>{timeLabel}</time>
        <span>{meta.label}</span>
        {item.status === "done" ? <span className="done-label">已完成</span> : null}
      </div>
      <div className="event-actions" aria-label="日程快捷操作">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(item);
          }}
        >
          {item.status === "done" ? "恢复" : "完成"}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(item);
          }}
        >
          编辑
        </button>
        <button
          className="danger-text"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
        >
          删除
        </button>
      </div>
    </article>
  );
}

export function CalendarView({ slug }: { slug: string }) {
  const todayIso = toIsoDayInTimeZone(new Date(), "Asia/Shanghai");
  const initialWeek = getWeekStart(new Date(`${todayIso}T00:00:00`));
  const [passcode, setPasscode] = useState("");
  const [locked, setLocked] = useState(true);
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [selectedMobileDate, setSelectedMobileDate] = useState(todayIso);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [notice, setNotice] = useState("请先解锁日历");
  const [syncTone, setSyncTone] = useState<SyncTone>("locked");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureWarnings, setCaptureWarnings] = useState<string[]>([]);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftEvent>(EMPTY_DRAFT);
  const [noteDraft, setNoteDraft] = useState<DayNote>({ date: "", note: "" });
  const [todoText, setTodoText] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EventType>("all");
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [formError, setFormError] = useState("");
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [clockTime, setClockTime] = useState(currentClockTime);
  const searchRef = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const composeHandled = useRef(false);
  const manuallyLocked = useRef(false);
  const activeWeek = useRef(weekStart);
  activeWeek.current = weekStart;

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const visibleEvents = useMemo(
    () => filterEvents(events, { type: typeFilter, query, activeOnly }),
    [activeOnly, events, query, typeFilter]
  );
  const todaySummary = useMemo(
    () => getTodaySummary(events, todos, todayIso, clockTime),
    [clockTime, events, todayIso, todos]
  );
  const isCurrentWeek = weekDates.includes(todayIso);
  const mobileDate = getMobileDate(weekStart, selectedMobileDate, todayIso);
  const todoProgress = todaySummary.todoTotalCount
    ? Math.round((todaySummary.todoDoneCount / todaySummary.todoTotalCount) * 100)
    : 0;

  function applyPayload(payload: WeekPayload) {
    setEvents(
      payload.events.map((item) => ({
        ...item,
        date: normalizeIsoDate(item.date),
        startTime: normalizeTime(item.startTime),
        endTime: normalizeTime(item.endTime),
      }))
    );
    setNotes(payload.dayNotes.map((item) => ({ ...item, date: normalizeIsoDate(item.date) })));
    setTodos(payload.todos);
  }

  async function readError(response: Response, fallback: string) {
    try {
      const body = await response.json();
      return typeof body.error === "string" ? body.error : fallback;
    } catch {
      return fallback;
    }
  }

  async function pullWeek(targetWeekStart: string, silent = false) {
    if (manuallyLocked.current || targetWeekStart !== activeWeek.current) return;
    const version = ++readVersion.current;
    if (!silent) {
      setNotice("正在同步...");
      setSyncTone("syncing");
    }
    try {
      const response = await fetch(`/api/week?slug=${slug}&weekStart=${targetWeekStart}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (version !== readVersion.current || targetWeekStart !== activeWeek.current || manuallyLocked.current) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setLocked(true);
          setSyncTone("locked");
          setNotice("会话已过期，请重新输入口令");
          return;
        }
        setSyncTone("error");
        setNotice(await readError(response, "同步失败，请稍后重试"));
        return;
      }
      const payload = (await response.json()) as WeekPayload;
      if (version !== readVersion.current || manuallyLocked.current) return;
      applyPayload(payload);
      setLocked(false);
      setNotice("刚刚已同步");
      setSyncTone("synced");
    } catch {
      if (version !== readVersion.current || manuallyLocked.current) return;
      setSyncTone("error");
      setNotice("网络暂不可用，稍后会自动重试");
    }
  }

  useEffect(() => {
    void pullWeek(weekStart);
    return () => {
      readVersion.current += 1;
    };
  }, [slug, weekStart]);

  async function sendRequest(url: string, init?: RequestInit) {
    const isWrite = init?.method && init.method !== "GET";
    if (isWrite) readVersion.current += 1;
    const result = await calendarRequest(url, init);
    if (isWrite) readVersion.current += 1;
    if (result.error) {
      setNotice(result.error);
      setSyncTone("error");
      if (result.response?.status === 401 || result.response?.status === 403) {
        setLocked(true);
        setModalOpen(false);
        setCaptureOpen(false);
        setNoteModalOpen(false);
      }
      return null;
    }
    return result.response;
  }

  useEffect(() => {
    if (!weekDates.includes(selectedMobileDate)) {
      setSelectedMobileDate(getQuickCreateDate(weekStart, todayIso));
    }
  }, [selectedMobileDate, todayIso, weekDates, weekStart]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTime(currentClockTime()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (locked || composeHandled.current) return;
    composeHandled.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("compose") !== "1") return;
    openQuickCreate();
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void pullWeek(weekStart, true);
    };
    const timer = window.setInterval(refresh, 90_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [locked, weekStart]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "Escape") {
        setModalOpen(false);
        setCaptureOpen(false);
        setNoteModalOpen(false);
        setInstallHelpOpen(false);
        setFormError("");
        return;
      }
      if (locked || isTyping || modalOpen || captureOpen || noteModalOpen || installHelpOpen || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        openQuickCreate();
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        goToToday();
      } else if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setWeekStart((current) => addDays(current, -7));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setWeekStart((current) => addDays(current, 7));
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [locked, modalOpen, captureOpen, noteModalOpen, installHelpOpen, todayIso, weekStart]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("正在解锁...");
    setSyncTone("syncing");
    try {
      const response = await fetch("/api/calendar/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, passcode }),
      });
      if (!response.ok) {
        setSyncTone("error");
        setNotice(await readError(response, "口令不正确，请重试"));
        return;
      }
      setPasscode("");
      manuallyLocked.current = false;
      setLocked(false);
      await pullWeek(weekStart);
    } catch {
      setSyncTone("error");
      setNotice("网络连接失败，请稍后再试");
    }
  }

  function openCreate(date: string, period: Period) {
    setCaptureWarnings([]);
    setDraft({ ...EMPTY_DRAFT, date, period, type: "work" });
    setFormError("");
    setModalOpen(true);
  }

  function openQuickCreate() {
    setCaptureOpen(true);
  }

  function reviewCapture(captured: CapturedDraft, warnings: string[]) {
    setDraft({ ...EMPTY_DRAFT, ...captured });
    setCaptureWarnings(warnings);
    setFormError("");
    setCaptureOpen(false);
    setModalOpen(true);
  }

  function openEdit(item: EventItem) {
    setCaptureWarnings([]);
    setDraft({
      id: item.id,
      date: normalizeIsoDate(item.date),
      period: item.period,
      type: item.type ?? "work",
      title: item.title,
      startTime: normalizeTime(item.startTime),
      endTime: normalizeTime(item.endTime),
      description: item.description ?? "",
      status: item.status,
    });
    setFormError("");
    setModalOpen(true);
  }

  function openNote(date: string) {
    const note = notes.find((item) => item.date === date);
    setNoteDraft({ date, note: note?.note ?? "" });
    setFormError("");
    setNoteModalOpen(true);
  }

  function goToToday() {
    const next = getWeekStart(new Date(`${todayIso}T00:00:00`));
    setWeekStart(next);
    setSelectedMobileDate(todayIso);
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const timeError = validateTimeRange(draft.startTime, draft.endTime);
    if (timeError) {
      setFormError(timeError);
      return;
    }
    setSaving(true);
    setFormError("");
    const method = draft.id ? "PUT" : "POST";
    const endpoint = draft.id ? `/api/event/${draft.id}` : "/api/event";
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...draft }),
      });
      if (!response.ok) {
        const message = await readError(response, "保存失败，请重试");
        setFormError(message);
        setNotice(message);
        setSyncTone("error");
        return;
      }
      setModalOpen(false);
      setDraft(EMPTY_DRAFT);
      setNotice("日程已保存");
      setSyncTone("synced");
      const savedWeek = getWeekStart(new Date(`${draft.date}T00:00:00`));
      setSelectedMobileDate(draft.date);
      setQuery("");
      setTypeFilter("all");
      setActiveOnly(false);
      if (savedWeek !== weekStart) setWeekStart(savedWeek);
      else await pullWeek(weekStart, true);
    } catch {
      setFormError("网络连接失败，本次修改尚未保存");
      setSyncTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEventDone(item: EventItem) {
    const response = await sendRequest(`/api/event/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, status: item.status === "done" ? "active" : "done" }),
    });
    if (!response) return;
    setNotice(item.status === "done" ? "日程已恢复" : "日程已完成");
    setSyncTone("synced");
    await pullWeek(weekStart, true);
  }

  async function deleteEvent(item: EventItem) {
    if (!window.confirm(`确定删除“${item.title}”吗？`)) return;
    const response = await sendRequest(`/api/event/${item.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!response) return;
    setModalOpen(false);
    setNotice("日程已删除");
    setSyncTone("synced");
    await pullWeek(weekStart, true);
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await sendRequest("/api/day-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, date: noteDraft.date, note: noteDraft.note.trim() }),
      });
      if (!response) {
        setFormError("备注尚未保存，请检查连接后重试");
        return;
      }
      setNotes((current) => [
        ...current.filter((item) => item.date !== noteDraft.date),
        { date: noteDraft.date, note: noteDraft.note.trim() },
      ]);
      setNoteModalOpen(false);
      setNotice(noteDraft.note.trim() ? "备注已保存" : "备注已清空");
      setSyncTone("synced");
    } finally {
      setSaving(false);
    }
  }

  async function createTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!todoText.trim()) return;
    const response = await sendRequest("/api/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, content: todoText.trim() }),
    });
    if (!response) return;
    setTodoText("");
    setNotice("待办已添加");
    setSyncTone("synced");
    await pullWeek(weekStart, true);
  }

  async function updateTodo(todo: TodoItem, patch: Partial<TodoItem>) {
    const response = await sendRequest(`/api/todo/${todo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...patch }),
    });
    if (!response) return;
    await pullWeek(weekStart, true);
  }

  async function moveTodo(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= todos.length) return;
    const current = todos[index];
    const target = todos[targetIndex];
    const responses = await Promise.all([
      sendRequest(`/api/todo/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sortOrder: target.sortOrder }),
      }),
      sendRequest(`/api/todo/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sortOrder: current.sortOrder }),
      }),
    ]);
    if (responses.some((response) => !response?.ok)) {
      setNotice("待办排序失败，请重试");
      setSyncTone("error");
      await pullWeek(weekStart, true);
      return;
    }
    const reordered = [...todos];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setTodos(reordered.map((item) => ({ ...item, sortOrder: item.id === current.id ? target.sortOrder : item.id === target.id ? current.sortOrder : item.sortOrder })));
  }

  async function removeTodo(todo: TodoItem) {
    if (!window.confirm(`确定删除待办“${todo.content}”吗？`)) return;
    const response = await sendRequest(`/api/todo/${todo.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!response) return;
    setNotice("待办已删除");
    setSyncTone("synced");
    await pullWeek(weekStart, true);
  }

  async function exportData() {
    const response = await sendRequest(`/api/export?slug=${slug}`);
    if (!response) return;
    const payload = await response.json();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `calendar-backup-${todayIso}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    setNotice("备份已导出");
    setSyncTone("synced");
  }

  async function importData(file: File) {
    try {
      const payload = JSON.parse(await file.text());
      if (!importSchema.safeParse({ slug, payload }).success) {
        setNotice("这不是完整的日历备份，当前内容未改变");
        setSyncTone("error");
        return;
      }
      if (!window.confirm("导入会替换当前日历中的全部内容。请确认你已经导出备份，是否继续？")) return;
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, payload }),
      });
      if (!response.ok) {
        setNotice(await readError(response, "导入失败，请检查文件"));
        setSyncTone("error");
        return;
      }
      setNotice("导入完成");
      setSyncTone("synced");
      await pullWeek(weekStart, true);
    } catch {
      setNotice("导入未完成，请检查文件和网络后重试");
      setSyncTone("error");
    }
  }

  async function lockCalendar() {
    manuallyLocked.current = true;
    readVersion.current += 1;
    const response = await sendRequest("/api/calendar/lock", { method: "POST" });
    if (response) {
      setLocked(true);
      setPasscode("");
      setEvents([]);
      setNotes([]);
      setTodos([]);
      setNotice("日历已锁定");
      setSyncTone("locked");
    } else {
      manuallyLocked.current = false;
    }
  }

  if (locked) {
    return (
      <main className="unlock-shell">
        <section className="unlock-card">
          <div className="unlock-mark" aria-hidden="true">日</div>
          <p className="eyebrow">PRIVATE WEEKLY PLANNER</p>
          <h1>个人日程助手</h1>
          <p className="unlock-copy">输入你的私密口令，继续查看并同步日程。</p>
          <form onSubmit={unlock} className="unlock-form">
            <label htmlFor="calendar-passcode">日历口令</label>
            <input
              id="calendar-passcode"
              type="password"
              value={passcode}
              minLength={6}
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="请输入至少 6 位口令"
              autoComplete="current-password"
              autoFocus
              required
            />
            <button className="primary-btn unlock-button" type="submit">解锁日历</button>
          </form>
          <p className={`status-message ${syncTone}`} role="status">{notice}</p>
          <p className="privacy-note">口令只用于验证，不会显示在页面或导出文件中。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="calendar-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">MY WEEK</p>
          <h1>个人日程助手</h1>
        </div>

        <nav className="week-nav" aria-label="周导航">
          <button type="button" className="icon-button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="上一周">←</button>
          <div className="week-range">
            <strong>{formatShortDate(weekDates[0])} – {formatShortDate(weekDates[6])}</strong>
            <span>{new Date(`${weekDates[0]}T00:00:00`).getFullYear()} 年 · 第 {getWeekNumber(weekDates[0])} 周</span>
          </div>
          <button type="button" className="icon-button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="下一周">→</button>
          <button type="button" className="today-button" onClick={goToToday}>今天</button>
        </nav>

        <div className="top-actions">
          <div className={`sync-pill ${syncTone}`} aria-live="polite">
            <span className="sync-dot" />
            {notice}
          </div>
          <button type="button" className="quick-add-button" onClick={openQuickCreate}>
            <span>＋</span> 记一笔
          </button>
          <details className="more-menu">
            <summary aria-label="更多操作">•••</summary>
            <div className="more-popover">
              <button type="button" onClick={() => setInstallHelpOpen(true)}>添加到手机桌面</button>
              <button type="button" onClick={() => void pullWeek(weekStart)}>立即同步</button>
              <button type="button" onClick={() => void exportData()}>导出备份</button>
              <label className="import-action">
                导入备份
                <input
                  type="file"
                  accept="application/json"
                  onChange={(event) => {
                    if (event.target.files?.[0]) {
                      void importData(event.target.files[0]);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
              <div className="shortcut-hint">快捷键：C 新建 · T 今天 · / 搜索</div>
              <button type="button" className="lock-action" onClick={() => void lockCalendar()}>锁定日历</button>
            </div>
          </details>
        </div>
      </header>

      <section className="overview-strip" aria-label="今日概览">
        <div className="overview-lead">
          <span className="overview-date">{isCurrentWeek ? "今天" : "本周"}</span>
          {isCurrentWeek && todaySummary.nextEvent ? (
            <div>
              <p>接下来 · {normalizeTime(todaySummary.nextEvent.startTime)}</p>
              <strong>{todaySummary.nextEvent.title}</strong>
            </div>
          ) : (
            <div>
              <p>{isCurrentWeek ? "接下来" : "正在浏览"}</p>
              <strong>{isCurrentWeek ? "今天暂时没有更多安排" : `${formatShortDate(weekDates[0])} 开始的一周`}</strong>
            </div>
          )}
        </div>
        <div className="overview-metrics">
          <div><strong>{isCurrentWeek ? todaySummary.activeEventCount : visibleEvents.filter((item) => item.status === "active").length}</strong><span>{isCurrentWeek ? "今日安排" : "本周安排"}</span></div>
          <div><strong>{todos.filter((item) => !item.done).length}</strong><span>待办未完成</span></div>
          <div className="progress-metric">
            <span><strong>{todoProgress}%</strong> 待办进度</span>
            <div className="progress-track"><i style={{ width: `${todoProgress}%` }} /></div>
          </div>
        </div>
      </section>

      <section className="filter-bar" aria-label="日程筛选">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索日程标题或备注"
            aria-label="搜索日程标题或备注"
          />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="清空搜索">×</button> : <kbd>/</kbd>}
        </label>
        <div className="type-tabs" role="group" aria-label="按日程类型筛选">
          {(["all", "work", "personal", "social"] as const).map((type) => (
            <button
              type="button"
              key={type}
              className={typeFilter === type ? "active" : ""}
              onClick={() => setTypeFilter(type)}
              aria-pressed={typeFilter === type}
            >
              {type === "all" ? "全部" : TYPE_META[type].label}
            </button>
          ))}
        </div>
        <label className="active-only-toggle">
          <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
          <span />
          只看未完成
        </label>
      </section>

      <section className="desktop-calendar" aria-label="周日历">
        <div className="calendar-grid">
          <div className="corner-cell"><span>时间</span><small>MON – SUN</small></div>
          {weekDates.map((date, index) => {
            const note = notes.find((item) => item.date === date);
            const special = HOLIDAY_2026[date];
            return (
              <div key={date} className={`day-header ${date === todayIso ? "is-today" : ""}`}>
                <div className="day-name">周{WEEKDAYS[index]}</div>
                <div className="day-number-row">
                  <strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
                  {special ? <span className={`holiday-badge ${special.type}`}>{special.label}</span> : null}
                </div>
                <button type="button" className="note-link" onClick={() => openNote(date)}>
                  {note?.note ? <><span className="note-dot" />{note.note}</> : "+ 备注"}
                </button>
              </div>
            );
          })}

          {PERIODS.map((period) => (
            <Fragment key={`${period}-row`}>
              <div className={`period-label ${period}`}>
                <span>{getPeriodLabel(period).title}</span>
                <small>{getPeriodLabel(period).timeRange}</small>
              </div>
              {weekDates.map((date) => {
                const cellEvents = sortEvents(
                  visibleEvents.filter((item) => item.date === date && item.period === period)
                );
                return (
                  <div
                    key={`${period}-${date}`}
                    className={`period-cell ${period}`}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest(".event-card")) return;
                      openCreate(date, period);
                    }}
                  >
                    {cellEvents.map((item) => (
                      <EventCard key={item.id} item={item} onEdit={openEdit} onToggle={(value) => void toggleEventDone(value)} onDelete={(value) => void deleteEvent(value)} />
                    ))}
                    {cellEvents.length === 0 ? <button type="button" className="empty-cell-add" onClick={() => openCreate(date, period)}>＋ 添加</button> : null}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </section>

      <section className="mobile-calendar" aria-label="手机日历">
        <div className="mobile-day-tabs">
          {weekDates.map((date, index) => {
            const special = HOLIDAY_2026[date];
            const count = events.filter((item) => item.date === date && item.status === "active").length;
            return (
              <button
                type="button"
                key={date}
                className={`${mobileDate === date ? "active" : ""} ${date === todayIso ? "today" : ""}`}
                onClick={() => setSelectedMobileDate(date)}
              >
                <span>周{WEEKDAYS[index]}</span>
                <strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
                <i>{special ? special.label.slice(0, 2) : count ? `${count}项` : ""}</i>
              </button>
            );
          })}
        </div>
        <div className="mobile-day-heading">
          <div>
            <p>{mobileDate === todayIso ? "今天" : `周${WEEKDAYS[weekDates.indexOf(mobileDate)]}`}</p>
            <h2>{formatDate(mobileDate)}</h2>
          </div>
          <button type="button" onClick={() => openNote(mobileDate)}>
            {notes.some((item) => item.date === mobileDate && item.note) ? "编辑备注" : "+ 当日备注"}
          </button>
        </div>
        {notes.find((item) => item.date === mobileDate)?.note ? (
          <button type="button" className="mobile-note" onClick={() => openNote(mobileDate)}>
            <span>笺</span>{notes.find((item) => item.date === mobileDate)?.note}
          </button>
        ) : null}
        <div className="mobile-period-list">
          {PERIODS.map((period) => {
            const periodEvents = sortEvents(
              visibleEvents.filter((item) => item.date === mobileDate && item.period === period)
            );
            return (
              <section key={period} className={`mobile-period ${period}`}>
                <header>
                  <div><strong>{getPeriodLabel(period).title}</strong><span>{getPeriodLabel(period).timeRange}</span></div>
                  <button type="button" onClick={() => openCreate(mobileDate, period)} aria-label={`添加${getPeriodLabel(period).title}日程`}>＋</button>
                </header>
                <div className="mobile-event-list">
                  {periodEvents.map((item) => (
                    <EventCard key={item.id} item={item} onEdit={openEdit} onToggle={(value) => void toggleEventDone(value)} onDelete={(value) => void deleteEvent(value)} />
                  ))}
                  {periodEvents.length === 0 ? <button type="button" className="mobile-empty-add" onClick={() => openCreate(mobileDate, period)}>轻点添加日程</button> : null}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="todo-panel">
        <div className="todo-heading">
          <div>
            <p className="eyebrow">TO-DO</p>
            <h2>待办事项</h2>
          </div>
          <span>{todaySummary.todoDoneCount}/{todaySummary.todoTotalCount || 0} 已完成</span>
        </div>
        <form className="todo-input-row" onSubmit={createTodo}>
          <input
            type="text"
            value={todoText}
            onChange={(event) => setTodoText(event.target.value)}
            placeholder="写下一件需要完成的事，按 Enter 添加"
            maxLength={200}
          />
          <button type="submit">添加待办</button>
        </form>
        {todos.length ? (
          <ul className="todo-list">
            {todos.map((todo, index) => (
              <li key={todo.id} className={todo.done ? "done" : ""}>
                <label>
                  <input type="checkbox" checked={todo.done} onChange={() => void updateTodo(todo, { done: !todo.done })} />
                  <span className="custom-checkbox" aria-hidden="true">✓</span>
                  <span>{todo.content}</span>
                </label>
                <div className="todo-actions">
                  <button type="button" disabled={index === 0} onClick={() => void moveTodo(index, -1)} aria-label="上移待办">↑</button>
                  <button type="button" disabled={index === todos.length - 1} onClick={() => void moveTodo(index, 1)} aria-label="下移待办">↓</button>
                  <button type="button" className="danger-text" onClick={() => void removeTodo(todo)}>删除</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="todo-empty"><span>✓</span><p>待办清单还是空的</p><small>把零碎的事情先记下来，日程会轻松很多。</small></div>
        )}
      </section>

      <button type="button" className="mobile-fab" onClick={openQuickCreate} aria-label="新增日程">＋</button>

      {captureOpen ? <CaptureInput
        referenceDay={todayIso}
        onClose={() => setCaptureOpen(false)}
        onDraft={reviewCapture}
        onManual={() => { setCaptureOpen(false); openCreate(getQuickCreateDate(weekStart, todayIso), periodForNow()); }}
      /> : null}

      {installHelpOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setInstallHelpOpen(false); }}>
          <section className="modal install-help" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
            <header className="modal-header">
              <div><p className="eyebrow">HOME SCREEN</p><h3 id="install-help-title">一键打开你的日程</h3></div>
              <button type="button" className="modal-close" autoFocus onClick={() => setInstallHelpOpen(false)} aria-label="关闭桌面说明">×</button>
            </header>
            <h4>iPhone</h4>
            <ol>
              <li>用 Safari 打开当前这份日历。</li>
              <li>点“分享”，选择“添加到主屏幕”。</li>
              <li>若有“作为网页 App 打开”，保持开启，再点“添加”。</li>
            </ol>
            <p>以后点桌面图标就能进入。第一次打开可能需要重新输入原口令。</p>
            <h4>安卓</h4>
            <p>Chrome 右上角菜单 → “添加到主屏幕”或“安装应用”。</p>
            <h4>只想快速记一笔？</h4>
            <p>把下面的入口添加到主屏幕，名称设为“记一笔”。打开并解锁后直接显示录入窗口。</p>
            <a className="primary-btn compose-shortcut" href={`/c/${slug}?compose=1`}>打开“记一笔”入口</a>
            <p className="privacy-note">仍需要联网；桌面版不会绕过口令或改变目前的网络访问条件。不会离线缓存你的日程。</p>
          </section>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <form className="modal event-modal" onSubmit={saveEvent} role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
            <header className="modal-header">
              <div><p className="eyebrow">SCHEDULE</p><h3 id="event-modal-title">{draft.id ? "编辑日程" : "记一笔"}</h3></div>
              <button type="button" className="modal-close" onClick={() => setModalOpen(false)} aria-label="关闭">×</button>
            </header>
            {captureWarnings.length ? <div className="capture-warnings" role="status">
              <strong>保存前请确认</strong>
              <ul>{captureWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div> : null}
            <label className="title-field">
              <span>日程标题</span>
              <input type="text" required autoFocus maxLength={120} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="例如：和产品团队开周会" />
            </label>
            <div className="modal-grid two-columns">
              <label>
                <span>日期</span>
                <input type="date" required value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
              </label>
              <label>
                <span>归入时段</span>
                <select value={draft.period} onChange={(event) => setDraft((current) => ({ ...current, period: event.target.value as Period }))}>
                  <option value="morning">上午</option>
                  <option value="afternoon">下午</option>
                  <option value="evening">晚上</option>
                </select>
              </label>
            </div>
            <div className="modal-grid two-columns">
              <label>
                <span>开始时间</span>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    startTime: event.target.value,
                    period: inferPeriodFromTime(event.target.value, current.period),
                  }))}
                />
              </label>
              <label>
                <span>结束时间</span>
                <input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} />
              </label>
            </div>
            <fieldset className="type-picker">
              <legend>日程类型</legend>
              <div>
                {(Object.keys(TYPE_META) as EventType[]).map((type) => (
                  <label key={type} className={`${TYPE_META[type].className} ${draft.type === type ? "selected" : ""}`}>
                    <input type="radio" name="event-type" value={type} checked={draft.type === type} onChange={() => setDraft((current) => ({ ...current, type }))} />
                    <span className={`event-type-icon ${TYPE_META[type].className}`}><TypeIcon type={type} /></span>
                    {TYPE_META[type].label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              <span>补充备注 <small>选填</small></span>
              <textarea value={draft.description} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="地点、准备事项或其他信息" rows={3} />
            </label>
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
            <footer className="modal-actions">
              {draft.id ? <button type="button" className="delete-button" onClick={() => void deleteEvent({ ...draft, id: draft.id! })}>删除日程</button> : <span />}
              <div>
                <button type="button" onClick={() => setModalOpen(false)}>取消</button>
                <button className="primary-btn" type="submit" disabled={saving}>{saving ? "保存中..." : "保存日程"}</button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}

      {noteModalOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNoteModalOpen(false); }}>
          <form className="modal note-modal" onSubmit={saveNote} role="dialog" aria-modal="true" aria-labelledby="note-modal-title">
            <header className="modal-header">
              <div><p className="eyebrow">DAILY NOTE</p><h3 id="note-modal-title">{formatDate(noteDraft.date)} · 备注</h3></div>
              <button type="button" className="modal-close" onClick={() => setNoteModalOpen(false)} aria-label="关闭">×</button>
            </header>
            <label>
              <span>写下一句提醒或当天重点</span>
              <textarea autoFocus value={noteDraft.note} maxLength={300} onChange={(event) => setNoteDraft((current) => ({ ...current, note: event.target.value }))} placeholder="例如：今天尽量不安排晚间会议" rows={5} />
            </label>
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
            <footer className="modal-actions note-actions">
              <small>{noteDraft.note.length}/300</small>
              <div>
                <button type="button" onClick={() => setNoteModalOpen(false)}>取消</button>
                <button className="primary-btn" type="submit" disabled={saving}>{saving ? "保存中..." : "保存备注"}</button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}
