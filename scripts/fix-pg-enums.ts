import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'drizzle/schema.ts');
let content = fs.readFileSync(schemaPath, 'utf-8');

console.log('🔄 Fixing PostgreSQL enum definitions...\n');

// 定義所有 enum 類型
const enumDefs = `
// Enum definitions
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const sourceEnum = pgEnum("source", ["snkrdunk", "ebay", "tcgplayer", "other"]);
export const taskStatusEnum = pgEnum("status", ["pending", "running", "completed", "failed", "paused"]);
export const firecrawlStatusEnum = pgEnum("firecrawl_status", ["success", "failed", "quota_exceeded"]);
export const searchMethodEnum = pgEnum("search_method", ["image", "text"]);
export const postStatusEnum = pgEnum("post_status", ["draft", "published"]);
export const dataSourceEnum = pgEnum("data_source", ["manual", "ai-generated", "mixed"]);

`;

// 在第一行 import 後插入 enum 定義
const lines = content.split('\n');
lines.splice(1, 0, enumDefs);
content = lines.join('\n');

// 替換 inline enum 為引用
content = content.replace(/pgEnum\("role", \["user", "admin"\]\)/g, 'roleEnum("role")');
content = content.replace(/pgEnum\("source", \["snkrdunk", "ebay", "tcgplayer", "other"\]\)/g, 'sourceEnum("source")');
content = content.replace(/pgEnum\("status", \["pending", "running", "completed", "failed", "paused"\]\)/g, 'taskStatusEnum("status")');
content = content.replace(/pgEnum\("status", \["success", "failed", "quota_exceeded"\]\)/g, 'firecrawlStatusEnum("status")');
content = content.replace(/pgEnum\("searchMethod", \["image", "text"\]\)/g, 'searchMethodEnum("searchMethod")');
content = content.replace(/pgEnum\("status", \["draft", "published"\]\)/g, 'postStatusEnum("status")');
content = content.replace(/pgEnum\("dataSource", \["manual", "ai-generated", "mixed"\]\)/g, 'dataSourceEnum("dataSource")');

console.log('✅ Enum definitions fixed!\n');
console.log('Writing to file...');

fs.writeFileSync(schemaPath, content, 'utf-8');

console.log('✅ Schema file updated successfully!');
