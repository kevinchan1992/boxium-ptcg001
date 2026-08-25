import fs from "node:fs";
import path from "node:path";

const inventoryPath = path.resolve("docs/db-parity/production-source-inventory.json");
const outputPath = path.resolve("docs/db-parity/production-inventory-classification.json");
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

const rebuildableSearch = new Set(["searchTokens", "snkrdunkGradeIndex"]);
const rebuildableCaches = new Set([
  "snkrdunkListingsCache", "ebayListingsCache", "trendingCardsCache", "trendingRankingsCache",
  "marketTrends", "searchStats", "priceUpdateSchedule", "scheduleConfig", "scheduledTasks",
]);
const operationalLogs = new Set([
  "scraperPerformanceLogs", "scheduleExecutionHistory", "userSearchLogs", "marketplaceSearchLogs",
  "emailLogs", "securityEvents", "webhookLogs", "adminAuditLogs", "listingModerationLogs",
]);

function groupFor(tableName) {
  if (rebuildableSearch.has(tableName)) return "rebuildable_search_index";
  if (rebuildableCaches.has(tableName)) return "rebuildable_cache";
  if (operationalLogs.has(tableName)) return "operational_log";
  return "core_or_business_data";
}

const groups = new Map();
for (const table of inventory.tables) {
  const group = groupFor(table.tableName);
  if (!groups.has(group)) groups.set(group, { rows: 0, dataBytes: 0, indexBytes: 0, tables: [] });
  const bucket = groups.get(group);
  bucket.rows += table.rowCount;
  bucket.dataBytes += table.estimatedDataBytes ?? 0;
  bucket.indexBytes += table.estimatedIndexBytes ?? 0;
  bucket.tables.push(table);
}

const totals = {
  rows: inventory.totalRows,
  dataBytes: inventory.totalEstimatedDataBytes,
  indexBytes: inventory.totalEstimatedIndexBytes,
};

const result = {
  generatedAt: new Date().toISOString(),
  sourceSchemaSha256: inventory.sourceSchemaSha256,
  targetOnlyTables: inventory.targetOnlyTables,
  totals,
  groups: Object.fromEntries([...groups.entries()].map(([name, value]) => [name, {
    ...value,
    totalBytes: value.dataBytes + value.indexBytes,
    percentOfRows: Number((value.rows / totals.rows * 100).toFixed(2)),
  }])),
  largestTables: [...inventory.tables]
    .map((table) => ({ ...table, totalBytes: (table.estimatedDataBytes ?? 0) + (table.estimatedIndexBytes ?? 0) }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, 15),
  dataHandling: "Aggregated table counts and information_schema metadata only; no row content, credentials or connection strings are written.",
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ output: path.relative(process.cwd(), outputPath), groups: Object.keys(result.groups) }));
