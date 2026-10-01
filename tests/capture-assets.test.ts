import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("截图识别配置固定使用同源引擎和模型，麦克风只向本网站开放", async () => {
  const source = await readFile(new URL("../lib/capture-ocr.ts", import.meta.url), "utf8");
  assert.ok(source.includes('new URL("/ocr/", window.location.origin)'));
  for (const name of ["workerPath:", "corePath:", "langPath:"]) assert.ok(source.includes(name));
  assert.ok(!source.includes("https://"));
  const config = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");
  assert.ok(config.includes("camera=(), microphone=(self), geolocation=()"));
});
