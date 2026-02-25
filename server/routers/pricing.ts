import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { fetchEbayListings } from '../services/ebay';
import { scrapeSnkrdunkListings } from '../services/snkrdunkScraperService';
import { ebayRateLimiter } from '../services/rateLimiter';
import * as db from '../db';
import { searchEbayByImage } from '../ebayImageSearch';
import { convertUsdToHkd } from '../ebay';
import { downloadAndEncodeImage, getBestImageUrl } from '../imageUtils';

interface PriceListing {
  id: string;
  market: 'ebay' | 'snkrdunk';
  title: string;
  price: number;
  currency: string;
  image: string;
  productUrl: string;
  seller: {
    name: string;
    rating?: number;
  };
  grade: string;
  condition: string;
  lastUpdated: string;
}

interface PriceStats {
  totalCount: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  marketDistribution: {
    ebay: number;
    snkrdunk: number;
  };
}

/**
 * Calculate price statistics from listings
 */
function calculateStats(listings: PriceListing[]): PriceStats {
  if (listings.length === 0) {
    return {
      totalCount: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      marketDistribution: {
        ebay: 0,
        snkrdunk: 0,
      },
    };
  }

  const prices = listings.map((l) => l.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  const ebayCount = listings.filter((l) => l.market === 'ebay').length;
  const snkrdunkCount = listings.filter((l) => l.market === 'snkrdunk').length;

  return {
    totalCount: listings.length,
    minPrice,
    maxPrice,
    avgPrice,
    marketDistribution: {
      ebay: ebayCount,
      snkrdunk: snkrdunkCount,
    },
  };
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

        // Step 2: Fetch from eBay API using image search for PSA10 (with dual-layer caching and rate limiting)
        console.log('[Pricing Router] Fetching from eBay using image search...');
        let ebayListings: any[] = [];
        try {
          const searchQuery = `image-search-${actualCardId}`; // Use cardId as cache key for image search
          
          // Check cache first (dual-layer caching: hot cache 1h + cold cache 6h)
          const cache = await db.getEbayListingsCache(actualCardId, searchQuery);
          const now = new Date();
          
          // Check hot cache first
          if (cache && cache.hotExpiresAt && new Date(cache.hotExpiresAt) > now) {
            // Hot cache is valid, use cached data directly
            console.log(`[Pricing Router] Using eBay hot cache (expires at ${cache.hotExpiresAt})`);
            
            try {
              // Handle both string and object types (Drizzle may auto-parse JSON)
              let cachedListings;
              if (typeof cache.listings === 'string') {
                cachedListings = JSON.parse(cache.listings);
              } else if (Array.isArray(cache.listings)) {
                cachedListings = cache.listings;
              } else {
                throw new Error(`Unexpected cache.listings type: ${typeof cache.listings}`);
              }
              
              ebayListings = cachedListings;
              console.log(`[Pricing Router] eBay hot cache returned ${ebayListings.length} listings`);
            } catch (parseError) {
              console.error(`[Pricing Router] Failed to parse eBay cache listings:`, parseError);
              console.error(`[Pricing Router] cache.listings type: ${typeof cache.listings}`);
              console.error(`[Pricing Router] cache.listings value:`, cache.listings);
              // Clear invalid cache and continue without eBay listings
              ebayListings = [];
            }
          } else {
            // Hot cache expired or doesn't exist, check rate limiter
            if (ebayRateLimiter.tryConsume()) {
              console.log('[Pricing Router] eBay hot cache expired, using image search...');
              
              // Get best image URL for the card
              const imageUrl = getBestImageUrl(card);
              if (!imageUrl) {
                console.log('[Pricing Router] No image URL available for eBay image search');
                ebayListings = [];
              } else {
                // Download and encode image
                console.log(`[Pricing Router] Downloading image: ${imageUrl}`);
                const base64Image = await downloadAndEncodeImage(imageUrl);
                
                // Search eBay by image
                console.log('[Pricing Router] Searching eBay by image...');
                const imageSearchResponse = await searchEbayByImage(
                  base64Image,
                  '183454', // Pokemon TCG category
                  50 // Limit
                );
                
                // Filter for PSA 10 items only (check title)
                const psa10Items = (imageSearchResponse.itemSummaries || []).filter(item => {
                  const title = item.title.toLowerCase();
                  // Must contain "psa" and "10" (or "psa 10" or "psa10")
                  return (title.includes('psa') && title.includes('10')) || 
                         title.includes('psa 10') || 
                         title.includes('psa10');
                });
                
                console.log(`[Pricing Router] Filtered ${psa10Items.length}/${imageSearchResponse.itemSummaries?.length || 0} PSA 10 items from eBay image search`);
                
                // Transform to expected format and convert prices to HKD
                const newListings = await Promise.all(
                  psa10Items.map(async (item) => {
                    try {
                      const usdPrice = parseFloat(item.price.value);
                      const hkdPrice = await convertUsdToHkd(usdPrice);
                      
                      return {
                        id: `ebay-${item.itemId}`,
                        title: item.title,
                        price: hkdPrice,
                        currency: 'HKD',
                        image: item.image?.imageUrl || '',
                        productUrl: item.itemWebUrl,
                        seller: { name: 'eBay Seller' },
                        condition: 'PSA 10',
                      };
                    } catch (error) {
                      console.error(`[Pricing Router] Error converting price for item ${item.itemId}:`, error);
                      return null;
                    }
                  })
                ).then(results => results.filter((item): item is NonNullable<typeof item> => item !== null));
                
                // URL deduplication: merge new listings with cached listings
                let mergedListings = newListings;
                if (cache && new Date(cache.expiresAt) > now) {
                  // Cold cache is still valid, merge with new listings
                  const cachedListings = JSON.parse(cache.listings);
                  const newIds = new Set(newListings.map(item => item.id));
                  const uniqueCachedListings = cachedListings.filter(
                    (item: any) => !newIds.has(item.id)
                  );
                  mergedListings = [...newListings, ...uniqueCachedListings];
                  console.log(`[Pricing Router] Merged ${newListings.length} new + ${uniqueCachedListings.length} cached = ${mergedListings.length} total eBay listings`);
                }
                
                // Save to cache with dual expiration times
                const hotExpiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
                const coldExpiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
                await db.saveEbayListingsCache({
                  cardId: actualCardId,
                  searchQuery,
                  listings: JSON.stringify(mergedListings),
                  hotExpiresAt,
                  expiresAt: coldExpiresAt,
                });
                console.log(`[Pricing Router] Saved eBay data to cache (hot: ${hotExpiresAt}, cold: ${coldExpiresAt})`);
                
                ebayListings = mergedListings;
                console.log(`[Pricing Router] eBay image search returned ${ebayListings.length} listings`);
              }
            } else {
              // Rate limit exceeded, use cold cache if available
              console.log('[Pricing Router] eBay rate limit exceeded, checking cold cache...');
              if (cache && new Date(cache.expiresAt) > now) {
                console.log(`[Pricing Router] Using eBay cold cache (expires at ${cache.expiresAt})`);
                const cachedListings = JSON.parse(cache.listings);
                ebayListings = cachedListings;
                console.log(`[Pricing Router] eBay cold cache returned ${ebayListings.length} listings`);
              } else {
                console.log('[Pricing Router] No valid eBay cache available, skipping eBay listings');
              }
            }
          }
        } catch (error) {
          console.error('[Pricing Router] eBay fetch error:', error);
          // Continue even if eBay fails
        }

        // Step 3: Fetch SNKRDUNK PSA 10 listings using Playwright (with caching)
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
                snkrdunkListings = cachedListings.map((item: any) => ({
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
                console.log(`[Pricing Router] Hot cache returned ${snkrdunkListings.length} listings`);
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

        // Step 4: Transform eBay listings to unified format
        const ebayFormattedListings = ebayListings.map((item: any) => ({
          id: item.id,
          title: item.title,
          price: item.price,
          currency: item.currency,
          imageUrl: item.image,
          source: 'ebay' as const,
          buyUrl: item.productUrl,
          seller: item.seller?.name,
          condition: item.condition,
        }));

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

  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
        forceRefresh: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const { query, forceRefresh } = input;

      console.log(`[Pricing Router] Search request: "${query}", forceRefresh: ${forceRefresh}`);

      try {
        // Step 1: Parse search query
        // For now, treat the entire query as card name
        // TODO: Add more sophisticated parsing (card number, series extraction)
        const cardName = query.trim();

        if (!cardName) {
          return {
            results: [],
            stats: calculateStats([]),
          };
        }

        // Step 2: Fetch from eBay API
        console.log('[Pricing Router] Fetching from eBay...');
        let ebayListings: PriceListing[] = [];
        try {
          ebayListings = await fetchEbayListings({ cardName });
          console.log(`[Pricing Router] eBay returned ${ebayListings.length} listings`);
        } catch (error) {
          console.error('[Pricing Router] eBay fetch error:', error);
          // Continue even if eBay fails
        }

        // Step 3: Fetch from SNKRDUNK
        // TODO: Implement SNKRDUNK service
        console.log('[Pricing Router] SNKRDUNK service not yet implemented');
        const snkrdunkListings: PriceListing[] = [];

        // Step 4: Merge results
        const allListings = [...ebayListings, ...snkrdunkListings];

        // Step 5: Sort by price (lowest first)
        allListings.sort((a, b) => a.price - b.price);

        // Step 6: Calculate stats
        const stats = calculateStats(allListings);

        console.log(`[Pricing Router] Returning ${allListings.length} total listings`);

        return {
          results: allListings,
          stats,
        };
      } catch (error) {
        console.error('[Pricing Router] Search error:', error);
        throw new Error('Failed to search for pricing data');
      }
    }),
});
