import { z } from "zod";

export const createCalendarSchema = z.object({
  passcode: z.string().min(6).max(100),
  timezone: z.string().min(2).max(64).default("Asia/Shanghai"),
});

export const unlockSchema = z.object({
  slug: z.string().min(8).max(64),
  passcode: z.string().min(6).max(100),
});

export const weekSchema = z.object({
  slug: z.string().min(8),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const eventSchema = z.object({
  slug: z.string().min(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(["morning", "afternoon", "evening"]),
  type: z.enum(["work", "personal", "social"]).default("work"),
  title: z.string().min(1).max(120),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["active", "done", "cancelled"]).optional(),
});

export const noteSchema = z.object({
  slug: z.string().min(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(300),
});

export const todoCreateSchema = z.object({
  slug: z.string().min(8),
  content: z.string().min(1).max(200),
});

export const todoUpdateSchema = z.object({
  slug: z.string().min(8),
  content: z.string().max(200).optional(),
  done: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});