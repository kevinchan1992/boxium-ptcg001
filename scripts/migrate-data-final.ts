import mysql from "mysql2/promise";
import pg from "pg";

const { Client } = pg;

// MySQL (Manus TiDB) connection
const mysqlConnection = await mysql.createConnection(process.env.DATABASE_URL!);

// PostgreSQL (Supabase) connection - 使用 Client 而不是 Pool
const pgClient = new Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.sagyfroktrfnnhepmvzu",
  password: "Aa63020887@@",
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

await pgClient.connect();
console.log("✅ PostgreSQL 連接成功\n");

const tables = [
  "users",
  "cards",
  "dataSources",
  "priceHistory",
  "scheduledTasks",
  "snkrdunkListingsCache",
  "ebayListingsCache",
  "firecrawlUsage",
  "searchStats",
  "categories",
  "tags",
  "posts",
  "priceUpdateSchedule",
  "scheduleConfig",
  "trendingCardsCache"
];

async function migrateData() {
  console.log("🚀 開始數據遷移...\n");

  for (const tableName of tables) {
    try {
      console.log(`\n📦 處理表: ${tableName}`);
      
      // 從 MySQL 導出數據
      const [rows] = await mysqlConnection.query(`SELECT * FROM ${tableName}`);
      const data = rows as any[];
      
      console.log(`   ✓ 從 MySQL 導出 ${data.length} 條記錄`);
      
      if (data.length === 0) {
        console.log(`   ⊘ 表 ${tableName} 為空，跳過`);
        continue;
      }

      // 獲取列名
      const columns = Object.keys(data[0]);
      
      // 批量插入到 PostgreSQL（小批次，避免超時）
      const batchSize = 50;
      let imported = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        // 構建 INSERT 語句
        const placeholders = batch.map((_, idx) => {
          const rowPlaceholders = columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`);
          return `(${rowPlaceholders.join(", ")})`;
        }).join(", ");
        
        const values = batch.flatMap(row => columns.map(col => {
          const value = row[col];
          
          // 處理 null 值
          if (value === null || value === undefined) {
            return null;
          }
          
          // 處理日期轉換
          if (value instanceof Date) {
            return value.toISOString();
          }
          
          // 處理 boolean 轉換 (MySQL 使用 0/1)
          // 注意：isActive 在 dataSources 表中是 integer，不要轉換
          if (typeof value === 'number' && (
            col === 'success' || 
            col === 'enabled' || 
            col.includes('Enabled')
          )) {
            return value === 1;
          }
          
          return value;
        }));
        
        const quotedColumns = columns.map(col => `"${col}"`).join(", ");
        const sql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES ${placeholders}`;
        
        try {
          await pgClient.query(sql, values);
          imported += batch.length;
          
          if (imported % 500 === 0 || imported === data.length) {
            console.log(`   ⟳ 已導入 ${imported}/${data.length} 條記錄`);
          }
        } catch (err: any) {
          console.error(`   ⚠️ 批次導入失敗 (${i}-${i + batch.length}):`, err.message);
          // 嘗試逐條插入這個批次
          console.log(`   🔄 嘗試逐條插入...`);
          for (let j = 0; j < batch.length; j++) {
            const row = batch[j];
            const singlePlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
            const singleValues = columns.map(col => {
              const value = row[col];
              if (value === null || value === undefined) return null;
              if (value instanceof Date) return value.toISOString();
              // 處理 boolean 轉換 (MySQL 使用 0/1)
              // 注意：isActive 在 dataSources 表中是 integer，不要轉換
              if (typeof value === 'number' && (col === 'success' || col === 'enabled' || col.includes('Enabled'))) {
                return value === 1;
              }
              return value;
            });
            const singleSql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${singlePlaceholders})`;
            
            try {
              await pgClient.query(singleSql, singleValues);
              imported++;
            } catch (singleErr: any) {
              console.error(`   ❌ 記錄導入失敗 (row ${i + j}):`, singleErr.message);
            }
          }
        }
      }
      
      console.log(`   ✅ 表 ${tableName} 導入完成！共 ${imported} 條記錄`);
      
    } catch (error: any) {
      console.error(`   ❌ 表 ${tableName} 處理失敗:`, error.message);
      // 繼續處理下一個表
    }
  }

  console.log("\n\n🎉 數據遷移完成！");
  
  // 關閉連接
  await mysqlConnection.end();
  await pgClient.end();
}

migrateData().catch(console.error);
