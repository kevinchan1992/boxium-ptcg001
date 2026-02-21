import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs/promises";
import path from "path";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log("=== 開始導出數據到 JSON ===\n");

// 創建導出目錄
const exportDir = "/home/ubuntu/boxium-ptcg/db_export";
await fs.mkdir(exportDir, { recursive: true });

// 獲取所有表名
const [tables] = await connection.query("SHOW TABLES");
console.log(`📊 共有 ${tables.length} 個表需要導出\n`);

let totalExported = 0;
const exportManifest = {
  exportDate: new Date().toISOString(),
  tables: []
};

for (const table of tables) {
  const tableName = Object.values(table)[0];
  
  try {
    // 查詢表數據
    const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
    
    // 保存為 JSON
    const filename = `${tableName}.json`;
    const filepath = path.join(exportDir, filename);
    await fs.writeFile(filepath, JSON.stringify(rows, null, 2));
    
    console.log(`✅ ${tableName.padEnd(40)} ${rows.length.toLocaleString()} 條記錄`);
    
    totalExported += rows.length;
    exportManifest.tables.push({
      name: tableName,
      filename,
      recordCount: rows.length
    });
  } catch (error) {
    console.error(`❌ ${tableName} 導出失敗:`, error.message);
  }
}

// 保存導出清單
await fs.writeFile(
  path.join(exportDir, "manifest.json"),
  JSON.stringify(exportManifest, null, 2)
);

console.log("\n" + "─".repeat(60));
console.log(`✅ 導出完成！共導出 ${totalExported.toLocaleString()} 條記錄`);
console.log(`📁 導出目錄：${exportDir}`);

await connection.end();
