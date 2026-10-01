function calendarPath(slug: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) throw new Error("Invalid calendar slug");
  return `/c/${slug}`;
}

export function getCalendarManifestPath(slug: string, compose = false) {
  return `${calendarPath(slug)}/manifest.webmanifest${compose ? "?compose=1" : ""}`;
}

export function getCalendarAppManifest(slug: string, compose = false) {
  const path = calendarPath(slug);
  const startUrl = `${path}${compose ? "?compose=1" : ""}`;
  return {
    id: startUrl,
    name: compose ? "记一笔" : "个人日程助手",
    short_name: compose ? "记一笔" : "我的日程",
    description: "点开桌面图标，查看或记录你的私密日程",
    lang: "zh-CN",
    start_url: startUrl,
    scope: path,
    display: "standalone" as const,
    background_color: "#f4f5f1",
    theme_color: "#f4f5f1",
    icons: [192, 512].map((size) => ({
      src: `/app-icon?size=${size}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any maskable" as const,
    })),
    shortcuts: [{
      name: "记一笔",
      short_name: "记一笔",
      description: "直接打开新增日程窗口",
      url: `${path}?compose=1`,
    }],
  };
}
