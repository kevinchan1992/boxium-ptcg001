import fs from "node:fs";
import path from "node:path";

const [, , migrationName, disabledArtifactPath, outputPath] = process.argv;
const targetProjectId = "bzqppgrieiwigkzrkjtr";
const expectedPatterns = {
  m02_prod_enum_and_domain_types: /^\s*CREATE TYPE /im,
  m03_prod_base_tables_and_identity: /^\s*CREATE TABLE /im,
  m04_prod_indexes_and_unique_resolved: /^\s*CREATE (?:UNIQUE )?INDEX /im,
  m05_prod_validated_high_confidence_constraints: /^\s*ALTER TABLE /im,
};

if (!migrationName || !disabledArtifactPath || !outputPath || !expectedPatterns[migrationName]) {
  throw new Error("Unsupported production baseline migration name or missing arguments");
}
if (!disabledArtifactPath.endsWith(".sql.disabled")) {
  throw new Error("Only reviewed .sql.disabled artifacts may be used");
}

const query = fs.readFileSync(path.resolve(disabledArtifactPath), "utf8");
const executableSql = query.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").trim();
if (!expectedPatterns[migrationName].test(executableSql)) {
  throw new Error("Artifact SQL does not match the selected M02–M05 schema-only phase");
}
if (/\b(?:CREATE ROLE|ALTER ROLE|GRANT|REVOKE|ENABLE ROW LEVEL SECURITY|CREATE POLICY|INSERT|UPDATE|DELETE|DROP TABLE|TRUNCATE|COPY)\b/i.test(executableSql)) {
  throw new Error("Production baseline only permits reviewed M02–M05 DDL; data, M06/RLS and destructive SQL are forbidden");
}
if (/(?:postgres(?:ql)?:\/\/|mysql:\/\/|VITE_)/i.test(query)) {
  throw new Error("Baseline artifact must not contain a credential, connection string or frontend database key");
}

const input = { project_id: targetProjectId, name: migrationName, query };
fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(input)}\n`, "utf8");
console.log(JSON.stringify({ migrationName, bytes: Buffer.byteLength(query), projectRef: "bzq…kjtr" }));
