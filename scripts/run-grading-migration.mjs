import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL || '';

async function run() {
  const conn = await createConnection(url);
  const sql = readFileSync(join(__dirname, '../drizzle/0060_psa_grading_service.sql'), 'utf8');
  
  // Split by semicolon but handle multi-line statements
  // Remove comment lines first, then split by semicolon
  const cleanSql = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  const stmts = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const stmt of stmts) {
    try {
      await conn.execute(stmt);
      console.log('OK:', stmt.substring(0, 80).replace(/\n/g, ' '));
    } catch(e) {
      console.error('ERR:', e.message, '\nSQL:', stmt.substring(0, 80).replace(/\n/g, ' '));
    }
  }
  await conn.end();
  console.log('Migration complete');
}

run().catch(e => console.error('Fatal:', e.message));
