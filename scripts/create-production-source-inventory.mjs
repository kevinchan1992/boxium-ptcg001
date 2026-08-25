import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

const sourceSchemaPath = process.env.BOXIUM_SOURCE_SCHEMA_PATH || "/home/ubuntu/boxium-ptcg/drizzle/schema_new.ts";
const outputPath = process.env.BOXIUM_SOURCE_INVENTORY_OUTPUT || path.resolve("docs/db-parity/production-source-inventory.json");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required through the managed environment and must never be passed on the command line");
}

const schemaSource = fs.readFileSync(sourceSchemaPath, "utf8");
const tableNames = [...schemaSource.matchAll(/mysqlTable\("([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
if (tableNames.length !== 95 || new Set(tableNames).size !== tableNames.length) {
  throw new Error(`Expected 95 unique MySQL source tables, found ${tableNames.length}`);
}
const targetOnlyTables = ["articleGenerationHistory"];
const sourceTableNames = tableNames.filter((tableName) => !targetOnlyTables.includes(tableName));

const connection = await mysql.createConnection(databaseUrl);
try {
  const [schemas] = await connection.query(
    "SELECT SCHEMA_NAME AS dbName FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')",
  );
  const sourceCandidates = [];
  for (const { dbName } of schemas) {
    const [dbTables] = await connection.query(
      "SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [dbName],
    );
    const names = new Set(dbTables.map((row) => row.tableName));
    const missing = sourceTableNames.filter((tableName) => !names.has(tableName));
    sourceCandidates.push({ dbName, matchedTableCount: sourceTableNames.length - missing.length, missing });
  }
  sourceCandidates.sort((left, right) => right.matchedTableCount - left.matchedTableCount);
  const best = sourceCandidates[0];
  if (!best || best.matchedTableCount !== sourceTableNames.length || (sourceCandidates[1]?.matchedTableCount === best.matchedTableCount)) {
    const matched = best?.matchedTableCount ?? 0;
    const missing = best?.missing?.join(", ") || "unknown";
    throw new Error(`Unable to uniquely identify a source schema with all ${sourceTableNames.length} expected source tables; best match has ${matched}; missing: ${missing}`);
  }
  const dbName = best.dbName;

  const [existingRows] = await connection.query(
    "SELECT TABLE_NAME AS tableName, DATA_LENGTH AS dataBytes, INDEX_LENGTH AS indexBytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
    [dbName],
  );
  const existing = new Set(existingRows.map((row) => row.tableName));
  const tableMetadata = new Map(existingRows.map((row) => [row.tableName, row]));
  const missing = sourceTableNames.filter((tableName) => !existing.has(tableName));
  if (missing.length) throw new Error(`Source schema missing expected tables: ${missing.join(", ")}`);

  const tables = [];
  for (const tableName of sourceTableNames) {
    const escapedSchema = `\`${dbName.replaceAll("`", "``")}\``;
    const escapedTable = `\`${tableName.replaceAll("`", "``")}\``;
    const escaped = `${escapedSchema}.${escapedTable}`;
    const [rows] = await connection.query(`SELECT COUNT(*) AS rowCount FROM ${escaped}`);
    const metadata = tableMetadata.get(tableName);
    tables.push({
      tableName,
      rowCount: Number(rows[0].rowCount),
      estimatedDataBytes: Number(metadata?.dataBytes ?? 0),
      estimatedIndexBytes: Number(metadata?.indexBytes ?? 0),
    });
  }

  const inventory = {
    generatedAt: new Date().toISOString(),
    source: "managed-mysql-tidb",
    sourceSchemaSha256: crypto.createHash("sha256").update(schemaSource).digest("hex"),
    sourceTableCount: sourceTableNames.length,
    targetTableCount: tableNames.length,
    targetOnlyTables,
    totalRows: tables.reduce((total, table) => total + table.rowCount, 0),
    totalEstimatedDataBytes: tables.reduce((total, table) => total + table.estimatedDataBytes, 0),
    totalEstimatedIndexBytes: tables.reduce((total, table) => total + table.estimatedIndexBytes, 0),
    tables,
    dataHandling: "Counts only; no row content, credentials or connection strings are written.",
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ sourceTableCount: inventory.sourceTableCount, targetTableCount: inventory.targetTableCount, totalRows: inventory.totalRows, output: path.relative(process.cwd(), outputPath) }));
} finally {
  await connection.end();
}
