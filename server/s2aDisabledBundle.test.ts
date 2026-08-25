import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = path.join(root, "docs", "db-parity", "migrations", "lab-disabled", "manual");
const read = (name: string) => readFileSync(path.join(bundleDir, name), "utf8");

describe("S2-A disabled Lab migration bundle", () => {
  it("contains the S1 mapped enum, table and index proposals only", () => {
    const summary = JSON.parse(read("bundle-summary.json"));
    expect(summary.connectionUsed).toBe(false);
    expect(summary.tableCount).toBe(95);
    expect(summary.enumCount).toBe(96);
    expect(summary.indexCount).toBe(206);
    expect(summary.indexNameCollisionEntries).toBe(4);
    expect(summary.omittedStages).toEqual(["M05-validated-constraints", "M06-runtime-grants"]);

    expect((read("M02-enum-and-domain-types.sql.disabled").match(/^CREATE TYPE /gm) ?? [])).toHaveLength(96);
    expect((read("M03-base-tables-and-identity.sql.disabled").match(/^CREATE TABLE /gm) ?? [])).toHaveLength(95);
    expect((read("M04-indexes-and-unique.sql.disabled").match(/^CREATE (?:UNIQUE )?INDEX /gm) ?? [])).toHaveLength(206);

    const indexNames = [...read("M04-indexes-and-unique.sql.disabled").matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"/gm)].map((match) => match[1]);
    expect(new Set(indexNames).size).toBe(indexNames.length);
    const resolution = JSON.parse(read("index-name-resolution.json"));
    expect(resolution.resolutions).toHaveLength(4);
    expect(resolution.resolutions).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceName: "cardId_idx", resolvedName: "cardId_idx__snkrdunkListingsCache" }),
      expect.objectContaining({ sourceName: "cardId_idx", resolvedName: "cardId_idx__ebayListingsCache" }),
    ]));
  });

  it("contains no connection string, role/grant, foreign-key or executable migration path", () => {
    const bundle = [
      read("M02-enum-and-domain-types.sql.disabled"),
      read("M03-base-tables-and-identity.sql.disabled"),
      read("M04-indexes-and-unique.sql.disabled"),
    ].join("\n");

    expect(bundle).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(bundle).not.toMatch(/mysql:\/\//i);
    expect(bundle).not.toMatch(/\b(?:CREATE ROLE|GRANT|REVOKE|FOREIGN KEY)\b/i);
  });
});
