import 'dotenv/config';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection({ uri: dbUrl, ssl: { rejectUnauthorized: false } });
const [rows] = await conn.query(`
  SELECT i.id, i.tierId, i.feeHkd, t.name as tierName, s.totalFeeHkd, s.upgradeNewTierId 
  FROM gradingSubmissionItems i 
  JOIN gradingSubmissions s ON s.id = i.submissionId 
  LEFT JOIN gradingServiceTiers t ON t.id = i.tierId 
  WHERE s.orderNo = 'BOXIUM-GRD-20260414-1190' LIMIT 5
`);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
