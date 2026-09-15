/**
 * SNKRDUNK high-water card discovery.
 *
 * The old implementation enumerated market-ranked HTML search pages. That is
 * unsuitable for discovery because cards with no listing, sale, or release
 * activity can be far behind unrelated products. This implementation probes a
 * bounded product-ID window around the last observed single-card ID instead.
 * A product is only inserted when the public product API confirms both a
 * configured TCG brand and the trading-card-single category (ID 25).
 */

import mysql from 'mysql2/promise';
import { pathToFileURL } from 'node:url';
import { createHighWaterRange, isTargetTradingCard, readPositiveInt } from './snkrdunkHighWaterCore.mjs';

const CONFIG = {
  LOOKBACK: readPositiveInt(process.env.HIGH_WATER_LOOKBACK, 10_000),
  FORWARD: readPositiveInt(process.env.HIGH_WATER_FORWARD, 2_000),
  CONCURRENCY: Math.min(readPositiveInt(process.env.HIGH_WATER_CONCURRENCY, 8), 12),
  MAX_NEW: readPositiveInt(process.env.MAX_NEW_PER_BRAND, 1_000),
  REQUEST_TIMEOUT: readPositiveInt(process.env.REQUEST_TIMEOUT_MS, 8_000),
  BATCH_SIZE: 500,
  STATE_KEY: 'snkrdunk_high_water_discovery_v1',
  USER_AGENT: 'BOXIUM SNKRDUNK Discovery/3.0 (+https://boxium.asia)',
};

let pool;

async function getPool() {
  if (pool) return pool;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is required');
  const url = dbUrl.includes('timezone=')
    ? dbUrl
    : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}timezone=%2B08:00`;

  pool = mysql.createPool({
    uri: url,
    connectionLimit: 5,
    charset: 'utf8mb4',
    connectTimeout: 30_000,
  });
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('[DB] Connected to MySQL database');
  return pool;
}

async function fetchProduct(apparelId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
  try {
    const response = await fetch(`https://snkrdunk.com/v1/apparels/${apparelId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        Accept: 'application/json',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });
    if (response.status === 404) return { kind: 'not_found' };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Read through the same abort signal so a slow JSON body cannot block the
    // whole batch after headers have arrived.
    const body = await response.text();
    return { kind: 'product', product: JSON.parse(body) };
  } finally {
    clearTimeout(timer);
  }
}

async function getExistingSourceIds() {
  const db = await getPool();
  const [rows] = await db.query(
    `SELECT sourceIdentifier
     FROM dataSources
     WHERE source = 'snkrdunk' AND productType = 'single_card' AND isActive = 1`,
  );
  return new Set(rows.map(({ sourceIdentifier }) => String(sourceIdentifier)));
}

async function getDiscoveryHighWater() {
  const db = await getPool();
  const [[maxRow]] = await db.query(
    `SELECT COALESCE(MAX(CAST(sourceIdentifier AS UNSIGNED)), 0) AS maxId
     FROM dataSources
     WHERE source = 'snkrdunk'
       AND productType = 'single_card'
       AND sourceIdentifier REGEXP '^[0-9]+$'`,
  );
  const [[stateRow]] = await db.query(
    'SELECT settingValue FROM systemSettings WHERE settingKey = ? LIMIT 1',
    [CONFIG.STATE_KEY],
  );

  let savedHighWater = 0;
  if (stateRow?.settingValue) {
    try {
      savedHighWater = Number(JSON.parse(stateRow.settingValue).highWaterId) || 0;
    } catch {
      console.warn('[Discovery] Ignoring malformed persisted high-water state');
    }
  }

  return Math.max(Number(maxRow?.maxId) || 0, savedHighWater);
}

async function saveDiscoveryState(state) {
  const db = await getPool();
  await db.query(
    `INSERT INTO systemSettings (settingKey, settingValue, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       settingValue = VALUES(settingValue),
       description = VALUES(description)`,
    [
      CONFIG.STATE_KEY,
      JSON.stringify(state),
      'SNKRDUNK high-water direct product discovery cursor and latest run summary',
    ],
  );
}

