import type { Period } from "./types";

export function getWeekStart(value: Date): string {
  const current = new Date(value);
  const day = current.getDay();
  const distance = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + distance);
  current.setHours(0, 0, 0, 0);
  return toIsoDay(current);
}

export function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDay(date);
}

export function toIsoDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00`);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function getPeriodLabel(period: Period): { title: string; timeRange: string } {
  if (period === "morning") return { title: "上午", timeRange: "08:00-12:00" };
  if (period === "afternoon") return { title: "下午", timeRange: "12:00-17:00" };
  return { title: "晚上", timeRange: "17:00-22:00" };
}