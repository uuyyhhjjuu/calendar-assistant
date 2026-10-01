import { getCalendarAppManifest } from "@/lib/mobile-app";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const compose = new URL(request.url).searchParams.get("compose") === "1";
    return new Response(JSON.stringify(getCalendarAppManifest(slug, compose)), {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Invalid calendar path", { status: 400 });
  }
}
