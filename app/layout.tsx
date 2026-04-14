import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "个人日程助手",
  description: "周视图日历助手，支持私密链接和口令同步",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}