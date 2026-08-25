import fs from "node:fs";
import path from "node:path";

const [migrationName, disabledArtifactPath, outputPath] = process.argv.slice(2);
const targetProjectId = "bzqppgrieiwigkzrkjtr";
if (migrationName !== "m06_prod_server_only_roles_and_client_revocation" || !disabledArtifactPath || !outputPath) {
  throw new Error("Usage: create-production-m06-migration-input.mjs m06_prod_server_only_roles_and_client_revocation <disabled-artifact> <output-json>");
}
const query = fs.readFileSync(path.resolve(disabledArtifactPath), "utf8");
const executableSql = query.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").trim();
const required = [/CREATE ROLE boxium_runtime NOLOGIN/i, /CREATE ROLE boxium_migrator NOLOGIN/i, /REVOKE ALL ON SCHEMA public FROM anon, authenticated/i, /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO boxium_runtime/i];
if (required.some((pattern) => !pattern.test(executableSql))) {
  throw new Error("M06 server-only migration is missing a required role-revocation-grant control");
}
if (/\b(?:LOGIN|PASSWORD|ENABLE ROW LEVEL SECURITY|CREATE POLICY|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|DROP\s+TABLE|COPY)\b/i.test(executableSql)) {
  throw new Error("M06 must not create credentials, RLS policies, data mutations or destructive DDL");
}
if (/(?:postgres(?:ql)?:\/\/|mysql:\/\/|VITE_)/i.test(query)) {
  throw new Error("M06 input must not contain a connection string or frontend database key");
}
fs.writeFileSync(path.resolve(outputPath), JSON.stringify({ project_id: targetProjectId, name: migrationName, query }, null, 2) + "\n");
console.log(JSON.stringify({ migrationName, projectRef: "bzq…kjtr", containsCredential: false }));
