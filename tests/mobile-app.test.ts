import assert from "node:assert/strict";
import test from "node:test";

async function loadMobileApp() {
  try {
    return await import("../lib/mobile-app.ts");
  } catch {
    return null;
  }
}

test("桌面入口直接打开当前私密日历，而不是创建新日历的首页", async () => {
  const app = await loadMobileApp();
  assert.ok(app, "mobile app manifest builder should exist");
  const manifest = app.getCalendarAppManifest("test-calendar");
  assert.equal(manifest.start_url, "/c/test-calendar");
  assert.equal(manifest.id, manifest.start_url);
  assert.equal(manifest.scope, "/c/test-calendar");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.name, "个人日程助手");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.equal(manifest.shortcuts[0].url, "/c/test-calendar?compose=1");
});

test("安装配置只含当前路径和通用图标，不接收口令或外部网址", async () => {
  const app = await loadMobileApp();
  assert.ok(app);
  assert.throws(() => app.getCalendarAppManifest("../../external"));
  assert.throws(() => app.getCalendarAppManifest("https://example.com"));
  const manifest = app.getCalendarAppManifest("test-calendar");
  assert.equal(app.getCalendarManifestPath("test-calendar"), "/c/test-calendar/manifest.webmanifest");
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith("/app-icon?size=")));
  assert.equal(JSON.stringify(manifest).includes("passcode"), false);
});

test("记一笔拥有独立安装入口，桌面启动不会丢失快速录入参数", async () => {
  const app = await loadMobileApp();
  assert.ok(app);
  const manifest = app.getCalendarAppManifest("test-calendar", true);
  assert.equal(manifest.start_url, "/c/test-calendar?compose=1");
  assert.equal(manifest.id, manifest.start_url);
  assert.equal(manifest.name, "记一笔");
  assert.equal(manifest.scope, "/c/test-calendar");
  assert.equal(app.getCalendarManifestPath("test-calendar", true), "/c/test-calendar/manifest.webmanifest?compose=1");
});
