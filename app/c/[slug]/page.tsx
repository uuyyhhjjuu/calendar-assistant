import { CalendarView } from "@/lib/calendar-view";
import { getCalendarManifestPath } from "@/lib/mobile-app";

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ compose?: string }>;
}) {
  const { slug } = await params;
  const { compose } = await searchParams;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) return {};
  return {
    manifest: getCalendarManifestPath(slug, compose === "1"),
    appleWebApp: { capable: true, statusBarStyle: "default" as const, title: compose === "1" ? "记一笔" : "个人日程助手" },
  };
}

export default async function CalendarSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CalendarView slug={slug} />;
}
