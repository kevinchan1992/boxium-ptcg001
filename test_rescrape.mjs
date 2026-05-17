// Test the refreshDataSource flow with the failing data source IDs
process.env.NODE_ENV = 'development';

const db = await import('./server/db.js');
const { extractSnkrdunkId, fetchCardDetailsFromApi, fetchPriceHistoryFromApi, convertJpyToHkd } = await import('./server/snkrdunkScraper.js');
const { normaliseGrade } = await import('./server/utils/priceValidator.js');

const testIds = [1830565, 1830448];

for (const dsId of testIds) {
  console.log(`\n=== Testing dataSourceId: ${dsId} ===`);
  try {
    const dataSource = await db.getDataSourceById(dsId);
    if (!dataSource) { console.log('Data source not found'); continue; }
    
    const productType = (dataSource.productType || "single_card");
    const productId = extractSnkrdunkId(dataSource.sourceUrl);
    console.log('productId:', productId, 'productType:', productType, 'url:', dataSource.sourceUrl);
    
    if (!productId) {
      console.error('ERROR: Cannot extract product ID');
      continue;
    }
    
    const [cardDetails, priceHistory] = await Promise.all([
      fetchCardDetailsFromApi(productId),
      fetchPriceHistoryFromApi(productId, productType),
    ]);
    
    console.log('cardDetails.name:', cardDetails.name);
    console.log('priceHistory count:', priceHistory.length);
    
    if (priceHistory.length > 0) {
      const entry = priceHistory[0];
      console.log('First entry:', JSON.stringify({
        price: entry.price,
        grade: entry.grade,
        soldAt: entry.soldAt?.toISOString(),
        isRelativeTime: entry.isRelativeTime,
      }));
      
      const priceHkd = convertJpyToHkd(entry.price);
      const normalisedGrade = productType === 'sealed_product' ? undefined : normaliseGrade(entry.grade);
      console.log('priceHkd:', priceHkd, 'normalisedGrade:', normalisedGrade);
      
      // Try inserting the first entry to DB
      const soldAtStr = entry.soldAt ? entry.soldAt.toISOString().slice(0, 10) : 'unknown';
      const gradeKey = normalisedGrade ?? 'null';
      const groupKey = `${soldAtStr}|${gradeKey}|${entry.price}`;
      const sourcePosition = 0;
      
      const result = await db.addPriceHistory({
        cardId: dataSource.cardId,
        source: "snkrdunk",
        price: priceHkd.toString(),
        currency: "HKD",
        jpyPrice: entry.price,
        sourcePosition,
        grade: normalisedGrade,
        quantity: productType === 'sealed_product' ? entry.quantity : undefined,
        productType,
        soldAt: entry.soldAt,
        listingUrl: dataSource.sourceUrl,
        isRelativeTime: entry.isRelativeTime,
        estimatedSoldAt: entry.estimatedSoldAt,
      });
      console.log('DB insert result:', result ? 'inserted' : 'skipped (duplicate)');
    }
    
    console.log(`SUCCESS for ${dsId}`);
  } catch(e) {
    console.error(`FAILED for ${dsId}:`, e.message);
    console.error('Stack:', e.stack?.split('\n').slice(0, 8).join('\n'));
  }
}

process.exit(0);
