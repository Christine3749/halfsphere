import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationDir = join(root, "supabase", "migrations");
const sqlPaths = [
  ...readdirSync(migrationDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => join(migrationDir, name)),
  join(root, "scripts", "full-rebuild.sql"),
  join(root, "scripts", "nuclear-rebuild.sql"),
  join(root, "scripts", "emergency-rebuild-user-tiers.sql"),
];

const executableSql = sqlPaths
  .map((path) => readFileSync(path, "utf8"))
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*--.*$/gm, "");

test("clients cannot update their own authorization row", () => {
  assert.doesNotMatch(
    executableSql,
    /CREATE\s+POLICY[\s\S]{0,160}ON\s+(?:public\.)?user_tiers[\s\S]{0,80}FOR\s+UPDATE/i,
  );
  assert.doesNotMatch(
    executableSql,
    /GRANT[^;]*UPDATE[^;]*ON\s+(?:TABLE\s+)?(?:public\.)?user_tiers/i,
  );
});

test("anonymous clients cannot list registration requests", () => {
  assert.doesNotMatch(
    executableSql,
    /CREATE\s+POLICY[\s\S]{0,160}ON\s+(?:public\.)?registration_requests[\s\S]{0,100}FOR\s+SELECT[\s\S]{0,80}TO[^;]*anon/i,
  );
});

test("live hardening revokes unsafe grants and hardens the admin function", () => {
  const hardening = readFileSync(
    join(migrationDir, "20260826000001_authz_security_hardening.sql"),
    "utf8",
  );
  assert.match(hardening, /REVOKE INSERT, UPDATE, DELETE ON public\.user_tiers/);
  assert.match(hardening, /SET search_path = ''/);
  assert.match(hardening, /REVOKE SELECT, UPDATE, DELETE ON public\.registration_requests/);
});

test("destructive maintenance scripts are transactionally quarantined", () => {
  const scripts = [
    ["full-rebuild.sql", "FULL_REBUILD_ACKNOWLEDGED"],
    ["nuclear-rebuild.sql", "NUCLEAR_REBUILD_ACKNOWLEDGED"],
    ["emergency-rebuild-user-tiers.sql", "USER_TIERS_REBUILD_ACKNOWLEDGED"],
  ];

  for (const [name, confirmation] of scripts) {
    const sql = readFileSync(join(root, "scripts", name), "utf8");
    assert.match(sql, /^--[\s\S]*?\bBEGIN;/);
    assert.match(sql, /current_setting\('halfsphere\.expected_database', true\)/);
    assert.match(sql, /current_setting\('halfsphere\.verified_backup_sha256', true\)/);
    assert.match(sql, /current_setting\('halfsphere\.change_id', true\)/);
    assert.match(sql, new RegExp(confirmation));
    assert.match(sql, /COMMIT;\s*$/);
  }
});
