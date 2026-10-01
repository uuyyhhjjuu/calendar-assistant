import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "个人日程助手",
  description: "周视图日历助手，支持私密链接和口令同步",
  applicationName: "个人日程助手",
  icons: {
    icon: [{ url: "/app-icon?size=192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/app-icon?size=180", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: false, follow: false, noarchive: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "个人日程助手",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f5f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
