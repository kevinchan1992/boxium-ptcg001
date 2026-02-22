import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'drizzle/schema_new.ts');
let content = fs.readFileSync(schemaPath, 'utf-8');

console.log('🔄 Converting schema from MySQL to PostgreSQL...\n');

// 1. 更新 imports
content = content.replace(
  /from "drizzle-orm\/mysql-core"/g,
  'from "drizzle-orm/pg-core"'
);

// 2. 更新 table 函數
content = content.replace(/mysqlTable/g, 'pgTable');

// 3. 更新 enum 函數
content = content.replace(/mysqlEnum/g, 'pgEnum');

// 4. 更新數據類型
// int().autoincrement() -> serial()
content = content.replace(/int\(\)\.autoincrement\(\)/g, 'serial()');

// int() -> integer()
content = content.replace(/\bint\(\)/g, 'integer()');

// datetime() -> timestamp()
content = content.replace(/datetime\(\)/g, 'timestamp()');

// varchar(n) 保持不變
// text() 保持不變
// decimal(n,m) 保持不變

// 5. 更新 boolean 類型 (tinyint(1) in MySQL)
// 這個在我們的 schema 中已經使用 integer，所以不需要改

console.log('✅ Schema conversion complete!\n');
console.log('Writing to file...');

fs.writeFileSync(schemaPath, content, 'utf-8');

console.log('✅ Schema file updated successfully!');
