import { createConnection } from 'mysql2/promise';
const url = process.env.DATABASE_URL || '';
const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!m) { console.log('Cannot parse DATABASE_URL'); process.exit(1); }
const [,user,pass,host,port,db] = m;
const conn = await createConnection({host, port: parseInt(port), user, password: pass, database: db.split('?')[0]});
const [rows] = await conn.execute('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME LIKE ?', ['gradingSubmissions', 'alipayProofAi%']);
console.log('AI columns:', rows);
await conn.end();
