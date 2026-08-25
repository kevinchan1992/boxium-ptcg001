import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => readFileSync(path.join(root, "docs", "db-parity", "migrations", "lab-disabled", "manual", name), "utf8");

describe("M05 Lab-only constraint proposal", () => {
  it("contains only the ten high-confidence FK constraints and no access control SQL", () => {
    const ddl = read("M05-validated-constraints.sql.disabled");
    const executableSql = ddl.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
    expect((ddl.match(/^ALTER TABLE /gm) ?? [])).toHaveLength(10);
    expect(ddl).toMatch(/m05_cards_game/);
    expect(ddl).toMatch(/m05_posts_category/);
    expect(ddl).toMatch(/m05_post_tags_post/);
    expect(ddl).toMatch(/m05_user_collections_card/);
    expect(executableSql).not.toMatch(/\b(?:CREATE ROLE|GRANT|REVOKE|ENABLE ROW LEVEL SECURITY|CREATE POLICY)\b/i);
    expect(executableSql).not.toMatch(/postgres(?:ql)?:\/\//i);
  });

  it("documents ephemeral synthetic-only fixtures and excludes unresolved polymorphic relations", () => {
    const fixture = read("M05-synthetic-fixture-test.sql.disabled");
    const plan = readFileSync(path.join(root, "docs", "db-parity", "m05-synthetic-integrity-plan.md"), "utf8");
    expect(fixture).toContain("DO $m05$");
    expect(fixture).toContain("m05_fixture_rows_remaining");
    expect(fixture).toContain("M05 fixture cleanup failed");
    expect(fixture).toContain("910001");
    expect(fixture).toContain("m05-fixture@lab.invalid");
    expect(plan).toContain("productType");
    expect(plan).toContain("無 Production data");
  });
});
