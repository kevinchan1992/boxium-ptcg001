import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log("=== 當前數據庫狀態 ===\n");

// 獲取所有表名
const [tables] = await connection.query("SHOW TABLES");
console.log(`✅ 數據庫連接成功！`);
console.log(`📊 共有 ${tables.length} 個表\n`);

// 統計每個表的記錄數
console.log("表名\t\t\t\t記錄數");
console.log("─".repeat(60));

let totalRecords = 0;
for (const table of tables) {
  const tableName = Object.values(table)[0];
  const [result] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
  const count = result[0].count;
  totalRecords += parseInt(count);
  console.log(`${tableName.padEnd(40)}\t${count.toLocaleString()}`);
}

console.log("─".repeat(60));
console.log(`總記錄數：${totalRecords.toLocaleString()}\n`);

// 獲取數據庫大小
const [dbSize] = await connection.query(`
  SELECT 
    table_schema AS \`Database\`,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS \`Size_MB\`
  FROM information_schema.tables 
  WHERE table_schema = DATABASE()
  GROUP BY table_schema
`);

if (dbSize.length > 0) {
  console.log(`💾 數據庫大小：${dbSize[0].Size_MB} MB\n`);
}

await connection.end();
console.log("✅ 第一階段評估完成！");
