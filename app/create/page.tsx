"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCalendarPage() {
  const [passcode, setPasscode] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, timezone }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "创建失败");
        return;
      }

      await fetch("/api/calendar/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: payload.slug, passcode }),
      });

      router.push(`/c/${payload.slug}`);
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell centered">
      <section className="card create-card">
        <h1>创建私密日历</h1>
        <p>生成后请保管好链接与口令。</p>
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            口令（至少 6 位）
            <input
              type="password"
              minLength={6}
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
          </label>

          <label>
            时区
            <input
              type="text"
              required
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </label>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "创建中..." : "创建并进入"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}