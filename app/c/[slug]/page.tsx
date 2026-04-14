import { CalendarView } from "@/lib/calendar-view";

export default async function CalendarSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CalendarView slug={slug} />;
}