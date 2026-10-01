import assert from "node:assert/strict";
import test from "node:test";

type SessionCookie = typeof import("../lib/session-cookie.ts");

async function loadSessionCookie(): Promise<SessionCookie | null> {
  try {
    return await import("../lib/session-cookie.ts");
  } catch {
    return null;
  }
}

test("锁定日历时生成立即过期且仍为 HttpOnly 的会话 Cookie", async () => {
  const sessionCookie = await loadSessionCookie();
  assert.ok(sessionCookie, "session cookie module should exist");

  const cookie = sessionCookie.getClearedSessionCookie(true);
  assert.equal(cookie.name, "calendar_session");
  assert.equal(cookie.value, "");
  assert.equal(cookie.options.maxAge, 0);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, true);
  assert.equal(cookie.options.sameSite, "lax");
  assert.equal(cookie.options.path, "/");
});
