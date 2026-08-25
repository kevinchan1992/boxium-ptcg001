import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const artifactPath = path.resolve(process.cwd(), "docs/db-parity/migrations/lab-disabled/manual/M06-server-only-roles.sql.disabled");
const sql = fs.readFileSync(artifactPath, "utf8");
const executableSql = sql.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");

describe("M06 server-only role bundle", () => {
  it("creates non-login roles and removes client-role privileges", () => {
    expect(executableSql).toMatch(/CREATE ROLE boxium_runtime NOLOGIN/i);
    expect(executableSql).toMatch(/CREATE ROLE boxium_migrator NOLOGIN/i);
    expect(executableSql).toMatch(/REVOKE ALL ON SCHEMA public FROM anon, authenticated/i);
    expect(executableSql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO boxium_runtime/i);
  });

  it("does not create a secret, browser path, RLS policy or data mutation", () => {
    expect(executableSql).not.toMatch(/\bLOGIN\b|\bPASSWORD\b|ENABLE ROW LEVEL SECURITY|CREATE POLICY/i);
    expect(executableSql).not.toMatch(/INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|COPY|postgres(?:ql)?:\/\/|mysql:\/\/|VITE_/i);
  });
});
