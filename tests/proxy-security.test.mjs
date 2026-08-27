import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const proxySource = readFileSync(join(root, "proxy.ts"), "utf8");

test("proxy rate limiting ignores spoofable X-Real-IP", () => {
  assert.doesNotMatch(proxySource, /headers\.get\(["']x-real-ip["']\)/i);
  assert.match(proxySource, /headers\.get\(["']x-forwarded-for["']\)/i);
});

test("proxy rate limiter has a bounded fail-closed ledger", () => {
  assert.match(proxySource, /MAX_RATE_RECORDS\s*=\s*10_000/);
  assert.match(proxySource, /rateMap\.size\s*>=\s*MAX_RATE_RECORDS/);
  assert.match(proxySource, /return true;/);
  assert.match(proxySource, /rateMap\.delete\(key\)/);
});
