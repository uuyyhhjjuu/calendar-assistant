import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell centered">
      <section className="card create-card">
        <h1>个人日程助手</h1>
        <p>创建一个私密日历链接，输入口令后可跨设备同步。</p>
        <Link href="/create" className="primary-btn">创建我的日历</Link>
      </section>
    </main>
  );
}