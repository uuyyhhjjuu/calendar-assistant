import type { EventItem, EventType, Period, TodoItem } from "./types";

export type EventFilters = {
  type: "all" | EventType;
  query: string;
  activeOnly: boolean;
};

export type TodaySummary = {
  activeEventCount: number;
  nextEvent: EventItem | null;
  todoDoneCount: number;
  todoTotalCount: number;
};

export function timeToMinutes(value?: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }
  return hours * 60 + minutes;
}

export function inferPeriodFromTime(value: string, fallback: Period): Period {
  const minutes = timeToMinutes(value);
  if (!Number.isFinite(minutes)) return fallback;
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

export function validateTimeRange(startTime: string, endTime: string): string | null {
  if (!startTime || !endTime) return null;
  return timeToMinutes(endTime) > timeToMinutes(startTime)
    ? null
    : "结束时间需要晚于开始时间";
}

export function sortEvents(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => {
    const timeDifference = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (Number.isNaN(timeDifference) || timeDifference === 0) {
      return a.title.localeCompare(b.title, "zh-CN");
    }
    return timeDifference;
  });
}

export function filterEvents(events: EventItem[], filters: EventFilters): EventItem[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  return events.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.activeOnly && item.status !== "active") return false;
    if (!query) return true;
    return `${item.title} ${item.description ?? ""}`.toLocaleLowerCase("zh-CN").includes(query);
  });
}

export function getTodaySummary(
  events: EventItem[],
  todos: TodoItem[],
  today: string,
  nowTime: string
): TodaySummary {
  const activeEvents = sortEvents(
    events.filter((item) => item.date === today && item.status === "active")
  );
  const nowMinutes = timeToMinutes(nowTime);
  const nextEvent =
    activeEvents.find((item) => {
      const end = timeToMinutes(item.endTime || item.startTime);
      return Number.isFinite(end) && end >= nowMinutes;
    }) ?? null;

  return {
    activeEventCount: activeEvents.length,
    nextEvent,
    todoDoneCount: todos.filter((item) => item.done).length,
    todoTotalCount: todos.length,
  };
}

export function getQuickCreateDate(weekStart: string, today: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const current = new Date(`${today}T00:00:00`);
  return current >= start && current <= end ? today : weekStart;
}

export function getMobileDate(weekStart: string, selected: string, today: string): string {
  const end = new Date(`${weekStart}T00:00:00`);
  end.setDate(end.getDate() + 6);
  const endDay = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return selected >= weekStart && selected <= endDay ? selected : getQuickCreateDate(weekStart, today);
}
