import { z } from "zod";

export const importSchema = z.object({
  slug: z.string().min(8),
  payload: z.object({
    events: z.array(z.object({
      date: z.string().min(10).max(40),
      period: z.enum(["morning", "afternoon", "evening"]),
      type: z.enum(["work", "personal", "social"]).default("work"),
      startTime: z.string().nullable().optional(),
      endTime: z.string().nullable().optional(),
      title: z.string().min(1).max(120),
      description: z.string().nullable().optional(),
      status: z.enum(["active", "done", "cancelled"]).optional(),
    })),
    dayNotes: z.array(z.object({ date: z.string().min(10).max(40), note: z.string().max(300) })),
    todos: z.array(z.object({
      content: z.string().min(1).max(200),
      done: z.boolean().default(false),
      sortOrder: z.number().int().nonnegative().optional(),
    })),
  }),
});
