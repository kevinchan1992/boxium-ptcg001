/**
 * Seed default values for new platform settings keys.
 * Run: node scripts/seed-platform-settings.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const settings = [
  { key: 'min_listing_price_hkd',    value: '4',  description: '最低出售金額 HKD (default: 4.00)' },
  { key: 'auto_complete_days',        value: '14', description: '出貨後自動完成訂單天數 (default: 14)' },
  { key: 'cart_retention_days',       value: '14', description: '購物車商品保留天數 (default: 14)' },
  { key: 'cart_expiry_reminder_days', value: '3',  description: '購物車到期提醒提前天數 (default: 3)' },
  { key: 'max_offers_per_day',        value: '3',  description: '每個商品每買家每24小時最多出價次數 (default: 3)' },
  { key: 'alipay_review_sla_hours',   value: '24', description: 'Alipay 審核 SLA 時限小時 (default: 24)' },
  { key: 'dispute_sla_hours',         value: '72', description: '爭議處理 SLA 時限小時 (default: 72)' },
  { key: 'meetup_cancel_days',        value: '7',  description: '面交訂單未確認自動取消天數 (default: 7)' },
];

const conn = await mysql.createConnection(DATABASE_URL);
console.log('Connected to DB');

for (const s of settings) {
  const [rows] = await conn.execute(
    'SELECT settingKey FROM systemSettings WHERE settingKey = ?',
    [s.key]
  );
  if (rows.length === 0) {
    await conn.execute(
      'INSERT INTO systemSettings (settingKey, settingValue, description) VALUES (?, ?, ?)',
      [s.key, s.value, s.description]
    );
    console.log(`✅ Inserted: ${s.key} = ${s.value}`);
  } else {
    console.log(`⏭  Skipped (exists): ${s.key}`);
  }
}

await conn.end();
console.log('Done.');
