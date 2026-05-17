// Find which data sources fail with "The string did not match the expected pattern"
process.env.NODE_ENV = 'development';

const db = await import('./server/db.js');
const { extractSnkrdunkId, fetchCardDetailsFromApi, fetchPriceHistoryFromApi, convertJpyToHkd } = await import('./server/snkrdunkScraper.js');
const { normaliseGrade } = await import('./server/utils/priceValidator.js');

// Get a batch of data sources to test
const { getDb } = await import('./server/db.js');
const { dataSources } = await import('./drizzle/schema_new.js');
const { eq, desc, limit } = await import('drizzle-orm');

const dbConn = await getDb();
const sources = await dbConn
  .select()
  .from(dataSources)
  .limit(20)
  .orderBy(desc(dataSources.id));

console.log(`Testing ${sources.length} data sources...`);

for (const ds of sources) {
  try {
    const productType = (ds.productType || "single_card");
    const productId = extractSnkrdunkId(ds.sourceUrl);
    if (!productId) continue;
    
    const [cardDetails, priceHistory] = await Promise.all([
      fetchCardDetailsFromApi(productId),
      fetchPriceHistoryFromApi(productId, productType),
    ]);
    
    // Simulate the full insert loop
    const groupCounters = new Map();
    for (const entry of priceHistory) {
      const rawPrice = entry.price;
      if (rawPrice === undefined || rawPrice === null || isNaN(rawPrice)) continue;
      
      const priceHkd = convertJpyToHkd(rawPrice);
      const normalisedGrade = productType === 'sealed_product' ? undefined : normaliseGrade(entry.grade);
      const soldAtStr = entry.soldAt ? entry.soldAt.toISOString().slice(0, 10) : 'unknown';
      const gradeKey = normalisedGrade ?? 'null';
      const groupKey = `${soldAtStr}|${gradeKey}|${rawPrice}`;
      const sourcePosition = groupCounters.get(groupKey) ?? 0;
      groupCounters.set(groupKey, sourcePosition + 1);
      
      await db.addPriceHistory({
        cardId: ds.cardId,
        source: "snkrdunk",
        price: priceHkd.toString(),
        currency: "HKD",
        jpyPrice: rawPrice,
        sourcePosition,
        grade: normalisedGrade,
        quantity: productType === 'sealed_product' ? entry.quantity : undefined,
        productType,
        soldAt: entry.soldAt,
        listingUrl: ds.sourceUrl,
        isRelativeTime: entry.isRelativeTime,
        estimatedSoldAt: entry.estimatedSoldAt,
      });
    }
    
    console.log(`OK: id=${ds.id} productId=${productId} prices=${priceHistory.length}`);
  } catch(e) {
    console.error(`FAIL: id=${ds.id} url=${ds.sourceUrl} ERROR: ${e.message}`);
  }
}

process.exit(0);
