import { eq } from "drizzle-orm";
import * as db from "./db";
import { scheduledTasks } from "../drizzle/schema";
import { scrapeSnkrdunkPage, convertJpyToHkd, extractSnkrdunkId } from "./snkrdunkScraper";

const BATCH_SIZE = 10; // Increased from 5 to 10 for better performance
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

interface BatchAddProgress {
  processed: number;
  total: number;
  successCount: number;
  failedCount: number;
  errors: string[];
  failedUrls: string[];
  duplicateCount: number;
}

export async function persistentBulkAddDataSources(
  taskId: number,
  urls: string[]
): Promise<void> {
  console.log(`[PersistentBulkAddDataSources] Starting task ${taskId} with ${urls.length} URLs`);

  const progress: BatchAddProgress = {
    processed: 0,
    total: urls.length,
    successCount: 0,
    failedCount: 0,
    errors: [],
    failedUrls: [],
    duplicateCount: 0,
  };

  try {
    // Process URLs in batches
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      // Check if task is paused or cancelled
      const dbInst = await db.getDb();
      if (!dbInst) throw new Error("Database not available");
      const [task] = await dbInst.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId)).limit(1);

      if (!task) {
        console.log(`[PersistentBulkAddDataSources] Task ${taskId} not found, stopping`);
        return;
      }

      if (task.status === 'completed') {
        console.log(`[PersistentBulkAddDataSources] Task ${taskId} was cancelled, stopping`);
        return;
      }

      // Wait while task is paused
      while (await isTaskPaused(taskId)) {
        console.log(`[PersistentBulkAddDataSources] Task ${taskId} is paused, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchEnd = Math.min(i + BATCH_SIZE, urls.length);

      console.log(`[PersistentBulkAddDataSources] Processing batch ${i}-${batchEnd} of ${urls.length}`);

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            // Extract SNKRDUNK ID
            const snkrdunkId = extractSnkrdunkId(url);
            if (!snkrdunkId) {
              return { success: false, url, error: 'Invalid SNKRDUNK URL' };
            }

            // Normalize URL for duplicate check
            const normalizedUrl = url.split('?')[0].split('#')[0];
            
            // Check if data source already exists
            const allDataSourcesResult = await db.getDataSources();
            const existingDataSource = allDataSourcesResult.data.find((ds: any) => {
              const existingNormalized = ds.sourceUrl.split('?')[0].split('#')[0];
              return existingNormalized === normalizedUrl;
            });

            if (existingDataSource) {
              return { success: false, url, error: 'Duplicate', isDuplicate: true };
            }

            // Scrape SNKRDUNK page
            const cardData = await scrapeSnkrdunkPage(url);

            // Create or update card
            const existingCard = await db.getCardByCardId(`snkrdunk-${snkrdunkId}`);
            let cardId: number;

            if (existingCard) {
              cardId = existingCard.id;
              await db.updateCard(cardId, {
                name: cardData.name,
                nameJa: cardData.nameJa,
                imageUrl: cardData.imageUrl || undefined,
              });
            } else {
              cardId = await db.createCard({
                cardId: `snkrdunk-${snkrdunkId}`,
                name: cardData.name,
                nameJa: cardData.nameJa,
                imageUrl: cardData.imageUrl || undefined,
              });
            }

            // Add data source
            await db.addDataSource({
              cardId,
              source: "snkrdunk",
              sourceUrl: url,
              sourceIdentifier: snkrdunkId,
            });

            // Save price history
            for (const priceEntry of cardData.priceHistory) {
              const priceHkd = convertJpyToHkd(priceEntry.price);
              await db.addPriceHistory({
                cardId,
                source: "snkrdunk",
                price: priceHkd.toString(),
                currency: "HKD",
                grade: priceEntry.grade,
                soldAt: priceEntry.soldAt,
                listingUrl: url,
              });
            }

            // Update data source status
            const dataSourcesResult = await db.getDataSources();
            const newDataSource = dataSourcesResult.data.find(
              (ds) => ds.cardId === cardId && ds.source === "snkrdunk"
            );
            if (newDataSource) {
              await db.updateDataSourceFetchStatus(newDataSource.id, "success");
            }

            return { success: true, url };
          } catch (error: any) {
            return { success: false, url, error: error.message };
          }
        })
      );

      // Count successes and failures
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          progress.successCount++;
        } else {
          const url = batch[index];
          const errorMsg = result.status === 'fulfilled' 
            ? result.value.error 
            : (result.reason as any)?.message || '未知錯誤';
          
          // Check if it's a duplicate
          if (result.status === 'fulfilled' && (result.value as any).isDuplicate) {
            progress.duplicateCount++;
          } else {
            progress.failedCount++;
            progress.errors.push(`${url}: ${errorMsg}`);
            progress.failedUrls.push(url);
          }
        }
      });

      progress.processed = batchEnd;

      // Update task progress
      const progressPercentage = Math.floor((progress.processed / progress.total) * 100);
      const dbInst2 = await db.getDb();
      if (!dbInst2) throw new Error("Database not available");
      await dbInst2
        .update(scheduledTasks)
        .set({
          progress: progressPercentage,
          metadata: JSON.stringify(progress),
        })
        .where(eq(scheduledTasks.id, taskId));

      console.log(`[PersistentBulkAddDataSources] Progress: ${progress.processed}/${progress.total} (${progressPercentage}%)`);

      // Add delay between batches to avoid rate limits (except for last batch)
      if (i + BATCH_SIZE < urls.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Mark task as completed
    const dbInst3 = await db.getDb();
    if (!dbInst3) throw new Error("Database not available");
    await dbInst3
      .update(scheduledTasks)
      .set({
        status: 'completed',
        progress: 100,
        metadata: JSON.stringify(progress),
      })
      .where(eq(scheduledTasks.id, taskId));

    console.log(`[PersistentBulkAddDataSources] Task ${taskId} completed: ${progress.successCount} success, ${progress.failedCount} failed`);
  } catch (error: any) {
    console.error(`[PersistentBulkAddDataSources] Task ${taskId} failed:`, error);
    
    // Mark task as failed
    const dbInst4 = await db.getDb();
    if (dbInst4) {
      await dbInst4
        .update(scheduledTasks)
        .set({
          status: 'completed',
          metadata: JSON.stringify({
            ...progress,
            error: error.message,
          }),
        })
        .where(eq(scheduledTasks.id, taskId));
    }
  }
}

async function isTaskPaused(taskId: number): Promise<boolean> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return false;
  const [task] = await dbInstance.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId)).limit(1);
  return task?.status === 'paused';
}
