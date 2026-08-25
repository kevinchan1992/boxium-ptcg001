import fs from "node:fs";
import path from "node:path";

const [migrationName, disabledArtifactPath, outputPath] = process.argv.slice(2);
const targetProjectId = "bzqppgrieiwigkzrkjtr";
if (migrationName !== "m06a_prod_revoke_public_inherited_privileges" || !disabledArtifactPath || !outputPath) {
  throw new Error("Usage: create-production-m06a-migration-input.mjs m06a_prod_revoke_public_inherited_privileges <disabled-artifact> <output-json>");
}
const query = fs.readFileSync(path.resolve(disabledArtifactPath), "utf8");
const executableSql = query.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").trim();
if ((executableSql.match(/\bREVOKE\b/gi) ?? []).length !== 7 || !/REVOKE ALL ON SCHEMA public FROM PUBLIC/i.test(executableSql)) {
  throw new Error("M06a must only contain the reviewed PUBLIC privilege cleanup statements");
}
if (/\b(?:CREATE ROLE|ALTER ROLE|GRANT|ENABLE ROW LEVEL SECURITY|CREATE POLICY|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|DROP\s+TABLE|COPY|LOGIN|PASSWORD)\b/i.test(executableSql)) {
  throw new Error("M06a may not introduce credentials, grants, RLS, data mutations or destructive DDL");
}
fs.writeFileSync(path.resolve(outputPath), JSON.stringify({ project_id: targetProjectId, name: migrationName, query }, null, 2) + "\n");
console.log(JSON.stringify({ migrationName, projectRef: "bzq…kjtr" }));
