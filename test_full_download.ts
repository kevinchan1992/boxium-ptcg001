import { getDb } from './server/db';
import { cardInventory } from './drizzle/schema_new';
import https from 'https';
import sharp from 'sharp';

async function fetchAndResize(url: string): Promise<Buffer | null> {
  if (!url) return null;
  const rawBuf = await new Promise<Buffer | null>((resolve) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
  if (!rawBuf) return null;
  // Resize to small thumbnail (100x140) to reduce processing time
  return sharp(rawBuf).resize(100, 140, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
}

async function main() {
  const db = await getDb();
  const rows = await db.select({ s3ImageUrl: cardInventory.s3ImageUrl }).from(cardInventory);
  console.log(`Total rows: ${rows.length}`);
  
  const start = Date.now();
  let processed = 0;
  
  // Process in batches of 10 (parallel)
  for (let i = 0; i < rows.length; i += 10) {
    const batch = rows.slice(i, i + 10);
    await Promise.all(batch.map(r => fetchAndResize(r.s3ImageUrl || '')));
    processed += batch.length;
    console.log(`Processed ${processed}/${rows.length} in ${Date.now() - start}ms`);
  }
  
  console.log(`TOTAL TIME: ${Date.now() - start}ms`);
}

main().catch(console.error);
