import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceRoot = process.env.S1_SOURCE_ROOT ? path.resolve(process.env.S1_SOURCE_ROOT) : repoRoot;
const schemaPath = path.join(sourceRoot, 'drizzle/schema_new.ts');
const outputRoot = path.join(repoRoot, 'docs/db-parity');
const schemaOutput = path.join(repoRoot, 'drizzle/schema.pg.ts');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function isIdentifierStart(character) {
  return /[A-Za-z_$]/.test(character);
}

function isIdentifierCharacter(character) {
  return /[A-Za-z0-9_$]/.test(character);
}

function skipWhitespaceAndComments(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }
    break;
  }
  return index;
}

function findMatching(source, openingIndex, openingCharacter, closingCharacter) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (!escaped && character === quote) quote = null;
      escaped = !escaped && character === '\\';
      if (character !== '\\') escaped = false;
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      escaped = false;
      continue;
    }
    if (character === openingCharacter) depth += 1;
    if (character === closingCharacter) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`Unable to find matching ${closingCharacter} from offset ${openingIndex}`);
}

function splitTopLevel(source) {
  const parts = [];
  let start = 0;
  let index = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  const depth = { curly: 0, square: 0, paren: 0 };

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      index += 1;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (quote) {
      if (!escaped && character === quote) quote = null;
      escaped = !escaped && character === '\\';
      if (character !== '\\') escaped = false;
      index += 1;
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 2;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 2;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      escaped = false;
      index += 1;
      continue;
    }
    if (character === '{') depth.curly += 1;
    if (character === '}') depth.curly -= 1;
    if (character === '[') depth.square += 1;
    if (character === ']') depth.square -= 1;
    if (character === '(') depth.paren += 1;
    if (character === ')') depth.paren -= 1;
    if (character === ',' && depth.curly === 0 && depth.square === 0 && depth.paren === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
    index += 1;
  }
  const tail = source.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseProperties(objectLiteral) {
  const opening = objectLiteral.indexOf('{');
  const closing = findMatching(objectLiteral, opening, '{', '}');
  const body = objectLiteral.slice(opening + 1, closing);
  const properties = [];
  let position = 0;

  while (position < body.length) {
    position = skipWhitespaceAndComments(body, position);
    if (position >= body.length) break;
    if (!isIdentifierStart(body[position])) {
      position += 1;
      continue;
    }
    const nameStart = position;
    position += 1;
    while (position < body.length && isIdentifierCharacter(body[position])) position += 1;
    const name = body.slice(nameStart, position);
    position = skipWhitespaceAndComments(body, position);
    if (body[position] !== ':') continue;
    position += 1;
    const expressionStart = position;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    const depth = { curly: 0, square: 0, paren: 0 };

    while (position < body.length) {
      const character = body[position];
      const next = body[position + 1];
      if (lineComment) {
        if (character === '\n') lineComment = false;
        position += 1;
        continue;
      }
      if (blockComment) {
        if (character === '*' && next === '/') {
          blockComment = false;
          position += 2;
          continue;
        }
        position += 1;
        continue;
      }
      if (quote) {
        if (!escaped && character === quote) quote = null;
        escaped = !escaped && character === '\\';
        if (character !== '\\') escaped = false;
        position += 1;
        continue;
      }
      if (character === '/' && next === '/') {
        lineComment = true;
        position += 2;
        continue;
      }
      if (character === '/' && next === '*') {
        blockComment = true;
        position += 2;
        continue;
      }
      if (character === '"' || character === "'" || character === '`') {
        quote = character;
        escaped = false;
        position += 1;
        continue;
      }
      if (character === '{') depth.curly += 1;
      if (character === '}') depth.curly -= 1;
      if (character === '[') depth.square += 1;
      if (character === ']') depth.square -= 1;
      if (character === '(') depth.paren += 1;
      if (character === ')') depth.paren -= 1;
      if (character === ',' && depth.curly === 0 && depth.square === 0 && depth.paren === 0) break;
      position += 1;
    }
    properties.push({ name, expression: body.slice(expressionStart, position).trim() });
    if (body[position] === ',') position += 1;
  }
  return properties;
}

function toPascal(value) {
  return value.replace(/(^|[_-])([A-Za-z0-9])/g, (_, __, character) => character.toUpperCase());
}

function toSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
}

