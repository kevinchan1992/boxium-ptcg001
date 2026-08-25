import fs from "node:fs";
import path from "node:path";

const [migrationName, disabledArtifactPath, outputPath] = process.argv.slice(2);
const targetProjectId = "bzqppgrieiwigkzrkjtr";
if (migrationName !== "m05_prod_validated_high_confidence_constraints" || !disabledArtifactPath || !outputPath) {
  throw new Error("Usage: create-production-m05-migration-input.mjs m05_prod_validated_high_confidence_constraints <disabled-artifact> <output-json>");
}

const query = fs.readFileSync(path.resolve(disabledArtifactPath), "utf8");
const executableSql = query.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").trim();
const statements = executableSql.split(";").map((statement) => statement.trim()).filter(Boolean);
if (statements.length !== 10 || statements.some((statement) => !/^ALTER TABLE /i.test(statement))) {
  throw new Error("M05 production input must contain exactly ten ALTER TABLE foreign-key statements");
}
if (/\b(?:CREATE ROLE|ALTER ROLE|GRANT|REVOKE|ENABLE ROW LEVEL SECURITY|CREATE POLICY|DROP TABLE|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|COPY)\b/i.test(executableSql)) {
  throw new Error("M05 production input may not contain privileges, RLS, destructive or fixture SQL");
}
if (/(?:postgres(?:ql)?:\/\/|mysql:\/\/|VITE_)/i.test(query)) {
  throw new Error("M05 production input must not contain a connection string or frontend database key");
}

fs.writeFileSync(path.resolve(outputPath), JSON.stringify({ project_id: targetProjectId, name: migrationName, query }, null, 2) + "\n");
console.log(JSON.stringify({ migrationName, statements: statements.length, projectRef: "bzq…kjtr" }));
