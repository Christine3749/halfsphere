import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const approvalRoute = readFileSync(
  join(root, "app", "api", "admin", "applications", "[id]", "approve", "route.ts"),
  "utf8",
);
const approvalEmail = readFileSync(join(root, "lib", "email.ts"), "utf8");

test("approval never creates or returns a plaintext password", () => {
  assert.doesNotMatch(approvalRoute, /randomBytes|createUser\s*\(/);
  assert.doesNotMatch(approvalRoute, /temp_password|tempPassword/);
  assert.match(approvalRoute, /generateLink/);
});

test("approval email carries only a one-time action link", () => {
  assert.doesNotMatch(approvalEmail, /tempPassword|临时密码/);
  assert.match(approvalEmail, /secureActionLink/);
  assert.match(approvalEmail, /一次性链接/);
});
