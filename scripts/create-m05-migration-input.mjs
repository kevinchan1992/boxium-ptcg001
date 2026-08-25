import fs from "node:fs";
import path from "node:path";

const [migrationName, disabledArtifactPath, outputPath] = process.argv.slice(2);
if (migrationName !== "m05_validated_high_confidence_constraints" || !disabledArtifactPath || !outputPath) {
  throw new Error("Usage: create-m05-migration-input.mjs m05_validated_high_confidence_constraints <disabled-artifact> <output-json>");
}

const projectRef = "ekqdgoewlvrrwpgulqew";
const query = fs.readFileSync(path.resolve(disabledArtifactPath), "utf8");
const executableSql = query.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").trim();
const statements = executableSql.split(";").map((statement) => statement.trim()).filter(Boolean);

if (statements.length !== 10 || statements.some((statement) => !/^ALTER TABLE /i.test(statement))) {
  throw new Error("M05 input must contain exactly ten ALTER TABLE foreign-key statements");
}
if (/\b(?:CREATE ROLE|GRANT|REVOKE|ENABLE ROW LEVEL SECURITY|CREATE POLICY|DROP TABLE|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)\b/i.test(executableSql)) {
  throw new Error("M05 privilege, RLS, destructive or fixture SQL is not allowed in the schema migration");
}
if (/(?:postgres(?:ql)?:\/\/|mysql:\/\/|VITE_)/i.test(query)) {
  throw new Error("M05 input must not contain a connection string or frontend database key");
}

fs.writeFileSync(path.resolve(outputPath), JSON.stringify({ project_id: projectRef, name: migrationName, query }, null, 2) + "\n");
console.log(JSON.stringify({ migrationName, statements: statements.length, projectRef: "ekqd…lqew" }));
