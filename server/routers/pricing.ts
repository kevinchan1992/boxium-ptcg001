import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { fetchEbayListings } from '../services/ebay';
import { scrapeSnkrdunkListings } from '../services/snkrdunkScraperService';
import { convertToHKD } from '../utils/currency';
import * as db from '../db';

/**
 * Derive condition from eBay listing title.
 * eBay's condition field only returns "Graded" for PSA/BGS cards;
 * we need to inspect the title to get the actual grade.
 */
function deriveEbayCondition(title: string): string {
  const t = title.toLowerCase();
  if (/\bpsa\s*10\b/.test(t)) return 'PSA 10';
  if (/\bpsa\s*9\.5\b/.test(t)) return 'PSA 9.5';
  if (/\bpsa\s*9\b/.test(t)) return 'PSA 9';
  if (/\bbgs\s*10\b/.test(t)) return 'BGS 10';
  if (/\bbgs\s*9\.5\b/.test(t)) return 'BGS 9.5';
  if (/\bcgc\s*10\b/.test(t)) return 'CGC 10';
  return 'Used';
}

export const pricingRouter = router({
  getListings: publicProcedure
    .input(
      z.object({
        cardId: z.number().optional(),
        snkrdunkId: z.string().optional(),
      }).refine(data => data.cardId || data.snkrdunkId, {
        message: 'Either cardId or snkrdunkId must be provided',
      })
    )
    .query(async ({ input }) => {
      const { cardId, snkrdunkId } = input;

      console.log(`[Pricing Router] Get listings for cardId: ${cardId}, snkrdunkId: ${snkrdunkId}`);

      try {
        // Step 1: Get card details from database (support both cardId and snkrdunkId)
        let card;
        if (cardId) {
          card = await db.getCardById(cardId);
        } else if (snkrdunkId) {
          card = await db.getCardBySnkrdunkId(snkrdunkId);
        }
        
        if (!card) {
          throw new Error('Card not found');
        }
        
        const actualCardId = card.id;

        // Step 2: Fetch from eBay Browse API (text search)
        console.log('[Pricing Router] Fetching from eBay Browse API...');
        let ebayListings: any[] = [];
        try {
          const cardNumber = card.cardNumber || '';
          const now = new Date();

          // ── PSA 10 search ──────────────────────────────────────────────
          const psa10SearchQuery = cardNumber ? `${cardNumber} PSA10` : `${card.name} PSA10`;
          console.log(`[Pricing Router] eBay PSA10 search query: "${psa10SearchQuery}"`);
          const psa10CacheKey = `text-search-${actualCardId}`;
          const psa10Cache = await db.getEbayListingsCache(actualCardId, psa10CacheKey);

          let psa10Listings: any[] = [];
          if (psa10Cache && psa10Cache.hotExpiresAt && new Date(psa10Cache.hotExpiresAt) > now) {
            console.log(`[Pricing Router] Using eBay PSA10 hot cache`);
            try {
              psa10Listings = typeof psa10Cache.listings === 'string'
                ? JSON.parse(psa10Cache.listings)
                : psa10Cache.listings;
            } catch { psa10Listings = []; }
          } else if (cardNumber) {
            const rawResults = await fetchEbayListings({ cardName: psa10SearchQuery });
            // Filter: must have PSA 10 in title, derive condition from title
            const filtered = (rawResults || []).filter((item: any) => {
              const t = item.title.toLowerCase();
              if (!/\bpsa\s*10\b/.test(t)) return false;
              const excludeGrades = [/\bpsa\s*9\b/, /\bpsa\s*8\b/, /\bpsa\s*7\b/, /\bpsa\s*6\b/, /\bpsa\s*5\b/, /\bpsa\s*4\b/, /\bpsa\s*3\b/, /\bpsa\s*2\b/, /\bpsa\s*1\b/];
              if (excludeGrades.some(p => p.test(t))) return false;
              const excludeItems = ['bgs', 'cgc', 'sgc', 'beckett', 'raw', 'ungraded', 'not graded', 'sleeve', 'sleeves', 'deck box', 'deckbox', 'playmat', 'binder', 'case', 'holder', 'toploader', 'protector', 'lot', 'bundle', 'collection'];
              return !excludeItems.some(p => t.includes(p));
            }).map((item: any) => ({ ...item, condition: deriveEbayCondition(item.title) }));
            console.log(`[Pricing Router] eBay PSA10 filtered: ${filtered.length}/${rawResults?.length || 0}`);
            // Merge with cold cache
            let merged = filtered;
            if (psa10Cache && new Date(psa10Cache.expiresAt) > now) {
              const cached = typeof psa10Cache.listings === 'string' ? JSON.parse(psa10Cache.listings) : psa10Cache.listings;
              const newIds = new Set(filtered.map((i: any) => i.id));
              merged = [...filtered, ...cached.filter((i: any) => !newIds.has(i.id))];
            }
            await db.saveEbayListingsCache({ cardId: actualCardId, searchQuery: psa10SearchQuery, listings: JSON.stringify(merged), hotExpiresAt: new Date(now.getTime() + 3600000), expiresAt: new Date(now.getTime() + 21600000) });
            psa10Listings = merged;
          }

          // ── Used / ungraded search ─────────────────────────────────────
          const usedSearchQuery = cardNumber ? `${cardNumber} pokemon card japanese` : `${card.name} pokemon card japanese`;
          console.log(`[Pricing Router] eBay used search query: "${usedSearchQuery}"`);
          const usedCacheKey = `used-search-${actualCardId}`;
          const usedCache = await db.getEbayListingsCache(actualCardId, usedCacheKey);

          let usedListings: any[] = [];
          if (usedCache && usedCache.hotExpiresAt && new Date(usedCache.hotExpiresAt) > now) {
            console.log(`[Pricing Router] Using eBay used hot cache`);
            try {
              usedListings = typeof usedCache.listings === 'string'
                ? JSON.parse(usedCache.listings)
                : usedCache.listings;
            } catch { usedListings = []; }
          } else if (cardNumber) {
            const rawUsed = await fetchEbayListings({ cardName: usedSearchQuery });
            // Exclude PSA/BGS/CGC graded items (they belong in psa10 bucket)
            const filteredUsed = (rawUsed || []).filter((item: any) => {
              const t = item.title.toLowerCase();
              if (/\bpsa\b/.test(t) || /\bbgs\b/.test(t) || /\bcgc\b/.test(t) || /\bsgc\b/.test(t)) return false;
              const excludeItems = ['sleeve', 'sleeves', 'deck box', 'deckbox', 'playmat', 'binder', 'case', 'holder', 'toploader', 'protector', 'lot', 'bundle', 'collection'];
              return !excludeItems.some(p => t.includes(p));
            }).map((item: any) => ({ ...item, condition: 'Used', id: `${item.id}-used` }));
            console.log(`[Pricing Router] eBay used filtered: ${filteredUsed.length}/${rawUsed?.length || 0}`);
            let mergedUsed = filteredUsed;
            if (usedCache && new Date(usedCache.expiresAt) > now) {
              const cached = typeof usedCache.listings === 'string' ? JSON.parse(usedCache.listings) : usedCache.listings;
              const newIds = new Set(filteredUsed.map((i: any) => i.id));
              mergedUsed = [...filteredUsed, ...cached.filter((i: any) => !newIds.has(i.id))];
            }
            await db.saveEbayListingsCache({ cardId: actualCardId, searchQuery: usedSearchQuery, listings: JSON.stringify(mergedUsed), hotExpiresAt: new Date(now.getTime() + 3600000), expiresAt: new Date(now.getTime() + 21600000) });
            usedListings = mergedUsed;
          }

          ebayListings = [...psa10Listings, ...usedListings];
          console.log(`[Pricing Router] eBay total: ${ebayListings.length} (PSA10: ${psa10Listings.length}, Used: ${usedListings.length})`);
        } catch (error) {
          console.error('[Pricing Router] eBay fetch error:', error);
          // Continue even if eBay fails
        }

        // Step 3: Fetch SNKRDUNK listings using Playwright (with caching) - all conditions
        console.log('[Pricing Router] Fetching from SNKRDUNK...');
        let snkrdunkListings: any[] = [];
        try {
          // Get SNKRDUNK data source for this card
          const dataSource = await db.getDataSourceByCardIdAndSource(actualCardId, 'snkrdunk');
          
          if (dataSource && dataSource.sourceUrl) {
            // Extract SNKRDUNK ID from URL (e.g., https://snkrdunk.com/apparels/93009 → 93009)
            const snkrdunkIdMatch = dataSource.sourceUrl.match(/\/apparels\/(\d+)/);
            if (snkrdunkIdMatch) {
              const snkrdunkId = snkrdunkIdMatch[1];
              console.log(`[Pricing Router] SNKRDUNK ID: ${snkrdunkId}`);
              
              // Check cache first (dual-layer caching: hot cache 1h + cold cache 6h)
              const cache = await db.getSnkrdunkListingsCache(actualCardId);
              const now = new Date();
              
              // Check hot cache first
              if (cache && cache.hotExpiresAt && new Date(cache.hotExpiresAt) > now) {
                // Hot cache is valid, use cached data directly
                console.log(`[Pricing Router] Using hot cache (expires at ${cache.hotExpiresAt})`);
                const cachedListings = JSON.parse(cache.listings);
                // Filter out sold items from cache (in case old cache contains sold items)
                const onSaleCachedListings = cachedListings.filter(
                  (item: any) => !item.status || item.status === 'on-sale'
                );
                snkrdunkListings = onSaleCachedListings.map((item: any) => ({
                  id: `snkrdunk-${item.url}`,
                  title: `${card.name} ${item.grade}`,
                  price: item.price,
                  currency: item.currency,
                  imageUrl: item.image || card.imageUrl || '',
                  source: 'snkrdunk' as const,
                  buyUrl: item.url,
                  seller: 'SNKRDUNK',
                  condition: item.grade,
                }));
                console.log(`[Pricing Router] Hot cache returned ${snkrdunkListings.length} on-sale listings (filtered from ${cachedListings.length} total)`);
              } else {
                // Hot cache expired or doesn't exist, scrape new data
                console.log('[Pricing Router] Hot cache expired, scraping SNKRDUNK...');
                
                try {
                  const newListings = await scrapeSnkrdunkListings(snkrdunkId);
                  
                  // URL deduplication: merge new listings with cached listings
                  let mergedListings = newListings;
                  if (cache && new Date(cache.expiresAt) > now) {
                    // Cold cache is still valid, merge with new listings
                    const cachedListings = JSON.parse(cache.listings);
                    const newUrls = new Set(newListings.map(item => item.url));
                    const uniqueCachedListings = cachedListings.filter(
                      (item: any) => !newUrls.has(item.url)
                    );
                    mergedListings = [...newListings, ...uniqueCachedListings];
                    console.log(`[Pricing Router] Merged ${newListings.length} new + ${uniqueCachedListings.length} cached = ${mergedListings.length} total`);
                  }
                  
                  // Only save to cache if we have results (don't cache empty results)
                  if (mergedListings.length > 0) {
                    const hotExpiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
                    const coldExpiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
                    await db.saveSnkrdunkListingsCache({
                      cardId: actualCardId,
                      snkrdunkId,
                      listings: JSON.stringify(mergedListings),
                      hotExpiresAt,
                      expiresAt: coldExpiresAt,
                    });
                    console.log(`[Pricing Router] Saved ${mergedListings.length} SNKRDUNK listings to cache (hot: ${hotExpiresAt}, cold: ${coldExpiresAt})`);
                  } else {
                    // If scraping returned no results, clear the old cache to force retry next time
                    console.log(`[Pricing Router] WARNING: Scraping returned 0 listings, clearing old cache to force retry`);
                    await db.clearSnkrdunkCacheByCardId(actualCardId);
                  }
                  
                  snkrdunkListings = mergedListings.map((item) => ({
                    id: `snkrdunk-${item.url}`,
                    title: `${card.name} ${item.grade}`,
                    price: item.price,
                    currency: item.currency,
                    imageUrl: item.image || card.imageUrl || '',
                    source: 'snkrdunk' as const,
                    buyUrl: item.url,
                    seller: 'SNKRDUNK',
                    condition: item.grade,
                  }));
                  console.log(`[Pricing Router] SNKRDUNK returned ${snkrdunkListings.length} listings`);
                } catch (scrapeError) {
                  // If scraping fails, clear the old cache and log detailed error
                  console.error(`[Pricing Router] SNKRDUNK scraping failed for cardId ${actualCardId}, snkrdunkId ${snkrdunkId}:`, scrapeError);
                  console.log(`[Pricing Router] Clearing old cache due to scraping failure`);
                  await db.clearSnkrdunkCacheByCardId(actualCardId);
                  
                  // Re-throw error to be caught by outer catch block
                  throw scrapeError;
                }
                
              }
            } else {
              console.log('[Pricing Router] Could not extract SNKRDUNK ID from URL');
            }
          } else {
            console.log('[Pricing Router] No SNKRDUNK data source found for this card');
          }
        } catch (error) {
          console.error('[Pricing Router] SNKRDUNK fetch error:', error);
          // Continue even if SNKRDUNK fails
        }

        // Step 4: Transform eBay listings to unified format (convert all prices to HKD)
        const ebayFormattedListings = ebayListings.map((item: any) => {
          const priceInHKD = item.currency === 'HKD' ? item.price : convertToHKD(item.price, item.currency);
          return {
            id: item.id,
            title: item.title,
            price: priceInHKD,
            currency: 'HKD',
            imageUrl: item.image,
            source: 'ebay' as const,
            buyUrl: item.productUrl,
            seller: item.seller?.name,
            condition: item.condition,
          };
        });

        // Step 5: Merge eBay and SNKRDUNK listings
        const listings = [...ebayFormattedListings, ...snkrdunkListings];
        
        // Step 6: Sort by price (lowest first)
        listings.sort((a, b) => a.price - b.price);

        console.log(`[Pricing Router] Returning ${listings.length} total listings (${ebayFormattedListings.length} eBay + ${snkrdunkListings.length} SNKRDUNK)`);

        return {
          card,
          listings,
        };
      } catch (error) {
        console.error('[Pricing Router] Get listings error:', error);
        throw new Error('Failed to fetch pricing listings');
      }
    }),

  // Admin: clear SNKRDUNK + eBay cache for a card so next request re-fetches fresh data
  clearCache: protectedProcedure
    .input(z.object({ cardId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      }
      const snkrdunkCleared = await db.clearSnkrdunkCacheByCardId(input.cardId);
      await db.clearEbayCacheByCardId(input.cardId);
      console.log(`[Pricing Router] Cleared cache for cardId=${input.cardId} (SNKRDUNK: ${snkrdunkCleared} rows)`);
      return { success: true, snkrdunkCleared };
    }),
});
