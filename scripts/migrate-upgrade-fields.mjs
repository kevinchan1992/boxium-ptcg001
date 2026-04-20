import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL || "";
// Parse mysql://user:pass@host:port/db
const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) {
  console.error("Cannot parse DATABASE_URL:", url.slice(0, 30));
  process.exit(1);
}
const [, user, pass, host, port, db] = match;

const conn = await mysql.createConnection({
  host,
  port: parseInt(port),
  user,
  password: pass,
  database: db,
  ssl: { rejectUnauthorized: false },
});

try {
  const sqls = [
    "ALTER TABLE gradingSubmissions ADD COLUMN IF NOT EXISTS upgradeCheckoutSessionId VARCHAR(128) NULL",
    "ALTER TABLE gradingSubmissions ADD COLUMN IF NOT EXISTS upgradeDiffFeeHkd DECIMAL(10,2) NULL",
    "ALTER TABLE gradingSubmissions ADD COLUMN IF NOT EXISTS upgradeNewTierId INT NULL",
    "ALTER TABLE gradingSubmissions ADD COLUMN IF NOT EXISTS upgradePaidAt TIMESTAMP NULL",
  ];
  for (const sql of sqls) {
    await conn.execute(sql);
    console.log("OK:", sql.slice(0, 60));
  }
  console.log("Migration successful!");
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exit(1);
} finally {
  await conn.end();
}
