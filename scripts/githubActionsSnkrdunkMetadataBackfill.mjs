import mysql from 'mysql2/promise';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const CONFIG = {
  BATCH_LIMIT: Number.parseInt(process.env.METADATA_BATCH_LIMIT || '1000', 10),
  PARALLEL: Math.min(Number.parseInt(process.env.METADATA_PARALLEL || '8', 10), 12),
  REQUEST_TIMEOUT: Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '7000', 10),
};

let pool;
const execFileAsync = promisify(execFile);

async function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is required');
  pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 12,
    charset: 'utf8mb4',
    connectTimeout: 30_000,
  });
  return pool;
}

function extractCardNumber(name) {
  const bracket = String(name || '').match(/\[([^\]]+)\]/)?.[1]?.trim();
  return bracket || null;
}

async function fetchProduct(apparelId) {
  try {
    const { stdout } = await execFileAsync(
      'timeout',
      [
        '--kill-after=2s',
        `${Math.ceil(CONFIG.REQUEST_TIMEOUT / 1000) + 2}s`,
        'curl',
        '--silent', '--show-error', '--fail', '--location',
        '--connect-timeout', '5',
        '--max-time', String(Math.ceil(CONFIG.REQUEST_TIMEOUT / 1000)),
        '--retry', '0',
        '-A', 'BOXIUM SNKRDUNK Metadata Backfill/1.0 (+https://boxium.asia)',
        '-H', 'Accept: application/json',
        `https://snkrdunk.com/v1/apparels/${apparelId}`,
      ],
      {
        timeout: CONFIG.REQUEST_TIMEOUT + 5_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    return JSON.parse(stdout);
  } catch (error) {
    if (error.killed || error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT' || Number(error.code) === 124 || Number(error.code) === 28) {
      throw new Error(`Metadata request timeout after ${CONFIG.REQUEST_TIMEOUT}ms`);
    }
    throw error;
  }
}

async function getPendingSources() {
  const db = await getPool();
  const limit = Math.max(1, Math.min(CONFIG.BATCH_LIMIT, 20_000));
  const [rows] = await db.execute(
    `SELECT ds.id AS dataSourceId, ds.sourceIdentifier, c.id AS cardId
     FROM dataSources ds
     INNER JOIN cards c ON c.id = ds.cardId
     WHERE ds.source = 'snkrdunk'
       AND ds.productType = 'single_card'
       AND ds.isActive = 1
       AND ds.sourceIdentifier REGEXP '^[0-9]+$'
       AND (c.name IS NULL OR c.name LIKE 'SNKRDUNK Card %' OR c.imageUrl IS NULL OR c.cardNumber IS NULL OR c.cardNumber = '')
       AND NOT (
         ds.lastFetchStatus = 'failed'
         AND ds.fetchErrorMessage = 'SNKRDUNK product response lacks required single-card metadata'
         AND ds.updatedAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       )
     ORDER BY ds.createdAt DESC
     LIMIT ${limit}`,
  );
  return rows;
}

async function markFailed(dataSourceId, message) {
  const db = await getPool();
  await db.execute(
    `UPDATE dataSources
     SET lastFetchStatus = 'failed', fetchErrorMessage = ?, updatedAt = NOW()
     WHERE id = ?`,
    [message.slice(0, 1000), dataSourceId],
  );
}

async function saveMetadata(source, product) {
  const name = product.name?.trim();
  const imageUrl = product.primaryMedia?.imageUrl?.trim();
  const cardNumber = extractCardNumber(name);
  if (!name || name.startsWith('SNKRDUNK Card ') || !imageUrl || !cardNumber) {
    throw new Error('SNKRDUNK product response lacks required single-card metadata');
  }

  const db = await getPool();
  await db.execute(
    `UPDATE cards
     SET name = ?,
         nameJa = COALESCE(?, nameJa),
         imageUrl = ?,
         cardNumber = ?,
         updatedAt = NOW()
     WHERE id = ?`,
    [name, product.localizedName || null, imageUrl, cardNumber, source.cardId],
  );
  await db.execute(
    `UPDATE dataSources
     SET lastFetchStatus = 'metadata_success', fetchErrorMessage = NULL, updatedAt = NOW()
     WHERE id = ?`,
    [source.dataSourceId],
  );
}

async function processSource(source) {
  try {
    console.log(`[MetadataBackfill] product=${source.sourceIdentifier} start`);
    const product = await fetchProduct(source.sourceIdentifier);
    await saveMetadata(source, product);
    console.log(`[MetadataBackfill] product=${source.sourceIdentifier} success`);
    return { ok: true };
  } catch (error) {
    await markFailed(source.dataSourceId, error.name === 'AbortError' ? `Metadata request timeout after ${CONFIG.REQUEST_TIMEOUT}ms` : error.message).catch(() => {});
    console.warn(`[MetadataBackfill] product=${source.sourceIdentifier} failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

async function processSourceWithDeadline(source) {
  const deadlineMs = CONFIG.REQUEST_TIMEOUT + 5_000;
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      const message = `Metadata worker deadline exceeded after ${deadlineMs}ms`;
      console.warn(`[MetadataBackfill] product=${source.sourceIdentifier} deadline exceeded`);
      resolve({ ok: false, error: message });
      void markFailed(source.dataSourceId, message).catch(() => {});
    }, deadlineMs);
  });
  try {
    return await Promise.race([processSource(source), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  try {
    const sources = await getPendingSources();
    console.log(`[MetadataBackfill] selected=${sources.length} parallel=${CONFIG.PARALLEL} limit=${CONFIG.BATCH_LIMIT}`);
    let success = 0;
    let failed = 0;
    for (let index = 0; index < sources.length; index += CONFIG.PARALLEL) {
      const batch = sources.slice(index, index + CONFIG.PARALLEL);
      const results = await Promise.all(batch.map(processSourceWithDeadline));
      for (const result of results) {
        if (result.ok) success += 1;
        else failed += 1;
      }
      console.log(`[MetadataBackfill] ${Math.min(index + batch.length, sources.length)}/${sources.length} success=${success} failed=${failed}`);
    }
    console.log(`[MetadataBackfill] COMPLETED success=${success} failed=${failed} selected=${sources.length}`);
  } finally {
    if (pool) {
      await pool.end().catch((error) => {
        console.warn(`[MetadataBackfill] connection pool closed with ${error.code || error.message}`);
      });
    }
  }
}

main().catch((error) => {
  console.error('[MetadataBackfill] Fatal:', error);
  process.exit(1);
});
