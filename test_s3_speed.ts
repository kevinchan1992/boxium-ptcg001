import { getDb } from './server/db';
import { cardInventory } from './drizzle/schema_new';
import { isNotNull } from 'drizzle-orm';
import https from 'https';

async function testS3Speed() {
  const db = await getDb();
  const rows = await db.select({
    id: cardInventory.id,
    s3ImageUrl: cardInventory.s3ImageUrl,
    imageUrl: cardInventory.imageUrl,
  }).from(cardInventory).limit(100);
  
  const withS3 = rows.filter(r => r.s3ImageUrl);
  const withoutS3 = rows.filter(r => !r.s3ImageUrl);
  
  console.log(`Total: ${rows.length}, With S3: ${withS3.length}, Without S3: ${withoutS3.length}`);
  
  if (withS3.length > 0) {
    // Test speed of first 3 S3 images
    const testUrls = withS3.slice(0, 3).map(r => r.s3ImageUrl!);
    for (const url of testUrls) {
      const start = Date.now();
      await new Promise<void>((resolve) => {
        const req = https.get(url, { timeout: 10000 }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const total = Buffer.concat(chunks).length;
            console.log(`S3 image: ${Date.now() - start}ms, size: ${total} bytes, url: ${url.slice(0, 60)}...`);
            resolve();
          });
          res.on('error', () => { console.log('Error'); resolve(); });
        });
        req.on('error', () => { console.log('Request error'); resolve(); });
      });
    }
  }
}

testS3Speed().catch(console.error);