async function mapWithConcurrency(values, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONFIG.CONCURRENCY, values.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function insertCandidates(candidates) {
  const db = await getPool();
  const grouped = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.gameId}:${candidate.brandName}`;
    const group = grouped.get(key) ?? [];
    group.push(candidate.apparelId);
    grouped.set(key, group);
  }

  let inserted = 0;
  let failed = 0;
  for (const ids of grouped.values()) {
    for (let index = 0; index < ids.length; index += CONFIG.BATCH_SIZE) {
      const chunk = ids.slice(index, index + CONFIG.BATCH_SIZE);
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const cardValues = chunk.map((id) => [
          `snkrdunk-${id}`,
          id,
          candidates.find((candidate) => candidate.apparelId === id).gameId,
          `SNKRDUNK Card ${id}`,
          null,
          null,
          null,
          null,
        ]);
        const cardPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        await conn.query(
          `INSERT IGNORE INTO cards (cardId, snkrdunkId, gameId, name, nameJa, imageUrl, cardNumber, setName)
           VALUES ${cardPlaceholders}`,
          cardValues.flat(),
        );

        const cardKeys = chunk.map((id) => `snkrdunk-${id}`);
        const keyPlaceholders = cardKeys.map(() => '?').join(', ');
        const [cardRows] = await conn.query(
          `SELECT id, cardId FROM cards WHERE cardId IN (${keyPlaceholders})`,
          cardKeys,
        );
        const cardIdByKey = new Map(cardRows.map((row) => [row.cardId, row.id]));
        const sourceValues = [];
        for (const id of chunk) {
          const candidate = candidates.find((entry) => entry.apparelId === id);
          const cardId = cardIdByKey.get(`snkrdunk-${id}`);
          if (!cardId) {
            failed += 1;
            continue;
          }
          sourceValues.push([
            cardId,
            candidate.gameId,
            `https://snkrdunk.com/apparels/${id}`,
            String(id),
          ]);
        }
        if (sourceValues.length) {
          const sourcePlaceholders = sourceValues.map(() => '(?, ?, \'single_card\', \'snkrdunk\', ?, ?, 1)').join(', ');
          const [result] = await conn.query(
            `INSERT IGNORE INTO dataSources (cardId, gameId, productType, source, sourceUrl, sourceIdentifier, isActive)
             VALUES ${sourcePlaceholders}`,
            sourceValues.flat(),
          );
          inserted += result.affectedRows;
        }
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        failed += chunk.length;
        console.error(`[Discovery] Insert batch failed: ${error.message}`);
      } finally {
        conn.release();
      }
    }
  }
  return { inserted, failed };
}

async function discoverHighWater() {
  const existingIds = await getExistingSourceIds();
  const highWater = await getDiscoveryHighWater();
  if (!highWater) throw new Error('Unable to establish a SNKRDUNK single-card high-water ID');

  const { start, end, ids } = createHighWaterRange(highWater, CONFIG.LOOKBACK, CONFIG.FORWARD);
  console.log(`[Discovery] mode=high_water range=${start}-${end} highWater=${highWater} concurrency=${CONFIG.CONCURRENCY}`);

  const stats = {
    rangeStart: start,
    rangeEnd: end,
    examined: 0,
    existing: 0,
    notFound: 0,
    nonTarget: 0,
    fetchFailed: 0,
    candidates: 0,
    acceptedByBrand: {},
  };

  const candidates = [];
  const outcomes = await mapWithConcurrency(ids, async (id) => {
    if (existingIds.has(String(id))) return { kind: 'existing', id };
    try {
      return { id, ...(await fetchProduct(id)) };
    } catch (error) {
      return { kind: 'failed', id, reason: error.name === 'AbortError' ? 'timeout' : error.message };
    }
  });

  for (const outcome of outcomes) {
    stats.examined += 1;
    if (outcome.kind === 'existing') {
      stats.existing += 1;
      continue;
    }
    if (outcome.kind === 'not_found') {
      stats.notFound += 1;
      continue;
    }
    if (outcome.kind === 'failed') {
      stats.fetchFailed += 1;
      console.warn(`[Discovery] product=${outcome.id} skipped (${outcome.reason})`);
      continue;
    }
    const brand = isTargetTradingCard(outcome.product);
    if (!brand) {
      stats.nonTarget += 1;
      continue;
    }
    if (candidates.length >= CONFIG.MAX_NEW) continue;
    candidates.push({ apparelId: outcome.id, gameId: brand.gameId, brandName: brand.name });
    stats.candidates += 1;
    stats.acceptedByBrand[brand.name] = (stats.acceptedByBrand[brand.name] ?? 0) + 1;
  }

  const { inserted, failed } = await insertCandidates(candidates);
  const summary = {
    ...stats,
    inserted,
    insertFailed: failed,
    highWaterId: end,
    runAt: new Date().toISOString(),
  };
  await saveDiscoveryState(summary);
  console.log(`[Discovery] summary=${JSON.stringify(summary)}`);
  return summary;
}

async function main() {
  try {
    console.log('[SNKRDUNK Discovery] Starting high-water direct product mode');
    const summary = await discoverHighWater();
    if (summary.fetchFailed > 0) {
      console.warn(`[Discovery] Completed with ${summary.fetchFailed} retriable product request failures; the next overlap window will retry them.`);
    }
  } finally {
    if (pool) await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[SNKRDUNK Discovery] Fatal:', error);
    process.exit(1);
  });
}