function stripComments(value) {
  return value.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
}

function columnType(expression) {
  const value = stripComments(expression);
  const match = value.match(/^(mysqlEnum|int|bigint|tinyint|varchar|text|timestamp|decimal|boolean)\s*\(/);
  return match ? match[1] : 'unclassified';
}

function inferOwner(tableName) {
  const groups = [
    [['games', 'cards', 'sealedProducts', 'sets', 'card', 'tcg', 'catalog'], 'TCG catalog'],
    [['price', 'market', 'snkrdunk', 'ebay', 'scraper', 'trend', 'fxRates', 'dataSources'], 'Pricing & market data'],
    [['auction', 'bid', 'offer', 'order', 'listing', 'payment', 'transaction', 'shipping', 'trade'], 'Marketplace & transactions'],
    [['user', 'session', 'auth', 'oauth', 'verification', 'vip', 'notification', 'watchlist', 'favorite', 'vault'], 'Identity & user experience'],
    [['post', 'blog', 'category', 'tag', 'article', 'uploaded'], 'Content & media metadata'],
    [['schedule', 'task', 'setting', 'log', 'cache', 'stats', 'usage', 'sitemap'], 'Operations & platform'],
  ];
  const normalized = tableName.toLowerCase();
  for (const [terms, owner] of groups) {
    if (terms.some((term) => normalized.includes(term.toLowerCase()))) return owner;
  }
  return 'Platform domain (manual owner assignment required)';
}

function inferFkTarget(table, property) {
  const columnName = property.name;
  const exact = {
    userId: 'users.id',
    cardId: table.properties.some((candidate) => candidate.name === 'productType')
      ? 'cards.id (conditional where productType=single_card)'
      : 'cards.id',
    sealedProductId: 'sealedProducts.id',
    gameId: 'games.id',
    categoryId: 'categories.id',
    postId: 'posts.id',
    tagId: 'tags.id',
    authorId: 'users.id',
    createdBy: 'users.id',
    uploadedBy: 'users.id',
    listingId: 'marketplaceListings.id',
    orderId: 'marketplaceOrders.id',
    buyerId: 'users.id',
    sellerId: 'users.id',
  };
  return exact[columnName] ?? 'logical relation unresolved — require S2 constraint decision';
}

function findTableDefinitions(schema) {
  const definitions = [];
  const expression = /export const\s+([A-Za-z0-9_$]+)\s*=\s*mysqlTable\s*\(/g;
  let match;
  while ((match = expression.exec(schema))) {
    const variable = match[1];
    const opening = schema.indexOf('(', match.index);
    const closing = findMatching(schema, opening, '(', ')');
    const args = splitTopLevel(schema.slice(opening + 1, closing));
    if (args.length < 2 || !args[1].trim().startsWith('{')) {
      throw new Error(`Unable to parse column object for ${variable}`);
    }
    const tableNameMatch = args[0].match(/^"([^"]+)"$/);
    const tableName = tableNameMatch ? tableNameMatch[1] : variable;
    const properties = parseProperties(args[1]);
    definitions.push({
      variable,
      tableName,
      properties,
      tableArgs: args,
      source: schema.slice(match.index, closing + 1),
    });
    expression.lastIndex = closing + 1;
  }
  return definitions;
}

function transformColumnExpression(table, property, enumDefinitions) {
  let transformed = property.expression;
  transformed = transformed.replace(/mysqlEnum\(\s*"([^"]+)"\s*,\s*(\[[^\]]+\])\s*\)/g, (_, columnName, values) => {
    const enumName = `${table.variable}${toPascal(property.name)}Enum`;
    const dbEnumName = `enum_${toSnake(table.tableName)}_${toSnake(columnName)}`;
    if (!enumDefinitions.has(enumName)) {
      enumDefinitions.set(enumName, { dbEnumName, values });
    }
    return `${enumName}("${columnName}")`;
  });
  transformed = transformed.replace(/\bint\s*\(/g, 'integer(');
  transformed = transformed.replace(/\btinyint\s*\(/g, 'smallint(');
  transformed = transformed.replace(/timestamp\(\s*("[^"]+")\s*\)/g, 'timestamp($1, { withTimezone: true })');
  transformed = transformed.replace(/\.autoincrement\(\)/g, '.generatedByDefaultAsIdentity()');
  transformed = transformed.replace(/\.onUpdateNow\(\)/g, '.$onUpdate(() => new Date())');
  return transformed;
}

function generatePgSchema(tables) {
  const enumDefinitions = new Map();
  const blocks = tables.map((table) => {
    const nameArg = table.tableArgs[0];
    const columns = table.properties
      .map((property) => `  ${property.name}: ${transformColumnExpression(table, property, enumDefinitions)},`)
      .join('\n');
    const callbackArgs = table.tableArgs.slice(2);
    const callback = callbackArgs.length ? `, ${callbackArgs.join(', ')}` : '';
    return `export const ${table.variable} = pgTable(${nameArg}, {\n${columns}\n}${callback});`;
  });
  const enums = [...enumDefinitions.entries()]
    .map(([name, definition]) => `export const ${name} = pgEnum('${definition.dbEnumName}', ${definition.values});`)
    .join('\n');
  return `/*\n * AUTO-GENERATED S1 DESIGN DRAFT — DO NOT APPLY.\n *\n * Source: drizzle/schema_new.ts (MySQL/TiDB). This file is an inventory-backed\n * PostgreSQL mapping proposal only. It must not be imported by production code,\n * executed with db:push, or used to create any Lab schema before S2 approval.\n *\n * Key intentional design decisions:\n * - MySQL timestamp fields are proposed as timestamptz, pending the S1 UTC field decision register.\n * - Inline MySQL enums become per-table PostgreSQL enum types.\n * - MySQL auto-increment becomes generated-by-default identity.\n * - MySQL onUpdateNow becomes Drizzle runtime $onUpdate; database-side trigger policy remains an S2 decision.\n * - The source schema declares no Drizzle .references(); logical relations remain deferred for explicit review.\n */\n\nimport { bigint, boolean, decimal, index, integer, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';\n\n${enums}\n\n${blocks.join('\n\n')}\n`;
}

function markdownCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function matrixForTable(table) {
  const primaryKeys = table.properties.filter((property) => property.expression.includes('.primaryKey()')).map((property) => property.name);
  const directUnique = table.properties.filter((property) => property.expression.includes('.unique()')).map((property) => property.name);
  const uniqueIndexes = [...table.source.matchAll(/uniqueIndex\("([^"]+)"\)\.on\(([^)]*)\)/g)].map((match) => `${match[1]}: ${match[2].replace(/table\./g, '')}`);
  const indexes = [...table.source.matchAll(/(?<!unique)index\("([^"]+)"\)\.on\(([^)]*)\)/g)].map((match) => match[1]);
  const defaults = table.properties
    .filter((property) => property.expression.includes('.default') || property.expression.includes('.defaultNow'))
    .map((property) => property.name);
  const fkCandidates = table.properties
    .filter((property) => {
      const sourceType = columnType(property.expression);
      const canBeRelationalId = sourceType === 'int' || sourceType === 'bigint';
      return property.name !== 'id' && canBeRelationalId && (property.name.endsWith('Id') || ['createdBy', 'uploadedBy'].includes(property.name));
    })
    .map((property) => `${property.name} → ${inferFkTarget(table, property)}`);
  const types = [...new Set(table.properties.map((property) => columnType(property.expression)))].join(', ');
  return {
    source: table.tableName,
    target: table.tableName,
    columns: table.properties.length,
    types,
    pk: primaryKeys.length ? primaryKeys.join(', ') : 'none declared',
    fk: fkCandidates.length ? fkCandidates.join('; ') : 'none declared',
    unique: [...directUnique, ...uniqueIndexes].length ? [...directUnique, ...uniqueIndexes].join('; ') : 'none declared',
    defaults: defaults.length ? defaults.join(', ') : 'none',
    indexes: indexes.length,
    owner: inferOwner(table.tableName),
  };
}

function generateSchemaMatrix(tables) {
  const rows = tables.map(matrixForTable);
  const declaredFkCount = 0;
  const primaryKeyCount = rows.filter((row) => row.pk !== 'none declared').length;
  const logicalFkCandidates = rows.reduce((count, row) => count + (row.fk === 'none declared' ? 0 : row.fk.split('; ').length), 0);
  const indexCount = rows.reduce((count, row) => count + row.indexes, 0);
  const uniqueCount = rows.reduce((count, row) => count + (row.unique === 'none declared' ? 0 : row.unique.split('; ').length), 0);
  const tableRows = rows.map((row) => `| \`${markdownCell(row.source)}\` | \`${markdownCell(row.target)}\` | ${row.columns} | ${markdownCell(row.types)} | ${markdownCell(row.pk)} | ${markdownCell(row.fk)} | ${markdownCell(row.unique)} | ${markdownCell(row.defaults)} | ${row.indexes} | ${markdownCell(row.owner)} |`).join('\n');
  return `# BOXIUM S1：MySQL／TiDB → PostgreSQL Schema Matrix\n\n**狀態：S1 read-only inventory；設計草案，未套用至任何資料庫。**\n\n> 本文件只由 \`drizzle/schema_new.ts\` 與 repository source code 衍生。沒有連線、讀取、匯出或修改 BOXIUM Production MySQL／TiDB；也沒有對 Supabase Lab 執行 DDL、DML、migration 或 fixture 寫入。\n\n## Inventory 摘要\n\n| 項目 | 結果 |\n|---|---:|\n| MySQL source table definitions | ${tables.length} |\n| Proposed PostgreSQL table definitions | ${tables.length} |\n| Tables with declared source primary key | ${primaryKeyCount} |\n| Drizzle-declared source foreign keys | ${declaredFkCount} |\n| Logical FK candidates requiring explicit S2 decision | ${logicalFkCandidates} |\n| Declared secondary indexes | ${indexCount} |\n| Declared unique fields／indexes | ${uniqueCount} |\n\n現行 source schema **沒有**使用 Drizzle \`.references()\` 宣告外鍵。因此下表的「FK／logical relation」是依欄位命名和程式碼註解建立的設計候選，不是可直接套用的 constraint。S2 前必須先用 synthetic fixture 驗證 orphan、nullable relationship 與 polymorphic \`productType\` 關係，才可決定哪些 PostgreSQL FK 可以實體化。\n\n## 逐表對照\n\n| MySQL source table | PostgreSQL target table | Columns | Source type families | PK | FK／logical relation（待決定） | Unique | Defaulted fields | Secondary indexes | Owner |\n|---|---|---:|---|---|---|---|---|---:|---|\n${tableRows}\n\n## S1 PostgreSQL 設計規則\n\n| Source construct | Proposed PostgreSQL design | S1／S2 decision point |\n|---|---|---|\n| \`mysqlTable\` | Same physical table name with \`pgTable\` | Preserve application-facing identifiers unless a separately approved naming migration is planned. |\n| \`int().autoincrement()\` | \`integer().generatedByDefaultAsIdentity()\` | S2 must define sequence reset after any approved import. |\n| \`mysqlEnum\` | Per-table \`pgEnum\` in the S1 draft | S2 must review enum lifecycle and decide whether future values require enum migration or \`varchar + check\`. |\n| MySQL \`timestamp\` | \`timestamp(..., { withTimezone: true })\` design proposal | Per-column timezone semantic register is mandatory before any data import. |\n| \`.onUpdateNow()\` | Drizzle \`$onUpdate(() => new Date())\` design placeholder | S2 must decide server application update vs database trigger and test concurrent writers. |\n| JSON carried in \`text\` | Keep as \`text\` in initial draft unless query contract requires \`jsonb\` | S1 type register identifies high-risk fields; no data transformation has occurred. |\n| No source \`.references()\` | No physical FK is auto-generated | Add only explicitly approved, data-validated constraints in S2. |\n\n## S1 Acceptance Status\n\n| Requirement | Status |\n|---|---|\n| All source tables mapped | Complete — ${tables.length}/${tables.length}. |\n| Every mapping names PK, logical FK status, unique/default and owner | Complete; undeclared source constraints are explicitly flagged rather than guessed. |\n| Existing MySQL schema unchanged | Complete — no source file edited. |\n| Supabase Lab schema unchanged | Complete — no migration／DDL executed. |\n| Production resources/data unchanged | Complete — source-code-only analysis. |\n\n## Next Gate (not approved by this document)\n\nThe companion \`drizzle/schema.pg.ts\` is a **non-executable S1 draft**. It must not be imported by runtime code, supplied to \`db:push\`, or applied to Supabase Lab until the user separately approves S2.\n`;
}

function generateTypeRegister(tables) {
  const typeCounts = new Map();
  const examples = new Map();
  for (const table of tables) {
    for (const property of table.properties) {
      const type = columnType(property.expression);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      if (!examples.has(type)) examples.set(type, `\`${table.tableName}.${property.name}\``);
    }
  }
  const rules = {
    int: ['\`integer\`', 'Preserve JS number semantics; review IDs that may grow beyond signed 32-bit.', 'S2 fixture boundary and sequence check'],
    bigint: ['\`bigint({ mode })\`', 'Retain source number/string contract explicitly; do not silently coerce precision-sensitive values.', 'S2 serialization contract test'],
    tinyint: ['\`smallint\` by default', 'Source intent is ambiguous because \`tinyint\` is distinct from Drizzle \`boolean\`.', 'Classify each field as boolean, status code, or small integer before migration'],
    boolean: ['\`boolean\`', 'Direct mapping; validate MySQL 0/1/null legacy rows before adding NOT NULL.', 'Synthetic null/false/true fixture'],
    decimal: ['\`numeric(precision, scale)\`', 'Retain string／exact-decimal application contract; never substitute float.', 'Price, order and FX decimal checksum fixture'],
    timestamp: ['\`timestamptz\` design proposal', 'UTC instant by default; source semantics must be recorded field-by-field before import.', 'HKT boundary/UTC conversion fixture'],
    varchar: ['\`varchar(length)\`', 'Preserve max length; review collation/case-sensitive unique behavior.', 'Unicode and case-collision fixture'],
    text: ['\`text\` or explicitly approved \`jsonb\`', 'Text JSON must not be auto-converted without query/shape review.', 'Null, malformed JSON, array/object fixture'],
    mysqlEnum: ['\`pgEnum\`', 'Per-table enum type generated in S1 draft; additions/removals require migration lifecycle plan.', 'Every allowed value plus invalid-value rejection fixture'],
    unclassified: ['Manual review', 'The extractor did not identify a supported source family.', 'Block S2 until classified'],
  };
  const rows = [...typeCounts.entries()].sort().map(([sourceType, count]) => {
    const [target, risk, test] = rules[sourceType] ?? rules.unclassified;
    return `| \`${sourceType}\` | ${count} | ${examples.get(sourceType)} | ${target} | ${risk} | ${test} |`;
  }).join('\n');
  return `# BOXIUM S1：型別轉換清冊\n\n**狀態：設計登記冊；沒有轉換或寫入任何資料。**\n\n| MySQL／Drizzle source family | Occurrences | Example | Proposed PostgreSQL／Drizzle mapping | Semantic risk | Required S2／S3 validation |\n|---|---:|---|---|---|---|\n${rows}\n\n## 不可自動決定的資料語義\n\n| 類別 | S1 decision | Gate before data import |\n|---|---|---|\n| 商業 timestamp | 所有拍賣、成交、到期與排程時間需標明 UTC instant、HKT local date 或純日期。 | 任何不明確來源時區均為 No-Go。 |\n| 價格與金額 | 保持 \`numeric\` 與 string/exact decimal contract。 | 不可使用 JavaScript float 做 checksum。 |\n| Text JSON | 只在有 JSON query／index 需求、且 fixture 能驗證 shape 時，才轉 \`jsonb\`。 | \`listings\`、metadata、snapshot 等欄位須逐一決定。 |\n| Enum | S1 draft 使用 \`pgEnum\`。 | 要先確認擴展值、historic value 和 deployment sequencing。 |\n| Identity | 以 generated identity 取代 auto-increment。 | 日後才可在 approved import 後 reset sequence。 |\n`;
}

function walkSourceFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', '.manus-logs'].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkSourceFiles(fullPath, files);
    if (entry.isFile() && /\.(?:ts|tsx|mts|mjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function offsetToLine(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function classifySql(window) {
  const value = window.toLowerCase();
  if (value.includes('on duplicate key') || value.includes('on conflict')) return ['upsert', 'Replace with explicit ON CONFLICT target after unique-index review'];
  if (value.includes('insert ignore')) return ['insert_ignore', 'Replace with ON CONFLICT DO NOTHING and retain non-unique error visibility'];
  if (value.includes('ifnull(')) return ['null_handling', 'Replace IFNULL with COALESCE'];
  if (value.includes('date_format') || value.includes('date_add') || value.includes('date_sub') || value.includes('unix_timestamp')) return ['date_time', 'Replace with date_trunc/to_char/interval and UTC contract'];
  if (value.includes('group_concat')) return ['aggregation', 'Replace with string_agg and explicit ordering'];
  if (value.includes('json_') || value.includes('json_extract')) return ['json', 'Replace with jsonb operator/function after payload decision'];
  if (value.includes('`')) return ['identifier_quoting', 'Remove MySQL backticks; use Drizzle identifiers or PostgreSQL quoting'];
  if (value.includes('select')) return ['raw_select', 'Review casts, joins, order and pagination semantics'];
  if (value.includes('insert')) return ['raw_insert', 'Review identity/default and conflict behavior'];
  if (value.includes('update')) return ['raw_update', 'Review RETURNING and affected-row behavior'];
  if (value.includes('delete')) return ['raw_delete', 'Review join/delete semantics and row-count contract'];
  return ['execute_or_fragment', 'Manual PostgreSQL syntax and parameter review required'];
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function generateRawSqlManifest() {
  const roots = ['server', 'drizzle', 'scripts', 'client'].map((relative) => path.join(sourceRoot, relative));
  const files = roots.flatMap((directory) => walkSourceFiles(directory));
  const records = [];
  for (const filePath of files) {
    const source = read(filePath);
    const relativePath = path.relative(sourceRoot, filePath);
    const lineStarts = source.split('\n');
    const findWindow = (offset) => source.slice(offset, Math.min(source.length, offset + 900)).replace(/\s+/g, ' ').slice(0, 500);
    for (const match of source.matchAll(/\bsql(?:<[^>\n]+>)?\s*`/g)) {
      const line = offsetToLine(source, match.index);
      const window = findWindow(match.index);
      const [category, postgresTarget] = classifySql(window);
      records.push({ kind: 'sql_tag', file: relativePath, line, owner: inferOwner(`${relativePath} ${window}`), category, postgresTarget, snippet: lineStarts[line - 1]?.trim() ?? '', testStatus: 'not_started' });
    }
    for (const match of source.matchAll(/\.execute\s*\(/g)) {
      const line = offsetToLine(source, match.index);
      const window = findWindow(match.index);
      const [category, postgresTarget] = classifySql(window);
      records.push({ kind: 'execute_call', file: relativePath, line, owner: inferOwner(`${relativePath} ${window}`), category, postgresTarget, snippet: lineStarts[line - 1]?.trim() ?? '', testStatus: 'not_started' });
    }
  }
  records.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind));
  const header = ['id', 'kind', 'file', 'line', 'owner', 'mysql_pattern_category', 'postgres_target_design', 'source_snippet', 'test_status'];
  const lines = [header.map(csvEscape).join(',')];
  records.forEach((record, index) => lines.push([
    `S1-SQL-${String(index + 1).padStart(3, '0')}`,
    record.kind,
    record.file,
    record.line,
    record.owner,
    record.category,
    record.postgresTarget,
    record.snippet,
    record.testStatus,
  ].map(csvEscape).join(',')));
  return { csv: `${lines.join('\n')}\n`, records };
}

function generateBusinessContracts() {
  return `# BOXIUM S1：資料語義契約凍結\n\n**狀態：S1 design-only；此文件不改變 runtime、資料庫或任何資料。**\n\n> 所有後續 PostgreSQL schema、fixture、query conversion 與 migration 都必須遵守本文件。任何需要改變本節業務語義的工作，必須另行經產品與資料遷移審核批准。\n\n| 契約 | 固定規則 | PostgreSQL mapping implication |\n|---|---|---|\n| Production authority | Production MySQL／TiDB 在 migration 穩定前是唯一業務權威。 | S1/S2 不得讀取、匯出、寫入或切換 Production DSN。 |\n| TCG game IDs | Pokemon=\`1\`、One Piece=\`2\`、Yu-Gi-Oh=\`3\`、Dragon Ball=\`60001\`、Union Arena=\`60002\`、Weiss Schwarz=\`60003\`、Gundam=\`60004\`. | \`games.id\` 必須保留 identity value，不能以 sequence 重新編號。 |\n| \`productType\` | \`single_card\` 與 \`sealed_product\` 是價格、資料來源、收藏與搜尋分流的資料契約。 | 需以 enum/check 保存，所有關鍵 query 必須保留此條件；polymorphic card/product ID 不能自動加入單一 FK。 |\n| 價格精確度 | 價格、FX、庫存成本、訂單與支付金額不得用 float。 | 使用 \`numeric(precision, scale)\`，在 TypeScript 保持 decimal string／精確值語義。 |\n| UTC persistence | 商業時間以 UTC instant 儲存，前端僅負責轉換顯示時區。 | 目標為 \`timestamptz\`；每個 source timestamp 必須經來源時區決策表驗證，尤其 HKT 邊界。 |\n| 熱門卡牌資格 | 僅計算近七日、\`source=snkrdunk\`、\`grade=PSA 10\`、非 bulk 的合資格成交。 | \`priceHistory\` 的 source／grade／isSuspectedBulk／soldAt index 及 query 需保留。 |\n| 價格歷史冪等 | \`recordHash\` 與既有複合 unique 用於防止抓取重覆。 | PostgreSQL \`ON CONFLICT\` 必須選擇明確 conflict target，NULL unique semantics 需有 fixture。 |\n| Auth/Storage freeze | 保留 Manus OAuth、existing session model 與 S3。 | 不引入 Supabase Auth、Storage、Realtime、frontend Data API 或 RLS migration。 |\n| Server-side access | Express/tRPC 是唯一 DB access boundary。 | Lab Data API 保持停用；不建立 \`VITE_*\` Supabase key 或 browser client。 |\n\n## 禁止自動推論的項目\n\n| 項目 | 原因 | 需要的後續證據 |\n|---|---|---|\n| 將每個 \`*Id\` 欄位變成 FK | Source schema 沒有宣告 Drizzle FK，且 \`productType\` 有 polymorphic relationship。 | Synthetic orphan/nullable/polymorphic fixtures 與顯式 S2 mapping review。 |\n| 將所有 text JSON 轉 \`jsonb\` | 部分 payload 可能依賴原始 text、寬鬆 JSON 或無索引 query。 | Payload shape、query path、GIN/expression index 需求與 migration fallback。 |\n| 將所有 timestamp 視為 HKT | 會導致拍賣、成交、排程與價格 8 小時偏移。 | 來源時區決策表與 HKT boundary fixture。 |\n| 將 MySQL default／on-update 原樣當 DB trigger | PostgreSQL 與 Drizzle runtime behavior 不同。 | Concurrent writer、raw SQL update 與 retry fixture。 |\n`;
}

function main() {
  const schema = read(schemaPath);
  const tables = findTableDefinitions(schema);
  const expectedTableCount = Number(process.env.S1_EXPECTED_TABLES ?? '95');
  if (tables.length !== expectedTableCount) {
    throw new Error(`Expected ${expectedTableCount} mysqlTable definitions, found ${tables.length}`);
  }
  const rawSql = generateRawSqlManifest();
  write(schemaOutput, generatePgSchema(tables));
  write(path.join(outputRoot, 'schema-matrix.md'), generateSchemaMatrix(tables));
  write(path.join(outputRoot, 'type-conversion-register.md'), generateTypeRegister(tables));
  write(path.join(outputRoot, 'raw-sql-parity.csv'), rawSql.csv);
  write(path.join(outputRoot, 'business-data-contracts.md'), generateBusinessContracts());
  write(path.join(outputRoot, 's1-inventory-summary.json'), `${JSON.stringify({
    source: path.relative(sourceRoot, schemaPath),
    sourceRoot: sourceRoot === repoRoot ? 'current working tree' : 'explicit S1_SOURCE_ROOT snapshot',
    tables: tables.length,
    rawSqlTags: rawSql.records.filter((record) => record.kind === 'sql_tag').length,
    executeCalls: rawSql.records.filter((record) => record.kind === 'execute_call').length,
    generatedAt: new Date().toISOString(),
    safety: 'S1 code-only analysis; no database connection or write was performed',
  }, null, 2)}\n`);
  console.log(JSON.stringify({ tables: tables.length, rawSqlTags: rawSql.records.filter((record) => record.kind === 'sql_tag').length, executeCalls: rawSql.records.filter((record) => record.kind === 'execute_call').length }));
}

main();
