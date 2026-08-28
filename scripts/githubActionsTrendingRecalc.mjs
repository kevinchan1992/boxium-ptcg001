/**
 * Rebuild the homepage trending-card cache directly with the same MySQL/TiDB
 * database secret used by the existing SNKRDUNK GitHub updater. This removes
 * the dependency on a platform callback token while keeping the calculation
 * semantics aligned with server/db.ts.
 */
import mysql from "mysql2/promise";

process.env.TZ = "Asia/Hong_Kong";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be configured as a GitHub Actions secret.");

const databaseUrlWithTimezone = databaseUrl.includes("timezone=")
  ? databaseUrl
  : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}timezone=%2B08:00`;

const pool = mysql.createPool({
  uri: databaseUrlWithTimezone,
  connectionLimit: 2,
  charset: "utf8mb4",
  connectTimeout: 30_000,
});

function averageRounded(rows) {
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row.price), 0) / rows.length);
}

async function getReferencePrice(connection, cardId, now, before = false) {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start = new Date(cutoff);
  start.setMonth(start.getMonth() - 6);

  const [rows] = await connection.execute(
    before
      ? `SELECT price
           FROM priceHistory
          WHERE cardId = ? AND source = 'snkrdunk' AND grade = 'PSA 10'
            AND isSuspectedBulk = FALSE AND soldAt IS NOT NULL
            AND soldAt >= ? AND soldAt < ?
          ORDER BY soldAt DESC
          LIMIT 10`
      : `SELECT price
           FROM priceHistory
          WHERE cardId = ? AND source = 'snkrdunk' AND grade = 'PSA 10'
            AND isSuspectedBulk = FALSE AND soldAt IS NOT NULL
            AND soldAt >= ?
          ORDER BY soldAt DESC
          LIMIT 10`,
    before ? [cardId, start, cutoff] : [cardId, (() => {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return sixMonthsAgo;
    })()],
  );

  if (!before && rows.length === 0) {
    const [fallbackRows] = await connection.execute(
      `SELECT price
         FROM priceHistory
        WHERE cardId = ? AND source = 'snkrdunk' AND grade = 'PSA 10'
          AND isSuspectedBulk = FALSE AND soldAt IS NOT NULL
        ORDER BY soldAt DESC
        LIMIT 10`,
      [cardId],
    );
    return averageRounded(fallbackRows);
  }

  return averageRounded(rows);
}

async function rebuildTrendingCache() {
  const connection = await pool.getConnection();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [candidates] = await connection.execute(
      `SELECT ph.cardId, c.gameId, COUNT(*) AS transactionCount, MAX(ph.soldAt) AS latestSoldAt
         FROM priceHistory ph
         INNER JOIN cards c ON c.id = ph.cardId
        WHERE ph.source = 'snkrdunk'
          AND ph.grade = 'PSA 10'
          AND ph.productType = 'single_card'
          AND ph.isSuspectedBulk = FALSE
          AND ph.soldAt IS NOT NULL
          AND ph.soldAt >= ? AND ph.soldAt <= ?
        GROUP BY ph.cardId, c.gameId`,
      [sevenDaysAgo, now],
    );

    candidates.sort((a, b) =>
      Number(b.transactionCount) - Number(a.transactionCount) ||
      new Date(b.latestSoldAt).getTime() - new Date(a.latestSoldAt).getTime() ||
      Number(a.cardId) - Number(b.cardId),
    );

    const perGame = new Map();
    for (const candidate of candidates) {
      const gameId = Number(candidate.gameId ?? 1);
      const list = perGame.get(gameId) ?? [];
      if (list.length < 5) list.push({ ...candidate, gameId });
      perGame.set(gameId, list);
    }
    const topCards = [...perGame.values()].flat();

    const entries = [];
    for (const list of perGame.values()) {
      for (let index = 0; index < list.length; index += 1) {
        const card = list[index];
        const [currentPrice, oldPrice] = await Promise.all([
          getReferencePrice(connection, Number(card.cardId), now),
          getReferencePrice(connection, Number(card.cardId), now, true),
        ]);
        const priceChange7d = oldPrice > 0 && currentPrice > 0
          ? ((currentPrice - oldPrice) / oldPrice) * 100
          : 0;
        entries.push([
          Number(card.cardId),
          index + 1,
          priceChange7d.toFixed(2),
          oldPrice.toFixed(2),
          currentPrice.toFixed(2),
          now,
        ]);
      }
    }

    await connection.beginTransaction();
    await connection.query("DELETE FROM trendingCardsCache");
    if (entries.length > 0) {
      await connection.query(
        `INSERT INTO trendingCardsCache
          (cardId, \`rank\`, priceChange7d, oldPrice, currentPrice, calculatedAt)
         VALUES ?`,
        [entries],
      );
    }
    await connection.commit();

    console.log(`[TrendingRecalc] Rebuilt ${entries.length} cache rows across ${perGame.size} games from ${candidates.length} eligible transactions.`);
    console.log(`[TrendingRecalc] Window: ${sevenDaysAgo.toISOString()} → ${now.toISOString()}`);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

rebuildTrendingCache()
  .catch((error) => {
    console.error(`[TrendingRecalc] Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
