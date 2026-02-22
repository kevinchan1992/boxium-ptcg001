import { getDb } from "./server/db.ts";

const db = await getDb();
if (!db) {
  console.error("Database connection failed");
  process.exit(1);
}

const result = await db.execute("SHOW COLUMNS FROM users");
console.log("Users table columns:");
console.log(JSON.stringify(result[0], null, 2));
process.exit(0);
