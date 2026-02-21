import pkg from 'pg';
const { Client } = pkg;

const SUPABASE_URL = "postgresql://postgres.sagyfroktrfnnhepmvzu:Aa63020887@@@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";

console.log("=== 測試 Supabase 數據庫連接 ===\n");

try {
  const client = new Client({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log("✅ Supabase 連接成功！\n");
  
  // 測試查詢
  const result = await client.query('SELECT version()');
  console.log("📊 PostgreSQL 版本：", result.rows[0].version);
  
  // 檢查現有表
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  
  console.log(`\n📋 當前表數量：${tables.rows.length}`);
  if (tables.rows.length > 0) {
    console.log("現有表：", tables.rows.map(r => r.table_name).join(', '));
  } else {
    console.log("✨ 數據庫為空，準備創建表結構");
  }
  
  await client.end();
  console.log("\n✅ 第一步完成：Supabase 連接測試成功！");
} catch (error) {
  console.error("❌ 連接失敗：", error.message);
  process.exit(1);
}
