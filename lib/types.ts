export type Period = "morning" | "afternoon" | "evening";
export type EventType = "work" | "personal" | "social";

export type EventItem = {
  id: string;
  date: string;
  period: Period;
  type: EventType;
  startTime: string | null;
  endTime: string | null;
  title: string;
  description: string | null;
  status: "active" | "done" | "cancelled";
};

export type DayNote = {
  date: string;
  note: string;
};

export type TodoItem = {
  id: string;
  content: string;
  done: boolean;
  sortOrder: number;
};

export type WeekPayload = {
  weekStart: string;
  events: EventItem[];
  dayNotes: DayNote[];
  todos: TodoItem[];
};