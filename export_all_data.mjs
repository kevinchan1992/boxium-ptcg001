import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs/promises";

console.log("=== 第二步：導出所有數據 ===\n");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// 創建導出目錄
const exportDir = "/home/ubuntu/db_migration";
await fs.mkdir(exportDir, { recursive: true });

// 獲取所有表名
const [tables] = await connection.query("SHOW TABLES");
console.log(`📊 開始導出 ${tables.length} 個表...\n`);

let totalRecords = 0;
const manifest = { exportDate: new Date().toISOString(), tables: [] };

for (const table of tables) {
  const tableName = Object.values(table)[0];
  
  try {
    const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
    const filename = `${tableName}.json`;
    await fs.writeFile(
      `${exportDir}/${filename}`,
      JSON.stringify(rows, null, 2)
    );
    
    console.log(`✅ ${tableName.padEnd(35)} ${rows.length.toLocaleString().padStart(8)} 條`);
    totalRecords += rows.length;
    manifest.tables.push({ name: tableName, filename, count: rows.length });
  } catch (err) {
    console.error(`❌ ${tableName} 失敗:`, err.message);
  }
}

await fs.writeFile(`${exportDir}/manifest.json`, JSON.stringify(manifest, null, 2));
await connection.end();

console.log("\n" + "─".repeat(50));
console.log(`✅ 導出完成！共 ${totalRecords.toLocaleString()} 條記錄`);
console.log(`📁 目錄：${exportDir}\n`);
