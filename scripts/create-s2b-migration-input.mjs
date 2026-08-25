import fs from "node:fs";
import path from "node:path";

const [, , migrationName, sqlPath, outputPath] = process.argv;
if (!migrationName || !sqlPath || !outputPath) {
  throw new Error("Usage: node create-s2b-migration-input.mjs <migration_name> <sql_disabled_path> <output_json_path>");
}
if (!sqlPath.endsWith(".sql.disabled")) {
  throw new Error("Only .sql.disabled review artifacts are allowed");
}

const query = fs.readFileSync(sqlPath, "utf8");
if (/\b(?:CREATE ROLE|GRANT|REVOKE|FOREIGN KEY)\b/i.test(query)) {
  throw new Error("M05/M06 or privilege SQL is not allowed in S2-B");
}

const input = {
  project_id: "ekqdgoewlvrrwpgulqew",
  name: migrationName,
  query,
};
fs.writeFileSync(outputPath, `${JSON.stringify(input)}\n`, "utf8");
console.log(JSON.stringify({ migrationName, bytes: Buffer.byteLength(query), projectRef: "ekqd…lqew" }));
