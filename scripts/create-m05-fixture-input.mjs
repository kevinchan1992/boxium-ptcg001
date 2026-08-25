import fs from "node:fs";
import path from "node:path";

const [disabledArtifactPath, outputPath] = process.argv.slice(2);
if (!disabledArtifactPath || !outputPath) throw new Error("Usage: create-m05-fixture-input.mjs <disabled-artifact> <output-json>");

const projectRef = "ekqdgoewlvrrwpgulqew";
const query = fs.readFileSync(path.resolve(disabledArtifactPath), "utf8");
const executableSql = query.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").trim();

if (!executableSql.startsWith("DO $m05$") || !executableSql.includes("m05_fixture_rows_remaining")) {
  throw new Error("M05 fixture must be the reviewed atomic fixture contract");
}
if (!executableSql.includes("m05-fixture@lab.invalid") || !executableSql.includes("910001") || !executableSql.includes("M05 fixture cleanup failed")) {
  throw new Error("M05 fixture must retain synthetic identifiers and cleanup assertion");
}
if (/\b(?:CREATE ROLE|GRANT|REVOKE|ENABLE ROW LEVEL SECURITY|CREATE POLICY|ALTER TABLE|DROP TABLE)\b/i.test(executableSql)) {
  throw new Error("M05 fixture query must not alter schema, privileges or RLS");
}
if (/(?:postgres(?:ql)?:\/\/|mysql:\/\/|VITE_)/i.test(query)) {
  throw new Error("M05 fixture must not contain a connection string or frontend database key");
}

fs.writeFileSync(path.resolve(outputPath), JSON.stringify({ project_id: projectRef, query }, null, 2) + "\n");
console.log(JSON.stringify({ fixture: "m05_synthetic_atomic", projectRef: "ekqd…lqew" }));
